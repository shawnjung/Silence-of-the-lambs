import type { Scene } from 'phaser';
import { AtlasKeys, LambFrames } from '../core/assets';

const TAP_CIRCLE_START_SCALE = 0.4;
const TAP_CIRCLE_PHASE_MS = 100;

/**
 * Port of `event_listener.coffee`'s generic "any tap, anywhere on the play
 * band" feedback -- an expanding/fading circle at the tap point. Shared by
 * `ScoreStage` and `PvpStage`; unrelated to a lamb's own `pointerdown`
 * (`objects/Lamb.ts` wires that separately).
 */
export function renderTapCircle(scene: Scene, x: number, y: number, depth: number): void {
  const circle = scene.add.sprite(x, y, AtlasKeys.Lamb, LambFrames.TapCircle);
  circle.setOrigin(0.5, 0.5);
  circle.setAlpha(0);
  circle.setScale(TAP_CIRCLE_START_SCALE);
  circle.setDepth(depth);

  scene.tweens.chain({
    targets: circle,
    tweens: [
      { scale: 0.8, alpha: 1, duration: TAP_CIRCLE_PHASE_MS, ease: 'Linear' },
      { scale: 1.2, alpha: 0, duration: TAP_CIRCLE_PHASE_MS, ease: 'Linear' },
    ],
    onComplete: () => circle.destroy(),
  });
}

/**
 * True when `pointer` lands inside the scene's main camera viewport -- i.e.
 * on the letterboxed play band itself, not the Hud's own strips outside it
 * (see `ScoreStage`'s original comment on why this guard exists at all:
 * legacy had one full-screen canvas, this build has a separate Hud overlay).
 */
export function isWithinPlayViewport(scene: Scene, pointer: { x: number; y: number }): boolean {
  const cam = scene.cameras.main;
  return (
    pointer.x >= cam.x &&
    pointer.x <= cam.x + cam.width &&
    pointer.y >= cam.y &&
    pointer.y <= cam.y + cam.height
  );
}
