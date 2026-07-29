import assert from "node:assert/strict";
import test from "node:test";

import { createPredictionRunIndex } from "../src/api/prediction-run-index.js";

const run = (id, extra = {}) => ({ id, status: "completed", ...extra });

const notFound = (id) => {
  const error = new Error(`Prediction run ${id} not found`);
  error.status = 404;
  return error;
};

const makeIndex = ({ store = [], listThreshold = 7 } = {}) => {
  const calls = { one: [], all: 0 };
  const index = createPredictionRunIndex({
    listThreshold,
    fetchOne: async (id) => {
      calls.one.push(id);
      const found = store.find((item) => item.id === id);
      if (!found) throw notFound(id);
      return found;
    },
    fetchAll: async () => {
      calls.all += 1;
      return store;
    },
  });
  return { index, calls };
};

test("resolves a narrow fan-out one id at a time", async () => {
  const { index, calls } = makeIndex({ store: [run("a"), run("b")] });

  const { runs, missing, errors } = await index.resolve(["a", "b"]);

  assert.deepEqual(runs.map((r) => r.id), ["a", "b"]);
  assert.deepEqual(missing, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(calls.one, ["a", "b"]);
  assert.equal(calls.all, 0);
});

test("switches to the list endpoint once the fan-out reaches the threshold", async () => {
  const store = Array.from({ length: 9 }, (_, i) => run(`id-${i}`));
  const { index, calls } = makeIndex({ store, listThreshold: 7 });

  const { runs } = await index.resolve(store.map((r) => r.id));

  assert.equal(runs.length, 9);
  assert.equal(calls.all, 1);
  assert.deepEqual(calls.one, []);
});

test("reports ids the server does not have as missing, not as errors", async () => {
  const { index } = makeIndex({ store: [run("a")] });

  const { runs, missing, errors } = await index.resolve(["a", "gone"]);

  assert.deepEqual(runs.map((r) => r.id), ["a"]);
  assert.deepEqual(missing, ["gone"]);
  assert.deepEqual(errors, []);
});

test("keeps request failures separate from missing runs", async () => {
  const index = createPredictionRunIndex({
    fetchOne: async () => {
      throw Object.assign(new Error("Service Unavailable"), { status: 503 });
    },
    fetchAll: async () => [],
  });

  const { runs, missing, errors } = await index.resolve(["a"]);

  assert.deepEqual(runs, []);
  assert.deepEqual(missing, ["a"]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].id, "a");
  assert.match(errors[0].error.message, /Service Unavailable/);
});

test("a list fetch settles every requested id, so absences are not retried", async () => {
  const store = Array.from({ length: 7 }, (_, i) => run(`id-${i}`));
  const { index, calls } = makeIndex({ store, listThreshold: 7 });
  const ids = [...store.map((r) => r.id), "gone"];

  const first = await index.resolve(ids);
  const second = await index.resolve(ids);

  assert.deepEqual(first.missing, ["gone"]);
  assert.deepEqual(second.missing, ["gone"]);
  assert.equal(calls.all, 1);
  assert.deepEqual(calls.one, []);
});

test("does not re-request runs it already holds", async () => {
  const { index, calls } = makeIndex({ store: [run("a"), run("b")] });

  await index.resolve(["a"]);
  await index.resolve(["a", "b"]);

  assert.deepEqual(calls.one, ["a", "b"]);
});

test("refresh re-requests the named ids only", async () => {
  const store = [run("a"), run("b")];
  const { index, calls } = makeIndex({ store });

  await index.resolve(["a", "b"]);
  store[0] = run("a", { status: "failed" });
  const { byId } = await index.resolve(["a"], { refresh: true });

  assert.equal(byId.get("a").status, "failed");
  assert.deepEqual(calls.one, ["a", "b", "a"]);
});

test("deduplicates ids and coerces them to strings", async () => {
  const { index, calls } = makeIndex({ store: [run("7")] });

  const { runs, byId } = await index.resolve([7, "7", 7, null, ""]);

  assert.deepEqual(calls.one, ["7"]);
  assert.equal(runs.length, 1);
  assert.equal(byId.get("7").id, "7");
});

test("a failed list fetch reports an error rather than inventing absences", async () => {
  const index = createPredictionRunIndex({
    listThreshold: 2,
    fetchOne: async () => {
      throw new Error("should not be called");
    },
    fetchAll: async () => {
      throw new Error("Network down");
    },
  });

  const { missing, errors } = await index.resolve(["a", "b"]);

  assert.deepEqual(missing, ["a", "b"]);
  assert.equal(errors.length, 1);
  assert.match(errors[0].error.message, /Network down/);
});

test("accepts a paginated list payload as well as a bare array", async () => {
  const index = createPredictionRunIndex({
    listThreshold: 1,
    fetchOne: async () => null,
    fetchAll: async () => ({ items: [run("a")] }),
  });

  const { runs } = await index.resolve(["a"]);

  assert.deepEqual(runs.map((r) => r.id), ["a"]);
});
