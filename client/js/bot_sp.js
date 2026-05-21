// ===============================
// SINGLEPLAYER BOT MODULE
// ===============================

let SP_BOTS = [];

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

    for (const e of ents.enemies){
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const d = dx*dx + dy*dy;

      if (d < best){
        best = d;
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
      const dist = Math.hypot(dx,dy);

      b.ang = Math.atan2(dy,dx);

      if (dist > 120){
        b.x += Math.cos(b.ang)*b.speed*dt;
        b.y += Math.sin(b.ang)*b.speed*dt;
      }

      if (dist < 80){
        b.equip = "melee";
      } else {
        b.equip = "gun";
      }

      b.shootCD -= dt;

      if (b.shootCD <= 0 && b.equip === "gun"){
        b.shootCD = 0.45;

        const miss = Math.random() < 0.15;
        const ang = b.ang + (Math.random()-0.5)*(miss ? 0.4 : 0.05);

        ents.bullets.push({
          x: b.x,
          y: b.y,
          vx: Math.cos(ang)*800,
          vy: Math.sin(ang)*800,
          r: 4,
          dmg: 12,
          life: 1.2
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

    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();


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