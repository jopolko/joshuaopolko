/* Smushlings Quest - synth sound effects and chiptune music, all WebAudio, no files */

let ac = null, master = null, sfxBus = null, musBus = null;
let muted = false, musicOn = true;
try {
  const a = JSON.parse(localStorage.getItem('sq3_audio') || '{}');
  muted = !!a.muted; musicOn = a.music !== false;
} catch (e) { }
function savePrefs() { try { localStorage.setItem('sq3_audio', JSON.stringify({ muted, music: musicOn })); } catch (e) { } }

function init() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(ac.destination);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  comp.connect(master);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
  musBus = ac.createGain(); musBus.gain.value = musicOn ? 0.32 : 0; musBus.connect(comp);
}

let noiseBuf = null;
function getNoise() {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function tone(f, d, type = 'square', vol = 0.12, slide = 0, delay = 0, dest = null, at = null) {
  if (!ac || muted) return;
  const t0 = (at ?? ac.currentTime) + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(dest || sfxBus);
  o.start(t0); o.stop(t0 + d + 0.02);
}
function noise(d, vol = 0.12, freq = 2000, delay = 0, q = 0.8, dest = null, at = null, sweep = 0) {
  if (!ac || muted) return;
  const t0 = (at ?? ac.currentTime) + delay;
  const s = ac.createBufferSource(); s.buffer = getNoise();
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t0 + d);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(f); f.connect(g); g.connect(dest || sfxBus);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + d + 0.02);
}

/* rate-limit identical sounds so a 12-enemy wipe doesn't clip */
const last = {};
function lim(name, gap) {
  const n = performance.now();
  if (last[name] && n - last[name] < gap) return false;
  last[name] = n; return true;
}

const sfx = {
  shoot() { if (lim('shoot', 40)) { tone(640, 0.07, 'square', 0.045, -260); noise(0.05, 0.03, 3000); } },
  fire() { if (lim('shoot', 40)) { noise(0.16, 0.08, 900, 0, 0.7, null, null, -500); tone(260, 0.1, 'sawtooth', 0.04, -120); } },
  hit() { if (lim('hit', 30)) { tone(220, 0.06, 'square', 0.08, -90); noise(0.05, 0.06, 1800); } },
  crit() { tone(880, 0.08, 'square', 0.08, 300); noise(0.08, 0.08, 4000); },
  ping() { if (lim('ping', 60)) tone(1500, 0.08, 'triangle', 0.06, 200); },
  kill() { if (lim('kill', 35)) { tone(520, 0.08, 'triangle', 0.1, 500); tone(980, 0.1, 'triangle', 0.07, 200, 0.05); noise(0.12, 0.07, 1200); } },
  coin() { if (lim('coin', 45)) { tone(1320, 0.05, 'square', 0.04); tone(1980, 0.09, 'square', 0.035, 0, 0.045); } },
  xp() { if (lim('xp', 50)) tone(1100 + Math.random() * 500, 0.05, 'sine', 0.04, 400); },
  hurt() { tone(300, 0.22, 'sawtooth', 0.12, -220); noise(0.18, 0.1, 700); },
  dash() { noise(0.16, 0.09, 1400, 0, 0.6, null, null, 1600); tone(300, 0.1, 'sine', 0.05, 300); },
  spin() { noise(0.2, 0.08, 600, 0, 1.2, null, null, 2400); tone(200, 0.15, 'triangle', 0.06, 260); },
  reflect() { tone(1200, 0.08, 'square', 0.06, 600); },
  stomp() { tone(120, 0.3, 'sine', 0.22, -80); noise(0.35, 0.18, 300, 0, 0.6); },
  frost() { for (let i = 0; i < 5; i++) tone(1600 + i * 240, 0.12, 'sine', 0.035, -300, i * 0.03); noise(0.3, 0.05, 6000); },
  burn() { if (lim('burn', 80)) noise(0.25, 0.07, 700, 0, 0.5, null, null, 900); },
  crumble() { noise(0.3, 0.14, 400, 0, 0.6); tone(90, 0.2, 'square', 0.06, -40); },
  chest() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.06, 0, i * 0.07)); },
  key() { tone(1568, 0.08, 'square', 0.06); tone(2093, 0.2, 'square', 0.06, 0, 0.08); },
  door() { tone(90, 0.25, 'square', 0.09, 40); noise(0.25, 0.1, 500); },
  unlock() { tone(700, 0.08, 'square', 0.07); tone(1050, 0.12, 'square', 0.07, 0, 0.08); noise(0.2, 0.08, 800, 0.1); },
  levelup() { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(f, 0.18, 'square', 0.06, 0, i * 0.06); tone(f / 2, 0.18, 'triangle', 0.06, 0, i * 0.06); }); },
  powerup() { for (let i = 0; i < 6; i++) tone(500 + i * 160, 0.08, 'square', 0.05, 0, i * 0.035); },
  cage() { noise(0.3, 0.12, 1500, 0, 0.5); tone(880, 0.1, 'triangle', 0.07, 0, 0.05); tone(1320, 0.2, 'triangle', 0.07, 0, 0.12); },
  friend() { tone(900, 0.07, 'sine', 0.07, 500); tone(1300, 0.1, 'sine', 0.07, 400, 0.08); },
  portal() { for (let i = 0; i < 10; i++) tone(300 + i * 90, 0.2, 'sine', 0.05, 200, i * 0.04); },
  roar() { tone(110, 0.8, 'sawtooth', 0.14, -50); tone(147, 0.8, 'sawtooth', 0.09, -60); noise(0.8, 0.14, 400, 0, 0.4); },
  boom() { if (lim('boom', 60)) { tone(80, 0.4, 'sine', 0.22, -50); noise(0.45, 0.2, 500, 0, 0.5, null, null, -350); } },
  eshot() { if (lim('eshot', 70)) tone(420, 0.06, 'triangle', 0.035, 160); },
  select() { tone(880, 0.05, 'square', 0.05); },
  deny() { tone(160, 0.12, 'square', 0.07); },
  heal() { [784, 988, 1175].forEach((f, i) => tone(f, 0.12, 'sine', 0.07, 0, i * 0.06)); },
  fall() { tone(600, 0.5, 'sine', 0.08, -500); },
  crystal() { tone(1760, 0.12, 'sine', 0.06); tone(2637, 0.18, 'sine', 0.04, 0, 0.04); },
  combo() { tone(1000, 0.06, 'square', 0.04, 400); },
  egg() { [784, 988, 1175, 1568, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.2, 'square', 0.06, 0, i * 0.09)); },
  ability() { [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { tone(f, 0.3, 'square', 0.05, 0, i * 0.1); tone(f / 2, 0.3, 'triangle', 0.06, 0, i * 0.1); }); },
  victory() { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.06, 0, i * 0.12)); },
  shield() { tone(500, 0.2, 'sine', 0.08, 500); },
};

/* ------------------------------------------------------------------ music
   Each song: bpm, root note, 4-chord progression (semitones from root, minor/major via
   chord tables), drum pattern and a fixed pseudo-random lead built once from a seed. */
const SONGS = {
  title: { bpm: 112, root: 57, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [4, 7, 11]], seed: 3, drums: 'x...h...s...h..x' },
  w0: { bpm: 128, root: 60, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], seed: 11, drums: 'x...h.x.s...h.h.' },
  w1: { bpm: 118, root: 58, scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4, 7], [2, 5, 9], [5, 9, 12], [7, 11, 14]], seed: 27, drums: 'x..hh.x.s..hh...' },
  w2: { bpm: 104, root: 55, scale: [0, 2, 3, 5, 7, 8, 10], prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], seed: 41, drums: 'x...h...s..xh...' },
  w3: { bpm: 140, root: 52, scale: [0, 2, 3, 5, 7, 8, 11], prog: [[0, 3, 7], [5, 8, 12], [7, 11, 14], [0, 3, 7]], seed: 53, drums: 'x.h.s.hxx.h.s.hh' },
  boss: { bpm: 150, root: 50, scale: [0, 1, 3, 5, 7, 8, 10], prog: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [10, 13, 17]], seed: 66, drums: 'x.hxs.h.x.hxs.hs' },
  win: { bpm: 120, root: 60, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]], seed: 9, drums: 'x...h...s...h...' },
};
function seeded(s) { return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function buildLead(song) {
  const R = seeded(song.seed * 9973 + 1), n = 64, out = [];
  let deg = 2;
  for (let i = 0; i < n; i++) {
    const beat = i % 4 === 0;
    if (!beat && R() < 0.45) { out.push(null); continue; }
    if (i % 16 === 14 || i % 16 === 15) { out.push(null); continue; }
    const step = R() < 0.6 ? (R() < 0.5 ? 1 : -1) : (R() < 0.5 ? 2 : -2);
    deg = Math.max(0, Math.min(song.scale.length * 2 - 1, deg + step));
    if (beat) { // snap toward a chord tone on beats
      const chord = song.prog[(i / 16) | 0];
      const semi = song.scale[deg % song.scale.length] + 12 * ((deg / song.scale.length) | 0);
      let best = semi, bd = 99;
      for (const c of chord) for (const o of [0, 12, 24]) { const d = Math.abs(c % 12 + o - semi); if (d < bd) { bd = d; best = c % 12 + o; } }
      out.push(best);
    } else out.push(song.scale[deg % song.scale.length] + 12 * ((deg / song.scale.length) | 0));
  }
  return out;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let cur = null, curName = '', nextT = 0, stepI = 0, timer = null;
function schedule() {
  if (!ac || !cur) return;
  const spb = 60 / cur.bpm / 4;
  while (nextT < ac.currentTime + 0.12) {
    const s = stepI % 64, bar = (s / 16) | 0, chord = cur.prog[bar], t = nextT;
    if (!muted && musicOn) {
      const r = cur.root;
      if (s % 4 === 0 || s % 16 === 10) tone(mtof(r - 12 + chord[0]), spb * 1.8, 'triangle', 0.16, 0, 0, musBus, t);
      if (s % 2 === 0) tone(mtof(r + 12 + chord[(s / 2) % 3]), spb * 0.9, 'square', 0.025, 0, 0, musBus, t);
      const ld = cur.lead[s];
      if (ld !== null) tone(mtof(r + 12 + ld), spb * 1.7, 'square', 0.04, 0, 0, musBus, t);
      const d = cur.drums[s % 16];
      if (d === 'x') tone(150, 0.14, 'sine', 0.3, -110, 0, musBus, t);
      else if (d === 's') noise(0.12, 0.12, 1800, 0, 0.7, musBus, t);
      else if (d === 'h') noise(0.03, 0.05, 8000, 0, 1, musBus, t);
    }
    nextT += spb; stepI++;
  }
}
function music(name) {
  if (name === curName) return;
  curName = name;
  const s = SONGS[name];
  if (!s) { cur = null; return; }
  if (!s.lead) s.lead = buildLead(s);
  cur = s; stepI = 0;
  if (ac) nextT = ac.currentTime + 0.05;
  if (!timer) timer = setInterval(schedule, 30);
}

export const Snd = {
  init() { init(); if (cur && ac) nextT = Math.max(nextT, ac.currentTime + 0.05); },
  play(n) { if (sfx[n]) sfx[n](); },
  music,
  get muted() { return muted; },
  get musicOn() { return musicOn; },
  toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.55; savePrefs(); return muted; },
  toggleMusic() { musicOn = !musicOn; if (musBus) musBus.gain.value = musicOn ? 0.32 : 0; savePrefs(); return musicOn; },
};
