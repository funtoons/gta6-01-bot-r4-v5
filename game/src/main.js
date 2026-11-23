// AZURE BAY — boot, fixed-step loop, mode state machine.
import { CFG, RADIO } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { createWorld } from './world.js';
import { renderWorld, updateCamera } from './render.js';
import { drawHud, drawTitle, drawPause, drawMap, drawBusted, drawWasted, drawEnding } from './hud.js';
import { newPlayer, updatePlayer } from './player.js';
import { updateVehicles } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { updatePolice } from './police.js';
import { updateCombat } from './combat.js';
import { startMission, updateMissions, setDialog } from './missions.js';
import { initActivities, updateActivities } from './activities.js';
import { updateEffects } from './effects.js';
import { saveGame, loadSave, clearSave } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  ctx, canvas, tick: 0, mode: 'title',
  rng: new RNG(20261124),
  world: null,
  cam: { x: 0, y: 0 },
  player: null,
  cars: [], peds: [], gang: [], copPeds: [], pickups: [],
  particles: [], floaters: [], skids: [],
  mission: null, dialog: null, shake: 0,
  staging: false, shotReady: false, stagedFx: null,
  radio: { station: 0, track: 0 },
  gunshotT: 0, crimeT: 0, shootCd: 0,
  heli: null, roadblock: false, bubbleT: 0,
  ui: { buttons: [] },
  parkedSeeded: false,
  saveT: 0,
};

window.__game = G;
window.__gameReady = false;

function newGame(save) {
  G.tick = 0;
  G.rng = new RNG(20261124);
  G.cars = []; G.peds = []; G.gang = []; G.copPeds = []; G.pickups = [];
  G.particles = []; G.floaters = []; G.skids = [];
  G.heli = null; G.roadblock = false; G.dialog = null;
  G.parkedSeeded = false; G.staging = false; G.shotReady = false; G.stagedFx = null;
  G.player = newPlayer(940, 1360);
  G.pickups.push({ x: 980, y: 1330, kind: 'health' });
  G.pickups.push({ x: 1820, y: 1080, kind: 'armor' });
  if (save) {
    const p = G.player;
    p.cash = save.cash; p.health = save.health; p.armor = save.armor;
    p.weapon = save.weapon; p.ammo = save.ammo; p.respect = save.respect;
    p.x = save.x; p.y = save.y; p.stats = save.stats;
    p.stats.timeMin = save.timeMin || 0;
  }
  spawnPeds(G);
  initActivities(G);
  startMission(G, save ? save.mission : 0);
  G.mode = 'play';
}

function respawn(kind) {
  const p = G.player;
  p.health = 100; p.armor = 0; p.wanted = 0; p.evade = 0;
  p.inCar = null; p.gunshotT = 0;
  G.copPeds = [];
  G.heli = null;
  if (kind === 'busted') { p.x = 600; p.y = 260; }
  else { p.x = 1000; p.y = 1400; }
  G.mode = 'play';
  setDialog(G, 'dispatch', kind === 'busted' ? 'Bail posted. Stay out of trouble, Reyes.' : 'You are patched up. Get back to work.', 4);
}

function step(dt) {
  if (G.mode === 'play') {
    G.tick++;
    const p = G.player;
    p.stats.timeMin += dt / 60;
    updatePlayer(G, dt);
    updateVehicles(G, dt);
    updatePeds(G, dt);
    updatePolice(G, dt);
    updateCombat(G, dt);
    updateMissions(G, dt);
    updateActivities(G, dt);
    updateEffects(G, dt);
    if (G.dialog && !G.staging) G.dialog.t -= dt;
    if (G.stagedFx && G.tick >= G.stagedFx.at) {
      const fx = G.stagedFx;
      G.stagedFx = null;
      fx.fn(G);
    }
    // Radio: Q cycles, track advances every 24s.
    if (Input.wasPressed('KeyQ')) {
      G.radio.station = (G.radio.station + 1) % RADIO.length;
      G.radio.track = 0;
      AudioSys.playRadio(G.radio.station, 0);
    }
    if (G.tick % 1440 === 0) {
      G.radio.track = (G.radio.track + 1) % RADIO[G.radio.station].tracks.length;
      AudioSys.playRadio(G.radio.station, G.radio.track);
    }
    if (Input.wasPressed('KeyM')) G.mode = 'map';
    if (Input.wasPressed('KeyP') || Input.wasPressed('Escape')) G.mode = 'pause';
    G.saveT += dt;
    if (G.saveT > 30) { G.saveT = 0; saveGame(G); }
    if (G.staging && G.tick >= 50) G.shotReady = true;
    updateCamera(G);
  } else if (G.mode === 'map') {
    if (Input.wasPressed('KeyM') || Input.wasPressed('Escape')) G.mode = 'play';
  } else if (G.mode === 'pause') {
    if (Input.wasPressed('KeyP') || Input.wasPressed('Escape')) G.mode = 'play';
  } else if (G.mode === 'busted' || G.mode === 'wasted') {
    if (Input.wasPressed('Enter')) respawn(G.mode);
  } else if (G.mode === 'ending') {
    if (Input.wasPressed('Enter')) {
      G.mode = 'play';
      G.mission = { index: -1, stage: 0, spotsDone: 0, killNeed: 0, killGot: 0, timer: 0 };
    }
  }
  Input.endTick();
}

function render() {
  if (G.mode === 'title') { drawTitle(G); return; }
  renderWorld(G);
  if (G.mode === 'play') drawHud(G);
  else if (G.mode === 'pause') { drawHud(G); drawPause(G); }
  else if (G.mode === 'map') drawMap(G);
  else if (G.mode === 'busted') drawBusted(G);
  else if (G.mode === 'wasted') drawWasted(G);
  else if (G.mode === 'ending') drawEnding(G);
}

let last = 0;
function loop(t) {
  const dt = 1 / 60;
  step(dt);
  render();
  window.__gameReady = true;
  requestAnimationFrame(loop);
}

function onClick(e) {
  AudioSys.unlock();
  if (G.mode !== 'title' && G.mode !== 'pause') return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (1280 / rect.width);
  const y = (e.clientY - rect.top) * (720 / rect.height);
  for (const b of G.ui.buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      if (b.action === 'new') { clearSave(); newGame(null); }
      else if (b.action === 'continue') { newGame(loadSave()); }
      else if (b.action === 'resume') { G.mode = 'play'; }
      else if (b.action === 'title') { saveGame(G); G.mode = 'title'; }
      return;
    }
  }
}

function boot() {
  G.world = createWorld();
  G.player = newPlayer(940, 1360);
  G.cam.x = Math.max(0, Math.min(3200 - 1280, G.player.x - 640));
  G.cam.y = Math.max(0, Math.min(2400 - 720, G.player.y - 360));
  spawnPeds(G);
  initActivities(G);
  Input.init(canvas);
  canvas.addEventListener('click', onClick);
  window.addEventListener('keydown', () => AudioSys.unlock());
  window.addEventListener('pointerdown', () => AudioSys.unlock());
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    newGame(null);
    applyShot(G, shot);
    G.mode = shot === 'system' ? 'map' : 'play';
  }
  requestAnimationFrame(loop);
}

boot();
