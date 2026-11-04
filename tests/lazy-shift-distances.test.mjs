import assert from "node:assert/strict";
import test from "node:test";

import { createLazyShiftDistanceLoader } from "../src/pages/Simulation/Runs/lazy-shift-distances.js";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

test("lazy distance loading deduplicates a shift and preserves the configured concurrency", async () => {
  const gates = new Map();
  const started = [];
  const loaded = [];
  let active = 0;
  let maxActive = 0;
  const loader = createLazyShiftDistanceLoader({
    keyFor: (shift) => shift.id,
    concurrency: 2,
    load: async (shift) => {
      started.push(shift.id);
      active += 1;
      maxActive = Math.max(maxActive, active);
      const gate = deferred();
      gates.set(shift.id, gate);
      const value = await gate.promise;
      active -= 1;
      return value;
    },
    onLoaded: (result, shift) => loaded.push([shift.id, result]),
  });

  const shifts = ["a", "b", "c", "d"].map((id) => ({ id }));
  const all = loader.scheduleAll([...shifts, shifts[0]]);
  await Promise.resolve();
  assert.deepEqual(started, ["a", "b"]);
  assert.equal(maxActive, 2);
  assert.strictEqual(loader.schedule(shifts[0]), loader.schedule(shifts[0]));

  gates.get("a").resolve(1);
  gates.get("b").resolve(2);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["a", "b", "c", "d"]);

  gates.get("c").resolve(3);
  gates.get("d").resolve(4);
  assert.deepEqual(await all, [1, 2, 3, 4, 1]);
  assert.deepEqual(loaded, [["a", 1], ["b", 2], ["c", 3], ["d", 4]]);
  assert.equal(maxActive, 2);
});

test("one distance failure does not block queued shifts and is reported once", async () => {
  const errors = [];
  const loaded = [];
  let attempts = 0;
  const loader = createLazyShiftDistanceLoader({
    keyFor: (shift) => shift.id,
    concurrency: 1,
    load: async (shift) => {
      attempts += 1;
      if (shift.id === "bad") throw new Error("unavailable");
      return shift.id;
    },
    onLoaded: (result) => loaded.push(result),
    onError: (error, shift) => errors.push([shift.id, error.message]),
  });

  assert.deepEqual(
    await loader.scheduleAll([{ id: "bad" }, { id: "good" }, { id: "bad" }]),
    [null, "good", null]
  );
  assert.equal(attempts, 2);
  assert.deepEqual(errors, [["bad", "unavailable"]]);
  assert.deepEqual(loaded, ["good"]);
});

test("disposing the distance loader drops queued work and ignores active results", async () => {
  const activeGate = deferred();
  const started = [];
  const loaded = [];
  const loader = createLazyShiftDistanceLoader({
    keyFor: (shift) => shift.id,
    concurrency: 1,
    load: async (shift) => {
      started.push(shift.id);
      return activeGate.promise;
    },
    onLoaded: (_result, shift) => loaded.push(shift.id),
  });

  const active = loader.schedule({ id: "active" });
  const queued = loader.schedule({ id: "queued" });
  await Promise.resolve();
  loader.dispose();

  assert.equal(await queued, null);
  activeGate.resolve("late result");
  assert.equal(await active, "late result");
  assert.deepEqual(started, ["active"]);
  assert.deepEqual(loaded, []);
  assert.equal(await loader.schedule({ id: "new" }), null);
});

test("invalid loader configuration and items fail safely", async () => {
  assert.throws(() => createLazyShiftDistanceLoader(), /keyFor and load/);
  const loader = createLazyShiftDistanceLoader({
    keyFor: () => "",
    load: async () => {
      throw new Error("must not run");
    },
  });
  assert.equal(await loader.schedule({}), null);
  assert.deepEqual(await loader.scheduleAll(null), []);
});
