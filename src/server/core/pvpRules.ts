/**
 * Pure PvP rules — no Redis, no realtime, no `Date.now()` defaults. Every
 * function here takes all the state it needs as arguments, so it's testable
 * directly (see `pvp.test.ts`) without a Redis connection.
 *
 * Kept in its own leaf module, with no runtime imports of its own, so it can
 * be loaded directly by Node's native TS loader in tests (see the comment
 * at the top of `pvp.test.ts` for why that matters, and
 * `src/client/core/layout.ts` for the same pattern elsewhere in this repo).
 * `core/pvp.ts` — which does the actual Redis/realtime I/O and pulls in
 * `@devvit/web/server` — imports these rather than duplicating them.
 */

import type { PvpDirection } from '../../shared/pvp';

/** `Lamb.coffee`'s `dive_delay` — seconds between spawn and the patience clock starting, before any touch. */
export const DIVE_DELAY_SECONDS = 1.5;

/** `Room.coffee`'s `init_data` — 3 lambs per player at match start. */
export const LAMBS_PER_PLAYER = 3;

/**
 * How much slack we give an `/expire` report that arrives just ahead of our
 * own stored deadline. Chosen to comfortably absorb one request's worth of
 * client-server clock skew and network jitter (typical Reddit client RTTs
 * are well under this) without giving a lagging — or cheating — client a
 * meaningful head start on ending the match. `now >= deadline - GRACE_MS`
 * is checked against *our* stored deadline, never the caller's own timer.
 */
export const EXPIRE_GRACE_MS = 750;

/** `_(_.range(7,20)).sample()` — a uniformly-picked integer in [7, 19]. */
export function samplePatience(rand: () => number = Math.random): number {
  return 7 + Math.floor(rand() * 13);
}

/** `_(_.range(0,5)).sample()` — a uniformly-picked integer in [0, 4]. */
export function sampleLine(rand: () => number = Math.random): number {
  return Math.floor(rand() * 5);
}

/** `_(['left','right']).sample()`. */
export function sampleDirection(rand: () => number = Math.random): PvpDirection {
  return rand() < 0.5 ? 'left' : 'right';
}

export type LambAttributes = {
  x: number;
  speedPerSec: number;
  patience: number;
  line: number;
  direction: PvpDirection;
  delay: number;
};

/**
 * `Lamb.coffee#init_attributes`, distribution-for-distribution:
 * `x` and `delay` are `Math.random()`, `speed_per_sec` is
 * `100 + Math.random()*200`, `patience` and `line` are sampled from integer
 * ranges, `direction` is a coin flip. Do not "improve" these ranges.
 */
export function generateLambAttributes(rand: () => number = Math.random): LambAttributes {
  return {
    x: rand(),
    speedPerSec: 100 + rand() * 200,
    patience: samplePatience(rand),
    line: sampleLine(rand),
    direction: sampleDirection(rand),
    delay: rand(),
  };
}

/**
 * `Lamb.coffee#start_counter` (with `with_delay: true`, as `Room#start_pvp`
 * always calls it) followed by the `renew_counter` it schedules: the lamb's
 * first deadline is `dive_delay + delay + patience` seconds after spawn.
 */
export function initialDeadline(now: number, delay: number, patience: number): number {
  return now + (DIVE_DELAY_SECONDS + delay) * 1000 + patience * 1000;
}

/**
 * `User.coffee#update_lamb`'s escalation check:
 * ```coffee
 * rest_second = patience_was - (end_time - start_time) / 1000
 * @room.add_lamb by: this if rest_second < patience_was/8
 * ```
 * `start_time` is only defined once the patience clock has actually started
 * (naturally, after the dive delay, or from an earlier touch) — before that,
 * `rest_second` is `NaN` and the comparison is always false. Since
 * `deadlineBefore = start_time + patienceBefore*1000` whenever `start_time`
 * is defined, `rest_second` is exactly `(deadlineBefore - touchAt) / 1000`
 * seconds in both cases: pre-dive, `deadlineBefore` still evaluates to a
 * real number (`diveEnd + patience*1000`) and the resulting `rest_second`
 * always exceeds `patience`, so the `< patience/8` check is false anyway.
 * That means a `null` deadline (a lamb that has never had its clock
 * started — see `makeEscalationLamb` in `pvp.ts`) can be handled the same
 * way, with no special case.
 */
export function shouldEscalate(
  deadlineBefore: number | null,
  patienceBefore: number,
  touchAt: number
): boolean {
  if (deadlineBefore === null) return false;
  const restMs = deadlineBefore - touchAt;
  return restMs < (patienceBefore * 1000) / 8;
}

/**
 * `Lamb.coffee#expire`, minus the timer: valid iff `now` has reached the
 * stored deadline, allowing `EXPIRE_GRACE_MS` of slack. A lamb with no
 * running clock (`deadline: null`) can never validly expire.
 */
export function isExpireValid(
  now: number,
  deadline: number | null,
  graceMs: number = EXPIRE_GRACE_MS
): boolean {
  if (deadline === null) return false;
  return now >= deadline - graceMs;
}

/** The other seat at this 1v1 table. */
export function otherPlayer(players: readonly [string, string], userId: string): string {
  return players[0] === userId ? players[1] : players[0];
}

/**
 * The idempotency rule behind match-ending: whoever wrote first wins, and
 * every later reporter reads that same value back instead of overwriting
 * it. Pulled out as pure logic so it's testable without Redis — the real
 * I/O version (`endMatch` in `pvp.ts`) is `redis.set(key, value, {nx:true})`
 * followed by `redis.get(key)`, which is exactly `firstWins` with
 * `existing` being whatever the `get` returns.
 */
export function firstWins<T>(existing: T | undefined, candidate: T): T {
  return existing ?? candidate;
}
