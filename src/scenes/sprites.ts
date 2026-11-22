import type Phaser from 'phaser';
import { ART, PALETTE } from './art';

/** Turn the text art into textures once per game (textures are shared by all scenes). */
export function makeTextures(scene: Phaser.Scene) {
  for (const [key, a] of Object.entries(ART)) {
    if (!scene.textures.exists(key)) scene.textures.generate(key, { data: a.rows, pixelWidth: a.px,
      // Phaser's type lists its default 0-F keys, but any characters work.
      palette: { ...PALETTE, ...a.pal } as unknown as Phaser.Types.Create.Palette });
  }
}
