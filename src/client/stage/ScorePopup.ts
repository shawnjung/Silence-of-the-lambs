import type { GameObjects, Scene } from 'phaser';
import { BitmapFontKeys } from '../core/assets';

const RISE_DISTANCE = 80;
const PHASE_DURATION_MS = 300;

const BASE_SCALE = 0.2;
const HIGH_SCALE = 0.3;
const HIGH_SCORE_THRESHOLD = 15;
const MAX_SCALE = 0.5;
const MAX_SCORE_THRESHOLD = 30;

function scaleForScore(score: number): number {
  if (score > MAX_SCORE_THRESHOLD) return MAX_SCALE;
  if (score > HIGH_SCORE_THRESHOLD) return HIGH_SCALE;
  return BASE_SCALE;
}

/**
 * Port of LambController#_render_score_overlay + NumbersNode#fade_in_then_out.
 * Legacy built the number out of individual digit sprites (numbers_node.coffee)
 * purely because Cocos2d-JS had no bitmap-font primitive; Phaser does, so
 * this is a direct BitmapText using the `numbers` font instead of that
 * digit-sprite bookkeeping -- same visual result.
 *
 * `x`/`y` are the world-space point directly above the lamb (its top edge);
 * the popup rises 80px while fading in, then another 80px while fading out,
 * then destroys itself, exactly mirroring numbers_node.coffee's two
 * `moveBy(0, 80)` legs (cocos +y-up "up" == Phaser -y, already folded into
 * the tween targets below).
 *
 * Returns the created BitmapText so callers running a second, unzoomed UI
 * camera over the same scene (see `stage/cameraZoom.ts`'s header) can
 * exclude it from that camera -- a score popup is world content, not
 * overlay.
 */
export function showScorePopup(
  scene: Scene,
  x: number,
  y: number,
  score: number,
  depth: number
): GameObjects.BitmapText {
  const text = scene.add.bitmapText(x, y, BitmapFontKeys.Numbers, String(score));
  text.setOrigin(0.5, 1);
  text.setScale(scaleForScore(score));
  text.setDepth(depth);
  text.setAlpha(0);

  scene.tweens.chain({
    targets: text,
    tweens: [
      { alpha: 1, y: y - RISE_DISTANCE, duration: PHASE_DURATION_MS, ease: 'Linear' },
      { alpha: 0, y: y - RISE_DISTANCE * 2, duration: PHASE_DURATION_MS, ease: 'Linear' },
    ],
    onComplete: () => text.destroy(),
  });

  return text;
}
