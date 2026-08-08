/**
 * Pure, engine-free math extracted from the lamb port. Kept separate from
 * Lamb.ts / Gauge.ts so the trickiest parts of the coordinate-system and
 * timing conversion (see the huge comment block below) can be unit tested
 * without booting a Phaser game.
 *
 * ---------------------------------------------------------------------------
 * Coordinate system primer (read this before touching any of the below)
 * ---------------------------------------------------------------------------
 * Cocos2d (the legacy engine) is y-up with anchor points: a node's
 * `setPosition(x, y)` places whichever fractional point of its own bounding
 * box `setAnchorPoint(ax, ay)` names at that (x, y) in the *parent's* local
 * space, and y grows upward. Phaser is y-down with origins and (crucially)
 * `Phaser.GameObjects.Container` has no origin/anchor concept at all -- a
 * container's (x, y) is simply the point children are offset from, as if its
 * anchor were always (0, 0).
 *
 * Every anchored node in the legacy lamb code -- LambController, LambNode,
 * GaugeNode -- uses `setAnchorPoint(0.5, 0)`: the anchor sits at the
 * horizontal center of the box, at its bottom edge (the feet / ground line).
 * Because ay is always 0 here, converting a child's cocos-local position
 * (lx, ly) -- given in a y-up box of width W with (0,0) at the box's
 * bottom-left corner, which is how cocos2d always expresses child positions
 * regardless of the parent's own anchor -- into the Phaser-local position
 * relative to that same pinned point collapses to:
 *
 *   x' = lx - ax*W        (ax = 0.5 here, so: lx - W/2)
 *   y' = -ly               (the H terms cancel algebraically when ay = 0;
 *                           see localBodyPosition for the full derivation)
 *
 * That is `localBodyPosition` below, and it is reused for every anchored
 * parent in this port (LambNode's children, GaugeNode's children, and the
 * shadow once `dive()` reparents it onto the Lamb container itself) --
 * because they all happen to share anchor (0.5, 0).
 *
 * Separately, *world* positions (the Lamb's own x/y in the 1136x640 stage,
 * and the depth/z-order rule) flip against the full world height:
 *
 *   phaserY = WORLD_HEIGHT - cocosY
 *
 * That's `flipY` / `cocosYToDepth` below -- a different formula from
 * `localBodyPosition` because it is not relative to an anchored parent, it's
 * an absolute flip of the whole 640px-tall stage.
 *
 * Anchor fractions themselves flip as `(ax, ay) -> (ax, 1 - ay)` when used as
 * a Phaser sprite origin -- see `flipOriginY`.
 */

// Deliberately no import of WORLD_HEIGHT from '../../shared/api' here: this
// module stays free of any relative-module dependency so it (and its test)
// never depend on how the host resolves cross-module specifiers -- it only
// needs the *value*, which is a stable design constant of this game's world.
// Callers that already import WORLD_HEIGHT (e.g. Lamb.ts) should still pass
// it through explicitly rather than relying on this default.
const DEFAULT_WORLD_HEIGHT = 640;

// -- Shared geometry constants --------------------------------------------
// lamb_node.coffee's declared content size (540x396) and gauge_node.coffee's
// (200x18). Centralized here so Lamb.ts/Gauge.ts and this module never
// disagree about them.

export const LAMB_BODY_WIDTH = 540;
export const LAMB_BODY_HEIGHT = 396;
export const GAUGE_WIDTH = 200;
export const GAUGE_HEIGHT = 18;
/** gauge_node.coffee's fixed `setScale 0.4` -- independent of the lamb's own scale. */
export const GAUGE_DRAW_SCALE = 0.4;

// -- World-space y / depth --------------------------------------------------

/**
 * Cocos is y-up measured from the bottom of the WORLD_HEIGHT-tall stage;
 * Phaser is y-down measured from the top. This is the one conversion that
 * flips against the *world* height, not a local content box.
 */
export function flipY(cocosY: number, worldHeight: number = DEFAULT_WORLD_HEIGHT): number {
  return worldHeight - cocosY;
}

/**
 * base_scene.coffee: `@elements.addChild lamb, 640+(y*-1)` i.e. smaller cocos
 * y (closer to the top of the stage) draws further back. `640 - cocosY` is
 * exactly `flipY`, so the depth rule and the world-y conversion are the same
 * function applied to the same input -- once a lamb's Phaser y is set via
 * `flipY`, its depth is just `setDepth(that same y)`. Kept as a separate
 * named export because "depth" and "y" are different *concerns* even though
 * they share a formula, and a future engine swap might decouple them.
 */
export function cocosYToDepth(cocosY: number, worldHeight: number = DEFAULT_WORLD_HEIGHT): number {
  return flipY(cocosY, worldHeight);
}

/** cocos anchor/anchor-point fraction -> Phaser origin fraction, on the y axis. */
export function flipOriginY(ay: number): number {
  return 1 - ay;
}

// -- Local child positions within an anchor-(0.5, 0) parent -----------------

/**
 * Converts a child's cocos-local position (lx, ly), given in the y-up box
 * cocos2d always uses for child placement ((0,0) = box bottom-left), into
 * the Phaser-local position relative to the parent's own pinned point --
 * valid for any parent anchored at (0.5, ay=0), which is every anchored node
 * in this codebase (LambController/Lamb, LambNode/bodyGroup, GaugeNode/Gauge).
 *
 * Derivation: a point at box-local (lx, ly) sits in world space at
 * `parent.position + (lx - ax*W, ly - ay*H)` in cocos (y-up). Flipping the
 * whole box vertically (ly_down = H - ly) and re-deriving the equivalent
 * Phaser-local offset from the same pinned point gives
 * `ly' = ly_down - (1-ay)*H`, which -- only because ay is 0 for every parent
 * here -- reduces to `ly' = -ly`, independent of H entirely. x is unaffected
 * by the vertical flip and only needs the ax*W recentering.
 */
export function localBodyPosition(
  cocosX: number,
  cocosY: number,
  boxWidth: number
): { x: number; y: number } {
  // `|| 0` normalizes -0 (from `-cocosY` when cocosY is 0) to 0 -- harmless
  // to Phaser's renderer either way, but avoids a confusing -0 turning up in
  // logs/tests for the (very common) "no vertical offset" case.
  return { x: cocosX - boxWidth / 2, y: -cocosY || 0 };
}

// -- Horizontal clamp (LambController#_set_position) -------------------------

export type ClampedX = {
  x: number;
  minimum: number;
  maximum: number;
};

/**
 * Mirrors `_set_position`'s two *sequential* (not else-if) clamps exactly,
 * including its degenerate behaviour when the lamb is wider than the stage
 * (minimum > maximum): the second `if` always fires last, so the result
 * always collapses to `minimum` in that case, regardless of the input x.
 */
export function clampLambX(x: number, stageWidth: number, lambWidth: number): ClampedX {
  const halfWidth = lambWidth / 2;
  const minimum = halfWidth;
  const maximum = stageWidth - halfWidth;

  let result = x;
  if (result > maximum) result = maximum;
  if (result < minimum) result = minimum;

  return { x: result, minimum, maximum };
}

// -- Scale -> effective speed (LambController#_set_scale) --------------------

/** `@speed_per_sec = @speed_per_sec*@options.scale` -- further-away (smaller) lambs move slower. */
export function effectiveSpeedPerSec(baseSpeedPerSec: number, scale: number): number {
  return baseSpeedPerSec * scale;
}

// -- Patrol timing (LambController#move_around) ------------------------------

export type LambDirection = 'left' | 'right';

/** Guards divide-by-zero/negative speed; legacy never hits that path since speed_per_sec is always positive. */
export function patrolDurationSec(distance: number, speedPerSec: number): number {
  if (!(speedPerSec > 0)) return 0;
  return distance / speedPerSec;
}

export type PatrolStep = {
  /** facing direction to turn to at the start of this move, mirroring the CallFunc turn actions */
  direction: LambDirection;
  fromX: number;
  toX: number;
  durationSec: number;
};

export type PatrolPlan = {
  /** one-off steps that run once, before the loop starts (init_animation) */
  intro: PatrolStep[];
  /** the steady-state loop body (around_animation), to be repeated forever */
  loop: PatrolStep[];
};

export type PatrolPlanInput = {
  currentX: number;
  from: number;
  to: number;
  minimum: number;
  maximum: number;
  speedPerSec: number;
  direction: LambDirection;
};

/**
 * Mirrors `move_around` exactly, including its one-off intro leg that
 * depends on the lamb's starting `direction`:
 *  - starting 'right': already facing the loop's second leg, so intro is a
 *    single move straight to `to`.
 *  - starting 'left': intro must first walk to `from` (still facing left,
 *    no turn needed), then turn right and walk to `to` -- reusing the same
 *    two tail steps the loop itself repeats.
 * Either way the loop always begins by turning left and walking to `from`.
 */
export function computePatrolPlan(input: PatrolPlanInput): PatrolPlan {
  const from = input.from < input.minimum ? input.minimum : input.from;
  const to = input.to > input.maximum ? input.maximum : input.to;
  const loopDuration = patrolDurationSec(to - from, input.speedPerSec);

  const loop: PatrolStep[] = [
    { direction: 'left', fromX: to, toX: from, durationSec: loopDuration },
    { direction: 'right', fromX: from, toX: to, durationSec: loopDuration },
  ];

  const intro: PatrolStep[] =
    input.direction === 'right'
      ? [
          {
            direction: 'right',
            fromX: input.currentX,
            toX: to,
            durationSec: patrolDurationSec(to - input.currentX, input.speedPerSec),
          },
        ]
      : [
          {
            direction: 'left',
            fromX: input.currentX,
            toX: from,
            durationSec: patrolDurationSec(input.currentX - from, input.speedPerSec),
          },
          {
            direction: 'right',
            fromX: from,
            toX: to,
            durationSec: loopDuration,
          },
        ];

  return { intro, loop };
}
