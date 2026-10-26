import * as THREE from 'three';

// Everything that gets built out of triangles: the babies, the Boot of
// Destiny, the power-up pickups, and the playroom they all live in.

// ---------------------------------------------------------------------------
// Shared materials and geometry. Babies are spawned constantly, so nothing
// here is allocated per-instance except the few materials that get tinted.
// ---------------------------------------------------------------------------

function toonGradient() {
  // Four hard steps gives a proper cartoon ramp instead of smooth shading.
  const data = new Uint8Array([90, 150, 205, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

const GRADIENT = toonGradient();

export function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color, gradientMap: GRADIENT, ...opts,
  });
}

// A smooth, soft-shaded "toy" material: gentle roughness for a rounded
// plastic/rubber sheen rather than the boot's hard cartoon cel bands. The
// boot and pickups stay on `toonMat` (flat colour blocks read as "drawn
// prop"), but a creature shaded the same way looks like a graphic cutout
// rather than a rounded thing you could pick up - the soft gradient and the
// small specular highlight are what make a sphere read as a sculpted toy.
export function softMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.75, metalness: 0, ...opts,
  });
}

// A leaf-shaped wing: one Shape, extruded paper-thin, pointed at the root and
// rounded at the tip. Toy dragons wear their wings like this, standing up off
// the back rather than folded flat like a bat's - which also reads better
// under the play camera's steep overhead angle than a flat membrane did,
// since an upright leaf still shows most of its face from above. Built once
// and reused, same as everything else in GEO - only the material varies.
function leafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.36, 0.22, 0.18, 0.64);
  shape.quadraticCurveTo(0.07, 0.86, 0, 0.96);
  shape.quadraticCurveTo(-0.07, 0.86, -0.18, 0.64);
  shape.quadraticCurveTo(-0.36, 0.22, 0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.025, bevelEnabled: false,
  });
  geo.center();
  return geo;
}

const GEO = {
  head: new THREE.SphereGeometry(0.62, 32, 24),
  body: new THREE.SphereGeometry(0.5, 28, 20),
  limb: new THREE.CapsuleGeometry(0.145, 0.26, 6, 14),
  // A squashed sphere rather than a box: sharp box corners are the one
  // primitive shape that reliably reads as "aggressive" rather than "cute",
  // and a rounded paw pad costs nothing extra to render.
  foot: new THREE.SphereGeometry(0.16, 14, 10),
  eye: new THREE.SphereGeometry(0.165, 20, 16),
  glint: new THREE.SphereGeometry(0.05, 10, 8),
  horn: new THREE.ConeGeometry(0.07, 0.2, 14),
  snout: new THREE.SphereGeometry(0.3, 20, 16),
  wing: leafGeometry(),
  tailSeg: new THREE.SphereGeometry(0.2, 18, 14),
  tailTip: new THREE.ConeGeometry(0.15, 0.34, 14),
  hatCone: new THREE.ConeGeometry(0.26, 0.5, 14),
  hatBall: new THREE.SphereGeometry(0.075, 8, 8),
  shades: new THREE.BoxGeometry(0.72, 0.16, 0.08),
  topHat: new THREE.CylinderGeometry(0.17, 0.17, 0.3, 14),
  topBrim: new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16),
  paci: new THREE.TorusGeometry(0.1, 0.035, 6, 12),
  crown: new THREE.CylinderGeometry(0.3, 0.34, 0.22, 5, 1, true),
  zzz: new THREE.PlaneGeometry(0.5, 0.5),
};

// Ten hide tones for the head and limbs - a spread of dragon species rather
// than one recolour repeated, so twenty on the mat reads as a nursery of
// different little dragons and not one dragon copy-pasted twenty times.
const HIDE = [
  0x4ade80, 0x22c55e, 0x2dd4bf, 0x38bdf8, 0x818cf8,
  0xc084fc, 0xf472b6, 0xfb7185, 0xfb923c, 0xfacc15,
];

// How round a given baby is. Cosmetic ONLY: it is applied to the onesie, the
// nappy and the limbs, and never to `baseScale`, which is what the stomp
// radius, the crowd spacing and the launch physics all measure against. So no
// build is easier or harder to hit than any other, and none of them is worth
// more or less. Babies are round to begin with, so the range is narrow enough
// to read as "these are different babies" rather than as a caricature.
// ---- making one baby look like forty ---------------------------------------
//
// Everything here is recycled: four vocal samples, one mesh, one gait. The job
// of these numbers is to stop the player noticing that.
//
// Five INDEPENDENT rolls, because independent axes multiply. One axis at 22%
// gives you a slightly wider baby; five axes at 20% each give you a baby that
// is wide AND short AND big-headed AND long-limbed AND ginger, and the eye
// reads that as a different character rather than as the same asset rescaled.
//
// Every one of them is cosmetic. None of them touches `baseScale`, which is
// what the stomp radius, the crowd spacing and the launch physics measure
// against, so no shape is easier to hit and none is worth more.
const BUILD_MIN = 0.76;      // width: plump through thin
const BUILD_MAX = 1.24;
const STATURE_MIN = 0.88;    // height, rolled separately from width
const STATURE_MAX = 1.12;
const HEAD_MIN = 0.9;        // ...and how big the head is on top of it
const HEAD_MAX = 1.14;
const LIMB_MIN = 0.86;       // ...and how long the arms and legs are
const LIMB_MAX = 1.16;
// Horn and tail-spike keratin tones. The single cheapest variety in the whole
// file: it was one hard-coded brown curl on every baby in the game, and a horn
// wants the same range a curl did - bone through near-black.
const HORN = [0x8b5a2b, 0x3b2a20, 0x120e0c, 0xd8a45c, 0xa8501e, 0xe8d7b0,
  0x6b4a35, 0x2b1b12];
const BELLY = 0xfdfdff;

// ---------------------------------------------------------------------------
// Diaper colours. Every ordinary crawler wears one of four, and three of the
// same colour standing close together is a HUDDLE: the pattern the POWER
// STOMP exists to clear in one go.
//
// These are saturated rather than pastel on purpose. They have to read at a
// glance against every playmat tint in THEMES, and the huddle marker painted
// on the floor is drawn in the same colour, so a washed-out band would leave
// the marker invisible on half the levels.
// ---------------------------------------------------------------------------
// Three, not four. Measured: with four bands over the eight-or-so babies on
// the mat in level 1, three matching crawlers landed near each other about
// once per level, which is not a mechanic, it is a rumour.
export const BANDS = [
  { id: 0, hex: 0xff2d6f, css: '#ff2d6f', name: 'PINK' },
  { id: 1, hex: 0x1ea7f0, css: '#1ea7f0', name: 'BLUE' },
  { id: 2, hex: 0xffa41b, css: '#ffa41b', name: 'AMBER' },
];

// ---------------------------------------------------------------------------
// Baby types. `score` is the base value, everything else tunes behaviour.
// Every baby dies to a single stomp: nothing here has hit points, because
// having to click one twice breaks the rhythm the game is built on.
// ---------------------------------------------------------------------------

export const BABY_TYPES = {
  normal: {
    id: 'normal', name: 'Baby Dragon', score: 100, speed: 1.35, scale: 1.0,
    tint: null, wander: 1.0,
  },
  speedy: {
    id: 'speedy', name: 'Turbo Hatchling', score: 250, speed: 3.6, scale: 0.88,
    tint: 0x7dd3fc, wander: 2.4, trail: true,
  },
  ninja: {
    id: 'ninja', name: 'Ninja Dragon', score: 450, speed: 2.4, scale: 0.92,
    tint: 0x33314d, wander: 1.8, blinks: true,
  },
  bouncy: {
    id: 'bouncy', name: 'Pogo Dragon', score: 350, speed: 2.0, scale: 0.95,
    tint: 0x86efac, wander: 1.4, hops: true,
  },
  golden: {
    id: 'golden', name: 'GOLDEN DRAGON', score: 2500, speed: 4.4, scale: 1.0,
    tint: 0xffd700, wander: 3.0, golden: true, trail: true,
  },
  // ---- the bonus baby, and the only thing in the game that gives time back
  //
  // Appears for the closing seconds and buzzes around being obnoxious. It is
  // pure temptation: it pays a fortune and it hands back SECOND_WIND seconds
  // of clock, and it is the fastest thing on the mat, so going after it means
  // abandoning whatever wide swing you were lining up. That trade is the whole
  // reason it exists - the last ten seconds were previously the part of the
  // level where the correct play was most obviously "keep doing the big thing".
  //
  // It never costs anything to lose. A bonus that punishes you for failing to
  // catch it is not a bonus, it is a tax with a countdown on it.
  //
  // Speed 2.8, not 5.2. At 5.2 it was the fastest thing in the game - faster
  // than the GOLDEN BABY, which the game itself describes as very fast - and a
  // temptation you cannot physically reach is not a temptation, it is a tease.
  // It sits between an ordinary crawler (1.35) and a Turbo Crawler (3.6): quick
  // enough that catching one is a commitment, slow enough that committing works.
  // Its difficulty is meant to come from the wandering, and later from the
  // dodging, not from raw pace.
  hot: {
    id: 'hot', name: 'HOT DRAGON', score: 3200, speed: 2.8, scale: 0.94,
    tint: 0xff7a1a, wander: 3.2, hot: true, bonus: true, trail: true,
    life: 30,
  },
  helmet: {
    // The boot simply does not work on this one. A mat quake or a sliding
    // block does. It exists to stop stomping being the answer to everything.
    id: 'helmet', name: 'Hard Hat Dragon', score: 800, speed: 1.5, scale: 1.05,
    tint: 0xfbbf24, wander: 1.1, armored: true, life: 13,
  },
  sleeper: {
    // Do not stomp. The game will make you feel bad about it, briefly.
    id: 'sleeper', name: 'Sleeping Dragon', score: -400, speed: 0.0, scale: 1.1,
    tint: 0xc4b5fd, wander: 0, forbidden: true, life: 16,
  },
  // ---- curveballs: arrive on their own clock all through the level, not
  // only at the end (see main.js: _updateSpawns / _sendPeekabooBaby /
  // _sendRocketBaby). Both carry `bonus`, the same "missing it costs
  // nothing" exemption the hot baby uses.
  peekaboo: {
    // Spends nearly all its time near-invisible and only flickers into view
    // for a beat at a time (main.js drives d.vis every frame). Caught, it
    // pops every ordinary crawler near it for free - the reward for having
    // been watching when most players were not.
    id: 'peekaboo', name: 'PEEKABOO DRAGON', score: 1600, speed: 1.6, scale: 0.92,
    tint: 0xe6d9ff, wander: 2.2, bonus: true, peekaboo: true, life: 24,
  },
  rocket: {
    // Fired straight across the mat rather than wandering (main.js sets
    // d.fleeing at spawn and aims it edge to edge). Caught, it does not pay
    // score so much as it pays STREAK: a shortcut up the STREAK_SHOUTS
    // ladder, which is where the power stomp ceiling actually grows.
    id: 'rocket', name: 'ROCKET DRAGON', score: 900, speed: 3, scale: 0.88,
    tint: 0xffe8b8, wander: 0, bonus: true, rocket: true, life: 10,
  },
  // Dies to one stomp exactly like everything else - the twist is entirely
  // in the movement (see main.js: _updateBounce). A straight line that
  // ricochets off the kerb and off the boot itself, rather than the usual
  // wander-and-flee, so reading where it is GOING matters more than where
  // it currently is.
  bounce: {
    id: 'bounce', name: 'TAIL BOUNCE', score: 500, speed: 3.4, scale: 0.98,
    tint: null, wander: 0, bounces: true, life: 14,
  },
  // One per boss level (see levels.js: `boss: true`, and main.js: _updateBoss
  // / _spawnBoss). Huge, slow, and takes several hits rather than one - the
  // one deliberate exception to "nothing in this game has hit points" - and
  // fires volleys of nursery ammo the player has to dodge or intercept (see
  // makeBossAmmo). life is enormous on purpose: it does not age out and flee
  // like everything else, it stays until it is beaten or the clock runs out.
  boss: {
    id: 'boss', name: 'THE OVERTIRED ONE', score: 6000, speed: 0.9, scale: 2.6,
    tint: 0xff2d6f, wander: 0.5, boss: true, life: 9999,
  },
};

// How long each type wanders before giving up and crawling off for a nap.
// Short lives mean escapes are a constant threat, which is the whole pressure.
for (const [id, life] of Object.entries({
  normal: 11, speedy: 8, ninja: 10, bouncy: 10, golden: 7,
})) BABY_TYPES[id].life = life;

// ---------------------------------------------------------------------------
// Baby construction
// ---------------------------------------------------------------------------

function accessory(kind) {
  const g = new THREE.Group();
  if (kind === 'party') {
    const cone = new THREE.Mesh(GEO.hatCone, softMat(0xff5d8f));
    cone.position.y = 0.25;
    const ball = new THREE.Mesh(GEO.hatBall, softMat(0xfff3b0));
    ball.position.y = 0.53;
    g.add(cone, ball);
    g.position.set(0, 0.5, -0.05);
    g.rotation.z = 0.22;
  } else if (kind === 'shades') {
    const s = new THREE.Mesh(GEO.shades, softMat(0x1b1b2b));
    g.add(s);
    g.position.set(0, 0.1, 0.56);
  } else if (kind === 'tophat') {
    const brim = new THREE.Mesh(GEO.topBrim, softMat(0x2b2b3d));
    const top = new THREE.Mesh(GEO.topHat, softMat(0x2b2b3d));
    top.position.y = 0.16;
    g.add(brim, top);
    g.position.set(0, 0.54, -0.02);
    g.rotation.z = -0.18;
  }
  return g;
}

function makeZzzTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '900 96px "Trebuchet MS", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 12;
  g.lineJoin = 'round';
  g.strokeStyle = '#2b1b3d';
  g.strokeText('z', 64, 68);
  g.fillStyle = '#ffffff';
  g.fillText('z', 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const ZZZ_TEX = makeZzzTexture();

// A top hat and a pair of shades, bolted onto a baby after the fact. Used for
// exactly one thing: the sixth hot baby of a shift, which has earned them.
export function makeSwagger() {
  const g = new THREE.Group();
  g.add(accessory('tophat'), accessory('shades'));
  return g;
}

// A thin, slightly-oversized duplicate of a mesh, rendered back-face-only in
// ink so it shows only as a rim around the real mesh's silhouette - the same
// inverted-hull trick the boot uses (INK_MAT, further down), reused here for
// the parts that actually reach the creature's outer silhouette: body, head,
// wings, tail, horns, legs. Deliberately NOT used on parts that sit embedded
// in another part (the snout on the head, the belly on the body, the eyes):
// outlining something that never reaches the silhouette edge just draws a
// stray ring at the seam rather than a clean edge. This one addition is
// most of what separates "flat-shaded primitives" from "cartoon character" -
// a rounded, smoothly-lit shape with no outline reads as an unfinished 3D
// render; the same shape with one costs nothing extra to compute and reads
// as drawn.
function outline(parent, mesh, factor = 1.08) {
  const o = new THREE.Mesh(mesh.geometry, INK_MAT);
  o.position.copy(mesh.position);
  o.rotation.copy(mesh.rotation);
  o.scale.copy(mesh.scale).multiplyScalar(factor);
  parent.add(o);
  return o;
}

export function makeBaby(typeId) {
  const type = BABY_TYPES[typeId];
  const root = new THREE.Group();

  const skin = type.tint && type.golden
    ? 0xffe066
    : HIDE[(Math.random() * HIDE.length) | 0];
  const skinMat = softMat(skin);
  // Ten scale colours rather than five, for the same reason as everything else
  // in this block: the babies that do not carry a huddle band are the ones the
  // player sees most of, and they were coming in five flavours.
  const SCALES = [0xff9ec4, 0x9ee7ff, 0xc4b5fd, 0xa7f3d0, 0xfed7aa,
    0xfca5a5, 0x86efac, 0xfde68a, 0xbfdbfe, 0xf9a8d4];
  const onesieColor = type.tint ?? SCALES[(Math.random() * SCALES.length) | 0];

  // One set of rolls per baby, used everywhere below so a baby is consistently
  // itself for its whole short life.
  const roll = (lo, hi) => lo + Math.random() * (hi - lo);
  const build = roll(BUILD_MIN, BUILD_MAX);
  const stature = roll(STATURE_MIN, STATURE_MAX);
  const headSize = roll(HEAD_MIN, HEAD_MAX);
  const limbLen = roll(LIMB_MIN, LIMB_MAX);

  // Crawling pose: body horizontal, head up and forward, limbs underneath.
  const body = new THREE.Mesh(GEO.body, softMat(onesieColor));
  // Width and depth take the build; height takes a little of it back, so a
  // rounder baby reads as rounder rather than simply bigger.
  body.scale.set(1.05 * build, 0.92 * stature / Math.sqrt(build), 1.25 * build);
  body.position.set(0, 0.5, -0.1);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  outline(root, body);

  // Only ordinary crawlers carry a colour band. The specials are left plain,
  // so a huddle is never built out of something the boot cannot clear: a
  // hard hat or a sleeper inside the pattern would make it a trap rather
  // than an opportunity.
  const banded = !type.golden && !type.forbidden && !type.armored && !type.boss;
  const band = banded ? BANDS[(Math.random() * BANDS.length) | 0] : null;

  const diaper = new THREE.Mesh(GEO.body, softMat(
    type.golden ? 0xfff8dc : band ? band.hex : BELLY));
  // Slightly larger than it used to be. The belly plate stopped being trim
  // the moment it started carrying the colour a huddle is built from: the
  // player has to be able to see a match forming from across the arena, not
  // only once the floor has already lit up and told them.
  diaper.scale.set(1.08 * build, 0.8 * stature, 0.78 * build);
  diaper.position.set(0, 0.44, -0.42);
  diaper.castShadow = true;
  diaper.receiveShadow = true;
  root.add(diaper);

  // A pair of leaf wings, standing upright off the back rather than folded
  // flat: a toy dragon's wings, not a bat's. Leaf green always, regardless of
  // the dragon's own hide colour - the point is that they read as foliage
  // grown on the back, not as a body part, and that contrast is what makes
  // them legible against every one of the ten hide tones. Upright also reads
  // better under this game's steep overhead camera than a flat membrane did:
  // a leaf standing on its edge still shows most of its face from above,
  // where a wing lying flat showed almost none of it.
  const wingMat = softMat(0x9ee6a8, {
    transparent: true, opacity: 0.88, roughness: 0.4, side: THREE.DoubleSide,
  });
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(GEO.wing, wingMat);
    wing.rotation.set(0.15, 0.5 * sx, 0.55 * sx);
    wing.scale.set(0.62 * build, 0.7 * stature, 1);
    wing.position.set(0.22 * sx, 0.86, -0.32);
    wing.castShadow = true;
    wing.receiveShadow = true;
    root.add(wing);
    outline(root, wing, 1.12);
  }

  // A segmented tail: a run of shrinking beads along a gentle upward arc,
  // capped with a small cone tip. Reads as tail from directly overhead in a
  // way a smooth taper did not, because each bead casts its own visible
  // seam - the segments themselves are the silhouette detail, not just the
  // curve. Coloured off the hide, not the scales, so it does not disappear
  // into the body it is attached to.
  const tailMat = softMat(new THREE.Color(skin).lerp(new THREE.Color(onesieColor), 0.5));
  // Fixed, bounded offsets rather than compounding steps: a per-segment step
  // that is itself a function of the previous segment's size add up fast
  // over even 4 segments, and the first version of this put the tail tip
  // above head height. A short stubby tail reads as cute; a long one reads
  // as a separate animal draped over the back.
  const SCALE = [0.8, 0.65, 0.5, 0.4];
  const STEP_Z = [0.22, 0.18, 0.14];
  const STEP_Y = [0.13, 0.11, 0.09];
  let ty = 0.46, tz = -0.56 * build;
  for (let i = 0; i < SCALE.length; i++) {
    const seg = new THREE.Mesh(GEO.tailSeg, tailMat);
    seg.scale.setScalar(SCALE[i] * build);
    seg.position.set(0, ty, tz);
    seg.castShadow = true;
    seg.receiveShadow = true;
    root.add(seg);
    outline(root, seg, 1.1);
    if (i < STEP_Z.length) { tz -= STEP_Z[i] * build; ty += STEP_Y[i] * stature; }
  }
  const tailTip = new THREE.Mesh(GEO.tailTip, tailMat);
  tailTip.scale.setScalar(0.32 * build);
  tailTip.rotation.x = -Math.PI / 2.3;
  tailTip.position.set(0, ty + 0.09, tz - 0.12 * build);
  tailTip.castShadow = true;
  tailTip.receiveShadow = true;
  root.add(tailTip);
  outline(root, tailTip, 1.1);

  const head = new THREE.Group();
  head.position.set(0, 0.78, 0.5);
  const skull = new THREE.Mesh(GEO.head, skinMat);
  // A third of the build. Heads vary far less than bodies do, but a head that
  // completely ignores the body reads as a stretched baby rather than a
  // different one.
  const headBuild = (1 + (build - 1) * 0.32) * headSize;
  skull.scale.set(headBuild, 0.95 * headSize, 0.95 * headBuild);
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);
  outline(head, skull, 1.06);

  // Big glossy toy eyes: mostly dark, not mostly white. A tiny bright glint
  // offset toward the top is what sells "glossy plastic" - a matched pair of
  // dark spheres with no highlight at all just reads as holes. Low roughness
  // on the eye itself (not the rest of the face) so it catches a hard little
  // reflection the matte skin never does - a real glassy toy eye, not a
  // painted dot. Set low on the head, close to the snout rather than up near
  // the crown: low-set eyes read as younger than the same eyes set higher,
  // the single biggest lever a face has on "baby" versus "adult".
  const eyeMat = softMat(0x15100f, { roughness: 0.18, metalness: 0.15 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(GEO.eye, eyeMat);
    e.position.set(0.26 * sx, -0.08, 0.52);
    e.scale.set(1.1, 1.15, 0.9);
    head.add(e);
    const g = new THREE.Mesh(GEO.glint, glintMat);
    g.position.set(0.26 * sx + 0.05, 0.01, 0.64);
    head.add(g);
  }

  // A small, round snout - a puppyish nose bump, not a reptile's, which is
  // what keeps a dragon face reading as an infant's rather than as a small
  // adult's. Kept short enough that the eyes and the oversized forehead
  // above them are still the first thing the shape says. Same skinMat as the
  // skull, so it looks grown rather than bolted on.
  const snout = new THREE.Mesh(GEO.snout, skinMat);
  snout.scale.set(0.6 * headSize, 0.5 * headSize, 0.62 * headSize);
  snout.position.set(0, -0.16, 0.46 * headSize);
  snout.castShadow = true;
  snout.receiveShadow = true;
  head.add(snout);

  const hornMat = softMat(HORN[(Math.random() * HORN.length) | 0]);
  // ...and about one in six has none at all: too young for one yet. One roll
  // for the pair, not two, so a dragon is never caught with one horn in and
  // one horn skipped.
  const hasHorns = Math.random() > 0.16;
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(GEO.horn, hornMat);
    horn.visible = hasHorns;
    horn.position.set(0.16 * sx, 0.64, 0.08);
    horn.rotation.set(0.3, 0, 0.5 * sx);
    horn.castShadow = true;
    horn.receiveShadow = true;
    head.add(horn);
    outline(head, horn, 1.18).visible = hasHorns;
  }
  root.add(head);

  // Four limbs, animated in a diagonal crawl gait.
  const limbs = [];
  const limbMat = skinMat;
  const limbPos = [
    [-0.34, 0.26, 0.28], [0.34, 0.26, 0.28],
    [-0.32, 0.26, -0.4], [0.32, 0.26, -0.4],
  ];
  // A quarter of the build, on the pivot rather than the mesh: the gait only
  // ever ROTATES these, so a scale set here survives every frame of animation.
  const limbBuild = 1 + (build - 1) * 0.55;
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(...limbPos[i]);
    pivot.scale.set(limbBuild, limbLen, limbBuild);
    const l = new THREE.Mesh(GEO.limb, limbMat);
    l.position.y = -0.16;
    l.castShadow = true;
    l.receiveShadow = true;
    const h = new THREE.Mesh(GEO.foot, limbMat);
    h.position.y = -0.34;
    h.scale.set(1.15, 0.72, 1.25);
    h.castShadow = true;
    h.receiveShadow = true;
    pivot.add(l, h);
    outline(pivot, l, 1.12);
    outline(pivot, h, 1.12);
    root.add(pivot);
    limbs.push(pivot);
  }

  // Cosmetic accessories on a minority of babies. Purely for the moment where
  // you notice one is wearing a top hat.
  let acc = null;
  const r = Math.random();
  if (type.golden) {
    acc = new THREE.Group();
    const crown = new THREE.Mesh(GEO.crown, softMat(0xffcc00, { side: THREE.DoubleSide }));
    acc.add(crown);
    acc.position.set(0, 0.6, 0);
    head.add(acc);
  } else if (type.armored) {
    // A construction hat, so "the boot will not work here" is legible from
    // across the arena at a glance.
    acc = new THREE.Group();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      softMat(0xfacc15));
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.66, 0.07, 18), softMat(0xfacc15));
    brim.position.y = 0.02;
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.13, 0.86), softMat(0xf59e0b));
    ridge.position.y = 0.3;
    acc.add(dome, brim, ridge);
    acc.position.set(0, 0.34, 0.02);
    head.add(acc);
  } else if (type.blinks) {
    // Headband, so a ninja at full opacity is still obviously a ninja.
    acc = new THREE.Group();
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.635, 0.635, 0.16, 16, 1, true),
      softMat(0xe11d48, { side: THREE.DoubleSide }));
    band.position.y = 0.22;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), softMat(0xe11d48));
    strap.position.set(-0.5, 0.02, -0.42);
    strap.rotation.z = 0.5;
    acc.add(band, strap);
    head.add(acc);
  } else if (r < 0.07) {
    acc = accessory('tophat'); head.add(acc);
  } else if (r < 0.16) {
    acc = accessory('party'); head.add(acc);
  } else if (r < 0.22) {
    acc = accessory('shades'); head.add(acc);
  }

  // The hot baby carries its own light. It is the one baby that has to be
  // findable instantly on a busy mat AND on a blacked-out one, so it does not
  // rely on its tint: it glows, it wears a halo, and it trails sparks.
  let hotHalo = null;
  if (type.hot) {
    body.material.emissive = new THREE.Color(0xff6a00);
    body.material.emissiveIntensity = 0.9;
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 1.18, 30),
      new THREE.MeshBasicMaterial({
        color: 0xffb300, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false,
      }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.03;
    halo.renderOrder = 1;
    root.add(halo);
    // Held in a local and handed to userData below with everything else: the
    // userData object is REPLACED at the end of this function, so anything
    // written onto it before that point is thrown away.
    hotHalo = halo;
  }

  // The rocket baby wears its motor on its back rather than carrying a badge
  // on its head like the other specials: it is not identified by a detail
  // you have to be close enough to read, it is identified by how it moves,
  // so the only job of the model is to make the direction of travel obvious
  // at a glance.
  let rocketPack = null;
  if (type.rocket) {
    rocketPack = new THREE.Group();
    for (const side of [-1, 1]) {
      const tube = inkShape(GEO.limb, 0xbfdbfe, [side * 0.24, 0.1, -0.05],
        [Math.PI / 2, 0, 0], 1.1);
      const flame = inkShape(GEO.hatCone, 0xffb703, [side * 0.24, 0.1, 0.32],
        [Math.PI / 2, 0, 0], 1.15);
      rocketPack.add(tube, flame);
    }
    rocketPack.position.set(0, 0.62, -0.35);
    root.add(rocketPack);
  }

  let zzz = null;
  let ring = null;
  if (type.forbidden) {
    // A glowing keep-out ring, because "do not stomp this one" needs to be
    // readable in half a second at a glance.
    ring = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.18, 32),
      new THREE.MeshBasicMaterial({
        color: 0xc4b5fd, transparent: true, opacity: 0.4,
        side: THREE.DoubleSide, depthWrite: false,
      }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.renderOrder = 1;
    root.add(ring);

    zzz = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ZZZ_TEX, transparent: true, depthWrite: false,
      }));
      s.scale.setScalar(0.35 + i * 0.13);
      s.position.set(0.25 + i * 0.22, 0.4 + i * 0.42, 0);
      s.userData.phase = i * 0.8;
      zzz.add(s);
    }
    zzz.position.set(0, 1.0, 0.2);
    root.add(zzz);
    // Sleepers lie down with their eyes shut.
    root.rotation.x = 0;
    head.rotation.x = -0.5;
    for (const p of limbs) p.rotation.x = 0.6;
  }

  root.scale.setScalar(type.scale);
  root.userData = {
    type, band, head, body, diaper, limbs, zzz, ring, acc, hotHalo, rocketPack,
    build, stature, headSize, limbLen,
    skinMat, bodyMat: body.material, diaperMat: diaper.material,
  };
  return root;
}

// ---------------------------------------------------------------------------
// The Boot of Destiny
// ---------------------------------------------------------------------------

// A chunky cartoon hiking boot: orange upper, turquoise lugged sole and
// padded collar, coral laces. Every part carries an inverted-hull ink
// outline, which is what sells "drawn" rather than "modelled".
// A site boot, not a trainer. The joke of the game is that this is somebody's
// JOB, and a wheat-leather steel-toe with a black lug sole says that in one
// glance where a soft turquoise boot said "toy".
//
// The names are kept (orange, teal, coral) because the pickup toys and the
// charm meshes are built from the same palette and a rename would only churn
// them. What changed is what the names point at.
const BOOT_COLORS = {
  orange: 0xdb9226,        // wheat leather, the body of the boot
  orangeLight: 0xf0ad3f,   // ...catching the light
  orangeDark: 0xa96a18,    // heel counter and seams
  teal: 0x2f2a33,          // sole, collar: near-black rubber
  tealDark: 0x1d191f,      // lugs and midsole, darker still
  coral: 0xf6d9a2,         // rawhide laces
  steel: 0xc9ced6,         // the toe cap. The actual punchline.
  steelDark: 0x9aa2ad,
  ink: 0x1a1013,
};

// Shared: back faces only, so it renders as a shell behind each part.
const INK_MAT = new THREE.MeshBasicMaterial({
  color: BOOT_COLORS.ink, side: THREE.BackSide,
});

// A box with a slightly larger ink shell around it. The shell is grown by a
// fixed amount rather than a scale factor, so outline weight stays even
// across parts of very different sizes.
function inkBox(w, h, d, color, pos, rot, thickness = 0.055) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), softMat(color));
  m.castShadow = true;
  g.add(m);
  const o = new THREE.Mesh(
    new THREE.BoxGeometry(w + thickness * 2, h + thickness * 2, d + thickness * 2),
    INK_MAT);
  g.add(o);
  if (pos) g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  g.userData.face = m;
  return g;
}

// A rounded-corner box: a rounded-rectangle Shape, extruded with its own
// bevel so the extrusion edges round too, not just the four corners seen
// from the front. Same Shape+ExtrudeGeometry technique this file already
// uses for the wing and the star pickup - no addon geometry needed. This is
// the fix for the boot's flat panels reading as "blocky": a sharp-cornered
// box is the one primitive shape that reliably reads as aggressive rather
// than cute, same reasoning as the dragon's feet.
function roundedBoxGeometry(w, h, d, radius) {
  const x = w / 2, y = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + radius, -y);
  shape.lineTo(x - radius, -y);
  shape.quadraticCurveTo(x, -y, x, -y + radius);
  shape.lineTo(x, y - radius);
  shape.quadraticCurveTo(x, y, x - radius, y);
  shape.lineTo(-x + radius, y);
  shape.quadraticCurveTo(-x, y, -x, y - radius);
  shape.lineTo(-x, -y + radius);
  shape.quadraticCurveTo(-x, -y, -x + radius, -y);
  const bevel = Math.min(radius * 0.8, d * 0.3);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - bevel * 2, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6,
  });
  geo.translate(0, 0, -(d - bevel * 2) / 2 - bevel);
  geo.computeVertexNormals();
  return geo;
}

function inkRoundedBox(w, h, d, color, pos, rot, radius = 0.12, thickness = 0.06) {
  const geo = roundedBoxGeometry(w, h, d, radius);
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, softMat(color));
  m.castShadow = true;
  g.add(m);
  const o = new THREE.Mesh(roundedBoxGeometry(w + thickness * 2, h + thickness * 2, d + thickness * 2, radius + thickness), INK_MAT);
  g.add(o);
  if (pos) g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  g.userData.face = m;
  return g;
}

// Same idea for curved shapes, where a uniform scale is the only sane way to
// grow a shell.
function inkShape(geo, color, pos, rot, scale = 1.1, opts = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, opts.material || softMat(color));
  m.castShadow = true;
  const o = new THREE.Mesh(geo, INK_MAT);
  o.scale.setScalar(scale);
  g.add(m, o);
  if (pos) g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  g.userData.face = m;
  return g;
}

export function makeBoot() {
  const C = BOOT_COLORS;
  const g = new THREE.Group();

  // ---- turquoise lug sole -------------------------------------------------
  // Teeth first so the ink shells of the sole above cover their tops.
  // 22 identical teeth, so one instanced batch rather than 22 draw calls.
  const teeth = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.17, 0.16, 0.17), softMat(C.tealDark), 22);
  teeth.frustumCulled = false;
  const tooth = new THREE.Object3D();
  let ti = 0;
  for (let i = 0; i < 11; i++) {
    for (const sx of [-1, 1]) {
      tooth.position.set(sx * 0.62, 0.06, -1.2 + i * 0.24);
      tooth.updateMatrix();
      teeth.setMatrixAt(ti++, tooth.matrix);
    }
  }
  teeth.instanceMatrix.needsUpdate = true;
  g.add(teeth);

  const sole = inkBox(1.44, 0.26, 2.62, C.teal, [0, 0.2, 0]);
  g.add(sole);
  // Midsole stripe: the two-tone band the reference runs above the lugs.
  g.add(inkBox(1.32, 0.16, 2.5, C.tealDark, [0, 0.4, 0], null, 0.035));

  // ---- orange upper -------------------------------------------------------
  // Profile matters more than part count: the toe sits low, the instep slopes
  // up toward the back, and the collar caps it. That slope is what the laces
  // lie on, and without it they end up buried inside the boot. Rounded
  // corners on the upper panels specifically - they are the largest flat
  // surfaces on the boot and the ones most responsible for "blocky".
  g.add(inkRoundedBox(1.2, 0.5, 1.0, C.orangeLight, [0, 0.74, 0.8], null, 0.16));

  // Steel toe cap. Rounded so the front reads soft rather than as another
  // cube, and in bare metal because a boot that is legally required to
  // survive a dropped girder is a funnier thing to be standing on a baby.
  const bumper = inkShape(new THREE.SphereGeometry(0.5, 26, 20), C.steel,
    [0, 0.7, 1.18], null, 1.1);
  bumper.scale.set(1.18, 0.9, 0.72);
  g.add(bumper);
  // The welt where the cap is stitched down, which is what makes it read as
  // a cap rather than as a pale toe.
  g.add(inkBox(1.22, 0.1, 0.16, C.steelDark, [0, 0.62, 0.72], null, 0.03));

  g.add(inkRoundedBox(1.26, 0.85, 1.25, C.orange, [0, 0.9, -0.1], null, 0.18));
  g.add(inkRoundedBox(1.28, 1.05, 0.95, C.orange, [0, 1.25, -1.12], null, 0.18));
  // Heel counter: one darker panel reads as a seam, where a fully dark shaft
  // read as a separate block bolted on the back.
  g.add(inkRoundedBox(1.16, 0.62, 0.24, C.orangeDark, [0, 1.0, -1.58], null, 0.08, 0.03));

  // ---- turquoise padded collar -------------------------------------------
  // The most legible feature from the game's overhead camera, so it gets the
  // fattest tube and sits proud of the shaft.
  const collar = inkShape(new THREE.TorusGeometry(0.6, 0.2, 16, 32), C.teal,
    [0, 1.84, -1.12], [Math.PI / 2, 0, 0], 1.13);
  collar.scale.set(1.06, 0.98, 1);
  g.add(collar);

  // Lining disc filling the collar's hole. Without it the overhead camera
  // looks straight down onto the orange top of the shaft, and the boot reads
  // as solid rather than as something with an opening.
  const lining = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 22), softMat(0x3b2f24));
  lining.rotation.x = -Math.PI / 2;
  lining.position.set(0, 1.8, -1.12);
  g.add(lining);

  // Tongue poking up out of the collar, behind the top lace.
  g.add(inkBox(0.66, 0.52, 0.18, C.teal, [0, 1.62, -0.62], [-0.3, 0, 0], 0.04));

  // ---- coral laces --------------------------------------------------------
  // Laid along the instep slope and lifted just proud of it, with turquoise
  // eyelet beads either side. From directly above this is the detail that
  // says "boot" more than any other.
  const laceGeo = new THREE.BoxGeometry(1.3, 0.1, 0.14);
  const laceMat = softMat(C.coral);
  const eyelets = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.1, 14, 10), softMat(C.teal), 8);
  eyelets.frustumCulled = false;
  const eyelet = new THREE.Object3D();
  let ei = 0;
  const SLOPE = -0.28;
  for (let i = 0; i < 4; i++) {
    const z = 0.36 - i * 0.31;
    const y = 1.37 + i * 0.09;
    for (const tilt of [0.2, -0.2]) {
      const l = new THREE.Mesh(laceGeo, laceMat);
      l.position.set(0, y, z);
      l.rotation.set(SLOPE, 0, tilt);
      l.castShadow = true;
      g.add(l);
    }
    for (const sx of [-1, 1]) {
      eyelet.position.set(sx * 0.66, y - 0.02, z);
      eyelet.updateMatrix();
      eyelets.setMatrixAt(ei++, eyelet.matrix);
    }
  }
  eyelets.instanceMatrix.needsUpdate = true;
  g.add(eyelets);

  // ---- the charge bead ----------------------------------------------------
  // Kept as `gem` because the stomp and charge feedback drive its emissive.
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.2, 0),
    new THREE.MeshStandardMaterial({
      color: 0xfff0a8, emissive: 0xffcf5a, emissiveIntensity: 1.4,
      metalness: 0.05, roughness: 0.25,
    }));
  gem.position.set(0, 1.92, -0.66);
  gem.castShadow = true;
  g.add(gem);

  g.userData = { gem, cuff: collar, sole };
  return g;
}

// ---------------------------------------------------------------------------
// Power-up pickups
// ---------------------------------------------------------------------------

// `at` is the levelIndex from which a toy starts dropping. Power-ups used to
// all become available at once, so the player's first Teddy Bear or White
// Noise Machine arrived with no idea what it did. They now arrive one at a
// time, each announced on the intro card of the level that unlocks it.
// `short` is what the belt button says under the icon. An icon on its own is a
// rebus: the player has to remember which of eight toys the bottle was, in the
// second they are deciding whether to spend it. Kept to a word that fits a
// 56px button, so `label` is still what the callout and the results card use.
//
// ---- why the ladder starts at level 1, two at a time -----------------------
//
// Used to start at levelIndex 1 (level 2), one toy per level from there,
// because level 1's own card was reserved for POWER STOMP alone. Reported
// symptom: level 1 produces literally nothing (`_updateDropSpawns` bails
// outright when `openPowerups` is empty and bombs aren't open yet either -
// `BOMB_LEVEL` is 3), then level 2 can ONLY roll Mega Boot because it is the
// sole thing unlocked, and stays that way for a while since the one-per-level
// pace does not reach a second toy until level 3. A pool of one is not random,
// it is just delayed - "all boots all day" is what a 100%-weighted pool of
// one looks like from the outside, whatever its actual `weight` says.
//
// Fixed by moving Mega Boot onto level 1 itself (still the only chip added to
// that card - POWER STOMP keeps the spotlight) and doubling the pace after
// that, so the pool is already 3 toys deep by level 2 and full by level 5
// rather than level 9. `nappy` stays at or after `BOMB_LEVEL` (3): its effect
// spawns real bombs, and doing that before the level that introduces bombs
// would put an unexplained bomb on the mat. `radar` stays untouched, gated on
// `PEEKABOO_LEVEL` (13) for the same reason - it answers a problem the player
// has to have felt first.
export const POWERUPS = {
  // Kept well under an equal weight: mega dropping repeatedly would read as
  // "all boots" even with teddy in the pool alongside it.
  mega: { at: 0, id: 'mega', label: 'MEGA BOOT', short: 'MEGA', color: 0xff5d8f, duration: 9, icon: '🥾', weight: 0.4 },
  time: { at: 1, id: 'time', label: '+8 SECONDS', short: '+8s', color: 0x86efac, duration: 0, icon: '⏰' },
  // A hit taken for you. Instant, and it sits there until something goes
  // wrong, so it is the only pickup that is not a countdown.
  //
  // Also at:0, alongside mega: mega is the pool's only member whenever it is
  // active or already on the mat (_canDropPower excludes it then), and level
  // 0 had nothing else to fall back on - every timed drop attempt in that
  // window silently failed. Teddy gives the pool a second member so drops
  // keep landing instead of the "INCOMING DROP" chip filling and producing
  // nothing.
  teddy: { at: 0, id: 'teddy', label: 'TEDDY BEAR', short: 'TEDDY', color: 0xc98a5b, duration: 0, icon: '🧸' },
  slowmo: { at: 2, id: 'slowmo', label: 'SLOW-MO POTION', short: 'SLOW-MO', color: 0x7dd3fc, duration: 6, icon: '🧪' },
  double: { at: 2, id: 'double', label: 'DOUBLE POINTS', short: 'DOUBLE', color: 0xfcd34d, duration: 10, icon: '✨' },
  ripple: { at: 3, id: 'ripple', label: 'BIGGER RIPPLE', short: 'RIPPLE', color: 0xf472b6, duration: 14, icon: '🌊' },
  // Gathers the room instead of buffing the boot: the babies stop fleeing and
  // crawl toward it, which builds the crowd the POWER STOMP wants.
  lullaby: { at: 3, id: 'lullaby', label: 'WHITE NOISE', short: 'NOISE', color: 0xa78bfa, duration: 0, icon: '📻' },
  // Bombs, all of them, right now. `at` must stay >= BOMB_LEVEL (3) - see the
  // note above the ladder.
  nappy: { at: 4, id: 'nappy', label: 'FEED BAG', short: 'BOMBS', color: 0x38bdf8, duration: 12, icon: '🎒' },
  // Unlocked a level after PEEKABOO BABY starts turning up, not before: the
  // player has to have felt the problem (something they could not find)
  // before being handed the answer, or the toy arrives as a solution to a
  // question nobody has asked yet.
  radar: { at: 14, id: 'radar', label: 'DRAGON MONITOR', short: 'RADAR', color: 0x5eead4, duration: 10, icon: '📺' },
};

// ---------------------------------------------------------------------------
// Baby buffs
//
// From level 3 the babies get their own pickups. A bottle lands on the mat,
// every crawler in range makes for it, and whoever drinks it first gets one
// of these until it wears off.
//
// The rules they all obey: a buffed baby still dies to one stomp (nothing in
// this game has hit points), the buff is always visible from across the arena
// (the onesie repaints and a ring lights up underneath), and every one of
// them is worth more points than it costs you, so the honest play is to go
// and deal with it rather than to hide from it.
// ---------------------------------------------------------------------------
export const BABY_BUFFS = {
  sugar: {
    id: 'sugar', name: 'SUGAR RUSH', color: 0xff2d6f, dur: 6.5, score: 3,
    shout: 'SOMEBODY GAVE IT SUGAR',
  },
  growth: {
    id: 'growth', name: 'GROWTH SPURT', color: 0x9d6bff, dur: 10, score: 6,
    shout: 'THAT ONE IS ENORMOUS NOW',
  },
  colic: {
    id: 'colic', name: 'COLIC SCREAM', color: 0xff8a1a, dur: 9, score: 4,
    shout: 'EARPLUGS. NOW.',
  },
  conga: {
    id: 'conga', name: 'CONGA LINE', color: 0x14bf85, dur: 8, score: 4,
    shout: 'CONGA CONGA!!!',
  },
  // Curls up and stops for the length of the buff, wrapped in a bubble that
  // is telegraphed for exactly this reason: unlike the others, the honest
  // play here is patience, not a stomp. See main.js: _napWail.
  napshield: {
    id: 'napshield', name: 'NAP SHIELD', color: 0x9ee7ff, dur: 6, score: 5,
    shout: 'SHHHH, IT IS SLEEPING',
  },
};

// Each pickup is a little toy rather than a primitive, built with the same
// ink-outline treatment as the boot so the whole game reads as one drawing.
// `spin` picks how it tumbles: 'coin' flips flat like a arcade coin (the
// "1.5D" read), 'tumble' rolls on two axes, 'rock' sways like a wound toy.

function starGeometry(outer = 0.34, inner = 0.15, depth = 0.1) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function puPart(geo, color, pos, rot, outline = 1.12) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, softMat(color));
  m.castShadow = true;
  const o = new THREE.Mesh(geo, INK_MAT);
  o.scale.setScalar(outline);
  g.add(m, o);
  if (pos) g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  return g;
}

// Builders return the toy; the caller adds bobbing, spin and the halo.
const PU_BUILD = {
  // MEGA BOOT: a chunky little boot in the same palette as the real one.
  mega() {
    const g = new THREE.Group();
    g.add(puPart(new THREE.BoxGeometry(0.34, 0.16, 0.62), BOOT_COLORS.teal, [0, 0.08, 0]));
    g.add(puPart(new THREE.BoxGeometry(0.3, 0.3, 0.26), BOOT_COLORS.orange, [0, 0.3, -0.15]));
    g.add(puPart(new THREE.BoxGeometry(0.3, 0.18, 0.24), BOOT_COLORS.orangeLight, [0, 0.24, 0.18]));
    g.add(puPart(new THREE.TorusGeometry(0.15, 0.055, 8, 14), BOOT_COLORS.teal,
      [0, 0.46, -0.15], [Math.PI / 2, 0, 0]));
    return { toy: g, spin: 'tumble' };
  },
  // SLOW-MO POTION: a squat bottle, a neck and a stopper, i.e. an actual potion.
  slowmo() {
    const g = new THREE.Group();
    g.add(puPart(new THREE.CylinderGeometry(0.16, 0.21, 0.34, 14), 0x9ee7ff, [0, 0.03, 0]));
    g.add(puPart(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 12), 0x9ee7ff, [0, 0.26, 0]));
    g.add(puPart(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), 0xff9ec4, [0, 0.36, 0]));
    return { toy: g, spin: 'rock' };
  },
  // DOUBLE POINTS: a gold star that flips like a coin.
  double() {
    const g = new THREE.Group();
    g.add(puPart(starGeometry(0.36, 0.16, 0.1), 0xffd700));
    return { toy: g, spin: 'coin' };
  },
  // +8 SECONDS: a wind-up alarm clock, bells and all.
  time() {
    const g = new THREE.Group();
    g.add(puPart(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 18), 0x86efac,
      [0, 0, 0], [Math.PI / 2, 0, 0]));
    g.add(puPart(new THREE.CylinderGeometry(0.21, 0.21, 0.03, 18), 0xfdfdff,
      [0, 0, 0.09], [Math.PI / 2, 0, 0], 1.05));
    for (const sx of [-1, 1]) {
      g.add(puPart(new THREE.SphereGeometry(0.11, 10, 8), 0x22c55e, [sx * 0.24, 0.26, 0]));
    }
    // Hands, frozen at a comically urgent time.
    g.add(puPart(new THREE.BoxGeometry(0.03, 0.16, 0.03), 0x2a1710, [0, 0.07, 0.12]));
    g.add(puPart(new THREE.BoxGeometry(0.12, 0.03, 0.03), 0x2a1710, [0.05, 0, 0.12]));
    return { toy: g, spin: 'rock' };
  },
  // BIGGER RIPPLE: a mini of the bomb whose reach it upgrades.
  ripple() {
    const g = new THREE.Group();
    g.add(puPart(new THREE.SphereGeometry(0.26, 14, 12), 0xf472b6, [0, 0.2, 0]));
    g.add(puPart(new THREE.CylinderGeometry(0.07, 0.08, 0.3, 10), 0x9ee7ff, [0, -0.12, 0]));
    g.add(puPart(new THREE.TorusGeometry(0.12, 0.04, 8, 14), 0xa7f3d0,
      [0, -0.3, 0], [Math.PI / 2, 0, 0]));
    return { toy: g, spin: 'tumble' };
  },
};

// TEDDY BEAR: a plush that takes the hit for you, so it is built soft and
// round where every other pickup has a hard silhouette.
PU_BUILD.teddy = function teddy() {
  const g = new THREE.Group();
  const fur = 0xc98a5b;
  g.add(puPart(new THREE.SphereGeometry(0.3, 14, 12), fur, [0, 0.06, 0]));
  g.add(puPart(new THREE.SphereGeometry(0.22, 14, 12), fur, [0, 0.42, 0.02]));
  for (const sx of [-1, 1]) {
    g.add(puPart(new THREE.SphereGeometry(0.09, 10, 8), fur, [sx * 0.17, 0.58, 0]));
    g.add(puPart(new THREE.SphereGeometry(0.11, 10, 8), fur, [sx * 0.32, 0.06, 0.04]));
    g.add(puPart(new THREE.SphereGeometry(0.1, 10, 8), fur, [sx * 0.16, -0.2, 0.06]));
  }
  g.add(puPart(new THREE.SphereGeometry(0.11, 10, 8), 0xf6d8b8, [0, 0.36, 0.19]));
  return { toy: g, spin: 'rock' };
};

// WHITE NOISE MACHINE: a little radio, because the thing it does is make a
// noise the whole room walks toward.
PU_BUILD.lullaby = function lullaby() {
  const g = new THREE.Group();
  g.add(puPart(new THREE.BoxGeometry(0.52, 0.36, 0.26), 0xa78bfa, [0, 0.1, 0]));
  g.add(puPart(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16), 0x3b2a5e,
    [-0.12, 0.1, 0.15], [Math.PI / 2, 0, 0], 1.06));
  g.add(puPart(new THREE.BoxGeometry(0.14, 0.16, 0.04), 0xfdfdff, [0.14, 0.1, 0.15]));
  g.add(puPart(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8), 0xe9d5ff,
    [0.2, 0.4, -0.05], [0, 0, -0.35]));
  return { toy: g, spin: 'rock' };
};

// DIAPER BAG: a satchel, stuffed.
PU_BUILD.nappy = function nappy() {
  const g = new THREE.Group();
  g.add(puPart(new THREE.BoxGeometry(0.54, 0.38, 0.28), 0x38bdf8, [0, 0.08, 0]));
  g.add(puPart(new THREE.BoxGeometry(0.56, 0.14, 0.3), 0x0ea5e9, [0, 0.28, 0]));
  g.add(puPart(new THREE.TorusGeometry(0.19, 0.035, 8, 16), 0x0284c7,
    [0, 0.34, 0], [0, 0, 0]));
  g.add(puPart(new THREE.SphereGeometry(0.1, 10, 8), 0xfdfdff, [0.16, 0.36, 0.05]));
  return { toy: g, spin: 'tumble' };
};

// BABY MONITOR: a screen, a knob and an antenna angled up - the shape reads
// as "receiver" before the player ever learns what it reveals.
PU_BUILD.radar = function radar() {
  const g = new THREE.Group();
  g.add(puPart(new THREE.BoxGeometry(0.4, 0.5, 0.22), 0x5eead4, [0, 0.1, 0]));
  g.add(puPart(new THREE.BoxGeometry(0.3, 0.22, 0.04), 0x0f766e, [0, 0.2, 0.13]));
  g.add(puPart(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), 0xfdfdff,
    [0, -0.02, 0.13], [Math.PI / 2, 0, 0]));
  g.add(puPart(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), 0x99f6e4,
    [0.14, 0.42, -0.03], [0, 0, -0.3]));
  g.add(puPart(new THREE.SphereGeometry(0.035, 8, 6), 0xf87171, [0.14, 0.55, -0.11]));
  return { toy: g, spin: 'rock' };
};

// A pickup shrunk down to ride on the boot. What you are carrying should be
// visible on the thing you are actually looking at, not only in the HUD.
export function makeCharm(id) {
  const g = (PU_BUILD[id] || PU_BUILD.double)().toy;
  // The ink outline material is shared module-wide and must never be disposed
  // with the charm; everything else here was built fresh for this one.
  const mats = [];
  g.traverse((o) => {
    if (o.isMesh && o.material !== INK_MAT && !mats.includes(o.material)) {
      mats.push(o.material);
    }
  });
  g.userData.mats = mats;
  return g;
}

export function makePowerup(id) {
  const def = POWERUPS[id];
  const g = new THREE.Group();

  const built = (PU_BUILD[id] || PU_BUILD.double)();
  const core = built.toy;
  core.position.y = 0.85;
  // Sized against a baby (~1.3 units): a pickup has to be readable as a
  // specific toy from the play camera, not just as a coloured blob.
  // Bigger than it was (1.9). A toy on the mat is now the only way to get one,
  // so it has to read as a THING from the far side of the pen rather than as
  // scenery you might walk past.
  core.scale.setScalar(2.4);
  g.add(core);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.85, 28),
    new THREE.MeshBasicMaterial({
      color: def.color, transparent: true, opacity: 0.7,
      side: THREE.DoubleSide, depthWrite: false,
    }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.05;
  g.add(halo);

  // A column of light, same trick as the burning bomb: the camera looks down at
  // 56 degrees, so a vertical shape is the one thing that survives peripheral
  // vision when the player is watching babies somewhere else.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.5, 7, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: def.color, transparent: true, opacity: 0.26,
      depthWrite: false, side: THREE.DoubleSide,
    }));
  beacon.position.y = 3.6;
  beacon.renderOrder = 2;
  g.add(beacon);

  // The clock, on the floor. It closes in as the toy runs out of time, so the
  // deadline is a shape rather than a number.
  const clock = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.4, 32),
    new THREE.MeshBasicMaterial({
      color: def.color, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthWrite: false,
    }));
  clock.rotation.x = -Math.PI / 2;
  clock.position.y = 0.03;
  clock.renderOrder = 1;
  g.add(clock);

  // The shadow it throws while it is still in the air. Without one, a toy
  // descending on a camera that looks down at 56 degrees just appears to grow:
  // the shadow is what tells you it is above the mat and closing.
  const shade = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 24),
    new THREE.MeshBasicMaterial({
      color: 0x1b2233, transparent: true, opacity: 0, depthWrite: false,
    }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.02;
  g.add(shade);

  g.userData = {
    def, core, halo, beacon, clock, shade, spin: built.spin, t: Math.random() * 6,
  };
  return g;
}

// ---------------------------------------------------------------------------
// The bottle
//
// A pickup that is not for you. It lands on the mat, every crawler in range
// turns and makes for it, and whoever gets there first comes away buffed.
//
// Deliberately shaped and coloured nothing like a power-up: warm red halo
// instead of the pickup palette, and it sits low and still rather than
// bobbing and spinning. A player must never mistake one for the other, since
// the correct response to the two is opposite.
// ---------------------------------------------------------------------------
export function makeBottle() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.3, 0.62, 20), softMat(0xfdfdff));
  body.position.y = 0.42;
  body.castShadow = true;
  const bodyInk = new THREE.Mesh(body.geometry, INK_MAT);
  bodyInk.scale.setScalar(1.1);
  bodyInk.position.copy(body.position);

  const milk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.34, 20), softMat(0xfff3d6));
  milk.position.y = 0.29;

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.12, 20), softMat(0xff5d8f));
  collar.position.y = 0.79;
  const collarInk = new THREE.Mesh(collar.geometry, INK_MAT);
  collarInk.scale.setScalar(1.14);
  collarInk.position.copy(collar.position);

  const teat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.15, 0.26, 14), softMat(0xffc9a8));
  teat.position.y = 0.97;
  const teatInk = new THREE.Mesh(teat.geometry, INK_MAT);
  teatInk.scale.setScalar(1.16);
  teatInk.position.copy(teat.position);

  g.add(bodyInk, body, milk, collarInk, collar, teatInk, teat);

  // The halo is the actual signal. Red, because the right answer is usually
  // to break it up rather than to admire it.
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.94, 30),
    new THREE.MeshBasicMaterial({
      color: 0xff4d4d, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, depthWrite: false,
    }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.04;
  halo.renderOrder = 1;
  g.add(halo);

  g.scale.setScalar(1.25);
  g.userData = {
    halo, t: Math.random() * 6, life: 0,
    mats: [body.material, milk.material, collar.material, teat.material, halo.material],
  };
  return g;
}

// The ring under a buffed baby. Same read as the sleeper's keep-out ring, in
// the buff's own colour, because "something is different about that one" has
// to land in the half second before it reaches the edge.
export function makeBuffAura(color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 1.12, 28),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthWrite: false,
    }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  ring.renderOrder = 1;
  return ring;
}

// A soft bubble shield, worn only by a NAP SHIELD buff. Round rather than
// flat, unlike every other buff marker in this game: "there is something
// AROUND this one" has to read as a barrier standing in the way of the
// boot, not as a mark painted on the floor underneath it.
export function makeBubbleShield(color) {
  const g = new THREE.Group();
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 20, 14),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    }));
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(0.98, 16, 11),
    new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.4,
      side: THREE.BackSide, depthWrite: false, wireframe: true,
    }));
  g.add(bubble, rim);
  g.position.y = 0.5;
  g.userData = { bubble, rim };
  return g;
}

// Boss ammo: a folded diaper, thrown like a shuriken. Funnier than a
// fireball, and the flat wedge shape reads its spin from across the arena,
// which matters when it is the thing the player has to track and dodge.
export function makeBossAmmo() {
  const g = new THREE.Group();
  const wedge = new THREE.Shape();
  wedge.moveTo(-0.3, -0.18);
  wedge.lineTo(0.3, 0);
  wedge.lineTo(-0.3, 0.18);
  wedge.closePath();
  const geo = new THREE.ExtrudeGeometry(wedge, {
    depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1,
  });
  geo.center();
  g.add(puPart(geo, 0xfdfdff, [0, 0, 0], [Math.PI / 2, 0, 0]));
  g.add(puPart(new THREE.TorusGeometry(0.09, 0.025, 6, 10), 0xff9ec4,
    [0, 0, 0.03], [Math.PI / 2, 0, 0]));
  return g;
}

// ---------------------------------------------------------------------------
// The bomb
// ---------------------------------------------------------------------------

// Dropped on the mat, winds itself up, then sets off a quake that races along
// the foam seams. Built to look like a nursery toy that got overexcited.
// The classic cartoon bomb: a round dark body, a brass collar, and a fuse
// that visibly BURNS DOWN. The fuse is the whole point of the object - it is
// the only warning the player gets, and unlike the wind-up key it replaced it
// says how much time is left rather than merely that time is passing.
//
// Built from discrete segments rather than one tube, because the fuse has to
// get shorter. Six is enough for the burn to read as continuous at the size
// this is drawn, and hiding a segment is free where rebuilding a tube every
// frame would not be.
export const FUSE_SEGMENTS = 6;

export function makeBomb() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.44, 26, 20), softMat(0x2f2a44));
  body.position.y = 0.5;
  body.castShadow = true;
  g.add(body);
  // Ink shell, so it sits in the same drawing as the boot and the babies
  // rather than reading as a dark hole in the mat.
  const shell = new THREE.Mesh(body.geometry, INK_MAT);
  shell.scale.setScalar(1.1);
  shell.position.y = 0.5;
  g.add(shell);

  // A highlight, so a near-black sphere still reads as round from overhead.
  const gloss = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 10), softMat(0x8d86b8));
  gloss.position.set(-0.16, 0.72, 0.16);
  gloss.scale.set(1, 0.62, 0.72);
  g.add(gloss);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.18, 0.16, 16), softMat(0xffc400));
  collar.position.y = 0.92;
  collar.castShadow = true;
  g.add(collar);

  // The fuse, curling up and away from the collar. Segment 0 is at the
  // collar and the last is at the tip, so burning down means hiding from the
  // end of the array backwards.
  const fuse = [];
  const fuseGeo = new THREE.SphereGeometry(0.052, 10, 8);
  const fuseMat = softMat(0xd9c7a0);
  for (let i = 0; i < FUSE_SEGMENTS; i++) {
    const t = (i + 1) / FUSE_SEGMENTS;
    const seg = new THREE.Mesh(fuseGeo, fuseMat);
    seg.position.set(Math.sin(t * 2.1) * 0.3, 1.0 + t * 0.42, Math.sin(t * 3.1) * 0.1);
    g.add(seg);
    fuse.push(seg);
  }

  // The spark rides the burning end down the fuse. Basic material, not toon:
  // it is a light source in the fiction and must not take shading.
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
  spark.position.copy(fuse[FUSE_SEGMENTS - 1].position);
  g.add(spark);

  // A beacon standing straight up out of the bomb. The camera looks down at
  // 56 degrees, so a vertical column is the one shape that stays visible in
  // peripheral vision while the player is looking somewhere else entirely -
  // which is exactly the situation a burning fuse has to survive. Without it a
  // dropped bomb is a small dark ball on a busy mat and the quake reads as
  // something the game did on its own.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.3, 6, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff5d8f, transparent: true, opacity: 0.3,
      depthWrite: false, side: THREE.DoubleSide,
    }));
  beacon.position.y = 3.1;
  beacon.renderOrder = 2;
  g.add(beacon);

  // The shadow it throws on the way down. See FALL_H in main.js.
  const shade = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 20),
    new THREE.MeshBasicMaterial({
      color: 0x1b2233, transparent: true, opacity: 0, depthWrite: false,
    }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.02;
  g.add(shade);

  g.userData = { body, gloss, fuse, spark, beacon, shade, bodyMat: body.material };
  return g;
}

// ---------------------------------------------------------------------------
// Playroom
// ---------------------------------------------------------------------------

// The floor plane, the texture tiling, and the logical grid the mat quake
// travels along are all derived from these, so the seams you can see are
// exactly the seams the quake follows.
export const FLOOR_SIZE = 200;
const MAT_REPEAT = 20;
// FOUR, and it cannot be changed for looks: MAT_TILE is derived from it, and
// MAT_TILE is the grid the bomb quake travels along, the grid snapToTile snaps
// to, and the grid the blast preview paints. Six cells here quietly shrank the
// plus from 2.5 units a tile to 1.67 and made every bomb weaker. The mat's
// variety comes from what is drawn INSIDE each cell instead.
const MAT_CELLS = 4;
export const MAT_TILE = FLOOR_SIZE / (MAT_REPEAT * MAT_CELLS);

// Snaps a world coordinate to the centre of the foam tile containing it.
export function snapToTile(v) {
  return Math.floor(v / MAT_TILE) * MAT_TILE + MAT_TILE / 2;
}

function playmatTexture(pastels) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  // Deliberately low-contrast: the floor is a backdrop, the babies are the
  // thing you need to see.
  //
  // Six cells a side rather than four, each with its own shade nudge and its
  // own doodle. The old mat was four cells cycling four pastels with the
  // letters A-P laid out in reading order, tiled twenty times across the floor
  // - which from above is a visibly repeating wallpaper, and once you have seen
  // the repeat you cannot stop seeing it. Same trick as the babies and the toy
  // clutter: several weak axes instead of one strong one.
  const cells = MAT_CELLS;
  const cw = size / cells;
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const shade = (hex, mul) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * mul));
    const gg = Math.min(255, Math.round(((n >> 8) & 255) * mul));
    const b = Math.min(255, Math.round((n & 255) * mul));
    return `rgb(${r},${gg},${b})`;
  };
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const base = pastels[(x + y * 3 + ((x * y) % 2)) % pastels.length];
      g.fillStyle = shade(base, 0.94 + Math.random() * 0.12);
      g.fillRect(x * cw, y * cw, cw, cw);
      // Foam-mat jigsaw seam.
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 5;
      g.strokeRect(x * cw + 3, y * cw + 3, cw - 6, cw - 6);

      // One of four fillers per cell, so a tile is a letter, a number, a ring
      // of dots, a corner stripe or nothing at all.
      g.save();
      g.translate(x * cw + cw / 2, y * cw + cw / 2);
      g.rotate((Math.random() - 0.5) * 0.5);
      const roll = Math.random();
      g.fillStyle = 'rgba(140,130,170,0.07)';
      g.strokeStyle = 'rgba(140,130,170,0.07)';
      if (roll < 0.52) {
        g.font = `900 ${cw * (0.3 + Math.random() * 0.14)}px "Trebuchet MS", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(glyphs[(Math.random() * glyphs.length) | 0], 0, 0);
      } else if (roll < 0.72) {
        const n = 4 + ((Math.random() * 3) | 0);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          g.beginPath();
          g.arc(Math.cos(a) * cw * 0.24, Math.sin(a) * cw * 0.24, cw * 0.045, 0, Math.PI * 2);
          g.fill();
        }
      } else if (roll < 0.86) {
        g.lineWidth = cw * 0.05;
        for (let k = -1; k <= 1; k++) {
          g.beginPath();
          g.moveTo(-cw * 0.3, k * cw * 0.13);
          g.lineTo(cw * 0.3, k * cw * 0.13);
          g.stroke();
        }
      }
      g.restore();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(MAT_REPEAT, MAT_REPEAT);
  tex.anisotropy = 4;
  return tex;
}

export function makePlayroom(scene, bounds, palette = {}) {
  const mat = palette.mat || ['#f6ecf5', '#eef0f8', '#f2f4ec', '#f8f1e8'];
  const room = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.MeshToonMaterial({ map: playmatTexture(mat), gradientMap: GRADIENT }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const props = palette.props
    || [0xff8fab, 0x9ee7ff, 0xffe066, 0xa7f3d0, 0xc4b5fd, 0xffb37b];
  const foam = palette.foam
    || [0xffb3c9, 0xa8dcf5, 0xffe08a, 0xb6f0cd, 0xd3c2f7];

  // The kerb and the toy clutter are a few hundred static objects that never
  // move, which is a few hundred draw calls for scenery. They are built as
  // InstancedMesh instead: one draw call per shape, with the colour carried
  // per instance. Technique borrowed from Bruno Simon's folio-2025 (MIT),
  // which leans on instancing for exactly this kind of set dressing.
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  // Base colour must be white so the per-instance colour multiplies cleanly.
  const instanced = (geo, count) => {
    const m = new THREE.InstancedMesh(geo, softMat(0xffffff), count);
    m.castShadow = true;
    m.receiveShadow = true;
    // Instances are spread far wider than the geometry's own bounds, so the
    // automatic bounding sphere would cull the whole batch at odd angles.
    m.frustumCulled = false;
    return m;
  };

  // Same multiply-the-axes trick the babies got. A prop now carries a
  // three-axis rotation and a NON-UNIFORM scale, so one box geometry produces
  // cubes, planks, slabs and posts, and one sphere produces balls, eggs and
  // squashed cushions. Per-instance colour already existed; what was missing
  // was any variation in shape, which is what the eye actually reads when it
  // decides whether it is looking at forty objects or one object forty times.
  const place = (mesh, i, x, y, z, scale, rotY, rotZ, colour,
    sx = 1, sy = 1, sz = 1, rotX = 0) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rotX, rotY, rotZ);
    dummy.scale.set(scale * sx, scale * sy, scale * sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, tint.setHex(colour));
  };

  // ---- padded foam kerb marking the exact edge of play --------------------
  const bx = bounds.xMax + 1.0;
  const zA = bounds.zMin - 1.0;
  const zB = bounds.zMax + 1.0;
  const spots = [];
  for (let x = -bx; x <= bx + 0.01; x += 1.0) { spots.push([x, zA], [x, zB]); }
  for (let z = zA + 1; z <= zB - 1; z += 1.0) { spots.push([-bx, z], [bx, z]); }

  const kerbMesh = instanced(new THREE.BoxGeometry(1.0, 0.5, 1.0), spots.length);
  spots.forEach(([x, z], i) => {
    // Foam blocks are hand-laid by a tired adult, not extruded: each one sits a
    // little taller or shorter and a little askew. The colour cycle stays
    // deliberate, because the kerb is the border and has to read as a border.
    const h = 0.9 + Math.random() * 0.3;
    place(kerbMesh, i, x, (0.25 + (i % 2) * 0.04) * h, z, 1,
      (Math.random() - 0.5) * 0.14, 0, foam[i % foam.length],
      0.98 + Math.random() * 0.06, h, 0.98 + Math.random() * 0.06);
  });
  kerbMesh.instanceMatrix.needsUpdate = true;
  room.add(kerbMesh);

  // ---- toy clutter beyond the kerb ----------------------------------------
  // Three bands (back, left, right) and never in front, because anything
  // between the camera and the playfield would just be in the way.
  // How much clutter to lay down, from how much room there is around the pen.
  // A phone fits the kerb and almost nothing else, so the far bands are wasted
  // work there; a desktop has a wide empty apron on all sides and needs filling
  // or the playfield floats in a void. Measured off the viewport rather than the
  // arena, because it is screen space that is either full or empty.
  const pin = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const wide = typeof innerWidth === 'number' && innerHeight > 0
    ? pin(innerWidth / innerHeight, 0.4, 2.6) : 1.6;
  const density = pin(0.55 + wide * 0.55, 0.75, 1.9);
  const bands = [
    // Close-in scatter, just outside the kerb. This band exists so that a
    // boot which has grown a little has something to reach: without it the
    // nearest breakable toy sat 3.5 units past the playpen and nothing at all
    // was in range below power tier 3. Kept small and low so it still reads
    // as toys left on the floor rather than as a second wall.
    { n: 26, x: [-bx - 4.6, bx + 4.6], z: [zA - 4.6, zA - 0.7], stack: 0.25, near: true },
    { n: 16, x: [-bx - 4.6, -bx - 0.7], z: [zA - 4, zB + 4], stack: 0.25, near: true },
    { n: 16, x: [bx + 0.7, bx + 4.6], z: [zA - 4, zB + 4], stack: 0.25, near: true },
    { n: 70, x: [-34, 34], z: [zA - 16, zA - 2.5], stack: 3.0 },
    { n: 34, x: [-bx - 17, -bx - 2.5], z: [zA - 8, zB + 7], stack: 0.6 },
    { n: 34, x: [bx + 2.5, bx + 17], z: [zA - 8, zB + 7], stack: 0.6 },
  ];
  // Applied to the far bands only. The close-in scatter is the band the boot
  // can actually reach, so its count is a gameplay number and stays put.
  for (const b of bands) if (!b.near) b.n = Math.round(b.n * density);
  const total = bands.reduce((n, b) => n + b.n, 0);

  // Split by shape first so each batch is a single geometry.
  // Six shapes, one InstancedMesh each, so the whole toy field is still six
  // draw calls. Weighted so the boring two stay commonest: the point is that
  // the eye keeps finding something it has not catalogued, not that the floor
  // becomes a shape sampler.
  const KINDS = [
    { id: 'ball', w: 26, geo: () => new THREE.SphereGeometry(0.5, 14, 12) },
    { id: 'block', w: 30, geo: () => new THREE.BoxGeometry(1, 1, 1) },
    { id: 'drum', w: 14, geo: () => new THREE.CylinderGeometry(0.5, 0.5, 0.85, 14) },
    { id: 'cone', w: 10, geo: () => new THREE.ConeGeometry(0.5, 0.95, 14) },
    { id: 'ring', w: 10, geo: () => new THREE.TorusGeometry(0.38, 0.17, 9, 16) },
    { id: 'pill', w: 10, geo: () => new THREE.CapsuleGeometry(0.32, 0.5, 4, 12) },
  ];
  const kindBag = KINDS.flatMap((k) => Array(k.w).fill(k.id));
  const tintJit = new THREE.Color();

  const picks = [];
  for (const band of bands) {
    for (let k = 0; k < band.n; k++) {
      // The close band skews small, so most of what a low-tier boot can reach
      // is also light enough for it to break, with a few heavier pieces mixed
      // in to be visibly out of its league.
      const s = band.near ? 0.5 + Math.random() * 0.75 : 0.6 + Math.random() * 1.2;
      // Per-axis stretch. Kept inside 0.72-1.3 on purpose: the game gates a
      // prop's weight on `s` and measures the smash reach from it, so a prop
      // three units long with a one-unit hitbox would be a lie. This much
      // reshapes the silhouette without the collision noticing.
      const sx = 0.72 + Math.random() * 0.58;
      const sy = 0.72 + Math.random() * 0.58;
      const sz = 0.72 + Math.random() * 0.58;
      // Base colour, then a brightness nudge, which turns a palette of six into
      // a continuum without anybody having to pick more colours.
      const base = props[(Math.random() * props.length) | 0];
      tintJit.setHex(base).multiplyScalar(0.82 + Math.random() * 0.36);
      picks.push({
        kind: kindBag[(Math.random() * kindBag.length) | 0],
        x: band.x[0] + Math.random() * (band.x[1] - band.x[0]),
        z: band.z[0] + Math.random() * (band.z[1] - band.z[0]),
        y: s * 0.5 * sy + Math.random() * band.stack,
        s, sx, sy, sz,
        rotX: (Math.random() - 0.5) * 0.5,
        rotY: Math.random() * Math.PI * 2,
        rotZ: (Math.random() - 0.5) * 0.5,
        colour: tintJit.getHex(),
      });
    }
  }

  const meshes = {};
  for (const kind of KINDS) {
    const mine = picks.filter((p) => p.kind === kind.id);
    if (!mine.length) continue;
    const mesh = instanced(kind.geo(), mine.length);
    mine.forEach((p, i) => place(mesh, i, p.x, p.y, p.z, p.s,
      p.rotY, p.rotZ, p.colour, p.sx, p.sy, p.sz, p.rotX));
    mesh.instanceMatrix.needsUpdate = true;
    room.add(mesh);
    meshes[kind.id] = mine;
    mine.forEach((p, i) => { p.mesh = mesh; p.i = i; });
  }

  // The clutter used to be write-once set dressing. It is now a target list:
  // a boot with enough STOMP POWER behind it can reach out past the kerb and
  // flatten it, so the room has to hand back enough per-instance detail for
  // the game to find, weigh and delete one piece of it.
  // Every field a prop needs to be put back EXACTLY as it was, including the
  // new stretch and the third rotation axis: replaying a level must not start
  // you in the rubble of the last attempt, and it must not quietly reshape the
  // scenery either.
  const roster = [];
  for (const list of Object.values(meshes)) {
    for (const p of list) {
      roster.push({
        mesh: p.mesh, kind: p.kind, i: p.i, x: p.x, y: p.y, z: p.z,
        s: p.s, sx: p.sx, sy: p.sy, sz: p.sz, colour: p.colour,
        rotX: p.rotX || 0, rotY: p.rotY, rotZ: p.rotZ || 0,
        gone: false, lit: false,
      });
    }
  }

  room.userData.instanceCount = spots.length + total;
  room.userData.propKinds = KINDS.map((k) => k.id);
  room.userData.props = roster;
  room.userData.dummy = dummy;
  // Handed back so the closing seconds can wash the whole mat with colour.
  // The texture stays put and only the multiplier moves, which is why the
  // seams and the letters keep reading through a shimmer.
  room.userData.floorMat = floor.material;
  room.userData.kerbMesh = kerbMesh;

  scene.add(room);
  return room;
}
