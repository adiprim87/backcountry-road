import type { GameState } from './state';
import { repairPending } from './events';

const KEY = 'backcountry-road-save-v1';

// Storage can throw (private mode, blocked site data); the game just runs unsaved.
export function save(s: GameState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* unsaved */ }
}

export function load(): GameState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!s || !Array.isArray(s.party) || typeof s.miles !== 'number' || !s.supplies) return null;
    // Fill in fields added after a save was written.
    s.supplies.packHorses ??= 0;
    s.rep ??= { catawba: 0, cherokee: 0, settlers: 0, traders: 0 };
    s.owned ??= [];
    s.difficulty ??= 'normal';
    if (s.phase === 'hunt') s.phase = 'travel'; // a hunt in progress can't be resumed
    repairPending(s);
    return s;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing saved */ }
}
