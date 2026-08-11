import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { showLoginPrompt } from '@devvit/web/client';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/api';
import {
  AtlasKeys,
  AudioKeys,
  BitmapFontKeys,
  ImageKeys,
  LandingFrames,
} from '../core/assets';
import { api } from '../core/api';
import { applyMuteState, startMusicOnce } from '../core/audio';
import { applyPlayCamera, computeLayout } from '../core/layout';
import { flipOriginY, flipY } from '../objects/lambMath';

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Legacy `cc.fadeIn` durations/delays, in ms -- see landing_scene.coffee. */
const BG_FADE_MS = 1600;
const TITLE_DELAY_MS = 1600;
const TITLE_FADE_MS = 1000;
const SCORE_BTN_DELAY_MS = 3000;
const PVP_BTN_DELAY_MS = 3400;
const COPYRIGHT_DELAY_MS = 3800;
const CREDIT_DELAY_MS = 4100;
const TAIL_FADE_MS = 1000;

const BUTTON_PRESS_SCALE = 0.94;
const BUTTON_PRESS_MS = 60;

/**
 * Port of landing_scene.coffee: the game's title screen. Fades in the
 * background/title/menu over ~4.1s (skippable with any tap), then offers
 * Score and PvP entry points plus a personal-best/top-score readout fetched
 * from `/api/init`.
 */
export class MainMenu extends Scene {
  private introTweens: Phaser.Tweens.Tween[] = [];
  private introSkipped = false;

  /** Reddit t2_ id once `/api/init` resolves, or null while logged out/unknown. PvP requires a real id to match on. */
  private userId: string | null = null;

  private readonly onScaleResize = (): void => this.applyLayout();
  private readonly onPointerDown = (): void => {
    startMusicOnce(this, AudioKeys.Music);
    this.skipIntro();
  };

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.introTweens = [];
    this.introSkipped = false;
    this.userId = null;

    this.applyLayout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize);
    this.input.on('pointerdown', this.onPointerDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    applyMuteState(this);

    this.renderLambFace();
    this.renderTitle();
    this.renderMenus();
    this.renderCopyright();
    this.renderCredit();
    this.renderStats();
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize);
    this.input.off('pointerdown', this.onPointerDown);
  }

  private applyLayout(): void {
    applyPlayCamera(this, computeLayout(this.scale.width, this.scale.height));
  }

  /** A tap anywhere during the intro jumps every pending fade/scale tween straight to its end state. */
  private skipIntro(): void {
    if (this.introSkipped) return;
    this.introSkipped = true;
    for (const tween of this.introTweens) {
      tween.complete();
    }
  }

  // ------------------------------------------------------------ render --

  /** _render_lamb_face: full-bleed background, fading in over 1.6s, no delay. */
  private renderLambFace(): void {
    const bg = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, ImageKeys.LandingBg);
    bg.setAlpha(0);
    this.introTweens.push(
      this.tweens.add({ targets: bg, alpha: 1, duration: BG_FADE_MS, ease: 'Linear' })
    );
  }

  /**
   * _render_title: cocos (width/2, 200), anchor (0.5, 0) -> Phaser origin
   * (0.5, 1) at (WORLD_WIDTH/2, flipY(200)). Delayed fade-in + scale
   * 1.2 -> 1.0.
   */
  private renderTitle(): void {
    const title = this.add.sprite(
      WORLD_WIDTH / 2,
      flipY(200),
      AtlasKeys.Landing,
      LandingFrames.Title
    );
    title.setOrigin(0.5, flipOriginY(0));
    title.setAlpha(0);
    title.setScale(1.2);

    this.introTweens.push(
      this.tweens.add({
        targets: title,
        alpha: 1,
        scale: 1,
        delay: TITLE_DELAY_MS,
        duration: TITLE_FADE_MS,
        ease: 'Linear',
      })
    );
  }

  /**
   * _render_menus: both buttons sit at cocos y=70 (default anchor (0, 0) ->
   * Phaser origin (0, 1)). Score starts ScoreStage; PvP starts PvpLanding,
   * gated on login (`showLoginPrompt()` otherwise -- PvP needs a real
   * userId to match on, unlike solo play).
   */
  private renderMenus(): void {
    const y = flipY(70);
    const origin: [number, number] = [0, flipOriginY(0)];

    const scoreButton = this.add.sprite(
      WORLD_WIDTH / 2 - 410,
      y,
      AtlasKeys.Landing,
      LandingFrames.BtnScore
    );
    scoreButton.setOrigin(...origin);
    scoreButton.setAlpha(0);

    const pvpButton = this.add.sprite(
      WORLD_WIDTH / 2 + 14,
      y,
      AtlasKeys.Landing,
      LandingFrames.BtnPvp
    );
    pvpButton.setOrigin(...origin);
    pvpButton.setAlpha(0);

    this.introTweens.push(
      this.tweens.add({
        targets: scoreButton,
        alpha: 1,
        delay: SCORE_BTN_DELAY_MS,
        duration: TAIL_FADE_MS,
        ease: 'Linear',
      })
    );
    this.introTweens.push(
      this.tweens.add({
        targets: pvpButton,
        alpha: 1,
        delay: PVP_BTN_DELAY_MS,
        duration: TAIL_FADE_MS,
        ease: 'Linear',
      })
    );

    this.bindButton(scoreButton, () => this.handleScoreButton());
    this.bindButton(pvpButton, () => this.handlePvpButton());
  }

  /** _render_copyright: cocos (width/2-150, 20), default anchor (0, 0). */
  private renderCopyright(): void {
    const copyright = this.add.sprite(
      WORLD_WIDTH / 2 - 150,
      flipY(20),
      AtlasKeys.Landing,
      LandingFrames.Copyright
    );
    copyright.setOrigin(0, flipOriginY(0));
    copyright.setAlpha(0);

    this.introTweens.push(
      this.tweens.add({
        targets: copyright,
        alpha: 1,
        delay: COPYRIGHT_DELAY_MS,
        duration: TAIL_FADE_MS,
        ease: 'Linear',
      })
    );
  }

  /** _render_common_cc: cocos (width-136, 10), default anchor (0, 0). */
  private renderCredit(): void {
    const credit = this.add.sprite(
      WORLD_WIDTH - 136,
      flipY(10),
      AtlasKeys.Landing,
      LandingFrames.Credit
    );
    credit.setOrigin(0, flipOriginY(0));
    credit.setAlpha(0);

    this.introTweens.push(
      this.tweens.add({
        targets: credit,
        alpha: 1,
        delay: CREDIT_DELAY_MS,
        duration: TAIL_FADE_MS,
        ease: 'Linear',
      })
    );
  }

  /**
   * Not in the legacy scene: a small personal-best / top-score readout,
   * fetched from `/api/init`. Lives in the otherwise-empty strip above the
   * title (cocos y > 200) so it doesn't compete with the intro sequence.
   * `/api/init` can reject (network, or a 400 when there's no postId in
   * some contexts) -- the menu, and solo play, must work fine either way.
   */
  private renderStats(): void {
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '13px',
      color: '#f5f7fa',
      fontStyle: '600',
    };

    // The landing art is a big near-white lamb face filling the middle of the
    // band, so pale text over it is invisible and a centred panel covers the
    // lamb's eyes. The band's top corners are the only genuinely empty space:
    // one small dark pill in each, clear of the face either side.
    const PILL_WIDTH = 190;
    const PILL_HEIGHT = 58;
    const bestX = 24 + PILL_WIDTH / 2;
    const topX = WORLD_WIDTH - 24 - PILL_WIDTH / 2;

    const pill = this.add.graphics().fillStyle(0x0b1707, 0.6);
    for (const cx of [bestX, topX]) {
      pill.fillRoundedRect(cx - PILL_WIDTH / 2, 12, PILL_WIDTH, PILL_HEIGHT, 12);
    }

    this.add.text(bestX, 20, 'YOUR BEST', labelStyle).setOrigin(0.5, 0);
    this.add.text(topX, 20, 'TOP SCORE', labelStyle).setOrigin(0.5, 0);

    const bestValue = this.add
      .bitmapText(bestX, 36, BitmapFontKeys.Numbers, '0', 26)
      .setOrigin(0.5, 0);
    const topValue = this.add
      .bitmapText(topX, 36, BitmapFontKeys.Numbers, '0', 26)
      .setOrigin(0.5, 0);

    void api
      .init()
      .then((res) => {
        this.userId = res.userId;
        bestValue.setText(String(Math.max(0, Math.floor(res.personalBest))));
        topValue.setText(String(Math.max(0, Math.floor(res.top[0]?.score ?? 0))));
      })
      .catch(() => {
        // No identity/network -- leave the readouts at their default '0'
        // and this.userId at null (PvP just stays login-gated).
      });
  }

  // -------------------------------------------------------------- input --

  private bindButton(sprite: Phaser.GameObjects.Sprite, onClick: () => void): void {
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      this.tweens.add({
        targets: sprite,
        scale: sprite.scale * BUTTON_PRESS_SCALE,
        duration: BUTTON_PRESS_MS,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
      onClick();
    });
  }

  private handleScoreButton(): void {
    this.scene.start('ScoreStage', { hadTutorial: false });
  }

  private handlePvpButton(): void {
    if (this.userId === null) {
      showLoginPrompt();
      return;
    }

    this.scene.start('PvpLanding');
  }
}
