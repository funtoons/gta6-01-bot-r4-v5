// World rendering: blit the prerendered city, then draw markers and every
// entity sorted by y. Camera is a 1280x720 window into the 3200x2400 world.
import { CFG, RACE_COURSES } from './config.js';
import { districtAt } from './world.js';
import { missionMarker } from './missions.js';

export function updateCamera(G) {
  const p = G.player;
  const tx = Math.max(0, Math.min(CFG.worldW - 1280, p.x - 640));
  const ty = Math.max(0, Math.min(CFG.worldH - 720, p.y - 360));
  G.cam.x += (tx - G.cam.x) * 0.2;
  G.cam.y += (ty - G.cam.y) * 0.2;
}

function drawCarShape(c, car, t) {
  c.save();
  c.translate(car.x, car.y);
  c.rotate(car.angle);
  // Shadow.
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.fillRect(-22, -10, 46, 24);
  // Body.
  c.fillStyle = car.wreck ? '#2b2b30' : car.color;
  roundRect(c, -22, -11, 44, 22, 5);
  c.fill();
  // Cabin + windows.
  c.fillStyle = car.wreck ? '#1a1a1e' : '#1f2a3a';
  roundRect(c, -8, -9, 16, 18, 3);
  c.fill();
  c.fillStyle = 'rgba(180,220,255,0.55)';
  c.fillRect(-6, -8, 4, 16);
  // Headlights (front = +x).
  c.fillStyle = '#fff8c8';
  c.fillRect(20, -9, 3, 4);
  c.fillRect(20, 5, 3, 4);
  // Taillights.
  c.fillStyle = '#ff3b30';
  c.fillRect(-23, -9, 3, 4);
  c.fillRect(-23, 5, 3, 4);
  // Police light bar.
  if (car.isPolice && !car.wreck) {
    c.fillStyle = (Math.floor(t / 12) % 2 === 0) ? '#ff2a2a' : '#2a6bff';
    c.fillRect(-4, -11, 8, 4);
    c.fillStyle = (Math.floor(t / 12) % 2 === 0) ? '#2a6bff' : '#ff2a2a';
    c.fillRect(-4, 7, 8, 4);
  }
  // Taxi sign.
  if (car.type === 'taxi') {
    c.fillStyle = '#f5c518';
    c.fillRect(-6, -13, 12, 4);
    c.fillStyle = '#111';
    c.font = 'bold 5px sans-serif';
    c.fillText('TAXI', -5, -9.5);
  }
  // Plate on the player's Azul GT.
  if (car.isPlayer) {
    c.fillStyle = '#f5f0dc';
    c.fillRect(-24, -3, 8, 6);
    c.fillStyle = '#111';
    c.font = 'bold 4px sans-serif';
    c.fillText('AZR', -23.5, 1.5);
  }
  c.restore();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawPedShape(c, ped, t, opts) {
  const o = opts || {};
  c.save();
  c.translate(ped.x, ped.y);
  // Shadow.
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.ellipse(0, 10, 7, 3, 0, 0, Math.PI * 2); c.fill();
  const walk = Math.sin(t * 0.12 + ped.x * 0.05) * 3;
  // Legs.
  c.fillStyle = '#22304a';
  c.fillRect(-4, 4 + walk * 0.4, 3, 7);
  c.fillRect(1, 4 - walk * 0.4, 3, 7);
  // Torso.
  c.fillStyle = o.shirt || ped.shirt;
  roundRect(c, -5, -5, 10, 11, 3);
  c.fill();
  // Arms.
  c.fillStyle = o.skin || ped.skin;
  c.fillRect(-7, -4, 2, 8);
  c.fillRect(5, -4, 2, 8);
  // Head.
  c.beginPath(); c.arc(0, -9, 5, 0, Math.PI * 2); c.fill();
  // Hair / hat.
  c.fillStyle = o.hair || '#2a2018';
  c.beginPath(); c.arc(0, -10, 5, Math.PI, Math.PI * 2); c.fill();
  if (o.gang) {
    c.fillStyle = '#c81e1e';
    c.fillRect(-5, -12, 10, 3);
  }
  if (o.cop) {
    c.fillStyle = '#1b2a4a';
    c.fillRect(-5, -14, 10, 3);
  }
  c.restore();
  // Speech bubble.
  if (ped.bubble) {
    c.save();
    c.font = '11px system-ui, sans-serif';
    const w = c.measureText(ped.bubble).width + 14;
    const bx = ped.x - w / 2, by = ped.y - 38;
    c.fillStyle = 'rgba(255,255,255,0.94)';
    roundRect(c, bx, by, w, 18, 6);
    c.fill();
    c.beginPath(); c.moveTo(ped.x - 4, by + 18); c.lineTo(ped.x + 4, by + 18); c.lineTo(ped.x, by + 24); c.closePath(); c.fill();
    c.fillStyle = '#111';
    c.fillText(ped.bubble, bx + 7, by + 13);
    c.restore();
  }
}

export function renderWorld(G) {
  const c = G.ctx;
  const cam = G.cam;
  const shx = G.shake > 0 ? (G.rng.next() - 0.5) * G.shake : 0;
  const shy = G.shake > 0 ? (G.rng.next() - 0.5) * G.shake : 0;
  c.save();
  c.translate(-Math.round(cam.x + shx), -Math.round(cam.y + shy));
  // Prerendered city.
  c.drawImage(G.world.canvas, 0, 0);
  // Skid marks.
  c.strokeStyle = 'rgba(20,16,12,0.5)';
  c.lineWidth = 3;
  for (const s of G.skids) {
    c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + Math.cos(s.a) * 14, s.y + Math.sin(s.a) * 14); c.stroke();
  }
  // Mission / fare / race markers.
  const mk = missionMarker(G);
  if (mk) drawMarker(c, mk.x, mk.y, '#ffd94a', G.tick);
  if (G.taxiFare) drawMarker(c, G.taxiFare.x, G.taxiFare.y, '#f5c518', G.tick);
  if (G.race) {
    const rc = RACE_COURSES[G.race.course];
    const cp = rc.points[G.race.cp + 1];
    if (cp) drawMarker(c, cp[0], cp[1], '#7cfc9a', G.tick);
  }
  // Packages (sparkle when close).
  const p = G.player;
  for (const pk of G.packages) {
    if (pk.got) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) > 420) continue;
    c.fillStyle = '#ffd94a';
    c.save(); c.translate(pk.x, pk.y); c.rotate(G.tick * 0.02);
    c.fillRect(-4, -4, 8, 8);
    c.restore();
  }
  // Entities sorted by y.
  const ents = [];
  for (const ped of G.peds) ents.push({ y: ped.y, kind: 'ped', e: ped });
  for (const g of G.gang) ents.push({ y: g.y, kind: 'gang', e: g });
  for (const cop of G.copPeds) ents.push({ y: cop.y, kind: 'cop', e: cop });
  for (const car of G.cars) ents.push({ y: car.y, kind: 'car', e: car });
  ents.push({ y: p.y + 1, kind: 'player', e: p });
  ents.sort((a, b) => a.y - b.y);
  for (const ent of ents) {
    if (ent.kind === 'ped') drawPedShape(c, ent.e, G.tick);
    else if (ent.kind === 'gang') drawPedShape(c, ent.e, G.tick, { gang: true, shirt: '#3a3a44', skin: '#c98d5e', hair: '#111' });
    else if (ent.kind === 'cop') drawPedShape(c, ent.e, G.tick, { cop: true, shirt: '#1b2a4a', skin: '#f0c8a0', hair: '#1b2a4a' });
    else if (ent.kind === 'car') drawCarShape(c, ent.e, G.tick);
    else if (ent.kind === 'player' && !p.inCar) drawPlayerShape(c, p, G.tick);
  }
  // Heli spotlight + heli.
  if (G.heli) {
    const grd = c.createRadialGradient(p.x, p.y, 10, p.x, p.y, 150);
    grd.addColorStop(0, 'rgba(255,240,180,0.20)');
    grd.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = grd;
    c.beginPath(); c.arc(p.x, p.y, 150, 0, Math.PI * 2); c.fill();
    c.save();
    c.translate(G.heli.x, G.heli.y);
    c.fillStyle = 'rgba(0,0,0,0.30)';
    c.beginPath(); c.ellipse(4, 8, 16, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2b3442';
    c.beginPath(); c.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#c8ccd4';
    c.lineWidth = 2;
    const ra = G.tick * 0.9;
    c.beginPath(); c.moveTo(-22 * Math.cos(ra), -22 * Math.sin(ra)); c.lineTo(22 * Math.cos(ra), 22 * Math.sin(ra)); c.stroke();
    c.restore();
  }
  // Particles.
  for (const pt of G.particles) {
    c.globalAlpha = Math.max(0, pt.life / pt.max);
    c.fillStyle = pt.color;
    c.beginPath(); c.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // Floaters.
  c.font = 'bold 13px system-ui, sans-serif';
  c.textAlign = 'center';
  for (const f of G.floaters) {
    c.globalAlpha = Math.max(0, f.life / f.max);
    c.fillStyle = f.color;
    c.fillText(f.text, f.x, f.y);
  }
  c.globalAlpha = 1;
  c.textAlign = 'left';
  // Pickup icons.
  for (const pk of G.pickups) {
    c.fillStyle = pk.kind === 'health' ? '#ff5e6e' : pk.kind === 'armor' ? '#93c5fd' : '#ffd94a';
    c.fillRect(pk.x - 7, pk.y - 7, 14, 14);
    c.fillStyle = '#111';
    c.font = 'bold 9px sans-serif';
    c.fillText(pk.kind === 'health' ? 'H' : pk.kind === 'armor' ? 'A' : '+', pk.x - 3, pk.y + 3);
  }
  c.restore();
}

function drawMarker(c, x, y, color, tick) {
  const pulse = 1 + Math.sin(tick * 0.08) * 0.15;
  c.save();
  c.translate(x, y);
  c.strokeStyle = color;
  c.lineWidth = 3;
  c.beginPath(); c.arc(0, 0, 26 * pulse, 0, Math.PI * 2); c.stroke();
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, -16); c.lineTo(10, 0); c.lineTo(0, 16); c.lineTo(-10, 0); c.closePath();
  c.fill();
  c.fillStyle = '#111';
  c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill();
  c.restore();
}

function drawPlayerShape(c, p, t) {
  drawPedShape(c, { x: p.x, y: p.y, shirt: '#2dd4bf', skin: '#e8b98a', bubble: '', angle: p.angle }, t, { shirt: '#2dd4bf', skin: '#e8b98a', hair: '#141414' });
  // Aim line when armed.
  if (p.weapon !== 'fists') {
    c.save();
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(p.aim) * 40, p.y + Math.sin(p.aim) * 40); c.stroke();
    c.restore();
  }
}

export function districtNameAt(G) {
  return districtAt(G.player.x, G.player.y).name;
}
