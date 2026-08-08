/** Every Redis key the app uses, in one place. */

export const postBoard = (postId: string): string => `lb:post:${postId}`;
export const globalBoard = (): string => 'lb:global';
export const pvpWins = (postId: string): string => `pvp:wins:${postId}`;

/** Waiting player for a post's PvP queue. Short TTL so stale entries evaporate. */
export const pvpQueue = (postId: string): string => `pvp:q:${postId}`;
export const PVP_QUEUE_TTL_SECONDS = 30;

export const match = (matchId: string): string => `pvp:m:${matchId}`;
export const matchLambs = (matchId: string): string => `pvp:m:${matchId}:lambs`;
/** Written with nx:true — the first valid report of a match ending wins. */
export const matchOver = (matchId: string): string => `pvp:m:${matchId}:over`;
export const matchSeen = (matchId: string, userId: string): string =>
  `pvp:m:${matchId}:seen:${userId}`;
export const userMatch = (postId: string, userId: string): string =>
  `pvp:user:${postId}:${userId}`;

/** Heartbeat window. A peer whose `seen` key has expired has left. */
export const PVP_SEEN_TTL_SECONDS = 6;
export const MATCH_TTL_SECONDS = 60 * 60;
