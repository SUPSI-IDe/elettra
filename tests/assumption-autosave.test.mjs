import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssumptionAutosave } from '../src/utils/assumption-autosave.js';

test('autosave coalesces edits and snapshots values without mutating the caller', async () => {
  const writes = [], statuses = [];
  const autosave = createAssumptionAutosave({ save: async value => writes.push(value), onState: value => statuses.push(value.status) });
  const values = { km: { group: 100 } };
  autosave.queue(values); values.km.group = 200; autosave.queue(values); values.km.group = 300;
  await autosave.flush();
  assert.deepEqual(writes, [{ km: { group: 200 } }]);
  assert.equal(statuses.at(-1), 'saved');
  assert.equal(autosave.unsaved, false);
});

test('autosave serializes requests and never reports a stale write as the latest saved edit', async () => {
  const writes = [], statuses = [];
  let finish;
  const autosave = createAssumptionAutosave({ onState: value => statuses.push(value.status), save: async value => {
    writes.push(value);
    if (writes.length === 1) await new Promise(resolve => { finish = resolve; });
  } });
  autosave.queue({ price: 1 }); const first = autosave.flush(); await Promise.resolve();
  autosave.queue({ price: 2 }); autosave.queue({ price: 3 });
  assert.equal(writes.length, 1);
  finish(); await first;
  assert.deepEqual(writes, [{ price: 1 }, { price: 3 }]);
  assert.equal(statuses.filter(s => s === 'saved').length, 1);
  assert.equal(autosave.unsaved, false);
});

test('failed autosave retains the latest edit and can retry, including synchronous errors', async () => {
  let fails = true;
  const writes = [];
  const autosave = createAssumptionAutosave({ onState() {}, save(value) {
    if (fails) throw Error('Offline');
    writes.push(value);
  } });
  autosave.queue({ km: 10 }); await autosave.flush();
  assert.equal(autosave.state.status, 'error'); assert.equal(autosave.unsaved, true);
  fails = false; await autosave.flush();
  assert.deepEqual(writes, [{ km: 10 }]); assert.equal(autosave.state.status, 'saved');
});

test('invalid values cancel queued writes and do not become saved', async () => {
  const writes = [];
  const autosave = createAssumptionAutosave({ onState() {}, save: async value => writes.push(value) });
  autosave.queue({ km: 10 }); autosave.queue(null); await autosave.flush();
  assert.deepEqual(writes, []); assert.equal(autosave.state.status, 'invalid');
  autosave.queue({ km: 20 }); await autosave.flush();
  assert.deepEqual(writes, [{ km: 20 }]); assert.equal(autosave.state.status, 'saved');
});

test('leaving the page flushes a pending edit before the debounce expires', async () => {
  const writes = [];
  const autosave = createAssumptionAutosave({ onState() {}, save: async value => writes.push(value) });
  autosave.queue({ consumption: .65 }); await autosave.dispose();
  assert.deepEqual(writes, [{ consumption: .65 }]);
});
