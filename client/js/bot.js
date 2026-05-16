// ===============================
// SIMPLE BOT SYSTEM (PVE)
// ===============================

const bots = [];
window.bots = bots;

// ------------------------
// CREATE BOT
// ------------------------
window.createBot = function(id) {
  return {
    id,
    name: "Bot_" + Math.floor(Math.random() * 999),

    x: 2000,
    y: 1400,
    ang: 0,

    hp: 100,
    weapon: 0,

    input: {
      ix: 0,
      iy: 0,
      shoot: false,
      dash: false,
      melee: false,
      weaponSwitch: null
    },

    state: "follow",
    target: null,
    fireCooldown: 0,
    brainTick: 0
  };
}

// ------------------------
// MAIN AI
// ------------------------
window.updateBotAI = function(bot, players, enemies, world, dt) {

  bot.brainTick -= dt;
  if (bot.brainTick > 0) return;
  bot.brainTick = 0.1;

  bot.input.ix = 0;
  bot.input.iy = 0;
  bot.input.shoot = false;
  bot.input.melee = false;
  bot.input.dash = false;

  // ---------- find nearest enemy ----------
  let nearestEnemy = null;
  let bestDist = Infinity;

  for (const e of enemies) {
    const dx = e.x - bot.x;
    const dy = e.y - bot.y;
    const d = dx*dx + dy*dy;

    if (d < bestDist) {
      bestDist = d;
      nearestEnemy = e;
    }
  }

  // ---------- fallback: follow player ----------
  const player = players[0];

  // ---------- choose state ----------
  if (nearestEnemy && bestDist < 500*500) {
    bot.state = "combat";
    bot.target = nearestEnemy;
  } else {
    bot.state = "follow";
  }

  // ---------- act ----------
  if (bot.state === "combat") {
    combat(bot, bot.target);
  } else {
    moveTo(bot, player.x, player.y);
  }

  // ---------- avoid hazards ----------
  avoidHazards(bot, world);
}


// ------------------------
// COMBAT
// ------------------------
function combat(bot, enemy) {

  const dx = enemy.x - bot.x;
  const dy = enemy.y - bot.y;
  const dist = Math.hypot(dx, dy);

  bot.ang = Math.atan2(dy, dx);

  // strafe
  const side = Math.random() > 0.5 ? 1 : -1;
  const strafe = bot.ang + Math.PI/2 * side;

  bot.input.ix = Math.cos(strafe);
  bot.input.iy = Math.sin(strafe);

  // weapon switch
  if (dist < 80) bot.input.weaponSwitch = 2;
  else if (dist < 300) bot.input.weaponSwitch = 1;
  else bot.input.weaponSwitch = 0;

  // shooting
  bot.fireCooldown--;

  if (bot.fireCooldown <= 0) {
    bot.input.shoot = true;
    bot.fireCooldown = 10;
  }

  // melee
  if (dist < 50) bot.input.melee = true;

  // dash
  if (Math.random() < 0.05) bot.input.dash = true;
}


// ------------------------
// MOVE
// ------------------------
function moveTo(bot, x, y) {
  const dx = x - bot.x;
  const dy = y - bot.y;
  const d = Math.hypot(dx, dy);

  if (d > 1) {
    bot.input.ix = dx / d;
    bot.input.iy = dy / d;
  }
}


// ------------------------
// HAZARD AVOID
// ------------------------
function avoidHazards(bot, world) {

  let ax = 0;
  let ay = 0;

  for (const h of world.hazards) {
    const cx = h.x + h.w/2;
    const cy = h.y + h.h/2;

    const dx = bot.x - cx;
    const dy = bot.y - cy;
    const d = Math.hypot(dx, dy);

    if (d < 150) {
      ax += dx / d;
      ay += dy / d;
    }
  }

  bot.input.ix += ax;
  bot.input.iy += ay;
}