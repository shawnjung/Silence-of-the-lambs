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
import { computeMenuButtonPlacement } from './mainMenuLayout';
import { guard } from '../core/safety';

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

/** Gap kept between the title's baseline and the top of the menu button block. */
const TITLE_CLEARANCE = 18;

const BUTTON_PRESS_SCALE = 0.94;
const BUTTON_PRESS_MS = 60;

/** `renderStats`'s personal-best/top-score pill readouts -- sized independently of worldWidth, only their x position adapts. */
const STAT_PILL_WIDTH = 190;
const STAT_PILL_HEIGHT = 58;

/**
 * Port of landing_scene.coffee: the game's title screen. Fades in the
 * background/title/menu over ~4.1s (skippable with any tap), then offers
 * Score and PvP entry points plus a personal-best/top-score readout fetched
 * from `/api/init`.
 *
 * Every piece of content below is centered/anchored against `this.worldWidth`
 * -- the resolved world width from `core/layout.ts` -- rather than the fixed
 * `WORLD_WIDTH` constant, since that width now adapts to the canvas (as low
 * as 640 on a portrait phone). `applyLayout` re-resolves it on every Phaser
 * `resize` event and `relayoutContent` repositions everything in place, so
 * rotating the device (or the webview simply changing size) never leaves
 * stale geometry -- see `repositionMenus`'s use of `mainMenuLayout.ts` for
 * the one piece of that (the Score/PvP button pair) that also needs to
 * reflow, not just re-center.
 */
export class MainMenu extends Scene {
  private introTweens: Phaser.Tweens.Tween[] = [];
  private introSkipped = false;
  private created = false;

  /** Reddit t2_ id once `/api/init` resolves, or null while logged out/unknown. PvP requires a real id to match on. */
  private userId: string | null = null;

  /** Resolved by `applyLayout` from `core/layout.ts`'s `computeLayout` -- see this class's own header comment. */
  private worldWidth = WORLD_WIDTH;

  private lambFaceBg: Phaser.GameObjects.Image | undefined;
  private titleSprite: Phaser.GameObjects.Sprite | undefined;
  private scoreButton: Phaser.GameObjects.Sprite | undefined;
  private pvpButton: Phaser.GameObjects.Sprite | undefined;
  private copyrightSprite: Phaser.GameObjects.Sprite | undefined;
  private creditSprite: Phaser.GameObjects.Sprite | undefined;
  private statsPillGraphics: Phaser.GameObjects.Graphics | undefined;
  private bestLabelText: Phaser.GameObjects.Text | undefined;
  private topLabelText: Phaser.GameObjects.Text | undefined;
  private bestValueText: Phaser.GameObjects.BitmapText | undefined;
  private topValueText: Phaser.GameObjects.BitmapText | undefined;

  private readonly onScaleResize = (): void => this.applyLayout();
  private readonly onPointerDown = guard('MainMenu pointerdown', (): void => {
    startMusicOnce(this, AudioKeys.Music);
    this.skipIntro();
  });

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.introTweens = [];
    this.introSkipped = false;
    this.userId = null;
    this.worldWidth = WORLD_WIDTH;
    this.created = false;

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

    this.created = true;
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize);
    this.input.off('pointerdown', this.onPointerDown);
    this.created = false;
  }

  private applyLayout(): void {
    const layout = computeLayout(this.scale.width, this.scale.height);
    this.worldWidth = layout.worldWidth;
    applyPlayCamera(this, layout);

    if (this.created) this.relayoutContent();
  }

  /** Re-centers/reflows every piece of content already rendered against the freshly-resolved `this.worldWidth` -- called on every resize once `create()` has finished its first pass. */
  private relayoutContent(): void {
    this.repositionLambFace();
    this.repositionTitle();
    this.repositionMenus();
    this.repositionCopyright();
    this.repositionCredit();
    this.repositionStats();
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
    const bg = this.add.image(0, WORLD_HEIGHT / 2, ImageKeys.LandingBg);
    bg.setAlpha(0);
    this.lambFaceBg = bg;
    this.repositionLambFace();

    this.introTweens.push(
      this.tweens.add({ targets: bg, alpha: 1, duration: BG_FADE_MS, ease: 'Linear' })
    );
  }

  /**
   * landing_bg.png is authored at exactly WORLD_WIDTH x WORLD_HEIGHT (1136x640,
   * the world's native max) -- no scaling needed, only centering on the
   * resolved worldWidth (a horizontal crop, same technique ScoreStage/
   * PvpStage use for their own grass background).
   */
  private repositionLambFace(): void {
    this.lambFaceBg?.setX(this.worldWidth / 2);
  }

  /**
   * _render_title: cocos (width/2, 200), anchor (0.5, 0) -> Phaser origin
   * (0.5, 1) at (worldWidth/2, flipY(200)). Delayed fade-in + scale
   * 1.2 -> 1.0.
   */
  private renderTitle(): void {
    const title = this.add.sprite(0, flipY(200), AtlasKeys.Landing, LandingFrames.Title);
    title.setOrigin(0.5, flipOriginY(0));
    title.setAlpha(0);
    title.setScale(1.2);
    this.titleSprite = title;
    this.repositionTitle();

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
   * Legacy pinned the title at cocos y=200. That still holds on a wide world,
   * but a narrow one stacks the menu buttons, and the upper button then
   * occupies exactly that space -- the two overlapped on a portrait phone. So
   * the title clears the button block when it has to, and stays put when it
   * doesn't (`min` keeps the wide-screen layout byte-identical to legacy).
   */
  private repositionTitle(): void {
    if (!this.titleSprite) return;

    const placement = computeMenuButtonPlacement(this.worldWidth, flipY(70));
    const y = Math.min(flipY(200), placement.blockTopY - TITLE_CLEARANCE);

    this.titleSprite.setPosition(this.worldWidth / 2, y);
  }

  /**
   * _render_menus: both buttons sit at cocos y=70 (default anchor (0, 0) ->
   * Phaser origin (0, 1)). Score starts ScoreStage; PvP starts PvpLanding,
   * gated on login (`showLoginPrompt()` otherwise -- PvP needs a real
   * userId to match on, unlike solo play). Their actual x/y comes from
   * `repositionMenus` (mainMenuLayout.ts), since worldWidth may be too
   * narrow to fit them side-by-side.
   */
  private renderMenus(): void {
    const origin: [number, number] = [0, flipOriginY(0)];

    const scoreButton = this.add.sprite(0, 0, AtlasKeys.Landing, LandingFrames.BtnScore);
    scoreButton.setOrigin(...origin);
    scoreButton.setAlpha(0);
    this.scoreButton = scoreButton;

    const pvpButton = this.add.sprite(0, 0, AtlasKeys.Landing, LandingFrames.BtnPvp);
    pvpButton.setOrigin(...origin);
    pvpButton.setAlpha(0);
    this.pvpButton = pvpButton;

    this.repositionMenus();

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

    this.bindButton(scoreButton, guard('MainMenu score button', () => this.handleScoreButton()));
    this.bindButton(pvpButton, guard('MainMenu pvp button', () => this.handlePvpButton()));
  }

  /**
   * Places Score/PvP side-by-side when worldWidth has room, or stacks them
   * vertically otherwise -- see mainMenuLayout.ts's own header for why a
   * portrait phone's 640-wide world can no longer fit the legacy fixed
   * side-by-side layout.
   */
  private repositionMenus(): void {
    if (!this.scoreButton || !this.pvpButton) return;

    const baselineY = flipY(70);
    const placement = computeMenuButtonPlacement(this.worldWidth, baselineY);
    this.scoreButton.setPosition(placement.score.x, placement.score.y);
    this.pvpButton.setPosition(placement.pvp.x, placement.pvp.y);
  }

  /** _render_copyright: cocos (width/2-150, 20), default anchor (0, 0). */
  private renderCopyright(): void {
    const copyright = this.add.sprite(0, flipY(20), AtlasKeys.Landing, LandingFrames.Copyright);
    copyright.setOrigin(0, flipOriginY(0));
    copyright.setAlpha(0);
    this.copyrightSprite = copyright;
    this.repositionCopyright();

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

  private repositionCopyright(): void {
    this.copyrightSprite?.setX(this.worldWidth / 2 - 150);
  }

  /** _render_common_cc: cocos (width-136, 10), default anchor (0, 0). */
  private renderCredit(): void {
    const credit = this.add.sprite(0, flipY(10), AtlasKeys.Landing, LandingFrames.Credit);
    credit.setOrigin(0, flipOriginY(0));
    credit.setAlpha(0);
    this.creditSprite = credit;
    this.repositionCredit();

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

  private repositionCredit(): void {
    this.creditSprite?.setX(this.worldWidth - 136);
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
    this.statsPillGraphics = this.add.graphics();
    this.bestLabelText = this.add.text(0, 20, 'YOUR BEST', labelStyle).setOrigin(0.5, 0);
    this.topLabelText = this.add.text(0, 20, 'TOP SCORE', labelStyle).setOrigin(0.5, 0);
    this.bestValueText = this.add
      .bitmapText(0, 36, BitmapFontKeys.Numbers, '0', 26)
      .setOrigin(0.5, 0);
    this.topValueText = this.add
      .bitmapText(0, 36, BitmapFontKeys.Numbers, '0', 26)
      .setOrigin(0.5, 0);

    this.repositionStats();

    void api
      .init()
      .then((res) => {
        this.userId = res.userId;
        this.bestValueText?.setText(String(Math.max(0, Math.floor(res.personalBest))));
        this.topValueText?.setText(String(Math.max(0, Math.floor(res.top[0]?.score ?? 0))));
      })
      .catch(() => {
        // No identity/network -- leave the readouts at their default '0'
        // and this.userId at null (PvP just stays login-gated).
      });
  }

  private repositionStats(): void {
    const bestX = 24 + STAT_PILL_WIDTH / 2;
    const topX = this.worldWidth - 24 - STAT_PILL_WIDTH / 2;

    this.statsPillGraphics?.clear();
    this.statsPillGraphics?.fillStyle(0x0b1707, 0.6);
    for (const cx of [bestX, topX]) {
      this.statsPillGraphics?.fillRoundedRect(
        cx - STAT_PILL_WIDTH / 2,
        12,
        STAT_PILL_WIDTH,
        STAT_PILL_HEIGHT,
        12
      );
    }

    this.bestLabelText?.setX(bestX);
    this.topLabelText?.setX(topX);
    this.bestValueText?.setX(bestX);
    this.topValueText?.setX(topX);
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
