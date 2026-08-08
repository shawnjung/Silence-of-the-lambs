import { Scene } from 'phaser';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  create(): void {
    this.scene.start('MainMenu');
  }
}
