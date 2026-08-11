import { context } from '@devvit/web/client';

/**
 * Defensive reads of the Devvit client context.
 *
 * `context` is typed as always present, but it is injected by the Devvit host
 * — so outside one (a plain browser, a local harness, or any surface that
 * hasn't finished wiring it up) the import is `undefined`. Reading
 * `context.postId` there throws, and because PvP reads it during scene
 * creation the whole game went down instead of the PvP button simply not
 * working.
 *
 * Callers get `null` and are expected to degrade: solo play never needs
 * either value.
 */
type MaybeContext = { postId?: string; userId?: string } | undefined;

function safeContext(): { postId?: string; userId?: string } {
  return (context as MaybeContext) ?? {};
}

export function getPostId(): string | null {
  return safeContext().postId ?? null;
}

export function getUserId(): string | null {
  return safeContext().userId ?? null;
}
