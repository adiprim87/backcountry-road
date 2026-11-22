import { alive, checkEnd, clamp, damage, DIFFICULTY, note, type GameState, type Pace, type Rations, type Weather } from './state';
import { rand, weighted } from './rng';
import { ROUTE } from './route';
import { rollEvent } from './events';
import { makeQuiz } from './quiz';

export const PACE: Record<Pace, { miles: number; health: number }> = {
  rest: { miles: 0, health: 6 },
  steady: { miles: 12, health: 0 },
  strenuous: { miles: 16, health: -2 },
  grueling: { miles: 22, health: -3 },
};

export const RATIONS: Record<Rations, { lb: number; health: number }> = {
  filling: { lb: 3, health: 1 },
  meager: { lb: 2, health: 0 },
  bare: { lb: 1, health: -4 },
};

const WEATHER: { id: Weather; w: number; miles: number; health: number; rain: number }[] = [
  { id: 'fair', w: 5, miles: 1, health: 0, rain: -0.5 },
  { id: 'hot', w: 3, miles: 0.9, health: -2, rain: -0.5 },
  { id: 'rain', w: 2, miles: 0.75, health: -1, rain: 1 },
  { id: 'storm', w: 1, miles: 0.5, health: -2, rain: 2 },
  { id: 'fog', w: 1, miles: 0.8, health: 0, rain: 0 },
];

const EVENT_CHANCE = 0.35;
// Daily chance a healthy traveler falls sick (dysentery); a quarter of that while resting.
const FLUX_CHANCE = 0.025;

/** Advance one day. With travel=false the party stays put (waiting, hunting). Mutates s. */
export function advanceDay(s: GameState, travel = true) {
  if (s.result) return;
  s.day++;
  const weather = weighted(s, WEATHER);
  s.weather = weather.id;
  s.rain = Math.max(0, Math.min(6, s.rain + weather.rain));

  const party = alive(s);
  const need = RATIONS[s.rations].lb * party.length;
  const eaten = Math.min(s.supplies.food, need);
  const daysBefore = foodDays(s);
  s.supplies.food -= eaten;
  const starving = eaten < need;
  if (starving) note(s, eaten === 0 ? 'You have no food.' : 'There was not enough food for everyone.');
  else if (daysBefore >= 3 && foodDays(s) < 3) note(s, `Food is running low: about ${foodDays(s)} days left.`);

  const resting = s.pace === 'rest' || !travel;
  const dh = PACE[s.pace].health + RATIONS[s.rations].health + weather.health + (starving ? -12 : 0);
  for (const m of party) {
    const ill = m.status === 'sick' ? 9 : m.status === 'injured' ? 3 : 0;
    const cause = starving ? 'starvation' : m.status === 'sick' ? 'fever' : m.status === 'injured' ? 'injuries' : 'exhaustion';
    damage(s, m, -(dh + Math.floor(rand(s) * 3) - 1) + ill, cause);
    if (ill && m.status !== 'dead' && rand(s) < (resting ? 0.35 : 0.15)) {
      m.status = 'well';
      note(s, `${m.name} is feeling better.`);
    } else if (!ill && m.status !== 'dead' && rand(s) < (resting ? FLUX_CHANCE / 4 : FLUX_CHANCE) * DIFFICULTY[s.difficulty].flux) {
      m.status = 'sick';
      note(s, `${m.name} has come down with the bloody flux.`);
    }
  }
  s.morale = clamp(s.morale + Math.sign(dh) * 2);
  if (checkEnd(s) || !travel || s.pace === 'rest') return;

  // Morale scales speed from 50% (despair) to 100%.
  const horses = s.owned.includes('horses') ? 4 : 0;
  const gain = Math.round((PACE[s.pace].miles + horses) * weather.miles * (0.5 + s.morale / 200));
  const next = ROUTE[s.at + 1];
  if (s.miles + gain < next.mile) {
    s.miles += gain;
    if (rand(s) < EVENT_CHANCE * DIFFICULTY[s.difficulty].events) rollEvent(s);
    return;
  }
  s.miles = next.mile;
  s.at++;
  note(s, `You have reached ${next.name}.`);
  if (next.kind === 'fort') {
    s.result = 'won';
    s.endReason = `You reached ${next.name} on ${dateText(s.day)}.`;
    s.phase = 'end';
  } else {
    s.phase = next.kind === 'river' ? 'river' : 'landmark';
    s.quiz = makeQuiz(s);
  }
}

/** A day spent resting in camp, whatever the chosen pace. */
export function restDay(s: GameState) {
  const pace = s.pace;
  s.pace = 'rest';
  advanceDay(s, false);
  s.pace = pace;
}

/** Whole days the food lasts at the current rations. */
export const foodDays = (s: GameState) => Math.floor(s.supplies.food / (RATIONS[s.rations].lb * Math.max(1, alive(s).length)));

/** Spend a dose of medicine on the sickest member. */
export function treatSick(s: GameState) {
  const m = alive(s).filter((m) => m.status !== 'well').sort((a, b) => a.health - b.health)[0];
  if (!m || s.supplies.medicine < 1) return;
  s.supplies.medicine--;
  m.status = 'well';
  m.health = clamp(m.health + 10);
  note(s, `You give ${m.name} medicine. ${m.name} is on the mend.`);
}

export const carryLimit = (s: GameState) => 100 + 100 * s.supplies.packHorses;

export function finishHunt(s: GameState, meat: number, used: number) {
  s.supplies.shot = Math.max(0, s.supplies.shot - used);
  const kept = Math.min(meat, carryLimit(s));
  s.supplies.food += kept;
  s.phase = 'travel';
  advanceDay(s, false);
  note(s, kept ? `You bring back ${kept} lb of meat${meat > kept ? ' (all you can carry)' : ''}.` : 'You come back empty-handed.');
}

export const dateText = (day: number) =>
  new Date(1756, 3, 1 + day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
