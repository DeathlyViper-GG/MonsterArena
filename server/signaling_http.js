'use strict';

/*
 HTTP-only authoritative game server
 - NO WebSockets
 - Long-poll snapshots
 - PvE + PvP
*/

import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to client
const CLIENT_DIR = path.resolve(__dirname, "..", "client");

// Serve static assets
app.use(express.static(CLIENT_DIR));
// ✅ DEV: prevent browser caching for JS/CSS so new builds always load
app.disable('etag');
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
    res.set('Cache-Control', 'no-store');
  }
  next();
});

// ✅ FORCE root to load the game
app.get("/", (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, "indexmonster.html"));
});

// Root page → game
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "indexmonster.html"));
});

const PORT = process.env.PORT || 8080;
const TICK_MS = 50; // 100Hz
const LOBBY_INTERVAL = 10_000;
const WORLD = { w: 4000, h: 2800 };
const slotNow = () => Math.floor(now() / LOBBY_INTERVAL);
const slotEndMs = (slot) => (slot + 1) * LOBBY_INTERVAL;
// -----------------------------------------------------------------------------
// Combat tuning (authoritative)
// -----------------------------------------------------------------------------
const PLAYER_SPEED = 240;

// Bullet speeds
const SPD_SHOOTER = 520;
const SPD_SNIPER  = 760;     // faster than shooter
const SPD_BOMB    = 260;     // ~half speed of bullets

// Lifetimes (range control)
const LIFE_SHOOTER = 1.6;    // ~832px at 520
const LIFE_SNIPER  = 2.0;    // ~1520px at 760 (longer, but not infinite)
const LIFE_BOMB    = 0.9;    // ~234px at 260 (short)

// Damage
const DMG_SHOOTER = 10;
const DMG_SNIPER  = 14;      // slightly more
const DMG_BOMB    = 24;      // higher than bullets
const SPLASH_BOMB = 140;     // splash radius

// Healer aura
const HEAL_AURA_R   = 260;
const HEAL_PER_SEC  = 10;

// -----------------------------------------------------------------------------
// Difficulty scaling helpers
// -----------------------------------------------------------------------------
function clampInt(v, a, b){ return Math.max(a, Math.min(b, v|0)); }

function aiTierForWave(w){
  // 0: dumb chase, no strafe, no lead
  // 1: shooter strafe + bomber spacing
  // 2: sniper lead + ravener door-block + stronger coordination
  // 3: healer regroup logic + advanced coordination
  if (w < 4) return 0;
  if (w < 8) return 1;
  if (w < 12) return 2;
  return 3;
}

function removeDeadPlayers(lobby){
  for (const [pid, p] of lobby.players){
    if ((p.hp ?? 0) <= 0){
      lobby.players.delete(pid);
      lobby.inputs.delete(pid); // safety
    }
  }
}

function enemyCountForWave(w){
  // Starts small, ramps up, caps at 30
  // wave1=6, wave2~8, wave3~10, wave6~18, wave10~28, wave11+=30 cap
  const n = 6 + Math.floor(w * 2.2);
  return clampInt(n, 6, 30);
}

function weightedPick(weights){
  // weights: { type: weight, ... }
  let total = 0;
  for (const k in weights) total += Math.max(0, weights[k] || 0);
  if (total <= 0) return 'chaser';
  let r = Math.random() * total;
  for (const k in weights){
    r -= Math.max(0, weights[k] || 0);
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0] || 'chaser';
}

// -----------------------------------------------------------------------------
// Hazard helpers (SERVER-SIDE) — apply to enemies too
// -----------------------------------------------------------------------------
function hazardAt(lobby, x, y, r){
  const hz = lobby.world?.hazards || [];
  for (const h of hz){
    if (circleRectCollide(x, y, r, h)) return h;
  }
  return null;
}

// Quicksand-like pull (server version)
function applySandToEnemy(lobby, e, hz, dt){
  const cx = hz.x + hz.w / 2;
  const cy = hz.y + hz.h / 2;
  const dx = cx - e.x;
  const dy = cy - e.y;
  const dist = Math.hypot(dx, dy) + 1e-6;

  const rx = dx / dist, ry = dy / dist; // toward center
  const tx = -ry, ty = rx;              // tangential

  const maxR = Math.hypot(hz.w, hz.h) * 0.6;
  const closeness = Math.max(0, Math.min(1, 1 - dist / maxR));

  const swirl = 120 + 240 * closeness;
  const pull  =  30 + 180 * closeness;

  const vx = tx * swirl + rx * pull;
  const vy = ty * swirl + ry * pull;

  moveEnemyWithCollide(lobby, e, vx * dt, vy * dt);
}

// Ice drift (server version)
function applyIceToEnemy(lobby, e, hz, dt){
  const t = now() / 1000;
  const seed = (hz.x * 0.013 + hz.y * 0.017);
  const dir = (seed * Math.PI * 2) + Math.sin(t * 0.6 + seed) * 0.9;
  const breath = 0.85 + 0.15 * Math.sin(t * 1.1 + seed * 2.3);
  const slideSpeed = 180 * breath;

  moveEnemyWithCollide(lobby, e, Math.cos(dir) * slideSpeed * dt, Math.sin(dir) * slideSpeed * dt);
}

// Void: 50/50 teleport or kill (server authoritative)
function applyVoidToEnemy(lobby, e, hz){
  e.voidCD = Math.max(0, (e.voidCD || 0));
  if (e.voidCD > 0) return { killed:false };

  const teleport = (Math.random() < 0.5);
  if (teleport){
    const holes = (lobby.world?.hazards || []).filter(h => h.type === 'void' && h !== hz);
    if (holes.length){
      const tgt = holes[(Math.random() * holes.length) | 0];
      const cx = tgt.x + tgt.w / 2, cy = tgt.y + tgt.h / 2;
      const a = Math.random() * Math.PI * 2;
      const r = Math.min(tgt.w, tgt.h) * 0.22;
      e.x = clamp(cx + Math.cos(a) * r, e.r, WORLD.w - e.r);
      e.y = clamp(cy + Math.sin(a) * r, e.r, WORLD.h - e.r);
      e.voidCD = 0.6;
      return { killed:false };
    }
  }

  // kill if teleport not possible or 50% kill roll
  e.hp = 0;
  return { killed:true };
}

// Apply hazard effects to an enemy; return true if enemy should be removed
function applyEnemyHazards(lobby, e, dt){
  e.voidCD = Math.max(0, (e.voidCD || 0) - dt);

  const hz = hazardAt(lobby, e.x, e.y, (e.r || 16) * 0.9);
  if (!hz) return false;

  if (hz.type === 'sand'){
    applySandToEnemy(lobby, e, hz, dt);
    return false;
  }

  if (hz.type === 'ice'){
    applyIceToEnemy(lobby, e, hz, dt);
    return false;
  }

  if (hz.type === 'lava'){
    // server has no phase state; treat lava as lethal contact (matches your help text)
    e.hp = 0;
    return true;
  }

  if (hz.type === 'void'){
    return applyVoidToEnemy(lobby, e, hz).killed;
  }

  // unknown hazard -> lethal
  e.hp = 0;
  return true;
}

function weightsForWave(w){
  // Difficulty composition curve
  // Keep raveners common, introduce specials gradually, higher waves mix high tiers.
  const weights = { chaser: 10, tank: 0, shooter: 0, bomber: 0, sniper: 0, healer: 0 };

  if (w >= 2) weights.tank = 2;
  if (w >= 3) weights.tank = 3;

  if (w >= 4) weights.shooter = 2;
  if (w >= 6) weights.shooter = 3;

  if (w >= 6) weights.bomber = 1;
  if (w >= 8) weights.bomber = 2;

  if (w >= 8) weights.sniper = 1;
  if (w >= 10) weights.sniper = 2;

  if (w >= 10) weights.healer = 1;
  if (w >= 14) weights.healer = 2;

  // Raveners still exist but proportionally less later
  if (w >= 10) weights.chaser = 9;
  if (w >= 14) weights.chaser = 8;
  if (w >= 18) weights.chaser = 7;

  return weights;
}

// -----------------------------------------------------------------------------
// Building/door helpers (for door blocking behaviour)
// -----------------------------------------------------------------------------
function pointInRect(px, py, r){
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function buildingAt(buildings, x, y){
  for (const b of buildings || []){
    if (b && b.inner && pointInRect(x, y, b.inner)) return b;
  }
  return null;
}

function doorCenters(b){
  const out = [];
  for (const d of (b?.doors || [])){
    out.push({ x: d.x + d.w/2, y: d.y + d.h/2 });
  }
  return out;
}

function nearestDoorPoint(b, x, y){
  let best = null, bestD2 = Infinity;
  for (const p of doorCenters(b)){
    const d2 = dist2(x, y, p.x, p.y);
    if (d2 < bestD2){ bestD2 = d2; best = p; }
  }
  return best;
}

// Contact DPS (chip vs heavy)
function touchDps(type, bossVariant=0){
  if (type === 'tank') return 42;            // lots
  if (type === 'chaser') return 9;           // chip
  if (type === 'boss') {
    if (bossVariant === 2) return 16;        // wave10 runner: not huge
    return 30;
  }
  if (type === 'bomber') return 12;
  if (type === 'sniper') return 8;
  if (type === 'shooter') return 10;
  if (type === 'healer') return 6;
  return 10;
}

// -----------------------------------------------------------------------------
// Player HP helpers (server authoritative)
// -----------------------------------------------------------------------------
function clampHp(p){
  p.hp = Math.max(0, Math.min(100, p.hp ?? 100));
}

function applyPlayerDamage(lobby, playerId, dmg){
  const p = lobby.players.get(playerId);
  if (!p) return;
  p.hp = (p.hp ?? 100) - dmg;
  clampHp(p);
}
function handlePvPPlayerBulletHits(lobby, b, bulletIndex){
  if (lobby.mode !== 'pvp') return false;

  // Only bullets fired by a real player can hurt players
  if (typeof b.owner !== 'string' || !lobby.players.has(b.owner)) return false;

  for (const [pid, p] of lobby.players){
    if (pid === b.owner) continue; // no self hit
    const rr = (b.r ?? 4) + 16;
    if (dist2(b.x, b.y, p.x, p.y) <= rr * rr){
      applyPlayerDamage(lobby, pid, b.dmg ?? 10);
      lobby.bullets.splice(bulletIndex, 1);
      return true;
    }
  }
  return false;
}

function explodeEnemyBomb(lobby, b){
  const splash = (b.splashR ?? SPLASH_BOMB);
  for (const [pid, p] of lobby.players){
    const rr = splash + 16; // player radius approx
    if (dist2(b.x, b.y, p.x, p.y) <= rr * rr){
      applyPlayerDamage(lobby, pid, b.dmg ?? DMG_BOMB);
    }
  }
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
const now = () => Date.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
// -----------------------------------------------------------------------------
// Enemy collision helpers (SERVER-SIDE)
// -----------------------------------------------------------------------------

function circleRectCollide(x, y, r, o) {
  const cx = clamp(x, o.x, o.x + o.w);
  const cy = clamp(y, o.y, o.y + o.h);
  const dx = x - cx;
  const dy = y - cy;
  return (dx * dx + dy * dy) < (r * r);
}

function enemyBlocked(lobby, x, y, r) {
  const walls = lobby.world?.walls || [];
  for (const w of walls) {
    if (circleRectCollide(x, y, r, w)) return true;
  }
  return false;
}

function moveEnemyWithCollide(lobby, e, dx, dy) {
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6)); // max ~6px per micro-step
  const sx = dx / steps;
  const sy = dy / steps;

  for (let i = 0; i < steps; i++) {
    // X axis
    let nx = e.x + sx;
    if (!enemyBlocked(lobby, nx, e.y, e.r)) e.x = nx;

    // Y axis
    let ny = e.y + sy;
    if (!enemyBlocked(lobby, e.x, ny, e.r)) e.y = ny;

    // bounds each micro-step
    e.x = clamp(e.x, e.r, WORLD.w - e.r);
    e.y = clamp(e.y, e.r, WORLD.h - e.r);
  }
}
// -----------------------------------------------------------------------------
// Bullet collision helpers (SERVER-SIDE)
// -----------------------------------------------------------------------------
function bulletHitsWall(lobby, x, y, r) {
  const walls = lobby.world?.walls || [];
  for (const w of walls) {
    if (circleRectCollide(x, y, r, w)) return true;
  }
  return false;
}

function bulletSegmentHitsWall(lobby, x0, y0, x1, y1, r) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (bulletHitsWall(lobby, x, y, r)) return true;
  }
  return false;
}
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const makeId = (n = 6) =>
  Math.random().toString(36).slice(2, 2 + n).toUpperCase();

// -----------------------------------------------------------------------------
// Deterministic map generation (SERVER-SIDE)
// Mirrors pve16.js obstacle + hazard generation using seed.
// -----------------------------------------------------------------------------
let _rngSeed = 1 >>> 0;
function srand(seed){ _rngSeed = (seed >>> 0); }
function srandom(){
  _rngSeed = ((_rngSeed * 1664525) + 1013904223) >>> 0;
  return _rngSeed / 0x100000000;
}
const rand = (a,b) => srandom() * (b - a) + a;
const rint = (a,b) => Math.floor(rand(a, b + 1));

function rectOverlap(a, b, pad = 0){
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );
}

// Same level hazard spec as pve16.js LEVELS
const LEVEL_SPECS = {
  1: { hazards: { kind: 'none', count: 0 } },
  2: { hazards: { kind: 'sand', count: 10 } },
  3: { hazards: { kind: 'ice',  count: 12 } },
  4: { hazards: { kind: 'lava', count: 14 } },
  5: { hazards: { kind: 'void', count: 16 } },
};

function makeDoors(x,y,w,h,t){
  const sides = ['top','bottom','left','right'];
  const doorCount = rint(1,3);
  const doors = [];
  for (let i=0;i<doorCount;i++){
    const side = sides[rint(0,3)];
    const len = rint(54,70);
    if (side === 'top' || side === 'bottom'){
      const px = rint(x + t + 20, x + w - t - 20 - len);
      const py = (side === 'top') ? y : y + h - t;
      doors.push({ side, x:px, y:py, w:len, h:t });
    } else {
      const py = rint(y + t + 20, y + h - t - 20 - len);
      const px = (side === 'left') ? x : x + w - t;
      doors.push({ side, x:px, y:py, w:t, h:len });
    }
  }
  return doors;
}

function rebuildWalls(solids, buildings){
  const walls = [];
  for (const s of solids) walls.push({ x:s.x, y:s.y, w:s.w, h:s.h });

  for (const b of buildings){
    const {x,y,w,h,t,doors} = b;
    const split = (a, len, holes) => {
      let segs = [[a, len]];
      for (const ho of holes){
        const hx = ho.start, hw = ho.len, newSegs = [];
        for (const [sa, sl] of segs){
          const sb = sa + sl, hb = hx + hw;
          if (hb <= sa || sb <= hx){ newSegs.push([sa, sl]); continue; }
          if (hx > sa) newSegs.push([sa, Math.max(0, hx - sa)]);
          if (hb < sb) newSegs.push([hb, Math.max(0, sb - hb)]);
        }
        segs = newSegs.filter(s => s[1] > 0);
      }
      return segs;
    };

    const holesTop  = doors.filter(d=>d.side==='top')   .map(d=>({start:d.x, len:d.w}));
    const holesBot  = doors.filter(d=>d.side==='bottom').map(d=>({start:d.x, len:d.w}));
    const holesLeft = doors.filter(d=>d.side==='left')  .map(d=>({start:d.y, len:d.h}));
    const holesRight= doors.filter(d=>d.side==='right') .map(d=>({start:d.y, len:d.h}));

    for (const [sx, sl] of split(x, w, holesTop))   walls.push({x:sx, y:y,     w:sl, h:t});
    for (const [sx, sl] of split(x, w, holesBot))   walls.push({x:sx, y:y+h-t, w:sl, h:t});
    for (const [sy, sl] of split(y, h, holesLeft))  walls.push({x:x,  y:sy,    w:t,  h:sl});
    for (const [sy, sl] of split(y, h, holesRight)) walls.push({x:x+w-t, y:sy, w:t,  h:sl});
  }
  return walls;
}
function buildChestsForWorld(buildings, hazards){
  const chests = [];
  const B = buildings.length;
  const desired = Math.max(0, Math.min(B, Math.round(B * 8 / 15))); // ~8/15
  if (desired === 0) return chests;

  // deterministic shuffle of building indices
  const idx = [];
  for (let i=0;i<B;i++) idx.push(i);
  for (let i = idx.length - 1; i > 0; i--){
    const j = rint(0, i);
    const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
  }

  const pad = 28;
  let chestId = 0;

  for (let k=0; k<idx.length && chests.length < desired; k++){
    const bi = idx[k];
    const b = buildings[bi];
    if (!b || !b.inner) continue;

    // find a spot inside inner, avoid hazards
    let placed = false;
    for (let tries=0; tries<50 && !placed; tries++){
      const cx = rand(b.inner.x + pad, b.inner.x + b.inner.w - pad);
      const cy = rand(b.inner.y + pad, b.inner.y + b.inner.h - pad);

      let bad = false;
      for (const h of hazards){
        if (cx > h.x - 20 && cx < h.x + h.w + 20 && cy > h.y - 20 && cy < h.y + h.h + 20){
          bad = true; break;
        }
      }
      if (bad) continue;

      chests.push({
        id: chestId++,
        x: cx,
        y: cy,
        r: 16,
        opened: false,
        buildingIndex: bi,
        drops: null
      });
      placed = true;
    }
  }

  return chests;
}

function buildWorld(levelId, mapSeed){
  srand(mapSeed);

  const w = WORLD.w, h = WORLD.h;
  const spec = LEVEL_SPECS[levelId] || LEVEL_SPECS[1];

  const solids = [];
  const buildings = [];
  const hazards = [];

  // Match pve16.js parameters
  const PATH_GAP = 44;
  const EDGE_GAP = 40;
  const MAX_TRIES = 120;
  const COUNT = 14 + Math.floor((levelId - 1) * 2);

  // Arena boundary solids (same as pve16.js)
  solids.push({ x:0, y:0, w:w, h:40 });
  solids.push({ x:0, y:h-40, w:w, h:40 });
  solids.push({ x:0, y:0, w:40, h:h });
  solids.push({ x:w-40, y:0, w:40, h:h });

  const avoidOverlap = (rect, pad) => {
    for (const s of solids) if (rectOverlap(rect, s, pad)) return false;
    for (const b of buildings){
      const br = { x:b.x, y:b.y, w:b.w, h:b.h };
      if (rectOverlap(rect, br, pad)) return false;
    }
    return true;
  };

  const randomRect = (wMin, wMax, hMin, hMax) => {
    const rw = rint(wMin, wMax);
    const rh = rint(hMin, hMax);
    const rx = rint(EDGE_GAP, w - EDGE_GAP - rw);
    const ry = rint(EDGE_GAP, h - EDGE_GAP - rh);
    return { x: rx, y: ry, w: rw, h: rh };
  };

  for (let i=0; i<COUNT; i++){
    const wantBuilding = (rand(0,1) < 0.6);
    let placed = false;
    for (let t=0; t<MAX_TRIES && !placed; t++){
      const r = randomRect(
        wantBuilding ? 180 : 160,
        320,
        wantBuilding ? 140 : 120,
        260
      );
      if (!avoidOverlap(r, PATH_GAP)) continue;

      if (wantBuilding){
        const tWall = 18;
        buildings.push({
          x:r.x, y:r.y, w:r.w, h:r.h, t:tWall,
          doors: makeDoors(r.x, r.y, r.w, r.h, tWall),
          inner: { x:r.x+tWall, y:r.y+tWall, w:r.w-2*tWall, h:r.h-2*tWall }
        });
      } else {
        solids.push({ x:r.x, y:r.y, w:r.w, h:r.h });
      }
      placed = true;
    }
  }

  const walls = rebuildWalls(solids, buildings);

  // Hazards (same placement logic)
  const kind = spec.hazards.kind;
  const hc = spec.hazards.count || 0;
  if (kind !== 'none'){
    let tries = 0;
    while (hazards.length < hc && tries < hc * 40){
      tries++;
      const hw = rint(140,260), hh = rint(120,220);
      const hx = rint(160, w-160-hw), hy = rint(160, h-160-hh);
      const rect = { x:hx, y:hy, w:hw, h:hh, type:kind };

      // avoid center spawn and walls
      const cx = hx + hw/2, cy = hy + hh/2;
      const dx = cx - w/2, dy = cy - h/2;
      if ((dx*dx + dy*dy) < 600*600) continue;

      let bad = false;
      for (const ww of walls){
        if (rectOverlap(rect, ww, 30)){ bad = true; break; }
      }
      if (bad) continue;
      hazards.push(rect);
    }
  }

  const chests = buildChestsForWorld(buildings, hazards);
  return { walls, hazards, solids, buildings, chests };
}

function ensureWorldGenerated(lobby){
  if (!Number.isFinite(lobby.levelId) || !Number.isFinite(lobby.mapSeed)) return;
  const key = `${lobby.levelId}:${lobby.mapSeed}`;
  if (lobby.worldKey === key && lobby.worldLocked) return;
  lobby.chestVer = (lobby.chestVer || 0) + 1;

  const { walls, hazards, solids, buildings, chests } = buildWorld(lobby.levelId, lobby.mapSeed);
  lobby.world = { walls, hazards, solids, buildings, chests };
  lobby.worldKey = key;
  lobby.worldLocked = true;
}

// -----------------------------------------------------------------------------
// Lobby state
// -----------------------------------------------------------------------------
const LOBBIES = new Map(); // id → lobby

function createLobby(mode) {
  const created = now();
  return {
    id: makeId(),
    mode,
    created,
    startTime: created + LOBBY_INTERVAL,
    started: false,

    players: new Map(),
    inputs: new Map(),

    bullets: [],
    wave: 1,
    enemies: [],
    spawnQueue: [],

    lastTick: created,

    levelId: null,
    mapSeed: null,

    // ✅ CRITICAL: initialise world state
    world: { walls: [], hazards: [] },
    worldKey: null,
    chestVer: 0,
    worldLocked: false,

    snapshot: {
      t: now(),
      mode,
      wave: 1,
      players: [],
      enemies: [],
      bullets: [],
      meta: {
        mode,
        joinDeadline: created + LOBBY_INTERVAL,
        levelId: null,
        mapSeed: null,
        worldKey: null
      }
    }
  };
}

function ensureLobbyForLevel(mode, levelId){
  const t = now();

  const open = [...LOBBIES.values()]
    .filter(l => l.mode === mode && !l.started && t < l.startTime && l.levelId === levelId)
    .sort((a,b) => b.created - a.created)[0];

  if (open) return open;

  const l = createLobby(mode);
  l.levelId = levelId;
  l.mapSeed = Math.floor(Math.random() * 2**31);
  ensureWorldGenerated(l);
  LOBBIES.set(l.id, l);
  return l;
}

function placePlayerInLobby(lobby, peerId, name){
  const n = lobby.players.size;
  const R = 120;
  const a = (n * Math.PI * 2) / 8;

  lobby.players.set(peerId, {
    id: peerId,
    name: name || peerId,
    x: WORLD.w / 2 + Math.cos(a) * R,
    y: WORLD.h / 2 + Math.sin(a) * R,
    ang: 0,
    hp: 100
  });
}

function ensureLobby(mode) {
  const t = now();

  // ✅ pick the newest lobby that is still in its join window
  const open = [...LOBBIES.values()]
    .filter(l => l.mode === mode && !l.started && t < l.startTime)
    .sort((a, b) => b.created - a.created)[0];

  if (open) return open;

  const l = createLobby(mode);
  LOBBIES.set(l.id, l);
  return l;
}

// -----------------------------------------------------------------------------
// Enemy logic
// -----------------------------------------------------------------------------
function pickType(wave) {
  return weightedPick(weightsForWave(wave));
}

function spawnEnemy(type, x, y, bossVariant = 0) {
  const e = {
    id: makeId(8),
    type,
    x, y,
    r: 16,
    hp: 50,
    maxhp: 50,
    speed: 160,
    vx: 0,
    vy: 0,

    // AI state
    fireCD: 0,
    bombCD: 0,
    strafeDir: (Math.random() < 0.5 ? -1 : 1),
    underFireT: 0,

    // boss
    bossVariant
  };

  // Ravener (chaser): reasonably fast, but NOT faster than player speed
  if (type === 'chaser') {
    e.hp = e.maxhp = 45;
    e.speed = 210; // <= 240 player
    e.r = 16;
  }

  if (type === 'tank') {
    e.hp = e.maxhp = 220;
    e.speed = 120;
    e.r = 22;
  }

  if (type === 'shooter') {
    e.hp = e.maxhp = 70;
    e.speed = 150;
    e.r = 15;
    e.fireCD = 0.2;
  }

  if (type === 'sniper') {
    e.hp = e.maxhp = 60;
    e.speed = 140; // slower than ravener
    e.r = 16;
    e.fireCD = 0.8;
  }

  if (type === 'bomber') {
    e.hp = e.maxhp = 55;
    e.speed = 175;
    e.r = 18;
    e.bombCD = 0.8;
  }

  if (type === 'healer') {
    e.hp = e.maxhp = 120;
    e.speed = 135;
    e.r = 16;
  }

  if (type === 'boss') {
    e.r = 34;
    e.hp = e.maxhp = 900 + bossVariant * 250;

    if (bossVariant === 1) {        // wave 5: rapid fast bullets, low dmg
      e.speed = 150;
      e.fireCD = 0.15;
    } else if (bossVariant === 2) { // wave 10: runner 2x speed, no bullets
      e.speed = PLAYER_SPEED * 2;
    } else {                        // wave 15+: slow bomb lobber
      e.speed = 90;
      e.bombCD = 1.0;
    }
  }

  return e;
}

function spawnBlocked(lobby, x, y, r) {
  // blocks if inside any wall segment or hazard rect
  if (enemyBlocked(lobby, x, y, r)) return true;
  const hz = lobby.world?.hazards || [];
  for (const h of hz) {
    if (circleRectCollide(x, y, r, h)) return true;
  }
  return false;
}

function randSpawnPointAwayFromPlayers(lobby, minDist = 520, r = 20) {
  for (let tries = 0; tries < 160; tries++) {
    const x = 120 + Math.random() * (WORLD.w - 240);
    const y = 120 + Math.random() * (WORLD.h - 240);

    // away from players
    let ok = true;
    for (const p of lobby.players.values()) {
      if (dist2(x, y, p.x, p.y) < minDist * minDist) { ok = false; break; }
    }
    if (!ok) continue;

    // ✅ avoid walls/buildings/hazards
    if (spawnBlocked(lobby, x, y, r)) continue;

    return { x, y };
  }
  // fallback: try to find any free point
  for (let tries = 0; tries < 400; tries++) {
    const x = 120 + Math.random() * (WORLD.w - 240);
    const y = 120 + Math.random() * (WORLD.h - 240);
    if (!spawnBlocked(lobby, x, y, r)) return { x, y };
  }
  return { x: WORLD.w - 180, y: WORLD.h / 2 };
}
function desiredChestCount(buildings){
  const B = (buildings || []).length;
  return Math.max(0, Math.min(B, Math.round(B * 8 / 15)));
}

function randomPointInInnerAvoidHazards(inner, hazards){
  const pad = 28;
  for (let tries=0; tries<60; tries++){
    const x = rand(inner.x + pad, inner.x + inner.w - pad);
    const y = rand(inner.y + pad, inner.y + inner.h - pad);

    let bad = false;
    for (const h of (hazards || [])){
      if (x > h.x - 20 && x < h.x + h.w + 20 && y > h.y - 20 && y < h.y + h.h + 20){
        bad = true; break;
      }
    }
    if (!bad) return { x, y };
  }
  return null;
}

function topUpChestsForWave(lobby){
  if (!lobby.world) return;

  const buildings = lobby.world.buildings || [];
  const hazards   = lobby.world.hazards || [];
  lobby.world.chests = lobby.world.chests || [];
  const chests = lobby.world.chests;

  const desired = desiredChestCount(buildings);
  if (desired <= 0) return;

  // buildings that already have an ACTIVE (unopened) chest
  const activeBuildings = new Set();
  for (const c of chests){
    if (c && c.opened === false) activeBuildings.add(c.buildingIndex);
  }

  let need = desired - activeBuildings.size;
  if (need <= 0) return;

  // candidate buildings: no active chest
  const candidates = [];
  for (let i=0;i<buildings.length;i++){
    const b = buildings[i];
    if (!b || !b.inner) continue;
    if (!activeBuildings.has(i)) candidates.push(i);
  }

  // ✅ deterministic shuffle (use rint, not Math.random)
  for (let i=candidates.length-1; i>0; i--){
    const j = rint(0, i);
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }

  // reuse opened chests if possible, else create new
  const reusable = chests.filter(c => c && c.opened === true);
  let nextId = chests.reduce((m,c)=>Math.max(m, (c && typeof c.id==='number') ? c.id : -1), -1) + 1;

  for (let k=0; k<candidates.length && need>0; k++){
    const bi = candidates[k];
    const b = buildings[bi];

    const pos = randomPointInInnerAvoidHazards(b.inner, hazards);
    if (!pos) continue;

    let chest = reusable.pop();
    if (!chest){
      chest = { id: nextId++ };
      chests.push(chest);
    }

    chest.x = pos.x;
    chest.y = pos.y;
    chest.r = 16;
    chest.opened = false;
    chest.buildingIndex = bi;
    chest.drops = null;

    need--;
  }
}

function startWave(lobby, n) {
  lobby.wave = n;

  // ✅ HARD RESET: retire ALL chests so every wave is a fresh spawn set
  if (lobby.world) {
    lobby.world.chests = lobby.world.chests || [];
    for (const c of lobby.world.chests) {
      if (!c) continue;
      c.opened = true;   // make reusable
      c.drops  = null;
    }
  }

  // ✅ Refill chests for this wave (fresh unopened set)
  topUpChestsForWave(lobby);

  // ✅ ALWAYS bump chestVer so clients refresh world+chests every wave
  lobby.chestVer = (lobby.chestVer || 0) + 1;

  // --- existing wave init logic ---
  lobby.spawnQueue = [];
  lobby.nextWaveT = 2.0;

  const bossWave = (n % 5 === 0);
  if (bossWave) {
    const p = randSpawnPointAwayFromPlayers(lobby, 720, 34);
    lobby.spawnQueue.push({
      t: 1.0,
      type: 'boss',
      x: p.x,
      y: p.y,
      bossVariant: Math.floor(n / 5)
    });
  }

  const count = enemyCountForWave(n);
  for (let i = 0; i < count; i++) {
    const type = pickType(n);
    const r = (type === 'tank') ? 22 : (type === 'boss') ? 34 : 20;
    const p = randSpawnPointAwayFromPlayers(lobby, 520, r);

    lobby.spawnQueue.push({
      t: 0.5 + Math.random() * 8.0,
      type,
      x: p.x,
      y: p.y,
      wave: n
    });
  }

  lobby.spawnQueue.sort((a, b) => a.t - b.t);
}

function enemyAI(lobby, e, dt) {
  // pick nearest player
  let tgt = null;
  let best = Infinity;
  for (const p of lobby.players.values()) {
    const d = dist2(e.x, e.y, p.x, p.y);
    if (d < best) { best = d; tgt = p; }
  }
  if (!tgt) return;

  const dx = tgt.x - e.x;
  const dy = tgt.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const baseAng = Math.atan2(dy, dx);

  e.fireCD = Math.max(0, (e.fireCD ?? 0) - dt);
  e.bombCD = Math.max(0, (e.bombCD ?? 0) - dt);
  const wave = lobby.wave || (e.spawnWave || 1);
  const tier = aiTierForWave(wave);

  // Is player currently shooting? (set by /shoot)
  const nowT = now();
  const playerShooting = (tgt.lastShotAt && (nowT - tgt.lastShotAt) < 260);

  // Under fire behaviour timer (snipers)
  if (playerShooting && dist < 900) e.underFireT = 0.7;
  e.underFireT = Math.max(0, (e.underFireT ?? 0) - dt);
  const underFire = (e.underFireT ?? 0) > 0;

  // Find healer for regroup behaviour
  let healer = null;
  if (e.type !== 'healer') healer = lobby.enemies.find(x => x.type === 'healer');

  // Default move
  let moveAng = baseAng;
  let moveMul = 1;

  // ============================
  // HEALER: center + aura heal
  // ============================
  if (e.type === 'healer') {
    const cx = WORLD.w / 2, cy = WORLD.h / 2;
    const dc = Math.hypot(cx - e.x, cy - e.y);
    const a = angleTo(e.x, e.y, cx, cy);

    if (dc > 120) { moveAng = a; moveMul = 1; }
    else { moveMul = 0.2; }

    // Heal allies inside aura
    for (const ally of lobby.enemies) {
      if (ally === e) continue;
      if (dist2(e.x, e.y, ally.x, ally.y) <= HEAL_AURA_R * HEAL_AURA_R) {
        ally.hp = Math.min(ally.maxhp, ally.hp + HEAL_PER_SEC * dt);
      }
    }
  }

  // ============================
  // BOMBER: get into bomb range; bombs slow + short + splash
  // ============================
  else if (e.type === 'bomber') {
    const minRange = 220, maxRange = 420;

    if (dist < minRange) { moveAng = baseAng + Math.PI; moveMul = 0.9; }
    else if (dist > maxRange) { moveAng = baseAng; moveMul = 1.0; }
    else { moveMul = 0.55; }

    if (e.bombCD <= 0 && dist >= minRange && dist <= maxRange) {
      const a = baseAng + (Math.random() * 2 - 1) * 0.10;
      lobby.bullets.push({
        owner: `E:${e.id}`,
        kind: 'enemyBomb',
        x: e.x + Math.cos(a) * (e.r + 8),
        y: e.y + Math.sin(a) * (e.r + 8),
        vx: Math.cos(a) * SPD_BOMB,
        vy: Math.sin(a) * SPD_BOMB,
        r: 6,
        dmg: DMG_BOMB,
        life: LIFE_BOMB,
        splashR: SPLASH_BOMB
      });
      e.bombCD = 1.15;
    }
  }

  // ============================
  // SHOOTER: shorter range, more bullets
  // ============================
  else if (e.type === 'shooter') {
    const keepMin = 220, keepMax = 650;

    // tier0: mostly hold / simple reposition
    // tier1+: strafe
    if (dist < keepMin) moveAng = baseAng + Math.PI;
    else if (dist > keepMax) moveAng = baseAng;
    else {
      moveAng = (tier >= 1)
        ? baseAng + (e.strafeDir || 1) * Math.PI / 2
        : baseAng;
    }

    // ✅ exactly 1 bullet per shot
    if (e.fireCD <= 0 && dist < 760) {
      const a = baseAng + (Math.random() * 2 - 1) * 0.12;

      lobby.bullets.push({
        owner: `E:${e.id}`,
        kind: 'enemy',
        x: e.x + Math.cos(a) * (e.r + 6),
        y: e.y + Math.sin(a) * (e.r + 6),
        vx: Math.cos(a) * SPD_SHOOTER,
        vy: Math.sin(a) * SPD_SHOOTER,
        r: 4,
        dmg: DMG_SHOOTER,
        life: LIFE_SHOOTER
      });

      // higher tiers can shoot slightly more often
      e.fireCD = (tier >= 2) ? 0.32 : 0.38;
    }
  }

  // ============================
  // SNIPER: keep far, lead aim unless under fire
  // ============================
  else if (e.type === 'sniper') {
    const keepMin = 620, keepMax = 1200;

    if (dist < keepMin) { moveAng = baseAng + Math.PI; moveMul = 0.8; }
    else if (dist > keepMax) { moveAng = baseAng; moveMul = 1.0; }
    else { moveMul = underFire ? 1.0 : 0.25; }

    // Under fire: circle player at normal speed; no prediction
    if (underFire) {
      moveAng = baseAng + (e.strafeDir || 1) * Math.PI / 2;
    }

    if (e.fireCD <= 0 && dist < 1400) {
      let aAim = baseAng;

      // Predict only when NOT under fire
      // Predict only at higher waves (tier2+) and only when NOT under fire
      if (!underFire && tier >= 2) {
        const bulletSp = SPD_SNIPER;
        const leadT = Math.min(0.55, dist / bulletSp);
        const px = tgt.x + (tgt.vx || 0) * leadT * 0.9;
        const py = tgt.y + (tgt.vy || 0) * leadT * 0.9;
      }

      aAim += (Math.random() * 2 - 1) * (underFire ? 0.06 : 0.03);

      lobby.bullets.push({
        owner: `E:${e.id}`,
        kind: 'enemy',
        x: e.x + Math.cos(aAim) * (e.r + 8),
        y: e.y + Math.sin(aAim) * (e.r + 8),
        vx: Math.cos(aAim) * SPD_SNIPER,
        vy: Math.sin(aAim) * SPD_SNIPER,
        r: 4,
        dmg: DMG_SNIPER,
        life: LIFE_SNIPER
      });

      e.fireCD = underFire ? 1.35 : 1.8;
    }
  }

  // ============================
  // BOSS variants (wave 5/10/15)
  // ============================
  else if (e.type === 'boss') {
    const v = e.bossVariant || 1;

    if (v === 1) {
      // wave 5: very fast bullets, low damage, rapid fire
      moveMul = 0.75;
      if (e.fireCD <= 0) {
        const a = baseAng + (Math.random() * 2 - 1) * 0.10;
        lobby.bullets.push({
          owner: `E:${e.id}`,
          kind: 'enemy',
          x: e.x + Math.cos(a) * (e.r + 10),
          y: e.y + Math.sin(a) * (e.r + 10),
          vx: Math.cos(a) * 1050,
          vy: Math.sin(a) * 1050,
          r: 4,
          dmg: 6,
          life: 1.1
        });
        e.fireCD = 0.12;
      }
    } else if (v === 2) {
      // wave 10: runner, no bullets — speed already set to 2x player
      moveMul = 1.0;
    } else {
      // wave 15: slow bomb boss
      const keep = 700;
      if (dist < keep) { moveAng = baseAng + Math.PI; moveMul = 0.8; }
      else if (dist > keep + 300) { moveAng = baseAng; moveMul = 0.8; }
      else { moveMul = 0.25; }

      if (e.bombCD <= 0) {
        const a = baseAng + (Math.random() * 2 - 1) * 0.08;
        lobby.bullets.push({
          owner: `E:${e.id}`,
          kind: 'enemyBomb',
          x: e.x + Math.cos(a) * (e.r + 10),
          y: e.y + Math.sin(a) * (e.r + 10),
          vx: Math.cos(a) * SPD_BOMB,
          vy: Math.sin(a) * SPD_BOMB,
          r: 7,
          dmg: 26,
          life: 1.1,
          splashR: 150
        });
        e.bombCD = 1.25;
      }
    }
  }

  // ============================
  // RAVENER (chaser): chase + distract; regroup at healer if not shot at
  // ============================
  else if (e.type === 'chaser') {
    // Predict only at higher waves (tier2+) and only when NOT under fire
    if (!underFire && tier >= 2) {
      const bulletSp = SPD_SNIPER;
      const leadT = Math.min(0.55, dist / bulletSp);
      const px = tgt.x + (tgt.vx || 0) * leadT * 0.9;
      const py = tgt.y + (tgt.vy || 0) * leadT * 0.9;
      aAim = angleTo(e.x, e.y, px, py);
    }
    // regroup at healer when not being shot at and injured
    if (healer && !playerShooting && e.hp < e.maxhp * 0.7) {
      moveAng = angleTo(e.x, e.y, healer.x, healer.y);
    } else {
      // chase
      moveAng = baseAng;

      // "distract": if there is a shooter/sniper/boss, flank to pull player
      const commander = lobby.enemies.find(x => x.type === 'shooter' || x.type === 'sniper' || x.type === 'boss');
      if (commander && dist2(commander.x, commander.y, tgt.x, tgt.y) < 1200 * 1200) {
        const flankA = baseAng + Math.PI / 2;
        const fx = tgt.x + Math.cos(flankA) * 180;
        const fy = tgt.y + Math.sin(flankA) * 180;
        moveAng = angleTo(e.x, e.y, fx, fy);
      }
    }
  }

  // Tanks: just chase
  else if (e.type === 'tank') {
    moveAng = baseAng;
  }

  // movement integration
  const sp = (e.speed ?? 160) * moveMul;
  const vx = Math.cos(moveAng) * sp;
  const vy = Math.sin(moveAng) * sp;
  moveEnemyWithCollide(lobby, e, vx * dt, vy * dt);
}

// -----------------------------------------------------------------------------
// HTTP API
// -----------------------------------------------------------------------------
app.post('/lobby/join', (req, res) => {
  const mode = req.body?.mode === 'pvp' ? 'pvp' : 'pve';
  const nickname = String(req.body?.nickname || '').trim() || null;

  const lobby = ensureLobby(mode);
  const peerId = makeId(8);

  const n = lobby.players.size;
  const R = 120;
  const a = (n * Math.PI * 2) / 8;

  lobby.players.set(peerId, {
    id: peerId,
    name: nickname || peerId,
    x: WORLD.w / 2 + Math.cos(a) * R,
    y: WORLD.h / 2 + Math.sin(a) * R,
    ang: 0,
    hp: 100
  });

  res.json({
    lobbyId: lobby.id,
    peerId,
    mode,
    startTime: lobby.startTime,
    world: WORLD,
    levelId: lobby.levelId,
    mapSeed: lobby.mapSeed
  });
});

app.post('/chest/open', (req, res) => {
  const { lobbyId, peerId, chestId } = req.body;
  const lobby = LOBBIES.get(lobbyId);
  if (!lobby || !lobby.world) return res.json({ ok:false });

  const chests = lobby.world.chests ?? [];
  const ch = chests.find(c => c.id === chestId);
  if (!ch || ch.opened) return res.json({ ok:false });

  const p = lobby.players.get(peerId);
  if (!p) return res.json({ ok:false });

  const b = (lobby.world.buildings ?? [])[ch.buildingIndex];
  if (!b || !b.inner) return res.json({ ok:false });

  // must be inside the same building interior
  const inside =
    p.x >= b.inner.x && p.x <= b.inner.x + b.inner.w &&
    p.y >= b.inner.y && p.y <= b.inner.y + b.inner.h;

  if (!inside) return res.json({ ok:false });

  // must be close enough
  const rr = (ch.r ?? 16) + 16;
  if (dist2(p.x, p.y, ch.x, ch.y) > rr * rr) return res.json({ ok:false });

  // open + generate drops (authoritative)
  ch.opened = true;

  // drops are stored on chest so all clients can spawn them from snapshot
  const n = rint(2,3);
  const types = ['health','speed','shield','ammo'];
  const drops = [];
  for (let i=0;i<n;i++){
    const a = rand(0, Math.PI*2);
    const d = rand(18, 36);
    drops.push({
      x: ch.x + Math.cos(a) * d,
      y: ch.y + Math.sin(a) * d,
      type: types[rint(0, types.length-1)]
    });
  }
  ch.drops = drops;
  lobby.chestVer = (lobby.chestVer || 0) + 1;

  res.json({ ok:true, chestId, drops });
});

app.post('/input', (req, res) => {
  const { lobbyId, peerId, ix, iy, ang } = req.body;
  const lobby = LOBBIES.get(lobbyId);
  if (!lobby) return res.json({ ok: false });

  // ✅ Store only input vector + angle (ignore x/y)
  lobby.inputs.set(peerId, { ix, iy, ang });

  res.json({ ok: true });
});

app.post('/shoot', (req, res) => {
  const { lobbyId, peerId, x, y, ang, speed, dmg } = req.body;
  const lobby = LOBBIES.get(lobbyId);
  if (!lobby) return res.json({ ok: false });

  lobby.bullets.push({
    owner: peerId,
    x, y,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    r: 4,
    dmg,
    life: 1.2
  });
  const p = lobby.players.get(peerId);
  if (p) p.lastShotAt = now();

  res.json({ ok: true });
});
app.post('/hit', (req, res) => {
  const { lobbyId, peerId, target, x, y, dmg, kind } = req.body;
  const lobby = LOBBIES.get(lobbyId);
  if (!lobby) return res.json({ ok: false });

  // ✅ PvP: only melee uses /hit (bullets are server-simulated from /shoot)
  if (lobby.mode === 'pvp') {
    if (kind !== 'melee') return res.json({ ok: false });

    const attacker = lobby.players.get(peerId);
    const victim = lobby.players.get(target);
    if (!attacker || !victim) return res.json({ ok: false });
    if (peerId === target) return res.json({ ok: false });

    // Range validation (matches your client feel)
    const RANGE = 120;
    const rr = RANGE + 16;
    if (dist2(attacker.x, attacker.y, victim.x, victim.y) > rr * rr) {
      return res.json({ ok: false });
    }

    let dd = Number(dmg);
    if (!Number.isFinite(dd)) dd = 0;
    dd = Math.max(0, Math.min(60, dd)); // clamp

    applyPlayerDamage(lobby, target, dd);
    removeDeadPlayers(lobby);

    return res.json({ ok: true });
  }

  // ✅ PvE: only accept melee hits against enemies
  if (lobby.mode === 'pve' && target === 'enemy') {
    if (kind !== 'melee') return res.json({ ok: false });

    const hx = Number(x), hy = Number(y);
    let dd = Number(dmg);
    if (!Number.isFinite(hx) || !Number.isFinite(hy)) return res.json({ ok: false });
    if (!Number.isFinite(dd)) dd = 0;

    dd = Math.max(0, Math.min(80, dd));

    let best = -1;
    let bestD2 = 80 * 80;
    for (let i = 0; i < lobby.enemies.length; i++) {
      const e = lobby.enemies[i];
      const d2 = dist2(hx, hy, e.x, e.y);
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    }

    if (best >= 0) {
      lobby.enemies[best].hp -= dd;
      if (lobby.enemies[best].hp <= 0) lobby.enemies.splice(best, 1);
    }

    return res.json({ ok: true });
  }

  // Other hit types (ignore)
  res.json({ ok: true });
});

app.get('/world', (req, res) => {
  const { lobbyId } = req.query;
  const lobby = LOBBIES.get(lobbyId);
  if (!lobby) return res.json(null);
  res.json({
    world: lobby.world,
    meta: {
      worldKey: lobby.worldKey ?? null,
      chestVer: lobby.chestVer ?? 0,
      levelId: lobby.levelId ?? null,
      mapSeed: lobby.mapSeed ?? null
    }
  });
});

app.get('/poll', (req, res) => {
  const { lobbyId } = req.query;
  const lobby = LOBBIES.get(lobbyId);
  if (!lobby) return res.json(null);
  res.json(lobby.snapshot);
});

app.post('/lobby/setLevel', (req, res) => {
  const { lobbyId, levelId, peerId } = req.body;
  const lobby = LOBBIES.get(lobbyId);
  if (!lobby) {
    return res.status(404).json({ ok:false, error:'Lobby not found' });
  }

  // ✅ Do NOT allow level changes after lobby has started
  if (Date.now() >= lobby.startTime) {
    return res.status(409).json({ ok:false, error:'Lobby already started' });
  }

  // If lobby has no level yet -> set it
  if (lobby.levelId == null) {
    lobby.levelId = levelId;
    lobby.mapSeed = Math.floor(Math.random() * 2**31);
    ensureWorldGenerated(lobby);

    return res.json({
      ok:true,
      lobbyId: lobby.id,
      levelId: lobby.levelId,
      mapSeed: lobby.mapSeed,
      joinDeadline: lobby.startTime,
      redirected: false
    });
  }

  // If lobby already set to SAME level -> ok
  if (lobby.levelId === levelId) {
    return res.json({
      ok:true,
      lobbyId: lobby.id,
      levelId: lobby.levelId,
      mapSeed: lobby.mapSeed,
      joinDeadline: lobby.startTime,
      redirected: false
    });
  }

  // ✅ Lobby set to DIFFERENT level -> migrate this player (if peerId provided)
  if (!peerId) {
    return res.status(409).json({ ok:false, error:'Level mismatch and no peerId to migrate' });
  }

  const p = lobby.players.get(peerId);
  if (!p) {
    return res.status(404).json({ ok:false, error:'Player not found in lobby' });
  }

  const targetLobby = ensureLobbyForLevel(lobby.mode, levelId);

  // remove from old lobby
  lobby.players.delete(peerId);
  lobby.inputs.delete(peerId);

  // add to new lobby (keep name)
  placePlayerInLobby(targetLobby, peerId, p.name);

  // reply with redirect info
  return res.json({
    ok:true,
    redirected: true,
    lobbyId: targetLobby.id,
    levelId: targetLobby.levelId,
    mapSeed: targetLobby.mapSeed,
    joinDeadline: targetLobby.startTime
  });
});
app.post('/lobby/setWorld', (req, res) => {
  res.status(410).json({ ok:false, error:'world is server-generated' });
});

// -----------------------------------------------------------------------------
// Main server tick
// -----------------------------------------------------------------------------
setInterval(() => {
  const t = now();

  for (const lobby of LOBBIES.values()) {
    // Compute dt first (safe)
    const dt = Math.min(0.05, (t - lobby.lastTick) / 1000);
    lobby.lastTick = t;

    // Start lobby when countdown ends
    // Start lobby when countdown ends
    if (!lobby.started && t >= lobby.startTime) {
      if (lobby.levelId == null) lobby.levelId = 1 + Math.floor(Math.random() * 5);
      if (lobby.mapSeed == null) lobby.mapSeed = Math.floor(Math.random() * 2**31);

      ensureWorldGenerated(lobby); // ✅ SERVER CREATES MAP HERE

      lobby.started = true;
      if (lobby.mode === 'pve') startWave(lobby, 1);
    }

    // If not started, still publish a snapshot (optional, helps clients)
    if (!lobby.started) {
      lobby.snapshot = {
        t: now(),
        mode: lobby.mode,
        wave: lobby.wave,
        players: [...lobby.players.values()],
        enemies: [],
        bullets: [],
        meta: {
          lobbyId: lobby.id,
          mode: lobby.mode,
          joinDeadline: lobby.startTime,
          levelId: lobby.levelId,
          mapSeed: lobby.mapSeed,
          chestVer: lobby.chestVer || 0,
          worldKey: lobby.worldKey ?? null
        }
      };
      continue; // ✅ critical
    }

    // ---- Players ----
    // ---- Players ----
    for (const [id, p] of lobby.players) {
      const inp = lobby.inputs.get(id);
      if (!inp) continue;

      // store old pos for velocity
      const prevX = p.x, prevY = p.y;

      p.ang = inp.ang;

      // trust client-collided position if provided
      // ✅ Never trust client x/y (prevents 20Hz stepping / snapping)
      // Always integrate from input vector
      const m = Math.hypot(inp.ix, inp.iy) || 1;
      p.x += (inp.ix / m) * PLAYER_SPEED * dt;
      p.y += (inp.iy / m) * PLAYER_SPEED * dt;

      p.x = clamp(p.x, 30, WORLD.w - 30);
      p.y = clamp(p.y, 30, WORLD.h - 30);

      // ✅ velocity for sniper lead aim
      p.vx = (p.x - prevX) / dt;
      p.vy = (p.y - prevY) / dt;
    }

    // ---- PvE: spawn + enemy AI ----
    if (lobby.mode === 'pve') {
      lobby.spawnQueue = lobby.spawnQueue.filter(s => {
        s.t -= dt;
        if (s.t <= 0) {
          const en = spawnEnemy(s.type, s.x, s.y, s.bossVariant || 0);
          en.spawnWave = s.wave || lobby.wave;
          en.tier = aiTierForWave(en.spawnWave);

          // assign ravener roles only when it matters (door blockers later)
          if (en.type === 'chaser') {
            // before tier 2: no blocking role
            if (en.tier >= 2 && Math.random() < 0.35) en.role = 'blocker';
            else en.role = 'runner';
          }

          lobby.enemies.push(en);
          return false;
        }
        return true;
      });

      for (let i = lobby.enemies.length - 1; i >= 0; i--) {
        const e = lobby.enemies[i];

        enemyAI(lobby, e, dt);

        // ✅ Apply hazards to enemies (server authoritative)
        const killedByHazard = applyEnemyHazards(lobby, e, dt);

        if (killedByHazard || e.hp <= 0) {
          lobby.enemies.splice(i, 1);
        }
      }
      // ✅ Enemy body contact damage (server authoritative)
      for (const e of lobby.enemies) {
        const bossV = (e.type === 'boss') ? (e.bossVariant ?? 1) : 0;
        const dps = touchDps(e.type, bossV);

        for (const [pid, p] of lobby.players) {
          const rr = (e.r ?? 16) + 16; // enemy radius + player radius
          if (dist2(e.x, e.y, p.x, p.y) <= rr * rr) {
            applyPlayerDamage(lobby, pid, dps * dt * 1.4);
          }
        }
      }
      removeDeadPlayers(lobby);
      // ✅ Auto-advance waves when cleared
      if (lobby.spawnQueue.length === 0 && lobby.enemies.length === 0) {
        lobby.nextWaveT = (lobby.nextWaveT ?? 2.0) - dt;
        if (lobby.nextWaveT <= 0) {
          startWave(lobby, (lobby.wave || 1) + 1);
        }
      }
    }

    // -----------------------------------------------------------------------------
    // Bullet collision helpers (SERVER-SIDE)
    // -----------------------------------------------------------------------------
    // ---- Bullets (move + wall collision + expire) ----
    // ---- Bullets (move + wall collision + expire + player hits) ----
    for (let i = lobby.bullets.length - 1; i >= 0; i--) {
      const b = lobby.bullets[i];

      const x0 = b.x, y0 = b.y;
      const x1 = b.x + b.vx * dt;
      const y1 = b.y + b.vy * dt;

      const hitWall = bulletSegmentHitsWall(lobby, x0, y0, x1, y1, b.r ?? 4);

      // move if not hit wall
      if (!hitWall){
        b.x = x1;
        b.y = y1;
      }

      b.life -= dt;

      // ✅ Enemy bomb: explode on wall OR when timer ends
      if (b.kind === 'enemyBomb' && (hitWall || b.life <= 0)){
        explodeEnemyBomb(lobby, b);
        lobby.bullets.splice(i, 1);
        continue;
      }

      // normal bullets die on wall
      if (hitWall){
        lobby.bullets.splice(i, 1);
        continue;
      }

      // expire
      if (b.life <= 0){
        lobby.bullets.splice(i, 1);
        continue;
      }

      // ✅ Enemy bullets hit players
      const isEnemy = (typeof b.owner === 'string' && b.owner.startsWith('E:')) || b.kind === 'enemy';
      if (isEnemy){
        for (const [pid, p] of lobby.players){
          const rr = (b.r ?? 4) + 16;
          if (dist2(b.x, b.y, p.x, p.y) <= rr * rr){
            applyPlayerDamage(lobby, pid, b.dmg ?? DMG_SHOOTER);
            lobby.bullets.splice(i, 1);
            break;
          }
        }
      }
      // ✅ PvP: player bullets hit other players
      if (handlePvPPlayerBulletHits(lobby, b, i)) {
        continue;
      }
    }
    
    // ---- Bullet hits enemies (PvE) ----
    if (lobby.mode === 'pve') {
      for (let i = lobby.bullets.length - 1; i >= 0; i--) {
        const b = lobby.bullets[i];
        // ✅ only PLAYER bullets damage enemies
        if (!lobby.players.has(b.owner)) continue;

        let hitIndex = -1;
        for (let j = 0; j < lobby.enemies.length; j++) {
          const e = lobby.enemies[j];
          const rr = (b.r + e.r);
          if (dist2(b.x, b.y, e.x, e.y) < rr * rr) { hitIndex = j; break; }
        }

        if (hitIndex >= 0) {
          lobby.enemies[hitIndex].hp -= b.dmg;
          lobby.bullets.splice(i, 1); // consume bullet
        }
      }

      // remove dead enemies
      for (let j = lobby.enemies.length - 1; j >= 0; j--) {
        if (lobby.enemies[j].hp <= 0) lobby.enemies.splice(j, 1);
      }
    }
    removeDeadPlayers(lobby);

    // Snapshot
    // Snapshot (LIGHTWEIGHT - no full world payload)
    lobby.snapshot = {
      t: now(),
      mode: lobby.mode,
      wave: lobby.wave,
      players: [...lobby.players.values()],
      enemies: lobby.mode === 'pve' ? lobby.enemies : [],
      bullets: lobby.bullets,

      // ✅ DO NOT ship world every tick (client fetches /world only when changed)
      // world: undefined,

      meta: {
        lobbyId: lobby.id,
        mode: lobby.mode,
        joinDeadline: lobby.startTime,
        levelId: lobby.levelId,
        mapSeed: lobby.mapSeed,
        chestVer: lobby.chestVer || 0,
        worldKey: lobby.worldKey ?? null
      }
    };
  }
}, TICK_MS);

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ HTTP server running on http://localhost:${PORT}`);
});