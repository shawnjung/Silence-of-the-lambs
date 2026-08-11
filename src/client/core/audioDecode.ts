import type { Scene } from 'phaser';

/**
 * Loads audio by bypassing Phaser's format gate.
 *
 * Phaser decides whether it can play a file from its extension, probing the
 * browser with `canPlayType('audio/x-m4a')` and `canPlayType('audio/m4a')`.
 * Chromium returns "" for both -- while returning "maybe" for `audio/mp4` and
 * decoding these exact files without complaint. So Phaser refuses to load the
 * game's .m4a assets, logs "No audio URLs for ... can play on this device",
 * and leaves the keys absent from the cache.
 *
 * The original game shipped .m4a (it was a 2015 Cocos build targeting iOS), and
 * re-encoding needs ffmpeg. So instead of fighting the probe or converting the
 * assets, load the bytes ourselves and hand Web Audio the decode -- which is
 * the thing that was always capable of it. Phaser's audio cache holds an
 * AudioBuffer for the Web Audio backend, so a decoded buffer dropped in there
 * is indistinguishable from one Phaser loaded itself.
 *
 * Falls back to doing nothing if the sound manager has no Web Audio context
 * (`noAudio`, or the HTML5 backend). Callers must treat audio as optional --
 * see core/audio.ts.
 */

const RAW_SUFFIX = ':raw';

/** Queue the raw bytes during a scene's `preload()`. */
export function queueAudioBinaries(
  scene: Scene,
  entries: readonly { key: string; url: string }[]
): void {
  for (const { key, url } of entries) {
    scene.load.binary(key + RAW_SUFFIX, url);
  }
}

/**
 * Decode everything queued by `queueAudioBinaries` and publish it into
 * Phaser's audio cache. Resolves once all entries have settled; individual
 * failures are logged and skipped rather than rejecting, so one bad file
 * cannot cost the others.
 */
export async function publishDecodedAudio(
  scene: Scene,
  entries: readonly { key: string }[]
): Promise<void> {
  const context = (scene.sound as { context?: AudioContext }).context;
  if (!context) return;

  await Promise.all(
    entries.map(async ({ key }) => {
      if (scene.cache.audio.exists(key)) return;

      const raw = scene.cache.binary.get(key + RAW_SUFFIX) as
        | ArrayBuffer
        | Uint8Array
        | undefined;
      if (!raw) return;

      // decodeAudioData detaches the buffer it is given, and the cache entry is
      // shared, so decode a copy to keep retries and other readers valid.
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      const copy = bytes.slice().buffer as ArrayBuffer;

      try {
        const buffer = await context.decodeAudioData(copy);
        scene.cache.audio.add(key, buffer);
      } catch (error) {
        console.warn(`Could not decode audio "${key}":`, error);
      } finally {
        scene.cache.binary.remove(key + RAW_SUFFIX);
      }
    })
  );
}
