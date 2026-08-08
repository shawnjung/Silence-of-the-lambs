import assert from 'node:assert/strict';
import { test as nodeTest, describe as nodeDescribe, before } from 'node:test';

// See objects/lambMath.test.ts for why this file is structured this way
// (wrapper functions + a before() hook loading via a non-literal dynamic
// import) -- same Node-native-TS-loader resolution quirk, same workaround.
function describe(name: string, fn: () => void): void {
  void nodeDescribe(name, fn);
}
function test(name: string, fn: () => void): void {
  void nodeTest(name, fn);
}

type ScoringModule = typeof import('./scoring.js');
let computeSpentTime: ScoringModule['computeSpentTime'];
let earnScore: ScoringModule['earnScore'];

before(async () => {
  const scoring = (await import('./scoring' + '.ts')) as ScoringModule;
  ({ computeSpentTime, earnScore } = scoring);
});

describe('computeSpentTime', () => {
  test('truncates to a hundredth of a second, toward zero -- not round, not floor-of-ms', () => {
    // 1234ms -> 1.234s -> *100 = 123.4 -> parseInt/trunc -> 123 -> /100 = 1.23
    assert.equal(computeSpentTime(1234), 1.23);
    // 6789ms -> 6.789s -> 678.9 -> 678 -> 6.78 (not 6.79, i.e. not rounded)
    assert.equal(computeSpentTime(6789), 6.78);
  });

  test('exact hundredths pass through unchanged', () => {
    assert.equal(computeSpentTime(1230), 1.23);
    assert.equal(computeSpentTime(5000), 5);
  });

  test('zero elapsed time is zero spent time', () => {
    assert.equal(computeSpentTime(0), 0);
  });
});

describe('earnScore', () => {
  const patience = 10; // total_score = 16, patience/10 = 1 -- clean boundary numbers.
  const startedAt = 0;

  test('a tap so early that rest_time >= spent_time scores nothing (but still has a popup value of 0)', () => {
    // spent_time = 3, rest_time = 7 -- 7 < 3 is false, so no award.
    const result = earnScore(patience, startedAt, 3000);
    assert.equal(result.awarded, null);
    assert.equal(result.popupValue, 0);
  });

  test('a mid-window tap (past halfway, not in the final 10%) scores total - rest*1.6', () => {
    // spent_time = 6, rest_time = 4. patience/10 = 1, so 4 < 1 is false (no double).
    // score = 16 - 4*1.6 = 9.6 -> truncated to 9. rest(4) < spent(6) -> awarded.
    const result = earnScore(patience, startedAt, 6000);
    assert.equal(result.awarded, 9);
    assert.equal(result.popupValue, 9);
  });

  test('a tap in the final 10% of the patience window doubles the score', () => {
    // spent_time = 9.5, rest_time = 0.5. 0.5 < patience/10(1) -> double.
    // score = 16*2 = 32. rest(0.5) < spent(9.5) -> awarded.
    const result = earnScore(patience, startedAt, 9500);
    assert.equal(result.awarded, 32);
    assert.equal(result.popupValue, 32);
  });

  test('exact boundary: rest_time === patience/10 does NOT double (strict less-than)', () => {
    // spent_time = 9 -> rest_time = 1 === patience/10(1) -> else branch.
    // score = 16 - 1*1.6 = 14.4 -> truncated to 14. rest(1) < spent(9) -> awarded.
    const result = earnScore(patience, startedAt, 9000);
    assert.equal(result.awarded, 14);
  });

  test('just past that boundary (rest_time fractionally under patience/10) does double', () => {
    // spent_time = 9.01 -> rest_time = 0.99 < 1 -> double -> score = 32 exactly
    // regardless of how far under the threshold, since the double branch
    // doesn't depend on rest_time at all.
    const result = earnScore(patience, startedAt, 9010);
    assert.equal(result.awarded, 32);
  });

  test('exact boundary: rest_time === spent_time does NOT award (strict less-than)', () => {
    // spent_time = 5, rest_time = 5 -- equal, so rest_time < spent_time is false.
    const result = earnScore(patience, startedAt, 5000);
    assert.equal(result.awarded, null);
    assert.equal(result.popupValue, 0);
  });

  test('just past that boundary (spent_time fractionally over half) does award', () => {
    // spent_time = 5.01, rest_time = 4.99 -- 4.99 < 5.01 -> awarded.
    // score = 16 - 4.99*1.6 = 8.016 -> truncated to 8.
    const result = earnScore(patience, startedAt, 5010);
    assert.equal(result.awarded, 8);
  });

  test('a different patience level scales total_score and the 10% window proportionally', () => {
    // patience = 19 (the max level): total = 30.4, patience/10 = 1.9.
    // spent_time = 18, rest_time = 1 < 1.9 -> double -> score = 60.8 -> 60.
    const result = earnScore(19, startedAt, 18000);
    assert.equal(result.awarded, 60);
  });

  test('computeSpentTime truncates toward zero even for a negative elapsed time (parseInt semantics, not Math.floor)', () => {
    // -1234ms -> -1.234s -> *100 = -123.4 -> parseInt/trunc-toward-zero ->
    // -123 -> /100 = -1.23. Math.floor would have wrongly given -1.24.
    assert.equal(computeSpentTime(-1234), -1.23);
  });
});
