// Starter machines. Each one is missing its `ghost` pieces: they show as glowing outlines and wait in the tray.
// Every level must pass `node tests/sim.mjs` with the ghosts filled in — tune positions there, not by eye.
// c/r = bottom-left cell (row 0 = bottom), f = flipped.

const zigzag = [
  { t: 'start', c: 0, r: 10 },
  { t: 'ramp', c: 2, r: 9 },
  { t: 'brick', c: 5, r: 9 }, { t: 'brick', c: 5, r: 8 },
  { t: 'ramp', c: 3, r: 7, f: 1 },
  { t: 'brick', c: 1, r: 7 }, { t: 'brick', c: 1, r: 6 },
];

export const LEVELS = [
  {
    name: 'Roll', icon: 'ramp',
    pieces: [
      ...zigzag.map(p => p.t === 'ramp' && p.r === 7 ? { ...p, ghost: 1 } : p),
      { t: 'ramp', c: 2, r: 5 },
      { t: 'brick', c: 5, r: 5 }, { t: 'brick', c: 5, r: 4 },
      { t: 'ramp', c: 3, r: 3, f: 1 },
      { t: 'goal', c: 0, r: 0 },
    ],
  },
  {
    name: 'Dominoes', icon: 'domino',
    pieces: [
      { t: 'start', c: 0, r: 10 },
      { t: 'ramp', c: 2, r: 9 },
      { t: 'domino', c: 4, r: 8, ghost: 1 },
      { t: 'goal', c: 7, r: 0 },
    ],
  },
  {
    name: 'Boing', icon: 'bouncer',
    pieces: [
      { t: 'start', c: 0, r: 6 },
      { t: 'bouncer', c: 3, r: 3, ghost: 1 },
      { t: 'brick', c: 6, r: 0 }, { t: 'brick', c: 6, r: 1 }, { t: 'brick', c: 6, r: 2 },
      { t: 'goal', c: 8, r: 0 },
    ],
  },
  {
    name: 'Music', icon: 'music',
    pieces: [
      { t: 'start', c: 0, r: 10 },
      { t: 'music', c: 2, r: 9 }, { t: 'music', c: 4, r: 8, ghost: 1 }, { t: 'music', c: 6, r: 7 }, { t: 'music', c: 8, r: 6 },
      { t: 'music', c: 9, r: 4, f: 1 }, { t: 'music', c: 8, r: 3, f: 1, ghost: 1 }, { t: 'music', c: 7, r: 2, f: 1 }, { t: 'music', c: 6, r: 1, f: 1 },
      { t: 'goal', c: 3, r: 0 },
    ],
  },
  {
    name: 'Vroom', icon: 'car',
    pieces: [
      ...zigzag,
      { t: 'car', c: 2, r: 5, ghost: 1 },
      { t: 'goal', c: 7, r: 0 },
    ],
  },
  {
    name: 'Catapult', icon: 'seesaw',
    pieces: [
      { t: 'start', c: 0, r: 6 },
      { t: 'seesaw', c: 3, r: 3, f: 1, ghost: 1 },
      { t: 'goal', c: 0, r: 0 },
    ],
  },
  {
    name: 'Big Crash', icon: 'tower',
    pieces: [
      { t: 'start', c: 0, r: 10 },
      { t: 'music', c: 2, r: 9 }, { t: 'music', c: 4, r: 8, ghost: 1 }, { t: 'music', c: 6, r: 7 },
      { t: 'brick', c: 9, r: 7 }, { t: 'brick', c: 9, r: 6 },
      { t: 'car', c: 6, r: 4, f: 1, ghost: 1 },
      { t: 'tower', c: 2, r: 1 },
      { t: 'goal', c: 0, r: 0 },
    ],
  },
  // ---- science machines: each one has its own goal (`win` = the sticker that finishes it)
  {
    name: 'Light It', icon: 'candle', win: 'goal',
    pieces: [
      { t: 'start', c: 0, r: 4 },
      { t: 'match', c: 2, r: 3 }, { t: 'candle', c: 3, r: 3, ghost: 1 },
      { t: 'rope', c: 4, r: 3 },
      { t: 'goal', c: 4, r: 0 },
    ],
  },
  {
    name: 'Blast Off', icon: 'rocket', win: 'pop',
    pieces: [
      { t: 'start', c: 0, r: 2 },
      { t: 'match', c: 2, r: 1 }, { t: 'rocket', c: 3, r: 1, ghost: 1 },
      { t: 'balloon', c: 3, r: 4 }, { t: 'balloon', c: 4, r: 6, f: 1 }, { t: 'balloon', c: 5, r: 3 },
    ],
  },
  {
    name: 'Boil', icon: 'kettle', win: 'boil',
    pieces: [
      { t: 'start', c: 0, r: 1 },
      { t: 'match', c: 2, r: 0 }, { t: 'candle', c: 3, r: 0 },
      { t: 'kettle', c: 3, r: 1, ghost: 1 },
      { t: 'balloon', c: 3, r: 3, f: 1 },
    ],
  },
  {
    name: 'Splash', icon: 'water', win: 'putout',
    pieces: [
      { t: 'start', c: 1, r: 3 },
      { t: 'match', c: 3, r: 2 }, { t: 'candle', c: 4, r: 2 },
      { t: 'start', c: 8, r: 10, f: 1 },
      { t: 'water', c: 6, r: 7, f: 1, ghost: 1 },
    ],
  },
];

// Free build starts with a ball and a bucket; everything is movable.
export const FREE_START = [{ t: 'start', c: 0, r: 10 }, { t: 'goal', c: 8, r: 0 }];
