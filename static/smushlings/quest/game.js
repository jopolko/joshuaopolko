/* Smushlings Quest: Smushville - open-world game: camera, player, driving, crowds, gangs, heat, missions, bosses */
import {
  THREE, GEO, makeEnemy, makeBoss, makeSegment, loadDragon, makePlayerModel, recolorPlayer, makeCage, makeHeart,
  makeCoin, makeXp, makePowerup, makeTelegraph, makeBomb, makeEgg, emojiSprite, part, M, glow, collectMats,
} from './models.js';
import { makeBoot } from './vendor/entities.js';
import { makePed, makeCar, CAR_COLORS } from './peds.js';
import { buildCity, roadC, NB, LANE, SIZE, districtOf } from './city.js';
import { buildMissions } from './missions.js';
import {
  DISTRICTS, ENEMIES, GANGS, BOSSES, PERKS, POWERUPS, SHOP, HIDES, xpNeed, Save, clamp, lerp,
} from './data.js';
import { Snd } from './audio.js';
import { UI, HUD } from './ui.js';

Save.load();

/* ================================================================== renderer */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
/* graphics quality: auto-scales resolution to hold ~60fps; the pause menu can pin low / medium / high */
const COARSE = matchMedia('(pointer: coarse)').matches;
const QUALITY = { low: { dpr: 0.75, shadow: 0, peds: 14, traffic: 8 }, med: { dpr: 1, shadow: 1024, peds: 22, traffic: 11 }, high: { dpr: 1.5, shadow: 2048, peds: 30, traffic: 14 } };
let qName = 'auto'; try { qName = localStorage.getItem('sq_quality') || 'auto'; } catch (e) { }
let qLevel = qName === 'auto' ? (COARSE ? 'med' : 'high') : qName;
const DEVICE_DPR = devicePixelRatio || 1;
let DPR = Math.min(DEVICE_DPR, QUALITY[qLevel].dpr), dprScale = 1;
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.domElement.id = 'gl';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const SKY = new THREE.Color(0x9ad8ff);
scene.background = SKY.clone();
scene.fog = new THREE.Fog(SKY.clone(), 60, 180);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.2, 230);
const hemi = new THREE.HemisphereLight(0xfff6e8, 0x7a8a6a, 1.15);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(QUALITY[qLevel].shadow || 1024, QUALITY[qLevel].shadow || 1024);
sun.castShadow = QUALITY[qLevel].shadow > 0;
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 130 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(hemi, sun, sun.target);
const SKY_DAY = new THREE.Color(0x9ad8ff), SKY_NIGHT = new THREE.Color(0x1b1a3a), SKY_DUSK = new THREE.Color(0xffa98a);

/* ---------------- particles */
const MAXP = 5000;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP), pAlpha = new Float32Array(MAXP);
const pVel = new Float32Array(MAXP * 3), pLife = new Float32Array(MAXP), pMax = new Float32Array(MAXP), pGrav = new Float32Array(MAXP), pS0 = new Float32Array(MAXP);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('pcolor', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
pGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { scale: { value: 600 } }, transparent: true, depthWrite: false,
  vertexShader: `attribute float size; attribute float alpha; attribute vec3 pcolor; varying vec3 vC; varying float vA; uniform float scale;
    void main(){ vC=pcolor; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float d=length(c); if(d>.5) discard; gl_FragColor=vec4(vC, vA*smoothstep(.5,.15,d)); }`,
});
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
let pN = 0;
const tmpC = new THREE.Color();
function emit(x, y, z, vx, vy, vz, life, color, size, grav = 0) {
  if (pN >= MAXP) return;
  const i = pN++;
  pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
  pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
  tmpC.setHex(color); pCol[i * 3] = tmpC.r; pCol[i * 3 + 1] = tmpC.g; pCol[i * 3 + 2] = tmpC.b;
  pLife[i] = pMax[i] = life; pGrav[i] = grav; pS0[i] = size; pSize[i] = size; pAlpha[i] = 1;
}
function burst(x, y, z, n, color, spd = 4, life = 0.6, size = 0.25, grav = 6, up = 2) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * 6.283, s = spd * (0.3 + Math.random() * 0.7), e = Math.random();
    emit(x, y, z, Math.cos(a) * s, up * (0.4 + e) + (Math.random() - 0.3) * spd * 0.5, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6),
      Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color, size * (0.6 + Math.random() * 0.8), grav);
  }
}
function ringBurst(x, y, z, r, n, color, size = 0.3) {
  for (let k = 0; k < n; k++) { const a = k / n * 6.283; emit(x + Math.cos(a) * r * 0.3, y + 0.2, z + Math.sin(a) * r * 0.3, Math.cos(a) * r * 3, 0.6, Math.sin(a) * r * 3, 0.35, color, size, 0); }
}
function updateParticles(dt) {
  for (let i = 0; i < pN; i++) {
    pLife[i] -= dt;
    if (pLife[i] <= 0) {
      const j = --pN;
      if (i !== j) {
        for (let k = 0; k < 3; k++) { pPos[i * 3 + k] = pPos[j * 3 + k]; pVel[i * 3 + k] = pVel[j * 3 + k]; pCol[i * 3 + k] = pCol[j * 3 + k]; }
        pLife[i] = pLife[j]; pMax[i] = pMax[j]; pGrav[i] = pGrav[j]; pS0[i] = pS0[j];
        i--;
      }
      continue;
    }
    pVel[i * 3 + 1] -= pGrav[i] * dt;
    const drag = Math.exp(-2.2 * dt);
    pVel[i * 3] *= drag; pVel[i * 3 + 2] *= drag;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    if (pPos[i * 3 + 1] < 0.03) { pPos[i * 3 + 1] = 0.03; pVel[i * 3 + 1] *= -0.3; }
    const u = pLife[i] / pMax[i];
    pAlpha[i] = Math.min(1, u * 2.2); pSize[i] = pS0[i] * (0.4 + u * 0.6);
  }
  pGeo.setDrawRange(0, pN);
  for (const n of ['position', 'pcolor', 'size', 'alpha']) pGeo.attributes[n].needsUpdate = true;
}

function applyQuality() {
  const q = QUALITY[qLevel];
  DPR = Math.min(DEVICE_DPR, q.dpr) * dprScale;
  renderer.setPixelRatio(DPR);
  const want = q.shadow > 0;
  if (sun.castShadow !== want) sun.castShadow = want;
  if (want && sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  resize();
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  pMat.uniforms.scale.value = innerHeight * DPR / (2 * Math.tan(camera.fov * Math.PI / 360));
  HUD.resize();
}
addEventListener('resize', resize);
/* dynamic resolution: if frames are slow, render fewer pixels; if there's headroom, give them back */
let fAcc = 0, fN = 0;
function adaptRes(ms) {
  if (qName !== 'auto') return;
  fAcc += ms; fN++;
  if (fN < 45) return;
  const avg = fAcc / fN; fAcc = fN = 0;
  const cap = Math.min(DEVICE_DPR, QUALITY[qLevel].dpr);
  if (avg > 21 && dprScale > 0.6) { dprScale = Math.max(0.6, dprScale - 0.1); applyQuality(); }
  else if (avg > 27 && qLevel === 'high') { qLevel = 'med'; dprScale = Math.min(dprScale, 1); applyQuality(); }
  else if (avg < 11 && dprScale < 1) { dprScale = Math.min(1, dprScale + 0.1); applyQuality(); }
  void cap;
}
function setQuality(n) {
  qName = n; try { localStorage.setItem('sq_quality', n); } catch (e) { }
  qLevel = n === 'auto' ? (COARSE ? 'med' : 'high') : n; dprScale = 1; applyQuality();
}

/* ================================================================== input */
const keys = Object.create(null), pressed = Object.create(null);
const mouse = { l: false, r: false, dx: 0, dy: 0, lastMove: -99 };
const touch = { on: false, jx: 0, jy: 0, jid: null, ox: 0, oy: 0, lid: null, lx: 0, ly: 0, btn: {} };
let locked = false;
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  pressed[e.code] = true; keys[e.code] = true; Snd.init();
  if (touch.on) { touch.on = false; document.getElementById('touch').classList.remove('on'); }
  onKeyMenu(e.code);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });
const cvs = renderer.domElement;
addEventListener('mousemove', e => {
  if (G.mode !== 'play') return;
  if (locked || mouse.r || mouse.l) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; mouse.lastMove = performance.now(); }
});
cvs.addEventListener('mousedown', e => {
  Snd.init();
  if (performance.now() - (touch.last || -9e9) < 1200) return;
  if (G.mode === 'play' && !locked && !touch.on && cvs.requestPointerLock) { try { const p = cvs.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { } }
  if (e.button === 0) mouse.l = true;
  if (e.button === 2) mouse.r = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
cvs.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  const was = locked; locked = document.pointerLockElement === cvs;
  if (was && !locked && G.mode === 'play') togglePause();
});

/* ---------------- touch: floating joystick on the left, drag anywhere on the right to look,
   thumb buttons that change with what you're doing (on foot / driving / in the air / near a car) */
const touchEl = document.getElementById('touch');
touchEl.innerHTML = `<div id="joyBase"><div id="joyKnob"></div><span>MOVE</span></div>
  <div class="tlook">drag to look</div>
  <button class="tb fire foot car" data-a="fire" data-drag="1"><b>🔥</b>PUFF<small>hold + drag to aim</small></button>
  <button class="tb jump foot" data-a="jump"><b>⤒</b>JUMP</button>
  <button class="tb dash foot" data-a="dash"><b>💨</b>DASH</button>
  <button class="tb spin foot" data-a="spin"><b>🌀</b>SPIN</button>
  <button class="tb pound air" data-a="pound"><b>💥</b>FLOP</button>
  <button class="tb gas car" data-a="gas"><b>▲</b>GAS</button>
  <button class="tb brake car" data-a="brake"><b>▼</b>BRAKE</button>
  <button class="tb drift car" data-a="drift"><b>↯</b>DRIFT</button>
  <button class="tb use ctx" data-a="use"><span id="useLbl">🚗 Get in</span></button>
  <button class="tb mini pz" data-a="pause">⏸</button><button class="tb mini mapb" data-a="map">🗺️</button>
  <button class="tb mini radio car" data-a="radio">📻</button><button class="tb mini horn car" data-a="horn">📯</button>`;
const useLbl = document.getElementById('useLbl');
for (const b of touchEl.querySelectorAll('.tb')) {
  const a = b.dataset.a, drag = b.dataset.drag;
  let lx = 0, ly = 0;
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); Snd.init(); touch.last = performance.now();
    touch.btn[a] = true; pressed['T_' + a] = true; b.classList.add('down');
    try { b.setPointerCapture(e.pointerId); } catch (err) { }
    lx = e.clientX; ly = e.clientY;
    if (a === 'pause') onKeyMenu('Escape');
    if (a === 'map') onKeyMenu('KeyM');
  });
  b.addEventListener('pointermove', e => {
    if (!drag || !touch.btn[a]) return;
    mouse.dx += (e.clientX - lx) * 1.4; mouse.dy += (e.clientY - ly) * 1.4; lx = e.clientX; ly = e.clientY; mouse.lastMove = performance.now();
  });
  const up = () => { touch.btn[a] = false; b.classList.remove('down'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
}
const joyBase = document.getElementById('joyBase'), joyKnob = document.getElementById('joyKnob');
const setTouch = on => { touch.on = on; touchEl.classList.toggle('on', on); };
if (matchMedia('(pointer: coarse)').matches) setTouch(true);
/* on phones, Play goes fullscreen and asks for landscape (Android honours it; iOS ignores both, harmlessly) */
document.addEventListener('click', e => {
  if (!touch.on || !e.target || e.target.id !== 'bPlay' || document.fullscreenElement) return;
  const el = document.documentElement;
  try { const r = (el.requestFullscreen || el.webkitRequestFullscreen || function () { }).call(el, { navigationUI: 'hide' }); const lock = () => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (err) { } }; if (r && r.then) r.then(lock, () => { }); else lock(); } catch (err) { }
}, true);
addEventListener('touchstart', () => { touch.last = performance.now(); if (!touch.on) setTouch(true); }, { passive: true });
cvs.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  touch.last = performance.now();
  if (G.mode === 'map') { onKeyMenu('KeyM'); return; }
  if (e.clientX < innerWidth * 0.42 && touch.jid === null) {
    touch.jid = e.pointerId; touch.ox = e.clientX; touch.oy = e.clientY;
    joyBase.style.left = e.clientX + 'px'; joyBase.style.top = e.clientY + 'px'; joyBase.classList.add('on');
  } else if (touch.lid === null) { touch.lid = e.pointerId; touch.lx = e.clientX; touch.ly = e.clientY; }
});
addEventListener('pointermove', e => {
  if (e.pointerId === touch.jid) {
    let dx = e.clientX - touch.ox, dy = e.clientY - touch.oy; const d = Math.hypot(dx, dy), m = Math.max(44, Math.min(70, Math.min(innerWidth, innerHeight) * 0.16));
    if (d > m) { dx *= m / d; dy *= m / d; }
    touch.jx = dx / m; touch.jy = dy / m; joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === touch.lid) {
    mouse.dx += (e.clientX - touch.lx) * 1.6; mouse.dy += (e.clientY - touch.ly) * 1.6; touch.lx = e.clientX; touch.ly = e.clientY; mouse.lastMove = performance.now();
  }
});
const tEnd = e => {
  if (e.pointerId === touch.jid) { touch.jid = null; touch.jx = touch.jy = 0; joyKnob.style.transform = ''; joyBase.classList.remove('on'); joyBase.style.left = joyBase.style.top = ''; }
  if (e.pointerId === touch.lid) touch.lid = null;
};
addEventListener('pointerup', tEnd); addEventListener('pointercancel', tEnd);
/* keep the button set in sync with what the player is doing */
let lastTouchMode = '', lastUse = '';
function syncTouch() {
  if (!touch.on) return;
  const P = G.P, show = G.mode === 'play';
  const mode = !show ? 'hidden' : P && P.car ? 'car' : P && !P.onGround ? 'air' : 'foot';
  if (mode !== lastTouchMode) { touchEl.dataset.mode = mode; lastTouchMode = mode; }
  const use = P && P.car ? '🚪 Get out' : G.prompt ? (G.prompt.includes('Nest') ? '🏠 Enter Nest' : G.prompt.includes('patrol') ? '🚓 Steal it!' : '🚗 Get in') : '';
  if (use !== lastUse) { lastUse = use; useLbl.textContent = use; touchEl.classList.toggle('has-use', !!use); }
}

let pad = null, padPrev = {};
function pollPad() {
  const gp = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(p => p && p.connected);
  if (!gp) { pad = null; return; }
  const dz = v => Math.abs(v) < 0.16 ? 0 : v;
  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const now = { a: b(0), b: b(1), x: b(2), y: b(3), lb: b(4), rb: b(5), lt: b(6), rt: b(7), back: b(8), start: b(9), ls: b(10) };
  pad = { lx: dz(gp.axes[0]), ly: dz(gp.axes[1]), rx: dz(gp.axes[2] || 0), ry: dz(gp.axes[3] || 0), ...now };
  for (const k in now) if (now[k] && !padPrev[k]) { pressed['P_' + k] = true; Snd.init(); }
  if (pressed.P_start) onKeyMenu('Escape');
  if (pressed.P_back) onKeyMenu('KeyM');
  if (pressed.P_a && G.mode !== 'play') onKeyMenu('Enter');
  padPrev = now;
}
function readControls(dt) {
  const c = { mx: 0, mz: 0, fire: false, aim: false, jump: false, jumpHeld: false, dash: false, sprint: false, spin: false, pound: false, use: false, horn: false, radio: false };
  if (keys.KeyA || keys.ArrowLeft) c.mx -= 1; if (keys.KeyD || keys.ArrowRight) c.mx += 1;
  if (keys.KeyW || keys.ArrowUp) c.mz -= 1; if (keys.KeyS || keys.ArrowDown) c.mz += 1;
  if (touch.jid !== null) {
    /* small dead zone so a resting thumb doesn't drift, then rescale so the rest of the travel still reaches 1 */
    const m = Math.hypot(touch.jx, touch.jy);
    if (m > 0.14) { const k = Math.min(1, (m - 0.14) / 0.72) / m; c.mx += touch.jx * k; c.mz += touch.jy * k; }
  }
  if (touch.btn.gas) c.mz -= 1; if (touch.btn.brake) c.mz += 1;
  c.fire = mouse.l || keys.KeyJ || !!touch.btn.fire;
  c.aim = mouse.r;
  c.jump = !!(pressed.Space || pressed.T_jump || pressed.P_a);
  c.jumpHeld = !!(keys.Space || touch.btn.jump || touch.btn.drift || (pad && pad.a));
  c.dash = !!(pressed.ShiftLeft || pressed.ShiftRight || pressed.T_dash || pressed.P_b);
  c.sprint = !!(keys.ShiftLeft || keys.ShiftRight || touch.btn.dash || (touch.jid !== null && Math.hypot(touch.jx, touch.jy) > 0.88) || (pad && (pad.b || pad.ls)));
  c.spin = !!(pressed.KeyQ || pressed.KeyK || pressed.T_spin || pressed.P_x);
  c.pound = !!(pressed.KeyC || pressed.ControlLeft || pressed.T_pound || pressed.P_rb);
  c.use = !!(pressed.KeyF || pressed.KeyE || pressed.T_use || pressed.P_y);
  c.horn = !!(keys.KeyH || touch.btn.horn); c.radio = !!(pressed.KeyR || pressed.P_lb || pressed.T_radio);
  c.auto = !!touch.btn.fire || (!locked && !mouse.l && !!keys.KeyJ);
  if (pad) {
    c.mx += pad.lx; c.mz += pad.ly;
    if (pad.rt) { c.fire = true; c.auto = true; } if (pad.lt) c.aim = true;
    mouse.dx += pad.rx * 520 * dt; mouse.dy += pad.ry * 360 * dt;
    if (Math.abs(pad.rx) + Math.abs(pad.ry) > 0) mouse.lastMove = performance.now();
  }
  const ml = Math.hypot(c.mx, c.mz); if (ml > 1) { c.mx /= ml; c.mz /= ml; }
  return c;
}

/* ================================================================== state */
const G = {
  mode: 'boot', time: 0, timeScale: 1, slowT: 0, hitstop: 0, shake: 0, P: null, city: null,
  peds: [], cars: [], enemies: [], shots: [], eshots: [], bombs: [], pickups: [], fx: [], floats: [], waves: [], timers: [],
  cages: [], orbs: [], eggMeshes: [], combo: { n: 0, t: 0 }, toast: null, banner: null, hurtFlash: 0, pendingLU: 0, luDelay: 0,
  heat: 0, evadeT: 0, seen: false, bigBootT: 12, mission: null, boss: null, arena: null, gangs: [], radio: 0, dayT: 0.32, night: 0,
  cam: { yaw: 0, pitch: 0.32, dist: 6.5 }, prompt: '', district: -1, mapOpen: false, aimPt: null,
  coinsFloat: 0, xpPulse: 0, coinPulse: 0, spawnT: 0, stuntAir: null, objective: '', useNow: false, parkedOut: new Set(),
};
window.__G = G;
const pk = a => Save.d.perks[a] | 0;
const schedule = (t, fn) => G.timers.push({ t, fn });
let MISSIONS = [];

function recalc() {
  const P = G.P, s = Save.d.shop, pu = P.pu;
  const eggs = Save.eggs();
  const st = P.st = {};
  st.maxHp = 10 + 2 * (s.heart | 0) + 2 * pk('heart') + 2 * Math.floor(eggs / 6);
  st.dmgMul = (1 + 0.25 * pk('teeth')) * (1 + 0.12 * (s.claws | 0)) * (pu.rage ? 2 : 1);
  st.fire = pk('fire') > 0;
  st.shotDmg = (st.fire ? 1.6 : 1) * st.dmgMul;
  st.cd = 0.24 / (1 + 0.2 * pk('rapid')) / (pu.sugar ? 1.6 : 1);
  st.shots = 1 + pk('twin') + (pu.triple ? 2 : 0);
  st.speed = 5.8 * (1 + 0.08 * pk('feet')) * (pu.sugar ? 1.3 : 1);
  st.crit = 0.05 + 0.08 * pk('lucky');
  st.pierce = pk('pierce');
  st.shotSpd = 30 * (1 + 0.18 * pk('range'));
  st.range = 34 * (1 + 0.25 * pk('range'));
  st.spinR = 2.0 * (1 + 0.25 * pk('tail'));
  st.spinDmg = 2.4 * (1 + 0.3 * pk('tail')) * st.dmgMul;
  st.mag = 2.2 + 1.2 * pk('magnet') + (pu.magnet ? 60 : 0);
  st.coinMul = (1 + 0.15 * pk('magnet')) * (s.wallet ? 1.25 : 1);
  st.poundR = 3 * (1 + 0.2 * pk('quake'));
  st.jumps = 2 + pk('wings');
  st.carMul = 1 + 0.12 * pk('driver');
  st.dps = st.shotDmg * Math.min(st.shots, 3) / st.cd;
  if (P.hp > st.maxHp) P.hp = st.maxHp;
}

/* ================================================================== helpers */
function floatText(x, y, z, text, color = '#fff', size = 22, life = 0.9) { G.floats.push({ x, y, z, text, color, size, t: 0, life }); }
/* mission and tip text is written for keyboards; on touch screens swap the key names for button names */
function forDevice(s) {
  if (!touch.on || !s) return s;
  return s.replace(/\(hold SHIFT to sprint\)/g, '(push the stick to the edge to sprint)')
    .replace(/SPACE to jump, SPACE again mid-air to double jump/g, 'tap JUMP, then JUMP again mid-air')
    .replace(/SPACE is the handbrake/g, 'DRIFT is the handbrake').replace(/SHIFT dashes/g, 'DASH dashes')
    .replace(/Q spins your tail/g, 'SPIN whips your tail').replace(/C while in the air is a Belly Flop/g, 'FLOP (it appears mid-air) is a Belly Flop')
    .replace(/\(Q\)/g, '(SPIN)').replace(/\(C in the air\)/g, '(FLOP, mid-air)').replace(/\(F\)/g, '(yellow button)')
    .replace(/LEFT CLICK \/ J/g, 'hold PUFF').replace(/press F to borrow it/g, 'tap the yellow button to borrow it');
}
G.forDevice = forDevice;
function toast(text, t = 4) { G.toast = { text: forDevice(text), t }; }
function banner(text, sub = '', t = 1.8, color = '#ffd166') { G.banner = { text, sub, t, max: t, color }; }
function once(key, text) { if (Save.d.seen[key]) return; Save.d.seen[key] = 1; Save.save(); toast(text, 5.5); }
function shake(a) { G.shake = Math.max(G.shake, a); }
function hitstop(t) { G.hitstop = Math.min(0.1, Math.max(G.hitstop, t)); }
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function solidPoint(x, y, z) {
  for (const c of G.city.query(x, z, x, z)) if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && y < c.h) return true;
  return false;
}
/* cars are solid boxes for anything on foot; returns the roof height if you're above one, so you can stand on cars */
function carPush(o, r, y) {
  let top = 0;
  for (const c of G.cars) {
    if (c === G.P.car || c === o) continue;
    const dx = o.x - c.x, dz = o.z - c.z;
    if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    const lz = dx * fx + dz * fz, lx = dx * fz - dz * fx;
    const hl = c.L / 2 + r, hw = (c.kind === 'truck' ? 1.15 : 0.95) + r, roof = c.y + (c.kind === 'truck' ? 2.5 : c.kind === 'van' ? 1.3 : 1.05);
    if (Math.abs(lz) >= hl || Math.abs(lx) >= hw) continue;
    if (y >= roof - 0.45) { top = Math.max(top, roof); continue; }
    if (y + 0.9 < c.y) continue;
    /* push out along the shallower side, in the car's own frame */
    if (hl - Math.abs(lz) < hw - Math.abs(lx)) { const nz = Math.sign(lz) * hl; o.x = c.x + fx * nz + fz * lx; o.z = c.z + fz * nz - fx * lx; }
    else { const nx = Math.sign(lx) * hw; o.x = c.x + fx * lz + fz * nx; o.z = c.z + fz * lz - fx * nx; }
  }
  return top;
}
/* simple obstacle-avoiding steering for walkers */
function steerTo(e, tx, tz) {
  let dx = tx - e.x, dz = tz - e.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  if (e.fly) return [dx, dz];
  const look = Math.min(2, d);
  if (G.city.raycast(e.x, 0.4, e.z, dx, 0, dz, look) < look) {
    for (const a of [0.8, -0.8, 1.6, -1.6]) {
      const ca = Math.cos(a), sa = Math.sin(a), rx = dx * ca - dz * sa, rz = dx * sa + dz * ca;
      if (G.city.raycast(e.x, 0.4, e.z, rx, 0, rz, look) >= look) return [rx, rz];
    }
  }
  return [dx, dz];
}

/* ================================================================== player */
let dragon = null;
function buildPlayer() {
  const mesh = makePlayerModel(dragon, HIDES[Save.d.hide] || HIDES[0]);
  scene.add(mesh);
  const bubble = new THREE.Mesh(GEO.sphere, new THREE.MeshToonMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.28, emissive: 0x67e8f9, emissiveIntensity: 0.4, depthWrite: false }));
  bubble.scale.setScalar(0.95); bubble.position.y = 0.6; bubble.visible = false; mesh.add(bubble);
  const spinRing = new THREE.Mesh(GEO.torus, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
  spinRing.rotation.x = Math.PI / 2; spinRing.visible = false; scene.add(spinRing);
  G.P = {
    x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, kbx: 0, kbz: 0, r: 0.38, hp: 10, face: Math.PI, faceVis: Math.PI, inv: 0, graceT: 0, mesh, bubble, spinRing,
    shootCd: 0, spinCd: 0, spinT: 0, spinHit: new Set(), dashCd: 0, dashT: 0, dashDir: { x: 0, z: 1 }, dashHit: new Set(), jumps: 0, onGround: true,
    pounding: false, poundCd: 0, pu: {}, shield: 0, car: null, dead: false, aimT: 0, walk: 0, megaHit: new Map(), lastSafe: { x: 0, z: 0 }, regenT: 0,
  };
  recalc(); G.P.hp = G.P.st.maxHp;
}
function placePlayer(x, z) {
  const P = G.P;
  if (P.car) exitCar(true);
  Object.assign(P, { x, z, y: G.city.groundAt(x, z, 50), vx: 0, vz: 0, vy: 0, kbx: 0, kbz: 0, dashT: 0, dead: false, inv: 1.5, pounding: false, onGround: true });
  P.lastSafe = { x, z };
  P.mesh.scale.setScalar(1); P.mesh.rotation.set(0, P.face, 0); P.mesh.visible = true;
}

/* where the crosshair points: first thing along the camera ray */
const rayO = new THREE.Vector3(), rayD = new THREE.Vector3(), v2 = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
function computeAim(assist) {
  v2.set(0, 0.12);
  raycaster.setFromCamera(v2, camera);
  rayO.copy(raycaster.ray.origin); rayD.copy(raycaster.ray.direction);
  const P = G.P;
  let best = 80, hitE = null;
  const sphere = (cx, cy, cz, r) => {
    const ox = rayO.x - cx, oy = rayO.y - cy, oz = rayO.z - cz;
    const b = ox * rayD.x + oy * rayD.y + oz * rayD.z, c = ox * ox + oy * oy + oz * oz - r * r, h = b * b - c;
    return h < 0 ? -1 : -b - Math.sqrt(h);
  };
  const targets = [];
  for (const e of G.enemies) if (!e.dead && !e.intangible) targets.push([e, e.x, (e.y || 0) + (e.fly ? 1 : 0.6) * (e.boss ? 2.2 : 1), e.z, e.r + 0.25]);
  for (const p of G.peds) if (p.st !== 'flying') targets.push([p, p.x, p.y + 0.6, p.z, 0.45]);
  for (const c of G.cars) if (c !== P.car && !c.dead) targets.push([c, c.x, c.y + 0.8, c.z, 1.6]);
  for (const g of G.cages) if (!g.dead) targets.push([g, g.x, g.y + 0.6, g.z, 0.6]);
  for (const [o, x, y, z, r] of targets) { const t = sphere(x, y, z, r); if (t > 0.5 && t < best) { best = t; hitE = o; } }
  const tw = G.city.raycast(rayO.x, rayO.y, rayO.z, rayD.x, rayD.y, rayD.z, best);
  if (tw < best) { best = tw; hitE = null; }
  if (rayD.y < -0.01) { const tg = -rayO.y / rayD.y; if (tg > 0 && tg < best) { best = tg; hitE = null; } }
  let px = rayO.x + rayD.x * best, py = rayO.y + rayD.y * best, pz = rayO.z + rayD.z * best;
  /* aim assist: nudge onto hostile things close to the crosshair */
  if (!hitE || hitE.def === undefined) {
    let bestA = touch.on ? 0.5 : assist ? 0.16 : 0.05, snap = null;
    for (const e of G.enemies) {
      if (e.dead || e.intangible || (!e.aggro && !e.boss && !e.mission)) continue;
      const ey = (e.y || 0) + (e.fly ? 1 : 0.6) * (e.boss ? 2.2 : 1);
      const vx = e.x - rayO.x, vy = ey - rayO.y, vz = e.z - rayO.z, l = Math.hypot(vx, vy, vz);
      if (l > (touch.on ? 38 : 45)) continue;
      const a = Math.acos(clamp((vx * rayD.x + vy * rayD.y + vz * rayD.z) / l, -1, 1));
      if (a < bestA && G.city.los(P.x, P.z, e.x, e.z, 0.9)) { bestA = a; snap = [e.x, ey, e.z]; }
    }
    if (snap) [px, py, pz] = snap;
  }
  G.aimPt = { x: px, y: py, z: pz };
  return G.aimPt;
}

function updateFoot(dt, c) {
  const P = G.P, st = P.st, city = G.city;
  P.inv = Math.max(0, P.inv - dt); P.graceT -= dt; P.shootCd -= dt; P.spinCd -= dt; P.dashCd -= dt; P.poundCd -= dt; P.aimT -= dt;
  const yaw = G.cam.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let wx = fx * -c.mz + rx * c.mx, wz = fz * -c.mz + rz * c.mx;
  const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  const aiming = c.aim;
  if (c.dash && P.dashCd <= 0) {
    let dx = wx, dz = wz; if (!dx && !dz) { dx = Math.sin(P.face); dz = Math.cos(P.face); }
    const l = Math.hypot(dx, dz) || 1; P.dashDir = { x: dx / l, z: dz / l };
    P.dashT = 0.18; P.dashCd = 0.55; P.graceT = 0.32; P.dashHit.clear();
    if (!P.onGround) P.vy = Math.max(P.vy, 2);
    Snd.play('dash'); burst(P.x, P.y + 0.4, P.z, 8, 0xffffff, 3, 0.4, 0.3, 0, 0.5);
  }
  if (c.spin && P.spinCd <= 0) doSpin();
  /* forgiving jump: a press a hair before landing still counts, and so does one a hair after running off a ledge */
  P.jbuf = c.jump ? 0.13 : Math.max(0, (P.jbuf || 0) - dt);
  P.coyote = P.onGround ? 0.11 : Math.max(0, (P.coyote || 0) - dt);
  if (P.jbuf > 0) {
    if (P.onGround || (P.coyote > 0 && !P.pounding)) { P.jbuf = 0; P.coyote = 0; P.vy = 10.5; P.onGround = false; P.jumps = 1; Snd.play('dash'); burst(P.x, P.y + 0.1, P.z, 6, 0xffffff, 2, 0.3, 0.25, 2, 0.5); }
    else if (c.jump && P.jumps < st.jumps) { P.jbuf = 0; P.vy = 9.5; P.jumps++; Snd.play('spin'); ringBurst(P.x, P.y, P.z, 1.2, 12, 0xfde68a, 0.25); }
  }
  if (c.pound && !P.onGround && !P.pounding && P.poundCd <= 0) { P.pounding = true; P.vy = -26; P.dashT = 0; Snd.play('dash'); }

  const speed = st.speed * (c.sprint && !aiming ? 1.55 : 1) * (aiming ? 0.6 : 1);
  if (P.dashT > 0) {
    P.dashT -= dt;
    P.vx = P.dashDir.x * 19; P.vz = P.dashDir.z * 19;
    emit(P.x, P.y + 0.5, P.z, 0, 0.5, 0, 0.3, 0xffffff, 0.45);
    if (P.dashT <= 0) { P.vx *= 0.4; P.vz *= 0.4; }
  } else {
    const k = 1 - Math.exp(-(P.onGround ? 14 : 4) * dt);
    P.vx = lerp(P.vx, wx * speed, k); P.vz = lerp(P.vz, wz * speed, k);
  }
  P.kbx *= Math.exp(-8 * dt); P.kbz *= Math.exp(-8 * dt);
  if (P.dashT > 0 && !P.onGround) P.vy = Math.max(P.vy - 10 * dt, 0);
  else P.vy -= 28 * dt;
  const ox = P.x, oz = P.z;
  P.x += (P.vx + P.kbx) * dt; P.z += (P.vz + P.kbz) * dt;
  city.collide(P, P.r, P.y, true);
  const prevY = P.y;
  P.y += P.vy * dt;
  const gnd = Math.max(city.groundAt(P.x, P.z, Math.max(P.y, prevY), P.r, true), carPush(P, P.r, Math.max(P.y, prevY)));
  if (P.y <= gnd) {
    if (!P.onGround) {
      if (P.pounding) { P.pounding = false; P.y = gnd; poundImpact(); }
      else if (P.vy < -14) { shake(0.12); burst(P.x, gnd + 0.05, P.z, 8, 0xddd8cc, 2.5, 0.4, 0.3, 4, 0.5); }
    }
    P.y = gnd; P.vy = 0; P.onGround = true; P.jumps = 0;
  } else if (P.onGround) {
    if (P.y - gnd > 0.25 && P.vy <= 0) { P.onGround = false; P.jumps = 1; }
    else if (P.vy <= 0) { P.y = gnd; P.vy = 0; }
  }
  if (P.pounding) emit(P.x, P.y + 0.5, P.z, 0, 2, 0, 0.3, 0xf472b6, 0.4);
  const moved = Math.hypot(P.x - ox, P.z - oz) / Math.max(dt, 1e-4);

  if (moved > 2) city.kick(P.x, P.z, P.dashT > 0 ? 1 : 0.8, P.vx * 0.6, P.vz * 0.6, P.dashT > 0 ? 1.5 : 0.6, P.dashT <= 0);
  /* shooting */
  if (c.fire && P.shootCd <= 0) {
    const a = computeAim(c.auto || !!pad || touch.on);
    const mx0 = P.x + Math.sin(P.face) * 0.35, my0 = P.y + 0.95, mz0 = P.z + Math.cos(P.face) * 0.35;
    let dx = a.x - mx0, dy = a.y - my0, dz = a.z - mz0; const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    shoot(mx0, my0, mz0, dx, dy, dz);
    P.shootCd = st.cd; P.aimT = 0.5;
    P.face = Math.atan2(dx, dz);
    alarmPeds(P.x, P.z, 16);
  }
  if (aiming || P.aimT > 0) P.face = Math.atan2(fx, fz);
  else if (Math.hypot(P.vx, P.vz) > 0.6) P.face = Math.atan2(P.vx, P.vz);

  /* tail spin */
  if (P.spinT > 0) {
    P.spinT -= dt;
    const R = st.spinR;
    for (const e of G.enemies) {
      if (e.dead || P.spinHit.has(e)) continue;
      if (Math.hypot(e.x - P.x, e.z - P.z) < R + e.r && Math.abs((e.y || 0) - P.y) < 2.5) { P.spinHit.add(e); hurtEnemy(e, st.spinDmg, { x: P.x, z: P.z, kind: 'spin', kb: 9 }); }
    }
    for (const p of G.peds) if (!P.spinHit.has(p) && Math.hypot(p.x - P.x, p.z - P.z) < R) { P.spinHit.add(p); knockPed(p, P.x, P.z, 6, true); }
    for (const g of G.cages) if (!g.dead && !P.spinHit.has(g) && Math.hypot(g.x - P.x, g.z - P.z) < R + 0.5) { P.spinHit.add(g); hitCage(g); }
    for (const s of G.eshots) if (!s.refl && Math.hypot(s.x - P.x, s.z - P.z) < R + 0.5) reflectShot(s);
    city.kick(P.x, P.z, R, 0, 0, 1.2);
    P.spinRing.visible = true; P.spinRing.position.set(P.x, P.y + 0.5, P.z);
    const u = 1 - P.spinT / 0.28; P.spinRing.scale.setScalar(R * (0.4 + u * 0.6)); P.spinRing.material.opacity = 0.75 * (1 - u);
  } else P.spinRing.visible = false;

  if (P.dashT > 0 && pk('dashstrike')) for (const e of G.enemies) {
    if (e.dead || P.dashHit.has(e)) continue;
    if (Math.hypot(e.x - P.x, e.z - P.z) < e.r + P.r + 0.3) { P.dashHit.add(e); hurtEnemy(e, 2 * pk('dashstrike') * st.dmgMul, { x: P.x, z: P.z, kind: 'dash', kb: 8 }); }
  }
  if (P.pu.mega) for (const e of G.enemies) {
    if (e.dead || Math.hypot(e.x - P.x, e.z - P.z) > e.r + P.r * 1.9) continue;
    const last = P.megaHit.get(e) || 0;
    if (G.time - last > 0.35) { P.megaHit.set(e, G.time); hurtEnemy(e, 4 * st.dmgMul, { x: P.x, z: P.z, kind: 'mega', kb: 12 }); }
  }
  for (const p of G.peds) {
    if (p.st === 'flying') continue;
    const d = Math.hypot(p.x - P.x, p.z - P.z);
    if (d < 0.8 && d > 0.01 && Math.abs(p.y - P.y) < 1) {
      if (P.dashT > 0 || P.pu.mega) knockPed(p, P.x, P.z, 7, true);
      else { p.x += (p.x - P.x) / d * (0.8 - d); p.z += (p.z - P.z) / d * (0.8 - d); if (p.st === 'walk' && Math.random() < 0.02) emote(p, ['😠', '😮', '💢'][(Math.random() * 3) | 0]); }
    }
  }
  if (P.y < -5) { P.x = P.lastSafe.x; P.z = P.lastSafe.z; P.y = 2; P.vy = 0; }
  if (P.onGround) { P.lastSafe.x = P.x; P.lastSafe.z = P.z; }

  const mesh = P.mesh, ud = mesh.userData;
  P.faceVis += angDiff(P.face, P.faceVis) * (1 - Math.exp(-16 * dt));
  const speedFrac = clamp(moved / 6, 0, 1.6);
  P.walk += dt * (2 + speedFrac * 10);
  mesh.scale.setScalar(lerp(mesh.scale.x, P.pu.mega ? 1.9 : 1, 1 - Math.exp(-8 * dt)));
  mesh.position.set(P.x, P.y + (P.onGround && speedFrac > 0.1 ? Math.abs(Math.sin(P.walk)) * 0.06 : 0), P.z);
  mesh.rotation.y = P.faceVis + (P.spinT > 0 ? (1 - P.spinT / 0.28) * Math.PI * 2 : 0);
  mesh.rotation.x = P.dashT > 0 ? 0.35 : !P.onGround ? clamp(-P.vy * 0.02, -0.3, 0.3) : 0;
  if (ud.mixer) {
    ud.walk.setEffectiveWeight(P.onGround ? clamp(speedFrac * 1.5, 0, 1) : 0.4);
    ud.walk.timeScale = P.onGround ? 0.6 + speedFrac * 1.4 : 2.5;
    ud.mixer.update(dt);
  }
  mesh.visible = P.inv <= 0 || Math.floor(P.inv * 16) % 2 === 0;
  P.bubble.visible = P.shield > 0;
}
const MAT = {
  puff: new THREE.MeshBasicMaterial({ color: 0xfff6d6 }),
  fire: new THREE.MeshBasicMaterial({ color: 0xffa040 }),
  eshot: new THREE.MeshBasicMaterial({ color: 0xff3b8b }),
  orb: new THREE.MeshBasicMaterial({ color: 0xc084fc }),
  refl: new THREE.MeshBasicMaterial({ color: 0x67e8f9 }),
};
function shoot(x, y, z, dx, dy, dz) {
  const st = G.P.st, fire = st.fire;
  const n = st.shots, spread = n > 3 ? 0.07 : 0.1;
  const base = Math.atan2(dx, dz), hl = Math.hypot(dx, dz);
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * spread;
    const m = new THREE.Mesh(GEO.lowSphere, fire ? MAT.fire : MAT.puff);
    const crit = Math.random() < st.crit;
    m.scale.setScalar((fire ? 0.2 : 0.16) * (crit ? 1.35 : 1));
    m.position.set(x, y, z);
    scene.add(m);
    G.shots.push({ x, y, z, vx: Math.sin(a) * hl * st.shotSpd, vy: dy * st.shotSpd, vz: Math.cos(a) * hl * st.shotSpd, dmg: st.shotDmg * (crit ? 2.5 : 1), crit,
      life: st.range / st.shotSpd, pierce: st.pierce, fire, hit: new Set(), mesh: m, r: 0.22 });
  }
  Snd.play(fire ? 'fire' : 'shoot');
  burst(x + dx * 0.3, y, z + dz * 0.3, 3, fire ? 0xffa040 : 0xffffff, 2, 0.2, 0.2, 0, 0.2);
}
function doSpin() {
  const P = G.P;
  P.spinT = 0.28; P.spinCd = 0.6; P.spinHit.clear();
  Snd.play('spin'); ringBurst(P.x, P.y, P.z, P.st.spinR, 16, 0xffffff, 0.25);
}
function reflectShot(s) {
  s.refl = true; s.mesh.material = MAT.refl;
  let t = null, bd = 30;
  for (const e of G.enemies) if (!e.dead && (e.aggro || e.boss || e.mission)) { const d = dist2(e, s); if (d < bd) { bd = d; t = e; } }
  const sp = Math.hypot(s.vx, s.vz) * 1.5 + 3;
  if (t) { const dx = t.x - s.x, dz = t.z - s.z, d = Math.hypot(dx, dz) || 1; s.vx = dx / d * sp; s.vz = dz / d * sp; }
  else { s.vx = -s.vx * 1.5; s.vz = -s.vz * 1.5; }
  s.life = 2; s.homing = 0;
  Snd.play('reflect'); burst(s.x, s.y, s.z, 6, 0x67e8f9, 3, 0.3, 0.2, 0);
}
function poundImpact() {
  const P = G.P, R = P.st.poundR;
  P.poundCd = 0.6;
  Snd.play('stomp'); shake(0.5); hitstop(0.05);
  ringBurst(P.x, P.y, P.z, R, 28, 0xf472b6, 0.35);
  burst(P.x, P.y + 0.2, P.z, 18, [0xd8d0c8, 0xb08a6a], 5, 0.7, 0.3, 10, 2);
  addShock(P.x, P.y, P.z, R, 0xf472b6);
  for (const e of G.enemies) {
    if (e.dead || Math.hypot(e.x - P.x, e.z - P.z) > R + e.r) continue;
    hurtEnemy(e, 3.5 * P.st.dmgMul, { x: P.x, z: P.z, kind: 'pound', kb: 10, shieldBreak: true }); if (!e.boss) e.stun = Math.max(e.stun, 1.3);
  }
  for (const p of G.peds) if (Math.hypot(p.x - P.x, p.z - P.z) < R) knockPed(p, P.x, P.z, 8, true);
  for (const g of G.cages) if (!g.dead && Math.hypot(g.x - P.x, g.z - P.z) < R) { g.hp = 1; hitCage(g); }
  for (const c of G.cars) if (!c.dead && Math.hypot(c.x - P.x, c.z - P.z) < R + 1) { damageCar(c, 15, true); c.vy = 4; c.air = true; }
  G.city.kick(P.x, P.z, R, 0, 0, 2.5);
  for (const s of G.eshots) if (Math.hypot(s.x - P.x, s.z - P.z) < R) s.life = 0;
}
function hurtPlayer(dmg, src, force = false) {
  const P = G.P;
  if (P.dead || G.mode !== 'play') return;
  if (!force) {
    if (P.inv > 0 || P.dashT > 0 || P.graceT > 0 || P.pu.mega) return;
    if (P.shield > 0) {
      P.shield--; P.inv = 0.9; Snd.play('shield'); burst(P.x, P.y + 0.6, P.z, 16, 0x67e8f9, 4, 0.5, 0.3, 0);
      floatText(P.x, P.y + 1.7, P.z, P.shield ? 'BLOCKED' : 'POP!', '#67e8f9', 18); return;
    }
    if (Math.random() < 0.12 * pk('thick')) { P.inv = 0.5; floatText(P.x, P.y + 1.7, P.z, 'SHRUGGED', '#c4b5fd', 18); Snd.play('ping'); return; }
  }
  P.hp -= dmg; P.regenT = 6;
  P.inv = 1.0; G.hurtFlash = 0.45; shake(0.35); hitstop(0.06); Snd.play('hurt');
  burst(P.x, P.y + 0.6, P.z, 14, 0xff5d8f, 4, 0.5, 0.3, 6);
  if (src && !P.car) { const dx = P.x - src.x, dz = P.z - src.z, d = Math.hypot(dx, dz) || 1; P.kbx = dx / d * 9; P.kbz = dz / d * 9; }
  G.combo.n = 0; G.combo.t = 0;
  if (P.hp <= 0) {
    if ((Save.d.shop.fairy | 0) > 0) {
      Save.d.shop.fairy--; Save.save(); P.hp = P.st.maxHp; P.inv = 2.5;
      banner('FAIRY REVIVE!', 'Your fairy jar shatters', 2, '#f9a8d4'); Snd.play('heal');
      burst(P.x, P.y + 1, P.z, 50, [0xf9a8d4, 0xffffff, 0xfde68a], 5, 1.2, 0.35, -1, 3);
    } else die();
  }
}
function die() {
  const P = G.P;
  if (P.car) exitCar(true);
  P.dead = true; G.mode = 'dying'; G.dieT = 1.4;
  Snd.play('hurt'); Snd.play('fall'); shake(0.6);
  burst(P.x, P.y + 0.6, P.z, 40, [0xff5d8f, 0xffffff], 5, 0.9, 0.4, 6, 3);
}
function respawn() {
  const P = G.P;
  const n = nearestNest(P.x, P.z);
  const lost = Math.floor(Save.d.coins * 0.1);
  Save.d.coins -= lost; Save.save();
  if (G.mission) failMission('', true);
  clearHeat(true);
  P.face = P.faceVis = 0;
  placePlayer(n.x, n.z + 3);
  P.hp = P.st.maxHp; P.inv = 2;
  if (Save.d.shop.charm) P.shield = 2;
  G.cam.yaw = Math.PI;
  G.mode = 'play';
  if (lost) toast(`The Nest nurses patched you up. Fee: ${lost} coins.`, 4);
}
function nearestNest(x, z) {
  let best = G.city.nests[0], bd = 1e9;
  for (const n of G.city.nests) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
  return best;
}

/* ================================================================== cars */
function spawnCar(kind, color, x, z, h, driver = 'npc') {
  const mesh = makeCar(kind, color);
  scene.add(mesh);
  const c = { kind, color, x, z, y: 0, vy: 0, h, vx: 0, vz: 0, steer: 0, speed: 0, hp: kind === 'truck' ? 220 : kind === 'police' ? 90 : 100, mesh, driver, ai: null,
    air: false, airT: 0, dead: false, burnT: 0, honkT: 0, stuckT: 0, npc: null, smokeT: 0, prevVy: 0, L: mesh.userData.L, r: kind === 'truck' ? 1.25 : 1.0 };
  c.maxHp = c.hp;
  if (driver === 'npc' || driver === 'cop') {
    const pm = driver === 'cop' ? makePatrolBoot(0.32) : makePed((Math.random() * 24) | 0);
    if (driver !== 'cop') pm.scale.setScalar(0.85);
    mesh.userData.seat.add(pm); c.npc = pm;
  }
  G.cars.push(c);
  return c;
}
function carFwd(c) { return [Math.sin(c.h), Math.cos(c.h)]; }
function driveCar(c, throttle, steerIn, brake, dt) {
  const [fx, fz] = carFwd(c);
  let fs = c.vx * fx + c.vz * fz;
  const isP = c === G.P.car;
  const maxF = (c.kind === 'truck' ? 22 : c.kind === 'sport' ? 34 : c.kind === 'police' ? 30 : 28) * (isP ? G.P.st.carMul : 1);
  if (!c.air) {
    if (throttle > 0) fs = Math.min(maxF, fs + throttle * (fs < 0 ? 30 : 16) * dt);
    else if (throttle < 0) { if (fs > 0.5) fs -= 34 * dt; else fs = Math.max(-9, fs - 12 * dt); }
    else fs *= Math.exp(-0.6 * dt);
    if (brake) fs *= Math.exp(-1.2 * dt);
    c.steer = lerp(c.steer, steerIn, 1 - Math.exp(-8 * dt));
    const turn = c.steer * clamp(fs / 7, -1, 1) * 2.1 * (brake ? 1.5 : 1) * (1 - Math.min(0.45, Math.abs(fs) / 70));
    c.h -= turn * dt;
    const [nfx, nfz] = carFwd(c);
    const along = c.vx * fx + c.vz * fz;
    const latX = c.vx - fx * along, latZ = c.vz - fz * along;
    const grip = Math.exp(-(brake ? 1.4 : 9) * dt);
    c.vx = nfx * fs + latX * grip; c.vz = nfz * fs + latZ * grip;
    if (brake && Math.abs(fs) > 8 && Math.hypot(latX, latZ) > 2) {
      for (const s of [-1, 1]) emit(c.x - nfx * c.L * 0.4 + nfz * 0.8 * s, 0.2, c.z - nfz * c.L * 0.4 - nfx * 0.8 * s, 0, 0.8, 0, 0.6, 0xdddddd, 0.6, -0.5);
    }
  }
  c.speed = fs;
}
function physCar(c, dt) {
  const city = G.city;
  c.x += c.vx * dt; c.z += c.vz * dt;
  const [fx, fz] = carFwd(c);
  let impact = 0;
  for (const k of [-0.32, 0, 0.32]) {
    const ox = c.x + fx * c.L * k, oz = c.z + fz * c.L * k;
    const o = { x: ox, z: oz };
    const h = city.collide(o, c.r, c.y);
    if (h) {
      c.x += o.x - ox; c.z += o.z - oz;
      const l = Math.hypot(h.nx, h.nz) || 1, nx = h.nx / l, nz = h.nz / l, vn = c.vx * nx + c.vz * nz;
      if (vn < 0) { c.vx -= nx * vn * 1.3; c.vz -= nz * vn * 1.3; impact = Math.max(impact, -vn); }
    }
  }
  if (impact > 6 && !c.dead) {
    damageCar(c, (impact - 5) * 2.2);
    if (c === G.P.car) { shake(Math.min(0.8, impact * 0.04)); Snd.play('crumble'); }
    burst(c.x + fx * c.L * 0.5, 0.6, c.z + fz * c.L * 0.5, Math.min(20, impact | 0), [0xffd166, 0xffffff, 0x888888], 4, 0.4, 0.25, 6);
  }
  const sp = Math.hypot(c.vx, c.vz);
  if (sp > 3) city.kick(c.x + fx * c.L * 0.4, c.z + fz * c.L * 0.4, c.r + 0.6, c.vx, c.vz, 1.4);
  /* ground, ramps and air */
  const g = city.groundAt(c.x, c.z, c.y + 0.2, 0.6);
  if (!c.air) {
    if (g < c.y - 0.25) {
      c.air = true; c.airT = 0; c.vy = Math.max(0, c.prevVy || 0) * 1.6 + 1;
      if (c === G.P.car && c.lastRamp) G.stuntAir = { ramp: c.lastRamp, x: c.x, z: c.z };
    } else { c.prevVy = (g - c.y) / Math.max(dt, 1e-3); c.y = g; }
    const rp = city.rampAt(c.x, c.z); if (rp) c.lastRamp = rp; else if (g === 0) c.lastRamp = null;
  }
  if (c.air) {
    c.airT += dt; c.vy -= 24 * dt; c.y += c.vy * dt;
    if (c.y <= g) {
      if (c.vy < -8) { if (c === G.P.car) { shake(0.4); Snd.play('stomp'); } burst(c.x, 0.2, c.z, 16, 0xdddddd, 4, 0.5, 0.45, 4, 1); damageCar(c, Math.max(0, -c.vy - 14)); }
      c.y = g; c.vy = 0; c.air = false; c.prevVy = 0;
      if (c === G.P.car && G.stuntAir) landStunt(c);
    }
  }
  /* car vs car */
  for (const o of G.cars) {
    if (o === c || o.dead) continue;
    const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r + o.r + 0.7;
    if (d >= m || d < 1e-3 || Math.abs(o.y - c.y) > 1.5) continue;
    const nx = dx / d, nz = dz / d, push = (m - d) / 2;
    c.x -= nx * push; c.z -= nz * push; o.x += nx * push; o.z += nz * push;
    const rv = (c.vx - o.vx) * nx + (c.vz - o.vz) * nz;
    if (rv > 0) {
      const j = rv * 0.6;
      c.vx -= nx * j; c.vz -= nz * j; o.vx += nx * j; o.vz += nz * j;
      if (rv > 5) {
        damageCar(c, rv * 1.6); damageCar(o, rv * 2);
        if (c === G.P.car || o === G.P.car) { shake(Math.min(0.7, rv * 0.04)); Snd.play('crumble'); const other = c === G.P.car ? o : c; if (other.driver === 'npc') addHeat(0.25); if (other.driver === 'cop') addHeat(0.3); }
        burst((c.x + o.x) / 2, 0.8, (c.z + o.z) / 2, 12, [0xffd166, 0xffffff], 4, 0.4, 0.25, 6);
        if (o.driver === 'npc' && Math.random() < 0.5) emoteAt(o, ['💢', '😡', '🤬'][(Math.random() * 3) | 0]);
      }
    }
  }
  /* car vs peds / enemies / player */
  if (sp > 3) {
    for (const p of G.peds) {
      if (p.st === 'flying') continue;
      if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.9 && Math.abs(p.y - c.y) < 1.5) {
        knockPed(p, c.x - c.vx, c.z - c.vz, 5 + sp * 0.5, c === G.P.car);
        p.vx += c.vx * 0.6; p.vz += c.vz * 0.6;
        if (c === G.P.car) { addHeat(0.3); Save.d.stats.peds++; }
      }
    }
    for (const e of G.enemies) {
      if (e.dead || e.boss) continue;
      if (Math.hypot(e.x - c.x, e.z - c.z) < c.r + e.r + 0.4 && (e.hitByCar || 0) < G.time) {
        e.hitByCar = G.time + 0.5;
        hurtEnemy(e, sp * 0.5, { x: c.x - c.vx, z: c.z - c.vz, kind: 'car', kb: 12 });
      }
    }
    const P = G.P;
    if (c !== P.car && !P.car && !P.dead && Math.hypot(P.x - c.x, P.z - c.z) < c.r + 0.6 && Math.abs(P.y - c.y) < 1.2) {
      hurtPlayer(sp > 15 ? 4 : 2, { x: c.x - c.vx, z: c.z - c.vz });
      if (P.inv > 0.9) { P.vy = 6; P.onGround = false; }
    }
  }
  /* visuals */
  const ud = c.mesh.userData;
  c.mesh.position.set(c.x, c.y, c.z);
  c.mesh.rotation.y = c.h;
  const rp = !c.air && city.rampAt(c.x, c.z);
  let pitch = 0;
  if (c.air) pitch = clamp(-c.vy * 0.03, -0.4, 0.4);
  else if (rp) { const dir = Math.atan2(rp.dx, rp.dz); pitch = -0.28 * Math.cos(c.h - dir); }
  ud.body.rotation.x = lerp(ud.body.rotation.x, pitch, 1 - Math.exp(-10 * dt));
  ud.body.rotation.z = lerp(ud.body.rotation.z, clamp(-c.steer * c.speed * 0.008, -0.12, 0.12), 1 - Math.exp(-6 * dt));
  for (let i = 0; i < 4; i++) { ud.wheels[i].children[0].rotation.x += c.speed * dt / 0.4; if (i < 2) ud.wheels[i].rotation.y = c.steer * 0.5; }
  ud.lights.material.opacity = c.dead ? 0 : G.night * 0.9;
  if (c.hp < c.maxHp * 0.35 && !c.dead) { c.smokeT -= dt; if (c.smokeT <= 0) { c.smokeT = 0.08; emit(c.x + fx * c.L * 0.4, c.y + 1, c.z + fz * c.L * 0.4, (Math.random() - 0.5), 2, (Math.random() - 0.5), 1, c.hp < c.maxHp * 0.15 ? 0x333333 : 0x999999, 0.7, -1); } }
  if (c.burnT > 0) {
    c.burnT -= dt;
    emit(c.x + (Math.random() - 0.5) * 1.5, c.y + 1, c.z + (Math.random() - 0.5) * 1.5, 0, 3, 0, 0.6, Math.random() < 0.5 ? 0xff7a2a : 0xffd166, 0.6, -2);
    if (c.burnT <= 0) explodeCar(c);
  }
}
function damageCar(c, dmg, byPlayer = false) {
  if (c.dead || dmg <= 0) return;
  if (c === G.P.car) dmg *= (Save.d.shop.armor ? 0.5 : 1) / G.P.st.carMul;
  c.hp -= dmg;
  if (byPlayer && c.driver === 'npc') addHeat(0.2);
  if (byPlayer && c.driver === 'cop') addHeat(0.35);
  if (c.hp <= 0 && c.burnT <= 0) {
    c.burnT = c === G.P.car ? 2.5 : 1.6;
    if (c === G.P.car) toast('Your car is on fire! Get out (F)!', 2.5);
    if (c.driver === 'npc' && c.npc) ejectDriver(c);
  }
}
const CHAR = M(0x2a2a30);
function explodeCar(c) {
  if (c.dead) return;
  c.dead = true;
  const P = G.P;
  Snd.play('boom'); shake(Math.hypot(c.x - P.x, c.z - P.z) < 20 ? 0.7 : 0.2);
  burst(c.x, c.y + 1, c.z, 50, [0xff7a2a, 0xffd166, 0x555566, 0xffffff], 9, 0.9, 0.6, 4, 6);
  ringBurst(c.x, c.y, c.z, 4, 24, 0xffd166, 0.4);
  if (P.car === c) { exitCar(true); hurtPlayer(3, c, true); P.vy = 9; P.onGround = false; }
  else if (Math.hypot(P.x - c.x, P.z - c.z) < 4.5) hurtPlayer(3, c);
  for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - c.x, e.z - c.z) < 4.5) hurtEnemy(e, 8, { x: c.x, z: c.z, kind: 'boom', kb: 12 });
  for (const p of G.peds) if (Math.hypot(p.x - c.x, p.z - c.z) < 5) knockPed(p, c.x, c.z, 9, false);
  for (const o of G.cars) if (o !== c && !o.dead && Math.hypot(o.x - c.x, o.z - c.z) < 4.5) damageCar(o, 40);
  G.city.kick(c.x, c.z, 5, 0, 0, 3);
  if (c.driver === 'cop') addHeat(0.6);
  if (c.mission === 'truck' && G.mission) failMission('The truck was destroyed!');
  c.mesh.userData.body.children[0].material = CHAR;
  if (c.npc) { c.mesh.userData.seat.remove(c.npc); c.npc = null; }
  c.driver = null; c.vx *= 0.3; c.vz *= 0.3; c.vy = 6; c.air = true;
  schedule(25, () => { c.remove = true; });
}
function ejectDriver(c) {
  if (!c.npc) return;
  c.mesh.userData.seat.remove(c.npc); c.npc = null;
  const [fx, fz] = carFwd(c);
  if (c.driver === 'cop') {
    const e = spawnEnemy('patrol', c.x - fz * 2, c.z + fx * 2, { aggro: true, patrol: true }); e.spawnT = 0; e.mesh.scale.setScalar(e.baseScale);
  } else {
    const p = spawnPed(c.x - fz * 2, c.z + fx * 2);
    p.st = 'flee'; p.t = 5; p.fx = G.P.x; p.fz = G.P.z; emote(p, '😱');
  }
  c.driver = null;
}
function enterCar(c) {
  const P = G.P;
  if (c.driver === 'npc' || c.driver === 'cop') {
    const wasCop = c.driver === 'cop';
    ejectDriver(c); addHeat(wasCop ? 1 : 0.4);
    Snd.play('cage'); floatText(c.x, 2.4, c.z, 'HEY! MY CAR!', '#ffd166', 18);
  }
  c.driver = 'player'; c.ai = null;
  P.car = c;
  c.mesh.userData.seat.add(P.mesh);
  P.mesh.position.set(0, 0, 0); P.mesh.rotation.set(0, 0, 0); P.mesh.scale.setScalar(0.85);
  const ud = P.mesh.userData; if (ud.mixer) { ud.walk.setEffectiveWeight(0); ud.mixer.update(0); }
  P.mesh.visible = true;
  Snd.play('door');
  G.cam.yaw = c.h + Math.PI;
  const st = RADIO[G.radio];
  toast(`📻 ${st.name}  (R to change station)`, 2.5);
  Snd.music(st.song);
  once('carTip', touch.on ? 'GAS and BRAKE to drive, the stick steers, DRIFT for slides, PUFF still works. Orange ramps = stunt jumps!' : 'W/S drive, A/D steer, SPACE handbrake (drift!), CLICK to puff, F to get out. Orange ramps = stunt jumps!');
}
function exitCar(force = false) {
  const P = G.P, c = P.car; if (!c) return;
  if (!force && Math.hypot(c.vx, c.vz) > 14) { toast('Too fast to jump out!', 1.2); return; }
  P.car = null; if (!c.dead) c.driver = null;
  c.mesh.userData.seat.remove(P.mesh); scene.add(P.mesh); P.mesh.scale.setScalar(1);
  const [fx, fz] = carFwd(c);
  const o = { x: c.x - fz * 2, z: c.z + fx * 2 }; G.city.collide(o, P.r, 0, true);
  P.x = o.x; P.z = o.z; P.y = Math.max(c.y, G.city.groundAt(P.x, P.z, c.y + 1)); P.vx = c.vx * 0.5; P.vz = c.vz * 0.5; P.vy = 3; P.onGround = false;
  P.face = c.h;
  Snd.play('door');
  if (!G.boss) Snd.music(DISTRICTS[districtOf(P.x, P.z)].song);
}

/* ------------------------------------------------------------------ traffic AI */
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function npcDrive(c, dt) {
  const a = c.ai;
  const [dx, dz] = a.dir;
  const nodeX = roadC(a.ti), nodeZ = roadC(a.tj);
  const prog = dx ? (c.x - nodeX) * dx : (c.z - nodeZ) * dz;
  if (prog > -6) {
    const opts = DIRS.filter(([ex, ez]) => !(ex === -dx && ez === -dz) && a.ti + ex >= 0 && a.ti + ex <= NB && a.tj + ez >= 0 && a.tj + ez <= NB);
    const straight = opts.find(o => o[0] === dx && o[1] === dz);
    const nd = straight && Math.random() < 0.55 ? straight : opts[(Math.random() * opts.length) | 0];
    a.i = a.ti; a.j = a.tj; a.dir = nd; a.ti += nd[0]; a.tj += nd[1];
  }
  const [ndx, ndz] = a.dir;
  const tx = ndx ? c.x + ndx * 7 : roadC(a.i) - ndz * LANE, tz = ndx ? roadC(a.j) + ndx * LANE : c.z + ndz * 7;
  const want = Math.atan2(tx - c.x, tz - c.z), da = angDiff(want, c.h);
  let target = Math.abs(da) > 0.4 ? 6 : (c.cruise || 11);
  const [fx, fz] = carFwd(c);
  const blocked = (o) => { const rx = o.x - c.x, rz = o.z - c.z, f = rx * fx + rz * fz, l = Math.abs(rx * fz - rz * fx); return f > 0 && f < 8 && l < 1.8; };
  let block = null;
  for (const o of G.cars) if (o !== c && !o.dead && blocked(o)) { block = o; break; }
  if (!block) for (const p of G.peds) if (p.st !== 'flying' && blocked(p)) { block = p; break; }
  if (!block && !G.P.car && blocked(G.P)) block = G.P;
  if (block) {
    target = 0; c.honkT += dt;
    if (c.honkT > 1.2 && (block === G.P || block === G.P.car)) { c.honkT = -2; Snd.play('deny'); emoteAt(c, '📯'); }
  } else c.honkT = Math.max(0, c.honkT - dt);
  driveCar(c, c.speed < target - 0.5 ? 0.7 : c.speed > target + 1 ? -1 : 0, clamp(-da * 2.2, -1, 1), false, dt);
}
function copDrive(c, dt) {
  const P = G.P, tx = P.car ? P.car.x : P.x, tz = P.car ? P.car.z : P.z;
  const d = Math.hypot(tx - c.x, tz - c.z);
  const da = angDiff(Math.atan2(tx - c.x, tz - c.z), c.h);
  if (c.reverseT > 0) { c.reverseT -= dt; driveCar(c, -1, clamp(da * 2, -1, 1), false, dt); return; }
  if (Math.abs(c.speed) < 1.5 && d > 6) { c.stuckT += dt; if (c.stuckT > 1) { c.reverseT = 0.9; c.stuckT = 0; } } else c.stuckT = 0;
  driveCar(c, d < 7 && !P.car ? 0.2 : 1, clamp(-da * 2.5, -1, 1), Math.abs(da) > 1.2 && c.speed > 12, dt);
  c.sirenT = (c.sirenT || 0) + dt;
  if (Math.floor(c.sirenT * 6) % 2) emit(c.x, c.y + 1.9, c.z, 0, 0, 0, 0.12, Math.floor(c.sirenT * 3) % 2 ? 0xff3b3b : 0x3b82f6, 0.9);
  if (!P.car && d < 9 && c.speed < 4 && c.npc) ejectDriver(c);
}
function updateCars(dt) {
  const P = G.P;
  for (const c of G.cars) {
    if (!c.dead) {
      if (c.driver === 'npc' && c.ai) npcDrive(c, dt);
      else if (c.driver === 'cop') copDrive(c, dt);
      else if (c.driver !== 'player') driveCar(c, 0, 0, true, dt);
    }
    physCar(c, dt);
  }
  G.cars = G.cars.filter(c => {
    const far = Math.hypot(c.x - P.x, c.z - P.z);
    if (c === P.car || (c.mission && !c.remove)) return true;
    if (c.remove || (far > 140 && c.driver !== 'cop') || far > 220) {
      scene.remove(c.mesh);
      if (c.parkedId !== undefined) G.parkedOut.delete(c.parkedId);
      return false;
    }
    return true;
  });
}
function updatePlayerCar(dt, c) {
  const P = G.P, car = P.car;
  P.inv = Math.max(0, P.inv - dt); P.shootCd -= dt;
  driveCar(car, -c.mz, c.mx, c.jumpHeld, dt);
  if (c.fire && P.shootCd <= 0) {
    const a = computeAim(true);
    const mx0 = car.x, my0 = car.y + 1.6, mz0 = car.z;
    let dx = a.x - mx0, dy = a.y - my0, dz = a.z - mz0; const l = Math.hypot(dx, dy, dz) || 1;
    shoot(mx0 + dx / l * 1.5, my0, mz0 + dz / l * 1.5, dx / l, dy / l, dz / l);
    P.shootCd = P.st.cd * 1.2;
  }
  if (c.horn && (!G.hornT || G.hornT < G.time)) { G.hornT = G.time + 0.4; Snd.play('deny'); alarmPeds(car.x, car.z, 10); }
  if (c.radio) { G.radio = (G.radio + 1) % RADIO.length; Snd.music(RADIO[G.radio].song); toast(`📻 ${RADIO[G.radio].name}`, 2); }
  P.x = car.x; P.z = car.z; P.y = car.y;
}
const RADIO = [
  { name: 'SQUEAK FM 88.1', song: 'w0' }, { name: 'RUBBER DUCK RADIO', song: 'w1' }, { name: 'CLOSET CLASSICS', song: 'w2' },
  { name: 'FURNACE BEATS 101', song: 'w3' }, { name: 'THE BOOT 666', song: 'boss' }, { name: 'NEST NOSTALGIA', song: 'title' },
];
function landStunt(c) {
  const s = G.stuntAir; G.stuntAir = null;
  if (!s) return;
  const dist = Math.hypot(c.x - s.x, c.z - s.z);
  if (c.airT < 0.6 && dist < 10) return;
  const first = !Save.d.stunts[s.ramp.id];
  const pay = Math.round(dist * (first ? 3 : 1));
  Save.d.coins += pay;
  if (first) { Save.d.stunts[s.ramp.id] = 1; Save.save(); banner('UNIQUE STUNT!', `${dist.toFixed(1)}m · ${c.airT.toFixed(1)}s air · +${pay} coins`, 2.2, '#7dd3fc'); Snd.play('egg'); }
  else banner('STUNT JUMP!', `${dist.toFixed(1)}m · +${pay} coins`, 1.6, '#7dd3fc');
  gainXP(Math.round(dist / 2));
}

/* ================================================================== pedestrians */
function blockRing(b, inset = 1.4) {
  return [[b.x0 + inset, b.z0 + inset], [b.x1 - inset, b.z0 + inset], [b.x1 - inset, b.z1 - inset], [b.x0 + inset, b.z1 - inset]];
}
function nearestCorner(b, x, z) {
  let bi = 0, bd = 1e9;
  blockRing(b).forEach(([cx, cz], i) => { const d = Math.hypot(cx - x, cz - z); if (d < bd) { bd = d; bi = i; } });
  return bi;
}
function spawnPed(x, z, b) {
  const mesh = makePed((Math.random() * 1000) | 0);
  scene.add(mesh);
  const p = { x, z, y: G.city.groundAt(x, z, 1), vx: 0, vz: 0, vy: 0, face: Math.random() * 6, mesh, st: 'walk', t: 0, b: b || G.city.blockAt(x, z), corner: 0, cw: Math.random() < 0.5 ? 1 : -1,
    speed: 1.2 + Math.random() * 0.8, emoT: 0, emo: null, walk: Math.random() * 6, spin: 0 };
  if (p.b) p.corner = nearestCorner(p.b, x, z);
  G.peds.push(p);
  return p;
}
function emote(p, ch) {
  if (p.emo) p.mesh.remove(p.emo);
  p.emo = emojiSprite(ch, 0.6); p.emo.position.y = 1.9; p.mesh.add(p.emo); p.emoT = 2;
}
function emoteAt(c, ch) {
  const s = emojiSprite(ch, 0.8); s.position.set(c.x, (c.y || 0) + 2.6, c.z); scene.add(s);
  G.fx.push({ t: 0, life: 1.6, mesh: s, update() { s.position.y += 0.01; } });
}
function knockPed(p, sx, sz, power, byPlayer) {
  if (p.st === 'flying') return;
  const dx = p.x - sx, dz = p.z - sz, d = Math.hypot(dx, dz) || 1;
  p.st = 'flying'; p.vx = dx / d * power * 0.6; p.vz = dz / d * power * 0.6; p.vy = 3 + power * 0.5; p.spin = (Math.random() - 0.5) * 20;
  Snd.play('friend'); floatText(p.x, p.y + 1.8, p.z, ['OOF!', 'EEP!', 'SQUEAK!', 'OW!', 'HEY!'][(Math.random() * 5) | 0], '#ffffff', 16);
  burst(p.x, p.y + 0.6, p.z, 8, 0xffffff, 3, 0.4, 0.25, 6);
  if (byPlayer) { addHeat(0.35); if (Math.random() < 0.6) spawnPickup('coin', p.x, p.z); }
  alarmPeds(p.x, p.z, 12);
}
function alarmPeds(x, z, r) {
  for (const p of G.peds) {
    if (p.st === 'flying' || p.st === 'dazed' || p.st === 'flee') continue;
    if (Math.hypot(p.x - x, p.z - z) < r) { p.st = 'flee'; p.t = 4 + Math.random() * 2; p.fx = x; p.fz = z; if (Math.random() < 0.4) emote(p, ['😱', '😨', '❗'][(Math.random() * 3) | 0]); }
  }
}
function updatePeds(dt) {
  const P = G.P, city = G.city;
  for (const p of G.peds) {
    p.t -= dt;
    if (p.emoT > 0) { p.emoT -= dt; if (p.emoT <= 0 && p.emo) { p.mesh.remove(p.emo); p.emo = null; } }
    const inner = p.mesh.userData.inner;
    let tvx = 0, tvz = 0;
    if (p.st === 'flying') {
      p.vy -= 22 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
      city.collide(p, 0.35, p.y);
      inner.rotation.x += p.spin * dt;
      const g = city.groundAt(p.x, p.z, p.y + 0.3);
      if (p.y <= g && p.vy < 0) {
        p.y = g;
        if (p.vy < -6) { p.vy = -p.vy * 0.35; p.vx *= 0.5; p.vz *= 0.5; Snd.play('ping'); }
        else { p.st = 'dazed'; p.t = 1.8; p.vx = p.vz = p.vy = 0; inner.rotation.x = -Math.PI / 2; inner.position.y = 0.3; }
      }
      p.mesh.position.set(p.x, p.y, p.z);
      continue;
    }
    if (p.st === 'dazed') {
      if (Math.random() < 0.15) emit(p.x + Math.cos(G.time * 8) * 0.4, p.y + 0.9, p.z + Math.sin(G.time * 8) * 0.4, 0, 0, 0, 0.3, 0xffd166, 0.18);
      if (p.t <= 0) { inner.rotation.x = 0; inner.position.y = 0; p.st = 'flee'; p.t = 3; p.fx = P.x; p.fz = P.z; }
      continue;
    }
    if (p.st === 'flee') {
      const dx = p.x - p.fx, dz = p.z - p.fz, d = Math.hypot(dx, dz) || 1;
      [tvx, tvz] = steerTo(p, p.x + dx / d * 5, p.z + dz / d * 5); tvx *= 5.5; tvz *= 5.5;
      if (p.t <= 0) { p.st = 'walk'; p.b = city.blockAt(p.x, p.z); if (p.b) p.corner = nearestCorner(p.b, p.x, p.z); }
    } else if (p.st === 'idle') {
      if (p.t <= 0) p.st = 'walk';
    } else if (p.st === 'cross') {
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { p.st = 'walk'; p.b = city.blockAt(p.x, p.z) || p.b; p.corner = nearestCorner(p.b, p.x, p.z); }
      else { tvx = dx / d * p.speed * 1.3; tvz = dz / d * p.speed * 1.3; }
    } else {
      if (!p.b) {
        const nb = nearestBlock(p.x, p.z); const ci = nearestCorner(nb, p.x, p.z), r = blockRing(nb)[ci];
        p.st = 'cross'; p.tx = r[0]; p.tz = r[1]; continue;
      }
      const ring = blockRing(p.b);
      const [cx, cz] = ring[p.corner];
      const dx = cx - p.x, dz = cz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.5) {
        const cross = Math.random() < 0.3 ? crossTarget(p, cx, cz) : null;
        if (cross) { p.st = 'cross'; p.tx = cross[0]; p.tz = cross[1]; }
        else p.corner = (p.corner + p.cw + 4) % 4;
        if (Math.random() < 0.2) { p.st = 'idle'; p.t = 1 + Math.random() * 2.5; if (Math.random() < 0.5) emote(p, ['💬', '🎵', '❤️', '☀️', '🍦', '👋'][(Math.random() * 6) | 0]); }
      } else { tvx = dx / d * p.speed; tvz = dz / d * p.speed; }
    }
    const k = 1 - Math.exp(-8 * dt);
    p.vx = lerp(p.vx, tvx, k); p.vz = lerp(p.vz, tvz, k);
    p.x += p.vx * dt; p.z += p.vz * dt;
    if (p.st !== 'cross') city.collide(p, 0.35, p.y, true);
    carPush(p, 0.35, p.y);
    p.y = city.groundAt(p.x, p.z, p.y + 0.3);
    const sp = Math.hypot(p.vx, p.vz);
    if (sp > 0.2) p.face = Math.atan2(p.vx, p.vz);
    p.walk += dt * sp * 4;
    p.mesh.position.set(p.x, p.y + Math.abs(Math.sin(p.walk)) * 0.08 * Math.min(1, sp), p.z);
    p.mesh.rotation.y += angDiff(p.face, p.mesh.rotation.y) * (1 - Math.exp(-10 * dt));
    inner.rotation.z = Math.sin(p.walk) * 0.08 * Math.min(1, sp);
    const pd = Math.hypot(p.x - P.x, p.z - P.z);
    p.mesh.userData.ink.visible = pd < 26; p.mesh.visible = pd < 70;
  }
  G.peds = G.peds.filter(p => {
    if (Math.hypot(p.x - P.x, p.z - P.z) > 85) { scene.remove(p.mesh); return false; }
    return true;
  });
}
function nearestBlock(x, z) {
  let best = G.city.blocks[0], bd = 1e9;
  for (const b of G.city.blocks) { const d = Math.hypot(b.cx - x, b.cz - z); if (d < bd) { bd = d; best = b; } }
  return best;
}
function crossTarget(p, cx, cz) {
  const b = p.b, opts = [];
  const tryB = (bx, bz) => (bx < 0 || bz < 0 || bx >= NB || bz >= NB) ? null : G.city.blocks[bz * NB + bx];
  const atRight = cx > b.cx, atBottom = cz > b.cz;
  const h = tryB(b.bx + (atRight ? 1 : -1), b.bz), v = tryB(b.bx, b.bz + (atBottom ? 1 : -1));
  if (h) opts.push([atRight ? h.x0 + 1.4 : h.x1 - 1.4, cz]);
  if (v) opts.push([cx, atBottom ? v.z0 + 1.4 : v.z1 - 1.4]);
  return opts.length ? opts[(Math.random() * opts.length) | 0] : null;
}

/* ================================================================== streaming: keep the world populated around you */
function updateSpawns(dt) {
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  G.spawnT = 0.25;
  const P = G.P, city = G.city;
  if (G.peds.length < QUALITY[qLevel].peds) {
    const cand = city.blocks.filter(b => { const d = Math.hypot(b.cx - P.x, b.cz - P.z); return d < 75 && d > 10; });
    if (cand.length) {
      const b = cand[(Math.random() * cand.length) | 0];
      const ring = blockRing(b), i = (Math.random() * 4) | 0, j = (i + 1) % 4, u = Math.random();
      const x = lerp(ring[i][0], ring[j][0], u), z = lerp(ring[i][1], ring[j][1], u);
      if (Math.hypot(x - P.x, z - P.z) > 22) { const p = spawnPed(x, z, b); p.corner = j; p.cw = 1; }
    }
  }
  const traffic = G.cars.filter(c => c.driver === 'npc').length;
  if (traffic < QUALITY[qLevel].traffic) {
    const i = (Math.random() * (NB + 1)) | 0, j = (Math.random() * (NB + 1)) | 0;
    const nx = roadC(i), nz = roadC(j), d = Math.hypot(nx - P.x, nz - P.z);
    if (d > 40 && d < 110) {
      const opts = DIRS.filter(([dx, dz]) => i + dx >= 0 && i + dx <= NB && j + dz >= 0 && j + dz <= NB);
      const dir = opts[(Math.random() * opts.length) | 0];
      const x = nx + dir[0] * 9 - dir[1] * LANE, z = nz + dir[1] * 9 + dir[0] * LANE;
      if (!G.cars.some(c => Math.hypot(c.x - x, c.z - z) < 7)) {
        const kinds = ['car', 'car', 'car', 'van', 'sport'];
        const c = spawnCar(kinds[(Math.random() * kinds.length) | 0], CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0], x, z, Math.atan2(dir[0], dir[1]));
        c.ai = { i, j, ti: i + dir[0], tj: j + dir[1], dir }; c.cruise = 9 + Math.random() * 5;
      }
    }
  }
  city.parked.forEach((s, id) => {
    if (G.parkedOut.has(id)) return;
    const d = Math.hypot(s.x - P.x, s.z - P.z);
    if (d < 75 && d > 20) { const c = spawnCar(Math.random() < 0.25 ? 'sport' : 'car', CAR_COLORS[id % CAR_COLORS.length], s.x, s.z, s.h, null); c.parkedId = id; G.parkedOut.add(id); }
  });
  for (const g of G.gangs) {
    const d = Math.hypot(g.x - P.x, g.z - P.z);
    const missionHere = G.mission && G.mission.m.steps.some(s => s.go && Math.hypot(s.go[0] - g.x, s.go[1] - g.z) < 20);
    if (!g.active && d < 55 && G.time > g.back && !missionHere) {
      g.active = true; g.members = [];
      const pool = GANGS[g.gang].pool, n = 6 + ((Math.random() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2, r = 3 + Math.random() * 6;
        const o = { x: g.x + Math.cos(a) * r, z: g.z + Math.sin(a) * r * 0.6 }; G.city.collide(o, 0.6, 0);
        const e = spawnEnemy(pool[(Math.random() * pool.length) | 0], o.x, o.z, { gang: g, home: { x: g.x, z: g.z } });
        g.members.push(e);
      }
    }
    if (g.active) {
      const alive = g.members.filter(e => !e.dead);
      if (!alive.length) {
        g.active = false; g.back = G.time + 240;
        banner(GANGS[g.gang].name.toUpperCase() + ' SCATTERED!', 'Turf cleared', 1.8, GANGS[g.gang].color);
        spawnCoins(g.x, g.z, 20); gainXP(20); Snd.play('chest');
      } else if (d > 120) { for (const e of alive) { e.dead = true; scene.remove(e.mesh); } g.active = false; }
    }
  }
  if (G.pickups.filter(k => k.kind === 'powerup').length < 2 && Math.random() < 0.05) {
    const near = city.powerSpots.filter(s => { const d = Math.hypot(s.x - P.x, s.z - P.z); return d < 60 && d > 15; });
    if (near.length) { const s = near[(Math.random() * near.length) | 0]; const k = spawnPickup('powerup', s.x, s.z); k.vx = k.vz = 0; k.life = 120; }
  }
  if (G.pickups.filter(k => k.kind === 'coin').length < 40 && Math.random() < 0.08) {
    const cand = city.blocks.filter(b => { const d = Math.hypot(b.cx - P.x, b.cz - P.z); return d < 60 && d > 15; });
    if (cand.length) {
      const b = cand[(Math.random() * cand.length) | 0], ring = blockRing(b, 1.6), i = (Math.random() * 4) | 0, j = (i + 1) % 4;
      for (let k = 0; k < 6; k++) { const u = 0.25 + k * 0.08; const c = spawnPickup('coin', lerp(ring[i][0], ring[j][0], u), lerp(ring[i][1], ring[j][1], u)); c.vx = c.vz = c.vy = 0; c.y = c.base = 0.6; c.life = 90; c.trail = true; }
    }
  }
}

/* ================================================================== heat: the Boot Patrol */
const stars = () => Math.ceil(G.heat - 0.001);
function addHeat(a) {
  const before = stars();
  G.heat = Math.min(5, G.heat + a);
  if (G.heat > 0 && G.heat < 1) G.heat = 1;
  G.evadeT = 0;
  const after = stars();
  if (after > before) {
    Snd.play('roar');
    banner('🥾'.repeat(after), after === 1 ? 'The Boot Patrol is after you!' : after >= 5 ? 'THE GREAT BOOT IS WATCHING' : 'Heat rising!', 1.5, '#ff9ec4');
    if (after > Save.d.stats.maxHeat) Save.d.stats.maxHeat = after;
    once('heatTip', 'HEAT! The Boot Patrol chases troublemakers. Break line of sight and stay hidden to lose them.');
  }
}
function clearHeat(silent) {
  G.heat = 0; G.evadeT = 0;
  for (const e of G.enemies) if (e.patrol && !e.dead && !e.minionOf) { e.leaving = true; e.aggro = false; }
  for (const c of G.cars) if (c.driver === 'cop') { c.driver = 'npc'; c.ai = nearestLane(c); c.cruise = 12; }
  if (!silent) { banner('LOST THEM!', 'The Boot Patrol gave up', 1.6, '#86efac'); gainXP(10); Snd.play('chest'); }
}
function nearestLane(c) {
  const step = roadC(1) - roadC(0);
  const i = clamp(Math.round((c.x - roadC(0)) / step), 0, NB), j = clamp(Math.round((c.z - roadC(0)) / step), 0, NB);
  const dir = DIRS.find(([dx, dz]) => i + dx >= 0 && i + dx <= NB && j + dz >= 0 && j + dz <= NB);
  return { i, j, ti: i + dir[0], tj: j + dir[1], dir };
}
function updateHeat(dt) {
  const P = G.P, s = stars();
  if (s <= 0) return;
  const px = P.car ? P.car.x : P.x, pz = P.car ? P.car.z : P.z;
  let seen = false;
  for (const e of G.enemies) if (e.patrol && !e.dead && !e.leaving) { const d = Math.hypot(e.x - px, e.z - pz); if (d < 12 || (d < 32 && G.city.los(e.x, e.z, px, pz, 1.2))) { seen = true; break; } }
  if (!seen) for (const c of G.cars) if (c.driver === 'cop' && !c.dead) { const d = Math.hypot(c.x - px, c.z - pz); if (d < 14 || (d < 38 && G.city.los(c.x, c.z, px, pz, 1.4))) { seen = true; break; } }
  G.seen = seen;
  if (seen) G.evadeT = 0; else G.evadeT += dt;
  if (G.evadeT > 4 + s * 1.2) {
    G.heat -= dt * 0.6;
    if (G.heat <= 0) { clearHeat(false); return; }
  }
  const foot = G.enemies.filter(e => e.patrol && !e.dead && !e.leaving).length;
  const cops = G.cars.filter(c => c.driver === 'cop' && !c.dead).length;
  G.patrolT = (G.patrolT || 0) - dt;
  if (G.patrolT <= 0 && !G.boss) {
    G.patrolT = 1.2;
    if (foot < [0, 2, 3, 4, 5, 6][s]) {
      const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 8;
      const o = { x: px + Math.cos(a) * r, z: pz + Math.sin(a) * r }; G.city.collide(o, 0.6, 0);
      const e = spawnEnemy('patrol', o.x, o.z, { aggro: true, patrol: true });
      e.spawnT = 0; e.mesh.scale.setScalar(e.baseScale); e.y = 12; e.drop = true;
    }
    if (cops < [0, 0, 1, 2, 3, 4][s]) {
      let best = null;
      for (let t = 0; t < 12 && !best; t++) {
        const i = (Math.random() * (NB + 1)) | 0, j = (Math.random() * (NB + 1)) | 0, d = Math.hypot(roadC(i) - px, roadC(j) - pz);
        if (d > 45 && d < 90) best = [roadC(i), roadC(j)];
      }
      if (best) spawnCar('police', 0xffffff, best[0], best[1], Math.atan2(px - best[0], pz - best[1]), 'cop');
    }
  }
  if (s >= 5) { G.bigBootT -= dt; if (G.bigBootT <= 0) { G.bigBootT = 11; bigBootStrike(); } }
}
function bigBootStrike() {
  const P = G.P;
  const tx = P.car ? P.car.x : P.x, tz = P.car ? P.car.z : P.z;
  const tele = telegraph(tx, 0, tz, 4.2, 1.75);
  Snd.play('roar');
  const boot = makeBoot(); boot.scale.setScalar(3.4); boot.position.set(tx, 40, tz); boot.rotation.y = Math.random() * 6; scene.add(boot);
  G.fx.push({ t: 0, life: 3.4, mesh: boot, update(f) {
    const P2 = G.P;
    if (f.t < 1.0) { const nx = P2.car ? P2.car.x : P2.x, nz = P2.car ? P2.car.z : P2.z; tele.mesh.position.x = lerp(tele.mesh.position.x, nx, 0.06); tele.mesh.position.z = lerp(tele.mesh.position.z, nz, 0.06); boot.position.x = tele.mesh.position.x; boot.position.z = tele.mesh.position.z; }
    if (f.t < 1.6) boot.position.y = lerp(40, 10, f.t / 1.6);
    else if (f.t < 1.75) boot.position.y = lerp(10, 0, (f.t - 1.6) / 0.15);
    else if (!f.hit) {
      f.hit = true; boot.position.y = 0;
      const x = boot.position.x, z = boot.position.z;
      shake(1); Snd.play('boom'); Snd.play('stomp');
      burst(x, 0.5, z, 60, [0xffffff, 0xc98a3a, 0x888888], 9, 1, 0.6, 6, 4);
      addWave(x, z, 9, 18, 2);
      if (Math.hypot((P2.car ? P2.car.x : P2.x) - x, (P2.car ? P2.car.z : P2.z) - z) < 4.4) { if (P2.car) { damageCar(P2.car, 60); P2.car.vy = 10; P2.car.air = true; } else hurtPlayer(4, { x, z }); }
      for (const c of G.cars) if (c !== P2.car && Math.hypot(c.x - x, c.z - z) < 5) { c.vy = 9; c.air = true; damageCar(c, 50); }
      for (const p of G.peds) if (Math.hypot(p.x - x, p.z - z) < 7) knockPed(p, x, z, 10, false);
      G.city.kick(x, z, 6, 0, 0, 3);
    } else if (f.t > 2.4) boot.position.y = (f.t - 2.4) * 30;
  } });
}
function makePatrolBoot(s = 0.45) {
  const g = new THREE.Group();
  const b = makeBoot(); b.scale.setScalar(s); g.add(b);
  b.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const k = s / 0.45;
  const hat = new THREE.Group(); hat.position.set(0, 2.15 * s, -0.25 * s); g.add(hat);
  part(GEO.cyl, M(0x1e3a8a), [0.42 * k, 0.16 * k, 0.42 * k], [0, 0.08 * k, 0], 1.08, hat);
  part(GEO.box, M(0x1e3a8a), [1.0 * k, 0.04 * k, 0.5 * k], [0, 0, 0.25 * k], 1.08, hat);
  part(GEO.sphere, glow(0xffd166, 0.6), 0.07 * k, [0, 0.12 * k, 0.34 * k], 0, hat);
  for (const sx of [-1, 1]) {
    part(GEO.sphere, M(0xffffff), 0.13 * k, [sx * 0.2 * k, 1.25 * s, 1.05 * s], 1.1, g);
    part(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0x111111 }), 0.07 * k, [sx * 0.2 * k, 1.25 * s, 1.15 * s], 0, g);
  }
  g.userData.mats = collectMats(g);
  return g;
}

/* ================================================================== enemies */
function makeDummy() {
  const g = new THREE.Group();
  part(GEO.box, M(0xffd166), [0.9, 0.9, 0.9], [0, 0.45, 0], 1.06, g);
  part(GEO.box, M(0xff5d8f), [0.6, 0.6, 0.6], [0, 1.2, 0], 1.06, g);
  const s = emojiSprite('🎯', 0.5); s.position.set(0, 1.2, 0.32); g.add(s);
  g.userData.mats = collectMats(g);
  return g;
}
function spawnEnemy(type, x, z, o = {}) {
  const def = ENEMIES[type];
  const mesh = type === 'patrol' ? makePatrolBoot() : type === 'dummy' ? makeDummy() : makeEnemy(type, def, !!o.elite);
  mesh.position.set(x, 0, z); scene.add(mesh);
  const hpMul = (1 + Save.d.mission * 0.06) * Math.max(1, Math.pow(G.P.st.dps / 4, 0.45));
  const hp = def.hp * hpMul * (o.elite ? 2.6 : 1);
  const e = {
    type, def, x, z, y: 0, vx: 0, vz: 0, kbx: 0, kbz: 0, r: def.r * (o.elite ? 1.3 : 1), hp, maxHp: hp, mesh, t: Math.random() * 3,
    st: 'idle', stT: Math.random(), cd: 1 + Math.random() * 1.5, flash: 0, frozen: 0, burn: 0, burnTick: 0, stun: 0, elite: !!o.elite, fly: !!def.fly,
    spawnT: 0.6, face: Math.random() * 6.28, wd: null, wt: 0, tint: '', dmg: def.dmg, hopY: 0, aggro: !!o.aggro, gang: o.gang || null, home: o.home || { x, z },
    mission: !!o.mission, patrol: !!o.patrol, orig: mesh.userData.mats.map(m => [m.emissive.getHex(), m.emissiveIntensity]),
  };
  e.baseScale = mesh.scale.x;
  mesh.scale.multiplyScalar(0.01);
  burst(x, 0.4, z, 14, [0xffffff, 0xc4b5fd], 3, 0.5, 0.35, 0, 2);
  G.enemies.push(e);
  return e;
}
function hurtEnemy(e, dmg, src) {
  if (e.dead || e.spawnT > 0) return false;
  const P = G.P;
  if (e.intangible) return false;
  if (e.invuln) { if (src.kind === 'shot') { Snd.play('ping'); return 'block'; } return false; }
  if (e.type === 'knight' && src.kind === 'shot' && e.stun <= 0) {
    const fx = Math.sin(e.face), fz = Math.cos(e.face);
    const sx = -(src.dx || 0), sz = -(src.dz || 0), sl = Math.hypot(sx, sz) || 1;
    if ((fx * sx + fz * sz) / sl > 0.45) {
      Snd.play('ping'); burst(e.x + fx * 0.45, 0.6, e.z + fz * 0.45, 6, 0xffd166, 3, 0.25, 0.2, 0);
      once('knightTip', 'Tin Knights block puffs from the front. Get behind them, SPIN (Q) or Belly Flop (C in the air)!');
      e.aggro = true; return 'block';
    }
  }
  let mult = 1;
  if (e.frozen > 0) mult *= 1.5;
  if (e.boss) mult *= e.dmgTake || 1;
  if (['spin', 'pound', 'car'].includes(src.kind) && Math.random() < P.st.crit) { mult *= 2.5; src.crit = true; }
  const d = dmg * mult;
  e.hp -= d; e.flash = 0.1;
  if (!e.aggro && e.gang) { for (const o of e.gang.members) if (!o.dead) o.aggro = true; }
  e.aggro = true;
  if (e.patrol && !e.minionOf && src.kind !== 'burn') addHeat(0.3);
  if (src.fire) e.burn = Math.max(e.burn, 2.4);
  if (!e.boss && src.kb) { const dx = e.x - src.x, dz = e.z - src.z, dd = Math.hypot(dx, dz) || 1, m = src.kb * (e.elite ? 0.5 : 1); e.kbx += dx / dd * m; e.kbz += dz / dd * m; }
  if (src.kind !== 'burn') {
    const shown = d >= 10 ? Math.round(d) : Math.round(d * 10) / 10;
    floatText(e.x + (Math.random() - 0.5) * 0.4, (e.y || 0) + 1.4 + (e.boss ? 3 : 0), e.z, shown + (src.crit ? '!' : ''), src.crit ? '#ffd166' : '#ffffff', src.crit ? 28 : 18, src.crit ? 1 : 0.7);
    Snd.play(src.crit ? 'crit' : 'hit');
    burst(e.x, (e.y || 0) + 0.6, e.z, src.crit ? 10 : 5, src.fire ? [0xff7a2a, 0xffd166] : [0xffffff, e.def.color], 3.5, 0.3, 0.22, 4, 1);
    hitstop(src.crit ? 0.04 : 0.015);
    G.hitMarker = 0.15;
  }
  if (e.hp <= 0) { if (e.boss) bossDefeated(e); else killEnemy(e, src); }
  return true;
}
function killEnemy(e, src = {}) {
  if (e.dead) return;
  e.dead = true; scene.remove(e.mesh);
  const P = G.P, def = e.def;
  Snd.play('kill'); hitstop(0.03); shake(e.elite ? 0.3 : 0.1);
  burst(e.x, (e.y || 0) + 0.5, e.z, e.elite ? 34 : 18, [def.color, 0xffffff, def.color], 5, 0.7, 0.35, 8, 3);
  Save.d.stats.kills++;
  const c = G.combo; c.n++; c.t = 3 + 0.8 * pk('combo');
  if ([5, 10, 15, 20, 30, 50].includes(c.n)) {
    const words = { 5: 'NICE!', 10: 'SMUSHTASTIC!', 15: 'RAMPAGE!', 20: 'UNSTOPPABLE!', 30: 'DRAGON FURY!', 50: 'LEGENDARY!' };
    banner(c.n + ' COMBO', words[c.n], 1.3, '#ff9ec4'); Snd.play('combo'); spawnCoins(e.x, e.z, Math.round(c.n / 2));
  }
  const xpMul = 1 + Math.min(c.n, 25) * 0.04 * (1 + 0.5 * pk('combo'));
  spawnXp(e.x, e.z, def.xp * (e.elite ? 3 : 1) * xpMul);
  if (def.coins) spawnCoins(e.x, e.z, Math.max(1, Math.round(def.coins * (e.elite ? 4 : 1) * (0.6 + Math.random() * 0.8))));
  if (P.hp < P.st.maxHp && Math.random() < 0.08 + 0.05 * pk('vamp')) spawnPickup('heart', e.x, e.z);
  if (Math.random() < (e.elite ? 0.35 : 0.03)) spawnPickup('powerup', e.x, e.z);
  if (e.parent) e.parent.kids--;
  if (e.patrol && !e.minionOf) addHeat(0.4);
  if (pk('chain') && src.kind !== 'chain') {
    const R = 1.6 + 0.25 * pk('chain');
    schedule(0.06, () => {
      ringBurst(e.x, 0, e.z, R, 14, 0xff9ec4, 0.3);
      for (const o of G.enemies) if (!o.dead && o !== e && !o.boss && Math.hypot(o.x - e.x, o.z - e.z) < R + o.r) hurtEnemy(o, 1.2 * pk('chain') * P.st.dmgMul, { x: e.x, z: e.z, kind: 'chain', kb: 5 });
    });
  }
}
function minions(of) { return G.enemies.filter(e => !e.dead && e.minionOf === of).length; }
function wanderDir(e, dt) {
  e.wt -= dt;
  if (e.wt <= 0 || !e.wd) { const a = Math.random() * 6.283; e.wd = [Math.cos(a), Math.sin(a)]; e.wt = 1 + Math.random() * 1.5; }
  return e.wd;
}
function enemyAI(e, dt) {
  const P = G.P;
  const tgx = P.car ? P.car.x : P.x, tgz = P.car ? P.car.z : P.z;
  const dx = tgx - e.x, dz = tgz - e.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  const ud = e.mesh.userData;
  e.cd -= dt; e.stT -= dt;
  if (e.leaving) { const [wx, wz] = steerTo(e, e.x - dx, e.z - dz); e.vx = wx * 4; e.vz = wz * 4; e.face = Math.atan2(wx, wz); if (d > 45) { e.dead = true; scene.remove(e.mesh); } return; }
  if (!e.aggro && !P.dead && d < (e.patrol ? 30 : 13) && e.type !== 'dummy') {
    e.aggro = true;
    if (e.gang) for (const o of e.gang.members) if (!o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 16) o.aggro = true;
    floatText(e.x, 1.8, e.z, '!', '#ff5d8f', 26);
  }
  const sp = e.def.speed * (e.elite ? 1.12 : 1);
  let tvx = 0, tvz = 0, faceP = true, accel = 14;
  if (!e.aggro) {
    const hx = e.home.x - e.x, hz = e.home.z - e.z;
    const [wx, wz] = Math.hypot(hx, hz) > 7 ? steerTo(e, e.home.x, e.home.z) : wanderDir(e, dt);
    if (sp > 0.5) { tvx = wx * sp * 0.35; tvz = wz * sp * 0.35; }
    const k = 1 - Math.exp(-6 * dt); e.vx = lerp(e.vx, tvx, k); e.vz = lerp(e.vz, tvz, k);
    if (Math.abs(tvx) + Math.abs(tvz) > 0.1) e.face = Math.atan2(tvx, tvz);
    if (ud.wings) ud.wings.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * Math.sin(e.t * 22) * 0.7);
    return;
  }
  if (e.gang && !e.mission && Math.hypot(e.x - e.home.x, e.z - e.home.z) > 35) e.aggro = false;
  const chase = () => steerTo(e, tgx, tgz);
  switch (e.type) {
    case 'dummy': faceP = false; break;
    case 'patrol': {
      faceP = true;
      if (e.drop) { e.y -= dt * 25; if (e.y <= 0) { e.y = 0; e.drop = false; shake(0.2); Snd.play('stomp'); burst(e.x, 0.2, e.z, 14, 0xdddddd, 3, 0.4, 0.4, 4); } break; }
      if (e.st === 'wind') { e.hopY = Math.min(1.2, e.hopY + dt * 3); if (e.stT <= 0) { e.st = 'slam'; e.stT = 0.1; } }
      else if (e.st === 'slam') {
        e.hopY = Math.max(0, e.hopY - dt * 14);
        if (e.stT <= 0) {
          e.hopY = 0; shake(0.25); Snd.play('stomp'); burst(e.x, 0.2, e.z, 16, [0xc98a3a, 0xffffff], 4, 0.5, 0.35, 6);
          if (Math.hypot(tgx - e.x, tgz - e.z) < 2.1 && (P.car || P.y < 1.2)) { if (P.car) damageCar(P.car, 12); else hurtPlayer(e.dmg, e); }
          G.city.kick(e.x, e.z, 2, 0, 0, 1.5);
          e.st = 'rec'; e.stT = 0.7; e.cd = 1.2;
        }
      } else if (e.st === 'rec') { if (e.stT <= 0) e.st = 'hop'; }
      else {
        const [cx, cz] = chase();
        const m = P.car ? 1.7 : 1;
        tvx = cx * sp * m; tvz = cz * sp * m; e.hopY = Math.abs(Math.sin(e.t * 7)) * 0.35;
        if (d < 2.6 && e.cd <= 0) { e.st = 'wind'; e.stT = 0.5; telegraph(e.x + ux * 0.8, 0, e.z + uz * 0.8, 1.8, 0.6); }
      }
      break;
    }
    case 'slime': case 'minislime': {
      if (e.stT <= 0) {
        if (e.st === 'hop') { e.st = 'rest'; e.stT = 0.45 + Math.random() * 0.5; }
        else { e.st = 'hop'; e.stT = 0.42; const [cx, cz] = chase(); e.hx = cx; e.hz = cz; }
      }
      if (e.st === 'hop') { tvx = e.hx * sp * 1.8; tvz = e.hz * sp * 1.8; e.hopY = Math.sin((1 - e.stT / 0.42) * Math.PI) * 0.4; } else e.hopY = 0;
      if (ud.body) ud.body.scale.set(1 + (e.st === 'rest' ? 0.12 : -0.08), 1 - (e.st === 'rest' ? 0.12 : -0.12), 1 + (e.st === 'rest' ? 0.12 : -0.08));
      accel = 20; break;
    }
    case 'bunny': {
      if (e.stT <= 0) { e.stT = 0.32; const [cx, cz] = chase(); const a = Math.atan2(cx, cz) + (Math.random() - 0.5) * 1.6; e.hx = Math.sin(a); e.hz = Math.cos(a); }
      tvx = e.hx * sp; tvz = e.hz * sp; e.hopY = Math.abs(Math.sin(e.t * 10)) * 0.25; accel = 25; faceP = false; break;
    }
    case 'duck': case 'duckling': {
      const [wx, wz] = wanderDir(e, dt); tvx = wx * sp; tvz = wz * sp;
      if (e.cd <= 0 && d < 16 && G.city.los(e.x, e.z, tgx, tgz)) {
        const n = e.type === 'duckling' ? 1 : 3, a0 = Math.atan2(dx, dz);
        for (let i = 0; i < n; i++) fireE(e.x + ux * 0.5, e.z + uz * 0.5, a0 + (i - (n - 1) / 2) * 0.22, 7);
        e.cd = e.type === 'duckling' ? 2.6 : 2.1 + Math.random() * 0.6; e.squeak = 0.2;
      }
      e.squeak = Math.max(0, (e.squeak || 0) - dt);
      if (ud.body) ud.body.scale.set(1 + e.squeak, 1 - e.squeak, 1 + e.squeak); break;
    }
    case 'soldier': {
      if (e.st === 'idle' || e.st === 'march') {
        const [cx, cz] = chase(); tvx = cx * sp; tvz = cz * sp; e.st = 'march';
        if (d < 11 && d > 2 && e.cd <= 0 && G.city.los(e.x, e.z, tgx, tgz)) { e.st = 'aim'; e.stT = 0.45; e.cdir = [ux, uz]; }
      } else if (e.st === 'aim') {
        e.face = Math.atan2(e.cdir[0], e.cdir[1]); faceP = false;
        if (e.stT <= 0) { e.st = 'charge'; e.stT = 0.9; }
      } else if (e.st === 'charge') {
        tvx = e.cdir[0] * 11; tvz = e.cdir[1] * 11; faceP = false; accel = 40;
        if (e.hitWall || e.stT <= 0) { e.st = 'stun'; e.stT = 0.8; e.cd = 1.2; }
      } else if (e.st === 'stun') { faceP = false; if (e.stT <= 0) e.st = 'march'; }
      break;
    }
    case 'bat': {
      if (e.st !== 'swoop') {
        const px = -uz, pz = ux, w = Math.sin(e.t * 3) * 0.9, k = d > 3 ? 1 : -0.3;
        tvx = (ux * k + px * w) * sp * 0.8; tvz = (uz * k + pz * w) * sp * 0.8;
        if (e.cd <= 0 && d < 9) { e.st = 'swoop'; e.stT = 0.55; e.sx = ux; e.sz = uz; e.cd = 2.2 + Math.random(); }
      } else { tvx = e.sx * sp * 2.4; tvz = e.sz * sp * 2.4; accel = 30; if (e.stT <= 0) e.st = 'fly'; }
      ud.wings.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * Math.sin(e.t * 22) * 0.7);
      ud.body.position.y = 1 + Math.sin(e.t * 4) * 0.12; break;
    }
    case 'bomber': {
      const px = -uz, pz = ux; e.side = e.side || (Math.random() < 0.5 ? 1 : -1);
      if (d < 5) { tvx = -ux * sp; tvz = -uz * sp; }
      else if (d > 9) { const [cx, cz] = chase(); tvx = cx * sp; tvz = cz * sp; }
      else { tvx = px * sp * 0.6 * e.side; tvz = pz * sp * 0.6 * e.side; if (e.hitWall) e.side *= -1; }
      if (e.cd <= 0 && d < 13) { lobBomb(e.x, e.z, tgx + (P.car ? P.car.vx : P.vx) * 0.5, tgz + (P.car ? P.car.vz : P.vz) * 0.5, e.dmg); e.cd = 2.6 + Math.random() * 0.8; e.pop = 0.35; }
      e.pop = Math.max(0, (e.pop || 0) - dt);
      ud.head.position.y = 0.7 + e.pop * 1.2 + Math.sin(e.t * 5) * 0.03; break;
    }
    case 'roller': {
      const [cx, cz] = chase(); tvx = cx * sp; tvz = cz * sp; accel = 3; faceP = false;
      ud.body.rotation.x += e.vz * dt * 2.2; ud.body.rotation.z -= e.vx * dt * 2.2; break;
    }
    case 'ghost': {
      const cyc = e.t % 4.4;
      const a = cyc < 2.8 ? 1 : cyc < 3.2 ? 1 - (cyc - 2.8) / 0.4 : cyc < 4.0 ? 0 : (cyc - 4.0) / 0.4;
      e.intangible = a < 0.5;
      ud.ghostMat.opacity = 0.08 + a * 0.8;
      const w = Math.sin(e.t * 2) * 0.6;
      tvx = (ux - uz * w) * sp * 0.8; tvz = (uz + ux * w) * sp * 0.8;
      if (a >= 1 && e.cd <= 0 && d < 12) { fireE(e.x, e.z, Math.atan2(dx, dz), 5, e.dmg, { r: 0.22 }); e.cd = 2.4; }
      ud.body.position.y = 0.6 + Math.sin(e.t * 3) * 0.12; break;
    }
    case 'knight': {
      faceP = false;
      const da = angDiff(Math.atan2(dx, dz), e.face);
      if (e.st !== 'lunge') e.face += clamp(da, -2 * dt, 2 * dt);
      const fx = Math.sin(e.face), fz = Math.cos(e.face);
      if (e.st === 'wind') { ud.sword.rotation.y = 0.8; if (e.stT <= 0) { e.st = 'lunge'; e.stT = 0.3; } }
      else if (e.st === 'lunge') { tvx = fx * 9; tvz = fz * 9; accel = 40; ud.sword.rotation.y = -0.6; if (e.stT <= 0) { e.st = 'rec'; e.stT = 0.7; } }
      else if (e.st === 'rec') { ud.sword.rotation.y = 0; if (e.stT <= 0) e.st = 'walk'; }
      else {
        const [cx, cz] = chase();
        if (d > 1.5) { tvx = cx * sp; tvz = cz * sp; }
        if (d < 2.6 && e.cd <= 0 && Math.abs(da) < 0.5) { e.st = 'wind'; e.stT = 0.45; e.cd = 1.8; }
      }
      break;
    }
    case 'spawner': {
      e.kids = e.kids || 0;
      if (e.cd <= 0 && e.kids < 4) {
        const a = Math.random() * 6.283;
        const k = spawnEnemy('bunny', e.x + Math.cos(a) * 1.2, e.z + Math.sin(a) * 1.2, { aggro: true, gang: e.gang, home: e.home });
        k.parent = e; e.kids++; e.cd = 3.5;
        if (e.gang) e.gang.members.push(k);
      }
      const s = 1 + Math.sin(e.t * 4) * 0.06; ud.body.scale.set(s, 1 / s, s); break;
    }
    case 'mage': {
      if (e.st === 'idle' || e.st === 'walk') {
        const [wx, wz] = wanderDir(e, dt); tvx = wx * sp * 0.5; tvz = wz * sp * 0.5;
        if (e.cd <= 0) { e.st = 'out'; e.stT = 0.35; }
      } else if (e.st === 'out') {
        e.intangible = true; e.mesh.scale.setScalar(Math.max(0.01, e.stT / 0.35) * e.baseScale);
        if (e.stT <= 0) {
          for (let k = 0; k < 10; k++) {
            const a = Math.random() * 6.28, r = 4 + Math.random() * 4, nx = tgx + Math.cos(a) * r, nz = tgz + Math.sin(a) * r;
            if (!solidPoint(nx, 0.5, nz) && (!G.arena || Math.hypot(nx - G.arena.x, nz - G.arena.z) < G.arena.r - 1)) { e.x = nx; e.z = nz; break; }
          }
          e.st = 'in'; e.stT = 0.35; burst(e.x, 0.6, e.z, 12, 0xd946ef, 3, 0.4, 0.3, 0);
        }
      } else if (e.st === 'in') {
        e.mesh.scale.setScalar(Math.max(0.01, 1 - e.stT / 0.35) * e.baseScale);
        if (e.stT <= 0) { e.intangible = false; e.mesh.scale.setScalar(e.baseScale); e.st = 'cast'; e.stT = 0.5; }
      } else if (e.st === 'cast') {
        ud.orb.scale.setScalar(0.12 + (0.5 - e.stT) * 0.3);
        if (e.stT <= 0) {
          const a0 = Math.atan2(dx, dz);
          for (let i = -1; i <= 1; i++) fireE(e.x, e.z, a0 + i * 0.45, 4.2, e.dmg, { homing: 1.5, life: 4, r: 0.2 });
          ud.orb.scale.setScalar(0.12); e.st = 'idle'; e.cd = 2.4 + Math.random();
        }
      }
      break;
    }
    case 'turret': {
      e.spin = (e.spin || 0) + dt * 0.8; ud.head.rotation.y = e.spin; faceP = false;
      if (e.cd <= 0 && d < 16) { const n = e.elite ? 8 : 4; for (let i = 0; i < n; i++) fireE(e.x, e.z, e.spin + i / n * Math.PI * 2, 5.5, e.dmg); e.cd = 1.5; }
      break;
    }
    case 'imp': {
      if (e.st === 'fuse') {
        e.mesh.scale.setScalar((1 + (0.55 - e.stT) * 1.2) * e.baseScale);
        e.flash = Math.floor(e.stT * 20) % 2 ? 0.05 : 0;
        if (e.stT <= 0) { explode(e.x, e.z, 1.8, e.dmg, 3); killEnemy(e, { kind: 'boom' }); return; }
      } else {
        const [cx, cz] = chase(); tvx = cx * sp; tvz = cz * sp; accel = 10;
        if (d < 1.4) { e.st = 'fuse'; e.stT = 0.55; Snd.play('eshot'); }
      }
      ud.flame.scale.set(0.18, 0.4 + Math.sin(e.t * 20) * 0.08, 0.18);
      break;
    }
  }
  if (faceP) e.face = Math.atan2(dx, dz);
  else if (e.type !== 'knight' && e.type !== 'turret' && e.st !== 'aim' && (Math.abs(tvx) + Math.abs(tvz) > 0.1)) e.face = Math.atan2(tvx, tvz);
  const k = 1 - Math.exp(-accel * dt);
  e.vx = lerp(e.vx, tvx, k); e.vz = lerp(e.vz, tvz, k);
}
function updateEnemies(dt) {
  const P = G.P, edt = dt * (P.pu.slow ? 0.45 : 1);
  const px = P.car ? P.car.x : P.x, pz = P.car ? P.car.z : P.z;
  const active = [];
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - px, e.z - pz) > 90 && !e.boss && !e.mission) continue;
    active.push(e);
    e.t += edt;
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      e.mesh.scale.setScalar(Math.max(0.01, 1 - e.spawnT / 0.6) * e.baseScale);
      if (e.spawnT <= 0) e.mesh.scale.setScalar(e.baseScale);
      e.mesh.position.set(e.x, e.y || 0, e.z);
      continue;
    }
    e.flash -= dt;
    if (e.burn > 0) {
      e.burn -= dt; e.burnTick -= dt;
      if (Math.random() < 0.4) emit(e.x + (Math.random() - 0.5) * e.r, 0.5 + Math.random() * 0.5, e.z + (Math.random() - 0.5) * e.r, 0, 1.5, 0, 0.4, Math.random() < 0.5 ? 0xff7a2a : 0xffd166, 0.25, -1);
      if (e.burnTick <= 0) { e.burnTick = 0.5; hurtEnemy(e, 0.35 * P.st.dmgMul, { kind: 'burn' }); if (e.dead) continue; }
    }
    if (e.frozen > 0) { e.frozen -= edt; e.vx *= 0.8; e.vz *= 0.8; }
    else if (e.stun > 0) { e.stun -= edt; e.vx *= 0.85; e.vz *= 0.85; if (Math.random() < 0.15) emit(e.x + Math.cos(G.time * 8) * 0.4, 1.2, e.z + Math.sin(G.time * 8) * 0.4, 0, 0, 0, 0.3, 0xffd166, 0.18); }
    else if (e.boss) bossAI(e, edt);
    else enemyAI(e, edt);
    if (e.dead) continue;
    if (!e.noMove) {
      e.kbx *= Math.exp(-8 * dt); e.kbz *= Math.exp(-8 * dt);
      e.x += (e.vx + e.kbx) * edt; e.z += (e.vz + e.kbz) * edt;
      e.hitWall = !!G.city.collide(e, e.r * 0.9, e.fly ? 3 : 0, !e.fly);
      if (!e.fly && !e.boss) carPush(e, e.r * 0.9, e.y || 0);
      if (G.arena && (e.mission || e.boss)) clampArena(e, e.r);
    }
    const d = Math.hypot(P.x - e.x, P.z - e.z);
    if (!P.car && e.aggro && !e.intangible && !e.noTouch && e.dmg > 0 && e.type !== 'patrol' && d < e.r + P.r * 0.85 && Math.abs(P.y - (e.y || 0) - (e.hopY || 0)) < 1.2 && e.frozen <= 0 && !(e.boss && Math.abs(e.y || 0) > 1)) hurtPlayer(e.boss ? 2 : e.dmg, e);
    syncEnemyMesh(e, dt);
  }
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i], b = active[j];
    if (a.boss || b.boss || a.fly !== b.fly) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = (a.r + b.r) * 0.85;
    if (d < m && d > 1e-3) { const p = (m - d) / 2 / d; a.x -= dx * p; a.z -= dz * p; b.x += dx * p; b.z += dz * p; }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}
function syncEnemyMesh(e, dt) {
  const m = e.mesh;
  m.position.set(e.x, (e.hopY || 0) + (e.y || 0), e.z);
  if (!e.boss || e.kind !== 'boot') {
    e.faceVis = (e.faceVis ?? e.face) + angDiff(e.face, e.faceVis ?? e.face) * (1 - Math.exp(-12 * dt));
    m.rotation.y = e.faceVis;
  }
  const tint = e.flash > 0 ? 'flash' : e.frozen > 0 ? 'ice' : e.burn > 0 && Math.floor(G.time * 10) % 2 ? 'burn' : e.dmgTake > 1 ? 'weak' : '';
  if (tint !== e.tint) {
    e.tint = tint;
    m.userData.mats.forEach((mt, i) => {
      if (!e.orig[i]) return;
      if (tint === 'flash') { mt.emissive.setHex(0xffffff); mt.emissiveIntensity = 0.9; }
      else if (tint === 'ice') { mt.emissive.setHex(0x66ccff); mt.emissiveIntensity = 0.7; }
      else if (tint === 'burn') { mt.emissive.setHex(0xff5a00); mt.emissiveIntensity = 0.45; }
      else if (tint === 'weak') { mt.emissive.setHex(0xffd166); mt.emissiveIntensity = 0.35; }
      else { mt.emissive.setHex(e.orig[i][0]); mt.emissiveIntensity = e.orig[i][1]; }
    });
  }
  if (m.userData.aura) m.userData.aura.rotation.z += dt * 2;
}

/* ================================================================== projectiles */
function updateShots(dt) {
  const P = G.P;
  for (const s of G.shots) {
    s.life -= dt;
    if (s.life <= 0) { killShot(s); continue; }
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    const hp = G.city.propAt(s.x, s.y, s.z);
    if (hp) { G.city.kick(hp.x, hp.z, 0.3, s.vx * 0.2, s.vz * 0.2, 1); burst(s.x, s.y, s.z, 5, 0xffffff, 2, 0.25, 0.2, 4); killShot(s); continue; }
    if (s.y < 0.05 || solidPoint(s.x, s.y, s.z)) { G.city.kick(s.x, s.z, 0.6, s.vx * 0.15, s.vz * 0.15, 0.8); killShot(s); continue; }
    if (s.fire && Math.random() < 0.7) emit(s.x, s.y, s.z, (Math.random() - 0.5), 0.6, (Math.random() - 0.5), 0.3, Math.random() < 0.5 ? 0xff7a2a : 0xffd166, 0.25);
    else if (Math.random() < 0.3) emit(s.x, s.y, s.z, 0, 0, 0, 0.18, 0xffffff, 0.16);
    for (const e of G.enemies) {
      if (e.dead || s.hit.has(e)) continue;
      if (e.segs) for (const g of e.segs) if (!g.hidden && Math.hypot(g.x - s.x, g.z - s.z) < g.r + s.r && s.y < 2.2) { s.life = 0; Snd.play('ping'); break; }
      if (s.life <= 0) break;
      const ey = (e.y || 0) + (e.hopY || 0) + (e.fly ? 1 : 0.6) * (e.boss ? (e.kind === 'boot' ? 1.5 : 2) : 1);
      const hr = e.r + s.r + (e.boss ? 0.6 : 0.1);
      if (Math.hypot(e.x - s.x, e.z - s.z) < hr && Math.abs(ey - s.y) < (e.boss ? 3 : 1.1)) {
        s.hit.add(e);
        const res = hurtEnemy(e, s.dmg, { x: s.x - s.vx * 0.03, z: s.z - s.vz * 0.03, kind: 'shot', fire: s.fire, kb: 3.5, dx: s.vx, dz: s.vz, crit: s.crit });
        if (res === 'block') { s.life = 0; break; }
        if (res) { if (s.pierce > 0) s.pierce--; else { s.life = 0; break; } }
      }
    }
    if (s.life > 0) for (const p of G.peds) {
      if (p.st === 'flying' || s.hit.has(p)) continue;
      if (Math.hypot(p.x - s.x, p.z - s.z) < 0.5 && s.y - p.y < 1.5 && s.y > p.y) { s.hit.add(p); knockPed(p, s.x - s.vx, s.z - s.vz, 4, true); s.life = 0; break; }
    }
    if (s.life > 0) for (const c of G.cars) {
      if (c === P.car || c.dead) continue;
      if (Math.hypot(c.x - s.x, c.z - s.z) < 1.6 && s.y < c.y + 1.7) { damageCar(c, 6 * s.dmg, true); burst(s.x, s.y, s.z, 5, 0xffd166, 3, 0.3, 0.2, 4); s.life = 0; if (c.driver === 'npc' && Math.random() < 0.3) emoteAt(c, '💢'); break; }
    }
    if (s.life > 0) for (const g of G.cages) {
      if (g.dead) continue;
      if (Math.hypot(g.x - s.x, g.z - s.z) < 0.7 && s.y < g.y + 1.4) { hitCage(g); s.life = 0; break; }
    }
    if (s.life <= 0) { killShot(s); continue; }
    s.mesh.position.set(s.x, s.y, s.z);
  }
  G.shots = G.shots.filter(s => !s.dead);

  const edt = dt * (P.pu.slow ? 0.45 : 1);
  const px = P.car ? P.car.x : P.x, pz = P.car ? P.car.z : P.z;
  for (const s of G.eshots) {
    s.life -= edt;
    if (s.life <= 0) { killShot(s); continue; }
    if (s.homing && !s.refl) {
      const want = Math.atan2(px - s.x, pz - s.z), cur = Math.atan2(s.vx, s.vz);
      const na = cur + clamp(angDiff(want, cur), -s.homing * edt, s.homing * edt), sp = Math.hypot(s.vx, s.vz);
      s.vx = Math.sin(na) * sp; s.vz = Math.cos(na) * sp;
    }
    s.x += s.vx * edt; s.z += s.vz * edt;
    if (solidPoint(s.x, s.y, s.z)) { burst(s.x, s.y, s.z, 4, s.refl ? 0x67e8f9 : 0xff3b8b, 2, 0.25, 0.2, 0); killShot(s); continue; }
    if (s.refl) {
      for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - s.x, e.z - s.z) < e.r + s.r + (e.boss ? 0.6 : 0)) { hurtEnemy(e, 3 * P.st.dmgMul, { x: s.x, z: s.z, kind: 'refl', kb: 5 }); s.life = 0; break; }
    } else if (P.car) {
      if (Math.hypot(P.car.x - s.x, P.car.z - s.z) < 1.5) { damageCar(P.car, 6 * s.dmg); s.life = 0; burst(s.x, s.y, s.z, 5, 0xff3b8b, 2, 0.3, 0.2, 4); }
    } else if (Math.hypot(P.x - s.x, P.z - s.z) < P.r + s.r && Math.abs(P.y + 0.6 - s.y) < 0.9) {
      if (P.inv <= 0 && P.dashT <= 0 && P.graceT <= 0) { hurtPlayer(s.dmg, s); s.life = 0; }
    }
    if (s.life <= 0) { killShot(s); continue; }
    s.mesh.position.set(s.x, s.y, s.z);
    if (Math.random() < 0.25) emit(s.x, s.y, s.z, 0, 0, 0, 0.2, s.refl ? 0x67e8f9 : s.color, 0.18);
  }
  G.eshots = G.eshots.filter(s => !s.dead);
}
function killShot(s) { if (s.dead) return; s.dead = true; scene.remove(s.mesh); burst(s.x, s.y || 0.6, s.z, 3, s.fire ? 0xffa040 : 0xffffff, 1.5, 0.2, 0.18, 0); }
function fireE(x, z, ang, spd, dmg = 1, opts = {}) {
  const m = new THREE.Mesh(GEO.lowSphere, opts.homing ? MAT.orb : MAT.eshot);
  const r = opts.r || 0.18; m.scale.setScalar(r); m.position.set(x, 0.8, z);
  scene.add(m);
  G.eshots.push({ x, z, y: 0.8, vx: Math.sin(ang) * spd, vz: Math.cos(ang) * spd, dmg, life: opts.life || 5, r, mesh: m, homing: opts.homing || 0, refl: false, color: opts.homing ? 0xc084fc : 0xff3b8b });
  Snd.play('eshot');
  once('reflectTip', 'Tip: tail SPIN (Q) sends bullets straight back at whoever fired them!');
}
function ring(x, z, n, spd, dmg = 1, off = 0) { for (let i = 0; i < n; i++) fireE(x, z, off + i / n * Math.PI * 2, spd, dmg); }
function lobBomb(x, z, tx, tz, dmg = 2) {
  const mesh = makeBomb(); scene.add(mesh);
  const tele = makeTelegraph(0xff7a2a); tele.scale.setScalar(1.6); tele.position.set(tx, G.city.groundAt(tx, tz, 20), tz); scene.add(tele);
  G.bombs.push({ sx: x, sz: z, tx, tz, t: 0, T: 0.9, fuse: 0.6, mesh, tele, dmg });
}
function updateBombs(dt) {
  for (const b of G.bombs) {
    b.t += dt;
    const u = Math.min(1, b.t / b.T);
    b.mesh.position.set(lerp(b.sx, b.tx, u), b.tele.position.y + 0.25 + Math.sin(u * Math.PI) * 3, lerp(b.sz, b.tz, u));
    b.tele.userData.fill.material.opacity = 0.15 + 0.25 * Math.abs(Math.sin(b.t * 12));
    if (b.t > b.T + b.fuse) { b.dead = true; scene.remove(b.mesh); scene.remove(b.tele); explode(b.tx, b.tz, 1.6, b.dmg, 2.5); }
  }
  G.bombs = G.bombs.filter(b => !b.dead);
}
function explode(x, z, r, pdmg, edmg) {
  Snd.play('boom'); shake(0.3);
  burst(x, 0.4, z, 26, [0xff7a2a, 0xffd166, 0x555566], 6, 0.6, 0.45, 4, 3);
  ringBurst(x, 0, z, r, 18, 0xffd166, 0.3);
  const P = G.P;
  if (pdmg) {
    if (P.car && Math.hypot(P.car.x - x, P.car.z - z) < r + 1.5) damageCar(P.car, pdmg * 8);
    else if (!P.car && Math.hypot(P.x - x, P.z - z) < r + P.r && P.y < 1.5) hurtPlayer(pdmg, { x, z });
  }
  if (edmg) for (const e of G.enemies) if (!e.dead && !e.boss && Math.hypot(e.x - x, e.z - z) < r + e.r) hurtEnemy(e, edmg, { x, z, kind: 'boom', kb: 8 });
  for (const p of G.peds) if (Math.hypot(p.x - x, p.z - z) < r + 1) knockPed(p, x, z, 7, false);
  G.city.kick(x, z, r + 1, 0, 0, 2);
}
function addShock(x, y, z, R, color) {
  const m = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.08, z); scene.add(m);
  G.fx.push({ t: 0, life: 0.35, mesh: m, update(f) { const u = f.t / f.life; m.scale.setScalar(0.3 + u * R); m.material.opacity = 0.8 * (1 - u); } });
}
function addWave(x, z, spd, max, dmg, color = 0xff5d8f) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.12, z); scene.add(m);
  G.waves.push({ x, z, R: 0.5, spd, max, dmg, mesh: m, hit: false });
  once('waveTip', 'Shockwave! JUMP over it or DASH through it.');
}
function updateWaves(dt) {
  const P = G.P;
  for (const w of G.waves) {
    w.R += w.spd * dt;
    w.mesh.scale.setScalar(w.R); w.mesh.material.opacity = 0.9 * (1 - w.R / w.max);
    if (Math.random() < 0.8) { const a = Math.random() * 6.283; emit(w.x + Math.cos(a) * w.R, 0.2, w.z + Math.sin(a) * w.R, 0, 1.5, 0, 0.3, 0xffd1e0, 0.3); }
    const d = Math.hypot(P.x - w.x, P.z - w.z);
    if (!w.hit && Math.abs(d - w.R) < 0.45 && P.y < 0.5 && !P.car) { w.hit = true; hurtPlayer(w.dmg, { x: w.x, z: w.z }); }
    if (w.R >= w.max) { w.dead = true; scene.remove(w.mesh); w.mesh.geometry.dispose(); }
  }
  G.waves = G.waves.filter(w => !w.dead);
}
function telegraph(x, y, z, r, life, color = 0xff3b3b) {
  const m = makeTelegraph(color); m.position.set(x, y, z); m.scale.setScalar(r); scene.add(m);
  const f = { t: 0, life, mesh: m, update(f) { m.userData.fill.scale.setScalar(f.t / f.life); m.userData.ring.material.opacity = 0.5 + 0.5 * Math.abs(Math.sin(f.t * 14)); } };
  G.fx.push(f); return f;
}
function updateFx(dt) {
  for (const f of G.fx) {
    f.t += dt;
    if (f.update) f.update(f, dt);
    if (f.t >= f.life) { f.dead = true; if (f.mesh) scene.remove(f.mesh); }
  }
  G.fx = G.fx.filter(f => !f.dead);
}

/* ================================================================== pickups, eggs, cages, orbs */
function spawnCoins(x, z, n) { for (let i = 0; i < n; i++) spawnPickup('coin', x, z); }
function spawnXp(x, z, amt) { const n = Math.min(12, Math.max(1, Math.round(amt / 2))); for (let i = 0; i < n; i++) spawnPickup('xp', x, z, amt / n); }
function spawnPickup(kind, x, z, value = 1) {
  let mesh;
  if (kind === 'coin') mesh = makeCoin();
  else if (kind === 'xp') mesh = makeXp();
  else if (kind === 'heart') mesh = makeHeart();
  else { const ks = Object.keys(POWERUPS); value = ks[(Math.random() * ks.length) | 0]; mesh = makePowerup(POWERUPS[value].icon, POWERUPS[value].color); }
  const a = Math.random() * 6.283, s = 1 + Math.random() * 2.2;
  const gy = G.city.groundAt(x, z, 30);
  mesh.position.set(x, gy + 0.4, z); scene.add(mesh);
  const k = { kind, x, z, y: gy + 0.4, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 4 + Math.random() * 3, mesh, t: 0, value, base: gy + (kind === 'xp' ? 0.4 : kind === 'coin' ? 0.25 : 0.5), life: kind === 'coin' ? 30 : kind === 'xp' ? 20 : 60 };
  G.pickups.push(k);
  return k;
}
function updatePickups(dt) {
  const P = G.P;
  for (const k of G.pickups) {
    k.t += dt;
    if (k.t > k.life) { k.dead = true; scene.remove(k.mesh); continue; }
    const d = Math.hypot(P.x - k.x, P.z - k.z);
    const magR = k.kind === 'xp' ? 99 : k.kind === 'coin' ? P.st.mag * (P.car ? 1.6 : 1) : P.car ? 2.5 : 1.0;
    if (k.t > 0.35 && d < magR && !P.dead) {
      const sp = (k.kind === 'xp' ? 16 : 12) + 6 / Math.max(d, 0.3);
      k.x += (P.x - k.x) / (d || 1) * Math.min(d, sp * dt); k.z += (P.z - k.z) / (d || 1) * Math.min(d, sp * dt);
      k.y = lerp(k.y, P.y + 0.7, 0.2); k.vx *= 0.8; k.vz *= 0.8;
    } else if (!k.trail) {
      k.vy -= 22 * dt; k.y += k.vy * dt;
      if (k.y < k.base) { k.y = k.base; k.vy = Math.abs(k.vy) > 1.5 ? -k.vy * 0.4 : 0; k.vx *= 0.6; k.vz *= 0.6; }
      k.x += k.vx * dt; k.z += k.vz * dt;
    }
    k.mesh.position.set(k.x, k.y + (k.vy === 0 ? Math.sin(G.time * 4 + k.t) * 0.08 : 0), k.z);
    k.mesh.rotation.y += dt * 3;
    if (k.t > k.life - 3) k.mesh.visible = Math.floor(G.time * 10) % 2 === 0;
    if (d < P.r + (P.car ? 1.8 : 0.45) && Math.abs(k.y - P.y - 0.5) < 1.6 && k.t > 0.2) collect(k);
  }
  G.pickups = G.pickups.filter(k => !k.dead);
}
function collect(k) {
  const P = G.P;
  k.dead = true; scene.remove(k.mesh);
  switch (k.kind) {
    case 'coin': { G.coinsFloat += P.st.coinMul; const w = Math.floor(G.coinsFloat); Save.d.coins += w; G.coinsFloat -= w; G.coinPulse = 0.25; Snd.play('coin'); break; }
    case 'xp': Snd.play('xp'); gainXP(k.value); break;
    case 'heart':
      if (P.hp >= P.st.maxHp) { Save.d.coins += 3; Snd.play('coin'); break; }
      P.hp = Math.min(P.st.maxHp, P.hp + 2); Snd.play('heal'); floatText(P.x, P.y + 1.6, P.z, '+♥', '#ff5d8f', 22); break;
    case 'powerup': givePowerup(k.value); break;
  }
}
function givePowerup(id) {
  const P = G.P, d = POWERUPS[id];
  Snd.play('powerup');
  if (id === 'shield') P.shield = 2; else P.pu[id] = d.dur;
  recalc();
  banner(d.icon + ' ' + d.name, '', 1.2, '#' + d.color.toString(16).padStart(6, '0'));
  burst(P.x, P.y + 0.8, P.z, 24, d.color, 4, 0.6, 0.3, 0, 2);
}
function gainXP(v) {
  const s = Save.d;
  s.xp += v; G.xpPulse = 0.2;
  while (s.xp >= xpNeed(s.plv)) {
    s.xp -= xpNeed(s.plv); s.plv++;
    G.pendingLU++; G.luDelay = 0.4;
    const P = G.P; P.hp = Math.min(P.st.maxHp, P.hp + 4);
    Snd.play('levelup'); banner('LEVEL UP!', 'Level ' + s.plv, 1.4, '#7df9ff');
    burst(P.x, P.y + 0.5, P.z, 30, [0x7df9ff, 0xffffff], 4, 1, 0.35, -2, 4);
  }
}
function buildEggs() {
  for (const m of G.eggMeshes) scene.remove(m.mesh);
  G.eggMeshes = [];
  for (const e of G.city.eggs) {
    if (Save.d.eggs[e.id]) continue;
    const m = makeEgg(); m.scale.setScalar(0.8); m.position.set(e.x, e.y, e.z); scene.add(m);
    G.eggMeshes.push({ ...e, mesh: m, t: Math.random() * 6 });
  }
}
function updateEggs(dt) {
  const P = G.P;
  for (const e of G.eggMeshes) {
    if (e.dead) continue;
    e.t += dt;
    e.mesh.position.y = e.y + Math.sin(e.t * 2.5) * 0.12; e.mesh.rotation.y += dt * 1.5;
    const d = Math.hypot(P.x - e.x, P.z - e.z);
    if (d < 25 && Math.random() < 0.15) emit(e.x + (Math.random() - 0.5) * 0.8, e.y + Math.random(), e.z + (Math.random() - 0.5) * 0.8, 0, 0.6, 0, 0.7, 0xffd166, 0.22);
    if (d < 1.1 && Math.abs(P.y + 0.5 - e.y) < 1.4 && !P.car) {
      e.dead = true; scene.remove(e.mesh);
      Save.d.eggs[e.id] = 1; Save.save(); recalc();
      const n = Save.eggs();
      Snd.play('egg'); shake(0.3);
      banner('GOLDEN EGG!', `${n} / ${G.city.eggs.length}` + (n % 6 === 0 ? ' · +1 HEART!' : ''), 2.4);
      burst(e.x, e.y, e.z, 50, [0xffd166, 0xffffff, 0xff9ec4], 5, 1, 0.35, -1, 4);
      spawnCoins(e.x, e.z, 10); gainXP(15);
    }
  }
}
function spawnCage(x, z) {
  const mesh = makeCage((Math.random() * 10) | 0);
  const y = G.city.groundAt(x, z, 10);
  mesh.position.set(x, y, z); scene.add(mesh);
  const g = { x, z, y, hp: 3, mesh, dead: false, t: Math.random() * 5, wob: 0 };
  G.cages.push(g);
  return g;
}
function hitCage(g) {
  if (g.dead) return;
  g.hp--; g.wob = 0.3; Snd.play('hit');
  burst(g.x, g.y + 0.8, g.z, 5, 0xd1d5db, 2.5, 0.3, 0.2, 6);
  if (g.hp <= 0) {
    g.dead = true; scene.remove(g.mesh);
    Snd.play('cage'); schedule(0.15, () => Snd.play('friend'));
    burst(g.x, g.y + 0.8, g.z, 30, [0xffd166, 0xff9ec4, 0xffffff, 0x7dd3fc], 5, 0.8, 0.35, 6, 4);
    floatText(g.x, g.y + 1.8, g.z, 'FREED!', '#86efac', 26, 1.2);
    spawnXp(g.x, g.z, 8);
    const p = spawnPed(g.x, g.z); p.st = 'flee'; p.t = 2; p.fx = G.P.x; p.fz = G.P.z; emote(p, '❤️');
  }
}
function updateCages(dt) {
  for (const g of G.cages) {
    if (g.dead) continue;
    g.t += dt;
    if (g.wob > 0) { g.wob -= dt; g.mesh.rotation.z = Math.sin(g.wob * 40) * g.wob * 0.4; }
    const f = g.mesh.userData.friend; f.position.y = 0.12 + Math.abs(Math.sin(g.t * 3)) * 0.12; f.rotation.y = Math.sin(g.t) * 0.6;
  }
  G.cages = G.cages.filter(g => !g.dead);
}
function spawnOrb(x, z, y) {
  const m = new THREE.Group();
  const core = new THREE.Mesh(GEO.sphere, new THREE.MeshBasicMaterial({ color: 0x7df9ff })); core.scale.setScalar(0.35); m.add(core);
  const halo = new THREE.Mesh(GEO.torus, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })); halo.scale.setScalar(0.55); m.add(halo);
  m.position.set(x, y, z); scene.add(m);
  return { x, y, z, mesh: m, dead: false, t: 0 };
}

/* ================================================================== missions */
function missionMarker() {
  const m = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 30, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 15; m.add(beam);
  const rg = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  rg.rotation.x = -Math.PI / 2; rg.position.y = 0.1; rg.scale.setScalar(1.6); m.add(rg);
  const s = emojiSprite('⭐', 1.2); s.position.y = 2.2; m.add(s);
  m.userData = { beam, rg, s };
  scene.add(m);
  return m;
}
const markers = { start: null, goal: null };
function setGoal(x, z, r = 3, color = 0xffd166) {
  if (!markers.goal) markers.goal = missionMarker();
  markers.goal.visible = true;
  markers.goal.position.set(x, G.city.groundAt(x, z, 30), z);
  markers.goal.userData.rg.scale.setScalar(r);
  markers.goal.userData.beam.scale.set(r / 1.4, 1, r / 1.4);
  markers.goal.userData.beam.material.color.setHex(color); markers.goal.userData.rg.material.color.setHex(color);
  G.goal = { x, z };
}
function hideGoal() { if (markers.goal) markers.goal.visible = false; G.goal = null; }
function updateMissionStart(dt) {
  const mi = Save.d.mission;
  if (G.mission || mi >= MISSIONS.length) { if (markers.start) markers.start.visible = false; G.missionBlip = null; return; }
  const Mi = MISSIONS[mi];
  if (!markers.start) markers.start = missionMarker();
  markers.start.visible = true;
  markers.start.position.set(Mi.start[0], G.city.groundAt(Mi.start[0], Mi.start[1], 30), Mi.start[1]);
  markers.start.userData.s.position.y = 2.2 + Math.sin(G.time * 3) * 0.2;
  markers.start.userData.rg.rotation.z += dt;
  const P = G.P;
  const d = Math.hypot((P.car ? P.car.x : P.x) - Mi.start[0], (P.car ? P.car.z : P.z) - Mi.start[1]);
  G.missionBlip = { x: Mi.start[0], z: Mi.start[1] };
  if (d < 2.6 && G.mode === 'play' && G.time > (G.missionCool || 0)) {
    if (stars() > 0) { if (!G.heatMsg || G.heatMsg < G.time) { toast('Lose the Boot Patrol before starting a mission!', 2); G.heatMsg = G.time + 3; } return; }
    G.mode = 'modal';
    if (document.pointerLockElement) document.exitPointerLock();
    UI.missionIntro({ num: mi + 1, total: MISSIONS.length, name: Mi.name, giver: Mi.giver, blurb: Mi.blurb },
      () => { G.mode = 'play'; startMission(mi); },
      () => { G.mode = 'play'; G.missionCool = G.time + 5; });
  }
}
function startMission(mi) {
  G.mission = { m: MISSIONS[mi], i: -1, enemies: [], cages: [], orbs: [], st: null, timer: 0, idx: mi };
  if (markers.start) markers.start.visible = false;
  Snd.play('select');
  nextStep();
}
function nextStep() {
  const ms = G.mission; if (!ms) return;
  ms.i++;
  hideGoal(); G.objective = ''; G.goalBlip = null; ms.timer = 0; ms.timed = false;
  for (const o of ms.orbs) if (!o.dead) { o.dead = true; scene.remove(o.mesh); }
  ms.orbs = [];
  const s = ms.m.steps[ms.i];
  if (!s) return passMission();
  ms.st = s;
  if (s.talk) {
    G.mode = 'modal';
    if (document.pointerLockElement) document.exitPointerLock();
    UI.talk(ms.m.giver, forDevice(s.talk), () => { G.mode = 'play'; nextStep(); });
  } else if (s.go) { setGoal(s.go[0], s.go[1], Math.min(s.r, 6)); G.objective = s.text; }
  else if (s.spawn) {
    for (const g of s.spawn) for (let i = 0; i < g.n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * s.spread;
      const o = { x: s.at[0] + Math.cos(a) * r, z: s.at[1] + Math.sin(a) * r }; G.city.collide(o, 0.7, 0);
      ms.enemies.push(spawnEnemy(g.type, o.x, o.z, { aggro: g.type !== 'dummy', mission: true, elite: g.elite }));
    }
    nextStep();
  } else if (s.cages) {
    for (let i = 0; i < s.cages; i++) {
      const a = i / s.cages * Math.PI * 2 + 0.4, r = s.spread * (0.5 + Math.random() * 0.5);
      const o = { x: s.at[0] + Math.cos(a) * r, z: s.at[1] + Math.sin(a) * r }; G.city.collide(o, 0.8, 0);
      ms.cages.push(spawnCage(o.x, o.z));
    }
    nextStep();
  } else if (s.clear) G.objective = s.text;
  else if (s.orbs) {
    for (const [x, z, y] of s.orbs) ms.orbs.push(spawnOrb(x, z, y));
    ms.timer = s.time; ms.timed = true; G.objective = s.text;
  } else if (s.race) {
    ms.ck = 0; ms.timer = s.time; ms.timed = true; G.objective = s.text;
    setGoal(s.race[0][0], s.race[0][1], 5, 0x7dd3fc);
  } else if (s.heat || s.lose) G.objective = s.text;
  else if (s.setheat) { G.heat = 0; addHeat(s.setheat); nextStep(); }
  else if (s.truck) {
    const c = spawnCar('truck', 0x8b5a2b, s.truck[0], s.truck[1], 0, null);
    c.mission = 'truck'; ms.truck = c;
    nextStep();
  } else if (s.getcar) G.objective = s.text;
  else if (s.boss) { G.objective = 'Head to the arena'; setGoal(s.at[0], s.at[1], 6, 0xff5d8f); }
}
function updateMission(dt) {
  const ms = G.mission; if (!ms || !ms.st || G.mode !== 'play') return;
  const s = ms.st, P = G.P;
  const px = P.car ? P.car.x : P.x, pz = P.car ? P.car.z : P.z;
  if (ms.timed) { ms.timer -= dt; if (ms.timer <= 0) return failMission('Out of time!'); }
  if (s.go) {
    const okCar = !s.car || (P.car && (s.car === true || P.car.kind === s.car));
    if (Math.hypot(px - s.go[0], pz - s.go[1]) < s.r && okCar) nextStep();
    else G.objective = s.car && !okCar ? (s.car === 'truck' ? 'Get back in the truck!' : 'Get back in a car!') : s.text;
  } else if (s.clear) {
    const left = ms.enemies.filter(e => !e.dead).length, cagesLeft = ms.cages.filter(c => !c.dead).length;
    G.objective = s.text + `  (${left} left` + (ms.cages.length ? `, ${cagesLeft} caged)` : ')');
    const near = ms.enemies.find(e => !e.dead) || ms.cages.find(c => !c.dead);
    G.goalBlip = near ? { x: near.x, z: near.z } : null;
    if (!left && !cagesLeft) { ms.enemies = []; ms.cages = []; Snd.play('chest'); nextStep(); }
  } else if (s.orbs) {
    for (const o of ms.orbs) {
      if (o.dead) continue;
      o.mesh.rotation.y += dt * 2; o.mesh.children[1].rotation.x += dt * 3;
      if (Math.hypot(P.x - o.x, P.z - o.z) < 1.3 && Math.abs(P.y + 0.6 - o.y) < 1.5) { o.dead = true; scene.remove(o.mesh); Snd.play('crystal'); burst(o.x, o.y, o.z, 20, [0x7df9ff, 0xffffff], 4, 0.6, 0.3, 0); ms.timer += 5; floatText(o.x, o.y + 0.8, o.z, '+5s', '#7df9ff', 20); }
    }
    const left = ms.orbs.filter(o => !o.dead).length;
    G.objective = s.text + ` (${left} left)`;
    const next = ms.orbs.find(o => !o.dead); G.goalBlip = next ? { x: next.x, z: next.z } : null;
    if (!left) nextStep();
  } else if (s.race) {
    const ck = s.race[ms.ck];
    G.objective = (s.car && !P.car ? 'Get back in a car! ' : '') + s.text + ` (${ms.ck + 1}/${s.race.length})`;
    if (Math.hypot(px - ck[0], pz - ck[1]) < 6.5 && (!s.car || P.car)) {
      ms.ck++; Snd.play('crystal'); ms.timer += 4;
      if (ms.ck >= s.race.length) { Snd.play('victory'); nextStep(); }
      else setGoal(s.race[ms.ck][0], s.race[ms.ck][1], 5, 0x7dd3fc);
    }
  } else if (s.heat) { if (stars() >= s.heat) nextStep(); }
  else if (s.lose) { if (G.heat <= 0) nextStep(); }
  else if (s.getcar) {
    if (ms.truck && s.getcar === 'truck') setGoal(ms.truck.x, ms.truck.z, 3);
    if (P.car && (s.getcar === true || P.car.kind === s.getcar)) nextStep();
  } else if (s.boss) {
    if (!G.boss && !ms.bossStarted) {
      if (Math.hypot(px - s.at[0], pz - s.at[1]) < 12) {
        if (P.car) { G.objective = 'Get out of the car (F) to fight!'; return; }
        ms.bossStarted = true; hideGoal(); startBoss(s.boss, s.at[0], s.at[1]);
      }
    } else if (ms.bossStarted && ms.bossDone) { ms.bossStarted = false; ms.bossDone = false; nextStep(); }
    else if (G.boss) G.objective = 'Defeat ' + BOSSES[s.boss].name;
  }
}
function cleanupMission() {
  const ms = G.mission; if (!ms) return;
  for (const e of ms.enemies) if (!e.dead) { e.dead = true; scene.remove(e.mesh); }
  for (const c of ms.cages) if (!c.dead) { c.dead = true; scene.remove(c.mesh); }
  for (const o of ms.orbs) if (!o.dead) { o.dead = true; scene.remove(o.mesh); }
  if (ms.truck) { if (ms.truck !== G.P.car) ms.truck.remove = true; ms.truck.mission = null; }
  if (G.boss || G.arena) {
    for (const e of G.enemies) if (e.boss || e.minionOf) { e.dead = true; scene.remove(e.mesh); if (e.segs) e.segs.forEach(s => scene.remove(s.mesh)); if (e.shadow) scene.remove(e.shadow); }
    endArena(); G.boss = null;
  }
  hideGoal(); G.objective = ''; G.goalBlip = null;
  G.mission = null;
}
function failMission(reason, silent) {
  const ms = G.mission; if (!ms) return;
  const mi = ms.idx;
  cleanupMission();
  G.missionCool = G.time + 3;
  Snd.music(DISTRICTS[districtOf(G.P.x, G.P.z)].song);
  if (silent) return;
  G.mode = 'modal'; Snd.play('deny');
  if (document.pointerLockElement) document.exitPointerLock();
  UI.missionFailed({ name: MISSIONS[mi].name, reason }, () => { G.mode = 'play'; startMission(mi); }, () => { G.mode = 'play'; });
}
function passMission() {
  const ms = G.mission, Mi = ms.m;
  cleanupMission();
  Save.d.mission = Math.max(Save.d.mission, ms.idx + 1);
  Save.d.coins += Mi.coins;
  const last = ms.idx === MISSIONS.length - 1;
  if (last) Save.d.done = true;
  Save.save();
  gainXP(Mi.xp);
  Snd.play('victory');
  clearHeat(true);
  G.mode = 'modal';
  if (document.pointerLockElement) document.exitPointerLock();
  UI.missionPassed({ name: Mi.name, coins: Mi.coins, xp: Mi.xp, next: last ? null : MISSIONS[ms.idx + 1].name, last }, () => {
    G.mode = 'play';
    if (last) { G.mode = 'modal'; UI.ending({ eggs: Save.eggs(), total: G.city.eggs.length, plv: Save.d.plv, stunts: Object.keys(Save.d.stunts).length, ramps: G.city.ramps.length }, () => { G.mode = 'play'; }); }
  });
}

/* ================================================================== bosses */
function makeArena(x, z, r) {
  const g = new THREE.Group();
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 2.2, 6).translate(0, 1.1, 0), glow(0xff5d8f, 0.6), 36);
  const d = new THREE.Object3D();
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; d.position.set(x + Math.cos(a) * r, 0, z + Math.sin(a) * r); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); }
  g.add(posts);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0xff5d8f, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  band.position.set(x, 1, z); g.add(band);
  scene.add(g);
  return g;
}
function clampArena(o, r) {
  const A = G.arena; if (!A) return;
  const dx = o.x - A.x, dz = o.z - A.z, d = Math.hypot(dx, dz), m = A.r - r - 0.3;
  if (d > m) { o.x = A.x + dx / d * m; o.z = A.z + dz / d * m; }
}
function endArena() { if (G.arena) { scene.remove(G.arena.mesh); G.arena = null; } }
function startBoss(kind, cx, cz) {
  const B = BOSSES[kind];
  G.arena = { x: cx, z: cz, r: 14, mesh: makeArena(cx, cz, 14) };
  for (const p of G.peds) if (Math.hypot(p.x - cx, p.z - cz) < 16) { p.st = 'flee'; p.t = 6; p.fx = cx; p.fz = cz; }
  for (const c of G.cars) if (c !== G.P.car && Math.hypot(c.x - cx, c.z - cz) < 15 && !c.mission) c.remove = true;
  for (const e of G.enemies) if (!e.boss && !e.mission && Math.hypot(e.x - cx, e.z - cz) < 16) { e.dead = true; scene.remove(e.mesh); }
  clearHeat(true);
  const mesh = makeBoss(kind); scene.add(mesh);
  const hp = B.hp * Math.max(1, Math.pow(G.P.st.dps / 4.2, 0.6));
  const e = {
    boss: true, kind, def: { color: 0xffd166, name: B.name }, x: cx, z: cz - 4, y: 0, vx: 0, vz: 0, kbx: 0, kbz: 0, hp, maxHp: hp, mesh,
    r: { king: 1.45, duck: 1.5, serpent: 0.95, boot: 1.6 }[kind], st: 'intro', stT: 2, cd: 2, t: 0, flash: 0, frozen: 0, burn: 0, burnTick: 0,
    stun: 0, face: 0, spawnT: 0, tint: '', dmgTake: 1, orig: mesh.userData.mats.map(m => [m.emissive.getHex(), m.emissiveIntensity]),
    fly: true, cycle: 0, phase: 1, invuln: true, aggro: true, mission: true, baseScale: 1, dmg: 2,
  };
  if (kind === 'serpent') {
    e.segs = []; e.trail = [];
    for (let i = 0; i < 13; i++) { const s = makeSegment(i, 13); scene.add(s); e.segs.push({ x: cx, z: cz, r: s.userData.r, mesh: s, hidden: false }); }
    e.y = -2.5; e.heading = Math.PI; e.burrowT = 7;
  }
  if (kind === 'boot') {
    e.y = 18; e.noTouch = true;
    const sh = new THREE.Mesh(GEO.disc, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.06; scene.add(sh); e.shadow = sh;
  }
  if (kind === 'king') e.y = 14;
  if (kind === 'duck') e.mesh.scale.setScalar(0.01);
  G.boss = e; G.enemies.push(e);
  Snd.music('boss'); Snd.play('roar'); shake(0.5);
  banner(B.name, B.sub, 2.6, '#ff5d8f');
}
function bossAI(e, dt) {
  const P = G.P, dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  const A = G.arena; if (!A) return;
  const cx = A.x, cz = A.z;
  e.stT -= dt; e.cd -= dt;
  const frac = e.hp / e.maxHp;
  const np = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
  if (np !== e.phase) { e.phase = np; Snd.play('roar'); shake(0.4); banner(e.def.name, np === 2 ? 'is getting angry!' : 'is FURIOUS!', 1.4, '#ff5d8f'); }
  const ph = e.phase;
  const inArena = (x, z, m = 2.5) => { const ddx = x - cx, ddz = z - cz, dd = Math.hypot(ddx, ddz), lim = A.r - m; return dd > lim ? [cx + ddx / dd * lim, cz + ddz / dd * lim] : [x, z]; };
  let tvx = 0, tvz = 0;
  const ud = e.mesh.userData;
  if (e.kind === 'king') {
    e.face = Math.atan2(dx, dz);
    if (e.st === 'intro') {
      e.y = Math.max(0, 14 * (e.stT / 2)); e.invuln = true;
      if (e.stT <= 0) { e.y = 0; e.invuln = false; shake(0.8); Snd.play('boom'); ring(e.x, e.z, 10, 5); e.st = 'idle'; e.stT = 1; burst(e.x, 0.3, e.z, 40, [0xffffff, 0x8be9a8], 7, 0.8, 0.5, 8, 2); }
    } else if (e.st === 'idle') {
      tvx = ux * 1.4; tvz = uz * 1.4;
      ud.body.scale.set(1 + Math.sin(e.t * 6) * 0.05, 1 - Math.sin(e.t * 6) * 0.05, 1 + Math.sin(e.t * 6) * 0.05);
      if (e.stT <= 0) {
        if (Math.random() < 0.25 && minions(e) < 4) { e.st = 'summon'; e.stT = 0.7; }
        else { e.st = 'jump'; e.T = e.stT = ph === 1 ? 0.95 : ph === 2 ? 0.8 : 0.68; e.sx = e.x; e.sz = e.z; [e.tx, e.tz] = inArena(P.x + P.vx * 0.35, P.z + P.vz * 0.35); telegraph(e.tx, 0, e.tz, 2.2, e.T); }
      }
    } else if (e.st === 'jump') {
      const u = 1 - e.stT / e.T;
      e.x = lerp(e.sx, e.tx, u); e.z = lerp(e.sz, e.tz, u); e.y = Math.sin(u * Math.PI) * 5; e.invuln = e.y > 1.4;
      if (e.stT <= 0) {
        e.y = 0; e.invuln = false; shake(0.7); Snd.play('boom');
        burst(e.x, 0.3, e.z, 30, [0xffffff, 0x8be9a8], 6, 0.7, 0.45, 8, 2); addShock(e.x, 0, e.z, 2.8, 0x8be9a8);
        if (Math.hypot(P.x - e.x, P.z - e.z) < 2.3 + P.r && P.y < 1) hurtPlayer(2, e);
        const n = ph === 1 ? 10 : ph === 2 ? 14 : 18; ring(e.x, e.z, n, 5.5);
        if (ph >= 2) { const x = e.x, z = e.z; schedule(0.3, () => { if (G.boss) ring(x, z, n, 4.2, 1, Math.PI / n); }); }
        e.jumps = (e.jumps || 0) + 1;
        e.st = 'idle'; e.stT = ph === 1 ? 0.9 : ph === 2 ? 0.6 : 0.4;
        if (ph === 3 && e.jumps % 3) e.stT = 0.15;
      }
    } else if (e.st === 'summon') {
      ud.body.scale.set(1.15, 0.85, 1.15);
      if (e.stT <= 0) {
        for (let i = 0; i < (ph === 1 ? 2 : 3); i++) { const a = i * 2.1 + Math.random(); const m = spawnEnemy('minislime', e.x + Math.cos(a) * 2.5, e.z + Math.sin(a) * 2.5, { aggro: true, mission: true }); m.minionOf = e; }
        Snd.play('cage'); e.st = 'idle'; e.stT = 0.8;
      }
    }
  } else if (e.kind === 'duck') {
    if (e.st === 'intro') {
      e.invuln = true; e.mesh.scale.setScalar(Math.max(0.01, 1 - Math.max(0, e.stT) / 2) * 3.4); e.face = Math.atan2(dx, dz);
      if (e.stT <= 0) { e.invuln = false; e.st = 'idle'; e.stT = 1; }
    } else if (e.st === 'idle') {
      const tx = cx + Math.cos(e.t * 0.6) * 6, tz = cz + Math.sin(e.t * 0.8) * 4, ddx = tx - e.x, ddz = tz - e.z, dd = Math.hypot(ddx, ddz) || 1;
      tvx = ddx / dd * 2.6; tvz = ddz / dd * 2.6; e.face = Math.atan2(dx, dz);
      if (e.stT <= 0) {
        const opts = ['spiral', 'fan', 'charge', 'charge']; if (minions(e) < 3) opts.push('ducklings');
        let pick; do pick = opts[(Math.random() * opts.length) | 0]; while (pick === e.last && Math.random() < 0.8);
        e.last = pick; e.st = pick === 'charge' ? 'aim' : pick;
        e.stT = { spiral: 2.8, fan: 1.7, aim: 0.75, ducklings: 0.6 }[e.st]; e.cd = 0; e.vol = 0; e.spin = Math.random() * 6;
        if (e.st === 'aim') { e.cdir = [ux, uz]; telegraphLine(e.x, e.z, ux, uz, 24, 0.75); }
      }
    } else if (e.st === 'spiral') {
      e.face += dt * 6;
      if (e.cd <= 0) { e.cd = ph === 3 ? 0.07 : 0.09; fireE(e.x, e.z, e.spin, 5.4); if (ph >= 2) fireE(e.x, e.z, e.spin + Math.PI, 5.4); if (ph === 3) fireE(e.x, e.z, e.spin + Math.PI / 2, 4.6); e.spin += 0.33; }
      if (e.stT <= 0) { e.st = 'idle'; e.stT = 0.9; }
    } else if (e.st === 'fan') {
      e.face = Math.atan2(dx, dz);
      if (e.cd <= 0 && e.vol < 3) { e.cd = 0.55; e.vol++; const n = ph === 1 ? 7 : 9, a0 = Math.atan2(dx, dz); for (let i = 0; i < n; i++) fireE(e.x + ux, e.z + uz, a0 + (i - (n - 1) / 2) * 0.17, 7); }
      if (e.stT <= 0) { e.st = 'idle'; e.stT = 0.8; }
    } else if (e.st === 'aim') {
      e.face = Math.atan2(e.cdir[0], e.cdir[1]);
      if (e.stT <= 0) { e.st = 'charge'; e.stT = 1.6; Snd.play('roar'); }
    } else if (e.st === 'charge') {
      e.vx = e.cdir[0] * 16; e.vz = e.cdir[1] * 16; tvx = e.vx; tvz = e.vz;
      if (Math.random() < 0.7) emit(e.x, 0.3, e.z, 0, 1, 0, 0.4, 0xffffff, 0.5);
      if (Math.hypot(e.x - cx, e.z - cz) > A.r - 2.2 || e.stT <= 0) {
        e.st = 'dizzy'; e.stT = 1.5; e.dmgTake = 1.5; shake(0.6); Snd.play('boom'); e.vx = e.vz = 0;
        burst(e.x, 1, e.z, 20, [0xffd166, 0xffffff], 5, 0.6, 0.4, 6);
        if (ph >= 2) ring(e.x, e.z, 12, 5);
        once('dizzyTip', 'The Admiral is dizzy - he takes extra damage now!');
      }
    } else if (e.st === 'dizzy') {
      e.face += dt * 3;
      if (Math.random() < 0.3) emit(e.x + Math.cos(G.time * 6) * 1.2, 3.4, e.z + Math.sin(G.time * 6) * 1.2, 0, 0, 0, 0.4, 0xffd166, 0.3);
      if (e.stT <= 0) { e.dmgTake = 1; e.st = 'idle'; e.stT = 0.7; }
    } else if (e.st === 'ducklings') {
      if (e.stT <= 0) {
        for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; const m = spawnEnemy('duckling', cx + Math.cos(a) * 8, cz + Math.sin(a) * 8, { aggro: true, mission: true }); m.minionOf = e; }
        e.st = 'idle'; e.stT = 0.6; Snd.play('cage');
      }
    }
    if (e.st !== 'intro') e.mesh.scale.setScalar(3.4);
  } else if (e.kind === 'serpent') { serpentAI(e, dt, ph); return; }
  else if (e.kind === 'boot') { bootAI(e, dt, ph, inArena); return; }
  const k = 1 - Math.exp(-8 * dt);
  if (e.st !== 'charge') { e.vx = lerp(e.vx, tvx, k); e.vz = lerp(e.vz, tvz, k); }
  e.noMove = e.st === 'jump' || e.st === 'intro';
}
function telegraphLine(x, z, ux, uz, len, life) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, len), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.3, depthWrite: false }));
  m.rotation.set(-Math.PI / 2, Math.atan2(-ux, -uz), 0, 'YXZ');
  m.position.set(x + ux * len / 2, 0.07, z + uz * len / 2); scene.add(m);
  G.fx.push({ t: 0, life, mesh: m, update(f) { m.material.opacity = 0.2 + 0.25 * Math.abs(Math.sin(f.t * 14)); } });
}
function serpentAI(e, dt, ph) {
  const P = G.P, A = G.arena;
  e.noMove = true;
  if (e.st === 'intro') { e.y = -2.5 * Math.max(0, e.stT / 2); e.invuln = true; if (e.stT <= 0) { e.y = 0; e.invuln = false; e.st = 'swim'; e.cd = 2; } }
  if (e.st === 'swim' || e.st === 'intro') {
    const spd = ph === 1 ? 5 : ph === 2 ? 6 : 7, turn = ph === 1 ? 1.8 : 2.4;
    e.heading += clamp(angDiff(Math.atan2(P.x - e.x, P.z - e.z), e.heading), -turn * dt, turn * dt) + Math.sin(e.t * 2.4) * 0.9 * dt;
    let nx = e.x + Math.sin(e.heading) * spd * dt, nz = e.z + Math.cos(e.heading) * spd * dt;
    if (Math.hypot(nx - A.x, nz - A.z) > A.r - 1.8) { e.heading = Math.atan2(A.x - e.x, A.z - e.z) + (Math.random() - 0.5); nx = e.x; nz = e.z; }
    e.x = nx; e.z = nz; e.face = e.heading;
    if (e.st === 'swim') {
      if (e.cd <= 0) { const a0 = Math.atan2(P.x - e.x, P.z - e.z); for (let i = -1; i <= 1; i++) fireE(e.x, e.z, a0 + i * 0.3, 6.5); e.cd = ph === 1 ? 2.2 : ph === 2 ? 1.6 : 1.2; }
      if (ph >= 2) { e.tailT = (e.tailT || 1.2) - dt; if (e.tailT <= 0) { e.tailT = ph === 3 ? 0.8 : 1.3; const t = e.segs[e.segs.length - 1]; fireE(t.x, t.z, e.heading + Math.PI / 2, 4.4); fireE(t.x, t.z, e.heading - Math.PI / 2, 4.4); } }
      e.burrowT -= dt; if (e.burrowT <= 0) { e.st = 'dive'; e.stT = 0.7; Snd.play('crumble'); }
    }
  } else if (e.st === 'dive') {
    e.invuln = true; e.y = -2.6 * (1 - e.stT / 0.7);
    if (Math.random() < 0.6) burst(e.x, 0.1, e.z, 2, [0x75669a, 0xffffff], 3, 0.5, 0.3, 8, 2);
    if (e.stT <= 0) { e.st = 'under'; e.stT = 1.35; e.tele = telegraph(P.x, 0, P.z, 2.3, 1.35); e.tx = P.x; e.tz = P.z; }
  } else if (e.st === 'under') {
    e.invuln = true; e.y = -3;
    if (e.stT > 0.55) { e.tx = lerp(e.tx, P.x, 1 - Math.exp(-6 * dt)); e.tz = lerp(e.tz, P.z, 1 - Math.exp(-6 * dt)); e.tele.mesh.position.set(e.tx, 0, e.tz); }
    if (e.stT <= 0) {
      e.x = e.tx; e.z = e.tz; e.trail = []; for (const s of e.segs) { s.x = e.x; s.z = e.z; }
      e.st = 'emerge'; e.stT = 0.35; shake(0.8); Snd.play('boom');
      burst(e.x, 0.3, e.z, 40, [0x75669a, 0xff4d6d, 0xffffff], 7, 0.8, 0.45, 8, 4);
      if (Math.hypot(P.x - e.x, P.z - e.z) < 2.3 + P.r && P.y < 1.5) hurtPlayer(2, e);
      ring(e.x, e.z, ph === 1 ? 10 : 14, 5.2); e.heading = Math.random() * 6.28;
    }
  } else if (e.st === 'emerge') {
    e.y = -2 * (e.stT / 0.35); e.invuln = false;
    if (e.stT <= 0) { e.y = 0; e.st = 'swim'; e.burrowT = (ph === 1 ? 8 : 6) + Math.random() * 2; e.cd = 1.2; }
  }
  const tr = e.trail, last = tr[tr.length - 1];
  if (!last || Math.hypot(last[0] - e.x, last[1] - e.z) > 0.12) { tr.push([e.x, e.z]); if (tr.length > 400) tr.shift(); }
  let acc = 0, ti = tr.length - 1, px = e.x, pz = e.z;
  for (let i = 0; i < e.segs.length; i++) {
    const s = e.segs[i], want = 0.95 * (i + 1);
    while (ti > 0) {
      const q = tr[ti - 1], l = Math.hypot(q[0] - px, q[1] - pz);
      if (acc + l >= want) { const u = (want - acc) / l; px = lerp(px, q[0], u); pz = lerp(pz, q[1], u); acc = want; break; }
      acc += l; px = q[0]; pz = q[1]; ti--;
    }
    s.x = px; s.z = pz;
    const sy = e.st === 'swim' ? 0 : e.st === 'dive' || e.st === 'under' ? Math.min(0, e.y + i * 0.4) : e.y * Math.max(0, 1 - i * 0.15);
    s.hidden = sy < -1;
    s.mesh.position.set(s.x, sy + Math.sin(e.t * 6 - i * 0.6) * 0.08, s.z); s.mesh.visible = sy > -2;
    if (!s.hidden && e.st === 'swim' && Math.hypot(P.x - s.x, P.z - s.z) < s.r + P.r * 0.8 && P.y < 1.2) hurtPlayer(1, s);
  }
  e.mesh.visible = e.y > -2.4;
}
function bootAI(e, dt, ph, inArena) {
  const P = G.P, ud = e.mesh.userData;
  e.noMove = true;
  const hoverY = 5;
  const follow = (spd) => { const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz); if (d > 0.2) { const s = Math.min(spd * dt, d); e.x += dx / d * s; e.z += dz / d * s; } [e.x, e.z] = inArena(e.x, e.z, 2.4); };
  e.dmgTake = e.st === 'stuck' ? 1.6 : e.y > 1 ? 0.45 : 1;
  e.invuln = e.st === 'intro';
  if (e.st === 'intro') { e.y = lerp(18, hoverY, 1 - Math.max(0, e.stT) / 2); if (e.stT <= 0) { e.st = 'hover'; e.stT = 1.5; once('bootTip', 'Hit the Boot hard while it is STUCK in the ground!'); } }
  else if (e.st === 'hover') {
    follow(ph === 3 ? 6.5 : ph === 2 ? 5.2 : 4.3);
    e.y = lerp(e.y, hoverY + Math.sin(e.t * 2) * 0.3, 1 - Math.exp(-4 * dt));
    if (e.stT <= 0) {
      e.cycle++;
      if (ph >= 2 && e.cycle % 3 === 0 && minions(e) < 4) { e.st = 'summon'; e.stT = 1; }
      else if (ph === 3 && e.cycle % 3 === 1) { e.st = 'whip'; e.stT = 3; e.spin = 0; }
      else { e.st = 'wind'; e.stT = ph === 3 ? 0.6 : 0.85; telegraph(e.x, 0, e.z, 2.8, e.stT); if (ph === 3 && !e.triple) e.triple = Math.random() < 0.5 ? 2 : 0; }
    }
  } else if (e.st === 'wind') { e.y = lerp(e.y, hoverY + 1.4, 1 - Math.exp(-6 * dt)); if (e.stT <= 0) { e.st = 'slam'; e.stT = 0.12; e.y0 = e.y; } }
  else if (e.st === 'slam') {
    e.y = Math.max(0, e.y0 * (e.stT / 0.12));
    if (e.stT <= 0) {
      e.y = 0; shake(1); hitstop(0.06); Snd.play('boom'); Snd.play('stomp');
      burst(e.x, 0.3, e.z, 50, [0xffffff, 0xf2b134, 0x8c8f98], 8, 0.9, 0.5, 8, 3);
      if (Math.hypot(P.x - e.x, P.z - e.z) < 2.8 + P.r && P.y < 1.2) hurtPlayer(3, e);
      addWave(e.x, e.z, ph === 3 ? 8.5 : 7.2, 16, ph === 1 ? 1 : 2);
      if (ph >= 2) ring(e.x, e.z, 16, 5, 1, Math.random());
      if (e.triple > 0) { e.triple--; e.st = 'rise'; e.stT = 0.3; e.quick = true; }
      else { e.st = 'stuck'; e.stT = ph === 3 ? 1.3 : 1.8; e.quick = false; }
    }
  } else if (e.st === 'stuck') {
    e.y = 0;
    if (ud.gem) ud.gem.scale.setScalar(1 + Math.sin(e.t * 20) * 0.3);
    if (e.stT <= 0) { e.st = 'rise'; e.stT = 0.6; if (ud.gem) ud.gem.scale.setScalar(1); }
  } else if (e.st === 'rise') {
    e.y = lerp(e.y, hoverY, 1 - Math.exp(-8 * dt));
    if (e.quick) follow(10);
    if (e.stT <= 0) {
      if (e.quick) { e.st = 'wind'; e.stT = 0.45; telegraph(e.x, 0, e.z, 2.8, 0.45); e.quick = e.triple > 0; }
      else { e.st = 'hover'; e.stT = ph === 3 ? 0.9 : ph === 2 ? 1.2 : 1.5; }
    }
  } else if (e.st === 'summon') {
    e.y = lerp(e.y, hoverY + 2, 1 - Math.exp(-3 * dt));
    if (e.stT <= 0) {
      for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; const m = spawnEnemy('patrol', G.arena.x + Math.cos(a) * 8, G.arena.z + Math.sin(a) * 8, { aggro: true, mission: true }); m.minionOf = e; m.spawnT = 0; m.mesh.scale.setScalar(m.baseScale); m.y = 12; m.drop = true; }
      Snd.play('roar'); e.st = 'hover'; e.stT = 1.2;
    }
  } else if (e.st === 'whip') {
    follow(1.5);
    e.wt = (e.wt || 0) - dt;
    if (e.wt <= 0) { e.wt = 0.1; e.spin += 0.28; for (let k = 0; k < 2; k++) fireE(e.x, e.z, e.spin + k * Math.PI, 5.4); }
    if (e.stT <= 0) { e.st = 'wind'; e.stT = 0.7; telegraph(e.x, 0, e.z, 2.8, 0.7); }
  }
  e.mesh.position.set(e.x, e.y, e.z);
  e.mesh.rotation.y = Math.atan2(P.x - e.x, P.z - e.z) * 0.3 + Math.PI;
  e.shadow.position.set(e.x, 0.06, e.z); e.shadow.scale.setScalar(1.6 + (7 - Math.min(e.y, 7)) * 0.12);
  e.shadow.material.opacity = 0.25 + (1 - Math.min(1, e.y / 7)) * 0.3;
  if (e.y < 0.8 && Math.hypot(P.x - e.x, P.z - e.z) < e.r + P.r && P.y < 1.5) hurtPlayer(2, e);
}
function bossDefeated(e) {
  if (e.dying) return;
  e.dying = true; e.hp = 0; e.dead = true;
  G.timeScale = 0.3; G.slowT = 1.6;
  Snd.music(''); Snd.play('roar'); shake(1); hitstop(0.1);
  banner('BOSS SMUSHED!', BOSSES[e.kind].name, 3, '#ffd166');
  for (const o of G.enemies) if (o.minionOf === e && !o.dead) killEnemy(o, { kind: 'boom' });
  for (const s of G.eshots) s.life = 0;
  for (const w of G.waves) w.R = w.max;
  for (let i = 0; i < 9; i++) schedule(i * 0.16, () => { burst(e.x + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, e.z + (Math.random() - 0.5) * 3, 30, [0xffd166, 0xff5d8f, 0xffffff, 0x7dd3fc], 7, 0.9, 0.5, 4, 4); Snd.play('boom'); shake(0.6); });
  schedule(1.5, () => {
    scene.remove(e.mesh);
    if (e.segs) for (const s of e.segs) { scene.remove(s.mesh); burst(s.x, 0.6, s.z, 12, [0xff4d6d, 0xffffff], 4, 0.6, 0.35, 6); }
    if (e.shadow) scene.remove(e.shadow);
    burst(e.x, 1, e.z, 80, [0xffd166, 0xff5d8f, 0xffffff, 0x7dd3fc, 0x86efac], 9, 1.4, 0.6, 3, 6);
    Snd.play('victory');
    spawnXp(e.x, e.z, 40); spawnCoins(e.x, e.z, 40);
    for (let i = 0; i < 3; i++) spawnPickup('heart', e.x, e.z);
    endArena(); G.boss = null;
    if (G.mission) G.mission.bossDone = true;
    schedule(2, () => Snd.music(DISTRICTS[districtOf(G.P.x, G.P.z)].song));
  });
}

/* ================================================================== nests, day/night, music */
function updateWorld(dt) {
  const P = G.P;
  G.prompt = '';
  const px = P.car ? P.car.x : P.x, pz = P.car ? P.car.z : P.z;
  if (!P.car) {
    for (const n of G.city.nests) {
      if (Math.hypot(n.x - P.x, n.z - P.z) < 3.2) {
        G.prompt = 'F - enter ' + n.name + ' (heal, save, shop)';
        if (G.useNow) { G.useNow = false; openNest(n); }
      }
    }
    if (!G.prompt) {
      let best = null, bd = 3.2;
      for (const c of G.cars) if (!c.dead && c.burnT <= 0) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < bd) { bd = d; best = c; } }
      if (best) {
        G.prompt = best.driver === 'npc' ? 'F - borrow this car (the driver will be cross)' : best.driver === 'cop' ? 'F - steal the patrol car!' : 'F - get in';
        if (G.useNow) { G.useNow = false; enterCar(best); }
      }
    }
  }
  G.useNow = false;
  /* day / night: one full day every 8 minutes */
  G.dayT = (G.dayT + dt / 480) % 1;
  const h = Math.sin(G.dayT * Math.PI * 2 - Math.PI / 2);
  const night = clamp(-h * 1.8 + 0.2, 0, 1), dusk = clamp(1 - Math.abs(h) * 4, 0, 1);
  G.night = night;
  scene.background.copy(SKY_DAY).lerp(SKY_NIGHT, night).lerp(SKY_DUSK, dusk * 0.45);
  scene.fog.color.copy(scene.background);
  hemi.intensity = lerp(1.15, 0.55, night); hemi.color.setHex(night > 0.5 ? 0xb0b8ff : 0xfff6e8);
  sun.intensity = lerp(2.1, 0.35, night); sun.color.setHex(night > 0.5 ? 0x9fb0ff : dusk > 0.3 ? 0xffc890 : 0xfff0d8);
  G.city.setNight(night);
  const d = districtOf(px, pz);
  if (d !== G.district) {
    G.district = d;
    if (!P.car && !G.boss) Snd.music(DISTRICTS[d].song);
    toast(DISTRICTS[d].name, 1.6);
  }
  P.regenT = (P.regenT || 0) - dt;
  if (P.regenT <= 0 && P.hp < Math.ceil(P.st.maxHp / 2)) { P.hp++; P.regenT = 2.5; }
  Save.d.stats.time += dt;
}
function openNest(n) {
  const P = G.P;
  P.hp = P.st.maxHp; Snd.play('heal');
  clearHeat(true);
  Save.d.pos = { x: n.x, z: n.z + 3 }; Save.save();
  G.mode = 'modal';
  if (document.pointerLockElement) document.exitPointerLock();
  const done = () => { G.mode = 'play'; };
  const menu = () => UI.nest({ name: n.name, save: Save.d, eggs: Save.eggs(), totalEggs: G.city.eggs.length, stunts: Object.keys(Save.d.stunts).length, ramps: G.city.ramps.length, mission: Save.d.mission, missions: MISSIONS.length, maxHp: P.st.maxHp },
    { shop: showShop, colors: showColors, leave: done });
  const showShop = () => UI.shop(Save.d, buy, menu);
  const showColors = () => UI.colors(Save.d, Save.eggs(), (i) => { Save.d.hide = i; Save.save(); recolorPlayer(G.P.mesh, HIDES[i]); Snd.play('select'); }, menu);
  menu();
}
function buy(id) {
  const it = SHOP[id], have = Save.d.shop[id] | 0;
  if (it.consumable ? have >= 1 : have >= it.cost.length) { Snd.play('deny'); return false; }
  const cost = it.cost[it.consumable ? 0 : have];
  if (Save.d.coins < cost) { Snd.play('deny'); return false; }
  Save.d.coins -= cost; Save.d.shop[id] = have + 1; Save.save(); Snd.play('powerup'); recalc();
  if (id === 'heart') G.P.hp = G.P.st.maxHp;
  return true;
}

/* ================================================================== menus */
function openLevelUp() {
  const opts = [], pool = Object.keys(PERKS).filter(k => pk(k) < PERKS[k].max);
  if (!pk('fire') && Save.d.plv >= 3 && pool.includes('fire')) { opts.push('fire'); pool.splice(pool.indexOf('fire'), 1); }
  while (opts.length < 3 && pool.length) opts.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  G.pendingLU--;
  if (!opts.length) { Save.d.coins += 25; toast('Every perk maxed! +25 coins', 2); return; }
  G.mode = 'levelup';
  if (document.pointerLockElement) document.exitPointerLock();
  UI.levelUp({ plv: Save.d.plv, options: opts.map(k => ({ id: k, ...PERKS[k], have: pk(k) })) }, (id) => {
    Save.d.perks[id] = pk(id) + 1; Save.save(); recalc();
    if (id === 'heart') G.P.hp = G.P.st.maxHp;
    Snd.play('powerup'); G.mode = 'play'; G.luDelay = 0.3;
  });
}
function togglePause() {
  if (G.mode === 'play') {
    G.mode = 'pause';
    if (document.pointerLockElement) document.exitPointerLock();
    UI.pause({
      resume: () => { G.mode = 'play'; UI.hide(); },
      map: () => { UI.hide(); G.mapOpen = true; G.mode = 'map'; },
      muted: Snd.muted, music: Snd.musicOn, toggleMute: () => Snd.toggleMute(), toggleMusic: () => Snd.toggleMusic(),
      quality: qName, cycleQuality: () => { const o = ['auto', 'high', 'med', 'low']; setQuality(o[(o.indexOf(qName) + 1) % o.length]); return qName; },
      quitMission: G.mission ? () => { failMission('', true); G.mode = 'play'; UI.hide(); } : null,
      stats: { plv: Save.d.plv, coins: Save.d.coins, eggs: Save.eggs(), totalEggs: G.city.eggs.length, mission: Save.d.mission, missions: MISSIONS.length,
        stunts: Object.keys(Save.d.stunts).length, ramps: G.city.ramps.length, kills: Save.d.stats.kills, perks: Object.keys(Save.d.perks).map(k => ({ ...PERKS[k], n: Save.d.perks[k] })) },
      reset: () => { if (confirm('Erase ALL Smushville progress?')) { Save.reset(); location.reload(); } },
    });
  } else if (G.mode === 'pause') { G.mode = 'play'; UI.hide(); }
}
function onKeyMenu(code) {
  if (code === 'KeyM' && (G.mode === 'play' || G.mode === 'map')) { G.mapOpen = !G.mapOpen; G.mode = G.mapOpen ? 'map' : 'play'; return; }
  if (code === 'KeyN' && G.mode === 'play') { Snd.toggleMute(); return; }
  if (code === 'Escape' || code === 'KeyP') {
    if (G.mode === 'map') { G.mapOpen = false; G.mode = 'play'; return; }
    if (G.mode === 'play' || G.mode === 'pause') togglePause();
    return;
  }
  if (code === 'Enter' || (code === 'Space' && G.mode !== 'play')) UI.primary();
  if (G.mode === 'levelup' && ['Digit1', 'Digit2', 'Digit3'].includes(code)) UI.pickIndex(+code.slice(-1) - 1);
}
UI.onAction = () => Snd.init();

/* ================================================================== camera */
function updateCamera(rdt) {
  const P = G.P, cam = G.cam, city = G.city;
  if (G.mode === 'title') {
    cam.orbit = (cam.orbit || 0) + rdt * 0.08;
    const tx = SIZE / 2, tz = SIZE / 2;
    camera.position.set(tx + Math.sin(cam.orbit) * 150, 90, tz + Math.cos(cam.orbit) * 150);
    camera.lookAt(tx, 0, tz);
    sun.position.set(tx + 40, 120, tz + 60); sun.target.position.set(tx, 0, tz);
    return;
  }
  const sens = 0.0024;
  cam.yaw -= mouse.dx * sens; cam.pitch = clamp(cam.pitch + mouse.dy * sens, -0.35, 1.25);
  mouse.dx = mouse.dy = 0;
  const car = P.car;
  const aiming = !car && (mouse.r || (pad && pad.lt));
  const idle = performance.now() - mouse.lastMove > 1400;
  if (car && idle && Math.abs(car.speed) > 3) {
    const want = car.h + Math.PI + (car.speed < 0 ? Math.PI : 0);
    cam.yaw += angDiff(want, cam.yaw) * (1 - Math.exp(-2.5 * rdt));
    cam.pitch += (0.3 - cam.pitch) * (1 - Math.exp(-2 * rdt));
  }
  /* on touch, running forward slowly swings the camera in behind you, like a mobile third-person game */
  if (touch.on && !car && idle && touch.jid !== null && touch.jy < -0.35 && Math.hypot(P.vx, P.vz) > 2) {
    cam.yaw += angDiff(P.face + Math.PI, cam.yaw) * (1 - Math.exp(-1.2 * rdt));
  }
  const wantDist = car ? (car.kind === 'truck' ? 12 : 9.5) + Math.min(4, Math.abs(car.speed) * 0.1) : aiming ? 3.6 : 6.2;
  cam.dist += (wantDist - cam.dist) * (1 - Math.exp(-6 * rdt));
  const tx = car ? car.x : P.x, ty = car ? car.y + 1.8 : P.y + 1.5, tz = car ? car.z : P.z;
  const side = aiming ? 0.8 : 0.35;
  const ax = tx + Math.cos(cam.yaw) * side, az = tz - Math.sin(cam.yaw) * side;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const dx = Math.sin(cam.yaw) * cp, dy = sp, dz = Math.cos(cam.yaw) * cp;
  let d = cam.dist;
  const hit = city.raycast(ax, ty, az, dx, dy, dz, d + 0.4);
  if (hit < d + 0.4) d = Math.max(1.2, hit - 0.4);
  camera.position.set(ax + dx * d, Math.max(0.4, ty + dy * d), az + dz * d);
  if (G.shake > 0) { const s = G.shake * G.shake * 0.4; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; camera.position.z += (Math.random() - 0.5) * s; }
  camera.lookAt(ax, ty + 0.1, az);
  const fov = car ? 62 + Math.min(14, Math.abs(car.speed) * 0.45) : aiming ? 52 : 62;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, 1 - Math.exp(-5 * rdt)); camera.updateProjectionMatrix(); }
  const sx = Math.round(tx / 2) * 2, sz = Math.round(tz / 2) * 2;
  const sa = G.dayT * Math.PI * 2;
  sun.position.set(sx + Math.cos(sa) * 40, 70, sz + 30 + Math.sin(sa) * 20); sun.target.position.set(sx, 0, sz);
}

/* ================================================================== main loop */
function update(dt, rdt) {
  const c = readControls(rdt);
  G.time += dt;
  if (G.combo.t > 0) { G.combo.t -= dt; if (G.combo.t <= 0) G.combo.n = 0; }
  const P = G.P;
  for (const k in P.pu) { if (POWERUPS[k].dur) { P.pu[k] -= dt; if (P.pu[k] <= 0) { delete P.pu[k]; recalc(); } } }
  if (c.use && P.car) { exitCar(); c.use = false; }
  G.useNow = c.use;
  if (P.car) updatePlayerCar(dt, c); else updateFoot(dt, c);
  if (G.mode !== 'play') return;
  updateCars(dt);
  updatePeds(dt);
  updateEnemies(dt);
  updateShots(dt);
  updateBombs(dt);
  updateWaves(dt);
  updateFx(dt);
  updatePickups(dt);
  updateCages(dt);
  updateEggs(dt);
  updateHeat(dt);
  updateSpawns(dt);
  updateWorld(dt);
  updateMissionStart(dt);
  updateMission(dt);
  G.city.updateDyn(dt);
  if (G.arena && !P.car) clampArena(P, P.r);
  if (markers.goal && markers.goal.visible) { markers.goal.userData.rg.rotation.z += dt; markers.goal.userData.s.position.y = 2.2 + Math.sin(G.time * 3) * 0.2; }
  if (G.pendingLU > 0 && G.mode === 'play') { G.luDelay -= rdt; if (G.luDelay <= 0 && !G.boss) openLevelUp(); }
  G.hitMarker = Math.max(0, (G.hitMarker || 0) - dt);
}
function updateDying(rdt) {
  const P = G.P;
  G.dieT -= rdt;
  const u = 1 - G.dieT / 1.4;
  P.mesh.scale.set(1 + u * 0.6, Math.max(0.12, 1 - u * 1.5), 1 + u * 0.6);
  P.mesh.rotation.y += rdt * 4;
  if (G.dieT <= 0) {
    G.mode = 'dead';
    if (document.pointerLockElement) document.exitPointerLock();
    UI.dead({ respawn });
  }
}
let last = performance.now();
/* cap at 60fps: on a 120/144Hz monitor rendering every refresh doubles the work for no visible gain */
function frame(now) {
  requestAnimationFrame(frame);
  if (now - last < 14.5) return;
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  const t0 = performance.now();
  tick(rdt);
  adaptRes(Math.max(performance.now() - t0, rdt * 1000 * 0.85));
}
function tick(rdt) {
  const P0 = G.prof ? performance.now() : 0;
  pollPad();
  G.touchOn = touch.on; G.locked = locked;
  syncTouch();
  for (const t of G.timers) { t.t -= rdt; if (t.t <= 0 && !t.done) { t.done = true; t.fn(); } }
  G.timers = G.timers.filter(t => !t.done);
  if (G.slowT > 0) { G.slowT -= rdt; if (G.slowT <= 0) G.timeScale = 1; }
  if (G.mode === 'play') {
    if (G.hitstop > 0) G.hitstop -= rdt;
    else update(rdt * G.timeScale, rdt);
  } else if (G.mode === 'dying') { updateDying(rdt); updateFx(rdt); }
  updateParticles(rdt);
  G.shake = Math.max(0, G.shake - rdt * 2.2);
  G.hurtFlash = Math.max(0, G.hurtFlash - rdt);
  G.xpPulse = Math.max(0, G.xpPulse - rdt); G.coinPulse = Math.max(0, G.coinPulse - rdt);
  if (G.toast) { G.toast.t -= rdt; if (G.toast.t <= 0) G.toast = null; }
  if (G.banner) { G.banner.t -= rdt; if (G.banner.t <= 0) G.banner = null; }
  for (const f of G.floats) f.t += rdt;
  G.floats = G.floats.filter(f => f.t < f.life);
  const P1 = G.prof ? performance.now() : 0;
  updateCamera(rdt);
  renderer.render(scene, camera);
  const P2 = G.prof ? performance.now() : 0;
  HUD.draw(G, camera, Save, { xpNeed, POWERUPS, BOSSES, MISSIONS, pad: !!pad, stars: stars() });
  if (G.prof) { const P3 = performance.now(), q = G.prof; q.sim += P1 - P0; q.render += P2 - P1; q.hud += P3 - P2; q.n++; }
  for (const k in pressed) pressed[k] = false;
}

/* ================================================================== boot */
window.__R = renderer; window.__S = scene; window.__C = camera;
window.__Q = { G, Save, tick: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) tick(dt); }, get startMission() { return startMission; }, get addHeat() { return addHeat; }, get spawnEnemy() { return spawnEnemy; }, get enterCar() { return enterCar; }, get gainXP() { return gainXP; }, get startPlay() { return startPlay; } };

function startPlay() {
  G.mode = 'play';
  UI.hide();
  Snd.init();
  G.district = -1;
  if (!Save.d.seen.controls) {
    Save.d.seen.controls = 1; Save.save();
    toast(touch.on ? 'Left thumb moves, right thumb looks. Hold PUFF to fire (it aims for you). The yellow button pops up near cars and doors. Follow the ⭐ for your first mission!' : 'CLICK to grab the mouse · WASD move · mouse look · CLICK puff · SPACE jump (twice!) · SHIFT dash / sprint · Q spin · F cars & doors · M map. Follow the ⭐ for your first mission!', 10);
  }
}
(async function boot() {
  UI.loading();
  resize();
  await new Promise(r => setTimeout(r, 30));
  G.city = buildCity(scene, 4242);
  MISSIONS = buildMissions(G.city);
  G.gangs = G.city.gangs.map(g => ({ ...g, active: false, back: 0, members: [] }));
  G.city.onKick = (p) => {
    if (p.kind !== 'hydrant' || p.sprayed) return;
    p.sprayed = true; const x = p.x, z = p.z; let n = 0;
    const spray = () => { for (let i = 0; i < 6; i++) emit(x, 0.6, z, (Math.random() - 0.5) * 2, 9 + Math.random() * 3, (Math.random() - 0.5) * 2, 1.2, i % 2 ? 0x7fd3f5 : 0xffffff, 0.35, 14); if (++n < 80) schedule(0.08, spray); };
    spray(); Snd.play('frost');
  };
  dragon = await loadDragon();
  buildPlayer();
  const home = Save.d.pos || (() => { const n = G.city.nests.find(n => n.name === 'Home Nest'); return { x: n.x, z: n.z + 3 }; })();
  G.P.face = G.P.faceVis = 0;
  placePlayer(home.x, home.z);
  G.cam.yaw = Math.PI;
  buildEggs();
  requestAnimationFrame(frame);
  G.mode = 'title';
  Snd.music('title');
  UI.title({ play: startPlay, hasSave: Save.d.mission > 0 || Save.d.plv > 1 });
})();
