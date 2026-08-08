/**
 * 1v1 PvP message and payload contracts, shared between client and server.
 *
 * This is the successor to the socket.io event set in
 * `legacy/socket_app/Model/{User,Room,Lamb}.coffee` /
 * `legacy/client_app/javascripts/socket.coffee`, adapted for Devvit's
 * request-scoped server (no in-memory timers) and Realtime (broadcast-only,
 * no per-socket emit). See `src/server/core/pvp.ts` for the rationale.
 */

/** A lamb dives in from this side of its lane. */
export type PvpDirection = 'left' | 'right';

/** Why a match ended. Mirrors the three ways `Room.end_pvp` was reached. */
export type PvpEndReason =
  /** A lamb's patience ran out before its owner touched it. */
  | 'expired'
  /** Someone touched a lamb they don't own. */
  | 'wrong-touch'
  /** A player explicitly left, or stopped sending heartbeats. */
  | 'left';

/**
 * A single lamb. `deadline` is the epoch-ms instant at which this lamb will
 * be considered expired if untouched — the authoritative replacement for the
 * legacy `setTimeout`-based `expire()` call. Both clients render their own
 * countdown from this value; the server re-derives it from persisted state
 * on every request rather than trusting a client's clock.
 *
 * `deadline: null` means this lamb has no running countdown at all — the
 * state legacy `Room.add_lamb` leaves an escalation-spawned lamb in (see
 * `core/pvp.ts` for why that's a faithful port, not an oversight). Touching
 * such a lamb (by its owner) starts its clock for the first time.
 */
export type PvpLamb = {
  id: string;
  ownerId: string;
  x: number;
  speedPerSec: number;
  patience: number;
  line: number;
  direction: PvpDirection;
  delay: number;
  deadline: number | null;
};

export type PvpMatch = {
  matchId: string;
  postId: string;
  players: [string, string];
  lambs: PvpLamb[];
  createdAt: number;
};

/** The one-shot result of a match ending, broadcast exactly once per match. */
export type PvpOverPayload = {
  winnerId: string;
  /** The lamb that triggered the end, or null for a departure/left match. */
  lambId: string | null;
  reason: PvpEndReason;
};

export type PvpErrorResponse = {
  status: 'error';
  message: string;
};

// ---- REST: POST /api/pvp/queue ----

export type PvpQueueResponse =
  | { status: 'waiting' }
  | { status: 'matched'; match: PvpMatch };

// ---- REST: POST /api/pvp/touch ----

export type PvpTouchRequest = { matchId: string; lambId: string };

export type PvpTouchResponse = { status: 'ok' } | ({ status: 'over' } & PvpOverPayload);

// ---- REST: POST /api/pvp/expire ----

export type PvpExpireRequest = { matchId: string; lambId: string };

export type PvpExpireResponse =
  /** Reported before the grace-adjusted deadline; the server ignores it. */
  | { status: 'rejected' }
  | ({ status: 'over' } & PvpOverPayload);

// ---- REST: POST /api/pvp/ping ----

export type PvpPingRequest = { matchId: string };

export type PvpPingResponse = { status: 'ok' } | ({ status: 'over' } & PvpOverPayload);

// ---- REST: POST /api/pvp/leave ----

export type PvpLeaveRequest = { matchId: string };

export type PvpLeaveResponse = { status: 'ok' };

// ---- Realtime messages ----
// realtime.send() broadcasts to every subscriber on the channel, including
// the sender, so every message names the acting user — the client filters
// its own echo by comparing against its own userId.

export type PvpMatchedMessage = {
  type: 'matched';
  userId: string;
  match: PvpMatch;
};

export type PvpResetLambMessage = {
  type: 'reset-lamb';
  userId: string;
  lambId: string;
  patience: number;
  deadline: number;
};

export type PvpAddLambMessage = {
  type: 'add-lamb';
  userId: string;
  lamb: PvpLamb;
};

export type PvpOverMessage = {
  type: 'pvp-over';
  userId: string;
} & PvpOverPayload;

/** Sent on `pvp:lobby:{postId}` — the waiting player has no open request, so
 * this is the only way to tell them a match was found. */
export type PvpLobbyMessage = PvpMatchedMessage;

/** Sent on `pvp:{matchId}` — traffic for an in-progress match. */
export type PvpMatchMessage =
  | PvpResetLambMessage
  | PvpAddLambMessage
  | PvpOverMessage;

export type PvpRealtimeMessage = PvpLobbyMessage | PvpMatchMessage;

/** The waiting-room channel for a post. Carries `PvpLobbyMessage`. */
export const pvpLobbyChannel = (postId: string): string => `pvp:lobby:${postId}`;

/** The in-match channel for a match. Carries `PvpMatchMessage`. */
export const pvpMatchChannel = (matchId: string): string => `pvp:${matchId}`;
