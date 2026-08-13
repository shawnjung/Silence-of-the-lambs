/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test, before } from 'node:test';

type Mod = typeof import('./pvp.ts');
let mod: Mod;

const MODULE_PATH = './pvp.ts';

before(async () => {
  mod = (await import(MODULE_PATH)) as Mod;
});

/**
 * Devvit rejects a realtime channel name containing anything but letters,
 * numbers, and underscores, and only says so at connect time -- which happens
 * inside a scene's create(), where a throw kills the game loop. PvP shipped
 * broken because the natural colon-separated names are illegal, so these are
 * worth pinning.
 */
void describe('realtime channel names', () => {
  const VALID = /^[A-Za-z0-9_]+$/;

  void test('the lobby channel is legal for a real Reddit post id', () => {
    const channel = mod.pvpLobbyChannel('t3_1vl1e11');
    assert.match(channel, VALID);
    assert.equal(channel, 'pvp_lobby_t3_1vl1e11');
  });

  void test('the match channel is legal for a hyphenated uuid', () => {
    const channel = mod.pvpMatchChannel('3f2b1c9a-77de-4e1b-9b0a-1c2d3e4f5a6b');
    assert.match(channel, VALID);
    assert.ok(!channel.includes('-'));
  });

  void test('every illegal character is replaced, not dropped', () => {
    // Dropping would let two distinct ids collapse onto one channel; replacing
    // keeps them distinct.
    const a = mod.pvpMatchChannel('a:b');
    const b = mod.pvpMatchChannel('a-b');
    assert.match(a, VALID);
    assert.match(b, VALID);
    assert.equal(a, b, 'both illegal separators normalize the same way');
    assert.notEqual(mod.pvpMatchChannel('ab'), a, 'ids are not silently shortened');
  });

  void test('colons never survive, whatever the id looks like', () => {
    for (const id of ['t3_abc', 'a:b:c', '..', 'x/y', 'A1_z', '']) {
      assert.match(mod.pvpLobbyChannel(id), VALID);
      assert.match(mod.pvpMatchChannel(id), VALID);
    }
  });
});
