import { alive, checkEnd, clamp, damage, note, type GameState, type Member, type Part, type Pending } from './state';
import { rand, weighted } from './rng';
import { ROUTE } from './route';
import { advanceDay, restDay } from './tick';

interface Choice {
  label: string | ((s: GameState) => string);
  ok?: (s: GameState) => boolean;
  apply: (s: GameState, p: Pending, who: Member) => string;
}

interface GameEvent {
  id: string;
  once?: boolean;
  weight: (s: GameState) => number;
  text: (s: GameState, who: Member, p: Pending) => string;
  choices: Choice[];
}

export const PART_NAME: Record<Part, string> = { wheels: 'wheel', axles: 'axle', tongues: 'tongue' };
const PARTS: Part[] = ['wheels', 'axles', 'tongues'];
const nextMile = (s: GameState) => ROUTE[s.at + 1].mile;
const loseFood = (s: GameState, min: number, max: number) => {
  const n = Math.round(s.supplies.food * (min + rand(s) * (max - min)));
  s.supplies.food -= n;
  return n;
};
const ok = (msg: string) => ({ label: msg, apply: () => '' });

export const EVENTS: GameEvent[] = [
  {
    id: 'fever',
    weight: (s) => (s.miles < 150 ? 3 : 1),
    text: (_, w) => `${w.name} is shaking with the fever and ague of the low country.`,
    choices: [
      { label: (s) => `Give medicine (${s.supplies.medicine} left)`, ok: (s) => s.supplies.medicine > 0,
        apply: (s, _, w) => { s.supplies.medicine--; w.health = clamp(w.health + 10); return `The fever breaks. ${w.name} rallies.`; } },
      { label: 'Press on', apply: (_, __, w) => { w.status = 'sick'; return `${w.name} is sick.`; } },
    ],
  },
  {
    id: 'snakebite',
    weight: (s) => (s.weather === 'hot' || s.weather === 'fair' ? 2 : 0.5),
    text: (s, w) => `A ${s.miles < 150 ? 'cottonmouth' : 'timber rattlesnake'} strikes ${w.name} at a creek.`,
    choices: [
      { label: (s) => `Use medicine (${s.supplies.medicine} left)`, ok: (s) => s.supplies.medicine > 0,
        apply: (s, _, w) => { s.supplies.medicine--; damage(s, w, 15, 'snakebite'); return `You treat the bite. ${w.name} will live.`; } },
      { label: 'Bind the wound and hope', apply: (s, _, w) => { damage(s, w, 40, 'snakebite'); if (w.status !== 'dead') w.status = 'injured'; return `${w.name}'s leg swells badly.`; } },
    ],
  },
  {
    id: 'heat',
    weight: (s) => (s.weather === 'hot' ? 4 : 0),
    text: (_, w) => `The heat and damp are brutal. ${w.name} collapses by the road.`,
    choices: [
      { label: 'Rest a day in the shade', apply: (s, _, w) => { restDay(s); w.health = clamp(w.health + 10); return `${w.name} recovers in the shade.`; } },
      { label: 'Keep moving', apply: (s, _, w) => { damage(s, w, 20, 'heat stroke'); return `${w.name} staggers on.`; } },
    ],
  },
  {
    id: 'mosquitoes',
    weight: (s) => (s.miles < 160 ? 2 : 0),
    text: () => 'Clouds of mosquitoes rise from the swamp. Nobody sleeps.',
    choices: [{ label: 'Endure it', apply: (s) => { alive(s).forEach((m) => damage(s, m, 5, 'fever')); s.morale = clamp(s.morale - 5); return ''; } }],
  },
  {
    id: 'break',
    weight: () => 3,
    text: (_, __, p) => `Your wagon's ${PART_NAME[p.part!]} breaks on a hidden stump. The wagon cannot move.`,
    choices: [
      { label: (s) => `Fit a spare (${s.supplies[s.pending!.part!]} left)`, ok: (s) => s.supplies[s.pending!.part!] > 0,
        apply: (s, p) => { s.supplies[p.part!]--; return 'You fit the spare. The wagon rolls again.'; } },
      { label: 'Try to mend it (takes a day)',
        apply: (s, p) => {
          const mended = rand(s) < (s.role === 'farmer' ? 0.75 : 0.5);
          restDay(s);
          if (mended) return `You mend the ${PART_NAME[p.part!]} well enough to go on.`;
          s.pending = p;
          s.phase = 'event';
          return 'The mend does not hold. The wagon still will not move.';
        } },
      { label: 'Abandon the wagon',
        apply: (s) => { s.result = 'lost'; s.endReason = 'Your wagon broke down far from help, and you could not go on.'; return ''; } },
    ],
  },
  {
    id: 'storm',
    weight: (s) => (s.weather === 'storm' ? 6 : 0),
    text: () => 'A thunderstorm breaks over the road. Lightning splits a pine nearby.',
    choices: [
      { label: 'Shelter and wait it out (a day)', apply: (s) => { restDay(s); return 'The storm passes.'; } },
      { label: 'Push through', apply: (s) => `Rain soaks your stores. You lose ${loseFood(s, 0.1, 0.3)} lb of food.` },
    ],
  },
  {
    id: 'lost',
    weight: (s) => (s.weather === 'fog' ? 4 : 1),
    text: () => 'The trail fades into a maze of cattle paths and canebrakes.',
    choices: [
      { label: 'Backtrack to the last blaze (2 days)', apply: (s) => { advanceDay(s, false); advanceDay(s, false); return 'You find the trail again.'; } },
      { label: 'Cut through the woods',
        apply: (s, p) => {
          if (rand(s) >= 0.4) return 'You cut through and strike the trail again.';
          s.pending = { id: 'break', target: p.target, part: PARTS[Math.floor(rand(s) * 3)] };
          s.phase = 'event';
          return 'You crash through the brush. Something cracks.';
        } },
    ],
  },
  {
    id: 'spoiled',
    weight: (s) => (s.supplies.food > 50 ? 1.5 : 0),
    text: () => 'Damp and weevils have gotten into the flour and meal.',
    choices: [{ label: 'Throw out the spoiled food', apply: (s) => `You lose ${loseFood(s, 0.15, 0.3)} lb of food.` }],
  },
  {
    id: 'peddler',
    weight: (s) => (s.miles > 20 ? 1.5 : 0),
    text: () => 'A peddler with a packhorse offers two doses of medicine for £8.',
    choices: [
      { label: 'Buy (£8)', ok: (s) => s.supplies.money >= 8, apply: (s) => { s.supplies.money -= 8; s.supplies.medicine += 2; return 'You buy the medicine.'; } },
      ok('No, thank you'),
    ],
  },
  {
    id: 'catawba',
    weight: (s) => (s.miles > 30 && s.miles < 200 ? 2 : 0),
    text: () => 'A Catawba trader bound for Charles Town offers 40 lb of dried venison and corn for 15 rounds of shot.',
    choices: [
      { label: 'Trade', ok: (s) => s.supplies.shot >= 15,
        apply: (s) => { s.supplies.shot -= 15; s.supplies.food += 40; s.morale = clamp(s.morale + 5); return 'You trade. He tells you where the next creek can be forded.'; } },
      ok('Thank him and decline'),
    ],
  },
  {
    id: 'guide',
    once: true,
    weight: (s) => (s.miles > 190 && nextMile(s) - s.miles > 20 ? 3 : 0),
    text: () => 'A Cherokee man returning home to Keowee offers to guide you along a shorter ridge path for £10.',
    choices: [
      { label: 'Accept (£10)', ok: (s) => s.supplies.money >= 10,
        apply: (s) => { s.supplies.money -= 10; s.miles = Math.min(s.miles + 15, nextMile(s) - 1); return 'He leads you along the ridges, saving many miles.'; } },
      ok('Thank him and keep to the road'),
    ],
  },
  {
    id: 'militia',
    weight: () => 1,
    text: () => 'A ranger patrol rides past. Their captain shares news of the frontier and a twist of tobacco.',
    choices: [{ label: 'Wish them well', apply: (s) => { s.morale = clamp(s.morale + 10); return ''; } }],
  },
  {
    id: 'berries',
    weight: () => 2,
    text: () => 'Blackberries and wild strawberries crowd the roadside.',
    choices: [{ label: 'Pick them', apply: (s) => { const n = 15 + Math.floor(rand(s) * 16); s.supplies.food += n; return `You gather ${n} lb of fruit.`; } }],
  },
  {
    id: 'camp',
    weight: () => 1.5,
    text: () => 'You come to a fine campsite by a cold spring.',
    choices: [
      { label: 'Rest here a day', apply: (s) => { restDay(s); alive(s).forEach((m) => (m.health = clamp(m.health + 5))); return 'Everyone feels stronger.'; } },
      { label: 'Keep going', apply: (s) => { s.morale = clamp(s.morale + 3); return ''; } },
    ],
  },
  {
    id: 'cabin',
    weight: () => 1,
    text: () => 'An abandoned cabin stands by the road, its roof half fallen in.',
    choices: [
      { label: 'Search it',
        apply: (s) => {
          const r = rand(s);
          if (r < 0.35) { s.supplies.medicine++; return 'You find a stoppered bottle of medicine.'; }
          if (r < 0.7) { s.supplies.shot += 10; return 'You find a powder horn and 10 rounds of shot.'; }
          return 'Nothing but mice.';
        } },
      ok('Leave it be'),
    ],
  },

  // --- Events that reward particular play styles ---
  {
    // Fast travelers: trade health for miles.
    id: 'nightMarch',
    weight: (s) => (s.pace === 'strenuous' || s.pace === 'grueling' ? 3 : 0),
    text: () => 'Clear skies and a full moon. The road ahead is good, and rain is coming in a day or two.',
    choices: [
      { label: 'March on through the night',
        apply: (s) => { s.miles = Math.min(s.miles + 12, nextMile(s) - 1); alive(s).forEach((m) => damage(s, m, 6, 'exhaustion')); return 'You make good miles by moonlight.'; } },
      ok('Make camp as usual'),
    ],
  },
  {
    // Hunters: shot pays off without a full day's hunt.
    id: 'deer',
    weight: (s) => (s.supplies.shot >= 5 ? 2 : 0),
    text: () => 'A buck steps out to drink at the creek, not fifty yards off.',
    choices: [
      { label: 'Take the shot (5 rounds)', ok: (s) => s.supplies.shot >= 5,
        apply: (s) => {
          s.supplies.shot -= 5;
          if (rand(s) < (s.role === 'ranger' ? 0.85 : 0.5)) { s.supplies.food += 50; return 'A clean shot. 50 lb of venison.'; }
          return 'You miss, and the buck crashes away.';
        } },
      ok('Let it go'),
    ],
  },
  {
    // Upcountry danger that punishes carrying no powder.
    id: 'wolves',
    weight: (s) => (s.miles > 150 ? 2 : 0),
    text: () => 'Wolves circle the camp after dark, drawn by the smell of your meat.',
    choices: [
      { label: 'Fire into the dark (10 rounds)', ok: (s) => s.supplies.shot >= 10,
        apply: (s) => { s.supplies.shot -= 10; return 'The wolves scatter and do not come back.'; } },
      { label: 'Build up the fire and hope', apply: (s) => `By morning they have torn into your stores. You lose ${loseFood(s, 0.2, 0.35)} lb of food.` },
    ],
  },
  {
    // Medicine as trade goods.
    id: 'sickTraveler',
    weight: (s) => (s.supplies.medicine > 0 ? 1.5 : 0),
    text: () => "A packhorse man's son burns with fever. His father offers £15 for a dose of medicine.",
    choices: [
      { label: 'Sell a dose (£15)', ok: (s) => s.supplies.medicine > 0,
        apply: (s) => { s.supplies.medicine--; s.supplies.money += 15; s.morale = clamp(s.morale + 5); return 'The boy rallies, and his father pays gladly.'; } },
      ok('Keep your medicine'),
    ],
  },
  {
    // Merchants: connections mean coast prices inland.
    id: 'factor',
    weight: (s) => (s.miles > 60 ? (s.role === 'merchant' ? 3 : 0.5) : 0),
    text: (s) => s.role === 'merchant'
      ? 'A Charleston factor you do business with is hauling goods inland. He offers you 60 lb of food and 20 rounds at coast prices: £10.'
      : 'A Charleston factor hauling goods inland will part with 60 lb of food and 20 rounds for £16.',
    choices: [
      { label: (s) => `Buy (£${s.role === 'merchant' ? 10 : 16})`, ok: (s) => s.supplies.money >= (s.role === 'merchant' ? 10 : 16),
        apply: (s) => { s.supplies.money -= s.role === 'merchant' ? 10 : 16; s.supplies.food += 60; s.supplies.shot += 20; return 'You load the goods.'; } },
      ok('No, thank you'),
    ],
  },
  {
    // Farmers: handy with a broken wagon, and neighbors repay it.
    id: 'settlerWagon',
    weight: () => 1.5,
    text: () => "A settler family's wagon sits in the road with a cracked axle. The children watch you hopefully.",
    choices: [
      { label: 'Stop and help (a day)',
        apply: (s) => {
          advanceDay(s, false);
          if (rand(s) < (s.role === 'farmer' ? 0.9 : 0.5)) { s.supplies.food += 40; s.morale = clamp(s.morale + 10); return 'You get them rolling. They insist you take 40 lb of corn and bacon.'; }
          s.morale = clamp(s.morale - 5);
          return 'Despite a day of work, the axle cannot be saved.';
        } },
      ok('Pass them by'),
    ],
  },
  {
    // Patient travelers: a slow day earns food.
    id: 'harvest',
    weight: (s) => (s.miles > 80 && (s.pace === 'steady' || s.pace === 'rest') ? 2 : 0),
    text: () => 'Settlers at a homestead are rolling logs to clear a field. They offer food for a day of work.',
    choices: [
      { label: 'Work a day', apply: (s) => { advanceDay(s, false); s.supplies.food += 50; s.morale = clamp(s.morale + 5); return 'A long day, a good supper, and 50 lb of food to take with you.'; } },
      ok('Move on'),
    ],
  },
];

const byId = (id: string) => EVENTS.find((e) => e.id === id)!;

export function rollEvent(s: GameState) {
  const pool = EVENTS.filter((e) => !(e.once && s.seen.includes(e.id))).map((e) => ({ e, w: e.weight(s) })).filter((x) => x.w > 0);
  if (!pool.length) return;
  const { e } = weighted(s, pool);
  const party = alive(s);
  const target = s.party.indexOf(party[Math.floor(rand(s) * party.length)]);
  s.pending = { id: e.id, target, part: e.id === 'break' ? PARTS[Math.floor(rand(s) * 3)] : undefined };
  if (e.once) s.seen.push(e.id);
  s.phase = 'event';
}

export function currentEvent(s: GameState) {
  const p = s.pending!;
  const e = byId(p.id);
  const who = s.party[p.target];
  return {
    text: e.text(s, who, p),
    choices: e.choices.map((c) => ({ label: typeof c.label === 'string' ? c.label : c.label(s), ok: !c.ok || c.ok(s) })),
  };
}

export function resolveEvent(s: GameState, i: number) {
  const p = s.pending!;
  const c = byId(p.id).choices[i];
  if (!c || (c.ok && !c.ok(s))) return;
  s.pending = undefined;
  s.phase = 'travel';
  note(s, c.apply(s, p, s.party[p.target]));
  checkEnd(s);
}
