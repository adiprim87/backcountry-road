import Phaser from 'phaser';
import { sfx } from '../sound';
import { makeTextures } from './sprites';
import type { Method } from '../game/river';

const FONT = '"Courier New", Courier, monospace';
const W = 800, H = 300, LEFT = 250, RIGHT = 550, ROAD = 150;

export interface CrossOpts { method: Method; safe: boolean; river: string }
export type CrossDone = () => void;

/** A short animation of the wagon crossing; the outcome was already decided by the game. Tap or Enter skips it. */
export class CrossScene extends Phaser.Scene {
  private opts!: CrossOpts;
  private done!: CrossDone;
  private ended = false;
  private canSkip = false; // the Enter that chose the crossing releases inside this scene; don't let it skip
  private wagon!: Phaser.GameObjects.Image;
  private currents: Phaser.GameObjects.Rectangle[] = [];
  private rock?: Phaser.Tweens.Tween; // floating wagon's rocking; stopped so it can't fight the mishap tilt

  constructor() { super('cross'); }

  init(d: { opts: CrossOpts; done: CrossDone }) {
    Object.assign(this, { opts: d.opts, done: d.done, ended: false, canSkip: false, currents: [], rock: undefined });
  }

  create() {
    makeTextures(this);
    const { method, safe, river } = this.opts;
    const g = this.add.graphics();
    g.fillStyle(0x1a3318).fillRect(0, 0, W, H);
    g.fillStyle(0x12303a).fillRect(LEFT, 0, RIGHT - LEFT, H);
    g.fillStyle(0x3a2a1a).fillRect(0, ROAD - 6, LEFT, 26).fillRect(RIGHT, ROAD - 6, W - RIGHT, 26); // road to the water
    for (let i = 0; i < 18; i++) this.currents.push(this.add.rectangle(Phaser.Math.Between(LEFT + 10, RIGHT - 10), Phaser.Math.Between(0, H), 2, 14, 0x4fa3c7, 0.5));
    for (const [x, y] of [[60, 50], [150, 250], [700, 40], [640, 260], [760, 230], [40, 230]]) this.add.image(x, y, 'pine').setOrigin(0.5, 1).setScale(0.5);
    for (const [x, y] of [[LEFT, 70], [LEFT + 5, 260], [RIGHT, 90], [RIGHT - 5, 240]]) this.add.image(x, y, 'reeds').setOrigin(0.5, 1);
    this.add.text(W / 2, 14, `Crossing the ${river}`, { fontFamily: FONT, fontSize: '22px', color: '#7dff8a' }).setOrigin(0.5, 0).setDepth(10);
    this.add.text(W - 10, H - 8, 'Tap or press Enter to skip', { fontFamily: FONT, fontSize: '14px', color: '#3f8a47' }).setOrigin(1, 1).setDepth(10);

    const raft = method === 'ferry' ? this.add.image(150, ROAD + 22, 'raft') : null;
    this.wagon = this.add.image(150, ROAD, 'wagon0').setScale(2.5).setOrigin(0.5, 0.75).setDepth(2);
    const riders: Phaser.GameObjects.Image[] = [this.wagon, ...(raft ? [raft] : [])];
    const sink = method === 'ferry' ? 0 : method === 'float' ? 14 : 8; // how low the wagon sits in the water
    const steps: Phaser.Types.Tweens.TweenBuilderConfig[] = [
      { targets: riders, x: LEFT + 30, duration: 600 },
      { targets: riders, x: W / 2, y: `+=${sink}`, duration: 800 },
    ];
    if (!safe) {
      steps.push({ targets: riders, y: '+=60', angle: 12, duration: 500, ease: 'Quad.out', onStart: () => this.mishap() });
      steps.push({ targets: riders, x: RIGHT - 30, angle: 0, duration: 900 });
      steps.push({ targets: riders, x: 650, y: ROAD + (raft ? 22 : 0), duration: 700 });
    } else {
      steps.push({ targets: riders, x: RIGHT - 30, duration: 800 });
      steps.push({ targets: riders, x: 650, y: `-=${sink}`, duration: 600 });
    }
    if (raft) steps[steps.length - 1].targets = this.wagon; // the raft stays at the landing
    if (raft) steps[steps.length - 1].y = ROAD;
    this.tweens.chain({ tweens: steps, onComplete: () => {
      this.rock?.stop();
      this.wagon.setAngle(0).setTexture('wagon0');
      this.time.delayedCall(500, () => this.finish());
    } });
    if (method === 'float') this.rock = this.tweens.add({ targets: this.wagon, angle: { from: -3, to: 3 }, duration: 400, yoyo: true, repeat: -1 });

    this.time.delayedCall(400, () => (this.canSkip = true));
    const skip = () => this.canSkip && this.finish();
    this.input.on('pointerdown', skip);
    const kb = this.input.keyboard!;
    kb.addCapture('ENTER,SPACE');
    kb.on('keyup-ENTER', skip); // keyup, so the release can't also click the next screen's button
    kb.on('keyup-SPACE', skip);
    this.events.once('shutdown', () => kb.clearCaptures());
  }

  private mishap() {
    this.rock?.stop();
    sfx.splash();
    const { x, y } = this.wagon;
    this.add.particles(x, y, 'drop', { speed: { min: 80, max: 220 }, angle: { min: 200, max: 340 }, gravityY: 500, lifespan: 700, emitting: false })
      .setDepth(3).explode(24);
    const crate = this.add.image(x + 10, y + 10, 'crate').setDepth(1);
    this.tweens.add({ targets: crate, y: H + 30, x: x + 40, angle: 90, duration: 2200 });
  }

  update(time: number, dt: number) {
    for (const c of this.currents) c.y = c.y > H ? -14 : c.y + (60 * dt) / 1000; // the river flows down the screen
    if (this.tweens.isTweening(this.wagon)) this.wagon.setTexture(Math.floor(time / 120) % 2 ? 'wagon1' : 'wagon0');
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.done();
  }
}
