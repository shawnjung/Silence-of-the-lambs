import { Scene } from 'phaser';
import { AssetUrls, ImageKeys } from '../core/assets';

/**
 * Boot loads the bare minimum Preloader needs to draw itself — just the
 * grass backdrop it sits in front of while the progress bar runs — then
 * hands off immediately. Everything else is Preloader's job.
 */
export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image(ImageKeys.Grass, AssetUrls[ImageKeys.Grass]);
  }

  create(): void {
    this.scene.start('Preloader');
  }
}
