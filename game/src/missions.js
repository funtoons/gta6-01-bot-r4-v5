// Six story missions for Nico Reyes: a $50,000 debt to Big Eddie, fixer
// Carmen Vega, and the Vipers crew led by Dante Cruz. Stage engine: each
// stage has a type, an objective line and a completion test.
import { MISSIONS, SHOPS } from './config.js';
import { makeCar } from './vehicles.js';
import { spawnGang } from './combat.js';
import { addWanted } from './police.js';
import { saveGame } from './save.js';
import { AudioSys } from './audio.js';

export function setDialog(G, who, text, t) {
  G.dialog = { who, text, t: t || 5 };
}

export function missionMarker(G) {
  const m = G.mission;
  if (!m || m.index < 0 || m.index >= MISSIONS.length) return null;
  const st = MISSIONS[m.index].stages[m.stage];
  if (!st) return null;
  if (st.type === 'collect') return { x: st.spots[m.spotsDone][0], y: st.spots[m.spotsDone][1] };
  if (st.x !== undefined) return { x: st.x, y: st.y };
  if (st.type === 'enter') {
    const car = G.cars.find((c) => c.missionCar === (m.index === 1 ? 'steal' : m.index === 5 ? 'truck' : 'mission'));
    return car ? { x: car.x, y: car.y } : null;
  }
  return null;
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  G.mission = {
    index, stage: 0, spotsDone: 0, killNeed: 0, killGot: 0, timer: 0,
    onEnterSteal: null, onEnterMission: null, onEnterTruck: null, onGangDown: null,
  };
  const m = G.mission;
  if (index === 0) {
    const car = makeCar(G, 'coupe', 1060, 1440, Math.PI / 2);
    car.missionCar = 'mission';
    m.onEnterMission = () => advance(G);
    setDialog(G, 'carmen', "Nico, you're back. Drive my Azul GT to Pier 9 — the stash is waiting.", 6);
  }
  if (index === 1) {
    const car = makeCar(G, 'muscle', 1440, 1060, 0);
    car.missionCar = 'steal'; car.stolen = true;
    m.onEnterSteal = () => advance(G);
    setDialog(G, 'carmen', 'That red Falcon GT belongs to the Vipers. Take it to Rico — quietly.', 6);
  }
  if (index === 3) {
    m.timer = 95;
    addWanted(G, 3, 'chase');
    setDialog(G, 'carmen', 'Timed drop, Nico. The Yards, 95 seconds. The cops are already on you.', 6);
  }
  if (index === 4) {
    setDialog(G, 'carmen', "The Vipers' warehouse. Clear it out and grab the ledger.", 6);
  }
  if (index === 5) {
    const truck = makeCar(G, 'truck', 1400, 800, Math.PI / 2);
    truck.missionCar = 'truck'; truck.stolen = true;
    m.onEnterTruck = () => { addWanted(G, 4, 'truck'); advance(G); };
    setDialog(G, 'dante', 'That truck is MINE, Reyes. My crew does not miss.', 6);
  }
  if (index === 2) {
    setDialog(G, 'carmen', 'Three debts, three stops. Collect them all — and watch your back.', 6);
  }
}

function advance(G) {
  const m = G.mission;
  const def = MISSIONS[m.index];
  m.stage++;
  m.spotsDone = 0; m.killGot = 0;
  if (m.stage >= def.stages.length) completeMission(G);
  else {
    const st = def.stages[m.stage];
    if (st.type === 'clear') {
      spawnGang(G, st.x, st.y, st.count);
      m.killNeed = st.count;
      m.onGangDown = (n) => { m.killGot += n; };
    }
    if (st.type === 'timed') m.timer = st.seconds;
  }
}

function completeMission(G) {
  const m = G.mission;
  const def = MISSIONS[m.index];
  const p = G.player;
  p.cash += def.reward;
  p.stats.cashEarned += def.reward;
  p.stats.missions++;
  p.respect = Math.min(100, p.respect + 12);
  AudioSys.jingle();
  setDialog(G, 'carmen', `Job done. $${def.reward} is yours, Nico. Debt left: $${Math.max(0, 50000 - p.stats.cashEarned)}.`, 6);
  saveGame(G);
  if (m.index + 1 >= MISSIONS.length) {
    G.mode = 'ending';
    return;
  }
  startMission(G, m.index + 1);
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m || m.index < 0 || G.mode !== 'play') return;
  const def = MISSIONS[m.index];
  const st = def.stages[m.stage];
  if (!st) return;
  const p = G.player;
  if (st.type === 'timed') {
    m.timer -= dt;
    if (m.timer <= 0) {
      setDialog(G, 'carmen', 'Too slow — Carmen gives you another shot. The drop resets.', 5);
      startMission(G, m.index);
      return;
    }
  }
  const dx = st.x !== undefined ? p.x - st.x : 0;
  const dy = st.y !== undefined ? p.y - st.y : 0;
  const d = Math.hypot(dx, dy);
  if (st.type === 'goto' && d < 48) advance(G);
  else if (st.type === 'deliver' && d < 64) {
    if (m.index === 1) { p.wanted = 0; }
    advance(G);
  } else if (st.type === 'collect') {
    const spot = st.spots[m.spotsDone];
    if (Math.hypot(p.x - spot[0], p.y - spot[1]) < 48) {
      p.cash += 200; p.stats.cashEarned += 200;
      m.spotsDone++;
      spawnGang(G, spot[0], spot[1], 2);
      setDialog(G, 'carmen', `Debt ${m.spotsDone} of 3 collected. Keep moving.`, 4);
      if (m.spotsDone >= st.spots.length) advance(G);
    }
  } else if (st.type === 'clear' && m.killGot >= m.killNeed && m.killNeed > 0) {
    advance(G);
  }
}

export function missionObjective(G) {
  const m = G.mission;
  if (!m || m.index < 0) return { name: 'Free Roam', obj: 'Explore Azure Bay', next: 'Visit Carmen', stage: '—' };
  const def = MISSIONS[m.index];
  const st = def.stages[Math.min(m.stage, def.stages.length - 1)];
  let obj = st.obj;
  if (st.type === 'collect') obj = `Collect 3 debts across town (${m.spotsDone}/3)`;
  if (st.type === 'clear') obj = `Clear the warehouse (${m.killGot}/${m.killNeed})`;
  if (st.type === 'timed') obj = `Timed delivery to The Yards (${Math.ceil(m.timer)}s)`;
  return { name: def.name, obj, next: st.next, stage: `${m.stage + 1}/${def.stages.length}` };
}
