import Phaser from 'phaser';

const FONT = '"Courier New", Courier, monospace';

export interface HuntOpts { shots: number; ranger: boolean; rifle: boolean; carry: number }
export type HuntDone = (meat: number, used: number) => void;

const W = 800, H = 450, SECONDS = 30;
const GAME = [
  { name: 'rabbit', lb: 3, r: 10, speed: 220, color: 0xc8b89a, w: 4 },
  { name: 'turkey', lb: 12, r: 14, speed: 150, color: 0x8a5a2b, w: 3 },
  { name: 'deer', lb: 50, r: 24, speed: 120, color: 0xb5835a, w: 2 },
  { name: 'boar', lb: 40, r: 20, speed: 170, color: 0x6b5444, w: 1.5 },
];

interface Animal { obj: Phaser.GameObjects.Ellipse; lb: number; r: number; vx: number }

export class HuntScene extends Phaser.Scene {
  private opts!: HuntOpts;
  private done!: HuntDone;
  private animals: Animal[] = [];
  private meat = 0;
  private used = 0;
  private left = SECONDS;
  private over = false;
  private canLeave = false;
  private hud!: Phaser.GameObjects.Text;

  constructor() { super('hunt'); }

  init(d: { opts: HuntOpts; done: HuntDone }) {
    Object.assign(this, { opts: d.opts, done: d.done, animals: [], meat: 0, used: 0, left: SECONDS, over: false, canLeave: false });
  }

  create() {
    const g = this.add.graphics();
    g.fillStyle(0x10200f).fillRect(0, 0, W, H);
    g.fillStyle(0x1a3318).fillRect(0, 300, W, H - 300);
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(0, W), base = Phaser.Math.Between(260, 330);
      g.fillStyle(0x3b2a1e).fillRect(x - 4, base - 160, 8, 160);
      g.fillStyle(0x1f4a24).fillTriangle(x - 30, base - 110, x + 30, base - 110, x, base - 230);
    }
    this.hud = this.add.text(12, 10, '', { fontFamily: FONT, fontSize: '18px', color: '#7dff8a' });
    this.time.addEvent({ delay: 900, loop: true, callback: () => this.spawn() });
    this.time.addEvent({ delay: 1000, repeat: SECONDS - 1, callback: () => { if (--this.left <= 0) this.finish(); } });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.shoot(p.x, p.y));
    this.updateHud();
  }

  private spawn() {
    if (this.over) return;
    let r = Math.random() * GAME.reduce((a, g) => a + g.w, 0);
    const t = GAME.find((g) => (r -= g.w) < 0) ?? GAME[0];
    const fromLeft = Math.random() < 0.5;
    const speed = t.speed * (this.opts.ranger ? 0.8 : 1) * Phaser.Math.FloatBetween(0.8, 1.2);
    const obj = this.add.ellipse(fromLeft ? -30 : W + 30, Phaser.Math.Between(150, 420), t.r * 2.4, t.r * 1.6, t.color);
    this.animals.push({ obj, lb: t.lb, r: t.r, vx: fromLeft ? speed : -speed });
  }

  update(_: number, dt: number) {
    for (const a of this.animals) a.obj.x += (a.vx * dt) / 1000;
    this.animals = this.animals.filter((a) => {
      const gone = a.obj.x < -40 || a.obj.x > W + 40;
      if (gone) a.obj.destroy();
      return !gone;
    });
  }

  private shoot(x: number, y: number) {
    if (this.over) {
      if (this.canLeave) this.done(this.meat, this.used);
      return;
    }
    if (this.used >= this.opts.shots) return;
    this.used++;
    const flash = this.add.circle(x, y, 6, 0xffffcc);
    this.tweens.add({ targets: flash, alpha: 0, scale: 3, duration: 250, onComplete: () => flash.destroy() });
    const reach = (this.opts.ranger ? 1.5 : 1.2) * (this.opts.rifle ? 1.3 : 1);
    const hit = this.animals.find((a) => Phaser.Math.Distance.Between(x, y, a.obj.x, a.obj.y) < a.r * reach);
    if (hit) {
      this.meat += hit.lb;
      const label = this.add.text(hit.obj.x, hit.obj.y - 20, `+${hit.lb} lb`, { fontFamily: FONT, fontSize: '16px', color: '#ffffcc' }).setOrigin(0.5);
      this.tweens.add({ targets: label, y: label.y - 30, alpha: 0, duration: 800, onComplete: () => label.destroy() });
      hit.obj.destroy();
      this.animals = this.animals.filter((a) => a !== hit);
    }
    this.updateHud();
    if (this.used >= this.opts.shots || this.meat >= this.opts.carry) this.finish();
  }

  private updateHud() {
    this.hud.setText(`TIME ${Math.max(0, this.left)}   SHOTS ${this.opts.shots - this.used}   MEAT ${this.meat}/${this.opts.carry} lb`);
  }

  private finish() {
    if (this.over) return;
    this.over = true;
    this.time.removeAllEvents();
    this.updateHud();
    const extra = this.meat >= this.opts.carry ? `\nThat's all you can carry (${this.opts.carry} lb).` : '';
    this.add.rectangle(W / 2, H / 2, 520, 130, 0x0b0f0a, 0.9).setStrokeStyle(2, 0x7dff8a);
    this.add.text(W / 2, H / 2, `The hunt is over.\nYou shot ${this.meat} lb of game.${extra}\n\nClick or tap to return.`,
      { fontFamily: FONT, fontSize: '18px', color: '#7dff8a', align: 'center' }).setOrigin(0.5);
    // Ignore the click that ended the hunt, so the summary is readable.
    this.time.delayedCall(400, () => (this.canLeave = true));
  }
}
