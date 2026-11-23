// Car physics, damage, traffic AI, spawn/despawn. Cars are circles for
// collision (radius ~20) with a drawn rectangle body on top.
import { CFG, CARS, SHOPS } from './config.js';
import { Input } from './input.js';
import { RNG } from './random.js';
import { pointInBuilding, trafficLightAt, nearestRoad, isRoad } from './world.js';
import { addSkid, spawnSparks, spawnSmallExplosion, spawnSmoke } from './effects.js';
import { exitCar } from './player.js';

let nextId = 1;

export function makeCar(G, type, x, y, angle, opts) {
  const def = CARS[type] || CARS.sedan;
  const car = {
    id: nextId++, type, x, y, angle, speed: 0, hp: def.hp, maxHp: def.hp,
    color: def.color, name: def.name, max: def.max, accel: def.accel, turn: def.turn,
    isPlayer: false, isPolice: false, isTraffic: false, wreck: false,
    driver: null, stolen: false, missionCar: null, taxi: false,
    damage: 0, brakeT: 0, ...(opts || {}),
  };
  G.cars.push(car);
  return car;
}

function collideCarBuilding(G, car) {
  const b = pointInBuilding(G.world, car.x, car.y, 20);
  if (!b) return false;
  const cx = Math.max(b.x, Math.min(car.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(car.y, b.y + b.h));
  let dx = car.x - cx, dy = car.y - cy;
  const d = Math.hypot(dx, dy);
  if (d < 0.01) { car.y = b.y - 21; car.speed *= 0.4; return true; }
  dx /= d; dy /= d;
  car.x = cx + dx * 21;
  car.y = cy + dy * 21;
  // Slide along the wall: keep the tangential component, kill the normal one.
  const vn = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
  if (vn < 0 && Math.abs(car.speed) > 60 && (car.hitT || 0) <= 0) {
    car.hp -= 4; car.damage += 4;
    car.hitT = 0.6;
    spawnSparks(G, car.x - dx * 20, car.y - dy * 20, 3);
  }
  car.speed *= 0.92;
  return true;
}

function updatePlayerCar(G, dt) {
  const p = G.player, car = p.inCar;
  if (!car) return;
  const def = car;
  const fwd = Input.isDown('KeyW') || Input.isDown('ArrowUp');
  const back = Input.isDown('KeyS') || Input.isDown('ArrowDown');
  const hand = Input.isDown('Space');
  const steer = (Input.isDown('KeyA') || Input.isDown('ArrowLeft') ? -1 : 0)
    + (Input.isDown('KeyD') || Input.isDown('ArrowRight') ? 1 : 0);
  if (fwd) car.speed += def.accel * dt;
  if (back) car.speed -= (car.speed > 20 ? def.accel * 1.1 : def.accel * 0.6) * dt;
  if (!fwd && !back) car.speed *= Math.pow(0.4, dt);
  car.speed = Math.max(-def.max * 0.45, Math.min(def.max, car.speed));
  const s01 = Math.min(1, Math.abs(car.speed) / def.max);
  const turnRate = def.turn * (0.35 + 0.65 * s01) * (car.speed >= 0 ? 1 : -1);
  car.angle += steer * turnRate * dt * (hand ? 1.5 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx; car.y = ny;
  if (hand && Math.abs(car.speed) > 120) {
    addSkid(G, car.x - Math.cos(car.angle) * 16, car.y - Math.sin(car.angle) * 16, car.angle);
    if (G.rng.chance(0.3)) spawnSmoke(G, car.x, car.y, 1);
  }
  car.x = Math.max(24, Math.min(CFG.worldW - 24, car.x));
  car.y = Math.max(24, Math.min(CFG.worldH - 24, car.y));
  collideCarBuilding(G, car);
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = Math.abs(car.speed);
  // E exits the car — unless parked at a respray shop, where E is respray.
  if (Input.peekPressed('KeyE')) {
    const atRespray = [SHOPS.spray1, SHOPS.spray2].some((rs) => Math.hypot(p.x - rs.x, p.y - rs.y) < 80);
    if (!atRespray) { Input.consume('KeyE'); exitCar(G); }
  }
  if (car.hp <= 0) wreckCar(G, car);
}

export function wreckCar(G, car) {
  if (car.wreck) return;
  car.wreck = true;
  car.speed = 0;
  spawnSmallExplosion(G, car.x, car.y);
  spawnSmoke(G, car.x, car.y, 6);
  if (G.player.inCar === car) {
    G.player.inCar = null;
    G.player.x = car.x + 40; G.player.y = car.y + 40;
    G.player.invulnT = 2;
  }
}

function carHitCar(G, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = 40;
  if (d >= min || d < 0.01) return;
  const push = (min - d) / 2;
  const nx = dx / d, ny = dy / d;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  const rel = Math.abs(a.speed - b.speed);
  if (rel > 120) {
    const dmg = Math.min(14, rel / 40);
    a.hp -= dmg; b.hp -= dmg;
    a.damage += dmg; b.damage += dmg;
    spawnSparks(G, (a.x + b.x) / 2, (a.y + b.y) / 2, 4);
    a.speed *= 0.7; b.speed *= 0.7;
    if (a.hp <= 0) wreckCar(G, a);
    if (b.hp <= 0) wreckCar(G, b);
  }
}

// --- Traffic ---
function spawnTrafficCar(G) {
  const p = G.player;
  const axis = G.rng.chance(0.5) ? 'v' : 'h';
  let x, y, dir;
  if (axis === 'v') {
    const ax = G.rng.pick(CFG.avenues);
    const off = G.rng.range(260, 700) * (G.rng.chance(0.5) ? 1 : -1);
    x = ax + (G.rng.chance(0.5) ? 12 : -12);
    y = Math.max(80, Math.min(CFG.worldH - 80, p.y + off));
    dir = G.rng.chance(0.5) ? 1 : -1;
  } else {
    const sy = G.rng.pick(CFG.streets);
    const off = G.rng.range(260, 700) * (G.rng.chance(0.5) ? 1 : -1);
    y = sy + (G.rng.chance(0.5) ? 12 : -12);
    x = Math.max(80, Math.min(CFG.worldW - 80, p.x + off));
    dir = G.rng.chance(0.5) ? 1 : -1;
  }
  const type = G.rng.pick(['sedan', 'sedan', 'coupe', 'van', 'taxi', 'muscle']);
  const car = makeCar(G, type, x, y, axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
  car.isTraffic = true;
  car.tAxis = axis; car.tDir = dir;
  car.tSpeed = G.rng.range(150, 260);
  car.color = G.rng.chance(0.12) ? '#f5c518' : car.color;
  return car;
}

function updateTrafficCar(G, car, dt) {
  if (car.wreck) return;
  const p = G.player;
  const d = Math.hypot(car.x - p.x, car.y - p.y);
  if (d > 950) { car.dead = true; return; }
  // Stop at a red light ahead, and for a car ahead.
  let target = car.tSpeed;
  const ahead = 70;
  const ax = car.x + Math.cos(car.angle) * ahead, ay = car.y + Math.sin(car.angle) * ahead;
  const light = trafficLightAt(G.world, ax, ay, G.tick);
  if (light) {
    const ns = car.tAxis === 'v';
    if ((ns && (light === 'ew' || light === 'ewY')) || (!ns && (light === 'ns' || light === 'nsY'))) target = 0;
  }
  for (const o of G.cars) {
    if (o === car || o.wreck) continue;
    const od = Math.hypot(o.x - car.x, o.y - car.y);
    if (od < 58) {
      const dot = ((o.x - car.x) * Math.cos(car.angle) + (o.y - car.y) * Math.sin(car.angle)) / Math.max(1, od);
      if (dot > 0.6) target = 0;
    }
  }
  car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // At an intersection, sometimes turn onto the cross road.
  const nearAv = CFG.avenues.some((a) => Math.abs(car.x - a) < 26);
  const nearSt = CFG.streets.some((s) => Math.abs(car.y - s) < 26);
  if (nearAv && nearSt && G.rng.chance(dt * 0.25)) {
    if (car.tAxis === 'v') {
      car.tAxis = 'h';
      const sy = CFG.streets.reduce((a, b) => Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a);
      car.y = sy + (G.rng.chance(0.5) ? 12 : -12);
      car.tDir = G.rng.chance(0.5) ? 1 : -1;
      car.angle = car.tDir > 0 ? 0 : Math.PI;
    } else {
      car.tAxis = 'v';
      const ax = CFG.avenues.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a);
      car.x = ax + (G.rng.chance(0.5) ? 12 : -12);
      car.tDir = G.rng.chance(0.5) ? 1 : -1;
      car.angle = car.tDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  collideCarBuilding(G, car);
  if (car.hp <= 0) wreckCar(G, car);
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) car.hitT = Math.max(0, (car.hitT || 0) - dt);
  updatePlayerCar(G, dt);
  // Keep traffic dense near the player.
  const traffic = G.cars.filter((c) => c.isTraffic && !c.dead);
  if (traffic.length < 14) spawnTrafficCar(G);
  if (traffic.length < 16 && G.rng.chance(dt * 0.5)) spawnTrafficCar(G);
  for (const car of G.cars) {
    if (car.isTraffic) updateTrafficCar(G, car, dt);
  }
  G.cars = G.cars.filter((c) => !c.dead);
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) carHitCar(G, G.cars[i], G.cars[j]);
  }
  // Parked cars: a few static cars near roads for stealing flavour.
  if (!G.parkedSeeded) {
    G.parkedSeeded = true;
    const spots = [[1060, 1440], [1440, 1060], [2260, 1440], [640, 1140], [1840, 2040], [2640, 840]];
    for (const [x, y] of spots) {
      const c = makeCar(G, G.rng.pick(['sedan', 'coupe', 'muscle', 'van']), x, y, G.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
      c.stolen = true;
    }
  }
}
