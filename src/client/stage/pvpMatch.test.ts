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

type PvpMatchModule = typeof import('./pvpMatch.js');
let gaugeStartSchedule: PvpMatchModule['gaugeStartSchedule'];
let gaugeFractionFromDeadline: PvpMatchModule['gaugeFractionFromDeadline'];
let worstGaugeFraction: PvpMatchModule['worstGaugeFraction'];
let pvpOutcomeFor: PvpMatchModule['pvpOutcomeFor'];

before(async () => {
  const pvpMatch = (await import('./pvpMatch' + '.ts')) as PvpMatchModule;
  ({ gaugeStartSchedule, gaugeFractionFromDeadline, worstGaugeFraction, pvpOutcomeFor } = pvpMatch);
});

describe('gaugeStartSchedule', () => {
  test('deadline further away than patience -- waits for the pre-countdown window, then runs the full patience', () => {
    // now=0, patience=10s -> deadline=15000 means 5s of dive/delay slack still remain.
    const result = gaugeStartSchedule(0, 15000, 10);
    assert.equal(result.delayMs, 5000);
    assert.equal(result.durationSec, 10);
  });

  test('deadline exactly patience seconds away -- starts immediately, full duration', () => {
    const result = gaugeStartSchedule(0, 10000, 10);
    assert.equal(result.delayMs, 0);
    assert.equal(result.durationSec, 10);
  });

  test('already inside the countdown window -- starts immediately with only the remaining time', () => {
    // now=6000, deadline=10000 -> 4s left, even though patience is 10s.
    const result = gaugeStartSchedule(6000, 10000, 10);
    assert.equal(result.delayMs, 0);
    assert.equal(result.durationSec, 4);
  });

  test('deadline already in the past -- starts immediately with zero duration, never negative', () => {
    const result = gaugeStartSchedule(12000, 10000, 10);
    assert.equal(result.delayMs, 0);
    assert.equal(result.durationSec, 0);
  });
});

describe('gaugeFractionFromDeadline', () => {
  test('a lamb with no running clock (deadline null) reads empty', () => {
    assert.equal(gaugeFractionFromDeadline(0, null, 10), 0);
  });

  test('halfway through the patience window reads 0.5', () => {
    // patience=10s, deadline=10000 (10s from now=0) -> at now=5000, half elapsed.
    assert.equal(gaugeFractionFromDeadline(5000, 10000, 10), 0.5);
  });

  test('right at spawn (deadline patience seconds away) reads 0', () => {
    assert.equal(gaugeFractionFromDeadline(0, 10000, 10), 0);
  });

  test('right at the deadline reads 1', () => {
    assert.equal(gaugeFractionFromDeadline(10000, 10000, 10), 1);
  });

  test('past the deadline clamps to 1, never overflows', () => {
    assert.equal(gaugeFractionFromDeadline(99000, 10000, 10), 1);
  });

  test('before the countdown has even started (deadline further away than patience) clamps to 0, never negative', () => {
    assert.equal(gaugeFractionFromDeadline(0, 15000, 10), 0);
  });
});

describe('worstGaugeFraction', () => {
  test('no lambs -- 0', () => {
    assert.equal(worstGaugeFraction([], 0), 0);
  });

  test('picks the most-filled lamb among several', () => {
    const lambs = [
      { deadline: 10000, patience: 10 }, // 0.5 at now=5000
      { deadline: 6000, patience: 10 }, // 0.9 at now=5000
      { deadline: null, patience: 10 }, // 0 (no running clock)
    ];
    assert.equal(worstGaugeFraction(lambs, 5000), 0.9);
  });

  test('all idle (no running clocks) -- 0', () => {
    const lambs = [
      { deadline: null, patience: 7 },
      { deadline: null, patience: 19 },
    ];
    assert.equal(worstGaugeFraction(lambs, 0), 0);
  });
});

describe('pvpOutcomeFor', () => {
  test('the local viewer being the winner -- won', () => {
    assert.equal(pvpOutcomeFor({ winnerId: 't2_me' }, 't2_me'), 'won');
  });

  test('the opponent being the winner -- lost', () => {
    assert.equal(pvpOutcomeFor({ winnerId: 't2_opponent' }, 't2_me'), 'lost');
  });
});
