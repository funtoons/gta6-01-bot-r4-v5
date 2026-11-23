// Azure Bay local playtest: 31 checks against a real headless Chromium.
// Serves game/ on localhost, drives keyboard/mouse, teleports the player
// between scripted beats. Usage: node tools/playtest.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GAME = join(ROOT, 'game');
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    const data = await readFile(join(GAME, path));
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
const pageErrors = [];
const externalReqs = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('request', (r) => { if (!r.url().startsWith(BASE)) externalReqs.push(r.url()); });

const ev = (fn, ...args) => page.evaluate(fn, ...args);
async function waitFor(fn, timeout = 8000, label = '', arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await ev(fn, arg)) return true; } catch { /* retry */ }
    await page.waitForTimeout(50);
  }
  console.log(`  (timeout waiting: ${label})`);
  return false;
}
async function hold(code, ms) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}
async function clearTraffic() {
  await ev(() => {
    const G = window.__game;
    G.cars = G.cars.filter((c) => !c.isTraffic || Math.hypot(c.x - G.player.x, c.y - G.player.y) > 400);
  });
}

async function tp(x, y, angle) {
  await ev(([x, y, angle]) => {
    const G = window.__game;
    G.player.x = x; G.player.y = y;
    if (G.player.inCar) {
      G.player.inCar.x = x; G.player.inCar.y = y; G.player.inCar.speed = 0;
      if (angle !== undefined) { G.player.inCar.angle = angle; G.player.angle = angle; }
    }
    G.cam.x = Math.max(0, Math.min(3200 - 1280, x - 640));
    G.cam.y = Math.max(0, Math.min(2400 - 720, y - 360));
  }, [x, y, angle]);
}

try {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  check('01 boot: game ready', await waitFor(() => window.__gameReady, 10000, 'ready'));
  check('02 boot: no console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 200));
  check('03 boot: no page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
  check('04 boot: no external requests', externalReqs.length === 0, externalReqs.join(', ').slice(0, 200));
  check('05 title screen shown', await ev(() => window.__game.mode === 'title'));
  await page.mouse.click(640, 366); // NEW GAME
  check('06 new game starts play', await waitFor(() => window.__game.mode === 'play', 5000, 'play'));
  check('07 player spawns on foot at diner', await ev(() => {
    const p = window.__game.player;
    return !p.inCar && Math.hypot(p.x - 940, p.y - 1360) < 60;
  }));
  const x0 = await ev(() => window.__game.player.x);
  await hold('KeyD', 1000);
  const x1 = await ev(() => window.__game.player.x);
  check('08 walk moves player', x1 - x0 > 30, `dx=${Math.round(x1 - x0)}`);
  await tp(1000, 1360);
  check('09 mission 1: walk to diner advances stage', await waitFor(() => {
    const m = window.__game.mission;
    return m.index === 0 && m.stage === 1;
  }, 5000, 'stage 1'));
  await tp(1060, 1405);
  await clearTraffic();
  await page.keyboard.press('KeyE');
  check('10 enter mission car', await waitFor(() => {
    const p = window.__game.player;
    return p.inCar && p.inCar.missionCar === 'mission';
  }, 5000, 'in mission car'));
  // Drive east along street 1100 (a clear road) from the mission car.
  await tp(1000, 1100, 0);
  await hold('KeyW', 1200);
  const spd = await ev(() => (window.__game.player.inCar ? Math.abs(window.__game.player.inCar.speed) : -1));
  check('11 drive: car accelerates', spd > 50, `speed=${Math.round(spd)}`);
  await tp(2180, 500);
  check('12 mission 1 completes, cash up', await waitFor(() => {
    const G = window.__game;
    return G.mission.index === 1 && G.player.cash >= 1100;
  }, 5000, 'mission 2'));
  check('13 save written to localStorage', await ev(() => !!localStorage.getItem('azurebay.save.v1')));
  await page.reload({ waitUntil: 'load' });
  await waitFor(() => window.__gameReady, 10000, 'ready after reload');
  await page.mouse.click(640, 430); // CONTINUE
  check('14 reload + Continue restores cash', await waitFor(() => {
    const G = window.__game;
    return G.mode === 'play' && G.player.cash >= 1100;
  }, 5000, 'continue'));
  await tp(600, 1650);
  await clearTraffic();
  const ammoBefore = await ev(() => window.__game.player.ammo.pistol);
  const cashBefore = await ev(() => window.__game.player.cash);
  await page.keyboard.press('KeyE');
  check('15 buy ammo at Harbor Arms', await waitFor(([a, c]) => {
    const p = window.__game.player;
    return p.ammo.pistol === a + 24 && p.cash === c - 60;
  }, 5000, 'ammo bought', [ammoBefore, cashBefore]));
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(150);
  await page.mouse.move(900, 360);
  const ammo0 = await ev(() => window.__game.player.ammo.pistol);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const ammo1 = await ev(() => window.__game.player.ammo.pistol);
  check('16 shoot consumes ammo', ammo1 <= ammo0 - 1, `${ammo0} -> ${ammo1}`);
  await tp(1440, 1030);
  await clearTraffic();
  await page.keyboard.press('KeyE');
  check('17 steal parked car raises wanted', await waitFor(() => {
    const p = window.__game.player;
    return p.inCar && p.stats.carsStolen >= 1 && p.wanted >= 1;
  }, 5000, 'stolen'));
  check('18 police units spawn', await waitFor(() => window.__game.cars.some((c) => c.isPolice && !c.wreck), 6000, 'cops'));
  check('19 police close in on player', await waitFor(() => {
    const G = window.__game;
    return G.cars.some((c) => c.isPolice && !c.wreck && Math.hypot(c.x - G.player.x, c.y - G.player.y) < 300);
  }, 10000, 'cop near'));
  // Respray: step out of the old car, park it far away, get into a fresh
  // car parked at Azure Spray, then press E.
  await ev(() => {
    const G = window.__game;
    const old = G.player.inCar;
    if (old) { old.isPlayer = false; old.x = 100; old.y = 100; old.speed = 0; }
    G.player.inCar = null;
    G.player.x = 1800; G.player.y = 1040;
    G.cars.push({ id: 9003, type: 'sedan', x: 1800, y: 1080, angle: 0, speed: 0, hp: 100, maxHp: 100, color: '#4a90d9', name: 'Vela Sedan', max: 520, accel: 340, turn: 2.6, isPlayer: false, isPolice: false, isTraffic: false, wreck: false, driver: null, stolen: false, missionCar: null, taxi: false, damage: 0, brakeT: 0 });
  });
  await clearTraffic();
  await page.keyboard.press('KeyE');
  const inFresh = await waitFor(() => {
    const p = window.__game.player;
    return p.inCar && p.inCar.id === 9003;
  }, 3000, 'in fresh car');
  const cash0 = await ev(() => window.__game.player.cash);
  if (inFresh) await page.keyboard.press('KeyE');
  check('20 respray clears wanted (-$150)', inFresh && await waitFor((c0) => {
    const p = window.__game.player;
    return p.wanted === 0 && p.cash === c0 - 150;
  }, 5000, 'respray', cash0));
  await page.keyboard.press('KeyP');
  check('21 pause opens', await waitFor(() => window.__game.mode === 'pause', 3000, 'pause'));
  await page.keyboard.press('KeyP');
  check('21b pause resumes', await waitFor(() => window.__game.mode === 'play', 3000, 'play'));
  await page.keyboard.press('KeyM');
  check('22 map opens', await waitFor(() => window.__game.mode === 'map', 3000, 'map'));
  await page.keyboard.press('KeyM');
  check('22b map closes', await waitFor(() => window.__game.mode === 'play', 3000, 'play'));
  // Taxi: step out of any car first, then build a taxi, get in, take a fare.
  await ev(() => {
    const G = window.__game;
    const old = G.player.inCar;
    if (old) { old.isPlayer = false; old.x = 100; old.y = 100; old.speed = 0; }
    G.player.inCar = null;
    G.player.x = 1200; G.player.y = 1160;
    G.cars.push({ id: 9001, type: 'taxi', x: 1200, y: 1200, angle: 0, speed: 0, hp: 120, maxHp: 120, color: '#f5c518', name: 'Taxi', max: 300, accel: 320, turn: 2.6, isPlayer: false, isPolice: false, isTraffic: false, wreck: false, driver: null, stolen: false, missionCar: null, taxi: true, damage: 0, brakeT: 0 });
  });
  await clearTraffic();
  await page.keyboard.press('KeyE');
  const inTaxi = await waitFor(() => window.__game.player.inCar && window.__game.player.inCar.type === 'taxi', 5000, 'in taxi');
  if (inTaxi) await page.keyboard.press('KeyT');
  check('23 taxi fare starts', inTaxi && await waitFor(() => !!window.__game.taxiFare, 3000, 'fare'));
  if (await ev(() => !!window.__game.taxiFare)) {
    const fare = await ev(() => window.__game.taxiFare);
    await tp(fare.x, fare.y);
    check('23b taxi fare completes', await waitFor(() => window.__game.player.stats.fares >= 1, 5000, 'fare done'));
  } else check('23b taxi fare completes', false, 'no fare');
  // Race: exit car, run the Neon Sprint checkpoints by teleport.
  await page.keyboard.press('KeyE');
  await tp(1000, 1400);
  await page.keyboard.press('KeyR');
  check('24 race starts', await waitFor(() => !!window.__game.race, 3000, 'race'));
  for (const [cx, cy] of [[1800, 1400], [1800, 500], [1000, 500]]) {
    await tp(cx, cy);
    await page.waitForTimeout(200);
  }
  check('24b race completes', await waitFor(() => window.__game.player.stats.racesWon >= 1, 5000, 'race won'));
  const pk0 = await ev(() => { const pk = window.__game.packages.find((p) => !p.got); return pk ? [pk.x, pk.y] : null; });
  if (pk0) await tp(pk0[0], pk0[1]);
  check('25 hidden package collected', pk0 && await waitFor(() => window.__game.player.stats.packages >= 1, 5000, 'package'));
  // Vigilante in a police car.
  await ev(() => {
    const G = window.__game;
    G.cars.push({ id: 9002, type: 'police', x: 500, y: 500, angle: 0, speed: 0, hp: 160, maxHp: 160, color: '#e8e8e8', name: 'APD Cruiser', max: 340, accel: 380, turn: 2.9, isPlayer: false, isPolice: true, isTraffic: false, wreck: false, driver: null, stolen: false, missionCar: null, taxi: false, damage: 0, brakeT: 0, unit: 'APD-99', role: 'IN PURSUIT' });
  });
  await tp(500, 460);
  await clearTraffic();
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyV');
  check('26 vigilante patrol active', await waitFor(() => !!window.__game.vigilante, 3000, 'vigilante'));
  // Busted: on foot, wanted 1, a foot cop walks in.
  await page.keyboard.press('KeyE'); // exit car
  await ev(() => {
    const G = window.__game;
    G.player.health = 100; G.player.invulnT = 10; G.player.wanted = 1;
    G.copPeds.push({ x: G.player.x + 40, y: G.player.y, angle: 0 });
  });
  check('27 busted by foot cop', await waitFor(() => window.__game.mode === 'busted', 8000, 'busted'));
  await page.keyboard.press('Enter');
  check('27b busted respawns at station', await waitFor(() => {
    const G = window.__game;
    return G.mode === 'play' && Math.hypot(G.player.x - 600, G.player.y - 260) < 10;
  }, 3000, 'respawn'));
  // Wasted: 1 HP, a Viper shoots.
  await ev(() => {
    const G = window.__game;
    G.player.health = 1; G.player.invulnT = 0;
    G.gang.push({ x: G.player.x + 50, y: G.player.y, hp: 60, angle: 0, shootT: 0, speed: 95, shirt: '#3a3a44', skin: '#c98d5e' });
  });
  check('28 wasted by gunfire', await waitFor(() => window.__game.mode === 'wasted', 12000, 'wasted'));
  await page.keyboard.press('Enter');
  check('28b wasted respawns healthy', await waitFor(() => {
    const G = window.__game;
    return G.mode === 'play' && G.player.health >= 90;
  }, 3000, 'respawn'));
  // Mission 6 + ending.
  await ev(() => window.__debug.startMission(5));
  await tp(1400, 760);
  await clearTraffic();
  await page.keyboard.press('KeyE');
  const inTruck = await waitFor(() => {
    const p = window.__game.player;
    return p.inCar && p.inCar.missionCar === 'truck';
  }, 5000, 'in truck');
  check('29a mission 6: hijack cash truck', inTruck);
  if (inTruck) {
    await tp(1000, 1360);
    check('29b mission 6 completes -> ending', await waitFor(() => window.__game.mode === 'ending', 5000, 'ending'));
  } else check('29b mission 6 completes -> ending', false, 'no truck');
  await page.keyboard.press('Enter');
  check('29c ending -> free roam', await waitFor(() => window.__game.mode === 'play', 3000, 'free roam'));
  const st0 = await ev(() => window.__game.radio.station);
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(200);
  const st1 = await ev(() => window.__game.radio.station);
  check('30 radio cycles station', st1 === (st0 + 1) % 3, `${st0} -> ${st1}`);
  check('31 session clean: no errors, no external requests', consoleErrors.length === 0 && pageErrors.length === 0 && externalReqs.length === 0,
    `console=${consoleErrors.length} page=${pageErrors.length} ext=${externalReqs.length} :: ${pageErrors.join(' | ').slice(0, 400)}`);
} catch (e) {
  console.log('PLAYTEST CRASH:', String(e).slice(0, 500));
  results.push({ name: 'playtest crash', ok: false });
} finally {
  await browser.close();
  server.close();
}

const passed = results.filter((r) => r.ok).length;
console.log(`\nPLAYTEST: ${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
