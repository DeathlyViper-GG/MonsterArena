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
  document.getElementById('resumeBtn')?.addEventListener('click', () => togglePause(false));
  document.getElementById('restartBtn2')?.addEventListener('click', () => restart());
  document.getElementById('homeBtn2')?.addEventListener('click', () => goHome());
  document.getElementById('settingsBtn2')?.addEventListener('click', () => showOverlay(ovSettings,true));
  document.getElementById('helpBtn2')?.addEventListener('click', () => showOverlay(ovHelp,true));
  document.getElementById('closeHelp')?.addEventListener('click', () => showOverlay(ovHelp,false));
  document.getElementById('closeSettings')?.addEventListener('click', () => { saveSettings(); showOverlay(ovSettings,false); });
  document.getElementById('homeHelp')?.addEventListener('click', () => showOverlay(ovHelp,true));
  document.getElementById('homeSettings')?.addEventListener('click', () => showOverlay(ovSettings,true));
  btnHomeCustomize.onclick = () => { buildSkins(); showOverlay(ovCustomize,true); };
  document.getElementById('closeCustomize').onclick = () => { store.write('design', selectedDesign); store.write('color', selectedColor); showOverlay(ovCustomize,false); };

  btnPause.onclick = () => togglePause();
  btnRestart.onclick = () => restart();
  btnHome.onclick = () => goHome();
  btnHelp.onclick = () => showOverlay(ovHelp, true);
  btnSettings.onclick = () => showOverlay(ovSettings, true);

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
  function isNetActive() {
    return !!(window.Net && Net.state && Net.state.myId);
  }
  function hasFreshSnapshot(maxAgeMs = 1200) {
    const s = (window.Net && Net.state && Net.state.snapshot) ? Net.state.snapshot : null;
    if (!s || !s.t) return false;
    return (Date.now() - s.t) <= maxAgeMs;
  }

  function mySnapshotPlayer() {
    const s = window.Net?.state?.snapshot;
    if (!s || !Array.isArray(s.players)) return null;
    const me = s.players.find(p => p.id === window.Net.state.myId);
    return me || null;
  }

  function handleAuthoritativeDeath(){
    state.running = false;
    input.keys.clear();
    input.mouse.down = false;
    input.touch.fire = false;
    input.touch.stick.active = false;

    // Clear local visuals
    ents.bullets.length = 0;
    ents.effects.length = 0;
    ents.pickups.length = 0;

    ovPause.style.display = 'none';
    ovHome.style.display = 'grid';
    audio.stopMusic();
    updateHUD();
  }
  function getGlobalBestWave() {
    let best = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      // Stored by PvE per level
      if (k.startsWith('arenaBestWave_')) {
        const v = parseInt(localStorage.getItem(k), 10);
        if (!isNaN(v)) best = Math.max(best, v);
      }
    }

    return best;
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
  let selectedDesign = parseInt(store.read('design', 0),10) || 0;
  let selectedColor  = parseInt(store.read('color', 0),10)  || 0;
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
          const ch = {
            id: this.chests.length,
            x:cx, y:cy, r:16, opened:false, buildingIndex:i 
          };
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
      const g = ctx.createLinearGradient(0,0,0,canvas.height);
      g.addColorStop(0, currentTheme.floor.c1); g.addColorStop(1, currentTheme.floor.c2);
      ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);
      const grid=64, ox=-((cam.x+cam.sx)%grid), oy=-((cam.y+cam.sy)%grid);
      ctx.strokeStyle=currentTheme.floor.grid; ctx.lineWidth=1; ctx.beginPath();
      for(let x=ox; x<canvas.width; x+=grid){ ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
      for(let y=oy; y<canvas.height; y+=grid){ ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); }
      ctx.stroke();
      const vg = ctx.createRadialGradient(canvas.width/2, canvas.height/2, Math.min(canvas.width,canvas.height)/3,
                                          canvas.width/2, canvas.height/2, Math.max(canvas.width,canvas.height)/1.1);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.35)');
      ctx.fillStyle=vg; ctx.fillRect(0,0,canvas.width,canvas.height);
    },
    drawHazards(){
      const t = performance.now()/1000;
      for(const hz of this.hazards){
        const x=hz.x - cam.x - cam.sx, y=hz.y - cam.y - cam.sy;
        if(hz.type==='lava') {
          
          const cx = x + hz.w/2, cy = y + hz.h/2;

          // Rendering-only delta (draw loop has no dt)
          const dt2 = 1/60;

          // Initialize geyser cycle
          hz.phase = hz.phase || 'idle';   // idle → warn → erupt → after
          hz.timer = hz.timer || 0;
          hz.timer += dt2;

          // Timings
          const idleTime  = 1.4;
          const warnTime  = 1.0;
          const eruptTime = 0.35;
          const afterTime = 2.5;

          // Cycle transitions
          if (hz.phase === 'idle'  && hz.timer >= idleTime)  { hz.phase='warn';  hz.timer=0; }
          else if (hz.phase === 'warn'  && hz.timer >= warnTime)  { hz.phase='erupt'; hz.timer=0; }
          else if (hz.phase === 'erupt' && hz.timer >= eruptTime) { hz.phase='after'; hz.timer=0; }
          else if (hz.phase === 'after' && hz.timer >= afterTime) { hz.phase='idle';  hz.timer=0; }

          // === RENDERING ===

          if (hz.phase === 'idle') {
            const g = ctx.createLinearGradient(0,y,0,y+hz.h);
            g.addColorStop(0,'#2a1a12');
            g.addColorStop(1,'#1a0e08');
            ctx.fillStyle = g;
            ctx.fillRect(x,y,hz.w,hz.h);

          } else if (hz.phase === 'warn') {
            const pulse = hz.timer / warnTime;
            ctx.fillStyle = `rgba(255,120,40,${0.2 + pulse*0.5})`;
            ctx.fillRect(x,y,hz.w,hz.h);

            // growing pulse circle
            ctx.save();
            ctx.translate(cx,cy);
            ctx.strokeStyle = `rgba(255,200,80,${0.4 + pulse*0.4})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0,0, Math.min(hz.w,hz.h)*0.3*pulse, 0, Math.PI*2);
            ctx.stroke();
            ctx.restore();

          } else if (hz.phase === 'erupt') {
            // bright vertical geyser
            const g = ctx.createLinearGradient(cx, cy-hz.h*1.2, cx, cy);
            g.addColorStop(0,'#ffffff');
            g.addColorStop(0.3,'#ffd766');
            g.addColorStop(1,'#ff6a00');
            ctx.fillStyle = g;

            ctx.save();
            ctx.translate(cx,cy);
            ctx.beginPath();
            ctx.ellipse(0,0, hz.w*0.45, hz.h*1.25, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();

          } else if (hz.phase === 'after') {
            // Scorched DoT zone
            ctx.fillStyle = '#3a1a0a';
            ctx.fillRect(x,y,hz.w,hz.h);

            // lava flecks
            ctx.fillStyle = 'rgba(255,120,40,0.7)';
            for (let i=0;i<20;i++){
              const fx = x + Math.random()*hz.w;
              const fy = y + Math.random()*hz.h;
              ctx.fillRect(fx, fy, 3, 3);
            }
          }

          // outline
          ctx.strokeStyle='#ff7a6644';
          ctx.lineWidth=2;
          ctx.strokeRect(x+1,y+1,hz.w-2,hz.h-2);

          
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
        const ch=this.chests[i]; if(ch.opened) continue;
        const b=this.buildings[ch.buildingIndex];
        if(!pointInRect(player.x,player.y,b.inner)) continue;
        const x=ch.x - cam.x - cam.sx, y=ch.y - cam.y - cam.sy;
        ctx.save(); ctx.translate(x,y);
        ctx.fillStyle='#6b4a1a'; roundRect(ctx,-14,-10,28,20,4); ctx.fill();
        ctx.fillStyle='#9c6a2a'; roundRect(ctx,-12,-8,24,16,3); ctx.fill();
        ctx.strokeStyle='#e5c26a'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(8,0); ctx.stroke();
        ctx.restore();
      }
    }
  };
  function roundRect(c,x,y,w,h,r){ const rr=Math.max(0, Math.min(r, Math.min(w,h)/2)); c.beginPath(); c.moveTo(x+rr,y); c.arcTo(x+w,y,x+w,y+h,rr); c.arcTo(x+w,y+h,x,y+h,rr); c.arcTo(x,y+h,x,y,rr); c.arcTo(x,y,x+w,y,rr); c.closePath(); }
  const pointInRect=(px,py, r)=> px>=r.x && px<=r.x+r.w && py>=r.y && py<=r.y+r.h;

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
    if(e.key==='Escape') togglePause();
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
  function resize(){ const dpr=Math.max(1, window.devicePixelRatio||1); canvas.width=Math.floor(window.innerWidth*dpr); canvas.height=Math.floor(window.innerHeight*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); }
  window.addEventListener('resize', resize); resize();

  // Camera --------------------------------------------------------------------
  const cam = { x:0, y:0, shake:0, sx:0, sy:0 };
  function updateCamera(dt){
    const targetX = player.x - canvas.width / 2;
    const targetY = player.y - canvas.height / 2;
    cam.x = lerp(cam.x, targetX, 0.12);
    cam.y = lerp(cam.y, targetY, 0.12);
  }

  // Entities ------------------------------------------------------------------
  const ents = { bullets:[], effects:[], pickups:[] };

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
  function updateHUD(){ hpFill.style.width=`${(player.hp/player.hpMax)*100}%`; if(equip==='melee'){ ammoFill.style.width='0%'; ammoText.textContent='—'; weaponName.textContent=`Melee: ${melee?.name ?? '—'}`; } else { const w=weapons[player.weapon]; ammoFill.style.width=`${(player.ammo/w.ammo)*100}%`; ammoText.textContent=`${player.ammo} / ${player.reserve}`; weaponName.textContent=w.name; } shieldEl.textContent=player.shield.toFixed(0); spdEl.textContent=`${(player.spdMul*(player.slowT>0?0.7:1)).toFixed(2)}x`; lvlEl.textContent=currentTheme ? `${currentTheme.id} — ${currentTheme.name}` : '—'; }

  // Game state ----------------------------------------------------------------
  const state={
    running:false,
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
  loadImages();
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
 loadGunImages();
 // === MELEE ================================================================
  // 1) Preload all melee sprites (common/rare/epic/legendary/god)
  Melee.loadAll();

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
  function drawDesign(designId, bodyColor, t){ ctx.fillStyle = bodyColor; ctx.beginPath(); ctx.arc(0,0, player.r, 0, Math.PI*2); ctx.fill(); switch(designId){ case 0: ctx.strokeStyle = bodyColor+'aa'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0, player.r+3+Math.sin(t*4), 0, Math.PI*2); ctx.stroke(); break; case 1: ctx.strokeStyle='#ff6478aa'; ctx.lineWidth=3; for(let i=0;i<10;i++){ const a=i*(Math.PI*2/10)+t*1.2; ctx.beginPath(); ctx.moveTo(Math.cos(a)*(player.r+2), Math.sin(a)*(player.r+2)); ctx.lineTo(Math.cos(a)*(player.r+10), Math.sin(a)*(player.r+10)); ctx.stroke(); } break; case 2: ctx.fillStyle='#1b1120aa'; for(let i=0;i<8;i++){ const a=i*(Math.PI*2/8)+t*1.5; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*(player.r+2), Math.sin(a)*(player.r+2)); ctx.lineTo(Math.cos(a+0.2)*(player.r+6), Math.sin(a+0.2)*(player.r+6)); ctx.fill(); } break; case 3: ctx.strokeStyle='#5b7faaaa'; ctx.lineWidth=2; for(let i=0;i<6;i++){ const a=i*(Math.PI*2/6)+t*0.6; ctx.beginPath(); for(let j=0;j<6;j++){ const aa=a+j*(Math.PI*2/6); const rr=player.r+6; const x=Math.cos(aa)*rr, y=Math.sin(aa)*rr; if(j===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.closePath(); ctx.stroke(); } break; case 4: ctx.strokeStyle='#9cf'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0, player.r+10, t, t+Math.PI*1.4); ctx.stroke(); break; case 5: ctx.fillStyle='rgba(192,102,255,0.28)'; for(let i=0;i<12;i++){ const a=i*(Math.PI*2/12)+Math.sin(t*2)*0.2; ctx.beginPath(); ctx.ellipse(Math.cos(a)*(player.r+2), Math.sin(a)*(player.r+2), 6+Math.sin(t*4+i)*2, 12, a, 0, Math.PI*2); ctx.fill(); } break; case 6: ctx.fillStyle='#aef'; for(let i=0;i<6;i++){ const a=i*(Math.PI*2/6)+t*1.0; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(player.r+4,0); ctx.lineTo(player.r+14,-5); ctx.lineTo(player.r+18,0); ctx.lineTo(player.r+14,5); ctx.closePath(); ctx.fill(); ctx.restore(); } break; case 7: ctx.strokeStyle='#7dffa3'; ctx.lineWidth=3; for(let i=0;i<3;i++){ const a=t*2+i*2.09; ctx.beginPath(); ctx.moveTo(Math.cos(a)*player.r, Math.sin(a)*player.r); ctx.lineTo(Math.cos(a)*(player.r+16), Math.sin(a)*(player.r+16)); ctx.stroke(); } break; case 8: ctx.fillStyle='#ff9a3caa'; for(let s of [-1,1]){ ctx.beginPath(); ctx.ellipse(s*(player.r+4), -6, 6, 10, 0.3*s, 0, Math.PI*2); ctx.fill(); } break; case 9: ctx.fillStyle='#e8eefb'; for(let i=0;i<3;i++){ const a=t*3+i*(Math.PI*2/3); ctx.save(); ctx.rotate(a); ctx.fillRect(player.r*0.2, -3, 18, 6); ctx.restore(); } break; case 10: drawWing('angel', t); break; case 11: drawWing('cyber', t); break; case 12: drawWing('void',  t); break; case 13: drawWing('fire',  t); break; case 14: drawWing('insect',t); break; } }

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
      card.onclick = () => { selectedDesign = d.id; store.write('design', selectedDesign); buildSkins(); };
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
        sw.onclick = ()=>{ selectedColor = idx; store.write('color', selectedColor); buildSkins(); };
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

function bestScore(){
  const best = state?.best || parseInt(localStorage.getItem('arenaBest')||'0',10) || 0;
  return best;
}

const UNLOCK_GUN_WAVE = {
  pistol:  [2, 5, 10, 15, 20],
  rifle:   [5, 10, 15, 20, 25],
  shotgun: [10, 15, 20, 25, 30]
};

function buildGunsUI(){
  const bw = getGlobalBestWave();

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
          if (kind==='pistol'){ pistolIndex = idx; store.write('pistolIndex', idx); }
          if (kind==='rifle'){  rifleIndex  = idx; store.write('rifleIndex',  idx); }
          if (kind==='shotgun'){shotgunIndex= idx; store.write('shotgunIndex',idx); }
          makeGrid(gridId, kind, idx);
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

  

  

  

  // Bullets / effects / pickups / chests -------------------------------------
  function spawnBullet(x,y,a, speed,dmg,pierce=0){ ents.bullets.push({x,y,vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, r:4, dmg, life:1.2, pierce}); }
  function addEffect(x,y,type,life=0.4,color='#9cf'){ ents.effects.push({x,y,type,life,color,t:0,r:6}); }
  function dropPickup(x,y, forcedType=null){
    const opts=['health','speed','shield','ammo'];
    const type = forcedType || opts[rint(0,opts.length-1)];
    ents.pickups.push({x,y,r:10,type,t:0});
  }
  function openChest(ch, remoteDrops=null){
    if (ch.opened) return;
    ch.opened = true;
    audio.chest();

    const drops = remoteDrops || (() => {
      const opts=['health','speed','shield','ammo'];
      const n = rint(2,3);
      const out=[];
      for(let i=0;i<n;i++){
      const a = rand(0,Math.PI*2);
      const d = rand(18,36);
      out.push({
        x: ch.x + Math.cos(a)*d,
        y: ch.y + Math.sin(a)*d,
        type: opts[rint(0,opts.length-1)]
      });
      }
      return out;
    })();

    for (const d of drops) dropPickup(d.x, d.y, d.type);

    if (!remoteDrops && isNetActive()) {
      Net.state.sendEvent({
      kind:'chest_open',
      id: ch.id,
      drops,
      t: Date.now()
      });
    }
    }
  function respawnCollectedChests(){ const freeBuildings = []; for(let i=0;i<world.buildings.length;i++){ if(!world.buildings[i].hasChest) freeBuildings.push(i); } for(let i=0;i<world.chests.length;i++){ const ch = world.chests[i]; if(!ch.opened) continue; const prevIdx=ch.buildingIndex; world.buildings[prevIdx].hasChest=false; const candidates = freeBuildings.filter(idx=> idx!==prevIdx); if(candidates.length===0) continue; const newIdx = candidates[rint(0,candidates.length-1)]; freeBuildings.splice(freeBuildings.indexOf(newIdx),1); const b = world.buildings[newIdx]; const pad=28; let tries=0, cx, cy; do{ cx=rand(b.inner.x+pad, b.inner.x+b.inner.w-pad); cy=rand(b.inner.y+pad, b.inner.y+b.inner.h-pad); tries++; } while(tries<30 && world.collideHazard(cx,cy,16)); ch.x=cx; ch.y=cy; ch.r=16; ch.opened=false; ch.buildingIndex=newIdx; b.hasChest=true; } }

  // Waves & progressive difficulty -------------------------------------------

  // Shooting / collisions -----------------------------------------------------
  function playerShoot(){
    if (equip === 'melee') {
      if (meleeCooldown > 0) return;
      if (melee && melee.state !== 'using'){
        Melee.use(melee);
        audio.hit();
        meleeCooldown = 0.5;
      }
      return;
    }

    const w = weapons[player.weapon];
    const t = nowMS()/1000;
    const interval = 1/(w.rof*(player.reloading ? 0.6 : 1));
    if (t - player.lastShot < interval) return;
    if (player.reloading) return;

    if (player.ammo <= 0){
      playerTryReload();
      return;
    }

    player.lastShot = t;
    player.ammo--;

    const base = player.angle;

    // ✅ ONLINE: server authoritative bullets
    if (isNetActive()){
      for (let i = 0; i < w.shots; i++){
        const a = base + rand(-w.spread, w.spread);
        Net.sendShoot(
          player.x + Math.cos(a) * player.r,
          player.y + Math.sin(a) * player.r,
          a,
          w.speed,
          w.dmg
        );
      }
      addEffect(
        player.x + Math.cos(base) * player.r,
        player.y + Math.sin(base) * player.r,
        'muzzle', 0.1, '#fff'
      );
      cam.shake = Math.max(cam.shake, 4*w.recoil);
      if (w.name === 'Shotgun') audio.shotgun(); else audio.shoot();
      return;
    }

    // ✅ OFFLINE: local bullets
    for (let i = 0; i < w.shots; i++){
      const a = base + rand(-w.spread, w.spread);
      spawnBullet(
        player.x + Math.cos(a) * player.r,
        player.y + Math.sin(a) * player.r,
        a,
        w.speed,
        w.dmg,
        w.pierce
      );
    }

    addEffect(
      player.x + Math.cos(base) * player.r,
      player.y + Math.sin(base) * player.r,
      'muzzle', 0.1, '#fff'
    );
    cam.shake = Math.max(cam.shake, 4*w.recoil);
    if (w.name === 'Shotgun') audio.shotgun(); else audio.shoot();
  }
  function lineWallHit(px,py,vx,vy, dt, r){ const nx=px+vx*dt, ny=py+vy*dt; for(const o of world.walls){ const cx=clamp(nx,o.x,o.x+o.w), cy=clamp(ny,o.y,o.y+o.h); const dx=nx-cx, dy=ny-cy; if(dx*dx+dy*dy < r*r) return true; } return false; }
  function stepProjectiles(dt){
    // ✅ PvP: bullets are 100% server-authoritative
    if (isNetActive() && Net.state?.meta?.mode === 'pvp') {
      return;
    }
    // ✅ ONLINE: server owns bullets + damage; client does not simulate
    if (isNetActive()){
      for (let i = ents.effects.length - 1; i >= 0; i--){
        const e = ents.effects[i];
        e.t += dt;
        if (e.t >= e.life) ents.effects.splice(i, 1);
      }
      return;
    }

    // OFFLINE: move bullets locally
    for (let i = ents.bullets.length - 1; i >= 0; i--){
      const b = ents.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.life <= 0 || lineWallHit(b.x, b.y, b.vx, b.vy, 0, b.r)){
        ents.bullets.splice(i,1);
        continue;
      }
    }

    // effects cleanup
    for (let i = ents.effects.length - 1; i >= 0; i--){
      const e = ents.effects[i];
      e.t += dt;
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
      showGameOver(); 
      return;
  }
  ovPause.querySelector('h2').textContent = '⏸️ Paused'; 
  if(on) audio.stopMusic(); else if(audio.musicOn) audio.startMusic(); }
  function goHome(){ state.running=false; ovPause.style.display='none'; ovHome.style.display='grid'; if(audio.musicOn) audio.startMusic(); }

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
    state.playerExploded = false;

    // Clear world and queues
    
    ents.bullets = [];
    ents.effects = [];
    ents.pickups = [];
    noiseEvents.length = 0;

    const c0 = nav.cellFrom(player.x, player.y);
    nav.floodFrom(c0.ix, c0.iy);

    // If multiplayer is NOT active, spawn the first wave locally

    // 👇 IMPORTANT: actually start the simulation
    ovHome.style.display = 'none';
    ovPause.style.display = 'none';
    state.running = true;                     // ← lets update() run
    if (audio.musicOn) audio.startMusic();
    canvas.focus();
  }
  function applyTheme(theme){
    // ❌ NEVER allow local map builds in multiplayer
    if (isNetActive()) return;

    currentTheme = theme;
    state.diff = parseFloat(selDiff.value || '1.0');
    lvlEl.textContent = `${currentTheme.id} — ${currentTheme.name}`;

    world.buildObstacles();
    world.buildHazards();
    world.buildChests();
    nav.rebuild();
  }
  function applyNetMap(meta){
    if (!meta) return;

    // ✅ Resolve level
    if (meta.levelId){
      const th = LEVELS.find(l => l.id === meta.levelId);
      if (th) currentTheme = th;
    }

    // ✅ Apply deterministic seed
    if (typeof meta.mapSeed === 'number'){
      srand(meta.mapSeed);
    }

    // ✅ Build the world ONCE, authoritatively
    world.buildObstacles();
    world.buildHazards();
    world.buildChests();
    nav.rebuild();

    lvlEl.textContent = currentTheme
      ? `${currentTheme.id} — ${currentTheme.name}`
      : '—';
  }
  // Build home cards ----------------------------------------------------------
  function createLevelPreview(theme){ const cnv=document.createElement('canvas'); cnv.width=260; cnv.height=130; const c=cnv.getContext('2d'); const g=c.createLinearGradient(0,0,0,cnv.height); g.addColorStop(0,theme.floor.c1); g.addColorStop(1,theme.floor.c2); c.fillStyle=g; c.fillRect(0,0,cnv.width,cnv.height); c.strokeStyle=theme.floor.grid; c.lineWidth=1; c.beginPath(); for(let x=0;x<cnv.width;x+=20){ c.moveTo(x,0); c.lineTo(x,cnv.height); } for(let y=0;y<cnv.height;y+=20){ c.moveTo(0,y); c.lineTo(cnv.width,y); } c.stroke(); const rects=[{x:20,y:22,w:70,h:18},{x:120,y:46,w:50,h:26},{x:190,y:26,w:50,h:22},{x:60,y:82,w:120,h:20}]; for(const o of rects){ c.fillStyle=theme.obs.fill; c.strokeStyle=theme.obs.stroke; c.lineWidth=2; roundRect(c,o.x,o.y,o.w,o.h,8); c.fill(); c.stroke(); } if(theme.hazards.kind!=='none'){ c.fillStyle= theme.hazards.kind==='lava'?'#ff6a2a': theme.hazards.kind==='chasm'?'#08101a': theme.hazards.kind==='void'?'#09060c':'#4a3a2a'; c.fillRect(160,22,70,30); c.strokeStyle=theme.accent+'66'; c.strokeRect(160,22,70,30); } c.fillStyle = '#fff'; c.beginPath(); c.arc(200,70, 14, 0, Math.PI*2); c.fill(); return cnv; }
  function buildHome(){ const grid=document.getElementById('levelsGrid'); grid.innerHTML=''; LEVELS.forEach(theme=>{ const card=document.createElement('div'); card.className='levelCard'; const prev=document.createElement('div'); prev.className='levelPreview'; const prevCanvas=createLevelPreview(theme); prev.appendChild(prevCanvas); const badge=document.createElement('div'); badge.className='levelBadge'; badge.textContent=theme.badge; prev.appendChild(badge); const body=document.createElement('div'); body.className='levelBody'; const name=document.createElement('div'); name.className='levelName'; name.textContent=`${theme.id}. ${theme.name}`; const desc=document.createElement('div'); desc.className='levelDesc'; desc.textContent=theme.desc; body.appendChild(name); body.appendChild(desc); card.appendChild(prev); card.appendChild(body); 
    
    card.addEventListener('click', async () => {
      // ✅ ONLINE (HTTP authoritative): request level from server
      if (isNetActive()) {
        try { await Net.setLevel(theme.id); } catch (e) { console.warn(e); }
      } else {
        // ✅ OFFLINE only
        applyTheme(theme);
      }

      // Show loading overlay with countdown from server joinDeadline
      const ovLoad = document.getElementById('overlayLoading');
      const text   = document.getElementById('loadingText');
      const badge  = document.getElementById('lobbyBadge');

      const meta = (window.Net && Net.state && Net.state.meta) ? Net.state.meta : {};
      const deadline = meta.joinDeadline || 0;

      if (badge) {
        const parts = badge.textContent.split(' • ')[0];
        badge.textContent = `${parts} • L${theme.id}`;
        badge.style.display = 'inline-block';
      }

      if (ovLoad && text) {
        ovLoad.style.display = 'grid';

        const tick = () => {
          let secs = 0;
          if (deadline > 0) secs = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

          text.textContent = (deadline > 0)
            ? `Starting in ${secs}s…`
            : `Waiting for server…`;

          if (deadline > 0 && secs <= 0) {
            ovLoad.style.display = 'none';
            document.getElementById('overlayHome').style.display = 'none';
            document.getElementById('btnRestart')?.click();
          } else {
            setTimeout(tick, 250);
          }
        };

        tick();
      }
    });
    grid.appendChild(card); }); }

  // Init ----------------------------------------------------------------------
  if (!isNetActive()) {
    world.buildObstacles();
  }
  buildHome();
  loadSettings();
  // React to host meta (level + seed)
  window.addEventListener('net:meta', (ev) => {
   try { applyNetMap(ev.detail); } catch {} 
   try { 
   if (isNetActive() && Net.lockstep && Net.lockstep.peers) { 
   const ids = Net.lockstep.peers() || []; 
   // ✅ init when roster is real; also fix "ready but empty"
   if (ids.length && ids.includes(Net.state.myId) && (!LS.ready || LS.players.size === 0)) { 
   lsInitPlayers(); 
   } 
   } 
   } catch {} 
  }); 
  // Show remote events (muzzle flashes / melee pose)
  // Show remote events (muzzle flashes / melee pose / bullets)
  window.addEventListener('net:event', (ev) => {
    const e = ev.detail || {};

    if (e.kind === 'shot') {
      // (1) a quick muzzle puff for the remote shot
      ents.effects.push({ x: e.x, y: e.y, type:'muzzle', life:0.1, t:0, color:'#fff' });

      // (2) spawn the remote bullets so you can see their tracers
      try {
        const snap = Net.state?.snapshot;
        const pp = snap?.players?.find(p => p.id === e.from);
        const w = (pp ? weapons[pp.weapon || 0] : weapons[0]);
        if (w) {
          const base = e.ang;
          for (let i = 0; i < w.shots; i++) {
          }
        }
      } catch {}
    }
    else if (e.kind === 'melee') {
      // quick pop at remote melee position
      ents.effects.push({ x: e.x, y: e.y, type:'pop', life:0.25, t:0, color:'#aef' });
    }
    else if (e.kind === 'chest_open') {
      const ch = world.chests?.[e.id];
      if (ch && !ch.opened) openChest(ch, e.drops);
    }
  });
  window.addEventListener('net:snapshot', (ev) => {
    const snap = ev.detail;
    if (!snap) return;

    // ✅ Server is the ONLY world authority in PvP
    if (snap.world) {
      world.walls = snap.world.walls || [];
      world.hazards = snap.world.hazards || [];
      world.solids = snap.world.solids || [];
      world.buildings = snap.world.buildings || [];
      world.chests = snap.world.chests || [];
      nav.rebuild();
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

    // ✅ IMPORTANT: do NOT become "ready" unless roster exists AND includes me
    if (!ids.length || !ids.includes(Net.state.myId)) { 
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
    const me = LS.players.get(Net.state.myId); 
    if (me) { player.x = me.x; player.y = me.y; player.angle = me.ang; player.hp = me.hp; } 
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
    const me = LS.players.get(Net.state.myId);
    if (me) {
      player.x = me.x; player.y = me.y;
      player.angle = me.ang; player.hp = me.hp;
    }

    // ---- Deterministic firing (LOCAL ONLY for now) ----
    // (This makes "shoot" actually work when lockstep is active.)
    const myInp = inputsById[Net.state.myId] || { shoot:false, melee:false, ang: player.angle };
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

   

    // ✅ move bullets/effects in lockstep (fixes "white dot")
    stepProjectiles(dt); 
  } 

  // Loop ----------------------------------------------------------------------
  let last=performance.now(); function loop(t){
    const dt = Math.min(0.033, (t-last)/1000);
    last = t;

    if (state.running) {
      if (isNetActive() && LS.ready && Net.lockstep) {
        LS.acc += dt;
        while (LS.acc >= LS.dt) {
          const nextTick = LS.tick + 1;

          // build my input for the next tick (deterministic, quantized)
          const k = input.keys;
          let ix = 0, iy = 0;
          if (k.has('w') || k.has('arrowup')) iy -= 1;
          if (k.has('s') || k.has('arrowdown')) iy += 1;
          if (k.has('a') || k.has('arrowleft')) ix -= 1;
          if (k.has('d') || k.has('arrowright')) ix += 1;

          ix += (input.touch.stick.dx > 0.25 ? 1 : (input.touch.stick.dx < -0.25 ? -1 : 0));
          iy += (input.touch.stick.dy > 0.25 ? 1 : (input.touch.stick.dy < -0.25 ? -1 : 0));

          const mx = input.mouse.x, my = input.mouse.y;
          const aimX = cam.x + cam.sx + mx;
          const aimY = cam.y + cam.sy + my;
          const angRaw = angleTo(player.x, player.y, aimX, aimY);
          const angQ = Math.round(angRaw * 4096) / 4096;

          const shoot = !!(input.mouse.down || input.touch.fire);
          const meleeCmd = (equip === 'melee') && melee && (melee.state !== 'using');

          Net.lockstep.send(nextTick, { ix, iy, ang: angQ, shoot, melee: meleeCmd });
          updateCamera(dt);

          // Pop whatever we have for this tick (missing peers become defaults)
          const inputsById = Net.lockstep.pop(nextTick);
          if (!inputsById) break;

          // Fill missing peer inputs with deterministic "no-op"
          const peerIds = Net.lockstep.peers ? Net.lockstep.peers() : [];
          for (const id of peerIds) {
            if (!inputsById[id]) inputsById[id] = { ix:0, iy:0, ang:0, shoot:false, melee:false };
          }

          lsStep(LS.dt, inputsById);
          LS.tick = nextTick;
          LS.acc -= LS.dt;
        }
      } else {
        // offline fallback: old behavior
        updateFixed(dt, ++SIM_TICK);
      }
    }

    draw(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function updateFixed(dt, tick){
    // ✅ PvP is server-authoritative
    if (isNetActive() && Net.state?.meta?.mode === 'pvp') {
      const snap = Net.state.snapshot;
      if (snap?.players) {
        const me = snap.players.find(p => p.id === Net.state.myId);
        if (me) {
          player.x = me.x;
          player.y = me.y;
          player.angle = me.ang;
          player.hp = me.hp;
        }
      }
      return; // ❌ no local sim
    }
    if (isNetActive() && Net.lockstep) return;
    const online = isNetActive();

    // ✅ Authoritative death: if server no longer includes me → go home
    if (online && hasFreshSnapshot()){
      const me = mySnapshotPlayer();
      if (!me){
        handleAuthoritativeDeath();
        return;
      }
      if (typeof me.hp === 'number') player.hp = me.hp;
    }

    meleeCooldown = Math.max(0, meleeCooldown - dt);

    let dx = 0, dy = 0;
    const k = input.keys;
    if (k.has('w') || k.has('arrowup')) dy -= 1;
    if (k.has('s') || k.has('arrowdown')) dy += 1;
    if (k.has('a') || k.has('arrowleft')) dx -= 1;
    if (k.has('d') || k.has('arrowright')) dx += 1;

    dx += input.touch.stick.dx * 1.2;
    dy += input.touch.stick.dy * 1.2;

    const mag = Math.hypot(dx, dy) || 1;
    dx /= mag; dy /= mag;

    const sens = parseFloat(rngSens.value || '1');
    const mx = input.mouse.x, my = input.mouse.y;
    const aimX = cam.x + cam.sx + mx;
    const aimY = cam.y + cam.sy + my;

    player.angle = lerpAngle(
      player.angle,
      angleTo(player.x, player.y, aimX, aimY),
      0.28 * sens
    );

    // reload
    if (player.reloading){
      player.reloadT -= dt;
      if (player.reloadT <= 0){
        const w = weapons[player.weapon];
        const need = w.ammo - player.ammo;
        const give = Math.min(need, player.reserve);
        player.ammo += give;
        player.reserve -= give;
        player.reloading = false;
      }
    }

    // movement
    const speed = player.speed * player.spdMul * (player.slowT > 0 ? 0.7 : 1);
    if (player.slowT > 0) player.slowT = Math.max(0, player.slowT - dt);

    moveWithCollide(player, dx * speed * dt, dy * speed * dt);

    // ✅ HTTP net input
    if (online){
      Net.sendInput(dx, dy, player.angle, player.x, player.y);
    }

    // shoot
    if (input.mouse.down || input.touch.fire){
      playerShoot();
    }

    // melee damage (PvP): server validated via /hit
    if (equip === 'melee' && melee){
      if (melee._lastState !== melee.state){
        if (melee.state === 'using') melee._hitSet = new Set();
        melee._lastState = melee.state;
      }

      if (melee.state === 'using'){
        const DMG = meleeDamageForCurrentWeapon();
        const RANGE = 120;
        const ARC = Math.PI / 2;
        const ang = player.angle;

        const snap = Net.state?.snapshot;
        if (online && snap?.players){
          for (const p of snap.players){
            if (!p || p.id === Net.state.myId) continue;

            // prevent multi-hit spam per swing
            const key = p.id;
            if (melee._hitSet && melee._hitSet.has(key)) continue;

            const dxp = p.x - player.x;
            const dyp = p.y - player.y;
            const dist = Math.hypot(dxp, dyp);
            if (dist > RANGE + player.r) continue;

            const dir = Math.atan2(dyp, dxp);
            const diff = Math.abs(((dir - ang + Math.PI*3) % (Math.PI*2)) - Math.PI);
            if (diff <= ARC / 2){
              Net.sendHit(p.id, p.x, p.y, DMG, 'melee'); // ✅ HTTP method
              if (!melee._hitSet) melee._hitSet = new Set();
              melee._hitSet.add(key);
            }
          }
        }
      }
    }

    if (melee) Melee.update(melee, dt);

    // effects/projectiles (offline sim only; online just cleans effects)
    stepProjectiles(dt);

    updateCamera(dt);
    updateHUD();
  }
  
  const SPRITE_ROT_OFF = {
    pistol:  0,
    rifle:   0,
    shotgun: +Math.PI * 2
  };


  function draw(dt){
    const online = isNetActive();
    const snap = online ? Net.state?.snapshot : null;

    // World layers
    world.drawFloor();
    world.drawHazards();
    world.drawObstacles();

    // ✅ Bullets: server authoritative online, local offline
    const bullets = (online && snap && Array.isArray(snap.bullets)) ? snap.bullets : ents.bullets;
    ctx.fillStyle = '#cfe5ff';
    for (const b of bullets){
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

    // ✅ Remote players (from snapshot)
    if (online && hasFreshSnapshot() && snap && Array.isArray(snap.players)){
      for (const p of snap.players){
        if (!p || (Net.state?.myId && p.id === Net.state.myId)) continue;

        const cx = p.x - cam.x - cam.sx;
        const cy = p.y - cam.y - cam.sy;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(p.ang ?? 0);
        drawDesign(selectedDesign, COLORS[selectedColor].c, performance.now()/1000);
        ctx.fillStyle = '#1e2a45';
        ctx.fillRect(player.r * 0.5, -3, 18, 6);
        ctx.restore();
      }
    }

    // Local player (always draw locally)
    {
      const px = player.x - cam.x - cam.sx;
      const py = player.y - cam.y - cam.sy;
      const t = performance.now()/1000;

      if (player.shield > 0){
        ctx.strokeStyle = 'rgba(150,220,255,.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, player.r + 6 + Math.sin(performance.now()/120)*2, 0, Math.PI*2);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(player.angle);

      drawDesign(selectedDesign, COLORS[selectedColor].c, t);

      const w = weapons[player.weapon];
      const showMelee = (equip === 'melee') || (melee && melee.state === 'using');
      if (showMelee){
        Melee.draw(ctx, melee, { playerR: player.r });
      } else {
        let img = null;
        if (w.kind === 'pistol' && pistolIndex >= 0) img = gunSheets.pistols[pistolIndex];
        if (w.kind === 'rifle'  && rifleIndex  >= 0) img = gunSheets.rifles[rifleIndex];
        if (w.kind === 'shotgun'&& shotgunIndex>= 0) img = gunSheets.shotguns[shotgunIndex];

        if (img){
          const targetLength = (w.kind === 'shotgun') ? 20 : (w.kind === 'rifle') ? 30 : 110;
          const ar = (img.width > 0) ? (img.height / img.width) : 1.8;
          const drawW = targetLength / ar;
          const drawH = targetLength;

          ctx.save();
          ctx.translate(player.r * 0.4, 0);
          ctx.rotate(SPRITE_ROT_OFF?.[w.kind] ?? 0);
          const off = SPRITE_OFFSET?.[w.kind] ?? { x: -0.2, y: -0.5 };
          ctx.drawImage(img, drawW * off.x, drawH * off.y, drawW, drawH);
          ctx.restore();
        } else {
          ctx.fillStyle = '#1e2a45';
          ctx.fillRect(player.r * 0.5, -4, 22, 8);
        }
      }

      ctx.restore();
    }

    // Effects
    for (const e of ents.effects){
      const ex = e.x - cam.x - cam.sx;
      const ey = e.y - cam.y - cam.sy;

      if (e.type === 'muzzle'){
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.beginPath();
        ctx.arc(ex, ey, 6 * (1 - e.t / e.life), 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'hit'){
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ex, ey, 10 * (1 - e.t / e.life), 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.type === 'pop'){
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ex, ey, 20 * (e.t / e.life), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawMinimap();
    updateHUD();
  }

  function drawMinimap(){
    const sx=mini.width/world.w, sy=mini.height/world.h;
    mctx.clearRect(0,0,mini.width,mini.height);

    // hazards
    for(const h of world.hazards){
      mctx.fillStyle= h.type==='lava'?'#ff6a2a': h.type==='chasm'?'#0a111c': h.type==='void'?'#09060c':'#4a3a2a';
      mctx.fillRect(h.x*sx, h.y*sy, h.w*sx, h.h*sy);
    }
    // walls
    mctx.fillStyle='#12182b';
    for(const w of world.walls){
      mctx.fillRect(w.x*sx, w.y*sy, w.w*sx, w.h*sy);
    }

    // other players from snapshot (blue)
    try {
      const snap = (isNetActive() ? Net.state?.snapshot : null);
      if (snap?.players) {
        mctx.fillStyle = '#66a3ff';
        for (const p of snap.players) {
          // skip drawing our own dot in blue; the local dot below is green
          if (p.id && Net.state?.myId && p.id === Net.state.myId) continue;
          mctx.fillRect(p.x*sx-2, p.y*sy-2, 4, 4);
        }
      }
    } catch {}

    // local player (green)
    mctx.fillStyle='#7dffa3';
    mctx.beginPath(); mctx.arc(player.x*sx, player.y*sy, 3, 0, Math.PI*2); mctx.fill();

    // enemies (single-player local list; online uses snapshot so skip here)
    // local enemies (draw even when online in Phase‑1)
    mctx.fillStyle = '#ff6275';
    

    // camera box
    mctx.strokeStyle='#9cf';
    mctx.lineWidth=1;
    mctx.strokeRect(cam.x*sx, cam.y*sy, canvas.width*sx, canvas.height*sy);
  }
  // Utilities -----------------------------------------------------------------
  function lerpAngle(a,b,t){ const d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI; return a + d*t; }
  function moveWithCollide(obj, dx, dy){
    // ❌ PvP: server already resolved movement
    if (isNetActive() && Net.state?.meta?.mode === 'pvp') return;

    obj.x += dx;
    if (world.isBlocked(obj.x, obj.y, obj.r)) obj.x -= dx;
    obj.y += dy;
    if (world.isBlocked(obj.x, obj.y, obj.r)) obj.y -= dy;
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
// ---- expose asset loaders for boot progress ----
window.__ASSETS__ = window.__ASSETS__ || {};
window.__ASSETS__.loadImages = loadImages;
window.__ASSETS__.loadGunImages = loadGunImages;
window.__ASSETS__.loadMelee = () => Melee.loadAll();
})();