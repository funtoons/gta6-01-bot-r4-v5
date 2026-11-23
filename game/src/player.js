// Nico Reyes on foot: walk/sprint, enter/exit cars, interact, player state.
import { CFG } from './config.js';
import { Input } from './input.js';
import { pointInBuilding } from './world.js';
import { addWanted } from './police.js';

export function newPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0, inCar: null,
    health: 100, armor: 0, cash: 250, wanted: 0, evade: 0,
    weapon: 'fists', ammo: { pistol: 48, smg: 90, shotgun: 24 },
    respect: 0, stats: {
      missions: 0, cashEarned: 0, carsStolen: 0, fares: 0, packages: 0,
      racesWon: 0, gangDown: 0, jumps: 0, busted: 0, wasted: 0, timeMin: 0,
    },
    hurtT: 0, invulnT: 0,
  };
}

function collideBuildings(G, e, r) {
  const b = pointInBuilding(G.world, e.x, e.y, r);
  if (!b) return;
  const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
  let dx = e.x - cx, dy = e.y - cy;
  const d = Math.hypot(dx, dy);
  if (d < 0.01) { e.y = b.y - r - 1; return; }
  dx /= d; dy /= d;
  e.x = cx + dx * (r + 0.5);
  e.y = cy + dy * (r + 0.5);
}

export function updatePlayer(G, dt) {
  const p = G.player;
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.invulnT = Math.max(0, p.invulnT - dt);
  if (p.inCar) return; // car physics owns movement in vehicles.js
  const ax = Input.axis();
  const sprint = Input.isDown('ShiftLeft') || Input.isDown('ShiftRight');
  const sp = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
  const len = Math.hypot(ax.x, ax.y);
  if (len > 0) {
    const nx = ax.x / len, ny = ax.y / len;
    p.x += nx * sp * dt;
    p.y += ny * sp * dt;
    p.angle = Math.atan2(ny, nx);
    p.speed = sp;
  } else p.speed = 0;
  p.x = Math.max(24, Math.min(CFG.worldW - 24, p.x));
  p.y = Math.max(24, Math.min(CFG.worldH - 24, p.y));
  collideBuildings(G, p, 11);
  // Aim at the mouse (world position).
  const wx = G.cam.x + Input.mouse.x, wy = G.cam.y + Input.mouse.y;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
  // Enter a nearby car with E (only the acting system consumes the press).
  if (Input.peekPressed('KeyE')) {
    let best = null, bd = 52;
    for (const car of G.cars) {
      if (car.wreck) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bd) { bd = d; best = car; }
    }
    if (best) {
      Input.consume('KeyE');
      p.inCar = best;
      best.isPlayer = true;
      best.driver = 'player';
      if (best.stolen) {
        best.stolen = false;
        p.stats.carsStolen++;
        addWanted(G, 1, 'theft');
        G.dialog = { who: 'dispatch', text: 'Unit, we have a vehicle theft in progress. Respond.', t: 4 };
      }
      if (best.missionCar === 'steal') G.mission.onEnterSteal?.();
      if (best.missionCar === 'truck') G.mission.onEnterTruck?.();
      if (best.missionCar === 'mission') G.mission.onEnterMission?.();
    }
  }
}

export function exitCar(G) {
  const p = G.player, car = p.inCar;
  if (!car) return;
  car.isPlayer = false;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  car.speed = 0;
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.invulnT > 0 || G.mode !== 'play') return;
  let left = amount;
  if (p.armor > 0) { const ab = Math.min(p.armor, left); p.armor -= ab; left -= ab; }
  p.health -= left;
  p.hurtT = 0.5;
  if (p.health <= 0) {
    p.health = 0;
    G.mode = 'wasted';
    p.stats.wasted++;
    G.dialog = { who: 'dispatch', text: 'Officer down. Ambulance to the scene.', t: 4 };
  }
}
