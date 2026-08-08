/**
 * Pure, engine-free PvP match math -- how a lamb's server-sent `deadline`
 * (see `src/shared/pvp.ts#PvpLamb`) turns into gauge fill state, and how a
 * `pvp-over` payload turns into a won/lost banner. Isolated here (no Phaser,
 * no relative-module dependency beyond nothing) so it's directly unit
 * testable, mirroring `objects/lambMath.ts` / `stage/scoring.ts`.
 */

export type GaugeSchedule = {
  /** ms to wait before the gauge should visually start counting down at all. */
  delayMs: number;
  /** the `Gauge#start` duration (seconds) to use once that wait is over. */
  durationSec: number;
};

/**
 * When (and for how long) to (re)start a lamb's visual gauge tween so it
 * reaches 100% full at exactly `deadline`.
 *
 * A lamb's patience clock does not necessarily start the instant a client
 * learns its `deadline` -- the very first deadline of a match already bakes
 * in `Lamb.coffee#start_counter`'s dive+per-lamb delay (see
 * `initialDeadline` in `server/core/pvpRules.ts`), so `deadline - now` can
 * exceed `patience` seconds. In that case the gauge should stay hidden/idle
 * until the remaining time has counted down to exactly `patience`, then run
 * for the full `patience` seconds. Once inside that window already (a touch
 * reconciliation, or a lamb whose clock has already been running a while),
 * the gauge should start immediately for whatever time is actually left.
 */
export function gaugeStartSchedule(now: number, deadline: number, patience: number): GaugeSchedule {
  const remainingMs = deadline - now;
  const patienceMs = patience * 1000;

  if (remainingMs > patienceMs) {
    return { delayMs: remainingMs - patienceMs, durationSec: patience };
  }
  return { delayMs: 0, durationSec: Math.max(0, remainingMs) / 1000 };
}

/**
 * Fraction (0..1) of a lamb's patience gauge that has filled right now,
 * derived purely from its `deadline` -- never from a locally-tracked
 * elapsed-time timer, so every client watching the same lamb agrees. A lamb
 * with no running clock at all (`deadline: null`, see `PvpLamb`'s doc) reads
 * as empty; one whose deadline has already passed reads as full.
 */
export function gaugeFractionFromDeadline(
  now: number,
  deadline: number | null,
  patience: number
): number {
  if (deadline === null) return 0;
  if (!(patience > 0)) return 1;

  const remainingMs = deadline - now;
  const fraction = 1 - remainingMs / (patience * 1000);
  return Math.min(1, Math.max(0, fraction));
}

export type GaugeLike = { deadline: number | null; patience: number };

/**
 * The worst (closest-to-expiring) gauge fraction among a set of lambs --
 * used to drive both the local danger meter and `Hud#setOpponent`'s reading
 * of the opponent's own worst lamb. 0 when there are no lambs, or none has a
 * running clock.
 */
export function worstGaugeFraction(lambs: readonly GaugeLike[], now: number): number {
  let worst = 0;
  for (const lamb of lambs) {
    const fraction = gaugeFractionFromDeadline(now, lamb.deadline, lamb.patience);
    if (fraction > worst) worst = fraction;
  }
  return worst;
}

export type PvpOutcome = 'won' | 'lost';

/**
 * `pvp-over` is one broadcast shared by both players (unlike legacy's
 * separate `pvp-won`/`pvp-lost` socket events) -- each client branches on
 * whether it was the winner.
 */
export function pvpOutcomeFor(payload: { winnerId: string }, selfUserId: string): PvpOutcome {
  return payload.winnerId === selfUserId ? 'won' : 'lost';
}
