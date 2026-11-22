import type { Difficulty, Role } from './state';

export interface ScoreEntry { name: string; role: Role; difficulty: Difficulty; score: number; days: number; daily?: string }

const KEY = 'backcountry-road-scores-v1';
const MAX = 5;

/** Insert a run, keep the best MAX. Pure, so it can be tested. */
export const addScore = (list: ScoreEntry[], e: ScoreEntry) => [...list, e].sort((a, b) => b.score - a.score).slice(0, MAX);

export function loadScores(): ScoreEntry[] {
  try {
    const xs = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(xs) ? xs.filter((x) => x && typeof x.score === 'number' && typeof x.days === 'number' && typeof x.name === 'string') : [];
  } catch {
    return [];
  }
}

export function recordScore(e: ScoreEntry) {
  const list = addScore(loadScores(), e);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* unsaved */ }
  return list;
}
