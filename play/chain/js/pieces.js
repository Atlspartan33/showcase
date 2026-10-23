// Piece catalog. Pure data + geometry math: no three.js, no Rapier, so tests/sim.mjs can run it in Node.
//
// Board: COLS x ROWS cells, 1 cell = 1 world unit, row 0 at the bottom.
// A placed piece = { t: type, c, r, f } — c/r is the bottom-left cell of its footprint, f = flipped (mirrored).
// parts(piece) returns world-space parts. Each part is one rigid body for physics and one mesh for the renderer:
//   { shape:'box', hw, hh } | { shape:'ball', r } | { shape:'poly', pts } | { shape:'none' }   (decoration only)
//   body: 'fixed' | 'dynamic', x, y, a (radians), look, color, snd, mat:{fric,rest,dens,bouncy}, role, sub:[...]
// joints(piece) returns revolute joints between part indexes (b:null = pinned to the world).

export const COLS = 10, ROWS = 12;

export const LEGO = {
  red: 0xd01012, blue: 0x0055bf, yellow: 0xf2cd37, green: 0x237841, orange: 0xfe8a18, lime: 0xa5ca18,
  azure: 0x36aebf, magenta: 0xc870a0, purple: 0x7a4bb4, white: 0xf4f4f4, dark: 0x3a3f45, black: 0x1b1d20,
  gold: 0xf5b400, tan: 0xe4cd9e, pink: 0xff7eb6,
};

// Pentatonic C major: every note sounds good next to every other one. Row picks the note (higher = higher).
export const NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
const RAINBOW = [LEGO.red, LEGO.orange, LEGO.yellow, LEGO.lime, LEGO.green, LEGO.azure, LEGO.blue, LEGO.purple, LEGO.magenta, LEGO.pink, LEGO.red, LEGO.orange];

// A plank between two points: centre, half-length, angle.
function plank(x1, y1, x2, y2, th, extra) {
  const dx = x2 - x1, dy = y2 - y1;
  return { shape: 'box', x: (x1 + x2) / 2, y: (y1 + y2) / 2, a: Math.atan2(dy, dx), hw: Math.hypot(dx, dy) / 2, hh: th / 2, body: 'fixed', ...extra };
}

const WOOD = { fric: 0.6, rest: 0.1, dens: 1 };
export const BALL_R = 0.3;

export const TYPES = {
  start: {
    w: 2, h: 1, flip: true, color: LEGO.green,
    // A little launch ramp with the ball held behind a gate. GO removes the gate and the ball rolls off the low end.
    parts: () => [
      plank(0.04, 0.66, 1.98, 0.24, 0.16, { look: 'plank', color: LEGO.green, snd: 'wood', mat: WOOD }),
      { shape: 'box', x: 0.1, y: 0.8, hw: 0.08, hh: 0.3, body: 'fixed', look: 'post', color: LEGO.green, snd: 'wood', mat: WOOD },
      { shape: 'box', x: 0.98, y: 0.62, hw: 0.06, hh: 0.24, body: 'fixed', look: 'gate', color: LEGO.red, role: 'gate', mat: WOOD },
      { shape: 'ball', x: 0.5, y: 0.56 + 0.08 + BALL_R, r: BALL_R, body: 'dynamic', look: 'ball', color: LEGO.red, snd: 'ball', role: 'ball',
        mat: { fric: 0.5, rest: 0.35, dens: 1.2 } },
    ],
  },
  ramp: {
    w: 2, h: 1, flip: true, color: LEGO.orange,
    parts: () => [plank(0.02, 0.72, 1.98, 0.3, 0.2, { look: 'plank', color: LEGO.orange, snd: 'wood', mat: WOOD })],
  },
  steep: {
    w: 2, h: 2, flip: true, color: LEGO.yellow,
    parts: () => [plank(0.04, 1.72, 1.96, 0.3, 0.16, { look: 'plank', color: LEGO.yellow, snd: 'wood', mat: WOOD })],
  },
  brick: {
    w: 1, h: 1, flip: false, color: LEGO.red,
    parts: () => [{ shape: 'box', x: 0.5, y: 0.5, hw: 0.47, hh: 0.47, body: 'fixed', look: 'brick', color: LEGO.red, snd: 'wood', mat: WOOD }],
  },
  domino: {
    w: 3, h: 2, flip: true, color: LEGO.blue,
    parts: () => {
      const out = [plank(0, 0.1, 3, 0.1, 0.16, { look: 'plank', color: LEGO.dark, snd: 'wood', mat: WOOD })];
      for (let i = 0; i < 4; i++) out.push({
        shape: 'box', x: 0.35 + 0.75 * i, y: 0.18 + 0.5, hw: 0.12, hh: 0.5, body: 'dynamic', look: 'domino',
        color: [LEGO.blue, LEGO.azure, LEGO.lime, LEGO.yellow][i], snd: 'clack', mat: { fric: 0.5, rest: 0.05, dens: 0.8 },
      });
      return out;
    },
  },
  tower: {
    w: 2, h: 2, flip: false, color: LEGO.magenta,
    parts: () => {
      const out = [plank(0, 0.1, 2, 0.1, 0.16, { look: 'plank', color: LEGO.dark, snd: 'wood', mat: WOOD })];
      const rows = [[0.5, 1.0, 1.5], [0.75, 1.25], [1.0]];
      const cols = [LEGO.magenta, LEGO.yellow, LEGO.azure, LEGO.lime, LEGO.orange, LEGO.purple];
      let k = 0;
      rows.forEach((xs, ri) => xs.forEach(x => out.push({
        shape: 'box', x, y: 0.18 + 0.16 + ri * 0.32, hw: 0.24, hh: 0.155, body: 'dynamic', look: 'block',
        color: cols[k++ % cols.length], snd: 'crash', mat: { fric: 0.45, rest: 0.1, dens: 0.15 },
      })));
      out.push({ shape: 'box', x: 1.0, y: 0.18 + 0.96 + 0.2, hw: 0.2, hh: 0.2, body: 'dynamic', look: 'crown', color: LEGO.gold, snd: 'crash', mat: { fric: 0.45, rest: 0.1, dens: 0.15 } });
      return out;
    },
  },
  bouncer: {
    w: 1, h: 1, flip: true, color: LEGO.red,
    // Trampoline pad tilted so the ball springs off toward +x (or -x when flipped).
    parts: () => [
      { shape: 'box', x: 0.5, y: 0.34, hw: 0.44, hh: 0.07, a: -0.32, body: 'fixed', look: 'pad', color: LEGO.red, snd: 'boing', role: 'pad',
        mat: { fric: 0.4, rest: 1.0, dens: 1, bouncy: true } },
      { shape: 'none', x: 0.5, y: 0.14, look: 'spring', color: LEGO.dark },
    ],
  },
  music: {
    w: 1, h: 1, flip: true, color: LEGO.azure,
    // Xylophone key. Its note (and colour) comes from the row it sits in.
    parts: (p) => [{ shape: 'box', x: 0.5, y: 0.34, hw: 0.45, hh: 0.11, a: -0.2, body: 'fixed', look: 'key', color: RAINBOW[p.r % RAINBOW.length],
      snd: 'note', note: NOTES[p.r % NOTES.length], mat: { fric: 0.4, rest: 0.45, dens: 1 } }],
  },
  seesaw: {
    w: 3, h: 1, flip: true, color: LEGO.purple,
    // Left end starts down with a passenger ball in its cup. Something landing on the high right end flings the passenger up.
    parts: () => {
      const A = 0.28, PY = 0.6, LY = PY + 0.07, px = -1.1;
      return [
        { shape: 'poly', x: 1.5, y: 0, pts: [[-0.3, 0], [0.3, 0], [0, PY]], body: 'fixed', look: 'pivot', color: LEGO.dark, snd: 'wood', mat: WOOD },
        { shape: 'box', x: 1.5, y: LY, hw: 1.45, hh: 0.07, a: A, body: 'dynamic', look: 'lever', color: LEGO.purple, snd: 'wood',
          mat: { fric: 0.6, rest: 0.1, dens: 0.3 },
          sub: [{ x: -1.38, y: 0.17, hw: 0.06, hh: 0.12 }, { x: -0.82, y: 0.11, hw: 0.05, hh: 0.06 }] },
        { shape: 'box', x: 0.12, y: 0.09, hw: 0.1, hh: 0.09, body: 'fixed', look: 'stop', color: LEGO.dark, mat: WOOD },
        { shape: 'box', x: 2.88, y: 0.09, hw: 0.1, hh: 0.09, body: 'fixed', look: 'stop', color: LEGO.dark, mat: WOOD },
        { shape: 'ball', x: 1.5 + px * Math.cos(A), y: LY + px * Math.sin(A) + 0.07 + 0.24, r: 0.24, body: 'dynamic', look: 'ball', color: LEGO.yellow,
          snd: 'ball', role: 'ball', mat: { fric: 0.5, rest: 0.3, dens: 0.6 } },
      ];
    },
    joints: () => [{ a: 1, b: null, x: 1.5, y: 0.6 }],
  },
  car: {
    w: 3, h: 1, flip: true, color: LEGO.blue,
    // A pull-back toy car on a shelf. The first bump wakes it and it drives off the open end (see role 'car').
    parts: () => [
      plank(0, 0.08, 3, 0.08, 0.16, { look: 'plank', color: LEGO.dark, snd: 'wood', mat: WOOD }),
      { shape: 'box', x: 0.7, y: 0.52, hw: 0.46, hh: 0.14, body: 'dynamic', look: 'car', color: LEGO.blue, snd: 'car', role: 'car',
        mat: { fric: 0.4, rest: 0.1, dens: 1.2 } },
      { shape: 'ball', x: 0.4, y: 0.32, r: 0.16, body: 'dynamic', look: 'wheel', color: LEGO.black, mat: { fric: 1.2, rest: 0.1, dens: 1 } },
      { shape: 'ball', x: 1.0, y: 0.32, r: 0.16, body: 'dynamic', look: 'wheel', color: LEGO.black, mat: { fric: 1.2, rest: 0.1, dens: 1 } },
    ],
    joints: () => [{ a: 2, b: 1, x: 0.4, y: 0.32 }, { a: 3, b: 1, x: 1.0, y: 0.32 }],
  },
  goal: {
    w: 2, h: 1, flip: false, color: LEGO.gold,
    parts: () => [
      plank(0.1, 0.08, 1.9, 0.08, 0.14, { look: 'plank', color: LEGO.gold, snd: 'metal', mat: WOOD }),
      { shape: 'box', x: 0.13, y: 0.45, hw: 0.07, hh: 0.37, body: 'fixed', look: 'plank', color: LEGO.gold, snd: 'metal', mat: WOOD },
      { shape: 'box', x: 1.87, y: 0.45, hw: 0.07, hh: 0.37, body: 'fixed', look: 'plank', color: LEGO.gold, snd: 'metal', mat: WOOD },
      { shape: 'box', x: 1.0, y: 0.4, hw: 0.66, hh: 0.26, body: 'fixed', look: 'none', role: 'goal', sensor: true },
      { shape: 'none', x: 1.0, y: 0.45, look: 'star', color: LEGO.gold },
    ],
  },

  // ---------------- science pieces (behaviour lives in science.js) ----------------
  // `pt` holds named points in piece-local coords; parts() turns them into world {x, y}.
  match: {
    w: 1, h: 1, flip: true, color: LEGO.red, sci: true,
    // A big match leaning out of its box. Bump it and it strikes; a flame nearby lights it too.
    parts: () => [{ shape: 'box', x: 0.5, y: 0.14, hw: 0.3, hh: 0.12, body: 'fixed', look: 'matchbox', color: LEGO.red, snd: 'wood', role: 'match',
      mat: WOOD, pt: { head: [0.78, 0.86] }, sub: [{ x: 0.065, y: 0.42, hw: 0.04, hh: 0.37, a: -0.62 }] }],
  },
  candle: {
    w: 1, h: 1, flip: false, color: LEGO.white, sci: true,
    parts: () => [{ shape: 'box', x: 0.5, y: 0.34, hw: 0.12, hh: 0.26, body: 'fixed', look: 'candle', color: 0xfff4e0, snd: 'wood', role: 'candle',
      mat: WOOD, pt: { wick: [0.5, 0.62], flame: [0.5, 0.8] }, sub: [{ x: 0, y: -0.25, hw: 0.3, hh: 0.05 }] }],
  },
  rope: {
    w: 1, h: 2, flip: false, color: LEGO.dark, sci: true,
    // A weight hanging from a hook. Fire burns the rope and the weight drops.
    parts: () => [
      { shape: 'box', x: 0.5, y: 1.9, hw: 0.3, hh: 0.06, body: 'fixed', look: 'hook', color: LEGO.dark, snd: 'metal', mat: WOOD },
      { shape: 'box', x: 0.5, y: 0.5, hw: 0.3, hh: 0.2, body: 'dynamic', look: 'anvil', color: 0x4a5058, snd: 'metal', role: 'anvil',
        mat: { fric: 0.6, rest: 0.05, dens: 3 }, ropeTo: [0.5, 1.84] },
    ],
    joints: () => [{ a: 1, b: 0, x: 0.5, y: 1.84, tag: 'rope' }],
  },
  rocket: {
    w: 1, h: 2, flip: false, color: LEGO.red, sci: true,
    parts: () => [
      { shape: 'box', x: 0.5, y: 0.05, hw: 0.34, hh: 0.05, body: 'fixed', look: 'launchpad', color: LEGO.dark, snd: 'metal', mat: WOOD },
      { shape: 'box', x: 0.5, y: 0.83, hw: 0.16, hh: 0.72, body: 'dynamic', look: 'rocket', color: LEGO.red, snd: 'metal', role: 'rocket',
        mat: { fric: 0.5, rest: 0.1, dens: 0.6 } },
    ],
  },
  kettle: {
    w: 1, h: 1, flip: true, color: 0xb8c4d0, sci: true,
    // Put a flame under it: it boils, whistles, and the steam lifts things up.
    parts: () => [{ shape: 'box', x: 0.5, y: 0.3, hw: 0.32, hh: 0.24, body: 'fixed', look: 'kettle', color: 0xb8c4d0, snd: 'metal', role: 'kettle', mat: WOOD }],
  },
  potion: {
    w: 1, h: 1, flip: true, color: LEGO.magenta, sci: true,
    // Bump it or heat it: foam eruption. Tapping it swaps the potion colour.
    parts: (p) => [{ shape: 'box', x: 0.5, y: 0.2, hw: 0.3, hh: 0.18, body: 'fixed', look: 'flask', color: p.f ? LEGO.lime : LEGO.magenta, snd: 'glass', role: 'potion',
      mat: WOOD, pt: { mouth: [0.5, 0.8] }, sub: [{ x: 0, y: 0.34, hw: 0.09, hh: 0.2 }] }],
  },
  water: {
    w: 1, h: 2, flip: true, color: LEGO.azure, sci: true,
    // A water tank on legs. Bump it and the tap pours; water puts out fires.
    parts: () => [
      { shape: 'box', x: 0.5, y: 1.4, hw: 0.36, hh: 0.42, body: 'fixed', look: 'tank', color: LEGO.azure, snd: 'glass', role: 'water', mat: WOOD, pt: { spout: [0.96, 1.08] } },
      { shape: 'box', x: 0.2, y: 0.49, hw: 0.04, hh: 0.49, body: 'fixed', look: 'post', color: LEGO.dark, mat: WOOD },
      { shape: 'box', x: 0.8, y: 0.49, hw: 0.04, hh: 0.49, body: 'fixed', look: 'post', color: LEGO.dark, mat: WOOD },
    ],
  },
  balloon: {
    w: 1, h: 1, flip: true, color: LEGO.red, sci: true,
    // Floats up when GO is pressed; pops near a flame. Tapping it swaps the colour.
    parts: (p) => [{ shape: 'ball', x: 0.5, y: 0.58, r: 0.32, body: 'dynamic', look: 'balloon', color: p.f ? LEGO.azure : LEGO.red, snd: 'ball', role: 'balloon',
      mat: { fric: 0.3, rest: 0.5, dens: 0.08 } }],
  },
};

// Tray order in free build: the machine tab and the science tab.
export const TRAY = ['start', 'ramp', 'steep', 'domino', 'music', 'bouncer', 'car', 'seesaw', 'tower', 'brick', 'goal'];
export const SCIENCE = ['match', 'candle', 'rope', 'rocket', 'kettle', 'potion', 'water', 'balloon'];

// World-space parts for a placed piece (mirrored when p.f).
export function parts(p) {
  const T = TYPES[p.t], w = T.w;
  return T.parts(p).map(q => {
    const o = { ...q };
    if (p.f) {
      o.x = w - q.x; o.a = -(q.a || 0);
      if (q.pts) o.pts = q.pts.map(([x, y]) => [-x, y]);
      if (q.sub) o.sub = q.sub.map(s => ({ ...s, x: -s.x, a: -(s.a || 0) }));
    }
    const at = ([x, y]) => ({ x: (p.f ? w - x : x) + p.c, y: y + p.r });
    if (q.pt) o.pt = Object.fromEntries(Object.entries(q.pt).map(([k, v]) => [k, at(v)]));
    if (q.ropeTo) o.ropeTo = at(q.ropeTo);
    o.x += p.c; o.y += p.r; o.a = o.a || 0;
    return o;
  });
}

export function joints(p) {
  const T = TYPES[p.t];
  if (!T.joints) return [];
  return T.joints(p).map(j => ({ ...j, x: (p.f ? T.w - j.x : j.x) + p.c, y: j.y + p.r }));
}

export function footprint(p) { const T = TYPES[p.t]; return { c: p.c, r: p.r, w: T.w, h: T.h }; }

export function cellsOf(p) {
  const f = footprint(p), out = [];
  for (let i = 0; i < f.w; i++) for (let j = 0; j < f.h; j++) out.push([f.c + i, f.r + j]);
  return out;
}

export function inBounds(p) { const f = footprint(p); return f.c >= 0 && f.r >= 0 && f.c + f.w <= COLS && f.r + f.h <= ROWS; }

// Does p overlap any piece in list (ignoring `skip`)?
export function overlaps(p, list, skip) {
  const mine = new Set(cellsOf(p).map(([c, r]) => c + ',' + r));
  return list.some(q => q !== skip && cellsOf(q).some(([c, r]) => mine.has(c + ',' + r)));
}

export function pieceAt(list, c, r) { return list.find(q => cellsOf(q).some(([x, y]) => x === c && y === r)); }
