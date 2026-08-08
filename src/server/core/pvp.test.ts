/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

// Node's native TS loader (this file is run directly via
// `node --experimental-strip-types`) requires an explicit `.ts` extension on
// relative specifiers. tsc's project config (moduleResolution "bundler", no
// `allowImportingTsExtensions`) rejects that same extension on *value*
// imports. Type-only references to a `.ts` path are exempt from that tsc
// restriction, so the type import below is static and extension-safe; the
// runtime bindings are loaded via a non-literal dynamic import, which tsc
// treats as an opaque expression (no module-specifier check applies) while
// Node resolves it exactly like any other dynamic import. See
// `src/client/core/layout.test.ts` for the same pattern. This is why the
// pure rules live in `pvpRules.ts` rather than `pvp.ts` itself: `pvp.ts`
// pulls in `@devvit/web/server` and other extensionless local imports that
// only a bundler (not Node's loader) can resolve, but `pvpRules.ts` has no
// runtime imports of its own and can be loaded directly like this.
type PvpRulesModule = typeof import('./pvpRules.ts');

const pvpRulesModulePath = './pvpRules.ts';
const {
  EXPIRE_GRACE_MS,
  firstWins,
  generateLambAttributes,
  initialDeadline,
  isExpireValid,
  otherPlayer,
  sampleDirection,
  sampleLine,
  samplePatience,
  shouldEscalate,
} = (await import(pvpRulesModulePath)) as PvpRulesModule;

// A fixed sequence of "random" numbers so tests are deterministic without
// touching Math.random. Each call returns the next value, wrapping around.
function fakeRand(...values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v!;
  };
}

void test('isExpireValid rejects a report that arrives before the (grace-adjusted) deadline', () => {
  const deadline = 10_000;
  assert.equal(isExpireValid(deadline - EXPIRE_GRACE_MS - 1, deadline), false);
});

void test('isExpireValid accepts a report at or after the grace-adjusted deadline', () => {
  const deadline = 10_000;
  assert.equal(isExpireValid(deadline - EXPIRE_GRACE_MS, deadline), true);
  assert.equal(isExpireValid(deadline, deadline), true);
  assert.equal(isExpireValid(deadline + 5_000, deadline), true);
});

void test('isExpireValid never validates a lamb with no running clock', () => {
  assert.equal(isExpireValid(Number.MAX_SAFE_INTEGER, null), false);
});

void test('shouldEscalate: exactly on the 1/8-of-patience boundary is not an escalation', () => {
  // patience_was = 8s -> boundary is patience_was/8 = 1s of remaining time.
  // rest_second == 1 is NOT "< 1", so this must not escalate.
  const patienceBefore = 8;
  const now = 0;
  const deadlineBefore = now + 1_000; // exactly 1s of "rest" left
  assert.equal(shouldEscalate(deadlineBefore, patienceBefore, now), false);
});

void test('shouldEscalate: one millisecond inside the boundary does escalate', () => {
  const patienceBefore = 8;
  const now = 0;
  const deadlineBefore = now + 999; // just under 1s of "rest" left
  assert.equal(shouldEscalate(deadlineBefore, patienceBefore, now), true);
});

void test('shouldEscalate: comfortably outside the last-1/8 window does not escalate', () => {
  const patienceBefore = 16;
  const now = 0;
  const deadlineBefore = now + 10_000; // 10s of 16s remaining, nowhere near the last 1/8 (2s)
  assert.equal(shouldEscalate(deadlineBefore, patienceBefore, now), false);
});

void test('shouldEscalate never fires for a lamb whose clock never started (null deadline)', () => {
  // Mirrors the legacy `start_time` being undefined -> NaN comparison -> false,
  // for both a still-diving initial lamb and a never-touched escalation lamb.
  assert.equal(shouldEscalate(null, 19, Date.now()), false);
});

void test('generated lamb attributes always fall within the legacy ranges', () => {
  for (let i = 0; i < 2000; i++) {
    const attrs = generateLambAttributes(Math.random);
    assert.ok(attrs.x >= 0 && attrs.x < 1, `x out of range: ${attrs.x}`);
    assert.ok(
      attrs.speedPerSec >= 100 && attrs.speedPerSec < 300,
      `speedPerSec out of range: ${attrs.speedPerSec}`
    );
    assert.ok(
      Number.isInteger(attrs.patience) && attrs.patience >= 7 && attrs.patience <= 19,
      `patience out of range: ${attrs.patience}`
    );
    assert.ok(
      Number.isInteger(attrs.line) && attrs.line >= 0 && attrs.line <= 4,
      `line out of range: ${attrs.line}`
    );
    assert.ok(
      attrs.direction === 'left' || attrs.direction === 'right',
      `direction invalid: ${attrs.direction}`
    );
    assert.ok(attrs.delay >= 0 && attrs.delay < 1, `delay out of range: ${attrs.delay}`);
  }
});

void test('samplePatience/sampleLine/sampleDirection hit their range boundaries', () => {
  assert.equal(samplePatience(fakeRand(0)), 7);
  assert.equal(samplePatience(fakeRand(0.999999)), 19);
  assert.equal(sampleLine(fakeRand(0)), 0);
  assert.equal(sampleLine(fakeRand(0.999999)), 4);
  assert.equal(sampleDirection(fakeRand(0)), 'left');
  assert.equal(sampleDirection(fakeRand(0.999999)), 'right');
});

void test('initialDeadline folds in dive delay, spawn delay, and patience', () => {
  const now = 1_000_000;
  const delay = 0.4;
  const patience = 10;
  // dive_delay (1.5s) + delay (0.4s) + patience (10s) = 11.9s
  assert.equal(initialDeadline(now, delay, patience), now + 11_900);
});

void test('otherPlayer resolves the opposite seat', () => {
  const players: [string, string] = ['a', 'b'];
  assert.equal(otherPlayer(players, 'a'), 'b');
  assert.equal(otherPlayer(players, 'b'), 'a');
});

void test('firstWins: a second report of a match ending does not overwrite the first winner', () => {
  type Over = { winnerId: string; lambId: string; reason: 'expired' | 'wrong-touch' };
  const first: Over = { winnerId: 'p1', lambId: 'lamb-1', reason: 'expired' };
  const second: Over = { winnerId: 'p2', lambId: 'lamb-2', reason: 'wrong-touch' };

  // Simulates redis.set(key, value, {nx:true}) followed by redis.get(key):
  // the first call finds nothing stored yet, the second finds the first
  // call's value already there.
  const resolvedForFirstCall = firstWins<Over | undefined>(undefined, first);
  const resolvedForSecondCall = firstWins(resolvedForFirstCall, second);

  assert.deepEqual(resolvedForFirstCall, first);
  assert.deepEqual(resolvedForSecondCall, first);
  assert.notDeepEqual(resolvedForSecondCall, second);
});
