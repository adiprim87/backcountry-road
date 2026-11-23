import Phaser from 'phaser';
import type { Weather } from '../game/state';
import { MapScene } from './MapScene';
import { HuntScene, type HuntDone, type HuntOpts } from './HuntScene';
import { FishScene, type FishDone } from './FishScene';
import { CrossScene, type CrossDone, type CrossOpts } from './CrossScene';
import { CampScene, type CampDone, type CampOpts } from './CampScene';

let game: Phaser.Game | null = null;
const el = () => document.getElementById('game')!;

// Sharp pixels only when the browser enlarges the canvas; when it shrinks it, smoothing keeps small text readable.
function pixelate() {
  const c = game?.canvas;
  if (c) c.style.imageRendering = c.clientWidth * devicePixelRatio >= c.width ? 'pixelated' : '';
}
addEventListener('resize', pixelate);

function ensure(w: number, h: number) {
  el().hidden = false;
  if (!game) {
    game = new Phaser.Game({
      type: Phaser.AUTO, parent: 'game', width: w, height: h, backgroundColor: '#0b0f0a',
      scale: { mode: Phaser.Scale.NONE }, // CSS scales the canvas to the column width
      banner: false,
      pixelArt: true, // keep sprite edges sharp when Phaser scales them
    });
    game.scene.add('map', MapScene, false);
    game.scene.add('hunt', HuntScene, false);
    game.scene.add('fish', FishScene, false);
    game.scene.add('cross', CrossScene, false);
    game.scene.add('camp', CampScene, false);
    if (import.meta.env.DEV) Object.assign(window, { __game: game }); // for browser smoke tests
  } else game.scale.setGameSize(w, h);
  game.scale.refresh();
  pixelate();
  return game;
}

export function showMap(miles: number, weather: Weather) {
  const g = ensure(800, 200);
  for (const k of ['hunt', 'fish', 'cross', 'camp']) if (g.scene.isActive(k)) g.scene.stop(k);
  if (g.scene.isActive('map')) {
    const map = g.scene.getScene('map') as MapScene;
    map.setMiles(miles);
    map.setWeather(weather);
  } else g.scene.start('map', { miles, weather });
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

export function startCrossing(opts: CrossOpts, done: CrossDone) {
  const g = ensure(800, 300);
  g.scene.stop('map');
  g.scene.start('cross', { opts, done });
}

export function startCamp(opts: CampOpts, done: CampDone) {
  const g = ensure(800, 300);
  g.scene.stop('map');
  g.scene.start('camp', { opts, done });
}

export function hideCanvas() {
  el().hidden = true;
  game?.scene.stop('map');
  game?.scene.stop('hunt');
  game?.scene.stop('fish');
  game?.scene.stop('cross');
  game?.scene.stop('camp');
}
