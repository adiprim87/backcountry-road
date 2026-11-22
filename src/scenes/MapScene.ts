import Phaser from 'phaser';

const FONT = '"Courier New", Courier, monospace';
import { ROUTE } from '../game/route';
import { makeTextures } from './sprites';

// Hand-placed positions on an 800x200 sketch of the colony, coast at bottom right.
const PTS: [number, number][] = [
  [750, 165], [690, 145], [615, 150], [545, 125], [465, 100],
  [395, 110], [305, 92], [225, 72], [135, 50], [60, 40],
];
const FG = 0x7dff8a, DIM = 0x3f8a47, WATER = 0x4fa3c7;

function pointAt(miles: number): [number, number] {
  let i = 0;
  while (i < ROUTE.length - 2 && miles > ROUTE[i + 1].mile) i++;
  const t = Math.min(1, (miles - ROUTE[i].mile) / (ROUTE[i + 1].mile - ROUTE[i].mile));
  return [PTS[i][0] + (PTS[i + 1][0] - PTS[i][0]) * t, PTS[i][1] + (PTS[i + 1][1] - PTS[i][1]) * t];
}

// Distance from a point to the trail, to keep decoration off the road and labels.
function nearTrail(x: number, y: number) {
  return PTS.some(([px, py], i) => {
    if (Math.abs(px - x) < 45 && Math.abs(py - y) < 32) return true; // landmark and its label
    const nx = PTS[i + 1];
    if (!nx) return false;
    const [dx, dy] = [nx[0] - px, nx[1] - py];
    const t = Phaser.Math.Clamp(((x - px) * dx + (y - py) * dy) / (dx * dx + dy * dy), 0, 1);
    return Phaser.Math.Distance.Between(x, y, px + dx * t, py + dy * t) < 16;
  });
}

export class MapScene extends Phaser.Scene {
  private miles = 0;
  private trail!: Phaser.GameObjects.Graphics;
  private wagon!: Phaser.GameObjects.Image;

  constructor() { super('map'); }

  init(d: { miles: number }) { this.miles = d.miles; }

  create() {
    makeTextures(this);
    // Same forest every time: a fixed little random sequence.
    let r = 7;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = 15 + rnd() * 770, y = 12 + rnd() * 170;
      if (!nearTrail(x, y) && !(x > 700 && y > 170)) this.add.image(x, y, 'tree').setAlpha(0.45 + rnd() * 0.35);
    }
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
      if (l.kind === 'river') g.fillStyle(WATER, 1).fillCircle(x, y, 4);
      else this.add.image(x, y, l.kind === 'fort' ? 'fort' : 'house').setOrigin(0.5, 0.8);
      this.add.text(i === ROUTE.length - 1 ? x - 40 : x, i % 2 ? y + 10 : y - 26, l.name.replace(' River', ''), { fontFamily: FONT, fontSize: '13px', color: '#7dff8a' })
        .setOrigin(i === ROUTE.length - 1 ? 0 : 0.5, 0);
    });
    this.add.text(790, 190, 'ATLANTIC', { fontFamily: FONT, fontSize: '11px', color: '#4fa3c7' }).setOrigin(1, 1);
    this.trail = this.add.graphics();
    this.wagon = this.add.image(0, 0, 'wagon0').setFlipX(true).setOrigin(0.5, 0.9); // art faces right; the road runs west
    this.draw(this.miles);
  }

  setMiles(m: number) {
    if (m === this.miles) return;
    this.tweens.addCounter({ from: this.miles, to: m, duration: 600, onUpdate: (tw) => {
      this.draw(tw.getValue() ?? m);
      this.wagon.setTexture(Math.floor(tw.progress * 8) % 2 ? 'wagon1' : 'wagon0'); // wheels turn while moving
    } });
    this.miles = m;
  }

  private draw(m: number) {
    const pts = PTS.filter((_, i) => ROUTE[i].mile <= m).concat([pointAt(m)]);
    this.trail.clear().lineStyle(3, FG, 1).strokePoints(pts.map(([x, y]) => new Phaser.Math.Vector2(x, y)));
    this.wagon.setPosition(...pointAt(m));
  }
}
