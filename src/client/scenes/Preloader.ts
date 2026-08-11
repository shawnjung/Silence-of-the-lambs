import { Scene } from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/api';
import { publishDecodedAudio, queueAudioBinaries } from '../core/audioDecode';
import {
  AssetUrls,
  AtlasKeys,
  AudioKeys,
  BitmapFontKeys,
  ImageKeys,
} from '../core/assets';

/**
 * Draws the grass backdrop Boot already loaded plus a simple progress bar,
 * then loads everything else the game needs before handing off to MainMenu.
 */
const AUDIO_ENTRIES = [
  { key: AudioKeys.Music, url: AssetUrls[AudioKeys.Music] },
  { key: AudioKeys.Effects, url: AssetUrls[AudioKeys.Effects] },
  { key: AudioKeys.Tap, url: AssetUrls[AudioKeys.Tap] },
] as const;

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  init(): void {
    this.add
      .image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, ImageKeys.Grass)
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);

    const barWidth = 400;
    const barHeight = 28;
    const x = WORLD_WIDTH / 2 - barWidth / 2;
    const y = WORLD_HEIGHT / 2 - barHeight / 2;

    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, barWidth + 8, barHeight + 8, 0x000000, 0.5);

    const bar = this.add.graphics();

    this.load.on('progress', (progress: number) => {
      bar.clear();
      bar.fillStyle(0xffffff, 1);
      bar.fillRect(x, y, barWidth * progress, barHeight);
    });
  }

  preload(): void {
    const lamb = AssetUrls[AtlasKeys.Lamb];
    const enemyLamb = AssetUrls[AtlasKeys.EnemyLamb];
    const landing = AssetUrls[AtlasKeys.Landing];
    const pvpLanding = AssetUrls[AtlasKeys.PvpLanding];
    const endingMessages = AssetUrls[AtlasKeys.EndingMessages];
    const numbers = AssetUrls[BitmapFontKeys.Numbers];

    this.load.atlas(AtlasKeys.Lamb, lamb.texture, lamb.atlas);
    this.load.atlas(AtlasKeys.EnemyLamb, enemyLamb.texture, enemyLamb.atlas);
    this.load.atlas(AtlasKeys.Landing, landing.texture, landing.atlas);
    this.load.atlas(AtlasKeys.EndingMessages, endingMessages.texture, endingMessages.atlas);

    this.load.image(ImageKeys.LandingBg, AssetUrls[ImageKeys.LandingBg]);
    this.load.image(ImageKeys.PvpLandingBg, AssetUrls[ImageKeys.PvpLandingBg]);

    this.load.atlas(AtlasKeys.PvpLanding, pvpLanding.texture, pvpLanding.atlas);

    this.load.bitmapFont(BitmapFontKeys.Numbers, numbers.texture, numbers.xml);

    // Not this.load.audio: Phaser's canPlayType probe rejects .m4a even where
    // the browser decodes it fine. See core/audioDecode.ts.
    queueAudioBinaries(this, AUDIO_ENTRIES);
  }

  create(): void {
    // Deliberately not awaited: decoding is a few milliseconds of Web Audio
    // work and the menu should not wait on it. Music only starts on the first
    // tap, and every audio call site treats a missing key as "play nothing"
    // (core/audio.ts), so arriving late is harmless.
    void publishDecodedAudio(this, AUDIO_ENTRIES);
    this.scene.start('MainMenu');
  }
}
