/**
 * Pure, engine-free port of base_scene.coffee's lamb-spawning math
 * (`_render_lambs` / `render_lamb` / `_attributes_for_random_lamb`).
 * Isolated here, import-free (mirrors objects/lambMath.ts), so the exact
 * legacy ranges can be property-tested without booting Phaser.
 *
 * Deliberately declares its own local `LambDirection` rather than importing
 * one from objects/lambMath.ts or objects/Lamb.ts: both are identically-
 * shaped string-literal unions, so TypeScript accepts either at any call
 * site, and this module stays free of any relative-module dependency (same
 * reasoning as lambMath.ts's own header comment).
 */

export type LambDirection = 'left' | 'right';

/** base_scene.coffee: `lambs_count: 5`. */
export const LAMBS_COUNT = 5;

/** base_scene.coffee: `patience_levels: _.range(7,20)` -- integers 7..19 inclusive. */
export const PATIENCE_MIN = 7;
export const PATIENCE_MAX = 19;

/** base_scene.coffee: `y_lines: [0, 100, 200, 280, 360, 440]` (cocos-space). */
export const Y_LINES = [0, 100, 200, 280, 360, 440] as const;

/**
 * `_attributes_for_random_lamb`'s `_(_.range(0, 5)).sample()` picks a line
 * from 0..4 -- deliberately not 0..5, even though `y_lines` has six entries.
 * Preserved exactly as a legacy quirk, not "fixed" to use all six lines.
 */
export const SPAWNABLE_LINE_COUNT = 5;

export type LambSpawnAttributes = {
  /** 0..1 fraction of stage width -- `x: Math.random()` in legacy. */
  x: number;
  /** 0..4 -- which of the (six-entry) y_lines table to spawn on. */
  line: number;
  /** integer, PATIENCE_MIN..PATIENCE_MAX inclusive. */
  patience: number;
  direction: LambDirection;
  /** `(300-200) + Math.random()*200` -- 100..300, exclusive at the top. */
  speedPerSec: number;
  /** 0..1 seconds -- `Math.random()` in legacy, used as a spawn delay. */
  delay: number;
};

/** Per-line spawn counts, mutated in place by computeLambSpawnPosition -- mirrors base_scene.coffee's `@lines`. */
export type LambLineCounts = number[];

export function freshLineCounts(): LambLineCounts {
  return Y_LINES.map(() => 0);
}

/** `_(@patience_levels).sample()` -- a uniformly random integer in [PATIENCE_MIN, PATIENCE_MAX]. */
export function samplePatience(rng: () => number = Math.random): number {
  const levelCount = PATIENCE_MAX - PATIENCE_MIN + 1;
  return PATIENCE_MIN + Math.floor(rng() * levelCount);
}

/** `_(_.range(0, 5)).sample()` -- a uniformly random integer in [0, 4]. */
export function sampleLine(rng: () => number = Math.random): number {
  return Math.floor(rng() * SPAWNABLE_LINE_COUNT);
}

/** `_(['left', 'right']).sample()`. */
export function sampleDirection(rng: () => number = Math.random): LambDirection {
  return rng() < 0.5 ? 'left' : 'right';
}

/** Port of `_attributes_for_random_lamb`. */
export function attributesForRandomLamb(
  rng: () => number = Math.random
): LambSpawnAttributes {
  return {
    x: rng(),
    line: sampleLine(rng),
    patience: samplePatience(rng),
    direction: sampleDirection(rng),
    speedPerSec: 100 + rng() * 200,
    delay: rng(),
  };
}

export type LambSpawnPosition = {
  x: number;
  /** cocos-space (y-up) y -- callers pass this straight through to Lamb, which does its own world-y flip. */
  y: number;
  scale: number;
};

/**
 * Port of the position/scale half of `render_lamb`:
 *   @lines[options.line].push 1
 *   x = parseInt(@size.width * options.x)
 *   y = @y_lines[options.line]+20 + @lines[options.line].length*15
 *   scale: 0.5-(y/@size.height*0.45)
 *
 * Mutates `lineCounts` in place (pushes 1 onto the line's count) before
 * reading its new length, exactly mirroring the push-then-read order above --
 * the y for the Nth lamb spawned on a line is offset by N*15, not (N-1)*15.
 */
export function computeLambSpawnPosition(
  line: number,
  lineCounts: LambLineCounts,
  stageWidth: number,
  xFraction: number,
  stageHeight = 640
): LambSpawnPosition {
  lineCounts[line] = (lineCounts[line] ?? 0) + 1;
  const count = lineCounts[line];

  const x = Math.trunc(stageWidth * xFraction);
  const y = Y_LINES[line]! + 20 + count * 15;
  const scale = 0.5 - (y / stageHeight) * 0.45;

  return { x, y, scale };
}
