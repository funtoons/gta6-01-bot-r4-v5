// Particles, skid marks, floating texts and screen shake. Explosions here
// are deliberately SMALL (smoke + a few sparks), never a screen-filling blob.
export function spawnSmoke(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    G.particles.push({
      kind: 'smoke', x: x + G.rng.range(-14, 14), y: y + G.rng.range(-14, 14),
      vx: G.rng.range(-24, 24), vy: G.rng.range(-30, -6), life: G.rng.range(0.5, 1.1),
      max: 1.1, r: G.rng.range(5, 11), color: '#8a8a92',
    });
  }
}

export function spawnSparks(G, x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = G.rng.range(0, Math.PI * 2), s = G.rng.range(60, 240);
    G.particles.push({
      kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: G.rng.range(0.15, 0.4), max: 0.4, r: G.rng.range(1.5, 3), color: color || '#ffd94a',
    });
  }
}

export function spawnSmallExplosion(G, x, y) {
  spawnSparks(G, x, y, 12, '#ff9a2a');
  spawnSparks(G, x, y, 6, '#ffd94a');
  spawnSmoke(G, x, y, 7);
  G.shake = Math.max(G.shake, 5);
}

export function addFloater(G, x, y, text, color) {
  G.floaters.push({ x, y, text, color: color || '#ffe9a8', life: 1.2 });
}

export function addSkid(G, x, y, angle) {
  G.skids.push({ x, y, angle, life: 5 });
  if (G.skids.length > 220) G.skids.shift();
}

export function updateEffects(G, dt) {
  for (const p of G.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
    p.life -= dt;
  }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const f of G.floaters) { f.y -= 26 * dt; f.life -= dt; }
  G.floaters = G.floaters.filter((f) => f.life > 0);
  for (const s of G.skids) s.life -= dt;
  G.skids = G.skids.filter((s) => s.life > 0);
  G.shake = Math.max(0, G.shake - dt * 22);
}

export function drawEffects(c, G, cam) {
  for (const s of G.skids) {
    c.save();
    c.translate(s.x - cam.x, s.y - cam.y);
    c.rotate(s.angle);
    c.globalAlpha = Math.min(0.5, s.life * 0.12);
    c.fillStyle = '#0c0c12';
    c.fillRect(-9, -2, 18, 4);
    c.restore();
  }
  c.globalAlpha = 1;
  for (const p of G.particles) {
    c.globalAlpha = Math.max(0, p.life / p.max);
    c.fillStyle = p.color;
    c.beginPath(); c.arc(p.x - cam.x, p.y - cam.y, p.r, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
  c.font = 'bold 13px sans-serif';
  c.textAlign = 'center';
  for (const f of G.floaters) {
    c.globalAlpha = Math.max(0, Math.min(1, f.life));
    c.fillStyle = f.color;
    c.fillText(f.text, f.x - cam.x, f.y - cam.y);
  }
  c.globalAlpha = 1;
  c.textAlign = 'left';
}
