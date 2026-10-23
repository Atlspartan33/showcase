// Every sound is synthesized with WebAudio — no files to download, works offline, instant.
let ctx = null, master = null, noiseBuf = null;

export function unlock() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.8;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

const now = () => ctx.currentTime;

function env(g, t, vol, a, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(freq, { type = 'sine', vol = 0.3, a = 0.005, d = 0.3, to = null, at = 0, dest = master } = {}) {
  const t = now() + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
  env(g, t, vol, a, d);
  o.connect(g).connect(dest); o.start(t); o.stop(t + a + d + 0.05);
}

function noise({ vol = 0.3, d = 0.08, f = 1500, q = 1, type = 'bandpass', to = null, at = 0 } = {}) {
  const t = now() + at, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + d);
  env(g, t, vol, 0.002, d);
  s.connect(fl).connect(g).connect(master); s.start(t, Math.random() * 0.3); s.stop(t + d + 0.05);
}

const SFX = {
  pick: () => tone(700, { vol: 0.12, d: 0.05, type: 'triangle' }),
  pop: () => { tone(420, { to: 900, vol: 0.28, d: 0.12 }); noise({ vol: 0.08, d: 0.04, f: 3000 }); },
  flip: () => { tone(500, { to: 800, vol: 0.18, d: 0.08, type: 'triangle' }); tone(800, { to: 500, vol: 0.14, d: 0.08, type: 'triangle', at: 0.08 }); },
  poof: () => { noise({ vol: 0.3, d: 0.3, f: 2500, to: 300, q: 0.7 }); tone(300, { to: 120, vol: 0.15, d: 0.25 }); },
  nope: () => { tone(220, { vol: 0.2, d: 0.09, type: 'square' }); tone(180, { vol: 0.2, d: 0.12, type: 'square', at: 0.1 }); },
  go: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { vol: 0.22, d: 0.18, type: 'triangle', at: i * 0.08 })),
  gate: () => { noise({ vol: 0.25, d: 0.06, f: 900 }); tone(160, { vol: 0.25, d: 0.1 }); },
  reset: () => { tone(900, { to: 400, vol: 0.18, d: 0.18, type: 'triangle' }); noise({ vol: 0.1, d: 0.2, f: 1200, to: 3000 }); },
  wood: (v) => { noise({ vol: 0.12 * v, d: 0.035, f: 900 + Math.random() * 300, q: 3 }); tone(240, { vol: 0.12 * v, d: 0.05 }); },
  clack: (v) => { noise({ vol: 0.35 * v, d: 0.03, f: 2400 + Math.random() * 600, q: 4 }); tone(1300 + Math.random() * 200, { vol: 0.1 * v, d: 0.03, type: 'triangle' }); },
  crash: (v) => { noise({ vol: 0.3 * v, d: 0.06, f: 1600 + Math.random() * 1200, q: 2 }); tone(500 + Math.random() * 400, { vol: 0.08 * v, d: 0.05, type: 'square' }); },
  ball: (v) => tone(140, { to: 90, vol: 0.3 * v, d: 0.1 }),
  boing: (v) => { tone(160, { to: 620, vol: 0.35 * Math.max(v, 0.5), d: 0.28, type: 'sine' }); tone(330, { to: 1200, vol: 0.08, d: 0.2, type: 'triangle' }); },
  note: (v, f = 523) => {
    tone(f, { vol: 0.32 * Math.max(v, 0.5), d: 1.1 });
    tone(f * 2, { vol: 0.1, d: 0.5 });
    tone(f * 3.9, { vol: 0.05, d: 0.12 });
  },
  glass: (v) => { tone(1800 + Math.random() * 400, { vol: 0.12 * v, d: 0.25 }); tone(3100, { vol: 0.05 * v, d: 0.15 }); },
  metal: (v) => { [1, 2.76, 5.4].forEach((m, i) => tone(520 * m, { vol: (0.14 / (i + 1)) * v, d: 0.5 - i * 0.12 })); },
  car: () => {
    const t = now(), o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(210, t + 0.5); o.frequency.exponentialRampToValueAtTime(150, t + 1.1);
    f.type = 'lowpass'; f.frequency.value = 900;
    env(g, t, 0.28, 0.05, 1.1);
    o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 1.3);
    tone(900, { vol: 0.15, d: 0.1, type: 'square', at: 0.02 }); tone(900, { vol: 0.15, d: 0.12, type: 'square', at: 0.16 }); // beep beep
  },
  goal: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { vol: 0.25, d: 0.35, type: 'triangle', at: i * 0.07 }));
    [2093, 2637, 3136].forEach((f, i) => tone(f, { vol: 0.07, d: 0.4, at: 0.35 + i * 0.06 }));
    noise({ vol: 0.12, d: 0.6, f: 4000, q: 0.5, at: 0.3 });
  },
  // ---- science
  strike: () => { noise({ vol: 0.35, d: 0.12, f: 3500, q: 1.5, to: 1800 }); noise({ vol: 0.25, d: 0.25, f: 900, q: 0.8, at: 0.08 }); },
  whoosh: () => noise({ vol: 0.3, d: 0.35, f: 400, to: 1600, q: 0.7, type: 'bandpass' }),
  crackle: () => { for (let i = 0; i < 3; i++) noise({ vol: 0.1 + Math.random() * 0.1, d: 0.015, f: 2500 + Math.random() * 2500, q: 3, at: Math.random() * 0.15 }); },
  sizzle: () => noise({ vol: 0.2, d: 0.7, f: 5000, q: 0.6, type: 'highpass' }),
  snap: () => { noise({ vol: 0.4, d: 0.05, f: 1800, q: 2 }); tone(300, { to: 120, vol: 0.2, d: 0.12, type: 'triangle' }); },
  roar: () => { noise({ vol: 0.45, d: 1.4, f: 300, to: 900, q: 0.5, type: 'lowpass' }); noise({ vol: 0.15, d: 1.2, f: 3000, q: 0.5 }); },
  bang: () => {
    tone(90, { to: 35, vol: 0.6, d: 0.5 }); noise({ vol: 0.5, d: 0.4, f: 800, to: 200, q: 0.4, type: 'lowpass' });
    for (let i = 0; i < 14; i++) noise({ vol: 0.12, d: 0.02, f: 3000 + Math.random() * 3000, q: 4, at: 0.25 + Math.random() * 0.9 });
  },
  whistle: () => {
    const t = now(), o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1900, t + 0.5);
    lfo.frequency.value = 9; lg.gain.value = 25; lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.3); g.gain.setValueAtTime(0.18, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + 1.9); lfo.stop(t + 1.9);
    noise({ vol: 0.12, d: 1.6, f: 6000, q: 0.5, type: 'highpass' });
  },
  bloop: () => tone(200 + Math.random() * 250, { to: 500 + Math.random() * 300, vol: 0.12, d: 0.08 }),
  foam: () => {
    for (let i = 0; i < 10; i++) tone(180 + Math.random() * 400, { to: 600 + Math.random() * 500, vol: 0.12, d: 0.1, at: i * 0.07 });
    noise({ vol: 0.2, d: 1.2, f: 4000, q: 0.4, type: 'highpass' });
  },
  pour: () => { noise({ vol: 0.22, d: 2.4, f: 1100, q: 0.8 }); for (let i = 0; i < 8; i++) tone(700 + Math.random() * 600, { vol: 0.05, d: 0.05, at: Math.random() * 2.2 }); },
  hiss: () => noise({ vol: 0.35, d: 0.8, f: 5500, to: 2500, q: 0.6, type: 'highpass' }),
  balloon: () => { noise({ vol: 0.6, d: 0.06, f: 2000, q: 0.5 }); tone(160, { to: 60, vol: 0.3, d: 0.1 }); },
  sticker: () => [1047, 1319, 1568, 2093].forEach((f, i) => { tone(f, { vol: 0.16, d: 0.25, at: i * 0.06 }); tone(f * 2, { vol: 0.05, d: 0.2, at: i * 0.06 + 0.02 }); }),
  tab: () => tone(600, { to: 900, vol: 0.14, d: 0.06, type: 'triangle' }),
  win: () => {
    const seq = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.64]];
    seq.forEach(([f, at]) => { tone(f, { vol: 0.22, d: 0.3, type: 'square', at }); tone(f / 2, { vol: 0.15, d: 0.3, type: 'triangle', at }); });
  },
};

// Throttle so a pile of falling blocks doesn't turn into static.
let lastT = 0, inFrame = 0;
export function play(name, v = 1, extra) {
  if (!ctx || !SFX[name]) return;
  const t = performance.now();
  if (t - lastT > 16) { lastT = t; inFrame = 0; }
  if (++inFrame > 5) return;
  SFX[name](Math.min(1, Math.max(0.15, v)), extra);
}
