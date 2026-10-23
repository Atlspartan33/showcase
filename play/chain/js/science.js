// "Science" pieces: fire, heat, steam, foam, water, rockets, balloons. Runs inside the physics step, deterministically
// (seeded random), so Node tests and the browser agree. Everything visible is announced through sim.fx events
// ({ type, x, y, ... }) that main.js turns into sounds, particles and stickers.
import { DT } from './physics.js';

export const REACH = 1.05;      // a steady flame (candle, match) lights things about one cell away
const CATCH = 0.45;             // a ball this close to a flame becomes a fireball
const FIREBALL_S = 8;           // seconds a fireball burns
const SPAWN_CAP = 220;          // foam + water bodies alive at once
const WET_S = 3;                // after being put out, things can't catch fire again for a moment

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
  return dist(px, py, ax + t * dx, ay + t * dy);
}
// World position of a point given in a body's local frame.
function worldOf(body, lx, ly) {
  const t = body.translation(), a = body.rotation(), c = Math.cos(a), s = Math.sin(a);
  return { x: t.x + lx * c - ly * s, y: t.y + lx * s + ly * c };
}

export function sciInit(sim) {
  sim.rand = rng(1234);
  sim.fx = [];
  sim.fires = [];
  sim.spawned = [];             // { body, col, kind: 'foam'|'drop', life, color }
  sim.spawnCols = new Set();
  sim.booms = [];               // explosions: { x, y, t }
  sim.stickers = new Set();     // discoveries already announced this run
  const by = (role) => sim.bodies.filter(e => e.part.role === role);
  sim.matches = by('match'); sim.candles = by('candle'); sim.rockets = by('rocket'); sim.kettles = by('kettle');
  sim.potions = by('potion'); sim.tanks = by('water'); sim.balloons = by('balloon');
  sim.balls = sim.bodies.filter(e => e.dyn && e.part.look === 'ball');
  sim.blocks = sim.bodies.filter(e => e.part.look === 'block' || e.part.look === 'crown');
  for (const e of [...sim.matches, ...sim.candles, ...sim.rockets, ...sim.kettles, ...sim.potions, ...sim.tanks, ...sim.balloons]) e.s = { t: 0 };
  for (const b of sim.balls) b.fire = 0;
}

export function sciRelease(sim) {
  for (const b of sim.balloons) { b.body.setGravityScale(-0.35, true); b.body.setLinearDamping(2.2); b.body.wakeUp(); }
}

function emit(sim, type, x, y, extra) { sim.fx.push({ type, x, y, ...extra }); }
function discover(sim, name, x, y) { if (!sim.stickers.has(name)) { sim.stickers.add(name); emit(sim, 'sticker', x, y, { name }); } }

function light(sim, e, how) {
  if (e.s.lit || e.dead || e.s.done) return;
  e.s.lit = true; e.s.t = 0;
  const p = e.part.pt.flame || e.part.pt.head;
  emit(sim, how === 'strike' ? 'strike' : 'ignite', p.x, p.y, { what: e.part.role });
  if (e.part.role === 'candle') discover(sim, 'candle', p.x, p.y);
}

// Collision hook: matches strike, potions erupt, tanks pour when bumped.
export function sciHit(sim, a, b, v) {
  for (const e of [a, b]) {
    if (!e || e.dead) continue;
    const role = e.part.role;
    if (role === 'match' && v > 0.6) light(sim, e, 'strike');
    else if (role === 'potion' && v > 1.4 && !e.s.go) erupt(sim, e);
    else if (role === 'water' && v > 0.6 && !e.s.go) { e.s.go = true; e.s.t = 0; emit(sim, 'pour', e.part.pt.spout.x, e.part.pt.spout.y); }
  }
}

function erupt(sim, e) {
  e.s.go = true; e.s.t = 0;
  const m = e.part.pt.mouth; emit(sim, 'foam', m.x, m.y); discover(sim, 'foam', m.x, m.y);
}

function spawn(sim, kind, x, y, vx, vy, color) {
  if (sim.spawned.length >= SPAWN_CAP) return;
  const R = sim.R, foam = kind === 'foam';
  const body = sim.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y).setLinvel(vx, vy)
    .setLinearDamping(foam ? 1.2 : 0.1));
  const col = sim.world.createCollider(R.ColliderDesc.ball(foam ? 0.12 : 0.085).setDensity(foam ? 0.15 : 1)
    .setFriction(foam ? 0.8 : 0.05).setRestitution(foam ? 0.1 : 0.2), body);
  sim.spawnCols.add(col.handle);
  sim.spawned.push({ body, col, kind, life: foam ? 7 : 6, max: foam ? 7 : 6, color });
}

function kill(sim, e) {
  if (e.dead) return;
  e.dead = true;
  sim.world.removeRigidBody(e.body);
}

const FOAM = [0xff7eb6, 0xc870a0, 0xffffff, 0xa5ca18, 0x36aebf, 0xf2cd37];

export function sciStep(sim) {
  const { rand } = sim;
  // ---- 1. where is fire right now?
  const fires = sim.fires = [];
  for (const e of sim.matches) if (e.s.lit) fires.push({ x: e.part.pt.head.x, y: e.part.pt.head.y, r: REACH, src: e, steady: true });
  for (const e of sim.candles) if (e.s.lit) fires.push({ x: e.part.pt.flame.x, y: e.part.pt.flame.y, r: REACH, src: e, steady: true });
  for (const b of sim.balls) if (b.fire > 0 && !b.dead) { const p = b.body.translation(); fires.push({ x: p.x, y: p.y, r: 0.6, src: b, ball: true }); }
  for (const e of sim.rockets) if (!e.dead && (e.s.state === 'thrust' || e.s.state === 'fuse')) {
    const p = worldOf(e.body, 0, -e.part.hh - 0.05);
    fires.push({ x: p.x, y: p.y, r: e.s.state === 'thrust' ? 0.9 : 0.15, src: e, exhaust: true });
  }
  for (const b of sim.booms) if (b.t < 0.3) fires.push({ x: b.x, y: b.y, r: 1.5, boom: true });

  const near = (x, y, self, k = 1) => fires.find(f => f.src !== self && dist(x, y, f.x, f.y) < f.r * k);
  // Things take a moment to catch, so you can watch fire travel along the machine.
  const warm = (e, hot, need) => { e.s.warm = hot ? (e.s.warm || 0) + DT : Math.max(0, (e.s.warm || 0) - DT); return e.s.warm >= need; };

  // ---- 2. fire spreads
  for (const e of [...sim.matches, ...sim.candles, ...sim.balls]) if (e.wet > 0) e.wet -= DT;
  for (const e of sim.matches) if (e.s.lit && (e.s.t += DT) > 4) { e.s.lit = false; e.s.done = true; emit(sim, 'fizzle', e.part.pt.head.x, e.part.pt.head.y); } // matches burn out
  for (const e of sim.matches) if (!e.s.lit && !e.s.done && !(e.wet > 0) && warm(e, near(e.part.pt.head.x, e.part.pt.head.y, e), 0.35)) light(sim, e);
  for (const e of sim.candles) if (!e.s.lit && !(e.wet > 0) && warm(e, near(e.part.pt.wick.x, e.part.pt.wick.y, e), 0.35)) light(sim, e);
  for (const b of sim.balls) {
    if (b.dead || b.fire > 0 || b.wet > 0 || b.spent) continue;
    const p = b.body.translation();
    if (fires.some(f => f.src !== b && (f.steady || f.exhaust || f.boom) && dist(p.x, p.y, f.x, f.y) < (f.steady ? CATCH + b.part.r : f.r))) {
      b.fire = FIREBALL_S; emit(sim, 'fireball', p.x, p.y); discover(sim, 'fireball', p.x, p.y);
    }
  }
  for (const b of sim.balls) if (b.fire > 0) { b.fire -= DT; if (b.fire <= 0) { b.spent = true; emit(sim, 'fizzle', b.body.translation().x, b.body.translation().y); } } // a ball only burns once
  for (const rope of sim.ropes) {
    if (rope.burnt) continue;
    const a = rope.top, b = worldOf(rope.anvil.body, 0, rope.anvil.part.hh);
    rope.s = rope.s || { t: 0 };
    if (!rope.burning && warm(rope, fires.some(f => segDist(f.x, f.y, a.x, a.y, b.x, b.y) < f.r), 0.3)) { rope.burning = 0.8; emit(sim, 'burn', (a.x + b.x) / 2, (a.y + b.y) / 2); }
    if (rope.burning) {
      rope.burning -= DT;
      if (rope.burning <= 0) {
        rope.burnt = true; sim.world.removeImpulseJoint(rope.joint, true); rope.anvil.body.wakeUp();
        emit(sim, 'snap', b.x, b.y); discover(sim, 'rope', b.x, b.y);
      }
    }
  }
  for (const e of sim.potions) if (!e.s.go && warm(e, near(e.part.pt.mouth.x, e.part.pt.mouth.y, e, 0.8), 0.5)) erupt(sim, e);

  // ---- 3. rockets: fuse -> thrust -> boom
  for (const e of sim.rockets) {
    if (e.dead) continue;
    const s = e.s, tail = worldOf(e.body, 0, -e.part.hh);
    if (!s.state && warm(e, near(tail.x, tail.y, e), 0.2)) { s.state = 'fuse'; s.t = 0; emit(sim, 'fuse', tail.x, tail.y); }
    if (!s.state) continue;
    s.t += DT;
    if (s.state === 'fuse' && s.t > 0.7) { s.state = 'thrust'; s.t = 0; e.body.wakeUp(); emit(sim, 'launch', tail.x, tail.y); discover(sim, 'rocket', tail.x, tail.y); }
    if (s.state === 'thrust') {
      const m = e.body.mass(), a = e.body.rotation(), v = e.body.linvel();
      e.body.setAngvel(-a * 10, true); // rockets fly straight up
      e.body.setLinvel({ x: v.x * 0.96, y: v.y }, true);
      if (Math.hypot(v.x, v.y) < 9) e.body.applyImpulse({ x: -Math.sin(a) * m * 34 * DT, y: Math.cos(a) * m * 34 * DT }, true);
      if (s.t > 1.3) {
        const p = e.body.translation();
        kill(sim, e);
        sim.booms.push({ x: p.x, y: p.y, t: 0 });
        emit(sim, 'boom', p.x, p.y);
        for (const o of sim.bodies) {
          if (!o.dyn || o.dead) continue;
          const q = o.body.translation(), d = dist(p.x, p.y, q.x, q.y);
          if (d < 2.4 && d > 0.01) { const k = o.body.mass() * 7 * (1 - d / 2.4); o.body.applyImpulse({ x: (q.x - p.x) / d * k, y: (q.y - p.y) / d * k }, true); }
        }
      }
    }
  }
  for (const b of sim.booms) b.t += DT;

  // ---- 4. kettles boil when a flame is underneath; steam lifts things
  for (const e of sim.kettles) {
    const s = e.s, k = e.body.translation(), bottom = k.y - e.part.hh;
    const heated = fires.some(f => !f.boom && Math.abs(f.x - k.x) < 0.6 && f.y < bottom + 0.2 && f.y > bottom - 1.6);
    s.heat = Math.max(0, Math.min(2, (s.heat || 0) + (heated ? DT : -DT * 0.25)));
    if (!s.boil && s.heat >= 1) { s.boil = true; emit(sim, 'boil', k.x, k.y + e.part.hh); discover(sim, 'boil', k.x, k.y); }
    if (s.boil && s.heat <= 0) { s.boil = false; emit(sim, 'cool', k.x, k.y); }
    if (s.boil) {
      const top = k.y + e.part.hh;
      const lift = (body) => { const q = body.translation(); if (Math.abs(q.x - k.x) < 0.5 && q.y > top && q.y < top + 4.5) { body.applyImpulse({ x: (k.x - q.x) * body.mass() * 2 * DT, y: body.mass() * 30 * DT }, true); return q; } };
      for (const o of sim.bodies) if (o.dyn && !o.dead) { const q = lift(o.body); if (q && o.part.look === 'ball' && q.y > top + 1) discover(sim, 'lift', q.x, q.y); }
      for (const o of sim.spawned) lift(o.body);
    }
  }

  // ---- 5. potions foam, tanks pour
  for (const e of sim.potions) if (e.s.go && e.s.t < 1.8) {
    e.s.t += DT; e.s.acc = (e.s.acc || 0) + DT * 26;
    const m = e.part.pt.mouth;
    while (e.s.acc >= 1) { e.s.acc--; spawn(sim, 'foam', m.x + (rand() - 0.5) * 0.15, m.y, (rand() - 0.5) * 3, 5 + rand() * 3.5, FOAM[(rand() * FOAM.length) | 0]); }
  }
  for (const e of sim.tanks) if (e.s.go && e.s.t < 2.5) {
    e.s.t += DT; e.s.acc = (e.s.acc || 0) + DT * 30;
    const sp = e.part.pt.spout, dir = e.piece.f ? -1 : 1;
    while (e.s.acc >= 1) { e.s.acc--; spawn(sim, 'drop', sp.x, sp.y + (rand() - 0.5) * 0.06, dir * (1 + rand() * 0.6), -0.3 - rand() * 0.4, 0x5ab4ff); }
  }

  // ---- 6. water and foam put fires out
  if ((sim.tick = (sim.tick || 0) + 1) % 2 === 0) {
    for (const d of sim.spawned) {
      const q = d.body.translation();
      for (const f of fires) {
        if (f.boom || f.r === 0 || dist(q.x, q.y, f.x, f.y) > (f.ball ? 0.45 : 0.5)) continue;
        const e = f.src;
        if (f.ball) e.fire = 0;
        else if (e.part.role === 'rocket') { if (e.s.state !== 'fuse') continue; e.s.state = null; e.s.warm = 0; }
        else { e.s.lit = false; e.s.warm = 0; }
        e.wet = WET_S;
        emit(sim, 'putout', f.x, f.y); discover(sim, 'putout', f.x, f.y);
        f.r = 0; // gone for the rest of this step
        // Water splashes: a fireball sitting right next to what got doused goes out too.
        for (const b of sim.balls) if (b.fire > 0 && !b.dead) { const bp = b.body.translation(); if (dist(bp.x, bp.y, f.x, f.y) < 0.8) { b.fire = 0; b.wet = WET_S; } }
      }
    }
  }
  for (let i = sim.spawned.length - 1; i >= 0; i--) {
    const d = sim.spawned[i];
    d.life -= DT;
    if (d.life <= 0 || d.body.translation().y < -1) {
      sim.spawnCols.delete(d.col.handle); sim.world.removeRigidBody(d.body); sim.spawned.splice(i, 1);
    }
  }

  // ---- 7. balloons pop near fire or a blast
  for (const e of sim.balloons) {
    if (e.dead) continue;
    const p = e.body.translation();
    if (fires.some(f => f.r > 0 && dist(p.x, p.y, f.x, f.y) < (f.boom ? 2.4 : f.r * 0.6 + e.part.r * 0.5))) {
      kill(sim, e); emit(sim, 'pop', p.x, p.y, { color: e.part.color }); discover(sim, 'pop', p.x, p.y);
    }
  }

  // ---- 8. knocking the tower over counts as a discovery
  if (!sim.stickers.has('crash') && sim.tick % 30 === 0) {
    for (const b of sim.blocks) {
      if (b.dead || b.body.isSleeping()) continue;
      const q = b.body.translation();
      if (dist(q.x, q.y, b.part.x, b.part.y) > 0.8) { discover(sim, 'crash', q.x, q.y); break; }
    }
  }
}

// Still doing something even if nothing is moving right now?
export function sciBusy(sim) {
  return sim.spawned.length > 0
    || [...sim.matches, ...sim.candles, ...sim.rockets, ...sim.potions].some(e => e.s.warm > 0 && !e.s.lit && !e.s.state && !e.s.go)
    || sim.ropes.some(r => r.s && r.s.warm > 0 && !r.burning)
    || sim.kettles.some(e => e.s.heat > 0 && !e.s.boil)
    || sim.rockets.some(e => !e.dead && (e.s.state === 'fuse' || e.s.state === 'thrust'))
    || sim.ropes.some(r => r.burning && !r.burnt)
    || sim.potions.some(e => e.s.go && e.s.t < 1.8) || sim.tanks.some(e => e.s.go && e.s.t < 2.5)
    || sim.balls.some(b => b.fire > 0 && !b.body.isSleeping());
}
