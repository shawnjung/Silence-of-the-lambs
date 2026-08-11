/**
 * Pure, engine-free geometry for `MainMenu`'s Score/PvP button pair --
 * isolated here (mirrors `core/layout.ts`/`objects/lambMath.ts`'s own
 * leaf-module convention) so the reflow decision (side-by-side vs. stacked)
 * can be unit tested without booting Phaser. `MainMenu.ts` is the only
 * caller and owns all the Phaser-side rendering (sprites, tweens, origins);
 * this module only ever answers "where do the two buttons go for this
 * worldWidth".
 *
 * Why this exists at all: legacy's fixed 1136-wide world let both buttons
 * sit side-by-side unconditionally (`landing_scene.coffee`'s cocos x =
 * width/2 -410 and +14). Now that `core/layout.ts` resolves an adaptive
 * `worldWidth` that can shrink to 640 (a portrait phone), 820px of button-
 * plus-gap plus margin no longer fits -- so below a width threshold the
 * buttons stack vertically instead, both centered on worldWidth/2.
 */

/** Sprite sheet size of both btn/score and btn/pvp (landing.json) -- identical for both frames. */
export const MENU_BUTTON_WIDTH = 396;
export const MENU_BUTTON_HEIGHT = 88;

/**
 * Horizontal gap between the two buttons in row mode. Chosen so row mode's
 * placement at worldWidth === 1136 reproduces legacy's exact fixed offsets:
 * buttonWidth(396) + gap/2(14) === 410, the magic offset `landing_scene.coffee`
 * itself used.
 */
const ROW_GAP = 28;
/** Vertical gap between the two buttons in column mode. */
const COLUMN_GAP = 20;
/** Minimum breathing room on either side of the row before it's cramped enough to prefer stacking instead. */
const ROW_SIDE_MARGIN = 24;

export type MenuButtonMode = 'row' | 'column';

export type MenuButtonPlacement = {
  mode: MenuButtonMode;
  /** left-edge x, baseline y -- matches MainMenu's existing sprite origin (0, flipOriginY(0)). */
  score: { x: number; y: number };
  pvp: { x: number; y: number };
  /**
   * Top edge of whichever button sits highest. The title has to clear this:
   * stacking pushes the upper button into the space the title occupied at the
   * legacy fixed position, and the two collided.
   */
  blockTopY: number;
};

/**
 * Row mode needs both buttons plus the gap between them plus a margin on
 * each side to not feel cramped against the world edges; anything narrower
 * stacks instead.
 */
export function decideMenuButtonMode(
  worldWidth: number,
  buttonWidth: number = MENU_BUTTON_WIDTH,
  gap: number = ROW_GAP,
  sideMargin: number = ROW_SIDE_MARGIN
): MenuButtonMode {
  const rowWidth = buttonWidth * 2 + gap + sideMargin * 2;
  return worldWidth >= rowWidth ? 'row' : 'column';
}

/**
 * Resolves both buttons' Phaser-space (origin (0, baseline)) positions for
 * `worldWidth`, given the shared baseline y row mode uses (cocos y=70,
 * already flipped to Phaser space by the caller -- see MainMenu's own
 * `flipY(70)`).
 *
 * Row mode centers the pair on worldWidth/2, exactly reproducing legacy's
 * fixed offsets when worldWidth === 1136 (see ROW_GAP's own comment).
 * Column mode stacks Score above PvP, both centered horizontally, with PvP
 * kept at the same baseline row mode would have used (so the primary
 * "start playing" tap target lands in the same spot regardless of mode).
 */
export function computeMenuButtonPlacement(
  worldWidth: number,
  baselineY: number,
  buttonWidth: number = MENU_BUTTON_WIDTH,
  buttonHeight: number = MENU_BUTTON_HEIGHT,
  rowGap: number = ROW_GAP,
  columnGap: number = COLUMN_GAP
): MenuButtonPlacement {
  const mode = decideMenuButtonMode(worldWidth, buttonWidth, rowGap);

  if (mode === 'row') {
    const leftX = worldWidth / 2 - buttonWidth - rowGap / 2;
    const rightX = worldWidth / 2 + rowGap / 2;
    return {
      mode,
      score: { x: leftX, y: baselineY },
      pvp: { x: rightX, y: baselineY },
      blockTopY: baselineY - buttonHeight,
    };
  }

  const centerX = worldWidth / 2 - buttonWidth / 2;
  const scoreY = baselineY - buttonHeight - columnGap;
  return {
    mode,
    score: { x: centerX, y: scoreY },
    pvp: { x: centerX, y: baselineY },
    blockTopY: scoreY - buttonHeight,
  };
}
