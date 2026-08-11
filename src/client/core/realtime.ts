import { connectRealtime, disconnectRealtime } from '@devvit/web/client';
import { getUserId } from './devvitContext';
import type { PvpLobbyMessage, PvpMatchMessage } from '../../shared/pvp';
import { pvpLobbyChannel, pvpMatchChannel } from '../../shared/pvp';
import { isOwnMessage } from './realtimeFilter';

/**
 * Thin typed wrapper over `connectRealtime`/`disconnectRealtime` — see
 * `src/shared/pvp.ts`'s header for why realtime has no per-socket emit: every
 * `realtime.send()` on the server broadcasts to the *whole* channel,
 * including whichever client caused the send. Every PvP message therefore
 * carries the acting `userId`, and it's this module's job to decide, per
 * channel, whether the local viewer should hear their own echo (the actual
 * rule lives in `./realtimeFilter`, kept import-free for testing).
 *
 * Callers never see a raw channel string or have to reason about self-echoes
 * themselves — they get one `subscribe*` call per PvP channel and an
 * `Unsubscribe` thunk back.
 */

export type Unsubscribe = () => void;
export { isOwnMessage };

function subscribe<Msg extends { userId: string }>(
  channel: string,
  onMessage: (msg: Msg) => void,
  options: { includeOwn?: boolean } = {}
): Unsubscribe {
  const includeOwn = options.includeOwn ?? false;
  let live = true;

  connectRealtime<Msg>({
    channel,
    onMessage: (msg) => {
      if (!live) return;
      if (!includeOwn && isOwnMessage(msg.userId, getUserId() ?? undefined)) return;
      onMessage(msg);
    },
  });

  return () => {
    if (!live) return;
    live = false;
    disconnectRealtime(channel);
  };
}

/**
 * `pvp:lobby:{postId}` — carries exactly one message shape, `matched`, sent
 * by whichever player's `queue()` call completed the pairing. The player who
 * placed that call already has the match from their own REST response, so
 * their own echo of this broadcast is filtered here; the player who was
 * already parked waiting has no open request of their own, and this
 * broadcast is the only way they ever learn a match was found — see
 * `src/shared/pvp.ts`'s `PvpLobbyMessage` doc.
 */
export function subscribePvpLobby(
  postId: string,
  onMatched: (msg: PvpLobbyMessage) => void
): Unsubscribe {
  return subscribe<PvpLobbyMessage>(pvpLobbyChannel(postId), onMatched);
}

/**
 * `pvp:{matchId}` — traffic for a live match. Unlike the lobby channel,
 * every message here must reach *both* players regardless of who acted:
 * `reset-lamb` is how the toucher's own optimistic gauge reset gets
 * reconciled with the authoritative patience/deadline (see PvpStage), and
 * it's simultaneously how the other player learns that lamb changed at all.
 * Nothing is filtered.
 */
export function subscribePvpMatch(
  matchId: string,
  onMessage: (msg: PvpMatchMessage) => void
): Unsubscribe {
  return subscribe<PvpMatchMessage>(pvpMatchChannel(matchId), onMessage, { includeOwn: true });
}
