import assert from "node:assert/strict";
import test from "node:test";

import { createShiftIndex } from "../src/api/shift-index.js";

const shift = (id, name = `Shift ${id}`) => ({ id, name, trip_count: 3 });

const makeIndex = ({ store = [], listThreshold = 8 } = {}) => {
  const calls = { all: 0 };
  const index = createShiftIndex({
    listThreshold,
    fetchAll: async () => {
      calls.all += 1;
      return store;
    },
  });
  return { index, calls };
};

const ids = (n, prefix = "s") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

test("leaves a narrow request unscreened rather than sweeping for it", async () => {
  const { index, calls } = makeIndex({ store: [shift("s0")] });

  const { candidates, missing, summaries } = await index.screen(["s0", "gone"]);

  assert.deepEqual(candidates, ["s0", "gone"]);
  assert.deepEqual(missing, []);
  assert.equal(summaries.size, 0);
  assert.equal(calls.all, 0);
});

test("sweeps once the request is wide enough and separates the gone ids", async () => {
  const store = ids(5).map((id) => shift(id));
  const { index, calls } = makeIndex({ store, listThreshold: 8 });

  const { candidates, missing } = await index.screen([
    ...ids(5),
    ...ids(3, "gone"),
  ]);

  assert.deepEqual(candidates, ids(5));
  assert.deepEqual(missing, ["gone0", "gone1", "gone2"]);
  assert.equal(calls.all, 1);
});

test("returns the list projection for screened ids", async () => {
  const store = ids(8).map((id) => shift(id, `Name of ${id}`));
  const { index } = makeIndex({ store });

  const { summaries } = await index.screen(ids(8));

  assert.equal(summaries.get("s3").name, "Name of s3");
  assert.equal(summaries.size, 8);
});

test("one sweep serves later screens, however narrow", async () => {
  const store = ids(8).map((id) => shift(id));
  const { index, calls } = makeIndex({ store });

  await index.screen(ids(8));
  const { candidates, missing } = await index.screen(["s1", "gone"]);

  assert.deepEqual(candidates, ["s1"]);
  assert.deepEqual(missing, ["gone"]);
  assert.equal(calls.all, 1);
});

test("a failed sweep fails open, so callers behave as they did before", async () => {
  const index = createShiftIndex({
    listThreshold: 2,
    fetchAll: async () => {
      throw new Error("Network down");
    },
  });

  const { candidates, missing, errors } = await index.screen(["a", "b"]);

  assert.deepEqual(candidates, ["a", "b"]);
  assert.deepEqual(missing, []);
  assert.equal(errors.length, 1);
  assert.match(errors[0].error.message, /Network down/);
});

test("a failed sweep is retried on the next screen", async () => {
  let attempts = 0;
  const index = createShiftIndex({
    listThreshold: 2,
    fetchAll: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("Network down");
      return [shift("a")];
    },
  });

  await index.screen(["a", "b"]);
  const { candidates, missing } = await index.screen(["a", "b"]);

  assert.equal(attempts, 2);
  assert.deepEqual(candidates, ["a"]);
  assert.deepEqual(missing, ["b"]);
});

test("invalidating forces the next wide screen to sweep again", async () => {
  const store = ids(8).map((id) => shift(id));
  const { index, calls } = makeIndex({ store });

  await index.screen(ids(8));
  index.invalidate();
  await index.screen(ids(8));

  assert.equal(calls.all, 2);
});

test("deduplicates ids and coerces them to strings", async () => {
  const { index } = makeIndex({ store: [shift("7")], listThreshold: 1 });

  const { candidates, missing } = await index.screen([7, "7", 7, null, "", 9]);

  assert.deepEqual(candidates, ["7"]);
  assert.deepEqual(missing, ["9"]);
});
