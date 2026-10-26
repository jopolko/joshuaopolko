/* Smushlings Quest: Smushville - static data: districts, enemies, perks, power-ups, shop, save */

export const rng = (seed) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;

/* four districts, one per quarter of the island */
export const DISTRICTS = [
  { name: 'Nursery Hills', color: '#86efac', ground: '#8fd66f', ground2: '#9fe07f', song: 'w0',
    bldg: [0xfff1d6, 0xffd6e0, 0xd6f0ff, 0xfff0a8, 0xe6dcff], roof: [0xff6b6b, 0x5fb7e5, 0xffa94d, 0x9b8cc4] },
  { name: 'Closet Downtown', color: '#c4b5fd', ground: '#7c7394', ground2: '#857c9e', song: 'w2',
    bldg: [0xb8a9e8, 0x8fa3d9, 0xd9c2f0, 0x9fd3e0, 0xe3d6b5, 0xc7c7d6], roof: [0x5e4a96, 0x3d2d66] },
  { name: 'Bathtub Beach', color: '#7dd3fc', ground: '#f2dfaa', ground2: '#ead39a', song: 'w1',
    bldg: [0xffffff, 0xffd1dc, 0xbfe8ff, 0xfff3b0, 0xc8f7d7], roof: [0xff8fab, 0x4fc3f7, 0xffd166] },
  { name: 'Boot Factory', color: '#fb923c', ground: '#8c8f98', ground2: '#82858e', song: 'w3',
    bldg: [0xb8bcc6, 0xa09a92, 0xc9b79c, 0x8d99a6], roof: [0xf2b134, 0x4b4f5c] },
];

/* hp is in puff hits; dmg in half-hearts */
export const ENEMIES = {
  slime: { name: 'Sock Slime', hp: 3, speed: 2.4, r: 0.42, dmg: 1, xp: 2, coins: 1, color: 0x8be9a8 },
  bunny: { name: 'Lint Bunny', hp: 2, speed: 4.2, r: 0.32, dmg: 1, xp: 2, coins: 1, color: 0xd9d2f0 },
  duck: { name: 'Squeaky Turret', hp: 4, speed: 0.6, r: 0.42, dmg: 1, xp: 3, coins: 2, color: 0xffd84a },
  soldier: { name: 'Toy Trooper', hp: 5, speed: 2.0, r: 0.4, dmg: 1, xp: 4, coins: 2, color: 0xe2454b },
  bat: { name: 'Dust Moth', hp: 2, speed: 3.6, r: 0.34, dmg: 1, xp: 3, coins: 1, color: 0x9b8cc4, fly: true },
  bomber: { name: 'Jack-in-the-Bomb', hp: 4, speed: 1.6, r: 0.42, dmg: 2, xp: 4, coins: 2, color: 0x5ec2ff },
  roller: { name: 'Spiky Marble', hp: 10, speed: 4.0, r: 0.45, dmg: 2, xp: 4, coins: 2, color: 0xb04ad8 },
  ghost: { name: 'Sock Ghost', hp: 4, speed: 2.2, r: 0.42, dmg: 1, xp: 4, coins: 2, color: 0xf2f0ff, fly: true },
  knight: { name: 'Tin Knight', hp: 9, speed: 1.6, r: 0.48, dmg: 2, xp: 7, coins: 3, color: 0xb9c2d0 },
  spawner: { name: 'Lint Nest', hp: 12, speed: 0, r: 0.6, dmg: 1, xp: 8, coins: 4, color: 0xa69cb8 },
  mage: { name: 'Shoehorn Shaman', hp: 5, speed: 1.8, r: 0.38, dmg: 2, xp: 6, coins: 3, color: 0x8b5cf6 },
  turret: { name: 'Sprinkler Bot', hp: 11, speed: 0, r: 0.55, dmg: 2, xp: 7, coins: 3, color: 0x94a3b8 },
  imp: { name: 'Ember Imp', hp: 2, speed: 5.0, r: 0.32, dmg: 2, xp: 3, coins: 1, color: 0xff7a2a },
  minislime: { name: 'Sockling', hp: 2, speed: 3.2, r: 0.3, dmg: 1, xp: 1, coins: 1, color: 0x8be9a8 },
  duckling: { name: 'Duckling', hp: 3, speed: 0.8, r: 0.32, dmg: 1, xp: 1, coins: 1, color: 0xffe066 },
  dummy: { name: 'Training Block', hp: 3, speed: 0, r: 0.5, dmg: 0, xp: 2, coins: 1, color: 0xffd166 },
  patrol: { name: 'Boot Patrol', hp: 8, speed: 3.6, r: 0.55, dmg: 2, xp: 5, coins: 2, color: 0xc98a3a },
};

/* gangs hang out in one block each and come back a while after you clear them */
export const GANGS = {
  sock: { name: 'Sock Gang', pool: ['slime', 'slime', 'bunny', 'minislime', 'spawner'], color: '#86efac' },
  duck: { name: 'Duck Mafia', pool: ['duck', 'duck', 'bomber', 'bat'], color: '#fde047' },
  knight: { name: 'Tin Legion', pool: ['knight', 'soldier', 'mage', 'ghost'], color: '#c4b5fd' },
  imp: { name: 'Ember Crew', pool: ['imp', 'imp', 'turret', 'bomber', 'roller'], color: '#fb923c' },
};

export const BOSSES = {
  king: { name: 'KING SOCKINGTON', sub: 'Lord of the Lost Socks', hp: 60 },
  duck: { name: 'ADMIRAL QUACKERS', sub: 'Terror of the Tub', hp: 110 },
  serpent: { name: 'TANGLE', sub: 'The Lace Serpent', hp: 130 },
  boot: { name: 'THE GREAT BOOT', sub: 'Boot of Destiny', hp: 220 },
};

/* level-up choices */
export const PERKS = {
  heart: { name: 'Big Heart', icon: '❤️', desc: '+1 heart container and heal fully.', max: 5 },
  fire: { name: 'Flame Breath', icon: '🔥', desc: 'Puffs become fireballs: +60% damage and they set enemies alight.', max: 1 },
  teeth: { name: 'Sharp Teeth', icon: '🦷', desc: '+25% damage.', max: 6 },
  rapid: { name: 'Rapid Puffs', icon: '💨', desc: 'Puff 20% faster.', max: 5 },
  twin: { name: 'Twin Breath', icon: '✌️', desc: '+1 puff per shot, in a spread.', max: 2 },
  feet: { name: 'Swift Feet', icon: '🦶', desc: '+8% run speed.', max: 4 },
  lucky: { name: 'Lucky Scales', icon: '🍀', desc: '+8% critical hit chance (crits do 2.5x).', max: 5 },
  pierce: { name: 'Piercing Puffs', icon: '📌', desc: 'Puffs pass through +1 enemy.', max: 3 },
  tail: { name: 'Big Tail', icon: '🌀', desc: 'Tail spin is 25% bigger and hits harder.', max: 3 },
  dashstrike: { name: 'Battering Dash', icon: '🐏', desc: 'Dashing through enemies damages them.', max: 2 },
  vamp: { name: 'Snack Attack', icon: '🍪', desc: 'Smushed enemies drop hearts more often.', max: 3 },
  chain: { name: 'Pop Chain', icon: '🎆', desc: 'Smushed enemies burst, hurting their neighbours.', max: 3 },
  magnet: { name: 'Shiny Sense', icon: '🧲', desc: 'Pick up coins from further away. +15% coins.', max: 3 },
  thick: { name: 'Thick Hide', icon: '🛡️', desc: '12% chance to shrug off a hit.', max: 3 },
  combo: { name: 'Combo King', icon: '👑', desc: 'Combos last longer and give more XP.', max: 3 },
  range: { name: 'Long Breath', icon: '🔭', desc: 'Puffs fly faster and further.', max: 2 },
  quake: { name: 'Aftershock', icon: '🌋', desc: 'Belly Flop is bigger and recharges faster.', max: 3 },
  wings: { name: 'Wiggle Wings', icon: '🪽', desc: '+1 extra mid-air jump.', max: 2 },
  driver: { name: 'Road Hog', icon: '🏎️', desc: 'Cars you drive are 12% faster and tougher.', max: 3 },
};

export const POWERUPS = {
  triple: { name: 'TRIPLE BREATH', icon: '🔱', color: 0x7dd3fc, dur: 15 },
  sugar: { name: 'SUGAR RUSH', icon: '🍭', color: 0xf472b6, dur: 12 },
  shield: { name: 'BUBBLE SHIELD', icon: '🫧', color: 0x67e8f9, dur: 0 },
  mega: { name: 'MEGA SMUSH', icon: '🦖', color: 0xff5d8f, dur: 10 },
  magnet: { name: 'COIN MAGNET', icon: '🧲', color: 0xfacc15, dur: 20 },
  rage: { name: 'DRAGON RAGE', icon: '😤', color: 0xef4444, dur: 12 },
  slow: { name: 'SLOW-MO', icon: '🐌', color: 0xa78bfa, dur: 8 },
};

export const SHOP = {
  heart: { name: 'Heart Container', icon: '❤️', desc: '+1 heart, permanently.', cost: [60, 120, 200, 320, 480] },
  claws: { name: 'Sharp Claws', icon: '🗡️', desc: '+12% damage, permanently.', cost: [90, 180, 300] },
  fairy: { name: 'Fairy in a Jar', icon: '🧚', desc: 'Revives you once with full hearts. Held until used.', cost: [50], consumable: true },
  charm: { name: 'Bubble Charm', icon: '🫧', desc: 'Respawn with a Bubble Shield.', cost: [150] },
  wallet: { name: 'Lucky Wallet', icon: '👛', desc: '+25% coins from everything.', cost: [140] },
  armor: { name: 'Rubber Bumpers', icon: '🚗', desc: 'Every car you drive takes half damage.', cost: [180] },
};

export const HIDES = [0x4ade80, 0xf472b6, 0x38bdf8, 0xfacc15, 0xc084fc, 0xfb923c, 0x2dd4bf, 0xfb7185, 0xffffff, 0x1f2937];
export const HIDE_NAMES = ['Mint', 'Bubblegum', 'Sky', 'Butter', 'Grape', 'Tangerine', 'Teal', 'Rose', 'Ghost', 'Shadow'];

export const xpNeed = (lv) => Math.round(12 + lv * 8 + lv * lv * 0.8);

const KEY = 'sq_smushville_v1';
export const Save = {
  d: null,
  fresh() {
    return { mission: 0, eggs: {}, stunts: {}, plv: 1, xp: 0, perks: {}, coins: 0, shop: {}, hide: 0, seen: {},
      stats: { kills: 0, peds: 0, cars: 0, maxHeat: 0, time: 0 }, pos: null, done: false };
  },
  load() {
    try { this.d = Object.assign(this.fresh(), JSON.parse(localStorage.getItem(KEY) || 'null') || {}); }
    catch (e) { this.d = this.fresh(); }
    return this.d;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { } },
  reset() { this.d = this.fresh(); this.save(); },
  eggs() { return Object.keys(this.d.eggs).length; },
};
