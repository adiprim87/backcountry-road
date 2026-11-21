export interface Landmark {
  name: string;
  mile: number;
  kind: 'town' | 'river' | 'fort';
  store?: boolean;
  depth?: number; // river depth in feet when dry
  ferry?: number; // ferry fare in £, if there is one
  text: string;
}

// Mileages are approximate.
export const ROUTE: Landmark[] = [
  { name: 'Charleston', mile: 0, kind: 'town', store: true,
    text: 'Charles Town, the richest port in the colonies. Its wealth rests on rice and indigo worked by enslaved Africans. You load your wagon and turn west.' },
  { name: 'Dorchester', mile: 25, kind: 'town', store: true,
    text: 'A small market town on the Ashley River, with a brick church and a few shops.' },
  { name: 'Edisto River', mile: 55, kind: 'river', depth: 3, ferry: 5,
    text: 'The black-water Edisto winds through cypress swamp.' },
  { name: 'Orangeburg', mile: 85, kind: 'town', store: true,
    text: 'A township of Swiss and German settlers. Prices are higher here.' },
  { name: 'Congaree River', mile: 120, kind: 'river', depth: 4.5, ferry: 8,
    text: 'Near the Saxe-Gotha settlement, the Congaree runs wide and fast.' },
  { name: 'Saluda River', mile: 150, kind: 'river', depth: 3.5, ferry: 6,
    text: 'The rocky Saluda. Traders say its fords shift after every rain.' },
  { name: 'Ninety Six', mile: 190, kind: 'town', store: true,
    text: 'A trading post on the Cherokee Path, with a stockade and a crossroads of traders.' },
  { name: 'Long Canes', mile: 225, kind: 'town',
    text: 'Cane breaks and scattered homesteads. There is no store here.' },
  { name: 'Twelve Mile River', mile: 270, kind: 'river', depth: 2.5,
    text: 'A clear, cold foothill river with no ferry. The Blue Ridge shows on the horizon.' },
  { name: 'Fort Prince George', mile: 300, kind: 'fort',
    text: 'The earthwork fort across from the Cherokee town of Keowee. Your journey is done.' },
];

export const TOTAL_MILES = ROUTE[ROUTE.length - 1].mile;
