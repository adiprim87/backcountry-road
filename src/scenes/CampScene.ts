import Phaser from 'phaser';
import { makeTextures } from './sprites';
import { COATS } from './art';

const FONT = '"Courier New", Courier, monospace';
const W = 800, H = 300, GROUND = 190, FIRE_X = 400, FIRE_Y = 250;
// Places around the fire: [x, y, faces right]. Left side faces right, right side faces left.
const SEATS: [number, number, boolean][] = [[318, 245, true], [482, 245, false], [345, 282, true], [455, 282, false], [400, 215, true]];

export interface CampOpts { title: string; river: boolean; members: { name: string; resting: boolean }[] }
export type CampDone = () => void;

/** The party camps for a day: dusk, a night by the fire, then dawn. Tap or Enter skips. */
export class CampScene extends Phaser.Scene {
  private opts!: CampOpts;
  private done!: CampDone;
  private ended = false;
  private canSkip = false;

  constructor() { super('camp'); }

  init(d: { opts: CampOpts; done: CampDone }) {
    Object.assign(this, { opts: d.opts, done: d.done, ended: false, canSkip: false });
  }

  create() {
    makeTextures(this);
    const { title, river, members } = this.opts;
    const g = this.add.graphics();
    g.fillStyle(0x24344a).fillRect(0, 0, W, GROUND);
    if (river) g.fillStyle(0x12303a).fillRect(0, GROUND - 40, W, 40);
    g.fillStyle(0x1a3318).fillRect(0, GROUND, W, H - GROUND);
    for (let i = 0; i < 14; i++) this.add.image(Phaser.Math.Between(0, W), river ? GROUND - 40 : GROUND, 'pine').setOrigin(0.5, 1).setScale(0.5).setTint(0x99bb99);
    this.add.image(150, 250, 'wagon0').setScale(2.5).setOrigin(0.5, 1);

    // Night falls, stars come out, then dawn. One overlay and the stars share a single tween.
    const night = this.add.rectangle(W / 2, H / 2, W, H, 0x03060c).setAlpha(0).setDepth(5);
    const stars = Array.from({ length: 40 }, () =>
      this.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(5, GROUND - 50), 2, 2, 0xf0f0ff).setAlpha(0).setDepth(6));
    this.tweens.addCounter({ from: 0, to: 1, duration: 1100, yoyo: true, hold: 600, ease: 'Sine.inOut',
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        night.setAlpha(v * 0.6);
        stars.forEach((s) => s.setAlpha(v * 0.9));
      },
      onComplete: () => this.time.delayedCall(250, () => this.finish()) });

    // The fire and its glow sit above the dark, so the camp stays lit all night.
    // Soft glow: a few stacked circles fade out toward the edge instead of one hard disk.
    const glow = this.add.container(FIRE_X, FIRE_Y - 10, [120, 90, 60].map((r) => this.add.circle(0, 0, r, 0xffaa44, 0.06))).setDepth(7);
    this.tweens.add({ targets: glow, alpha: 0.7, scale: 1.08, duration: 300, yoyo: true, repeat: -1 });
    const fire = this.add.image(FIRE_X, FIRE_Y, 'fire').setScale(2).setOrigin(0.5, 1).setDepth(9);
    this.time.addEvent({ delay: 140, loop: true, callback: () => fire.setTexture(fire.texture.key === 'fire' ? 'fire1' : 'fire') });

    members.slice(0, SEATS.length).forEach((m, i) => {
      const [x, y, right] = SEATS[i];
      const coat = i % COATS.length;
      const body = m.resting
        ? this.add.image(x, y, 'sleeper').setOrigin(0.5, 1).setFlipX(!right)
        : this.add.image(x, y, `sit${coat}a`).setOrigin(0.5, 1).setFlipX(!right);
      body.setDepth(8 + y / 1000);
      if (m.resting) this.tweens.add({ targets: body, scaleY: 1.06, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); // breathing
      else {
        this.tweens.add({ targets: body, y: y - 2, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        // Now and then someone lifts a bite to their mouth.
        this.time.addEvent({ delay: 900 + i * 230, loop: true, callback: () => {
          body.setTexture(`sit${coat}b`);
          this.time.delayedCall(350, () => body.active && body.setTexture(`sit${coat}a`));
        } });
      }
      const behindFire = i === 4; // the back seat's name goes above the head, not under the fire
      this.add.text(x, behindFire ? y - 50 : y + 4, m.name, { fontFamily: FONT, fontSize: '12px', color: '#e8e0c8' }).setOrigin(0.5, 0).setDepth(9);
    });

    this.add.text(W / 2, 14, title, { fontFamily: FONT, fontSize: '22px', color: '#7dff8a' }).setOrigin(0.5, 0).setDepth(10);
    this.add.text(W - 10, H - 8, 'Tap or press Enter to skip', { fontFamily: FONT, fontSize: '14px', color: '#3f8a47' }).setOrigin(1, 1).setDepth(10);

    this.time.delayedCall(400, () => (this.canSkip = true)); // the Enter that chose to rest releases inside this scene
    const skip = () => this.canSkip && this.finish();
    this.input.on('pointerdown', skip);
    const kb = this.input.keyboard!;
    kb.addCapture('ENTER,SPACE');
    kb.on('keyup-ENTER', skip);
    kb.on('keyup-SPACE', skip);
    this.events.once('shutdown', () => kb.clearCaptures());
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.done();
  }
}
