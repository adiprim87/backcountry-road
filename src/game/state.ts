import type { Quiz } from './quiz';

export type Role = 'merchant' | 'farmer' | 'ranger';
export type Pace = 'rest' | 'steady' | 'strenuous' | 'grueling';
export type Rations = 'filling' | 'meager' | 'bare';
export type Phase = 'store' | 'travel' | 'event' | 'river' | 'hunt' | 'fish' | 'landmark' | 'end';
export type Weather = 'fair' | 'hot' | 'rain' | 'storm' | 'fog';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Member {
  name: string;
  health: number; // 0-100
  status: 'well' | 'sick' | 'injured' | 'dead';
  cause?: string;
}

export interface Supplies {
  food: number; // lbs
  shot: number;
  wheels: number;
  axles: number;
  tongues: number;
  medicine: number;
  riverGear: number;
  packHorses: number; // each carries 100 lb more home from a hunt
  money: number; // whole pounds sterling
}

export type Part = 'wheels' | 'axles' | 'tongues';

/** Peoples you trade with; each remembers how you treated them. */
export type Group = 'catawba' | 'cherokee' | 'settlers' | 'traders';
/** Rare, costly purchases that change how a run plays. */
export type Owned = 'rifle' | 'horses' | 'deed' | 'scout';
export type Goods = Exclude<keyof Supplies, 'packHorses'>;

/** A rolled trade: you hand over `give`, you receive `get`. */
export interface Offer {
  give: Goods;
  giveQty: number;
  get?: Goods; // absent for big items (see Pending.id)
  getQty?: number;
}

export interface Pending {
  id: string;
  target: number; // party index the event is about
  part?: Part;
  offer?: Offer;
  group?: Group;
}

export interface GameState {
  rng: number;
  role: Role;
  difficulty: Difficulty;
  day: number;
  miles: number;
  at: number; // index into ROUTE of the last landmark reached
  pace: Pace;
  rations: Rations;
  morale: number; // 0-100
  weather: Weather;
  party: Member[];
  supplies: Supplies;
  phase: Phase;
  rain: number; // recent rainfall, 0-6; raises rivers
  pending?: Pending;
  seen: string[]; // once-only events already fired
  rep: Record<Group, number>; // -3 (wary) .. 3 (trusted)
  owned: Owned[];
  fishedAt?: number; // ROUTE index of the river last fished (once per river)
  quiz?: Quiz; // the reckoning problem at the current landmark
  log: string[];
  result?: 'won' | 'lost';
  endReason?: string;
}

export const ROLES: Record<Role, { label: string; money: number; perk: string }> = {
  merchant: { label: 'Charleston merchant', money: 250, perk: 'Starts with the most money.' },
  farmer: { label: 'Backcountry farmer', money: 180, perk: 'Wagon repairs succeed more often.' },
  ranger: { label: 'Ranger', money: 150, perk: 'A better shot when hunting.' },
};

/** money: starting purse; events: daily event chance; flux: daily sickness chance. All multipliers. */
export const DIFFICULTY: Record<Difficulty, { label: string; money: number; events: number; flux: number }> = {
  easy: { label: 'Easy', money: 1.3, events: 0.8, flux: 0.5 },
  normal: { label: 'Normal', money: 1, events: 1, flux: 1 },
  hard: { label: 'Hard', money: 0.8, events: 1.2, flux: 2.5 },
};

export function newGame(role: Role, names: string[], seed = Date.now(), difficulty: Difficulty = 'normal'): GameState {
  return {
    rng: seed | 0,
    role,
    difficulty,
    day: 0,
    miles: 0,
    at: 0,
    pace: 'steady',
    rations: 'filling',
    morale: 80,
    weather: 'fair',
    party: names.map((name) => ({ name, health: 100, status: 'well' })),
    supplies: { food: 0, shot: 0, wheels: 0, axles: 0, tongues: 0, medicine: 0, riverGear: 0, packHorses: 0, money: Math.round(ROLES[role].money * DIFFICULTY[difficulty].money) },
    phase: 'store',
    rain: 0,
    seen: [],
    rep: { catawba: 0, cherokee: 0, settlers: 0, traders: 0 },
    owned: [],
    log: [],
  };
}

export const alive = (s: GameState) => s.party.filter((m) => m.status !== 'dead');

export function score(s: GameState): number {
  const living = alive(s);
  const deed = s.result === 'won' && s.owned.includes('deed') ? 500 : 0;
  return living.length * 100 + living.reduce((a, m) => a + m.health, 0) + Math.floor(s.supplies.food / 10) + s.supplies.money - s.day + deed;
}

export const clamp = (n: number, max = 100) => Math.max(0, Math.min(max, Math.round(n)));

export function note(s: GameState, msg: string) {
  if (msg) s.log = [msg, ...s.log].slice(0, 8);
}

export function damage(s: GameState, m: Member, n: number, cause: string) {
  if (m.status === 'dead') return;
  m.health = clamp(m.health - n);
  if (m.health === 0) {
    m.status = 'dead';
    m.cause = cause;
    s.morale = clamp(s.morale - 15);
    note(s, `${m.name} has died of ${cause}.`);
  }
}

/** Sets result/phase if the run is over. */
export function checkEnd(s: GameState): boolean {
  if (!s.result && alive(s).length === 0) {
    s.result = 'lost';
    s.endReason = 'Your whole party has perished.';
  }
  if (s.result) s.phase = 'end';
  return !!s.result;
}
