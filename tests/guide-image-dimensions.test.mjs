import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { guideContent } from '../guide/content.js';

test('all guide screenshots reserve their real intrinsic dimensions in every language', async () => {
  const hashes = new Map();
  for (const [language, content] of Object.entries(guideContent)) {
    for (const figure of content.sections.flatMap(({ figures = [], items }) =>
      [...figures, ...items.flatMap(item => item.figures ?? [])]
    )) {
      const png = await readFile(new URL(figure.src));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      const actual = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
      assert.deepEqual({ width: figure.width, height: figure.height }, actual, language + ': ' + figure.src);
      const url = new URL(figure.src);
      const [folder, filename] = url.pathname.split('/').slice(-2);
      assert.equal(folder, language, figure.src);
      if (!hashes.has(filename)) hashes.set(filename, new Set());
      hashes.get(filename).add(createHash('sha256').update(png).digest('hex'));
    }
  }
  assert.ok(hashes.size > 0);
  for (const [filename, variants] of hashes) {
    assert.equal(variants.size, Object.keys(guideContent).length, filename + ' needs a distinct screenshot for every language');
  }
});
