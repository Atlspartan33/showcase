// Chain Reaction — app shell: home screen, building (drag / tap / flip), GO runs, celebration, hints.
import * as THREE from 'three';
import RAPIER from 'rapier';
import { TYPES, TRAY, SCIENCE, COLS, ROWS, LEGO, parts, inBounds, overlaps, pieceAt } from './pieces.js';
import { buildWorld, release, step, settled, DT } from './physics.js';
import { LEVELS, FREE_START } from './levels.js';
import { makeStage, fitCamera, pieceView, ghostify, pick, toScreen, thumbnail } from './render.js';
import { unlock, play } from './audio.js';
import { makeFx } from './fx3d.js';

const $ = (s) => document.querySelector(s);
const arr = (v) => Array.isArray(v) ? v : [];
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

await RAPIER.init();
const canvas = $('#c'), fx = $('#fx'), fxc = fx.getContext('2d');
const { renderer, scene, camera } = makeStage(canvas);
const vfx = makeFx(scene);

const S = {
  screen: 'home', mode: 'level', li: 0,
  layout: [], level: null,
  phase: 'edit',                // edit | run | ran
  sim: null, acc: 0, quiet: 0, won: false,
  views: new Map(), ghostViews: new Map(),
  press: null, drag: null, idle: 0,
  done: new Set(arr(store.get('cr-progress-v1', [])).filter(Number.isInteger)),
  tab: store.get('cr-tab', 'machine') === 'science' ? 'science' : 'machine',
  stickers: new Set(arr(store.get('cr-stickers-v1', []))),
};
window.__cr = { S, LEVELS };

// ---------------- helpers ----------------
const T = (p) => TYPES[p.t];
const same = (a, b) => a.t === b.t && a.c === b.c && a.r === b.r && !!a.f === !!b.f;
function openGhosts() { return S.level ? S.level.ghosts.filter(g => !S.layout.some(p => same(p, g))) : []; }
function trayCount(t) {
  if (S.mode === 'free') return Infinity;
  return S.level.ghosts.filter(g => g.t === t).length - S.layout.filter(p => !p.lock && p.t === t).length;
}
// Saved free build, cleaned: unknown types, out-of-bounds and overlapping pieces are dropped.
function loadFree() {
  const out = [];
  const saved = store.get('cr-free-v1', FREE_START);
  for (const q of Array.isArray(saved) ? saved : FREE_START) {
    if (!q || !TYPES[q.t]) continue;
    const p = { t: q.t, c: q.c | 0, r: q.r | 0, f: !!q.f };
    if (inBounds(p) && !overlaps(p, out)) out.push(p);
  }
  return out;
}
function saveFree() { if (S.mode === 'free') store.set('cr-free-v1', S.layout.map(({ t, c, r, f }) => ({ t, c, r, f: f ? 1 : 0 }))); }

// ---------------- stickers: discoveries he makes by accident, collected in a book ----------------
const STICKERS = [
  { id: 'goal', e: '⭐', need: ['start', 'goal'] },
  { id: 'note', e: '🎵', need: ['start', 'music'] },
  { id: 'car', e: '🚗', need: ['start', 'car'] },
  { id: 'crash', e: '💥', need: ['start', 'tower'] },
  { id: 'candle', e: '🕯️', need: ['match', 'candle'] },
  { id: 'fireball', e: '🔥', need: ['start', 'match'] },
  { id: 'rope', e: '✂️', need: ['candle', 'rope'] },
  { id: 'rocket', e: '🚀', need: ['match', 'rocket'] },
  { id: 'lift', e: '🛸', need: ['candle', 'kettle', 'start'] },
  { id: 'boil', e: '♨️', need: ['candle', 'kettle'] },
  { id: 'foam', e: '🧪', need: ['start', 'potion'] },
  { id: 'putout', e: '💧', need: ['water', 'candle'] },
  { id: 'pop', e: '🎈', need: ['balloon', 'candle'] },
];
const STICKER = Object.fromEntries(STICKERS.map(x => [x.id, x]));
const popQueue = [];
let popping = false;
function award(id) {
  if (S.stickers.has(id) || !STICKER[id]) return;
  S.stickers.add(id); store.set('cr-stickers-v1', [...S.stickers]);
  popQueue.push(id);
  if (!popping) nextPop();
}
// One sticker at a time: each pops, then flies into the book button.
function nextPop() {
  const id = popQueue.shift();
  if (!id) { popping = false; return; }
  popping = true;
  const pop = $('#sticker-pop');
  pop.textContent = STICKER[id].e; pop.classList.remove('hide');
  play('sticker');
  const btn = $('#book-btn').getBoundingClientRect(), r = pop.getBoundingClientRect();
  const dx = btn.left + btn.width / 2 - (r.left + r.width / 2), dy = btn.top + btn.height / 2 - (r.top + r.height / 2);
  pop.animate([
    { transform: 'scale(0) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1.15) rotate(6deg)', opacity: 1, offset: 0.18 },
    { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.7 }, { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0.6 },
  ], { duration: 1900, easing: 'ease-in-out' }).onfinish = () => { pop.classList.add('hide'); updateBookBtn(true); nextPop(); };
}
function updateBookBtn(bump) {
  $('#book-n').textContent = S.stickers.size;
  if (bump) $('#book-btn').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 400 });
}
function openBook() {
  unlock(); play('pick');
  const grid = $('#book-grid'); grid.innerHTML = '';
  $('#book-hint').innerHTML = '';
  for (const st of STICKERS) {
    const have = S.stickers.has(st.id), b = document.createElement('button');
    b.className = 'sticker' + (have ? ' have' : '');
    b.setAttribute('aria-label', have ? `sticker ${st.id}` : `sticker ${st.id}, not found yet`);
    b.innerHTML = `<span>${st.e}</span>`;
    b.onclick = () => {
      if (have) { play('sticker'); b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2) rotate(8deg)' }, { transform: 'scale(1)' }], { duration: 350 }); return; }
      // Not found yet: show which pieces make it happen.
      play('pick');
      $('#book-hint').innerHTML = `<span class="q">${st.e}</span><span class="eq">=</span>` + st.need.map(t => `<img alt="${t}" src="${icon(t)}">`).join('<span class="eq">+</span>');
    };
    grid.appendChild(b);
  }
  $('#book-count').textContent = `${S.stickers.size} / ${STICKERS.length}`;
  $('#book').classList.remove('hide');
}
$('#book-btn').addEventListener('click', openBook);
$('#book-close').addEventListener('click', () => { play('pick'); $('#book').classList.add('hide'); });

// ---------------- views ----------------
function syncViews() {
  for (const [p, v] of S.views) if (!S.layout.includes(p)) { scene.remove(v); S.views.delete(p); }
  for (const p of S.layout) if (!S.views.has(p)) { const v = pieceView(p); scene.add(v); S.views.set(p, v); }
  const open = openGhosts();
  for (const [g, v] of S.ghostViews) if (!open.includes(g)) { scene.remove(v); S.ghostViews.delete(g); }
  for (const g of open) if (!S.ghostViews.has(g)) { const v = ghostify(pieceView(g), 0xffd23f, 0.6); scene.add(v); S.ghostViews.set(g, v); }
  renderTray(); updateButtons();
}
function refreshView(p) { const v = S.views.get(p); if (v) { scene.remove(v); S.views.delete(p); } syncViews(); }
function clearScene() {
  for (const v of S.views.values()) scene.remove(v);
  for (const v of S.ghostViews.values()) scene.remove(v);
  S.views.clear(); S.ghostViews.clear();
}

// Little squash-and-stretch pops on placement.
const pops = [];
function popView(p, kind = 'pop') {
  const v = S.views.get(p); if (!v) return;
  const TT = TYPES[p.t];
  pops.push({ v, t: 0, kind, cx: p.c + TT.w / 2, cy: p.r + TT.h / 2 });
}
function animatePops(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const o = pops[i]; o.t += dt;
    const k = Math.min(o.t / 0.35, 1);
    if (o.kind === 'pop') { const s = 1 + Math.sin(k * Math.PI) * 0.12; o.v.scale.set(s, s, 1); o.v.position.set(o.cx * (1 - s), o.cy * (1 - s), 0); } // grow around its own centre
    else { o.v.position.x = Math.sin(k * Math.PI * 6) * 0.08 * (1 - k); }
    if (k >= 1) { o.v.scale.set(1, 1, 1); o.v.position.set(0, 0, 0); pops.splice(i, 1); }
  }
}

// ---------------- screens ----------------
// Leaving a screen: drop any finger gesture (putting a dragged piece back) and cancel pending timers.
const timers = new Set();
function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); }
function leave() {
  for (const id of timers) clearTimeout(id);
  timers.clear();
  abortGesture(true); hideHand();
}
function abortGesture(restore) {
  const d = S.drag;
  S.drag = S.press = null;
  if (!d) return;
  scene.remove(d.view);
  const back = d.from && { t: d.t, c: d.from.c, r: d.from.r, f: d.f };
  if (restore && back && !overlaps(back, S.layout)) { S.layout.push(back); syncViews(); saveFree(); }
}

function showHome() {
  leave();
  S.screen = 'home'; resetRun(true);
  $('#play').classList.add('hide'); $('#win').classList.add('hide'); $('#home').classList.remove('hide');
  renderHome();
}

function enterLevel(i) {
  leave();
  S.mode = 'level'; S.li = i;
  const L = LEVELS[i];
  S.level = { ghosts: L.pieces.filter(p => p.ghost).map(({ t, c, r, f }) => ({ t, c, r, f: !!f })) };
  S.layout = L.pieces.filter(p => !p.ghost).map(({ t, c, r, f }) => ({ t, c, r, f: !!f, lock: true }));
  enterPlay();
}
function enterFree() {
  leave();
  S.mode = 'free'; S.level = null;
  S.layout = loadFree();
  enterPlay();
}
function enterPlay() {
  resetRun(true);
  S.screen = 'play'; S.phase = 'edit'; S.won = false; S.idle = 0;
  clearScene();
  $('#home').classList.add('hide'); $('#win').classList.add('hide'); $('#play').classList.remove('hide');
  $('#clear').classList.toggle('hide', S.mode !== 'free');
  // Science machines show what they're for: a sticker bubble in the corner.
  const win = S.mode === 'level' ? (LEVELS[S.li].win || 'goal') : 'goal';
  $('#objective').classList.toggle('hide', win === 'goal'); $('#objective').classList.remove('got');
  $('#objective span').textContent = STICKER[win]?.e || '';
  updateBookBtn();
  resize();
  syncViews();
  if (history.state?.cr !== 'play') history.pushState({ cr: 'play' }, '');
}
// Android back button inside a machine goes home instead of closing the app.
window.addEventListener('popstate', () => { if (S.screen === 'play') showHome(); });

// ---------------- home ----------------
const thumbs = new Map();
function levelThumb(i) {
  if (!thumbs.has(i)) thumbs.set(i, thumbnail(LEVELS[i].pieces.map(({ t, c, r, f }) => ({ t, c, r, f: !!f })), 220, 260, { board: true, pad: 0.1 }));
  return thumbs.get(i);
}
const STAR = '<svg class="done" viewBox="0 0 24 24"><path fill="#f5b400" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" d="M12 1.8l3 6.4 7 .8-5.2 4.8 1.4 6.9L12 17.2l-6.2 3.5 1.4-6.9L2 9l7-.8z"/></svg>';
function renderHome() {
  const title = 'Chain Reaction', cols = ['#e2231a', '#fe8a18', '#f2cd37', '#2fbf4f', '#36aebf', '#1e6fd9', '#c870a0'];
  let k = 0;
  $('#title').innerHTML = title.split(' ').map(w => `<span class="w">${[...w].map(ch => `<span style="color:${cols[k++ % cols.length]}">${ch}</span>`).join('')}</span>`).join('');
  const next = LEVELS.findIndex((_, i) => !S.done.has(i));
  const box = $('#levels'); box.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    b.className = 'card' + (i === next ? ' next' : '');
    b.setAttribute('aria-label', `Machine ${i + 1}: ${L.name}${S.done.has(i) ? ', done' : ''}`);
    b.innerHTML = `<img alt="" src="${levelThumb(i)}"><span class="num">${i + 1}</span>${S.done.has(i) ? STAR : ''}`;
    b.onclick = () => { unlock(); play('pop'); goFull(); enterLevel(i); };
    box.appendChild(b);
  });
  const bk = document.createElement('button');
  bk.className = 'card book';
  bk.setAttribute('aria-label', `Sticker book, ${S.stickers.size} of ${STICKERS.length}`);
  bk.innerHTML = `<span class="bk-e">${S.stickers.size ? [...S.stickers].slice(-3).map(id => STICKER[id]?.e || '').join('') : '⭐'}</span><span class="bk-n">${S.stickers.size}/${STICKERS.length}</span>`;
  bk.onclick = openBook;
  const f = document.createElement('button');
  f.className = 'card free' + (next === -1 ? ' next' : '');
  f.setAttribute('aria-label', 'Build your own');
  const saved = loadFree();
  f.innerHTML = `<img alt="" src="${thumbnail(saved, 220, 260, { board: true, pad: 0.1 })}"><span class="label">Build<br>your<br>own!</span>`;
  f.onclick = () => { unlock(); play('pop'); goFull(); enterFree(); };
  box.appendChild(f); box.appendChild(bk);
}
function goFull() {
  if (matchMedia('(display-mode: standalone)').matches || document.fullscreenElement) return;
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); } catch {}
}

// ---------------- tray ----------------
const GEAR = '<svg width="36" height="36" viewBox="0 0 24 24" fill="#fff"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.4 5 .1-1.5-.1-1.5 2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L15 2.5h-4l-.4 2.5A8 8 0 0 0 8 6.5l-2.4-1-2 3.4 2 1.6-.1 1.5.1 1.5-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4z"/></svg>';
const FLASK = '<svg width="36" height="36" viewBox="0 0 24 24"><path fill="#fff" d="M9 2h6v2h-1v5l5.5 9.5A2 2 0 0 1 17.8 21H6.2a2 2 0 0 1-1.7-2.5L10 9V4H9z"/><path fill="#ff7eb6" d="M7.6 14h8.8l2.1 3.9a.8.8 0 0 1-.7 1.1H6.2a.8.8 0 0 1-.7-1.1z"/></svg>';
const icons = new Map();
function icon(t) { if (!icons.has(t)) icons.set(t, thumbnail([{ t, c: 0, r: 0, f: false }], 150, 150, { pad: 0.12 })); return icons.get(t); }
function renderTray() {
  const tray = $('#tray');
  const types = S.mode === 'free' ? (S.tab === 'science' ? SCIENCE : TRAY) : [...new Set(S.level.ghosts.map(g => g.t))];
  const want = new Set(openGhosts().map(g => g.t));
  tray.innerHTML = '';
  if (S.mode === 'free') {
    const tabs = document.createElement('div'); tabs.className = 'tabs';
    for (const [id, svg, label] of [['machine', GEAR, 'Machine pieces'], ['science', FLASK, 'Science pieces']]) {
      const b = document.createElement('button');
      b.className = 'tab' + (S.tab === id ? ' on' : ''); b.innerHTML = svg; b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', S.tab === id);
      b.addEventListener('click', () => { if (S.tab === id) return; unlock(); play('tab'); S.tab = id; store.set('cr-tab', id); renderTray(); });
      tabs.appendChild(b);
    }
    tray.appendChild(tabs);
  }
  tray.classList.toggle('many', types.length > 4);
  for (const t of types) {
    const n = trayCount(t);
    const b = document.createElement('button');
    b.className = 'tile' + (n <= 0 ? ' empty' : '') + (want.has(t) && n > 0 && S.phase === 'edit' ? ' want' : '');
    b.dataset.t = t; b.setAttribute('aria-label', t + ' piece');
    b.innerHTML = `<img alt="" src="${icon(t)}">` + (Number.isFinite(n) ? `<span class="n">${n}</span>` : '');
    b.addEventListener('pointerdown', (e) => trayDown(e, t));
    tray.appendChild(b);
  }
  if (S.mode === 'free') for (let k = types.length; k < Math.max(TRAY.length, SCIENCE.length); k++) {
    const sp = document.createElement('span'); sp.className = 'tile spacer'; sp.setAttribute('aria-hidden', 'true'); tray.appendChild(sp);
  }
}

// ---------------- buttons ----------------
function canGo() { return S.layout.some(p => p.t === 'start' || TYPES[p.t].sci); }
function updateButtons() {
  const go = $('#go'), reset = $('#reset');
  const ready = S.mode === 'free' ? canGo() : openGhosts().length === 0;
  go.classList.toggle('pulse', S.phase === 'edit' && ready);
  go.classList.toggle('wait', S.phase === 'edit' && !ready); // not finished yet: GO stays tappable but quiet
  go.disabled = S.phase === 'run' || !canGo();
  reset.disabled = S.phase === 'edit';
  reset.classList.toggle('pulse', S.phase === 'ran' && !S.won);
}
$('#go').addEventListener('click', () => { unlock(); S.idle = 0; if (S.press || S.drag) return; if (S.phase === 'ran') resetRun(); startRun(); });
$('#reset').addEventListener('click', () => { unlock(); S.idle = 0; resetRun(); play('reset'); });
$('#home-btn').addEventListener('click', () => { unlock(); play('pick'); showHome(); });
$('#again').addEventListener('click', () => { play('reset'); $('#win').classList.add('hide'); resetRun(); later(startRun, 250); });
$('#next').addEventListener('click', () => {
  play('pop'); $('#win').classList.add('hide'); $('#next').classList.remove('pulse');
  if (S.li + 1 < LEVELS.length) enterLevel(S.li + 1); else showHome();
});
// Hold the trash for a second to clear free build (a stray tap does nothing).
{
  const clr = $('#clear'); let timer = null;
  const stop = () => { clr.classList.remove('holding'); clearTimeout(timer); };
  clr.addEventListener('pointerdown', () => {
    unlock(); if (S.phase !== 'edit') resetRun();
    clr.classList.add('holding');
    timer = setTimeout(() => { stop(); if (S.mode !== 'free' || S.screen !== 'play' || S.phase !== 'edit') return; S.layout = S.layout.filter(p => p.t === 'start' || p.t === 'goal'); play('poof'); syncViews(); saveFree(); }, 1000);
  });
  clr.addEventListener('pointerup', stop); clr.addEventListener('pointerleave', stop); clr.addEventListener('pointercancel', stop);
}

// ---------------- running ----------------
const gateAnims = [];
function freeSim() { if (S.sim) { S.sim.events.free(); S.sim.world.free(); S.sim = null; } }
function startRun() {
  if (S.phase !== 'edit' || S.press || S.drag || !canGo()) return;
  freeSim();
  S.sim = buildWorld(RAPIER, S.layout);
  release(S.sim);
  S.phase = 'run'; S.acc = 0; S.quiet = 0; S.won = false;
  play('go'); later(() => play('gate'), 120);
  for (const e of S.sim.gates) { const m = meshOf(e); if (m) gateAnims.push({ m, t: 0 }); }
  renderTray(); updateButtons();
}
function resetRun(silent) {
  freeSim(); gateAnims.length = 0;
  for (const v of S.views.values()) for (const m of v.userData.parts) {
    if (!m) continue;
    const h = m.userData.home; m.position.set(h.x, h.y, 0); m.rotation.z = h.a; m.visible = true;
    if (m.userData.part.look === 'star') m.rotation.y = 0;
    const u = m.userData;
    if (u.rope) u.rope.visible = true;
    if (u.head) u.head.material.color.set(0xc0262d);
    if (u.liquid) u.liquid.scale.y = 1;
    if (u.water) u.water.scale.y = 1;
  }
  vfx.clear();
  const was = S.phase; S.phase = 'edit';
  if (!silent && was !== 'edit') renderTray();
  updateButtons();
}
const meshOf = (e) => S.views.get(e.piece)?.userData.parts[e.pi];

const SND_RANK = { note: 6, boing: 5, car: 4, clack: 3, crash: 3, metal: 3, ball: 2, wood: 1 };
const lastHit = new WeakMap();
function onHit(a, b, v) {
  if (v < 0.7) return;
  const e = [a, b].filter(Boolean).sort((x, y) => (SND_RANK[y.part.snd] || 0) - (SND_RANK[x.part.snd] || 0))[0];
  if (!e || !e.part.snd) return;
  const t = performance.now();
  if (t - (lastHit.get(e) || 0) < 70) return;
  lastHit.set(e, t);
  const vol = Math.min(1, v / 6);
  if (e.part.snd === 'note') {
    play('note', vol, e.part.note); award('note');
    const g = meshOf(e)?.userData.glow; if (g) { g.material.emissiveIntensity = 1.2; flashes.push(g); }
  } else if (e.part.snd === 'boing') {
    play('boing', vol); squash(e.piece);
  } else if (e.part.snd === 'car') play('clack', vol);
  else play(e.part.snd, vol);
}
const flashes = [];
function squash(piece) { popView(piece); }

function onGoal(g, visitor) {
  play('goal'); award('goal');
  const star = S.views.get(g.piece)?.userData.parts.find(m => m && m.userData.part.look === 'star');
  if (star) spinStar.push({ m: star, t: 0 });
  const { x, y } = g.body.translation();
  const p = toScreen(camera, canvas.getBoundingClientRect(), x, y + 0.3);
  const r = fx.getBoundingClientRect();
  burst(p.x - r.left, p.y - r.top, 70);
  kick = 1;
  if (S.mode === 'level' && (LEVELS[S.li].win || 'goal') === 'goal') levelWin();
  else if (S.mode === 'free') S.won = true;
}
// The level's objective happened: star + next.
function levelWin() {
  if (S.won) return;
  S.won = true;
  const first = !S.done.has(S.li), r = fx.getBoundingClientRect();
  S.done.add(S.li); store.set('cr-progress-v1', [...S.done]);
  $('#objective').classList.add('got');
  later(() => {
    if (S.screen !== 'play') return;
    play('win'); $('#win').classList.remove('hide'); $('#next').classList.add('pulse');
    burst(innerWidth / 2 - r.left, innerHeight * 0.35 - r.top, first ? 160 : 90);
  }, 2000);
}

// Science happenings -> sound, particles, stickers.
function onFx(f) {
  switch (f.type) {
    case 'strike': play('strike'); vfx.sparks(f.x, f.y, 26); break;
    case 'ignite': play('whoosh'); vfx.sparks(f.x, f.y, 14, 0xffa030, 2); break;
    case 'fireball': play('whoosh'); break;
    case 'fizzle': vfx.smoke(f.x, f.y, 4); break;
    case 'burn': play('sizzle'); break;
    case 'snap': play('snap'); vfx.sparks(f.x, f.y, 22); break;
    case 'fuse': play('sizzle'); break;
    case 'launch': play('roar'); vfx.smoke(f.x, f.y, 16); break;
    case 'boom': play('bang'); vfx.firework(f.x, f.y); kick = 1; break;
    case 'boil': play('whistle'); vfx.puff(f.x, f.y, 12); break;
    case 'foam': play('foam'); vfx.bubbles(f.x, f.y, 18); break;
    case 'pour': play('pour'); break;
    case 'putout': play('hiss'); vfx.puff(f.x, f.y, 12, 0xffffff, 1.6); break;
    case 'pop': play('balloon'); vfx.confetti(f.x, f.y, f.color); break;
    case 'sticker':
      award(f.name);
      if (S.mode === 'level' && LEVELS[S.li].win === f.name) levelWin();
      break;
  }
}

// Every frame while a machine exists: flames, steam, exhaust, foam and water, burnt-out bits.
let crackleT = 0;
function sciVisuals(dt, t) {
  const sim = S.sim;
  if (sim) {
    for (const e of sim.matches) {
      if (e.s.lit) vfx.flame(e, e.part.pt.head.x, e.part.pt.head.y, 0.75);
      const h = meshOf(e)?.userData.head; if (h && (e.s.done || e.s.lit)) h.material.color.set(e.s.done ? 0x2a2a2a : 0x7a1a1a);
    }
    for (const e of sim.candles) if (e.s.lit) vfx.flame(e, e.part.pt.flame.x, e.part.pt.flame.y - 0.14, 0.85);
    for (const b of sim.balls) if (b.fire > 0 && !b.dead) {
      const p = b.body.translation(); vfx.flame(b, p.x, p.y - 0.12, 1.4, 0.45);
    }
    for (const e of sim.rockets) {
      if (e.dead || !e.s.state) continue;
      const a = e.body.rotation(), p = e.body.translation(), L = e.part.hh + 0.05;
      const tx = p.x + Math.sin(a) * L, ty = p.y - Math.cos(a) * L;
      if (e.s.state === 'fuse') vfx.sparks(tx, ty, 2, 0xffe080, 1.5);
      else vfx.exhaust(tx, ty);
    }
    for (const rope of sim.ropes) {
      const m = meshOf(rope.anvil);
      if (rope.burnt) { if (m?.userData.rope) m.userData.rope.visible = false; continue; }
      if (rope.burning) { const b = rope.anvil.body.translation(); vfx.flame(rope, rope.top.x, (rope.top.y + b.y) / 2, 0.55); }
    }
    for (const e of sim.kettles) if (e.s.boil) {
      const k = e.body.translation(), dir = e.piece.f ? -1 : 1;
      if (Math.random() < dt * 30) vfx.steam(k.x, k.y + e.part.hh + 0.1);
      if (Math.random() < dt * 12) vfx.steam(k.x + dir * 0.48, k.y + e.part.hh * 0.6);
      if (S.phase === 'run' && Math.random() < dt * 6) play('bloop');
    }
    for (const e of sim.potions) if (e.s.go) { const l = meshOf(e)?.userData.liquid; if (l) l.scale.y = Math.max(0.15, 1 - e.s.t / 1.8); }
    for (const e of sim.tanks) if (e.s.go) { const w = meshOf(e)?.userData.water; if (w) w.scale.y = Math.max(0.1, 1 - e.s.t / 2.5); }
    vfx.syncSpawned(sim.spawned);
    const burning = sim.fires.length > 0;
    if (burning && S.phase === 'run' && (crackleT -= dt) < 0) { crackleT = 0.15 + Math.random() * 0.35; play('crackle'); }
  }
  vfx.endFlames(t);
  vfx.update(dt);
}
const spinStar = [];
let kick = 0;

function stepRun(dt) {
  S.acc += Math.min(dt, 0.05);
  let n = 0;
  while (S.acc >= DT && n++ < 8) { step(S.sim, onHit, onGoal); S.acc -= DT; }
  for (const c of S.sim.cars) if (c.justStarted) { c.justStarted = false; play('car'); award('car'); }
  for (const f of S.sim.fx.splice(0)) onFx(f);
  for (const e of S.sim.bodies) {
    if (!e.dyn) continue;
    const m = meshOf(e); if (!m) continue;
    if (e.dead) { m.visible = false; continue; }
    const p = e.body.translation(); m.position.set(p.x, p.y, 0); m.rotation.z = e.body.rotation();
  }
  for (const ga of gateAnims) { ga.t += dt; ga.m.position.y = ga.m.userData.home.y - Math.min(ga.t / 0.18, 1) * 0.5; ga.m.visible = ga.t < 0.25; }
  S.quiet = settled(S.sim) ? S.quiet + dt : 0;
  if (S.quiet > 1 || S.sim.t > 30) {
    S.phase = 'ran';
    renderTray(); updateButtons();
  }
}

// ---------------- building: board gestures ----------------
const LIFT_TOUCH = 0.55; // show the dragged piece a little above the finger so it isn't hidden
function boardPoint(e) { return pick(camera, canvas.getBoundingClientRect(), e.clientX, e.clientY); }
function overTray(e) { const r = $('#tray').getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }

canvas.addEventListener('pointerdown', (e) => {
  unlock(); S.idle = 0; hideHand();
  if (S.phase === 'run' || S.press || S.drag) return;
  if (S.phase === 'ran') resetRun();
  const w = boardPoint(e); if (!w) return;
  const p = pieceNear(w.x, w.y);
  if (!p) return;
  if (p.lock) { play('nope'); popView(p, 'wiggle'); return; }
  S.press = { piece: p, x0: e.clientX, y0: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse' };
  canvas.setPointerCapture(e.pointerId);
});

// The piece under the finger, or failing that one within ~0.4 cell (phone cells are small).
function pieceNear(x, y) {
  const hitP = pieceAt(S.layout, Math.floor(x), Math.floor(y));
  if (hitP) return hitP;
  for (const [dx, dy] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) { const q = pieceAt(S.layout, Math.floor(x + dx), Math.floor(y + dy)); if (q) return q; }
  return null;
}

function trayDown(e, t) {
  unlock(); S.idle = 0; hideHand();
  if (S.phase === 'run' || S.press || S.drag) return;
  if (S.phase === 'ran') resetRun(true); // silent: rebuilding the tray now would detach the tile under the finger
  if (trayCount(t) <= 0) { play('nope'); return; }
  play('pick');
  S.press = { tray: t, x0: e.clientX, y0: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse', el: e.currentTarget };
  e.currentTarget.setPointerCapture?.(e.pointerId);
  e.preventDefault();
}

window.addEventListener('pointermove', (e) => {
  if (S.press && e.pointerId === S.press.id && !S.drag && Math.hypot(e.clientX - S.press.x0, e.clientY - S.press.y0) > 10) beginDrag();
  if (S.drag && e.pointerId === S.drag.id) moveDrag(e);
});
window.addEventListener('pointerup', (e) => endPress(e));
window.addEventListener('pointercancel', (e) => {
  if (!S.press || e.pointerId !== S.press.id) return; // a resting palm elsewhere shouldn't drop the piece
  abortGesture(true); renderTray();
});

function beginDrag() {
  const pr = S.press;
  if (S.phase === 'run') { S.press = null; return; }
  let t, f, from = null;
  if (pr.tray) { t = pr.tray; const g = openGhosts().find(g => g.t === t); f = g ? g.f : false; }
  else { const p = pr.piece; t = p.t; f = p.f; from = { c: p.c, r: p.r }; S.layout = S.layout.filter(q => q !== p); syncViews(); }
  const cand = { t, c: -9, r: -9, f };
  const view = ghostify(pieceView(cand), 0x7dff9a, 0.7);
  view.visible = false; scene.add(view);
  S.drag = { t, f, from, cand, base: cand, view, id: pr.id, touch: pr.touch, ok: false, piece: pr.piece };
  play('pick');
}

function candidateAt(e) {
  const d = S.drag, w = boardPoint(e); if (!w) return null;
  const TT = TYPES[d.t];
  const y = w.y + (d.touch ? LIFT_TOUCH : 0);
  const cand = { t: d.t, f: d.f, c: Math.round(w.x - TT.w / 2), r: Math.round(y - TT.h / 2) };
  // Snap into a matching glowing slot when close — the slot knows which way it faces.
  let best = null, bd = 1.6;
  for (const g of openGhosts()) if (g.t === d.t) {
    const dist = Math.hypot(g.c - cand.c, g.r - cand.r);
    if (dist <= bd) { bd = dist; best = g; }
  }
  if (best) Object.assign(cand, { c: best.c, r: best.r, f: best.f, snapped: true });
  return cand;
}

function moveDrag(e) {
  const d = S.drag;
  const trash = overTray(e);
  const cand = trash ? null : candidateAt(e);
  const ok = !!cand && inBounds(cand) && !overlaps(cand, S.layout);
  if (cand) {
    if (cand.f !== d.base.f) { scene.remove(d.view); d.view = ghostify(pieceView(cand), 0x7dff9a, 0.7); scene.add(d.view); d.base = cand; }
    if (ok && (cand.c !== d.cand.c || cand.r !== d.cand.r)) play('pick');
    d.view.position.set(cand.c - d.base.c, cand.r - d.base.r, 0.3);
    d.cand = cand;
  }
  d.view.visible = !!cand && inBounds(cand);
  d.view.userData.ghostMat.color.set(ok ? 0x7dff9a : 0xff6b6b); d.view.userData.padMat.color.set(ok ? 0x7dff9a : 0xff6b6b);
  d.view.userData.ghostMat.opacity = ok ? 0.8 : 0.3; d.view.userData.padMat.opacity = ok ? 0.45 : 0.1; // a bad spot also goes faint, not just red
  d.ok = ok; d.trash = trash;
}

function place(p, how = 'pop') {
  S.layout.push(p); syncViews(); popView(p); play(how);
  saveFree();
}

function endPress(e) {
  const pr = S.press;
  if (!pr || e.pointerId !== pr.id) return;
  S.press = null;
  if (S.phase === 'run') { abortGesture(true); return; }
  if (S.drag) {
    const d = S.drag; S.drag = null; scene.remove(d.view);
    if (d.ok && inBounds(d.cand) && !overlaps(d.cand, S.layout)) place({ t: d.t, c: d.cand.c, r: d.cand.r, f: d.cand.f });
    else if (d.from && !d.trash && !overlaps({ t: d.t, c: d.from.c, r: d.from.r, f: d.f }, S.layout)) { place({ t: d.t, c: d.from.c, r: d.from.r, f: d.f }, 'nope'); }
    else if (d.from) { play('poof'); syncViews(); saveFree(); }
    else { play('poof'); renderTray(); }
    return;
  }
  // A tap.
  if (pr.tray) { tapTray(pr.tray); renderTray(); }
  else if (pr.piece) {
    const p = pr.piece;
    if (T(p).flip) { p.f = !p.f; refreshView(p); popView(p); play('flip'); saveFree(); }
    else { popView(p, 'wiggle'); play('nope'); }
  }
}

// Tap a tray piece: in a level it flies straight into its glowing slot; in free build it lands in the first open spot.
function tapTray(t) {
  if (S.level) {
    const g = openGhosts().find(g => g.t === t);
    if (g) { if (overlaps(g, S.layout)) { play('nope'); return; } return place({ t, c: g.c, r: g.r, f: g.f }); }
  }
  const TT = TYPES[t], spots = [];
  for (let r = ROWS - TT.h; r >= 0; r--) for (let c = 0; c + TT.w <= COLS; c++) spots.push({ t, c, r, f: false });
  spots.sort((a, b) => (Math.abs(a.c + TT.w / 2 - COLS / 2) + (ROWS - a.r) * 0.6) - (Math.abs(b.c + TT.w / 2 - COLS / 2) + (ROWS - b.r) * 0.6));
  const spot = spots.find(s => !overlaps(s, S.layout));
  if (spot) place(spot); else play('nope');
}

// ---------------- hints: a hand shows what to do after a few quiet seconds ----------------
const hand = $('#hand');
let handAnim = null;
function hideHand() { if (handAnim) { handAnim.cancel(); handAnim = null; } hand.style.opacity = 0; }
function showHint() {
  if (S.screen !== 'play' || S.press || S.drag || !$('#win').classList.contains('hide')) return;
  let from = null, to = null;
  if (S.phase === 'edit' && S.level) {
    const g = openGhosts()[0];
    if (g) {
      const TT = TYPES[g.t], cr = canvas.getBoundingClientRect();
      if (trayCount(g.t) > 0) {
        const tile = $(`#tray .tile[data-t="${g.t}"]`); if (!tile) return;
        const tr = tile.getBoundingClientRect();
        from = { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
      } else {
        // The piece is already on the board somewhere else: show moving it into the gap.
        const stray = S.layout.find(p => !p.lock && p.t === g.t); if (!stray) return;
        from = toScreen(camera, cr, stray.c + T(stray).w / 2, stray.r + T(stray).h / 2);
      }
      to = toScreen(camera, cr, g.c + TT.w / 2, g.r + TT.h / 2);
    } else { const r = $('#go').getBoundingClientRect(); to = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  } else if (S.phase === 'ran' && !S.won) { const r = $('#reset').getBoundingClientRect(); to = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  else if (S.phase === 'edit' && S.mode === 'free') {
    if (S.layout.some(p => p.t === 'start')) { const r = $('#go').getBoundingClientRect(); to = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    else { // no ball on the board: show bringing the start piece back
      const tile = $('#tray .tile[data-t="start"]'); if (!tile) return;
      const tr = tile.getBoundingClientRect(); from = { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
      to = toScreen(camera, canvas.getBoundingClientRect(), 2, ROWS - 1.5);
    }
  }
  if (!to) return;
  const tf = (p, s = 1) => `translate(${p.x - 20}px, ${p.y - 6}px) scale(${s})`;
  hideHand(); hand.style.opacity = 1;
  const frames = from
    ? [{ transform: tf(from), opacity: 0 }, { transform: tf(from, 0.9), opacity: 1, offset: 0.15 }, { transform: tf(to, 0.9), opacity: 1, offset: 0.75 }, { transform: tf(to, 1), opacity: 0 }]
    : [{ transform: tf(to), opacity: 0 }, { transform: tf(to), opacity: 1, offset: 0.2 }, { transform: tf(to, 0.82), offset: 0.4 }, { transform: tf(to), offset: 0.55 }, { transform: tf(to, 0.82), offset: 0.7 }, { transform: tf(to), opacity: 0 }];
  handAnim = hand.animate(frames, { duration: 1800, easing: 'ease-in-out' });
  handAnim.onfinish = () => { hand.style.opacity = 0; handAnim = null; };
}

// ---------------- confetti ----------------
const bits = [];
const CONF = ['#e2231a', '#fe8a18', '#f2cd37', '#2fbf4f', '#36aebf', '#1e6fd9', '#c870a0', '#ffffff'];
function burst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, s = 5 + Math.random() * 9;
    bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, w: 6 + Math.random() * 8, h: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: CONF[i % CONF.length], life: 1 });
  }
}
function drawFx(dt) {
  const w = fx.width / devicePixelRatio, h = fx.height / devicePixelRatio;
  fxc.clearRect(0, 0, w, h);
  const k = dt * 60;
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.vy += 0.3 * k; b.vx *= 0.99; b.x += b.vx * k; b.y += b.vy * k; b.r += b.vr * k; b.life -= 0.006 * k;
    if (b.y > h + 20 || b.life <= 0) { bits.splice(i, 1); continue; }
    fxc.save(); fxc.translate(b.x, b.y); fxc.rotate(b.r); fxc.globalAlpha = Math.min(1, b.life * 2);
    fxc.fillStyle = b.c; fxc.fillRect(-b.w / 2, -b.h / 2, b.w, Math.abs(Math.cos(b.r * 2)) * b.h + 1); fxc.restore();
  }
}

// ---------------- frame loop ----------------
function resize() {
  const r = $('#stage').getBoundingClientRect();
  if (!r.width || !r.height) return;
  renderer.setSize(r.width, r.height, false);
  fitCamera(camera, r.width, r.height);
  vfx.setScale(r.height * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
  fx.width = r.width * devicePixelRatio; fx.height = r.height * devicePixelRatio;
  fxc.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
new ResizeObserver(resize).observe($('#stage'));

let last = performance.now(), pulseT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (S.screen !== 'play') return;
  if (S.phase === 'run' && S.sim) stepRun(dt);
  sciVisuals(dt, now / 1000);
  animatePops(dt);
  pulseT += dt;
  for (const v of S.ghostViews.values()) { const k = 0.5 + 0.5 * Math.sin(pulseT * 5); v.userData.ghostMat.opacity = 0.7 + 0.3 * k; v.userData.padMat.opacity = 0.3 + 0.35 * k; }
  for (let i = flashes.length - 1; i >= 0; i--) { const m = flashes[i].material; m.emissiveIntensity *= Math.pow(0.02, dt); if (m.emissiveIntensity < 0.02) { m.emissiveIntensity = 0; flashes.splice(i, 1); } }
  for (let i = spinStar.length - 1; i >= 0; i--) { const s = spinStar[i]; s.t += dt; s.m.rotation.y = s.t * 14 * Math.max(0, 1 - s.t / 1.6); s.m.scale.setScalar(1 + 0.6 * Math.sin(Math.min(s.t / 1.6, 1) * Math.PI)); if (s.t > 1.6) { s.m.scale.setScalar(1); spinStar.splice(i, 1); } }
  if (kick > 0) { kick = Math.max(0, kick - dt * 2); camera.zoom = 1 + 0.035 * Math.sin(kick * Math.PI); camera.updateProjectionMatrix(); }
  // Hints after quiet time.
  S.idle += dt;
  if (!S.press && !S.drag && S.phase !== 'run' && S.idle > 4.5 && !handAnim) { S.idle = 0; showHint(); }
  renderer.render(scene, camera);
  drawFx(dt);
}

// ---------------- boot ----------------
document.addEventListener('pointerdown', unlock, { once: true });
renderHome();
$('#boot').remove();
$('#home').classList.remove('hide');
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// Test hooks (used by the browser checks; harmless for play).
Object.assign(window.__cr, {
  award, openBook, STICKERS,
  enterLevel, enterFree, showHome, startRun, resetRun, tapTray, openGhosts,
  fill() { for (const g of openGhosts()) place({ ...g }); },
  sim: () => S.sim,
});
