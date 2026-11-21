import type { GameState, Supplies } from './state';
import { ROUTE, TOTAL_MILES } from './route';

export type ItemKey = Exclude<keyof Supplies, 'money'>;

export const ITEMS: { key: ItemKey; label: string; qty: number; price: number }[] = [
  { key: 'food', label: 'Food, 10 lb', qty: 10, price: 2 },
  { key: 'shot', label: 'Powder & shot, 20 shots', qty: 20, price: 2 },
  { key: 'wheels', label: 'Spare wheel', qty: 1, price: 10 },
  { key: 'axles', label: 'Spare axle', qty: 1, price: 10 },
  { key: 'tongues', label: 'Spare tongue', qty: 1, price: 8 },
  { key: 'medicine', label: 'Medicine, 1 dose', qty: 1, price: 3 },
  { key: 'riverGear', label: 'Rope & caulking', qty: 1, price: 5 },
];

// Goods cost up to double by the time you reach the frontier.
export function unitPrice(s: GameState, key: ItemKey): number {
  const item = ITEMS.find((i) => i.key === key)!;
  return Math.ceil(item.price * (1 + ROUTE[s.at].mile / TOTAL_MILES));
}

export function buy(s: GameState, key: ItemKey, n = 1): boolean {
  const cost = unitPrice(s, key) * n;
  if (n < 1 || cost > s.supplies.money) return false;
  s.supplies.money -= cost;
  s.supplies[key] += ITEMS.find((i) => i.key === key)!.qty * n;
  return true;
}
