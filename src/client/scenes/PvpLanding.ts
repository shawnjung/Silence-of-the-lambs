import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { getPostId } from '../core/devvitContext';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/api';
import type { PvpMatch } from '../../shared/pvp';
import { AtlasKeys, AudioKeys, ImageKeys, PvpLandingFrames } from '../core/assets';
import { applyMuteState, startMusicOnce } from '../core/audio';
import { applyBaseCameraToScene } from '../core/layout';
import { PvpApiError, pvpApi } from '../core/pvpApi';
import { subscribePvpLobby, type Unsubscribe } from '../core/realtime';
import { flipOriginY, flipY } from '../objects/lambMath';
import type { PvpStageInitData } from './PvpStage';
import { guard, reportError } from '../core/safety';

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Replaces legacy's `pvp_landing_scene.coffee` room-code screen. There is no
 * code to type or share any more -- the Reddit post itself is the lobby --
 * so this scene's only job is to call `queue()` and react to whichever of
 * the two shapes `PvpQueueResponse` comes back as, or to the lobby
 * broadcast that arrives later for whichever player ends up parked waiting.
 */
export class PvpLanding extends Scene {
  /** Guards `attemptQueue()` against re-entrancy while a queue() request is in flight. */
  private queueInFlight = false;
  private matchId: string | null = null;
  private unsubscribeLobby: Unsubscribe | null = null;
  private cleanedUp = false;
  private created = false;

  /** Resolved by `applyLayout` from `core/layout.ts`'s `computeLayout` -- see PvpStage's own header comment on why this is no longer the fixed WORLD_WIDTH constant. */
  private worldWidth = WORLD_WIDTH;

  private backgroundImage: Phaser.GameObjects.Image | undefined;
  private titleSprite!: Phaser.GameObjects.Sprite;
  private statusText!: Phaser.GameObjects.Text;
  private retryButton!: Phaser.GameObjects.Sprite;

  private readonly onScaleResize = (): void => this.applyLayout();

  constructor() {
    super('PvpLanding');
  }

  create(): void {
    this.queueInFlight = false;
    this.matchId = null;
    this.unsubscribeLobby = null;
    this.cleanedUp = false;
    this.worldWidth = WORLD_WIDTH;
    this.created = false;

    applyMuteState(this);
    this.applyLayout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.input.once(
      'pointerdown',
      guard('PvpLanding pointerdown', () => startMusicOnce(this, AudioKeys.Music))
    );

    this.renderBackground();
    this.renderTitle();
    this.renderStatus();
    this.renderRetryButton();
    this.renderBackButton();

    this.created = true;

    // Subscribed for the *entire* time this scene is up, not just once a
    // 'waiting' response comes back -- queue()'s own request and the lobby
    // subscription race each other over the network, and subscribing only
    // after learning we're the one waiting would leave a real (if narrow)
    // window to miss the other player's broadcast. Subscribing unconditionally
    // up front closes that window; it's also exactly why the acting player's
    // own echo needs filtering at all (see core/realtime.ts) -- without it,
    // whoever's queue() call itself completes the pairing would process
    // their own 'matched' broadcast a second time, on top of the one they
    // already got directly from their POST response below.
    const postId = getPostId();
    if (!postId) {
      // No host context means there is no lobby to join. Say so instead of
      // throwing out of create() and taking the whole game down with it.
      this.setStatus('PvP is unavailable here.', false);
      return;
    }
    // A throw here would escape create() and kill the game loop -- guard()
    // only covers callbacks Phaser invokes later. Devvit's realtime connect
    // validates the channel name synchronously and rejects anything outside
    // [A-Za-z0-9_], which is exactly how PvP froze the whole game.
    try {
      this.unsubscribeLobby = subscribePvpLobby(postId, (msg) => this.enterMatch(msg.match));
    } catch (error) {
      reportError('PvpLanding realtime subscribe', error);
      this.setStatus('Could not reach the PvP lobby.', true);
      return;
    }

    this.attemptQueue();
  }

  private applyLayout(): void {
    const { worldWidth } = applyBaseCameraToScene(this);
    this.worldWidth = worldWidth;

    if (this.created) this.relayoutContent();
  }

  /** Re-centers everything already rendered against the freshly-resolved `this.worldWidth` -- called on every resize once `create()` has finished its first pass. */
  private relayoutContent(): void {
    this.backgroundImage?.setX(this.worldWidth / 2);
    this.titleSprite.setX(this.worldWidth / 2);
    this.statusText.setX(this.worldWidth / 2);
    this.statusText.setWordWrapWidth(this.worldWidth - 200);
    this.retryButton.setX(this.worldWidth / 2);
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize);
    this.created = false;
    this.cleanUp();
  }

  /**
   * Runs once, however the scene ends up leaving: an explicit back-button
   * tap, or the scene being torn down (navigated away from, backgrounded and
   * recycled, etc.) while still queued/waiting. Unsubscribes the lobby
   * channel unconditionally, then tells the server we are gone. `leave()`
   * without a matchId vacates the queue slot; with one it forfeits a match
   * found in that same narrow window. Leaving the queue matters: otherwise
   * the entry lingers for its full TTL and the next joiner is paired with
   * someone who already walked away, then waits out the heartbeat before
   * being told they won a match that never started.
   */
  private cleanUp(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;

    this.unsubscribeLobby?.();
    this.unsubscribeLobby = null;

    void pvpApi.leave(this.matchId ?? undefined).catch(() => {});
  }

  // ---------------------------------------------------------------- ui --

  private renderBackground(): void {
    this.backgroundImage = this.add.image(
      this.worldWidth / 2,
      WORLD_HEIGHT / 2,
      ImageKeys.PvpLandingBg
    );
  }

  private renderTitle(): void {
    const title = this.add.sprite(
      this.worldWidth / 2,
      flipY(490),
      AtlasKeys.PvpLanding,
      PvpLandingFrames.Title
    );
    title.setOrigin(0.5, flipOriginY(0));
    this.titleSprite = title;
  }

  private renderStatus(): void {
    this.statusText = this.add
      .text(this.worldWidth / 2, flipY(280), '', {
        fontFamily: FONT_STACK,
        fontSize: '22px',
        color: '#f5f7fa',
        fontStyle: '600',
        align: 'center',
        wordWrap: { width: this.worldWidth - 200 },
      })
      .setOrigin(0.5, 0.5);
  }

  private renderRetryButton(): void {
    this.retryButton = this.add.sprite(
      this.worldWidth / 2,
      flipY(80),
      AtlasKeys.PvpLanding,
      PvpLandingFrames.BtnStart
    );
    this.retryButton.setOrigin(0.5, flipOriginY(0));
    this.retryButton.setVisible(false);
    this.retryButton.setInteractive({ useHandCursor: true });
    this.retryButton.on('pointerdown', guard('PvpLanding retry', () => this.attemptQueue()));
  }

  private renderBackButton(): void {
    const backButton = this.add
      .text(24, 24, '← Back', {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        color: '#f5f7fa',
        fontStyle: '700',
        backgroundColor: '#0c1220',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0, 0);
    backButton.setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', guard('PvpLanding back', () => this.handleBack()));
  }

  private setStatus(message: string, showRetry: boolean): void {
    this.statusText.setText(message);
    this.retryButton.setVisible(showRetry);
  }

  // ------------------------------------------------------------- queue --

  private attemptQueue(): void {
    if (this.queueInFlight) return;
    this.queueInFlight = true;

    this.setStatus('Searching for an opponent…', false);

    pvpApi
      .queue()
      .then((res) => {
        this.queueInFlight = false;
        if (res.status === 'matched') {
          this.enterMatch(res.match);
        } else {
          this.setStatus('Waiting for an opponent…', false);
        }
      })
      .catch((error: unknown) => {
        this.queueInFlight = false;
        this.handleQueueError(error);
      });
  }

  private handleQueueError(error: unknown): void {
    const busy = error instanceof PvpApiError && error.httpStatus === 503;
    const message = busy
      ? 'Matchmaking is busy right now — tap to try again.'
      : 'Could not reach the match — tap to try again.';
    this.setStatus(message, true);
  }

  private enterMatch(match: PvpMatch): void {
    if (this.cleanedUp) return;
    this.matchId = match.matchId;
    this.unsubscribeLobby?.();
    this.unsubscribeLobby = null;
    this.scene.start('PvpStage', { match } satisfies PvpStageInitData);
  }

  private handleBack(): void {
    this.cleanUp();
    this.scene.start('MainMenu');
  }
}
