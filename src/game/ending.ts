import { alive, type GameState } from './state';
import { GROUP_NAME } from './events';

/** A few lines on what became of the party, shaped by how the trip was played. */
export function epilogue(s: GameState): string[] {
  const living = alive(s), lines: string[] = [];
  if (s.result !== 'won') {
    if (s.owned.includes('deed')) lines.push('The warrant for 200 acres on Long Canes Creek is never claimed.');
    return lines;
  }
  lines.push(living.length === s.party.length ? `All ${s.party.length} of you walk through the gate of the fort together.`
    : living.length === 1 ? `Of those who left Charleston, only ${living[0].name} arrives.`
    : `${living.length} of you arrive. You will not forget the graves along the road.`);
  lines.push(s.owned.includes('deed') ? 'With your warrant you claim 200 acres on Long Canes Creek. By autumn there is a cabin and a cleared field.'
    : s.supplies.money >= 100 ? 'You arrive with money enough to set up as a trader near the fort.'
    : 'You arrive with little but your wagon, and hire on as laborers at the fort.');
  const friend = (['cherokee', 'catawba'] as const).find((g) => s.rep[g] >= 2);
  if (friend) lines.push(`${GROUP_NAME[friend]} friends from the road speak for you at Keowee, and trade comes easily in the years ahead.`);
  else if (Object.values(s.rep).some((r) => r <= -2)) lines.push('Word of your hard bargaining has traveled ahead of you, and the traders near the fort are slow to deal with you.');
  if (s.day < 28) lines.push('Your fast passage is talked about at the fort for weeks.');
  return lines;
}
