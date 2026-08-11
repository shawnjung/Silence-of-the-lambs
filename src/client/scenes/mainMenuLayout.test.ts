/// <reference types="node" />
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// See layout.test.ts's own header comment for why this dynamic-import
// dance (rather than a plain relative import) is needed for a module run
// directly via `node --experimental-strip-types`.
type MainMenuLayoutModule = typeof import('./mainMenuLayout.ts');

const modulePath = './mainMenuLayout.ts';
const {
  decideMenuButtonMode,
  computeMenuButtonPlacement,
  MENU_BUTTON_WIDTH,
  MENU_BUTTON_HEIGHT,
} = (await import(modulePath)) as MainMenuLayoutModule;

const EPS = 1e-9;

void describe('decideMenuButtonMode', () => {
  void test('the native 1136-wide world fits side-by-side', () => {
    assert.equal(decideMenuButtonMode(1136), 'row');
  });

  void test('a square 640-wide world (portrait phone) is too narrow and stacks', () => {
    assert.equal(decideMenuButtonMode(640), 'column');
  });

  void test('flips exactly at the row-width threshold', () => {
    // rowWidth = 396*2 + 28 + 24*2 = 868
    assert.equal(decideMenuButtonMode(867), 'column');
    assert.equal(decideMenuButtonMode(868), 'row');
    assert.equal(decideMenuButtonMode(869), 'row');
  });

  void test('respects custom button width/gap/margin', () => {
    // rowWidth = 100*2 + 10 + 5*2 = 220
    assert.equal(decideMenuButtonMode(219, 100, 10, 5), 'column');
    assert.equal(decideMenuButtonMode(220, 100, 10, 5), 'row');
  });
});

void describe('computeMenuButtonPlacement', () => {
  void test('row mode at worldWidth 1136 reproduces the legacy fixed offsets exactly', () => {
    const placement = computeMenuButtonPlacement(1136, 500);

    assert.equal(placement.mode, 'row');
    // legacy: WORLD_WIDTH/2 - 410 and WORLD_WIDTH/2 + 14
    assert.ok(Math.abs(placement.score.x - (1136 / 2 - 410)) < EPS);
    assert.ok(Math.abs(placement.pvp.x - (1136 / 2 + 14)) < EPS);
    assert.equal(placement.score.y, 500);
    assert.equal(placement.pvp.y, 500);
  });

  void test('row mode centers the pair on worldWidth/2 with no gap overlap', () => {
    const placement = computeMenuButtonPlacement(1000, 200);
    assert.equal(placement.mode, 'row');

    const scoreRight = placement.score.x + MENU_BUTTON_WIDTH;
    const gap = placement.pvp.x - scoreRight;
    assert.ok(gap > 0, `expected a positive gap, got ${gap}`);

    const leftMargin = placement.score.x;
    const rightMargin = 1000 - (placement.pvp.x + MENU_BUTTON_WIDTH);
    assert.ok(Math.abs(leftMargin - rightMargin) < EPS);
  });

  void test('column mode stacks Score above PvP, both centered horizontally, never overlapping', () => {
    const placement = computeMenuButtonPlacement(640, 500);
    assert.equal(placement.mode, 'column');

    assert.ok(Math.abs(placement.score.x - placement.pvp.x) < EPS);
    // Centered: left margin (x) equals right margin (worldWidth - x - buttonWidth).
    const rightMargin = 640 - (placement.score.x + MENU_BUTTON_WIDTH);
    assert.ok(Math.abs(placement.score.x - rightMargin) < EPS);

    // Both are origin-(0, baseline) sprites -- each occupies
    // [baseline - height, baseline]. Score sits above PvP with no overlap:
    // score's own baseline must be at or above PvP's top edge.
    assert.ok(placement.score.y <= placement.pvp.y - MENU_BUTTON_HEIGHT + EPS);
    // PvP keeps the same baseline row mode would have used.
    assert.equal(placement.pvp.y, 500);
  });

  void test('both buttons stay within [0, worldWidth] across a wide range of widths', () => {
    for (const worldWidth of [640, 700, 800, 868, 900, 1000, 1136]) {
      const placement = computeMenuButtonPlacement(worldWidth, 400);
      for (const btn of [placement.score, placement.pvp]) {
        assert.ok(btn.x >= -EPS, `x should not be negative for worldWidth=${worldWidth}`);
        assert.ok(
          btn.x + MENU_BUTTON_WIDTH <= worldWidth + EPS,
          `button should not overflow worldWidth=${worldWidth} (x=${btn.x})`
        );
      }
    }
  });
});
