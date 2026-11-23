// Side systems: taxi fares, vigilante (in a police car), 20 hidden
// packages, 3 checkpoint races, respray shops, the gun shop.
import { SHOPS, RACE_COURSES } from './config.js';
import { Input } from './input.js';
import { addWanted } from './police.js';
import { addFloater } from './effects.js';
import { setDialog } from './missions.js';
import { saveGame } from './save.js';

export const PACKAGE_SPOTS = [
  [340, 340], [560, 940], [940, 340], [1340, 740], [1740, 340], [2140, 940],
  [2540, 340], [2940, 940], [340, 1540], [940, 2140], [1340, 1540], [1740, 2140],
  [2140, 1540], [2540, 2140], [2940, 1540], [340, 2140], [740, 1140], [1140, 740],
  [2340, 1140], [2740, 1740],
];

export function initActivities(G) {
  G.packages = PACKAGE_SPOTS.map(([x, y]) => ({ x, y, got: false }));
  G.taxiFare = null;
  G.vigilante = null;
  G.race = null;
  G.prompt = '';
}

function nearCar(G, r) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.wreck) continue;
    if (Math.hypot(car.x - p.x, car.y - p.y) < r) return car;
  }
  return null;
}

export function updateActivities(G, dt) {
  const p = G.player;
  G.prompt = '';
  if (G.mode !== 'play') return;
  // Packages: walk over to collect.
  for (const pk of G.packages) {
    if (pk.got || p.inCar) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      pk.got = true;
      p.cash += 100;
      p.stats.packages++;
      addFloater(G, pk.x, pk.y - 20, '+$100 PACKAGE', '#7CFC9a');
      setDialog(G, 'carmen', `Package ${p.stats.packages} of 20. Big Eddie's stash — keep them coming.`, 4);
    }
  }
  // Taxi fare: press T while driving a taxi.
  if (p.inCar && p.inCar.type === 'taxi' && Input.wasPressed('KeyT') && !G.taxiFare) {
    const spots = [[600, 200], [2600, 2000], [2200, 500], [1000, 1360], [300, 2000], [1800, 1100]];
    const [x, y] = spots[Math.floor(G.rng.next() * spots.length)];
    G.taxiFare = { x, y, t: 75 };
    setDialog(G, 'dispatch', 'Fare waiting. Drop them off fast and the tip is yours.', 4);
  }
  if (G.taxiFare) {
    G.taxiFare.t -= dt;
    if (Math.hypot(p.x - G.taxiFare.x, p.y - G.taxiFare.y) < 64) {
      const tip = G.taxiFare.t > 40 ? 60 : 20;
      p.cash += 80 + tip;
      p.stats.fares++;
      addFloater(G, p.x, p.y - 30, `+$${80 + tip} FARE`, '#ffd94a');
      G.taxiFare = null;
    } else if (G.taxiFare.t <= 0) {
      G.taxiFare = null;
      setDialog(G, 'dispatch', 'Fare cancelled. The customer walked.', 4);
    }
  }
  // Vigilante: press V while driving a police car.
  if (p.inCar && p.inCar.isPolice && Input.wasPressed('KeyV') && !G.vigilante) {
    G.vigilante = { t: 30 };
    setDialog(G, 'dispatch', 'Vigilante patrol active. Stop the getaway car — $80 per bust.', 4);
  }
  if (G.vigilante) {
    G.vigilante.t -= dt;
    if (G.vigilante.t <= 0) G.vigilante = null;
  }
  // Races: press R at a start marker.
  if (!G.race && !p.inCar) {
    for (let i = 0; i < RACE_COURSES.length; i++) {
      const rc = RACE_COURSES[i];
      if (Math.hypot(p.x - rc.start[0], p.y - rc.start[1]) < 50) {
        G.prompt = `R — Start race: ${rc.name} ($400)`;
        if (Input.wasPressed('KeyR')) {
          G.race = { course: i, cp: 0, t: rc.limit };
          setDialog(G, 'dispatch', `${rc.name}: hit every checkpoint before the clock runs out.`, 4);
        }
      }
    }
  }
  if (G.race) {
    const rc = RACE_COURSES[G.race.course];
    G.race.t -= dt;
    const cp = rc.checkpoints[G.race.cp];
    if (Math.hypot(p.x - cp[0], p.y - cp[1]) < 60) {
      G.race.cp++;
      if (G.race.cp >= rc.checkpoints.length) {
        p.cash += 400;
        p.stats.racesWon++;
        addFloater(G, p.x, p.y - 30, '+$400 RACE WON', '#ffd94a');
        G.race = null;
      }
    } else if (G.race.t <= 0) {
      G.race = null;
      setDialog(G, 'dispatch', 'Race over — too slow. Try again at the start line.', 4);
    }
  }
  // Shops (E), only when not about to enter a car.
  if (!nearCar(G, 52)) {
    const gun = SHOPS.gun;
    if (!p.inCar && Math.hypot(p.x - gun.x, p.y - gun.y) < 70) {
      G.prompt = 'E — Harbor Arms: Pistol $300 / Ammo $60';
      if (Input.wasPressed('KeyE')) {
        if (p.ammo.pistol === 0 && p.cash >= 300) {
          p.cash -= 300; p.ammo.pistol = 48; p.weapon = 'pistol';
          setDialog(G, 'shop', 'Harbor Arms: a pistol, fresh out of the box. Stay safe out there.', 4);
        } else if (p.cash >= 60) {
          p.cash -= 60; p.ammo.pistol += 24; p.ammo.smg += 30; p.ammo.shotgun += 12;
          setDialog(G, 'shop', 'Harbor Arms: ammo restocked. Thanks for the business.', 4);
        }
      }
    }
    if (p.inCar) {
      for (const rs of SHOPS.respray) {
        if (Math.hypot(p.x - rs.x, p.y - rs.y) < 80) {
          G.prompt = 'E — Azure Spray: Respray $150 (clears wanted)';
          if (Input.wasPressed('KeyE') && p.cash >= 150) {
            p.cash -= 150;
            p.wanted = 0;
            p.inCar.hp = p.inCar.maxHp;
            p.inCar.damage = 0;
            p.inCar.color = '#2dd4bf';
            saveGame(G);
            setDialog(G, 'shop', 'Azure Spray: new paint, clean plates. The cops lost you.', 4);
          }
        }
      }
    }
  }
}
