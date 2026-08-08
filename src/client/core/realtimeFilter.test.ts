import assert from 'node:assert/strict';
import { test as nodeTest, describe as nodeDescribe, before } from 'node:test';

// See objects/lambMath.test.ts for why this file is structured this way
// (wrapper functions + a before() hook loading via a non-literal dynamic
// import) -- same Node-native-TS-loader resolution quirk, same workaround.
function describe(name: string, fn: () => void): void {
  void nodeDescribe(name, fn);
}
function test(name: string, fn: () => void): void {
  void nodeTest(name, fn);
}

type RealtimeFilterModule = typeof import('./realtimeFilter.js');
let isOwnMessage: RealtimeFilterModule['isOwnMessage'];

before(async () => {
  const realtimeFilter = (await import('./realtimeFilter' + '.ts')) as RealtimeFilterModule;
  ({ isOwnMessage } = realtimeFilter);
});

describe('isOwnMessage', () => {
  test('a message naming the local viewer is their own echo', () => {
    assert.equal(isOwnMessage('t2_abc', 't2_abc'), true);
  });

  test('a message naming a different user is not', () => {
    assert.equal(isOwnMessage('t2_abc', 't2_xyz'), false);
  });

  test('an unknown local viewer (logged out / not yet resolved) never matches', () => {
    assert.equal(isOwnMessage('t2_abc', undefined), false);
  });
});
