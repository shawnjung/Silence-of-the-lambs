/**
 * Single source of truth for every asset key and atlas frame name the client
 * loads. Nothing outside Boot/Preloader should reference a raw string for a
 * texture, atlas, bitmap font, or audio key — import from here instead so a
 * rename or a legacy-rect correction only has to happen in one place.
 */

/** Absolute (client-root-relative) URLs, matching how Vite emits `public/`. */
const SPRITES = '/assets/sprites';
const BACKGROUNDS = '/assets/backgrounds';
const AUDIO = '/assets/audio';

// -- Loader keys --------------------------------------------------------

export const ImageKeys = {
  Grass: 'grass',
  LandingBg: 'landing-bg',
  PvpLandingBg: 'pvp-landing-bg',
} as const;

export const AtlasKeys = {
  Lamb: 'lamb',
  EnemyLamb: 'enermy-lamb',
  Landing: 'landing',
  PvpLanding: 'pvp-landing',
  EndingMessages: 'ending-messages',
} as const;

export const BitmapFontKeys = {
  Numbers: 'numbers',
} as const;

export const AudioKeys = {
  Music: 'music',
  Effects: 'effects',
  Tap: 'tap',
} as const;

// -- Loader URLs ---------------------------------------------------------

export const AssetUrls = {
  [ImageKeys.Grass]: `${BACKGROUNDS}/grass.png`,
  [ImageKeys.LandingBg]: `${BACKGROUNDS}/landing.png`,
  [ImageKeys.PvpLandingBg]: `${BACKGROUNDS}/pvp-landing.png`,

  [AtlasKeys.Lamb]: {
    texture: `${SPRITES}/lamb.png`,
    atlas: `${SPRITES}/lamb.json`,
  },
  [AtlasKeys.EnemyLamb]: {
    texture: `${SPRITES}/enermy-lamb.png`,
    atlas: `${SPRITES}/enermy-lamb.json`,
  },
  [AtlasKeys.Landing]: {
    texture: `${SPRITES}/landing.png`,
    atlas: `${SPRITES}/landing.json`,
  },
  [AtlasKeys.PvpLanding]: {
    texture: `${SPRITES}/pvp-landing.png`,
    atlas: `${SPRITES}/pvp-landing.json`,
  },
  [AtlasKeys.EndingMessages]: {
    texture: `${SPRITES}/ending-messages.png`,
    atlas: `${SPRITES}/ending-messages.json`,
  },

  [BitmapFontKeys.Numbers]: {
    texture: `${SPRITES}/numbers.png`,
    xml: `${SPRITES}/numbers.xml`,
  },

  [AudioKeys.Music]: `${AUDIO}/music.m4a`,
  [AudioKeys.Effects]: `${AUDIO}/effects.m4a`,
  [AudioKeys.Tap]: `${AUDIO}/tap.m4a`,
} as const;

// -- Atlas frame names ----------------------------------------------------
// Shared by lamb + enermy-lamb — both sheets use identical rects (see
// public/assets/sprites/lamb.json / enermy-lamb.json).

export const LambFrames = {
  BodyFront: 'body/front',
  BodyBack: 'body/back',
  Leg: 'leg',
  FaceIdle: 'face/idle',
  FaceBleat: 'face/bleat',
  Shadow: 'shadow',
  GaugeFill: 'gauge/fill',
  GaugeTrack: 'gauge/track',
  Finger: 'finger',
  TapCircle: 'tap-circle',
  Arrow: 'arrow',
  BtnBack: 'btn/back',
  BtnRestart: 'btn/restart',
} as const;

export const LandingFrames = {
  Title: 'title',
  BtnScore: 'btn/score',
  BtnPvp: 'btn/pvp',
  Copyright: 'copyright',
  Credit: 'credit',
} as const;

export const PvpLandingFrames = {
  Title: 'title',
  BtnStart: 'btn/start',
} as const;

export const EndingMessageFrames = {
  Lost: 'lost',
  Won: 'won',
} as const;
