// Visual effects for the science pieces: particle sprays (sparks, embers, steam, smoke, fireworks),
// flickering flames, and instanced foam / water drops that follow their physics bodies.
import * as THREE from 'three';

// ---------------- particles ----------------
const VERT = `
  attribute float size; attribute vec4 rgba; varying vec4 vC; uniform float scale;
  void main() { vC = rgba; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const FRAG = `
  varying vec4 vC;
  void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(0.5, 0.1, d)); }`;

class Pool {
  constructor(n, additive) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.p = Array.from({ length: n }, () => ({ life: 0 }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('rgba', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { scale: { value: 800 } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 3 : 2;
    this.g = g;
  }
  emit(o) {
    const p = this.p[this.i]; this.i = (this.i + 1) % this.n; this.idle = 0;
    Object.assign(p, { x: o.x, y: o.y, z: o.z ?? 0.35, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, r: o.c[0], g: o.c[1], b: o.c[2],
      a: o.a ?? 1, s: o.s ?? 0.15, grow: o.grow ?? 0, life: o.life ?? 1, max: o.life ?? 1, grav: o.grav ?? 0, drag: o.drag ?? 0 });
  }
  update(dt) {
    if (this.idle > 3) return; // nothing emitted for a while: every particle is long dead, skip the upload
    this.idle = (this.idle || 0) + dt;
    for (let k = 0; k < this.n; k++) {
      const p = this.p[k];
      if (p.life <= 0) { this.size[k] = 0; continue; }
      p.life -= dt;
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr + p.grav * dt; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.s += p.grow * dt;
      const k3 = k * 3, k4 = k * 4, f = Math.max(0, p.life / p.max);
      this.pos[k3] = p.x; this.pos[k3 + 1] = p.y; this.pos[k3 + 2] = p.z;
      this.col[k4] = p.r; this.col[k4 + 1] = p.g; this.col[k4 + 2] = p.b; this.col[k4 + 3] = p.a * Math.min(1, f * 1.6);
      this.size[k] = Math.max(0, p.s);
    }
    this.g.attributes.position.needsUpdate = this.g.attributes.rgba.needsUpdate = this.g.attributes.size.needsUpdate = true;
  }
  clear() { for (const p of this.p) p.life = 0; this.idle = 0; this.update(0); }
}

const rgbCache = new Map();
const rgb = (hex) => { let v = rgbCache.get(hex); if (!v) { const c = new THREE.Color(hex); rgbCache.set(hex, v = [c.r, c.g, c.b]); } return v; };
const R = Math.random;

// ---------------- flames ----------------
function flameTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 92, 2, 32, 80, 60);
  grad.addColorStop(0, 'rgba(255,255,220,1)'); grad.addColorStop(0.25, 'rgba(255,210,80,0.95)');
  grad.addColorStop(0.55, 'rgba(255,110,20,0.6)'); grad.addColorStop(1, 'rgba(255,40,0,0)');
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(58, 50, 60, 100, 32, 124); g.bezierCurveTo(4, 100, 6, 50, 32, 4); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,190,90,0.9)'); grad.addColorStop(0.4, 'rgba(255,140,40,0.35)'); grad.addColorStop(1, 'rgba(255,100,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeFx(scene) {
  const add = new Pool(1600, true), soft = new Pool(900, false);
  scene.add(add.points, soft.points);
  const fTex = flameTex(), gTex = glowTex();
  const flameMat = new THREE.SpriteMaterial({ map: fTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const glowMat = new THREE.SpriteMaterial({ map: gTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });
  const flames = new Map(); // key -> { g, outer, glow, seen, size }

  // Instanced foam + water.
  const sphere = new THREE.SphereGeometry(1, 14, 10);
  const foam = new THREE.InstancedMesh(sphere, new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.8, sheen: 0.5 }), 240);
  const drops = new THREE.InstancedMesh(sphere, new THREE.MeshPhysicalMaterial({ color: 0x56b2ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 }), 240);
  foam.count = drops.count = 0; foam.frustumCulled = drops.frustumCulled = false;
  foam.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(240 * 3), 3);
  scene.add(foam, drops);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), C = new THREE.Color();

  const api = {
    setScale(px) { add.mat.uniforms.scale.value = soft.mat.uniforms.scale.value = px; },

    // Mark a flame as alive this frame (created on first use).
    flame(key, x, y, size = 1, z = 0.32) {
      let f = flames.get(key);
      if (!f) {
        const g = new THREE.Group(), outer = new THREE.Sprite(flameMat), glow = new THREE.Sprite(glowMat);
        glow.position.z = -0.25; g.add(glow, outer); g.renderOrder = 4; scene.add(g);
        f = { g, outer, glow, ph: R() * 10 }; flames.set(key, f);
      }
      f.seen = true; f.g.position.set(x, y, z); f.size = size;
      return f;
    },
    // Called once per frame after all flame() calls: flicker the live ones, drop the rest.
    endFlames(t) {
      for (const [k, f] of flames) {
        if (!f.seen) { scene.remove(f.g); flames.delete(k); continue; }
        f.seen = false;
        const s = f.size, fl = 1 + Math.sin(t * 23 + f.ph) * 0.08 + Math.sin(t * 37 + f.ph * 2) * 0.06;
        f.outer.scale.set(0.34 * s * (2 - fl), 0.62 * s * fl, 1); f.outer.position.y = 0.2 * s;
        f.glow.scale.setScalar(1.5 * s * (0.9 + 0.1 * fl));
        if (R() < 0.12 * s) add.emit({ x: f.g.position.x + (R() - 0.5) * 0.1 * s, y: f.g.position.y + 0.35 * s, vx: (R() - 0.5) * 0.4, vy: 1 + R(), c: rgb(0xffa030), s: 0.07, life: 0.6, drag: 1 });
      }
    },
    clearFlames() { for (const f of flames.values()) scene.remove(f.g); flames.clear(); },

    sparks(x, y, n = 20, color = 0xffc040, speed = 3) {
      for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, v = speed * (0.4 + R()); add.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1, c: rgb(color), s: 0.07 + R() * 0.06, life: 0.4 + R() * 0.4, grav: -8, drag: 1.5 }); }
    },
    puff(x, y, n = 8, color = 0xffffff, rise = 1, size = 0.35) {
      for (let i = 0; i < n; i++) soft.emit({ x: x + (R() - 0.5) * 0.3, y: y + (R() - 0.5) * 0.2, vx: (R() - 0.5) * 0.8, vy: rise * (0.6 + R()), c: rgb(color), a: 0.55, s: size * (0.6 + R() * 0.5), grow: 0.6, life: 1 + R() * 0.8, drag: 1.2 });
    },
    exhaust(x, y) {
      for (let i = 0; i < 5; i++) add.emit({ x: x + (R() - 0.5) * 0.12, y, vx: (R() - 0.5) * 1.2, vy: -3 - R() * 3, c: rgb([0xfff0a0, 0xffa030, 0xff5a1a][i % 3]), s: 0.2 + R() * 0.12, grow: -0.2, life: 0.3 + R() * 0.2, drag: 2 });
      if (R() < 0.5) soft.emit({ x, y: y - 0.3, vx: (R() - 0.5) * 1.2, vy: -1 - R(), c: [0.75, 0.77, 0.8], a: 0.5, s: 0.35, grow: 1.2, life: 1.4, drag: 1.5 });
    },
    smoke(x, y, n = 6) { this.puff(x, y, n, 0x9aa3ad, 0.8, 0.4); },
    steam(x, y) { soft.emit({ x: x + (R() - 0.5) * 0.25, y, vx: (R() - 0.5) * 0.3, vy: 2 + R() * 1.5, c: [1, 1, 1], a: 0.45, s: 0.25, grow: 0.9, life: 1.2 + R() * 0.6, drag: 0.6 }); },
    firework(x, y) {
      const cols = [0xff4f6d, 0xffd23f, 0x5ab4ff, 0x7dff9a, 0xff9f1c, 0xd08cff];
      for (let ring = 0; ring < 2; ring++) {
        const col = cols[(R() * cols.length) | 0], n = 70;
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, v = (ring ? 3.2 : 5.5) * (0.85 + R() * 0.3); add.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: rgb(col), s: 0.13, life: 1.1 + R() * 0.5, grav: -3, drag: 1.4 }); }
      }
      add.emit({ x, y, c: [1, 0.95, 0.8], s: 2.6, grow: -4, life: 0.25 });
      this.smoke(x, y, 10);
    },
    confetti(x, y, color, n = 26) {
      for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, v = 2 + R() * 3; soft.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: rgb(i % 3 ? color : 0xffffff), a: 1, s: 0.1, life: 0.9, grav: -9, drag: 1 }); }
    },
    bubbles(x, y, n = 10) { for (let i = 0; i < n; i++) soft.emit({ x: x + (R() - 0.5) * 0.3, y, vx: (R() - 0.5) * 1.5, vy: 2 + R() * 2, c: rgb([0xff7eb6, 0xffffff, 0xa5ca18][i % 3]), a: 0.9, s: 0.12, grow: 0.1, life: 0.8, grav: -2, drag: 1 }); },

    // Foam and drops mirror the physics spawns each frame.
    syncSpawned(list) {
      let nf = 0, nd = 0;
      for (const d of list) {
        const t = d.body.translation();
        const fade = Math.min(1, d.life / 0.8);
        if (d.kind === 'foam') {
          if (nf >= 240) continue;
          S.setScalar(0.13 * fade + 0.01); P.set(t.x, t.y, 0.05); M.compose(P, Q, S); foam.setMatrixAt(nf, M);
          foam.setColorAt(nf, C.set(d.color)); nf++;
        } else {
          if (nd >= 240) continue;
          S.set(0.09, 0.1, 0.09).multiplyScalar(fade + 0.05); P.set(t.x, t.y, 0.08); M.compose(P, Q, S); drops.setMatrixAt(nd++, M);
        }
      }
      foam.count = nf; drops.count = nd;
      foam.instanceMatrix.needsUpdate = drops.instanceMatrix.needsUpdate = true;
      if (foam.instanceColor) foam.instanceColor.needsUpdate = true;
    },

    update(dt) { add.update(dt); soft.update(dt); },
    clear() { add.clear(); soft.clear(); this.clearFlames(); foam.count = drops.count = 0; },
  };
  return api;
}
