// Dense HUD (top-3 structure): mission + dispatch top-left, money/wanted
// top-right, round minimap + health bottom-left, dialog bottom-center,
// speed + car + weapons bottom-right, radio bar. Plus title/pause/map/
// busted/wasted/ending screens.
import { CFG, DISTRICTS, WEAPONS, RADIO, SHOPS, RACE_COURSES } from './config.js';
import { missionObjective, missionMarker } from './missions.js';
import { policeUnits } from './police.js';
import { districtNameAt } from './render.js';
import { hasSave } from './save.js';

function panel(c, x, y, w, h, alpha) {
  c.fillStyle = `rgba(10,12,20,${alpha || 0.72})`;
  c.beginPath();
  c.roundRect(x, y, w, h, 8);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.18)';
  c.lineWidth = 1;
  c.stroke();
}

function bar(c, x, y, w, h, frac, color) {
  c.fillStyle = 'rgba(255,255,255,0.15)';
  c.fillRect(x, y, w, h);
  c.fillStyle = color;
  c.fillRect(x, y, Math.max(0, Math.min(w, w * frac)), h);
}

function clockStr(G) {
  const mins = 1060 + Math.floor(G.tick / 120);
  const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function drawHud(G) {
  const c = G.ctx;
  const p = G.player;
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  // --- Top-left: mission panel.
  const mo = missionObjective(G);
  panel(c, 12, 12, 300, 118, 0.72);
  c.fillStyle = '#ffd94a';
  c.font = 'bold 15px system-ui, sans-serif';
  c.fillText(mo.name.toUpperCase(), 22, 34);
  c.fillStyle = '#fff';
  c.font = '12px system-ui, sans-serif';
  c.fillText(`STAGE ${mo.stage}`, 22, 52);
  const stageFrac = mo.stage === '—' ? 1 : (parseInt(mo.stage.split('/')[0], 10) - 1) / parseInt(mo.stage.split('/')[1], 10);
  bar(c, 22, 58, 140, 6, stageFrac, '#ffd94a');
  c.fillStyle = '#e8e8e8';
  c.font = '12px system-ui, sans-serif';
  wrapText(c, mo.obj, 22, 78, 280, 14);
  c.fillStyle = '#9ecbff';
  c.fillText(`NEXT: ${mo.next}`, 22, 120);
  const mk = missionMarker(G);
  if (mk) {
    c.fillStyle = '#ffd94a';
    c.font = 'bold 12px system-ui, sans-serif';
    c.fillText(`${Math.round(Math.hypot(mk.x - p.x, mk.y - p.y))}m`, 250, 52);
  }
  // --- Dispatch panel (5 units).
  const units = policeUnits(G);
  panel(c, 12, 138, 300, 30 + units.length * 18 + 8, 0.66);
  c.fillStyle = '#7cc7ff';
  c.font = 'bold 12px system-ui, sans-serif';
  c.fillText('AZURE PD DISPATCH', 22, 158);
  c.font = '12px system-ui, sans-serif';
  units.forEach((u, i) => {
    const y = 176 + i * 18;
    c.fillStyle = '#fff';
    c.fillText(u.name, 22, y);
    c.fillStyle = '#c8c8c8';
    c.fillText(`${u.dist}m`, 90, y);
    c.fillStyle = u.role === 'ROADBLOCK' ? '#ff8a7a' : '#ffd94a';
    c.fillText(u.role, 150, y);
  });
  if (units.length === 0) {
    c.fillStyle = '#c8c8c8';
    c.fillText('No units in pursuit.', 22, 176);
  }
  // --- Top-right: money, wanted, clock, alert.
  panel(c, 1008, 12, 260, 96, 0.72);
  c.fillStyle = '#7cfc9a';
  c.font = 'bold 26px system-ui, sans-serif';
  c.fillText(`$${p.cash.toLocaleString('en-US')}`, 1022, 42);
  c.font = 'bold 16px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    c.fillStyle = i < p.wanted ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    c.fillText('★', 1022 + i * 24, 66);
  }
  c.fillStyle = '#fff';
  c.font = '13px system-ui, sans-serif';
  c.fillText(clockStr(G), 1180, 66);
  if (p.wanted >= 3) {
    c.fillStyle = '#ff8a7a';
    c.font = 'bold 12px system-ui, sans-serif';
    c.fillText(G.heli ? 'HELI OVERHEAD — STAY LOW' : 'HIGH ALERT', 1022, 92);
  } else if (p.wanted > 0) {
    c.fillStyle = '#ffd94a';
    c.font = 'bold 12px system-ui, sans-serif';
    c.fillText('WANTED — BREAK LINE OF SIGHT', 1022, 92);
  }
  // --- Bottom-left: round minimap + district + health/armour.
  const mx = 104, my = 606, mr = 88;
  c.save();
  c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.clip();
  // Minimap canvas is the whole world at 1/16 scale; show a 900-unit
  // window around the player, centred on the circle.
  const k = (mr * 2) / 900;
  c.drawImage(G.world.minimap, mx - p.x * k, my - p.y * k, 3200 * k, 2400 * k);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.5)';
  c.lineWidth = 2;
  c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.stroke();
  // Player dot + mission marker dot on the minimap.
  c.fillStyle = '#2dd4bf';
  c.beginPath(); c.arc(mx, my, 4, 0, Math.PI * 2); c.fill();
  if (mk) {
    const dx = (mk.x - p.x) * k, dy = (mk.y - p.y) * k;
    const dl = Math.hypot(dx, dy);
    const cl = Math.min(dl, mr - 8) / Math.max(1, dl);
    c.fillStyle = '#ffd94a';
    c.beginPath(); c.arc(mx + dx * cl, my + dy * cl, 5, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = '#fff';
  c.font = 'bold 13px system-ui, sans-serif';
  c.fillText(districtNameAt(G).toUpperCase(), 214, 596);
  c.font = '11px system-ui, sans-serif';
  c.fillStyle = '#c8c8c8';
  c.fillText('HEALTH', 214, 622);
  bar(c, 214, 628, 150, 9, p.health / 100, '#7cfc9a');
  c.fillText('ARMOUR', 214, 654);
  bar(c, 214, 660, 150, 9, p.armor / 100, '#93c5fd');
  // --- Bottom-center: dialog.
  if (G.dialog && G.dialog.t > 0) {
    const who = G.dialog.who;
    const meta = {
      carmen: ['CARMEN VEGA', 'Fixer', '#e07ab8'],
      dante: ['DANTE CRUZ', 'The Vipers', '#c81e1e'],
      dispatch: ['AZURE PD', 'Dispatch', '#7cc7ff'],
      shop: ['SHOPKEEPER', 'Azure Bay', '#ffd94a'],
    }[who] || ['NICO REYES', 'Driver', '#2dd4bf'];
    panel(c, 400, 592, 480, 108, 0.8);
    c.fillStyle = meta[2];
    c.beginPath(); c.arc(432, 630, 20, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111';
    c.font = 'bold 14px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText(meta[0][0], 432, 635);
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.font = 'bold 13px system-ui, sans-serif';
    c.fillText(meta[0], 462, 622);
    c.fillStyle = '#9ecbff';
    c.font = '11px system-ui, sans-serif';
    c.fillText(meta[1], 462, 638);
    c.fillStyle = '#f0f0f0';
    c.font = '13px system-ui, sans-serif';
    wrapText(c, G.dialog.text, 462, 658, 400, 16);
  }
  // --- Radio bar (above dialog).
  const st = RADIO[G.radio.station];
  panel(c, 480, 566, 320, 22, 0.6);
  c.fillStyle = '#ffd94a';
  c.font = 'bold 11px system-ui, sans-serif';
  c.fillText(`♪ ${st.name} — ${st.tag}`, 492, 581);
  c.fillStyle = '#c8c8c8';
  c.fillText('[Q] radio', 740, 581);
  // --- Prompt.
  if (G.prompt) {
    c.fillStyle = '#fff';
    c.font = 'bold 13px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText(G.prompt, 640, 548);
    c.textAlign = 'left';
  }
  // --- Bottom-right: speed + car + condition + weapons.
  panel(c, 1008, 600, 260, 100, 0.72);
  const mph = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 0.12) : Math.round(p.speed * 0.06);
  c.fillStyle = '#fff';
  c.font = 'bold 40px system-ui, sans-serif';
  c.textAlign = 'right';
  c.fillText(String(mph), 1240, 644);
  c.font = '12px system-ui, sans-serif';
  c.fillStyle = '#c8c8c8';
  c.fillText('mph', 1252, 644);
  c.textAlign = 'left';
  c.fillStyle = '#ffd94a';
  c.font = 'bold 13px system-ui, sans-serif';
  c.fillText(p.inCar ? p.inCar.name.toUpperCase() : 'ON FOOT', 1022, 622);
  if (p.inCar) {
    c.fillStyle = '#c8c8c8';
    c.font = '11px system-ui, sans-serif';
    c.fillText(`CONDITION ${Math.round((p.inCar.hp / p.inCar.maxHp) * 100)}%`, 1022, 640);
    bar(c, 1022, 648, 120, 6, p.inCar.hp / p.inCar.maxHp, '#ff8a7a');
  }
  const slots = [['1', 'FISTS', 'fists'], ['2', 'PISTOL', 'pistol'], ['3', 'SMG', 'smg'], ['4', 'SHOTGUN', 'shotgun']];
  slots.forEach(([key, label, w], i) => {
    const x = 1022 + i * 62;
    c.fillStyle = p.weapon === w ? 'rgba(255,217,74,0.35)' : 'rgba(255,255,255,0.08)';
    c.fillRect(x, 668, 56, 20);
    c.fillStyle = p.weapon === w ? '#ffd94a' : '#c8c8c8';
    c.font = 'bold 10px system-ui, sans-serif';
    c.fillText(`${key} ${label}`, x + 3, 682);
  });
  // --- Crew chips (right edge).
  const crew = [['CV', 'Carmen', '#e07ab8'], ['DC', 'Dante', '#c81e1e'], ['BE', 'Big Eddie', '#f5c518']];
  crew.forEach(([init, name, col], i) => {
    const y = 300 + i * 44;
    c.fillStyle = col;
    c.beginPath(); c.arc(1252, y, 16, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111';
    c.font = 'bold 11px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText(init, 1252, y + 4);
    c.textAlign = 'left';
  });
  // --- Alerts (taxi timer / race timer / wanted evade).
  if (G.taxiFare) {
    c.fillStyle = '#ffd94a';
    c.font = 'bold 14px system-ui, sans-serif';
    c.fillText(`FARE: ${Math.ceil(G.taxiFare.t)}s — ${Math.round(Math.hypot(G.taxiFare.x - p.x, G.taxiFare.y - p.y))}m`, 500, 40);
  }
  if (G.race) {
    c.fillStyle = '#7cfc9a';
    c.font = 'bold 14px system-ui, sans-serif';
    c.fillText(`RACE ${RACE_COURSES[G.race.course].name}: CP ${G.race.cp + 1}/${RACE_COURSES[G.race.course].points.length - 1} — ${Math.ceil(G.race.t)}s`, 500, 40);
  }
  if (G.mission && G.mission.timer > 0) {
    c.fillStyle = '#ff8a7a';
    c.font = 'bold 16px system-ui, sans-serif';
    c.fillText(`${Math.ceil(G.mission.timer)}s`, 620, 40);
  }
}

function wrapText(c, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (c.measureText(test).width > maxW && line) {
      c.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) c.fillText(line, x, yy);
}

// --- Screens ---
export function drawTitle(G) {
  const c = G.ctx;
  const grd = c.createLinearGradient(0, 0, 0, 720);
  grd.addColorStop(0, '#1a1030');
  grd.addColorStop(0.55, '#3a1a4a');
  grd.addColorStop(1, '#0e2a4a');
  c.fillStyle = grd;
  c.fillRect(0, 0, 1280, 720);
  // Skyline silhouette.
  c.fillStyle = 'rgba(0,0,0,0.35)';
  const rng = G.rng;
  for (let x = 0; x < 1280; x += 46) {
    const h = 120 + ((x * 37) % 160);
    c.fillRect(x, 720 - h - 180, 40, h);
  }
  c.fillStyle = '#ffd94a';
  c.font = 'bold 64px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('AZURE BAY', 640, 220);
  c.fillStyle = '#fff';
  c.font = 'bold 22px system-ui, sans-serif';
  c.fillText('A GTA-STYLE OPEN WORLD', 640, 258);
  c.font = '16px system-ui, sans-serif';
  c.fillStyle = '#d8d8d8';
  c.fillText('Nico Reyes owes Big Eddie $50,000. Six jobs. One city. No way out but through.', 640, 292);
  c.textAlign = 'left';
  G.ui.buttons = [];
  const save = hasSave();
  const bx = 490;
  button(G, bx, 340, 300, 52, 'NEW GAME', 'new');
  if (save) button(G, bx, 404, 300, 52, 'CONTINUE', 'continue');
  c.fillStyle = '#c8c8c8';
  c.font = '13px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('WASD move / drive  •  E enter car  •  Mouse aim, Click shoot  •  1-4 weapons', 640, 500);
  c.fillText('M map  •  P pause  •  Q radio  •  T taxi fare  •  V vigilante  •  R race', 640, 524);
  c.fillText('Steal cars, dodge the Azure PD, clear your debt.', 640, 548);
  c.textAlign = 'left';
}

function button(G, x, y, w, h, label, action) {
  const c = G.ctx;
  c.fillStyle = 'rgba(255,217,74,0.9)';
  c.beginPath(); c.roundRect(x, y, w, h, 8); c.fill();
  c.fillStyle = '#111';
  c.font = 'bold 18px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText(label, x + w / 2, y + 33);
  c.textAlign = 'left';
  G.ui.buttons.push({ x, y, w, h, action });
}

export function drawPause(G) {
  const c = G.ctx;
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.fillRect(0, 0, 1280, 720);
  c.fillStyle = '#fff';
  c.font = 'bold 40px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('PAUSED', 640, 260);
  c.textAlign = 'left';
  G.ui.buttons = [];
  button(G, 490, 300, 300, 52, 'RESUME', 'resume');
  button(G, 490, 364, 300, 52, 'SAVE & TITLE', 'title');
}

export function drawMap(G) {
  const c = G.ctx;
  c.fillStyle = 'rgba(8,10,18,0.92)';
  c.fillRect(0, 0, 1280, 720);
  c.fillStyle = '#fff';
  c.font = 'bold 24px system-ui, sans-serif';
  c.fillText('AZURE BAY — CITY MAP', 190, 60);
  c.font = '13px system-ui, sans-serif';
  c.fillStyle = '#c8c8c8';
  c.fillText('M / Esc to close  •  Yellow diamond = mission  •  Teal dot = you', 190, 84);
  const mw = 720, mh = 540;
  const mx = 190, my = 100;
  c.drawImage(G.world.minimap, mx, my, mw, mh);
  c.strokeStyle = 'rgba(255,255,255,0.4)';
  c.strokeRect(mx, my, mw, mh);
  const s = mw / CFG.worldW;
  const p = G.player;
  const mk = missionMarker(G);
  if (mk) {
    c.fillStyle = '#ffd94a';
    c.beginPath(); c.arc(mx + mk.x * s, my + mk.y * s, 7, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = '#2dd4bf';
  c.beginPath(); c.arc(mx + p.x * s, my + p.y * s, 6, 0, Math.PI * 2); c.fill();
  // District labels.
  c.font = 'bold 13px system-ui, sans-serif';
  c.fillStyle = 'rgba(255,255,255,0.9)';
  for (const d of DISTRICTS) {
    c.fillText(d.name.toUpperCase(), mx + d.x0 * s + 6, my + d.y0 * s + 6);
  }
  // Career stats on the right.
  const st = p.stats;
  const sx = 940, sy = 120;
  c.fillStyle = '#fff';
  c.font = 'bold 16px system-ui, sans-serif';
  c.fillText('CAREER', sx, sy);
  c.font = '13px system-ui, sans-serif';
  const rows = [
    ['Missions done', st.missions],
    ['Cash earned', `$${st.cashEarned}`],
    ['Cars stolen', st.carsStolen],
    ['Taxi fares', st.fares],
    ['Packages', `${st.packages}/20`],
    ['Races won', st.racesWon],
    ['Gang down', st.gangDown],
    ['Busted', st.busted],
    ['Wasted', st.wasted],
    ['Time played', `${Math.floor(st.timeMin)} min`],
  ];
  rows.forEach(([k, v], i) => {
    c.fillStyle = '#c8c8c8';
    c.fillText(k, sx, sy + 30 + i * 22);
    c.fillStyle = '#fff';
    c.fillText(String(v), sx + 110, sy + 30 + i * 22);
  });
}

export function drawBusted(G) {
  overlayScreen(G, 'BUSTED', 'The Azure PD caught you. 15% of your cash is gone — bail paid, back on the street.', '#7cc7ff');
}

export function drawWasted(G) {
  overlayScreen(G, 'WASTED', 'You blacked out. The hospital patched you up — the debt is still waiting.', '#ff8a7a');
}

function overlayScreen(G, title, sub, color) {
  const c = G.ctx;
  c.fillStyle = 'rgba(0,0,0,0.72)';
  c.fillRect(0, 0, 1280, 720);
  c.fillStyle = color;
  c.font = 'bold 56px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText(title, 640, 330);
  c.fillStyle = '#fff';
  c.font = '16px system-ui, sans-serif';
  c.fillText(sub, 640, 372);
  c.fillStyle = '#ffd94a';
  c.font = 'bold 16px system-ui, sans-serif';
  c.fillText('Press ENTER to continue', 640, 420);
  c.textAlign = 'left';
}

export function drawEnding(G) {
  const c = G.ctx;
  c.fillStyle = '#0e2a1a';
  c.fillRect(0, 0, 1280, 720);
  c.fillStyle = '#7cfc9a';
  c.font = 'bold 52px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('DEBT CLEARED', 640, 240);
  c.fillStyle = '#fff';
  c.font = '20px system-ui, sans-serif';
  c.fillText('Nico Reyes paid Big Eddie $50,000. Azure Bay is his now.', 640, 286);
  const st = G.player.stats;
  c.font = '16px system-ui, sans-serif';
  c.fillText(`Missions ${st.missions}  •  Cash earned $${st.cashEarned}  •  Cars stolen ${st.carsStolen}  •  Packages ${st.packages}/20`, 640, 330);
  c.fillStyle = '#ffd94a';
  c.font = 'bold 16px system-ui, sans-serif';
  c.fillText('Press ENTER for free roam', 640, 380);
  c.textAlign = 'left';
}
