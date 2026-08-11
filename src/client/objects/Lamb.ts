import { GameObjects, Geom } from 'phaser';
import type { Scene, Tweens, Types } from 'phaser';
import { AtlasKeys, LambFrames } from '../core/assets';
import { localHitRect } from '../core/hitArea';
import { Gauge } from './Gauge';
import {
  LAMB_BODY_HEIGHT,
  LAMB_BODY_WIDTH,
  clampLambX,
  cocosYToDepth,
  computePatrolPlan,
  effectiveSpeedPerSec,
  flipY,
  localBodyPosition,
  type LambDirection,
  type PatrolStep,
} from './lambMath';

export type { LambDirection };
export type LambSkin = 'mine' | 'enemy';

/** The only piece of the stage/scene Lamb actually needs -- kept minimal so this class stays scene-agnostic. */
export interface LambStage {
  size: { width: number };
}

export interface LambOptions {
  scale: number;
  x: number;
  /** Cocos-space (y-up, measured from the bottom of the WORLD_HEIGHT-tall stage) spawn y. */
  y: number;
  patience: number;
  direction: LambDirection;
  speedPerSec: number;
  skin: LambSkin;
  stage: LambStage;
  /**
   * Sound key for speak()'s bleat effect. Taken as a dependency rather than
   * importing the audio module directly, so Lamb has no compile-time
   * dependency on how (or whether) sound is wired up -- keeps it testable
   * and decoupled.
   */
  bleatSoundKey: string;
}

const WALK_SWING_DURATION_MS = 600;
const STAND_DURATION_MS = 600;
const DIVE_DURATION_MS = 1400;
const DIVE_START_OFFSET = 700;
const DIE_DURATION_MS = 800;

/**
 * Port of _lamb_controller.coffee + lamb_node.coffee + gauge_node.coffee.
 * A Phaser Container assembling the lamb's body/legs/face/shadow from the
 * atlas, owning a Gauge, and driving its own patrol/walk/dive/die/speak
 * behaviour. Deliberately free of scene/stage/scoring logic -- see
 * lambMath.ts for the coordinate-system derivations this leans on.
 */
export class Lamb extends GameObjects.Container {
  readonly gauge: Gauge;

  patience: number;
  startedAt: number | null = null;
  override active = true;
  /** World-x lower bound for this lamb's own position (half its own width). */
  minimum = 0;
  /** World-x upper bound for this lamb's own position (stage width minus half its own width). */
  maximum = 0;

  private readonly options: LambOptions;
  private readonly stage: LambStage;
  private readonly bleatSoundKey: string;

  /** Mirrors lamb_node.coffee: the body/legs/face/shadow group, scaled and flipped independently of the Gauge. */
  private readonly bodyGroup: GameObjects.Container;
  private readonly legs: [
    GameObjects.Sprite,
    GameObjects.Sprite,
    GameObjects.Sprite,
    GameObjects.Sprite,
  ];
  private readonly face: GameObjects.Sprite;
  private shadow: GameObjects.Sprite;

  private direction: LambDirection;
  private speedPerSec: number;
  private moving = false;
  private walking = false;
  private speaking = false;
  private speakTimeout: ReturnType<typeof setTimeout> | null = null;

  private introTween: Tweens.TweenChain | null = null;
  private loopTween: Tweens.TweenChain | null = null;
  private legTweens: Tweens.Tween[] = [];

  constructor(scene: Scene, options: LambOptions) {
    super(scene, 0, 0);

    this.options = options;
    this.stage = options.stage;
    this.patience = options.patience;
    this.direction = options.direction;
    this.bleatSoundKey = options.bleatSoundKey;
    this.speedPerSec = options.speedPerSec;

    const skinKey = options.skin === 'enemy' ? AtlasKeys.EnemyLamb : AtlasKeys.Lamb;

    this.bodyGroup = new GameObjects.Container(scene, 0, 0);
    this.legs = this.buildLegs(skinKey);
    const frontBody = this.buildBodySprite(skinKey, LambFrames.BodyFront, 0, 70);
    const backBody = this.buildBodySprite(skinKey, LambFrames.BodyBack, 30, 55);
    this.face = this.buildBodySprite(skinKey, LambFrames.FaceIdle, 400, 250);
    this.shadow = this.buildBodySprite(skinKey, LambFrames.Shadow, 0, -30);

    // Back-to-front draw order mirrors lamb_node.coffee's z-indices exactly:
    // back_body (z0) and shadow (z0, added later so it draws on top of
    // back_body) sit behind the legs (z6..z9, leg3 furthest back), which sit
    // behind front_body (z10) and face (z11, frontmost).
    this.bodyGroup.add([
      backBody,
      this.shadow,
      this.legs[3],
      this.legs[2],
      this.legs[1],
      this.legs[0],
      frontBody,
      this.face,
    ]);

    this.gauge = new Gauge(scene, skinKey);

    this.add([this.bodyGroup, this.gauge]);

    this._setScale();
    this._setPosition();

    // onEnter: @lamb_node.attr y: 700 -- held above its resting spot,
    // waiting for dive() to drop it in. The +700 is cocos-local (y-up); once
    // flipped it's -700 (above, since Phaser-local "up" is negative y).
    this.bodyGroup.y = -DIVE_START_OFFSET;

    this.gauge.on('time-over', () => this.emit('time-over'));

    // The rect must be in Phaser's displayOrigin-shifted space, not plain
    // local space -- see core/hitArea.ts. Requires _setScale() to have run
    // already, since displayOrigin derives from setSize().
    this.setInteractive(
      localHitRect(this, -this.width / 2, -this.height, this.width, this.height),
      Geom.Rectangle.Contains
    );
    this.on('pointerdown', () => this.emit('tapped'));
  }

  /** LambController#start: shows + starts the gauge and begins the full-width patrol. */
  start(): void {
    if (!this.active) return;
    this.gauge.show();
    this.gauge.start(this.patience);
    this.moveAround(0, this.stage.size.width);
    this.startedAt = Date.now();
  }

  /**
   * Not a legacy concept -- legacy's stage width never changed underneath a
   * live round. Now that `core/layout.ts` resolves an adaptive `worldWidth`
   * that can shrink or grow on resize (rotating a phone mid-round), this
   * recomputes this lamb's horizontal clamp (`minimum`/`maximum`) for the
   * new `stageWidth`, snaps its own x back inside that range if it fell
   * outside, and -- only if it's actively patrolling -- restarts its
   * movement tweens toward the new bound from wherever it now is. A lamb
   * that isn't patrolling (still diving, already stopped/dead) just gets
   * its bounds refreshed for whenever it next calls `moveAround` itself.
   */
  rebound(stageWidth: number): void {
    const clamped = clampLambX(this.x, stageWidth, this.width);
    this.minimum = clamped.minimum;
    this.maximum = clamped.maximum;
    this.x = clamped.x;

    if (!this.moving) return;

    this.introTween?.stop();
    this.loopTween?.stop();
    this.introTween = null;
    this.loopTween = null;
    this.moving = false;
    this.moveAround(0, stageWidth);
  }

  /** LambController#reset: refreshes patience and restarts the gauge (used to recycle a lamb between rounds). */
  reset(patience: number): void {
    this.startedAt = Date.now();
    this.patience = patience;
    this.gauge.reset(patience);
  }

  /** LambController#stop: halts movement, walking, and the gauge; hides the gauge. */
  stop(): void {
    this.active = false;
    this.moving = false;
    this.introTween?.stop();
    this.loopTween?.stop();
    this.introTween = null;
    this.loopTween = null;
    this.stand();
    this.gauge.stop();
    this.gauge.hide();
  }

  /**
   * LambController#move_around: turn left, walk to `from`, turn right, walk
   * to `to`, forever -- with a one-off intro leg whose shape depends on the
   * lamb's starting direction (see computePatrolPlan for the exact legs).
   * The intro chain and the repeating loop chain mirror the legacy
   * init_animation / after_init_animation split exactly; Phaser's chained,
   * repeating tweens are close enough to cocos's action sequences that no
   * behavioural gap exists here.
   */
  moveAround(from: number, to: number): void {
    if (this.moving) return;
    this.moving = true;
    this.walk();

    const plan = computePatrolPlan({
      currentX: this.x,
      from,
      to,
      minimum: this.minimum,
      maximum: this.maximum,
      speedPerSec: this.speedPerSec,
      direction: this.direction,
    });

    const toTween = (step: PatrolStep): Types.Tweens.TweenBuilderConfig => ({
      targets: this,
      x: step.toX,
      duration: Math.max(0, step.durationSec * 1000),
      ease: 'Linear',
      onStart: () => this.setDirection(step.direction),
    });

    this.introTween = this.scene.tweens.chain({
      targets: this,
      tweens: plan.intro.map(toTween),
      onComplete: () => {
        this.loopTween = this.scene.tweens.chain({
          targets: this,
          tweens: plan.loop.map(toTween),
          repeat: -1,
        });
      },
    });
  }

  /**
   * LambNode#walk (via LambController#walk): all four legs swing between
   * angle 70 and 110. legs[0]/[2] and legs[1]/[3] are primed to opposite
   * starting angles so `yoyo: true, repeat: -1` oscillates exactly between
   * 70 and 110 with the two pairs opposed -- the natural Phaser expression
   * of cc.RepeatForever(rotateTo(0.6,70), rotateTo(0.6,110)) alternating
   * with its mirror. Note: this is a deliberate translation, not a literal
   * two-step port -- cocos's two independent one-way actions per cycle and
   * Phaser's single yoyo-ing tween happen to coincide for exactly two
   * endpoints, but wouldn't for three or more.
   */
  walk(): void {
    if (this.walking) return;
    this.walking = true;

    const [leg0, leg1, leg2, leg3] = this.legs;

    for (const leg of [leg0, leg2]) {
      leg.angle = 70;
      this.legTweens.push(
        this.scene.tweens.add({
          targets: leg,
          angle: 110,
          duration: WALK_SWING_DURATION_MS,
          ease: 'Linear',
          yoyo: true,
          repeat: -1,
        })
      );
    }

    for (const leg of [leg1, leg3]) {
      leg.angle = 110;
      this.legTweens.push(
        this.scene.tweens.add({
          targets: leg,
          angle: 70,
          duration: WALK_SWING_DURATION_MS,
          ease: 'Linear',
          yoyo: true,
          repeat: -1,
        })
      );
    }
  }

  /** LambNode#stop: returns all four legs to a neutral standing pose (angle 90) over 0.6s. */
  stand(): void {
    this.walking = false;
    for (const tween of this.legTweens) {
      tween.stop();
    }
    this.legTweens = [];

    for (const leg of this.legs) {
      this.scene.tweens.add({
        targets: leg,
        angle: 90,
        duration: STAND_DURATION_MS,
        ease: 'Linear',
      });
    }
  }

  /**
   * LambController#set_direction: flips the *body group's* scaleX only --
   * never the Gauge, and never the outer container -- so the gauge stays
   * unmirrored regardless of which way the lamb is facing.
   */
  setDirection(direction?: LambDirection): void {
    const resolved: LambDirection = direction ?? (Math.random() < 0.5 ? 'left' : 'right');
    const current: LambDirection = this.bodyGroup.scaleX > 0 ? 'right' : 'left';

    if (current !== resolved) {
      this.bodyGroup.scaleX *= -1;
    }

    this.direction = resolved;
  }

  /**
   * LambController#dive: drops the lamb in from above with a bounce, and
   * permanently reparents the shadow from the body group onto this
   * container (legacy never reparents it back). `bodyGroup.y` starts
   * negative (above rest) because Phaser-local "up" is negative y --
   * see the DIVE_START_OFFSET comment in the constructor.
   */
  dive(callback?: () => void): void {
    this.setDirection(this.options.direction);

    this.bodyGroup.remove(this.shadow, false);
    this.shadow.setOrigin(0.5, 0.5);
    this.shadow.setScale(0);
    const shadowPos = localBodyPosition(
      250 * this.options.scale,
      10 * this.options.scale,
      this.width
    );
    this.shadow.setPosition(shadowPos.x, shadowPos.y);
    this.add(this.shadow);

    this.bodyGroup.y = -DIVE_START_OFFSET;

    this.scene.tweens.add({
      targets: this.bodyGroup,
      y: 0,
      duration: DIVE_DURATION_MS,
      ease: 'Bounce.easeOut',
    });

    this.scene.tweens.add({
      targets: this.shadow,
      scale: this.options.scale,
      duration: DIVE_DURATION_MS,
      ease: 'Bounce.easeOut',
      onComplete: () => callback?.(),
    });
  }

  /** LambController#die: scales the body and shadow away, then destroys this lamb and calls back. */
  die(callback?: () => void): void {
    this.stop();
    this.gauge.hide();

    this.scene.tweens.add({
      targets: this.bodyGroup,
      scale: 0,
      duration: DIE_DURATION_MS,
      ease: 'Quad.easeIn',
    });

    this.scene.tweens.add({
      targets: this.shadow,
      scale: 0,
      duration: DIE_DURATION_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.destroy();
        callback?.();
      },
    });
  }

  /**
   * LambController#speak: swaps to the bleat face and plays the bleat sound
   * for 3s. Legacy never resets `speaking` or the face frame afterwards --
   * this is a deliberate one-shot-per-lamb faithful port of that quirk, not
   * an oversight.
   */
  speak(): void {
    if (this.speaking) return;
    this.speaking = true;

    // sound.add throws on a missing key, and speak() runs from the losing
    // path -- an undecodable asset must not turn a lost round into a crash.
    if (!this.scene.cache.audio.exists(this.bleatSoundKey)) return;
    const sound = this.scene.sound.add(this.bleatSoundKey);
    sound.play();
    this.speakTimeout = setTimeout(() => {
      sound.stop();
    }, 3000);

    this.face.setFrame(LambFrames.FaceBleat);
  }

  override destroy(fromScene?: boolean): void {
    if (this.speakTimeout) {
      clearTimeout(this.speakTimeout);
      this.speakTimeout = null;
    }
    this.introTween?.stop();
    this.loopTween?.stop();
    for (const tween of this.legTweens) {
      tween.stop();
    }
    super.destroy(fromScene);
  }

  /**
   * LambController#_set_scale: the body group (not the container, and not
   * the Gauge) is scaled by options.scale -- and critically, speed_per_sec
   * is *also* multiplied by options.scale, so smaller (further away) lambs
   * move slower. The Gauge keeps its own fixed 0.4 draw scale and is
   * repositioned above the now-scaled body.
   */
  private _setScale(): void {
    this.speedPerSec = effectiveSpeedPerSec(this.options.speedPerSec, this.options.scale);
    this.bodyGroup.setScale(this.options.scale);

    const width = Math.trunc(LAMB_BODY_WIDTH * this.options.scale);
    const height = Math.trunc(LAMB_BODY_HEIGHT * this.options.scale);
    this.setSize(width, height);

    const gaugePos = localBodyPosition(width / 2, height + 20, width);
    this.gauge.setPosition(gaugePos.x, gaugePos.y);
  }

  /**
   * LambController#_set_position: clamps x into [halfWidth, stageWidth -
   * halfWidth] (exposed as minimum/maximum) and converts the cocos-space y
   * into both this lamb's Phaser y and its depth -- see cocosYToDepth for
   * why "lower on screen draws in front" falls out of the same formula.
   */
  private _setPosition(): void {
    const clamped = clampLambX(this.options.x, this.stage.size.width, this.width);
    this.minimum = clamped.minimum;
    this.maximum = clamped.maximum;

    this.setPosition(clamped.x, flipY(this.options.y));
    this.setDepth(cocosYToDepth(this.options.y));
  }

  private buildLegs(
    textureKey: string
  ): [GameObjects.Sprite, GameObjects.Sprite, GameObjects.Sprite, GameObjects.Sprite] {
    return [
      this.buildLeg(textureKey, 360, 210),
      this.buildLeg(textureKey, 420, 210),
      this.buildLeg(textureKey, 90, 210),
      this.buildLeg(textureKey, 150, 210),
    ];
  }

  private buildLeg(textureKey: string, cocosX: number, cocosY: number): GameObjects.Sprite {
    const { x, y } = localBodyPosition(cocosX, cocosY, LAMB_BODY_WIDTH);
    const leg = new GameObjects.Sprite(this.scene, x, y, textureKey, LambFrames.Leg);
    // cocos anchor (0.09, 0.5) -> Phaser origin (0.09, 0.5): unchanged,
    // because 1 - 0.5 = 0.5. Rotation carries over unchanged too -- both
    // engines treat positive rotation as clockwise on screen -- so the
    // 70<->110 leg swing needs no sign flip anywhere. Deliberate, not an
    // oversight.
    leg.setOrigin(0.09, 0.5);
    leg.angle = 90;
    return leg;
  }

  private buildBodySprite(
    textureKey: string,
    frame: string,
    cocosX: number,
    cocosY: number
  ): GameObjects.Sprite {
    const { x, y } = localBodyPosition(cocosX, cocosY, LAMB_BODY_WIDTH);
    const sprite = new GameObjects.Sprite(this.scene, x, y, textureKey, frame);
    sprite.setOrigin(0, 1);
    return sprite;
  }
}
