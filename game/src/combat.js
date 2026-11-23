// Weapons, shooting, gang AI, pickups. Hitscan with a short cooldown;
// gunfire raises the wanted level and scares nearby pedestrians.
import { WEAPONS } from './config.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { spawnSparks, spawnSmallExplosion, addFloater } from './effects.js';
import { addWanted } from './police.js';
import { damagePlayer } from './player.js';

export function spawnGang(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    G.gang.push({
      x: x + G.rng.range(-60, 60), y: y + G.rng.range(-60, 60),
      hp: 60, angle: 0, shootT: G.rng.range(0.5, 1.5), speed: 95,
      shirt: '#3a3a44', skin: '#c98d5e',
    });
  }
}

export function updateCombat(G, dt) {
  const p = G.player;
  G.shootCd = Math.max(0, (G.shootCd || 0) - dt);
  G.gunshotT = Math.max(0, (G.gunshotT || 0) - dt);
  G.crimeT = Math.max(0, (G.crimeT || 0) - dt);
  if (G.mode !== 'play') return;
  // Weapon switching.
  if (Input.wasPressed('Digit1')) p.weapon = 'fists';
  if (Input.wasPressed('Digit2') && p.ammo.pistol > 0) p.weapon = 'pistol';
  if (Input.wasPressed('Digit3') && p.ammo.smg > 0) p.weapon = 'smg';
  if (Input.wasPressed('Digit4') && p.ammo.shotgun > 0) p.weapon = 'shotgun';
  // Fire on click.
  if ((Input.mouse.clicked || Input.mouse.down) && G.shootCd <= 0 && !p.inCar) {
    const w = WEAPONS[p.weapon];
    if (p.weapon === 'fists') {
      G.shootCd = w.rate / 1000;
      const ax = p.x + Math.cos(p.aim) * 30, ay = p.y + Math.sin(p.aim) * 30;
      let hit = false;
      for (const g of G.gang) {
        if (Math.hypot(g.x - ax, g.y - ay) < 34) { g.hp -= w.dmg; hit = true; }
      }
      if (hit) spawnSparks(G, ax, ay, 3, '#ffffff');
    } else if (p.ammo[p.weapon] > 0) {
      p.ammo[p.weapon]--;
      G.shootCd = w.rate / 1000;
      G.gunshotT = 2;
      AudioSys.shot();
      const mx = p.x + Math.cos(p.aim) * 26, my = p.y + Math.sin(p.aim) * 26;
      spawnSparks(G, mx, my, 4, '#ffd94a');
      if (G.crimeT <= 0) { addWanted(G, 1, 'shots'); G.crimeT = 3; }
      // Hitscan: nearest gang / car / ped inside the aim cone.
      let best = null, bd = w.range;
      const aimDx = Math.cos(p.aim), aimDy = Math.sin(p.aim);
      for (const g of G.gang) {
        const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy);
        if (d < bd && (dx * aimDx + dy * aimDy) / Math.max(1, d) > 0.86) { bd = d; best = { kind: 'gang', e: g }; }
      }
      for (const car of G.cars) {
        if (car.isPlayer || car.wreck) continue;
        const dx = car.x - p.x, dy = car.y - p.y, d = Math.hypot(dx, dy);
        if (d < bd && (dx * aimDx + dy * aimDy) / Math.max(1, d) > 0.86) { bd = d; best = { kind: 'car', e: car }; }
      }
      if (best) {
        if (best.kind === 'gang') {
          best.e.hp -= w.dmg;
          spawnSparks(G, best.e.x, best.e.y, 5, '#ff6a5e');
        } else {
          best.e.hp -= w.dmg;
          best.e.damage += w.dmg;
          spawnSparks(G, best.e.x, best.e.y, 5, '#ffd94a');
          if (best.e.hp <= 0 && !best.e.wreck) {
            best.e.wreck = true;
            spawnSmallExplosion(G, best.e.x, best.e.y);
          }
        }
      }
    }
  }
  // Gang AI: close in, shoot when in range.
  for (const g of G.gang) {
    if (g.hp <= 0) continue;
    const dx = p.x - g.x, dy = p.y - g.y;
    const d = Math.hypot(dx, dy);
    g.angle = Math.atan2(dy, dx);
    if (d > 240) {
      g.x += Math.cos(g.angle) * g.speed * dt;
      g.y += Math.sin(g.angle) * g.speed * dt;
    } else {
      g.shootT -= dt;
      if (g.shootT <= 0) {
        g.shootT = 1.6;
        spawnSparks(G, g.x + Math.cos(g.angle) * 20, g.y + Math.sin(g.angle) * 20, 3, '#ff9a2a');
        if (d < 320 && G.rng.chance(0.55)) damagePlayer(G, 8);
      }
    }
  }
  const before = G.gang.length;
  G.gang = G.gang.filter((g) => g.hp > 0);
  const down = before - G.gang.length;
  if (down > 0) {
    p.stats.gangDown += down;
    G.mission.onGangDown?.(down);
    if (G.rng.chance(0.5)) G.pickups.push({ x: p.x + 40, y: p.y + 30, kind: 'ammo' });
  }
  // Pickups.
  for (const pk of G.pickups) {
    if (pk.got) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30 && !p.inCar) {
      pk.got = true;
      if (pk.kind === 'health') { p.health = Math.min(100, p.health + 40); addFloater(G, p.x, p.y - 20, '+40 HEALTH', '#7CFC9a'); }
      if (pk.kind === 'armor') { p.armor = Math.min(100, p.armor + 50); addFloater(G, p.x, p.y - 20, '+50 ARMOUR', '#93c5fd'); }
      if (pk.kind === 'ammo') { p.ammo.pistol += 24; p.ammo.smg += 30; addFloater(G, p.x, p.y - 20, '+AMMO', '#ffd94a'); }
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.got);
}
