import { Scene } from 'phaser';

export class ScoreStage extends Scene {
  constructor() {
    super('ScoreStage');
  }

  create(): void {
    this.scene.start('MainMenu');
  }
}
