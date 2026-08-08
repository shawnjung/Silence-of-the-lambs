/// <reference types="node" />
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// Node's native TS loader (this file is run directly via
// `node --experimental-strip-types`) requires an explicit `.ts` extension on
// relative specifiers. tsc's project config (moduleResolution "bundler",
// no `allowImportingTsExtensions`) rejects that same extension on *value*
// imports. Type-only references to a `.ts` path are exempt from that tsc
// restriction, so the type import below is static and extension-safe; the
// runtime bindings are loaded via a non-literal dynamic import, which tsc
// treats as an opaque expression (no module-specifier check applies) while
// Node resolves it exactly like any other dynamic import.
type LayoutModule = typeof import('./layout.ts');
type Layout = ReturnType<LayoutModule['computeLayout']>;

const layoutModulePath = './layout.ts';
const { computeLayout, applyPlayCamera } = (await import(
  layoutModulePath
)) as LayoutModule;

const WORLD_WIDTH = 1136;
const WORLD_HEIGHT = 640;
const EPS = 1e-6;

function assertZoomMatchesBand(layout: Layout): void {
  assert.ok(
    Math.abs(layout.zoom * WORLD_WIDTH - layout.band.width) < 1e-6,
    `zoom (${layout.zoom}) * ${WORLD_WIDTH} should equal band.width (${layout.band.width})`
  );
}

function assertBandWithinCanvas(layout: Layout): void {
  assert.ok(layout.band.width <= layout.canvasWidth + EPS);
  assert.ok(layout.band.height <= layout.canvasHeight + EPS);
  assert.ok(layout.band.x >= -EPS);
  assert.ok(layout.band.y >= -EPS);
  assert.ok(layout.band.x + layout.band.width <= layout.canvasWidth + EPS);
  assert.ok(layout.band.y + layout.band.height <= layout.canvasHeight + EPS);
}

function assertNoNegativesOrNaN(layout: Layout): void {
  for (const rect of [layout.band, layout.topStrip, layout.bottomStrip]) {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      assert.ok(Number.isFinite(rect[key]), `${key} should be finite`);
      assert.ok(rect[key] >= -EPS, `${key} should not be negative`);
    }
  }
  assert.ok(Number.isFinite(layout.zoom));
  assert.ok(layout.zoom >= 0);
}

void describe('computeLayout', () => {
  void test('exact 16:9 canvas yields zero strips and a full-canvas band', () => {
    const layout = computeLayout(WORLD_WIDTH, WORLD_HEIGHT);

    assert.equal(layout.topStrip.height, 0);
    assert.equal(layout.bottomStrip.height, 0);
    assert.equal(layout.band.width, WORLD_WIDTH);
    assert.equal(layout.band.height, WORLD_HEIGHT);
    assert.equal(layout.band.x, 0);
    assert.equal(layout.band.y, 0);
    assert.equal(layout.zoom, 1);
    assertZoomMatchesBand(layout);
    assertBandWithinCanvas(layout);
    assertNoNegativesOrNaN(layout);
  });

  void test('portrait canvas (~0.46 aspect) yields a band narrower than the canvas is tall, with two substantial strips', () => {
    const canvasWidth = 390;
    const canvasHeight = 844; // aspect ~0.462, typical phone portrait
    const layout = computeLayout(canvasWidth, canvasHeight);

    // Width-limited band: the band is exactly as wide as the canvas...
    assert.equal(layout.band.width, canvasWidth);
    // ...and narrower than the canvas is tall.
    assert.ok(layout.band.width < canvasHeight);
    // No horizontal centering needed when width-limited.
    assert.equal(layout.band.x, 0);

    // Both strips exist and are well above the compact threshold.
    assert.ok(layout.topStrip.height > 56);
    assert.ok(layout.bottomStrip.height > 56);
    // Bottom strip gets the larger share (thumbs/controls live there).
    assert.ok(layout.bottomStrip.height > layout.topStrip.height);
    assert.equal(layout.compact, false);

    // Strips + band should account for the full canvas height.
    assert.ok(
      Math.abs(
        layout.topStrip.height + layout.band.height + layout.bottomStrip.height - canvasHeight
      ) < EPS
    );

    assertZoomMatchesBand(layout);
    assertBandWithinCanvas(layout);
    assertNoNegativesOrNaN(layout);
  });

  void test('ultrawide canvas (2.5 aspect) yields a height-limited band with zero strips, horizontally centered', () => {
    const canvasWidth = 1600;
    const canvasHeight = 640; // aspect 2.5
    const layout = computeLayout(canvasWidth, canvasHeight);

    // Height-limited: band fills the full canvas height.
    assert.equal(layout.band.height, canvasHeight);
    assert.ok(layout.band.width < canvasWidth);

    // Leftover vertical space is zero, so no strips.
    assert.equal(layout.topStrip.height, 0);
    assert.equal(layout.bottomStrip.height, 0);
    assert.equal(layout.compact, true);

    // Horizontally centered: equal margin on both sides.
    const rightMargin = canvasWidth - (layout.band.x + layout.band.width);
    assert.ok(Math.abs(layout.band.x - rightMargin) < EPS);
    assert.ok(layout.band.x > 0);

    assertZoomMatchesBand(layout);
    assertBandWithinCanvas(layout);
    assertNoNegativesOrNaN(layout);
  });

  void test('compact flips at the ~56px strip threshold', () => {
    // canvasWidth = WORLD_WIDTH keeps the band width-limited and exactly
    // WORLD_WIDTH wide, so leftover = canvasHeight - WORLD_HEIGHT and
    // topStripHeight = leftover * 0.4 lands on round numbers.
    const belowThreshold = computeLayout(WORLD_WIDTH, WORLD_HEIGHT + 139); // top = 55.6
    const atThreshold = computeLayout(WORLD_WIDTH, WORLD_HEIGHT + 140); // top = 56 exactly
    const aboveThreshold = computeLayout(WORLD_WIDTH, WORLD_HEIGHT + 141); // top = 56.4

    assert.equal(belowThreshold.compact, true);
    assert.equal(atThreshold.compact, false); // threshold is strictly "< 56"
    assert.equal(aboveThreshold.compact, false);

    for (const layout of [belowThreshold, atThreshold, aboveThreshold]) {
      assertZoomMatchesBand(layout);
      assertBandWithinCanvas(layout);
      assertNoNegativesOrNaN(layout);
    }
  });

  void test('degenerate inputs never produce NaN or negative sizes', () => {
    const cases: Array<[number, number]> = [
      [0, 0],
      [0, 640],
      [1136, 0],
      [-100, 640],
      [1136, -100],
      [NaN, 640],
      [1136, NaN],
      [Infinity, 640],
      [1136, Infinity],
      [-Infinity, -Infinity],
    ];

    for (const [w, h] of cases) {
      const layout = computeLayout(w, h);
      assertNoNegativesOrNaN(layout);
      // Degenerate input means no usable band.
      assert.equal(layout.band.width, 0);
      assert.equal(layout.band.height, 0);
      assert.equal(layout.compact, true);
    }
  });

  void test('zoom is always consistent with band width', () => {
    const sizes: Array<[number, number]> = [
      [1136, 640],
      [390, 844],
      [430, 932],
      [820, 1180],
      [1280, 720],
      [1920, 1080],
      [512, 512],
      [1600, 640],
      [3440, 1440],
    ];

    for (const [w, h] of sizes) {
      assertZoomMatchesBand(computeLayout(w, h));
    }
  });

  void test('band is always centered horizontally and vertically within its leftover space', () => {
    const sizes: Array<[number, number]> = [
      [390, 844],
      [1600, 640],
      [512, 512],
      [3440, 1440],
    ];

    for (const [w, h] of sizes) {
      const layout = computeLayout(w, h);
      const rightMargin = w - (layout.band.x + layout.band.width);
      assert.ok(Math.abs(layout.band.x - rightMargin) < EPS);
      assertBandWithinCanvas(layout);
    }
  });
});

void describe('applyPlayCamera', () => {
  function createFakeScene() {
    const calls: {
      viewport?: [number, number, number, number];
      zoom?: number;
      scroll?: [number, number];
    } = {};

    const cam = {
      setViewport(x: number, y: number, width: number, height: number) {
        calls.viewport = [x, y, width, height];
        return cam;
      },
      setZoom(z: number) {
        calls.zoom = z;
        return cam;
      },
      setScroll(x: number, y: number) {
        calls.scroll = [x, y];
        return cam;
      },
    };

    const scene = { cameras: { main: cam } };
    return { scene, calls };
  }

  void test('sets viewport to the band and zoom to layout.zoom', () => {
    const layout = computeLayout(390, 844);
    const { scene, calls } = createFakeScene();

    applyPlayCamera(scene as unknown as Parameters<typeof applyPlayCamera>[0], layout);

    assert.deepEqual(calls.viewport, [
      layout.band.x,
      layout.band.y,
      layout.band.width,
      layout.band.height,
    ]);
    assert.equal(calls.zoom, layout.zoom);
  });

  void test('scrolls so world (0,0) is the band top-left and (1136,640) is the bottom-right', () => {
    const cases: Array<[number, number]> = [
      [1136, 640],
      [390, 844],
      [1600, 640],
    ];

    for (const [w, h] of cases) {
      const layout = computeLayout(w, h);
      const { scene, calls } = createFakeScene();

      applyPlayCamera(scene as unknown as Parameters<typeof applyPlayCamera>[0], layout);

      const [scrollX, scrollY] = calls.scroll ?? [NaN, NaN];

      // Reproduce Phaser's own worldView math (Camera#preRender) to verify
      // the visible world rect is exactly (0, 0, WORLD_WIDTH, WORLD_HEIGHT).
      const zoom = layout.zoom > 0 ? layout.zoom : 1;
      const viewportWidth = layout.band.width;
      const viewportHeight = layout.band.height;
      const midX = scrollX + viewportWidth / 2;
      const midY = scrollY + viewportHeight / 2;
      const displayWidth = viewportWidth / zoom;
      const displayHeight = viewportHeight / zoom;
      const worldViewX = midX - displayWidth / 2;
      const worldViewY = midY - displayHeight / 2;

      assert.ok(Math.abs(worldViewX - 0) < 1e-9, `worldView.x for ${w}x${h}`);
      assert.ok(Math.abs(worldViewY - 0) < 1e-9, `worldView.y for ${w}x${h}`);
      assert.ok(
        Math.abs(displayWidth - WORLD_WIDTH) < 1e-6,
        `displayWidth for ${w}x${h}`
      );
      assert.ok(
        Math.abs(displayHeight - WORLD_HEIGHT) < 1e-6,
        `displayHeight for ${w}x${h}`
      );
    }
  });
});
