import assert from 'node:assert/strict';
import test from 'node:test';
import { appendCopyNameSuffix } from '../src/utils/copy-name.js';

for (const suffix of ['_copy','_copia','_copie','_Kopie']) {
  test(`numbered ${suffix} copies retain their base and advance on repeated duplication`, () => {
    let name = 'Summer analysis';
    for (let i = 1; i <= 15; i++) {
      name = appendCopyNameSuffix(name, suffix);
      assert.equal(name, `Summer analysis${suffix}_${i}`);
    }
  });
}
test('legacy repeated and mixed-language suffixes are flattened', () => {
  for (const value of ['Name_copia_copia', 'Name (copy) (copia)', 'Name_copy (Kopie)']) {
    assert.equal(appendCopyNameSuffix(value, '_copia'), 'Name_copia_3');
  }
  assert.equal(appendCopyNameSuffix('Name_copy_7', '_copia'), 'Name_copia_8');
  assert.equal(appendCopyNameSuffix('Name_copy_7_copia', '_copie'), 'Name_copie_9');
});
test('existing family names choose the next unused ordinal, including other languages and gaps', () => {
  const names = ['Name', 'Name_copia_1', 'Name_copy_5', 'Other_copia_99', 'Name_Kopie_3'];
  const snapshot = [...names];
  assert.equal(appendCopyNameSuffix('Name', '_copia', names), 'Name_copia_6');
  assert.equal(appendCopyNameSuffix('Name_copia_1', '_copy', names), 'Name_copy_6');
  assert.deepEqual(names, snapshot);
});
test('ordinary words and numbers inside names are retained', () => {
  for (const name of ['Copy shop', 'Route_12', 'Report_copy_notes', 'My copia report', 'Route_copycat', 'Copy']) {
    assert.equal(appendCopyNameSuffix(name, '_copy'), `${name}_copy_1`);
  }
});
test('parenthesized legacy suffixes use the same numbered convention', () => {
  assert.equal(appendCopyNameSuffix('Name (copy)', '(copy)'), 'Name_copy_2');
  assert.equal(appendCopyNameSuffix('Name (copia)', '_copia'), 'Name_copia_2');
});
test('empty names, whitespace and missing suffixes are handled', () => {
  assert.equal(appendCopyNameSuffix('  Name  ', ' _copia '), 'Name_copia_1');
  assert.equal(appendCopyNameSuffix(null, '_copy'), 'copy_1');
  assert.equal(appendCopyNameSuffix('Name', ''), 'Name');
  assert.equal(appendCopyNameSuffix('copy_1', '_copy'), 'copy_2');
  assert.equal(appendCopyNameSuffix('copy_12', '_copy'), 'copy_13');
});
test('large ordinals do not wrap or lose integer precision', () => {
  assert.equal(appendCopyNameSuffix('Name_copy_9007199254740992', '_copy'), 'Name_copy_9007199254740993');
});
test('custom suffixes are escaped rather than interpreted as regular expressions', () => {
  assert.equal(appendCopyNameSuffix('Name_copy+_2', '_copy+'), 'Name_copy+_3');
});
