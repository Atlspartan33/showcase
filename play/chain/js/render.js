// three.js side: the Lego baseplate, piece meshes, camera fit, picking and thumbnails.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { parts, COLS, ROWS, LEGO, TYPES } from './pieces.js';

const DEPTH = 0.6;           // how thick pieces are toward the camera
export const BG = 0x13213a;  // page colour behind the board
const PLATE = 0x4f9ee3;      // baseplate blue

// ---------- shared materials + geometry caches ----------
const matCache = new Map();
export function plastic(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshPhysicalMaterial({
    color, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.18, ...opts,
  }));
  return matCache.get(key);
}
const metal = (color) => plastic(color, { metalness: 0.65, roughness: 0.28, clearcoat: 0.3 });
const geoCache = new Map();
function cached(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
const rbox = (w, h, d, r) => cached(`rb${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, h / 2 - 0.001, w / 2 - 0.001)));
const studGeo = cached('stud', () => new THREE.CylinderGeometry(0.1, 0.1, 0.08, 20));

function studs(group, color, xs, y, zs = [0]) {
  for (const x of xs) for (const z of zs) {
    const s = new THREE.Mesh(studGeo, plastic(color)); s.position.set(x, y + 0.04, z); s.castShadow = true; group.add(s);
  }
}

// Beach ball: stripes run pole to pole around the z axis, so from the front you see a pinwheel spin.
function ballTex(color) {
  return cached('balltex' + color, () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 8;
    const g = c.getContext('2d'), cols = ['#' + new THREE.Color(color).getHexString(), '#ffffff', '#f2cd37', '#ffffff', '#1e6fd9', '#ffffff'];
    cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(i * c.width / cols.length, 0, c.width / cols.length + 1, c.height); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  });
}
const ballGeo = (r) => cached('ball' + r, () => new THREE.SphereGeometry(r, 36, 24).rotateX(Math.PI / 2));
const ballMat = (color) => cached('ballmat' + color, () => new THREE.MeshPhysicalMaterial({ map: ballTex(color), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }));

function starShape(R, r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    i ? s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  return s;
}

// ---------- one mesh (group) per part, in the part's local frame ----------
function partMesh(part) {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const { hw = 0, hh = 0, color } = part;
  switch (part.look) {
    case 'plank': case 'post': case 'stop': case 'lever': {
      const mat = part.snd === 'metal' ? metal(color) : plastic(color);
      add(rbox(hw * 2, hh * 2, DEPTH, 0.05), mat);
      for (const s of part.sub || []) add(rbox(s.hw * 2, s.hh * 2, DEPTH, 0.03), mat, s.x, s.y);
      if (part.look === 'post') studs(g, color, [0], hh);
      break;
    }
    case 'gate': add(rbox(hw * 2, hh * 2, DEPTH + 0.1, 0.04), plastic(color)); studs(g, color, [0], hh); break;
    case 'brick': add(rbox(hw * 2, hh * 2, DEPTH + 0.1, 0.05), plastic(color)); studs(g, color, [-0.22, 0.22], hh, [-0.18, 0.18]); break;
    case 'domino': add(rbox(hw * 2, hh * 2, DEPTH - 0.1, 0.04), plastic(color)); studs(g, color, [0], hh); break;
    case 'block': add(rbox(hw * 2, hh * 2, DEPTH - 0.1, 0.04), plastic(color)); studs(g, color, [-0.12, 0.12], hh); break;
    case 'crown': {
      add(rbox(hw * 2, hh * 2, hw * 2, 0.04), metal(color));
      const cone = cached('crownCone', () => new THREE.ConeGeometry(0.07, 0.16, 12));
      for (const x of [-0.13, 0, 0.13]) add(cone, metal(color), x, hh + 0.08);
      break;
    }
    case 'ball': add(ballGeo(part.r), ballMat(color)); break;
    case 'wheel': {
      const tire = cached('tire' + part.r, () => new THREE.CylinderGeometry(part.r, part.r, 0.12, 24).rotateX(Math.PI / 2));
      const hub = cached('hub' + part.r, () => new THREE.CylinderGeometry(part.r * 0.5, part.r * 0.5, 0.13, 6).rotateX(Math.PI / 2));
      for (const z of [-0.26, 0.26]) { add(tire, plastic(LEGO.black, { roughness: 0.7, clearcoat: 0 }), 0, 0, z); add(hub, plastic(LEGO.white), 0, 0, z + Math.sign(z) * 0.005); }
      break;
    }
    case 'car': {
      add(rbox(hw * 2, hh * 2, 0.52, 0.07), plastic(color));
      add(rbox(0.46, 0.26, 0.46, 0.06), plastic(LEGO.white), -0.1, hh + 0.12);
      add(rbox(0.3, 0.18, 0.48, 0.03), plastic(0x243447, { roughness: 0.1, clearcoat: 1 }), -0.06, hh + 0.14);
      add(rbox(0.06, 0.08, 0.4, 0.02), plastic(LEGO.yellow, { emissive: LEGO.yellow, emissiveIntensity: 0.4 }), hw - 0.01, 0.02);
      add(rbox(0.05, 0.08, 0.4, 0.02), plastic(LEGO.red), -hw + 0.01, 0.02);
      studs(g, LEGO.white, [-0.2, 0], hh + 0.25);
      break;
    }
    case 'pad': add(rbox(hw * 2, hh * 2, DEPTH, 0.05), plastic(color)); break;
    case 'spring': {
      const helix = cached('helix', () => {
        const pts = []; for (let i = 0; i <= 80; i++) { const t = i / 80; pts.push(new THREE.Vector3(Math.cos(t * Math.PI * 10) * 0.16, t * 0.26 - 0.13, Math.sin(t * Math.PI * 10) * 0.16)); }
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.025, 6);
      });
      add(helix, metal(0xc9d1d9)); add(rbox(0.5, 0.08, 0.5, 0.03), plastic(LEGO.dark), 0, -0.16);
      break;
    }
    case 'key': {
      g.userData.glow = add(rbox(hw * 2, hh * 2, DEPTH - 0.05, 0.05), plastic(color, { emissive: color, emissiveIntensity: 0 }).clone());
      const pin = cached('pin', () => new THREE.SphereGeometry(0.045, 12, 8));
      for (const x of [-hw * 0.7, hw * 0.7]) add(pin, metal(0xdddddd), x, hh + 0.01, 0.2);
      break;
    }
    case 'pivot': {
      const shape = new THREE.Shape(part.pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const geo = cached('pivot' + part.pts.flat().join(','), () => new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }).translate(0, 0, -DEPTH / 2));
      add(geo, plastic(color));
      break;
    }
    case 'star': {
      const geo = cached('star', () => new THREE.ExtrudeGeometry(starShape(0.2, 0.09), { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }).translate(0, 0, -0.04));
      const m = add(geo, metal(color).clone()); m.position.set(0, 0.62, 0.34); m.userData.star = true;
      break;
    }
    // ---------------- science pieces ----------------
    case 'matchbox': {
      add(rbox(hw * 2, hh * 2, 0.5, 0.04), plastic(color));
      add(rbox(hw * 2 - 0.1, hh * 0.9, 0.52, 0.02), plastic(LEGO.yellow), 0, 0);
      const st = part.sub[0], len = st.hh * 2;
      const stick = add(cached('stick' + len, () => new THREE.CylinderGeometry(0.035, 0.035, len, 8)), plastic(0xe8c89a, { clearcoat: 0, roughness: 0.8 }), st.x, st.y);
      stick.rotation.z = st.a;
      const hx = part.pt.head.x - part.x, hy = part.pt.head.y - part.y;
      g.userData.head = add(cached('mhead', () => new THREE.SphereGeometry(0.08, 14, 10).scale(1, 1.3, 1)), plastic(0xc0262d).clone(), hx - Math.sin(st.a) * 0.02, hy - 0.06);
      g.userData.head.rotation.z = st.a;
      break;
    }
    case 'candle': {
      add(cached('candle', () => new THREE.CylinderGeometry(0.12, 0.125, hh * 2, 20)), plastic(color, { roughness: 0.55, clearcoat: 0.1, sheen: 0.4 }));
      add(cached('drip', () => new THREE.TorusGeometry(0.115, 0.025, 6, 20).rotateX(Math.PI / 2)), plastic(color, { roughness: 0.55 }), 0, hh - 0.04);
      add(cached('wick', () => new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6)), plastic(0x222222), 0, hh + 0.04);
      add(cached('dish', () => new THREE.CylinderGeometry(0.3, 0.24, 0.08, 24)), metal(LEGO.gold), 0, -0.25);
      break;
    }
    case 'hook': {
      add(rbox(hw * 2, hh * 2, 0.4, 0.03), metal(color));
      add(cached('ring', () => new THREE.TorusGeometry(0.06, 0.018, 8, 16)), metal(0x9aa3ad), 0, -0.09);
      break;
    }
    case 'anvil': {
      add(rbox(hw * 1.3, hh * 1.2, 0.4, 0.03), metal(color), 0, -hh * 0.35);
      add(rbox(hw * 2, hh * 0.9, 0.46, 0.04), metal(color), 0, hh * 0.52);
      const horn = add(cached('horn', () => new THREE.ConeGeometry(0.1, 0.24, 14).rotateZ(-Math.PI / 2)), metal(color), hw + 0.1, hh * 0.55);
      horn.scale.set(1, 0.8, 1);
      const L = part.ropeTo.y - part.y - hh;
      g.userData.rope = add(cached('rope' + L.toFixed(2), () => new THREE.CylinderGeometry(0.025, 0.025, L, 8)), plastic(0xc9a46a, { roughness: 0.9, clearcoat: 0 }), 0, hh + L / 2);
      break;
    }
    case 'launchpad': {
      add(rbox(hw * 2, hh * 2 + 0.02, 0.5, 0.02), plastic(color));
      for (const x of [-0.18, 0, 0.18]) add(rbox(0.07, 0.03, 0.52, 0.01), plastic(LEGO.yellow), x, 0.01);
      break;
    }
    case 'rocket': {
      const body = add(cached('rbody', () => new THREE.CylinderGeometry(hw, hw, hh * 1.5, 20)), plastic(LEGO.white), 0, -hh * 0.2);
      add(cached('rband', () => new THREE.CylinderGeometry(hw + 0.005, hw + 0.005, 0.12, 20)), plastic(color), 0, -hh * 0.05);
      add(cached('rnose', () => new THREE.ConeGeometry(hw, hh * 0.55, 20)), plastic(color), 0, hh * 0.55 + hh * 0.275 - 0.02);
      add(cached('rwin', () => new THREE.SphereGeometry(0.075, 14, 10).scale(1, 1, 0.4)), plastic(0x5ab4ff, { roughness: 0.05, clearcoat: 1, emissive: 0x1e6fd9, emissiveIntensity: 0.3 }), 0, hh * 0.28, hw - 0.01);
      const fin = cached('fin', () => { const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.17, -0.12), new THREE.Vector2(0.17, -0.3), new THREE.Vector2(0, -0.2)]); return new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }).translate(0, 0, -0.02); });
      for (const sgn of [1, -1]) { const f = add(fin, plastic(color), sgn * hw * 0.9, -hh * 0.62); f.scale.x = sgn; }
      add(cached('nozzle', () => new THREE.CylinderGeometry(hw * 0.6, hw * 0.85, 0.12, 16)), metal(LEGO.dark), 0, -hh + 0.02);
      void body;
      break;
    }
    case 'kettle': {
      add(cached('kbody', () => new THREE.SphereGeometry(0.34, 28, 18).scale(1, 0.72, 0.9)), metal(color), 0, -0.02);
      add(cached('kbase', () => new THREE.CylinderGeometry(0.24, 0.26, 0.06, 24)), metal(0x6b7580), 0, -hh + 0.03);
      add(cached('klid', () => new THREE.SphereGeometry(0.06, 12, 8)), plastic(LEGO.red), 0, hh + 0.02);
      const spout = add(cached('kspout', () => new THREE.CylinderGeometry(0.035, 0.07, 0.3, 12)), metal(color), 0.33, 0.06);
      spout.rotation.z = -0.9;
      add(cached('khandle', () => new THREE.TorusGeometry(0.16, 0.03, 8, 20, Math.PI)), plastic(LEGO.dark), -0.02, hh - 0.02);
      break;
    }
    case 'flask': {
      const glass = plastic(0xffffff, { roughness: 0.05, transparent: true, opacity: 0.32, clearcoat: 1, depthWrite: false });
      const prof = [[0, -0.18], [0.3, -0.18], [0.31, -0.13], [0.11, 0.2], [0.1, 0.52], [0.14, 0.56]].map(([x, y]) => new THREE.Vector2(x, y));
      add(cached('flaskG', () => new THREE.LatheGeometry(prof, 28)), glass).renderOrder = 2;
      const liq = [[0, -0.16], [0.28, -0.16], [0.29, -0.12], [0.18, 0.06], [0, 0.06]].map(([x, y]) => new THREE.Vector2(x, y));
      g.userData.liquid = add(cached('flaskL', () => new THREE.LatheGeometry(liq, 24)), plastic(color, { emissive: color, emissiveIntensity: 0.35, roughness: 0.2 }));
      for (const [x, y] of [[-0.1, -0.08], [0.08, -0.02], [0.02, -0.11]]) add(cached('bub', () => new THREE.SphereGeometry(0.03, 8, 6)), plastic(0xffffff, { transparent: true, opacity: 0.8 }), x, y, 0.2);
      break;
    }
    case 'tank': {
      const glass = plastic(0xffffff, { roughness: 0.05, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false });
      add(rbox(hw * 2, hh * 2, 0.56, 0.06), glass).renderOrder = 2;
      g.userData.water = add(rbox(hw * 2 - 0.08, hh * 1.4, 0.48, 0.04), plastic(0x3d9df2, { transparent: true, opacity: 0.85, roughness: 0.1 }), 0, -hh * 0.27);
      add(rbox(hw * 2 + 0.04, 0.06, 0.6, 0.02), plastic(LEGO.dark), 0, hh);
      const px = part.pt.spout.x - part.x, py = part.pt.spout.y - part.y;
      add(cached('tap', () => new THREE.CylinderGeometry(0.045, 0.045, 0.22, 10).rotateZ(Math.PI / 2)), metal(0xc9d1d9), Math.abs(px) - 0.1, py);
      add(cached('tapk', () => new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8)), plastic(LEGO.red), Math.abs(px) - 0.14, py + 0.09);
      break;
    }
    case 'balloon': {
      add(cached('balloon' + part.r, () => new THREE.SphereGeometry(part.r, 28, 20).scale(1, 1.14, 1)), plastic(color, { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }));
      add(cached('bknot', () => new THREE.ConeGeometry(0.05, 0.08, 10).rotateX(Math.PI)), plastic(color), 0, -part.r * 1.14 - 0.02);
      add(cached('bstring', () => new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5)), plastic(0xffffff, { clearcoat: 0 }), 0, -part.r * 1.14 - 0.3);
      break;
    }
    default: break;
  }
  return g;
}

// A whole piece: group of part meshes positioned in world space. userData.parts[i] = mesh for part i (or null).
export function pieceView(piece) {
  const root = new THREE.Group();
  const ps = parts(piece);
  root.userData.parts = ps.map(p => {
    if (p.look === 'none') return null;
    const m = partMesh(p);
    m.position.set(p.x, p.y, 0); m.rotation.z = p.a;
    if ((p.look === 'car' || p.look === 'kettle' || p.look === 'tank') && piece.f) m.scale.x = -1; // faces the way it points
    if (p.look === 'star') m.position.z = 0;
    m.userData.part = p; m.userData.home = { x: p.x, y: p.y, a: p.a };
    root.add(m);
    return m;
  });
  root.userData.piece = piece;
  return root;
}

// See-through version for ghost slots and drag previews, with a glowing footprint pad on the baseplate.
export function ghostify(view, color = 0xffffff, opacity = 0.45) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  view.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = o.receiveShadow = false; } });
  const p = view.userData.piece, T = TYPES[p.t];
  const pad = new THREE.Mesh(rbox(T.w - 0.08, T.h - 0.08, 0.04, 0.12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 0.5, depthWrite: false }));
  pad.position.set(p.c + T.w / 2, p.r + T.h / 2, -DEPTH / 2 + 0.06);
  view.add(pad);
  view.userData.ghostMat = mat; view.userData.padMat = pad.material;
  return view;
}

// ---------- the board ----------
export function makeStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4a66, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-3, ROWS + 6, 12); sun.target.position.set(COLS / 2, ROWS / 2, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  scene.add(makeBoard());
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  return { renderer, scene, camera };
}

function makeBoard() {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(rbox(COLS + 0.1, ROWS + 0.1, 0.3, 0.05), plastic(PLATE, { clearcoat: 0.3, roughness: 0.5 }));
  plate.position.set(COLS / 2, ROWS / 2, -DEPTH / 2 - 0.15); plate.receiveShadow = true; g.add(plate);
  // Studs, two per cell each way.
  const inst = new THREE.InstancedMesh(cached('bstud', () => new THREE.CylinderGeometry(0.11, 0.11, 0.07, 16).rotateX(Math.PI / 2)), plastic(PLATE, { clearcoat: 0.3, roughness: 0.5 }), COLS * ROWS * 4);
  const m = new THREE.Matrix4(); let k = 0;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) for (const dx of [0.25, 0.75]) for (const dy of [0.25, 0.75]) {
    m.makeTranslation(c + dx, r + dy, -DEPTH / 2 + 0.035); inst.setMatrixAt(k++, m);
  }
  inst.receiveShadow = true; g.add(inst);
  // Chunky yellow frame: floor, walls, top.
  const frameMat = plastic(LEGO.yellow);
  const bar = (x, y, w, h) => { const b = new THREE.Mesh(rbox(w, h, DEPTH + 0.3, 0.08), frameMat); b.position.set(x, y, 0); b.castShadow = b.receiveShadow = true; g.add(b); };
  bar(COLS / 2, -0.25, COLS + 1, 0.5); bar(COLS / 2, ROWS + 0.2, COLS + 1, 0.4);
  bar(-0.25, ROWS / 2, 0.5, ROWS); bar(COLS + 0.25, ROWS / 2, 0.5, ROWS);
  studs(g, LEGO.yellow, [...Array(COLS + 1).keys()].map(i => i), ROWS + 0.4, [0]);
  return g;
}

export function fitCamera(camera, w, h) {
  camera.aspect = w / h;
  const needH = ROWS + 1.3, needW = COLS + 1.3;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2;
  const D = Math.max(needH, needW / camera.aspect) / t;
  camera.position.set(COLS / 2, ROWS / 2 + 0.05, D);
  camera.lookAt(COLS / 2, ROWS / 2 + 0.05, 0);
  camera.updateProjectionMatrix();
}

// Screen px -> board world (x, y) on the z = 0 plane.
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
export function pick(camera, rect, px, py) {
  ray.setFromCamera({ x: ((px - rect.left) / rect.width) * 2 - 1, y: -((py - rect.top) / rect.height) * 2 + 1 }, camera);
  return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, y: hit.y } : null;
}
export function toScreen(camera, rect, x, y, z = 0) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
}

// ---------- thumbnails (tray icons + level cards) ----------
let thumbR = null;
export function thumbnail(layout, w, h, { board = false, pad = 0.35 } = {}) {
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbR.toneMapping = THREE.ACESFilmicToneMapping;
    const pm = new THREE.PMREMGenerator(thumbR);
    thumbR.userData = { env: pm.fromScene(new RoomEnvironment(), 0.04).texture };
  }
  thumbR.setPixelRatio(1); thumbR.setSize(w, h, false);
  const scene = new THREE.Scene(); scene.environment = thumbR.userData.env; scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4a66, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(-3, 10, 12); scene.add(sun);
  let minX, maxX, minY, maxY;
  if (board) { scene.add(makeBoard()); minX = -0.5; maxX = COLS + 0.5; minY = -0.5; maxY = ROWS + 0.4; }
  else {
    minX = Math.min(...layout.map(p => p.c)); minY = Math.min(...layout.map(p => p.r));
    maxX = Math.max(...layout.map(p => p.c + TYPES[p.t].w)); maxY = Math.max(...layout.map(p => p.r + TYPES[p.t].h));
    if (layout.some(p => p.t === 'goal')) maxY += 0.35;
  }
  for (const p of layout) scene.add(pieceView(p));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const cw = maxX - minX + pad * 2, ch = maxY - minY + pad * 2, asp = w / h;
  const halfW = Math.max(cw, ch * asp) / 2, halfH = halfW / asp;
  Object.assign(cam, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
  cam.position.set((minX + maxX) / 2, (minY + maxY) / 2, 20); cam.updateProjectionMatrix();
  thumbR.render(scene, cam);
  return thumbR.domElement.toDataURL('image/png');
}
