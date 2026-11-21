import Phaser from 'phaser';

const FONT = '"Courier New", Courier, monospace';
import { ROUTE } from '../game/route';

// Hand-placed positions on an 800x200 sketch of the colony, coast at bottom right.
const PTS: [number, number][] = [
  [750, 165], [690, 145], [615, 150], [545, 125], [465, 100],
  [395, 110], [305, 92], [225, 72], [135, 50], [60, 40],
];
const FG = 0x7dff8a, DIM = 0x3f8a47, WATER = 0x4fa3c7;

export function pointAt(miles: number): [number, number] {
  let i = 0;
  while (i < ROUTE.length - 2 && miles > ROUTE[i + 1].mile) i++;
  const t = Math.min(1, (miles - ROUTE[i].mile) / (ROUTE[i + 1].mile - ROUTE[i].mile));
  return [PTS[i][0] + (PTS[i + 1][0] - PTS[i][0]) * t, PTS[i][1] + (PTS[i + 1][1] - PTS[i][1]) * t];
}

export class MapScene extends Phaser.Scene {
  private miles = 0;
  private trail!: Phaser.GameObjects.Graphics;
  private wagon!: Phaser.GameObjects.Rectangle;

  constructor() { super('map'); }

  init(d: { miles: number }) { this.miles = d.miles; }

  create() {
    const g = this.add.graphics();
    g.lineStyle(2, WATER, 0.8);
    ROUTE.forEach((l, i) => {
      if (l.kind !== 'river') return;
      const [x, y] = PTS[i];
      g.beginPath(); g.moveTo(x - 25, y - 40); g.lineTo(x - 5, y - 10); g.lineTo(x + 5, y + 10); g.lineTo(x + 30, y + 45); g.strokePath();
    });
    g.lineStyle(2, DIM, 1).strokePoints(PTS.map(([x, y]) => new Phaser.Math.Vector2(x, y)));
    ROUTE.forEach((l, i) => {
      const [x, y] = PTS[i];
      g.fillStyle(l.kind === 'river' ? WATER : FG, 1).fillCircle(x, y, 4);
      this.add.text(i === ROUTE.length - 1 ? x - 40 : x, i % 2 ? y + 10 : y - 24, l.name.replace(' River', ''), { fontFamily: FONT, fontSize: '13px', color: '#7dff8a' })
        .setOrigin(i === ROUTE.length - 1 ? 0 : 0.5, 0);
    });
    this.add.text(790, 190, 'ATLANTIC', { fontFamily: FONT, fontSize: '11px', color: '#4fa3c7' }).setOrigin(1, 1);
    this.trail = this.add.graphics();
    this.wagon = this.add.rectangle(0, 0, 10, 10, FG).setStrokeStyle(2, 0x0b0f0a);
    this.draw(this.miles);
  }

  setMiles(m: number) {
    if (m === this.miles) return;
    this.tweens.addCounter({ from: this.miles, to: m, duration: 500, onUpdate: (tw) => this.draw(tw.getValue() ?? m) });
    this.miles = m;
  }

  private draw(m: number) {
    const pts = PTS.filter((_, i) => ROUTE[i].mile <= m).concat([pointAt(m)]);
    this.trail.clear().lineStyle(3, FG, 1).strokePoints(pts.map(([x, y]) => new Phaser.Math.Vector2(x, y)));
    this.wagon.setPosition(...pointAt(m));
  }
}
