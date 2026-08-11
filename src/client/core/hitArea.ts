import { Geom } from 'phaser';

/**
 * Builds a hit-area rectangle for a game object whose visual box, in its own
 * local space, spans [x0, x0+width] x [y0, y0+height].
 *
 * This exists because Phaser's hit test does NOT pass the local point to the
 * hit-area callback -- it passes `localX + displayOriginX, localY +
 * displayOriginY`. So a rectangle written in plain local coordinates is
 * silently offset by the display origin, and the object becomes partly or
 * wholly untappable with no error anywhere.
 *
 * That is exactly what happened to the lambs: a Container sized 432x316 has
 * displayOrigin (216, 158), so a tap on the lamb's body arrived at the
 * callback as y = +98 while the hand-written rect covered y in [-316, 0].
 * Every lamb in the game was unclickable, and the only symptom was a tutorial
 * that never advanced.
 *
 * Objects without an Origin component (Graphics, for one) report `undefined`
 * here, which would poison the arithmetic into NaN -- hence the `?? 0`.
 */
export function localHitRect(
  target: object,
  x0: number,
  y0: number,
  width: number,
  height: number
): Geom.Rectangle {
  const origin = target as { displayOriginX?: number; displayOriginY?: number };
  return new Geom.Rectangle(
    x0 + (origin.displayOriginX ?? 0),
    y0 + (origin.displayOriginY ?? 0),
    width,
    height
  );
}
