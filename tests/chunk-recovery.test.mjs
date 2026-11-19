import test from 'node:test';
import assert from 'node:assert/strict';
import { installChunkRecovery } from '../src/chunk-recovery.js';

test('a removed asset recovers once across page reloads and permits a later deployment', () => {
  const values = new Map();
  let reloads = 0, time = 100_000;
  const makeWindow = () => Object.assign(new EventTarget(), {
    sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    location: { reload: () => reloads++ },
  });
  const firstWindow = makeWindow();
  installChunkRecovery(firstWindow, { now: () => time });
  const firstFailure = new Event('vite:preloadError', { cancelable: true });
  firstWindow.dispatchEvent(firstFailure);
  assert.equal(firstFailure.defaultPrevented, true);
  assert.equal(reloads, 1);
  const nextWindow = makeWindow();
  installChunkRecovery(nextWindow, { now: () => time });
  const repeatedFailure = new Event('vite:preloadError', { cancelable: true });
  nextWindow.dispatchEvent(repeatedFailure);
  assert.equal(repeatedFailure.defaultPrevented, false);
  assert.equal(reloads, 1);
  time += 30_001;
  nextWindow.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
  assert.equal(reloads, 2);
});

test('unavailable session storage leaves failure handling to navigation without a reload loop', () => {
  const target = Object.assign(new EventTarget(), {
    sessionStorage: { getItem() { throw new Error('Storage blocked'); } },
    location: { reload() { assert.fail('Cannot safely auto-reload without the guard'); } },
  });
  installChunkRecovery(target);
  const failure = new Event('vite:preloadError', { cancelable: true });
  target.dispatchEvent(failure);
  assert.equal(failure.defaultPrevented, false);
});
