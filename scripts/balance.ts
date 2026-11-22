// Balance check: plays thousands of games with simple scripted strategies.
// Run: npx vite-node scripts/balance.ts [gamesPerCell]
import { alive, newGame, ROLES, type GameState, type Pace, type Rations, type Role } from '../src/game/state';
import { advanceDay, carryLimit, finishHunt, foodDays, treatSick } from '../src/game/tick';
import { currentEvent, resolveEvent } from '../src/game/events';
import { canCross, cross, depth, risk, waitRiver } from '../src/game/river';
import { ROUTE } from '../src/game/route';
import { buy, type ItemKey } from '../src/game/store';

interface Strategy {
  pace: Pace;
  rations: Rations;
  /** What to own when leaving Charleston. */
  kit: Partial<Record<ItemKey, number>>;
  restock: 'always' | 'whenLow' | false; // top up food at later stores
  hunt: boolean; // hunt when food runs low
  careful: boolean; // ferry/float/wait at rivers vs. always ford
}

const STRATEGIES: Record<string, Strategy> = {
  // A first-time player: buys food, goes, restocks only when the ledger says LOW.
  naive: { pace: 'steady', rations: 'filling', kit: { food: 150 }, restock: 'whenLow', hunt: false, careful: false },
  // Reads the store page, keeps buying food, plays it safe at rivers.
  careful: { pace: 'steady', rations: 'filling', kit: { food: 200, shot: 40, wheels: 1, axles: 1, tongues: 1, medicine: 3, riverGear: 2 }, restock: 'always', hunt: true, careful: true },
  // Rushes: grueling pace, meager rations, fords everything.
  rushed: { pace: 'grueling', rations: 'meager', kit: { food: 200, wheels: 1, axles: 1 }, restock: 'always', hunt: false, careful: false },
  // Careful, but lives off hunting with pack horses.
  hunter: { pace: 'steady', rations: 'filling', kit: { food: 100, shot: 100, packHorses: 2, wheels: 1, axles: 1, medicine: 2, riverGear: 2 }, restock: false, hunt: true, careful: true },
};

const NAMES = ['A', 'B', 'C', 'D', 'E'];

function buyUpTo(s: GameState, key: ItemKey, target: number) {
  while (s.supplies[key] < target && buy(s, key, 1));
}

/** Food to reach the next store (or the fort), with a 30% margin. */
function foodForNextLeg(s: GameState, st: Strategy) {
  const next = ROUTE.slice(s.at + 1).find((l) => l.store || l.kind === 'fort')!;
  const days = (next.mile - s.miles) / 10; // ~10 mi/day after weather and morale
  const perDay = { filling: 3, meager: 2, bare: 1 }[st.rations] * alive(s).length;
  return Math.ceil(days * perDay * 1.3);
}

// A human hunter's haul: mostly 30-120 lb; rangers and the long rifle do better.
function simulateHunt(s: GameState, rng: () => number) {
  const shots = Math.min(s.supplies.shot, 12);
  const meat = Math.round((20 + rng() * 100) * (s.role === 'ranger' ? 1.3 : 1) * (s.owned.includes('rifle') ? 1.4 : 1) * (shots / 12));
  finishHunt(s, Math.min(meat, carryLimit(s)), shots);
}

function play(role: Role, st: Strategy, seed: number) {
  const s = newGame(role, NAMES, seed);
  let r = seed * 7919 + 1;
  const rng = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const [k, v] of Object.entries(st.kit)) buyUpTo(s, k as ItemKey, v!);
  s.pace = st.pace;
  s.rations = st.rations;
  s.phase = 'travel';

  for (let guard = 0; guard < 500 && !s.result; guard++) {
    if (s.phase === 'event') {
      const choices = currentEvent(s).choices;
      // First enabled choice: usually the safe or resource-spending option. Never abandon the wagon unless forced.
      const i = choices.findIndex((c) => c.ok && !c.label.startsWith('Abandon'));
      resolveEvent(s, i >= 0 ? i : choices.length - 1);
    } else if (s.phase === 'river') {
      const d = depth(s);
      if (!st.careful) cross(s, 'ford');
      else if (canCross(s, 'ferry')) cross(s, 'ferry');
      else if (canCross(s, 'float') && risk('float', d) < risk('ford', d)) cross(s, 'float');
      else if (risk('ford', d) > 0.3 && s.supplies.food > 30) waitRiver(s);
      else cross(s, 'ford');
    } else if (s.phase === 'landmark') {
      // 'whenLow' is a new player reacting to the LOW food warning in the ledger.
      if (ROUTE[s.at].store && (st.restock === 'always' || (st.restock === 'whenLow' && foodDays(s) < 3))) buyUpTo(s, 'food', foodForNextLeg(s, st));
      s.phase = 'travel';
    } else if (s.supplies.medicine > 0 && alive(s).some((m) => m.status !== 'well')) {
      treatSick(s);
    } else if (st.hunt && s.supplies.food < alive(s).length * 9 && s.supplies.shot > 0) {
      simulateHunt(s, rng);
    } else advanceDay(s);
  }
  return s;
}

const N = Number(process.argv[2] ?? 2000);
const pct = (n: number) => `${Math.round((n / N) * 100)}%`.padStart(4);

console.log(`${N} games per row\n`);
console.log('strategy  role      win  avgDays  survivors(won)  top causes of death / loss');
for (const [name, st] of Object.entries(STRATEGIES)) {
  for (const role of Object.keys(ROLES) as Role[]) {
    let wins = 0, days = 0, surv = 0;
    const causes: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const s = play(role, st, i + 1);
      if (s.result === 'won') { wins++; days += s.day; surv += alive(s).length; }
      else if (s.result === 'lost' && s.endReason?.startsWith('Your wagon')) causes['abandoned wagon'] = (causes['abandoned wagon'] ?? 0) + 1;
      else if (!s.result) causes['(stuck)'] = (causes['(stuck)'] ?? 0) + 1;
      for (const m of s.party) if (m.cause) causes[m.cause] = (causes[m.cause] ?? 0) + 1;
    }
    const top = Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c} ${(n / N).toFixed(2)}`).join(', ');
    console.log(`${name.padEnd(9)} ${role.padEnd(9)} ${pct(wins)}  ${(wins ? days / wins : 0).toFixed(0).padStart(7)}  ${(wins ? surv / wins : 0).toFixed(1).padStart(14)}  ${top}`);
  }
}
console.log('\nCauses are deaths per game (5 = whole party), plus "abandoned wagon" losses.');

// Do the big items pay off? Careful bots buy whatever they can afford, so compare runs with and without each.
import { score } from '../src/game/state';
console.log('\nBig items (careful strategy, all roles): runs that bought it vs. runs that did not');
console.log('item     bought   win  avgScore(won) | not bought   win  avgScore(won)');
const runs = (Object.keys(ROLES) as Role[]).flatMap((role) => Array.from({ length: N }, (_, i) => play(role, STRATEGIES.careful, i + 1)));
const stats = (xs: GameState[]) => {
  const won = xs.filter((s) => s.result === 'won');
  return `${String(xs.length).padStart(6)} ${`${Math.round((won.length / Math.max(1, xs.length)) * 100)}%`.padStart(5)} ${(won.reduce((a, s) => a + score(s), 0) / Math.max(1, won.length)).toFixed(0).padStart(14)}`;
};
for (const item of ['rifle', 'horses', 'deed', 'scout'] as const) {
  console.log(`${item.padEnd(8)} ${stats(runs.filter((s) => s.owned.includes(item)))} | ${stats(runs.filter((s) => !s.owned.includes(item)))}`);
}

