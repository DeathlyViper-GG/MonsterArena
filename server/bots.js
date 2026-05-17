// ===============================
// SERVER BOT SYSTEM (AUTHORITATIVE PVE)
// ===============================

export function initBots(lobby) {
  if (!lobby.bots) lobby.bots = [];

  if (lobby.bots.length === 0) {
    for (let i = 0; i < 3; i++) {
      lobby.bots.push({
        id: "bot_" + i,
        name: "Bot_" + (100 + i),

        x: lobby.world ? lobby.world.w / 2 : 2000,
        y: lobby.world ? lobby.world.h / 2 : 1400,

        ang: 0,
        hp: 100,
        r: 16,

        shootCD: 0,
        wander: null,
        target: null
      });
    }
  }
}

export function updateBots(lobby, dt, TICK_MS, moveEnemyWithCollide) {
  if (!lobby.bots) return;

  for (const bot of lobby.bots) {

    // FIND NEAREST ENEMY
    let target = null;
    let best = Infinity;

    for (const e of lobby.enemies) {
      const dx = e.x - bot.x;
      const dy = e.y - bot.y;
      const d = dx*dx + dy*dy;

      if (d < best) {
        best = d;
        target = e;
      }
    }

    bot.target = target;

    // =====================
    // COMBAT
    // =====================
    if (target) {
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const ang = Math.atan2(dy, dx);

      bot.ang = ang;

      const speed = 160;

      moveEnemyWithCollide(
        lobby,
        bot,
        Math.cos(ang) * speed * dt,
        Math.sin(ang) * speed * dt
      );

      bot.shootCD -= dt;

      if (bot.shootCD <= 0) {
        bot.shootCD = 0.6;

        lobby.bullets.push({
          owner: "BOT",
          x: bot.x,
          y: bot.y,
          vx: Math.cos(ang) * 600,
          vy: Math.sin(ang) * 600,
          r: 4,
          dmg: 10,
          life: 1.2
        });
      }
    }

    // =====================
    // WANDER
    // =====================
    else {
      if (!bot.wander || Math.random() < 0.02) {
        bot.wander = {
          x: bot.x + Math.random()*400 - 200,
          y: bot.y + Math.random()*400 - 200
        };
      }

      const dx = bot.wander.x - bot.x;
      const dy = bot.wander.y - bot.y;
      const dist = Math.hypot(dx, dy) || 1;

      moveEnemyWithCollide(
        lobby,
        bot,
        (dx/dist) * 120 * dt,
        (dy/dist) * 120 * dt
      );
    }
  }
}

export function bakeBotsSnapshot(lobby) {
  return (lobby.bots || []).map(b => ({
    id: b.id,
    name: b.name,
    x: b.x,
    y: b.y,
    ang: b.ang,
    hp: b.hp
  }));
}