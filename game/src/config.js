// Azure Bay tuning constants, district/car/weapon/mission data.
// All names, story and lines are original to this game.
export const CFG = {
  worldW: 3200, worldH: 2400,
  viewW: 1280, viewH: 720,
  seed: 20261124,
  walkSpeed: 175, sprintSpeed: 265,
  roadW: 48,
  avenues: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  streets: [200, 500, 800, 1100, 1400, 1700, 2000, 2300],
  saveKey: 'azurebay-save-v1',
  resprayCost: 150,
  packageReward: 100,
};

// Districts: 3 columns x 2 rows over the city grid.
export const DISTRICTS = [
  { name: 'NEON MILE', x0: 0, y0: 0, x1: 1067, y1: 1200, ground: '#3a2a4d', accent: '#ff4fd8', roof: ['#5b2a6e', '#7a2a8e', '#4a1f5e'] },
  { name: 'MARINA BAY', x0: 1067, y0: 0, x1: 2133, y1: 1200, ground: '#1f3a44', accent: '#37e0c8', roof: ['#2a5a6e', '#2f6e7a', '#24505e'] },
  { name: 'PALM COURT', x0: 2133, y0: 0, x1: 3200, y1: 1200, ground: '#3d4a26', accent: '#ffd94a', roof: ['#6e5a2a', '#7a6a35', '#5e4a22'] },
  { name: 'THE YARDS', x0: 0, y0: 1200, x1: 1067, y1: 2400, ground: '#3a3630', accent: '#ff8c2a', roof: ['#5e5648', '#6e6250', '#4e463c'] },
  { name: 'SUNNYSIDE', x0: 1067, y0: 1200, x1: 2133, y1: 2400, ground: '#4a3a26', accent: '#ffe9a8', roof: ['#8e6a3a', '#9a7a45', '#7a5a30'] },
  { name: 'BAYSIDE', x0: 2133, y0: 1200, x1: 3200, y1: 2400, ground: '#27455e', accent: '#6ec8ff', roof: ['#3a6a8e', '#457a9e', '#2f5a7a'] },
];

export const CARS = {
  sedan:   { name: 'Vela Sedan',  color: '#4a90d9', max: 520, accel: 340, turn: 2.6, hp: 100 },
  coupe:   { name: 'Azul GT',     color: '#14b8a6', max: 640, accel: 430, turn: 2.9, hp: 90 },
  muscle:  { name: 'Falcon GT',   color: '#e04a3a', max: 600, accel: 470, turn: 2.5, hp: 110 },
  van:     { name: 'Harbor Van',  color: '#e8e0c8', max: 420, accel: 280, turn: 2.1, hp: 140 },
  taxi:    { name: 'Azure Cab',   color: '#f5c518', max: 540, accel: 360, turn: 2.7, hp: 100 },
  police:  { name: 'Azure PD',    color: '#f2f2f2', max: 620, accel: 460, turn: 2.9, hp: 130 },
  truck:   { name: 'Cash Truck',   color: '#8a94a6', max: 460, accel: 300, turn: 2.0, hp: 220 },
};

export const WEAPONS = {
  fists:   { name: 'Fists',   slot: 1, ammo: Infinity, dmg: 12, rate: 320, range: 46 },
  pistol:  { name: 'Pistol',  slot: 2, ammo: 48,  dmg: 22, rate: 260, range: 420 },
  smg:     { name: 'SMG',     slot: 3, ammo: 90,  dmg: 13, rate: 95,  range: 360 },
  shotgun: { name: 'Shotgun', slot: 4, ammo: 24,  dmg: 34, rate: 650, range: 260 },
};

export const RADIO = [
  { name: 'AZURE 98.1', tag: 'Coastal Pop', chords: [[0, 4, 7], [5, 9, 12], [3, 7, 10], [5, 9, 12]] },
  { name: 'VISTA 96.4', tag: 'Sunset Rock', chords: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]] },
  { name: 'PALMA 101.2', tag: 'Harbor Nights', chords: [[0, 5, 7], [3, 7, 10], [7, 11, 14], [5, 8, 12]] },
];

export const PED_LINES = [
  'Best tacos on Neon Mile, trust me.',
  'The Vipers own the harbor after dark.',
  'Did you see the Azure GT? What a car.',
  'Rent is due and my cab never came.',
  'Golden hour makes this city glow.',
  'Carmen runs this town, everyone knows.',
  'I heard the cash truck rolls at noon.',
  'The cops are everywhere tonight.',
  'Marina Bay at sunset, nothing better.',
  'My cousin drives a taxi, ask him.',
  'The Yards smell like diesel and rain.',
  'Nico Reyes is back? Big Eddie will hear.',
];

export const DIALOG = {
  carmen: { name: 'Carmen Vega', role: 'FIXER', color: '#c084fc' },
  nico: { name: 'Nico Reyes', role: 'DRIVER', color: '#2dd4bf' },
  dante: { name: 'Dante Cruz', role: 'RIVAL', color: '#f87171' },
  dispatch: { name: 'Azure PD', role: 'DISPATCH', color: '#93c5fd' },
};

// Mission defs: stages drive the mission engine in missions.js.
// Stage types: goto (reach marker), enter (enter a marked car), deliver (drive marker),
// collect (visit N markers), clear (defeat N gang at a spot), timed (reach marker in time).
export const MISSIONS = [
  { name: 'Back in Town', stages: [
    { type: 'goto', x: 1000, y: 1360, obj: "Walk to Carmen's Diner", next: "Take Carmen's Azul GT" },
    { type: 'enter', car: 'mission', obj: "Get in Carmen's Azul GT", next: 'Drive to the stash' },
    { type: 'deliver', x: 2200, y: 500, obj: 'Drive the stash car to Pier 9', next: 'FINISH' },
  ], reward: 850 },
  { name: 'Hot Wheels', stages: [
    { type: 'enter', car: 'steal', obj: 'Steal the marked Falcon GT', next: 'Lose the heat, then deliver' },
    { type: 'deliver', x: 2600, y: 2000, obj: "Deliver it to Rico's Chop Shop", next: 'FINISH' },
  ], reward: 1200 },
  { name: 'Collection Run', stages: [
    { type: 'collect', spots: [[600, 800], [1800, 1700], [2600, 800]], obj: 'Collect 3 debts across town (0/3)', next: 'Return to Carmen' },
    { type: 'goto', x: 1000, y: 1360, obj: 'Bring the cash back to Carmen', next: 'FINISH' },
  ], reward: 1500 },
  { name: 'The Drop', stages: [
    { type: 'timed', x: 600, y: 2000, seconds: 95, obj: 'Timed delivery to The Yards (95s)', next: 'FINISH' },
  ], reward: 1800 },
  { name: 'Harbor Heat', stages: [
    { type: 'goto', x: 300, y: 2000, obj: "Reach the Vipers' warehouse", next: 'Clear the warehouse' },
    { type: 'clear', x: 300, y: 2000, count: 5, obj: 'Clear the warehouse (0/5)', next: 'Grab the ledger' },
    { type: 'goto', x: 360, y: 2060, obj: 'Grab the ledger and get out', next: 'FINISH' },
  ], reward: 2200 },
  { name: 'Payday', stages: [
    { type: 'enter', car: 'truck', obj: "Hijack the Vipers' cash truck", next: 'Survive the 4-star chase' },
    { type: 'deliver', x: 1000, y: 1360, obj: "Deliver the truck to Carmen's Diner", next: 'FINISH' },
  ], reward: 5000 },
];

export const SHOPS = {
  gun: { name: 'Harbor Arms', x: 600, y: 1700 },
  spray1: { name: 'Azure Spray', x: 1800, y: 1100 },
  spray2: { name: 'Azure Spray', x: 1000, y: 2000 },
  diner: { name: "Carmen's Diner", x: 1000, y: 1360 },
  chop: { name: "Rico's Chop Shop", x: 2600, y: 2000 },
  warehouse: { name: 'Viper Warehouse', x: 300, y: 2000 },
};

export const RACE_COURSES = [
  { name: 'Neon Sprint', points: [[1000, 1400], [1800, 1400], [1800, 500], [1000, 500]] },
  { name: 'Bay Loop', points: [[2200, 1100], [2600, 1700], [2200, 2000], [1400, 2000]] },
  { name: 'Yard Dash', points: [[600, 1400], [600, 2000], [1400, 2000], [1400, 1400]] },
];
