import assert from 'node:assert/strict';
import { test as nodeTest, describe as nodeDescribe, before } from 'node:test';

// node:test's `test`/`describe` always return `Promise<void>` (even for a
// fully synchronous callback), which @typescript-eslint/no-floating-promises
// correctly flags as unhandled at every call site unless each one is
// individually `void`-ed or awaited. These two thin wrappers do that once,
// here, so the ~30 call sites below can stay exactly as plain and readable
// as every other *.test.ts file in this repo.
function describe(name: string, fn: () => void): void {
  void nodeDescribe(name, fn);
}
function test(name: string, fn: () => void): void {
  void nodeTest(name, fn);
}

// `node --experimental-strip-types` sometimes fails to resolve a plain
// `./lambMath.js` specifier to its sibling `.ts` source for a module it has
// never loaded before in this process/host (observed in this sandbox; the
// exact same static-import pattern works fine for other, older `.test.ts`
// files in this repo). `import type` is fully erased at compile time -- it
// never becomes a runtime import -- so it's unaffected and gives us real
// types; a dynamic import with a *computed* (non-literal) specifier sidesteps
// both that resolution quirk and TypeScript's TS5097 ("import path cannot end
// with .ts") since the literal-path check only looks at string-literal
// arguments. It's loaded from a `before()` hook rather than a top-level
// `await` because top-level await in this file confuses
// @typescript-eslint/no-floating-promises into flagging every unrelated
// statement below as an unhandled promise.
type LambMathModule = typeof import('./lambMath.js');
let clampLambX: LambMathModule['clampLambX'];
let cocosYToDepth: LambMathModule['cocosYToDepth'];
let computePatrolPlan: LambMathModule['computePatrolPlan'];
let effectiveSpeedPerSec: LambMathModule['effectiveSpeedPerSec'];
let flipOriginY: LambMathModule['flipOriginY'];
let flipY: LambMathModule['flipY'];
let localBodyPosition: LambMathModule['localBodyPosition'];
let patrolDurationSec: LambMathModule['patrolDurationSec'];

before(async () => {
  const lambMath = (await import('./lambMath' + '.ts')) as LambMathModule;
  ({
    clampLambX,
    cocosYToDepth,
    computePatrolPlan,
    effectiveSpeedPerSec,
    flipOriginY,
    flipY,
    localBodyPosition,
    patrolDurationSec,
  } = lambMath);
});

describe('flipY / cocosYToDepth', () => {
  test('flips against the full world height', () => {
    assert.equal(flipY(0), 640);
    assert.equal(flipY(640), 0);
    assert.equal(flipY(320), 320);
  });

  test('depth is exactly the flipped y -- lower on screen (larger phaserY) draws in front', () => {
    for (const cocosY of [0, 20, 100, 280, 440, 639]) {
      assert.equal(cocosYToDepth(cocosY), flipY(cocosY));
    }

    // A lamb nearer the top of the stage (larger cocosY) has a *smaller*
    // phaserY/depth than one nearer the bottom, so it draws further back.
    const nearTop = cocosYToDepth(500);
    const nearBottom = cocosYToDepth(50);
    assert.ok(nearBottom > nearTop);
  });

  test('respects a custom world height', () => {
    assert.equal(flipY(0, 1000), 1000);
    assert.equal(flipY(1000, 1000), 0);
  });
});

describe('flipOriginY', () => {
  test('mirrors anchor fractions on the y axis', () => {
    assert.equal(flipOriginY(0), 1);
    assert.equal(flipOriginY(1), 0);
    assert.equal(flipOriginY(0.5), 0.5);
    assert.equal(flipOriginY(0.09), 0.91);
  });
});

describe('localBodyPosition', () => {
  test('front_body (lamb_node.coffee: x=0,y=70 in a 540-wide box)', () => {
    assert.deepEqual(localBodyPosition(0, 70, 540), { x: -270, y: -70 });
  });

  test('leg 0 (x=360,y=210 in a 540-wide box)', () => {
    assert.deepEqual(localBodyPosition(360, 210, 540), { x: 90, y: -210 });
  });

  test('shadow (x=0,y=-30 in a 540-wide box) lands below the ground pin', () => {
    const { x, y } = localBodyPosition(0, -30, 540);
    assert.equal(x, -270);
    assert.equal(y, 30); // positive Phaser-local y = below the feet, as intended
  });

  test('gauge fill/track (x=0,y=0 in a 200-wide box) centers horizontally', () => {
    assert.deepEqual(localBodyPosition(0, 0, 200), { x: -100, y: 0 });
  });

  test('is independent of box height (only ay=0 matters, not H)', () => {
    // Same lx, ly, boxWidth should give the same result no matter what the
    // (unused) box height would have been -- this function takes no height
    // argument at all, which is the point being tested here.
    const a = localBodyPosition(30, 55, 540);
    const b = localBodyPosition(30, 55, 540);
    assert.deepEqual(a, b);
  });
});

describe('clampLambX', () => {
  test('leaves an in-range x untouched', () => {
    const result = clampLambX(500, 1136, 540);
    assert.equal(result.minimum, 270);
    assert.equal(result.maximum, 1136 - 270);
    assert.equal(result.x, 500);
  });

  test('clamps an x spawned below minimum', () => {
    const result = clampLambX(-50, 1136, 540);
    assert.equal(result.x, result.minimum);
  });

  test('clamps an x spawned above maximum', () => {
    const result = clampLambX(5000, 1136, 540);
    assert.equal(result.x, result.maximum);
  });

  test('a lamb wider than the stage always collapses to minimum (legacy quirk)', () => {
    // stageWidth=200, lambWidth=540 => minimum=270, maximum=200-270=-70, so
    // minimum > maximum. Sequential (not else-if) ifs in the original mean
    // the min-check always fires last and wins, for *any* input x.
    const stageWidth = 200;
    const lambWidth = 540;

    for (const x of [-1000, -70, 0, 100, 270, 1000]) {
      const result = clampLambX(x, stageWidth, lambWidth);
      assert.ok(result.minimum > result.maximum);
      assert.equal(result.x, result.minimum);
    }
  });

  test('zero-width stage/lamb does not throw and is internally consistent', () => {
    const result = clampLambX(0, 0, 0);
    assert.equal(result.minimum, 0);
    assert.equal(result.maximum, 0);
    assert.equal(result.x, 0);
  });
});

describe('effectiveSpeedPerSec', () => {
  test('smaller (further away) lambs move slower', () => {
    assert.equal(effectiveSpeedPerSec(200, 0.5), 100);
    assert.equal(effectiveSpeedPerSec(200, 1), 200);
  });

  test('scale of 0 yields zero speed rather than NaN', () => {
    assert.equal(effectiveSpeedPerSec(200, 0), 0);
  });
});

describe('patrolDurationSec', () => {
  test('duration = distance / speed', () => {
    assert.equal(patrolDurationSec(1136, 200), 5.68);
  });

  test('zero distance yields zero duration', () => {
    assert.equal(patrolDurationSec(0, 200), 0);
  });

  test('non-positive speed is guarded to zero, not Infinity/NaN', () => {
    assert.equal(patrolDurationSec(100, 0), 0);
    assert.equal(patrolDurationSec(100, -5), 0);
  });
});

describe('computePatrolPlan', () => {
  const baseInput = {
    currentX: 0,
    from: 0,
    to: 1136,
    minimum: 270,
    maximum: 1136 - 270,
    speedPerSec: 200,
  };

  test('starting direction "right" produces a single intro leg straight to `to`', () => {
    const plan = computePatrolPlan({ ...baseInput, currentX: 300, direction: 'right' });

    assert.equal(plan.intro.length, 1);
    assert.equal(plan.intro[0]?.direction, 'right');
    assert.equal(plan.intro[0]?.fromX, 300);
    assert.equal(plan.intro[0]?.toX, plan.loop[1]?.toX); // clamped `to`
    assert.equal(
      plan.intro[0]?.durationSec,
      patrolDurationSec((plan.intro[0]?.toX ?? 0) - 300, baseInput.speedPerSec)
    );
  });

  test('starting direction "left" produces two intro legs: walk to `from`, then turn and walk to `to`', () => {
    const plan = computePatrolPlan({ ...baseInput, currentX: 800, direction: 'left' });

    assert.equal(plan.intro.length, 2);
    assert.equal(plan.intro[0]?.direction, 'left');
    assert.equal(plan.intro[0]?.fromX, 800);
    assert.equal(plan.intro[1]?.direction, 'right');
    assert.equal(plan.intro[0]?.toX, plan.intro[1]?.fromX); // legs are contiguous
    assert.equal(plan.intro[1]?.toX, plan.loop[1]?.toX);
  });

  test('the loop always starts by turning left toward `from`, then right toward `to`, with equal durations', () => {
    const plan = computePatrolPlan({ ...baseInput, direction: 'right' });

    // baseInput.from/to (0/1136) are both clamped by minimum/maximum
    // (270/866), so the loop's targets are the clamped values, not the raw
    // inputs -- see the dedicated clamping test below for that behaviour.
    assert.equal(plan.loop.length, 2);
    assert.equal(plan.loop[0]?.direction, 'left');
    assert.equal(plan.loop[0]?.toX, baseInput.minimum);
    assert.equal(plan.loop[1]?.direction, 'right');
    assert.equal(plan.loop[1]?.toX, baseInput.maximum);
    assert.equal(plan.loop[0]?.durationSec, plan.loop[1]?.durationSec);
  });

  test('clamps from/to against minimum/maximum before computing distances', () => {
    const plan = computePatrolPlan({
      ...baseInput,
      from: -500, // below minimum(270) -> clamped up to 270
      to: 5000, // above maximum(866) -> clamped down to 866
      direction: 'right',
    });

    assert.equal(plan.loop[0]?.toX, baseInput.minimum);
    assert.equal(plan.loop[1]?.toX, baseInput.maximum);
  });

  test('zero distance (from === to) yields zero-duration loop and intro steps', () => {
    const plan = computePatrolPlan({ ...baseInput, from: 600, to: 600, currentX: 600, direction: 'right' });

    assert.equal(plan.loop[0]?.durationSec, 0);
    assert.equal(plan.loop[1]?.durationSec, 0);
    assert.equal(plan.intro[0]?.durationSec, 0);
  });

  test('both starting directions eventually converge on an identical steady-state loop', () => {
    const rightPlan = computePatrolPlan({ ...baseInput, currentX: 0, direction: 'right' });
    const leftPlan = computePatrolPlan({ ...baseInput, currentX: 1136, direction: 'left' });

    assert.deepEqual(rightPlan.loop, leftPlan.loop);
  });
});
