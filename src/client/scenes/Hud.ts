import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { computeLayout, type Layout, type Rect } from '../core/layout';

export type OpponentInfo = { username: string; danger: number };

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const PANEL_FILL = 0x0c1220;
const PANEL_FILL_ALPHA = 0.72;
const PANEL_STROKE = 0xffffff;
const PANEL_STROKE_ALPHA = 0.08;
const PANEL_RADIUS = 14;

const TEXT_PRIMARY = '#f5f7fa';
const TEXT_MUTED = '#9aa5b1';

const DANGER_TRACK_FILL = 0x1b2330;
const DANGER_LOW_COLOR = 0x3ddc84;
const DANGER_HIGH_COLOR = 0xff4d4f;

const BUTTON_FILL = 0x151d2b;
const BUTTON_FILL_HOVER = 0x223047;
const BUTTON_RADIUS = 10;

const PADDING = 16;
const COMPACT_PADDING = 8;

/** Blends DANGER_LOW_COLOR -> DANGER_HIGH_COLOR as `fraction` goes 0 -> 1. */
function dangerColor(fraction: number): number {
  const t = Phaser.Math.Clamp(fraction, 0, 1);
  const from = Phaser.Display.Color.ValueToColor(DANGER_LOW_COLOR);
  const to = Phaser.Display.Color.ValueToColor(DANGER_HIGH_COLOR);
  const blended = Phaser.Display.Color.Interpolate.ColorWithColor(
    from,
    to,
    100,
    t * 100
  );
  return Phaser.Display.Color.GetColor(blended.r, blended.g, blended.b);
}

/** A drawn rounded panel plus a same-size interactive hit zone. */
type ButtonHandle = {
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Text;
  redraw: (hover: boolean) => void;
};

/**
 * Full-canvas overlay HUD: score, danger meter, mute/back buttons, and an
 * optional PvP opponent readout. Runs in parallel with the play scene (it is
 * `scene.launch`-ed, never `scene.start`-ed) so its own camera is left at
 * the default full-canvas viewport/zoom — only the play scene's camera gets
 * the letterboxed `computeLayout` band treatment (see core/layout.ts).
 *
 * All content is positioned in the same canvas-pixel space `computeLayout`
 * uses, which lines up 1:1 with this scene's untouched camera.
 */
export class Hud extends Scene {
  // ---- Buffered state. Setters below may be called before create() runs
  // (scenes launched in parallel race), so every value is cached here and
  // (re)applied to the live display objects once they exist. ----
  private score = 0;
  private dangerFraction = 0;
  private opponent: OpponentInfo | null = null;
  private muted = false;

  private backCb: (() => void) | null = null;
  private muteToggleCb: (() => void) | null = null;

  private created = false;

  // Live display objects for the current layout pass. Torn down and
  // rebuilt whenever the layout mode (normal strips vs. compact overlay)
  // or canvas size changes, then re-synced with the buffered state above.
  private liveObjects: Phaser.GameObjects.GameObject[] = [];
  private scoreValueText: Phaser.GameObjects.Text | undefined = undefined;
  private dangerFill: Phaser.GameObjects.Rectangle | undefined = undefined;
  private dangerTrackWidth = 0;
  private dangerTrackX = 0;
  private dangerTrackY = 0;
  private dangerTrackHeight = 0;
  private opponentRoot: Phaser.GameObjects.Container | undefined = undefined;
  private opponentNameText: Phaser.GameObjects.Text | undefined = undefined;
  private opponentFill: Phaser.GameObjects.Rectangle | undefined = undefined;
  private opponentTrackWidth = 0;
  private muteButton: ButtonHandle | undefined = undefined;

  private readonly onScaleResize = (): void => this.relayout();

  constructor() {
    super('Hud');
  }

  create(): void {
    this.created = true;

    this.relayout();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onScaleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onScaleResize);
    this.created = false;
  }

  // ---------------------------------------------------------------- API --

  setScore(n: number): void {
    this.score = n;
    if (this.scoreValueText) {
      // TODO: once core/assets.ts finishes loading the `numbers` bitmap
      // font, swap this plain Text readout for a BitmapText using it.
      this.scoreValueText.setText(Math.max(0, Math.floor(n)).toString());
    }
  }

  setDanger(fraction: number): void {
    this.dangerFraction = Phaser.Math.Clamp(fraction, 0, 1);
    this.applyDangerFill();
  }

  setOpponent(info: OpponentInfo | null): void {
    this.opponent = info;
    this.applyOpponent();
  }

  onBack(cb: () => void): void {
    this.backCb = cb;
  }

  onMuteToggle(cb: () => void): void {
    this.muteToggleCb = cb;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.muteButton) {
      this.muteButton.icon.setText(muted ? '🔇' : '🔊');
    }
  }

  // ------------------------------------------------------------ layout --

  private relayout(): void {
    if (!this.created) return;

    for (const obj of this.liveObjects) obj.destroy();
    this.liveObjects = [];
    this.scoreValueText = undefined;
    this.dangerFill = undefined;
    this.opponentRoot = undefined;
    this.opponentNameText = undefined;
    this.opponentFill = undefined;
    this.muteButton = undefined;

    const layout = computeLayout(this.scale.width, this.scale.height);

    if (layout.compact) {
      this.buildCompact(layout);
    } else {
      this.buildStrips(layout);
    }

    // Re-sync freshly built display objects with the buffered state.
    this.setScore(this.score);
    this.applyDangerFill();
    this.applyOpponent();
    this.setMuted(this.muted);
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.liveObjects.push(obj);
    return obj;
  }

  /** Normal layout: HUD content lives in the top/bottom strips. */
  private buildStrips(layout: Layout): void {
    const { topStrip, bottomStrip } = layout;

    if (topStrip.height > 0) {
      this.drawPanel(topStrip);
      this.buildScore(topStrip.x + PADDING, topStrip.height / 2, 'left');
      this.buildOpponentSlot(
        topStrip.x + topStrip.width - PADDING,
        topStrip.height / 2
      );
    }

    if (bottomStrip.height > 0) {
      this.drawPanel(bottomStrip);

      const buttonSize = Math.min(48, bottomStrip.height - 16);
      const backX = bottomStrip.x + bottomStrip.width - PADDING - buttonSize / 2;
      const muteX = backX - buttonSize - 12;
      const buttonY = bottomStrip.y + bottomStrip.height / 2;

      this.buildButton(backX, buttonY, buttonSize, '←', () => this.backCb?.());
      this.muteButton = this.buildButton(muteX, buttonY, buttonSize, '🔊', () =>
        this.muteToggleCb?.()
      );

      const meterLeft = bottomStrip.x + PADDING;
      const meterRight = muteX - buttonSize / 2 - 20;
      this.buildDangerMeter(
        meterLeft,
        bottomStrip.y + bottomStrip.height / 2,
        Math.max(40, meterRight - meterLeft)
      );
    }
  }

  /**
   * Compact layout: strips are too thin for real content, so HUD chips
   * overlay the band's corners instead. Score top-left, opponent top-right,
   * danger meter bottom-left, mute/back bottom-right.
   */
  private buildCompact(layout: Layout): void {
    const { band } = layout;
    const pad = COMPACT_PADDING;

    this.buildScore(band.x + pad, band.y + pad + 14, 'left', true);
    this.buildOpponentSlot(band.x + band.width - pad, band.y + pad + 14, true);

    const buttonSize = 36;
    const backX = band.x + band.width - pad - buttonSize / 2;
    const muteX = backX - buttonSize - 8;
    const buttonY = band.y + band.height - pad - buttonSize / 2;

    this.buildButton(backX, buttonY, buttonSize, '←', () => this.backCb?.());
    this.muteButton = this.buildButton(muteX, buttonY, buttonSize, '🔊', () =>
      this.muteToggleCb?.()
    );

    const meterWidth = Math.max(60, band.width * 0.3);
    this.buildDangerMeter(
      band.x + pad,
      band.y + band.height - pad - 10,
      meterWidth,
      true
    );
  }

  private drawPanel(rect: Rect): void {
    const g = this.track(this.add.graphics());
    g.fillStyle(PANEL_FILL, PANEL_FILL_ALPHA);
    g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, PANEL_RADIUS);
    g.lineStyle(1, PANEL_STROKE, PANEL_STROKE_ALPHA);
    g.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, PANEL_RADIUS);
  }

  private buildScore(
    x: number,
    y: number,
    align: 'left' | 'right',
    compact = false
  ): void {
    const originX = align === 'left' ? 0 : 1;

    if (!compact) {
      const label = this.track(
        this.add.text(x, y - 16, 'SCORE', {
          fontFamily: FONT_STACK,
          fontSize: '13px',
          color: TEXT_MUTED,
          fontStyle: '600',
        })
      );
      label.setOrigin(originX, 0.5);
      label.setLetterSpacing(1.5);
    }

    // TODO: swap this Text readout for a BitmapText using the `numbers`
    // bitmap font once core/assets.ts + Preloader finish loading it.
    this.scoreValueText = this.track(
      this.add.text(x, y + (compact ? 0 : 10), '0', {
        fontFamily: FONT_STACK,
        fontSize: compact ? '18px' : '26px',
        color: TEXT_PRIMARY,
        fontStyle: '700',
      })
    ) as Phaser.GameObjects.Text;
    this.scoreValueText.setOrigin(originX, 0.5);
  }

  private buildOpponentSlot(x: number, y: number, compact = false): void {
    const container = this.track(this.add.container(x, y));
    this.opponentRoot = container as Phaser.GameObjects.Container;

    const nameText = this.add.text(0, compact ? 0 : -16, '', {
      fontFamily: FONT_STACK,
      fontSize: compact ? '13px' : '15px',
      color: TEXT_PRIMARY,
      fontStyle: '600',
    });
    nameText.setOrigin(1, 0.5);
    container.add(nameText);
    this.opponentNameText = nameText;

    const trackWidth = compact ? 60 : 100;
    const trackHeight = 6;
    const trackY = compact ? 12 : 8;

    const track = this.add.rectangle(
      -trackWidth,
      trackY,
      trackWidth,
      trackHeight,
      DANGER_TRACK_FILL
    );
    track.setOrigin(0, 0.5);
    container.add(track);

    const fill = this.add.rectangle(
      -trackWidth,
      trackY,
      0,
      trackHeight,
      DANGER_LOW_COLOR
    );
    fill.setOrigin(0, 0.5);
    container.add(fill);

    this.opponentFill = fill;
    this.opponentTrackWidth = trackWidth;

    container.setVisible(this.opponent !== null);
  }

  private buildDangerMeter(
    x: number,
    y: number,
    width: number,
    compact = false
  ): void {
    if (!compact) {
      const label = this.track(
        this.add.text(x, y - 18, 'DANGER', {
          fontFamily: FONT_STACK,
          fontSize: '12px',
          color: TEXT_MUTED,
          fontStyle: '600',
        })
      );
      label.setOrigin(0, 0.5);
      label.setLetterSpacing(1.5);
    }

    const height = compact ? 8 : 12;

    const track = this.track(
      this.add.rectangle(x, y, width, height, DANGER_TRACK_FILL)
    ) as Phaser.GameObjects.Rectangle;
    track.setOrigin(0, 0.5);

    const fill = this.track(
      this.add.rectangle(x, y, 0, height, dangerColor(0))
    ) as Phaser.GameObjects.Rectangle;
    fill.setOrigin(0, 0.5);

    this.dangerFill = fill;
    this.dangerTrackX = x;
    this.dangerTrackY = y;
    this.dangerTrackWidth = width;
    this.dangerTrackHeight = height;
  }

  private buildButton(
    x: number,
    y: number,
    size: number,
    label: string,
    onClick: () => void
  ): ButtonHandle {
    const half = size / 2;
    const bg = this.track(this.add.graphics({ x, y }));

    const redraw = (hover: boolean): void => {
      bg.clear();
      bg.fillStyle(hover ? BUTTON_FILL_HOVER : BUTTON_FILL, 0.85);
      bg.fillRoundedRect(-half, -half, size, size, BUTTON_RADIUS);
      bg.lineStyle(1, PANEL_STROKE, PANEL_STROKE_ALPHA);
      bg.strokeRoundedRect(-half, -half, size, size, BUTTON_RADIUS);
    };
    redraw(false);

    const icon = this.track(
      this.add.text(x, y, label, {
        fontFamily: FONT_STACK,
        fontSize: `${Math.round(size * 0.45)}px`,
        color: TEXT_PRIMARY,
      })
    ) as Phaser.GameObjects.Text;
    icon.setOrigin(0.5, 0.5);

    bg.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-half, -half, size, size),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    bg.on('pointerover', () => redraw(true));
    bg.on('pointerout', () => redraw(false));
    bg.on('pointerdown', () => onClick());

    return { bg, icon, redraw };
  }

  // ------------------------------------------------------------- apply --

  private applyDangerFill(): void {
    if (!this.dangerFill) return;
    const width = this.dangerTrackWidth * this.dangerFraction;
    this.dangerFill.setSize(width, this.dangerTrackHeight);
    this.dangerFill.setFillStyle(dangerColor(this.dangerFraction));
    this.dangerFill.setPosition(this.dangerTrackX, this.dangerTrackY);
  }

  private applyOpponent(): void {
    if (!this.opponentRoot) return;

    const visible = this.opponent !== null;
    this.opponentRoot.setVisible(visible);
    if (!visible) return;

    const info = this.opponent as OpponentInfo;
    this.opponentNameText?.setText(info.username);
    if (this.opponentFill) {
      const fraction = Phaser.Math.Clamp(info.danger, 0, 1);
      this.opponentFill.setSize(
        this.opponentTrackWidth * fraction,
        this.opponentFill.height
      );
      this.opponentFill.setFillStyle(dangerColor(fraction));
    }
  }
}
