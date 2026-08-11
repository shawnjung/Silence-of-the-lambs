import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../shared/api';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { ScoreStage } from './scenes/ScoreStage';
import { PvpLanding } from './scenes/PvpLanding';
import { PvpStage } from './scenes/PvpStage';
import { Hud } from './scenes/Hud';
import { installErrorOverlay } from './core/safety';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  parent: 'game-container',
  backgroundColor: '#0b1707',
  scale: {
    // RESIZE hands us the full parent size; core/layout.ts turns that into a
    // 1136x640 play band plus HUD strips, so no scene ever sees device pixels.
    mode: Phaser.Scale.RESIZE,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  },
  scene: [Boot, Preloader, MainMenu, ScoreStage, PvpLanding, PvpStage, Hud],
};

installErrorOverlay();

document.addEventListener('DOMContentLoaded', () => {
  new Game(config);
});
