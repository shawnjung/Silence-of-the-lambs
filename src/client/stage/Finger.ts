import { GameObjects } from 'phaser';
import type { Scene, Time } from 'phaser';
import { AtlasKeys, LambFrames } from '../core/assets';

const CONTENT_WIDTH = 142;
const CONTENT_HEIGHT = 170;
const SLIDE_IN_DURATION_MS = 500;
const CIRCLE_INTERVAL_MS = 500;
const CIRCLE_GROW_DURATION_MS = 500;
const STOP_SHRINK_DURATION_MS = 300;

/**
 * Converts a child's cocos-local position (lx, ly) -- (0,0) = box
 * bottom-left, y-up -- into the Phaser-local offset from THIS node's own
 * pin, for a box anchored at cocos (0.5, 1) (top-center): the general form
 * of objects/lambMath.ts's `localBodyPosition` (which is specialized for
 * ay=0 parents) with ax=0.5, ay=1 plugged in: `dx = lx - ax*W`,
 * `dy = ay*H - ly`. Kept private/local here since FingerNode is the only
 * anchor-(0.5,1) node in this port -- not worth generalizing into
 * lambMath.ts for a single caller.
 */
function localOffset(cocosX: number, cocosY: number): { x: number; y: number } {
  return { x: cocosX - CONTENT_WIDTH / 2, y: CONTENT_HEIGHT - cocosY };
}

/**
 * Port of finger_node.coffee: the tutorial's pointing-hand hint. Slides up
 * and fades in on start(), then loops an expanding tap-circle every 0.5s
 * behind it until stop()ped, which shrinks the whole thing away and
 * destroys it.
 */
export class Finger extends GameObjects.Container {
  private readonly finger: GameObjects.Sprite;
  private circleTimer: Time.TimerEvent | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);

    const start = localOffset(0, -60);
    this.finger = new GameObjects.Sprite(scene, start.x, start.y, AtlasKeys.Lamb, LambFrames.Finger);
    this.finger.setOrigin(0, 1);
    this.finger.setAlpha(0);
    this.add(this.finger);
  }

  start(): void {
    this.setAngle(-10);

    const target = localOffset(0, 0);
    this.scene.tweens.add({
      targets: this.finger,
      x: target.x,
      y: target.y,
      alpha: 1,
      duration: SLIDE_IN_DURATION_MS,
      ease: 'Linear',
      onComplete: () => this.runCircleAnimation(),
    });
  }

  stop(): void {
    this.circleTimer?.remove();
    this.circleTimer = null;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.finger);

    this.scene.tweens.add({
      targets: this,
      scale: 0,
      duration: STOP_SHRINK_DURATION_MS,
      ease: 'Linear',
      onComplete: () => this.destroy(),
    });
  }

  private runCircleAnimation(): void {
    this.renderCircle();
    this.circleTimer = this.scene.time.addEvent({
      delay: CIRCLE_INTERVAL_MS,
      loop: true,
      callback: () => this.renderCircle(),
    });
  }

  private renderCircle(): void {
    const pos = localOffset(56, 160);
    const circle = new GameObjects.Sprite(this.scene, pos.x, pos.y, AtlasKeys.Lamb, LambFrames.TapCircle);
    circle.setOrigin(0.5, 0.5);
    circle.setAlpha(0);
    circle.setScale(0.3);
    // Behind the finger sprite, mirroring `@addChild circle, 0` vs. the
    // finger's own `@addChild @finger, 1`.
    this.addAt(circle, 0);

    this.scene.tweens.chain({
      targets: circle,
      tweens: [
        { scale: 0.9, alpha: 1, duration: CIRCLE_GROW_DURATION_MS, ease: 'Linear' },
        { scale: 1.5, alpha: 0, duration: CIRCLE_GROW_DURATION_MS, ease: 'Linear' },
      ],
      onComplete: () => circle.destroy(),
    });
  }

  override destroy(fromScene?: boolean): void {
    this.circleTimer?.remove();
    this.circleTimer = null;
    super.destroy(fromScene);
  }
}
