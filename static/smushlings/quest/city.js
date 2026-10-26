/* Smushlings Quest: Smushville - the open-world island city.
   An 8x8 grid of blocks split into four districts, with a road between every block.
   Produces: meshes, AABB colliders (with heights, so you can jump onto things), ramps,
   knock-over street props, traffic lanes, sidewalk paths, landmarks and egg spots. */
import { THREE, M } from './models.js';
import { rng, clamp, DISTRICTS } from './data.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { makeBoot } from './vendor/entities.js';

export const NB = 8, BLK = 34, ROAD = 12, PITCH = BLK + ROAD, SIZE = NB * PITCH + ROAD; // 380
export const LAND0 = -16, LAND1 = SIZE + 16;
export const LANE = 2.6;
export const roadC = k => k * PITCH + ROAD / 2;            // centreline of road k (0..NB)
export const blockX0 = b => ROAD + b * PITCH;              // block b spans [x0, x0 + BLK]
export const districtOf = (x, z) => (x >= SIZE / 2 ? 1 : 0) + (z >= SIZE / 2 ? 2 : 0);

const SPECIAL = {
  '2,2': { kind: 'nest', name: 'Home Nest' },
  '1,1': { kind: 'park', arena: 'king', name: 'Cradle Park' },
  '0,2': { kind: 'hangout', gang: 'sock', name: 'Sock Gang Laundromat' },
  '3,0': { kind: 'park', name: 'Rattle Gardens', lm: 'rattle' },
  '0,0': { kind: 'lot', name: 'Toybox Lot' },
  '2,0': { kind: 'lot', name: 'Blanket Lot' },
  '3,5': { kind: 'nest', name: 'Beach Nest' },
  '1,6': { kind: 'beach', arena: 'duck', name: 'Squeaky Beach' },
  '0,5': { kind: 'hangout', gang: 'duck', name: 'Duck Mafia Docks' },
  '2,4': { kind: 'park', name: 'Bubble Park', lm: 'duck' },
  '4,3': { kind: 'nest', name: 'Downtown Nest' },
  '5,1': { kind: 'plaza', arena: 'serpent', name: 'Hanger Plaza' },
  '6,2': { kind: 'hangout', gang: 'knight', name: 'Tin Legion HQ' },
  '5,3': { kind: 'parkour', name: 'Skyline Steps' },
  '7,0': { kind: 'lot', name: 'Rooftop Lot', lm: 'hanger' },
  '2,7': { kind: 'beach', name: 'Ferris Beach', lm: 'ferris' },
  '7,5': { kind: 'lot', name: 'Boot Monument', lm: 'boot' },
  '4,6': { kind: 'nest', name: 'Factory Nest' },
  '6,6': { kind: 'yard', arena: 'boot', name: 'Boot Factory Yard' },
  '5,5': { kind: 'hangout', gang: 'imp', name: 'Ember Crew Furnace' },
  '7,7': { kind: 'lot', name: 'Scrap Ramps' },
  '7,4': { kind: 'lot', name: 'Crate Canyon' },
};

/* ------------------------------------------------------------------ textures */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function windowTex(emissive) {
  const c = canvas(128, 102), x = c.getContext('2d');
  x.fillStyle = emissive ? '#000' : '#ffffff'; x.fillRect(0, 0, 128, 102);
  if (!emissive) { x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, 96, 128, 6); }
  for (const wx of [14, 78]) {
    if (emissive) { x.fillStyle = '#ffd98a'; x.fillRect(wx, 22, 36, 44); continue; }
    x.fillStyle = '#5b6b8c'; x.fillRect(wx - 3, 19, 42, 50);
    x.fillStyle = '#a9d8ff'; x.fillRect(wx, 22, 36, 44);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(wx + 3, 25, 9, 20);
    x.fillStyle = '#5b6b8c'; x.fillRect(wx + 16, 22, 4, 44);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const crateTex = (() => {
  const c = canvas(64, 64), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 6; x.strokeRect(3, 3, 58, 58);
  x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(0,0,0,.28)'; x.fillText('★', 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

/* ------------------------------------------------------------------ geometry helpers */
function colorize(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function boxGeo(x0, z0, x1, z1, y0, h, hex, windows) {
  const w = x1 - x0, d = z1 - z0;
  let g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (!windows || f === 2 || f === 3) { uv.setXY(i, 0.02, 0.02); continue; }
    const fw = f < 2 ? d : w;
    uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(fw / 4)), uv.getY(i) * Math.max(1, Math.round(h / 3.2)));
  }
  g.translate(x0 + w / 2, y0 + h / 2, z0 + d / 2);
  g = g.toNonIndexed();
  return colorize(g, hex);
}
function prismGeo(x0, z0, x1, z1, y0, rh, hex) {
  const alongX = x1 - x0 >= z1 - z0;
  const p = [];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = y0 + rh;
  if (alongX) {
    const A = [x0, y0, z0], B = [x0, y0, z1], C = [x0, top, cz], D = [x1, y0, z0], E = [x1, y0, z1], F = [x1, top, cz];
    p.push(...A, ...C, ...B, ...D, ...E, ...F, ...A, ...D, ...F, ...A, ...F, ...C, ...B, ...C, ...F, ...B, ...F, ...E);
  } else {
    const A = [x0, y0, z0], B = [x1, y0, z0], C = [cx, top, z0], D = [x0, y0, z1], E = [x1, y0, z1], F = [cx, top, z1];
    p.push(...A, ...B, ...C, ...D, ...F, ...E, ...A, ...C, ...F, ...A, ...F, ...D, ...B, ...E, ...F, ...B, ...F, ...C);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.length / 3 * 2).fill(0.02), 2));
  return colorize(g, hex);
}
function cylGeo(x, z, r, h, hex, y0 = 0, seg = 12) {
  let g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(x, y0 + h / 2, z);
  g = g.toNonIndexed();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.02, 0.02);
  return colorize(g, hex);
}
function sphGeo(x, y, z, r, hex, sx = 1, sy = 1, sz = 1) {
  let g = new THREE.SphereGeometry(r, 18, 12); g.scale(sx, sy, sz); g.translate(x, y, z);
  g = g.toNonIndexed();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.02, 0.02);
  return colorize(g, hex);
}
function domeGeo(x, z, r, sy, hex) {
  let g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, sy, 1); g.translate(x, 0, z);
  g = g.toNonIndexed();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.02, 0.02);
  return colorize(g, hex);
}

/* ================================================================== the city */
export function buildCity(scene, seed = 1234) {
  const R = rng(seed);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = a => a[Math.floor(R() * a.length)];
  const colliders = [], ramps = [], blocks = [], eggSpots = [], parked = [], dyn = [], trees = [], crates = [], anim = [], late = [];
  const landmarks = {}, nests = [], gangs = [], arenas = {}, powerSpots = [], orbSpots = [];
  const winGeos = [], plainGeos = [];
  const col = (x0, z0, x1, z1, h, kind = 'solid') => { const c = { x0, z0, x1, z1, h, kind }; colliders.push(c); return c; };
  const bldg = (x0, z0, x1, z1, h, hex, windows = true) => { winGeos.push(boxGeo(x0, z0, x1, z1, 0, h, hex, windows)); return col(x0, z0, x1, z1, h, 'bldg'); };
  const plain = (g) => plainGeos.push(g);
  const crateStack = (x, z, n, hex) => { for (let i = 0; i < n; i++) crates.push({ x, z, y: i, hex }); col(x - 0.5, z - 0.5, x + 0.5, z + 0.5, n, 'crate'); };
  /* a little staircase of crates ending at height n, leading in direction (dx,dz) from (x,z) */
  const stairs = (x, z, dx, dz, n, hex) => { for (let i = 1; i <= n; i++) crateStack(x + dx * (i - 1), z + dz * (i - 1), i, hex); return [x + dx * (n - 1), n, z + dz * (n - 1)]; };
  const tree = (x, z, s = 1, palm = false) => { trees.push({ x, z, s, palm }); col(x - 0.35 * s, z - 0.35 * s, x + 0.35 * s, z + 0.35 * s, 7 * s, 'tree'); };
  const ramp = (x, z, dx, dz) => {
    const L = 6, W = 3.4, h = 1.7;
    const x0 = dx ? (dx > 0 ? x : x - L) : x - W / 2, x1 = dx ? (dx > 0 ? x + L : x) : x + W / 2;
    const z0 = dz ? (dz > 0 ? z : z - L) : z - W / 2, z1 = dz ? (dz > 0 ? z + L : z) : z + W / 2;
    ramps.push({ id: ramps.length, x0, z0, x1, z1, h, dx, dz });
  };
  /* street furniture is solid until something knocks it over; benches, bins and barrels can be stood on */
  const SOLID = { signal: [0.16, 5.2], lamp: [0.18, 4.4], bin: [0.38, 0.95], hydrant: [0.27, 0.9], mailbox: [0.3, 1.3], barrel: [0.47, 1.2], umbrella: [0.12, 2.4], bench: [0.38, 0.6] };
  const prop = (kind, x, z, ry = 0) => {
    const p = { kind, x, z, y: 0, ry, rx: 0, rz: 0, vx: 0, vy: 0, vz: 0, avx: 0, avz: 0, active: false, down: false };
    const sd = SOLID[kind];
    if (sd) {
      p.sr = sd[0]; p.sh = sd[1];
      p.circles = kind === 'bench' ? [[x + Math.cos(ry) * 0.62, z - Math.sin(ry) * 0.62], [x - Math.cos(ry) * 0.62, z + Math.sin(ry) * 0.62]] : [[x, z]];
    }
    dyn.push(p);
  };

  for (let bz = 0; bz < NB; bz++) for (let bx = 0; bx < NB; bx++) {
    const x0 = blockX0(bx), z0 = blockX0(bz), x1 = x0 + BLK, z1 = z0 + BLK, cx = x0 + BLK / 2, cz = z0 + BLK / 2;
    const d = districtOf(cx, cz), D = DISTRICTS[d];
    const sp = SPECIAL[bx + ',' + bz] || {};
    let kind = sp.kind;
    if (!kind) {
      const x = R();
      if (d === 2 && bz === NB - 1) kind = 'beach';
      else if (d === 0) kind = x < 0.5 ? 'houses' : x < 0.62 ? 'park' : x < 0.68 ? 'lot' : x < 0.84 ? 'playground' : 'market';
      else if (d === 1) kind = x < 0.68 ? 'towers' : x < 0.74 ? 'lot' : x < 0.88 ? 'construction' : 'market';
      else if (d === 2) kind = x < 0.55 ? 'beachhouses' : x < 0.7 ? 'park' : x < 0.85 ? 'market' : 'playground';
      else kind = x < 0.6 ? 'warehouses' : x < 0.7 ? 'lot' : 'construction';
    }
    const B = { bx, bz, x0, z0, x1, z1, cx, cz, d, kind, name: sp.name || '', arena: sp.arena, gang: sp.gang };
    blocks.push(B);
    if (sp.name) landmarks[sp.name] = { x: cx, z: cz };
    const ix0 = x0 + 3.5, iz0 = z0 + 3.5, ix1 = x1 - 3.5, iz1 = z1 - 3.5; // inside the sidewalk
    const bc = () => pick(D.bldg), rc = () => pick(D.roof);
    const crateHex = () => pick([0xff6b6b, 0x5fb7e5, 0xffd166, 0x86efac, 0xc084fc, 0xff9ec4]);

    /* sidewalk furniture: lamps, hydrants, bins */
    if (kind !== 'beach') {
      for (const [ax, az, bx2, bz2] of [[x0 + 1, z0 + 1, x1 - 1, z0 + 1], [x0 + 1, z1 - 1, x1 - 1, z1 - 1], [x0 + 1, z0 + 1, x0 + 1, z1 - 1], [x1 - 1, z0 + 1, x1 - 1, z1 - 1]]) {
        for (let t = 0.2; t < 0.9; t += 0.3) {
          prop('lamp', ax + (bx2 - ax) * t, az + (bz2 - az) * t, R() * 6);
          if (R() < 0.35) prop(pick(['bin', 'hydrant', 'mailbox', 'cone']), ax + (bx2 - ax) * (t + 0.12), az + (bz2 - az) * (t + 0.12), R() * 6);
        }
      }
    }

    if (kind === 'houses' || kind === 'beachhouses') {
      for (let lz = 0; lz < 2; lz++) for (let lx = 0; lx < 2; lx++) {
        const lx0 = ix0 + lx * 13.5, lz0 = iz0 + lz * 13.5;
        if (R() < 0.18) { tree(lx0 + 4 + R() * 5, lz0 + 4 + R() * 5, 0.9 + R() * 0.4, kind === 'beachhouses'); prop('bench', lx0 + 7, lz0 + 10, 0); continue; }
        const w = (kind === 'houses' ? 7 : 5.5) + R() * 3, dd = (kind === 'houses' ? 7 : 5.5) + R() * 3;
        const hx0 = lx0 + 1 + R() * (12 - w), hz0 = lz0 + 1 + R() * (12 - dd);
        const flat = R() < 0.3;
        const h = flat ? 2.8 + R() * 0.6 : 3 + R() * 2.5;
        bldg(hx0, hz0, hx0 + w, hz0 + dd, h, bc());
        if (!flat) { const rh = 1.6 + R(); plain(prismGeo(hx0 - 0.3, hz0 - 0.3, hx0 + w + 0.3, hz0 + dd + 0.3, h, rh, rc())); colliders[colliders.length - 1].h = h + rh * 0.6; }
        else {
          plain(boxGeo(hx0 - 0.15, hz0 - 0.15, hx0 + w + 0.15, hz0 + dd + 0.15, h, 0.25, rc(), false));
          /* flat roofs are climbable: crates up to them, an egg on top sometimes */
          const sx = hx0 + w + 0.6, sz = hz0 + 0.6;
          if (sx < ix1 + 2) { stairs(sx + 2, sz, -1, 0, 3, crateHex()); eggSpots.push({ x: hx0 + w / 2, y: h + 0.5, z: hz0 + dd / 2, d }); }
        }
        if (R() < 0.6) tree(lx0 + (hx0 - lx0 > 4 ? 1.8 : 11), lz0 + 11, 0.8 + R() * 0.4, kind === 'beachhouses');
        if (kind === 'beachhouses' && R() < 0.5) prop('umbrella', lx0 + 2 + R() * 9, lz0 + 11.5, 0);
      }
      if (R() < 0.3) parked.push({ x: x0 - 4.8, z: cz + (R() - 0.5) * 16, h: R() < 0.5 ? 0 : Math.PI });
    } else if (kind === 'towers') {
      if (R() < 0.45) {
        const w = 20 + R() * 6, h = 18 + R() * 20, hx0 = cx - w / 2, hz0 = cz - w / 2;
        bldg(hx0, hz0, hx0 + w, hz0 + w, h, bc());
        if (R() < 0.6) { const w2 = w * 0.6, th = 6 + R() * 8; winGeos.push(boxGeo(cx - w2 / 2, cz - w2 / 2, cx + w2 / 2, cz + w2 / 2, h, th, bc(), true)); col(cx - w2 / 2, cz - w2 / 2, cx + w2 / 2, cz + w2 / 2, h + th, 'bldg'); }
        plain(boxGeo(cx - 2, cz - 2, cx + 2, cz + 2, h, 1.5, 0x8b8b9a, false)); col(cx - 2, cz - 2, cx + 2, cz + 2, h + 1.5, 'bldg');
        prop('bench', hx0 - 1.5, cz, Math.PI / 2);
      } else {
        for (let lz = 0; lz < 2; lz++) for (let lx = 0; lx < 2; lx++) {
          const lx0 = ix0 + lx * 13.5, lz0 = iz0 + lz * 13.5;
          const w = 9 + R() * 3, h = 8 + R() * 22;
          bldg(lx0 + 0.5, lz0 + 0.5, lx0 + 0.5 + w, lz0 + 0.5 + w, h, bc());
          plain(boxGeo(lx0 + 2, lz0 + 2, lx0 + 4, lz0 + 4, h, 1.4, 0x8b8b9a, false)); col(lx0 + 2, lz0 + 2, lx0 + 4, lz0 + 4, h + 1.4, 'bldg');
        }
        crateStack(cx, cz + 0.5, 1, crateHex()); prop('bin', cx + 1, cz - 1, 0);
      }
      if (R() < 0.4) parked.push({ x: cx + (R() - 0.5) * 18, z: z0 - 4.8, h: Math.PI / 2 });
    } else if (kind === 'warehouses') {
      const h = 7 + R() * 4;
      bldg(ix0, iz0, ix1, iz0 + 12, h, bc());
      plain(boxGeo(ix0 - 0.2, iz0 - 0.2, ix1 + 0.2, iz0 + 12.2, h, 0.4, rc(), false));
      const chx = ix0 + 3 + R() * 20; plain(cylGeo(chx, iz0 + 6, 1.3, h + 9, 0xa04a3a)); plain(cylGeo(chx, iz0 + 6, 1.45, 1, 0xf2f2f2, h + 7));
      for (let i = 0; i < 3; i++) {
        const ccx = ix0 + 1 + i * 9, ccz = iz0 + 17 + R() * 3, hex = pick([0xd9534f, 0x5bc0de, 0xf0ad4e, 0x5cb85c]);
        if (R() < 0.75) { winGeos.push(boxGeo(ccx, ccz, ccx + 6, ccz + 2.6, 0, 2.6, hex, false)); col(ccx, ccz, ccx + 6, ccz + 2.6, 2.6, 'bldg'); if (R() < 0.5) { stairs(ccx - 0.5, ccz + 3.5, 0, -1, 2, crateHex()); eggSpots.push({ x: ccx + 3, y: 3.1, z: ccz + 1.3, d }); } }
      }
      for (let i = 0; i < 4; i++) prop('barrel', ix0 + R() * 26, iz1 - 1 - R() * 2, 0);
      powerSpots.push({ x: cx, z: iz1 - 2 });
    } else if (kind === 'lot') {
      for (let i = 0; i < 3; i++) { const sx = ix0 + 2 + R() * 22, sz = iz0 + 2 + R() * 22; stairs(sx, sz, R() < 0.5 ? 1 : 0, R() < 0.5 ? 1 : 0 || 1, ri(2, 4), crateHex()); }
      const top = stairs(ix0 + 1, iz1 - 1, 1, 0, 5, crateHex());
      eggSpots.push({ x: top[0], y: top[1] + 0.5, z: top[2], d });
      const dir = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      ramp(cx - dir[0] * 4, cz - dir[1] * 4, dir[0], dir[1]);
      winGeos.push(boxGeo(ix1 - 3, iz0, ix1, iz0 + 1.4, 0, 1.4, 0x3f8f4f, false)); col(ix1 - 3, iz0, ix1, iz0 + 1.4, 1.4);
      for (let i = 0; i < 6; i++) prop('cone', cx + (R() - 0.5) * 20, cz + (R() - 0.5) * 20, 0);
      parked.push({ x: cx + 8, z: cz + 9, h: 0 });
      powerSpots.push({ x: cx, z: cz });
    } else if (kind === 'park' || kind === 'beach') {
      const isBeach = kind === 'beach';
      const n = isBeach ? 7 : 12;
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2, rr = B.arena ? 14 + R() * 2 : 4 + R() * 11;
        const tx = clamp(cx + Math.cos(a) * rr, ix0 + 1, ix1 - 1), tz = clamp(cz + Math.sin(a) * rr, iz0 + 1, iz1 - 1);
        if (Math.hypot(tx - cx, tz - cz) < 3 && !B.arena) continue;
        tree(tx, tz, 0.8 + R() * 0.6, isBeach || d === 2);
      }
      for (let i = 0; i < 4; i++) prop(isBeach ? 'umbrella' : 'bench', ix0 + 2 + R() * 24, iz0 + 2 + R() * 24, R() * 6);
      if (!B.arena) {
        const top = stairs(cx - 2, cz + 2, 1, 0, 3, crateHex());
        if (isBeach) { winGeos.push(boxGeo(cx + 2, cz - 1.5, cx + 5, cz + 1.5, 0, 3.2, 0xffffff, false)); col(cx + 2, cz - 1.5, cx + 5, cz + 1.5, 3.2, 'bldg'); eggSpots.push({ x: cx + 3.5, y: 3.7, z: cz, d }); }
        else eggSpots.push({ x: top[0], y: top[1] + 0.5, z: top[2], d });
        eggSpots.push({ x: ix0 + 1, y: 0.6, z: iz0 + 1, d });
        if (R() < 0.6) ramp(ix0 + 5, cz + 6, 1, 0);
      }
      powerSpots.push({ x: cx + 6, z: cz - 6 });
    } else if (kind === 'plaza') {
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; prop('bench', cx + Math.cos(a) * 15, cz + Math.sin(a) * 15, -a); }
      for (const [tx, tz] of [[ix0, iz0], [ix1, iz0], [ix0, iz1], [ix1, iz1]]) tree(tx, tz, 1);
    } else if (kind === 'yard') {
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + 0.3, ccx = cx + Math.cos(a) * 15, ccz = cz + Math.sin(a) * 15;
        winGeos.push(boxGeo(ccx - 1.3, ccz - 1.3, ccx + 1.3, ccz + 1.3, 0, 2.6, pick([0xd9534f, 0x5bc0de, 0xf0ad4e]), false)); col(ccx - 1.3, ccz - 1.3, ccx + 1.3, ccz + 1.3, 2.6, 'bldg');
      }
      for (let i = 0; i < 8; i++) prop('barrel', ix0 + R() * 26, iz0 + R() * 26, 0);
    } else if (kind === 'nest') {
      plain(domeGeo(cx, cz - 2, 9, 0.85, 0xffc2d6));
      plain(domeGeo(cx, cz - 2, 3, 0.9, 0xffffff));
      for (let i = 0; i < 9; i++) { const a = i * 0.7, r2 = 4 + (i % 3) * 1.6; plain(domeGeo(cx + Math.cos(a) * r2, cz - 2 + Math.sin(a) * r2 * 0.6, 0.9, 0.4, 0xff8fb3)); }
      col(cx - 7.6, cz - 9.6, cx + 7.6, cz + 5.4, 6.5, 'bldg');
      winGeos.push(boxGeo(cx - 1.6, cz + 5.4, cx + 1.6, cz + 6.8, 0, 3, 0x7c4a2a, false)); col(cx - 1.6, cz + 5.4, cx + 1.6, cz + 6.8, 3, 'bldg');
      nests.push({ x: cx, z: cz + 8, name: sp.name });
      tree(ix0 + 1, iz1 - 1, 1); tree(ix1 - 1, iz1 - 1, 1);
      prop('bench', cx - 5, iz1 - 0.5, 0); prop('bench', cx + 5, iz1 - 0.5, 0);
    } else if (kind === 'hangout') {
      const g = sp.gang, hex = { sock: 0x9fe0b0, duck: 0xffe066, knight: 0xb9c2d0, imp: 0xff9a5a }[g];
      bldg(ix0 + 2, iz0 + 1, ix1 - 2, iz0 + 11, 5.5, hex);
      plain(boxGeo(ix0 + 1.6, iz0 + 0.6, ix1 - 1.6, iz0 + 11.4, 5.5, 0.5, 0x3a3346, false));
      for (let i = 0; i < 5; i++) crateStack(ix0 + 2 + i * 5.5, iz1 - 2 - (i % 2) * 2, 1 + (i % 2), crateHex());
      gangs.push({ gang: g, x: cx, z: cz + 4, name: sp.name });
    } else if (kind === 'parkour') {
      /* a spiral of ever-higher platforms around a central tower */
      bldg(cx - 2.5, cz - 2.5, cx + 2.5, cz + 2.5, 17.5, 0xd9c2f0);
      const n = 13;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 * 1.3, r2 = 10 - i * 0.35, px = cx + Math.cos(a) * r2, pz = cz + Math.sin(a) * r2, h = 1.25 + i * 1.25;
        winGeos.push(boxGeo(px - 1.4, pz - 1.4, px + 1.4, pz + 1.4, 0, h, [0xff9ec4, 0x7dd3fc, 0xffd166, 0x86efac][i % 4], false));
        col(px - 1.4, pz - 1.4, px + 1.4, pz + 1.4, h, 'bldg');
        if (i % 3 === 2) orbSpots.push({ x: px, y: h + 0.8, z: pz });
      }
      eggSpots.push({ x: cx, y: 18, z: cz, d, top: true });
      crateStack(cx + 11, cz + 1, 1, crateHex());
    }

    if (kind === 'market') {
      const awn = [0xff6b6b, 0xffd166, 0x5fb7e5, 0x86efac, 0xc084fc, 0xff9ec4];
      for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
        const sx = ix0 + 2 + i * 6.5, sz = iz0 + 4 + row * 14, ac = awn[(i + row * 3 + bx + bz) % awn.length];
        winGeos.push(boxGeo(sx, sz, sx + 5, sz + 1.6, 0, 1.0, 0xb4703a, false)); col(sx, sz, sx + 5, sz + 1.6, 1.0, 'bldg');
        plain(cylGeo(sx + 0.1, sz + 0.1, 0.08, 2.7, 0xeeeeee)); plain(cylGeo(sx + 4.9, sz + 0.1, 0.08, 2.7, 0xeeeeee));
        plain(boxGeo(sx - 0.3, sz - 0.8, sx + 5.3, sz + 1.9, 2.7, 0.18, ac, false));
        plain(boxGeo(sx - 0.3, sz - 0.8, sx + 5.3, sz - 0.6, 2.2, 0.5, ac, false));
        for (let k = 0; k < 4; k++) plain(sphGeo(sx + 0.8 + k * 1.1, 1.25, sz + 0.8, 0.25, pick([0xff5d5d, 0xffd166, 0x86efac, 0xff9ec4])));
        if (R() < 0.5) crateStack(sx + 2.5, sz + 3.2, 1, crateHex());
      }
      eggSpots.push({ x: ix0 + 4.5, y: 1.6, z: iz0 + 4.8, d });
      prop('bin', cx, cz, 0); prop('bench', cx - 4, cz, 0); prop('bench', cx + 4, cz, 0);
      powerSpots.push({ x: cx, z: cz + 4 });
    }
    if (kind === 'playground') {
      for (let i = 0; i < 2; i++) {
        const sx = ix0 + 2 + i * 13, sz = iz0 + 4, fc = i ? 0x4fa8ff : 0xe53935;
        plain(cylGeo(sx, sz, 0.13, 3.1, fc)); plain(cylGeo(sx + 6, sz, 0.13, 3.1, fc)); plain(boxGeo(sx - 0.1, sz - 0.12, sx + 6.1, sz + 0.12, 3.1, 0.22, fc, false));
        col(sx - 0.15, sz - 0.15, sx + 0.15, sz + 0.15, 3.1, 'bldg'); col(sx + 5.85, sz - 0.15, sx + 6.15, sz + 0.15, 3.1, 'bldg');
        for (const k of [1.5, 3, 4.5]) { plain(boxGeo(sx + k - 0.3, sz - 0.3, sx + k + 0.3, sz + 0.3, 0.7, 0.1, 0x333344, false)); plain(cylGeo(sx + k - 0.25, sz, 0.02, 2.4, 0xcccccc, 0.8, 4)); plain(cylGeo(sx + k + 0.25, sz, 0.02, 2.4, 0xcccccc, 0.8, 4)); }
      }
      const rx = ix0 + 3, rz = cz + 2;
      ramp(rx, rz, 1, 0);
      winGeos.push(boxGeo(rx + 6, rz - 1.7, rx + 9.2, rz + 1.7, 0, 1.7, 0xffd166, false)); col(rx + 6, rz - 1.7, rx + 9.2, rz + 1.7, 1.7, 'bldg');
      plain(boxGeo(rx + 6, rz - 1.7, rx + 9.2, rz - 1.5, 1.7, 1.2, 0xff5d8f, false)); plain(boxGeo(rx + 6, rz + 1.5, rx + 9.2, rz + 1.7, 1.7, 1.2, 0xff5d8f, false));
      eggSpots.push({ x: rx + 7.6, y: 2.2, z: rz, d });
      plain(cylGeo(cx + 6, cz + 7, 2.3, 0.5, 0x7dd3fc, 0, 16)); col(cx + 3.7, cz + 4.7, cx + 8.3, cz + 9.3, 0.5, 'bldg');
      for (let i = 0; i < 4; i++) prop('bench', ix0 + 3 + i * 6, iz1 - 0.6, 0);
      powerSpots.push({ x: cx, z: cz + 8 });
    }
    if (kind === 'construction') {
      const fh = 1.7, fc = 0xffa726;
      const fence = (x0f, z0f, x1f, z1f) => { winGeos.push(boxGeo(x0f, z0f, x1f, z1f, 0, fh, fc, false)); col(x0f, z0f, x1f, z1f, fh, 'bldg'); };
      fence(ix0, iz0, ix1, iz0 + 0.3); fence(ix0, iz0, ix0 + 0.3, iz1); fence(ix1 - 0.3, iz0, ix1, iz1);
      fence(ix0, iz1 - 0.3, cx - 3.5, iz1); fence(cx + 3.5, iz1 - 0.3, ix1, iz1);
      const fw = 11, fx0 = cx - fw / 2 - 3, fz0 = iz0 + 3, fhh = 9 + R() * 3;
      winGeos.push(boxGeo(fx0, fz0, fx0 + fw, fz0 + fw, 0, fhh, 0x9aa0ae, false)); col(fx0, fz0, fx0 + fw, fz0 + fw, fhh, 'bldg');
      for (let k = 1; k < 4; k++) plain(boxGeo(fx0 - 0.15, fz0 - 0.15, fx0 + fw + 0.15, fz0 + fw + 0.15, k * fhh / 4, 0.18, 0x6b7280, false));
      eggSpots.push({ x: fx0 + fw / 2, y: fhh + 0.5, z: fz0 + fw / 2, d });
      stairs(fx0 - 2, fz0 + fw + 1.5, 1, 0, 3, crateHex());
      const kx = ix1 - 5, kz = iz0 + 4;
      winGeos.push(boxGeo(kx, kz, kx + 1.4, kz + 1.4, 0, 30, 0xffd23f, false)); col(kx, kz, kx + 1.4, kz + 1.4, 30, 'bldg');
      plain(boxGeo(kx - 14, kz + 0.1, kx + 5, kz + 1.3, 30, 1.2, 0xffd23f, false)); plain(boxGeo(kx + 1.6, kz + 0.3, kx + 4, kz + 1.1, 28.4, 1.6, 0x555566, false));
      plain(cylGeo(kx - 10, kz + 0.7, 0.05, 6, 0x222233, 24)); plain(boxGeo(kx - 10.5, kz + 0.2, kx - 9.5, kz + 1.2, 23.4, 0.6, 0xff5d5d, false));
      winGeos.push(boxGeo(ix0 + 2, iz1 - 5, ix0 + 6.5, iz1 - 3, 0, 1.4, 0x2e8b57, false)); col(ix0 + 2, iz1 - 5, ix0 + 6.5, iz1 - 3, 1.4, 'bldg');
      for (let i = 0; i < 4; i++) crateStack(ix0 + 8 + i * 3, iz1 - 4, 1 + (i % 2), crateHex());
      for (let i = 0; i < 6; i++) prop('cone', ix0 + 3 + R() * 24, iz1 - 8 - R() * 5, 0);
      for (let i = 0; i < 3; i++) prop('barrel', cx + 6 + R() * 6, cz + R() * 4, 0);
      powerSpots.push({ x: cx, z: iz1 - 5 });
    }
    if (sp.lm) {
      const lm = sp.lm;
      if (lm === 'rattle') {
        plain(cylGeo(cx, cz, 0.9, 15, 0xff8fb3)); plain(sphGeo(cx, 19, cz, 6.2, 0xffd166)); plain(sphGeo(cx, 19, cz, 6.5, 0xff5d8f, 1, 0.12, 1.05)); plain(sphGeo(cx, 26, cz, 1.3, 0x7dd3fc));
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; plain(sphGeo(cx + Math.cos(a) * 6.3, 19 + Math.sin(a * 2) * 2, cz + Math.sin(a) * 6.3, 0.7, [0xff5d8f, 0x7dd3fc, 0x86efac][i % 3])); }
        col(cx - 1.2, cz - 1.2, cx + 1.2, cz + 1.2, 25, 'bldg'); landmarks['Giant Rattle'] = { x: cx, z: cz };
      } else if (lm === 'hanger') {
        winGeos.push(boxGeo(ix1 - 11, iz0 + 1, ix1 - 2, iz0 + 10, 0, 62, 0x6d5bb8, true)); col(ix1 - 11, iz0 + 1, ix1 - 2, iz0 + 10, 62, 'bldg');
        plain(boxGeo(ix1 - 10.2, iz0 + 1.8, ix1 - 2.8, iz0 + 9.2, 62, 2, 0x4c3d8f, false));
        const hx = ix1 - 6.5, hz = iz0 + 5.5;
        plain(cylGeo(hx, hz, 0.35, 9, 0xd1d5db, 64)); plain(boxGeo(hx - 6, hz - 0.3, hx + 6, hz + 0.3, 63.6, 0.6, 0xd1d5db, false));
        plain(sphGeo(hx, 75, hz, 0.8, 0xffd166)); landmarks['Hanger Tower'] = { x: hx, z: hz };
      } else if (lm === 'duck') {
        plain(sphGeo(cx, 5.2, cz, 6.2, 0xffd84a, 1, 0.85, 1.15)); plain(sphGeo(cx, 5.5, cz - 6.2, 2.6, 0xffd84a, 0.6, 0.9, 1.1)); plain(sphGeo(cx, 10.8, cz + 3.8, 3.6, 0xffd84a));
        plain(boxGeo(cx - 1.6, cz + 7.2, cx + 1.6, cz + 9.6, 9.9, 0.9, 0xff8a2a, false));
        plain(sphGeo(cx - 1.5, 11.8, cz + 6.9, 0.65, 0xffffff)); plain(sphGeo(cx + 1.5, 11.8, cz + 6.9, 0.65, 0xffffff)); plain(sphGeo(cx - 1.5, 11.8, cz + 7.5, 0.35, 0x111111)); plain(sphGeo(cx + 1.5, 11.8, cz + 7.5, 0.35, 0x111111));
        plain(cylGeo(cx, cz, 8.5, 0.5, 0x7fd3f5, 0, 24)); col(cx - 6.4, cz - 8.4, cx + 6.4, cz + 7, 9.5, 'bldg'); landmarks['Giant Duck'] = { x: cx, z: cz };
      } else if (lm === 'boot') {
        const px = cx, pz = cz;
        winGeos.push(boxGeo(px - 7, pz - 8, px + 7, pz + 8, 0, 2.2, 0xcfc9bd, false)); col(px - 7, pz - 8, px + 7, pz + 8, 2.2, 'bldg');
        col(px - 4, pz - 6, px + 4, pz + 6, 14, 'bldg');
        late.push(g => { const b = makeBoot(); b.scale.setScalar(5.2); b.position.set(px, 2.2, pz); b.rotation.y = Math.PI / 2; b.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(b); });
        landmarks['Giant Boot Statue'] = { x: px, z: pz };
      } else if (lm === 'ferris') {
        const R2 = 11.5, hubY = 13.5;
        for (const sz of [-1, 1]) { winGeos.push(boxGeo(cx - 0.6, cz + sz * 3 - 0.6, cx + 0.6, cz + sz * 3 + 0.6, 0, hubY, 0xff5d8f, false)); col(cx - 1.1, cz + sz * 3 - 0.6, cx + 1.1, cz + sz * 3 + 0.6, 4, 'bldg'); }
        winGeos.push(boxGeo(cx - 6, cz - 5, cx + 6, cz + 5, 0, 0.5, 0xffe9a8, false)); col(cx - 6, cz - 5, cx + 6, cz + 5, 0.5, 'bldg');
        late.push(g => {
          const wheel = new THREE.Group(); wheel.position.set(cx, hubY, cz);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(R2, 0.28, 8, 48), M(0xffffff)); wheel.add(rim);
          const rim2 = rim.clone(); rim2.scale.setScalar(0.55); wheel.add(rim2);
          const cabs = [];
          for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            const spoke = new THREE.Mesh(new THREE.BoxGeometry(R2, 0.14, 0.14), M(0xdddddd)); spoke.position.set(Math.cos(a) * R2 / 2, Math.sin(a) * R2 / 2, 0); spoke.rotation.z = a; wheel.add(spoke);
            const cab = new THREE.Group(); cab.position.set(Math.cos(a) * R2, Math.sin(a) * R2, 0);
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.6), M([0xff5d5d, 0x5fb7e5, 0xffd166, 0x86efac, 0xc084fc, 0xff9ec4][i % 6])); body.position.y = -0.8; cab.add(body);
            wheel.add(cab); cabs.push(cab);
          }
          wheel.traverse(o => { if (o.isMesh) o.castShadow = true; });
          g.add(wheel);
          anim.push(dt => { wheel.rotation.z += dt * 0.12; for (const c of cabs) c.rotation.z = -wheel.rotation.z; });
        });
        landmarks['Giant Wheel'] = { x: cx, z: cz };
      }
    }
    if (B.arena) arenas[B.arena] = { x: cx, z: cz, r: 14, name: sp.name };
  }

  /* the beach ring around the island: palms, a few ramps */
  for (let i = 0; i < 70; i++) {
    const t = R() * 4, s = R() * (SIZE + 16) - 8, off = -10 - R() * 4;
    const [x, z] = t < 1 ? [s, off] : t < 2 ? [s, SIZE - off] : t < 3 ? [off, s] : [SIZE - off, s];
    tree(x, z, 0.9 + R() * 0.5, true);
  }
  ramp(roadC(0) + 30, LAND0 + 6.5, 1, 0); ramp(SIZE - 40, LAND1 - 6.5, -1, 0);
  ramp(LAND0 + 6.5, SIZE / 2 + 20, 0, -1); ramp(LAND1 - 6.5, SIZE / 2 - 20, 0, 1);
  /* invisible sea walls */
  col(LAND0 - 5, LAND0 - 5, LAND1 + 5, LAND0, 60); col(LAND0 - 5, LAND1, LAND1 + 5, LAND1 + 5, 60);
  col(LAND0 - 5, LAND0, LAND0, LAND1, 60); col(LAND1, LAND0, LAND1 + 5, LAND1, 60);

  /* traffic signals on every intersection corner */
  for (let i = 0; i <= NB; i++) for (let j = 0; j <= NB; j++) {
    const xi = roadC(i), zj = roadC(j);
    for (const [sx, sz] of [[1, 1], [-1, -1]]) prop('signal', xi + sx * 6.9, zj + sz * 6.9, 0);
  }
  /* parked cars at some road edges */
  for (let i = 0; i < 26; i++) {
    const k = ri(0, NB), seg = ri(0, NB - 1), along = blockX0(seg) + 6 + R() * (BLK - 12), side = R() < 0.5 ? -4.8 : 4.8;
    if (R() < 0.5) parked.push({ x: along, z: roadC(k) + side, h: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
    else parked.push({ x: roadC(k) + side, z: along, h: side > 0 ? Math.PI : 0 });
  }

  /* ---------------- spatial hash */
  const CELL = 8, hash = new Map();
  const key = (cx, cz) => (cx + 50) * 1000 + cz + 50;
  colliders.forEach((c, i) => {
    for (let cz = Math.floor(c.z0 / CELL); cz <= Math.floor(c.z1 / CELL); cz++) for (let cx = Math.floor(c.x0 / CELL); cx <= Math.floor(c.x1 / CELL); cx++) {
      const k = key(cx, cz); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i);
    }
  });
  const dynHash = new Map();
  dyn.forEach((p, i) => { const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)); if (!dynHash.has(k)) dynHash.set(k, []); dynHash.get(k).push(i); });
  let stamp = 1; const seen = new Uint32Array(colliders.length);
  function query(x0, z0, x1, z1, out = []) {
    stamp++; out.length = 0;
    for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      const l = hash.get(key(cx, cz)); if (!l) continue;
      for (const i of l) if (seen[i] !== stamp) { seen[i] = stamp; out.push(colliders[i]); }
    }
    return out;
  }
  const qbuf = [];

  /* ---------------- meshes */
  const grp = new THREE.Group(); scene.add(grp);
  for (const f of late) f(grp);
  const winMat = new THREE.MeshToonMaterial({ vertexColors: true, map: windowTex(false), emissiveMap: windowTex(true), emissive: 0xffffff, emissiveIntensity: 0 });
  const plainMat = M(0xffffff, { vertexColors: true });
  /* merge in chunks so frustum culling still helps */
  const chunk = (geos, mat) => {
    const groups = new Map();
    for (const g of geos) { g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3()); const k = Math.floor(c.x / 95) + ',' + Math.floor(c.z / 95); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); }
    for (const list of groups.values()) {
      const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; m.receiveShadow = true; grp.add(m);
      list.forEach(g => g.dispose());
    }
  };
  chunk(winGeos, winMat); chunk(plainGeos, plainMat);

  /* ground: one big painted texture */
  const TEX = 4096, W = LAND1 - LAND0, ppu = TEX / W;
  const gc = canvas(TEX, TEX), gx = gc.getContext('2d');
  paintGround(gx, ppu, blocks, ramps, true);
  const gtex = new THREE.CanvasTexture(gc); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, W), new THREE.MeshToonMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set((LAND0 + LAND1) / 2, 0, (LAND0 + LAND1) / 2); ground.receiveShadow = true; grp.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshToonMaterial({ color: 0x3fa9e0, emissive: 0x1a6fa8, emissiveIntensity: 0.35 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(SIZE / 2, -0.35, SIZE / 2); grp.add(sea);
  const shore = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, W), new THREE.MeshToonMaterial({ color: 0xe8d39a }));
  shore.position.set((LAND0 + LAND1) / 2, -0.31, (LAND0 + LAND1) / 2); grp.add(shore);

  /* minimap image */
  const MAP = 640, mapC = canvas(MAP, MAP), mx = mapC.getContext('2d');
  mx.drawImage(gc, 0, 0, MAP, MAP);
  const mppu = MAP / W;
  mx.fillStyle = 'rgba(40,30,60,.75)';
  for (const c of colliders) if (c.kind === 'bldg' && c.h > 2) mx.fillRect((c.x0 - LAND0) * mppu, (c.z0 - LAND0) * mppu, (c.x1 - c.x0) * mppu, (c.z1 - c.z0) * mppu);

  /* ramps */
  const rampGeo = new THREE.BufferGeometry();
  {
    // unit wedge rising along +x from 0 to 1, width 1 centred on z
    const p = [0, 0, -0.5, 1, 1, -0.5, 1, 0, -0.5, 0, 0, 0.5, 1, 0, 0.5, 1, 1, 0.5, 0, 0, -0.5, 0, 0, 0.5, 1, 1, 0.5, 0, 0, -0.5, 1, 1, 0.5, 1, 1, -0.5, 1, 0, -0.5, 1, 1, -0.5, 1, 1, 0.5, 1, 0, -0.5, 1, 1, 0.5, 1, 0, 0.5];
    rampGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); rampGeo.computeVertexNormals();
  }
  const rampMat = M(0xffb020, { side: THREE.DoubleSide });
  for (const r of ramps) {
    const m = new THREE.Mesh(rampGeo, rampMat);
    const L = r.dx ? r.x1 - r.x0 : r.z1 - r.z0, Wd = r.dx ? r.z1 - r.z0 : r.x1 - r.x0;
    m.scale.set(L, r.h, Wd);
    const ang = r.dx ? (r.dx > 0 ? 0 : Math.PI) : (r.dz > 0 ? -Math.PI / 2 : Math.PI / 2);
    m.rotation.y = ang;
    const sx = r.dx > 0 ? r.x0 : r.dx < 0 ? r.x1 : (r.x0 + r.x1) / 2, sz = r.dz > 0 ? r.z0 : r.dz < 0 ? r.z1 : (r.z0 + r.z1) / 2;
    m.position.set(sx, 0, sz); m.castShadow = m.receiveShadow = true; grp.add(m);
  }

  /* instanced crates, trees, palms */
  const dummy = new THREE.Object3D(), tc = new THREE.Color();
  const crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ map: crateTex }), Math.max(1, crates.length));
  crates.forEach((c, i) => { dummy.position.set(c.x, c.y + 0.5, c.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); crateMesh.setMatrixAt(i, dummy.matrix); crateMesh.setColorAt(i, tc.setHex(c.hex)); });
  crateMesh.castShadow = crateMesh.receiveShadow = true; grp.add(crateMesh);
  const normal = trees.filter(t => !t.palm), palms = trees.filter(t => t.palm);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 8).translate(0, 0.5, 0), M(0x8b5a2b), Math.max(1, trees.length));
  const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M(0xffffff), Math.max(1, normal.length));
  const fronds = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 0.6, 7).translate(0, 0.3, 0), M(0x3fae5a), Math.max(1, palms.length));
  trees.forEach((t, i) => { dummy.position.set(t.x, 0, t.z); dummy.rotation.set(0, R() * 6, 0); dummy.scale.set(t.s, (t.palm ? 5 : 2.6) * t.s, t.s); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix); });
  normal.forEach((t, i) => { dummy.position.set(t.x, 3.6 * t.s, t.z); dummy.rotation.set(R(), R(), R()); dummy.scale.set(2 * t.s, 1.8 * t.s, 2 * t.s); dummy.updateMatrix(); canopy.setMatrixAt(i, dummy.matrix); canopy.setColorAt(i, tc.setHex(pick([0x5fbf4a, 0x4caf50, 0x7ad35f, 0xff9ec4, 0x8bd17c]))); });
  palms.forEach((t, i) => { dummy.position.set(t.x, 5 * t.s, t.z); dummy.rotation.set(0, R() * 6, 0); dummy.scale.set(2.4 * t.s, 1.2 * t.s, 2.4 * t.s); dummy.updateMatrix(); fronds.setMatrixAt(i, dummy.matrix); });
  for (const m of [trunk, canopy, fronds]) { m.castShadow = true; grp.add(m); }

  /* knock-over props */
  const PROP = {
    signal: { geos: [[new THREE.CylinderGeometry(0.1, 0.13, 5.2, 5).translate(0, 2.6, 0), 0x3b3f4c], [new THREE.BoxGeometry(0.5, 1.5, 0.45).translate(0, 4.6, 0), 0x262833], [new THREE.SphereGeometry(0.17, 6, 4).translate(0, 5.05, 0.24), 0xff4d4d], [new THREE.SphereGeometry(0.17, 6, 4).translate(0, 4.6, 0.24), 0xffd84a], [new THREE.SphereGeometry(0.17, 6, 4).translate(0, 4.15, 0.24), 0x4ade80]] },
    lamp: { geos: [[new THREE.CylinderGeometry(0.09, 0.12, 4.2, 5).translate(0, 2.1, 0), 0x4b4f5c], [new THREE.SphereGeometry(0.32, 6, 4).translate(0, 4.3, 0), 0xfff2b0, true]] },
    bin: { geos: [[new THREE.CylinderGeometry(0.35, 0.3, 0.9, 10).translate(0, 0.45, 0), 0x3f8f4f], [new THREE.CylinderGeometry(0.38, 0.38, 0.1, 10).translate(0, 0.95, 0), 0x2f6f3f]] },
    hydrant: { geos: [[new THREE.CylinderGeometry(0.2, 0.24, 0.8, 10).translate(0, 0.4, 0), 0xe53935], [new THREE.SphereGeometry(0.22, 8, 6).translate(0, 0.8, 0), 0xe53935]] },
    mailbox: { geos: [[new THREE.BoxGeometry(0.1, 0.9, 0.1).translate(0, 0.45, 0), 0x555555], [new THREE.BoxGeometry(0.45, 0.4, 0.7).translate(0, 1.1, 0), 0x1e88e5]] },
    cone: { geos: [[new THREE.ConeGeometry(0.3, 0.8, 10).translate(0, 0.4, 0), 0xff7a1a], [new THREE.CylinderGeometry(0.21, 0.24, 0.12, 10).translate(0, 0.4, 0), 0xffffff]] },
    bench: { geos: [[new THREE.BoxGeometry(2, 0.12, 0.6).translate(0, 0.5, 0), 0xb4703a], [new THREE.BoxGeometry(2, 0.5, 0.1).translate(0, 0.8, -0.28), 0xb4703a], [new THREE.BoxGeometry(1.8, 0.45, 0.4).translate(0, 0.22, 0), 0x4b4f5c]] },
    barrel: { geos: [[new THREE.CylinderGeometry(0.45, 0.45, 1.2, 12).translate(0, 0.6, 0), 0x2b6cb0], [new THREE.CylinderGeometry(0.47, 0.47, 0.1, 12).translate(0, 0.9, 0), 0xffd166]] },
    umbrella: { geos: [[new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6).translate(0, 1.2, 0), 0xffffff], [new THREE.ConeGeometry(1.5, 0.7, 10).translate(0, 2.5, 0), 0xff5d8f]] },
  };
  const propMeshes = {};
  const lampMats = [];
  for (const k in PROP) {
    const list = dyn.filter(p => p.kind === k);
    propMeshes[k] = PROP[k].geos.map(([g, hex, glowy]) => {
      const mat = glowy ? new THREE.MeshToonMaterial({ color: hex, emissive: 0xffe08a, emissiveIntensity: 0 }) : M(hex);
      if (glowy) lampMats.push(mat);
      const m = new THREE.InstancedMesh(g, mat, Math.max(1, list.length)); m.count = list.length; m.castShadow = true; grp.add(m); return m;
    });
    list.forEach((p, i) => { p.inst = i; });
  }
  const placeProp = (p) => {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, p.rz, 'YXZ'); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    for (const m of propMeshes[p.kind]) { m.setMatrixAt(p.inst, dummy.matrix); m.instanceMatrix.needsUpdate = true; }
  };
  dyn.forEach(placeProp);

  /* ---------------- egg spots: 30 spread over the districts */
  const eggs = [];
  for (let dd = 0; dd < 4; dd++) {
    const list = eggSpots.filter(e => e.d === dd);
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    eggs.push(...list.slice(0, dd < 2 ? 8 : 7));
  }
  eggs.forEach((e, i) => e.id = i);

  /* ================================================================== queries */
  const STEP = 0.4;
  /* standing props near a point (knocked-over ones stop being obstacles) */
  const nbuf = [];
  function nearProps(x, z, r) {
    nbuf.length = 0;
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      const l = dynHash.get(key(cx, cz)); if (!l) continue;
      for (const i of l) { const p = dyn[i]; if (p.sr && !p.down && Math.abs(p.x - x) < r + 1.3 && Math.abs(p.z - z) < r + 1.3) nbuf.push(p); }
    }
    return nbuf;
  }
  const city = {
    group: grp, colliders, ramps, blocks, landmarks, nests, gangs, arenas, eggs, parked, powerSpots, orbSpots, dyn, mapCanvas: mapC,
    mapScale: mppu, land0: LAND0, land1: LAND1, winMat, lampMats, sea,
    query,
    /* height you would be standing on at (x,z) given you're currently at height y */
    groundAt(x, z, y, r = 0.3, props = false) {
      let g = 0;
      const rr = r * 0.6;
      for (const c of query(x - rr, z - rr, x + rr, z + rr, qbuf)) {
        if (c.h > 50) continue;
        if (x + rr > c.x0 && x - rr < c.x1 && z + rr > c.z0 && z - rr < c.z1 && c.h <= y + STEP && c.h > g) g = c.h;
      }
      if (props) for (const p of nearProps(x, z, r + 1)) {
        if (p.y + p.sh > y + STEP || p.y + p.sh <= g) continue;
        for (const [cx, cz] of p.circles) if (Math.hypot(x - cx, z - cz) < p.sr + r * 0.5) { g = p.y + p.sh; break; }
      }
      for (const rp of ramps) {
        if (x < rp.x0 || x > rp.x1 || z < rp.z0 || z > rp.z1) continue;
        const u = rp.dx > 0 ? (x - rp.x0) / (rp.x1 - rp.x0) : rp.dx < 0 ? (rp.x1 - x) / (rp.x1 - rp.x0) : rp.dz > 0 ? (z - rp.z0) / (rp.z1 - rp.z0) : (rp.z1 - z) / (rp.z1 - rp.z0);
        const h = u * rp.h;
        if (h <= y + STEP + 0.3 && h > g) g = h;
      }
      return g;
    },
    /* a standing prop at a 3D point, for puffs to hit */
    propAt(x, y, z) {
      for (const p of nearProps(x, z, 0.5)) { if (y > p.y + p.sh) continue; for (const [cx, cz] of p.circles) if (Math.hypot(x - cx, z - cz) < p.sr + 0.15) return p; }
      return null;
    },
    rampAt(x, z) { for (const rp of ramps) if (x >= rp.x0 && x <= rp.x1 && z >= rp.z0 && z <= rp.z1) return rp; return null; },
    /* push a circle out of everything taller than its feet; returns summed normal or null */
    collide(o, r, y = 0, props = false) {
      let hit = null;
      for (let it = 0; it < 2; it++) {
        for (const c of query(o.x - r, o.z - r, o.x + r, o.z + r, qbuf)) {
          if (c.h <= y + STEP) continue;
          const cx = clamp(o.x, c.x0, c.x1), cz = clamp(o.z, c.z0, c.z1);
          let dx = o.x - cx, dz = o.z - cz; const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-8) { const d = Math.sqrt(d2), p = r - d; dx /= d; dz /= d; o.x += dx * p; o.z += dz * p; }
          else {
            const l = o.x - c.x0, rr = c.x1 - o.x, u = o.z - c.z0, b = c.z1 - o.z, m = Math.min(l, rr, u, b);
            if (m === l) { o.x = c.x0 - r; dx = -1; dz = 0; } else if (m === rr) { o.x = c.x1 + r; dx = 1; dz = 0; }
            else if (m === u) { o.z = c.z0 - r; dx = 0; dz = -1; } else { o.z = c.z1 + r; dx = 0; dz = 1; }
          }
          hit = hit || { nx: 0, nz: 0 }; hit.nx += dx; hit.nz += dz;
        }
      }
      if (props) for (const p of nearProps(o.x, o.z, r + 1.2)) {
        if (p.y + p.sh <= y + STEP) continue;
        for (const [cx, cz] of p.circles) {
          const dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz), m = p.sr + r;
          if (d >= m) continue;
          const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
          o.x = cx + nx * m; o.z = cz + nz * m;
          hit = hit || { nx: 0, nz: 0 }; hit.nx += nx; hit.nz += nz;
        }
      }
      return hit;
    },
    /* first box hit along a 3D ray, or maxT */
    raycast(ox, oy, oz, dx, dy, dz, maxT) {
      let best = maxT;
      const ex = ox + dx * maxT, ez = oz + dz * maxT;
      const seenR = new Set();
      const n = Math.ceil(maxT / 4) + 1;
      for (let s = 0; s <= n; s++) {
        const px = ox + (ex - ox) * s / n, pz = oz + (ez - oz) * s / n;
        for (const c of query(px - 4, pz - 4, px + 4, pz + 4, qbuf)) {
          if (seenR.has(c) || c.h > 50) continue; seenR.add(c);
          let t0 = 0, t1 = best;
          for (const [o, dd, a, b] of [[ox, dx, c.x0, c.x1], [oy, dy, 0, c.h], [oz, dz, c.z0, c.z1]]) {
            if (Math.abs(dd) < 1e-9) { if (o < a || o > b) { t0 = 1e9; break; } continue; }
            let ta = (a - o) / dd, tb = (b - o) / dd; if (ta > tb) [ta, tb] = [tb, ta];
            t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) break;
          }
          if (t0 <= t1 && t0 < best && t0 >= 0) best = t0;
        }
      }
      return best;
    },
    los(ax, az, bx, bz, y = 0.8) { const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz) || 1; return city.raycast(ax, y, az, dx / d, 0, dz / d, d) >= d - 0.05; },
    blockAt(x, z) {
      const bx = Math.floor((x - ROAD) / PITCH), bz = Math.floor((z - ROAD) / PITCH);
      if (bx < 0 || bz < 0 || bx >= NB || bz >= NB) return null;
      const b = blocks[bz * NB + bx];
      return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 ? b : null;
    },
    onRoad(x, z) { return x >= 0 && z >= 0 && x <= SIZE && z <= SIZE && !city.blockAt(x, z); },
    /* knock street props near a point; returns how many moved */
    kick(x, z, r, vx, vz, power = 1, lightOnly = false) {
      let n = 0;
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
        const l = dynHash.get(key(cx, cz)); if (!l) continue;
        for (const i of l) {
          const p = dyn[i];
          const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
          if (d > r || (p.active && p.t < 0.3)) continue;
          if (lightOnly && p.sr && !p.down) continue;
          const sp = Math.hypot(vx, vz);
          p.active = true; p.t = 0; p.down = true;
          p.vx = vx * 0.9 + dx / (d || 1) * 2 * power; p.vz = vz * 0.9 + dz / (d || 1) * 2 * power; p.vy = 3 + sp * 0.25 * power;
          p.avx = (Math.random() - 0.5) * 10 * power; p.avz = (Math.random() - 0.5) * 10 * power;
          if (p.kind === 'lamp') { p.vy = 0; p.vx *= 0.15; p.vz *= 0.15; p.fall = Math.atan2(vx || dx, vz || dz); }
          n++; city.onKick && city.onKick(p);
        }
      }
      return n;
    },
    updateDyn(dt) {
      for (const f of anim) f(dt);
      for (const p of dyn) {
        if (!p.active) continue;
        p.t += dt;
        if (p.kind === 'lamp') {
          p.tilt = Math.min(Math.PI / 2, (p.tilt || 0) + dt * (1 + (p.tilt || 0) * 4));
          p.rx = Math.cos(p.fall) * p.tilt; p.rz = -Math.sin(p.fall) * p.tilt; p.ry = 0;
          if (p.tilt >= Math.PI / 2) p.active = false;
          placeProp(p); continue;
        }
        p.vy -= 22 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rx += p.avx * dt; p.rz += p.avz * dt;
        if (p.y <= 0) {
          p.y = 0; p.vy = Math.abs(p.vy) > 2 ? -p.vy * 0.35 : 0; p.vx *= 0.6; p.vz *= 0.6; p.avx *= 0.6; p.avz *= 0.6;
          const snap = Math.PI / 2;
          if (Math.abs(p.vx) + Math.abs(p.vz) + Math.abs(p.vy) < 0.3) { p.rx = Math.round(p.rx / snap) * snap; p.rz = Math.round(p.rz / snap) * snap; if (p.rx || p.rz) p.y = 0.25; p.active = false; }
        }
        placeProp(p);
      }
    },
    setNight(n) {
      winMat.emissiveIntensity = n * 0.9;
      for (const m of lampMats) m.emissiveIntensity = n * 2;
    },
  };
  return city;
}

/* road network, blocks and districts painted onto a canvas (used for the ground and the map) */
function paintGround(x, ppu, blocks, ramps, detail) {
  const P = v => (v - LAND0) * ppu;
  x.fillStyle = '#f0dca0'; x.fillRect(0, 0, x.canvas.width, x.canvas.height);
  /* asphalt over the whole city */
  const ROADS = ['#5d6070', '#383846', '#8a8678', '#55565e'];
  const half = SIZE / 2;
  for (let q = 0; q < 4; q++) { x.fillStyle = ROADS[q]; x.fillRect(P((q & 1) * half), P((q >> 1) * half), (half + 0.5) * ppu, (half + 0.5) * ppu); }
  for (const b of blocks) {
    const D = DISTRICTS[b.d];
    /* sidewalk */
    x.fillStyle = b.kind === 'beach' ? '#f2dfaa' : '#cfcbd8';
    x.fillRect(P(b.x0), P(b.z0), BLK * ppu, BLK * ppu);
    let fill = D.ground;
    if (b.kind === 'park' || b.kind === 'nest') fill = b.d === 2 ? '#a7d98a' : '#86cf68';
    if (b.kind === 'plaza') fill = '#e3d7c3';
    if (b.kind === 'lot' || b.kind === 'yard') fill = '#7d7d88';
    if (b.kind === 'beach') fill = '#f2dfaa';
    if (b.kind === 'parkour') fill = '#c9b8e8';
    x.fillStyle = fill; x.fillRect(P(b.x0 + 2.6), P(b.z0 + 2.6), (BLK - 5.2) * ppu, (BLK - 5.2) * ppu);
    if (detail) {
      if (b.kind === 'houses' || b.kind === 'park' || b.kind === 'nest') {
        x.fillStyle = D.ground2;
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) x.fillRect(P(b.x0 + 2.6 + i * 4.8), P(b.z0 + 2.6 + j * 4.8), 4.8 * ppu, 4.8 * ppu);
      }
      if (b.kind === 'plaza') { x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 2; for (let i = 0; i < 15; i++) { x.beginPath(); x.moveTo(P(b.x0 + 2.6 + i * 2), P(b.z0 + 2.6)); x.lineTo(P(b.x0 + 2.6 + i * 2), P(b.z1 - 2.6)); x.stroke(); x.beginPath(); x.moveTo(P(b.x0 + 2.6), P(b.z0 + 2.6 + i * 2)); x.lineTo(P(b.x1 - 2.6), P(b.z0 + 2.6 + i * 2)); x.stroke(); } }
      if (b.kind === 'park' && !b.arena) { x.fillStyle = '#5ab4e8'; x.beginPath(); x.ellipse(P(b.cx + 6), P(b.cz - 6), 4 * ppu, 3 * ppu, 0, 0, 7); x.fill(); }
      if (b.kind === 'beachhouses') { x.fillStyle = '#7fd3f5'; x.fillRect(P(b.cx - 3), P(b.cz - 2), 6 * ppu, 4 * ppu); }
      if (b.kind === 'lot' || b.kind === 'yard') { x.strokeStyle = '#e8e8f0'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(P(b.x0 + 4 + i * 4.5), P(b.z1 - 9)); x.lineTo(P(b.x0 + 4 + i * 4.5), P(b.z1 - 4)); x.stroke(); } }
      if (b.arena) {
        x.strokeStyle = 'rgba(255,93,143,.6)'; x.lineWidth = 0.6 * ppu; x.setLineDash([2 * ppu, 1.2 * ppu]);
        x.beginPath(); x.arc(P(b.cx), P(b.cz), 14 * ppu, 0, 7); x.stroke(); x.setLineDash([]);
      }
    }
  }
  if (detail) {
    /* lane markings */
    for (let k = 0; k <= NB; k++) {
      const c = roadC(k);
      x.strokeStyle = '#ffd166'; x.lineWidth = 0.25 * ppu; x.setLineDash([2.5 * ppu, 2 * ppu]);
      x.beginPath(); x.moveTo(P(0), P(c)); x.lineTo(P(SIZE), P(c)); x.stroke();
      x.beginPath(); x.moveTo(P(c), P(0)); x.lineTo(P(c), P(SIZE)); x.stroke();
      x.setLineDash([]);
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 0.18 * ppu;
      for (const o of [-5.4, 5.4]) {
        x.beginPath(); x.moveTo(P(0), P(c + o)); x.lineTo(P(SIZE), P(c + o)); x.stroke();
        x.beginPath(); x.moveTo(P(c + o), P(0)); x.lineTo(P(c + o), P(SIZE)); x.stroke();
      }
    }
    /* intersections: clear the markings, paint crosswalks */
    for (let i = 0; i <= NB; i++) for (let j = 0; j <= NB; j++) {
      const cx = roadC(i), cz = roadC(j);
      x.fillStyle = ROADS[(cx >= half ? 1 : 0) + (cz >= half ? 2 : 0)]; x.fillRect(P(cx - ROAD / 2), P(cz - ROAD / 2), ROAD * ppu, ROAD * ppu);
      x.fillStyle = 'rgba(255,255,255,.75)';
      for (let s = -5; s <= 4; s += 1.6) {
        x.fillRect(P(cx + s), P(cz - ROAD / 2 - 2.2), 0.8 * ppu, 2 * ppu); x.fillRect(P(cx + s), P(cz + ROAD / 2 + 0.2), 0.8 * ppu, 2 * ppu);
        x.fillRect(P(cx - ROAD / 2 - 2.2), P(cz + s), 2 * ppu, 0.8 * ppu); x.fillRect(P(cx + ROAD / 2 + 0.2), P(cz + s), 2 * ppu, 0.8 * ppu);
      }
    }
    for (const r of ramps) { x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(P(r.x0), P(r.z0), (r.x1 - r.x0) * ppu, (r.z1 - r.z0) * ppu); }
  }
}
