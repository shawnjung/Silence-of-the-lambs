import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/api';
import {
  AtlasKeys,
  AudioKeys,
  EndingMessageFrames,
  ImageKeys,
  LambFrames,
} from '../core/assets';
import { applyMuteState, isMuted, playEffect, startMusicOnce, toggleMuted } from '../core/audio';
import { api } from '../core/api';
import { applyBaseCameraToScene } from '../core/layout';
import { Lamb, type LambStage } from '../objects/Lamb';
import { GAUGE_WIDTH, flipY, localBodyPosition } from '../objects/lambMath';
import { zoomOnLoss } from '../stage/cameraZoom';
import { Finger } from '../stage/Finger';
import {
  LAMBS_COUNT,
  attributesForRandomLamb,
  computeLambSpawnPosition,
  freshLineCounts,
  samplePatience,
  type LambLineCounts,
  type LambSpawnAttributes,
} from '../stage/lambSpawn';
import { showScorePopup } from '../stage/ScorePopup';
import { earnScore } from '../stage/scoring';
import { isWithinPlayViewport, renderTapCircle } from '../stage/tapFeedback';
import { Hud } from './Hud';

export type ScoreStageInitData = { hadTutorial?: boolean };

// -- Tutorial (base_scene.coffee#_start_tutorial) ---------------------------
const TUTORIAL_GUIDE_PATIENCE = 5;
const TUTORIAL_GUIDE_SCALE = 0.8;
const TUTORIAL_DIVE_DELAY_MS = 1000;
const TUTORIAL_FINGER_DELAY_MS = 5000;
const TUTORIAL_FINGER_X_OFFSET = 140;
/** LambController's own class-level default -- the guide lamb never patrols, so this only satisfies the constructor's required field. */
const DEFAULT_SPEED_PER_SEC = 180;

// -- Overlay depths (score_mode_labels_node.coffee's @addChild z-order + event_listener.coffee's tap circle) --
const OVERLAY_DEPTH = 700;
const SCORE_POPUP_DEPTH = 650;
const TAP_CIRCLE_DEPTH = 1000;

// -- Restart/lost overlay fade-in (score_mode_labels_node.coffee#activate_restart_button) --
const OVERLAY_FADE_DELAY_MS = 500;
const OVERLAY_FADE_DURATION_MS = 400;

/**
 * Port of score_stage_scene.coffee + base_scene.coffee: the solo score mode.
 * Runs the tutorial once (unless `hadTutorial` is set, e.g. on restart),
 * then the real game loop -- spawn lambs, score taps, spawn more every 5th
 * score, and end the round the moment any lamb's patience gauge fills.
 *
 * Deliberately does not read device/canvas size anywhere except inside
 * applyBaseCamera() (via computeLayout(this.scale.width, this.scale.height))
 * -- everything else works in fixed 1136x640 world coordinates.
 */
export class ScoreStage extends Scene {
  private readonly lambStage: LambStage = { size: { width: WORLD_WIDTH } };

  private hadTutorial = false;
  private hud!: Hud;

  private lambs: Lamb[] = [];
  private lineCounts: LambLineCounts = freshLineCounts();
  private currentScore = 0;
  private scoreEarnedCount = 0;
  private gameOver = false;
  private baseZoom = 1;

  private restartButton!: Phaser.GameObjects.Sprite;
  private lostBanner!: Phaser.GameObjects.Sprite;

  private readonly onScaleResize = (): void => this.applyBaseCamera();

  constructor() {
    super('ScoreStage');
  }

  init(data: ScoreStageInitData): void {
    this.hadTutorial = data?.hadTutorial ?? false;
    this.lambs = [];
    this.lineCounts = freshLineCounts();
    this.currentScore = 0;
    this.scoreEarnedCount = 0;
    this.gameOver = false;
  }

  create(): void {
    // Always reassert the letterboxed base camera on every entry (including
    // a restart re-entering this same Scene instance) -- this is what
    // guarantees zoomLamb()'s temporary pan/zoom from a previous round never
    // leaks into the next one, without needing any special teardown of its
    // own (see zoomLamb()'s comment for the rest of that story).
    applyMuteState(this);
    this.applyBaseCamera();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.input.on('pointerdown', this.handlePointerDown, this);

    this.renderBackground();
    this.renderOverlays();

    this.scene.launch('Hud');
    this.hud = this.scene.get('Hud') as Hud;
    this.hud.setScore(0);
    this.hud.setDanger(0);
    this.hud.setMuted(isMuted());
    this.hud.onBack(() => this.handleBack());
    this.hud.onMuteToggle(() => this.handleMuteToggle());

    this.startTutorial(() => this.startScoreMode());
  }

  override update(): void {
    this.updateDangerMeter();
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize);
    this.input.off('pointerdown', this.handlePointerDown, this);
    // 'score-earned' is registered fresh by startScoreMode() on every entry
    // (this Scene instance is reused across restarts) -- drop whatever's
    // there so listeners never stack across rounds.
    this.events.off('score-earned');
  }

  // ------------------------------------------------------------- camera --

  private applyBaseCamera(): void {
    this.baseZoom = applyBaseCameraToScene(this);
  }

  /**
   * base_scene.coffee#zoom_lamb repositions and rescales an anchor-pointed
   * `elements` node around the tapped lamb -- pure Cocos anchor-point
   * trickery with no Phaser equivalent (Phaser containers have no anchor
   * concept at all; see objects/lambMath.ts's header). The actual pan+zoom
   * mechanism now lives in stage/cameraZoom.ts (shared with PvpStage's own
   * end-of-match zoom); see its header for the rest of the derivation.
   *
   * Only the camera's zoom and scroll move there -- never its viewport --
   * so applyPlayCamera()'s ownership of the viewport is untouched. The
   * zoom/scroll it *did* set get overwritten by this tween, but every
   * fresh entry into this scene calls applyBaseCamera() again before
   * anything else runs, which resets both back to the letterboxed base --
   * that's the "restore on restart" half of the contract.
   */
  private zoomLamb(lamb: Lamb, onComplete: () => void): void {
    zoomOnLoss(this, this.baseZoom, lamb, onComplete);
  }

  // -------------------------------------------------------------- input --

  /**
   * Port of event_listener.coffee: every touch, regardless of what (if
   * anything) it hit, plays the tap sound and draws an expanding tap
   * circle (stage/tapFeedback.ts, shared with PvpStage) -- and kicks off
   * the music on the very first gesture of the session. Phaser dispatches
   * this scene-level 'pointerdown' for any tap on the canvas regardless of
   * camera viewport, so the play-band check below (a genuinely new concern
   * -- legacy had one full-screen canvas, this build has a separate
   * letterboxed Hud overlay outside the band on non-16:9 screens) keeps
   * taps on the Hud's own strips from also triggering the play scene's tap
   * sound/circle. The music-start check runs before that guard, since it
   * should fire on ANY first tap.
   */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    startMusicOnce(this, AudioKeys.Music);

    if (!isWithinPlayViewport(this, pointer)) return;

    playEffect(this, AudioKeys.Tap);
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    renderTapCircle(this, world.x, world.y, TAP_CIRCLE_DEPTH);
  }

  // ---------------------------------------------------------------- ui --

  private renderBackground(): void {
    // grass.png is authored at exactly WORLD_WIDTH x WORLD_HEIGHT (1136x640)
    // -- no scaling needed, only centering (background_node.coffee).
    const grass = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, ImageKeys.Grass);
    grass.setDepth(-1000);
  }

  /** Restart button + "lost" banner (score_mode_labels_node.coffee, minus the score label and back button -- both now Hud's job). */
  private renderOverlays(): void {
    this.restartButton = this.add.sprite(
      WORLD_WIDTH / 2,
      flipY(60),
      AtlasKeys.Lamb,
      LambFrames.BtnRestart
    );
    this.restartButton.setOrigin(0.5, 1);
    this.restartButton.setDepth(OVERLAY_DEPTH);
    this.restartButton.setAlpha(0);
    this.restartButton.setVisible(false);
    this.restartButton.on('pointerdown', () => this.handleRestart());

    this.lostBanner = this.add.sprite(0, flipY(240), AtlasKeys.EndingMessages, EndingMessageFrames.Lost);
    this.lostBanner.setOrigin(0, 1);
    this.lostBanner.setDepth(OVERLAY_DEPTH);
    this.lostBanner.setAlpha(0);
    this.lostBanner.setVisible(false);
  }

  private activateRestartButton(): void {
    this.lostBanner.setAlpha(0);
    this.lostBanner.setVisible(true);
    this.restartButton.setAlpha(0);
    this.restartButton.setVisible(true);

    this.tweens.add({
      targets: this.lostBanner,
      alpha: 1,
      delay: OVERLAY_FADE_DELAY_MS,
      duration: OVERLAY_FADE_DURATION_MS,
    });

    this.tweens.add({
      targets: this.restartButton,
      alpha: 1,
      delay: OVERLAY_FADE_DELAY_MS,
      duration: OVERLAY_FADE_DURATION_MS,
      onComplete: () => this.restartButton.setInteractive(),
    });
  }

  private handleRestart(): void {
    this.scene.start('ScoreStage', { hadTutorial: true } satisfies ScoreStageInitData);
  }

  private handleBack(): void {
    this.scene.stop('Hud');
    this.scene.start('MainMenu');
  }

  private handleMuteToggle(): void {
    const muted = toggleMuted(this);
    this.hud.setMuted(muted);
  }

  private updateDangerMeter(): void {
    if (this.gameOver) {
      this.hud.setDanger(1);
      return;
    }

    const now = Date.now();
    let maxFraction = 0;
    for (const lamb of this.lambs) {
      if (!lamb.active || lamb.startedAt === null) continue;
      const fraction = (now - lamb.startedAt) / 1000 / lamb.patience;
      if (fraction > maxFraction) maxFraction = fraction;
    }
    this.hud.setDanger(maxFraction);
  }

  // ------------------------------------------------------------ scoring --

  private wireLambScoring(lamb: Lamb): void {
    lamb.on('tapped', () => this.handleLambTapped(lamb));
  }

  /** Port of ScoreLambController#earn_score's side effects; the pure math itself lives in stage/scoring.ts. */
  private handleLambTapped(lamb: Lamb): void {
    if (!lamb.active || lamb.startedAt === null) return;

    const outcome = earnScore(lamb.patience, lamb.startedAt, Date.now());
    showScorePopup(this, lamb.x, lamb.y - lamb.height, outcome.popupValue, SCORE_POPUP_DEPTH);
    lamb.reset(samplePatience());

    if (outcome.awarded !== null) {
      this.events.emit('score-earned', outcome.awarded);
    }
  }

  private handleScoreEarned(score: number): void {
    this.scoreEarnedCount++;
    this.currentScore += score;
    this.hud.setScore(this.currentScore);

    if (this.scoreEarnedCount % 5 === 0) {
      this.spawnLamb(attributesForRandomLamb());
    }
  }

  // -------------------------------------------------------------- lambs --

  private spawnLamb(attrs: LambSpawnAttributes): Lamb {
    const pos = computeLambSpawnPosition(attrs.line, this.lineCounts, WORLD_WIDTH, attrs.x, WORLD_HEIGHT);

    const lamb = new Lamb(this, {
      scale: pos.scale,
      x: pos.x,
      y: pos.y,
      patience: attrs.patience,
      direction: attrs.direction,
      speedPerSec: attrs.speedPerSec,
      skin: 'mine',
      stage: this.lambStage,
      bleatSoundKey: AudioKeys.Effects,
    });

    this.wireLambScoring(lamb);
    lamb.on('time-over', () => this.handleTimeOver(lamb));
    this.lambs.push(lamb);

    // base_scene.coffee#render_lamb defers adding the lamb to the stage (and
    // diving it in) by `options.delay` seconds -- lambs trickle onto the
    // stage rather than all popping in at once.
    this.time.delayedCall(attrs.delay * 1000, () => {
      this.add.existing(lamb);
      lamb.dive(() => lamb.start());
    });

    return lamb;
  }

  private renderLambs(): void {
    for (let i = 0; i < LAMBS_COUNT; i++) {
      this.spawnLamb(attributesForRandomLamb());
    }
  }

  private stopAllLambs(): void {
    for (const lamb of this.lambs) lamb.stop();
  }

  // ----------------------------------------------------------- game loop --

  /** Port of score_stage_scene.coffee#_start_score_mode. */
  private startScoreMode(): void {
    this.currentScore = 0;
    this.scoreEarnedCount = 0;
    this.hud.setScore(0);

    this.renderLambs();
    this.events.on('score-earned', this.handleScoreEarned, this);
  }

  private handleTimeOver(lamb: Lamb): void {
    if (this.gameOver) return;
    this.gameOver = true;

    lamb.speak();
    this.stopAllLambs();
    this.zoomLamb(lamb, () => {
      this.activateRestartButton();
      lamb.gauge.show();
    });

    // A logged-out viewer gets a 401 from the server -- that must never
    // break the game, so the rejection is swallowed unconditionally.
    void api.submitScore(this.currentScore).catch(() => {});
  }

  // ------------------------------------------------------------ tutorial --

  /** Port of score_stage_scene.coffee#_start_tutorial. */
  private startTutorial(callback: () => void): void {
    if (this.hadTutorial) {
      callback();
      return;
    }

    const guideLamb = new Lamb(this, {
      scale: TUTORIAL_GUIDE_SCALE,
      x: WORLD_WIDTH / 2,
      y: 120,
      patience: TUTORIAL_GUIDE_PATIENCE,
      direction: 'right',
      speedPerSec: DEFAULT_SPEED_PER_SEC,
      skin: 'mine',
      stage: this.lambStage,
      bleatSoundKey: AudioKeys.Effects,
    });

    // Arrow sprite parented to the guide lamb's gauge, positioned via the
    // same anchor-(0.5,0) local-position math Gauge.ts itself already uses
    // for its track/fill (cocos-local (120, 47) within the 200-wide gauge box).
    const arrowPos = localBodyPosition(120, 47, GAUGE_WIDTH);
    const arrow = this.add.sprite(arrowPos.x, arrowPos.y, AtlasKeys.Lamb, LambFrames.Arrow);
    arrow.setScale(1.5);
    guideLamb.gauge.add(arrow);

    this.wireLambScoring(guideLamb);

    const finger = new Finger(this);

    this.time.delayedCall(TUTORIAL_DIVE_DELAY_MS, () => {
      this.add.existing(guideLamb);
      guideLamb.dive(() => {
        guideLamb.startedAt = Date.now();
        guideLamb.gauge.show();
        guideLamb.gauge.start(guideLamb.patience);
      });
    });

    this.time.delayedCall(TUTORIAL_FINGER_DELAY_MS, () => {
      finger.setPosition(WORLD_WIDTH / 2 + TUTORIAL_FINGER_X_OFFSET, flipY(220));
      this.add.existing(finger);
      finger.start();
    });

    this.events.once('score-earned', () => {
      finger.stop();
      guideLamb.die(() => callback());
    });
  }
}
