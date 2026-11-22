import { alive, checkEnd, clamp, damage, note, type GameState, type Goods, type Group, type Member, type Offer, type Owned, type Part, type Pending } from './state';
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
  setup?: (s: GameState, p: Pending) => void; // roll per-encounter details (prices, goods)
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
const guidePrice = (s: GameState) => Math.max(2, Math.round(10 * priceFactor(s, 'cherokee')));
const ok = (msg: string) => ({ label: msg, apply: () => '' });

// ---------- Trading and reputation ----------

export const GROUP_NAME: Record<Group, string> = { catawba: 'Catawba', cherokee: 'Cherokee', settlers: 'settlers', traders: 'traders' };

/** -3..3 as a word, for the ledger and greetings. */
export const mood = (r: number) => (r >= 3 ? 'trusted' : r >= 1 ? 'friendly' : r <= -2 ? 'wary' : r < 0 ? 'cool' : 'neutral');

/** Price multiplier for a group: trusted pays ~55%, wary pays ~130%. */
export const priceFactor = (s: GameState, g: Group) => 1 - 0.15 * Math.max(-2, Math.min(3, s.rep[g]));

const changeRep = (s: GameState, g: Group, n: number) => (s.rep[g] = Math.max(-3, Math.min(3, s.rep[g] + n)));

/** How a group greets you; tells the player where they stand. */
function greet(s: GameState, g: Group): string {
  const name = GROUP_NAME[g];
  switch (mood(s.rep[g])) {
    case 'trusted': return g === 'catawba' || g === 'cherokee'
      ? `Word of your fair dealing has traveled ahead of you among the ${name}. You are greeted as a friend and offered their best terms.`
      : `The ${name} on this road know your name and your honest dealing, and give you their best terms.`;
    case 'friendly': return `They have heard well of you from other ${name} and offer fair terms.`;
    case 'cool': return `They are guarded. Word of your hard bargaining has reached the ${name}.`;
    case 'wary': return `They are wary of you and set a stiff price. Your name is not well spoken of among the ${name}.`;
    default: return '';
  }
}

const UNIT: Record<Goods, string> = {
  food: 'lb of food', shot: 'rounds of shot', medicine: 'doses of medicine', riverGear: 'coils of rope and caulking',
  wheels: 'spare wheel', axles: 'spare axle', tongues: 'spare tongue', money: '',
};
export const fmt = (k: Goods, n: number) => (k === 'money' ? `£${n}` : `${n} ${UNIT[k]}`);
const pick = <T,>(s: GameState, xs: T[]) => xs[Math.floor(rand(s) * xs.length)];
const vary = (s: GameState, n: number) => n * (0.7 + rand(s) * 0.6); // ±30%

function pay(s: GameState, o: Offer, share = 1) {
  s.supplies[o.give] -= Math.ceil(o.giveQty * share);
  if (o.get) s.supplies[o.get] += o.getQty!;
}

/**
 * A randomized barter with a group. What they want and offer, and how much,
 * is rolled per encounter and scaled by your standing with them.
 */
function tradeEvent(id: string, g: Group, weight: (s: GameState) => number, intro: string,
  wants: [Goods, number][], offers: [Goods, number][]): GameEvent {
  const offer = (s: GameState) => s.pending!.offer!;
  return {
    id,
    weight,
    setup: (s, p) => {
      const [get, getBase] = pick(s, offers);
      const [give, giveBase] = pick(s, wants.filter(([k]) => k !== get));
      p.offer = { get, getQty: Math.max(1, Math.round(vary(s, getBase))), give, giveQty: Math.max(1, Math.round(vary(s, giveBase) * priceFactor(s, g))) };
    },
    text: (s, _, p) => `${intro} ${greet(s, g)} They offer ${fmt(p.offer!.get!, p.offer!.getQty!)} for ${fmt(p.offer!.give, p.offer!.giveQty)}.`.replace(/\s+/g, ' '),
    choices: [
      { label: (s) => `Trade (${fmt(offer(s).give, offer(s).giveQty)})`, ok: (s) => s.supplies[offer(s).give] >= offer(s).giveQty,
        apply: (s, p) => { pay(s, p.offer!); changeRep(s, g, 1); return `You trade fairly. The ${GROUP_NAME[g]} will remember it.`; } },
      { label: (s) => `Trade and add a gift (${fmt(offer(s).give, Math.ceil(offer(s).giveQty * 1.5))})`,
        ok: (s) => s.supplies[offer(s).give] >= Math.ceil(offer(s).giveQty * 1.5),
        apply: (s, p) => { pay(s, p.offer!, 1.5); changeRep(s, g, 2); return `Your gift is received warmly. Good words about you will travel among the ${GROUP_NAME[g]}.`; } },
      { label: 'Drive a hard bargain (pay half)', ok: (s) => s.supplies[offer(s).give] >= Math.ceil(offer(s).giveQty / 2),
        apply: (s, p) => {
          if (rand(s) < (s.rep[g] > 0 ? 0.65 : 0.4)) {
            pay(s, p.offer!, 0.5);
            changeRep(s, g, -2);
            return `They give in, but coldly. Word of this will travel among the ${GROUP_NAME[g]}.`;
          }
          changeRep(s, g, -1);
          return 'They take offense and leave without trading.';
        } },
      ok('Decline politely'),
    ],
  };
}

/**
 * A rare, expensive purchase that changes how the rest of the run plays.
 * The price is rolled within a range, so sometimes it's a steal.
 */
function bigItem(id: Owned, weight: (s: GameState) => number, text: (price: string) => string,
  min: number, max: number, bought: string): GameEvent {
  const price = (s: GameState) => s.pending!.offer!.giveQty;
  return {
    id,
    once: true,
    weight: (s) => (s.owned.includes(id) ? 0 : weight(s)),
    setup: (s, p) => { p.offer = { give: 'money', giveQty: Math.round(min + rand(s) * (max - min)) }; },
    text: (_, __, p) => text(fmt('money', p.offer!.giveQty)),
    choices: [
      { label: (s) => `Buy it (£${price(s)} of your £${s.supplies.money})`, ok: (s) => s.supplies.money >= price(s),
        apply: (s, p) => { s.supplies.money -= p.offer!.giveQty; s.owned.push(id); return bought; } },
      ok('It is too dear'),
    ],
  };
}

export const OWNED_LABEL: Record<Owned, string> = {
  rifle: 'long rifle (better hunting)', horses: 'horse team (+4 mi/day)', deed: 'land warrant (+500 score on arrival)', scout: 'guide (safer rivers)',
};

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
        apply: (s) => {
          if (rand(s) >= 0.4) return 'You cut through and strike the trail again.';
          startEvent(s, 'break');
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
  tradeEvent('peddler', 'traders', (s) => (s.miles > 20 ? 1.5 : 0),
    'Two peddlers leading packhorses hail you from the roadside.',
    [['money', 8], ['shot', 15]],
    [['medicine', 2], ['riverGear', 1], ['food', 30]]),
  tradeEvent('catawba', 'catawba', (s) => (s.miles > 30 && s.miles < 200 ? 2.5 : 0),
    'Catawba traders carrying deerskins to Charles Town stop to talk.',
    [['shot', 15], ['money', 10], ['medicine', 1]],
    [['food', 45], ['medicine', 2], ['riverGear', 1]]),
  tradeEvent('cherokeeTrade', 'cherokee', (s) => (s.miles > 150 ? 2.5 : 0),
    'Cherokee hunters on their way to Keowee share your fire and offer to trade.',
    [['shot', 20], ['money', 12], ['medicine', 2]],
    [['food', 55], ['medicine', 2], ['riverGear', 1]]),
  tradeEvent('homestead', 'settlers', (s) => (s.miles > 25 ? 2 : 0),
    'A homesteading family waves you over and asks if you have anything to trade.',
    [['money', 8], ['shot', 10], ['medicine', 1]],
    [['food', 40], ['wheels', 1], ['axles', 1], ['riverGear', 1]]),
  {
    id: 'guide',
    once: true,
    weight: (s) => (s.miles > 190 && nextMile(s) - s.miles > 20 ? 3 : 0),
    text: (s) => `A Cherokee man returning home to Keowee offers to guide you along a shorter ridge path for £${guidePrice(s)}. ${greet(s, 'cherokee')}`,
    choices: [
      { label: (s) => `Accept (£${guidePrice(s)})`, ok: (s) => s.supplies.money >= guidePrice(s),
        apply: (s) => { s.supplies.money -= guidePrice(s); changeRep(s, 'cherokee', 1); s.miles = Math.min(s.miles + 15, nextMile(s) - 1); return 'He leads you along the ridges, saving many miles.'; } },
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
          if (rand(s) < Math.min(0.95, (s.role === 'ranger' ? 0.85 : 0.5) + (s.owned.includes('rifle') ? 0.3 : 0))) { s.supplies.food += 50; return 'A clean shot. 50 lb of venison.'; }
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
        apply: (s) => { s.supplies.medicine--; s.supplies.money += 15; s.morale = clamp(s.morale + 5); changeRep(s, 'traders', 1); return 'The boy rallies, and his father pays gladly.'; } },
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
          if (rand(s) < (s.role === 'farmer' ? 0.9 : 0.5)) { s.supplies.food += 40; s.morale = clamp(s.morale + 10); changeRep(s, 'settlers', 1); return 'You get them rolling. They insist you take 40 lb of corn and bacon.'; }
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
      { label: 'Work a day', apply: (s) => { advanceDay(s, false); s.supplies.food += 50; s.morale = clamp(s.morale + 5); changeRep(s, 'settlers', 1); return 'A long day, a good supper, and 50 lb of food to take with you.'; } },
      ok('Move on'),
    ],
  },

  // --- Rare, costly items that change how a run plays ---
  bigItem('rifle', (s) => (s.miles > 20 ? 0.8 : 0),
    (p) => `A gunsmith's journeyman from Pennsylvania shows you a long rifle, rifled and true, the finest you have seen. He wants ${p} for it.`,
    55, 85, 'The long rifle is yours. Game will be easier to bring down.'),
  bigItem('horses', (s) => (s.miles > 20 && s.miles < 220 ? 0.8 : 0),
    (p) => `A drover is selling a matched team of strong horses that could pull your wagon far faster. His price is ${p}.`,
    70, 105, 'You hitch the new team. The wagon fairly flies along.'),
  bigItem('deed', (s) => (s.miles > 60 ? 0.6 : 0),
    (p) => `A surveyor offers a warrant for 200 acres of rich bottomland on Long Canes Creek, yours if you reach the frontier. He asks ${p}.`,
    90, 135, 'You fold the land warrant carefully into your coat. Now you must arrive.'),
  {
    // Only offered to parties who have earned real trust.
    id: 'scout',
    once: true,
    weight: (s) => (!s.owned.includes('scout') && (s.rep.catawba >= 2 || s.rep.cherokee >= 2) ? 3 : 0),
    setup: (s, p) => {
      p.group = s.rep.cherokee >= s.rep.catawba ? 'cherokee' : 'catawba';
      p.offer = { give: 'money', giveQty: Math.round(vary(s, 30) * priceFactor(s, p.group)) };
    },
    text: (_, __, p) => {
      const name = GROUP_NAME[p.group!];
      return `A ${name} hunter you traded with catches up to your wagon. Because you have dealt honestly with his people, he offers to travel with you to the fort as a guide, for ${fmt('money', p.offer!.giveQty)}. He knows every ford between here and Keowee.`;
    },
    choices: [
      { label: (s) => `Welcome him (£${s.pending!.offer!.giveQty})`, ok: (s) => s.supplies.money >= s.pending!.offer!.giveQty,
        apply: (s, p) => { s.supplies.money -= p.offer!.giveQty; s.owned.push('scout'); return 'Your new guide points out the safest fords and the best hunting grounds.'; } },
      ok('Thank him and go on alone'),
    ],
  },
];

const byId = (id: string) => EVENTS.find((e) => e.id === id)!;

export function rollEvent(s: GameState) {
  const pool = EVENTS.filter((e) => !(e.once && s.seen.includes(e.id))).map((e) => ({ e, w: e.weight(s) })).filter((x) => x.w > 0);
  if (!pool.length) return;
  startEvent(s, weighted(s, pool).e.id);
}

/**
 * Saves from older versions may hold an event that no longer exists,
 * or one that gained a setup step (rolled offer) after it was saved.
 */
export function repairPending(s: GameState) {
  const p = s.pending;
  if (!p) return;
  const e = EVENTS.find((e) => e.id === p.id);
  if (!e) {
    s.pending = undefined;
    if (s.phase === 'event') s.phase = 'travel';
  } else if (e.setup && !p.offer) e.setup(s, p);
}

/** Begin a specific event: pick who it's about, roll its details, show it. */
export function startEvent(s: GameState, id: string) {
  const e = byId(id);
  const party = alive(s);
  const target = s.party.indexOf(party[Math.floor(rand(s) * party.length)]);
  s.pending = { id, target, part: id === 'break' ? PARTS[Math.floor(rand(s) * 3)] : undefined };
  e.setup?.(s, s.pending);
  if (e.once) s.seen.push(id);
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
