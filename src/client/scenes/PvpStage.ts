import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { context } from '@devvit/web/client';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/api';
import type {
  PvpLamb,
  PvpMatch,
  PvpMatchMessage,
  PvpOverPayload,
} from '../../shared/pvp';
import {
  AtlasKeys,
  AudioKeys,
  EndingMessageFrames,
  ImageKeys,
  LambFrames,
} from '../core/assets';
import { applyMuteState, isMuted, startMusicOnce, toggleMuted } from '../core/audio';
import { applyBaseCameraToScene } from '../core/layout';
import { pvpApi } from '../core/pvpApi';
import { subscribePvpMatch, type Unsubscribe } from '../core/realtime';
import { Lamb, type LambStage } from '../objects/Lamb';
import { flipY } from '../objects/lambMath';
import { zoomOnLoss } from '../stage/cameraZoom';
import {
  computeLambSpawnPosition,
  freshLineCounts,
  type LambLineCounts,
} from '../stage/lambSpawn';
import {
  gaugeStartSchedule,
  pvpOutcomeFor,
  worstGaugeFraction,
  type GaugeLike,
  type PvpOutcome,
} from '../stage/pvpMatch';
import { isWithinPlayViewport, renderTapCircle } from '../stage/tapFeedback';
import { Hud } from './Hud';

export type PvpStageInitData = { match: PvpMatch };

// -- Overlay depths (mirrors ScoreStage's own) ------------------------------
const OVERLAY_DEPTH = 700;
const TAP_CIRCLE_DEPTH = 1000;

const OVERLAY_FADE_DELAY_MS = 500;
const OVERLAY_FADE_DURATION_MS = 400;

/** POST /api/pvp/ping roughly this often -- comfortably inside the server's PVP_SEEN_TTL_SECONDS (6s) window. */
const HEARTBEAT_INTERVAL_MS = 2000;

type PvpLambEntry = {
  id: string;
  ownerId: string;
  lamb: Lamb;
  /** This lamb's current authoritative (or optimistically-guessed) deadline -- kept in sync with whatever last drove its gauge, so worstGaugeFraction() has something to read every frame. */
  deadline: number | null;
  /** Pending "reveal the gauge" timer for a deadline further away than its own patience (see gaugeStartSchedule) -- cleared/replaced on every new deadline. */
  pendingStart: Phaser.Time.TimerEvent | null;
};

/**
 * Port of `pvp_stage_scene.coffee`: the 1v1 match itself. Mirrors
 * `ScoreStage`'s structure closely (camera handling, resize/shutdown wiring,
 * tap feedback, the play-band gate, Hud integration) -- see that scene's own
 * comments for the parts that are identical rather than PvP-specific.
 *
 * The one thing genuinely new here: nothing about a lamb's patience gauge is
 * ever driven by a local timer. Every gauge is scheduled from the server's
 * `deadline` (see `stage/pvpMatch.ts`), touches are optimistic-then-
 * reconciled, and match-ending is entirely the server's call -- this scene
 * only ever *reports* (`touch`/`expire`), never decides.
 */
export class PvpStage extends Scene {
  private readonly lambStage: LambStage = { size: { width: WORLD_WIDTH } };

  private matchId!: string;
  private selfUserId!: string;
  private opponentId!: string;
  /** The match payload `init()` was handed -- read exactly once, by `create()`, to seed the initial lambs. */
  private initialLambs: PvpLamb[] = [];

  private lambs = new Map<string, PvpLambEntry>();
  private lineCounts: LambLineCounts = freshLineCounts();
  private matchOver = false;
  private baseZoom = 1;

  private hud!: Hud;
  private unsubscribeMatch: Unsubscribe | null = null;
  private heartbeatTimer: Phaser.Time.TimerEvent | null = null;
  private cleanedUp = false;

  private wonBanner!: Phaser.GameObjects.Sprite;
  private lostBanner!: Phaser.GameObjects.Sprite;
  private rematchButton!: Phaser.GameObjects.Sprite;

  private readonly onScaleResize = (): void => this.applyBaseCamera();

  constructor() {
    super('PvpStage');
  }

  init(data: PvpStageInitData): void {
    this.matchId = data.match.matchId;
    // MainMenu only ever lets a logged-in viewer reach PvP (see MainMenu's
    // own userId gate before it starts PvpLanding), and every PvP REST call
    // besides is itself userId-gated server-side -- context.userId is safe
    // to treat as non-null for the lifetime of this scene.
    this.selfUserId = context.userId as string;
    this.opponentId =
      data.match.players.find((id) => id !== this.selfUserId) ?? data.match.players[0];
    this.initialLambs = data.match.lambs;

    this.lambs = new Map();
    this.lineCounts = freshLineCounts();
    this.matchOver = false;
    this.unsubscribeMatch = null;
    this.heartbeatTimer = null;
    this.cleanedUp = false;
  }

  create(): void {
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
    this.hud.setOpponent({ username: this.opponentLabel(), danger: 0 });
    this.hud.setMuted(isMuted());
    this.hud.onBack(() => this.handleBack());
    this.hud.onMuteToggle(() => this.handleMuteToggle());

    for (const serverLamb of this.initialLambs) {
      this.spawnLamb(serverLamb);
    }

    this.unsubscribeMatch = subscribePvpMatch(this.matchId, (msg) => this.handleMatchMessage(msg));
    this.startHeartbeat();
  }

  override update(): void {
    if (this.matchOver) return;

    const now = Date.now();
    const mine: GaugeLike[] = [];
    const theirs: GaugeLike[] = [];
    for (const entry of this.lambs.values()) {
      const bucket = entry.ownerId === this.selfUserId ? mine : theirs;
      bucket.push({ deadline: entry.deadline, patience: entry.lamb.patience });
    }

    this.hud.setDanger(worstGaugeFraction(mine, now));
    this.hud.setOpponent({ username: this.opponentLabel(), danger: worstGaugeFraction(theirs, now) });
  }

  // ------------------------------------------------------------- cleanup --

  /**
   * Runs exactly once however this scene ends -- Hud's back button, a
   * rematch re-queue, or the scene simply being torn down (backgrounded and
   * recycled, navigated away from some other way). A leaked heartbeat or
   * realtime subscription after leaving a match is a real bug (Reddit users
   * background these webviews constantly), so every one of these is
   * unconditional here rather than split across the handlers that might
   * trigger a shutdown.
   */
  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize);
    this.input.off('pointerdown', this.handlePointerDown, this);

    if (this.cleanedUp) return;
    this.cleanedUp = true;

    this.stopHeartbeat();

    this.unsubscribeMatch?.();
    this.unsubscribeMatch = null;

    for (const entry of this.lambs.values()) {
      entry.pendingStart?.remove();
      entry.pendingStart = null;
    }
    this.lambs.clear();

    this.tweens.killAll();

    // Best-effort -- harmless (and a no-op server-side) if the match already
    // ended by the time this fires.
    void pvpApi.leave(this.matchId).catch(() => {});
  }

  // ------------------------------------------------------------- camera --

  private applyBaseCamera(): void {
    this.baseZoom = applyBaseCameraToScene(this);
  }

  // -------------------------------------------------------------- input --

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    startMusicOnce(this, AudioKeys.Music);

    if (!isWithinPlayViewport(this, pointer)) return;

    this.sound.play(AudioKeys.Tap);
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    renderTapCircle(this, world.x, world.y, TAP_CIRCLE_DEPTH);
  }

  // ---------------------------------------------------------------- ui --

  private renderBackground(): void {
    const grass = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, ImageKeys.Grass);
    grass.setDepth(-1000);
  }

  private renderOverlays(): void {
    this.wonBanner = this.add.sprite(0, flipY(240), AtlasKeys.EndingMessages, EndingMessageFrames.Won);
    this.wonBanner.setOrigin(0, 1);
    this.wonBanner.setDepth(OVERLAY_DEPTH);
    this.wonBanner.setAlpha(0);
    this.wonBanner.setVisible(false);

    this.lostBanner = this.add.sprite(0, flipY(240), AtlasKeys.EndingMessages, EndingMessageFrames.Lost);
    this.lostBanner.setOrigin(0, 1);
    this.lostBanner.setDepth(OVERLAY_DEPTH);
    this.lostBanner.setAlpha(0);
    this.lostBanner.setVisible(false);

    this.rematchButton = this.add.sprite(WORLD_WIDTH / 2, flipY(60), AtlasKeys.Lamb, LambFrames.BtnRestart);
    this.rematchButton.setOrigin(0.5, 1);
    this.rematchButton.setDepth(OVERLAY_DEPTH);
    this.rematchButton.setAlpha(0);
    this.rematchButton.setVisible(false);
    this.rematchButton.on('pointerdown', () => this.handleRematch());
  }

  private showEndingBanner(outcome: PvpOutcome): void {
    const banner = outcome === 'won' ? this.wonBanner : this.lostBanner;
    banner.setAlpha(0);
    banner.setVisible(true);
    this.rematchButton.setAlpha(0);
    this.rematchButton.setVisible(true);

    this.tweens.add({
      targets: banner,
      alpha: 1,
      delay: OVERLAY_FADE_DELAY_MS,
      duration: OVERLAY_FADE_DURATION_MS,
    });

    this.tweens.add({
      targets: this.rematchButton,
      alpha: 1,
      delay: OVERLAY_FADE_DELAY_MS,
      duration: OVERLAY_FADE_DURATION_MS,
      onComplete: () => this.rematchButton.setInteractive({ useHandCursor: true }),
    });
  }

  private handleRematch(): void {
    // PvpLanding has no use for Hud (it renders its own plain back/status
    // UI) -- stop it explicitly, the same as handleBack() below, so it
    // doesn't keep running underneath the next scene.
    this.scene.stop('Hud');
    this.scene.start('PvpLanding');
  }

  private handleBack(): void {
    this.scene.stop('Hud');
    this.scene.start('MainMenu');
  }

  private handleMuteToggle(): void {
    const muted = toggleMuted(this);
    this.hud.setMuted(muted);
  }

  private opponentLabel(): string {
    return `Opponent #${this.opponentId.slice(-4)}`;
  }

  // -------------------------------------------------------------- lambs --

  private spawnLamb(serverLamb: PvpLamb): void {
    const pos = computeLambSpawnPosition(
      serverLamb.line,
      this.lineCounts,
      WORLD_WIDTH,
      serverLamb.x,
      WORLD_HEIGHT
    );

    const isMine = serverLamb.ownerId === this.selfUserId;
    const lamb = new Lamb(this, {
      scale: pos.scale,
      x: pos.x,
      y: pos.y,
      patience: serverLamb.patience,
      direction: serverLamb.direction,
      speedPerSec: serverLamb.speedPerSec,
      skin: isMine ? 'mine' : 'enemy',
      stage: this.lambStage,
      bleatSoundKey: AudioKeys.Effects,
    });

    const entry: PvpLambEntry = {
      id: serverLamb.id,
      ownerId: serverLamb.ownerId,
      lamb,
      deadline: null,
      pendingStart: null,
    };
    this.lambs.set(serverLamb.id, entry);

    lamb.on('tapped', () => this.handleLambTapped(entry));
    lamb.on('time-over', () => this.handleLambTimeOver(entry));

    this.time.delayedCall(serverLamb.delay * 1000, () => {
      this.add.existing(lamb);
      lamb.dive(() => {
        lamb.moveAround(0, WORLD_WIDTH);
        this.applyDeadline(entry, serverLamb.deadline, serverLamb.patience);
      });
    });
  }

  /**
   * Schedules (or re-schedules) `entry`'s gauge purely from `deadline` --
   * see `stage/pvpMatch.ts#gaugeStartSchedule` for the derivation. `deadline
   * === null` (an escalation lamb never yet touched by its owner, see
   * `PvpLamb`'s own doc) just hides the gauge; the lamb still patrols.
   */
  private applyDeadline(entry: PvpLambEntry, deadline: number | null, patience: number): void {
    entry.pendingStart?.remove();
    entry.pendingStart = null;
    entry.deadline = deadline;
    entry.lamb.patience = patience;

    if (deadline === null) {
      entry.lamb.gauge.stop();
      entry.lamb.gauge.hide();
      entry.lamb.startedAt = null;
      return;
    }

    const schedule = gaugeStartSchedule(Date.now(), deadline, patience);
    const startGauge = (): void => {
      entry.lamb.startedAt = Date.now();
      entry.lamb.gauge.show();
      entry.lamb.gauge.start(schedule.durationSec);
    };

    if (schedule.delayMs <= 0) {
      startGauge();
    } else {
      entry.pendingStart = this.time.delayedCall(schedule.delayMs, startGauge);
    }
  }

  /**
   * The single most important feel detail in this scene: tapping your own
   * lamb must feel instant, but the authoritative new patience only exists
   * once the server picks it (`touch()`'s response is just `{status:'ok'}`,
   * it never carries the value). So this resets the gauge *optimistically*
   * with the lamb's current patience as a placeholder the moment the tap
   * lands, then lets the `reset-lamb` broadcast --- which reaches this same
   * client too, since realtime broadcasts to the whole channel including the
   * sender --- reconcile it via `applyDeadline` moments later. If the touch
   * request never lands at all (offline blip), nothing here further
   * corrects the optimistic guess; the worst case is a locally-fabricated
   * deadline that's a few seconds off until the player taps again.
   */
  private handleLambTapped(entry: PvpLambEntry): void {
    if (this.matchOver) return;

    if (entry.ownerId === this.selfUserId) {
      const guessPatience = entry.lamb.patience;
      entry.pendingStart?.remove();
      entry.pendingStart = null;
      entry.deadline = Date.now() + guessPatience * 1000;
      entry.lamb.startedAt = Date.now();
      entry.lamb.gauge.show();
      entry.lamb.gauge.start(guessPatience);
    }
    // Tapping the opponent's lamb gets no optimistic feedback at all -- it
    // is not "my lamb calming down", it's an instant loss the server alone
    // decides (legacy User.coffee#update_lamb's else-branch).

    void pvpApi
      .touch(this.matchId, entry.id)
      .then((res) => {
        if (res.status === 'over') this.handleMatchOver(res);
      })
      .catch(() => {});
  }

  /**
   * A lamb's local gauge filling never ends the match by itself -- it only
   * ever gets *reported*. The server re-validates against its own stored
   * deadline (with a small grace window) and is the sole authority on
   * whether this actually counts.
   */
  private handleLambTimeOver(entry: PvpLambEntry): void {
    if (this.matchOver) return;

    void pvpApi
      .expire(this.matchId, entry.id)
      .then((res) => {
        if (res.status === 'over') this.handleMatchOver(res);
        // 'rejected' -- our gauge fired a hair ahead of the server's own
        // stored deadline (clock skew/jitter); nothing to do, a later
        // reset-lamb/pvp-over/expire report resolves it.
      })
      .catch(() => {});
  }

  // ------------------------------------------------------------ realtime --

  private handleMatchMessage(msg: PvpMatchMessage): void {
    switch (msg.type) {
      case 'reset-lamb': {
        const entry = this.lambs.get(msg.lambId);
        if (entry) this.applyDeadline(entry, msg.deadline, msg.patience);
        return;
      }
      case 'add-lamb':
        if (!this.matchOver) this.spawnLamb(msg.lamb);
        return;
      case 'pvp-over':
        this.handleMatchOver(msg);
    }
  }

  // --------------------------------------------------------- match-over --

  /**
   * `pvp-over` is one broadcast shared by both players (legacy sent separate
   * `pvp-won`/`pvp-lost` socket events; realtime cannot). Idempotent: the
   * acting player's own `touch()`/`expire()` REST response can carry this
   * exact payload before the broadcast of the same event arrives, so this
   * only ever acts on the first occurrence.
   */
  private handleMatchOver(payload: PvpOverPayload): void {
    if (this.matchOver) return;
    this.matchOver = true;
    this.stopHeartbeat();
    this.stopAllLambs();

    const outcome = pvpOutcomeFor(payload, this.selfUserId);
    const lambEntry = payload.lambId ? this.lambs.get(payload.lambId) : undefined;

    if (lambEntry) {
      lambEntry.lamb.speak();
      zoomOnLoss(this, this.baseZoom, lambEntry.lamb, () => {
        lambEntry.lamb.gauge.show();
        this.showEndingBanner(outcome);
      });
    } else {
      this.showEndingBanner(outcome);
    }
  }

  private stopAllLambs(): void {
    for (const entry of this.lambs.values()) {
      entry.pendingStart?.remove();
      entry.pendingStart = null;
      entry.lamb.stop();
    }
  }

  // ----------------------------------------------------------- heartbeat --

  private startHeartbeat(): void {
    this.heartbeatTimer = this.time.addEvent({
      delay: HEARTBEAT_INTERVAL_MS,
      loop: true,
      callback: () => {
        if (this.matchOver) return;
        void pvpApi
          .ping(this.matchId)
          .then((res) => {
            if (res.status === 'over') this.handleMatchOver(res);
          })
          .catch((error: unknown) => {
            // A single dropped ping is not fatal -- the server only ends
            // the match once the *peer's* seen-key lapses, which is a much
            // longer window than one missed heartbeat of our own. Surface
            // nothing else to the player.
            void error;
          });
      },
    });
  }

  private stopHeartbeat(): void {
    this.heartbeatTimer?.remove();
    this.heartbeatTimer = null;
  }
}
