// mulberry32; state lives on the game object so saves replay identically.
export function rand(s: { rng: number }): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function weighted<T extends { w: number }>(s: { rng: number }, items: T[]): T {
  let r = rand(s) * items.reduce((a, i) => a + i.w, 0);
  for (const i of items) if ((r -= i.w) < 0) return i;
  return items[items.length - 1];
}
