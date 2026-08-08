import { Hono } from 'hono';
import type { Context } from 'hono';
import type {
  PvpErrorResponse,
  PvpExpireRequest,
  PvpExpireResponse,
  PvpLeaveRequest,
  PvpLeaveResponse,
  PvpPingRequest,
  PvpPingResponse,
  PvpQueueResponse,
  PvpTouchRequest,
  PvpTouchResponse,
} from '../../shared/pvp';
import {
  PvpError,
  leave,
  ping,
  queue,
  reportExpire,
  requirePostId,
  requireUserId,
  touch,
} from '../core/pvp';

export const pvp = new Hono();

/** `must be a non-empty string`, otherwise the caller gets a clean 400 instead of a thrown TypeError. */
function requireStringField(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | null)?.[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new PvpError(400, `${field} is required`);
  }
  return value;
}

pvp.post('/queue', async (c) => {
  try {
    const userId = requireUserId();
    const postId = requirePostId();
    const result = await queue(postId, userId);
    return c.json<PvpQueueResponse>(result);
  } catch (error) {
    return handlePvpError(c, error);
  }
});

pvp.post('/touch', async (c) => {
  try {
    const userId = requireUserId();
    const body = (await c.req.json().catch(() => ({}))) as Partial<PvpTouchRequest>;
    const matchId = requireStringField(body, 'matchId');
    const lambId = requireStringField(body, 'lambId');
    const result = await touch(matchId, userId, lambId);
    return c.json<PvpTouchResponse>(result);
  } catch (error) {
    return handlePvpError(c, error);
  }
});

pvp.post('/expire', async (c) => {
  try {
    const userId = requireUserId();
    const body = (await c.req.json().catch(() => ({}))) as Partial<PvpExpireRequest>;
    const matchId = requireStringField(body, 'matchId');
    const lambId = requireStringField(body, 'lambId');
    const result = await reportExpire(matchId, userId, lambId);
    return c.json<PvpExpireResponse>(result);
  } catch (error) {
    return handlePvpError(c, error);
  }
});

pvp.post('/ping', async (c) => {
  try {
    const userId = requireUserId();
    const body = (await c.req.json().catch(() => ({}))) as Partial<PvpPingRequest>;
    const matchId = requireStringField(body, 'matchId');
    const result = await ping(matchId, userId);
    return c.json<PvpPingResponse>(result);
  } catch (error) {
    return handlePvpError(c, error);
  }
});

pvp.post('/leave', async (c) => {
  try {
    const userId = requireUserId();
    const postId = requirePostId();
    const body = (await c.req.json().catch(() => ({}))) as Partial<PvpLeaveRequest>;
    // Optional on purpose — a player still parked in the queue has no match
    // to leave but must still vacate the queue.
    const matchId = typeof body.matchId === 'string' && body.matchId ? body.matchId : undefined;
    const result = await leave(postId, userId, matchId);
    return c.json<PvpLeaveResponse>(result);
  } catch (error) {
    return handlePvpError(c, error);
  }
});

function handlePvpError(c: Context, error: unknown): Response {
  if (error instanceof PvpError) {
    return c.json<PvpErrorResponse>(
      { status: 'error', message: error.message },
      // Hono's json() typing wants a literal status code union; PvpError's
      // httpStatus is always one of the 4xx codes this file throws, cast to
      // satisfy the type without hardcoding a redundant switch.
      error.httpStatus as 400 | 401 | 403 | 404 | 409
    );
  }
  console.error('Unexpected PvP error:', error);
  return c.json<PvpErrorResponse>({ status: 'error', message: 'internal error' }, 500);
}
