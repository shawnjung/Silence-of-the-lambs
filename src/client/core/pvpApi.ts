import type {
  PvpErrorResponse,
  PvpExpireResponse,
  PvpLeaveResponse,
  PvpPingResponse,
  PvpQueueResponse,
  PvpTouchResponse,
} from '../../shared/pvp';

/**
 * Client -> server calls for the five live PvP endpoints (`src/server/routes/pvp.ts`).
 * Kept separate from `core/api.ts` rather than folded into it: that module's
 * shape (one bare async function per endpoint, throwing a generic `Error` on
 * any non-2xx) doesn't distinguish PvP's one status code callers actually
 * need to branch on -- 503 ("matchmaking is busy, try again") -- from every
 * other failure, so `PvpApiError` below carries the real HTTP status through
 * instead of losing it in a stringified message.
 */

export class PvpApiError extends Error {
  readonly httpStatus: number;

  constructor(httpStatus: number, message: string) {
    super(message);
    this.name = 'PvpApiError';
    this.httpStatus = httpStatus;
  }
}

async function postPvp<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      json !== null && typeof json === 'object' && typeof (json as PvpErrorResponse).message === 'string'
        ? (json as PvpErrorResponse).message
        : `pvp request failed: ${res.status}`;
    throw new PvpApiError(res.status, message);
  }

  return json as T;
}

export const pvpApi = {
  /** `POST /api/pvp/queue` -- join (or rejoin) the post's matchmaking queue. */
  queue: (): Promise<PvpQueueResponse> => postPvp<PvpQueueResponse>('/api/pvp/queue'),

  /** `POST /api/pvp/touch` -- tap a lamb, own or opponent's. */
  touch: (matchId: string, lambId: string): Promise<PvpTouchResponse> =>
    postPvp<PvpTouchResponse>('/api/pvp/touch', { matchId, lambId }),

  /** `POST /api/pvp/expire` -- report a lamb whose local gauge just filled. */
  expire: (matchId: string, lambId: string): Promise<PvpExpireResponse> =>
    postPvp<PvpExpireResponse>('/api/pvp/expire', { matchId, lambId }),

  /** `POST /api/pvp/ping` -- heartbeat; see PvpStage's ~2s interval. */
  ping: (matchId: string): Promise<PvpPingResponse> =>
    postPvp<PvpPingResponse>('/api/pvp/ping', { matchId }),

  /**
   * `POST /api/pvp/leave` -- explicit departure. Omit `matchId` when leaving
   * the matchmaking queue rather than a match; the server then just vacates
   * the queue slot, so the next joiner is not paired with someone who has
   * already walked away.
   */
  leave: (matchId?: string): Promise<PvpLeaveResponse> =>
    postPvp<PvpLeaveResponse>('/api/pvp/leave', matchId ? { matchId } : {}),
};
