// Screenshot staging: each shot is a reachable in-game state, frozen
// (dialog and random triggers paused) so the capture is deterministic.
import { makeCar } from './vehicles.js';
import { spawnGang } from './combat.js';
import { spawnSmallExplosion, spawnSmoke } from './effects.js';
import { startMission, setDialog } from './missions.js';
import { spawnPeds } from './pedestrians.js';
import { RNG } from './random.js';

export const SHOT_LIST = ['chase', 'street', 'mission', 'system'];

function trafficNear(G, cx, cy) {
  const spots = [
    [cx - 260, cy - 120, 0], [cx - 120, cy + 130, Math.PI], [cx + 180, cy - 130, 0],
    [cx + 300, cy + 120, Math.PI], [cx - 320, cy + 60, Math.PI / 2], [cx + 60, cy - 260, Math.PI / 2],
    [cx - 60, cy + 300, -Math.PI / 2], [cx + 340, cy - 60, 0],
  ];
  for (const [x, y, a] of spots) {
    const car = makeCar(G, G.rng.pick(['sedan', 'coupe', 'van', 'taxi']), x, y, a);
    car.isTraffic = true;
    car.tSpeed = 200;
  }
}

export function applyShot(G, name) {
  G.staging = true;
  G.shotReady = false;
  G.tick = 0;
  const p = G.player;
  if (name === 'chase') {
    p.x = 1800; p.y = 1100;
    const car = makeCar(G, 'coupe', 1800, 1100, 0);
    car.isPlayer = true; car.color = '#2dd4bf';
    p.inCar = car; p.speed = 0;
    p.wanted = 4;
    p.cash = 12450;
    startMission(G, 3);
    G.mission.stage = 0;
    G.mission.timer = 62;
    // Pursuit cars + a roadblock fully in frame, ahead of the player.
    const cops = [[1560, 980], [1620, 1240], [2060, 980], [2120, 1240]];
    for (const [x, y] of cops) {
      const c = makeCar(G, 'police', x, y, Math.atan2(p.y - y, p.x - x));
      c.isPolice = true;
    }
    const rb1 = makeCar(G, 'police', 2200, 1076, Math.PI / 2); rb1.isPolice = true;
    const rb2 = makeCar(G, 'police', 2200, 1124, Math.PI / 2); rb2.isPolice = true;
    G.roadblock = true;
    G.heli = { x: 1800, y: 940, unit: 'AIR-1' };
    trafficNear(G, 1800, 1100);
    spawnPeds(G);
    setDialog(G, 'dispatch', 'All units, the Azul GT is heading east on Sunnyside. Box him in.', 999);
  } else if (name === 'street') {
    p.x = 1400; p.y = 1100; p.inCar = null; p.wanted = 0; p.cash = 3250;
    startMission(G, 0);
    const taxi = makeCar(G, 'taxi', 1420, 1076, 0);
    taxi.isTraffic = true;
    trafficNear(G, 1400, 1100);
    spawnPeds(G);
    // Extra crowd + forced bubbles on the nearest peds.
    for (let i = 0; i < 10; i++) {
      const a = G.rng.range(0, Math.PI * 2), d = G.rng.range(60, 260);
      G.peds.push({
        x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
        angle: G.rng.range(0, Math.PI * 2), speed: 40,
        state: 'walk', shirt: ['#e04a3a', '#4a90d9', '#f5c518', '#7a4fd0'][i % 4],
        skin: '#f0c8a0', bubble: '', bubbleT: 0, fleeT: 0, axis: 'v',
      });
    }
    const lines = [
      'The Vipers took my cousin\'s shop.',
      'Sunset at Pier 9 is unreal tonight.',
      'Big Eddie never forgets a debt.',
      'Taxi! I need the Marina, quick!',
      'Did you hear about the Azul GT?',
    ];
    const near = [...G.peds].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 5);
    near.forEach((ped, i) => { ped.bubble = lines[i]; ped.bubbleT = 999; });
    setDialog(G, 'carmen', 'Walk to the diner, Nico. Your first job starts there.', 999);
  } else if (name === 'mission') {
    p.x = 380; p.y = 2060; p.inCar = null; p.wanted = 1; p.cash = 4100;
    p.weapon = 'pistol'; p.ammo.pistol = 48;
    startMission(G, 4);
    G.mission.stage = 1;
    G.mission.killNeed = 5; G.mission.killGot = 2;
    G.mission.onGangDown = (n) => { G.mission.killGot += n; };
    spawnGang(G, 300, 2000, 5);
    trafficNear(G, 600, 2000);
    spawnPeds(G);
    // Small, contained explosion timed to be fresh at capture.
    G.stagedFx = { at: 44, fn: (g) => { spawnSmallExplosion(g, 300, 1960); spawnSmoke(g, 300, 1960, 3); } };
    setDialog(G, 'carmen', 'The ledger is inside the warehouse. Take the Vipers down.', 999);
  } else if (name === 'system') {
    p.x = 1800; p.y = 1100; p.cash = 4850;
    p.stats.missions = 3; p.stats.cashEarned = 4850; p.stats.carsStolen = 7;
    p.stats.fares = 4; p.stats.packages = 6; p.stats.racesWon = 1;
    p.stats.gangDown = 9; p.stats.timeMin = 47;
    startMission(G, 3);
    G.mode = 'map';
  }
  // Center the camera on the player right away.
  G.cam.x = Math.max(0, Math.min(3200 - 1280, p.x - 640));
  G.cam.y = Math.max(0, Math.min(2400 - 720, p.y - 360));
  // Staged RNG for the capture run.
  G.rng = new RNG(1);
}
