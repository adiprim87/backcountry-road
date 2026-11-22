import Phaser from 'phaser';
import { sfx } from '../sound';
import { makeTextures } from './sprites';

const FONT = '"Courier New", Courier, monospace';
const W = 800, H = 450, SECONDS = 20, BITE_MS = 750, WATER_Y = 260;
const FISH = [
  { name: 'bream', lb: 1, w: 5 },
  { name: 'shad', lb: 3, w: 3 },
  { name: 'catfish', lb: 6, w: 2 },
  { name: 'sturgeon', lb: 20, w: 0.3 },
];

export type FishDone = (lb: number) => void;

/** Timing game: wait for the float to dip, then tap before the fish lets go. */
export class FishScene extends Phaser.Scene {
  private done!: FishDone;
  private lb = 0;
  private left = SECONDS;
  private biting = false;
  private over = false;
  private canLeave = false;
  private float!: Phaser.GameObjects.Image;
  private hud!: Phaser.GameObjects.Text;
  private msg!: Phaser.GameObjects.Text;
  private bite?: Phaser.Time.TimerEvent;
  private bob!: Phaser.Tweens.Tween; // gentle bobbing, paused while a fish pulls the float under

  constructor() { super('fish'); }

  init(d: { done: FishDone }) {
    Object.assign(this, { done: d.done, lb: 0, left: SECONDS, biting: false, over: false, canLeave: false, bite: undefined });
  }

  create() {
    makeTextures(this);
    const g = this.add.graphics();
    g.fillStyle(0x10200f).fillRect(0, 0, W, WATER_Y);
    for (let i = 0; i < 14; i++) this.add.image(Phaser.Math.Between(0, W), WATER_Y - 95, 'pine').setOrigin(0.5, 1).setScale(0.5).setTint(0x99bb99); // far shore
    g.fillStyle(0x1a3318).fillRect(0, WATER_Y - 100, W, 22);
    const water = this.add.graphics().setDepth(-1);
    g.setDepth(-2);
    water.fillStyle(0x12303a).fillRect(0, WATER_Y - 78, W, H - WATER_Y + 78);
    water.lineStyle(1, 0x4fa3c7, 0.5);
    for (let i = 0; i < 14; i++) { const y = WATER_Y - 60 + i * 16; water.lineBetween(Phaser.Math.Between(150, 400), y, Phaser.Math.Between(450, W), y); }
    // Near bank with the angler; the rod runs from his hand out over the water.
    water.fillStyle(0x2a3a1a).fillRect(0, WATER_Y + 40, 230, H).fillTriangle(230, WATER_Y + 40, 290, H, 230, H);
    for (const [x, y] of [[215, WATER_Y + 48], [250, WATER_Y + 110], [30, WATER_Y + 44], [600, WATER_Y - 66], [700, WATER_Y - 70]]) this.add.image(x, y, 'reeds').setOrigin(0.5, 1);
    const ax = 110, ay = WATER_Y + 45;
    this.add.image(ax, ay, 'angler').setOrigin(0.5, 1);
    const hand = [ax + 13, ay - 28], tip = [360, WATER_Y - 120];
    this.add.graphics().lineStyle(3, 0x5a3a1e).lineBetween(hand[0], hand[1], tip[0], tip[1]).lineStyle(1, 0xc8c8c8).lineBetween(tip[0], tip[1], 400, WATER_Y);
    this.float = this.add.image(400, WATER_Y, 'float').setDepth(2);
    this.bob = this.tweens.add({ targets: this.float, y: WATER_Y + 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.hud = this.add.text(12, 10, '', { fontFamily: FONT, fontSize: '26px', color: '#7dff8a' });
    this.msg = this.add.text(W / 2, 72, 'Tap or press Space when the float dips.', { fontFamily: FONT, fontSize: '32px', color: '#7dff8a' }).setOrigin(0.5);
    this.time.addEvent({ delay: 1000, repeat: SECONDS - 1, callback: () => { if (--this.left <= 0) this.finish(); this.updateHud(); } });
    this.input.on('pointerdown', () => this.tap());
    // Space strikes; leaving uses keyup so the release can't also click the next screen's button.
    const kb = this.input.keyboard!;
    kb.addCapture('SPACE,ENTER');
    kb.on('keydown-SPACE', () => !this.over && this.tap());
    kb.on('keyup-SPACE', () => this.over && this.tap());
    kb.on('keyup-ENTER', () => this.over && this.tap());
    this.events.once('shutdown', () => kb.clearCaptures()); // give Space back to the page
    this.waitForBite(1500);
    this.updateHud();
  }

  private waitForBite(extra = 0) {
    this.bite?.remove();
    this.bite = this.time.delayedCall(extra + Phaser.Math.Between(1000, 3000), () => {
      if (this.over) return;
      this.biting = true;
      this.bob.pause();
      this.float.setY(WATER_Y + 8).setCrop(0, 0, 20, 12); // only the red tip shows above the water
      this.msg.setText('A bite!');
      this.bite = this.time.delayedCall(BITE_MS, () => this.endBite('It got away.'));
    });
  }

  private endBite(text: string, spook = 0) {
    this.biting = false;
    this.float.setY(WATER_Y).setCrop();
    this.bob.resume();
    this.msg.setText(text);
    this.waitForBite(spook);
  }

  private tap() {
    if (this.over) {
      if (this.canLeave) this.done(this.lb);
      return;
    }
    if (!this.biting) return this.endBite('Too soon. You spooked them.', 1000);
    let r = Math.random() * FISH.reduce((a, f) => a + f.w, 0);
    const f = FISH.find((x) => (r -= x.w) < 0) ?? FISH[0];
    this.lb += f.lb;
    sfx.hit();
    // The catch leaps out of the water and back.
    const leap = this.add.image(400, WATER_Y, f.name).setFlipX(Math.random() < 0.5).setDepth(3);
    this.tweens.add({ targets: leap, y: WATER_Y - 90, angle: leap.flipX ? 30 : -30, duration: 300, yoyo: true, ease: 'Quad.out',
      onComplete: () => leap.destroy() });
    this.endBite(`A ${f.name}, ${f.lb} lb!`);
    this.updateHud();
  }

  private updateHud() {
    this.hud.setText(`TIME ${Math.max(0, this.left)}   CATCH ${this.lb} lb`);
  }

  private finish() {
    if (this.over) return;
    this.over = true;
    this.time.removeAllEvents();
    this.add.rectangle(W / 2, H / 2, 520, 130, 0x0b0f0a, 0.9).setStrokeStyle(2, 0x7dff8a).setDepth(10);
    this.add.text(W / 2, H / 2, `Time to move on.\nYou caught ${this.lb} lb of fish.\n\nClick, tap or press Enter to return.`,
      { fontFamily: FONT, fontSize: '18px', color: '#7dff8a', align: 'center' }).setOrigin(0.5).setDepth(10);
    this.time.delayedCall(400, () => (this.canLeave = true));
  }
}
