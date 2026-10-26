/* Smushlings Quest - every mesh in the game, built from primitives (plus the rigged dragon). */
import * as THREE from 'three';
import { toonMat, makeBaby, makeBoot } from './vendor/entities.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone as skClone } from './vendor/SkeletonUtils.js';

export { THREE };
export const GEO = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  lowSphere: new THREE.SphereGeometry(1, 10, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  cone: new THREE.ConeGeometry(1, 1, 14),
  torus: new THREE.TorusGeometry(1, 0.22, 8, 24),
  ico: new THREE.IcosahedronGeometry(1, 0),
  oct: new THREE.OctahedronGeometry(1, 0),
  ring: new THREE.RingGeometry(0.8, 1, 40),
  disc: new THREE.CircleGeometry(1, 32),
};
export const INK = new THREE.MeshBasicMaterial({ color: 0x1a1020, side: THREE.BackSide });
export const M = (c, o) => toonMat(c, o);
export const glow = (c, i = 1) => new THREE.MeshToonMaterial({ color: c, emissive: c, emissiveIntensity: i });

export function part(geo, mat, s, p, ink = 1.08, parent = null) {
  const m = new THREE.Mesh(geo, mat);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]);
  if (p) m.position.set(p[0], p[1], p[2]);
  m.castShadow = true;
  if (ink) { const o = new THREE.Mesh(geo, INK); o.scale.setScalar(ink); m.add(o); }
  if (parent) parent.add(m);
  return m;
}
function eyes(g, y, z, sep, s, pupil = 0x111111, white = 0xffffff) {
  const wm = M(white), pm = new THREE.MeshBasicMaterial({ color: pupil });
  const out = [];
  for (const sx of [-1, 1]) {
    const e = part(GEO.sphere, wm, s, [sx * sep, y, z], 1.12, g);
    const p = part(GEO.sphere, pm, s * 0.55, [sx * sep, y + s * 0.05, z + s * 0.62], 0, g);
    out.push(e, p);
  }
  return out;
}
export function collectMats(g) {
  const s = new Set();
  g.traverse(o => { if (o.isMesh && o.material && o.material !== INK && o.material.emissive) s.add(o.material); });
  return [...s];
}

/* ------------------------------------------------------------------ emoji sprites */
const emojiCache = {};
export function emojiTex(ch) {
  if (emojiCache[ch]) return emojiCache[ch];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.font = '96px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 64, 72);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return emojiCache[ch] = t;
}
export function emojiSprite(ch, s = 0.6) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(ch), transparent: true, depthWrite: false }));
  sp.scale.setScalar(s); return sp;
}

/* ------------------------------------------------------------------ enemies */
const B = {
  slime(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    part(GEO.sphere, M(c), [0.45, 0.36, 0.45], [0, 0.36, 0], 1.08, body);
    part(GEO.cyl, M(0xffffff), [0.22, 0.14, 0.22], [0, 0.72, 0], 1.1, body);
    part(GEO.torus, M(0xff5d8f), [0.22, 0.22, 0.4], [0, 0.72, 0], 0, body).rotation.x = Math.PI / 2;
    eyes(body, 0.44, 0.34, 0.15, 0.1);
    g.userData.body = body; return g;
  },
  bunny(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    part(GEO.sphere, M(c), [0.3, 0.27, 0.3], [0, 0.29, 0], 1.08, body);
    for (const s of [-1, 1]) { const e = part(GEO.sphere, M(c), [0.06, 0.24, 0.07], [s * 0.12, 0.66, -0.04], 1.15, body); e.rotation.z = -s * 0.25; }
    part(GEO.sphere, M(0xff9ec4), 0.05, [0, 0.3, 0.29], 0, body);
    eyes(body, 0.38, 0.22, 0.11, 0.07);
    g.userData.body = body; return g;
  },
  duck(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    part(GEO.sphere, M(c), [0.42, 0.34, 0.46], [0, 0.36, 0], 1.07, body);
    part(GEO.sphere, M(c), 0.25, [0, 0.8, 0.14], 1.08, body);
    part(GEO.box, M(0xff8a2a), [0.24, 0.08, 0.22], [0, 0.76, 0.42], 1.12, body);
    part(GEO.cone, M(c), [0.12, 0.25, 0.12], [0, 0.5, -0.45], 1.1, body).rotation.x = -1.2;
    eyes(body, 0.88, 0.32, 0.11, 0.07);
    g.userData.body = body; return g;
  },
  soldier(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    for (const s of [-1, 1]) part(GEO.cyl, M(0x23305e), [0.08, 0.3, 0.08], [s * 0.1, 0.15, 0], 1.12, body);
    part(GEO.cyl, M(c), [0.22, 0.42, 0.2], [0, 0.5, 0], 1.08, body);
    part(GEO.box, M(0xffd166), [0.5, 0.06, 0.12], [0, 0.66, 0], 1.1, body);
    part(GEO.sphere, M(0xffd7b5), 0.17, [0, 0.88, 0], 1.08, body);
    part(GEO.cyl, M(0x1a1a2e), [0.16, 0.3, 0.16], [0, 1.15, 0], 1.08, body);
    part(GEO.sphere, M(0xff5d8f), 0.07, [0, 1.33, 0], 1.1, body);
    part(GEO.cyl, M(0xcccccc), [0.025, 0.55, 0.025], [0.26, 0.6, 0.18], 0, body).rotation.x = 1.2;
    eyes(body, 0.9, 0.15, 0.07, 0.045);
    g.userData.body = body; return g;
  },
  bat(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.position.y = 1.0;
    part(GEO.sphere, M(c), [0.22, 0.22, 0.26], [0, 0, 0], 1.1, body);
    const wings = [];
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.x = s * 0.15; body.add(piv);
      part(GEO.sphere, M(0xe9ddff), [0.32, 0.03, 0.22], [s * 0.3, 0, 0], 1.15, piv);
      wings.push(piv);
    }
    for (const s of [-1, 1]) part(GEO.cyl, M(0x3b2a5e), [0.01, 0.2, 0.01], [s * 0.06, 0.22, 0.16], 0, body).rotation.x = -0.5;
    eyes(body, 0.04, 0.17, 0.08, 0.07, 0x111111, 0xffe066);
    g.userData.body = body; g.userData.wings = wings; return g;
  },
  bomber(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    part(GEO.box, M(c), 0.6, [0, 0.3, 0], 1.06, body);
    part(GEO.box, M(0xffd166), [0.66, 0.08, 0.66], [0, 0.62, 0], 1.06, body);
    const head = new THREE.Group(); head.position.y = 0.7; body.add(head);
    part(GEO.cyl, M(0xbbbbbb), [0.06, 0.3, 0.06], [0, 0.12, 0], 0, head);
    part(GEO.sphere, M(0xffffff), 0.22, [0, 0.38, 0], 1.08, head);
    part(GEO.sphere, M(0xff3b3b), 0.06, [0, 0.36, 0.22], 0, head);
    part(GEO.cone, M(0xff5d8f), [0.16, 0.3, 0.16], [0, 0.68, 0], 1.08, head);
    eyes(head, 0.44, 0.17, 0.08, 0.05);
    g.userData.body = body; g.userData.head = head; return g;
  },
  roller(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.position.y = 0.45;
    part(GEO.sphere, M(c), 0.42, [0, 0, 0], 1.06, body);
    const sm = M(0xf0e6ff);
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0.7, -0.7, 0], [-0.7, -0.7, 0], [0, 0.7, 0.7], [0, -0.7, -0.7], [0.7, 0, 0.7], [-0.7, 0, -0.7]];
    for (const d of dirs) {
      const v = new THREE.Vector3(...d).normalize();
      const s = part(GEO.cone, sm, [0.09, 0.26, 0.09], [v.x * 0.46, v.y * 0.46, v.z * 0.46], 0, body);
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    }
    g.userData.body = body; return g;
  },
  ghost(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.position.y = 0.6;
    const m = M(c, { transparent: true, opacity: 0.85 });
    part(GEO.sphere, m, [0.38, 0.34, 0.38], [0, 0.2, 0], 0, body);
    const sk = part(GEO.cone, m, [0.42, 0.6, 0.42], [0, -0.15, 0], 0, body); sk.rotation.x = Math.PI;
    for (let i = 0; i < 2; i++) { const s = (i ? 1 : -1); part(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0x1a1020 }), [0.07, 0.11, 0.05], [s * 0.13, 0.26, 0.33], 0, body); }
    part(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0x1a1020 }), [0.07, 0.05, 0.05], [0, 0.1, 0.36], 0, body);
    g.userData.body = body; g.userData.ghostMat = m; return g;
  },
  knight(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    part(GEO.cyl, M(c), [0.3, 0.55, 0.28], [0, 0.4, 0], 1.06, body);
    part(GEO.sphere, M(c), 0.27, [0, 0.86, 0], 1.07, body);
    part(GEO.box, new THREE.MeshBasicMaterial({ color: 0x111111 }), [0.3, 0.06, 0.1], [0, 0.88, 0.23], 0, body);
    part(GEO.cone, M(0xff4d6d), [0.07, 0.3, 0.07], [0, 1.2, -0.05], 1.1, body);
    const shield = new THREE.Group(); shield.position.set(0.05, 0.5, 0.4); body.add(shield);
    part(GEO.box, M(0x3b82f6), [0.6, 0.62, 0.09], [0, 0, 0], 1.08, shield);
    part(GEO.box, M(0xffd166), [0.1, 0.46, 0.1], [0, 0, 0.03], 0, shield);
    part(GEO.box, M(0xffd166), [0.4, 0.1, 0.1], [0, 0.06, 0.03], 0, shield);
    const sword = part(GEO.box, M(0xe5e7eb), [0.06, 0.06, 0.6], [-0.36, 0.5, 0.2], 1.1, body);
    g.userData.body = body; g.userData.shield = shield; g.userData.sword = sword; return g;
  },
  spawner(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.position.y = 0.55;
    part(GEO.ico, M(c), 0.6, [0, 0, 0], 1.06, body);
    for (let i = 0; i < 7; i++) { const a = i * 0.9; part(GEO.ico, M(0xcfc6e0), 0.18, [Math.cos(a) * 0.55, Math.sin(i * 2.1) * 0.4, Math.sin(a) * 0.55], 1.1, body); }
    const core = part(GEO.sphere, glow(0xff5d8f, 1.4), 0.28, [0, 0.1, 0.42], 0, body);
    g.userData.body = body; g.userData.core = core; return g;
  },
  mage(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    part(GEO.cone, M(c), [0.34, 0.75, 0.34], [0, 0.38, 0], 1.07, body);
    part(GEO.sphere, M(0x86efac), 0.2, [0, 0.86, 0], 1.08, body);
    const hat = part(GEO.cone, M(0x4c1d95), [0.22, 0.5, 0.22], [0, 1.22, -0.04], 1.08, body); hat.rotation.x = -0.25;
    const orb = part(GEO.sphere, glow(0xd946ef, 1.6), 0.12, [0.32, 0.7, 0.24], 0, body);
    eyes(body, 0.9, 0.16, 0.07, 0.05, 0x111111, 0xfff176);
    g.userData.body = body; g.userData.orb = orb; return g;
  },
  turret(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    part(GEO.cyl, M(0x475569), [0.55, 0.3, 0.55], [0, 0.15, 0], 1.05, body);
    part(GEO.sphere, M(c), [0.42, 0.36, 0.42], [0, 0.42, 0], 1.06, body);
    const head = new THREE.Group(); head.position.y = 0.55; body.add(head);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const n = part(GEO.cyl, M(0x334155), [0.08, 0.4, 0.08], [Math.sin(a) * 0.38, 0, Math.cos(a) * 0.38], 1.1, head);
      n.rotation.set(Math.PI / 2, 0, 0); n.rotation.order = 'YXZ'; n.rotation.y = a;
    }
    const light = part(GEO.sphere, glow(0xff4d4d, 1.5), 0.1, [0, 0.38, 0], 0, head);
    g.userData.body = body; g.userData.head = head; g.userData.light = light; return g;
  },
  imp(c) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    part(GEO.sphere, glow(c, 0.5), 0.3, [0, 0.32, 0], 1.08, body);
    const fl = part(GEO.cone, glow(0xffd166, 1.4), [0.18, 0.4, 0.18], [0, 0.72, -0.02], 0, body);
    for (const s of [-1, 1]) part(GEO.cone, M(0x3b1a0a), [0.05, 0.16, 0.05], [s * 0.15, 0.6, 0.05], 0, body).rotation.z = -s * 0.4;
    eyes(body, 0.38, 0.24, 0.1, 0.06, 0x111111, 0xfff6c0);
    g.userData.body = body; g.userData.flame = fl; return g;
  },
};
B.minislime = c => { const g = B.slime(c); g.scale.setScalar(0.65); return g; };
B.duckling = c => { const g = B.duck(c); g.scale.setScalar(0.72); return g; };

export function makeEnemy(type, def, elite) {
  const g = B[type](def.color);
  if (elite) {
    const aura = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.7, depthWrite: false }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.04; aura.scale.setScalar(def.r * 1.8);
    g.add(aura); g.userData.aura = aura;
    g.scale.multiplyScalar(1.3);
  }
  g.userData.mats = collectMats(g);
  return g;
}

/* ------------------------------------------------------------------ bosses */
export function makeBoss(kind) {
  let g;
  if (kind === 'king') {
    g = B.slime(0x7ee0a0); g.scale.setScalar(3.3);
    const crown = new THREE.Group(); crown.position.y = 0.82; g.userData.body.add(crown);
    const gold = glow(0xffd166, 0.35);
    part(GEO.cyl, gold, [0.2, 0.08, 0.2], [0, 0, 0], 1.08, crown);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; part(GEO.cone, gold, [0.05, 0.12, 0.05], [Math.cos(a) * 0.17, 0.09, Math.sin(a) * 0.17], 1.1, crown); }
    part(GEO.sphere, glow(0xff5d8f, 1), 0.04, [0, 0.02, 0.2], 0, crown);
  } else if (kind === 'duck') {
    g = B.duck(0xffd84a); g.scale.setScalar(3.4);
    const hat = new THREE.Group(); hat.position.set(0, 1.02, 0.12); g.userData.body.add(hat);
    part(GEO.box, M(0x1f2340), [0.5, 0.1, 0.22], [0, 0, 0], 1.08, hat);
    part(GEO.sphere, M(0x1f2340), [0.18, 0.12, 0.16], [0, 0.08, 0], 1.08, hat);
    part(GEO.sphere, glow(0xffd166, 0.5), 0.05, [0, 0.08, 0.15], 0, hat);
    part(GEO.box, new THREE.MeshBasicMaterial({ color: 0x111111 }), [0.12, 0.1, 0.03], [0.11, 0.88, 0.37], 0, g.userData.body);
  } else if (kind === 'serpent') {
    g = new THREE.Group(); const body = new THREE.Group(); g.add(body); body.position.y = 0.7;
    part(GEO.sphere, M(0xff4d6d), [0.75, 0.6, 0.95], [0, 0, 0], 1.06, body);
    part(GEO.sphere, M(0xffe4ea), [0.6, 0.25, 0.7], [0, -0.28, 0.25], 0, body);
    for (const s of [-1, 1]) part(GEO.cone, M(0xffffff), [0.07, 0.25, 0.07], [s * 0.25, -0.38, 0.75], 0, body).rotation.x = Math.PI;
    eyes(body, 0.32, 0.55, 0.32, 0.18, 0x111111, 0xfff176);
    for (const s of [-1, 1]) part(GEO.cone, M(0xffd166), [0.1, 0.45, 0.1], [s * 0.4, 0.55, -0.3], 1.1, body).rotation.x = -0.6;
    g.userData.body = body;
  } else {
    g = new THREE.Group();
    const boot = makeBoot(); boot.scale.setScalar(2.7); g.add(boot);
    g.userData.body = boot; g.userData.gem = boot.userData.gem;
    boot.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  g.userData.mats = collectMats(g);
  return g;
}
export function makeSegment(i, n) {
  const g = new THREE.Group();
  const s = 0.75 - (i / n) * 0.3;
  const c = i % 2 ? 0xffffff : 0xff4d6d;
  part(GEO.sphere, M(c), [s, s * 0.8, s], [0, 0.6, 0], 1.06, g);
  if (i === n - 1) part(GEO.cyl, glow(0xffd166, 0.5), [0.18, 0.6, 0.18], [0, 0.6, 0], 1.1, g).rotation.x = Math.PI / 2;
  g.userData.r = s; g.userData.mats = collectMats(g);
  return g;
}

/* ------------------------------------------------------------------ player */
let dragonP = null;
export function loadDragon() {
  if (!dragonP) dragonP = new Promise(res => {
    new GLTFLoader().load('../assets/dragon.glb', g => res(g), undefined, () => res(null));
  });
  return dragonP;
}
function inflate(geo, a) {
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * a, p.getY(i) + n.getY(i) * a, p.getZ(i) + n.getZ(i) * a);
  p.needsUpdate = true; return g;
}
export function makePlayerModel(gltf, hide) {
  const root = new THREE.Group();
  let mixer = null, walk = null, model, mats = [];
  if (gltf) {
    model = skClone(gltf.scene);
    const skinned = [];
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (o.material && o.material.name === 'hide') { o.material = o.material.clone(); o.material.color.setHex(hide); }
      if (o.isSkinnedMesh) skinned.push(o);
      if (o.material && o.material.emissive) mats.push(o.material);
    });
    for (const s of skinned) {
      const out = new THREE.SkinnedMesh(inflate(s.geometry, 0.028), INK.clone());
      out.bind(s.skeleton, s.bindMatrix); s.parent.add(out);
    }
    model.scale.setScalar(0.95);
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      walk = mixer.clipAction(gltf.animations[0]); walk.play();
    }
  } else {
    model = makeBaby('normal'); model.scale.setScalar(0.9);
    mats = collectMats(model);
  }
  root.add(model);
  root.userData = { model, mixer, walk, mats, hideMats: mats };
  return root;
}
export function recolorPlayer(root, hide) {
  root.userData.model.traverse(o => { if (o.isMesh && o.material && o.material.name === 'hide') o.material.color.setHex(hide); });
}

/* ------------------------------------------------------------------ props */
export function makeFriend(seed) {
  const types = ['normal', 'normal', 'speedy', 'bouncy', 'golden', 'helmet', 'normal', 'peekaboo', 'ninja', 'normal'];
  let b;
  try { b = makeBaby(types[seed % types.length]); } catch (e) { b = makeBaby('normal'); }
  b.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const g = new THREE.Group(); b.scale.multiplyScalar(0.62); g.add(b);
  if (b.userData.zzz) b.userData.zzz.visible = false;
  g.userData.baby = b;
  return g;
}
export function makeCage(seed) {
  const g = new THREE.Group();
  const wood = M(0x8b5a2b), bar = M(0xd1d5db);
  part(GEO.cyl, wood, [0.55, 0.12, 0.55], [0, 0.06, 0], 1.05, g);
  part(GEO.cyl, wood, [0.55, 0.1, 0.55], [0, 1.15, 0], 1.05, g);
  part(GEO.sphere, M(0xffd166), 0.1, [0, 1.28, 0], 1.1, g);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; part(GEO.cyl, bar, [0.035, 1.05, 0.035], [Math.cos(a) * 0.5, 0.6, Math.sin(a) * 0.5], 0, g); }
  const f = makeFriend(seed); f.position.y = 0.12; g.add(f);
  g.userData.friend = f; g.userData.mats = collectMats(g);
  return g;
}
export function makeChest(big) {
  const g = new THREE.Group(), s = big ? 1.25 : 1;
  const wood = M(0xb4703a), band = glow(0xffd166, 0.25);
  part(GEO.box, wood, [0.8 * s, 0.42 * s, 0.56 * s], [0, 0.21 * s, 0], 1.05, g);
  const lid = new THREE.Group(); lid.position.set(0, 0.42 * s, -0.28 * s); g.add(lid);
  part(GEO.box, wood, [0.82 * s, 0.2 * s, 0.58 * s], [0, 0.1 * s, 0.28 * s], 1.05, lid);
  for (const x of [-0.28, 0.28]) part(GEO.box, band, [0.08 * s, 0.24 * s, 0.6 * s], [x * s, 0.1 * s, 0.28 * s], 0, lid);
  part(GEO.box, band, [0.14 * s, 0.16 * s, 0.06 * s], [0, 0.36 * s, 0.29 * s], 1.1, g);
  g.userData.lid = lid; return g;
}
export function makeKey() {
  const g = new THREE.Group(), m = glow(0xffd166, 0.5);
  part(GEO.torus, m, 0.16, [0, 0.42, 0], 1.12, g);
  part(GEO.box, m, [0.07, 0.4, 0.07], [0, 0.1, 0], 1.12, g);
  part(GEO.box, m, [0.14, 0.06, 0.07], [0.07, -0.04, 0], 0, g);
  part(GEO.box, m, [0.1, 0.06, 0.07], [0.05, 0.06, 0], 0, g);
  return g;
}
export function makeEgg() {
  const g = new THREE.Group();
  part(GEO.sphere, glow(0xffd166, 0.7), [0.3, 0.4, 0.3], [0, 0, 0], 1.08, g);
  part(GEO.torus, glow(0xff5d8f, 0.6), [0.3, 0.3, 0.5], [0, 0.04, 0], 0, g).rotation.x = Math.PI / 2;
  return g;
}
const heartShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5); s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.5, 0.18);
  s.bezierCurveTo(-0.45, 0.48, -0.08, 0.5, 0, 0.25); s.bezierCurveTo(0.08, 0.5, 0.45, 0.48, 0.5, 0.18);
  s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
  g.center(); return g;
})();
export function makeHeart() {
  const g = new THREE.Group();
  part(heartShape, glow(0xff3b6b, 0.5), 0.55, [0, 0, 0], 1.1, g);
  return g;
}
const coinMat = glow(0xffcf3a, 0.45), xpMat = new THREE.MeshBasicMaterial({ color: 0x7df9ff });
export function makeCoin() { const m = new THREE.Mesh(GEO.oct, coinMat); m.scale.set(0.13, 0.17, 0.13); m.castShadow = true; return m; }
export function makeXp() { const m = new THREE.Mesh(GEO.ico, xpMat); m.scale.setScalar(0.08); return m; }
export function makePowerup(icon, color) {
  const g = new THREE.Group();
  const bub = new THREE.Mesh(GEO.sphere, new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.45, emissive: color, emissiveIntensity: 0.4 }));
  bub.scale.setScalar(0.34); g.add(bub);
  const sp = emojiSprite(icon, 0.46); g.add(sp);
  return g;
}
export function makeAbilityOrb(icon, color) {
  const g = new THREE.Group();
  part(GEO.cyl, M(0xd6d3e8), [0.45, 0.5, 0.45], [0, 0.25, 0], 1.05, g);
  const orb = new THREE.Group(); orb.position.y = 1.15; g.add(orb);
  const c = new THREE.Color(color);
  orb.add(new THREE.Mesh(GEO.sphere, new THREE.MeshToonMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, transparent: true, opacity: 0.8 })));
  orb.children[0].scale.setScalar(0.38);
  orb.add(emojiSprite(icon, 0.5));
  const ring = new THREE.Mesh(GEO.torus, glow(color, 1)); ring.scale.setScalar(0.55); orb.add(ring);
  g.userData.orb = orb; g.userData.ring = ring;
  return g;
}
export function makeCrystal() {
  const g = new THREE.Group();
  part(GEO.cyl, M(0x6b7280), [0.3, 0.3, 0.3], [0, 0.15, 0], 1.05, g);
  const offM = M(0x6d7fa6), onM = glow(0x67e8f9, 1.3);
  const c = part(GEO.oct, offM, [0.26, 0.45, 0.26], [0, 0.8, 0], 1.08, g);
  g.userData = { gem: c, offM, onM };
  return g;
}
export function makeTorch() {
  const g = new THREE.Group();
  part(GEO.cyl, M(0x5b3b24), [0.08, 0.9, 0.08], [0, 0.45, 0], 1.1, g);
  part(GEO.cyl, M(0x3a3a46), [0.22, 0.14, 0.22], [0, 0.95, 0], 1.08, g);
  const fl = new THREE.Group(); fl.position.y = 1.15; g.add(fl);
  part(GEO.cone, glow(0xff7a2a, 1.6), [0.17, 0.42, 0.17], [0, 0, 0], 0, fl);
  part(GEO.cone, glow(0xffe066, 2), [0.09, 0.26, 0.09], [0, -0.03, 0], 0, fl);
  fl.visible = false; g.userData.flame = fl;
  return g;
}
const potCol = [0xff9ec4, 0x7dd3fc, 0xc4b5fd, 0xfbbf24];
export function makePot(wi) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 10; i++) { const y = i / 10; pts.push(new THREE.Vector2(0.18 + Math.sin(y * Math.PI) * 0.2 - (y > 0.85 ? 0.06 : 0), y * 0.7)); }
  const geo = new THREE.LatheGeometry(pts, 16);
  part(geo, M(potCol[wi]), 1, [0, 0, 0], 1.06, g);
  part(GEO.cyl, M(0xffffff), [0.22, 0.05, 0.22], [0, 0.45, 0], 0, g);
  g.userData.mats = collectMats(g);
  return g;
}
export function makePortal() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(GEO.torus, glow(0xff5d8f, 1.2)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(1.0); ring.position.y = 0.08; g.add(ring);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  for (let i = 0; i < 6; i++) { x.strokeStyle = `hsla(${300 + i * 15},100%,${70 - i * 6}%,0.9)`; x.lineWidth = 9; x.beginPath(); x.arc(64, 64, 10 + i * 9, i, i + 4); x.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(GEO.disc, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06; disc.scale.setScalar(0.95); g.add(disc);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9ec4, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 2; g.add(beam);
  g.userData = { ring, disc, beam };
  return g;
}
export function makeFountain() {
  const g = new THREE.Group();
  part(GEO.cyl, M(0xd6d3e8), [0.85, 0.35, 0.85], [0, 0.17, 0], 1.04, g);
  const w = new THREE.Mesh(GEO.disc, glow(0x67e8f9, 0.6)); w.rotation.x = -Math.PI / 2; w.position.y = 0.36; w.scale.setScalar(0.72); g.add(w);
  part(GEO.cyl, M(0xd6d3e8), [0.12, 0.8, 0.12], [0, 0.6, 0], 1.08, g);
  part(GEO.sphere, glow(0xff9ec4, 0.8), 0.17, [0, 1.06, 0], 1.08, g);
  g.userData.water = w; return g;
}
export function makeSign() {
  const g = new THREE.Group();
  part(GEO.box, M(0x8b5a2b), [0.1, 0.7, 0.1], [0, 0.35, 0], 1.1, g);
  part(GEO.box, M(0xe0b47a), [0.8, 0.5, 0.08], [0, 0.85, 0], 1.06, g);
  const sp = emojiSprite('💬', 0.45); sp.position.set(0, 1.45, 0); g.add(sp);
  g.userData.bubble = sp;
  return g;
}
export function makeTelegraph(color = 0xff3b3b) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  const fill = new THREE.Mesh(GEO.disc, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
  ring.rotation.x = fill.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05; fill.position.y = 0.04;
  g.add(fill, ring); g.userData = { ring, fill };
  return g;
}
export function makeBomb() {
  const g = new THREE.Group();
  part(GEO.sphere, M(0x2b2b3a), 0.22, [0, 0, 0], 1.1, g);
  const spark = part(GEO.sphere, glow(0xffd166, 2), 0.07, [0, 0.27, 0], 0, g);
  g.userData.spark = spark;
  return g;
}
