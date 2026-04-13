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
  const btnFire = document.getElementById('btnFire');
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
  function getVisualPlayerPos(){
    if (isNetActive()){
      const me = mySnapshotPlayer();
      if (me) return { x: me.x, y: me.y };
    }
    return { x: player.x, y: player.y };
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
  let currentTheme = LEVELS[0];
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

    // no tab value yet → generate one
    const d = Math.floor(Math.random() * 15); // 0–14
    sessionStorage.setItem('design', d);
    return d;
  }

  function getTabColor() {
    const v = sessionStorage.getItem('color');
    if (v !== null) return parseInt(v, 10);

    const c = Math.floor(Math.random() * COLORS.length);
    sessionStorage.setItem('color', c);
    return c;
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
      if (equip === 'melee') {
        Melee.use(melee);
        if (isNetActive()) {
          try { Net.state.sendEvent({ kind:'melee', ang: player.angle, x: player.x, y: player.y, t: Date.now() }); } catch {}
        }
      }
    }
    if(e.key.toLowerCase()==='r') playerTryReload();
    if(e.key===' ') playerDash();
  
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
    const meSnap = online ? mySnapshotPlayer() : null;

    // Use authoritative-me when online (prevents drift)
    const px = meSnap?.x ?? LS.visualMe?.x ?? player.x;
    const py = meSnap?.y ?? LS.visualMe?.y ?? player.y;
    // ✅ Use CSS viewport size (NOT canvas.width/height which are device pixels)
    const targetX = px - VIEW.w / 2;
    const targetY = py - VIEW.h / 2;

    cam.x = lerp(cam.x, targetX, 0.12);
    cam.y = lerp(cam.y, targetY, 0.12);
  }

  // Entities ------------------------------------------------------------------
  const ents = { bullets:[], ebullets:[], effects:[], enemies:[], pickups:[] };
  window._ents = ents;

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
  function playerDash(){ if(player.dashCD>0) return; const w=weapons[player.weapon]; const dash=w.dash*(1+(player.shield>0?0.15:0)); const ax=Math.cos(player.angle), ay=Math.sin(player.angle); player.x+=ax*dash; player.y+=ay*dash; player.x=clamp(player.x,60,world.w-60); player.y=clamp(player.y,60,world.h-60); cam.shake=Math.max(cam.shake,8); player.dashCD=1.4; player.dashI=0.15; audio.dash(); }
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
    shieldEl.textContent = Math.round(player.shield);

    // =========================
    // ✅ SPEED MULTIPLIER
    // =========================
    const slowMul = (player.slowT > 0) ? 0.7 : 1;
    spdEl.textContent = `${(player.spdMul * slowMul).toFixed(2)}x`;

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
  }
  function updateNetStatus(){
    const el = document.getElementById('netStatus');
    if (!el) return;

    el.className = 'net-status';
    if (!isNetActive()) el.classList.add('offline');
    else if (amHost()) el.classList.add('host');
    else el.classList.add('peer');
  }

  // Game state ----------------------------------------------------------------
  const state={
    running:false, wave:1, score:0,
    best:parseInt(localStorage.getItem('arenaBest')||'0',10)||0,
    spawnT:0, nextWaveT:0, diff:1.0,
    playerExploded:false
  };

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
      phaseCD: rand(0,0.8) + 0.4      // deterministic
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
  function startWave(n){ state.wave=n; state.spawnT=0; const base=6+Math.floor(n*1.5); let remaining=base; const c0=nav.cellFrom(player.x,player.y); nav.floodFrom(c0.ix, c0.iy);
    const pos=()=>{ const margin=120; for(let attempts=0; attempts<60; attempts++){ const x=rand(margin, world.w-margin), y=rand(margin, world.h-margin); if(dist2(x,y,player.x,player.y)<520*520) continue; if(world.isBlocked(x,y,20) || world.collideHazard(x,y,20)) continue; if(nav.isReachable(x,y)) return {x,y}; } return {x: clamp(player.x+800, margin, world.w-margin), y: clamp(player.y, margin, world.h-margin)}; };
    state.nextWaveT=2.0; const toSpawn=[]; const bossWave=(n%5===0); if(bossWave){ const p=pos(); toSpawn.push({t:1.5,type:'boss',...p}); remaining+=2; } for(let i=0;i<remaining;i++){ const p=pos(); toSpawn.push({t:rand(0.5,10), type:pickType(), ...p}); } spawnQueue=toSpawn.sort((a,b)=>a.t-b.t); }
  function pickType(){ const w = state.wave; let weights = { chaser:6, tank:1, shooter:1, sniper:0, bomber:0, healer:0 }; if (w>=2){ weights.tank+=1; weights.shooter+=1; } if (w>=3){ weights.sniper+=2; } if (w>=4){ weights.bomber+=2; } if (w>=5){ weights.healer+=1; } if (w>=6){ weights.tank+=2; weights.sniper+=2; } if (w>=8){ weights.bomber+=2; weights.healer+=1; } if (w>=10){ weights.sniper+=3; weights.bomber+=3; weights.healer+=2; } let pool=[]; for(const k in weights){ for(let i=0;i<weights[k]; i++) pool.push(k); } return pool[rint(0, pool.length-1)]; }

  // Shooting / collisions -----------------------------------------------------
  function playerShoot(){ 
    
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
    const { x: px0, y: py0 } = getVisualPlayerPos();

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
    const kill = lineWallHit(b.x, b.y, b.vx, b.vy, dt, b.r); 
    b.x += b.vx * dt; 
    b.y += b.vy * dt; 
    b.life -= dt; 
    if (kill || b.life <= 0){ 
    ents.bullets.splice(i,1); 
    continue; 
    } 
    // hit enemies 
    let hit = -1; 
    for (let j = 0; j < ents.enemies.length; j++){ 
    const e = ents.enemies[j]; 
    const r = e.r + b.r; 
    if (dist2(b.x,b.y,e.x,e.y) < r*r){ hit = j; break; } 
    } 
    if (hit >= 0) {
      // ✅ BULLET DAMAGE IS SERVER-AUTHORITATIVE
      // Client does NOT apply damage or send hits for bullets

      addEffect(b.x, b.y, 'hit', 0.15, '#fff');
      cam.shake = Math.max(cam.shake, 1.5);

      if (b.pierce > 0) b.pierce--;
      else ents.bullets.splice(i, 1);
    }
   } 

    // enemy bullets (move + expire) 
    for (let i = ents.ebullets.length - 1; i >= 0; i--){ 
    const b = ents.ebullets[i]; 
    b.x += b.vx * dt; 
    b.y += b.vy * dt; 
    b.life -= dt; 
    if (b.life <= 0){ 
    ents.ebullets.splice(i,1); 
    continue; 
    } 
    if (lineWallHit(b.x,b.y,b.vx,b.vy,0,b.r)){ 
    ents.ebullets.splice(i,1); 
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
  const touch = { idL:null, init(){ const rel=(el,e)=>{ const r=el.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }; stickL.addEventListener('touchstart', e=>{ e.preventDefault(); for(const t of e.changedTouches){ if(!this.idL){ const p=rel(stickL,t); if(p.x>=0&&p.y>=0&&p.x<=stickL.clientWidth&&p.y<=stickL.clientHeight){ this.idL=t.identifier; } } } }, {passive:false}); stickL.addEventListener('touchmove', e=>{ e.preventDefault(); for(const t of e.changedTouches){ if(t.identifier===this.idL){ const r=stickL.getBoundingClientRect(); const x=t.clientX-(r.left+r.width/2), y=t.clientY-(r.top+r.height/2), m=Math.hypot(x,y), lim=44; const nx=(m>lim? x/m*lim:x), ny=(m>lim? y/m*lim:y); nubL.style.transform=`translate(${nx}px,${ny}px)`; input.touch.stick.dx=nx/lim; input.touch.stick.dy=ny/lim; input.touch.stick.active=true; } } }, {passive:false}); stickL.addEventListener('touchend', e=>{ e.preventDefault(); for(const t of e.changedTouches){ if(t.identifier===this.idL){ this.idL=null; input.touch.stick={dx:0,dy:0,active:false}; nubL.style.transform='translate(0px,0px)'; } } }, {passive:false}); btnFire.addEventListener('touchstart', e=>{ e.preventDefault(); input.touch.fire=true; }, {passive:false}); btnFire.addEventListener('touchend', e=>{ e.preventDefault(); input.touch.fire=false; }, {passive:false}); btnSwap.addEventListener('touchstart', e=>{ e.preventDefault(); swapWeapon(1); }, {passive:false}); } };
  touch.init();

  // Settings ------------------------------------------------------------------
  function loadSettings(){ selDiff.value=store.read('diff','1.0'); selSfx.value=store.read('sfx','1'); selMusic.value=store.read('music','1'); rngSens.value=store.read('sens','1.0'); rngUI.value=store.read('ui','1.0'); sensVal.textContent=`${parseFloat(rngSens.value).toFixed(2)}x`; uiVal.textContent=`${Math.round(parseFloat(rngUI.value)*100)}%`; state.diff=parseFloat(selDiff.value); audio.sfxOn=selSfx.value==='1'; audio.musicOn=selMusic.value==='1'; setUIOpacity(parseFloat(rngUI.value)); if(audio.musicOn) audio.startMusic(); else audio.stopMusic(); }
  function saveSettings(){ store.write('diff',selDiff.value); store.write('sfx',selSfx.value); store.write('music',selMusic.value); store.write('sens',rngSens.value); store.write('ui',rngUI.value); sensVal.textContent=`${parseFloat(rngSens.value).toFixed(2)}x`; uiVal.textContent=`${Math.round(parseFloat(rngUI.value)*100)}%`; state.diff=parseFloat(selDiff.value); audio.sfxOn=selSfx.value==='1'; audio.musicOn=selMusic.value==='1'; setUIOpacity(parseFloat(rngUI.value)); if(audio.musicOn) audio.startMusic(); else audio.stopMusic(); }
  rngSens.oninput=()=> sensVal.textContent=`${parseFloat(rngSens.value).toFixed(2)}x`;
  rngUI.oninput=()=> setUIOpacity(parseFloat(rngUI.value));
  function setUIOpacity(v){ uiVal.textContent=`${Math.round(v*100)}%`; document.querySelectorAll('.hud,.corner,.help,.minimap').forEach(el=> el.style.opacity=String(v)); }
  function showOverlay(el,show){ el.style.display=show?'grid':'none'; if(el===ovSettings && !show) saveSettings(); if(show) togglePause(true); else canvas.focus(); }
  function togglePause(force){ const on=typeof force==='boolean'?force:!state.running; state.running=!on; ovPause.style.display=on?'grid':'none' 
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
      return; // 🚨 stop updateFixed immediately
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
  if(on) audio.stopMusic(); else if(audio.musicOn) audio.startMusic(); }
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

      // pick deterministic seed

      // if online, tell server which level everyone should use
      if (window.Net && Net.state && Net.state.lobbyId) {
        await Net.setLevel(theme.id);
      }

      // show joining overlay
      const ovLoad = document.getElementById('overlayLoading');
      const text   = document.getElementById('loadingText');
      if (ovLoad) ovLoad.style.display = 'grid';

      const deadline = Net?.state?.meta?.joinDeadline || (Date.now() + 1500);

      const tick = () => {
        const secs = Math.max(0, Math.ceil((deadline - Date.now())/1000));
        if (text) text.textContent = `Joining lobby… starting in ${secs}s`;
        if (secs <= 0) {
          ovLoad.style.display = 'none';
          document.getElementById('overlayHome').style.display = 'none';
          document.getElementById('btnRestart')?.click();
        } else setTimeout(tick, 250);
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

 
window.addEventListener('net:snapshot', () => {
  const snap = Net?.state?.snapshot;
  if (!snap || !Array.isArray(snap.players)) return;


  renderLobbyPlayers();


    if (!snap) return;

    // ✅ Multiplayer PvE progression
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
    if (online) {
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


    const sens = parseFloat(rngSens.value || '1');
    const mx_css = input.mouse.x, my_css = input.mouse.y;

    // Mouse screen → world (same space your world is drawn in)
    const aimX = cam.x + cam.sx + mx_css;
    const aimY = cam.y + cam.sy + my_css;

    // ✅ Compute angle from the SAME position you render the player at
    const { x: ax, y: ay } = getVisualPlayerPos();

    player.angle = lerpAngle(
      player.angle,
      angleTo(ax, ay, aimX, aimY),
      0.28 * sens
    );
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

    if (online) {
      Net.sendInput(dx, dy, player.angle, player.x, player.y, player.weapon);
    }

    
    // Always allow local fire; when online, also broadcast a 'shot' event for VFX
    if (input.mouse.down || input.touch.fire) {
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

          const idKey = e.id ?? e;           // snapshot enemies have e.id; local use object
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
            e.hp -= DMG;
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

      if (spawnQueue.length === 0 && ents.enemies.length === 0) {
        state.nextWaveT -= dt;
        if (state.nextWaveT <= 0) {
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

        // AI tick
        if (!isNetActive() || !Net.state.snapshot) {
          enemyBehavior(e, dt);
        }
        e.voidCD = Math.max(0, (e.voidCD || 0) - dt);

        // Body collision with player
        const d2 = dist2(e.x, e.y, player.x, player.y);
        const rr = e.r + player.r;
        if (d2 < rr * rr) {
          const dmg = ( e.type==='tank'?22
                      : e.type==='boss'?30
                      : e.type==='swarm'?6
                      : e.type==='healer'?0
                      : e.type==='bomber'?8
                      : 12 ) * state.diff;
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

        // Death & loot
        if (e.hp <= 0) {
          let sc = 10;
          if (e.type==='tank')    sc = 28;
          if (e.type==='shooter') sc = 18;
          if (e.type==='swarm')   sc = 6;
          if (e.type==='boss')    sc = 320;

          state.score += sc;
          if (Math.random() < 0.15 || e.type === 'boss') dropPickup(e.x, e.y);

          const baseCol = sampleSpriteColor(e.type);
          spawnTriangleBurst(e.x, e.y, baseCol, { big:6, small:22 });
          spawnGhostSilhouette(e.x, e.y, e.r + 10, currentTheme.accent);

          ents.enemies.splice(i, 1);
          audio.hit();
          continue; // <-- legal here
        }
      }
    }

    for (let i = ents.bullets.length - 1; i >= 0; i--){ const b = ents.bullets[i]; const kill = lineWallHit(b.x, b.y, b.vx, b.vy, dt, b.r); b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (kill || b.life <= 0){ ents.bullets.splice(i,1); continue; } let hit = -1; for (let j = 0; j < ents.enemies.length; j++){ const e = ents.enemies[j]; const r = e.r + b.r; if (dist2(b.x,b.y,e.x,e.y) < r*r){ hit = j; break; } } if (hit >= 0){ const e = ents.enemies[hit]; e.hp -= b.dmg * (1 + state.wave * 0.02); addEffect(b.x,b.y,'hit',0.15,'#fff'); cam.shake = Math.max(cam.shake,1.5); if (b.pierce > 0) b.pierce--; else ents.bullets.splice(i,1); e.alerted = true; e.alertT = Math.max(e.alertT, 3); broadcastAlertFrom(e.x,e.y); } }

    for (let i = ents.ebullets.length - 1; i >= 0; i--){ const b = ents.ebullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (b.kind === 'bomb'){ const hitWall = lineWallHit(b.x, b.y, b.vx, b.vy, 0, b.r); const timeUp=(b.life<=0); if (hitWall || timeUp){ const R=(b.splashR||110)+player.r; if(dist2(b.x,b.y,player.x,player.y) < R*R){ hurtPlayer(b.dmg); addEffect(b.x,b.y,'hit',0.12,'#ffd7d7'); } addEffect(b.x,b.y,'pop',0.55,'#ffb38a'); cam.shake=Math.max(cam.shake,5); ents.ebullets.splice(i, 1); continue; } continue; } if (lineWallHit(b.x,b.y,b.vy,b.vx,0,b.r) || b.life <= 0){ ents.ebullets.splice(i,1); continue; } const r = player.r + b.r; if (dist2(b.x,b.y,player.x,player.y) < r*r){ if (currentTheme.id === 3) player.slowT = Math.max(player.slowT, 1.6); hurtPlayer(b.dmg); addEffect(b.x,b.y,'hit',0.1,'#ffd7d7'); ents.ebullets.splice(i,1); } }

    for (let i = ents.pickups.length - 1; i >= 0; i--){ const p = ents.pickups[i]; p.t += dt; const r = player.r + p.r; if (dist2(p.x,p.y,player.x,player.y) < r*r){ switch(p.type){ case 'health': player.hp = Math.min(player.hpMax, player.hp + 35); break; case 'speed': player.spdMul = clamp(player.spdMul + 0.15, 1, 1.7); break; case 'shield': player.shield = clamp(player.shield + 35, 0, 120); break; case 'ammo': player.reserve += 24; break; } addEffect(p.x,p.y,'pop',0.4,'#aef'); audio.pickup(); ents.pickups.splice(i,1);} }

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

    if (e.t >= e.life) ents.effects.splice(i, 1);
  }

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
    updateHUD();    
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
  }
  
  const SPRITE_ROT_OFF = {
    pistol:  0,
    rifle:   0,
    shotgun: +Math.PI * 2
  };


  function draw(dt) {
    const online = isNetActive();
    const snap = online ? (Net.state && Net.state.snapshot) : null;

    const drawEnemies =
      (online && snap && Array.isArray(snap.enemies))
        ? snap.enemies
        : ents.enemies;

    // World layers
    // Floor does not need 60Hz redraw
   
    // World layers (floor + obstacles must stay in sync)
    if ((SIM_TICK & 3) === 0) {
      world.drawFloor();
      world.drawHazards();
      if (!isNetActive() || HAS_SERVER_WORLD) {
        world.drawObstacles();
      }
    }


    // ---------------------------
    // Pickups (local-only visuals)
    // ---------------------------
    for (const p of ents.pickups) {
      const t = (Math.sin((p.t ?? 0) * 6) + 1) / 2;
      const col =
        p.type === 'health' ? '#7dffa3' :
        p.type === 'speed'  ? '#9cf' :
        p.type === 'shield' ? '#7af' : '#ffd166';

      ctx.fillStyle = col;
      ctx.strokeStyle = '#fff2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x - cam.x - cam.sx, p.y - cam.y - cam.sy, p.r + t * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // ---------------------------
    // ✅ Bullets (authoritative online)
    // ---------------------------
    const allBullets =
      (online && snap && Array.isArray(snap.bullets))
        ? snap.bullets
        : ents.bullets;

    // Player bullets
    ctx.fillStyle = '#cfe5ff';
    for (const b of allBullets) {
      const isEnemy =
        (typeof b.owner === 'string' && b.owner.startsWith('E:')) ||
        b.kind === 'enemy' ||
        b.kind === 'enemyBomb';

      if (isEnemy) continue;

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

    // Enemy bullets / bombs
    ctx.fillStyle = '#ffadad';
    for (const b of allBullets) {
      const isEnemy =
        (typeof b.owner === 'string' && b.owner.startsWith('E:')) ||
        b.kind === 'enemy' ||
        b.kind === 'enemyBomb';

      if (!isEnemy) continue;

      const rad = (b.kind === 'enemyBomb') ? 7 : (b.r ?? 4);

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
    if (online && Net.state?.snapshot?.players) {
      const myId = Net.state.peerId;

      for (const rp of Net.state.snapshot.players) {
        if (!rp || rp.id === myId) continue;

        const px = rp.x - cam.x - cam.sx;
        const py = rp.y - cam.y - cam.sy;

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
        ctx.rotate(rp.ang ?? 0);
        
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
    }

    // ---------------------------
    // Local player
    // ---------------------------
    {
      const meSnap = online ? mySnapshotPlayer() : null;
      const lx = meSnap ? meSnap.x : player.x;
      const ly = meSnap ? meSnap.y : player.y;

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
    }

    // ---------------------------
    // Chests, minimap, HUD
    // ---------------------------
    world.drawChests();
    if ((SIM_TICK & 3) === 0) {
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
  
  function hurtPlayer(dmg){ let left=dmg; if(player.shield>0){ const used=Math.min(player.shield, left*0.8); player.shield-=used; left-=used; } player.hp-=left; cam.shake=Math.max(cam.shake,6); audio.hurt(); if(player.hp<0) player.hp=0; }
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

// ✅ PRELOAD ALL VISUAL ASSETS IMMEDIATELY
(async () => {
  try {
    await loadImages();        // monsters
    await loadGunImages();     // guns
    await Melee.loadAll();     // melee
    console.log('[ASSETS] All sprites preloaded');
  } catch (e) {
    console.warn('[ASSETS] preload failed', e);
  }
})();
})();