import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { guideContent } from '../guide/content.js';

test('all guide screenshots reserve their real intrinsic dimensions in every language', async () => {
  const files = new Set();
  for (const [language, content] of Object.entries(guideContent)) {
    for (const figure of content.sections.flatMap(section => section.figures ?? [])) {
      const png = await readFile(new URL(figure.src));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      const actual = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
      assert.deepEqual({ width: figure.width, height: figure.height }, actual, language + ': ' + figure.src);
      files.add(figure.src);
    }
  }
  assert.equal(files.size, 10);
});
