import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ErrorResponse,
  InitResponse,
  LeaderboardResponse,
  ScoreResponse,
} from '../../shared/api';
import {
  isPlausibleScore,
  personalBest,
  rankOf,
  recordScore,
  topScores,
} from '../core/leaderboard';

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId, userId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  const username = (await reddit.getCurrentUsername()) ?? null;
  const [best, top] = await Promise.all([
    username ? personalBest(postId, username) : Promise.resolve(0),
    topScores(postId),
  ]);

  return c.json<InitResponse>({
    type: 'init',
    postId,
    userId: userId ?? null,
    username: username ?? 'anonymous',
    personalBest: best,
    top,
  });
});

api.get('/leaderboard', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  const username = await reddit.getCurrentUsername();
  const [top, rank] = await Promise.all([
    topScores(postId),
    username ? rankOf(postId, username) : Promise.resolve(null),
  ]);

  return c.json<LeaderboardResponse>({ type: 'leaderboard', top, rank });
});

api.post('/score', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  const username = await reddit.getCurrentUsername();
  if (!username) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'must be logged in to record a score' },
      401
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as { score?: unknown };
  if (!isPlausibleScore(body.score)) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'invalid score' },
      400
    );
  }

  const best = await recordScore(postId, username, body.score);
  const rank = await rankOf(postId, username);

  return c.json<ScoreResponse>({ type: 'score', personalBest: best, rank });
});
