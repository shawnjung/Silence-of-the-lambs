/**
 * Keeping a thrown error from freezing the whole game.
 *
 * Phaser does not run input callbacks straight from the DOM listener -- it
 * queues DOM events and dispatches them inside the requestAnimationFrame step.
 * So an exception thrown by a pointerdown handler propagates out of the game
 * loop itself and rendering stops dead. The canvas freezes on the last frame
 * and there is nothing on screen to say why, which is exactly how a missing
 * audio key presented: "tapping the title screen freezes the app".
 *
 * Two defences here:
 *
 *  - `guard()` wraps an input callback so a throw is reported and swallowed
 *    instead of reaching Phaser's step. A broken button beats a dead game.
 *  - `installErrorOverlay()` puts any uncaught error on screen. Debugging a
 *    webview inside the Reddit app is awkward at best, so the game has to be
 *    able to say what went wrong without a devtools console attached.
 */

let overlay: HTMLElement | null = null;

function ensureOverlay(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (overlay?.isConnected) return overlay;

  const el = document.createElement('div');
  el.setAttribute('role', 'alert');
  el.style.cssText = [
    'position:fixed',
    'inset:auto 8px 8px 8px',
    'z-index:2147483647',
    'max-height:45%',
    'overflow:auto',
    'padding:10px 12px',
    'border-radius:10px',
    'background:rgba(60,8,8,0.94)',
    'color:#ffe9e9',
    'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    'white-space:pre-wrap',
    'word-break:break-word',
  ].join(';');
  document.body.appendChild(el);
  overlay = el;
  return el;
}

export function reportError(label: string, error: unknown): void {
  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : String(error);
  console.error(`[${label}]`, error);

  const el = ensureOverlay();
  if (el) el.textContent = `${label}\n${detail}`.slice(0, 2000);
}

/**
 * Wraps a callback so it can never take the game loop down with it. Use for
 * anything Phaser invokes during its step: input handlers, tween callbacks,
 * timer callbacks.
 */
export function guard<A extends unknown[]>(
  label: string,
  fn: (...args: A) => void
): (...args: A) => void {
  return (...args: A): void => {
    try {
      fn(...args);
    } catch (error) {
      reportError(label, error);
    }
  };
}

/** Call once at boot. Surfaces uncaught errors and rejected promises on screen. */
export function installErrorOverlay(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportError('Uncaught error', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportError('Unhandled promise rejection', event.reason);
  });
}
