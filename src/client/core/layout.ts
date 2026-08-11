import type { Scene } from 'phaser';

/**
 * World design height. Mirrors WORLD_HEIGHT in `src/shared/api.ts` (the play
 * camera always renders exactly this many world px vertically). NEVER
 * changes -- every tuned gameplay constant (y_lines, the depth scale, gauge
 * offsets, speed_per_sec) is authored against exactly this height.
 *
 * World *width*, unlike height, is adaptive -- see `computeLayout`'s own
 * doc comment for the full story. `NATIVE_WORLD_WIDTH` below is only the
 * upper bound that width can resolve to.
 *
 * Duplicated here rather than imported: this module (and its unit tests)
 * are executed directly by Node's native TypeScript loader
 * (`npm run test:unit`), which requires explicit `.ts` extensions on every
 * relative import in the whole module graph it loads, while the project's
 * tsc/Vite config expects the opposite (extensionless relative imports).
 * Keeping this leaf module import-free of the rest of `src/` sidesteps that
 * mismatch. If WORLD_WIDTH/WORLD_HEIGHT ever change, update both spots.
 */
const WORLD_HEIGHT = 640;

/**
 * The world's native, maximum aspect ratio -- 1136x640, 16:9-ish landscape.
 * All gameplay art is authored at exactly this size; a resolved `worldWidth`
 * never exceeds `NATIVE_WORLD_WIDTH` (so every background image, authored at
 * this size, always covers the world with plain centering -- see
 * `computeLayout`'s doc comment).
 */
const NATIVE_WORLD_WIDTH = 1136;
const MAX_WORLD_ASPECT = NATIVE_WORLD_WIDTH / WORLD_HEIGHT;

/** The narrowest the world (and its play band) is ever allowed to go: square. */
const MIN_WORLD_ASPECT = 1;

/**
 * Leftover vertical space (canvasHeight - band.height) is split between the
 * top and bottom strips using this ratio. The bottom strip gets the larger
 * share because on phones the thumbs and primary tap targets live at the
 * bottom of the screen (within easy reach), while the top strip only needs
 * to hold glanceable readouts (score, opponent info).
 */
const TOP_STRIP_RATIO = 0.4;
const BOTTOM_STRIP_RATIO = 1 - TOP_STRIP_RATIO;

/**
 * Below this height (in canvas px) a strip is considered too short to hold
 * real HUD content (a button, a label, a bar all need vertical room to
 * breathe). When either strip dips below this, `compact` flips true and the
 * caller should overlay HUD content on the band's corners instead.
 */
const COMPACT_STRIP_THRESHOLD = 56;

export type Rect = { x: number; y: number; width: number; height: number };

export type Layout = {
  canvasWidth: number;
  canvasHeight: number;
  band: Rect;
  topStrip: Rect;
  bottomStrip: Rect;
  /**
   * The resolved world width this layout's band maps to horizontally --
   * adaptive, always in [640, 1136] (see `computeLayout`). Callers that used
   * to assume a fixed 1136-wide world (lamb patrol bounds, spawn-x
   * distribution, centered art, menu button placement, ending banners) must
   * use this instead.
   */
  worldWidth: number;
  /** The world height this layout's band maps to vertically -- always 640, exposed for symmetry with `worldWidth`. */
  worldHeight: number;
  /** world px -> canvas px */
  zoom: number;
  /** true when strips are too short to hold HUD content and it must overlay the band instead */
  compact: boolean;
};

function emptyLayout(canvasWidth: number, canvasHeight: number): Layout {
  return {
    canvasWidth,
    canvasHeight,
    band: { x: 0, y: 0, width: 0, height: 0 },
    topStrip: { x: 0, y: 0, width: canvasWidth, height: 0 },
    bottomStrip: { x: 0, y: canvasHeight, width: canvasWidth, height: 0 },
    // No usable canvas means no meaningful aspect to resolve -- default to
    // the square minimum rather than 0, so a degenerate layout never forces
    // a caller to guard against a divide-by-zero of its own.
    worldWidth: WORLD_HEIGHT,
    worldHeight: WORLD_HEIGHT,
    zoom: 0,
    compact: true,
  };
}

/**
 * Computes the centered play band plus the top/bottom HUD strips for a given
 * canvas size.
 *
 * The band's aspect ratio -- and therefore the world's own width -- adapts
 * to the canvas instead of being locked to the native 1136x640 (16:9-ish):
 *
 *   playAspect = clamp(canvasW / canvasH, 1.0, 1136/640)
 *   worldWidth = round(640 * playAspect)   // 640 (square) .. 1136 (native)
 *   worldHeight = 640                      // NEVER changes
 *
 * On a portrait phone this yields a square world (worldWidth 640) --
 * dramatically more play area than a fixed 16:9 band would letterbox down
 * to. On a wide/landscape canvas it opens back out toward the native 1136,
 * exactly reproducing the old fixed behaviour once canvasW/canvasH >= 1136/640
 * (see the ultrawide case below, and the exact-16:9 case, both unchanged).
 *
 * Background art is authored at exactly 1136x640 -- since worldWidth never
 * exceeds that, every resolved world is coverable by simply centering that
 * art (a horizontal crop, never a gap or a scale) -- see callers in
 * ScoreStage/PvpStage.
 *
 * Pure and side-effect free so it can be unit tested without a running
 * Phaser instance.
 */
export function computeLayout(
  canvasWidth: number,
  canvasHeight: number
): Layout {
  const width =
    Number.isFinite(canvasWidth) && canvasWidth > 0 ? canvasWidth : 0;
  const height =
    Number.isFinite(canvasHeight) && canvasHeight > 0 ? canvasHeight : 0;

  if (width === 0 || height === 0) {
    return emptyLayout(width, height);
  }

  const canvasAspect = width / height;
  const playAspect = Math.min(
    Math.max(canvasAspect, MIN_WORLD_ASPECT),
    MAX_WORLD_ASPECT
  );

  // Rounded to a whole px -- world width is a design size lambs/backgrounds
  // measure themselves against, not a raw camera-fit number.
  const worldWidth = Math.round(WORLD_HEIGHT * playAspect);
  // Re-derive the aspect from the *rounded* worldWidth (rather than reusing
  // `playAspect` directly) so `zoom * worldWidth === band.width` holds
  // exactly -- see assertZoomMatchesBand in layout.test.ts.
  const worldAspect = worldWidth / WORLD_HEIGHT;

  // The band never exceeds the canvas in either axis: it's width-limited on
  // narrow/portrait canvases and height-limited on wide/ultrawide ones.
  const bandWidth = Math.min(width, height * worldAspect);
  const bandHeight = bandWidth / worldAspect;
  const zoom = bandWidth / worldWidth;

  const bandX = (width - bandWidth) / 2;

  // Guard against floating point putting bandHeight a hair over height.
  const leftover = Math.max(0, height - bandHeight);
  const topStripHeight = leftover * TOP_STRIP_RATIO;
  const bottomStripHeight = leftover * BOTTOM_STRIP_RATIO;

  const bandY = topStripHeight;

  const compact =
    Math.min(topStripHeight, bottomStripHeight) < COMPACT_STRIP_THRESHOLD;

  return {
    canvasWidth: width,
    canvasHeight: height,
    band: { x: bandX, y: bandY, width: bandWidth, height: bandHeight },
    topStrip: { x: 0, y: 0, width, height: topStripHeight },
    bottomStrip: {
      x: 0,
      y: height - bottomStripHeight,
      width,
      height: bottomStripHeight,
    },
    worldWidth,
    worldHeight: WORLD_HEIGHT,
    zoom,
    compact,
  };
}

/** The sliver of a Phaser Camera `applyLayoutToCamera` actually needs -- kept minimal so it can target either `scene.cameras.main` or a second, added camera without depending on the full Camera type. */
export type LayoutCamera = {
  setViewport(x: number, y: number, width: number, height: number): unknown;
  setZoom(zoom: number): unknown;
  setScroll(x: number, y: number): unknown;
};

/**
 * Applies a computed layout to any Phaser camera so that the camera's
 * viewport exactly covers the play band, and the visible world rectangle is
 * exactly (0, 0, layout.worldWidth, layout.worldHeight) regardless of zoom.
 *
 * Phaser's `centerOn`/`scrollX` are defined in raw viewport pixels and are
 * NOT adjusted for zoom (see Phaser's Camera#preRender: `midX = scrollX +
 * width * 0.5`, then `worldView.x = midX - displayWidth / 2` where
 * `displayWidth = width / zoom`). Solving that for the scroll that puts
 * world (0,0) at the viewport's top-left gives:
 *
 *   scrollX = (worldWidth  - band.width)  / 2
 *   scrollY = (worldHeight - band.height) / 2
 *
 * which collapses to 0 when band.width/height already equal the world size
 * (zoom 1), and shifts outward symmetrically otherwise.
 *
 * Shared by `applyPlayCamera` (the scene's main camera) and by any second,
 * unzoomed UI camera a stage scene adds over the same band (see
 * `stage/cameraZoom.ts`'s header on why the zoom-on-loss pan/zoom must only
 * ever touch the main camera, never this one).
 */
export function applyLayoutToCamera(camera: LayoutCamera, layout: Layout): void {
  const { band, zoom, worldWidth, worldHeight } = layout;

  camera.setViewport(band.x, band.y, band.width, band.height);
  camera.setZoom(zoom > 0 ? zoom : 1);
  camera.setScroll(
    (worldWidth - band.width) / 2,
    (worldHeight - band.height) / 2
  );
}

/** `applyLayoutToCamera` for `scene.cameras.main` specifically -- the common case every scene wants. */
export function applyPlayCamera(scene: Scene, layout: Layout): void {
  applyLayoutToCamera(scene.cameras.main, layout);
}

/**
 * The letterboxed base geometry callers need to remember after laying out a
 * scene's main camera: `zoom` -- normalized to 1 if the band is degenerate --
 * is what a temporary zoom (see `stage/cameraZoom.ts`'s `zoomOnLoss`) has to
 * multiply against and what `applyBaseCameraToScene` restores back to on the
 * next resize or scene entry; `worldWidth` is the resolved world width
 * anything positioned/bounded in world space (lamb patrol bounds, spawn-x
 * distribution, centered art) must use instead of a fixed constant.
 */
export type BaseCameraLayout = { zoom: number; worldWidth: number };

/**
 * `computeLayout` + `applyPlayCamera` for the scene's current canvas size.
 * Shared by every scene that only ever needs a single (main) camera treated
 * this way -- `PvpLanding`, and (via their own richer camera setup) the
 * `zoom`/`worldWidth` bookkeeping `ScoreStage` and `PvpStage` also lean on.
 */
export function applyBaseCameraToScene(scene: Scene): BaseCameraLayout {
  const layout = computeLayout(scene.scale.width, scene.scale.height);
  applyPlayCamera(scene, layout);
  return {
    zoom: layout.zoom > 0 ? layout.zoom : 1,
    worldWidth: layout.worldWidth,
  };
}
