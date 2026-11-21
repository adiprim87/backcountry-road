export type Role = 'merchant' | 'farmer' | 'ranger';
export type Pace = 'rest' | 'steady' | 'strenuous' | 'grueling';
export type Rations = 'filling' | 'meager' | 'bare';
export type Phase = 'store' | 'travel' | 'event' | 'river' | 'hunt' | 'landmark' | 'end';
export type Weather = 'fair' | 'hot' | 'rain' | 'storm' | 'fog';

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
  money: number; // whole pounds sterling
}

export type Part = 'wheels' | 'axles' | 'tongues';

export interface Pending {
  id: string;
  target: number; // party index the event is about
  part?: Part;
}

export interface GameState {
  rng: number;
  role: Role;
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
  log: string[];
  result?: 'won' | 'lost';
  endReason?: string;
}

export const ROLES: Record<Role, { label: string; money: number; perk: string }> = {
  merchant: { label: 'Charleston merchant', money: 300, perk: 'Starts with the most money.' },
  farmer: { label: 'Backcountry farmer', money: 180, perk: 'Wagon repairs succeed more often.' },
  ranger: { label: 'Ranger', money: 120, perk: 'A better shot when hunting.' },
};

export function newGame(role: Role, names: string[], seed = Date.now()): GameState {
  return {
    rng: seed | 0,
    role,
    day: 0,
    miles: 0,
    at: 0,
    pace: 'steady',
    rations: 'filling',
    morale: 80,
    weather: 'fair',
    party: names.map((name) => ({ name, health: 100, status: 'well' })),
    supplies: { food: 0, shot: 0, wheels: 0, axles: 0, tongues: 0, medicine: 0, riverGear: 0, money: ROLES[role].money },
    phase: 'store',
    rain: 0,
    seen: [],
    log: [],
  };
}

export const alive = (s: GameState) => s.party.filter((m) => m.status !== 'dead');

export function score(s: GameState): number {
  const living = alive(s);
  return living.length * 100 + living.reduce((a, m) => a + m.health, 0) + Math.floor(s.supplies.food / 10) + s.supplies.money - s.day;
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
