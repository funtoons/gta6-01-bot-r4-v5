// Wanted 0–5, Azure PD pursuit, roadblocks, heli spotlight, BUSTED/WASTED.
import { CFG } from './config.js';
import { makeCar, wreckCar } from './vehicles.js';
import { damagePlayer } from './player.js';
import { spawnSparks } from './effects.js';

const UNIT_NAMES = ['APD-12', 'APD-07', 'APD-23', 'APD-31', 'APD-04', 'APD-18'];
const UNIT_ROLES = ['IN PURSUIT', 'RAMMING', 'FLANKING', 'CLOSING IN', 'SPOTLIGHT', 'ROADBLOCK'];

export function addWanted(G, n, why) {
  const p = G.player;
  const before = p.wanted;
  p.wanted = Math.max(0, Math.min(5, p.wanted + n));
  p.evade = 0;
  if (p.wanted > before && p.wanted >= 2) {
    G.dialog = { who: 'dispatch', text: why === 'theft' ? 'All units, vehicle theft reported. Converge.' : 'Shots fired. All units respond.', t: 4 };
  }
}

export function updatePolice(G, dt) {
  const p = G.player;
  // Evade: wanted falls when no unit is close and the player stays clean.
  const nearest = nearestUnitDist(G);
  if (p.wanted > 0) {
    if (nearest > 480 && !G.heli) {
      p.evade += dt;
      if (p.evade > 6) { p.wanted--; p.evade = 0; }
    } else p.evade = 0;
  }
  // Maintain pursuit cars.
  const want = p.wanted > 0 ? Math.min(6, p.wanted + 1) : 0;
  const cops = G.cars.filter((c) => c.isPolice && !c.wreck);
  if (cops.length < want) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(420, 620);
    const x = Math.max(80, Math.min(CFG.worldW - 80, p.x + Math.cos(a) * d));
    const y = Math.max(80, Math.min(CFG.worldH - 80, p.y + Math.sin(a) * d));
    const car = makeCar(G, 'police', x, y, Math.atan2(p.y - y, p.x - x));
    car.isPolice = true;
    car.unit = UNIT_NAMES[cops.length % UNIT_NAMES.length];
    car.role = UNIT_ROLES[cops.length % UNIT_ROLES.length];
  }
  // Heli at wanted >= 3.
  if (p.wanted >= 3 && !G.heli) {
    G.heli = { x: p.x, y: p.y - 200, unit: 'AIR-1' };
    G.dialog = { who: 'dispatch', text: 'Air One is overhead. Stay in the light.', t: 4 };
  }
  if (p.wanted < 3) G.heli = null;
  if (G.heli) {
    G.heli.x += (p.x - G.heli.x) * Math.min(1, dt * 0.8);
    G.heli.y += (p.y - 160 - G.heli.y) * Math.min(1, dt * 0.8);
  }
  // Roadblock at wanted >= 4 (once per episode).
  if (p.wanted >= 4 && !G.roadblock) {
    G.roadblock = true;
    const a = p.angle;
    const bx = p.x + Math.cos(a) * 320, by = p.y + Math.sin(a) * 320;
    for (const off of [-30, 30]) {
      const car = makeCar(G, 'police', bx + Math.cos(a + Math.PI / 2) * off, by + Math.sin(a + Math.PI / 2) * off, a + Math.PI / 2);
      car.isPolice = true; car.unit = 'APD-RB'; car.role = 'ROADBLOCK';
    }
  }
  if (p.wanted < 4) G.roadblock = false;
  // Pursuit driving.
  for (const car of cops) {
    if (car.wreck) continue;
    const dx = p.x - car.x, dy = p.y - car.y;
    const d = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const target = d > 90 ? car.max : car.max * 0.55;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Ram the player.
    if (d < 46) {
      if (p.inCar) {
        p.inCar.hp -= 6 * dt * 4;
        p.inCar.damage += 6 * dt * 4;
        spawnSparks(G, car.x, car.y, 2);
        if (p.inCar.hp <= 0) wreckCar(G, p.inCar);
      } else {
        damagePlayer(G, 14 * dt);
      }
      car.speed *= 0.6;
    }
  }
  // Foot cops at wanted 1–2: walk in, and bust a slow on-foot player.
  if (p.wanted >= 1 && p.wanted <= 2 && !p.inCar) {
    if (G.copPeds.length < 2) {
      const a = G.rng.range(0, Math.PI * 2);
      G.copPeds.push({ x: p.x + Math.cos(a) * 260, y: p.y + Math.sin(a) * 260, angle: 0 });
    }
  } else if (p.wanted === 0 || p.inCar) G.copPeds = [];
  for (const cop of G.copPeds) {
    const dx = p.x - cop.x, dy = p.y - cop.y;
    const d = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (d > 30) { cop.x += Math.cos(cop.angle) * 120 * dt; cop.y += Math.sin(cop.angle) * 120 * dt; }
    else if (p.speed < 40 && G.mode === 'play') {
      G.mode = 'busted';
      p.stats.busted++;
      const lost = Math.floor(p.cash * 0.15);
      p.cash -= lost;
      p.weapon = 'fists';
      p.x = 600; p.y = 260;
      G.dialog = { who: 'dispatch', text: 'Suspect in custody. Booking at Central.', t: 4 };
    }
  }
}

export function nearestUnitDist(G) {
  const p = G.player;
  let best = 1e9;
  for (const car of G.cars) {
    if (!car.isPolice || car.wreck) continue;
    best = Math.min(best, Math.hypot(car.x - p.x, car.y - p.y));
  }
  for (const cop of G.copPeds) best = Math.min(best, Math.hypot(cop.x - p.x, cop.y - p.y));
  return best;
}

export function policeUnits(G) {
  const p = G.player;
  const units = [];
  const cops = G.cars.filter((c) => c.isPolice && !c.wreck).slice(0, 5);
  for (const car of cops) {
    units.push({ name: car.unit || 'APD', dist: Math.round(Math.hypot(car.x - p.x, car.y - p.y)), role: car.role || 'IN PURSUIT' });
  }
  if (G.heli) units.push({ name: 'AIR-1', dist: Math.round(Math.hypot(G.heli.x - p.x, G.heli.y - p.y)), role: 'SPOTLIGHT' });
  return units.slice(0, 5);
}
