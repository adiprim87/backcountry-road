import Phaser from 'phaser';
import { MapScene } from './MapScene';
import { HuntScene, type HuntDone, type HuntOpts } from './HuntScene';
import { FishScene, type FishDone } from './FishScene';

let game: Phaser.Game | null = null;
const el = () => document.getElementById('game')!;

function ensure(w: number, h: number) {
  el().hidden = false;
  if (!game) {
    game = new Phaser.Game({
      type: Phaser.AUTO, parent: 'game', width: w, height: h, backgroundColor: '#0b0f0a',
      scale: { mode: Phaser.Scale.NONE }, // CSS scales the canvas to the column width
      banner: false,
    });
    game.scene.add('map', MapScene, false);
    game.scene.add('hunt', HuntScene, false);
    game.scene.add('fish', FishScene, false);
    if (import.meta.env.DEV) Object.assign(window, { __game: game }); // for browser smoke tests
  } else game.scale.setGameSize(w, h);
  game.scale.refresh();
  return game;
}

export function showMap(miles: number) {
  const g = ensure(800, 200);
  for (const k of ['hunt', 'fish']) if (g.scene.isActive(k)) g.scene.stop(k);
  if (g.scene.isActive('map')) (g.scene.getScene('map') as MapScene).setMiles(miles);
  else g.scene.start('map', { miles });
}

export function startHunt(opts: HuntOpts, done: HuntDone) {
  const g = ensure(800, 450);
  g.scene.stop('map');
  g.scene.start('hunt', { opts, done });
}

export function startFish(done: FishDone) {
  const g = ensure(800, 450);
  g.scene.stop('map');
  g.scene.start('fish', { done });
}

export function hideCanvas() {
  el().hidden = true;
  game?.scene.stop('map');
  game?.scene.stop('hunt');
  game?.scene.stop('fish');
}
