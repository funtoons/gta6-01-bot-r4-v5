// Synthesized sound only (WebAudio, no audio files). All noise comes from a
// seeded LCG buffer, so the sound path is deterministic in structure.
import { RNG } from './random.js';
import { RADIO } from './config.js';

export const AudioSys = {
  ctx: null, master: null, engineOsc: null, engineGain: null, sirenOsc: null,
  sirenGain: null, radioTimer: 0, radioChord: 0, radioOn: false, station: 0,
  muted: false, started: false,
  unlock() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.started = true;
    } catch (e) { this.started = false; }
  },
  noiseBuffer(dur) {
    const rng = new RNG(99);
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (rng.next() * 2 - 1) * (1 - i / len);
    return buf;
  },
  blip(freq, dur, type, vol, when) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + (when || 0);
    const o = this.ctx.createOscillator();
    o.type = type || 'sine'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  shot() {
    if (!this.ctx || this.muted) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuffer(0.14);
    const g = this.ctx.createGain(); g.gain.value = 0.3;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
  },
  punch() { this.blip(90, 0.12, 'sine', 0.3); },
  pickup() { this.blip(660, 0.1, 'sine', 0.2); this.blip(990, 0.14, 'sine', 0.2, 0.09); },
  jingle() { [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.18, i * 0.11)); },
  fail() { [330, 262, 196].forEach((f, i) => this.blip(f, 0.25, 'triangle', 0.16, i * 0.13)); },
  engine(speed01, inCar) {
    if (!this.ctx) return;
    this.engineGain.gain.value = this.muted ? 0 : (inCar ? 0.05 + speed01 * 0.06 : 0);
    this.engineOsc.frequency.value = 55 + speed01 * 130;
  },
  siren(on, tick) {
    if (!this.ctx) return;
    this.sirenGain.gain.value = (on && !this.muted) ? 0.035 : 0;
    if (on) this.sirenOsc.frequency.value = (Math.floor(tick / 30) % 2 === 0) ? 720 : 960;
  },
  radioTick(dt, inCar) {
    if (!this.ctx) return;
    this.radioTimer += dt;
    if (this.radioTimer < 2 || !inCar || this.muted) return;
    this.radioTimer = 0;
    const st = RADIO[this.station];
    const chord = st.chords[this.radioChord % st.chords.length];
    this.radioChord++;
    const base = 220;
    chord.forEach((semi) => {
      const f = base * Math.pow(2, semi / 12);
      this.blip(f, 1.8, 'triangle', 0.045);
      this.blip(f / 2, 1.8, 'sine', 0.05);
    });
  },
  setStation(i) { this.station = ((i % RADIO.length) + RADIO.length) % RADIO.length; this.radioChord = 0; },
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.35; },
};
