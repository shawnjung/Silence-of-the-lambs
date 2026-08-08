import { requestExpandedMode } from '@devvit/web/client';
import type { LeaderboardResponse } from '../shared/api';

const play = document.getElementById('play') as HTMLButtonElement;
const board = document.getElementById('board') as HTMLOListElement;

play.addEventListener('click', (e) => {
  // Must be a trusted gesture event, and 'game' is the devvit.json entrypoint key.
  requestExpandedMode(e, 'game');
});

async function renderTopScores(): Promise<void> {
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) return;
    const data = (await res.json()) as LeaderboardResponse;
    board.replaceChildren(
      ...data.top.slice(0, 3).map((row, i) => {
        const li = document.createElement('li');
        const who = document.createElement('span');
        who.className = 'who';
        who.textContent = `${i + 1}. ${row.username}`;
        const score = document.createElement('span');
        score.className = 'score';
        score.textContent = String(row.score);
        li.append(who, score);
        return li;
      })
    );
  } catch {
    // A splash without scores is still a working splash.
  }
}

void renderTopScores();
