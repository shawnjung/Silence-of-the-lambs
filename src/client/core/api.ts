import type {
  InitResponse,
  LeaderboardResponse,
  ScoreResponse,
} from '../../shared/api';

/**
 * Client -> server is plain same-origin fetch; Devvit's server is
 * request/response only. Anything the server needs to push back arrives over
 * realtime instead (see core/realtime.ts).
 */

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  init: (): Promise<InitResponse> => get<InitResponse>('/api/init'),

  leaderboard: (): Promise<LeaderboardResponse> =>
    get<LeaderboardResponse>('/api/leaderboard'),

  submitScore: (score: number): Promise<ScoreResponse> =>
    post<ScoreResponse>('/api/score', { score }),
};
