/**
 * Pure, engine-free port of score_lamb_controller.coffee#earn_score -- the
 * one piece of real game-design content in this codebase, so it's isolated
 * here (no Phaser/scene dependency at all) to make it table-testable and to
 * protect it from silent drift. See scoring.test.ts.
 *
 * Deliberately import-free (mirrors objects/lambMath.ts): this keeps the
 * module -- and anything dynamically importing it under Node's native TS
 * loader -- free of any relative-module resolution quirk.
 *
 * Legacy (CoffeeScript):
 *   spent_time = parseInt((now - startedAt)/1000*100)/100
 *   rest_time  = patience - spent_time
 *   total      = patience * 1.6
 *   score      = if rest_time < patience/10 then total*2 else total - rest_time*1.6
 *   if rest_time < spent_time
 *     award parseInt(score); show popup with that value
 *   else
 *     award nothing; still show a 0 popup
 *
 * `parseInt` on a float truncates toward zero (same as Math.trunc for the
 * non-negative values this game ever produces) -- every truncation below
 * uses Math.trunc to match that exactly, not Math.floor/Math.round.
 */

/** legacy `patience_levels: _.range(7,20)` -- integers 7..19 inclusive. */
export const PATIENCE_MIN = 7;
export const PATIENCE_MAX = 19;

export type ScoreOutcome = {
  /** Truncated score to award via 'score-earned', or null when the tap was too early (rest_time >= spent_time) to score at all. */
  awarded: number | null;
  /** What the popup should display -- equal to `awarded` when scoring, otherwise 0. */
  popupValue: number;
};

/**
 * `parseInt((end_time - start_time)/1000*100)/100` -- truncates the elapsed
 * seconds to a hundredth, toward zero. Split out from `earnScore` so this
 * truncation step (the one place `parseInt`'s exact semantics matter most)
 * gets its own direct unit tests.
 */
export function computeSpentTime(elapsedMs: number): number {
  return Math.trunc((elapsedMs / 1000) * 100) / 100;
}

/**
 * Port of ScoreLambController#earn_score, minus the side effects (the
 * `@stage.trigger`, the popup render, and the `@reset` call all stay in the
 * caller -- this function only computes the outcome).
 */
export function earnScore(
  patience: number,
  startedAtMs: number,
  nowMs: number
): ScoreOutcome {
  const spentTime = computeSpentTime(nowMs - startedAtMs);
  const restTime = patience - spentTime;
  const totalScore = patience * 1.6;

  const score =
    restTime < patience / 10 ? totalScore * 2 : totalScore - restTime * 1.6;

  if (restTime < spentTime) {
    const awarded = Math.trunc(score);
    return { awarded, popupValue: awarded };
  }

  return { awarded: null, popupValue: 0 };
}
