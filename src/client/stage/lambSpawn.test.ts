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

type LambSpawnModule = typeof import('./lambSpawn.js');
let attributesForRandomLamb: LambSpawnModule['attributesForRandomLamb'];
let computeLambSpawnPosition: LambSpawnModule['computeLambSpawnPosition'];
let freshLineCounts: LambSpawnModule['freshLineCounts'];
let samplePatience: LambSpawnModule['samplePatience'];
let sampleLine: LambSpawnModule['sampleLine'];
let sampleDirection: LambSpawnModule['sampleDirection'];
let Y_LINES: LambSpawnModule['Y_LINES'];
let PATIENCE_MIN: LambSpawnModule['PATIENCE_MIN'];
let PATIENCE_MAX: LambSpawnModule['PATIENCE_MAX'];

before(async () => {
  const lambSpawn = (await import('./lambSpawn' + '.ts')) as LambSpawnModule;
  ({
    attributesForRandomLamb,
    computeLambSpawnPosition,
    freshLineCounts,
    samplePatience,
    sampleLine,
    sampleDirection,
    Y_LINES,
    PATIENCE_MIN,
    PATIENCE_MAX,
  } = lambSpawn);
});

const ITERATIONS = 2000;

describe('samplePatience', () => {
  test('stays within the legacy 7..19 inclusive range and is always an integer', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const patience = samplePatience();
      assert.ok(Number.isInteger(patience), `${patience} should be an integer`);
      assert.ok(patience >= PATIENCE_MIN, `${patience} >= ${PATIENCE_MIN}`);
      assert.ok(patience <= PATIENCE_MAX, `${patience} <= ${PATIENCE_MAX}`);
    }
  });

  test('is deterministic for a given rng, and covers both ends of the range', () => {
    assert.equal(samplePatience(() => 0), PATIENCE_MIN);
    // Just under 1 should land on the top level, not overflow past it.
    assert.equal(samplePatience(() => 0.999999), PATIENCE_MAX);
  });
});

describe('sampleLine', () => {
  test('stays within 0..4 -- NOT 0..5, even though Y_LINES has six entries (legacy quirk)', () => {
    assert.equal(Y_LINES.length, 6);

    const seen = new Set<number>();
    for (let i = 0; i < ITERATIONS; i++) {
      const line = sampleLine();
      assert.ok(Number.isInteger(line));
      assert.ok(line >= 0 && line <= 4, `${line} should be in [0, 4]`);
      seen.add(line);
    }
    // Over enough iterations, all five spawnable lines should show up, and
    // line 5 (the sixth y_lines entry) should never be produced.
    assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]);
  });

  test('is deterministic for a given rng', () => {
    assert.equal(sampleLine(() => 0), 0);
    assert.equal(sampleLine(() => 0.999999), 4);
  });
});

describe('sampleDirection', () => {
  test('only ever produces left or right', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const direction = sampleDirection();
      assert.ok(direction === 'left' || direction === 'right');
    }
  });

  test('is deterministic for a given rng', () => {
    assert.equal(sampleDirection(() => 0), 'left');
    assert.equal(sampleDirection(() => 0.999999), 'right');
  });
});

describe('attributesForRandomLamb', () => {
  test('every field stays within its legacy range, over many iterations', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const attrs = attributesForRandomLamb();

      assert.ok(attrs.x >= 0 && attrs.x < 1, `x=${attrs.x}`);
      assert.ok(attrs.line >= 0 && attrs.line <= 4, `line=${attrs.line}`);
      assert.ok(Number.isInteger(attrs.patience));
      assert.ok(attrs.patience >= PATIENCE_MIN && attrs.patience <= PATIENCE_MAX);
      assert.ok(attrs.direction === 'left' || attrs.direction === 'right');
      // (300-200) + Math.random()*200 -- legacy's own oddly-written 100+rand*200.
      assert.ok(attrs.speedPerSec >= 100 && attrs.speedPerSec < 300, `speedPerSec=${attrs.speedPerSec}`);
      assert.ok(attrs.delay >= 0 && attrs.delay < 1, `delay=${attrs.delay}`);
    }
  });
});

describe('computeLambSpawnPosition', () => {
  test('the first lamb on a line lands at y_lines[line] + 20 + 15', () => {
    const counts = freshLineCounts();
    const pos = computeLambSpawnPosition(2, counts, 1136, 0.5);
    assert.equal(pos.y, Y_LINES[2] + 20 + 1 * 15);
    assert.equal(counts[2], 1);
  });

  test('successive spawns on the same line stack by +15 each time (push-then-read-length order)', () => {
    const counts = freshLineCounts();
    const first = computeLambSpawnPosition(0, counts, 1136, 0);
    const second = computeLambSpawnPosition(0, counts, 1136, 0);
    const third = computeLambSpawnPosition(0, counts, 1136, 0);

    assert.equal(first.y, Y_LINES[0] + 20 + 15);
    assert.equal(second.y, Y_LINES[0] + 20 + 30);
    assert.equal(third.y, Y_LINES[0] + 20 + 45);
  });

  test('lines are tracked independently', () => {
    const counts = freshLineCounts();
    computeLambSpawnPosition(0, counts, 1136, 0);
    computeLambSpawnPosition(0, counts, 1136, 0);
    const line3 = computeLambSpawnPosition(3, counts, 1136, 0);

    assert.equal(line3.y, Y_LINES[3] + 20 + 1 * 15); // unaffected by line 0's count
  });

  test('x is the stage width scaled by the fraction, truncated toward zero', () => {
    const counts = freshLineCounts();
    const pos = computeLambSpawnPosition(0, counts, 1136, 0.6789);
    assert.equal(pos.x, Math.trunc(1136 * 0.6789));
  });

  test('scale = 0.5 - (y/stageHeight)*0.45, matching the two extremes from the legacy y range', () => {
    const counts = freshLineCounts();
    // Smallest possible y (line 0, first spawn): y = 0+20+15 = 35.
    const near = computeLambSpawnPosition(0, counts, 1136, 0, 640);
    assert.ok(Math.abs(near.scale - (0.5 - (35 / 640) * 0.45)) < 1e-9);

    // Largest y_lines entry (line 4 -> y_lines[4] = 360) with several stacked lambs.
    const farCounts = freshLineCounts();
    farCounts[4] = 5;
    const far = computeLambSpawnPosition(4, farCounts, 1136, 0, 640);
    const expectedY = 360 + 20 + 6 * 15;
    assert.ok(Math.abs(far.scale - (0.5 - (expectedY / 640) * 0.45)) < 1e-9);
  });

  test('property: over many random attribute draws, the resulting position/scale always stays in legacy bounds', () => {
    // A fresh line-count table per iteration -- a real round only ever
    // stacks a handful of lambs per line (LAMBS_COUNT=5, plus the
    // occasional every-5th-score respawn), never anywhere near enough to
    // push y (and therefore scale) out of its intended range. Reusing one
    // table across all `ITERATIONS` draws would instead be testing an
    // unrealistic "thousands of lambs stacked on one line" scenario.
    for (let i = 0; i < ITERATIONS; i++) {
      const counts = freshLineCounts();
      const attrs = attributesForRandomLamb();
      const pos = computeLambSpawnPosition(attrs.line, counts, 1136, attrs.x);

      assert.ok(pos.x >= 0 && pos.x < 1136, `x=${pos.x}`);
      const lineBase = Y_LINES[attrs.line] ?? 0;
      assert.ok(pos.y > lineBase, `y=${pos.y} should be past its line's base`);
      // scale = 0.5 - (y/640)*0.45, matching the direct formula test above --
      // check it holds for every randomly-drawn line/position, not just the
      // two fixed examples.
      const expectedScale = 0.5 - (pos.y / 640) * 0.45;
      assert.ok(Math.abs(pos.scale - expectedScale) < 1e-9, `scale=${pos.scale}`);
    }
  });
});
