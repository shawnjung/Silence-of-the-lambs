/** Shared API + realtime message contracts. Imported by both client and server. */

/** World design size. The play camera always renders exactly this. */
export const WORLD_WIDTH = 1136;
export const WORLD_HEIGHT = 640;

export type LeaderRow = {
  username: string;
  score: number;
};

export type InitResponse = {
  type: 'init';
  postId: string;
  /** Reddit t2_ id, or null when the viewer is logged out. */
  userId: string | null;
  username: string;
  personalBest: number;
  top: LeaderRow[];
};

export type LeaderboardResponse = {
  type: 'leaderboard';
  top: LeaderRow[];
  /** 1-based rank of the caller, or null when unranked/logged out. */
  rank: number | null;
};

export type ScoreResponse = {
  type: 'score';
  personalBest: number;
  rank: number | null;
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};
