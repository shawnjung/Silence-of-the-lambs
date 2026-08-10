import { reddit, type Post } from '@devvit/web/server';

/**
 * Creates the playable post. Shared by the app-install trigger and the
 * moderator menu item so both produce an identical post.
 *
 * `subredditName` is omitted deliberately — it defaults to the current
 * subreddit, which is what both call sites want.
 *
 * No `entry` is passed either: it defaults to the `default` entrypoint, which
 * `devvit.json` maps to the inline `splash.html`. The game itself lives behind
 * the splash's Play button via `requestExpandedMode(event, 'game')`, so the
 * feed never pays for Phaser or the audio.
 */
export async function createPost(): Promise<Post> {
  return await reddit.submitCustomPost({
    title: "Don't let lambs cry",
    // old.reddit can't render a custom post, so give it something readable.
    textFallback: {
      text: 'Tap every lamb before its patience runs out. Playable on new Reddit and in the mobile apps.',
    },
  });
}
