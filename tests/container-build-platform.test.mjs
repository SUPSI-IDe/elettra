import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dockerfileUrl = new URL('../docker/Dockerfile', import.meta.url);

test('multi-platform releases build static assets on the native runner', async () => {
  const dockerfile = await readFile(dockerfileUrl, 'utf8');

  assert.match(
    dockerfile,
    /^FROM --platform=\$BUILDPLATFORM node:[^\s]+ AS builder$/m,
  );
  assert.match(dockerfile, /^FROM nginx:[^\s]+$/m);
});
