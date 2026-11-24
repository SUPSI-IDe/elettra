import assert from 'node:assert/strict';
import test from 'node:test';
import { appendCopyNameSuffix } from '../src/utils/copy-name.js';

for (const suffix of ['_copy', '_copia', '_copie', '_Kopie']) {
  test(`${suffix} starts unnumbered and copies of copies stay in the original family`, () => {
    const names = ['Summer analysis'];
    for (let ordinal = 0; ordinal <= 15; ordinal++) {
      const name = appendCopyNameSuffix(names.at(-1), suffix, names);
      assert.equal(name, `Summer analysis${suffix}${ordinal ? `_${ordinal}` : ''}`);
      names.push(name);
    }
  });
}

test('families use the first available ordinal across languages, capitalization and Unicode forms', () => {
  const names = ['Linéa', 'LINÉA_copie', 'Linéa_copia_1', 'Linéa_copy_5', 'Other_copia_2', 'Linéa_Kopie_3'];
  const snapshot = [...names];
  assert.equal(appendCopyNameSuffix('Linéa', '_copia', names), 'Linéa_copia_2');
  assert.equal(appendCopyNameSuffix('Linéa_copia_1', '_copy', names), 'Linéa_copy_2');
  assert.deepEqual(names, snapshot);
});

test('a numbered copy can reuse the unnumbered slot when it is available', () => {
  assert.equal(appendCopyNameSuffix('Name_copy_7', '_copia'), 'Name_copia');
  assert.equal(appendCopyNameSuffix('Name_copia', '_copy'), 'Name_copy_1');
});

test('legacy parenthesized suffixes occupy the corresponding slots', () => {
  assert.equal(appendCopyNameSuffix('Name (copy)', '(copy)'), 'Name_copy_1');
  assert.equal(appendCopyNameSuffix('Name (copia_2)', '_copia', ['Name (copy)', 'Name_copy_1']), 'Name_copia_3');
});

test('legacy stacked and mixed-language suffixes are flattened for the family', () => {
  for (const value of ['Name_copia_copia', 'Name (copy) (copia)', 'Name_copy (Kopie)']) {
    assert.equal(appendCopyNameSuffix(value, '_copia', ['Name_copy', 'Name_copie_1']), 'Name_copia_3');
  }
  assert.equal(appendCopyNameSuffix('Name_copy_7_copia', '_copie'), 'Name_copie');
});

test('ordinary words and numbers inside names are retained', () => {
  for (const name of ['Copy shop', 'Route_12', 'Report_copy_notes', 'My copia report', 'Route_copycat', 'Copy']) {
    assert.equal(appendCopyNameSuffix(name, '_copy'), `${name}_copy`);
  }
});

test('empty names, whitespace and missing suffixes are handled', () => {
  assert.equal(appendCopyNameSuffix('  Name  ', ' _copia '), 'Name_copia');
  assert.equal(appendCopyNameSuffix(null, '_copy'), '_copy');
  assert.equal(appendCopyNameSuffix('Name', ''), 'Name');
  assert.equal(appendCopyNameSuffix('copy_1', '_copy', ['_copy']), '_copy_2');
});

test('a large legacy ordinal does not prevent choosing the first free slot', () => {
  assert.equal(appendCopyNameSuffix('Name_copy_9007199254740992', '_copy', ['Name_copy']), 'Name_copy_1');
});

test('custom suffixes are escaped rather than interpreted as regular expressions', () => {
  assert.equal(appendCopyNameSuffix('Name_copy+_2', '_copy+', ['Name_copy+', 'Name_copy+_1']), 'Name_copy+_3');
});
