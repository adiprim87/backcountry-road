import Phaser from 'phaser';
import { sfx } from '../sound';

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
  private float!: Phaser.GameObjects.Arc;
  private hud!: Phaser.GameObjects.Text;
  private msg!: Phaser.GameObjects.Text;
  private bite?: Phaser.Time.TimerEvent;

  constructor() { super('fish'); }

  init(d: { done: FishDone }) {
    Object.assign(this, { done: d.done, lb: 0, left: SECONDS, biting: false, over: false, canLeave: false, bite: undefined });
  }

  create() {
    const g = this.add.graphics();
    g.fillStyle(0x10200f).fillRect(0, 0, W, WATER_Y);
    g.fillStyle(0x12303a).fillRect(0, WATER_Y, W, H - WATER_Y);
    g.lineStyle(1, 0x4fa3c7, 0.5);
    for (let i = 0; i < 12; i++) { const y = WATER_Y + 15 + i * 15; g.lineBetween(Phaser.Math.Between(0, 300), y, Phaser.Math.Between(400, W), y); }
    g.lineStyle(2, 0x3b2a1e).lineBetween(60, 120, 400, WATER_Y - 60); // rod
    g.lineStyle(1, 0xc8c8c8).lineBetween(400, WATER_Y - 60, 400, WATER_Y); // line
    this.float = this.add.circle(400, WATER_Y, 18, 0xd94a3a).setStrokeStyle(3, 0xf0f0f0);
    this.tweens.add({ targets: this.float, y: WATER_Y + 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.hud = this.add.text(12, 10, '', { fontFamily: FONT, fontSize: '26px', color: '#7dff8a' });
    this.msg = this.add.text(W / 2, 70, 'Tap or press Space when the float dips.', { fontFamily: FONT, fontSize: '32px', color: '#7dff8a' }).setOrigin(0.5);
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
      this.float.setY(WATER_Y + 14).setScale(0.7);
      this.msg.setText('A bite!');
      this.bite = this.time.delayedCall(BITE_MS, () => this.endBite('It got away.'));
    });
  }

  private endBite(text: string, spook = 0) {
    this.biting = false;
    this.float.setScale(1);
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
    this.add.rectangle(W / 2, H / 2, 520, 130, 0x0b0f0a, 0.9).setStrokeStyle(2, 0x7dff8a);
    this.add.text(W / 2, H / 2, `Time to move on.\nYou caught ${this.lb} lb of fish.\n\nClick, tap or press Enter to return.`,
      { fontFamily: FONT, fontSize: '18px', color: '#7dff8a', align: 'center' }).setOrigin(0.5);
    this.time.delayedCall(400, () => (this.canLeave = true));
  }
}
