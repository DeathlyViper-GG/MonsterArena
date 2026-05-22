// ===============================
// SINGLEPLAYER BOT MODULE
// ===============================

let SP_BOTS = [];
// bring functions from main file
let BOT_losBlocked = null;
let BOT_moveWithCollide = null;

function setBotLOS(fn){
  BOT_losBlocked = fn;
}

function setBotMove(fn){
  BOT_moveWithCollide = fn;
}

// ===== local helpers (fix missing functions) =====
function angleTo(ax, ay, bx, by){
  return Math.atan2(by - ay, bx - ax);
}

function lerpAngle(a, b, t){
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}



// ===== INIT =====
function initSPBots(player, COLORS, DESIGNS, gunSheets){
  SP_BOTS = [];

  for (let i = 0; i < 3; i++){
    SP_BOTS.push({
      id: "bot_" + i,

      x: player.x + (Math.random() - 0.5) * 800,
      y: player.y + (Math.random() - 0.5) * 800,
      ang: Math.random() * Math.PI * 2,

      hp: 100,
      hpMax: 100,
      r: 16,

      speed: 180,

      design: Math.floor(Math.random() * DESIGNS.length),
      color: Math.floor(Math.random() * COLORS.length),

      guns: {
        pistol: Math.floor(Math.random() * gunSheets.pistols.length),
        rifle: Math.floor(Math.random() * gunSheets.rifles.length),
        shotgun: Math.floor(Math.random() * gunSheets.shotguns.length)
      },

      weapon: 0,
      equip: "gun",

      target: null,
      shootCD: 0,
      dodgeCD: 0,
      wanderT: 0,

      essence: 0
    });
  }
}

// ===== UPDATE =====
function updateSPBots(dt, player, ents, world){

  for (const b of SP_BOTS){

    

    let target = null;
    let best = Infinity;

    const MAX_DIST = 650;   // 👈 tweak (600–800 feels good)

    for (const e of ents.enemies){

      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const dist = dx*dx + dy*dy;

      if (dist > MAX_DIST * MAX_DIST) continue;

      if (BOT_losBlocked && BOT_losBlocked(b.x, b.y, e.x, e.y)) continue;

      const bias = Math.random() * 200;

      if (dist + bias < best){
        best = dist + bias;
        target = e;
      }
    }


    b.target = target;

    // LOW HP
    if (b.hp < 30){
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      b.ang = Math.atan2(dy, dx);
      b.x += Math.cos(b.ang)*b.speed*dt;
      b.y += Math.sin(b.ang)*b.speed*dt;
      continue;
    }

    if (target){

      const dx = target.x - b.x;
      const dy = target.y - b.y;
      const d = Math.hypot(dx,dy) || 1;

      if (b.brave === undefined) b.brave = Math.random() < 0.5;
      if (!b.side) b.side = Math.random() < 0.5 ? -1 : 1;

      let moveX = dx / d;
      let moveY = dy / d;

      if (d > 300){
        // approach
      }
      else if (d < 160){
        moveX *= -1;
        moveY *= -1;
      }
      else{
        const strafeX = -moveY * b.side;
        const strafeY = moveX * b.side;

        moveX = moveX * 0.3 + strafeX * 0.7;
        moveY = moveY * 0.3 + strafeY * 0.7;
      }

      const speedMul = b.brave ? 1.2 : 0.85;

      b.vx = moveX * b.speed * speedMul;
      b.vy = moveY * b.speed * speedMul;

      if (BOT_moveWithCollide){
        BOT_moveWithCollide(b, b.vx * dt, b.vy * dt);
      }

      // ✅ EXACT same hazard system as enemies
      const hz = world.getHazardAt(b.x, b.y, b.r * 0.9);

      if (hz) {
        if (hz.type === 'sand') {
          applyQuicksand(b, hz, dt, { isPlayer:false });
        }
        else if (hz.type === 'ice') {
          applyIceSlide(b, hz, dt);
        }
        else if (hz.type === 'lava') {
          if (hz.phase === 'erupt') {
            b.hp = 0;
          } else if (hz.phase === 'after') {
            b.hp -= 30 * dt;
          }
        }
        else if (hz.type === 'void') {
          const res = resolveVoid(b, hz, dt, false);
          if (res.done && res.killed) {
            b.hp = 0;
          }
        }
      }

      const aim = angleTo(b.x, b.y, target.x, target.y);
      const miss = 0.08 * (Math.random() - 0.5);

      b.ang = lerpAngle(b.ang || 0, aim + miss, 0.2);
    }
    // ===== SHOOTING =====

    if (target){

      if (!b.fireRate){
        b.fireRate = 0.4 + Math.random() * 0.6;
      }

      b.shootCD -= dt;

      if (b.shootCD <= 0){
        b.shootCD = b.fireRate;

        if (!ents.bullets) ents.bullets = [];

          ents.bullets.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(b.ang) * 600,
            vy: Math.sin(b.ang) * 600,
            life: 1.2,
            r: 4,
            dmg: 10,
            team: "player"
          });
      }
    }

    // DODGE
    b.dodgeCD -= dt;
    if (b.dodgeCD <= 0){
      for (const eb of ents.ebullets){
        const dx = b.x - eb.x;
        const dy = b.y - eb.y;
        const d = dx*dx + dy*dy;

        if (d < 220*220){
          b.dodgeCD = 1.2;
          b.ang += Math.PI/2;
          break;
        }
      }
    }

    // WANDER
    if (!target){
      b.wanderT -= dt;

      if (b.wanderT <= 0){
        b.wanderT = 2 + Math.random()*2;
        b.ang = Math.random()*Math.PI*2;
      }

      b.x += Math.cos(b.ang)*b.speed*0.6*dt;
      b.y += Math.sin(b.ang)*b.speed*0.6*dt;
    }

    // PICKUPS
    for (let i = ents.pickups.length - 1; i >= 0; i--){
      const p = ents.pickups[i];

      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.hypot(dx,dy);

      if (d < 200){
        const a = Math.atan2(dy,dx);
        b.x += Math.cos(a)*140*dt;
        b.y += Math.sin(a)*140*dt;
      }

      if (d < 20){
        if (p.type === "xp"){
          b.essence++;
        }
        ents.pickups.splice(i,1);
      }
    }

    if (world.collideHazard(b.x, b.y, 16)){
      b.hp = 0;
    }
  }

  SP_BOTS = SP_BOTS.filter(b => b.hp > 0);
}

// ===== DRAW =====
function drawSPBots(ctx, cam, COLORS, drawDesign, weapons, gunSheets){

  for (const b of SP_BOTS){

    
    const px = b.x - cam.x - cam.sx;
    const py = b.y - cam.y - cam.sy;


    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(b.ang);

    drawDesign(
      b.design,
      COLORS[b.color].c,
      performance.now()/1000,
      20
    );


    const w = weapons[b.weapon];

    let img = null;
    if (w.kind === 'pistol') img = gunSheets.pistols[b.guns.pistol];
    if (w.kind === 'rifle') img = gunSheets.rifles[b.guns.rifle];
    if (w.kind === 'shotgun') img = gunSheets.shotguns[b.guns.shotgun];

    if (img){
      ctx.drawImage(img, 10, -5, 28, 18);
    }

    ctx.restore();

    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.arc(px, py, 22, 0, Math.PI*2);
    ctx.stroke();

    ctx.strokeStyle = "#66ff66";
    ctx.beginPath();
    ctx.arc(px, py, 22, -Math.PI/2, -Math.PI/2 + (b.hp/b.hpMax)*Math.PI*2);
    ctx.stroke();
  }
}