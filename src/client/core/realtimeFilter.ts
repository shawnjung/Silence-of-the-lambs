/**
 * The one pure rule behind PvP's realtime self-echo filtering, pulled into
 * its own zero-import leaf module -- mirroring `objects/lambMath.ts` /
 * `stage/scoring.ts` / `stage/lambSpawn.ts` / `core/layout.ts` -- so it can
 * be loaded directly by Node's native TS loader in tests without dragging in
 * `core/realtime.ts`'s own imports (`@devvit/web/client`, and the
 * extensionless relative import of `shared/pvp.ts` that loader can't resolve
 * on its own; see those other modules' headers for the same reasoning).
 */

/**
 * True when `userId` names the local viewer -- the self-echo every
 * `realtime.send()` broadcast carries back to its own sender (see
 * `src/shared/pvp.ts`'s header on why realtime has no per-socket emit).
 */
export function isOwnMessage(userId: string, selfUserId: string | undefined): boolean {
  return selfUserId !== undefined && userId === selfUserId;
}
