// Azure Bay city generation: seeded road grid, blocks, varied buildings,
// palms, lamps, beach and marina. The static world is pre-rendered once to an
// offscreen canvas so each frame only blits the visible region.
import { CFG, DISTRICTS } from './config.js';
import { RNG } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[0];
}

export function isRoad(x, y) {
  const hw = CFG.roadW / 2 + 2;
  for (const ax of CFG.avenues) if (Math.abs(x - ax) <= hw) return true;
  for (const sy of CFG.streets) if (Math.abs(y - sy) <= hw) return true;
  return false;
}

export function nearestRoad(x, y) {
  let bx = CFG.avenues[0], bd = Math.abs(x - bx);
  for (const ax of CFG.avenues) { const d = Math.abs(x - ax); if (d < bd) { bd = d; bx = ax; } }
  let by = CFG.streets[0]; bd = Math.abs(y - by);
  for (const sy of CFG.streets) { const d = Math.abs(y - sy); if (d < bd) { bd = d; by = sy; } }
  if (Math.abs(x - bx) <= Math.abs(y - by)) return { x: bx, y };
  return { x, y: by };
}

export function buildWorld(seed) {
  const rng = new RNG(seed);
  const world = {
    W: CFG.worldW, H: CFG.worldH,
    buildings: [], palms: [], lamps: [], packages: [], ramps: [],
    intersections: [], parks: [],
  };
  for (const ax of CFG.avenues) {
    for (const sy of CFG.streets) world.intersections.push({ x: ax, y: sy, phase: rng.int(0, 479) });
  }
  // Blocks between avenues/streets.
  for (let i = 0; i < CFG.avenues.length - 1; i++) {
    for (let j = 0; j < CFG.streets.length - 1; j++) {
      const bx0 = CFG.avenues[i] + 26, bx1 = CFG.avenues[i + 1] - 26;
      const by0 = CFG.streets[j] + 26, by1 = CFG.streets[j + 1] - 26;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const d = districtAt(cx, cy);
      if (rng.chance(0.14)) { world.parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }); continue; }
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const w = rng.range(70, (bx1 - bx0) / n - 14);
        const h = rng.range(60, (by1 - by0) - 14);
        const x = bx0 + 8 + (k * (bx1 - bx0)) / n + rng.range(0, 10);
        const y = by0 + 8 + rng.range(0, Math.max(1, (by1 - by0) - h - 16));
        const roof = rng.pick(d.roof);
        const wall = shade(roof, rng.range(-18, 18));
        world.buildings.push({
          x, y, w: Math.min(w, bx1 - x - 8), h: Math.min(h, by1 - y - 8),
          roof, wall, height: rng.range(10, 42), lit: rng.next(),
          sign: rng.chance(0.4) ? rng.pick(['MARKET', 'HOTEL', 'CAFE', 'GYM', 'CLUB', 'OFFICE', 'DOCK 9', 'PIER 4', 'TACOS', 'LAUNDRY']) : '',
        });
      }
    }
  }
  // Palms and lamps along roads.
  for (const ax of CFG.avenues) {
    for (let y = 120; y < CFG.worldH - 80; y += 170) {
      if (rng.chance(0.75)) world.palms.push({ x: ax + 34, y: y + rng.range(-20, 20), r: rng.range(9, 14) });
      if (rng.chance(0.5)) world.lamps.push({ x: ax - 34, y });
    }
  }
  for (const sy of CFG.streets) {
    for (let x = 120; x < CFG.worldW - 80; x += 190) {
      if (rng.chance(0.6)) world.palms.push({ x: x + rng.range(-20, 20), y: sy + 34, r: rng.range(9, 14) });
    }
  }
  // Hidden packages on sidewalks (never inside a building or on a road).
  let guard = 0;
  while (world.packages.length < 20 && guard++ < 800) {
    const x = rng.range(120, CFG.worldW - 120), y = rng.range(120, CFG.worldH - 120);
    if (isRoad(x, y)) continue;
    if (world.buildings.some((b) => x > b.x - 14 && x < b.x + b.w + 14 && y > b.y - 14 && y < b.y + b.h + 14)) continue;
    world.packages.push({ x, y, got: false });
  }
  world.ramps = [{ x: 1400, y: 1100, dir: 'h' }, { x: 2200, y: 1700, dir: 'v' }];
  world.canvas = prerender(world, rng);
  world.minimap = prerenderMinimap(world);
  return world;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function prerender(world, rng) {
  const cv = document.createElement('canvas');
  cv.width = CFG.worldW; cv.height = CFG.worldH;
  const c = cv.getContext('2d');
  // District ground.
  for (const d of DISTRICTS) { c.fillStyle = d.ground; c.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); }
  // Beach + water on the east edge.
  c.fillStyle = '#d9c58a'; c.fillRect(3040, 0, 70, CFG.worldH);
  c.fillStyle = '#2a7ab8'; c.fillRect(3110, 0, 90, CFG.worldH);
  c.fillStyle = '#3a9ad8';
  for (let y = 40; y < CFG.worldH; y += 130) c.fillRect(3120, y, 60, 4);
  // Marina docks (north-east).
  c.fillStyle = '#6e4a2a';
  c.fillRect(2960, 260, 130, 10); c.fillRect(2960, 380, 130, 10);
  c.fillStyle = '#e8e8f2';
  for (let i = 0; i < 5; i++) { c.fillRect(2970 + i * 24, 272, 16, 34); c.fillRect(2970 + i * 24, 392, 16, 34); }
  // Sidewalks (block borders).
  c.fillStyle = '#4a4450';
  for (let i = 0; i < CFG.avenues.length - 1; i++) {
    for (let j = 0; j < CFG.streets.length - 1; j++) {
      c.fillRect(CFG.avenues[i] + 24, CFG.streets[j] + 24, CFG.avenues[i + 1] - CFG.avenues[i] - 48, CFG.streets[j + 1] - CFG.streets[j] - 48);
    }
  }
  // Parks.
  for (const p of world.parks) {
    c.fillStyle = '#2e5a2e'; c.fillRect(p.x, p.y, p.w, p.h);
    c.fillStyle = '#3f7a3f';
    const pr = new RNG(Math.floor(p.x + p.y));
    for (let i = 0; i < 8; i++) {
      c.beginPath(); c.arc(p.x + 20 + pr.range(0, p.w - 40), p.y + 20 + pr.range(0, p.h - 40), 12, 0, 7); c.fill();
    }
  }
  // Roads.
  c.fillStyle = '#23232e';
  for (const ax of CFG.avenues) c.fillRect(ax - 24, 0, 48, CFG.worldH);
  for (const sy of CFG.streets) c.fillRect(0, sy - 24, CFG.worldW, 48);
  // Lane dashes.
  c.fillStyle = '#d8c25a';
  for (const ax of CFG.avenues) {
    for (let y = 0; y < CFG.worldH; y += 44) {
      if (CFG.streets.some((s) => Math.abs(y + 10 - s) < 40)) continue;
      c.fillRect(ax - 2, y, 4, 22);
    }
  }
  for (const sy of CFG.streets) {
    for (let x = 0; x < CFG.worldW; x += 44) {
      if (CFG.avenues.some((a) => Math.abs(x + 10 - a) < 40)) continue;
      c.fillRect(x, sy - 2, 22, 4);
    }
  }
  // Crosswalks at intersections.
  c.fillStyle = '#d8d8e0';
  for (const it of world.intersections) {
    for (let k = -3; k <= 3; k++) {
      c.fillRect(it.x - 20 + k * 6, it.y - 34, 3, 12);
      c.fillRect(it.x - 20 + k * 6, it.y + 22, 3, 12);
      c.fillRect(it.x - 34, it.y - 20 + k * 6, 12, 3);
      c.fillRect(it.x + 22, it.y - 20 + k * 6, 12, 3);
    }
  }
  // Ramps.
  c.fillStyle = '#f5c518';
  for (const r of world.ramps) {
    if (r.dir === 'h') { for (let k = 0; k < 5; k++) c.fillRect(r.x - 30 + k * 12, r.y - 16, 6, 32); }
    else { for (let k = 0; k < 5; k++) c.fillRect(r.x - 16, r.y - 30 + k * 12, 32, 6); }
  }
  // Buildings, sorted by y so south faces overlap correctly.
  const sorted = [...world.buildings].sort((a, b) => a.y - b.y);
  for (const b of sorted) {
    const s = b.height * 0.45;
    c.fillStyle = shade(b.wall, -30);
    c.fillRect(b.x + 4, b.y + 4 + s * 0.4, b.w, b.h); // south face shadow-side
    c.fillStyle = b.wall;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.fillStyle = b.roof;
    c.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    // Roof details: AC boxes, skylight, vents.
    c.fillStyle = shade(b.roof, -25);
    c.fillRect(b.x + 8, b.y + 8, 12, 10);
    c.fillRect(b.x + b.w - 22, b.y + b.h - 20, 14, 10);
    c.fillStyle = shade(b.roof, 25);
    c.fillRect(b.x + b.w / 2 - 10, b.y + b.h / 2 - 6, 20, 12);
    // Lit windows across the roof (read as lit windows from above).
    const wr = new RNG(Math.floor(b.x * 7 + b.y * 13));
    const cols = Math.max(2, Math.floor((b.w - 16) / 22)), rows = Math.max(1, Math.floor((b.h - 16) / 24));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const lit = wr.next() < b.lit;
        c.fillStyle = lit ? '#ffd94a' : '#2a2438';
        c.fillRect(b.x + 10 + i * 22, b.y + 10 + j * 24, 11, 9);
      }
    }
    if (b.sign) {
      c.fillStyle = '#111118';
      c.fillRect(b.x + 6, b.y - 2, b.sign.length * 7 + 8, 14);
      c.fillStyle = '#ffe9a8';
      c.font = 'bold 10px sans-serif';
      c.fillText(b.sign, b.x + 10, b.y + 9);
    }
  }
  // Palms and lamps (drawn over roads edges).
  for (const p of world.palms) {
    c.strokeStyle = '#6e4a2a'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 3, p.y - 12); c.stroke();
    c.fillStyle = '#2e8a3e';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      c.beginPath(); c.ellipse(p.x + 3 + Math.cos(a) * p.r * 0.7, p.y - 12 + Math.sin(a) * p.r * 0.5, p.r, 4, a, 0, 7); c.fill();
    }
  }
  for (const l of world.lamps) {
    c.fillStyle = '#888'; c.fillRect(l.x - 1, l.y - 8, 2, 8);
    c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(l.x, l.y - 9, 3, 0, 7); c.fill();
  }
  return cv;
}

function prerenderMinimap(world) {
  const cv = document.createElement('canvas');
  cv.width = 200; cv.height = 150;
  const c = cv.getContext('2d');
  const sx = 200 / CFG.worldW, sy = 150 / CFG.worldH;
  c.fillStyle = '#14101e'; c.fillRect(0, 0, 200, 150);
  c.fillStyle = '#3a3a48';
  for (const ax of CFG.avenues) c.fillRect(ax * sx - 1, 0, 2, 150);
  for (const sy2 of CFG.streets) c.fillRect(0, sy2 * sy - 1, 200, 2);
  c.fillStyle = '#2a7ab8'; c.fillRect(3110 * sx, 0, 90 * sx, 150);
  c.fillStyle = '#d9c58a'; c.fillRect(3040 * sx, 0, 70 * sx, 150);
  return cv;
}

export function pointInBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return b;
  }
  return null;
}

export function trafficLightAt(world, x, y, tick) {
  let best = null, bd = 1e9;
  for (const it of world.intersections) {
    const d = Math.abs(x - it.x) + Math.abs(y - it.y);
    if (d < bd) { bd = d; best = it; }
  }
  if (!best || bd > 90) return null;
  const ph = (tick + best.phase) % 480;
  return ph < 220 ? 'ns' : ph < 240 ? 'nsY' : ph < 460 ? 'ew' : 'ewY';
}
