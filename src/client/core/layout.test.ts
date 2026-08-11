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

/** The world's native, maximum width/height -- mirrors NATIVE_WORLD_WIDTH/WORLD_HEIGHT in layout.ts itself. */
const NATIVE_WORLD_WIDTH = 1136;
const WORLD_HEIGHT = 640;
/** The narrowest the world is ever allowed to resolve to -- a square. */
const MIN_WORLD_WIDTH = WORLD_HEIGHT;
const EPS = 1e-6;

function assertZoomMatchesBand(layout: Layout): void {
  assert.ok(
    Math.abs(layout.zoom * layout.worldWidth - layout.band.width) < 1e-6,
    `zoom (${layout.zoom}) * worldWidth (${layout.worldWidth}) should equal band.width (${layout.band.width})`
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
  assert.ok(Number.isFinite(layout.worldWidth));
  assert.ok(Number.isFinite(layout.worldHeight));
  assert.ok(layout.worldWidth > 0);
  assert.ok(layout.worldHeight > 0);
}

/** `layout.worldWidth` must always be in [640, 1136] and worldHeight must always be exactly 640, whatever the canvas. */
function assertWorldSizeInRange(layout: Layout): void {
  assert.ok(
    layout.worldWidth >= MIN_WORLD_WIDTH - EPS && layout.worldWidth <= NATIVE_WORLD_WIDTH + EPS,
    `worldWidth (${layout.worldWidth}) should be in [${MIN_WORLD_WIDTH}, ${NATIVE_WORLD_WIDTH}]`
  );
  assert.equal(layout.worldHeight, WORLD_HEIGHT);
}

/**
 * Reproduces Phaser's own worldView math (Camera#preRender: `midX = scrollX +
 * width * 0.5`, `worldView.x = midX - (width / zoom) / 2`) independently of
 * `applyPlayCamera`, to verify the visible world rectangle is exactly
 * (0, 0, layout.worldWidth, layout.worldHeight) for a given canvas size --
 * see layout.ts's own header comment on why this derivation, not a literal
 * re-use of applyPlayCamera's formula, is the right thing to assert against.
 */
function assertWorldMapsOntoBand(canvasWidth: number, canvasHeight: number): void {
  const layout = computeLayout(canvasWidth, canvasHeight);
  const calls: { viewport?: [number, number, number, number]; zoom?: number; scroll?: [number, number] } = {};

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

  applyPlayCamera(scene as unknown as Parameters<typeof applyPlayCamera>[0], layout);

  const [scrollX, scrollY] = calls.scroll ?? [NaN, NaN];
  const zoom = layout.zoom > 0 ? layout.zoom : 1;
  const viewportWidth = layout.band.width;
  const viewportHeight = layout.band.height;
  const midX = scrollX + viewportWidth / 2;
  const midY = scrollY + viewportHeight / 2;
  const displayWidth = viewportWidth / zoom;
  const displayHeight = viewportHeight / zoom;
  const worldViewX = midX - displayWidth / 2;
  const worldViewY = midY - displayHeight / 2;

  assert.ok(Math.abs(worldViewX - 0) < 1e-9, `worldView.x for ${canvasWidth}x${canvasHeight}`);
  assert.ok(Math.abs(worldViewY - 0) < 1e-9, `worldView.y for ${canvasWidth}x${canvasHeight}`);
  assert.ok(
    Math.abs(displayWidth - layout.worldWidth) < 1e-6,
    `displayWidth for ${canvasWidth}x${canvasHeight} should equal worldWidth (${layout.worldWidth}), got ${displayWidth}`
  );
  assert.ok(
    Math.abs(displayHeight - layout.worldHeight) < 1e-6,
    `displayHeight for ${canvasWidth}x${canvasHeight} should equal worldHeight (${layout.worldHeight}), got ${displayHeight}`
  );
}

void describe('computeLayout', () => {
  void test('exact 16:9 canvas yields zero strips, a full-canvas band, and the native worldWidth', () => {
    const layout = computeLayout(NATIVE_WORLD_WIDTH, WORLD_HEIGHT);

    assert.equal(layout.topStrip.height, 0);
    assert.equal(layout.bottomStrip.height, 0);
    assert.equal(layout.band.width, NATIVE_WORLD_WIDTH);
    assert.equal(layout.band.height, WORLD_HEIGHT);
    assert.equal(layout.band.x, 0);
    assert.equal(layout.band.y, 0);
    assert.equal(layout.zoom, 1);
    assert.equal(layout.worldWidth, NATIVE_WORLD_WIDTH);
    assert.equal(layout.worldHeight, WORLD_HEIGHT);
    assertZoomMatchesBand(layout);
    assertBandWithinCanvas(layout);
    assertNoNegativesOrNaN(layout);
    assertWorldSizeInRange(layout);
  });

  void test('a 412x915 portrait phone (the reported too-small-play-area case) clamps to a square 640-wide world and a square band', () => {
    const layout = computeLayout(412, 915);

    assert.equal(layout.worldWidth, 640);
    assert.equal(layout.worldHeight, 640);
    // Width-limited: the band is exactly as wide as the canvas...
    assert.equal(layout.band.width, 412);
    // ...and square, since the world itself resolved to square.
    assert.ok(Math.abs(layout.band.width - layout.band.height) < EPS);
    assert.equal(layout.band.x, 0);

    assertZoomMatchesBand(layout);
    assertBandWithinCanvas(layout);
    assertNoNegativesOrNaN(layout);
    assertWorldSizeInRange(layout);
  });

  void test('portrait canvas (~0.46 aspect) clamps to a square world with two substantial strips', () => {
    const canvasWidth = 390;
    const canvasHeight = 844; // aspect ~0.462, typical phone portrait
    const layout = computeLayout(canvasWidth, canvasHeight);

    assert.equal(layout.worldWidth, 640);

    // Width-limited, square band: the band is exactly as wide as the canvas
    // and (since the world itself is square) exactly as tall as it is wide.
    assert.equal(layout.band.width, canvasWidth);
    assert.ok(Math.abs(layout.band.width - layout.band.height) < EPS);
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
    assertWorldSizeInRange(layout);
  });

  void test('a 1280x720 canvas resolves worldWidth to (almost) the native 1136 and the band nearly fills the canvas', () => {
    const layout = computeLayout(1280, 720);

    assert.equal(layout.worldWidth, NATIVE_WORLD_WIDTH);
    // canvasAspect (1.778) is only a hair past the native clamp (1.775), so
    // the band should fill almost the entire canvas in both axes -- nothing
    // like the old fixed-16:9 behaviour's big top/bottom strips would have
    // produced on a canvas this close to native.
    const widthGap = layout.canvasWidth - layout.band.width;
    const heightGap = layout.canvasHeight - layout.band.height;
    assert.ok(widthGap < 5, `band.width should nearly fill the canvas, got ${layout.band.width}`);
    assert.ok(heightGap < 5, `band.height should nearly fill the canvas, got ${layout.band.height}`);

    assertZoomMatchesBand(layout);
    assertBandWithinCanvas(layout);
    assertNoNegativesOrNaN(layout);
    assertWorldSizeInRange(layout);
  });

  void test('ultrawide canvas (2.5 aspect) clamps worldWidth to the native 1136 and letterboxes horizontally', () => {
    const canvasWidth = 1600;
    const canvasHeight = 640; // aspect 2.5
    const layout = computeLayout(canvasWidth, canvasHeight);

    assert.equal(layout.worldWidth, NATIVE_WORLD_WIDTH);

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
    assertWorldSizeInRange(layout);
  });

  void test('a 1:1 canvas resolves a square 640-wide world with a square, gapless band', () => {
    const layout = computeLayout(512, 512);

    assert.equal(layout.worldWidth, 640);
    assert.equal(layout.band.width, 512);
    assert.equal(layout.band.height, 512);
    assert.equal(layout.band.x, 0);
    assert.equal(layout.band.y, 0);
    assert.equal(layout.topStrip.height, 0);
    assert.equal(layout.bottomStrip.height, 0);
    assert.equal(layout.compact, true);

    assertZoomMatchesBand(layout);
    assertBandWithinCanvas(layout);
    assertNoNegativesOrNaN(layout);
    assertWorldSizeInRange(layout);
  });

  void test('compact flips at the ~56px strip threshold', () => {
    // A portrait canvas (width < height) always clamps to a square world
    // and a band exactly as wide as the canvas, so leftover = canvasHeight -
    // canvasWidth regardless of the specific width chosen -- topStripHeight
    // = leftover * 0.4 lands on the same round numbers as before.
    const width = 390;
    const belowThreshold = computeLayout(width, width + 139); // top = 55.6
    const atThreshold = computeLayout(width, width + 140); // top = 56 exactly
    const aboveThreshold = computeLayout(width, width + 141); // top = 56.4

    assert.equal(belowThreshold.compact, true);
    assert.equal(atThreshold.compact, false); // threshold is strictly "< 56"
    assert.equal(aboveThreshold.compact, false);

    for (const layout of [belowThreshold, atThreshold, aboveThreshold]) {
      assert.equal(layout.worldWidth, 640);
      assertZoomMatchesBand(layout);
      assertBandWithinCanvas(layout);
      assertNoNegativesOrNaN(layout);
      assertWorldSizeInRange(layout);
    }
  });

  void test('degenerate inputs never produce NaN or negative sizes, and default worldWidth/worldHeight to the square minimum', () => {
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
      assertWorldSizeInRange(layout);
      // Degenerate input means no usable band.
      assert.equal(layout.band.width, 0);
      assert.equal(layout.band.height, 0);
      assert.equal(layout.compact, true);
      // No canvas to resolve an aspect from -- defaults to the square
      // minimum rather than 0, so callers never divide by a zero worldWidth.
      assert.equal(layout.worldWidth, 640);
      assert.equal(layout.worldHeight, 640);
    }
  });

  void test('zoom is always consistent with band width', () => {
    const sizes: Array<[number, number]> = [
      [1136, 640],
      [412, 915],
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
      const layout = computeLayout(w, h);
      assertZoomMatchesBand(layout);
      assertWorldSizeInRange(layout);
    }
  });

  void test('band is always centered horizontally and vertically within its leftover space', () => {
    const sizes: Array<[number, number]> = [
      [412, 915],
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

  void test('worldWidth stays within [640, 1136] and worldHeight is always 640, across a wide range of canvases', () => {
    const sizes: Array<[number, number]> = [
      [1, 1],
      [100, 1000],
      [412, 915],
      [390, 844],
      [430, 932],
      [820, 1180],
      [1136, 640],
      [1280, 720],
      [1920, 1080],
      [512, 512],
      [1600, 640],
      [3440, 1440],
      [10000, 1],
    ];

    for (const [w, h] of sizes) {
      assertWorldSizeInRange(computeLayout(w, h));
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

  void test('scrolls so world (0,0) is the band top-left and (worldWidth,worldHeight) is the bottom-right, for a wide range of canvases', () => {
    const cases: Array<[number, number]> = [
      [1136, 640], // exact native
      [412, 915], // the reported problem case: portrait phone
      [390, 844], // portrait
      [1280, 720], // just past native, nearly fills
      [1600, 640], // ultrawide, clamps to native
      [512, 512], // square
      [3440, 1440], // extreme ultrawide
    ];

    for (const [w, h] of cases) {
      assertWorldMapsOntoBand(w, h);
    }
  });
});
