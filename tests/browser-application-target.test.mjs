import test from 'node:test';
import assert from 'node:assert/strict';
import { browserApplicationOrigin } from '../test-support/browser-application-target.mjs';

test('browser regressions allow only the staging frontend and the local staging-backed runner', () => {
  assert.equal(browserApplicationOrigin('http://127.0.0.1:55558/elettra/'), 'http://127.0.0.1:55558');
  assert.equal(browserApplicationOrigin('http://127.0.0.1:9010/elettra/'), 'http://127.0.0.1:9010');
});

test('browser regressions reject production, remote, credentialed and non-application targets', () => {
  for (const url of [
    'http://127.0.0.1:8002/elettra/',
    'http://isaac-elettra.dacd.supsi.ch:8002/elettra/',
    'http://127.0.0.1:18558/elettra/',
    'http://example.com:55558/elettra/',
    'http://user:password@127.0.0.1:55558/elettra/',
    'https://127.0.0.1:9010/elettra/',
    'http://127.0.0.1:9010/other/',
    'http://127.0.0.1:9010/elettra/?target=production',
    'http://127.0.0.1:9010/elettra/#home',
  ]) assert.throws(() => browserApplicationOrigin(url), /require the local source\/bundle runner/);
});
