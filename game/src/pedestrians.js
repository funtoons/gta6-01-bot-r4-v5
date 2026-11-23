// Pedestrians: they walk the sidewalks, cross at crosswalks, chat in
// speech bubbles, and flee gunfire and crashes. Drawn as readable figures
// (head, torso, legs), never stick figures.
import { CFG, PED_LINES } from './config.js';
import { isRoad, nearestRoad } from './world.js';

const SHIRTS = ['#e04a3a', '#4a90d9', '#f5c518', '#7a4fd0', '#37b86e', '#e07ab8', '#e8e0c8', '#ff8c2a'];

export function spawnPeds(G) {
  G.peds = [];
  for (let i = 0; i < 34; i++) spawnPed(G, true);
}

function spawnPed(G, anywhere) {
  const p = G.player;
  let x, y, tries = 0;
  do {
    const a = G.rng.range(0, Math.PI * 2);
    const d = anywhere ? G.rng.range(80, 700) : G.rng.range(500, 750);
    x = p.x + Math.cos(a) * d;
    y = p.y + Math.sin(a) * d;
    tries++;
  } while ((x < 60 || x > CFG.worldW - 60 || y < 60 || y > CFG.worldH - 60 || isRoad(x, y)) && tries < 20);
  const near = nearestRoad(x, y);
  const ped = {
    x: near.x + (G.rng.chance(0.5) ? 34 : -34), y: near.y + (G.rng.chance(0.5) ? 34 : -34),
    angle: G.rng.range(0, Math.PI * 2), speed: G.rng.range(28, 62),
    state: 'walk', shirt: G.rng.pick(SHIRTS), skin: G.rng.pick(['#f0c8a0', '#c98d5e', '#8a5a34', '#f5d7b0']),
    bubble: '', bubbleT: 0, fleeT: 0, axis: Math.abs(x - near.x) < Math.abs(y - near.y) ? 'v' : 'h',
  };
  ped.x = Math.max(40, Math.min(CFG.worldW - 40, ped.x));
  ped.y = Math.max(40, Math.min(CFG.worldH - 40, ped.y));
  G.peds.push(ped);
  return ped;
}

export function updatePeds(G, dt) {
  const p = G.player;
  // Keep the crowd dense near the player.
  if (G.peds.length < 30) spawnPed(G, false);
  if (G.peds.length < 34 && G.rng.chance(dt * 0.4)) spawnPed(G, false);
  // Rotate speech bubbles among the nearest peds.
  G.bubbleT -= dt;
  if (G.bubbleT <= 0) {
    G.bubbleT = 5;
    for (const ped of G.peds) ped.bubble = '';
    const near = [...G.peds].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 3);
    for (const ped of near) {
      ped.bubble = G.rng.pick(PED_LINES);
      ped.bubbleT = 5;
    }
  }
  for (const ped of G.peds) {
    ped.bubbleT = Math.max(0, ped.bubbleT - dt);
    if (ped.bubbleT <= 0) ped.bubble = '';
    ped.fleeT = Math.max(0, ped.fleeT - dt);
    const pd = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (G.gunshotT > 0 && pd < 260) ped.fleeT = 2.5;
    if (ped.fleeT > 0) {
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
      ped.angle = a;
      continue;
    }
    // Walk along the sidewalk: keep the road offset, drift along the axis.
    if (ped.axis === 'v') {
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      ped.x += (Math.sign(ped.x - nearestRoad(ped.x, ped.y).x || 1) * 0 + 0);
      if (G.rng.chance(dt * 0.05)) ped.angle = G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      if (ped.y < 60 || ped.y > CFG.worldH - 60) ped.angle += Math.PI;
    } else {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      if (G.rng.chance(dt * 0.05)) ped.angle = G.rng.chance(0.5) ? 0 : Math.PI;
      if (ped.x < 60 || ped.x > CFG.worldW - 60) ped.angle += Math.PI;
    }
    ped.x = Math.max(30, Math.min(CFG.worldW - 30, ped.x));
    ped.y = Math.max(30, Math.min(CFG.worldH - 30, ped.y));
    // Step onto a crosswalk now and then.
    if (G.rng.chance(dt * 0.02)) {
      const nr = nearestRoad(ped.x, ped.y);
      ped.x += (nr.x - ped.x) * 0.2;
      ped.y += (nr.y - ped.y) * 0.2;
    }
  }
  // Drop far peds, keep the local crowd.
  G.peds = G.peds.filter((ped) => Math.hypot(ped.x - p.x, ped.y - p.y) < 900);
}
