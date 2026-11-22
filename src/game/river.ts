import { alive, checkEnd, damage, note, type GameState } from './state';
import { rand } from './rng';
import { ROUTE } from './route';
import { advanceDay } from './tick';

export type Method = 'ford' | 'float' | 'ferry';

export const depth = (s: GameState) => Math.round((ROUTE[s.at].depth! + s.rain * 0.5) * 10) / 10;

/** Chance a crossing goes wrong. */
export function risk(m: Method, d: number): number {
  if (m === 'ferry') return 0.03;
  if (m === 'float') return Math.min(0.6, 0.1 + 0.04 * d);
  return d <= 2.5 ? 0.05 : Math.min(0.9, 0.2 + 0.2 * (d - 2.5));
}

/** Risk at this river today; a guide who knows the fords halves it. */
export const crossRisk = (s: GameState, m: Method) => risk(m, depth(s)) * (s.owned.includes('scout') ? 0.5 : 1);

export function canCross(s: GameState, m: Method) {
  if (m === 'float') return s.supplies.riverGear > 0;
  if (m === 'ferry') return !!ROUTE[s.at].ferry && s.supplies.money >= ROUTE[s.at].ferry!;
  return true;
}

export function cross(s: GameState, m: Method) {
  if (!canCross(s, m)) return;
  const river = ROUTE[s.at];
  const d = depth(s);
  if (m === 'float') s.supplies.riverGear--;
  if (m === 'ferry') s.supplies.money -= river.ferry!;
  s.phase = 'travel';
  if (rand(s) >= crossRisk(s, m)) return note(s, `You cross the ${river.name} safely.`);

  const lost = Math.round(s.supplies.food * (0.2 + rand(s) * 0.3));
  s.supplies.food -= lost;
  const party = alive(s);
  const who = party[Math.floor(rand(s) * party.length)];
  let msg = `The current catches the wagon. You lose ${lost} lb of food.`;
  if (m === 'ford' && d > 4 && rand(s) < 0.3) {
    damage(s, who, 100, 'drowning');
    msg += ` ${who.name} is swept away.`;
  } else {
    damage(s, who, 20, 'injuries');
    if (who.status !== 'dead') who.status = 'injured';
    msg += ` ${who.name} is hurt.`;
  }
  if (rand(s) < 0.3) {
    s.supplies.shot = Math.floor(s.supplies.shot / 2);
    msg += ' Half your powder is soaked.';
  }
  note(s, msg);
  checkEnd(s);
}

export function waitRiver(s: GameState) {
  advanceDay(s, false);
  if (!checkEnd(s)) note(s, `You wait a day. The river is now ${depth(s)} ft deep.`);
}

/** Fishing is free and spends no day, but only once per river. */
export const canFish = (s: GameState) => s.phase === 'river' && s.fishedAt !== s.at;

export function finishFish(s: GameState, lb: number) {
  s.fishedAt = s.at;
  s.supplies.food += lb;
  s.phase = 'river';
  note(s, lb ? `You catch ${lb} lb of fish.` : 'Nothing is biting.');
}
