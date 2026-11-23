// localStorage save/load. Deterministic: only plain game state, no
// timestamps or paths.
const KEY = 'azurebay.save.v1';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      cash: p.cash, health: p.health, armor: p.armor, weapon: p.weapon,
      ammo: p.ammo, respect: p.respect, x: Math.round(p.x), y: Math.round(p.y),
      mission: G.mission ? G.mission.index : -1,
      stats: p.stats, timeMin: p.stats.timeMin,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function hasSave() {
  return !!loadSave();
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
