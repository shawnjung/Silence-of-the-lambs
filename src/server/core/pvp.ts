/**
 * 1v1 PvP matchmaking, lamb attributes, and match-ending rules.
 *
 * Ported from `legacy/socket_app/Model/{User,Room,Lamb}.coffee`. The one
 * thing that could not survive the port unchanged is timing: the legacy
 * server held authoritative `setTimeout`s per lamb (`start_counter`,
 * `renew_counter`, `expire` in `Model/Lamb.coffee`) and called
 * `Room.end_pvp` from inside them. Devvit's server is request-scoped —
 * nothing survives between requests, and the scheduler is cron-granular —
 * so there is nowhere to hang a 7-20 second timer.
 *
 * The fix: every lamb carries a `deadline` (epoch ms) instead of a running
 * timer. Expiry is derived, not scheduled — evaluated fresh on whichever
 * request happens to arrive next. Both clients render the same countdown
 * from `deadline` locally; whichever one's gauge fills first calls
 * `reportExpire`, and the server validates that report against its own
 * stored `deadline` (with a small grace window, see `EXPIRE_GRACE_MS`)
 * rather than trusting the caller's clock.
 */

import { randomUUID } from 'node:crypto';
import { context, realtime, redis } from '@devvit/web/server';
import type {
  PvpLamb,
  PvpLobbyMessage,
  PvpMatch,
  PvpMatchMessage,
  PvpOverPayload,
  PvpQueueResponse,
  PvpTouchResponse,
  PvpExpireResponse,
  PvpPingResponse,
  PvpLeaveResponse,
} from '../../shared/pvp';
import { pvpLobbyChannel, pvpMatchChannel } from '../../shared/pvp';
import * as keys from './keys';
import { MATCH_TTL_SECONDS, PVP_QUEUE_TTL_SECONDS, PVP_SEEN_TTL_SECONDS } from './keys';
import {
  LAMBS_PER_PLAYER,
  generateLambAttributes,
  initialDeadline,
  isExpireValid,
  otherPlayer,
  samplePatience,
  shouldEscalate,
} from './pvpRules';

/** Surfaced to routes as an HTTP status + message; see `routes/pvp.ts`. */
export class PvpError extends Error {
  readonly httpStatus: number;

  constructor(httpStatus: number, message: string) {
    super(message);
    this.name = 'PvpError';
    this.httpStatus = httpStatus;
  }
}

// ---------------------------------------------------------------------------
// Redis-backed state. The pure rules this builds on (deadline math, the
// escalation window, idempotent match-ending) live in `pvpRules.ts` and are
// what `pvp.test.ts` exercises directly.
// ---------------------------------------------------------------------------

type MatchMeta = {
  matchId: string;
  postId: string;
  players: [string, string];
  createdAt: number;
  active: boolean;
};

type LoadedMatch = {
  meta: MatchMeta;
  lambs: Record<string, PvpLamb>;
};

type StoredMatchOver = PvpOverPayload & { nonce: string };

function makeInitialLamb(
  ownerId: string,
  now: number,
  rand: () => number = Math.random
): PvpLamb {
  const attrs = generateLambAttributes(rand);
  return {
    id: randomUUID(),
    ownerId,
    ...attrs,
    deadline: initialDeadline(now, attrs.delay, attrs.patience),
  };
}

/**
 * `Room.coffee#add_lamb` creates the escalation lamb via
 * `@lambs.add id: uuid.v4()` and never calls `start_counter` on it — only
 * `Room#start_pvp` does that, and only for the lambs present at match start.
 * That looks like an oversight, but the task is to match the legacy rules,
 * not fix them: an escalation lamb is faithfully reproduced as one with no
 * running clock at all (`deadline: null`) until its owner first touches it,
 * at which point the normal touch path starts its clock like any other.
 */
function makeEscalationLamb(ownerId: string, rand: () => number = Math.random): PvpLamb {
  return {
    id: randomUUID(),
    ownerId,
    ...generateLambAttributes(rand),
    deadline: null,
  };
}

function toPvpMatch(state: LoadedMatch): PvpMatch {
  return {
    matchId: state.meta.matchId,
    postId: state.meta.postId,
    players: state.meta.players,
    lambs: Object.values(state.lambs),
    createdAt: state.meta.createdAt,
  };
}

async function loadMatch(matchId: string): Promise<LoadedMatch | null> {
  const raw = await redis.get(keys.match(matchId));
  if (!raw) return null;
  const meta = JSON.parse(raw) as MatchMeta;
  const rows = await redis.hGetAll(keys.matchLambs(matchId));
  const lambs: Record<string, PvpLamb> = {};
  for (const [lambId, json] of Object.entries(rows)) {
    lambs[lambId] = JSON.parse(json) as PvpLamb;
  }
  return { meta, lambs };
}

async function saveLamb(matchId: string, lamb: PvpLamb): Promise<void> {
  await redis.hSet(keys.matchLambs(matchId), { [lamb.id]: JSON.stringify(lamb) });
}

async function markSeen(matchId: string, userId: string, now: number): Promise<void> {
  await redis.set(keys.matchSeen(matchId, userId), '1', {
    expiration: new Date(now + PVP_SEEN_TTL_SECONDS * 1000),
  });
}

async function isSeen(matchId: string, userId: string): Promise<boolean> {
  return (await redis.get(keys.matchSeen(matchId, userId))) !== undefined;
}

async function markMatchInactive(meta: MatchMeta): Promise<void> {
  const updated: MatchMeta = { ...meta, active: false };
  await redis.set(keys.match(meta.matchId), JSON.stringify(updated), {
    expiration: new Date(Date.now() + MATCH_TTL_SECONDS * 1000),
  });
}

async function readMatchOver(matchId: string): Promise<PvpOverPayload | null> {
  const raw = await redis.get(keys.matchOver(matchId));
  if (!raw) return null;
  const stored = JSON.parse(raw) as StoredMatchOver;
  return { winnerId: stored.winnerId, lambId: stored.lambId, reason: stored.reason };
}

/**
 * Ends a match exactly once, however many callers race to report it.
 *
 * `redis.set(key, value, {nx:true})` only ever "wins" for the first caller,
 * but this SDK's `set()` doesn't give us an unambiguous signal of whether
 * *we* were that caller (its return type doesn't distinguish "wrote" from
 * "already existed" as cleanly as a raw redis client would). So rather than
 * branch on `set`'s return, we always follow it with a `get` and compare —
 * every candidate carries a fresh `nonce`, and only the request whose nonce
 * comes back out of the `get` actually happened first. That request alone
 * flips the match inactive, credits the win, and sends the one `pvp-over`
 * broadcast; everyone else just relays the same resolved result to their
 * own caller.
 */
async function endMatch(
  meta: MatchMeta,
  candidate: PvpOverPayload,
  actingUserId: string
): Promise<PvpOverPayload> {
  const key = keys.matchOver(meta.matchId);
  const nonce = randomUUID();
  const stored: StoredMatchOver = { ...candidate, nonce };

  await redis.set(key, JSON.stringify(stored), {
    nx: true,
    expiration: new Date(Date.now() + MATCH_TTL_SECONDS * 1000),
  });
  const raw = await redis.get(key);
  const resolved: StoredMatchOver = raw ? (JSON.parse(raw) as StoredMatchOver) : stored;
  const wasFirstWriter = resolved.nonce === nonce;

  const result: PvpOverPayload = {
    winnerId: resolved.winnerId,
    lambId: resolved.lambId,
    reason: resolved.reason,
  };

  if (wasFirstWriter) {
    await Promise.all([
      markMatchInactive(meta),
      redis.zIncrBy(keys.pvpWins(meta.postId), result.winnerId, 1),
      realtime.send<PvpMatchMessage>(pvpMatchChannel(meta.matchId), {
        type: 'pvp-over',
        userId: actingUserId,
        ...result,
      }),
    ]);
  }

  return result;
}

/**
 * `connectRealtime`'s `onDisconnect` only fires for the local client's own
 * socket — it cannot tell either player that the *other* one left. Every
 * request refreshes the caller's own `seen` key and checks the peer's; if
 * the peer's has lapsed (no ping/touch/expire from them in
 * `PVP_SEEN_TTL_SECONDS`), the match ends here with `reason: 'left'`.
 */
async function checkPeerLeft(
  meta: MatchMeta,
  userId: string
): Promise<PvpOverPayload | null> {
  const peerId = otherPlayer(meta.players, userId);
  if (await isSeen(meta.matchId, peerId)) return null;
  return endMatch(meta, { winnerId: userId, lambId: null, reason: 'left' }, userId);
}

/**
 * A transaction commits iff `exec` returns a result array. A WATCH-aborted
 * transaction yields nil (and some clients throw), so both mean "lost".
 */
async function committed(tx: {
  exec(): Promise<unknown[]>;
}): Promise<boolean> {
  try {
    const results = await tx.exec();
    return Array.isArray(results) && results.length > 0;
  } catch {
    return false;
  }
}

/**
 * One attempt at the queue. The read MUST happen after the WATCH: `DEL` on an
 * already-claimed key still reports success (it returns 0, not an error), so
 * reading the waiting player before arming the watch leaves a window where two
 * joiners both read the same opponent, both delete, and both build a match
 * against a player who is already in one. Watching first makes the value we
 * read part of the transaction's precondition — if anyone touches the key
 * between our read and our `exec`, the transaction aborts and we retry.
 */
async function tryQueueOnce(
  qKey: string,
  userId: string,
  now: number
): Promise<{ outcome: 'claimed'; opponent: string } | { outcome: 'parked' } | { outcome: 'retry' }> {
  const tx = await redis.watch(qKey);
  const waiting = await redis.get(qKey);

  if (waiting && waiting !== userId) {
    await tx.multi();
    await tx.del(qKey);
    return (await committed(tx))
      ? { outcome: 'claimed', opponent: waiting }
      : { outcome: 'retry' };
  }

  // Nobody waiting, or it is already us — (re-)park and refresh the TTL.
  await tx.multi();
  await tx.set(qKey, userId, {
    expiration: new Date(now + PVP_QUEUE_TTL_SECONDS * 1000),
  });
  return (await committed(tx)) ? { outcome: 'parked' } : { outcome: 'retry' };
}

async function createMatch(
  postId: string,
  players: [string, string],
  now: number
): Promise<PvpMatch> {
  const matchId = randomUUID();
  const lambs = players.flatMap((ownerId) =>
    Array.from({ length: LAMBS_PER_PLAYER }, () => makeInitialLamb(ownerId, now))
  );
  const meta: MatchMeta = { matchId, postId, players, createdAt: now, active: true };
  const expiration = new Date(now + MATCH_TTL_SECONDS * 1000);
  const seenExpiration = new Date(now + PVP_SEEN_TTL_SECONDS * 1000);

  await Promise.all([
    redis.set(keys.match(matchId), JSON.stringify(meta), { expiration }),
    redis.hSet(
      keys.matchLambs(matchId),
      Object.fromEntries(lambs.map((lamb) => [lamb.id, JSON.stringify(lamb)]))
    ),
    redis.expire(keys.matchLambs(matchId), MATCH_TTL_SECONDS),
    redis.set(keys.userMatch(postId, players[0]), matchId, { expiration }),
    redis.set(keys.userMatch(postId, players[1]), matchId, { expiration }),
    // Seeded at creation, not just on first ping — otherwise the peer who
    // hasn't sent a request yet would look like they'd already left.
    redis.set(keys.matchSeen(matchId, players[0]), '1', { expiration: seenExpiration }),
    redis.set(keys.matchSeen(matchId, players[1]), '1', { expiration: seenExpiration }),
  ]);

  return { matchId, postId, players, lambs, createdAt: now };
}

// ---------------------------------------------------------------------------
// Public operations — called from routes/pvp.ts
// ---------------------------------------------------------------------------

/**
 * The post is the lobby; the legacy 5-digit room codes
 * (`Collection/Rooms.coffee#create_id`) have no meaning on Reddit, where the
 * post itself is the only "room" a client could name.
 */
export async function queue(
  postId: string,
  userId: string,
  now: number = Date.now()
): Promise<PvpQueueResponse> {
  const existingMatchId = await redis.get(keys.userMatch(postId, userId));
  if (existingMatchId) {
    const state = await loadMatch(existingMatchId);
    if (state && state.meta.active) {
      return { status: 'matched', match: toPvpMatch(state) };
    }
  }

  const qKey = keys.pvpQueue(postId);

  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await tryQueueOnce(qKey, userId, now);

    if (result.outcome === 'retry') continue;
    if (result.outcome === 'parked') return { status: 'waiting' };

    const match = await createMatch(postId, [result.opponent, userId], now);
    await realtime.send<PvpLobbyMessage>(pvpLobbyChannel(postId), {
      type: 'matched',
      userId,
      match,
    });
    return { status: 'matched', match };
  }

  // Every attempt lost its race, which needs sustained contention on one post.
  // Failing loudly beats the old fallback of an unconditional `set`, which
  // would have evicted whoever was legitimately waiting.
  throw new PvpError(503, 'matchmaking is busy right now — try again');
}

/** `User.coffee#update_lamb`. */
export async function touch(
  matchId: string,
  userId: string,
  lambId: string,
  now: number = Date.now()
): Promise<PvpTouchResponse> {
  const state = await loadMatch(matchId);
  if (!state) throw new PvpError(404, 'match not found');
  const { meta } = state;
  if (!meta.players.includes(userId)) {
    throw new PvpError(403, 'not a participant in this match');
  }

  if (!meta.active) {
    const over = await readMatchOver(matchId);
    if (over) return { status: 'over', ...over };
    throw new PvpError(409, 'match already ended');
  }

  await markSeen(matchId, userId, now);
  const left = await checkPeerLeft(meta, userId);
  if (left) return { status: 'over', ...left };

  const lamb = state.lambs[lambId];
  if (!lamb) throw new PvpError(404, 'lamb not found');

  if (lamb.ownerId !== userId) {
    // Touching the opponent's lamb is an instant loss for the toucher.
    const winnerId = otherPlayer(meta.players, userId);
    const over = await endMatch(meta, { winnerId, lambId, reason: 'wrong-touch' }, userId);
    return { status: 'over', ...over };
  }

  const escalate = shouldEscalate(lamb.deadline, lamb.patience, now);
  const patience = samplePatience();
  const deadline = now + patience * 1000;
  await saveLamb(matchId, { ...lamb, patience, deadline });
  await realtime.send<PvpMatchMessage>(pvpMatchChannel(matchId), {
    type: 'reset-lamb',
    userId,
    lambId,
    patience,
    deadline,
  });

  if (escalate) {
    const beneficiary = otherPlayer(meta.players, userId);
    const newLamb = makeEscalationLamb(beneficiary);
    await saveLamb(matchId, newLamb);
    await realtime.send<PvpMatchMessage>(pvpMatchChannel(matchId), {
      type: 'add-lamb',
      userId,
      lamb: newLamb,
    });
  }

  return { status: 'ok' };
}

/** `Lamb.coffee#expire`, reported by whichever client's local gauge fills first. */
export async function reportExpire(
  matchId: string,
  userId: string,
  lambId: string,
  now: number = Date.now()
): Promise<PvpExpireResponse> {
  const state = await loadMatch(matchId);
  if (!state) throw new PvpError(404, 'match not found');
  const { meta } = state;
  if (!meta.players.includes(userId)) {
    throw new PvpError(403, 'not a participant in this match');
  }

  if (!meta.active) {
    const over = await readMatchOver(matchId);
    if (over) return { status: 'over', ...over };
    throw new PvpError(409, 'match already ended');
  }

  await markSeen(matchId, userId, now);
  const left = await checkPeerLeft(meta, userId);
  if (left) return { status: 'over', ...left };

  const lamb = state.lambs[lambId];
  if (!lamb) throw new PvpError(404, 'lamb not found');

  if (!isExpireValid(now, lamb.deadline)) {
    return { status: 'rejected' };
  }

  const winnerId = otherPlayer(meta.players, lamb.ownerId);
  const over = await endMatch(meta, { winnerId, lambId, reason: 'expired' }, userId);
  return { status: 'over', ...over };
}

/** Heartbeat. Exists solely to give `checkPeerLeft` something to check against. */
export async function ping(
  matchId: string,
  userId: string,
  now: number = Date.now()
): Promise<PvpPingResponse> {
  const state = await loadMatch(matchId);
  if (!state) throw new PvpError(404, 'match not found');
  const { meta } = state;
  if (!meta.players.includes(userId)) {
    throw new PvpError(403, 'not a participant in this match');
  }

  if (!meta.active) {
    const over = await readMatchOver(matchId);
    return over ? { status: 'over', ...over } : { status: 'ok' };
  }

  await markSeen(matchId, userId, now);
  const left = await checkPeerLeft(meta, userId);
  if (left) return { status: 'over', ...left };
  return { status: 'ok' };
}

/** `User.coffee#leave_room` — an explicit departure, same ending path as a lapsed heartbeat. */
/**
 * Vacates the matchmaking queue, but only if this user is still the one
 * parked in it. Watching the key matters: between our read and our delete
 * someone else may have claimed our slot and parked themselves, and blindly
 * deleting would evict them.
 */
async function leaveQueue(postId: string, userId: string): Promise<void> {
  const qKey = keys.pvpQueue(postId);
  const tx = await redis.watch(qKey);
  const waiting = await redis.get(qKey);

  if (waiting !== userId) return;

  await tx.multi();
  await tx.del(qKey);
  await committed(tx);
}

/**
 * Explicit departure. `matchId` is absent when the caller was still waiting
 * in the queue rather than in a match — without this path their queue entry
 * would linger for its full TTL and the next joiner would be paired with
 * someone who already walked away, then sit in a match until the heartbeat
 * timed the ghost out.
 */
export async function leave(
  postId: string,
  userId: string,
  matchId?: string
): Promise<PvpLeaveResponse> {
  if (!matchId) {
    await leaveQueue(postId, userId);
    return { status: 'ok' };
  }

  const state = await loadMatch(matchId);
  if (!state) {
    await leaveQueue(postId, userId);
    return { status: 'ok' };
  }
  const { meta } = state;
  if (!meta.players.includes(userId)) {
    throw new PvpError(403, 'not a participant in this match');
  }

  if (meta.active) {
    const winnerId = otherPlayer(meta.players, userId);
    await endMatch(meta, { winnerId, lambId: null, reason: 'left' }, userId);
  }
  await redis.del(keys.matchSeen(matchId, userId));
  return { status: 'ok' };
}

/** Convenience for routes: the logged-in userId, or a 401 `PvpError`. */
export function requireUserId(): string {
  const { userId } = context;
  if (!userId) throw new PvpError(401, 'must be logged in');
  return userId;
}

/** Convenience for routes: the current post's id, or a 400 `PvpError`. */
export function requirePostId(): string {
  const { postId } = context;
  if (!postId) throw new PvpError(400, 'postId is required');
  return postId;
}
