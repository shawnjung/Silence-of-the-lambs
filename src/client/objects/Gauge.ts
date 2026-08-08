import { GameObjects } from 'phaser';
import type { Scene, Tweens } from 'phaser';
import { LambFrames } from '../core/assets';
import { GAUGE_DRAW_SCALE, GAUGE_HEIGHT, GAUGE_WIDTH, localBodyPosition } from './lambMath';

/**
 * Port of gauge_node.coffee. A patience gauge: a track sprite behind a fill
 * sprite that grows left-to-right.
 *
 * gauge_node.coffee starts the fill at `setScaleX 0` and tweens `scaleX` up
 * to `1` over `patience` seconds, firing `time-over` the instant it reaches
 * full -- the gauge FILLS, it does not drain. The art (LambFrames.GaugeFill)
 * is drawn for that direction; do not flip it.
 */
export class Gauge extends GameObjects.Container {
  private readonly fill: GameObjects.Sprite;
  private tween: Tweens.Tween | null = null;

  /** `skin` is the loaded atlas key (AtlasKeys.Lamb or AtlasKeys.EnemyLamb) the gauge frames are drawn from. */
  constructor(scene: Scene, skin: string) {
    super(scene, 0, 0);

    // gauge_node.coffee: setAnchorPoint 0.5, 0; setContentSize 200, 18 --
    // both the track and fill sprites sit at local (0, 0) inside that box
    // (anchor 0, 0 each), which localBodyPosition converts to a position
    // centered horizontally on the Gauge's own pin.
    const { x, y } = localBodyPosition(0, 0, GAUGE_WIDTH);

    const track = new GameObjects.Sprite(scene, x, y, skin, LambFrames.GaugeTrack);
    track.setOrigin(0, 1);

    this.fill = new GameObjects.Sprite(scene, x, y, skin, LambFrames.GaugeFill);
    this.fill.setOrigin(0, 1); // left edge pinned -- scaleX grows rightward, not from center
    this.fill.scaleX = 0;

    // Track behind, fill in front (gauge_node.coffee: background z0, bar z1).
    this.add([track, this.fill]);

    // gauge_node.coffee's own `setScale 0.4` -- independent of the lamb's scale.
    this.setScale(GAUGE_DRAW_SCALE);
    this.setSize(GAUGE_WIDTH, GAUGE_HEIGHT);

    this.hide();
  }

  /** Starts (or restarts) the fill animation from empty, over `patienceSeconds`. */
  start(patienceSeconds: number): void {
    this.stopTween();
    this.fill.scaleX = 0;
    this.tween = this.scene.tweens.add({
      targets: this.fill,
      scaleX: 1,
      duration: Math.max(0, patienceSeconds * 1000),
      ease: 'Linear',
      onComplete: () => this.emit('time-over'),
    });
  }

  /** LambController#reset: same as start(), with a fresh patience value. */
  reset(patienceSeconds: number): void {
    this.start(patienceSeconds);
  }

  stop(): void {
    this.stopTween();
  }

  show(): void {
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }

  override destroy(fromScene?: boolean): void {
    this.stopTween();
    super.destroy(fromScene);
  }

  private stopTween(): void {
    if (this.tween) {
      this.tween.stop();
      this.tween = null;
    }
  }
}
