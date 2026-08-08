import * as Phaser from 'phaser';
import type { Scene } from 'phaser';
import { LAMB_BODY_WIDTH } from '../objects/lambMath';

const ZOOM_DURATION_MS = 400;
const ZOOM_EASE = 'Cubic.easeIn';

/** The sliver of a `Lamb` this module actually needs -- kept minimal, same spirit as `objects/Lamb.ts`'s own `LambStage`. */
export type ZoomableLamb = { x: number; y: number; width: number; height: number };

/**
 * Port of `base_scene.coffee#zoom_lamb`: pans and zooms the *camera* in on
 * the lamb that just ended the round -- shared by `ScoreStage` (a lost round)
 * and `PvpStage` (a `pvp-over`, when it names a lamb). See `ScoreStage`'s own
 * former copy of this method for the full derivation of why a camera
 * pan+zoom is the idiomatic Phaser stand-in for cocos's anchor-point
 * re-centering trick, and why only the camera's zoom/scroll move here, never
 * its viewport.
 *
 * `baseZoom` is the letterboxed play-band zoom (`Layout#zoom`, or 1 if the
 * band is degenerate) that the caller's own `applyBaseCameraToScene` last
 * computed -- passed in rather than read off the scene, since neither scene
 * exposes that as a public property.
 */
export function zoomOnLoss(scene: Scene, baseZoom: number, lamb: ZoomableLamb, onComplete: () => void): void {
  const cam = scene.cameras.main;

  // lamb.width already encodes the lamb's own render scale (see
  // Lamb.ts#_setScale: width = trunc(LAMB_BODY_WIDTH * scale)), so this
  // recovers an approximation of that scale without Lamb needing to expose
  // it directly.
  const approxScale = Phaser.Math.Clamp(lamb.width / LAMB_BODY_WIDTH, 0.05, 1);
  const zoomFactor = Phaser.Math.Clamp(1.6 + 4 * (1 - approxScale * 2), 1, 5.2);
  const targetZoom = baseZoom * zoomFactor;
  const targetY = lamb.y - lamb.height / 2;

  let pending = 2;
  const done = (): void => {
    pending -= 1;
    if (pending <= 0) onComplete();
  };

  cam.pan(lamb.x, targetY, ZOOM_DURATION_MS, ZOOM_EASE, false, (_cam, progress) => {
    if (progress >= 1) done();
  });
  cam.zoomTo(targetZoom, ZOOM_DURATION_MS, ZOOM_EASE, false, (_cam, progress) => {
    if (progress >= 1) done();
  });
}
