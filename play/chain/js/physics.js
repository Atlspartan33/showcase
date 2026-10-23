// Rapier 2D world built from a layout. RAPIER is passed in so the same code runs in the browser and in Node tests.
import { parts, joints, COLS, ROWS } from './pieces.js';
import { sciInit, sciRelease, sciHit, sciStep, sciBusy } from './science.js';

export const DT = 1 / 120;
const GRAVITY = -18;

export function buildWorld(RAPIER, layout) {
  const R = RAPIER;
  const world = new R.World({ x: 0, y: GRAVITY });
  world.timestep = DT;
  world.numSolverIterations = 8;
  const bodies = [];          // { body, part, piece, pi (part index) }
  const byCollider = new Map(); // collider handle -> body entry
  const gates = [], goals = [], cars = [], ropes = [];

  const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  const frame = (x, y, hw, hh) => world.createCollider(R.ColliderDesc.cuboid(hw, hh).setTranslation(x, y).setFriction(0.6), ground);
  frame(COLS / 2, -0.25, COLS / 2 + 0.5, 0.25);      // floor
  frame(-0.25, ROWS / 2, 0.25, ROWS / 2 + 2);        // left wall
  frame(COLS + 0.25, ROWS / 2, 0.25, ROWS / 2 + 2);  // right wall
  frame(COLS / 2, ROWS + 0.25, COLS / 2 + 0.5, 0.25);  // ceiling (balloons and rockets)

  // Canonical order: the same machine must behave the same no matter the order its pieces were placed in.
  const ordered = [...layout].sort((a, b) => a.r - b.r || a.c - b.c || (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  for (const piece of ordered) {
    const ps = parts(piece), made = [];
    ps.forEach((part, pi) => {
      if (part.shape === 'none') { made.push(null); return; }
      const dyn = part.body === 'dynamic';
      const desc = (dyn ? R.RigidBodyDesc.dynamic() : R.RigidBodyDesc.fixed()).setTranslation(part.x, part.y).setRotation(part.a);
      if (dyn) desc.setSleeping(true).setCcdEnabled(part.look === 'ball').setLinearDamping(0.05).setAngularDamping(0.1);
      const body = world.createRigidBody(desc);
      const m = part.mat || {};
      const cd = part.shape === 'ball' ? R.ColliderDesc.ball(part.r)
        : part.shape === 'poly' ? R.ColliderDesc.convexHull(new Float32Array(part.pts.flat()))
        : R.ColliderDesc.cuboid(part.hw, part.hh);
      cd.setFriction(m.fric ?? 0.6).setRestitution(m.rest ?? 0.1).setDensity(m.dens ?? 1)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
      if (m.bouncy) cd.setRestitutionCombineRule(R.CoefficientCombineRule.Max);
      if (part.sensor) cd.setSensor(true);
      const col = world.createCollider(cd, body);
      const entry = { body, part, piece, pi, col, dyn };
      byCollider.set(col.handle, entry);
      for (const s of part.sub || []) {
        const sc = world.createCollider(R.ColliderDesc.cuboid(s.hw, s.hh).setTranslation(s.x, s.y).setRotation(s.a || 0)
          .setFriction(m.fric ?? 0.6).setDensity(m.dens ?? 1).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), body);
        byCollider.set(sc.handle, entry);
      }
      if (part.role === 'gate') gates.push(entry);
      if (part.role === 'goal') goals.push(entry);
      if (part.role === 'car') { entry.dir = piece.f ? -1 : 1; entry.drive = 0; cars.push(entry); }
      bodies.push(entry); made.push(entry);
    });
    for (const j of joints(piece)) {
      const a = made[j.a], b = j.b == null ? null : made[j.b];
      const local = (e) => {
        const t = e.body.translation(), ang = e.body.rotation(), dx = j.x - t.x, dy = j.y - t.y;
        return { x: dx * Math.cos(-ang) - dy * Math.sin(-ang), y: dx * Math.sin(-ang) + dy * Math.cos(-ang) };
      };
      const jd = R.JointData.revolute(local(a), b ? local(b) : { x: j.x, y: j.y });
      const joint = world.createImpulseJoint(jd, a.body, b ? b.body : ground, false);
      joint.setContactsEnabled(false);
      if (j.tag === 'rope') ropes.push({ joint, anvil: a, top: { x: j.x, y: j.y }, piece });
    }
  }
  const sim = { world, bodies, byCollider, gates, goals, cars, ropes, events: new R.EventQueue(true), t: 0, goalHits: new Set(), R };
  sciInit(sim);
  return sim;
}

// GO: drop every start gate.
export function release(sim) {
  for (const g of sim.gates) { g.col.setEnabled(false); g.open = true; }
  for (const e of sim.bodies) if (e.part.role === 'ball' && e.piece.t === 'start') e.body.wakeUp();
  sciRelease(sim);
}

// One fixed step. onHit(entryA, entryB, speed) fires for new contacts; onGoal(goalEntry, visitor) once per visitor.
export function step(sim, onHit, onGoal) {
  const { world, events, byCollider } = sim;
  for (const c of sim.cars) {
    if (!c.started && !c.body.isSleeping()) { c.started = true; c.drive = 2.2; c.justStarted = true; }
    c.body.resetForces(false); // Rapier forces persist between steps, so re-apply each step
    if (c.drive > 0) {
      c.drive -= DT;
      if (c.body.linvel().x * c.dir < 4) c.body.addForce({ x: c.dir * c.body.mass() * 12, y: 0 }, true);
    }
  }
  world.step(events);
  sim.t += DT;
  events.drainCollisionEvents((h1, h2, started) => {
    if (!started || sim.spawnCols.has(h1) || sim.spawnCols.has(h2)) return; // foam and water don't clack
    const a = byCollider.get(h1), b = byCollider.get(h2);
    if ((a && a.dead) || (b && b.dead)) return;
    const va = a && a.dyn ? a.body.linvel() : { x: 0, y: 0 }, vb = b && b.dyn ? b.body.linvel() : { x: 0, y: 0 };
    const v = Math.hypot(va.x - vb.x, va.y - vb.y);
    sciHit(sim, a, b, v);
    onHit && onHit(a, b, v);
  });
  sciStep(sim);
  for (const g of sim.goals) {
    world.intersectionPairsWith(g.col, (other) => {
      const e = byCollider.get(other.handle);
      if (!e || !e.dyn || e.dead || sim.goalHits.has(e)) return;
      sim.goalHits.add(e);
      onGoal && onGoal(g, e);
    });
  }
}

// True when nothing is moving any more.
export function settled(sim) {
  return !sciBusy(sim) && sim.bodies.every(e => !e.dyn || e.dead || e.body.isSleeping() || (Math.hypot(e.body.linvel().x, e.body.linvel().y) < 0.05 && Math.abs(e.body.angvel()) < 0.1))
    && sim.cars.every(c => c.drive <= 0);
}
