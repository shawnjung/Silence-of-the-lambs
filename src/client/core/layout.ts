import type { Scene } from 'phaser';

/**
 * World design size. Mirrors WORLD_WIDTH/WORLD_HEIGHT in
 * `src/shared/api.ts` (the play camera always renders exactly this).
 *
 * Duplicated here rather than imported: this module (and its unit tests)
 * are executed directly by Node's native TypeScript loader
 * (`npm run test:unit`), which requires explicit `.ts` extensions on every
 * relative import in the whole module graph it loads, while the project's
 * tsc/Vite config expects the opposite (extensionless relative imports).
 * Keeping this leaf module import-free of the rest of `src/` sidesteps that
 * mismatch. If WORLD_WIDTH/WORLD_HEIGHT ever change, update both spots.
 */
const WORLD_WIDTH = 1136;
const WORLD_HEIGHT = 640;

/**
 * The world's native aspect ratio. All gameplay art and constants are tuned
 * for exactly WORLD_WIDTH x WORLD_HEIGHT (1136x640, 16:9-ish landscape).
 */
const WORLD_ASPECT = WORLD_WIDTH / WORLD_HEIGHT;

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
    zoom: 0,
    compact: true,
  };
}

/**
 * Computes the centered 16:9 play band plus the top/bottom HUD strips for a
 * given canvas size. Pure and side-effect free so it can be unit tested
 * without a running Phaser instance.
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

  // The band never exceeds the canvas in either axis: it's width-limited on
  // narrow/portrait canvases and height-limited on wide/ultrawide ones.
  const bandWidth = Math.min(width, height * WORLD_ASPECT);
  const bandHeight = bandWidth / WORLD_ASPECT;
  const zoom = bandWidth / WORLD_WIDTH;

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
    zoom,
    compact,
  };
}

/**
 * Applies a computed layout to a Phaser scene's main camera so that the
 * camera's viewport exactly covers the play band, and the visible world
 * rectangle is exactly (0, 0, WORLD_WIDTH, WORLD_HEIGHT) regardless of zoom.
 *
 * Phaser's `centerOn`/`scrollX` are defined in raw viewport pixels and are
 * NOT adjusted for zoom (see Phaser's Camera#preRender: `midX = scrollX +
 * width * 0.5`, then `worldView.x = midX - displayWidth / 2` where
 * `displayWidth = width / zoom`). Solving that for the scroll that puts
 * world (0,0) at the viewport's top-left gives:
 *
 *   scrollX = (WORLD_WIDTH  - band.width)  / 2
 *   scrollY = (WORLD_HEIGHT - band.height) / 2
 *
 * which collapses to 0 when band.width/height already equal the world size
 * (zoom 1), and shifts outward symmetrically otherwise.
 */
export function applyPlayCamera(scene: Scene, layout: Layout): void {
  const cam = scene.cameras.main;
  const { band, zoom } = layout;

  cam.setViewport(band.x, band.y, band.width, band.height);
  cam.setZoom(zoom > 0 ? zoom : 1);
  cam.setScroll(
    (WORLD_WIDTH - band.width) / 2,
    (WORLD_HEIGHT - band.height) / 2
  );
}

/**
 * `computeLayout` + `applyPlayCamera` for the scene's current canvas size,
 * returning the resulting `Layout#zoom` (or 1 if the band is degenerate) --
 * the "base" zoom callers need to remember so a temporary zoom (see
 * `stage/cameraZoom.ts`'s `zoomOnLoss`) has something to multiply against
 * and `applyBaseCameraToScene` has something to restore back to on the next
 * resize or scene entry. Shared by `ScoreStage` and `PvpStage`, which are
 * otherwise identical on this one point.
 */
export function applyBaseCameraToScene(scene: Scene): number {
  const layout = computeLayout(scene.scale.width, scene.scale.height);
  applyPlayCamera(scene, layout);
  return layout.zoom > 0 ? layout.zoom : 1;
}
