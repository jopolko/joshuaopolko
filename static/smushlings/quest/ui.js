/* Smushlings Quest: Smushville - HTML menus and the canvas HUD (radar, hearts, heat, crosshair, map) */
import { Vector3 } from 'three';
import { SHOP, HIDES, HIDE_NAMES, xpNeed, DISTRICTS, GANGS } from './data.js';

const ui = document.getElementById('ui');
let primaryFn = null, pickFns = [];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = n => '#' + n.toString(16).padStart(6, '0');
const fmtT = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); };
const TOUCH = matchMedia('(pointer: coarse)').matches;
const TOUCH_CONTROLS = `<b>Left thumb</b>: drag on the left half to move (push to the edge to sprint) · <b>Right thumb</b>: drag to look<br>
  <b>PUFF</b>: hold to fire (it auto-aims), drag while holding to turn · <b>JUMP</b> twice for a double jump · <b>FLOP</b> appears mid-air<br>
  The yellow button does whatever is nearby: get in a car, enter a Nest. In cars: <b>GAS</b>, <b>BRAKE</b>, <b>DRIFT</b>, <b>PUFF</b> · 🗺️ map · ⏸ pause<br>
  Best played sideways (landscape).`;
const CONTROLS_DESKTOP = `<b>WASD</b> move · <b>mouse</b> look (click to grab it) · <b>LEFT CLICK</b> puff · <b>RIGHT CLICK</b> aim<br>
  <b>SPACE</b> jump (again for a double jump) · <b>SHIFT</b> dash / hold to sprint · <b>Q</b> tail spin · <b>C</b> belly flop (in the air)<br>
  <b>F</b> borrow a car / get out / enter doors · in cars: <b>SPACE</b> handbrake, <b>R</b> radio, <b>H</b> horn · <b>M</b> map · <b>ESC</b> pause<br>
  gamepad and touch supported`;
const CONTROLS = TOUCH ? TOUCH_CONTROLS : CONTROLS_DESKTOP;

function show(html, wide = false) {
  ui.innerHTML = `<div class="card${wide ? ' wide' : ''}">${html}</div>`;
  ui.className = 'on';
  primaryFn = null; pickFns = [];
}
function bind(id, fn, primary = false) {
  const el = document.getElementById(id); if (!el) return;
  const go = () => { UI.onAction && UI.onAction(); fn(); };
  el.onclick = go;
  if (primary) primaryFn = go;
}
const GIVER = { 'Mama Smush': '🐲', 'Captain Puddles': '🦆', 'Professor Lint': '🧦', 'Grandpa Grommet': '👴' };

export const UI = {
  onAction: null,
  hide() { ui.className = ''; ui.innerHTML = ''; primaryFn = null; pickFns = []; },
  primary() { if (primaryFn) primaryFn(); },
  pickIndex(i) { if (pickFns[i]) pickFns[i](); },
  loading() { show(`<div class="logo">SMUSHVILLE</div><p class="sub">building the city...</p>`); },

  title(o) {
    show(`<div class="logo">SMUSHVILLE</div><div class="logo2">A SMUSHLINGS STORY</div>
      <p class="tag">An open city of toy blocks, rubber dragons and very bad drivers. The Great Boot's patrol is scooping up your friends.
      Puff, jump, dash, borrow cars, outrun the Boot Patrol, clean up four gangs, beat four bosses and hunt down every golden egg.</p>
      <div class="btns"><button class="btn" id="bPlay">${o.hasSave ? 'Continue' : 'Play'}</button></div>
      <div class="how">${CONTROLS}</div>
      <a class="back" href="../">&larr; back to Smushlings: Boot of Destiny</a>`);
    bind('bPlay', o.play, true);
  },

  missionIntro(o, go, cancel) {
    show(`<p class="sub">Mission ${o.num} / ${o.total}</p><div class="giver">${GIVER[o.giver] || '⭐'}</div>
      <h2>${esc(o.name)}</h2><p class="tag">${esc(o.blurb)}</p><p class="foot">from ${esc(o.giver)}</p>
      <div class="btns"><button class="btn" id="bGo">Start mission</button><button class="btn ghost" id="bNo">Not now</button></div>`);
    bind('bGo', () => { UI.hide(); go(); }, true); bind('bNo', () => { UI.hide(); cancel(); });
  },
  talk(who, text, next) {
    show(`<div class="talk"><div class="giver">${GIVER[who] || '⭐'}</div><div><p class="sub">${esc(who)}</p><p class="said">${esc(text)}</p></div></div>
      <div class="btns"><button class="btn" id="bOk">Got it!</button></div>`);
    bind('bOk', () => { UI.hide(); next(); }, true);
  },
  missionPassed(o, ok) {
    show(`<p class="sub">Mission passed</p><div class="logo small">RESPECT +</div><h2>${esc(o.name)}</h2>
      <div class="stats"><div>Coins</div><div>🪙 ${o.coins}</div><div>XP</div><div>+${o.xp}</div></div>
      ${o.next ? `<p>Next mission: <b>${esc(o.next)}</b> - follow the ⭐ on your radar.</p>` : ''}
      <div class="btns"><button class="btn" id="bOk">${o.last ? 'The End...?' : 'Sweet!'}</button></div>`);
    bind('bOk', () => { UI.hide(); ok(); }, true);
  },
  missionFailed(o, retry, ok) {
    show(`<p class="sub">Mission failed</p><div class="logo small">SMUSHED IT</div><h2>${esc(o.name)}</h2><p>${esc(o.reason)}</p>
      <div class="btns"><button class="btn" id="bRetry">Retry</button><button class="btn ghost" id="bOk">Free roam</button></div>`);
    bind('bRetry', () => { UI.hide(); retry(); }, true); bind('bOk', () => { UI.hide(); ok(); });
  },
  dead(o) {
    show(`<div class="logo small">SMUSHED!</div><p>Even rubber dragons have their limits. The Nest nurses will patch you up (for a small fee).</p>
      <div class="btns"><button class="btn" id="bRe">Wake up at the Nest</button></div>
      <p class="foot">You keep your XP, perks and eggs. A Fairy in a Jar from the Nest Shop revives you on the spot.</p>`);
    bind('bRe', () => { UI.hide(); o.respawn(); }, true);
  },
  levelUp(o, pick) {
    const cards = o.options.map((p, i) => `<button class="perk" data-i="${i}"><span class="pic">${p.icon}</span><b>${esc(p.name)}</b>
      <small>${esc(p.desc)}</small><span class="pips">${'●'.repeat(p.have)}${'○'.repeat(p.max - p.have)}</span><kbd>${i + 1}</kbd></button>`).join('');
    show(`<p class="sub">Level ${o.plv}!</p><h2>Choose a perk</h2><div class="perks">${cards}</div>`, true);
    pickFns = o.options.map(p => () => { UI.hide(); pick(p.id); });
    ui.querySelectorAll('.perk').forEach((b, i) => b.onclick = () => { UI.onAction && UI.onAction(); pickFns[i](); });
  },
  pause(o) {
    const s = o.stats;
    const perks = s.perks.map(p => `<span class="chip" title="${esc(p.desc)}">${p.icon} ${esc(p.name)} ×${p.n}</span>`).join('') || '<small>No perks yet - level up!</small>';
    show(`<h2>Paused</h2>
      <div class="statgrid"><span>Lv <b>${s.plv}</b></span><span>🪙 <b>${s.coins}</b></span><span>⭐ <b>${s.mission}/${s.missions}</b> missions</span>
        <span>🥚 <b>${s.eggs}/${s.totalEggs}</b> eggs</span><span>🛹 <b>${s.stunts}/${s.ramps}</b> stunts</span><span>💥 <b>${s.kills}</b> smushed</span></div>
      <div class="btns col"><button class="btn" id="bRes">Resume</button><button class="btn ghost" id="bMap">🗺️ Map</button>
      ${o.quitMission ? '<button class="btn ghost" id="bQuit">Abandon mission</button>' : ''}
      <button class="btn ghost" id="bMute">${o.muted ? '🔇 Sound: off' : '🔊 Sound: on'}</button>
      <button class="btn ghost" id="bMus">${o.music ? '🎵 Music: on' : '🎵 Music: off'}</button>
      <button class="btn ghost" id="bGfx">🖥️ Graphics: ${esc(o.quality)}</button></div>
      <p class="sub">Perks</p><div class="chips">${perks}</div>
      <div class="how">${CONTROLS}</div>
      <button class="btn ghost small" id="bReset" style="margin-top:10px">Erase save</button>`);
    bind('bRes', o.resume, true); bind('bMap', o.map); if (o.quitMission) bind('bQuit', o.quitMission);
    bind('bMute', () => { const m = o.toggleMute(); document.getElementById('bMute').textContent = m ? '🔇 Sound: off' : '🔊 Sound: on'; });
    bind('bMus', () => { const m = o.toggleMusic(); document.getElementById('bMus').textContent = m ? '🎵 Music: on' : '🎵 Music: off'; });
    bind('bGfx', () => { const q = o.cycleQuality(); document.getElementById('bGfx').textContent = '🖥️ Graphics: ' + q; });
    bind('bReset', o.reset);
  },
  nest(o, cb) {
    show(`<p class="sub">${esc(o.name)}</p><div class="giver">🪺</div><h2>Welcome home, puffling</h2>
      <p>Hearts refilled and game saved. The Boot Patrol won't look for you here.</p>
      <div class="statgrid"><span>🪙 <b>${o.save.coins}</b></span><span>❤️ <b>${o.maxHp / 2}</b> hearts</span><span>⭐ <b>${o.mission}/${o.missions}</b></span>
        <span>🥚 <b>${o.eggs}/${o.totalEggs}</b></span><span>🛹 <b>${o.stunts}/${o.ramps}</b></span><span>Lv <b>${o.save.plv}</b></span></div>
      <div class="btns col"><button class="btn alt" id="bShop">🛒 Nest Shop</button><button class="btn ghost" id="bCol">🎨 Change colour</button><button class="btn" id="bLeave">Back outside</button></div>
      <p class="foot">Every 6 golden eggs = +1 heart. Every 3 eggs unlocks a new colour.</p>`);
    bind('bShop', cb.shop); bind('bCol', cb.colors); bind('bLeave', () => { UI.hide(); cb.leave(); }, true);
  },
  shop(save, buy, back) {
    const render = () => {
      const items = Object.entries(SHOP).map(([id, it]) => {
        const have = save.shop[id] | 0, max = it.consumable ? 1 : it.cost.length, done = have >= max;
        const cost = it.cost[it.consumable ? 0 : Math.min(have, it.cost.length - 1)];
        const pips = it.consumable ? (have ? 'held' : '') : '●'.repeat(have) + '○'.repeat(max - have);
        return `<div class="up"><span class="ic">${it.icon}</span><span class="in"><b>${esc(it.name)}</b> <span class="pips">${pips}</span><br><small>${esc(it.desc)}</small></span>
          <button class="btn small${done || save.coins < cost ? ' dis' : ''}" data-id="${id}">${done ? (it.consumable ? 'HELD' : 'MAX') : '🪙 ' + cost}</button></div>`;
      }).join('');
      show(`<h2>🛒 Nest Shop</h2><p class="big">🪙 ${save.coins}</p><div class="ups">${items}</div>
        <div class="btns"><button class="btn" id="bBack">Back</button></div>`);
      ui.querySelectorAll('.up .btn').forEach(b => b.onclick = () => { UI.onAction && UI.onAction(); if (buy(b.dataset.id)) render(); else b.classList.add('shake'); });
      bind('bBack', back, true);
    };
    render();
  },
  colors(save, eggs, pick, back) {
    const unlocked = Math.min(HIDES.length, 3 + Math.floor(eggs / 3));
    const render = () => {
      const sw = HIDES.map((c, i) => `<button class="sw${i === save.hide ? ' on' : ''}${i >= unlocked ? ' locked' : ''}" data-i="${i}" style="--c:${hex(c)}" ${i >= unlocked ? 'disabled' : ''}>
        <span></span><small>${i >= unlocked ? '🥚 ' + ((i - 2) * 3) : HIDE_NAMES[i]}</small></button>`).join('');
      show(`<h2>🎨 Dragon Colours</h2><p>Every three golden eggs unlocks a new hide colour.</p><div class="sws">${sw}</div>
        <div class="btns"><button class="btn" id="bBack">Done</button></div>`);
      ui.querySelectorAll('.sw:not(.locked)').forEach(b => b.onclick = () => { pick(+b.dataset.i); render(); });
      bind('bBack', back, true);
    };
    render();
  },
  ending(o, back) {
    show(`<div class="logo small">THE BOOT IS BEATEN</div>
      <p class="tag">The Great Boot lies laceless in its own factory yard. Every caged Smushling bounces home and Smushville throws the squeakiest party in history.</p>
      <div class="statgrid"><span>🥚 <b>${o.eggs}/${o.total}</b> eggs</span><span>🛹 <b>${o.stunts}/${o.ramps}</b> stunts</span><span>Lv <b>${o.plv}</b></span></div>
      <p>The city is still yours. Hunt the remaining eggs, nail every stunt jump, and see how long you can survive five boots of heat.</p>
      <div class="btns"><button class="btn" id="bOk">Keep playing</button></div>`);
    bind('bOk', () => { UI.hide(); back(); }, true);
  },
};

/* ================================================================== HUD */
const hud = document.getElementById('hud'), hx = hud.getContext('2d');
let HW = 0, HH = 0, HD = 1;
const FONT = '"Baloo 2","Trebuchet MS",Verdana,sans-serif';
const PV = new Vector3();
export const HUD = {
  resize() { HD = Math.min(devicePixelRatio || 1, 2); HW = innerWidth; HH = innerHeight; hud.width = HW * HD; hud.height = HH * HD; },
  draw(G, camera, Save, H) {
    hx.setTransform(HD, 0, 0, HD, 0, 0);
    hx.clearRect(0, 0, HW, HH);
    if (!['play', 'dying', 'pause', 'levelup', 'modal', 'map'].includes(G.mode) || !G.P) return;
    const P = G.P, s = Math.min(1, Math.max(0.68, Math.min(HW / 1150, HH / 720)));
    hx.save(); hx.scale(s, s);
    const W = HW / s, Hh = HH / s;
    if (G.mode === 'map') { drawMap(G, W, Hh, Save); hx.restore(); return; }

    /* hurt vignette */
    const low = P.hp <= 3 && P.hp > 0;
    const va = G.hurtFlash * 1.2 + (low ? 0.16 + Math.sin(G.time * 6) * 0.08 : 0);
    if (va > 0.01) {
      const g = hx.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.35, W / 2, Hh / 2, Math.max(W, Hh) * 0.75);
      g.addColorStop(0, 'rgba(255,40,80,0)'); g.addColorStop(1, `rgba(255,40,80,${Math.min(0.55, va)})`);
      hx.fillStyle = g; hx.fillRect(0, 0, W, Hh);
    }
    /* floating text */
    for (const f of G.floats) {
      PV.set(f.x, f.y + f.t * 1.2, f.z).project(camera);
      if (PV.z > 1) continue;
      const u = f.t / f.life, a = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1, pop = 1 + Math.max(0, 0.15 - f.t) * 3;
      hx.globalAlpha = a; text(f.text, (PV.x + 1) / 2 * W, (1 - PV.y) / 2 * Hh, f.size * pop, f.color, 'center');
    }
    hx.globalAlpha = 1;

    /* crosshair */
    if (!P.car && G.mode === 'play') {
      const cx = W / 2, cy = Hh * 0.44;
      hx.strokeStyle = G.hitMarker > 0 ? '#ff5d8f' : 'rgba(255,255,255,.9)'; hx.lineWidth = 2;
      hx.beginPath(); hx.arc(cx, cy, 9, 0, 7); hx.stroke();
      hx.fillStyle = '#fff'; hx.beginPath(); hx.arc(cx, cy, 2, 0, 7); hx.fill();
      if (G.hitMarker > 0) { hx.beginPath(); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { hx.moveTo(cx + a * 6, cy + b * 6); hx.lineTo(cx + a * 12, cy + b * 12); } hx.stroke(); }
    }

    /* radar + health + xp, bottom left */
    /* on touch screens the radar lives top-left, out from under the joystick thumb */
    const T = G.touchOn, L0 = T ? 14 : 22;
    const R = T ? 58 : 82, rx = L0 + R, ry = T ? 14 + R : Hh - 34 - R;
    radar(G, rx, ry, R);
    const max = P.st.maxHp, nH = Math.ceil(max / 2), rows = Math.ceil(nH / 10);
    const hy = T ? ry + R + 22 : ry - R - 28;
    for (let i = 0; i < nH; i++) {
      const x = L0 + 11 + (i % 10) * 22, y = hy + Math.floor(i / 10) * 22 * (T ? 1 : -1), v = P.hp - i * 2;
      heart(x, y, 9 * (low && v > 0 ? 1 + Math.max(0, Math.sin(G.time * 8)) * 0.12 : 1), v >= 2 ? 1 : v === 1 ? 0.5 : 0);
    }
    for (let i = 0; i < P.shield; i++) { hx.fillStyle = 'rgba(103,232,249,.6)'; hx.beginPath(); hx.arc(L0 + 11 + (nH + i) * 22, hy, 8, 0, 7); hx.fill(); }
    const need = H.xpNeed(Save.d.plv), xy = T ? hy + (rows - 1) * 22 + 16 : ry + R + 10;
    hx.fillStyle = 'rgba(20,10,40,.6)'; round(L0, xy, R * 2, 9, 5); hx.fill();
    hx.fillStyle = G.xpPulse > 0 ? '#fff' : '#7df9ff'; round(L0, xy, Math.max(5, R * 2 * Math.min(1, Save.d.xp / need)), 9, 5); hx.fill();
    text('LV ' + Save.d.plv, L0 + R * 2 + 8, xy + 9, 14, '#7df9ff', 'left');
    /* ability cooldowns beside the radar */
    if (!G.touchOn) [['💨', P.dashCd, 0.55, 'SHIFT'], ['🌀', P.spinCd, 0.6, 'Q']].forEach(([ic, cd, mx, key], i) => {
      const x = rx + R + 30, y = ry - 30 + i * 52;
      hx.fillStyle = 'rgba(20,10,40,.6)'; hx.beginPath(); hx.arc(x, y, 19, 0, 7); hx.fill();
      text(ic, x, y + 7, 18, '#fff', 'center', 0);
      if (cd > 0) { hx.fillStyle = 'rgba(0,0,0,.55)'; hx.beginPath(); hx.moveTo(x, y); hx.arc(x, y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, cd / mx)); hx.fill(); }
      text(key, x, y + 31, 10, '#d8cff0', 'center');
    });
    /* power-ups */
    let px = L0;
    for (const k in P.pu) {
      const d = H.POWERUPS[k], t = P.pu[k], y = T ? xy + 20 : ry - R - 78;
      hx.fillStyle = 'rgba(20,10,40,.6)'; round(px, y, 40, 40, 10); hx.fill();
      text(d.icon, px + 20, y + 27, 20, '#fff', 'center', 0);
      hx.fillStyle = hex(d.color); round(px + 4, y + 34, 32 * Math.min(1, t / d.dur), 4, 2); hx.fill();
      px += 46;
    }

    /* top right: coins, heat, clock */
    text('🪙 ' + Save.d.coins, W - 20, 38, 24 * (1 + G.coinPulse * 0.6), '#ffd166', 'right');
    const st = H.stars;
    for (let i = 0; i < 5; i++) {
      const on = i < st, flash = on && !G.seen && G.evadeT > 1 && Math.floor(G.time * 4) % 2;
      hx.globalAlpha = on ? (flash ? 0.35 : 1) : 0.22;
      text('🥾', W - 26 - (4 - i) * 30, 74, 24, '#fff', 'center', 0);
    }
    hx.globalAlpha = 1;
    const hrs = (G.dayT * 24 + 6) % 24;
    text(`${String(Math.floor(hrs)).padStart(2, '0')}:${String(Math.floor((hrs % 1) * 60)).padStart(2, '0')}`, W - 20, 104, 15, 'rgba(255,255,255,.8)', 'right');

    /* car: speedo + damage */
    if (P.car) {
      const c = P.car, sp = Math.abs(c.speed) * 3.6;
      const sy = T ? 150 : Hh - 52;
      text(Math.round(sp), W - 70, sy, 44, '#fff', 'right');
      text('squeaks/h', W - 20, sy, 13, '#d8cff0', 'right');
      hx.fillStyle = 'rgba(20,10,40,.6)'; round(W - 190, sy + 12, 170, 10, 5); hx.fill();
      const f = Math.max(0, c.hp / c.maxHp);
      hx.fillStyle = f > 0.5 ? '#86efac' : f > 0.25 ? '#ffd166' : '#ff5d8f'; round(W - 190, sy + 12, 170 * f, 10, 5); hx.fill();
      text('🚗', W - 200, sy + 22, 16, '#fff', 'right', 0);
    }

    /* boss bar */
    if (G.boss) {
      const b = G.boss, bw = Math.min(520, W * 0.5), bx = W / 2 - bw / 2, by = 18;
      text(b.def.name, W / 2, by + 14, 18, '#ff9ec4', 'center');
      hx.fillStyle = 'rgba(20,10,40,.7)'; round(bx - 3, by + 22, bw + 6, 18, 9); hx.fill();
      const f = Math.max(0, b.hp / b.maxHp);
      b.shownHp = b.shownHp === undefined ? f : b.shownHp + (f - b.shownHp) * 0.06;
      hx.fillStyle = '#fff'; round(bx, by + 25, bw * b.shownHp, 12, 6); hx.fill();
      hx.fillStyle = b.dmgTake > 1 ? '#ffd166' : '#ff5d8f'; round(bx, by + 25, bw * f, 12, 6); hx.fill();
    }
    /* mission timer + objective */
    const ms = G.mission;
    if (ms && ms.timed) text('⏱ ' + fmtT(ms.timer), W / 2, G.boss ? 84 : 40, 30, ms.timer < 10 ? '#ff5d8f' : '#ffffff', 'center');
    if (G.objective) {
      const obj = G.forDevice ? G.forDevice(G.objective) : G.objective;
      hx.font = `700 18px ${FONT}`;
      const tw = Math.min(W - 40, hx.measureText(obj).width + 36), y = T ? (G.boss ? 100 : ms && ms.timed ? 82 : 46) + 6 : Hh - 46;
      hx.fillStyle = 'rgba(20,10,40,.7)'; round(W / 2 - tw / 2, y - 24, tw, 34, 12); hx.fill();
      text(obj, W / 2, y, 18, '#ffd166', 'center', 0);
    }
    if (G.prompt && G.mode === 'play' && !T) {
      const y = Hh - (G.touchOn ? 250 : 96);
      hx.font = `700 17px ${FONT}`; const tw = hx.measureText(G.prompt).width + 30;
      hx.fillStyle = 'rgba(255,209,102,.92)'; round(W / 2 - tw / 2, y - 22, tw, 32, 12); hx.fill();
      text(G.prompt, W / 2, y, 17, '#2b1b3d', 'center', 0);
    }
    if (!G.locked && !G.touchOn && G.mode === 'play' && !H.pad) text('click to grab the mouse for camera control', W / 2, Hh * 0.44 + 44, 13, 'rgba(255,255,255,.6)', 'center');

    /* combo */
    const c = G.combo;
    if (c.n >= 2 && c.t > 0) {
      const x = W - 70, y = Hh * 0.45;
      text(c.n + 'x', x, y, 40, c.n >= 20 ? '#ff5d8f' : c.n >= 10 ? '#ffd166' : '#ffffff', 'center');
      text('COMBO', x, y + 20, 13, '#d8cff0', 'center');
    }
    /* banner + toast */
    if (G.banner) {
      const b = G.banner, u = 1 - b.t / b.max, a = b.t < 0.4 ? b.t / 0.4 : 1, pop = u < 0.12 ? 0.6 + u / 0.12 * 0.4 + Math.sin(u / 0.12 * Math.PI) * 0.15 : 1;
      hx.globalAlpha = a;
      text(b.text, W / 2, Hh * 0.27, 46 * pop, b.color, 'center', 6);
      if (b.sub) text(b.sub, W / 2, Hh * 0.27 + 34, 20, '#ffffff', 'center');
      hx.globalAlpha = 1;
    }
    if (G.toast) {
      const t = G.toast; hx.globalAlpha = Math.min(1, t.t / 0.3);
      hx.font = `700 16px ${FONT}`;
      const lines = wrap(t.text, Math.min(560, W - 80));
      const bh = lines.length * 21 + 14, bw = Math.min(600, W - 40), bx = W / 2 - bw / 2, by = T ? 92 : 120;
      hx.fillStyle = 'rgba(20,10,40,.8)'; round(bx, by, bw, bh, 14); hx.fill();
      lines.forEach((l, i) => text(l, W / 2, by + 24 + i * 21, 16, '#fff', 'center', 0));
      hx.globalAlpha = 1;
    }
    hx.restore();
  },
};

function radar(G, cx, cy, R) {
  const P = G.P, city = G.city, k = city.mapScale, yaw = G.cam.yaw;
  const px = P.car ? P.car.x : P.x, pz = P.car ? P.car.z : P.z;
  const zoom = P.car ? 0.85 : 1.25;
  const pxPerWorld = R / 55 * zoom;
  hx.save();
  hx.beginPath(); hx.arc(cx, cy, R, 0, 7); hx.closePath();
  hx.fillStyle = '#2b1b3d'; hx.fill(); hx.clip();
  hx.translate(cx, cy); hx.rotate(yaw);
  hx.scale(pxPerWorld / k, pxPerWorld / k);
  hx.drawImage(city.mapCanvas, -(px - city.land0) * k, -(pz - city.land0) * k);
  hx.restore();
  const toR = (x, z, clampEdge) => {
    let dx = (x - px) * pxPerWorld, dz = (z - pz) * pxPerWorld;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    let sx = dx * c - dz * s, sy = dx * s + dz * c;
    const l = Math.hypot(sx, sy);
    if (l > R - 8) { if (!clampEdge) return null; sx *= (R - 8) / l; sy *= (R - 8) / l; }
    return [cx + sx, cy + sy];
  };
  hx.save(); hx.beginPath(); hx.arc(cx, cy, R, 0, 7); hx.clip();
  for (const n of city.nests) { const p = toR(n.x, n.z, true); if (p) text('🏠', p[0], p[1] + 6, 15, '#fff', 'center', 0); }
  for (const g of G.gangs) { const p = toR(g.x, g.z, false); if (p) { hx.fillStyle = GANGS[g.gang].color; hx.globalAlpha = 0.35; hx.beginPath(); hx.arc(p[0], p[1], 14, 0, 7); hx.fill(); hx.globalAlpha = 1; } }
  for (const e of G.enemies) {
    if (e.dead || !(e.aggro || e.mission)) continue;
    const p = toR(e.x, e.z, false); if (!p) continue;
    hx.fillStyle = e.patrol ? (Math.floor(G.time * 6) % 2 ? '#3b82f6' : '#ff3b3b') : e.boss ? '#ff5d8f' : '#ff4d4d';
    hx.beginPath(); hx.arc(p[0], p[1], e.boss ? 6 : 3.5, 0, 7); hx.fill();
  }
  for (const c of G.cars) if (c.driver === 'cop' && !c.dead) { const p = toR(c.x, c.z, false); if (p) { hx.fillStyle = Math.floor(G.time * 6) % 2 ? '#3b82f6' : '#ff3b3b'; hx.fillRect(p[0] - 4, p[1] - 4, 8, 8); } }
  for (const c of G.cages) if (!c.dead) { const p = toR(c.x, c.z, true); if (p) text('🐉', p[0], p[1] + 5, 12, '#fff', 'center', 0); }
  if (G.missionBlip && !G.mission) { const p = toR(G.missionBlip.x, G.missionBlip.z, true); text('⭐', p[0], p[1] + 7, 18, '#fff', 'center', 0); }
  const goal = G.goalBlip || G.goal;
  if (goal) { const p = toR(goal.x, goal.z, true); hx.fillStyle = '#ffd166'; hx.strokeStyle = '#2b1b3d'; hx.lineWidth = 2; hx.beginPath(); hx.arc(p[0], p[1], 6, 0, 7); hx.fill(); hx.stroke(); }
  hx.restore();
  /* the player arrow */
  const f = P.car ? P.car.h : P.face;
  const ax = Math.sin(f), az = Math.cos(f), c = Math.cos(yaw), s = Math.sin(yaw);
  const dx = ax * c - az * s, dy = ax * s + az * c, ang = Math.atan2(dy, dx);
  hx.save(); hx.translate(cx, cy); hx.rotate(ang);
  hx.fillStyle = '#fff'; hx.strokeStyle = '#2b1b3d'; hx.lineWidth = 2;
  hx.beginPath(); hx.moveTo(9, 0); hx.lineTo(-6, -6); hx.lineTo(-3, 0); hx.lineTo(-6, 6); hx.closePath(); hx.fill(); hx.stroke();
  hx.restore();
  hx.strokeStyle = 'rgba(255,255,255,.7)'; hx.lineWidth = 3; hx.beginPath(); hx.arc(cx, cy, R, 0, 7); hx.stroke();
  const ny = toNorth(yaw); text('N', cx + ny[0] * (R - 10), cy + ny[1] * (R - 10) + 5, 13, '#ffd166', 'center');
}
function toNorth(yaw) { return [Math.sin(yaw), -Math.cos(yaw)]; }
function drawMap(G, W, Hh, Save) {
  const city = G.city, img = city.mapCanvas, size = Math.min(W - 60, Hh - 110), x0 = W / 2 - size / 2, y0 = 70;
  hx.fillStyle = 'rgba(20,10,40,.85)'; hx.fillRect(0, 0, W, Hh);
  hx.drawImage(img, x0, y0, size, size);
  hx.strokeStyle = 'rgba(255,255,255,.6)'; hx.lineWidth = 3; hx.strokeRect(x0, y0, size, size);
  const k = size / (city.land1 - city.land0);
  const at = (x, z) => [x0 + (x - city.land0) * k, y0 + (z - city.land0) * k];
  DISTRICTS.forEach((d, i) => { const [x, y] = at(i % 2 ? 285 : 95, i >= 2 ? 285 : 95); text(d.name, x, y, 18, d.color, 'center'); });
  for (const b of city.blocks) if (b.name) { const [x, y] = at(b.cx, b.cz + 10); text(b.name, x, y, 11, 'rgba(255,255,255,.85)', 'center'); }
  for (const n of city.nests) { const [x, y] = at(n.x, n.z); text('🏠', x, y + 6, 18, '#fff', 'center', 0); }
  for (const g of G.gangs) { const [x, y] = at(g.x, g.z); text('💀', x, y + 6, 18, '#fff', 'center', 0); }
  for (const a of Object.values(city.arenas)) { const [x, y] = at(a.x, a.z); text('👑', x, y + 6, 16, '#fff', 'center', 0); }
  if (G.missionBlip && !G.mission) { const [x, y] = at(G.missionBlip.x, G.missionBlip.z); text('⭐', x, y + 8, 26, '#fff', 'center', 0); }
  const goal = G.goalBlip || G.goal;
  if (goal) { const [x, y] = at(goal.x, goal.z); hx.fillStyle = '#ffd166'; hx.beginPath(); hx.arc(x, y, 8, 0, 7); hx.fill(); }
  const P = G.P, [px, py] = at(P.car ? P.car.x : P.x, P.car ? P.car.z : P.z);
  const f = P.car ? P.car.h : P.face;
  hx.save(); hx.translate(px, py); hx.rotate(Math.atan2(Math.cos(f), Math.sin(f)));
  hx.fillStyle = '#fff'; hx.strokeStyle = '#ff5d8f'; hx.lineWidth = 3;
  hx.beginPath(); hx.moveTo(12, 0); hx.lineTo(-8, -8); hx.lineTo(-4, 0); hx.lineTo(-8, 8); hx.closePath(); hx.fill(); hx.stroke();
  hx.restore();
  text('SMUSHVILLE', W / 2, 46, 30, '#ffd166', 'center');
  text(`🏠 Nest   💀 Gang turf   👑 Boss arena   ⭐ Next mission   🥚 ${Save.eggs()} / ${city.eggs.length} golden eggs found   ·   M or ESC to close`, W / 2, y0 + size + 28, 15, '#fff', 'center');
}

function text(t, x, y, size, color, align = 'left', outline = 4) {
  hx.font = `800 ${size}px ${FONT}`; hx.textAlign = align;
  if (outline) { hx.lineJoin = 'round'; hx.lineWidth = outline; hx.strokeStyle = 'rgba(25,12,45,.9)'; hx.strokeText(t, x, y); }
  hx.fillStyle = color; hx.fillText(t, x, y);
}
function wrap(t, w) {
  const words = String(t).split(' '), out = []; let cur = '';
  for (const wd of words) { const n = cur ? cur + ' ' + wd : wd; if (hx.measureText(n).width > w && cur) { out.push(cur); cur = wd; } else cur = n; }
  if (cur) out.push(cur); return out;
}
function round(x, y, w, h, r) { hx.beginPath(); if (hx.roundRect) hx.roundRect(x, y, Math.max(0, w), h, Math.min(r, w / 2, h / 2)); else hx.rect(x, y, w, h); }
function heartPath(x, y, r) {
  hx.beginPath(); hx.moveTo(x, y + r * 0.9);
  hx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.9, y - r * 1.2, x, y - r * 0.45);
  hx.bezierCurveTo(x + r * 0.9, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
}
function heart(x, y, r, fill) {
  heartPath(x, y, r); hx.fillStyle = 'rgba(25,12,45,.75)'; hx.fill();
  hx.lineWidth = 3; hx.strokeStyle = 'rgba(25,12,45,.9)'; hx.stroke();
  if (fill > 0) {
    hx.save(); heartPath(x, y, r * 0.86); hx.clip();
    hx.fillStyle = '#ff3b6b'; hx.fillRect(x - r * 1.5, y - r * 1.5, r * 3 * (fill === 1 ? 1 : 0.5), r * 3);
    hx.fillStyle = 'rgba(255,255,255,.45)'; hx.beginPath(); hx.arc(x - r * 0.4, y - r * 0.35, r * 0.25, 0, 7); hx.fill();
    hx.restore();
  }
}
