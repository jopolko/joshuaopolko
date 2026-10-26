/* Smushlings Quest: Smushville - story missions. Each mission is a list of steps the game runs in order.
   Step types: talk, go, spawn, cages, clear, orbs, race, heat, lose, setheat, boss, truck, getcar. */
import { roadC, LAND1 } from './city.js';

export function buildMissions(city) {
  const L = (name, dx = 0, dz = 0) => { const p = city.landmarks[name]; return [p.x + dx, p.z + dz]; };
  const I = (i, j) => [roadC(i), roadC(j)];
  const nest = (name) => { const n = city.nests.find(n => n.name === name); return [n.x, n.z + 10]; };
  const beach = LAND1 - 8;
  return [
    {
      name: 'Hatch Day', giver: 'Mama Smush', start: nest('Home Nest'), coins: 40, xp: 25,
      blurb: 'Learn to puff, jump and run like a proper Smushling.',
      steps: [
        { talk: "Rise and shine, little puff! The Great Boot has been stomping round Smushville again, and the Boot Patrol is scooping up our friends. You're small, you're rubbery, and you're our best hope. First: training. Run to Blanket Lot, north of here." },
        { go: L('Blanket Lot'), r: 12, text: 'Run to Blanket Lot (hold SHIFT to sprint)' },
        { spawn: [{ type: 'dummy', n: 5 }], at: L('Blanket Lot'), spread: 7 },
        { clear: true, text: 'Puff the 5 training blocks (LEFT CLICK / J)' },
        { orbs: [[...L('Blanket Lot', -4, 5), 1.5], [...L('Blanket Lot', 0, 5), 2.6], [...L('Blanket Lot', 4, 5), 3.3]], time: 45, text: 'Grab the orbs: SPACE to jump, SPACE again mid-air to double jump' },
        { talk: "Ooh, bouncy! Remember: SHIFT dashes (you can't be hurt mid-dash), Q spins your tail to swat bullets back, and C while in the air is a Belly Flop. Come back to the Nest when you want to heal or shop." },
      ],
    },
    {
      name: 'Borrowed Wheels', giver: 'Mama Smush', start: nest('Home Nest'), coins: 55, xp: 30,
      blurb: 'Every Smushling needs a ride. Borrow one.',
      steps: [
        { talk: "Smushville is big and your legs are short. Walk up to any car and press F to borrow it. The driver won't mind. Much." },
        { getcar: true, text: 'Get in a car (walk up to one and press F)' },
        { race: [I(2, 2), I(4, 2), I(4, 4), I(2, 4), I(2, 3)], time: 80, car: true, text: 'Drive through the checkpoints!' },
        { talk: "Not bad! SPACE is the handbrake for drifting, and those orange ramps all over town launch you sky-high. Stunt jumps pay out." },
      ],
    },
    {
      name: 'Sock It To \'Em', giver: 'Mama Smush', start: L('Sock Gang Laundromat', 22, 0), coins: 70, xp: 45,
      blurb: 'The Sock Gang is holding three friends at the laundromat.',
      steps: [
        { talk: "The Sock Gang has three of our friends locked up in cages behind their laundromat. Get in there, smush those socks, and break the cages open." },
        { go: L('Sock Gang Laundromat'), r: 15, text: 'Raid the Sock Gang Laundromat' },
        { spawn: [{ type: 'slime', n: 5 }, { type: 'bunny', n: 3 }, { type: 'spawner', n: 1 }], at: L('Sock Gang Laundromat', 0, 5), spread: 9 },
        { cages: 3, at: L('Sock Gang Laundromat', 0, 7), spread: 8 },
        { clear: true, text: 'Smush the Sock Gang and free your 3 friends' },
      ],
    },
    {
      name: 'King of the Hamper', giver: 'Mama Smush', start: L('Cradle Park', 0, 19), coins: 120, xp: 80,
      blurb: 'The Sock Gang\'s king is waiting in Cradle Park.',
      steps: [
        { talk: "That did it - King Sockington himself has rolled into Cradle Park. He's big, he's smelly, and he jumps. Watch for his shadow!" },
        { boss: 'king', at: L('Cradle Park') },
        { talk: "You beat a KING! Captain Puddles down at the beach has been asking for help. Head south to the Beach Nest." },
      ],
    },
    {
      name: 'Beach Bum Rush', giver: 'Captain Puddles', start: nest('Beach Nest'), coins: 80, xp: 50,
      blurb: 'Race the whole south shore before the tide comes in.',
      steps: [
        { talk: "Ahoy, puffling! Captain Puddles here. Before I trust you with my problems, show me you can drive. Grab a car and race the shore road - round the south of the island!" },
        { getcar: true, text: 'Get in a car' },
        { race: [[30, beach], [130, beach], [230, beach], [330, beach], [beach, 330], [beach, 240]], time: 90, car: true, text: 'Race along the beach!' },
      ],
    },
    {
      name: 'Duck Duck Loot', giver: 'Captain Puddles', start: L('Duck Mafia Docks', 22, 0), coins: 90, xp: 60,
      blurb: 'The Duck Mafia has four of our friends on their docks.',
      steps: [
        { talk: "The Duck Mafia has taken over the docks. Squeaky turrets, bombs, the works. They've got four Smushlings caged up. Spin your tail (Q) to send their bullets back!" },
        { go: L('Duck Mafia Docks'), r: 15, text: 'Storm the Duck Mafia Docks' },
        { spawn: [{ type: 'duck', n: 5 }, { type: 'bomber', n: 3 }, { type: 'bat', n: 3 }], at: L('Duck Mafia Docks', 0, 5), spread: 10 },
        { cages: 4, at: L('Duck Mafia Docks', 0, 6), spread: 9 },
        { clear: true, text: 'Smush the Duck Mafia and free your 4 friends' },
      ],
    },
    {
      name: 'Heat Wave', giver: 'Captain Puddles', start: L('Bubble Park', 0, 19), coins: 100, xp: 60,
      blurb: 'Lure the Boot Patrol out. Then lose them.',
      steps: [
        { talk: "The Admiral's guarded by the Boot Patrol. We need to see how they work. Cause some chaos - puff cars, bonk bystanders - until you've got 3 BOOTS of heat. Then lose them: get out of their sight and stay hidden." },
        { heat: 3, text: 'Cause chaos until you have 3 boots of HEAT' },
        { lose: true, text: 'Lose the Boot Patrol! Get out of sight' },
        { talk: "Ha! They couldn't find you. Now we know their tricks. Time to go after the Admiral himself..." },
      ],
    },
    {
      name: 'Admiral Quackers', giver: 'Captain Puddles', start: L('Squeaky Beach', 0, -19), coins: 150, xp: 100,
      blurb: 'The terror of the tub has surfaced on Squeaky Beach.',
      steps: [
        { boss: 'duck', at: L('Squeaky Beach') },
        { talk: "The Admiral is beaten! Professor Lint in Closet Downtown wants a word. Head to the Downtown Nest." },
      ],
    },
    {
      name: 'Closet Cleanup', giver: 'Professor Lint', start: L('Tin Legion HQ', -22, 0), coins: 110, xp: 75,
      blurb: 'The Tin Legion is shielded. Get behind them.',
      steps: [
        { talk: "Professor Lint, at your service. The Tin Legion has fortified their HQ. Their shields block puffs from the front - circle round, dash past, or Belly Flop them from above!" },
        { go: L('Tin Legion HQ'), r: 15, text: 'Assault Tin Legion HQ' },
        { spawn: [{ type: 'knight', n: 4 }, { type: 'soldier', n: 4 }], at: L('Tin Legion HQ', 0, 5), spread: 10 },
        { cages: 4, at: L('Tin Legion HQ', 0, 7), spread: 9 },
        { clear: true, text: 'Defeat the first wave and free your friends' },
        { spawn: [{ type: 'knight', n: 3, elite: true }, { type: 'mage', n: 3 }, { type: 'ghost', n: 3 }], at: L('Tin Legion HQ', 0, 4), spread: 9 },
        { clear: true, text: 'Reinforcements! Defeat the elite guard' },
      ],
    },
    {
      name: 'Rooftop Run', giver: 'Professor Lint', start: L('Skyline Steps', 0, 19), coins: 110, xp: 75,
      blurb: 'Climb Skyline Steps and grab every orb.',
      steps: [
        { talk: "My instruments are up on the Skyline Steps! Climb the spiral, grab the glowing orbs before they fade. Double jump and air-dash are your friends." },
        { orbs: city.orbSpots.map(o => [o.x, o.z, o.y]), time: 100, text: 'Climb Skyline Steps and grab every orb' },
      ],
    },
    {
      name: 'Tangle Downtown', giver: 'Professor Lint', start: L('Hanger Plaza', 0, 19), coins: 180, xp: 120,
      blurb: 'A giant lace serpent has slithered into Hanger Plaza.',
      steps: [
        { talk: "My readings say something very long and very tangled is under Hanger Plaza. Only its HEAD can be hurt. Mind the ground when it dives!" },
        { boss: 'serpent', at: L('Hanger Plaza') },
        { talk: "Untangled! One stop left: the Boot Factory. Grandpa Grommet is waiting at the Factory Nest." },
      ],
    },
    {
      name: 'Factory Floor', giver: 'Grandpa Grommet', start: nest('Factory Nest'), coins: 130, xp: 90,
      blurb: 'The Ember Crew guards the last caged Smushlings.',
      steps: [
        { talk: "Grandpa Grommet here. The Ember Crew runs the furnace for the Boot. Five Smushlings are caged inside. Those little imps explode - don't let them hug you!" },
        { go: L('Ember Crew Furnace'), r: 15, text: 'Raid the Ember Crew Furnace' },
        { spawn: [{ type: 'imp', n: 5 }, { type: 'turret', n: 2 }, { type: 'bomber', n: 3 }, { type: 'roller', n: 1 }], at: L('Ember Crew Furnace', 0, 5), spread: 10 },
        { cages: 5, at: L('Ember Crew Furnace', 0, 7), spread: 9 },
        { clear: true, text: 'Smush the Ember Crew and free your 5 friends' },
      ],
    },
    {
      name: 'Special Delivery', giver: 'Grandpa Grommet', start: nest('Factory Nest'), coins: 150, xp: 100,
      blurb: 'Steal the Boot\'s delivery truck and bring it home.',
      steps: [
        { talk: "The Boot's delivery truck is parked by the factory yard - it's full of the Boot's spare laces. Steal it and drive it all the way to the Home Nest. Every Boot in town will come after you." },
        { truck: L('Boot Factory Yard', -21, 0) },
        { getcar: 'truck', text: 'Steal the Boot delivery truck (F)' },
        { setheat: 4 },
        { go: nest('Home Nest'), r: 9, car: 'truck', text: 'Drive the truck to the Home Nest!' },
        { talk: "You did it! Without its laces, the Boot can't tie itself up for a fight... it'll come out angry. It's waiting in the Boot Factory Yard. This is it, little puff." },
      ],
    },
    {
      name: 'The Great Boot', giver: 'Grandpa Grommet', start: L('Boot Factory Yard', 0, -19), coins: 300, xp: 200,
      blurb: 'End this. Face the Boot of Destiny.',
      steps: [
        { boss: 'boot', at: L('Boot Factory Yard') },
      ],
    },
  ];
}
