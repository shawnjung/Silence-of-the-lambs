import type { Scene } from 'phaser';

/**
 * The original called cc.audioEngine.playMusic straight out of the preload
 * callback (legacy/client_app/javascripts/launcher.coffee). Browsers block that
 * without a user gesture, and a Reddit post that autoplays music at someone
 * mid-scroll deserves the downvote. So music starts on the first tap, once.
 */

const MUTE_KEY = 'sotl:muted';

let musicStarted = false;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    // Storage can be partitioned or blocked inside the webview; not fatal.
    return false;
  }
}

function persistMuted(value: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Preference just won't survive a reload.
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(scene: Scene, value: boolean): void {
  muted = value;
  persistMuted(value);
  scene.sound.mute = value;
}

export function toggleMuted(scene: Scene): boolean {
  setMuted(scene, !muted);
  return muted;
}

/**
 * Call from the first pointerdown of the session. Safe to call repeatedly.
 */
export function startMusicOnce(scene: Scene, key: string): void {
  if (musicStarted) return;
  musicStarted = true;
  scene.sound.mute = muted;
  scene.sound.add(key, { loop: true, volume: 0.5 }).play();
}

/** Applies the persisted mute state to a freshly created scene's sound manager. */
export function applyMuteState(scene: Scene): void {
  scene.sound.mute = muted;
}
