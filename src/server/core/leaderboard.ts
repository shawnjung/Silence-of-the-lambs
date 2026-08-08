import { redis } from '@devvit/web/server';
import type { LeaderRow } from '../../shared/api';
import { globalBoard, postBoard } from './keys';

/**
 * Scores are client-reported and therefore forgeable. We can't prevent that in
 * a tap game without simulating play server-side, but we can refuse nonsense
 * and keep one entry per user rather than one per submission.
 */
export const MAX_PLAUSIBLE_SCORE = 100_000;

export function isPlausibleScore(score: unknown): score is number {
  return (
    typeof score === 'number' &&
    Number.isFinite(score) &&
    Number.isInteger(score) &&
    score >= 0 &&
    score <= MAX_PLAUSIBLE_SCORE
  );
}

export async function topScores(
  postId: string,
  count = 10
): Promise<LeaderRow[]> {
  const rows = await redis.zRange(postBoard(postId), 0, count - 1, {
    by: 'rank',
    reverse: true,
  });
  return rows.map((r) => ({ username: r.member, score: r.score }));
}

export async function personalBest(
  postId: string,
  username: string
): Promise<number> {
  const score = await redis.zScore(postBoard(postId), username);
  return score ?? 0;
}

/** 1-based rank on the post board, or null when the user has no score yet. */
export async function rankOf(
  postId: string,
  username: string
): Promise<number | null> {
  const [rank, total] = await Promise.all([
    redis.zRank(postBoard(postId), username),
    redis.zCard(postBoard(postId)),
  ]);
  if (rank === undefined) return null;
  // zRank is ascending; the board is displayed descending.
  return total - rank;
}

/**
 * Records a run, keeping only the user's best on each board. The two boards are
 * checked independently: a user's global best may come from a different post,
 * and a plain zAdd would overwrite it downwards.
 */
export async function recordScore(
  postId: string,
  username: string,
  score: number
): Promise<number> {
  const [postCurrent, globalCurrent] = await Promise.all([
    personalBest(postId, username),
    redis.zScore(globalBoard(), username),
  ]);

  const writes: Promise<unknown>[] = [];
  if (score > postCurrent) {
    writes.push(redis.zAdd(postBoard(postId), { member: username, score }));
  }
  if (score > (globalCurrent ?? 0)) {
    writes.push(redis.zAdd(globalBoard(), { member: username, score }));
  }
  await Promise.all(writes);

  return Math.max(score, postCurrent);
}
