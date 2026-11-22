import { alive, clamp, note, type GameState } from './state';
import { rand } from './rng';
import { ROUTE, TOTAL_MILES } from './route';
import { RATIONS } from './tick';
import { unitPrice } from './store';

export interface Quiz { at: number; q: string; answer: number; why: string; result?: 'right' | 'wrong' }

export const QUIZ_REWARD = 3;

/** Word problems built from the party's real situation. */
const KINDS: ((s: GameState, r: () => number) => Omit<Quiz, 'at'>)[] = [
  (s) => {
    const n = Math.max(1, alive(s).length), lb = RATIONS[s.rations].lb, food = Math.max(s.supplies.food, 60);
    const answer = Math.floor(food / (n * lb));
    return { q: `${food === s.supplies.food ? 'You have' : 'Suppose you had'} ${food} lb of food. ${n} people each eat ${lb} lb a day. How many full days will the food last?`,
      answer, why: `${n} × ${lb} = ${n * lb} lb a day, and ${food} ÷ ${n * lb} = ${answer} full days.` };
  },
  (s) => {
    const left = TOTAL_MILES - s.miles, answer = Math.ceil(left / 12);
    return { q: `Fort Prince George is at mile ${TOTAL_MILES} and you are at mile ${s.miles}. At 12 miles a day, how many days until you arrive?`,
      answer, why: `${TOTAL_MILES} − ${s.miles} = ${left} miles, and ${left} ÷ 12 rounded up is ${answer} days.` };
  },
  (s, r) => {
    const n = 2 + Math.floor(r() * 4), p = unitPrice(s, 'wheels'), answer = n * p;
    return { q: `A spare wheel costs £${p} this far inland. What would ${n} spare wheels cost?`, answer, why: `${n} × £${p} = £${answer}.` };
  },
  (_, r) => {
    const pounds = 2 + Math.floor(r() * 9), answer = pounds * 20;
    return { q: `There are 20 shillings in a pound. How many shillings are in £${pounds}?`, answer, why: `${pounds} × 20 = ${answer} shillings.` };
  },
  (s, r) => {
    const n = 2 + Math.floor(r() * 4), p = unitPrice(s, 'food'), money = Math.max(s.supplies.money, n * p + 5);
    const answer = money - n * p;
    return { q: `${money === s.supplies.money ? 'You have' : 'Suppose you had'} £${money}. Food costs £${p} for 10 lb. If you buy ${n * 10} lb, how much money is left?`,
      answer, why: `${n * 10} lb is ${n} lots of 10 lb, so ${n} × £${p} = £${n * p}, and £${money} − £${n * p} = £${answer}.` };
  },
];

/** A new problem for the landmark just reached. Uses its own seed so the game's dice are untouched. */
export function makeQuiz(s: GameState): Quiz {
  const r = { rng: (s.rng ^ (s.at * 0x9e3779b9)) | 0 };
  const roll = () => rand(r);
  return { at: s.at, ...KINDS[Math.floor(roll() * KINDS.length)](s, roll) };
}

/** Check an answer once; a right one pays a small reward. */
export function answerQuiz(s: GameState, value: number) {
  const z = s.quiz;
  if (!z || z.result || z.at !== s.at || !Number.isFinite(value)) return;
  z.result = value === z.answer ? 'right' : 'wrong';
  if (z.result === 'right') {
    s.supplies.money += QUIZ_REWARD;
    s.morale = clamp(s.morale + 5);
    note(s, `Good reckoning at ${ROUTE[s.at].name}. You earn £${QUIZ_REWARD}.`);
  }
}
