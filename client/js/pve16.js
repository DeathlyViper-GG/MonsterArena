(()=>{

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const mini = document.getElementById('mini');
  const mctx = mini.getContext('2d');

  const hpFill = document.getElementById('hpFill');
  const ammoFill = document.getElementById('ammoFill');
  const ammoText = document.getElementById('ammoText');
  const weaponName = document.getElementById('weaponName');
  const waveEl = document.getElementById('wave');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const shieldEl = document.getElementById('shield');
  const spdEl = document.getElementById('spd');
  const lvlEl = document.getElementById('lvl');

  const ovHome = document.getElementById('overlayHome');
  const ovPause = document.getElementById('overlayPause');
  const ovHelp = document.getElementById('overlayHelp');
  const ovSettings = document.getElementById('overlaySettings');
  const ovCustomize = document.getElementById('overlayCustomize');

  const IS_MOBILE = /Mobi|Android|iPad|iPhone/i.test(navigator.userAgent);

  let mobileAim = { active:false, x:0, y:0 };

  if (IS_MOBILE) {

    window.addEventListener('touchstart', (e) => {
      if (e.target.closest('#stickL')) return;

      const t = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect()

      mobileAim.active = true;
      mobileAim.x = cam.x + (t.clientX - rect.left);
      mobileAim.y = cam.y + (t.clientY - rect.top);

      input.mouse.down = true; // ✅ fire immediately on tap
    }, { passive:true });

    window.addEventListener('touchmove', (e) => {
      if (!mobileAim.active) return;

      const t = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect()

      mobileAim.x = cam.x + (t.clientX - rect.left);
      mobileAim.y = cam.y + (t.clientY - rect.top);
    }, { passive:true });

    window.addEventListener('touchend', () => {
      mobileAim.active = false;
      input.mouse.down = false;
    });
  }
  // ================================
  // 📱 Mobile Dash & Melee Buttons
  // ================================


  // ===== Glyph overlay elements =====
  const ovGlyphs = document.getElementById('overlayGlyphs');
  const glyphCanvas = document.getElementById('glyphCanvas');
  const glyphTimerEl = document.getElementById('glyphTimer');
  const glyphEssenceEl = document.getElementById('glyphEssence');
  const glyphTitleEl = document.getElementById('glyphTitle');
  const glyphDescEl = document.getElementById('glyphDesc');
  const glyphCostEl = document.getElementById('glyphCost');
  const glyphEnchantBtn = document.getElementById('glyphEnchant');

  const gctx = glyphCanvas ? glyphCanvas.getContext('2d') : null;


  const btnPause = document.getElementById('btnPause');
  const btnRestart = document.getElementById('btnRestart');
  const btnHome = document.getElementById('btnHome');
  const btnHelp = document.getElementById('btnHelp');
  const btnSettings = document.getElementById('btnSettings');
  const btnHomeCustomize = document.getElementById('homeCustomize');
  let HAS_SERVER_WORLD = false;
  let STATIC_WORLD_CANVAS = null;
  let STATIC_WORLD_CTX = null;
  let STATIC_WORLD_KEY = '';
  let _lastHUDUpdate = 0;
  const HUD_INTERVAL = 100; // ms (10 times per second)
  async function leaveMultiplayerAndReturnHome() {
    // Stop gameplay
    try { state.running = false; } catch {}

    // ✅ HARD STOP NETWORK (prevents /poll spam)
    try {
      if (window.Net && Net.state) {
        Net.state.stopped = true;
        Net.state.lobbyId = null;
        Net.state.peerId = null;
      }
      if (window.Net && Net.leave) {
        if (isNetActive()) {
          await Net.leave();
          return;
        }
      }
    } catch {}

    // Reset menu context
    window.MENU_CONTEXT = 'intro';

    // Hide all overlays
    document.querySelectorAll('.overlay').forEach(o => {
      o.style.display = 'none';
    });

    // Return to multiplayer home
    const home = document.getElementById('overlayHome');
    if (home) home.style.display = 'grid';
  }

  // Wire Exit button to the shared function
  const btnExit = document.getElementById('btnExit');
  if (btnExit) {
    btnExit.onclick = () => {
      leaveMultiplayerAndReturnHome();
    };
  }
  document.getElementById('resumeBtn')?.addEventListener('click', () => togglePause(false));
  document.getElementById('restartBtn2')?.addEventListener('click', () => restart());
  document.getElementById('homeBtn2')?.addEventListener('click', () => goHome());
  document.getElementById('settingsBtn2')?.addEventListener('click', () => showOverlay(ovSettings,true));
  document.getElementById('helpBtn2')?.addEventListener('click', () => showOverlay(ovHelp,true));
  document.getElementById('closeHelp')?.addEventListener('click', () => showOverlay(ovHelp,false));
  document.getElementById('closeSettings')?.addEventListener('click', () => { saveSettings(); showOverlay(ovSettings,false); });
  document.getElementById('homeHelp')?.addEventListener('click', () => showOverlay(ovHelp,true));
  document.getElementById('homeSettings')?.addEventListener('click', () => showOverlay(ovSettings,true));
  if (btnHomeCustomize) {
    btnHomeCustomize.onclick = () => { buildSkins(); showOverlay(ovCustomize, true); };
  }

  const closeCustomizeBtn = document.getElementById('closeCustomize');
  if (closeCustomizeBtn) {
    closeCustomizeBtn.onclick = () => {
      // Save selections
      store.write('design', selectedDesign);
      store.write('color', selectedColor);

      // Hide customise
      showOverlay(ovCustomize, false);

      // ✅ Route back to the correct menu
      document.querySelectorAll('.overlay').forEach(o => {
        o.style.display = 'none';
      });

      if (window.MENU_CONTEXT === 'multi') {
        const el = document.getElementById('overlayHome');
        if (el) el.style.display = 'grid';
        return;
      }

      if (window.MENU_CONTEXT === 'single') {
        const el = document.getElementById('overlaySingle');
        if (el) el.style.display = 'grid';
        return;
      }

      // ✅ Default: intro (single / multiplayer choice)
      const intro = document.getElementById('overlayIntro');
      if (intro) intro.style.display = 'grid';
    };
  }

  if (btnPause) {
    btnPause.onclick = () => {
      if (!isNetActive()) {
        togglePause();
      }
    };
  }
  if (btnRestart)  btnRestart.onclick  = () => restart();
  if (btnHome)     btnHome.onclick     = () => goHome();
  if (btnHelp)     btnHelp.onclick     = () => showOverlay(ovHelp, true);
  if (btnSettings) btnSettings.onclick = () => showOverlay(ovSettings, true);

  const selDiff = document.getElementById('selDiff');
  const selSfx = document.getElementById('selSfx');
  const selMusic = document.getElementById('selMusic');
  const rngSens = document.getElementById('rngSens');
  const rngUI = document.getElementById('rngUI');
  const sensVal = document.getElementById('sensVal');
  const uiVal = document.getElementById('uiVal');

  const stickL = document.getElementById('stickL');
  const nubL = document.getElementById('nubL');
  const btnSwap = document.getElementById('btnSwap');
  const Melee = /** @type {any} */ (window).Melee;
  const online = () => !!(window.Net && Net.state && Net.state.lobbyId);
  const HTTP_MODE = true;
  let _worldUploadedKey = '';
  let _prevSnapEnemies = new Map(); // id -> {x,y,type,r}


  async function uploadWorldToServerIfNeeded(){
    // Server is authoritative for world generation now.
    // Do not upload world from clients.
    return;
  }
  // ✅ Viewport in CSS pixels (matches ctx.setTransform(dpr,...))
  const VIEW = { w: 0, h: 0, dpr: 1 };
  function isNetActive() {
    return !!(window.Net && Net.state && Net.state.peerId);
  }

  let _sentAppearanceOnce = false;

  function syncAppearanceOnce() {
    if (_sentAppearanceOnce) return;
    if (!isNetActive()) return;

    Net.setDesign(selectedDesign).catch(() => {});
    Net.setColor(selectedColor).catch(() => {});

    _sentAppearanceOnce = true;
  }
  function clipBulletToWalls(world, x0, y0, x1, y1) {
    let hx = x1;
    let hy = y1;

    for (const w of world.walls) {
      // step along segment and stop at first hit
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;

        if (
          x >= w.x &&
          x <= w.x + w.w &&
          y >= w.y &&
          y <= w.y + w.h
        ) {
          return { hit: true, x, y };
        }
      }
    }

    return { hit: false, x: hx, y: hy };
  }


  let _sentGunsOnce = false;

  function syncGunsOnce() {
    if (_sentGunsOnce) return;
    if (!isNetActive()) return;

    Net.setGuns({
      pistol: pistolIndex,
      rifle: rifleIndex,
      shotgun: shotgunIndex
    });

    _sentGunsOnce = true;
  }
  function hasFreshSnapshot(maxAgeMs = 1200) {
    const s = (window.Net && Net.state && Net.state.snapshot) ? Net.state.snapshot : null;
    if (!s || !s.t) return false;
    return (Date.now() - s.t) <= maxAgeMs;
  }
  // ===== Snapshot interpolation (HTTP smoothness) =====
  let _snapPrev = null;
  let _snapCurr = null;
  let _snapPrevT = 0;
  let _snapCurrT = 0;
  // Client-side bullet render state (constant speed)
  const bulletRender = new Map();
  // Remote player render smoothing (no rewind, no buffer delay)
  const remoteRender = new Map(); // id -> { x, y, ang }
  let _prevDrawPlayerBullets = [];
  // id -> { sx, sy, vx, vy, t0 }

  function storeSnapshot(snap) {
    _snapPrev = _snapCurr;
    _snapPrevT = _snapCurrT;
    _snapCurr = snap;
    _snapCurrT = performance.now();
  }

  

  function getInterpolatedSnapshot(delayMs = 120) {
    if (!_snapCurr) return Net?.state?.snapshot || null;
    if (!_snapPrev) return _snapCurr;

    const t = performance.now() - delayMs;
    const span = Math.max(1, _snapCurrT - _snapPrevT);
    const a = clamp((t - _snapPrevT) / span, 0, 1);

    const out = { ..._snapCurr };

    // players
    if (Array.isArray(_snapPrev.players) && Array.isArray(_snapCurr.players)) {
      const A = new Map(_snapPrev.players.map(p => [p.id, p]));
      out.players = _snapCurr.players.map(pb => {
        const pa = A.get(pb.id);
        if (!pa) return pb;
        return {
          ...pb,
          x: pa.x + (pb.x - pa.x) * a,
          y: pa.y + (pb.y - pa.y) * a,
          ang: lerpAngle(pa.ang ?? 0, pb.ang ?? 0, a),
        };
      });
    }

    // enemies
    if (Array.isArray(_snapPrev.enemies) && Array.isArray(_snapCurr.enemies)) {
      const A = new Map(_snapPrev.enemies.map(e => [e.id, e]));
      out.enemies = _snapCurr.enemies.map(eb => {
        const ea = A.get(eb.id);
        if (!ea) return eb;
        return {
          ...eb,
          x: ea.x + (eb.x - ea.x) * a,
          y: ea.y + (eb.y - ea.y) * a,
        };
      });
    }

    // bullets (smooth the server "jumps")
    // NOTE: server bullets currently have no stable id, so we match by owner + similar velocity + nearest position.
    // bullets (constant-speed, time-anchored)
    if (Array.isArray(_snapCurr.bullets)) {
      const now = performance.now();

      out.bullets = _snapCurr.bullets.map(sb => {
        if (!sb) return sb;

        // Build a stable key (no ids yet)
        const key = `${sb.owner ?? 'x'}|${sb.vx}|${sb.vy}`;

        let r = bulletRender.get(key);

        if (!r) {
          // First time seeing this bullet
          r = {
            sx: sb.x,
            sy: sb.y,
            vx: sb.vx,
            vy: sb.vy,
            t0: now
          };
          bulletRender.set(key, r);
        }

        const dt = (now - r.t0) * 0.001;

        return {
          ...sb,
          x: r.sx + r.vx * dt,
          y: r.sy + r.vy * dt
        };
      });
    }

    return out;
  }
  // ===================================
  // STEP 2: GLYPH 3D VISUALS (FULL REPLACE)
  // ===================================

  function drawGlyphVisuals(ctx, target, sx, sy, t){
    const path = player.glyphPath;
    if (!path) return;

    if (path === 'fire')      drawFireVFX(ctx, target, sx, sy, t);
    if (path === 'lightning') drawLightningVFX(ctx, target, sx, sy, t);
    if (path === 'spirit')    drawSpiritVFX(ctx, target, sx, sy, t);
    if (path === 'water')     drawWaterVFX(ctx, target, sx, sy, t);
    if (path === 'earth')     drawEarthVFX(ctx, target, sx, sy, t);
  }
  function drawFireVFX(ctx, e, x, y, t){
    if ((e.burnT ?? 0) <= 0) return;

    const stacks = Math.min(e.burnStacks ?? 1, 3);
    const r = (e.r ?? 14) + 14 + stacks*4;
    const pulse = 0.6 + 0.4*Math.sin(t*6 + e.x*0.02);

    // 🔥 Core molten aura
    drawGlowOrb(ctx, x, y, r, '#ff7a2a', pulse);

    // 🔥 Vertical flame volume (3D illusion)
    drawVerticalEnergyPillar(ctx, x, y, r, '#ff6a00');

    // 🔥 Flame spikes (replaces simple dots)
    drawEnergySpikes(ctx, x, y, r*1.1, 6+stacks, '#ffae66', t);

    // 💥 Detonate ring → now erupting corona
    if (hasG('fire','detonate') && stacks === 3){
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(255,130,60,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x,y,r*2.8 + Math.sin(t*8)*8,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // 🌋 Volcanic Core — MASSIVE pulse
    if (hasG('fire','volcanicCore') && player._volcFlash > 0){
      drawGlowOrb(ctx, x, y, r*3.5, '#ff3a00', 1);
    }
  }
  function drawLightningVFX(ctx, e, x, y, t){
    if ((e.staticT ?? 0) <= 0) return;

    const r = (e.r ?? 14) + 18;
    const flick = 0.7 + 0.3*Math.sin(t*10);

    // ⚡ Charged dome
    drawGlowOrb(ctx, x, y, r, '#9fe3ff', flick);

    // ⚡ Lightning spokes
    ctx.save();
    ctx.strokeStyle = '#e8f7ff';
    ctx.lineWidth = 2;
    ctx.globalCompositeOperation = 'screen';
    for(let i=0;i<4;i++){
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.lineTo(
        x + (Math.random()*2-1)*r,
        y + (Math.random()*2-1)*r
      );
      ctx.stroke();
    }
    ctx.restore();

    // 🌩 Thunderclap — shockwave cylinder
    if (hasG('lightning','thunderclap')){
      drawVerticalEnergyPillar(ctx, x, y, r*1.2, '#cfffff');
    }
  }
  // ================================
  // PLAIN BULLET (NO GLYPHS)
  // ================================
  function spawnPlainBullet(x, y, ang, speed, dmg){
    ents.bullets.push({
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: 4,
      dmg,
      life: 1.1,
      pierce: 0,
      noGlyph: true // 🚫 prevents onHitGlyph
    });
  }
  function drawSpiritVFX(ctx, e, x, y, t){
    if ((e.hauntT ?? 0) <= 0) return;

    const r = (e.r ?? 14) + 20;
    const pulse = 0.6 + 0.4*Math.sin(t*3);

    // 👻 Ethereal body haze
    drawGlowOrb(ctx, x, y, r, '#c066ff', pulse);

    // 👻 Orbiting wisps (now volumetric)
    const count = hasG('spirit','wispSwarm') ? 3 : 1;
    for(let i=0;i<count;i++){
      const a = t*1.5 + i*2.4;
      const wx = x + Math.cos(a)*r*0.8;
      const wy = y + Math.sin(a)*r*0.8;
      drawGlowOrb(ctx, wx, wy, 10, '#e7c7ff', 1);
    }

    // 🔗 Soul Bind tether (NEW — fixes invisibility)
    if (hasG('spirit','soulBind') && player._linkA && player._linkB){
      ctx.save();
      ctx.strokeStyle = 'rgba(200,120,255,0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8,6]);
      ctx.beginPath();
      ctx.moveTo(player._linkA.x - cam.x, player._linkA.y - cam.y);
      ctx.lineTo(player._linkB.x - cam.x, player._linkB.y - cam.y);
      ctx.stroke();
      ctx.restore();
    }
  }
  function drawWaterVFX(ctx, e, x, y, t){
    if ((e.drenchT ?? 0) <= 0) return;

    const r = (e.r ?? 14) + 18;

    // 💧 Liquid body bloom
    drawGlowOrb(ctx, x, y, r, '#4fd3ff', 0.7);

    // 💧 Flow rings (animated vertical depth)
    ctx.save();
    ctx.strokeStyle = 'rgba(180,240,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x,y,r + Math.sin(t*2)*6,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();

    // ❄️ Freeze cross becomes ice pillar shards
    if ((e.freezeT ?? 0) > 0){
      drawEnergySpikes(ctx, x, y, r*1.1, 4, '#cfefff', t);
    }
  }
  function drawEarthVFX(ctx, e, x, y, t){
    if (!hasG('earth','stoneSkin')) return;

    const r = (e.r ?? 14) + 10;

    // 🪨 Crystalline shell
    ctx.save();
    ctx.strokeStyle = 'rgba(125,255,163,0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();

    // 🪨 Growing facets (armor feel)
    drawEnergySpikes(ctx, x, y, r*1.2, 5, '#d9ffe6', t*0.5);

    // 🌎 Quake pulse
    if (hasG('earth','quake') && player._quakeFlash > 0){
      drawGlowOrb(ctx, x, y, r*3, '#7dffa3', 1);
    }
  }
  function getVisualPlayerPos(){
    // Always start from immediate local state (instant)
    let x = player.x;
    let y = player.y;

    // If online, gently bias toward server (matches draw() behaviour)
    if (isNetActive()){
      const me = mySnapshotPlayer();
      if (me){
        const CORRECT_RATE = 0.18; // keep in sync with draw()
        x += (me.x - x) * CORRECT_RATE;
        y += (me.y - y) * CORRECT_RATE;
      }
    }

    return { x, y };
  }

  function mySnapshotPlayer() {
    const s = window.Net?.state?.snapshot;
    if (!s || !Array.isArray(s.players)) return null;
    const me = s.players.find(p => p.id === window.Net.state.peerId);
    return me || null;
  }
  function renderLobbyPlayers(){
    const el = document.getElementById('lobbyPlayers');
    if (!el) return;

    if (!isNetActive()) {
      el.textContent = 'Offline';
      return;
    }

    const snap = Net.state?.snapshot;
    const peers = (snap && Array.isArray(snap.players))
      ? snap.players.map(p => ({ id: p.id, label: (p.name || p.id) }))
      : [];
    const hostId = electedHostId();
    const me = Net.state?.peerId;

    el.innerHTML = peers.map(p => {
      const tag = (p.id === me) ? ' <b>(YOU)</b>' : '';
      return `<div>${p.label}${tag}</div>`;
    }).join('');
  }
  let _lastServerWorldKey = '';
  let _lastServerHadBuildings = false;

  function handleAuthoritativeDeath(){
    // Prevent double-trigger
    if (!state.running) return;

    console.warn("☠️ Authoritative death detected");

    // Stop simulation immediately
    state.running = false;

    // Hard-disable inputs
    input.keys.clear();
    input.mouse.down = false;
    input.touch.fire = false;
    input.touch.stick.active = false;

    // Clear gameplay entities (visual safety)
    ents.enemies.length = 0;
    ents.bullets.length = 0;
    ents.ebullets.length = 0;
    ents.effects.length = 0;
    ents.pickups.length = 0;

    // Reset player locally (no more movement/shooting)
    player.hp = 0;

    // Go back to HOME screen (not pause, not game over overlay)
    ovPause.style.display = 'none';
    ovHome.style.display = 'grid';

    // Optional: stop music / play death sting
    audio.stopMusic();

    // Update UI once
    updateHUD();
  }
  function applyServerWorldFromSnapshot() {
    const snap = Net?.state?.snapshot;
    if (!snap || !snap.world) return;

    const wk = String(snap.meta?.worldKey ?? '') + ':' + String(snap.meta?.chestVer ?? 0);
    const w = snap.world;

    HAS_SERVER_WORLD = true;

    // Hard clear any locally generated geometry
    world.walls.length     = 0;
    world.hazards.length   = 0;
    world.solids.length    = 0;
    world.buildings.length = 0;
    world.chests.length    = 0;

    // Replace with authoritative server world
    if (Array.isArray(w.walls))     world.walls.push(...w.walls);
    if (Array.isArray(w.hazards))   world.hazards.push(...w.hazards);
    if (Array.isArray(w.solids))    world.solids.push(...w.solids);
    if (Array.isArray(w.buildings)) world.buildings.push(...w.buildings);
    if (Array.isArray(w.chests))    world.chests.push(...w.chests);

    nav.rebuild();

    _lastServerWorldKey = wk;
    _lastServerHadBuildings = world.buildings.length > 0;
  }

  // ===== Local player visual smoothing =====
  let _mePrev = null;
  let _meCurr = null;
  let _mePrevT = 0;
  let _meCurrT = 0;

  function storeMeFromSnapshot(snap) {
    if (!snap || !Array.isArray(snap.players)) return;
    const me = snap.players.find(p => p.id === Net.state?.peerId);
    if (!me) return;

    _mePrev = _meCurr;
    _mePrevT = _meCurrT;
    _meCurr = me;
    _meCurrT = performance.now();
  }

  function getSmoothedMe(delayMs = 90) {
    if (!_meCurr) return null;
    if (!_mePrev) return _meCurr;

    const t = performance.now() - delayMs;
    const span = Math.max(1, _meCurrT - _mePrevT);
    const a = clamp((t - _mePrevT) / span, 0, 1);

    return {
      ..._meCurr,
      x: _mePrev.x + (_meCurr.x - _mePrev.x) * a,
      y: _mePrev.y + (_meCurr.y - _mePrev.y) * a,
      ang: lerpAngle(_mePrev.ang ?? 0, _meCurr.ang ?? 0, a)
    };
  }
  // -----------------------------------------------------------------------------
  // HTTP MODE COMPATIBILITY SHIMS (no WebRTC host/peer)
  // -----------------------------------------------------------------------------
  function amHost() {
    return false; // server is authoritative
  }

  
  function amPeer() {
    return isNetActive(); // ✅ THIS CLIENT IS A PEER
  }


  function electedHostId() {
    return null; // no client host
  }

  // Levels / themes -----------------------------------------------------------
  const LEVELS = [
    { id:1, name:'Meadow', badge:'Baseline', accent:'#7dffa3',
      floor:{c1:'#0b1410',c2:'#0a1014',grid:'#1c2f1a33'},
      obs:{fill:'#15251a', stroke:'#2b5a36'},
      hazards:{kind:'none', count:0},
      desc:'No hazards. Baseline squads & buildings.' },
    { id:2, name:'Desert', badge:'Quicksand', accent:'#ffd166',
      floor:{c1:'#1a1410',c2:'#20180f',grid:'#4a361a33'},
      obs:{fill:'#2a2118', stroke:'#6a4a22'},
      hazards:{kind:'sand', count:10},
      desc:'Quicksand pits. Some buildings hide chests.' },
    { id:3, name:'Ice Cavern', badge:'Chasms + Frost', accent:'#9fe3ff',
      floor:{c1:'#0b1320',c2:'#09111b',grid:'#1a355533'},
      obs:{fill:'#0f1b2b', stroke:'#2b4f7a'},
      hazards:{kind:'ice', count:12},
      desc:'Ice chasms. Frost slow from ranged hits.' },
    { id:4, name:'Lava Pits', badge:'Lava + Explosions', accent:'#ff7a66',
      floor:{c1:'#170a0a',c2:'#120607',grid:'#53202244'},
      obs:{fill:'#1a0f12', stroke:'#5a2028'},
      hazards:{kind:'lava', count:14},
      desc:'Lava pools. Enemies explode on death.' },
    { id:5, name:'Neon Void', badge:'Void + Phase', accent:'#d066ff',
      floor:{c1:'#0a0712',c2:'#070712',grid:'#3a285a44'},
      obs:{fill:'#0f0a1f', stroke:'#3a2a7a'},
      hazards:{kind:'void', count:16},
      desc:'Void tiles. Enemies phase-dash at times.' },
  ];
  // ✅ PvE leaderboard scoring per enemy type

  let currentTheme = LEVELS[0];
  // ✅ PvE leaderboard scoring per enemy type
  const PVE_POINTS = {
    ravener: 1,
    tank: 3,
    shooter: 4,
    sniper: 3,
    bomber: 5,
    healer: 2,
    boss: 15
  };

  // ✅ Local fallback (offline) leaderboard
  const pveLeaderboard = Object.create(null);
  let SIM_TICK = 0;
  const FIXED_DT = 1 / 30; // 30Hz lockstep
  let _accum = 0;
  let _prevChestOpenState = new Map(); // id -> boolean opened

  // Persistent settings -------------------------------------------------------
  const store = {
    get k(){ try{ return JSON.parse(localStorage.getItem('arenaSettings')||'{}'); }catch{return {}} },
    set k(v){ localStorage.setItem('arenaSettings', JSON.stringify(v)); },
    read(name, fallback){ return (this.k[name] ?? fallback); },
    write(name, val){ const all=this.k; all[name]=val; this.k=all; }
  };

  // --- Audio (synth SFX + ambient) ---
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audio = {
    ctx:null, sfxOn:true, musicOn:true, master:0.25, musicNode:null,
    init(){ if(!this.ctx) this.ctx = new AudioCtx(); },
    now(){ return this.ctx.currentTime; },
    tone({type='square',freq=440,dur=0.1,vol=0.1,decay=0.2,detune=0,startAt=0}){
      if(!this.sfxOn) return; if(!this.ctx) this.init();
      const t0=this.now()+startAt; const osc=this.ctx.createOscillator(); const gain=this.ctx.createGain();
      osc.type=type; osc.frequency.value=freq; osc.detune.value=detune; gain.gain.value=0;
      osc.connect(gain).connect(this.ctx.destination); osc.start(t0);
      gain.gain.setValueAtTime(vol*this.master, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0+Math.max(0.05,dur+decay));
      osc.stop(t0+dur+decay+0.05);
    },
    noise({dur=0.12, vol=0.2}={}){
      if(!this.sfxOn) return; if(!this.ctx) this.init();
      const sr=this.ctx.sampleRate; const len=Math.max(1,Math.floor(dur*sr));
      const buffer=this.ctx.createBuffer(1,len,sr); const data=buffer.getChannelData(0);
      for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*0.6;
      const src=this.ctx.createBufferSource(); src.buffer=buffer;
      const gain=this.ctx.createGain(); gain.gain.value=vol*this.master;
      src.connect(gain).connect(this.ctx.destination); src.start();
      const t0=this.now(); gain.gain.setValueAtTime(vol*this.master,t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0+dur); src.stop(t0+dur+0.02);
    },
    click(){ this.tone({type:'square', freq:880, dur:.04, vol:.06, decay:.08}); },
    shoot(){ this.tone({type:'sawtooth', freq:220, dur:.06, vol:.18, decay:.18}); },
    shotgun(){ this.noise({dur:.09, vol:.24}); },
    hit(){ this.tone({type:'triangle', freq:160, dur:.05, vol:.14, decay:.18}); },
    hurt(){ this.tone({type:'sawtooth', freq:120, dur:.12, vol:.22, decay:.35}); },
    pickup(){ this.tone({type:'square', freq:620, dur:.08, vol:.16, decay:.25}); },
    reload(){ this.tone({type:'triangle', freq:320, dur:.06, vol:.12, decay:.12}); },
    dash(){ this.tone({type:'square', freq:300, dur:.08, vol:.16, decay:.2}); },
    chest(){ this.tone({type:'square', freq:520, dur:.12, vol:.22, decay:.28}); this.tone({type:'triangle', freq:780, dur:.08, vol:.18, decay:.24, startAt:0.05}); },
    startMusic(){
      if(!this.musicOn) return; if(!this.ctx) this.init(); if(this.musicNode) return;
      const osc1=this.ctx.createOscillator(), osc2=this.ctx.createOscillator(); osc1.type='sine'; osc2.type='sine';
      osc1.frequency.value=110; osc2.frequency.value=147;
      const gain=this.ctx.createGain(); gain.gain.value=0.06*this.master;
      const lfo=this.ctx.createOscillator(), lfoGain=this.ctx.createGain(); lfo.type='sine'; lfo.frequency.value=0.07; lfoGain.gain.value=30;
      lfo.connect(lfoGain); lfoGain.connect(osc1.detune); lfoGain.connect(osc2.detune);
      osc1.connect(gain); osc2.connect(gain); gain.connect(this.ctx.destination);
      const t0=this.now(); osc1.start(t0); osc2.start(t0); lfo.start(t0);
      this.musicNode={osc1,osc2,gain,lfo};
    },
    stopMusic(){ if(this.musicNode){ try{ this.musicNode.osc1.stop(); this.musicNode.osc2.stop(); this.musicNode.lfo.stop(); }catch{} this.musicNode=null; } }
  };

  // Helpers -------------------------------------------------------------------
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;

  // --- deterministic RNG for synchronized lobbies ---
  let _rngSeed = null;
  function srand(seed){ _rngSeed = (seed>>>0); }
  function srandom(){
    // LCG (Numerical Recipes)
    _rngSeed = ((_rngSeed * 1664525) + 1013904223) >>> 0;
    return _rngSeed / 0x100000000;
  }
  // use seeded random if a seed is set, else fall back to Math.random
  const rand=(a,b)=>((_rngSeed!==null ? srandom() : Math.random())*(b-a)+a);
  const rint=(a,b)=>Math.floor(rand(a, b+1));

  const dist2=(ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
  const angleTo=(ax,ay,bx,by)=>Math.atan2(by-ay, bx-ax);
  const nowMS=()=>performance.now();

  // COLORS & DESIGNS ---------------------------------------------------------
  const COLORS = [
    {name:'Blue Core',  c:'#98d7ff'},
    {name:'Red Inferno',c:'#ff7666'},
    {name:'Toxic Green',c:'#7dffa3'},
    {name:'Golden Alloy',c:'#ffdf66'},
    {name:'Void Purple',c:'#c066ff'},
    {name:'Ice White',   c:'#e8f7ff'},
    {name:'Magma Orange',c:'#ff9a3c'}
  ];
  const DESIGNS = [
    {id:0,  name:'Basic Core',          unlock:0,  wing:false},
    {id:1,  name:'Spiked Shell',        unlock:2,  wing:false},
    {id:2,  name:'Toothy Maw',          unlock:3,  wing:false},
    {id:3,  name:'Hex Armor',           unlock:4,  wing:false},
    {id:4,  name:'Cyber Halo',          unlock:5,  wing:false},
    {id:5,  name:'Void Flame',          unlock:6,  wing:false},
    {id:6,  name:'Crystal Shards',      unlock:7,  wing:false},
    {id:7,  name:'Nano-Arms',           unlock:8,  wing:false},
    {id:8,  name:'Plasma Horns',        unlock:9,  wing:false},
    {id:9,  name:'Tri-Blade Wheel',     unlock:10, wing:false},
    {id:10, name:'Angel Wings',         unlock:3,  wing:true,  wingType:'angel'},
    {id:11, name:'Cyber Wings',         unlock:6,  wing:true,  wingType:'cyber'},
    {id:12, name:'Void Wings',          unlock:8,  wing:true,  wingType:'void'},
    {id:13, name:'Fire Wings',          unlock:9,  wing:true,  wingType:'fire'},
    {id:14, name:'Insect Wings',        unlock:5,  wing:true,  wingType:'insect'}
  ];
  // ✅ PER-TAB appearance (prevents mirror bug)
  // ✅ PER-TAB DEFAULT APPEARANCE (prevents mirror bug)
  function getTabDesign() {
    const v = sessionStorage.getItem('design');
    if (v !== null) return parseInt(v, 10);

    // ✅ FIXED DEFAULT (Basic Core)
    const DEFAULT_DESIGN = 0;
    sessionStorage.setItem('design', DEFAULT_DESIGN);
    return DEFAULT_DESIGN;
  }

  function getTabColor() {
    const v = sessionStorage.getItem('color');
    if (v !== null) return parseInt(v, 10);

    // ✅ FIXED DEFAULT (first colour)
    const DEFAULT_COLOR = 0;
    sessionStorage.setItem('color', DEFAULT_COLOR);
    return DEFAULT_COLOR;
  }

  let selectedDesign = getTabDesign();
  let selectedColor  = getTabColor();
  
 // Gun variant indices (persisted)
 // -1 means "Default sprite"
 let pistolIndex  = parseInt(store.read('pistolIndex',  '-1'),10);
 let rifleIndex   = parseInt(store.read('rifleIndex',   '-1'),10);
 let shotgunIndex = parseInt(store.read('shotgunIndex', '-1'),10);

 // Safety clamp (keep -1 as allowed)
 if (!Number.isInteger(pistolIndex))  pistolIndex  = -1;
 if (!Number.isInteger(rifleIndex))   rifleIndex   = -1;
 if (!Number.isInteger(shotgunIndex)) shotgunIndex = -1;
 function cycleGunIndex(kind, dir=1){
  if(kind==='pistol'){ pistolIndex=(pistolIndex+dir+5)%5; store.write('pistolIndex', pistolIndex); }
  if(kind==='rifle'){ rifleIndex=(rifleIndex+dir+5)%5; store.write('rifleIndex', rifleIndex); }
  if(kind==='shotgun'){ shotgunIndex=(shotgunIndex+dir+5)%5; store.write('shotgunIndex', shotgunIndex); }

  // ✅ sync
  if (isNetActive()) {
    Net.setGuns({ pistol: pistolIndex, rifle: rifleIndex, shotgun: shotgunIndex });
  }
}


  // WORLD --------------------------------------------------------------------
  const world = { w:4000, h:2800, solids:[], buildings:[], walls:[], hazards:[], chests:[],
    rr(x,y,w,h){ return {x,y,w,h}; },
    rectOverlap(a,b,pad=0){ return !(a.x+a.w+pad < b.x || b.x+b.w+pad < a.x || a.y+a.h+pad < b.y || b.y+b.h+pad < a.y); },
    buildObstacles(){
      // Reset containers
      this.solids = [];
      this.buildings = [];
      this.walls = [];
      this.chests = [];

      // --- Placement parameters (tune to taste) ---
      // Clearance wide enough for the player (r=16 -> 32) + buffer
      const PATH_GAP = 44;          // minimum free gap between ANY rectangles
      const EDGE_GAP = 40;          // minimum distance from world edges
      const MAX_TRIES = 120;        // attempts per rectangle
      const COUNT = 14 + Math.floor((currentTheme.id - 1) * 2);

      // Arena walls (same as before)
      const arenaLeft   = 0;
      const arenaTop    = 0;
      const arenaRight  = this.w;
      const arenaBottom = this.h;
      this.solids.push(this.rr(arenaLeft, arenaTop,            arenaRight - arenaLeft, 40));
      this.solids.push(this.rr(arenaLeft, arenaBottom - 40,    arenaRight - arenaLeft, 40));
      this.solids.push(this.rr(arenaLeft, arenaTop,            40,                      arenaBottom - arenaTop));
      this.solids.push(this.rr(arenaRight - 40, arenaTop,      40,                      arenaBottom - arenaTop));

      // Helper: returns true if 'rect' is CLEAR of all existing solids & buildings by 'pad'
      const avoidOverlap = (rect, pad) => {
        for (const s of this.solids) {
          if (this.rectOverlap(rect, s, pad)) return false;
        }
        for (const b of this.buildings) {
          // Use the building OUTER rectangle (not inner) for spacing
          const br = { x: b.x, y: b.y, w: b.w, h: b.h };
          if (this.rectOverlap(rect, br, pad)) return false;
        }
        return true;
      };

      // Helper: random rect respecting edge margins
      const randomRect = (wMin, wMax, hMin, hMax) => {
        const w = rint(wMin, wMax);
        const h = rint(hMin, hMax);
        const x = rint(EDGE_GAP, this.w - EDGE_GAP - w);
        const y = rint(EDGE_GAP, this.h - EDGE_GAP - h);
        return { x, y, w, h };
      };

      // Place COUNT rectangles; ~60% chance to be a building (same feel as before)
      // Place COUNT rectangles; ~60% chance to be a building (deterministic RNG)
      for (let i = 0; i < COUNT; i++){
        const wantBuilding = (rand(0,1) < 0.6);
        let placed = false;
        for (let t = 0; t < MAX_TRIES && !placed; t++){
          // Size range mirrors your previous logic (slightly tidied)
          const r = randomRect(
            wantBuilding ? 180 : 160,
            wantBuilding ? 320 : 320,
            wantBuilding ? 140 : 120,
            wantBuilding ? 260 : 260
          );

          // Enforce the clearance gap from EVERYTHING already placed
          if (!avoidOverlap(r, PATH_GAP)) continue;

          if (wantBuilding){
            const tWall = 18;
            const b = {
              x: r.x, y: r.y, w: r.w, h: r.h, t: tWall,
              doors: this.makeDoors(r.x, r.y, r.w, r.h, tWall),
              inner: { x: r.x + tWall, y: r.y + tWall, w: r.w - 2 * tWall, h: r.h - 2 * tWall },
              hasChest: false, chestId: -1
            };
            this.buildings.push(b);
          } else {
            this.solids.push(this.rr(r.x, r.y, r.w, r.h));
          }
          placed = true;
        }
        // If not placed after MAX_TRIES, we skip this slot to keep generation robust
      }

      // Rebuild wall segments around everything we placed
      this.rebuildWalls();
    },
    makeDoors(x,y,w,h,t){
      const sides=['top','bottom','left','right'];
      const doorCount = rint(1,3);
      const doors=[];
      for(let i=0;i<doorCount;i++){
        const side = sides[rint(0,3)];
        const len = rint(54,70);
        if(side==='top' || side==='bottom'){
          const px = rint(x+ t+20, x+w - t-20 - len);
          const py = (side==='top') ? y : y+h-t;
          doors.push({ side, x:px, y:py, w:len, h:t });
        } else {
          const py = rint(y+ t+20, y+h - t-20 - len);
          const px = (side==='left') ? x : x+w-t;
          doors.push({ side, x:px, y:py, w:t, h:len });
        }
      }
      return doors;
    },
    rebuildWalls(){
      this.walls = [];
      for(const s of this.solids) this.walls.push({x:s.x,y:s.y,w:s.w,h:s.h});
      for(const b of this.buildings){
        const {x,y,w,h,t,doors} = b;
        const split = (a,len,holes)=> {
          let segs=[[a, len]];
          for(const ho of holes){
            const hx=ho.start, hw=ho.len, newSegs=[];
            for(const [sa,sl] of segs){
              const sb=sa+sl, hb=hx+hw;
              if(hb<=sa || sb<=hx){ newSegs.push([sa,sl]); continue; }
              if(hx>sa) newSegs.push([sa, Math.max(0,hx-sa)]);
              if(hb<sb) newSegs.push([hb, Math.max(0,sb-hb)]);
            }
            segs = newSegs.filter(s=>s[1]>0);
          }
          return segs;
        };
        const holesTop = doors.filter(d=>d.side==='top').map(d=>({start:d.x, len:d.w}));
        const holesBot = doors.filter(d=>d.side==='bottom').map(d=>({start:d.x, len:d.w}));
        const holesLeft= doors.filter(d=>d.side==='left').map(d=>({start:d.y, len:d.h}));
        const holesRight=doors.filter(d=>d.side==='right').map(d=>({start:d.y, len:d.h}));
        for(const [sx,sl] of split(x, w, holesTop)) this.walls.push({x:sx, y:y, w:sl, h:t});
        for(const [sx,sl] of split(x, w, holesBot)) this.walls.push({x:sx, y:y+h-t, w:sl, h:t});
        for(const [sy,sl] of split(y, h, holesLeft)) this.walls.push({x:x, y:sy, w:t, h:sl});
        for(const [sy,sl] of split(y, h, holesRight)) this.walls.push({x:x+w-t, y:sy, w:t, h:sl});
      }
    },
    buildHazards(){
      const hz=[]; const hc=currentTheme.hazards.count||0; const kind=currentTheme.hazards.kind;
      if(kind==='none'){ this.hazards=[]; return; }
      let tries=0;
      while(hz.length<hc && tries<hc*40){
        tries++;
        const w=rint(140,260), h=rint(120,220), x=rint(160,this.w-160-w), y=rint(160,this.h-160-h);
        const rect={x,y,w,h,type:kind};
        let bad = false;
        if(dist2(x+w/2,y+h/2,this.w/2,this.h/2)<600*600) bad=true;
        for(const s of this.walls){ if(this.rectOverlap(rect,s,30)){ bad=true; break; } }
        if(bad) continue;
        hz.push(rect);
      }
      this.hazards = hz;
    },
    buildChests(){
      for(let i=0;i<this.buildings.length;i++){
        const b = this.buildings[i];
        if (rand(0,1) < 0.55){
          const pad=28; const cx=rand(b.inner.x+pad, b.inner.x+b.inner.w-pad);
          const cy=rand(b.inner.y+pad, b.inner.y+b.inner.h-pad);
          let ovr=false; for(const h of this.hazards){ if(cx>h.x-20 && cx<h.x+h.w+20 && cy>h.y-20 && cy<h.y+h.h+20){ ovr=true; break; } }
          if(ovr) continue;
          const ch = { id: this.chests.length, x:cx, y:cy, r:16, opened:false, buildingIndex:i };
          b.hasChest=true; b.chestId = this.chests.length; this.chests.push(ch);
        }
      }
    },
    circleRectCollide(x,y,r, o){ const cx=clamp(x,o.x,o.x+o.w), cy=clamp(y,o.y,o.y+o.h), dx=x-cx, dy=y-cy; return (dx*dx+dy*dy) < r*r; },
    isBlocked(x,y,r){ for(const w of this.walls){ if(this.circleRectCollide(x,y,r,w)) return true; } return false; },
    collideHazard(x,y,r){ for(const h of this.hazards){ if(this.circleRectCollide(x,y,r,h)) return true; } return false; },
    getHazardAt(x, y, r){
      for (const h of this.hazards) {
        if (this.circleRectCollide(x, y, r, h)) return h;
      }
      return null;
    },
    drawFloor(){
      // ✅ Use CSS pixel size (VIEW.w/VIEW.h), because ctx is already scaled by DPR
      const W = VIEW.w;
      const H = VIEW.h;

      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, currentTheme.floor.c1);
      g.addColorStop(1, currentTheme.floor.c2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const grid = 64;
      const ox = -((cam.x + cam.sx) % grid);
      const oy = -((cam.y + cam.sy) % grid);

      ctx.strokeStyle = currentTheme.floor.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let x = ox; x < W; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = oy; y < H; y += grid) { ctx.moveTo(0, y); ctx.lineTo(W, y); }

      ctx.stroke();

      const vg = ctx.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) / 3,
        W / 2, H / 2, Math.max(W, H) / 1.1
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    },
    drawHazards(){
      const t = performance.now()/1000;
      for(const hz of this.hazards){
        const x=hz.x - cam.x - cam.sx, y=hz.y - cam.y - cam.sy;
        if (hz.type === 'lava') {
          const cx = x + hz.w / 2;
          const cy = y + hz.h / 2;

          // 🔔 WARNING PHASE — glow ring, no damage
          if (hz.phase === 'warn') {
            const pulse = (Math.sin(performance.now() * 0.004) * 0.5 + 0.5);

            ctx.fillStyle = `rgba(255,140,40,${0.15 + pulse * 0.25})`;
            ctx.fillRect(x, y, hz.w, hz.h);

            ctx.save();
            ctx.translate(cx, cy);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255,200,80,${0.5 + pulse * 0.3})`;
            ctx.lineWidth = 4;
            ctx.arc(0, 0, Math.min(hz.w, hz.h) * 0.35, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // 🌋 ERUPTION — instant‑kill blast
          else if (hz.phase === 'eruption') {
            const g = ctx.createLinearGradient(cx, cy - hz.h, cx, cy);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.3, '#ffd766');
            g.addColorStop(1, '#ff6a00');
            ctx.fillStyle = g;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.beginPath();
            ctx.ellipse(0, 0, hz.w * 0.45, hz.h * 1.25, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // 🔥 BURN PHASE — chip damage only
          else if (hz.phase === 'burn') {
            ctx.fillStyle = '#3a1a0a';
            ctx.fillRect(x, y, hz.w, hz.h);

            ctx.fillStyle = 'rgba(255,120,40,0.7)';
            if ((SIM_TICK & 3) === 0) { // once every 4 frames
              for (let i = 0; i < 6; i++) {
                ctx.fillRect(
                  x + Math.random() * hz.w,
                  y + Math.random() * hz.h,
                  3,
                  3
                );
              }
            }
          }

          // 🧱 COOL PHASE
          else {
            const g = ctx.createLinearGradient(0, y, 0, y + hz.h);
            g.addColorStop(0, '#2a1a12');
            g.addColorStop(1, '#1a0e08');
            ctx.fillStyle = g;
            ctx.fillRect(x, y, hz.w, hz.h);
          }

          
        } else if(hz.type==='ice'){
          const cx = x + hz.w / 2, cy = y + hz.h / 2;
          const w = hz.w, h = hz.h;
          const ttilt = performance.now() / 1000;

          // Stable per-hazard seed so each sheet tilts differently across the map
          const seed = (hz.x * 0.013 + hz.y * 0.017);

          // A direction angle that continuously changes over time
          const dir = (seed * Math.PI * 2) + Math.sin(ttilt * 0.6 + seed) * 0.9;

          // 'Elevation' controls perspective squash (0 = top-down, bigger = steeper)
          const elev = 0.35 + 0.15 * Math.sin(ttilt * 0.8 + seed * 2.0); // ~0.2..0.5

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(dir);
          ctx.scale(1, Math.max(0.45, 1 - elev)); // vertical squash for 3D illusion

          // Glassy blue gradient panel
          const g = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
          g.addColorStop(0.00, '#0e2133');
          g.addColorStop(0.40, '#174262');
          g.addColorStop(0.60, '#2a6a95');
          g.addColorStop(1.00, '#0f1b2b');
          ctx.fillStyle = g;
          roundRect(ctx, -w/2, -h/2, w, h, 10);
          ctx.fill();

          // Frosted rim
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = '#9fe3ff66';
          ctx.lineWidth = 3;
          roundRect(ctx, -w/2+1, -h/2+1, w-2, h-2, 9);
          ctx.stroke();

          // Sweeping highlight (moving glint)
          ctx.globalAlpha = 0.25;
          const sweep = Math.sin(ttilt * 1.2 + seed * 3.0);
          ctx.save();
          ctx.translate(sweep * w * 0.25, 0);
          ctx.rotate(0.05 * Math.sin(ttilt * 0.9 + seed));
          const gl = ctx.createLinearGradient(-w*0.6, 0, w*0.6, 0);
          gl.addColorStop(0, '#ffffff00');
          gl.addColorStop(0.5, '#cfe9ff55');
          gl.addColorStop(1, '#ffffff00');
          ctx.fillStyle = gl;
          ctx.fillRect(-w*0.6, -h*0.52, w*1.2, h*1.04);
          ctx.restore();

          // Hairline cracks (very subtle)
          ctx.globalAlpha = 0.20;
          ctx.strokeStyle = '#b8dcff33';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for(let i=0;i<5;i++){
            const px = -w/2 + (i+1) * (w/6);
            ctx.moveTo(px, -h/2 + 10);
            ctx.lineTo(px + Math.sin(seed*10 + i)*10, h/2 - 10);
          }
          ctx.stroke();

          ctx.restore();

          // Thin world-space outline (not squashed)
          ctx.strokeStyle = '#9fe3ff33';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, hz.w - 2, hz.h - 2);
        } else if (hz.type === 'void') {
          const cx = x + hz.w / 2, cy = y + hz.h / 2;
          const r  = Math.min(hz.w, hz.h) * 0.46;
          const spin = performance.now() / 1000 * 0.9 + (hz.x + hz.y) * 0.0013;

          // Deep space base
          const space = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.05);
          space.addColorStop(0.00, '#06050a');
          space.addColorStop(0.55, '#0a0712');
          space.addColorStop(1.00, '#05040a');
          ctx.fillStyle = space;
          ctx.fillRect(x, y, hz.w, hz.h);

          // Event horizon ring
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(spin);
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
          const ring = ctx.createLinearGradient(-r, 0, r, 0);
          ring.addColorStop(0.00, '#bda6ff');
          ring.addColorStop(0.50, '#6e48ff');
          ring.addColorStop(1.00, '#bda6ff');
          ctx.strokeStyle = ring;
          ctx.lineWidth = Math.max(3, r * 0.10);
          ctx.stroke();
          ctx.restore();

          // Accretion swirl (two translucent, counter-rotating arms)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.globalAlpha = 0.65;
          for (const dir of [1, -1]) {
            ctx.save();
            ctx.rotate(spin * dir);
            ctx.beginPath();
            for (let i = 0; i <= 70; i++) {
              const p = i / 70;
              const rr = r * (0.2 + p * 0.8);
              const aa = p * Math.PI * 2.2;
              const xx = Math.cos(aa) * rr;
              const yy = Math.sin(aa) * rr * 0.92;
              if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
            }
            const arm = ctx.createLinearGradient(0, -r, 0, r);
            arm.addColorStop(0, '#6e48ff33');
            arm.addColorStop(1, '#ffffff11');
            ctx.strokeStyle = arm;
            ctx.lineWidth = Math.max(2, r * 0.04);
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();

          // Distant stars
          ctx.save();
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#cfd9ff';
          for (let i = 0; i < 16; i++) {
            const sx = x + ((hz.x * 97 + i * 73) % hz.w);
            const sy = y + ((hz.y * 71 + i * 37) % hz.h);
            ctx.fillRect(sx, sy, 1 + ((i % 3) === 0 ? 1 : 0), 1);
          }
          ctx.restore();

          // Outer frame
          ctx.strokeStyle = '#6e48ff66';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, hz.w - 2, hz.h - 2);

        } else if(hz.type==='sand'){
          const cx = x + hz.w / 2, cy = y + hz.h / 2;
          const rMax = Math.min(hz.w, hz.h) * 0.5;
          const spin = t * 1.2; // rotation speed

          // Base pit shading for depth
          const g = ctx.createRadialGradient(cx, cy, rMax * 0.15, cx, cy, rMax * 1.05);
          g.addColorStop(0.00, '#1b1410');
          g.addColorStop(0.35, '#2b2018');
          g.addColorStop(0.65, '#3a2a1a');
          g.addColorStop(1.00, '#0a0705');
          ctx.fillStyle = g;
          ctx.fillRect(x, y, hz.w, hz.h);

          // Inner shadow ring
          ctx.save();
          ctx.translate(cx, cy);
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.arc(0, 0, rMax * 0.85, 0, Math.PI * 2);
          ctx.strokeStyle = '#00000066';
          ctx.lineWidth = Math.max(6, rMax * 0.10);
          ctx.stroke();
          ctx.restore();

          // Swirling spiral arms (fake 3D look with perspective squash)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(spin);
          ctx.globalAlpha = 0.75;

          const arms = 7;
          const turns = 2.25;
          const thickness = Math.max(3, rMax * 0.05);

          for (let a = 0; a < arms; a++) {
            ctx.save();
            ctx.rotate((a / arms) * Math.PI * 2);
            ctx.beginPath();
            const steps = 90;
            for (let i = 0; i <= steps; i++) {
              const p = i / steps;                   // 0..1
              const rr = rMax * (0.15 + p * 0.85);   // inner->outer
              const ang = p * turns * Math.PI * 2;   // spiral angle
              const xx = Math.cos(ang) * rr;
              const yy = Math.sin(ang) * rr * 0.96;  // slight perspective squash
              if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
            }
            const col = ctx.createLinearGradient(0, -rMax, 0, rMax);
            col.addColorStop(0, '#d4b27a');
            col.addColorStop(1, '#7d5a2a');
            ctx.strokeStyle = col;
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();
          }

          // Rim highlight
          ctx.globalAlpha = 0.25;
          ctx.strokeStyle = '#e8c98a66';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, rMax * 0.98, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Outer outline
          ctx.strokeStyle = '#d3a25a44';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, hz.w - 2, hz.h - 2);
        }
      }
    },
    drawObstacles(){
      ctx.lineWidth=2;
      for(const s of this.solids){
        const x=s.x - cam.x - cam.sx, y=s.y - cam.y - cam.sy;
        ctx.fillStyle=currentTheme.obs.fill; ctx.strokeStyle=currentTheme.obs.stroke;
        roundRect(ctx,x,y,s.w,s.h,10); ctx.fill(); ctx.stroke();
      }
      for(const b of this.buildings){
        const x=b.x - cam.x - cam.sx, y=b.y - cam.y - cam.sy;
        ctx.fillStyle=currentTheme.obs.fill; ctx.strokeStyle=currentTheme.obs.stroke;
        roundRect(ctx,x,y,b.w,b.h,10); ctx.fill(); ctx.stroke();
        ctx.fillStyle='rgba(0,0,0,0.35)'; roundRect(ctx, x+b.t, y+b.t, b.w-2*b.t, b.h-2*b.t, 8); ctx.fill();
        for(const d of b.doors){
          const dx=d.x - cam.x - cam.sx, dy=d.y - cam.y - cam.sy;
          ctx.fillStyle='#111825'; roundRect(ctx,dx,dy,d.w,d.h,4); ctx.fill();
          ctx.strokeStyle='#88aaff66'; ctx.strokeRect(dx,dy,d.w,d.h);
        }
      }
    },
    drawChests(){
      for(let i=0;i<this.chests.length;i++){
        const ch = this.chests[i];
        if(!ch || ch.opened) continue;

        const b = this.buildings[ch.buildingIndex];
        if(!b || !b.inner) continue; // ✅ safety

        // only visible inside the building interior (your original logic)
        if(!pointInRect(player.x, player.y, b.inner)) continue;

        const x = ch.x - cam.x - cam.sx;
        const y = ch.y - cam.y - cam.sy;

        ctx.save();
        ctx.translate(x,y);

        ctx.fillStyle='#6b4a1a';
        roundRect(ctx,-14,-10,28,20,4);
        ctx.fill();

        ctx.fillStyle='#9c6a2a';
        roundRect(ctx,-12,-8,24,16,3);
        ctx.fill();

        ctx.strokeStyle='#e5c26a';
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(-8,0);
        ctx.lineTo(8,0);
        ctx.stroke();

        ctx.restore();
      }
    }
  };
  function roundRect(c,x,y,w,h,r){ const rr=Math.max(0, Math.min(r, Math.min(w,h)/2)); c.beginPath(); c.moveTo(x+rr,y); c.arcTo(x+w,y,x+w,y+h,rr); c.arcTo(x+w,y+h,x,y+h,rr); c.arcTo(x,y+h,x,y,rr); c.arcTo(x,y,x+w,y,rr); c.closePath(); }
  const pointInRect=(px,py, r)=> px>=r.x && px<=r.x+r.w && py>=r.y && py<=r.y+r.h;

  function drawServerWallsOnly(){
    ctx.lineWidth = 2;
    ctx.fillStyle = currentTheme.obs.fill;
    ctx.strokeStyle = currentTheme.obs.stroke;

    for (const w of world.walls){
      const x = w.x - cam.x - cam.sx;
      const y = w.y - cam.y - cam.sy;
      roundRect(ctx, x, y, w.w, w.h, 8);
      ctx.fill();
      ctx.stroke();
    }
  }

  // NAV ----------------------------------------------------------------------
  const nav = { cell: 50, cols:0, rows:0, blocked:[], reachable:[],
    rebuild(){ this.cols=Math.ceil(world.w/this.cell); this.rows=Math.ceil(world.h/this.cell); this.blocked=new Array(this.cols*this.rows).fill(false); const R=18; for(let iy=0; iy<this.rows; iy++){ for(let ix=0; ix<this.cols; ix++){ const cx=ix*this.cell+this.cell/2, cy=iy*this.cell+this.cell/2; this.blocked[iy*this.cols+ix] = world.isBlocked(cx,cy,R) || world.collideHazard(cx,cy,R); } } this.reachable=new Uint8Array(this.cols*this.rows); },
    idx(ix,iy){ return iy*this.cols+ix; },
    inb(ix,iy){ return ix>=0 && iy>=0 && ix<this.cols && iy<this.rows; },
    cellFrom(x,y){ return { ix: clamp(Math.floor(x/this.cell),0,this.cols-1), iy: clamp(Math.floor(y/this.cell),0,this.rows-1) }; },
    floodFrom(ix0,iy0){ this.reachable.fill(0); if(!this.inb(ix0,iy0) || this.blocked[this.idx(ix0,iy0)]) return; const q=[[ix0,iy0]]; this.reachable[this.idx(ix0,iy0)]=1; const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]; while(q.length){ const [ix,iy]=q.shift(); for(const [dx,dy] of dirs){ const nx=ix+dx, ny=iy+dy, id=this.idx(nx,ny); if(!this.inb(nx,ny) || this.reachable[id]) continue; if(this.blocked[id]) continue; this.reachable[id]=1; q.push([nx,ny]); } } },
    isReachable(x,y){ const {ix,iy} = this.cellFrom(x,y); return this.reachable[this.idx(ix,iy)]===1 && !this.blocked[this.idx(ix,iy)]; },
    randomReachableAwayFrom(px,py,minDist=600){ for(let tries=0; tries<80; tries++){ const x=rand(120,world.w-120), y=rand(120,world.h-120); if(dist2(x,y,px,py)<minDist*minDist) continue; if(world.isBlocked(x,y,16) || world.collideHazard(x,y,16)) continue; if(this.isReachable(x,y)) return {x,y}; } return null; }
  };

  // Input ---------------------------------------------------------------------
  const input = { keys:new Set(), mouse:{x:0,y:0,down:false}, touch:{mx:0,my:0, fire:false, stick:{dx:0,dy:0,active:false}} };
  window.addEventListener('keydown', e=>{
    input.keys.add(e.key.toLowerCase());
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (e.key === 'Escape') {
      if (!isNetActive()) {
        togglePause();
      }
    }
    if(e.key.toLowerCase()==='h') showOverlay(ovHelp, ovHelp.style.display!=='grid');
    // Q → equip melee (shows melee idle pose)
    if(e.key.toLowerCase()==='q'){
      if (equip !== 'melee'){ lastGun = player.weapon; equip = 'melee'; updateHUD(); }
      e.preventDefault();
    }

    // E → back to guns; if already on guns, keep cycling forward
    if(e.key.toLowerCase()==='e'){
      if (equip === 'melee'){ equip = 'gun'; setWeapon(lastGun); updateHUD(); }
      else { swapWeapon(1); }
    }

    // Optional: F can also trigger a melee swing (only when melee is equipped)
    if (e.key.toLowerCase()==='f'){
      if (ovGlyphs && ovGlyphs.style.display === 'grid') return;
      if (equip === 'melee') {
        Melee.use(melee);
        if (isNetActive()) {
          try { Net.state.sendEvent({ kind:'melee', ang: player.angle, x: player.x, y: player.y, t: Date.now() }); } catch {}
        }
      }
    }
    if(e.key.toLowerCase()==='r') playerTryReload();
    if(e.key===' ' && !(ovGlyphs && ovGlyphs.style.display==='grid')) playerDash();
  
  // Quick skin cycle for current weapon (Z/X)
  if(e.key.toLowerCase()==='z'){ const w = weapons[player.weapon].kind; cycleGunIndex(w, -1); }
  if(e.key.toLowerCase()==='x'){ const w = weapons[player.weapon].kind; cycleGunIndex(w, +1); }
}, {passive:false});
  window.addEventListener('keyup', e=>input.keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('mousemove', e=>{ const r=canvas.getBoundingClientRect(); input.mouse.x=e.clientX-r.left; input.mouse.y=e.clientY-r.top; });
  canvas.addEventListener('mousedown', ()=>{ input.mouse.down=true; audio.click(); });
  window.addEventListener('mouseup', ()=> input.mouse.down=false);

  // Resize --------------------------------------------------------------------
  function resize(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Backing store in device pixels
    canvas.width  = Math.floor(window.innerWidth  * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);

    // Draw in CSS pixel coordinates
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ✅ Store CSS viewport size for camera math
    const rect = canvas.getBoundingClientRect();
    VIEW.w = rect.width;
    VIEW.h = rect.height;
    VIEW.dpr = dpr;
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Minimap resize (DPR-safe) ---
  let MINI_DPR = 1;
  const MINI_VIEW = { w: 0, h: 0 };

  function resizeMini(){
    MINI_DPR = Math.max(1, window.devicePixelRatio || 1);

    const r = mini.getBoundingClientRect();

    // ✅ CSS size (VISIBLE AREA)
    MINI_VIEW.w = r.width;
    MINI_VIEW.h = r.height;

    // ✅ FORCE CSS SIZE (critical!)
    mini.style.width  = MINI_VIEW.w + 'px';
    mini.style.height = MINI_VIEW.h + 'px';

    // ✅ Backing store (DEVICE PIXELS)
    mini.width  = Math.floor(MINI_VIEW.w * MINI_DPR);
    mini.height = Math.floor(MINI_VIEW.h * MINI_DPR);

    // ✅ Draw in CSS pixel space
    mctx.setTransform(MINI_DPR, 0, 0, MINI_DPR, 0, 0);
  }

  window.addEventListener('resize', resizeMini);
  resizeMini();



  // Camera --------------------------------------------------------------------
  const cam = { x:0, y:0, shake:0, sx:0, sy:0 };
  function updateCamera(dt){
    const online = isNetActive();

    // Use authoritative-me when online (prevents drift)
    const meSnap = online ? mySnapshotPlayer() : null;

    let px = player.x;
    let py = player.y;

    if (online && meSnap) {
      px += (meSnap.x - px) * 0.18;
      py += (meSnap.y - py) * 0.18;
    }
    // ✅ Use CSS viewport size (NOT canvas.width/height which are device pixels)
    const targetX = px - VIEW.w / 2;
    const targetY = py - VIEW.h / 2;

    cam.x = lerp(cam.x, targetX, 0.12);
    cam.y = lerp(cam.y, targetY, 0.12);
  }

  // Entities ------------------------------------------------------------------
  const ents = { bullets:[], ebullets:[], effects:[], enemies:[], pickups:[] };
  ents.wisps = [];
  window._ents = ents;
  // ===========================
  // WORLD VFX (3D, persistent)
  // ===========================
  const worldVfx = []; 
  // { type, x, y, r, t, life, maxLife, el, data }

  function addWorldVfx(v){
    v.t = v.t ?? 0;
    v.maxLife = v.maxLife ?? v.life ?? 1;
    worldVfx.push(v);
  }

  function updateWorldVfx(dt){
    for (let i = worldVfx.length - 1; i >= 0; i--){
      const v = worldVfx[i];
      v.t += dt;
      v.life -= dt;

      // ===== Gameplay tick (offline only) =====
      if (!isNetActive()){
        // Napalm: damage + refresh burn
        if (v.type === 'napalm'){
          const R = (v.r ?? 60);
          for (const e of ents.enemies){
            if (dist2(e.x,e.y,v.x,v.y) <= (R + (e.r??16))*(R + (e.r??16))){
              e.hp -= 7 * dt;
              applyBurn(e, 1, 1.2);
            }
          }
        }

        // Sanctuary: heal player inside
        if (v.type === 'sanctuary'){
          const R = (v.r ?? 70);
          if (dist2(player.x,player.y,v.x,v.y) <= R*R){
            player.hp = Math.min(player.hpMax, player.hp + 10*dt);
          }
        }

        // Maelstrom: pull + damage
        // 🌊 MAELSTROM — QUICKSAND BEHAVIOUR (CIRCULAR PIT)
        if (v.type === 'maelstrom') {
          const R = v.r ?? 120;

          // Fake a sand hazard object so we reuse the real quicksand logic
          const hz = {
            type: 'sand',
            x: v.x - R,
            y: v.y - R,
            w: R * 2,
            h: R * 2
          };

          for (const e of ents.enemies) {
            // circular check (same feel as sand pit edges)
            const dx = e.x - v.x;
            const dy = e.y - v.y;
            if (dx * dx + dy * dy <= R * R) {
              applyQuicksand(e, hz, dt, { isPlayer: false });
            }
          }
        }
      }

      if (v.life <= 0) worldVfx.splice(i,1);
    }
  }

  // ---------- 3D draw helpers ----------
  // ================================
  // ADVANCED GLYPH VFX HELPERS
  // ================================
  function drawGlowOrb(ctx, x, y, r, col, pulse=1){
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(x,y,0,x,y,r*2);
    g.addColorStop(0, `${col}cc`);
    g.addColorStop(0.4, `${col}66`);
    g.addColorStop(1, '#0000');
    ctx.globalAlpha = 0.6 * pulse;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x,y,r*2,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function drawEnergySpikes(ctx, x, y, r, count, col, time){
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    for(let i=0;i<count;i++){
      const a = (i/count)*Math.PI*2 + time*0.8;
      const len = r*(0.7 + 0.3*Math.sin(time*4+i));
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.lineTo(
        x + Math.cos(a)*len,
        y + Math.sin(a)*len
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawVerticalEnergyPillar(ctx, x, y, r, col){
    ctx.save();
    const g = ctx.createLinearGradient(x,y-r*2,x,y+r*2);
    g.addColorStop(0, `${col}00`);
    g.addColorStop(0.5, `${col}aa`);
    g.addColorStop(1, `${col}00`);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x,y,r*0.6,r*2,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  function drawSoftShadow(ctx, x, y, rx, ry, a=0.35){
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  function drawEnergyBeam(ctx, x1,y1, x2,y2, col, w=2, a=0.7){
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawStonePillar3D(ctx, x, y, v){
    const r = v.r ?? 16;
    const h = (v.data?.h ?? 34);
    const wob = 0.9 + 0.1*Math.sin(v.t*2.2);

    ctx.save();

    // ground shadow
    drawSoftShadow(ctx, x, y + 10, r*1.1, r*0.7, 0.35);

    // pillar body (vertical depth)
    const g = ctx.createLinearGradient(x-r, y-h, x+r, y+h);
    g.addColorStop(0.0, '#cfead8');
    g.addColorStop(0.4, '#6fae8b');
    g.addColorStop(1.0, '#2f5a49');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x-r, y-h, r*2, h*2, 6);
    ctx.fill();

    // bevel highlight
    ctx.strokeStyle = 'rgba(210,255,235,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // top cap glow
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.35*wob;
    const cap = ctx.createRadialGradient(x, y-h, 2, x, y-h, r*1.3);
    cap.addColorStop(0,'rgba(255,255,255,0.45)');
    cap.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.arc(x, y-h, r*1.3, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }

  function drawQuakeRing3D(ctx, x, y, v){
    const u = 1 - (v.life / v.maxLife);
    const R = (v.r ?? 120) * u;

    ctx.save();
    ctx.globalAlpha = 0.85*(1-u);

    // shock ring
    ctx.strokeStyle = 'rgba(170,255,210,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x,y,R,0,Math.PI*2);
    ctx.stroke();

    // debris specks
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = 'rgba(210,255,235,0.9)';
    for (let i=0;i<10;i++){
      const a = i*0.63 + v.t*4.0;
      ctx.fillRect(
        x + Math.cos(a)*R,
        y + Math.sin(a)*R,
        2,2
      );
    }

    ctx.restore();
  }

  function drawSanctuary3D(ctx, x, y, v){
    const pulse = 0.92 + 0.08*Math.sin(v.t*2.0);
    const r = (v.r ?? 70) * pulse;

    ctx.save();

    // soft water fill
    ctx.globalAlpha = 0.18;
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(200,245,255,0.45)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();

    // rim
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = 'rgba(120,220,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.stroke();

    // rotating sigil lines (3D-ish)
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = 'rgba(220,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i=0;i<6;i++){
      const a = v.t*0.9 + i*(Math.PI/3);
      ctx.moveTo(x,y);
      ctx.lineTo(x + Math.cos(a)*r*0.85, y + Math.sin(a)*r*0.85);
    }
    ctx.stroke();

    ctx.restore();
  }

  function drawNapalmPatch3D(ctx, x, y, v){
    const r = v.r ?? 60;
    const flick = 0.6 + 0.4*Math.sin(v.t*10);

    ctx.save();

    // molten fill
    ctx.globalAlpha = 0.24*flick;
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(255,180,90,0.55)');
    g.addColorStop(0.35,'rgba(255,110,40,0.35)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();

    // crack rim
    ctx.globalAlpha = 0.40;
    ctx.strokeStyle = 'rgba(255,200,120,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x,y,r*(0.95+0.05*Math.sin(v.t*3)),0,Math.PI*2);
    ctx.stroke();

    ctx.restore();
  }

  function drawMaelstrom3D(ctx, x, y, v) {
    const r = v.r ?? 120;
    const t = v.t;
    const spinA = t * 2.0;
    const spinB = -t * 1.3;

    ctx.save();

    // ===== DEEP RECESSED CORE =====
    const core = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    core.addColorStop(0, 'rgba(10,22,34,0.9)');
    core.addColorStop(0.45, 'rgba(40,90,130,0.6)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'screen';

    // ===== PRIMARY SPIRAL ARMS =====
    ctx.strokeStyle = 'rgba(120,220,255,0.6)';
    ctx.lineWidth = 3;
    for (let a = 0; a < 4; a++) {
      ctx.beginPath();
      for (let i = 0; i <= 50; i++) {
        const p = i / 50;
        const rr = r * p;
        const ang = spinA + a * (Math.PI / 2) + p * 5.2;
        const px = x + Math.cos(ang) * rr;
        const py = y + Math.sin(ang) * rr * 0.8; // depth squash
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // ===== COUNTER‑ROTATING DEPTH ARMS =====
    ctx.strokeStyle = 'rgba(200,245,255,0.35)';
    ctx.lineWidth = 2;
    for (let a = 0; a < 3; a++) {
      ctx.beginPath();
      for (let i = 0; i <= 44; i++) {
        const p = i / 44;
        const rr = r * (0.3 + p * 0.7);
        const ang = spinB + a * (Math.PI * 2 / 3) + p * 4.0;
        const px = x + Math.cos(ang) * rr;
        const py = y + Math.sin(ang) * rr * 0.75;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // ===== RIPPLE POCKETS =====
    ctx.strokeStyle = 'rgba(180,240,255,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const rr = r * (0.35 + 0.25 * Math.sin(t * 2.2 + i));
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ===== ENERGY RIM =====
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = 'rgba(220,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * (0.95 + 0.05 * Math.sin(t * 3.2)), 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawWorldVfx(ctx){
    for (const v of worldVfx){
      const sx = v.x - cam.x - cam.sx;
      const sy = v.y - cam.y - cam.sy;

      if (v.type === 'stonePillar') drawStonePillar3D(ctx, sx, sy, v);
      else if (v.type === 'quake') drawQuakeRing3D(ctx, sx, sy, v);
      else if (v.type === 'sanctuary') drawSanctuary3D(ctx, sx, sy, v);
      else if (v.type === 'napalm') drawNapalmPatch3D(ctx, sx, sy, v);
      else if (v.type === 'maelstrom') drawMaelstrom3D(ctx, sx, sy, v);
    }
  }

  // Weapons & player ----------------------------------------------------------
  const weapons = [
  { name:'Pistol',  kind:'pistol',  dmg:18, rof:5,   spread:0.015, speed:1100, ammo:15, reserve:60,  reload:0.9, recoil:0.4, shots:1, pierce:0, dash:380 },
  { name:'Rifle',   kind:'rifle',   dmg:14, rof:10,  spread:0.010, speed:1400, ammo:28, reserve:112, reload:1.2, recoil:0.25, shots:1, pierce:1, dash:420 },
  { name:'Shotgun', kind:'shotgun', dmg:8,  rof:1.7, spread:0.180, speed:900,  ammo:6,  reserve:36,  reload:1.4, recoil:0.9, shots:8, pierce:0, dash:360 },
];
  const player = {
    x:world.w/2, y:world.h/2, r:16, color:'#aef',
    hp:100, hpMax:100, shield:0, speed:240, spdMul:1,
    weapon:0, ammo:15, reserve:60, angle:0, lastShot:0, reloading:false, reloadT:0,
    dashCD:0, dashI:0, slowT:0,

    // =========================
    // GLYPH GAMEPLAY STATE
    // =========================
    glyphPath: null,     // 'fire'|'lightning'|'spirit'|'water'|'earth'
    glyphTier: 0,        // 0..3
    essence: 0,          // XP orb currency (wave-earned)
    completedGlyphs: {},
    // upgrade flags (set true when you unlock them later)
    glyph: {
      fire: {
        ignite:true,
        hotCoals:false, searingShots:false, ashenFinish:false,
        detonate:false, napalmTrail:false, volcanicCore:false,
        cauterise:false, phoenixStep:false, rebirth:false
      },
      lightning: {
        static:true,
        arcJump:false, forkedArc:false, stormConductor:false,
        chargedRounds:false, overload:false, thunderclap:false,
        staticDash:false, blinkStrike:false, ballLightning:false
      },
      spirit: {
        soulTap:true,
        wispOrbit:false, wispSwarm:false, guardianSpirits:false,
        haunt:false, soulBind:false, dreadBloom:false,
        revenant:false, possession:false, wraithKing:false
      },
      water: {
        drench:true,
        chill:false, iceShards:false, permafrost:false,
        mendingMist:false, tidalRenewal:false, sanctuary:false,
        rippleShot:false, tidalWave:false, maelstrom:false
      },
      earth: {
        stoneSkin:true,
        thornmail:false, spikedBarrier:false, jaggedEarth:false,
        bulwark:false, rootedStance:false, unbreakable:false,
        stonePillar:false, quake:false, golem:false
      }
    },

    // per-wave/per-run trackers
    _rebirthUsed:false,
    _unbreakableUsed:false,
    _guardianCD:0,
    _charged:0,          // lightning charged rounds meter (0..1)
    _lastHitT:0,         // for charged rounds decay
    _killCount:0,    
    
    _tidalHits:0,        // tidal renewal
    _tidalWaveHits:0,    // ✅ REQUIRED
    _tidalWaveCD:0,       // for tidal renewal
    _quakeCD:0,          // earth quake timer
    _ballCD:0,           // ball lightning zap timer
    _wisps:0,            // number of wisps
    _wispCD:0,           // wisp fire timer
    _linkA:null, _linkB:null, _linkT:0, // soul bind
  };
  // 🔍 DEBUG: detect illegal writes to player (lockstep / render bugs)
  Object.seal(player);
  console.log('[DEBUG] player object sealed');
  // --- Melee damage helper: 1/3 of current gun's per-shot damage ---
  function meleeDamageForCurrentWeapon(){
    const w = weapons[player.weapon];
    // Use per-shot damage to keep it consistent across guns;
    // you can clamp a minimum if you like (e.g., Math.max(4, ...))
    return Math.max(3, Math.round(w.dmg / 3));
  }
  // --- Equip state: 'gun' or 'melee' ---
  let equip = 'gun', lastGun = 0;
  let meleeCooldown = 0;   // seconds until next swing allowed

  function setWeapon(i){ player.weapon=(i+weapons.length)%weapons.length; const w=weapons[player.weapon]; weaponName.textContent=w.name; if(player.ammo>w.ammo) player.ammo=w.ammo; updateHUD(); }
  function swapWeapon(d){ setWeapon(player.weapon+d); audio.click(); }
  function playerTryReload(){ const w=weapons[player.weapon]; if(player.reloading||player.ammo>=w.ammo||player.reserve<=0) return; player.reloading=true; player.reloadT=w.reload; audio.reload(); }
  function playerDash(){
    if(player.dashCD>0) return;

    const w=weapons[player.weapon];

    // Lightning Blink Strike replaces dash (short teleport)
    if (isPath('lightning') && hasG('lightning','blinkStrike')){
      const dist = 280;
      const ax=Math.cos(player.angle), ay=Math.sin(player.angle);
      const ox = player.x, oy = player.y;
      player.x += ax*dist; player.y += ay*dist;
      player.x=clamp(player.x,60,world.w-60); player.y=clamp(player.y,60,world.h-60);
      addEffect(ox,oy,'pop',0.22,'#9fe3ff');
      addEffect(player.x,player.y,'pop',0.22,'#9fe3ff');
      player.dashCD=2.2;
      audio.dash();
      return;
    }

    const dash=w.dash*(1+(player.shield>0?0.15:0));
    const ax=Math.cos(player.angle), ay=Math.sin(player.angle);
    const ox = player.x, oy = player.y;

    player.x+=ax*dash; player.y+=ay*dash;
    player.x=clamp(player.x,60,world.w-60); player.y=clamp(player.y,60,world.h-60);

    // Fire Phoenix Step: flame burst + clear slows
    if (isPath('fire') && hasG('fire','phoenixStep')){
      player.slowT = 0;
      aoeDamage(player.x, player.y, 95, 10, { col:'#ff6a2a', burn:true });
    }

    // Lightning Static Dash: shock line (simple version)
    if (isPath('lightning') && hasG('lightning','staticDash')){
      aoeDamage((ox+player.x)/2, (oy+player.y)/2, 90, 8, { col:'#9fe3ff', stun:0.18 });
    }

    cam.shake=Math.max(cam.shake,8);
    player.dashCD=1.4; player.dashI=0.15;
    audio.dash();
  }
  function updateHudButtonsForMode() {
    const online = isNetActive();

    const btnPause = document.getElementById('btnPause');
    const btnRestart = document.getElementById('btnRestart');
    const btnHome = document.getElementById('btnHome');
    const btnSettings = document.getElementById('btnSettings');
    const btnHelp = document.getElementById('btnHelp');
    const btnExit = document.getElementById('btnExit');

    if (!online) {
      // ✅ Single‑player
      btnPause && (btnPause.style.display = 'inline-block');
      btnRestart && (btnRestart.style.display = 'inline-block');
      btnHome && (btnHome.style.display = 'inline-block');
      btnSettings && (btnSettings.style.display = 'inline-block');
      btnHelp && (btnHelp.style.display = 'inline-block');
      btnExit && (btnExit.style.display = 'none');
    } else {
      // ✅ Multiplayer
      btnPause && (btnPause.style.display = 'none');
      btnRestart && (btnRestart.style.display = 'none');
      btnHome && (btnHome.style.display = 'none');
      btnSettings && (btnSettings.style.display = 'none');
      btnHelp && (btnHelp.style.display = 'inline-block');
      btnExit && (btnExit.style.display = 'inline-block');
    }
  }
  function updateHUD(){
    const online = isNetActive();
    const snap = online ? Net.state?.snapshot : null;

    // =========================
    // ✅ WAVE (SERVER FIRST)
    // =========================
    const wave =
      (online && snap && typeof snap.wave === 'number')
        ? snap.wave
        : state.wave;

    waveEl.textContent = wave;

    // =========================
    // ✅ SCORE
    // =========================
    scoreEl.textContent = state.score;

    // =========================
    // ✅ BEST WAVE
    // =========================
    bestEl.textContent = state.best;

    // =========================
    // ✅ PLAYER HP
    // =========================
    const hpPct = Math.max(0, player.hp / player.hpMax) * 100;
    hpFill.style.width = `${hpPct}%`;

    // =========================
    // ✅ SHIELD
    // =========================


    // =========================
    // ✅ SPEED MULTIPLIER
    // =========================
    const slowMul = (player.slowT > 0) ? 0.7 : 1;


    // =========================
    // ✅ WEAPON / AMMO / MELEE
    // =========================
    if (equip === 'melee'){
      ammoFill.style.width = '0%';
      ammoText.textContent = '—';
      weaponName.textContent = `Melee: ${melee?.name ?? '—'}`;
    } else {
      const w = weapons[player.weapon];
      const pct = Math.max(0, player.ammo / w.ammo) * 100;

      ammoFill.style.width = `${pct}%`;
      ammoText.textContent = `${player.ammo} / ${player.reserve}`;
      weaponName.textContent = w.name;
    }

    // =========================
    // ✅ LEVEL / THEME LABEL
    // =========================
    if (currentTheme){
      lvlEl.textContent = `${currentTheme.id} — ${currentTheme.name}`;
    } else {
      lvlEl.textContent = '—';
    }

    // =========================
    // ✅ OPTIONAL DEBUG (remove later)
    // Shows server enemies remaining
    // =========================
    /*
    if (online && snap && Array.isArray(snap.enemies)){
      waveEl.textContent = `${wave} (${snap.enemies.length})`;
    }
    */
    
   
    // =========================
    // =========================
    // ✅ PvE LEADERBOARD (Top 5, horizontal, ranked)
    // =========================
    // =========================
    // ✅ PvE LEADERBOARD (alive & connected players ONLY)
    // =========================
    const lb = document.getElementById('pveLeaderboard');
    if (lb) {
      const scores =
        (online && snap && snap.scores && typeof snap.scores === 'object')
          ? snap.scores
          : pveLeaderboard;

      // ✅ build alive & connected player set
      const alivePlayers = new Map();

      if (online && snap && Array.isArray(snap.players)) {
        for (const p of snap.players) {
          // must exist AND be alive
          if (p && typeof p.hp === 'number' && p.hp > 0) {
            alivePlayers.set(p.id, p);
          }
        }
      } else {
        // offline: local player is always alive
        alivePlayers.set('local', { name: 'You', id: 'local' });
      }

      // ✅ keep ONLY scores from alive players
      const entries = Object.entries(scores)
        .filter(([id]) => alivePlayers.has(id))
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 5);

      lb.innerHTML = '';
      lb.className = 'leaderboard leaderboard-horiz';

      entries.forEach(([id, pts], index) => {
        const p = alivePlayers.get(id);
        const rank = index + 1;
        const name = p?.name || p?.id || id;

        const row = document.createElement('div');
        row.className = `row rank-${rank}`;
        row.innerHTML = `
          <span class="rank">${rank}</span>
          <span class="name">${name}</span>
          <span class="score">${pts || 0}</span>
        `;
        lb.appendChild(row);
      });
    }
    // =========================
    // ✅ HUD Buff Icons (Speed / Shield)
    // =========================
    const buffSpeed  = document.getElementById('buffSpeed');
    const buffShield = document.getElementById('buffShield');

    // ---- SPEED BOOST ----
    if (player.spdMul > 1.01) {
      buffSpeed.classList.remove('hidden');
      buffSpeed.querySelector('.val').textContent =
        player.spdMul.toFixed(2) + '×';
    } else {
      buffSpeed.classList.add('hidden');
    }

    // ---- SHIELD ----
    if (player.shield > 0) {
      buffShield.classList.remove('hidden');
      buffShield.querySelector('.val').textContent =
        Math.round(player.shield);
    } else {
      buffShield.classList.add('hidden');
    }
  }
  function updateNetStatus(){
    const el = document.getElementById('netStatus');
    if (!el) return;

    el.className = 'net-status';
    if (!isNetActive()) el.classList.add('offline');
    else if (amHost()) el.classList.add('host');
    else el.classList.add('peer');
  }
  // ============================
  // MULTIPLAYER GLYPH PHASE
  // ============================
  let netPhase = 'combat';
  let netGlyphTime = 0;

  // Game state ----------------------------------------------------------------
  const state={
    running:false, wave:1, score:0,
    best:parseInt(localStorage.getItem('arenaBest')||'0',10)||0,
    spawnT:0, nextWaveT:0, diff:1.0,
    playerExploded:false,

    // ===== Glyph progression =====
    phase: 'combat',          // 'combat' | 'glyph'
    phaseEndsAt: 0,           // performance.now() ms for offline timer
    essence: 0,               // collected xp orbs this run
    path: null,               // 'fire'|'lightning'|'spirit'|'water'|'earth'
    tier: 0,                  // 0..3
    unlocks: {                // branch flags you can expand later
      fire: {},
      lightning: {},
      spirit: {},
      water: {},
      earth: {}
    },
    completed: { fire:false, lightning:false, spirit:false, water:false, earth:false }
  };
  
  // ✅ PvE leaderboard (playerId → points)


  // Noise events --------------------------------------------------------------
  const noiseEvents=[]; // {x,y,r,t}

  // === Enemy image sprites (from your original build) =======================
  const IMG_SPRITES = {
    ravener:            { src: 'assets/monsters/ravener.png' },
    'gorgon-x':         { src: 'assets/monsters/gorgon-x.png' },
    noctilith:          { src: 'assets/monsters/noctilith.png' },
    hellforged:         { src: 'assets/monsters/hellforged.png' },
    'bone-warden':      { src: 'assets/monsters/bone-warden.png' },
    'blacksite-operative': { src: 'assets/monsters/blacksite-operative.png' },
    'void-seraph':      { src: 'assets/monsters/void-seraph.png' }
  };
  const imgSheets = {};
  function loadImages(){ return new Promise(resolve => { const keys = Object.keys(IMG_SPRITES); if(keys.length===0) return resolve(); let left = keys.length; keys.forEach(k=>{ const meta = IMG_SPRITES[k]; const img = new Image(); img.onload = ()=>{ imgSheets[k] = { img }; if(--left===0) resolve(); }; img.onerror = ()=>{ if(--left===0) resolve(); }; img.src = meta.src; }); }); }
 // === Gun sprites (top-down) ===============================================
 const GUN_SPRITES = {
   pistols: { basePath: 'assets/guns/pistols/',  files: ['pistol1.png','pistol2.png','pistol3.png','pistol4.png','pistol5.png'] },
   rifles:  { basePath: 'assets/guns/rifles/',   files: ['rifle1.png','rifle2.png','rifle3.png','rifle4.png','rifle5.png'] },
   shotguns:{ basePath: 'assets/guns/shotguns/', files: ['shotgun1.png','shotgun2.png','shotgun3.png','shotgun4.png','shotgun5.png'] }
 };
 const gunSheets = { pistols: [], rifles: [], shotguns: [] };
 function loadGunImages(){
   return new Promise(resolve => {
     const groups = Object.keys(GUN_SPRITES);
     let left = groups.reduce((n,k) => n + GUN_SPRITES[k].files.length, 0);
     if(left===0) return resolve();
     for(const kind of groups){
       const { basePath, files } = GUN_SPRITES[kind];
       files.forEach((fname, idx) => {
         const img = new Image();
         img.onload = () => { gunSheets[kind][idx] = img; if(--left===0) resolve(); };
         img.onerror = () => { console.warn('Missing gun sprite:', basePath+fname); if(--left===0) resolve(); };
         img.src = basePath + fname;
       });
     }
   });
 }
 
 // === MELEE ================================================================
  // 1) Preload all melee sprites (common/rare/epic/legendary/god)

  // 2) Persisted selection (rarity + specific sprite name)
  let meleeRarity = (store.read('meleeRarity', 'common') || 'common');
  let meleeName   = (store.read('meleeName',   Melee.firstOf(meleeRarity, 'punch')));
  // Per-sprite scale overrides: 1.0 = original size; <1 = smaller; >1 = bigger
  // Put entries here for any sprite that looks too big/small.
  const MELEE_LENGTH_OVERRIDES = {
    // Examples (tweak or delete these as you see fit):
    common_blade1: 0.50,
    rare_punch1: 1.50,
    common_blade2: 0.50,
    rare_blade1: 0.50,
    rare_blade2: 0.50,
    rare_blade3: 0.50,
    rare_punch2: 4.0,
    epic_punch1: 3.0,
    epic_punch2: 2.0,
    epic_punch3: 2.0,
    epic_blade2: 0.75,
    legendary_blade3: 0.5,
    legendary_blade1: 0.75,
    legendary_blade2: 0.4,
    god_punch1: 4.0,
    god_punch2: 2.0,
    god_blade3: 1.75,
    god_blade1: 1.75,
    god_blade2: 1.75,


    // 'legendary_blade1': 0.95,
  };

  // Optional: allow per-sprite custom overrides to persist in localStorage
  function getMeleeScaleFor(name){
    const saved = parseFloat(store.read('meleeScale.' + name, 'NaN'));
    if (!Number.isNaN(saved) && saved > 0) return saved;
    return MELEE_LENGTH_OVERRIDES[name] ?? 1.0;
  }
  function setMeleeScaleFor(name, scale){
    if (scale > 0) store.write('meleeScale.' + name, String(scale));
  }
  
function defaultMeleeLength(rarity, name){
  // Create a temporary instance WITHOUT an explicit length
  // so the module assigns its own default based on the kind inferred from 'name'
  const tmp = Melee.create({ rarity, name });
  return tmp.length; // e.g., punch≈34, kick≈38, blade≈64 (from the module)
}

  // --- Melee combat numbers (tweak as needed) ---
  const MELEE_DAMAGE = 35;       // base damage
  const MELEE_RANGE  = 60;       // how far the punch reaches
  const MELEE_ARC    = Math.PI/2;  // 90-degree cone in front of the player

  // 3) Create an animatable melee instance
  const baseLen0 = defaultMeleeLength(meleeRarity, meleeName);
  let melee = Melee.create({
    rarity: meleeRarity,
    name: meleeName,
    length: Math.round(baseLen0 * getMeleeScaleFor(meleeName))
  });
 
const SPRITE_OFFSET = {
  pistol:  { x: -0.2, y: -0.5 },
  rifle:   { x: -0.2, y: -0.5 },
  shotgun: { x: -0.1, y: -0.5 }  // FIXES VISUAL OFFSET
};


  // === Player designs (animated vector) =====================================
  function drawWing(type, t){ ctx.save(); const flap = Math.sin(t*6)*0.25; if(type==='angel'){ ctx.rotate(-0.6+flap); drawFeatherWing('#eef', '#ccd'); ctx.rotate(1.2-2*flap); drawFeatherWing('#eef', '#ccd'); } else if(type==='cyber'){ ctx.rotate(-0.5+flap*0.6); drawBladeWing('#9cf'); ctx.rotate(1.0-flap*1.2); drawBladeWing('#9cf'); } else if(type==='void'){ ctx.rotate(-0.55+flap*0.4); drawShadowWing('#a6f'); ctx.rotate(1.1-flap*0.8); drawShadowWing('#a6f'); } else if(type==='fire'){ ctx.rotate(-0.55+flap*0.5); drawFlameWing('#ff9a3c'); ctx.rotate(1.1-flap*1.0); drawFlameWing('#ff9a3c'); } else if(type==='insect'){ ctx.rotate(-0.35+flap*1.2); drawInsectWing('#aef'); ctx.rotate(0.7-flap*2.4); drawInsectWing('#aef'); } ctx.restore(); }
  function drawFeatherWing(light, dark){ ctx.strokeStyle=dark; ctx.lineWidth=2; ctx.fillStyle=light; ctx.beginPath(); ctx.ellipse(-20, -2, 28, 14, -0.1, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(-34, -6, 22, 10, -0.15, 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
  function drawBladeWing(glow){ ctx.strokeStyle=glow; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-42,-12); ctx.lineTo(-46,-4); ctx.lineTo(-14,6); ctx.closePath(); ctx.stroke(); }
  function drawShadowWing(glow){ ctx.fillStyle='rgba(160,110,255,0.28)'; ctx.beginPath(); ctx.ellipse(-26, -4, 26, 16, -0.2, 0, Math.PI*2); ctx.fill(); }
  function drawFlameWing(col){ const g=ctx.createLinearGradient(-40,0,-10,0); g.addColorStop(0,'#0000'); g.addColorStop(1,col); ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-10,0); ctx.quadraticCurveTo(-38,-10,-44,-2); ctx.quadraticCurveTo(-30,12,-10,4); ctx.fill(); }
  function drawInsectWing(col){ ctx.strokeStyle=col; ctx.globalAlpha=0.6; ctx.beginPath(); ctx.ellipse(-24, -2, 24, 12, -0.1, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
  function drawDesign(designId, bodyColor, t, r){
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    switch (designId) {
      case 0:
        ctx.strokeStyle = bodyColor + 'aa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 3 + Math.sin(t * 4), 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 1:
        ctx.strokeStyle = '#ff6478aa';
        ctx.lineWidth = 3;
        for (let i = 0; i < 10; i++) {
          const a = i * (Math.PI * 2 / 10) + t * 1.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2));
          ctx.lineTo(Math.cos(a) * (r + 10), Math.sin(a) * (r + 10));
          ctx.stroke();
        }
        break;

      case 2:
        ctx.fillStyle = '#1b1120aa';
        for (let i = 0; i < 8; i++) {
          const a = i * (Math.PI * 2 / 8) + t * 1.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2));
          ctx.lineTo(Math.cos(a + 0.2) * (r + 6), Math.sin(a + 0.2) * (r + 6));
          ctx.fill();
        }
        break;

      case 3:
        ctx.strokeStyle = '#5b7faaaa';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = i * (Math.PI * 2 / 6) + t * 0.6;
          ctx.beginPath();
          for (let j = 0; j < 6; j++) {
            const aa = a + j * (Math.PI * 2 / 6);
            const rr = r + 6;
            const x = Math.cos(aa) * rr;
            const y = Math.sin(aa) * rr;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
        break;

      case 4:
        ctx.strokeStyle = '#9cf';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r + 10, t, t + Math.PI * 1.4);
        ctx.stroke();
        break;

      case 5:
        ctx.fillStyle = 'rgba(192,102,255,0.28)';
        for (let i = 0; i < 12; i++) {
          const a = i * (Math.PI * 2 / 12) + Math.sin(t * 2) * 0.2;
          ctx.beginPath();
          ctx.ellipse(
            Math.cos(a) * (r + 2),
            Math.sin(a) * (r + 2),
            6 + Math.sin(t * 4 + i) * 2,
            12,
            a,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        break;

      case 6:
        ctx.fillStyle = '#aef';
        for (let i = 0; i < 6; i++) {
          const a = i * (Math.PI * 2 / 6) + t * 1.0;
          ctx.save();
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(r + 4, 0);
          ctx.lineTo(r + 14, -5);
          ctx.lineTo(r + 18, 0);
          ctx.lineTo(r + 14, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        break;

      case 7:
        ctx.strokeStyle = '#7dffa3';
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const a = t * 2 + i * 2.09;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(a) * (r + 16), Math.sin(a) * (r + 16));
          ctx.stroke();
        }
        break;

      case 8:
        ctx.fillStyle = '#ff9a3caa';
        for (let s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(s * (r + 4), -6, 6, 10, 0.3 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 9:
        ctx.fillStyle = '#e8eefb';
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + i * (Math.PI * 2 / 3);
          ctx.save();
          ctx.rotate(a);
          ctx.fillRect(r * 0.2, -3, 18, 6);
          ctx.restore();
        }
        break;

      case 10: drawWing('angel', t); break;
      case 11: drawWing('cyber', t); break;
      case 12: drawWing('void', t); break;
      case 13: drawWing('fire', t); break;
      case 14: drawWing('insect', t); break;
    }
  }

  // CUSTOMIZE UI --------------------------------------------------------------
  
function buildSkins(){
  const grid = document.getElementById('skinGrid');
  if(!grid) return;
  grid.innerHTML='';
  const best = state.best || 0;
  DESIGNS.forEach(d => {
    const card = document.createElement('div');
    card.className='skinCard';
    const unlocked = best >= d.unlock;
    if(!unlocked) card.classList.add('locked');

    const icon = document.createElement('div');
    icon.className='skinIcon';
    icon.style.background = '#182138';

    const ic = document.createElement('canvas');
    ic.width=52; ic.height=52;
    const cc=ic.getContext('2d');
    cc.translate(26,26);
    cc.fillStyle = COLORS[0].c;
    cc.beginPath(); cc.arc(0,0, 12, 0, Math.PI*2); cc.fill();
    cc.strokeStyle='#9cf'; cc.beginPath(); cc.arc(0,0, 16, 0, Math.PI*1.5); cc.stroke();
    icon.appendChild(ic);

    const name = document.createElement('div');
    name.textContent = unlocked ? d.name : ('Unlock @ Wave ' + d.unlock);

    card.appendChild(icon);
    card.appendChild(name);

    if(unlocked){
      card.onclick = () => {
        selectedDesign = d.id;
        store.write('design', selectedDesign);
        sessionStorage.setItem('design', selectedDesign);

        // ✅ MULTIPLAYER: sync body design to server
        if (isNetActive()) {

          Net.setDesign(selectedDesign);
          Net.setColor(selectedColor);
        }

        buildSkins();
      };
    }

    const colorRow = document.createElement('div');
    colorRow.className='colorRow';
    COLORS.forEach((col, idx)=>{
      const sw = document.createElement('div');
      sw.className='colorSwatch';
      sw.style.background = col.c;
      if(!unlocked){
        sw.style.opacity = '.35';
      } else {
        sw.onclick = () => {
          selectedColor = idx;
          store.write('color', selectedColor);
          sessionStorage.setItem('color', selectedColor);

          // ✅ MULTIPLAYER: sync colour
          if (isNetActive()) {
            Net.setColor(selectedColor);
          }

          buildSkins();
        };
      }
      if(unlocked && selectedDesign===d.id && selectedColor===idx){
        sw.style.outline='2px solid #fff';
      }
      colorRow.appendChild(sw);
    });
    card.appendChild(colorRow);

    if(unlocked && selectedDesign===d.id){ card.style.borderColor = '#5ad2ff'; }

    grid.appendChild(card);
  });
}


// ---- Tabs & Guns UI -----------------------------------------------------
const tabPlayerBtn = document.getElementById('tabPlayerBtn');
const tabGunsBtn   = document.getElementById('tabGunsBtn');
const tabMeleeBtn  = document.getElementById('tabMeleeBtn'); // NEW
const playerTab    = document.getElementById('playerTab');
const gunTab       = document.getElementById('gunTab');
const meleeTab     = document.getElementById('meleeTab');     // NEW
if (tabPlayerBtn && tabGunsBtn && tabMeleeBtn) {
  tabPlayerBtn.onclick = () => {
    tabPlayerBtn.classList.add('active');  tabGunsBtn.classList.remove('active'); tabMeleeBtn.classList.remove('active');
    if(playerTab) playerTab.style.display='block';
    if(gunTab)    gunTab.style.display='none';
    if(meleeTab)  meleeTab.style.display='none';
  };
  tabGunsBtn.onclick = () => {
    tabGunsBtn.classList.add('active');  tabPlayerBtn.classList.remove('active'); tabMeleeBtn.classList.remove('active');
    if(playerTab) playerTab.style.display='none';
    if(gunTab)    gunTab.style.display='block';
    if(meleeTab)  meleeTab.style.display='none';
  };
  tabMeleeBtn.onclick = () => {
    tabMeleeBtn.classList.add('active'); tabPlayerBtn.classList.remove('active'); tabGunsBtn.classList.remove('active');
    if(playerTab) playerTab.style.display='none';
    if(gunTab)    gunTab.style.display='none';
    if(meleeTab)  meleeTab.style.display='block';
  };
}

function bestWave(){
  const best = state?.best || parseInt(localStorage.getItem('arenaBest')||'0',10) || 0;
  return best;
}

function updateBestWave(w) {
  const current = bestWave();

  if (w > current) {
    // ✅ update runtime state (immediate unlocks)
    state.best = w;

    // ✅ persist progression
    localStorage.setItem('arenaBest', String(w));
  }
}

function maybeUpdateBestWave(w) {
  const mode = localStorage.getItem('arenaMode');

  // ✅ Single-player
  if (!isNetActive()) {
    updateBestWave(w);
    return;
  }

  // ✅ Multiplayer PvE
  if (mode === 'pve') {
    updateBestWave(w);
  }
}

const UNLOCK_GUN_WAVE = {
  pistol:  [2, 5, 10, 15, 20],
  rifle:   [5, 10, 15, 20, 25],
  shotgun: [10, 15, 20, 25, 30]
};

function buildGunsUI(){
  const bw = bestWave();

  const makeGrid = (gridId, kind, currentIndex) => {
    const grid = document.getElementById(gridId); if(!grid) return; grid.innerHTML='';
    const sheetKey = kind + 's';
    const basePath = GUN_SPRITES[sheetKey].basePath;
    const files    = GUN_SPRITES[sheetKey].files;
    const unlocks  = UNLOCK_GUN_WAVE[kind];

        // ---- DEFAULT CARD (always unlocked) ----
    {
        const card = document.createElement('div');
        card.className = 'gunSkinCard defaultCard';

        const label = document.createElement('div');
        label.textContent = 'Default';
        label.style.fontWeight = '800';
        label.style.opacity = '0.9';
        card.appendChild(label);

        card.onclick = () => {
            if (kind === 'pistol')  { pistolIndex  = -1; store.write('pistolIndex',  -1); }
            if (kind === 'rifle')   { rifleIndex   = -1; store.write('rifleIndex',   -1); }
            if (kind === 'shotgun') { shotgunIndex = -1; store.write('shotgunIndex', -1); }
            makeGrid(gridId, kind, -1);
            
            if (isNetActive()) {
              Net.setGuns({
                pistol: pistolIndex,
                rifle: rifleIndex,
                shotgun: shotgunIndex
              });
            }

        };

        if (currentIndex === -1) card.classList.add('selected');
        grid.appendChild(card);
    }

    files.forEach((fname, idx) => {
      const card = document.createElement('div');
      card.className = 'gunSkinCard';

      const img = document.createElement('img');
      img.className = 'gunSkinImg';
      img.src = basePath + fname + '?v=' + (idx+1);
      card.appendChild(img);

      const req = unlocks[idx] || 9999;
      const isUnlocked = bw >= req;

      if(!isUnlocked){
        card.classList.add('locked');
        const badge = document.createElement('div');
        badge.className='lockBadge';
        badge.textContent = 'Unlock @ Wave ' + req;
        card.appendChild(badge);
      } else {
        
      card.onclick = () => {
        // ✅ Set the chosen skin index (NOT -1)
        if (kind === 'pistol')  { pistolIndex  = idx; store.write('pistolIndex',  idx); }
        if (kind === 'rifle')   { rifleIndex   = idx; store.write('rifleIndex',   idx); }
        if (kind === 'shotgun') { shotgunIndex = idx; store.write('shotgunIndex', idx); }

        // Rebuild with the new selection highlighted
        makeGrid(gridId, kind, idx);

        // ✅ Sync to server so it persists in multiplayer
        if (isNetActive()) {
          Net.setGuns({
            pistol: pistolIndex,
            rifle: rifleIndex,
            shotgun: shotgunIndex
          });
        }
      };

      }

      if (idx === currentIndex) card.classList.add('selected');
      grid.appendChild(card);
    });
  };

  makeGrid('pistolGrid','pistol', pistolIndex);
  makeGrid('rifleGrid','rifle',   rifleIndex);
  makeGrid('shotgunGrid','shotgun', shotgunIndex);
}

function buildMeleeUI(){
  // target grid elements by rarity
  const grids = {
    common:     document.getElementById('meleeCommonGrid'),
    rare:       document.getElementById('meleeRareGrid'),
    epic:       document.getElementById('meleeEpicGrid'),
    legendary:  document.getElementById('meleeLegendaryGrid'),
    god:        document.getElementById('meleeGodGrid')
  };
  const order = ['common','rare','epic','legendary','god'];
  // clear all grids
  order.forEach(r => { if (grids[r]) grids[r].innerHTML=''; });

  // pull sprite file info from the melee module
  const files = Melee._files || {}; // { rarity: { basePath, names[] } }

  order.forEach(rarity => {
    const grid = grids[rarity];
    if (!grid) return;
    const spec = files[rarity];
    if (!spec) return;

    const base = spec.basePath || '';
    const names = spec.names || [];

    names.forEach(name => {
      const card = document.createElement('div');
      card.className = 'gunSkinCard'; // reuse style
      const img = document.createElement('img');
      img.className = 'gunSkinImg';

      // Add extension only if name has none (matches module loader)
      const hasExt = /\.(png|gif|webp|jpe?g)$/i.test(name);
      img.src = base + (hasExt ? name : (name + '.png'));
      card.appendChild(img);

      const selected = (meleeRarity === rarity && meleeName === name);
      if (selected) card.classList.add('selected');

      card.onclick = () => {
        meleeRarity = rarity;
        meleeName   = name;
        store.write('meleeRarity', meleeRarity);
        store.write('meleeName',   meleeName);

        // Recreate melee with your current size (you set 200 earlier)
        // Recreate melee with per-sprite scaling (keep anchor)
        // Recreate melee with per-sprite scaling (fresh baseline, no carry-over)
        const keepAnchor = melee?.anchorDist ?? 0.4;
        const baseLen    = defaultMeleeLength(meleeRarity, meleeName); // ← NEW
        const scale      = getMeleeScaleFor(meleeName);

        melee = Melee.create({
          rarity: meleeRarity,
          name: meleeName,
          length: Math.round(baseLen * scale),
          anchorDist: keepAnchor
        });

        // If user is previewing melee, auto‑equip
        equip = 'melee';
        updateHUD();

        // Refresh selection highlight
        buildMeleeUI();
      };

      grid.appendChild(card);
    });
  });
}

// Rewire Customize button to build both tabs on open
// Rewire Customize button: build Player, Guns, and Melee tabs on open
if (btnHomeCustomize){
  btnHomeCustomize.onclick = () => {
    buildSkins();
    buildGunsUI();
    buildMeleeUI(); // NEW
    showOverlay(ovCustomize, true);
  };
}

  // ===== AI Helpers: tiers, buildings, doors, line-of-sight, squads =====
  let DEBUG_AI = false;

  // Progressive AI tiers by wave
  function aiTier() {
    const w = state.wave;               // uses your existing state.wave
    if (w < 3) return 0;                // Tier 0: dumb chase
    if (w < 6) return 1;                // Tier 1: door-aware
    if (w < 9) return 2;                // Tier 2: team roles (block/flank)
    if (w < 12) return 3;               // Tier 3: hazards-aware
    return 4;                           // Tier 4+: boss commands & full team
  }

  // Which building (if any) contains a point (inside the inner rectangle)?
  function buildingAt(x, y) {
    for (const b of world.buildings) {
      if (x >= b.inner.x && x <= b.inner.x + b.inner.w &&
          y >= b.inner.y && y <= b.inner.y + b.inner.h) {
        return b;
      }
    }
    return null;
  }

  // Return center points for all doors of a building
  function doorCenters(b) {
    const list = [];
    for (const d of b.doors) {
      const cx = d.side === 'left'  ? d.x + d.w/2 :
                d.side === 'right' ? d.x + d.w/2 :
                d.x + d.w/2;
      const cy = d.side === 'top'   ? d.y + d.h/2 :
                d.side === 'bottom'? d.y + d.h/2 :
                d.y + d.h/2;
      list.push({ x: cx, y: cy });
    }
    return list;
  }
  // --- nearest player (local + remote snapshot) ------------------------------
  function nearestPlayerTo(x, y){
    // Online: use snapshot players (includes remote peers) + include local player
    if (isNetActive() && hasFreshSnapshot() && Net.state?.snapshot?.players?.length) {
      let best = { x: player.x, y: player.y };
      let bestD2 = dist2(x, y, player.x, player.y);

      for (const p of Net.state.snapshot.players) {
        if (!p) continue;
        const d2 = dist2(x, y, p.x, p.y);
        if (d2 < bestD2) { bestD2 = d2; best = p; }
      }
      return best;
    }

    // offline fallback
    return { x: player.x, y: player.y };
  }

  // Nearest door (center) of building b to (x,y)
  function nearestDoor(b, x, y) {
    let best = null, bestD2 = Infinity;
    for (const p of doorCenters(b)) {
      const dx = p.x - x, dy = p.y - y, d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = p; }
    }
    return best;
  }

  // Cheap line-of-sight test: sample along the segment and check wall collision
  function losBlocked(ax, ay, bx, by) {
      // Step length in pixels
      const step = 8;

      const dx = bx - ax, dy = by - ay;
      const dist = Math.hypot(dx, dy) || 1;

      const nx = dx / dist, ny = dy / dist;
      const steps = Math.ceil(dist / step);

      for (let i = 1; i <= steps; i++) {
          const px = ax + nx * i * step;
          const py = ay + ny * i * step;

          // Check against EVERY wall segment directly
          for (const w of world.walls) {
              if (px >= w.x && px <= w.x + w.w &&
                  py >= w.y && py <= w.y + w.h) {

                  // Inside a wall rect → LOS is blocked
                  return true;
              }
          }
      }
      return false;
  }

  // Find nearest hazardous tile (by rectangle) around (x, y)
  function nearestHazard(x, y) {
    let best = null, bestD2 = Infinity;
    for (const h of world.hazards) {
      const cx = h.x + h.w/2, cy = h.y + h.h/2;
      const dx = cx - x, dy = cy - y, d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = h; }
    }
    return best;
  }
  // --- Rectangle corners CW order (outer building rect) ----------------------
  function rectCornersCW(b) {
    return [
      { x: b.x,         y: b.y },          // top-left
      { x: b.x + b.w,   y: b.y },          // top-right
      { x: b.x + b.w,   y: b.y + b.h },    // bottom-right
      { x: b.x,         y: b.y + b.h }     // bottom-left
    ];
  }

  // --- Find the index of the nearest corner to (x,y) -------------------------
  function nearestCornerIndex(corners, x, y) {
    let best = 0, bestD2 = Infinity;
    for (let i = 0; i < corners.length; i++) {
      const dx = corners[i].x - x, dy = corners[i].y - y, d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    }
    return best;
  }

  // --- Return true if there is a clear straight path from (x,y) to any door ---
  function anyDoorLOSOpen(b, x, y) {
    for (const d of doorCenters(b)) {
      if (!losBlocked(x, y, d.x, d.y)) return { x: d.x, y: d.y }; // pick this door
    }
    return null;
  }

  // Simple squad system: group enemies spawned close in time into small squads
  let _nextSquadId = 1;
  let _squadOpenUntil = 0;
  let _currentSquadId = 0;
  let _currentSquadCount = 0;

  function assignSquad(e) {
    const now = performance.now() / 1000;
    if (now > _squadOpenUntil || _currentSquadCount >= 4) {
      // start a new squad window (~2 seconds)
      _currentSquadId = _nextSquadId++;
      _squadOpenUntil = now + 2.0;
      _currentSquadCount = 0;
    }
    e.squadId = _currentSquadId;
    _currentSquadCount++;

    // Roles at Tier 2+: leader (1), blocker (1-2), rest flankers
    // We'll assign role here; AI can ignore it until higher tiers
    const idxInSquad = _currentSquadCount; // 1-based
    if (idxInSquad === 1) e.role = 'leader';
    else if (idxInSquad <= 3) e.role = 'blocker';
    else e.role = 'flanker';

    // Waypoint memory
    e.goal = null;            // {x,y}
    e.hold = false;           // blockers can hold a door
  }
  // ENEMIES -------------------------------------------------------------------
  function spawnEnemy(type,x,y){
    const e = {
      type, x, y,
      r:14, color:'#f77', speed:180,
      hp:40, maxhp:40,
      t:0,
      cd: rand(0,1.0) + 0.2,          // deterministic
      vx:0, vy:0, frameT:0,
      alerted:false, alertT:0, detectR:560,
      origin:{x,y},
      phaseCD: rand(0,0.8) + 0.4,     // deterministic

      // =========================
      // STATUS EFFECT STATE
      // =========================
      burnStacks:0, burnT:0,
      staticT:0, staticPrimed:false,
      drenchStacks:0, drenchT:0,
      freezeT:0,
      hauntT:0,
      stunT:0,
      bleedT:0,
      slowMul:1
    };
    switch(type){
      case 'chaser': e.speed=210; e.hp=e.maxhp=45; e.r=16; e.detectR=600; break;
      case 'tank'  : e.speed=100; e.hp=e.maxhp=140; e.r=19; e.detectR=560; break;
      case 'shooter':e.speed=150; e.hp=e.maxhp=55; e.r=15; e.detectR=700; break;
      case 'sniper': e.speed=120; e.hp=e.maxhp=50; e.r=16; e.detectR=900; e.cd=1.8; break;
      case 'bomber': e.speed=190; e.hp=e.maxhp=35; e.r=17; e.detectR=650; break;
      case 'healer': e.speed=140; e.hp=e.maxhp=70; e.r=15; e.detectR=650; e.healCD = 1.6; e.healR = 240; break;
      case 'boss'  : e.speed=130; e.hp=e.maxhp=1000; e.r=34; e.cd=0.5; e.detectR=800; e.commandCD = 3.0; break;
    }
    ents.enemies.push(e);
    assignSquad(e);
  }
  // =========================================================
  // GLYPH GAMEPLAY ENGINE (single-player/offline)
  // =========================================================

  function isPath(p){
    return player.glyphPath === p || player.completedGlyphs[p];
  }
  function hasG(path, key){ return !!(player.glyph?.[path]?.[key]); }

  function applyBurn(e, stacks=1, dur=3.6){
    e.burnStacks = Math.min(3, (e.burnStacks||0) + stacks);
    e.burnT = Math.max(e.burnT||0, dur);
  }
  function applyDrench(e, stacks=1, dur=4.0){
    e.drenchStacks = Math.min(3, (e.drenchStacks||0) + stacks);
    e.drenchT = Math.max(e.drenchT||0, dur);
  }
  function applyHaunt(e, dur=3.5){
    e.hauntT = Math.max(e.hauntT||0, dur);
  }
  function stun(e, t=0.45){
    e.stunT = Math.max(e.stunT||0, t);
  }
  function freeze(e, t=0.9){
    e.freezeT = Math.max(e.freezeT||0, t);
  }
  function bleed(e, t=2.8){
    e.bleedT = Math.max(e.bleedT||0, t);
  }

  function aoeDamage(x,y,r, dmg, opts={}){
    for (const e of ents.enemies){
      const rr = (e.r||16) + r;
      if (dist2(x,y,e.x,e.y) <= rr*rr){
        e.hp -= dmg;
        if (opts.burn) applyBurn(e, 1, 2.6);
        if (opts.stun) stun(e, opts.stun);
        if (opts.freeze) freeze(e, opts.freeze);
      }
    }
    addEffect(x,y,'pop',0.35, opts.col || '#fff');
    cam.shake = Math.max(cam.shake, 3.5);
  }

  // ----- Homing ember mini-projectiles (Ashen Finish) -----
  function spawnEmberSeek(x,y, count=4){
    for (let i=0;i<count;i++){
      ents.effects.push({
        type:'ember',
        x,y,
        life:0.8, t:0,
        vx: (Math.random()*2-1)*140,
        vy: (Math.random()*2-1)*140,
        col:'#ff9a3c'
      });
    }
  }

  // ----- Ball lightning follower -----
  function tickBallLightning(dt){
    if (!isPath('lightning') || !hasG('lightning','ballLightning')) return;
    player._ballCD = Math.max(0, (player._ballCD||0) - dt);

    // zap nearest enemy periodically
    if (player._ballCD <= 0){
      let best=null, bestD2=420*420;
      for (const e of ents.enemies){
        const d2 = dist2(player.x,player.y,e.x,e.y);
        if (d2 < bestD2){ bestD2=d2; best=e; }
      }
      if (best){
        best.hp -= 10;
        // discharge visual
        addEffect(best.x,best.y,'hit',0.18,'#9fe3ff');
        cam.shake = Math.max(cam.shake, 2);
      }
      player._ballCD = 0.45;
    }
  }

  // ----- Wisp orbit shooter -----
  function tickWisps(dt){
    if (!isPath('spirit') || !hasG('spirit','wispOrbit')){
      ents.wisps.length = 0;
      return;
    }

    const count = hasG('spirit','wispSwarm') ? 3 : 1;
    while (ents.wisps.length < count){
      ents.wisps.push({
        angle: Math.random() * Math.PI * 2,
        radius: 44,
        shootCD: Math.random() * 0.8,
        x: player.x,
        y: player.y
      });
    }
    ents.wisps.length = count;

    const baseDmg = weapons[player.weapon].dmg / 3; // ✅ 3× weaker

    for (let i = 0; i < ents.wisps.length; i++){
      const w = ents.wisps[i];
      w.angle += dt * 1.6;

      const a = w.angle + i * (Math.PI * 2 / count);
      w.x = player.x + Math.cos(a) * w.radius;
      w.y = player.y + Math.sin(a) * w.radius;

      w.shootCD -= dt;
      if (w.shootCD <= 0){
        w.shootCD = 1.0;

        let best = null;
        let bestD2 = 520 * 520;

        for (const e of ents.enemies){
          const d2 = dist2(w.x, w.y, e.x, e.y);
          if (d2 < bestD2){
            best = e;
            bestD2 = d2;
          }
        }

        if (best){
          spawnPlainBullet(
            w.x,
            w.y,
            Math.atan2(best.y - w.y, best.x - w.x),
            520,
            baseDmg
          );
        }
      }
    }
  }

  // ----- Per-enemy status tick -----
  function tickEnemyStatuses(e, dt){
    e.slowMul = 1;

    // Burn DOT + slow from Hot Coals
    if ((e.burnT||0) > 0){
      e.burnT -= dt;
      const dps = 4.2 + 2.4*(e.burnStacks||0);
      e.hp -= dps*dt;
      if (isPath('fire') && hasG('fire','hotCoals')){
        e.slowMul *= (1 - 0.07*(e.burnStacks||0));
      }
    } else {
      e.burnStacks = 0;
    }

    // Haunt DOT + weaken (touch damage later reads hauntT)
    if ((e.hauntT||0) > 0){
      e.hauntT -= dt;
      // Haunt DOT — minimal chip damage
    }

    // Drench slow
    if ((e.drenchT||0) > 0){
      e.drenchT -= dt;
      e.slowMul *= (1 - 0.05*(e.drenchStacks||0));
    } else {
      e.drenchStacks = 0;
    }

    // Bleed DOT (earth jagged)
    if ((e.bleedT||0) > 0){
      e.bleedT -= dt;
      e.hp -= 4.0*dt;
    }

    // Stun / Freeze hard lock
    e.stunT = Math.max(0, (e.stunT||0) - dt);
    e.freezeT = Math.max(0, (e.freezeT||0) - dt);
    if (e.stunT > 0 || e.freezeT > 0){
      // stop movement this tick
      e.vx = 0; e.vy = 0;
    }

    // Water Chill -> freeze at 3 stacks
    if (isPath('water') && hasG('water','chill') && (e.drenchStacks||0) >= 3 && e.freezeT <= 0){
      freeze(e, hasG('water','permafrost') ? 1.15 : 0.8);
      // Permafrost shatter AOE
      if (hasG('water','permafrost')){
        aoeDamage(e.x,e.y, 90, 18, { col:'#9fe3ff' });
      }
      e.drenchStacks = 0;
      e.drenchT = 0;
    }
  }

  // ----- On-hit glyph logic (returns damage multiplier) -----
  function onHitGlyph(e, baseDmg, hitKind){ // hitKind: 'bullet'|'melee'
    let mult = 1;
    // 🌊 Water — Tidal Wave (every 5 successful hits)
    if (isPath('water') && hasG('water','tidalWave')) {
      player._tidalWaveHits = (player._tidalWaveHits ?? 0) + 1;

      if (player._tidalWaveHits >= 5) {
        player._tidalWaveHits = 0;

        ents.effects.push({
          type: 'tidalWave',
          x: player.x,
          y: player.y,
          ang: player.angle,
          r: 300,
          spread: Math.PI / 1.8,
          life: 0.9,
          t: 0
        });
      }
    }

    // FIRE core: Ignite
    if (isPath('fire') && hasG('fire','ignite')){
      applyBurn(e, 1, 3.6);

      // Searing Shots: burned enemies take more damage
      if (hasG('fire','searingShots') && (e.burnStacks||0) > 0){
        mult *= 1.18;
      }

      // Detonate at 3 stacks
      if (hasG('fire','detonate') && (e.burnStacks||0) >= 3){
        aoeDamage(e.x,e.y, 110, 24, { col:'#ff6a2a', burn:true });
        e.burnStacks = 0; e.burnT = 0;
      }
    }

    // LIGHTNING core: Static (mark + discharge on next hit)
    if (isPath('lightning') && hasG('lightning','static')){
      if ((e.staticT||0) <= 0){
        e.staticT = 2.6;
        e.staticPrimed = true;
      } else if (e.staticPrimed){
        // discharge
        e.staticPrimed = false;
        e.staticT = 0;
        const bonus = 14;
        e.hp -= bonus;
        addEffect(e.x,e.y,'hit',0.18,'#9fe3ff');

        // Thunderclap ring
        if (hasG('lightning','thunderclap')){
          aoeDamage(e.x,e.y, 90, 10, { col:'#9fe3ff', stun:0.25 });
        }

        // Arc Jump / Forked Arc / Storm Conductor
        if (hasG('lightning','arcJump') || hasG('lightning','forkedArc') || hasG('lightning','stormConductor')){
          let jumps = hasG('lightning','stormConductor') ? 12 : (hasG('lightning','forkedArc') ? 2 : 1);
          let last = e;
          while (jumps-- > 0){
            let best=null, bestD2=220*220;
            for (const o of ents.enemies){
              if (o === last) continue;
              const d2 = dist2(last.x,last.y,o.x,o.y);
              if (d2 < bestD2){ bestD2=d2; best=o; }
            }
            if (!best) break;
            best.hp -= hasG('lightning','forkedArc') ? 7 : 10;
            addEffect(best.x,best.y,'hit',0.14,'#9fe3ff');
            last = best;
          }
        }

        // Overload (crit stun)
        if (hasG('lightning','overload')){
          stun(e, 0.35);
        }
      }

      // Charged Rounds (build meter on hits)
      if (hasG('lightning','chargedRounds')){
        player._charged = Math.min(1, (player._charged||0) + 0.08);
        player._lastHitT = performance.now()/1000;
        mult *= (1 + 0.10*player._charged);
      }
    }

    // SPIRIT core: Soul Tap + Haunt / Soul Bind
    if (isPath('spirit') && hasG('spirit','soulTap')){
      if (hasG('spirit','haunt')) applyHaunt(e, 3.4);

      if (hasG('spirit','soulBind')){
        // bind two enemies hit close together
        const now = performance.now()/1000;
        if (!player._linkA || (player._linkT||0) <= 0){
          player._linkA = e;
          player._linkB = null;
          player._linkT = 2.4;
        } else if (!player._linkB && player._linkA !== e){
          player._linkB = e;
          player._linkT = 3.0;
        }
      }
    }

    // WATER core: Drench + Ripple push + Ice Shards handled in shoot
    if (isPath('water') && hasG('water','drench')){
      applyDrench(e, 1, 4.2);
      if (hasG('water','rippleShot')){
        // small knockback away from player
        const dx = e.x - player.x, dy = e.y - player.y;
        const d = Math.hypot(dx,dy) || 1;
        e.x += (dx/d) * 18;
        e.y += (dy/d) * 18;
      }
      if (hasG('water','tidalRenewal')){
        player._tidalHits = (player._tidalHits||0) + 1;
        if (player._tidalHits % 10 === 0){
          player.hp = Math.min(player.hpMax, player.hp + 5);

          // 🌊 replace old pop ring with proper 3D healing pulse
          ents.effects.push({
            type: 'mendingPulse',
            x: player.x,
            y: player.y,
            r: player.r * 3,
            life: 1.4,
            t: 0
          });
        }
      }
      // 🌊 Tidal Wave — activates every 5 shots (OFFLINE ONLY)
      if (!online && hasG('water','tidalWave')){
        player._tidalWaveHits = (player._tidalWaveHits ?? 0) + 1;

        if (player._tidalWaveHits % 5 === 0){

          // pushback cone
          for (const en of ents.enemies){
            const dx = en.x - player.x;
            const dy = en.y - player.y;
            const d = Math.hypot(dx,dy) || 1;
            const ang = Math.atan2(dy,dx);
            const diff = Math.abs(((ang - player.angle + Math.PI*3) % (Math.PI*2)) - Math.PI);

            if (d < 260 && diff < Math.PI/6){
              en.x += (dx/d) * 180;
              en.y += (dy/d) * 180;
            }
          }

          // visual travelling wave
          ents.effects.push({
            type:'tidalWave',
            x: player.x,
            y: player.y,
            ang: player.angle,
            r: 260,
            spread: Math.PI/3,
            life: 0.9,
            t: 0
          });
        }
      }
    }

    // EARTH core: Stone Skin affects incoming damage in hurtPlayer()
    // Earth on-hit offensive comes from spikes/quake etc elsewhere

    return mult;
  }

  function onKillGlyph(e){
    // FIRE: Cauterise + Ashen Finish + Volcanic Core
    if (isPath('fire')){
      if (hasG('fire','cauterise') && (e.burnStacks||0) > 0){
        player.hp = Math.min(player.hpMax, player.hp + 6);
      }
      if (hasG('fire','ashenFinish') && (e.burnStacks||0) > 0){
        spawnEmberSeek(e.x,e.y, 5);
      }
      if (hasG('fire','volcanicCore')){
        player._killCount = (player._killCount||0) + 1;
        if (player._killCount % 8 === 0){
          aoeDamage(e.x,e.y, 140, 22, { col:'#ff6a2a', burn:true });
        }
      }
    }

    // SPIRIT: Dread Bloom + Revenant/WraithKing
    if (isPath('spirit')){
      if (hasG('spirit','dreadBloom') && (e.hauntT||0) > 0){
        // slow nearby enemies briefly
        for (const o of ents.enemies){
          if (dist2(e.x,e.y,o.x,o.y) < 180*180){
            o.slowMul = Math.min(o.slowMul, 0.72);
          }
        }
        addEffect(e.x,e.y,'pop',0.25,'#c066ff');
      }
      const isBoss = (e.type === 'boss');
      const spawnShade =
      (hasG('spirit','wraithKing') && isBoss) ||
      (hasG('spirit','revenant') && rand(0,1) < 0.25);

      if (spawnShade){
        ents.effects.push({
          type: 'shade',
          x: e.x,
          y: e.y,
          r: (e.type === 'boss') ? 26 : 18,   // 🔺 bigger for powerful wraith
          life: hasG('spirit','possession') ? 10 : 2.0,
          t: 0,
          isWraith: e.type === 'boss'         // 👑 marks powerful wraith
        });
      }
    }
  }
  function broadcastAlertFrom(x, y, radius = 700, time = 3) {
    for (const o of ents.enemies) {
      if (o.alerted) continue;
      if (dist2(x, y, o.x, o.y) <= radius * radius) {
        o.alerted = true;
        o.alertT = Math.max(o.alertT, time);
      }
    }
}

  function enemyBehavior(e, dt){
    e.t += dt;
    e.frameT += dt;
    e.phaseCD -= dt;

    // ✅ FIX: target must be defined FIRST
    const tgtP = nearestPlayerTo(e.x, e.y);
    const tx = tgtP.x;
    const ty = tgtP.y;
    const aP = angleTo(e.x, e.y, tx, ty);

    e.alertT = Math.max(0, e.alertT - dt);
    if (e.alertT === 0) e.alerted = false;

    if (!e.alerted) {
      const d2p = dist2(e.x, e.y, tx, ty);
      if (d2p <= e.detectR * e.detectR) {
        e.alerted = true;
        e.alertT = 3;
        broadcastAlertFrom(e.x, e.y);
      }
      for (const n of noiseEvents) {
        if (n.t <= 0) continue;
        if (dist2(e.x, e.y, n.x, n.y) <= n.r * n.r) {
          e.alerted = true;
          e.alertT = Math.max(e.alertT, 2.5);
        }
      }
    }

    let ax = 0, ay = 0;

    if(e.alerted){
      ax += Math.cos(aP); ay += Math.sin(aP);
      const strafe = aP + Math.PI/2; ax += Math.cos(strafe)*0.4; ay += Math.sin(strafe)*0.4;
      if(currentTheme.id===5 && e.phaseCD<=0){
        if (rand(0,1) < 0.015) {                 // deterministic
          const dash=70+state.wave*2; e.x+=Math.cos(aP)*dash; e.y+=Math.sin(aP)*dash; e.phaseCD=1.6;
        }
      }
    } else {
      e.patrolA = e.patrolA || rand(0, Math.PI*2); // deterministic
      e.patrolT = (e.patrolT||0)-dt;
      if(e.patrolT<=0){
        e.patrolA = rand(0, Math.PI*2);            // deterministic
        e.patrolT = 1.5 + rand(0, 2.0);            // deterministic
      }
      ax += Math.cos(e.patrolA)*0.6; ay += Math.sin(e.patrolA)*0.6;
      const a0 = angleTo(e.x,e.y, e.origin.x, e.origin.y);
      ax += Math.cos(a0)*0.2; ay += Math.sin(a0)*0.2;
    }

    { const playerB = buildingAt(tx, ty);
      if (!playerB) { if (e.goal && e.goal.kind === 'doorP') e.goal = null; if (e.circ) e.circ = null; e.squadDoor = null; e.hold = false; } }

    try {
      const tier = aiTier();
      if (tier >= 1 && e.alerted) {
        const bE = buildingAt(e.x, e.y);
        const bP = buildingAt(tx, ty);
        const separated = losBlocked(e.x, e.y, tx, ty, 22, e.r);
        if (separated) {
          if (bE && bE !== bP) {
            if (!e.goal || e.goal.kind !== 'doorE') { const d = nearestDoor(bE, e.x, e.y); if (d) e.goal = { x: d.x, y: d.y, kind: 'doorE' }; }
          } else if (!bE && bP) {
            if (!e.goal || e.goal.kind !== 'doorP') { const d = nearestDoor(bP, e.x, e.y); if (d) e.goal = { x: d.x, y: d.y, kind: 'doorP' }; }
          }
        }
        if (e.goal && (e.goal.kind === 'doorE' || e.goal.kind === 'doorP')) {
          const ga = angleTo(e.x, e.y, e.goal.x, e.goal.y);
          ax = Math.cos(ga); ay = Math.sin(ga);
          const d2g = dist2(e.x, e.y, e.goal.x, e.goal.y);
          if (d2g < (48*48)) e.goal = null;
        }
        if (e.alerted) {
          e._progT = (e._progT || 0) + dt;
          const goalDist = (e.goal ? Math.hypot(e.goal.x - e.x, e.goal.y - e.y) : Infinity);
          e._progMin = Math.min(e._progMin ?? Infinity, goalDist);
          const bEnemy  = buildingAt(e.x, e.y);
          const bPlayer = buildingAt(tx, ty);
          const targetB = bEnemy && bEnemy !== bPlayer ? bEnemy : (!bEnemy && bPlayer) ? bPlayer : null;
          const separated2 = losBlocked(e.x, e.y, tx, ty);
          const nearB = !!targetB && ( e.x > targetB.x - 40 && e.x < targetB.x + targetB.w + 40 && e.y > targetB.y - 40 && e.y < targetB.y + targetB.h + 40 );
          const STUCK_WINDOW = 0.8, STUCK_EPS = 8;
          let isStuckOnGoal = false;
          if (e.goal && isFinite(goalDist) && isFinite(e._progMin) && e._progT > STUCK_WINDOW) { isStuckOnGoal = (e._progMin - goalDist < STUCK_EPS); e._progMin = goalDist; e._progT = 0; }
          if (!e.circ && separated2 && (isStuckOnGoal || (!e.goal && nearB)) && targetB) {
            e.goal = null;
            const corners = rectCornersCW(targetB);
            let idx = nearestCornerIndex(corners, e.x, e.y);
            const dir = (rand(0,1) < 0.5) ? +1 : -1;           // deterministic
            e.circ = { b: targetB, corners, idx, dir, t: 0 };
          }
          if (e.circ) {
            const C = e.circ.corners; const cur = C[e.circ.idx];
            const d2c = dist2(e.x, e.y, cur.x, cur.y);
            if (d2c < 26*26) { e.circ.idx = (e.circ.idx + e.circ.dir + C.length) % C.length; }
            const door = anyDoorLOSOpen(e.circ.b, e.x, e.y);
            if (door) { e.goal = { x: door.x, y: door.y, kind: 'doorP' }; e.circ = null; }
            else { const ga = angleTo(e.x, e.y, cur.x, cur.y); ax = Math.cos(ga); ay = Math.sin(ga); }
            e.circ.t += dt;
            const stillSeparated = losBlocked(e.x, e.y, tx, ty);
            const playerInsideSame = (buildingAt(tx, ty) === e.circ.b);
            if (!stillSeparated || !playerInsideSame || e.circ.t > 8.0) { e.circ = null; }
          }
        }
      }
      if (tier >= 2 && e.alerted) {
        const bP = buildingAt(tx, ty);
        if (bP) {
          if (!e.squadDoor) { const d = nearestDoor(bP, tx, ty); if (d) e.squadDoor = d; }
          if (e.role === 'blocker' && e.squadDoor) {
            const ga = angleTo(e.x, e.y, e.squadDoor.x, e.squadDoor.y); ax = Math.cos(ga); ay = Math.sin(ga);
            const d2 = dist2(e.x, e.y, e.squadDoor.x, e.squadDoor.y); e.hold = (d2 < 36*36); if (e.hold) { ax = 0; ay = 0; }
          } else if (e.role === 'flanker') {
            const off = (e.squadId % 2 === 0 ? +1 : -1);
            const aF = angleTo(tx, ty, e.x, e.y) + off * (Math.PI/2);
            const fx = tx + Math.cos(aF) * 160; const fy = ty + Math.sin(aF) * 160;
            const ga = angleTo(e.x, e.y, fx, fy); ax = Math.cos(ga); ay = Math.sin(ga);
          }
        }
      }
      if (tier >= 3 && e.alerted) {
        const hz = nearestHazard(e.x, e.y);
        if (hz) {
          const cx = hz.x + hz.w/2, cy = hz.y + hz.h/2;
          const dx = e.x - cx, dy = e.y - cy;
          const dist = Math.hypot(dx, dy);
          const safe = Math.max(hz.w, hz.h) * 0.7;
          if (dist < safe) { const rx = (dx / (dist || 1)) * 1.5; const ry = (dy / (dist || 1)) * 1.5; ax += rx; ay += ry; }
        }
        if (hz && (e.role === 'leader' || e.role === 'flanker')) {
          const cx = hz.x + hz.w/2, cy = hz.y + hz.h/2;
          const aH = angleTo(tx, ty, cx, cy);
          const px = tx + Math.cos(aH) * 120; const py = ty + Math.sin(aH) * 120;
          const ga = angleTo(e.x, e.y, px, py); ax = lerp(ax, Math.cos(ga), 0.35); ay = lerp(ay, Math.sin(ga), 0.35);
        }
      }
      if (tier >= 4) {
        const boss = ents.enemies.find(o => o.type === 'boss');
        if (boss) {
          boss.commandCD = boss.commandCD || 0.5; boss.commandCD -= dt;
          if (boss.commandCD <= 0) {
            boss.commandCD = 3.0;
            let targetB = buildingAt(tx, ty);
            if (!targetB) { let best=null, bestD2=Infinity; for (const b of world.buildings) { const cx = b.x + b.w/2, cy = b.y + b.h/2; const d2 = dist2(cx, cy, tx, ty); if (d2 < bestD2) { bestD2 = d2; best = b; } } targetB = best; }
            if (targetB) { const d = nearestDoor(targetB, tx, ty); if (d) { for (const o of ents.enemies) { if (o.type !== 'boss') o.squadDoor = d; } } }
          }
        }
      }
    } catch (err) { }

    const n=Math.hypot(ax,ay)||1; ax/=n; ay/=n;
    let spd = e.speed * state.diff * (1 + state.wave*0.01);
    if(e.type==='tank') spd*=0.9; if(e.type==='swarm') spd*=1.15; if(e.type==='boss') spd*=1.05;
    e.vx = lerp(e.vx, ax*spd, 0.18); e.vy = lerp(e.vy, ay*spd, 0.18);
    moveWithCollide(e, e.vx*dt, e.vy*dt);
    // ✅ Apply hazard effects immediately after movement
    const hz = world.getHazardAt(e.x, e.y, e.r * 0.9);
    if (hz) {
      if (hz.type === 'sand') {
        applyQuicksand(e, hz, dt, { isPlayer:false });
      }
      else if (hz.type === 'ice') {
        applyIceSlide(e, hz, dt);
      }
      else if (hz.type === 'lava') {
        if (hz.phase === 'erupt') {
          e.hp = 0;
        } else if (hz.phase === 'after') {
          e.hp -= 30 * dt;
        }
      }
      else if (hz.type === 'void') {
        const res = resolveVoid(e, hz, dt, false);
        if (res.done && res.killed) {
          e.hp = 0;
        }
      }
    }

    e.cd -= dt;
    if (e.cd <= 0) {
      e.cd = (e.type === 'sniper' ? 1.8 : e.type === 'shooter' ? 1.0 : e.type === 'boss' ? 0.5 : e.type === 'bomber' ? 1.2 : 99);
      if ((e.type === 'sniper' || e.type === 'shooter' || e.type === 'boss') && e.alerted){
        const base = angleTo(e.x, e.y, tgtP.x, tgtP.y);
        const spread = (e.type === 'sniper' ? 0.035 : e.type === 'boss' ? 0.06 : 0.10);
        const a = base + rand(-spread, spread);
        const sp = (e.type === 'sniper' ? 620 : e.type === 'boss' ? 520 : 420) + state.wave * 4;
        const dmg = (e.type === 'sniper' ? 14 : e.type === 'boss' ? 20 : 22);
        spawnEBullet(e.x + Math.cos(a)*e.r, e.y + Math.sin(a)*e.r, a, sp, dmg);
      }
      if (e.type === 'bomber' && e.alerted){
        const d2p = dist2(e.x, e.y, tgtP.x, tgtP.y);
        const minRange=120, maxRange=360;
        if(d2p>=minRange*minRange && d2p<=maxRange*maxRange){
          const base=angleTo(e.x,e.y, tgtP.x, tgtP.y);
          const a = base + rand(-0.08, 0.08);
          const sp=360 + state.wave*3;
          const dmg=20, fuse=0.75, splash=120;
          spawnBomb(e.x + Math.cos(a)*e.r, e.y + Math.sin(a)*e.r, a, sp, dmg, splash, fuse);
        }
      }
    }

    if (e.type === 'healer'){ e.healCD -= dt; if (e.healCD <= 0){ let healed=0; for(const m of ents.enemies){ if(m===e) continue; if(dist2(e.x,e.y,m.x,m.y)<= (e.healR*e.healR)){ const amt=6+Math.floor(state.wave*0.5); m.hp=Math.min(m.maxhp, m.hp+amt); healed++; } } if(healed>0) addEffect(e.x,e.y,'pop',0.25,'#7dffa3'); e.healCD=1.6; } }
    if (e.type === 'boss'){ e.commandCD -= dt; if(e.commandCD<=0){ for(const o of ents.enemies){ if(o===e) continue; if(dist2(e.x,e.y,o.x,o.y)<=900*900){ o.alerted=true; o.alertT=Math.max(o.alertT,3); } } e.commandCD=3.0; } }
  }

  function pickType(){
    const w = state.wave;
    let weights = { chaser:6, tank:1, shooter:1, sniper:0, bomber:0, healer:0 };
    if (w>=2){ weights.tank+=1; weights.shooter+=1; }
    if (w>=3){ weights.sniper+=2; }
    if (w>=4){ weights.bomber+=2; }
    if (w>=5){ weights.healer+=1; }
    if (w>=6){ weights.tank+=2; weights.sniper+=2; }
    if (w>=8){ weights.bomber+=2; weights.healer+=1; }
    if (w>=10){ weights.sniper+=3; weights.bomber+=3; weights.healer+=2; }
    let pool=[]; for(const k in weights){ for(let i=0;i<weights[k]; i++) pool.push(k); }
    return pool[rint(0, pool.length-1)];  // deterministic
  }

  // Bullets / effects / pickups / chests -------------------------------------
  function spawnBullet(x,y,a, speed,dmg,pierce=0){ ents.bullets.push({x,y,vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, r:4, dmg, life:1.2, pierce}); }
  function spawnEBullet(x,y,a, speed,dmg){ ents.ebullets.push({x,y,vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, r:4, dmg, life:2.5}); }
  function spawnBomb(x,y,a, speed,dmg, splashR=110, fuse=0.75){ ents.ebullets.push({ x,y, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, r:6, dmg, life:fuse, kind:'bomb', splashR }); }
  function addEffect(x,y,type,life=0.4,color='#9cf'){ ents.effects.push({x,y,type,life,color,t:0,r:6}); }
  function dropPickup(x,y, forcedType=null){
    const opts=['health','speed','shield','ammo'];
    const type = forcedType || opts[rint(0,opts.length-1)];
    ents.pickups.push({x,y,r:10,type,t:0});
  }

  function dropXpOrb(x, y, value=1){
    // small white orb; value stored for future scaling
    ents.pickups.push({ x, y, r:6, type:'xp', t:0, v:value });
  }
  function openChest(ch, remoteDrops=null){
    if(ch.opened) return;
    ch.opened = true;
    audio.chest();

    // If remote gave us drops, use them; otherwise generate and broadcast
    const drops = remoteDrops || (() => {
      const n = rint(2,3);
      const out = [];
      const types = ['health','speed','shield','ammo'];
      for(let i=0;i<n;i++){
      const a = rand(0, Math.PI*2);
      const d = rand(18,36);
      const type = types[rint(0, types.length-1)];
      out.push({ x: ch.x + Math.cos(a)*d, y: ch.y + Math.sin(a)*d, type });
      }
      return out;
    })();

    // Spawn drops locally
    for (const d of drops) dropPickup(d.x, d.y, d.type);

    // Broadcast so nobody else can open the same chest
    if (!remoteDrops && isNetActive()) {
      try {
      Net.state.sendEvent({ kind:'chest_open', id: ch.id, drops, t: Date.now() });
      } catch {}
    }
    }
  function respawnCollectedChests(){ const freeBuildings = []; for(let i=0;i<world.buildings.length;i++){ if(!world.buildings[i].hasChest) freeBuildings.push(i); } for(let i=0;i<world.chests.length;i++){ const ch = world.chests[i]; if(!ch.opened) continue; const prevIdx=ch.buildingIndex; world.buildings[prevIdx].hasChest=false; const candidates = freeBuildings.filter(idx=> idx!==prevIdx); if(candidates.length===0) continue; const newIdx = candidates[rint(0,candidates.length-1)]; freeBuildings.splice(freeBuildings.indexOf(newIdx),1); const b = world.buildings[newIdx]; const pad=28; let tries=0, cx, cy; do{ cx=rand(b.inner.x+pad, b.inner.x+b.inner.w-pad); cy=rand(b.inner.y+pad, b.inner.y+b.inner.h-pad); tries++; } while(tries<30 && world.collideHazard(cx,cy,16)); ch.x=cx; ch.y=cy; ch.r=16; ch.opened=false; ch.buildingIndex=newIdx; b.hasChest=true; } }

  // Waves & progressive difficulty -------------------------------------------
  let spawnQueue=[];
  function enemyCountForWave(w) {
    // Smooth ramp: 5 → 25 by wave 15 (single‑player only)
    const min = 5;
    const max = 25;

    if (w >= 15) return max;

    const t = (w - 1) / 14;
    return Math.round(min + (max - min) * t);
  }
  function startWave(n) {
    // ✅ SINGLE‑PLAYER ONLY
    if (isNetActive()) return;

    state.wave = n;
    // ✅ ensure glyph overlay/phase is cleared on wave start
    // ✅ ensure glyph overlay/phase is cleared on wave start
    if (state.phase !== 'glyph') {
      state.phase = 'combat';
      state.phaseEndsAt = 0;
      if (ovGlyphs) ovGlyphs.style.display = 'none';
    }
    
    // reset per-wave glyph triggers
    player._rebirthUsed = false;
    player._unbreakableUsed = false;
    player._guardianCD = 0;
    player._tidalHits = 0;
    player._quakeCD = 0;

    state.spawnT = 0;
    state.spawnIdx = 0;
    spawnQueue = [];

    const maxAlive = 25;
    const alive = ents.enemies.length;
    const slots = Math.max(0, maxAlive - alive);
    const count = Math.min(enemyCountForWave(n), slots);

    const c0 = nav.cellFrom(player.x, player.y);
    nav.floodFrom(c0.ix, c0.iy);

    const pos = () => {
      const margin = 120;
      for (let i = 0; i < 60; i++) {
        const x = rand(margin, world.w - margin);
        const y = rand(margin, world.h - margin);
        if (dist2(x, y, player.x, player.y) < 520 * 520) continue;
        if (world.isBlocked(x, y, 20) || world.collideHazard(x, y, 20)) continue;
        if (nav.isReachable(x, y)) return { x, y };
      }
      return {
        x: clamp(player.x + 800, margin, world.w - margin),
        y: clamp(player.y, margin, world.h - margin)
      };
    };

    state.nextWaveT = 2.0;

    // ✅ Boss every 5 waves, same mix as previous wave
    if (n % 5 === 0) {
      const p = pos();
      spawnQueue.push({
        t: 1.2,
        type: 'boss',
        x: p.x,
        y: p.y
      });
    }

    for (let i = 0; i < count; i++) {
      const p = pos();
      spawnQueue.push({
        t: rand(0.5, 10),
        type: pickType(),
        x: p.x,
        y: p.y
      });
    }

    spawnQueue.sort((a, b) => a.t - b.t);
  }
  const SP_WAVE_COMPOSITION = {
    1:  ['chaser'],                                   // raveners
    2:  ['chaser','tank'],
    3:  ['chaser','tank','shooter'],
    4:  ['tank','shooter','sniper','chaser'],
    5:  ['tank','shooter','sniper','chaser'],         // boss added separately

    6:  ['chaser','tank','shooter','sniper','bomber'],
    7:  ['tank','shooter','sniper','bomber'],
    8:  ['tank','shooter','sniper','bomber'],
    9:  ['shooter','sniper','bomber'],
    10: ['shooter','sniper','bomber','healer']
  };

  function enemyPoolForWave(w) {
    if (w <= 10) return SP_WAVE_COMPOSITION[w];

    if (w <= 12) return ['tank','shooter','sniper','bomber','healer'];
    if (w <= 14) return ['shooter','sniper','bomber','healer'];
    return ['sniper','bomber','healer'];
  }
  function pickType() {
    // ✅ SINGLE‑PLAYER ONLY
    if (isNetActive()) {
      // Safety fallback (should never be used in MP)
      return 'chaser';
    }

    const pool = enemyPoolForWave(state.wave);
    return pool[rint(0, pool.length - 1)];
  }

  // Shooting / collisions -----------------------------------------------------
  function playerShoot(){ 
    if (isNetActive() && netPhase === 'glyph') return;
    
    if (equip === 'melee') {

        // Prevent swinging if cooldown not finished
        if (meleeCooldown > 0) return;

        if (melee && melee.state !== 'using'){ 
            Melee.use(melee);
            audio.hit();

            // Start cooldown (0.5 seconds)
            meleeCooldown = 0.5;
        }

        return;
    }

    const w=weapons[player.weapon]; const t=nowMS()/1000; const interval=1/(w.rof*(player.reloading?0.6:1)); if(t - player.lastShot < interval) return; if(player.reloading) return; if(player.ammo<=0){ playerTryReload(); return; } 
    
    player.lastShot = t;
    player.ammo--;

    const base = player.angle;

    // ✅ Use the same visual position as the rendered player
    // ✅ Use the same visual position as the rendered player
    const px0 = player.x;
    const py0 = player.y;

    // ✅ ONLINE: server authoritative bullets
    if (isNetActive()) {
      for (let i = 0; i < w.shots; i++){
        const a = base + rand(-w.spread, w.spread);
        Net.sendShoot(
          px0 + Math.cos(a) * player.r,
          py0 + Math.sin(a) * player.r,
          a,
          w.speed,
          w.dmg
        );
      }
      addEffect(px0 + Math.cos(base) * player.r, py0 + Math.sin(base) * player.r, 'muzzle', 0.1, '#fff');
      noiseEvents.push({ x: px0, y: py0, r: 720, t: 1.2 });
      return;
    }

    // ✅ OFFLINE: local bullets
    for (let i = 0; i < w.shots; i++){
      const a = base + rand(-w.spread, w.spread);
      spawnBullet(
        px0 + Math.cos(a) * player.r,
        py0 + Math.sin(a) * player.r,
        a,
        w.speed,
        w.dmg,
        w.pierce
      );
    }
    addEffect(px0 + Math.cos(base) * player.r, py0 + Math.sin(base) * player.r, 'muzzle', 0.1, '#fff');
    noiseEvents.push({ x: px0, y: py0, r: 720, t: 1.2 });
  }
  function lineWallHit(px,py,vx,vy, dt, r){ const nx=px+vx*dt, ny=py+vy*dt; for(const o of world.walls){ const cx=clamp(nx,o.x,o.x+o.w), cy=clamp(ny,o.y,o.y+o.h); const dx=nx-cx, dy=ny-cy; if(dx*dx+dy*dy < r*r) return true; } return false; }
  function stepProjectiles(dt){
    // player bullets 
    for (let i = ents.bullets.length - 1; i >= 0; i--){ 
    const b = ents.bullets[i]; 
    // ✅ store previous position for swept test
    const x0 = b.x;
    const y0 = b.y;

    const kill = lineWallHit(b.x, b.y, b.vx, b.vy, dt, b.r);

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
        if (kill || b.life <= 0){ 
        ents.bullets.splice(i,1); 
        continue; 
    } 
    // hit enemies 
    // hit enemies — SWEPT test (bullet path vs enemy circle)
    // ✅ VISUAL hit test — ALWAYS remove bullet if its PATH touches an enemy
    let hit = false;
    let hitX = b.x;
    let hitY = b.y;

    for (let j = 0; j < ents.enemies.length; j++) {
      const e = ents.enemies[j];
      const rr = (e.r ?? 16) + (b.r ?? 4);

      const dx = b.x - x0;
      const dy = b.y - y0;

      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const sx = x0 + dx * t;
        const sy = y0 + dy * t;

        if (dist2(sx, sy, e.x, e.y) <= rr * rr) {
          hit = true;
          hitX = sx;
          hitY = sy;
          break;
        }
      }
      if (hit) break;
    }

    if (hit) {
      // ✅ visual feedback only
      addEffect(hitX, hitY, 'hit', 0.15, '#fff');
      cam.shake = Math.max(cam.shake, 1.5);

      // ✅ bullet ALWAYS disappears, no matter what server does
      ents.bullets.splice(i, 1);
      continue;
    }
    } 

    // effects timer so muzzle flashes don’t stick 
    for (let i = ents.effects.length - 1; i >= 0; i--){ 
    const e = ents.effects[i]; 
    e.t = (e.t || 0) + dt; 
    if (e.t >= e.life) ents.effects.splice(i,1); 
    } 
    } 
  // Touch controls ------------------------------------------------------------
  const touch = { idL:null, init(){ const rel=(el,e)=>{ const r=el.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }; stickL.addEventListener('touchstart', e=>{ e.preventDefault(); for(const t of e.changedTouches){ if(!this.idL){ const p=rel(stickL,t); if(p.x>=0&&p.y>=0&&p.x<=stickL.clientWidth&&p.y<=stickL.clientHeight){ this.idL=t.identifier; } } } }, {passive:false}); stickL.addEventListener('touchmove', e=>{ e.preventDefault(); for(const t of e.changedTouches){ if(t.identifier===this.idL){ const r=stickL.getBoundingClientRect(); const x=t.clientX-(r.left+r.width/2), y=t.clientY-(r.top+r.height/2), m=Math.hypot(x,y), lim=44; const nx=(m>lim? x/m*lim:x), ny=(m>lim? y/m*lim:y); nubL.style.transform=`translate(${nx}px,${ny}px)`; input.touch.stick.dx=nx/lim; input.touch.stick.dy=ny/lim; input.touch.stick.active=true; } } }, {passive:false}); stickL.addEventListener('touchend', e=>{ e.preventDefault(); for(const t of e.changedTouches){ if(t.identifier===this.idL){ this.idL=null; input.touch.stick={dx:0,dy:0,active:false}; nubL.style.transform='translate(0px,0px)'; } } }, {passive:false}); btnSwap.addEventListener('touchstart', e=>{ e.preventDefault(); swapWeapon(1); }, {passive:false}); } };
  touch.init();

  // Settings ------------------------------------------------------------------
  function loadSettings(){ selDiff.value=store.read('diff','1.0'); selSfx.value=store.read('sfx','1'); selMusic.value=store.read('music','1'); rngSens.value=store.read('sens','1.0'); rngUI.value=store.read('ui','1.0'); sensVal.textContent=`${parseFloat(rngSens.value).toFixed(2)}x`; uiVal.textContent=`${Math.round(parseFloat(rngUI.value)*100)}%`; state.diff=parseFloat(selDiff.value); audio.sfxOn=selSfx.value==='1'; audio.musicOn=selMusic.value==='1'; setUIOpacity(parseFloat(rngUI.value)); if(audio.musicOn) audio.startMusic(); else audio.stopMusic(); }
  function saveSettings(){ store.write('diff',selDiff.value); store.write('sfx',selSfx.value); store.write('music',selMusic.value); store.write('sens',rngSens.value); store.write('ui',rngUI.value); sensVal.textContent=`${parseFloat(rngSens.value).toFixed(2)}x`; uiVal.textContent=`${Math.round(parseFloat(rngUI.value)*100)}%`; state.diff=parseFloat(selDiff.value); audio.sfxOn=selSfx.value==='1'; audio.musicOn=selMusic.value==='1'; setUIOpacity(parseFloat(rngUI.value)); if(audio.musicOn) audio.startMusic(); else audio.stopMusic(); }
  rngSens.oninput=()=> sensVal.textContent=`${parseFloat(rngSens.value).toFixed(2)}x`;
  rngUI.oninput=()=> setUIOpacity(parseFloat(rngUI.value));
  function setUIOpacity(v){ uiVal.textContent=`${Math.round(v*100)}%`; document.querySelectorAll('.hud,.corner,.help,.minimap').forEach(el=> el.style.opacity=String(v)); }
  function showOverlay(el,show){ el.style.display=show?'grid':'none'; if(el===ovSettings && !show) saveSettings(); if(show) togglePause(true); else canvas.focus(); }
  function togglePause(force){
    const on = typeof force === 'boolean' ? force : !state.running;
    state.running = !on;
    ovPause.style.display = on ? 'grid' : 'none';

    if (player.hp <= 0) {
      // one-time VFX trigger
      if (!state.playerExploded) {
        const baseCol = COLORS[selectedColor]?.c || '#aef';
        spawnTriangleBurst(player.x, player.y, baseCol, { big:8, small:26 });
        spawnGhostSilhouette(player.x, player.y, player.r + 14, currentTheme.accent);
        state.playerExploded = true;
      }

      state.running = false;

      // ✅ MULTIPLAYER: leave lobby immediately on death
      if (isNetActive()) {
        leaveMultiplayerAndReturnHome();
        return; // stop updateFixed immediately
      }

      // ✅ SINGLE‑PLAYER: normal game over flow
      const prev = parseInt(localStorage.getItem('arenaBest') || '0', 10) || 0;
      const best = Math.max(prev, state.wave);
      state.best = best;
      localStorage.setItem('arenaBest', String(best));
      bestEl.textContent = best;

      showGameOver();
    }

    ovPause.querySelector('h2').textContent = '⏸️ Paused';
    if (on) audio.stopMusic();
    else if (audio.musicOn) audio.startMusic();
  }

  

// ===============================
// Glyph overlay system (client) — SCROLLABLE 3D TREE + FULL DESCRIPTIONS
// ===============================
const GLYPH_COST_CORE = 1;
const GLYPH_COST_T1   = 1;
const GLYPH_COST_T2   = 1;
const GLYPH_COST_T3   = 1;

// ---------- Data: full skill names + descriptions ----------
const GLYPH_CORE = {
  fire:      { name:"Ignite", desc:"Your bullets/melee apply Burn: small DoT for 3–4 seconds." },
  lightning: { name:"Static", desc:"Your hits apply Static (a mark). On next hit, Static discharges for bonus damage." },
  spirit:    { name:"Soul Tap", desc:"Enemies drop soul fragments (XP orbs). Collecting them grants minor healing/shield." },
  water:     { name:"Drench", desc:"Hits apply Drench; drenched enemies slow slightly and enable Water effects." },
  earth:     { name:"Stone Skin", desc:"Gain armour (damage reduction)." }
};

// Branches are [A,B,C], each has Tier1→Tier2→Tier3
const GLYPH_TREE = {
  fire: [
    [
      { name:"Hot Coals",     desc:"Burn stacks up to 3; each stack increases DoT and slightly slows enemies." },
      { name:"Searing Shots", desc:"Burned enemies take +X% damage from you." },
      { name:"Ashen Finish",  desc:"If an enemy dies while burning, it bursts tiny embers that seek nearby enemies." }
    ],
    [
      { name:"Detonate",      desc:"When a burning enemy reaches 3 stacks, they pop for AoE." },
      { name:"Napalm Trail",  desc:"Your shots leave short-lived burning ground patches." },
      { name:"Volcanic Core", desc:"Every Nth kill triggers a big lava burst ring (visual + damage)." }
    ],
    [
      { name:"Cauterise",     desc:"Killing burning enemies heals you slightly." },
      { name:"Phoenix Step",  desc:"Short dash leaves a flame burst and clears slows." },
      { name:"Rebirth",       desc:"Once per wave, lethal damage consumes burn stacks in a radius and revives you at low HP." }
    ],
  ],

  lightning: [
    [
      { name:"Arc Jump",       desc:"Static discharge chains to 1 additional enemy." },
      { name:"Forked Arc",     desc:"Chains can fork to 2 enemies but lower damage per jump." },
      { name:"Storm Conductor",desc:"If 5+ enemies are in chain range, lightning keeps bouncing until it runs out." }
    ],
    [
      { name:"Charged Rounds", desc:"Crit chance increases as you keep firing without missing." },
      { name:"Overload",       desc:"Critical discharge stuns briefly." },
      { name:"Thunderclap",    desc:"Discharge creates a small AoE shock ring." }
    ],
    [
      { name:"Static Dash",    desc:"Dash leaves a shock line that discharges marked enemies." },
      { name:"Blink Strike",   desc:"Short-range blink to cursor with cooldown." },
      { name:"Ball Lightning", desc:"Summon a slow orb that follows you and zaps marked targets." }
    ],
  ],

  spirit: [
    [
      { name:"Wisp Orbit",       desc:"Gain 1 wisp that orbits you and shoots weak projectiles." },
      { name:"Wisp Swarm",       desc:"More wisps; each hit applies Haunt (small DoT)." },
      { name:"Guardian Spirits", desc:"Wisps can intercept one projectile every few seconds." }
    ],
    [
      { name:"Haunt",      desc:"Your hits apply Haunt; haunted enemies deal reduced touch damage." },
      { name:"Soul Bind",  desc:"Hit 2 enemies quickly to link them — damage to one copies % to the other." },
      { name:"Dread Bloom",desc:"Haunted enemy death releases fear pulse (brief slow/weakness around)." }
    ],
    [
      { name:"Revenant",   desc:"Chance on kill to spawn a temporary allied shade (melee chaser)." },
      { name:"Possession", desc:"Shade duration longer and gains ranged attack." },
      { name:"Wraith King",desc:"Boss kills always spawn a powerful shade for one wave." }
    ],
  ],

  water: [
    [
      { name:"Chill",      desc:"Drenched enemies slow more; at stacks freeze briefly." },
      { name:"Ice Shards", desc:"Your shots occasionally fire a shard that pierces." },
      { name:"Permafrost", desc:"Freeze causes a shatter AoE." }
    ],
    [
      { name:"Mending Mist", desc:"Collecting XP orbs also restores a tiny amount of HP." },
      { name:"Tidal Renewal",desc:"Every N hits create a small healing pulse around you." },
      { name:"Sanctuary",    desc:"Drop a water circle at wave-end that persists into next wave as a safe zone." }
    ],
    [
      { name:"Ripple Shot", desc:"Bullets push enemies slightly back." },
      { name:"Tidal Wave",  desc:"Every X seconds, emit a cone wave knockback." },
      { name:"Maelstrom",   desc:"A rotating water vortex that pulls enemies." }
    ],
  ],

  earth: [
    [
      { name:"Thornmail",      desc:"Contact damage taken reflects a portion." },
      { name:"Spiked Barrier", desc:"When hit, spawn 3 rock spikes outward." },
      { name:"Jagged Earth",   desc:"Reflected damage can crit and causes bleed." }
    ],
    [
      { name:"Bulwark",       desc:"Increased max HP or shield cap." },
      { name:"Rooted Stance", desc:"Standing still briefly increases damage reduction and accuracy." },
      { name:"Unbreakable",   desc:"Once per wave ignore lethal damage (stone shell shatters)." }
    ],
    [
      { name:"Stone Pillar", desc:"Create a small temporary wall (blocks enemies/shots)." },
      { name:"Quake",        desc:"Periodic stomp stuns in a small radius." },
      { name:"Golem",        desc:"Summon a slow ally that taunts (pulls enemies toward it)." }
    ],
  ],
};
// ===== Tree node → gameplay flag mapping (3 branches × 3 tiers) =====
const GLYPH_TREE_KEYS = {
  fire: [
    ['hotCoals','searingShots','ashenFinish'],
    ['detonate','napalmTrail','volcanicCore'],
    ['cauterise','phoenixStep','rebirth']
  ],
  lightning: [
    ['arcJump','forkedArc','stormConductor'],
    ['chargedRounds','overload','thunderclap'],
    ['staticDash','blinkStrike','ballLightning']
  ],
  spirit: [
    ['wispOrbit','wispSwarm','guardianSpirits'],
    ['haunt','soulBind','dreadBloom'],
    ['revenant','possession','wraithKing']
  ],
  water: [
    ['chill','iceShards','permafrost'],
    ['mendingMist','tidalRenewal','sanctuary'],
    ['rippleShot','tidalWave','maelstrom']
  ],
  earth: [
    ['thornmail','spikedBarrier','jaggedEarth'],
    ['bulwark','rootedStance','unbreakable'],
    ['stonePillar','quake','golem']
  ],
};

// ---------- Visual style ----------
const ELEM_STYLE = {
  fire:      { main:'#ff6a2a', rim:'#ffd7a3' },
  lightning: { main:'#9fe3ff', rim:'#e8f7ff' },
  water:     { main:'#4fd3ff', rim:'#cfefff' },
  spirit:    { main:'#c066ff', rim:'#e7c7ff' },
  earth:     { main:'#7dffa3', rim:'#d9ffe6' }
};

function hexRgb(hex){
  const h = String(hex || '#ffffff').replace('#','');
  const n = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function rgba(hex,a){
  const c = hexRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

// ---------- Tree layout ----------
const BRANCH_ANGLES = [-90, 30, 150];
const TIER_DIST     = [220, 340, 470];

function nodePos(b,tier){
  const ang = BRANCH_ANGLES[b] * Math.PI/180;
  const d = TIER_DIST[tier-1];
  return { x: Math.cos(ang)*d, y: Math.sin(ang)*d };
}

// ---------- State ----------
let _uiMode = 'pentagon';     // 'pentagon' | 'tree' | 'ceremony'
let _ceremony = null;         // { type:'core'|'node', el, branch, tier, from:{x,y}, to:{x,y}, t0, dur }
let _glyphSelected = null;    // element in pentagon
let _selBranch = -1;
let _selTier = 0;
let _glyphCost = 0;

let _glyphRAF = 0;
const _glyphParticles = [];

// ---------- Scroll camera ----------
const TREE_VIEW = { ox:0, oy:0, scale:1.0, dragging:false, lastX:0, lastY:0 };

function treeToScreen(tx,ty){
  const cx = glyphCanvas.width/2, cy = glyphCanvas.height/2;
  return { x: cx + (tx + TREE_VIEW.ox) * TREE_VIEW.scale,
           y: cy + (ty + TREE_VIEW.oy) * TREE_VIEW.scale };
}
function screenToTree(sx,sy){
  const cx = glyphCanvas.width/2, cy = glyphCanvas.height/2;
  return { x: (sx - cx)/TREE_VIEW.scale - TREE_VIEW.ox,
           y: (sy - cy)/TREE_VIEW.scale - TREE_VIEW.oy };
}

function ensureTreeState(el){
  if (!state.unlocks[el]) state.unlocks[el] = {};
  if (!Array.isArray(state.unlocks[el].tree)) {
    state.unlocks[el].tree = [
      [false,false,false],
      [false,false,false],
      [false,false,false]
    ];
  }
  return state.unlocks[el].tree;
}
function isUnlocked(el,b,tier){ return !!ensureTreeState(el)[b][tier-1]; }
function unlockNode(el,b,tier){
  ensureTreeState(el)[b][tier-1] = true;

  // Enable the real gameplay flag
  const key = GLYPH_TREE_KEYS?.[el]?.[b]?.[tier-1];
  if (key && player.glyph && player.glyph[el]) {
    player.glyph[el][key] = true;
  }

  // One-time stat bumps (safe, optional)
  if (el === 'earth' && key === 'bulwark'){
    player.hpMax = Math.min(220, (player.hpMax ?? 100) + 25);
    player.hp = Math.min(player.hpMax, player.hp + 25);
  }
}
function nextTier(el,b){
  if (!isUnlocked(el,b,1)) return 1;
  if (!isUnlocked(el,b,2)) return 2;
  if (!isUnlocked(el,b,3)) return 3;
  return 0;
}
function isComplete(el){
  for(let b=0;b<3;b++){ if(!isUnlocked(el,b,3)) return false; }
  return true;
}

// ---------- Input attach ----------
function attachTreeInput(){
  if (!glyphCanvas) return;

  glyphCanvas.onwheel = (ev) => {
    if (_uiMode !== 'tree' && _uiMode !== 'ceremony') return;
    ev.preventDefault();

    const rect = glyphCanvas.getBoundingClientRect();
    const sx = (ev.clientX - rect.left) * (glyphCanvas.width / rect.width);
    const sy = (ev.clientY - rect.top)  * (glyphCanvas.height / rect.height);

    const before = screenToTree(sx,sy);
    const zoom = (ev.deltaY > 0) ? 0.92 : 1.08;
    TREE_VIEW.scale = clamp(TREE_VIEW.scale * zoom, 0.55, 1.8);
    const after = screenToTree(sx,sy);

    TREE_VIEW.ox += (after.x - before.x);
    TREE_VIEW.oy += (after.y - before.y);
  };

  glyphCanvas.onpointerdown = (ev) => {
    if (_uiMode !== 'tree' && _uiMode !== 'ceremony') return;
    glyphCanvas.setPointerCapture(ev.pointerId);
    TREE_VIEW.dragging = true;
    TREE_VIEW.lastX = ev.clientX;
    TREE_VIEW.lastY = ev.clientY;
  };

  glyphCanvas.onpointermove = (ev) => {
    if (!TREE_VIEW.dragging) return;
    const dx = ev.clientX - TREE_VIEW.lastX;
    const dy = ev.clientY - TREE_VIEW.lastY;
    TREE_VIEW.lastX = ev.clientX;
    TREE_VIEW.lastY = ev.clientY;
    TREE_VIEW.ox += dx / TREE_VIEW.scale;
    TREE_VIEW.oy += dy / TREE_VIEW.scale;
  };

  glyphCanvas.onpointerup = () => { TREE_VIEW.dragging = false; };
}
function detachTreeInput(){
  if (!glyphCanvas) return;
  glyphCanvas.onwheel = null;
  glyphCanvas.onpointerdown = null;
  glyphCanvas.onpointermove = null;
  glyphCanvas.onpointerup = null;
}

// ---------- 3D + element signature draw ----------
function drawElementAura(ctx, el, x, y, r, time, alpha){
  const st = ELEM_STYLE[el] || ELEM_STYLE.lightning;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha;

  if (el === 'fire'){
    // flame tongues
    for (let k=0;k<3;k++){
      const a = time*3.2 + k*2.1 + (x+y)*0.002;
      const fx = x + Math.cos(a)*r*0.55;
      const fy = y + Math.sin(a)*r*0.55;
      ctx.fillStyle = rgba(st.main, 0.55);
      ctx.beginPath(); ctx.arc(fx, fy, 6 + 4*Math.sin(time*8+k), 0, Math.PI*2); ctx.fill();
    }
  } else if (el === 'lightning'){
    // tiny arcs
    ctx.strokeStyle = rgba(st.main, 0.65);
    ctx.lineWidth = 2;
    for (let k=0;k<3;k++){
      const a = time*4 + k*2.09;
      const x0 = x + Math.cos(a)*r*0.6;
      const y0 = y + Math.sin(a)*r*0.6;
      ctx.beginPath();
      ctx.moveTo(x0,y0);
      ctx.lineTo(x0 + (Math.random()*2-1)*18, y0 + (Math.random()*2-1)*18);
      ctx.stroke();
    }
  } else if (el === 'water'){
    // ripples
    ctx.strokeStyle = rgba(st.main, 0.35);
    ctx.lineWidth = 3;
    const rr = r*0.55 + (Math.sin(time*2.3)*0.5+0.5)*r*0.18;
    ctx.beginPath(); ctx.arc(x,y,rr,0,Math.PI*2); ctx.stroke();
  } else if (el === 'spirit'){
    // wisps
    ctx.fillStyle = rgba(st.main, 0.35);
    for (let k=0;k<4;k++){
      const a = time*1.7 + k*1.57;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a)*r*0.55, y + Math.sin(a)*r*0.55, 4.5, 0, Math.PI*2);
      ctx.fill();
    }
  } else if (el === 'earth'){
    // dust motes
    ctx.fillStyle = rgba(st.main, 0.28);
    for (let k=0;k<5;k++){
      const a = time*1.3 + k*1.1;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a)*r*0.58, y + Math.sin(a)*r*0.58, 2.5, 0, Math.PI*2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawGlyphIcon3D(ctx, img, x, y, size, el, alpha, selected, unlocked, time){
  const st = ELEM_STYLE[el] || ELEM_STYLE.lightning;
  const flick = (el==='fire') ? (0.7 + 0.3*Math.sin(time*10 + x*0.01 + y*0.01)) : 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  // shadow
  ctx.save();
  ctx.filter = 'drop-shadow(0px 10px 12px rgba(0,0,0,0.55))';
  ctx.drawImage(img, x - size/2, y - size/2, size, size);
  ctx.restore();

  // bevel darkening (fake engraved depth)
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha * 0.35;
  const dg = ctx.createRadialGradient(x,y,size*0.15, x,y,size*0.62);
  dg.addColorStop(0,'rgba(0,0,0,0)');
  dg.addColorStop(1,'rgba(0,0,0,0.85)');
  ctx.fillStyle = dg;
  ctx.beginPath(); ctx.arc(x,y,size*0.62,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // inner glow
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha * (selected ? 0.75 : 0.35) * flick;
  const g = ctx.createRadialGradient(x,y,size*0.12, x,y,size*0.62);
  g.addColorStop(0, rgba(st.rim, 0.55));
  g.addColorStop(0.45, rgba(st.main, 0.32));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x,y,size*0.62,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // rim ring
  ctx.save();
  ctx.globalAlpha = alpha * (selected ? 0.95 : 0.55);
  ctx.strokeStyle = rgba(st.rim, 0.85);
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(x,y,size*0.52,0,Math.PI*2); ctx.stroke();
  ctx.restore();

  // element aura
  drawElementAura(ctx, el, x, y, size*0.62, time, alpha*(selected?0.85:0.45));

  // unlocked pip
  if (unlocked){
    ctx.save();
    ctx.globalAlpha = alpha * 0.95;
    ctx.fillStyle = rgba(st.rim, 0.9);
    ctx.beginPath();
    ctx.arc(x + size*0.32, y - size*0.32, 9, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawLabel(ctx, x, y, text, alpha){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '700 13px system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, x, y + 62);
  ctx.restore();
}
// ===========================
// GLYPH UI POSITIONS (FIX)
// ===========================
// ===========================
// ANCIENT GLYPH PENTAGON UI
// ===========================

const GLYPHS = ['fire','lightning','spirit','water','earth'];

function getGlyphLayout(cx, cy, R){
  const out = [];
  const step = (Math.PI * 2) / 5;
  const offset = -Math.PI / 2; // point up

  for (let i = 0; i < 5; i++){
    const a = offset + i * step;
    out.push({
      g: GLYPHS[i],
      x: cx + Math.cos(a) * R,
      y: cy + Math.sin(a) * R,
      r: 28
    });
  }

  return out;
}
function drawGlyphPentagonUI(ctx, t){
  const cx = glyphCanvas.width * 0.5;
  const cy = glyphCanvas.height * 0.5 + 40;
  const R  = 140;

  const glyphs = getGlyphLayout(cx, cy, R);

  ctx.save();

  // --- Ancient connecting lines
  ctx.strokeStyle = 'rgba(200,180,120,0.35)';
  ctx.lineWidth = 3;

  for (let i = 0; i < glyphs.length; i++){
    const a = glyphs[i];
    const b = glyphs[(i + 1) % glyphs.length];

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // spoke to centre
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }

  // --- Centre mysterious glyph
  const pulse = 0.9 + Math.sin(t * 1.2) * 0.1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.2);

  const cg = ctx.createRadialGradient(0,0,4,0,0,32);
  cg.addColorStop(0,'rgba(255,240,200,0.9)');
  cg.addColorStop(1,'rgba(0,0,0,0)');

  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0,0,32 * pulse,0,Math.PI*2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,220,150,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0,0,22,0,Math.PI*2);
  ctx.stroke();

  ctx.restore();

  // --- Outer glyph nodes
  for (const g of glyphs){
    const sel = player.glyphPath === g.g;

    // glow
    const gg = ctx.createRadialGradient(g.x,g.y,4,g.x,g.y,36);
    gg.addColorStop(0, sel ? 'rgba(255,200,120,0.9)' : 'rgba(200,200,200,0.7)');
    gg.addColorStop(1,'rgba(0,0,0,0)');

    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(g.x,g.y,36,0,Math.PI*2);
    ctx.fill();

    // ring
    ctx.strokeStyle = sel ? 'rgba(255,220,150,1)' : 'rgba(180,180,180,0.8)';
    ctx.lineWidth = sel ? 4 : 2;
    ctx.beginPath();
    ctx.arc(g.x,g.y,g.r,0,Math.PI*2);
    ctx.stroke();

    // rune letter
    ctx.fillStyle = '#fff';
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(g.g[0].toUpperCase(), g.x, g.y);
  }

  ctx.restore();
}

// ---------- Open/close ----------
function openGlyphOverlay(seconds=15){
  if (!ovGlyphs || !glyphCanvas || !gctx) return;

  ovGlyphs.style.display = 'grid';

  if (state.path && !state.completed[state.path]) {
    _uiMode = 'tree';
    ensureTreeState(state.path);
  } else {
    _uiMode = 'pentagon';
  }

  _glyphSelected = null;
  _selBranch = -1;
  _selTier = 0;
  _glyphCost = 0;

  if (_uiMode === 'tree'){
    TREE_VIEW.ox = 0; TREE_VIEW.oy = 0; TREE_VIEW.scale = 1.0;
  }

  glyphTitleEl.textContent = '—';
  glyphDescEl.textContent = 'Select a glyph or node to view its description.';
  glyphEnchantBtn.disabled = true;
  glyphCostEl.textContent = '—';

  if (glyphTimerEl) glyphTimerEl.textContent = String(seconds);
  if (glyphEssenceEl) glyphEssenceEl.textContent = String(state.essence);

  _glyphParticles.length = 0;
  for (let i=0;i<140;i++){
    _glyphParticles.push({
      x:(Math.random()*2-1)*60,
      y:(Math.random()*2-1)*60,
      vx:(Math.random()*2-1)*22,
      vy:(Math.random()*2-1)*22,
      a:0.18 + Math.random()*0.35,
      r:1 + Math.random()*2.0
    });
  }

  glyphCanvas.onclick = (ev) => {
    const rect = glyphCanvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) * (glyphCanvas.width  / rect.width);
    const my = (ev.clientY - rect.top)  * (glyphCanvas.height / rect.height);
    onGlyphClick(mx, my);
  };

  glyphEnchantBtn.onclick = onGlyphEnchant;
  attachTreeInput();

  cancelAnimationFrame(_glyphRAF);
  _glyphRAF = requestAnimationFrame(drawGlyphOverlay);
}

function closeGlyphOverlay(){
  if (ovGlyphs) ovGlyphs.style.display = 'none';
  glyphCanvas && (glyphCanvas.onclick = null);
  glyphEnchantBtn && (glyphEnchantBtn.onclick = null);
  detachTreeInput();
  cancelAnimationFrame(_glyphRAF);
}

// ---------- Click selection ----------
function onGlyphClick(mx, my){

  // -------------------------
  // PENTAGON MODE (choose element)
  // -------------------------
  if (_uiMode === 'pentagon'){
    const cx = glyphCanvas.width * 0.5;
    const cy = glyphCanvas.height * 0.5 + 40;
    const R  = 140;

    const glyphs = getGlyphLayout(cx, cy, R);

    for (const g of glyphs){
      const dx = mx - g.x;
      const dy = my - g.y;
      if (dx*dx + dy*dy <= g.r*g.r){
        _glyphSelected = g.g;

        // show text
        glyphTitleEl.textContent = GLYPH_CORE[g.g].name;
        glyphDescEl.textContent  = GLYPH_CORE[g.g].desc;

        _glyphCost = GLYPH_COST_CORE;
        glyphCostEl.textContent = String(_glyphCost);
        glyphEnchantBtn.disabled = state.essence < _glyphCost;
        return;
      }
    }
    return;
  }

  // -------------------------
  // TREE MODE (choose next node)
  // -------------------------
  if (_uiMode === 'tree' && state.path){
    const el = state.path;
    ensureTreeState(el);

    for (let b=0;b<3;b++){
      const need = nextTier(el,b);
      if (!need) continue;

      const pos = nodePos(b, need);
      const ss = treeToScreen(pos.x, pos.y);

      const dx = mx - ss.x;
      const dy = my - ss.y;
      const hitR = 62; // matches 112px icon

      if (dx*dx + dy*dy <= hitR*hitR){
        _selBranch = b;
        _selTier   = need;

        _glyphCost = (need===1)?GLYPH_COST_T1:(need===2)?GLYPH_COST_T2:GLYPH_COST_T3;
        glyphCostEl.textContent = String(_glyphCost);
        glyphEnchantBtn.disabled = state.essence < _glyphCost;

        glyphTitleEl.textContent = GLYPH_TREE[el][b][need-1].name;
        glyphDescEl.textContent  = GLYPH_TREE[el][b][need-1].desc;
        return;
      }
    }
  }
}

// ---------- Enchant ----------
function onGlyphEnchant(){
  if (_uiMode === 'ceremony') return;

  const cx = glyphCanvas.width/2;
  const cy = glyphCanvas.height/2;

  // TREE MODE: enchant selected node
  if (_uiMode === 'tree') {
    const el = state.path;
    if (!el) return;
    if (_selBranch < 0 || _selTier < 1) return;
    if (state.essence < _glyphCost) return;

    state.essence -= _glyphCost;
    if (glyphEssenceEl) glyphEssenceEl.textContent = String(state.essence);

    const np = nodePos(_selBranch,_selTier);
    const sp = treeToScreen(np.x,np.y);

    _uiMode = 'ceremony';
    _ceremony = { type:'node', el, branch:_selBranch, tier:_selTier, from:{x:sp.x,y:sp.y}, to:{x:sp.x,y:sp.y}, t0:performance.now(), dur:650 };

    glyphEnchantBtn.disabled = true;
    glyphCostEl.textContent = '—';
    return;
  }

  // PENTAGON MODE: enchant core
  if (!_glyphSelected) return;
  if (state.essence < _glyphCost) return;

  state.essence -= _glyphCost;
  if (glyphEssenceEl) glyphEssenceEl.textContent = String(state.essence);

  state.path = _glyphSelected;
  state.tier = Math.max(state.tier, 1);
  player.glyphPath = state.path;
  player.glyphTier = state.tier;
  ensureTreeState(state.path);

  const glyphs = getGlyphLayout(cx, cy, 140);
  const g = glyphs.find(x => x.g === _glyphSelected);
  if (!g) return;

  const gx = g.x;
  const gy = g.y;

  _uiMode = 'ceremony';
  _ceremony = { type:'core', el:_glyphSelected, branch:-1, tier:0, from:{x:gx,y:gy}, to:{x:cx,y:cy}, t0:performance.now(), dur:900 };

  _glyphSelected = null;
  _selBranch = -1; _selTier = 0;
  TREE_VIEW.ox = 0; TREE_VIEW.oy = 0; TREE_VIEW.scale = 1.0;

  glyphEnchantBtn.disabled = true;
  glyphCostEl.textContent = '—';
}

// ---------- Draw ----------
function drawGlyphOverlay(){
  if (!ovGlyphs || ovGlyphs.style.display !== 'grid') return;

  const W = glyphCanvas.width, H = glyphCanvas.height;
  gctx.clearRect(0,0,W,H);

  const cx = W/2, cy = H/2;
  const time = performance.now()/1000;

  // particles orbit around centre/ceremony
  let orbitX = cx, orbitY = cy, orbitForce = 0.10;
  let activeEl = (state.path || _glyphSelected || (_ceremony && _ceremony.el) || 'lightning');
  const st = ELEM_STYLE[activeEl] || ELEM_STYLE.lightning;

  if (_uiMode === 'ceremony' && _ceremony){
    const t = (performance.now() - _ceremony.t0) / _ceremony.dur;
    const u = clamp(t, 0, 1);
    const ease = 1 - Math.pow(1-u, 3);
    orbitX = _ceremony.from.x + (_ceremony.to.x - _ceremony.from.x) * ease;
    orbitY = _ceremony.from.y + (_ceremony.to.y - _ceremony.from.y) * ease;
    orbitForce = 0.30;
  }

  for (const p of _glyphParticles){
    p.x += p.vx*(1/60);
    p.y += p.vy*(1/60);
    const d = Math.hypot(p.x,p.y) || 1;
    p.vx += (-p.y/d)*orbitForce;
    p.vy += ( p.x/d)*orbitForce;
    p.vx *= 0.99; p.vy *= 0.99;

    gctx.globalAlpha = p.a;
    gctx.fillStyle = rgba(st.main, p.a);
    gctx.beginPath();
    gctx.arc(orbitX + p.x, orbitY + p.y, p.r, 0, Math.PI*2);
    gctx.fill();
  }
  gctx.globalAlpha = 1;

  // centre “ancient core” (procedural — no sprite required)
  {
    const pulse = 0.5 + 0.5*Math.sin(time*1.4);
    const r0 = 62 + pulse*6;
    const g = gctx.createRadialGradient(cx,cy,10,cx,cy,r0*1.35);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.55, rgba(st.main, 0.12));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    gctx.fillStyle = g;
    gctx.beginPath(); gctx.arc(cx,cy,r0*1.35,0,Math.PI*2); gctx.fill();
  }

  // CEREMONY
  if (_uiMode === 'ceremony' && _ceremony){
    const t = (performance.now() - _ceremony.t0) / _ceremony.dur;
    const u = clamp(t,0,1);
    const ease = 1 - Math.pow(1-u, 3);
    const px = _ceremony.from.x + (_ceremony.to.x - _ceremony.from.x) * ease;
    const py = _ceremony.from.y + (_ceremony.to.y - _ceremony.from.y) * ease;

    // element-coloured whirl ring
    gctx.save();
    gctx.globalAlpha = 0.95;
    gctx.strokeStyle = rgba(st.rim, 0.95);
    gctx.lineWidth = 6;
    gctx.setLineDash([12, 7]);
    gctx.lineDashOffset = -performance.now()*0.03;
    gctx.beginPath();
    gctx.arc(px, py, 82 + Math.sin(u*Math.PI)*12, 0, Math.PI*2);
    gctx.stroke();
    gctx.restore();

    // draw icon (3D)
    const img = GlyphImages[_ceremony.el][0];
    drawGlyphIcon3D(gctx, img, px, py, 144, _ceremony.el, 1.0, true, true, time);

    // finish ceremony
    if (u >= 1){
      if (_ceremony.type === 'node'){
        unlockNode(_ceremony.el, _ceremony.branch, _ceremony.tier);

        if (isComplete(_ceremony.el)){
          state.completed[_ceremony.el] = true;
          player.completedGlyphs[_ceremony.el] = true;
          state.path = null;
          _uiMode = 'pentagon';
          glyphTitleEl.textContent = `${_ceremony.el.toUpperCase()} COMPLETED`;
          glyphDescEl.textContent  = "Path filled. Next upgrade lets you pick another element.";
        } else {
          _uiMode = 'tree';
          glyphTitleEl.textContent = `${_ceremony.el.toUpperCase()} — CONTINUE`;
          glyphDescEl.textContent  = "Enchant the next available tier on each branch.";
        }

        _selBranch = -1; _selTier = 0;
        glyphEnchantBtn.disabled = true;
        glyphCostEl.textContent = '—';
      } else {
        _uiMode = 'tree';
        glyphTitleEl.textContent = `${_ceremony.el.toUpperCase()} — CHOSEN`;
        glyphDescEl.textContent  = "Unlock each branch (T1→T2→T3). Scroll/drag to move the tree.";
        glyphEnchantBtn.disabled = true;
        glyphCostEl.textContent = '—';
      }
      _ceremony = null;
    }

    _glyphRAF = requestAnimationFrame(drawGlyphOverlay);
    return;
  }

  // TREE MODE
  if (_uiMode === 'tree' && state.path){
    const el = state.path;
    ensureTreeState(el);

    // core icon (uses tier1 sprite)
    const s0 = treeToScreen(0,0);
    drawGlyphIcon3D(gctx, GlyphImages[el][0], s0.x, s0.y, 144, el, 1.0, true, true, time);
    drawLabel(gctx, s0.x, s0.y, `${GLYPH_CORE[el].name}`, 0.75);

    for (let b=0;b<3;b++){
      const p1=nodePos(b,1), p2=nodePos(b,2), p3=nodePos(b,3);
      const a0=treeToScreen(0,0), a1=treeToScreen(p1.x,p1.y), a2=treeToScreen(p2.x,p2.y), a3=treeToScreen(p3.x,p3.y);

      gctx.save();
      gctx.globalAlpha = 0.22;
      gctx.strokeStyle = rgba(st.main, 0.45);
      gctx.lineWidth = 6;
      gctx.beginPath();
      gctx.moveTo(a0.x,a0.y);
      gctx.lineTo(a1.x,a1.y);
      gctx.lineTo(a2.x,a2.y);
      gctx.lineTo(a3.x,a3.y);
      gctx.stroke();
      gctx.restore();

      for (let tier=1;tier<=3;tier++){
        const pos = nodePos(b,tier);
        const ss = treeToScreen(pos.x,pos.y);
        const unlocked = isUnlocked(el,b,tier);
        const need = nextTier(el,b);
        const selectable = (tier === need);

        const img = (tier===1)?GlyphImages[el][0]:(tier===2)?GlyphImages[el][1]:GlyphImages[el][2];
        const alpha = unlocked ? 1.0 : (selectable ? 0.78 : 0.12);

        drawGlyphIcon3D(gctx, img, ss.x, ss.y, 112, el, alpha, selectable, unlocked, time);
        drawLabel(gctx, ss.x, ss.y, GLYPH_TREE[el][b][tier-1].name, alpha);
      }
    }

    _glyphRAF = requestAnimationFrame(drawGlyphOverlay);
    return;
  }
  // =========================
  // PENTAGON MODE (ACTIVE LOOP)
  // =========================
  if (_uiMode === 'pentagon'){
    drawGlyphPentagonUI(gctx, time);
    _glyphRAF = requestAnimationFrame(drawGlyphOverlay);
    return;
  }

}
  function goHome(){
    state.running = false;
    ovPause.style.display = 'none';

    // ✅ DO NOT FALL BACK TO SINGLE WHEN ONLINE
    if (isNetActive()) {
      // stay in multiplayer home
      ovHome.style.display = 'grid';
    } else {
      ovHome.style.display = 'grid';
    }

    if (audio.musicOn) audio.startMusic();
  }

  function restart() {
    // Reset player
    player.x = world.w / 2;
    player.y = world.h / 2;
    player.hp = player.hpMax = 100;
    player.shield = 0;
    player.spdMul = 1;
    player.slowT = 0;

    // Guns
    setWeapon(0);
    player.ammo = weapons[player.weapon].ammo;
    player.reserve = weapons[player.weapon].reserve;
    player.reloading = false;
    player.reloadT = 0;
    player.lastShot = 0;
    player.dashCD = 0;

    // State
    state.wave = 1;
    state.score = 0;
    state.playerExploded = false;
    // ✅ reset glyph phase properly (prevents instant overlay close)
    state.phase = 'combat';
    state.phaseEndsAt = 0;
    closeGlyphOverlay();
    // ✅ reset PvE leaderboard each run
    for (const k in pveLeaderboard) delete pveLeaderboard[k];
    pveLeaderboard.local = 0;

    // Clear world and queues
    spawnQueue = [];
    ents.bullets = [];
    ents.ebullets = [];
    ents.enemies = [];
    ents.effects = [];
    ents.pickups = [];
    noiseEvents.length = 0;

    // Rebuild map & nav
    // Rebuild map ONLY offline.
    // Online: server provides world via snapshot.world.
    if (!isNetActive()) {
      if (!window.Net || !Net.state || !Net.state.lobbyId) {
        world.buildObstacles();
        world.buildHazards();
        world.buildChests();
      }
      nav.rebuild();

      const c0 = nav.cellFrom(player.x, player.y);
      nav.floodFrom(c0.ix, c0.iy);

      startWave(1);
    }


    // 👇 IMPORTANT: actually start the simulation
    ovHome.style.display = 'none';
    ovPause.style.display = 'none';
    state.running = true;  
    // ✅ reset PvE leaderboard
    for (const k in pveLeaderboard) delete pveLeaderboard[k];
    pveLeaderboard['local'] = 0;
   
    updateHudButtonsForMode();                // ← lets update() run
    if (audio.musicOn) audio.startMusic();
    canvas.focus();
  }
  function applyTheme(theme){ currentTheme=theme; state.diff=parseFloat(selDiff.value||'1.0')||1.0; lvlEl.textContent=`${currentTheme.id} — ${currentTheme.name}` 
    if (!window.Net || !Net.state || !Net.state.lobbyId) {
      world.buildObstacles();
      world.buildHazards();
      world.buildChests();
    }
    nav.rebuild(); }
  function applyNetMap(meta){
    if (!meta) return;

    // ✅ Theme is visual ONLY
    if (meta.levelId){
      const th = LEVELS.find(l => l.id === meta.levelId);
      if (th) currentTheme = th;
    }

    // ❌ DO NOT build world locally in multiplayer
    // ❌ DO NOT call buildObstacles / buildHazards / buildChests

    // ✅ Server snapshot owns the world completely
    if (isNetActive() && hasFreshSnapshot()){
      applyServerWorldFromSnapshot();
    }
  }
  // Build home cards ----------------------------------------------------------
  function createLevelPreview(theme){ const cnv=document.createElement('canvas'); cnv.width=260; cnv.height=130; const c=cnv.getContext('2d'); const g=c.createLinearGradient(0,0,0,cnv.height); g.addColorStop(0,theme.floor.c1); g.addColorStop(1,theme.floor.c2); c.fillStyle=g; c.fillRect(0,0,cnv.width,cnv.height); c.strokeStyle=theme.floor.grid; c.lineWidth=1; c.beginPath(); for(let x=0;x<cnv.width;x+=20){ c.moveTo(x,0); c.lineTo(x,cnv.height); } for(let y=0;y<cnv.height;y+=20){ c.moveTo(0,y); c.lineTo(cnv.width,y); } c.stroke(); const rects=[{x:20,y:22,w:70,h:18},{x:120,y:46,w:50,h:26},{x:190,y:26,w:50,h:22},{x:60,y:82,w:120,h:20}]; for(const o of rects){ c.fillStyle=theme.obs.fill; c.strokeStyle=theme.obs.stroke; c.lineWidth=2; roundRect(c,o.x,o.y,o.w,o.h,8); c.fill(); c.stroke(); } if(theme.hazards.kind!=='none'){ c.fillStyle= theme.hazards.kind==='lava'?'#ff6a2a': theme.hazards.kind==='chasm'?'#08101a': theme.hazards.kind==='void'?'#09060c':'#4a3a2a'; c.fillRect(160,22,70,30); c.strokeStyle=theme.accent+'66'; c.strokeRect(160,22,70,30); } c.fillStyle = '#fff'; c.beginPath(); c.arc(200,70, 14, 0, Math.PI*2); c.fill(); return cnv; }
  
  function buildHome(){
    const grid = document.getElementById('levelsGrid');
    if (!grid) return; // ✅ multiplayer / in‑game safety

    grid.innerHTML = '';
    LEVELS.forEach(theme => { 
    const card=document.createElement('div') 
    card.className='levelCard' 
    const prev=document.createElement('div') 
    prev.className='levelPreview' 
    const prevCanvas=createLevelPreview(theme) 
    prev.appendChild(prevCanvas) 
    const badge=document.createElement('div') 
    badge.className='levelBadge' 
    badge.textContent=theme.badge; prev.appendChild(badge) 
    const body=document.createElement('div') 
    body.className='levelBody' 
    const name=document.createElement('div') 
    name.className='levelName' 
    name.textContent=`${theme.id}. ${theme.name}` 
    const desc=document.createElement('div') 
    desc.className='levelDesc' 
    desc.textContent=theme.desc 
    body.appendChild(name) 
    body.appendChild(desc) 
    card.appendChild(prev) 
    card.appendChild(body)
    
    card.addEventListener('click', async () => {
      // ✅ OFFLINE (single-player): apply theme immediately
      if (!isNetActive()) {
        applyTheme(theme); // sets currentTheme + rebuilds world offline
      }

      // ✅ ONLINE (multiplayer): tell server which level to use
      if (window.Net && Net.state && Net.state.lobbyId) {
        await Net.setLevel(theme.id);
      }

      // show loading overlay (used by both single & multi)
      const ovLoad = document.getElementById('overlayLoading');
      const text = document.getElementById('loadingText');
      if (ovLoad) ovLoad.style.display = 'grid';

      // offline uses a short delay; online uses server joinDeadline
      const deadline = Net?.state?.meta?.joinDeadline || (Date.now() + 1500);

      const tick = () => {
        const secs = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        if (text) {
          text.textContent = isNetActive()
            ? `Joining lobby… starting in ${secs}s`
            : `Starting in ${secs}s…`;
        }

        if (secs <= 0) {
          if (ovLoad) ovLoad.style.display = 'none';

          // ✅ hide either menu (single or multi)
          const oh = document.getElementById('overlayHome');
          if (oh) oh.style.display = 'none';
          const os = document.getElementById('overlaySingle');
          if (os) os.style.display = 'none';

          document.getElementById('btnRestart')?.click();
        } else {
          setTimeout(tick, 250);
        }
      };

      tick();
    });
    grid.appendChild(card); }); }

  // Init ----------------------------------------------------------------------
  // Init ----------------------------------------------------------------------
  if (!window.Net || !Net.state || !Net.state.lobbyId) {
    world.buildObstacles();
  }

    buildHome();
    loadSettings();
  // React to host meta (level + seed)
  let _lastRosterKey = '';
  let _lastMapKey = '';
  window.addEventListener('net:meta', (ev) => {
    HAS_SERVER_WORLD = false;
    // 1) Apply map only when it actually changes (prevents heavy work every poll tick)
    try {
      const d = ev.detail || {};
      const mapKey = String(d.levelId ?? '') + ':' + String(d.mapSeed ?? '');
      if (mapKey !== _lastMapKey) {
        _lastMapKey = mapKey;
        applyNetMap(d);
      }
    } catch {}

    // 2) Re-init lockstep ONLY when roster changes (prevents respawn snap-back)
    try {
      
    } catch {}
  });
  // Show remote events (muzzle flashes / melee pose)
  // Show remote events (muzzle flashes / melee pose / bullets)
  window.addEventListener('net:event', (ev) => {
   const e = ev.detail || {};

   if (e.kind === 'shot') {
      // PvE: remote shot is VFX only (avoid RNG desync)
      ents.effects.push({ x: e.x, y: e.y, type: 'muzzle', life: 0.12, t: 0, color: '#fff' });

      // Visual-only remote bullet (moving dot), no collision/damage
      const a = e.ang ?? 0;
      const sp = 1200; // visual speed
      ents.effects.push({
        x: e.x,
        y: e.y,
        type: 'rb',
        life: 0.35,
        t: 0,
        color: '#cfe5ff',
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 3.5
      });

      // IMPORTANT: make host AI hear peer shots too
      if (isNetActive() && amHost()) {
        noiseEvents.push({ x: e.x, y: e.y, r: 720, t: 1.2 });
      }
    }
   else if (e.kind === 'enemy_hit' && amHost()) {
      // Find closest enemy to hit point
      let best = -1;
      let bestD2 = 40 * 40;

      for (let i = 0; i < ents.enemies.length; i++) {
        const en = ents.enemies[i];
        const dx = en.x - e.x;
        const dy = en.y - e.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = i;
        }
      }

      if (best >= 0) {
        ents.enemies[best].hp -= e.dmg;
      }
    }
   else if (e.kind === 'melee') {
    ents.effects.push({ x: e.x, y: e.y, type:'pop', life:0.25, t:0, color:'#aef' });
   }
   else if (e.kind === 'chest_open') {
    // Apply chest open globally
    const ch = world.chests && world.chests[e.id];
    if (ch && !ch.opened) openChest(ch, e.drops || []);
   }
  });
  let _lastSeenServerWave = 0;

 
window.addEventListener('net:snapshot', (ev) => {
  const snap = ev.detail || Net?.state?.snapshot;
  if (!snap || !Array.isArray(snap.players)) return;

  storeSnapshot(snap);
  storeMeFromSnapshot(snap); // ✅ ADD THIS
  renderLobbyPlayers();

  if (localStorage.getItem('arenaMode') === 'pve' && typeof snap.wave === 'number') {
    if (snap.wave > _lastSeenServerWave) {
      _lastSeenServerWave = snap.wave;
      updateBestWave(snap.wave);
    }
  }
});

  // If we join late and meta already exists, apply once at startup
  try { if (isNetActive() && Net.state?.meta) applyNetMap(Net.state.meta); } catch {}
  // -------- Lockstep sim (no host) --------
  const LS = {
    tick: 0, 
    acc: 0, 
    dt: 1/30, // fixed sim step (30Hz) 
    players: new Map(), // id -> {x,y,ang,hp} 
    ready: false 
    }; 
    function lsInitPlayers() { 
    const ids = (isNetActive() ? (Net.lockstep?.peers?.() || []) : []);

    // PvE lobby limit (max 5)
    if (ids.length > 5) ids.length = 5; 

    // ✅ IMPORTANT: do NOT become "ready" unless roster exists AND includes me
    if (!ids.length || !ids.includes(Net.state.peerId)) { 
    LS.players.clear(); 
    LS.ready = false; 
    return; 
    } 

    LS.players.clear(); 
    // deterministic spawn positions from sorted ids 
    const cx = world.w/2, cy = world.h/2, R = 240; 
    for (let i=0; i<ids.length; i++) { 
    const id = ids[i]; 
    const a = (i / Math.max(1, ids.length)) * Math.PI * 2; 
    LS.players.set(id, { x: cx + Math.cos(a)*R, y: cy + Math.sin(a)*R, ang: 0, hp: 100 }); 
    } 
    // bind local player object to my lockstep state 
    // ✅ DO NOT overwrite the local player object
    // Lockstep state is authoritative ONLY for prediction,
    // render from snapshot / player separately

    const me = LS.players.get(Net.state.peerId);
    if (me) {
      // keep a separate visual reference only
      LS.visualMe = me;
    }
    LS.tick = 0; 
    LS.acc = 0; 
    LS.ready = true; 
    } 
  function lsStep(dt, inputsById) {
    // apply player inputs deterministically
    for (const [id, st] of LS.players.entries()) {
      const inp = inputsById[id] || { ix:0, iy:0, ang:0, shoot:false, melee:false };

      st.ang = inp.ang;

      const speed = 240;
      const dx = inp.ix, dy = inp.iy;
      const m = Math.hypot(dx,dy) || 1;
      const vx = (dx/m) * speed * dt;
      const vy = (dy/m) * speed * dt;

      const oldX = st.x, oldY = st.y;
      st.x += vx; if (world.isBlocked(st.x, st.y, player.r)) st.x = oldX;
      st.y += vy; if (world.isBlocked(st.x, st.y, player.r)) st.y = oldY;
      st.x = clamp(st.x, 30, world.w-30);
      st.y = clamp(st.y, 30, world.h-30);
    }

    // copy my lockstep state into your existing local "player" object
    

    // ---- Deterministic firing (LOCAL ONLY for now) ----
    // (This makes "shoot" actually work when lockstep is active.)
    const myInp = inputsById[Net.state.peerId] || { shoot:false, melee:false, ang: player.angle };
    player._fireCD = Math.max(0, (player._fireCD || 0) - dt);

    if (myInp.shoot && equip !== 'melee' && player._fireCD <= 0) {
      // tick-based cooldown (deterministic)
      const w = weapons[player.weapon];
      player._fireCD = 1 / Math.max(1, w.rof);

      // spawn bullets deterministically using seeded rand()
      const base = player.angle;
      if (player.ammo > 0 && !player.reloading) {
        player.ammo--;
        for (let i = 0; i < w.shots; i++) {
          const a = base + rand(-w.spread, w.spread);
          spawnBullet(
            player.x + Math.cos(a) * player.r,
            player.y + Math.sin(a) * player.r,
            a, w.speed, w.dmg, w.pierce
          );
        }
        addEffect(player.x + Math.cos(base) * player.r, player.y + Math.sin(base) * player.r, 'muzzle', 0.1, '#fff');
        cam.shake = Math.max(cam.shake, 4 * w.recoil);
      }
    }

    // run ENEMY AI
    // run ENEMY AI
    for (let i = ents.enemies.length - 1; i >= 0; i--) { 
    const e = ents.enemies[i]; 
    if (!online() || !Net.state.snapshot) {
      enemyBehavior(e, dt);
    }
    } 

    // ✅ move bullets/effects in lockstep (fixes "white dot")
    stepProjectiles(dt); 
    // ✅ handle deaths in lockstep (was missing)
    for (let i = ents.enemies.length - 1; i >= 0; i--) {
      const e = ents.enemies[i];
      if (e.hp <= 0) {
        let sc = 10;
        if (e.type === 'tank') sc = 28;
        if (e.type === 'shooter') sc = 18;
        if (e.type === 'swarm') sc = 6;
        if (e.type === 'boss') sc = 320;

        state.score += sc;

        // Use deterministic rand() (NOT Math.random) to avoid desync
        if (rand(0,1) < 0.15 || e.type === 'boss') dropPickup(e.x, e.y);

        const baseCol = sampleSpriteColor(e.type);
        spawnTriangleBurst(e.x, e.y, baseCol, { big: 6, small: 22 });
        spawnGhostSilhouette(e.x, e.y, e.r + 10, currentTheme.accent);

        ents.enemies.splice(i, 1);
      }
    }
  } 

  // Loop ----------------------------------------------------------------------
  let last=performance.now() 
  function loop(t){
    const dt = Math.min(0.033, (t-last)/1000);
    last = t;
    
    const meshSize = window.Net?._mesh?.size ?? 0;

    if (
      isNetActive() &&
      Net.lockstep &&
      Net.lockstep.peers &&
      Net.lockstep.peers().length > 0 &&
      meshSize === 0
    ) {
      console.warn(
        "LOCKSTEP STALLED",
        "peers =", Net.lockstep.peers(),
        "mesh.size =", meshSize,
        "LS.ready =", LS.ready
      );
    }


    if (state.running) {
      const online = isNetActive();
      const peerCount = online && Net.lockstep?.peers ? Net.lockstep.peers().length : 0;
      const meshSize = window.Net?._mesh?.size ?? 0;

      // ✅ Only use lockstep if:
      // - solo (1 peer), OR
      // - at least one WebRTC connection is open
      const canLockstep =
        online &&
        LS.ready &&
        Net.lockstep &&
        (meshSize > 0)

      if (canLockstep) {
        // TEMP: lockstep branch not implemented in pve5 yet,
        // so keep the game playable using the offline sim.
        updateFixed(dt, ++SIM_TICK);
      } else {
        updateFixed(dt, ++SIM_TICK);
      }
    }

    draw(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function updateFixed(dt, tick){
    if (isNetActive()) syncAppearanceOnce();
    if (isNetActive()) syncGunsOnce();
    let dx = 0, dy = 0;
    const online = isNetActive();
    if (online && hasFreshSnapshot()) {
      applyServerWorldFromSnapshot();
    }
    // ✅ Online: authoritative death handling
    if (online && hasFreshSnapshot()){
      const me = mySnapshotPlayer();

      // ✅ If server no longer includes me → I am DEAD
      if (!me) {
        handleAuthoritativeDeath();
        return; // 🚨 stop updateFixed immediately
      }

      if (typeof me.hp === 'number'){
        player.hp = me.hp;
      }
    }
    // ✅ Online: spawn death VFX when enemies disappear from snapshot
    if (online && hasFreshSnapshot()){
      const snap = Net.state?.snapshot;
      if (snap?.phase && snap.phase !== netPhase) {
        netPhase = snap.phase;
        netGlyphTime = snap.glyphTime ?? 0;

        if (netPhase === 'glyph') {
          openGlyphOverlay(15);
          state.running = false;
        }

        if (netPhase === 'combat') {
          closeGlyphOverlay();
          state.running = true;
        }
      }
      if (snap && Array.isArray(snap.enemies)){
        const nowE = new Map();
        for (const e of snap.enemies){
          nowE.set(e.id, { x:e.x, y:e.y, type:e.type, r:e.r ?? 16 });
        }

        for (const [id, prev] of _prevSnapEnemies){
          if (!nowE.has(id)){
            const baseCol = sampleSpriteColor(prev.type);
            spawnTriangleBurst(prev.x, prev.y, baseCol, { big:6, small:22 });
            spawnGhostSilhouette(prev.x, prev.y, (prev.r ?? 16) + 10, currentTheme.accent);
            audio.hit();
            
            // ✅ PvE leaderboard (online)
              const typeKey =
                (prev.type === 'chaser' || prev.type === 'swarm')
                  ? 'ravener'
                  : prev.type;

              const pts = PVE_POINTS[typeKey] || 0;
              const killer = prev.killerId || 'unknown';

              if (!pveLeaderboard[killer]) pveLeaderboard[killer] = 0;
              pveLeaderboard[killer] += pts;

          }
        }

        _prevSnapEnemies = nowE;
        // ✅ Online: spawn chest drops when a chest becomes opened (snapshot diff)
        // ✅ Online: spawn chest drops on transition unopened -> opened (supports respawn)
        if (online && hasFreshSnapshot()) {
          const snap = Net.state?.snapshot;
          const chests = snap?.world?.chests;

          if (Array.isArray(chests)) {
            const alive = new Set();

            for (const ch of chests) {
              if (!ch || typeof ch.id !== 'number') continue;
              alive.add(ch.id);

              const prevOpen = _prevChestOpenState.get(ch.id) || false;
              const nowOpen = !!ch.opened;

              if (!prevOpen && nowOpen) {
                if (Array.isArray(ch.drops)) {
                  for (const d of ch.drops) dropPickup(d.x, d.y, d.type);
                }
                audio.chest();
              }

              _prevChestOpenState.set(ch.id, nowOpen);
            }

            // prune removed ids
            for (const id of _prevChestOpenState.keys()) {
              if (!alive.has(id)) _prevChestOpenState.delete(id);
            }
          }
        }
      }
    }
    // ✅ Online authoritative: bullets come from snapshot
    if (online && hasFreshSnapshot()) {
      ents.bullets.length = 0;
      ents.ebullets.length = 0;
    }

    const isHost = online && amHost();
    const isPeer = online && amPeer();
    // If I'm a peer, I must not keep any locally simulated enemies
    if (isPeer) {
      if (ents.enemies.length) ents.enemies.length = 0;
      if (spawnQueue.length) spawnQueue = [];
    }

    // Host safety: if match is running and nothing is queued, ensure wave 1 is started
    if (online && isHost && state.running && state.wave === 1 && spawnQueue.length === 0 && ents.enemies.length === 0) {
      startWave(1);
    }

    meleeCooldown = Math.max(0, meleeCooldown - dt);
    for (let i = noiseEvents.length - 1; i >= 0; i--){ noiseEvents[i].t -= dt; if (noiseEvents[i].t <= 0) noiseEvents.splice(i, 1); }
    const k = input.keys 
    if (k.has('w') || k.has('arrowup'))    dy -= 1; if (k.has('s') || k.has('arrowdown'))  dy += 1; if (k.has('a') || k.has('arrowleft'))  dx -= 1; if (k.has('d') || k.has('arrowright')) dx += 1; dx += input.touch.stick.dx * 1.2; dy += input.touch.stick.dy * 1.2; const mag = Math.hypot(dx, dy) || 1; dx /= mag; dy /= mag;
    // ✅ GLYPH PHASE: hard-disable player control
    if (!online && state.phase === 'glyph') {
      dx = 0; dy = 0;
      input.mouse.down = false;
      input.touch.fire = false;
      input.touch.stick.active = false;
    }

    const sens = parseFloat(rngSens.value || '1');
    const mx_css = input.mouse.x, my_css = input.mouse.y;

    // Mouse screen → world (same space your world is drawn in)
    let aimX, aimY;

    if (IS_MOBILE && mobileAim.active) {
      aimX = mobileAim.x;
      aimY = mobileAim.y;
    } else {
      aimX = cam.x + cam.sx + mx_css;
      aimY = cam.y + cam.sy + my_css;
    }

    // ✅ Compute angle from the SAME position you render the player at
    const { x: ax, y: ay } = getVisualPlayerPos();

    player.angle = lerpAngle(
      player.angle,
      angleTo(ax, ay, aimX, aimY),
      0.28 * sens
    );
    // 📱 Mobile tap-to-aim override (fires towards tap crosshair)
    if (IS_MOBILE && mobileAim.active) {
      player.angle = lerpAngle(
        player.angle,
        angleTo(player.x, player.y, mobileAim.x, mobileAim.y),
        0.4
      );
    }
    if (player.reloading){ player.reloadT -= dt; if (player.reloadT <= 0){ const w = weapons[player.weapon]; const need = w.ammo - player.ammo; const give = Math.min(need, player.reserve); player.ammo += give; player.reserve -= give; player.reloading = false; } }
    player.inSand = false;
    player.onIce  = false; // <-- add this reset

    const speed = player.speed * player.spdMul
                * (player.slowT > 0 ? 0.7 : 1)
                * (player.inSand ? 0.35 : 1)
                * (player.onIce  ? 0.85 : 1); // slight traction loss on ice
    
    if (player.slowT > 0) player.slowT = Math.max(0, player.slowT - dt);
    
    // Mesh (no host): ALWAYS move locally so controls remain responsive online
    const predicting = false;
    const netReady   = online && hasFreshSnapshot();

    // (Optional legacy: you can remove sendInput; mesh uses state/event instead)
    // AFTER dx / dy are computed and normalized
    moveWithCollide(player, dx * speed * dt, dy * speed * dt);
    tickWisps(dt); // ✅ WISPS UPDATE (ANCHOR TO PLAYER)

    if (online) {
      Net.sendInput(dx, dy, player.angle, player.x, player.y, player.weapon);
    }
  

    
    // Always allow local fire; when online, also broadcast a 'shot' event for VFX
    if (state.phase !== 'glyph' && (input.mouse.down || input.touch.fire)) {
      const ammoBefore = player.ammo;
      const lastShotBefore = player.lastShot;
      playerShoot()

    }
    if (player.dashCD > 0) player.dashCD = Math.max(0, player.dashCD - dt) 
    if (player.dashI  > 0) player.dashI  = Math.max(0, player.dashI  - dt)
    player.voidCD = Math.max(0, (player.voidCD || 0) - dt);
    if (melee) Melee.update(melee, dt);
    // --- Melee damage check ---
    // --- Melee damage check (cone in front), 1 hit per enemy per swing ---
    if (equip === 'melee' && melee) {
      // Track per-swing hits so we don't multi-hit the same enemy in one animation
      if (melee._lastState !== melee.state) {
        if (melee.state === 'using') melee._hitSet = new Set();
        melee._lastState = melee.state;
      }

      if (melee.state === 'using') {
        const DMG = meleeDamageForCurrentWeapon();
        const RANGE = 120;
        const ARC = Math.PI / 2;
        const ang = player.angle;

        const snap = isNetActive() ? Net.state?.snapshot : null;
        const targets = (isNetActive() && snap && Array.isArray(snap.enemies))
          ? snap.enemies
          : ents.enemies;

        // Track hit IDs per swing (works for snapshot + local enemies)
        if (!melee._hitSet) melee._hitSet = new Set();

        for (let i = targets.length - 1; i >= 0; i--) {
          const e = targets[i];
          if (!e) continue;

          const idKey = e.id ?? e;         
          if (melee._hitSet.has(idKey)) continue;

          const dx = e.x - player.x;
          const dy = e.y - player.y;
          const dist = Math.hypot(dx, dy);
          const er = e.r ?? 16;

          if (dist > RANGE + er) continue;

          const dir = Math.atan2(dy, dx);
          const diff = Math.abs(((dir - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > ARC / 2) continue;

          // VFX always
          addEffect(e.x, e.y, 'hit', 0.15, '#fff');
          cam.shake = Math.max(cam.shake, 2);

          if (isNetActive()) {
            // ✅ server authoritative melee damage
            Net.sendHit('enemy', e.x, e.y, DMG, 'melee');
          } else {
            // offline damage
            
            // offline damage (glyph-aware)
            const mult = onHitGlyph(e, DMG, 'melee');
            e.hp -= DMG * mult;

            // Soul Bind copy damage
            if (isPath('spirit') && hasG('spirit','soulBind') && player._linkA && player._linkB && player._linkT > 0){
              const other = (player._linkA === e) ? player._linkB : (player._linkB === e ? player._linkA : null);
              if (other && other !== e) other.hp -= DMG * mult * 0.35;
            }


            // ✅ track melee kill owner
            e.lastHitBy = 'local';

            if (e.hp <= 0) ents.enemies.splice(i, 1);
          }

          melee._hitSet.add(idKey);
        }
      }
    }
    // --- Single‑player spawning only ---
    if (!online) {
      state.spawnT += dt;

      if (state.spawnIdx == null) state.spawnIdx = 0;

        while (
          state.spawnIdx < spawnQueue.length &&
          state.spawnT >= spawnQueue[state.spawnIdx].t
        ) {
          const s = spawnQueue[state.spawnIdx++];
        const cNow = nav.cellFrom(player.x, player.y);
        nav.floodFrom(cNow.ix, cNow.iy);
        let x = s.x, y = s.y;
        if (!nav.isReachable(x,y) || world.isBlocked(x,y,16) || world.collideHazard(x,y,16)) {
          const fb = nav.randomReachableAwayFrom(player.x, player.y, 600);
          if (fb){ x = fb.x; y = fb.y; }
        }
        if (!isNetActive()) {
          spawnEnemy(s.type, x, y);
        }
      }

      if ((state.spawnIdx ?? 0) >= spawnQueue.length && ents.enemies.length === 0) {

        // enter glyph phase once per wave end
        if (state.phase !== 'glyph') {
          state.phase = 'glyph';
          state.phaseEndsAt = performance.now() + 15000;
          openGlyphOverlay(15);
        }

        // countdown
        const remaining = Math.max(0, state.phaseEndsAt - performance.now());
        if (glyphTimerEl) glyphTimerEl.textContent = String(Math.ceil(remaining/1000));
        if (glyphEssenceEl) glyphEssenceEl.textContent = String(state.essence);

        // when timer ends -> resume
        if (remaining <= 0 && _uiMode !== 'ceremony') {
          closeGlyphOverlay();

          state.phase = 'combat';
          state.phaseEndsAt = 0;

          // 💧 Sanctuary persists into next wave
          if (isPath('water') && hasG('water','sanctuary')){
            addWorldVfx({ type:'sanctuary', x: player.x, y: player.y, r: 80, life: 20 });
          }

          startWave(state.wave + 1);
          maybeUpdateBestWave(state.wave);
          respawnCollectedChests();
          player.reserve += 10 + Math.floor(state.wave * 2);
        }
      }
    }
    
    if (melee) Melee.update(melee, dt);
    // --- Single‑player enemy updates only ---
    if (!online) {
      for (let i = ents.enemies.length - 1; i >= 0; i--) {
        const e = ents.enemies[i];
        // 👻 Check Dread Bloom aura
        e._dread = false;
        for (const fx of ents.effects){
          if (fx.type === 'dreadBloom'){
            const dx = e.x - fx.x;
            const dy = e.y - fx.y;
            if (dx*dx + dy*dy < fx.r * fx.r){
              e._dread = true;
              break;
            }
          }
        }

        // AI tick
        // 💧 Drench slow (OFFLINE ONLY)
        if (!online && e.drenchT > 0){
          e.spdMul = 0.75;
        } else {
          e.spdMul = 1;
        }

        // AI tick
        if (!isNetActive() || !Net.state.snapshot) {
          enemyBehavior(e, dt);
        }
        e.voidCD = Math.max(0, (e.voidCD || 0) - dt);

        // Body collision with player
        const d2 = dist2(e.x, e.y, player.x, player.y);
        const rr = e.r + player.r;
        if (d2 < rr * rr) {
          let dmg = ( e.type==='tank'?22
          : e.type==='boss'?30
          : e.type==='swarm'?6
          : e.type==='healer'?0
          : e.type==='bomber'?8
          : 12 ) * state.diff;

        // 👻 Haunt: enemies deal half damage
        if (e.hauntT > 0){
          dmg *= 0.5;
        }
        // 👻 Dread Bloom: reduce damage by 1/3
        if (e._dread){
          dmg *= 0.66;
        }

        hurtPlayer(dmg * dt * 1.4);
          const d = Math.sqrt(d2) || 1;
          moveWithCollide(player, (player.x - e.x)/d * 40 * dt, (player.y - e.y)/d * 40 * dt);
        }

        // Hazard interaction for this enemy
        {
          const hz = world.getHazardAt(e.x, e.y, e.r * 0.9);
          if (hz) {
            if (hz.type === 'sand') {
              e.inSand = true;
              applyQuicksand(e, hz, dt, { isPlayer:false });
            } else if (hz.type === 'ice') {
              applyIceSlide(e, hz, dt);
            } else if (hz.type === 'void') {
              const res = resolveVoid(e, hz, dt, false);
              if (res.done && res.killed) {
                ents.enemies.splice(i, 1);
                addEffect(e.x, e.y, 'pop', 0.5, '#ff8aa6');
                state.score += 6;
                continue; // <-- inside the for loop (legal)
              }
            } else if (hz.type === 'lava') {
              if (hz.phase === 'erupt') {
                // instant kill
                ents.enemies.splice(i, 1);
                addEffect(e.x, e.y, 'pop', 0.5, '#ff8aa6');
                state.score += 6;
                continue;
              } else if (hz.phase === 'after') {
                e.hp -= 30 * dt; // DoT
              }
            } else {
              // generic lethal hazard
              ents.enemies.splice(i, 1);
              addEffect(e.x, e.y, 'pop', 0.5, '#ff8aa6');
              state.score += 6;
              continue;
            }
          } else {
            e.inSand = false;
          }
        }

        tickEnemyStatuses(e, dt);
        // Death & loot
        if (e.hp <= 0) {
          const typeKey = (e.type === 'chaser' || e.type === 'swarm')
            ? 'ravener'
            : e.type;

          const pts = PVE_POINTS[typeKey] || 0;
          const killer = e.lastHitBy || 'local';

          // init bucket
          if (!pveLeaderboard[killer]) {
            pveLeaderboard[killer] = 0;
          }

          // award points
          pveLeaderboard[killer] += pts;

          // XP orb always drops (value by enemy type)
          const XP_VAL = (e.type === 'boss') ? 8 :
                        (e.type === 'bomber') ? 4 :
                        (e.type === 'healer') ? 3 :
                        (e.type === 'tank' || e.type === 'shooter' || e.type === 'sniper') ? 2 : 1;
          dropXpOrb(e.x, e.y, XP_VAL);

          // (optional) still allow classic loot sometimes:
          if (Math.random() < 0.10 || e.type === 'boss') dropPickup(e.x, e.y);

          const baseCol = sampleSpriteColor(e.type);
          spawnTriangleBurst(e.x, e.y, baseCol, { big:6, small:22 });
          spawnGhostSilhouette(e.x, e.y, e.r + 10, currentTheme.accent);

          // 👻 SPIRIT SHADE SPAWN (OFFLINE)
          if (
            isPath('spirit') &&
            (
              (hasG('spirit','wraithKing') && e.type === 'boss') ||
              (hasG('spirit','revenant') && Math.random() < 0.25)
            )
          ){
            ents.effects.push({
              type: 'shade',
              x: e.x,
              y: e.y,
              r: 18,
              life: hasG('spirit','possession') ? 3.5 : 2.0,
              t: 0
            });
          }
          // 👻 Dread Bloom aura on death
          if (isPath('spirit') && hasG('spirit','dreadBloom')){
            ents.effects.push({
              type: 'dreadBloom',
              x: e.x,
              y: e.y,
              r: 120,
              life: 4.5,
              t: 0
            });
          }
          // 🌊 WATER — MAELSTROM (SINGLE‑PLAYER, 75% ON KILL)
          if (
            !isNetActive() &&
            isPath('water') &&
            hasG('water', 'maelstrom') &&
            Math.random() < 0.75
          ) {
            addWorldVfx({
              type: 'maelstrom',
              x: e.x,
              y: e.y,
              r: 120,
              life: 4.0 // ✅ EXACTLY 4 SECONDS
            });
          }

          ents.enemies.splice(i, 1);
          audio.hit();
          continue; // <-- legal here
        }
      }
    }

    for (let i = ents.bullets.length - 1; i >= 0; i--){ const b = ents.bullets[i]; const kill = lineWallHit(b.x, b.y, b.vx, b.vy, dt, b.r); b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (kill || b.life <= 0){ ents.bullets.splice(i,1); continue; } let hit = -1; for (let j = 0; j < ents.enemies.length; j++){ const e = ents.enemies[j]; const r = e.r + b.r; if (dist2(b.x,b.y,e.x,e.y) < r*r){ hit = j; break; } } if (hit >= 0){ const e = ents.enemies[hit] 
      
      const base = b.dmg * (1 + state.wave * 0.02);
      let dmg = b.dmg;

      // 🚫 Skip glyph logic for plain bullets (wisps)
      if (!b.noGlyph){
        const mult = onHitGlyph(e, dmg, 'bullet');
        dmg *= mult;
      }

      e.hp -= dmg;
      // 🔥 Napalm Trail: drop burning ground on bullet impact
      if (isPath('fire') && hasG('fire','napalmTrail')){
        addWorldVfx({ type:'napalm', x: b.x, y: b.y, r: 60, life: 1.2 });
      }

      // 👻 Soul Bind — split damage, conserve total
      if (
        isPath('spirit') &&
        hasG('spirit','soulBind') &&
        player._linkA &&
        player._linkB &&
        player._linkT > 0 &&
        (e === player._linkA || e === player._linkB)
      ){
        const other = (e === player._linkA) ? player._linkB : player._linkA;

        // Safety: kill broken links
        if (!other || other.hp <= 0){
          player._linkA = player._linkB = null;
          player._linkT = 0;
        } else {
          const shared = dmg * 0.35;
          const primary = dmg - shared;

          e.hp -= primary;
          other.hp -= shared;

          // cancel earlier full damage
          e.hp += dmg;
        }
      }


      // ✅ track last hitter for PvE leaderboard
      e.lastHitBy = 'local';
      addEffect(b.x,b.y,'hit',0.15,'#fff') 
      // 💧 Mending Mist hit counter (OFFLINE ONLY)
      if (!online && isPath('water') && hasG('water','mendingMist')){
        player._mistHits = (player._mistHits ?? 0) + 1;

        if (player._mistHits >= 10){
          player._mistHits = 0;

          // heal pulse
          player.hp = Math.min(player.hpMax, player.hp + 5);

          ents.effects.push({
            type: 'mendingPulse',
            x: player.x,
            y: player.y,
            r: player.r * 3,   // ✅ 3× player width
            life: 1.2,
            t: 0
          });
        }
      }
     // 🌊 Tidal Wave hit counter
     // 🌊 Tidal Wave hit counter (OFFLINE)
    
      cam.shake = Math.max(cam.shake,1.5); if (b.pierce > 0) b.pierce--; else ents.bullets.splice(i,1); e.alerted = true; e.alertT = Math.max(e.alertT, 3); broadcastAlertFrom(e.x,e.y); } }

    for (let i = ents.ebullets.length - 1; i >= 0; i--){ const b = ents.ebullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (b.kind === 'bomb'){ const hitWall = lineWallHit(b.x, b.y, b.vx, b.vy, 0, b.r); const timeUp=(b.life<=0); if (hitWall || timeUp){ const R=(b.splashR||110)+player.r; if(dist2(b.x,b.y,player.x,player.y) < R*R){ hurtPlayer(b.dmg); addEffect(b.x,b.y,'hit',0.12,'#ffd7d7'); } addEffect(b.x,b.y,'pop',0.55,'#ffb38a'); cam.shake=Math.max(cam.shake,5); ents.ebullets.splice(i, 1); continue; } continue; } if (lineWallHit(b.x,b.y,b.vy,b.vx,0,b.r) || b.life <= 0){ ents.ebullets.splice(i,1); continue; } const r = player.r + b.r; if (dist2(b.x,b.y,player.x,player.y) < r*r){ if (currentTheme.id === 3) player.slowT = Math.max(player.slowT, 1.6); hurtPlayer(b.dmg); addEffect(b.x,b.y,'hit',0.1,'#ffd7d7'); ents.ebullets.splice(i,1); } }

    for (let i = ents.pickups.length - 1; i >= 0; i--){
      const p = ents.pickups[i];
      p.t += dt;

      // ===== XP orb magnet =====
      if (p.type === 'xp') {
        const MAGNET_R = 260;
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < MAGNET_R) {
          const pull = (1 - d / MAGNET_R);
          const sp = 520 + pull * 680; // px/s
          p.x += (dx / d) * sp * dt;
          p.y += (dy / d) * sp * dt;
        }
      }

      // collect check
      const r = player.r + p.r;
      if (dist2(p.x,p.y,player.x,player.y) < r*r){
        switch(p.type){
          case 'health': player.hp = Math.min(player.hpMax, player.hp + 35); break;
          case 'speed':  player.spdMul = clamp(player.spdMul + 0.15, 1, 1.7); break;
          case 'shield': player.shield = clamp(player.shield + 35, 0, 120); break;
          case 'ammo':   player.reserve += 24; break;

          case 'xp':
            state.essence += (p.v ?? 1);

            // 💧 Mending Mist: heal on XP pickup (OFFLINE ONLY)
            if (!online && isPath('water') && hasG('water','mendingMist')){
              player.hp = Math.min(player.hpMax, player.hp + 5);

              ents.effects.push({
                type: 'mendingMist',
                x: player.x,
                y: player.y,
                r: 70,
                life: 0.9,
                t: 0
              });
            }
            break;

        }
        addEffect(p.x,p.y,'pop',0.4,'#aef');
        audio.pickup();
        ents.pickups.splice(i,1);
      }
    }

    for (const ch of world.chests){
      if (!ch || ch.opened) continue;

      const b = world.buildings[ch.buildingIndex];
      if (!b || !b.inner) continue;

      // must be inside building interior to interact
      if (!pointInRect(player.x, player.y, b.inner)) continue;

      // close enough
      if (dist2(player.x,player.y, ch.x,ch.y) < (player.r+ch.r)*(player.r+ch.r)){
        if (isNetActive()){
          // online: ask server to open
          if (!ch._opening){
            ch._opening = true;
            Net.openChest(ch.id).then((j) => {
              if (j && j.ok) {
                // optimistic local update (still authoritative because server responded)
                ch.opened = true;
                ch.drops = Array.isArray(j.drops) ? j.drops : [];

                // spawn drops immediately
                for (const d of (ch.drops || [])) {
                  dropPickup(d.x, d.y, d.type);
                }
                audio.chest();
              }
            }).finally(() => { ch._opening = false; });
          }
        } else {
          // offline: local open
          openChest(ch);
        }
      }
    }
    for (let i = ents.effects.length - 1; i >= 0; i--){
    const e = ents.effects[i];
    e.t += dt;

    // Per-effect updates
    if (e.type === 'triBurst'){
      for (const s of e.shards){
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.88;
        s.vy *= 0.88;
        s.rot += s.vr * dt;
        s.a *= 0.985;
      }
    } else if (e.type === 'rb') {
      e.x += (e.vx || 0) * dt;
      e.y += (e.vy || 0) * dt;
    } else if (e.type === 'ghost'){
      e.y += ((e.vy || -110)) * dt;
      if (e.vy) e.vy *= 0.98;
    }
    else if (e.type === 'mendingPulse'){
      // 🌊 follow player while active
      e.x = player.x;
      e.y = player.y;
    }
    // 🌊 TIDAL WAVE GAMEPLAY EFFECT (push + drench over lifetime)
    if (e.type === 'tidalWave') {
      const p = e.t / e.life;        // 0 → 1
      const curR = e.r * p;
      const ARC  = e.spread ?? Math.PI / 3;

      /* =======================
        ENEMIES — carried
        ======================= */
      for (const en of ents.enemies) {
        const dx = en.x - e.x;
        const dy = en.y - e.y;
        const d  = Math.hypot(dx, dy);
        if (d <= 0 || d > curR + en.r) continue;

        const ang  = Math.atan2(dy, dx);
        const diff = Math.abs(((ang - e.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff > ARC / 2) continue;

        applyDrench(en, 1, 1.2);

        const nx = dx / d;
        const ny = dy / d;

        const targetDist = curR - 8;
        if (d < targetDist) {
          const move = targetDist - d;
          en.x += nx * move;
          en.y += ny * move;
        }
      }

      /* =======================
        ENEMY BULLETS — carried
        (IDENTICAL LOGIC)
        ======================= */
      for (const b of ents.ebullets) {
        if (!b || b.life <= 0) continue;

        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const d  = Math.hypot(dx, dy);
        if (d <= 0 || d > curR) continue;

        const ang  = Math.atan2(dy, dx);
        const diff = Math.abs(((ang - e.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff > ARC / 2) continue;

        const nx = dx / d;
        const ny = dy / d;

        const BULLET_MARGIN = 6;          // slightly tighter than enemies
        const targetDist = curR - BULLET_MARGIN;

        if (d < targetDist) {
          const move = targetDist - d;
          b.x += nx * move;
          b.y += ny * move;
        }
      }
    }

    if (e.t >= e.life) ents.effects.splice(i, 1);
    else if (e.type === 'ember'){
      // homing ember: seek nearest enemy and ignite
      let best=null, bestD2=260*260;
      for (const en of ents.enemies){
        const d2 = dist2(e.x,e.y,en.x,en.y);
        if (d2 < bestD2){ bestD2=d2; best=en; }
      }
      if (best){
        const dx = best.x - e.x, dy = best.y - e.y;
        const d = Math.hypot(dx,dy) || 1;
        const sp = 520;
        e.vx += (dx/d) * sp * dt;
        e.vy += (dy/d) * sp * dt;

        // hit check
        if (d2 < (best.r + 6)*(best.r + 6)){
          applyBurn(best, 1, 2.4);
          addEffect(best.x, best.y, 'hit', 0.15, '#ff9a3c');
          ents.effects.splice(i,1);
          continue;
        }
      }
      e.x += (e.vx||0)*dt;
      e.y += (e.vy||0)*dt;
      e.vx *= 0.90;
      e.vy *= 0.90;
    }
    else if (e.type === 'mendingMist'){
      const x = e.x - cam.x;
      const y = e.y - cam.y;

      const pulse = 0.6 + 0.4 * Math.sin(e.t * 8);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const g = ctx.createRadialGradient(x, y, 10, x, y, e.r);
      g.addColorStop(0, `rgba(120,220,255,${0.35 * pulse})`);
      g.addColorStop(0.6, 'rgba(80,180,220,0.18)');
      g.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, e.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(180,240,255,${0.45 * pulse})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++){
        const a = e.t * 2 + i * (Math.PI * 2 / 3);
        ctx.beginPath();
        ctx.arc(x, y, e.r * 0.6, a, a + Math.PI * 0.7);
        ctx.stroke();
      }

      ctx.restore();
    }
    else if (e.type === 'tidalWave'){
      // static effect; no per-frame movement
    }
    


    else if (e.type === 'shade'){
      // simple allied shade: chases nearest enemy and hits
      let best=null, bestD2=520*520;
      for (const en of ents.enemies){
        const d2 = dist2(e.x,e.y,en.x,en.y);
        if (d2 < bestD2){ bestD2=d2; best=en; }
      }
      if (best){
        const dx = best.x - e.x, dy = best.y - e.y;
        const d = Math.hypot(dx,dy) || 1;
        const sp = hasG('spirit','possession') ? 320 : 240;
        e.x += (dx/d) * sp * dt;
        e.y += (dy/d) * sp * dt;

        if (bestD2 < (best.r + 14)*(best.r + 14)){
          best.hp -= hasG('spirit','possession') ? 18 : 12;
          if (hasG('spirit','haunt')) applyHaunt(best, 2.6);
          addEffect(best.x, best.y, 'hit', 0.15, '#c066ff');
        }
      }
    }
  }
  updateWorldVfx(dt);

    {
      const hz = world.getHazardAt(player.x, player.y, player.r * 0.9);
      if (hz) {
        if (hz.type === 'sand') {

          player.slowT = Math.max(player.slowT, 0.2);
          applyQuicksand(player, hz, dt, { isPlayer: true });

        } else if (hz.type === 'ice') {

          applyIceSlide(player, hz, dt);

        } else if (hz.type === 'lava') {

          if (hz.phase === 'erupt') {
            player.hp = 0;
          } else if (hz.phase === 'after') {
            hurtPlayer(20 * dt);
          }

        } else if (hz.type === 'void') {

          resolveVoid(player, hz, dt, true);

        } else {

          player.hp = 0;
        }
      }
    }
    // Provide my current light-weight state to the net layer (20Hz sender reads it)
    // Provide my current light-weight state to the net layer (20Hz sender reads it)
    if (isNetActive()) {
      const isHost = amHost();

      Net.state.local = {
        x: player.x,
        y: player.y,
        ang: player.angle,
        equip,
        weapon: player.weapon,
        melee: !!(melee && melee.state === 'using'),

        // Host broadcasts authoritative enemies
        enemies: isHost ? ents.enemies.map(en => ({
          type: en.type,
          x: en.x,
          y: en.y,
          r: en.r,
          hp: en.hp,
          maxhp: en.maxhp,
          alerted: !!en.alerted
        })) : undefined
      };
    }

    // Corrected camera boundaries — keeps player visible at edges
    // Unclamped camera: always follow player (no boundary stop)
    updateCamera(dt);   
    if (player.hp <= 0){
      // one-time VFX trigger
      if (!state.playerExploded){
        const baseCol = COLORS[selectedColor]?.c || '#aef';
        spawnTriangleBurst(player.x, player.y, baseCol, { big:8, small:26 });
        spawnGhostSilhouette(player.x, player.y, player.r + 14, currentTheme.accent);
        state.playerExploded = true;
      }

      state.running = false;
      const prev = parseInt(localStorage.getItem('arenaBest') || '0', 10) || 0;
      const best = Math.max(prev, state.wave);
      state.best = best;
      localStorage.setItem('arenaBest', String(best));
      bestEl.textContent = best;
      showGameOver();
    }
    // 🌊 Water: TIDAL WAVE — periodic cone knockback
    if (
      !isNetActive() &&
      isPath('water') &&
      hasG('water','tidalWave')
    ){
      player._tidalWaveCD = (player._tidalWaveCD ?? 0) - dt;

      if (player._tidalWaveCD <= 0){
        player._tidalWaveCD = 6.5; // seconds (tune as needed)

        ents.effects.push({
          type: 'tidalWave',
          x: player.x,
          y: player.y,
          ang: player.angle,
          r: 300,
          spread: Math.PI / 1.8,
          life: 0.9,
          t: 0
        });
      }
    }
    // 🪨 Earth: Quake periodic stomp
    if (!isNetActive() && isPath('earth') && hasG('earth','quake')){
      player._quakeCD = (player._quakeCD ?? 0) - dt;
      if (player._quakeCD <= 0){
        player._quakeCD = 3.2;
        aoeDamage(player.x, player.y, 120, 10, { col:'#7dffa3', stun:0.35 });
        addWorldVfx({ type:'quake', x: player.x, y: player.y, r: 160, life: 0.45, maxLife: 0.45 });
      }
    }
  }
  
  const SPRITE_ROT_OFF = {
    pistol:  0,
    rifle:   0,
    shotgun: +Math.PI * 2
  };


  function draw(dt) {
    const t = performance.now() / 1000;
    const online = isNetActive();
    const snap = online ? getInterpolatedSnapshot() : null;
    const snapRaw = online ? Net.state?.snapshot : null;

    // ✅ DEFINE BULLETS ONCE (used in multiple sections below)
    const allBullets =
      (online && snap && Array.isArray(snap.bullets))
        ? snap.bullets
        : ents.bullets;

    const drawEnemies =
      (online && snap && Array.isArray(snap.enemies))
        ? snap.enemies
        : ents.enemies;


    // World layers
    // Floor does not need 60Hz redraw
   
    // World layers (floor + obstacles must stay in sync)
   // --- World layers (must stay in sync to avoid flashing/shudder) ---
      world.drawFloor();
      world.drawHazards();

      if (!isNetActive() || HAS_SERVER_WORLD) {
        world.drawObstacles(); // ✅ always redraw on top of floor
      }



   // ---------------------------
    // Pickups + telegraphs (online uses snapshot pickups)
    // ---------------------------
    const drawPickups =
      (online && snap && Array.isArray(snap.pickups))
        ? snap.pickups
        : ents.pickups;

    for (const p of drawPickups) {

      // ✅ Boss telegraphed explosion warning
      // ✅ Boss telegraph: red target marker
      if (p.type === 'bossTarget') {
        const x = p.x - cam.x - cam.sx;
        const y = p.y - cam.y - cam.sy;

        ctx.save();
        ctx.globalAlpha = 0.9;

        // filled red dot
        ctx.fillStyle = 'rgba(255, 40, 40, 0.9)';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        // crosshair
        ctx.strokeStyle = 'rgba(255, 40, 40, 0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y);
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x, y + 10);
        ctx.stroke();

        ctx.restore();
        continue;
      }

      // ✅ Boss telegraph: blast radius warning circle (shown before explosion)
      if (p.type === 'bossWarn') {
        const x = p.x - cam.x - cam.sx;
        const y = p.y - cam.y - cam.sy;

        ctx.save();
        ctx.globalAlpha = 0.85;

        // translucent fill
        ctx.fillStyle = 'rgba(255, 40, 40, 0.12)';
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();

        // strong ring
        ctx.strokeStyle = 'rgba(255, 40, 40, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
        continue;
      }
      // ✅ Boss explosion VFX: expanding ring (not too big)
      if (p.type === 'bossBoom') {
        const x = p.x - cam.x - cam.sx;
        const y = p.y - cam.y - cam.sy;

        const age = (Date.now() - (p.t0 ?? Date.now())) / 1000;
        const life = p.life ?? 0.35;
        const u = clamp(age / life, 0, 1);

        // expand to splash radius (small because splash is ~96)
        const R = (p.r ?? 96) * u;

        ctx.save();
        ctx.globalAlpha = 0.95 * (1 - u);

        // warm fill
        ctx.fillStyle = 'rgba(255, 60, 40, 0.18)';
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fill();

        // bright shock ring
        ctx.strokeStyle = 'rgba(255, 40, 40, 0.95)';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
        continue;
      }

      // ✅ Normal pickups
      const col =
        p.type === 'xp'     ? '#ffffff' :
        p.type === 'health' ? '#7dffa3' :
        p.type === 'speed'  ? '#9cf' :
        p.type === 'shield' ? '#7af'   : '#ffd166';
      

      ctx.fillStyle = col;
      ctx.strokeStyle = '#fff2';
      ctx.lineWidth = 2;
      const bob = (Math.sin((p.t ?? 0) * 6) + 1) / 2;
      ctx.beginPath();
      ctx.arc(
        p.x - cam.x - cam.sx,
        p.y - cam.y - cam.sy,
        (p.type === 'xp' ? 4 : p.r) + bob * (p.type === 'xp' ? 1.2 : 2),
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();
    }

    // ---------------------------
    // ✅ Bullets (player + enemy)
    // ---------------------------

    // smoothed/interpolated snapshot bullets (once you add bullet smoothing into getInterpolatedSnapshot)
    const onlineBullets =
      (online && snap && Array.isArray(snap.bullets))
        ? snap.bullets
        : null;

    // raw/latest snapshot bullets (jumpy) for debug overlay
    const rawSnap = online ? Net.state?.snapshot : null;
    const rawBullets =
      (online && rawSnap && Array.isArray(rawSnap.bullets))
        ? rawSnap.bullets
        : null;

    // ===========================
    // PLAYER BULLETS
    // ===========================
    ctx.fillStyle = '#cfe5ff';

    // ✅ OFFLINE: draw local player bullets
    if (!online) {
      for (const b of ents.bullets) {
        ctx.beginPath();
        ctx.arc(
          b.x - cam.x - cam.sx,
          b.y - cam.y - cam.sy,
          b.r ?? 4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // ✅ ONLINE: draw RAW bullets in red (debug), then WALL‑CLIPPED bullets in normal colour
    if (online) {
      // raw (jumpy) — debug
      if (rawBullets) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#ff4040'; // red
        for (const b of rawBullets) {
          if (!b) continue;
          if (b.kind === 'enemy' || b.kind === 'enemyBomb') continue;

          ctx.beginPath();
          ctx.arc(
            b.x - cam.x - cam.sx,
            b.y - cam.y - cam.sy,
            b.r ?? 4,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.restore();
      }

      // ✅ HARD‑CLIPPED BULLETS (server walls are final)
      // ✅ HARD‑CLIPPED BULLETS (server walls are final)
      // ✅ PLUS: client-only hit detection + hide bullet immediately + spawn hit FX
      if (onlineBullets) {
        ctx.fillStyle = '#cfe5ff';

        const prev = _prevDrawPlayerBullets;
        const used = new Array(prev.length).fill(false);
        const next = [];

        for (const b of onlineBullets) {
          if (!b) continue;
          if (b.kind === 'enemy' || b.kind === 'enemyBomb') continue;

          // ---- Match this snapshot bullet to a previous drawn bullet (nearest + similar velocity) ----
          let bestIdx = -1;
          let bestScore = Infinity;

          for (let k = 0; k < prev.length; k++) {
            if (used[k]) continue;
            const p = prev[k];

            // must match same owner (if present) and be a player bullet
            if ((p.owner ?? null) !== (b.owner ?? null)) continue;

            // velocity similarity (tolerant)
            const dvx = (p.vx ?? 0) - (b.vx ?? 0);
            const dvy = (p.vy ?? 0) - (b.vy ?? 0);
            const vScore = dvx * dvx + dvy * dvy;

            // position closeness
            const dx = (p.x ?? b.x) - b.x;
            const dy = (p.y ?? b.y) - b.y;
            const dScore = dx * dx + dy * dy;

            // weighted score: position dominates, velocity disambiguates
            const score = dScore + vScore * 0.25;

            if (score < bestScore) {
              bestScore = score;
              bestIdx = k;
            }
          }

          let x0, y0, suppressed = false;
          if (bestIdx >= 0) {
            used[bestIdx] = true;
            x0 = prev[bestIdx].x;
            y0 = prev[bestIdx].y;
            suppressed = !!prev[bestIdx].suppressed;
          } else {
            // no match last frame → backtrack along velocity so we still sweep across walls
            // IMPORTANT: bullet snapshots can "jump", so a zero-length segment will miss walls.
            const BACKTRACK = 0.12; // seconds (matches your 120ms interp buffer)
            x0 = b.x - (b.vx ?? 0) * BACKTRACK;
            y0 = b.y - (b.vy ?? 0) * BACKTRACK;
            suppressed = false;
          }

          // ---- Clip against authoritative walls using the real segment (x0,y0) -> (b.x,b.y) ----
          let hitWall = false;
          let fx = b.x;
          let fy = b.y;

          for (const w of world.walls) {
            const steps = Math.max(1, Math.ceil(Math.hypot(b.x - x0, b.y - y0) / 4));
            for (let i = 1; i <= steps; i++) {
              const t = i / steps;
              const x = x0 + (b.x - x0) * t;
              const y = y0 + (b.y - y0) * t;

              if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) {
                fx = x;
                fy = y;
                hitWall = true;
                break;
              }
            }
            if (hitWall) break;
          }
          // ✅ If we hit a wall, draw ONLY at the impact point and stop forever
          if (hitWall) {
            // draw at wall contact (never beyond)
            ctx.beginPath();
            ctx.arc(
              fx - cam.x - cam.sx,
              fy - cam.y - cam.sy,
              b.r ?? 4,
              0,
              Math.PI * 2
            );
            ctx.fill();

            // ✅ do NOT carry this bullet forward
            continue;
          }
          // ---- Client-only swept hit vs the SAME enemies you draw (drawEnemies is interpolated snapshot) ----
          if (!suppressed && Array.isArray(drawEnemies) && drawEnemies.length) {
            let hitE = false;
            let hitX = fx, hitY = fy;

            const segDx = fx - x0;
            const segDy = fy - y0;
            const segLen = Math.hypot(segDx, segDy);

            // smaller step = fewer misses when bullets/enemies jump
            const steps = Math.max(1, Math.ceil(segLen / 2)); // <= key change from /6

            outer:
            for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              const sx = x0 + segDx * t;
              const sy = y0 + segDy * t;

              for (const e of drawEnemies) {
                if (!e) continue;
                const rr = (e.r ?? 16) + (b.r ?? 4);
                const dx = sx - e.x;
                const dy = sy - e.y;
                if (dx * dx + dy * dy <= rr * rr) {
                  hitE = true;
                  hitX = sx;
                  hitY = sy;
                  break outer;
                }
              }
            }

            if (hitE) {
              // ✅ Fire hit FX ONCE (first time we mark suppressed)
              addEffect(hitX, hitY, 'hit', 0.15, '#fff');
              cam.shake = Math.max(cam.shake, 1.5);

              // ✅ Hide bullet immediately on client regardless of server “jumps”
              suppressed = true;
            }
          }

          // remember for next frame (even if suppressed)
          // remember for next frame
          // ✅ IMPORTANT: bullets that hit a WALL are PERMANENTLY suppressed
          if (!hitWall) {
            next.push({
              x: fx, y: fy,       // ✅ store the drawn position
              vx: b.vx, vy: b.vy,
              owner: b.owner ?? null,
              suppressed
            });
          }
          // ✅ if hitWall === true → do NOT carry it forward at all

          // ✅ If suppressed (client says it hit), do not draw it at all
          if (suppressed) continue;

          // draw bullet (clamped if needed)
          ctx.beginPath();
          ctx.arc(
            fx - cam.x - cam.sx,
            fy - cam.y - cam.sy,
            b.r ?? 4,
            0,
            Math.PI * 2
          );
          ctx.fill();

          // ✅ do NOT render past the wall
          if (hitWall) continue;
        }

        _prevDrawPlayerBullets = next;
      }
    }

    // ===========================
    // ENEMY BULLETS
    // ===========================
    ctx.fillStyle = '#ffadad';

    // ✅ OFFLINE: enemy bullets
    if (!online) {
      for (const b of ents.ebullets) {
        const rad = b.kind === 'bomb' ? 7 : (b.r ?? 4);
        ctx.beginPath();
        ctx.arc(
          b.x - cam.x - cam.sx,
          b.y - cam.y - cam.sy,
          rad,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // ✅ ONLINE: draw RAW enemy bullets in magenta (debug), then smoothed in normal colour
    if (online) {
      // raw (jumpy) — debug
      if (rawBullets) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#ff40ff'; // magenta
        for (const b of rawBullets) {
          if (!b) continue;
          if (!(b.kind === 'enemy' || b.kind === 'enemyBomb')) continue;

          const rad = b.kind === 'enemyBomb' ? 7 : (b.r ?? 4);
          ctx.beginPath();
          ctx.arc(
            b.x - cam.x - cam.sx,
            b.y - cam.y - cam.sy,
            rad,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.restore();
      }

      // smoothed (interpolated) — main
      if (onlineBullets) {
        ctx.fillStyle = '#ffadad';
        for (const b of onlineBullets) {
          if (!b) continue;
          if (!(b.kind === 'enemy' || b.kind === 'enemyBomb')) continue;

          const rad = b.kind === 'enemyBomb' ? 7 : (b.r ?? 4);
          const BACKTRACK = 0.12;
          const x0 = b.x - (b.vx ?? 0) * BACKTRACK;
          const y0 = b.y - (b.vy ?? 0) * BACKTRACK;

          const clip = clipBulletToWalls(world, x0, y0, b.x, b.y);
          const bx = clip.x;
          const by = clip.y;

          ctx.beginPath();
          ctx.arc(
            bx - cam.x - cam.sx,
            by - cam.y - cam.sy,
            rad,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
    drawWorldVfx(ctx);

    // ---------------------------
    // Enemies
    // ---------------------------
    const map = {
      chaser: 'ravener',
      tank: 'gorgon-x',
      sniper: 'noctilith',
      bomber: 'hellforged',
      healer: 'bone-warden',
      shooter: 'blacksite-operative',
      boss: 'void-seraph',
      swarm: 'ravener'
    };

    for (const e of drawEnemies) {
      const cx = e.x - cam.x - cam.sx;
      const cy = e.y - cam.y - cam.sy;
      const rr = e.r ?? 16;

      // ✅ Healer aura visual (draw behind sprite)
      if (e.type === 'healer') {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#00ff8877';
        ctx.beginPath();
        ctx.arc(cx, cy, 260, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#00ff88aa';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 260, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const hpRatio = Math.max(
        0,
        (e.hp ?? 0) / Math.max(1, (e.maxhp ?? e.hp ?? 1))
      );

      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + rr * 0.65, rr * 0.9, rr * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body (sprite or fallback)
      const ang = angleTo(e.x, e.y, player.x, player.y);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);

      const spriteKey = map[e.type] ?? e.type;
      const sheet = imgSheets[spriteKey];

      if (sheet && sheet.img) {
        const drawR = (e.type === 'boss') ? rr + 12 : rr + 6;
        ctx.drawImage(sheet.img, -drawR, -drawR, drawR * 2, drawR * 2);
      } else {
        ctx.fillStyle = '#ff6478';
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      drawGlyphVisuals(ctx, e, cx, cy, t);

      // HP rings + alerted ring
      ctx.strokeStyle = currentTheme.accent + '55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rr + 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#000a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, rr + 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#fff8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rr + 4, -Math.PI / 2, -Math.PI / 2 + hpRatio * 2 * Math.PI);
      ctx.stroke();

      if (e.alerted) {
        ctx.strokeStyle = '#ffdd66aa';
        ctx.beginPath();
        ctx.arc(cx, cy, rr + 10 + Math.sin(performance.now() / 120) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ---------------------------
    // Optional: AI debug visuals (local ents only)
    // ---------------------------
    if (DEBUG_AI) {
      ctx.save();
      for (const e of ents.enemies) {
        if (e.goal) {
          ctx.strokeStyle = '#00ff88aa';
          ctx.beginPath();
          ctx.arc(e.goal.x - cam.x - cam.sx, e.goal.y - cam.y - cam.sy, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (e.squadDoor) {
          ctx.strokeStyle = (e.role === 'blocker') ? '#ff9966aa' : '#66bbffaa';
          ctx.strokeRect(
            e.squadDoor.x - cam.x - cam.sx - 6,
            e.squadDoor.y - cam.y - cam.sy - 6,
            12,
            12
          );
        }
      }
      ctx.restore();
    }

    // ---------------------------
    // Remote players
    // ---------------------------
    // ---------------------------
    // Remote players
    // ---------------------------
    

    const remotePlayers =
      (online && snapRaw && Array.isArray(snapRaw.players))
        ? snapRaw.players
        : null;

    if (remotePlayers) {
      const myId = Net.state.peerId;
      for (const rp of remotePlayers) {

        if (!rp || rp.id === myId) continue;

        
        // ✅ No advance: use the latest authoritative position/angle as-is
        // ✅ Low-latency smoothing toward latest snapshot (NO TIME REWIND)
        const id = rp.id;

        // persistent render state
        let st = remoteRender.get(id);
        if (!st) {
          st = { x: rp.x, y: rp.y, ang: rp.ang ?? 0 };
          remoteRender.set(id, st);
        }

        // tuning (NO buffer delay)
        const POS_SMOOTH = 0.22;   // position smoothing (0.15–0.35)
        const ANG_SMOOTH = 0.30;   // angle smoothing
        const MAX_ERR = 100;       // snap distance for dashes / teleports

        // hard snap on big correction (prevents rubber-banding)
        const err = Math.hypot(rp.x - st.x, rp.y - st.y);
        if (err > MAX_ERR) {
          st.x = rp.x;
          st.y = rp.y;
        } else {
          st.x += (rp.x - st.x) * POS_SMOOTH;
          st.y += (rp.y - st.y) * POS_SMOOTH;
        }

        // shortest-angle smoothing
        const targetAng = rp.ang ?? 0;
        const da = ((targetAng - st.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        st.ang += da * ANG_SMOOTH;

        let rx = st.x;
        let ry = st.y;
        let rang = st.ang;

        const px = rx - cam.x - cam.sx;
        const py = ry - cam.y - cam.sy;


        const design =
          Number.isInteger(rp.design)
            ? rp.design
            : parseInt(rp.design, 10) || 0;

        const colIdx =
          Number.isInteger(rp.color)
            ? rp.color
            : parseInt(rp.color, 10) || 0;

        const col = COLORS[colIdx]?.c ?? COLORS[0].c;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rang);
        
        // ✅ BODY ONLY — no gun, no local state
        drawDesign(
          design,
          col,
          performance.now() / 1000,
          rp.r ?? 16
        );
        // ✅ draw remote gun skin (visual only)
        const guns = rp.guns ?? { pistol: -1, rifle: -1, shotgun: -1 };
        const w = weapons[rp.weapon ?? 0];

        let img = null;
        if (w.kind === 'pistol' && guns.pistol >= 0) img = gunSheets.pistols[guns.pistol];
        if (w.kind === 'rifle' && guns.rifle >= 0) img = gunSheets.rifles[guns.rifle];
        if (w.kind === 'shotgun' && guns.shotgun >= 0) img = gunSheets.shotguns[guns.shotgun];

        if (img) {
          const targetLength = (w.kind === 'shotgun') ? 20 : (w.kind === 'rifle') ? 30 : 110;
          const ar = (img.width > 0) ? (img.height / img.width) : 1.8;
          const drawW = targetLength / ar;
          const drawH = targetLength;

          ctx.save();
          ctx.translate((rp.r ?? 16) * 0.4, 0);
          ctx.rotate(SPRITE_ROT_OFF[w.kind] ?? 0);
          const off = SPRITE_OFFSET[w.kind] ?? { x: -0.2, y: -0.5 };
          ctx.drawImage(img, drawW * off.x, drawH * off.y, drawW, drawH);
          ctx.restore();
        } else {
          // fallback gun block (same as local)
          ctx.fillStyle = '#1e2a45';
          ctx.fillRect((rp.r ?? 16) * 0.5, -4, 22, 8);
        }

        ctx.restore();
      }
      // prune smoothing state for players no longer present
      const alive = new Set(remotePlayers.map(p => p && p.id).filter(Boolean));
      for (const k of remoteRender.keys()) {
        if (!alive.has(k)) remoteRender.delete(k);
      }
    }

    // ---------------------------
    // Local player
    // ---------------------------
    {
      const meSnap = online ? mySnapshotPlayer() : null;

      // Start from immediate local state (NO DELAY)
      let lx = player.x;
      let ly = player.y;

      // Apply gentle error correction toward server (visual only)
      if (online && meSnap) {
        const dx = meSnap.x - lx;
        const dy = meSnap.y - ly;

        const CORRECT_RATE = 0.18; // 0.12–0.25 sweet spot
        lx += dx * CORRECT_RATE;
        ly += dy * CORRECT_RATE;
      }

      const px = lx - cam.x - cam.sx;
      const py = ly - cam.y - cam.sy;
      const t = performance.now() / 1000;

      if (player.shield > 0) {
        ctx.strokeStyle = 'rgba(150,220,255,.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, player.r + 6 + Math.sin(performance.now() / 120) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(player.angle);

      drawDesign(
        selectedDesign,
        COLORS[selectedColor].c,
        t,
        player.r
      );
      drawGlyphVisuals(ctx, player, px, py, t);

      const w = weapons[player.weapon];
      const showMelee = (equip === 'melee') || (melee && melee.state === 'using');

      if (showMelee) {
        Melee.draw(ctx, melee, { playerR: player.r });
      } else {
        let img = null;
        if (w.kind === 'pistol' && pistolIndex >= 0) img = gunSheets.pistols[pistolIndex];
        if (w.kind === 'rifle'  && rifleIndex  >= 0) img = gunSheets.rifles[rifleIndex];
        if (w.kind === 'shotgun'&& shotgunIndex>= 0) img = gunSheets.shotguns[shotgunIndex];

        if (img) {
          const targetLength = (w.kind === 'shotgun') ? 20 : (w.kind === 'rifle') ? 30 : 110;
          const ar = (img.width > 0) ? (img.height / img.width) : 1.8;
          const drawW = targetLength / ar;
          const drawH = targetLength;

          ctx.save();
          ctx.translate(player.r * 0.4, 0);
          ctx.rotate(SPRITE_ROT_OFF[w.kind] ?? 0);
          const off = SPRITE_OFFSET[w.kind] ?? { x: -0.2, y: -0.5 };
          ctx.drawImage(img, drawW * off.x, drawH * off.y, drawW, drawH);
          ctx.restore();
        } else {
          ctx.fillStyle = '#1e2a45';
          ctx.fillRect(player.r * 0.5, -4, 22, 8);
        }
      }

      ctx.restore();
    }

    // ---------------------------
    // Effects
    // ---------------------------
    for (const e of ents.effects) {
      const ex = e.x - cam.x - cam.sx;
      const ey = e.y - cam.y - cam.sy;

      if (e.type === 'muzzle') {
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.beginPath();
        ctx.arc(ex, ey, 6 * (1 - e.t / e.life), 0, Math.PI * 2);
        ctx.fill();
      }
      else if (e.type === 'rb') {
        ctx.fillStyle = e.color ?? '#cfe5ff';
        ctx.beginPath();
        ctx.arc(ex, ey, e.r ?? 3, 0, Math.PI * 2);
        ctx.fill();
      }
      else if (e.type === 'hit') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ex, ey, 10 * (1 - e.t / e.life), 0, Math.PI * 2);
        ctx.stroke();
      }
      else if (e.type === 'pop') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ex, ey, 20 * (e.t / e.life), 0, Math.PI * 2);
        ctx.stroke();
      }
      else if (e.type === 'dreadBloom'){
        const x = e.x - cam.x;
        const y = e.y - cam.y;
        const pulse = 0.6 + 0.4 * Math.sin(e.t * 3);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        const g = ctx.createRadialGradient(x, y, 0, x, y, e.r);
        g.addColorStop(0, `rgba(170,120,255,${0.25 * pulse})`);
        g.addColorStop(0.7, 'rgba(140,90,220,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, e.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
      else if (e.type === 'triBurst') {
        for (const s of e.shards) {
          const sx = s.x - cam.x - cam.sx;
          const sy = s.y - cam.y - cam.sy;

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(s.rot);

          ctx.globalAlpha = Math.max(0, s.a * (1 - e.t / e.life));
          ctx.fillStyle = s.col;

          ctx.beginPath();
          ctx.moveTo(0, -s.r1);
          ctx.lineTo(+s.r2 * 0.7, +s.r3 * 0.6);
          ctx.lineTo(-s.r2 * 0.7, +s.r3 * 0.6);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      else if (e.type === 'tidalWave'){
        const x = e.x - cam.x;
        const y = e.y - cam.y;

        const p = e.t / e.life;        // 0 → 1
        const fade = 1 - p;

        // 🌊 expanding wave front
        // 🌊 expanding wave front (SAFE)
        const frontR = Math.max(0.01, e.r * p);
        const thickness = e.r * 0.18;
        const innerR = Math.max(0, frontR - thickness);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(e.ang);
        ctx.globalCompositeOperation = 'screen';

        // shadowed base for depth
        ctx.globalCompositeOperation = 'multiply';
        const gShadow = ctx.createRadialGradient(
          0, 0, innerR,
          0, 0, frontR
        );
        gShadow.addColorStop(0, 'rgba(0,0,0,0)');
        gShadow.addColorStop(1, `rgba(30,60,90,${0.35 * fade})`);
        ctx.fillStyle = gShadow;

        ctx.beginPath();
        ctx.arc(0, 0, frontR, -e.spread/2, e.spread/2);
        ctx.arc(0, 0, Math.max(0, frontR - thickness), e.spread/2, -e.spread/2, true);
        ctx.closePath();
        ctx.fill();

        // luminous water crest
        ctx.globalCompositeOperation = 'screen';
        const gWave = ctx.createRadialGradient(
          0, 0, innerR,
          0, 0, frontR
        );
        gWave.addColorStop(0, `rgba(160,230,255,${0.25 * fade})`);
        gWave.addColorStop(1, `rgba(110,180,220,${0.45 * fade})`);
        ctx.fillStyle = gWave;

        ctx.beginPath();
        ctx.arc(0, 0, frontR, -e.spread/2, e.spread/2);
        ctx.arc(0, 0, Math.max(0, frontR - thickness), e.spread/2, -e.spread/2, true);
        ctx.closePath();
        ctx.fill();

        // crest lines (3D illusion)
        ctx.strokeStyle = `rgba(200,250,255,${0.5 * fade})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, frontR, -e.spread/2, e.spread/2);
        ctx.stroke();

        ctx.restore();
      }
      else if (e.type === 'ghost') {
        const a = Math.max(0, 0.65 * (1 - e.t / e.life));
        const r = Math.max(6, e.r * (0.85 + 0.15 * Math.sin(e.t * 4)));

        const g = ctx.createRadialGradient(ex, ey, r * 0.2, ex, ey, r);
        g.addColorStop(0, (e.color ?? '#fff') + '44');
        g.addColorStop(0.6, (e.color ?? '#fff') + '22');
        g.addColorStop(1, '#0000');

        ctx.globalAlpha = a;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ex, ey, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      else if (e.type === 'ember') {
        // 3D-ish ember orb + tail
        ctx.save();
        ctx.globalAlpha = 0.9;
        const g = ctx.createRadialGradient(ex,ey,2,ex,ey,10);
        g.addColorStop(0,'rgba(255,220,160,0.95)');
        g.addColorStop(1,'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ex,ey,10,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
      else if (e.type === 'mendingPulse'){
        const x = e.x - cam.x;
        const y = e.y - cam.y;

        const p = e.t / e.life;               // 0 → 1
        const fade = Math.max(0, 1 - p);
        const depth = e.r * (0.9 + 0.1 * Math.sin(e.t * 3));

        ctx.save();

        // 🌊 shadow base (grounded 3D depth)
        ctx.globalCompositeOperation = 'multiply';
        const gShadow = ctx.createRadialGradient(
          x, y, depth * 0.3,
          x, y, e.r * 1.15
        );
        gShadow.addColorStop(0, 'rgba(0,0,0,0)');
        gShadow.addColorStop(1, `rgba(40,70,90,${0.35 * fade})`);
        ctx.fillStyle = gShadow;
        ctx.beginPath();
        ctx.arc(x, y, e.r * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // 🌫 volumetric mist body
        ctx.globalCompositeOperation = 'screen';
        const gBody = ctx.createRadialGradient(x, y, 0, x, y, e.r);
        gBody.addColorStop(0, `rgba(140,220,255,${0.38 * fade})`);
        gBody.addColorStop(0.45, `rgba(110,180,210,${0.22 * fade})`);
        gBody.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gBody;
        ctx.beginPath();
        ctx.arc(x, y, e.r, 0, Math.PI * 2);
        ctx.fill();

        // 🌀 slow swirling mist bands (3D illusion)
        ctx.strokeStyle = `rgba(185,245,255,${0.45 * fade})`;
        ctx.lineWidth = e.r * 0.06;
        for (let i = 0; i < 4; i++){
          const a = e.t * 1.2 + i * (Math.PI * 2 / 4);
          ctx.beginPath();
          ctx.arc(
            x, y,
            depth * (0.55 + i * 0.08),
            a,
            a + Math.PI * 0.85
          );
          ctx.stroke();
        }

        ctx.restore();
      }

      else if (e.type === 'shade'){
        const x = e.x - cam.x;
        const y = e.y - cam.y;

        const t = e.t || 0;
        const pulse = 0.65 + 0.35 * Math.sin(t * 6);
        const baseR = e.r || 18;
        const scale = e.isWraith ? 1.6 : 1.0;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.translate(x, y);

        // 👻 Core ghost body
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, baseR * 1.4 * scale);
        g.addColorStop(0, `rgba(220,180,255,${0.7 * pulse})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, baseR * 1.4 * scale, 0, Math.PI * 2);
        ctx.fill();

        // 👻 Shimmering arms
        ctx.strokeStyle = `rgba(200,150,255,${0.35 * pulse})`;
        ctx.lineWidth = 3 * scale;
        for (let i = 0; i < 3; i++){
          const a = t * 1.6 + i * (Math.PI * 2 / 3);
          const len = baseR * (1.6 + 0.3 * Math.sin(t * 4 + i)) * scale;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
          ctx.stroke();
        }

        // 👑 Crown for wraiths
        if (e.isWraith){
          ctx.strokeStyle = 'rgba(255,215,120,0.9)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          const cr = baseR * 1.2 * scale;
          ctx.moveTo(-cr, -cr);
          ctx.lineTo(-cr * 0.5, -cr * 1.4);
          ctx.lineTo(0, -cr);
          ctx.lineTo(cr * 0.5, -cr * 1.4);
          ctx.lineTo(cr, -cr);
          ctx.stroke();
        }

        ctx.restore();
      }
    }
    // === WISPS (floating spirits) ===
    for (const w of ents.wisps){
      const x = w.x - cam.x - cam.sx;
      const y = w.y - cam.y - cam.sy;

      ctx.save();
      drawSoftShadow(ctx, x, y + 6, 10, 6, 0.3);

      const pulse = 0.6 + 0.4*Math.sin(performance.now()/200);
      const g = ctx.createRadialGradient(x,y,2,x,y,16);
      g.addColorStop(0,'rgba(220,180,255,0.9)');
      g.addColorStop(1,'rgba(120,60,200,0)');
      ctx.globalAlpha = pulse;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x,y,16,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // ---------------------------
    // Chests, minimap, HUD
    // ---------------------------
    world.drawChests();
    if ((SIM_TICK & 7) === 0) {
      drawMinimap();
    }
    if ((SIM_TICK & 1) === 0) updateHUD();
    updateNetStatus();
  }

  function drawMinimap(){
    // ✅ Use CSS-pixel space consistently
    mctx.setTransform(MINI_DPR, 0, 0, MINI_DPR, 0, 0);

    const mw = MINI_VIEW.w;
    const mh = MINI_VIEW.h;

    // Clear
    mctx.clearRect(0, 0, mw, mh);

    // Background
    mctx.fillStyle = '#0e1420';
    mctx.fillRect(0, 0, mw, mh);

    // ===============================
    // ✅ UNIFORM WORLD → MINIMAP SCALE
    // ===============================
    const scale = Math.min(
      mw / world.w,
      mh / world.h
    );

    const offsetX = (mw - world.w * scale) * 0.5;
    const offsetY = (mh - world.h * scale) * 0.5;

    const tx = x => offsetX + x * scale;
    const ty = y => offsetY + y * scale;


    // Arena border (scaled world bounds)
    mctx.strokeStyle = '#5ad2ff';
    mctx.lineWidth = Math.max(2, mw * 0.003);
    mctx.strokeRect(
      offsetX,
      offsetY,
      world.w * scale,
      world.h * scale
    );

    // Buildings
    mctx.fillStyle = '#3a4152';
    for (const b of world.buildings){
      mctx.fillRect(
        tx(b.x),
        ty(b.y),
        Math.max(2, b.w * scale),
        Math.max(2, b.h * scale)
      );
    }

    // Solids
    mctx.fillStyle = '#1b2233';
    for (const r of world.solids){
      mctx.fillRect(
        tx(r.x),
        ty(r.y),
        Math.max(2, r.w * scale),
        Math.max(2, r.h * scale)
      );
    }

    // Hazards
    for (const h of world.hazards){
      if (h.type === 'lava') mctx.fillStyle = '#ff6a2a';
      else if (h.type === 'ice') mctx.fillStyle = '#6fbaff';
      else if (h.type === 'void') mctx.fillStyle = '#7b5cff';
      else if (h.type === 'sand') mctx.fillStyle = '#c9a35a';
      else mctx.fillStyle = '#888';

      mctx.fillRect(
        tx(h.x),
        ty(h.y),
        Math.max(2, h.w * scale),
        Math.max(2, h.h * scale)
      );
    }

    // Enemies
    const online = isNetActive();
    const snap = online ? Net.state?.snapshot : null;
    const enemies =
      (online && snap && Array.isArray(snap.enemies))
        ? snap.enemies
        : ents.enemies;

    mctx.fillStyle = '#ff6a6a';
    for (const e of enemies){
      const r = (e.type === 'boss') ? 6 : 3;
      mctx.beginPath();
      mctx.arc(tx(e.x), ty(e.y), r, 0, Math.PI * 2);
      mctx.fill();
    }

    // Other players
    if (online && snap && Array.isArray(snap.players)){
      mctx.fillStyle = '#66a3ff';
      for (const p of snap.players){
        if (!p || p.id === Net.state.peerId) continue;
        mctx.fillRect(tx(p.x) - 3, ty(p.y) - 3, 6, 6);
      }
    }

    // Local player
    mctx.fillStyle = '#7dffa3';
    mctx.beginPath();
    mctx.arc(tx(player.x), ty(player.y), 4, 0, Math.PI * 2);
    mctx.fill();
  }
  // Utilities -----------------------------------------------------------------
  function lerpAngle(a,b,t){ const d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI; return a + d*t; }
  
  function moveWithCollide(obj, dx, dy) {
    // Always allow movement (so WSAD works immediately)
    const ox = obj.x, oy = obj.y;
    obj.x += dx;
    obj.y += dy;

    // Only apply wall collision when we actually have world geometry
    if (!isNetActive() || HAS_SERVER_WORLD) {
      // X axis resolve
      if (world.isBlocked(obj.x, oy, obj.r)) obj.x = ox;
      // Y axis resolve
      if (world.isBlocked(obj.x, obj.y, obj.r)) obj.y = oy;
    }

    // Always clamp bounds
    obj.x = clamp(obj.x, 30, world.w - 30);
    obj.y = clamp(obj.y, 30, world.h - 30);
  }

  // Quicksand (swirling vortex) field: tangential swirl + inward pull
  function applyQuicksand(entity, hazard, dt, opts = {}) {
    const cx = hazard.x + hazard.w / 2;
    const cy = hazard.y + hazard.h / 2;

    const dx = cx - entity.x;
    const dy = cy - entity.y;
    const dist = Math.hypot(dx, dy) + 1e-6;

    // Directions
    const rx = dx / dist, ry = dy / dist; // radial toward centre
    const tx = -ry, ty = rx;              // tangential (perpendicular)

    // Strength grows closer to centre
    const maxR = Math.hypot(hazard.w, hazard.h) * 0.6;
    const closeness = Math.max(0, Math.min(1, 1 - dist / maxR));

    let swirl = 140 + 260 * closeness; // tangential speed (degenerates near centre)
    let pull  =  40 + 220 * closeness; // inward suction

    // Dashing reduces suction so the player can escape
    if (opts.isPlayer && (entity.dashI || 0) > 0) {
      pull *= 0.25;
    }

    const vx = tx * swirl + rx * pull;
    const vy = ty * swirl + ry * pull;

    moveWithCollide(entity, vx * dt, vy * dt);
    entity.inSand = true; // flag for base-movement slowdown
  }
  // ICE sheet sliding (non-lethal): push along the live tilt direction
  function applyIceSlide(entity, hazard, dt){
    const t = performance.now() / 1000;
    const seed = (hazard.x * 0.013 + hazard.y * 0.017);

    // Must match the draw-code formula so visuals & physics align
    const dir = (seed * Math.PI * 2) + Math.sin(t * 0.6 + seed) * 0.9;

    // Slide force breathes a little so it feels alive
    const breath = 0.85 + 0.15 * Math.sin(t * 1.1 + seed * 2.3);
    const slideSpeed = 200 * breath;   // adjust 180–260 to taste

    const vx = Math.cos(dir) * slideSpeed;
    const vy = Math.sin(dir) * slideSpeed;

    // Apply a continuous drift while on ice
    moveWithCollide(entity, vx * dt, vy * dt);

    // Flag so movement feels a bit slipperier this frame
    entity.onIce = true;
  }
  // --- Enemy sprite key helper (same mapping used in draw()) -----------------
  function enemySpriteKey(type){
    // Keep in sync with the draw() map
    const map = {
      chaser:'ravener',
      tank:'gorgon-x',
      sniper:'noctilith',
      bomber:'hellforged',
      healer:'bone-warden',
      shooter:'blacksite-operative',
      boss:'void-seraph',
      swarm:'ravener'
    };
    return map[type] || type;
  }

  // --- Color helpers ----------------------------------------------------------
  function rgbToHex(r,g,b){
    const to = v => ('0' + Math.max(0, Math.min(255, v|0)).toString(16)).slice(-2);
    return '#' + to(r) + to(g) + to(b);
  }
  function brightenHex(hex, gain=1.15){
    // crude brighten in RGB space
    const n = parseInt(hex.slice(1), 16);
    let r = ((n >> 16) & 255) * gain;
    let g = ((n >> 8) & 255) * gain;
    let b = (n & 255) * gain;
    return rgbToHex(r, g, b);
  }

  // --- Auto-sample a representative color from enemy sprite -------------------
  function sampleSpriteColor(enemyType){
    const key = enemySpriteKey(enemyType);
    const sheet = imgSheets[key];
    const img = sheet && sheet.img;
    try{
      if(!img || !img.width || !img.height) throw 0;
      // draw to tiny offscreen and average a handful of random pixels
      const sz = 24;
      const cnv = document.createElement('canvas');
      cnv.width = sz; cnv.height = sz;
      const c = cnv.getContext('2d', { willReadFrequently:true });
      c.drawImage(img, 0, 0, sz, sz);
      const { data } = c.getImageData(0,0,sz,sz);

      let R=0,G=0,B=0, N=0;
      const picks = 120; // sample a subset for speed
      for(let i=0;i<picks;i++){
        const x = (Math.random()*sz)|0, y=(Math.random()*sz)|0;
        const k = (y*sz + x)*4;
        const a = data[k+3];
        if(a<16) continue; // skip fully transparent
        R += data[k]; G += data[k+1]; B += data[k+2]; N++;
      }
      if(N===0) throw 0;
      const hex = rgbToHex(R/N, G/N, B/N);
      return brightenHex(hex, 1.15);
    }catch{
      // safe fallback if sprite missing/not loaded yet
      return '#ff6478';
    }
  }

  // --- Triangle burst VFX (style #3: mixed big + small shards) ----------------
  function spawnTriangleBurst(x, y, baseHex, opts={}){
    const big = opts.big || 6;
    const small = opts.small || 22;
    const total = big + small;

    const shards = [];
    for(let i=0;i<total;i++){
      const isBig = (i<big);
      const ang = Math.random()*Math.PI*2;
      const spd = (isBig? rand(420,560): rand(260,420));
      const rot = rand(-6,6);
      shards.push({
        x, y,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd,
        a: 1,
        vr: rot,
        rot: rand(0,Math.PI*2),
        r1: isBig? rand(10,16): rand(5,9), // triangle radius (size)
        r2: isBig? rand(8,12): rand(4,7),
        r3: isBig? rand(8,12): rand(4,7),
        col: baseHex
      });
    }
    ents.effects.push({ type:'triBurst', x, y, shards, life:0.7, t:0 });
  }

  // --- Ghost silhouette VFX (rises & fades, level accent color) ---------------
  function spawnGhostSilhouette(x, y, radius, accent){
    ents.effects.push({
      type:'ghost',
      x, y,
      r: radius,
      vy: -120,    // upward drift
      life: 0.9,
      t: 0,
      color: accent || '#ffffff'
    });
  }
  // Cosmic black hole: 50/50 teleport to a different void pit or instant kill.
  // Players/enemies can't predict the outcome. Cooldown prevents immediate re-trigger.
  function resolveVoid(entity, hz, dt, isPlayer) {
    if ((entity.voidCD || 0) > 0) return { done: false, killed: false };
    const teleport = (rand(0,1) < 0.5);   // deterministic
    if (teleport) {
      const holes = world.hazards.filter(h => h.type === 'void' && h !== hz);
      if (holes.length) {
        const tgt = holes[rint(0, holes.length-1)]; // deterministic
        const cx = tgt.x + tgt.w / 2, cy = tgt.y + tgt.h / 2;
        const a = rand(0, Math.PI * 2);             // deterministic
        const r = Math.min(tgt.w, tgt.h) * 0.22;
        entity.x = clamp(cx + Math.cos(a) * r, 30, world.w - 30);
        entity.y = clamp(cy + Math.sin(a) * r, 30, world.h - 30);
        entity.voidCD = 0.6;
        cam.shake = Math.max(cam.shake, 6);
        addEffect(entity.x, entity.y, 'pop', 0.35, '#bda6ff');
        return { done: true, killed: false };
      }
    }
    if (isPlayer) entity.hp = 0;
    return { done: true, killed: true };
  }
  
  function hurtPlayer(dmg){
    let left = dmg;

    // Earth Stone Skin: armour DR
    if (isPath('earth') && hasG('earth','stoneSkin')){
      const armour = 0.16 + (hasG('earth','rootedStance') && (Math.hypot(player.vx||0, player.vy||0) < 20) ? 0.10 : 0);
      left *= (1 - armour);
    }

    // Shield absorbs first
    if(player.shield>0){
      const used = Math.min(player.shield, left*0.8);
      player.shield -= used;
      left -= used;
    }

    // Earth Unbreakable / Fire Rebirth: intercept lethal once per wave
    const wouldDie = (player.hp - left) <= 0;

    if (wouldDie){
      if (isPath('earth') && hasG('earth','unbreakable') && !player._unbreakableUsed){
        player._unbreakableUsed = true;
        player.hp = 35;
        aoeDamage(player.x, player.y, 120, 16, { col:'#7dffa3', stun:0.25 });
        addEffect(player.x,player.y,'pop',0.35,'#7dffa3');
        cam.shake = Math.max(cam.shake, 8);
        audio.hurt();
        return;
      }

      if (isPath('fire') && hasG('fire','rebirth') && !player._rebirthUsed){
        player._rebirthUsed = true;
        player.hp = 40;
        // consume burn in a radius as burst
        aoeDamage(player.x, player.y, 150, 22, { col:'#ff6a2a', burn:true });
        addEffect(player.x,player.y,'pop',0.35,'#ff6a2a');
        cam.shake = Math.max(cam.shake, 9);
        audio.hurt();
        return;
      }
    }

    player.hp -= left;
    cam.shake = Math.max(cam.shake, 6);
    audio.hurt();
    if (player.hp < 0) player.hp = 0;
  }
  function showGameOver(){ ovPause.style.display='grid'; ovPause.querySelector('h2').textContent='💀 Game Over'; }

  window.addEventListener('pointerdown', ()=>{ try{audio.ctx?.resume?.();}catch(e){} if(audio.musicOn) audio.startMusic(); }, {once:true});
  state.running=false; updateHUD();

  
window.buildSkins = buildSkins;
window.buildGunsUI = buildGunsUI;
window.buildMeleeUI = buildMeleeUI;

  // ---- expose asset loaders for boot progress ----
window.__ASSETS__ = window.__ASSETS__ || {};
window.__ASSETS__.loadImages = loadImages;
window.__ASSETS__.loadGunImages = loadGunImages;
window.__ASSETS__.loadMelee = () => Melee.loadAll();
// ================================
// 📱 Mobile Dash & Melee Buttons
// ✅ MUST RUN AFTER DOM IS READY
// ================================
window.addEventListener('DOMContentLoaded', () => {

  if (!IS_MOBILE) return;

  const btnDash  = document.getElementById('btnDash');
  const btnMelee = document.getElementById('btnMelee');

  // DASH → same as Space key
  if (btnDash) {
    btnDash.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();

      input.key.Space = true;
      setTimeout(() => {
        input.key.Space = false;
      }, 40);
    }, { passive: false });
  }

  // MELEE
  if (btnMelee) {
    btnMelee.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (window.Melee && typeof Melee.tryAttack === 'function') {
        Melee.tryAttack();
      }
    }, { passive: false });
  }

});
// ===== DEBUG HOOKS =====
window.__dbg = {
  ents,
  state,

  // advance exactly one wave (natural progression)
  skipWave() {
    ents.enemies.length = 0;
    state.nextWaveT = 0;
  },

  // advance N waves naturally
  skipWaves(n = 1) {
    for (let i = 0; i < n; i++) {
      ents.enemies.length = 0;
      state.nextWaveT = 0;
    }
  },

  // HARD jump to an exact wave (offline only)
  gotoWave(n) {
    if (isNetActive()) {
      console.warn('gotoWave blocked: multiplayer active');
      return;
    }
    startWave(n);
  },
  spawnBossAtWave(wave) {
    // offline or testing only
    state.wave = wave;

    // remove existing enemies
    ents.enemies.length = 0;

    // spawn boss near player
    spawnEnemy(
      'boss',
      player.x + 200,
      player.y
    );

    console.log(`Boss spawned with wave=${wave}`);
  }
};

// ✅ PRELOAD ALL VISUAL ASSETS IMMEDIATELY
// ===== Glyph sprite preload =====
const GlyphImages = {
  fire: [new Image(), new Image(), new Image()],
  lightning: [new Image(), new Image(), new Image()],
  water: [new Image(), new Image(), new Image()],
  earth: [new Image(), new Image(), new Image()],
  spirit: [new Image(), new Image(), new Image()],
};

function loadGlyphImages() {
  const tasks = [];
  const set3 = (k, base) => {
    const arr = GlyphImages[k];
    for (let i = 0; i < 3; i++) {
      tasks.push(new Promise(res => {
        arr[i].onload = () => res();
        arr[i].onerror = () => res(); // don't crash if missing
        arr[i].src = `assets/glyphs/${base}/${base}${i+1}.png`;
      }));
    }
  };
  set3('fire', 'fire');
  set3('lightning', 'lightning');
  set3('water', 'water');
  set3('earth', 'earth');
  set3('spirit', 'spirit');
  return Promise.all(tasks);
}

// ✅ PRELOAD ALL VISUAL ASSETS IMMEDIATELY
(async () => {
  try {
    await loadImages();      // monsters
    await loadGunImages();   // guns
    await Melee.loadAll();   // melee
    await loadGlyphImages(); // glyphs
    console.log('[ASSETS] All sprites preloaded (monsters/guns/melee/glyphs)');
  } catch (e) {
    console.warn('[ASSETS] preload failed', e);
  }
})();
})();
