/* Smushlings Quest: Smushville - cheap merged models for the crowd: pedestrian smushlings and toy cars.
   Each model is one vertex-coloured mesh plus one ink-outline mesh, so dozens cost dozens of draw calls,
   not thousands. */
import { THREE, M, INK } from './models.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const S = new THREE.SphereGeometry(1, 8, 6), BX = new THREE.BoxGeometry(1, 1, 1), CN = new THREE.ConeGeometry(1, 1, 6), CY = new THREE.CylinderGeometry(1, 1, 1, 8);
const e = new THREE.Euler(), q = new THREE.Quaternion(), mtx = new THREE.Matrix4(), v = new THREE.Vector3(), sc = new THREE.Vector3();
function part(geo, hex, s, p, r = [0, 0, 0]) {
  let g = geo.clone();
  e.set(r[0], r[1], r[2]); q.setFromEuler(e);
  mtx.compose(v.set(p[0], p[1], p[2]), q, sc.set(...(Array.isArray(s) ? s : [s, s, s])));
  g.applyMatrix4(mtx);
  if (g.index) g = g.toNonIndexed();
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}
function inflate(geo, amt) {
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * amt, p.getY(i) + n.getY(i) * amt, p.getZ(i) + n.getZ(i) * amt);
  g.deleteAttribute('color');
  return g;
}
const MAT = M(0xffffff, { vertexColors: true });

/* ------------------------------------------------------------------ pedestrians */
const HIDES = [0x4ade80, 0x22c55e, 0x2dd4bf, 0x38bdf8, 0x818cf8, 0xc084fc, 0xf472b6, 0xfb7185, 0xfb923c, 0xfacc15, 0xa3e635, 0x60a5fa];
const HATS = [0xff5d8f, 0x7dd3fc, 0xffd166, 0x86efac, 0xc084fc];
const pedCache = [];
function buildPed(i) {
  const r = (n) => { const x = Math.sin(i * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
  const hide = HIDES[Math.floor(r(1) * HIDES.length)], belly = 0xfff6e0, horn = [0xd8a45c, 0x8b5a2b, 0xe8d7b0][Math.floor(r(2) * 3)];
  const plump = 0.85 + r(3) * 0.35;
  const g = [
    part(S, hide, [0.36 * plump, 0.42, 0.33 * plump], [0, 0.55, 0]),
    part(S, belly, [0.26 * plump, 0.3, 0.12], [0, 0.52, 0.24 * plump]),
    part(S, hide, 0.3, [0, 1.05, 0.04]),
    part(S, belly, [0.17, 0.13, 0.15], [0, 0.98, 0.3]),
    part(S, 0xffffff, 0.085, [-0.12, 1.12, 0.25]), part(S, 0xffffff, 0.085, [0.12, 1.12, 0.25]),
    part(S, 0x111111, 0.05, [-0.12, 1.13, 0.32]), part(S, 0x111111, 0.05, [0.12, 1.13, 0.32]),
    part(CN, horn, [0.05, 0.16, 0.05], [-0.11, 1.34, -0.02], [0, 0, 0.25]), part(CN, horn, [0.05, 0.16, 0.05], [0.11, 1.34, -0.02], [0, 0, -0.25]),
    part(S, belly, [0.2, 0.05, 0.14], [-0.34 * plump, 0.78, -0.14], [0, 0, 0.6]), part(S, belly, [0.2, 0.05, 0.14], [0.34 * plump, 0.78, -0.14], [0, 0, -0.6]),
    part(CN, hide, [0.1, 0.38, 0.1], [0, 0.32, -0.4], [-1.9, 0, 0]),
    part(S, hide, [0.12, 0.08, 0.16], [-0.14, 0.07, 0.05]), part(S, hide, [0.12, 0.08, 0.16], [0.14, 0.07, 0.05]),
  ];
  const acc = r(4);
  if (acc < 0.25) g.push(part(CN, HATS[i % HATS.length], [0.13, 0.32, 0.13], [0, 1.45, 0], [-0.15, 0, 0]));
  else if (acc < 0.45) g.push(part(BX, 0x111111, [0.36, 0.08, 0.05], [0, 1.13, 0.34]));
  else if (acc < 0.6) g.push(part(BX, HATS[(i + 2) % HATS.length], [0.34, 0.36, 0.2], [0, 0.65, -0.33]));
  const geo = mergeGeometries(g); g.forEach(x => x.dispose());
  return { geo, ink: inflate(geo, 0.028), hide };
}
export function makePed(variant) {
  const vi = variant % 24;
  if (!pedCache[vi]) pedCache[vi] = buildPed(vi);
  const c = pedCache[vi];
  const g = new THREE.Group();
  const body = new THREE.Mesh(c.geo, MAT); body.castShadow = true;
  const ink = new THREE.Mesh(c.ink, INK);
  const inner = new THREE.Group(); inner.add(body, ink); g.add(inner);
  g.userData = { inner, ink, hide: c.hide };
  return g;
}

/* ------------------------------------------------------------------ cars (toy convertibles) */
export const CAR_COLORS = [0xff5d5d, 0x4fa8ff, 0xffd166, 0x5ed18a, 0xc084fc, 0xff9ec4, 0xff8f3a, 0xffffff, 0x2dd4bf];
const carCache = new Map();
function buildCar(kind, hex) {
  const g = [];
  const dark = new THREE.Color(hex).multiplyScalar(0.7).getHex();
  if (kind === 'truck') {
    g.push(part(BX, hex, [2.1, 0.8, 1.7], [0, 0.7, 1.75]));
    g.push(part(BX, 0x9fd8ff, [1.9, 0.5, 0.08], [0, 1.35, 1.2]));
    g.push(part(BX, 0x8b5a2b, [2.3, 2.1, 3.8], [0, 1.45, -1.1]));
    g.push(part(BX, 0xf2b134, [2.32, 0.3, 3.82], [0, 1.0, -1.1]));
    g.push(part(BX, 0x4b4f5c, [2.2, 0.3, 5.6], [0, 0.35, 0]));
  } else {
    const L = kind === 'van' ? 3.8 : 3.4, Hb = kind === 'van' ? 0.9 : 0.62;
    g.push(part(BX, hex, [1.85, Hb, L], [0, 0.22 + Hb / 2, 0]));
    g.push(part(BX, dark, [1.9, 0.12, L - 0.2], [0, 0.22 + Hb + 0.02, 0]));
    g.push(part(BX, 0x2b2b3a, [1.5, 0.12, 1.6], [0, 0.23 + Hb, -0.35]));
    g.push(part(BX, 0x9fd8ff, [1.6, 0.48, 0.08], [0, 0.22 + Hb + 0.26, 0.55], [-0.3, 0, 0]));
    g.push(part(BX, dark, [1.5, 0.45, 0.2], [0, 0.22 + Hb + 0.2, -0.9]));
    if (kind === 'police') {
      g.push(part(BX, 0x2b6cb0, [1.87, 0.3, 1.4], [0, 0.55, 0.1]));
      g.push(part(BX, 0xff3b3b, [0.5, 0.18, 0.3], [-0.3, 0.22 + Hb + 0.75, -0.9]));
      g.push(part(BX, 0x3b82f6, [0.5, 0.18, 0.3], [0.3, 0.22 + Hb + 0.75, -0.9]));
      g.push(part(BX, 0x666666, [0.1, 0.4, 0.1], [0, 0.22 + Hb + 0.5, -0.9]));
    }
    if (kind === 'sport') g.push(part(BX, dark, [1.9, 0.08, 0.5], [0, 1.25, -1.6]), part(BX, dark, [0.1, 0.4, 0.1], [-0.7, 1.05, -1.6]), part(BX, dark, [0.1, 0.4, 0.1], [0.7, 1.05, -1.6]));
  }
  const L = kind === 'truck' ? 5.6 : kind === 'van' ? 3.8 : 3.4;
  g.push(part(BX, 0xdddddd, [1.95, 0.25, 0.22], [0, 0.4, L / 2 + 0.02]), part(BX, 0xdddddd, [1.95, 0.25, 0.22], [0, 0.4, -L / 2 - 0.02]));
  g.push(part(BX, 0xfff3a0, [0.35, 0.18, 0.06], [-0.6, 0.65, L / 2 + 0.03]), part(BX, 0xfff3a0, [0.35, 0.18, 0.06], [0.6, 0.65, L / 2 + 0.03]));
  g.push(part(BX, 0xff3b3b, [0.3, 0.15, 0.06], [-0.65, 0.65, -L / 2 - 0.03]), part(BX, 0xff3b3b, [0.3, 0.15, 0.06], [0.65, 0.65, -L / 2 - 0.03]));
  const geo = mergeGeometries(g); g.forEach(x => x.dispose());
  return { geo, ink: inflate(geo, 0.035), L };
}
const wheelGeo = (() => { const w = part(CY, 0x222230, [0.4, 0.32, 0.4], [0, 0, 0], [0, 0, Math.PI / 2]), h = part(CY, 0xeeeeee, [0.18, 0.34, 0.18], [0, 0, 0], [0, 0, Math.PI / 2]); return mergeGeometries([w, h]); })();
export function makeCar(kind = 'car', hex = 0xff5d5d) {
  const k = kind + hex;
  if (!carCache.has(k)) carCache.set(k, buildCar(kind, hex));
  const c = carCache.get(k);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const m = new THREE.Mesh(c.geo, MAT); m.castShadow = true; m.receiveShadow = true;
  body.add(m, new THREE.Mesh(c.ink, INK));
  const wheels = [];
  const wz = c.L / 2 - 0.75, wx = kind === 'truck' ? 1.1 : 0.98;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const piv = new THREE.Group(); piv.position.set(x, 0.4, z);
    const w = new THREE.Mesh(wheelGeo, MAT); w.castShadow = true; piv.add(w); body.add(piv); wheels.push(piv);
  }
  const seat = new THREE.Group(); seat.position.set(0, kind === 'truck' ? 0.95 : kind === 'van' ? 0.85 : 0.6, kind === 'truck' ? 1.6 : -0.35); body.add(seat);
  const lights = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.05), new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0 }));
  lights.position.set(0, 0.65, c.L / 2 + 0.07); body.add(lights);
  root.userData = { body, wheels, seat, L: c.L, lights };
  return root;
}
