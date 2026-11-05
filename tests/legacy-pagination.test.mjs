import assert from "node:assert/strict";
import test from "node:test";

import { fetchAllLegacyPages } from "../src/api/pagination.js";


test("legacy array pagination loads every page without exceeding 100 rows", async () => {
  const source = Array.from({ length: 237 }, (_, index) => ({ id: index + 1 }));
  const calls = [];

  const rows = await fetchAllLegacyPages(async ({ skip, limit }) => {
    calls.push({ skip, limit });
    return source.slice(skip, skip + limit);
  });

  assert.deepEqual(rows, source);
  assert.deepEqual(calls, [
    { skip: 0, limit: 100 },
    { skip: 100, limit: 100 },
    { skip: 200, limit: 100 },
  ]);
});


test("legacy array pagination probes the next page at an exact boundary", async () => {
  const source = Array.from({ length: 100 }, (_, index) => index);
  const calls = [];

  const rows = await fetchAllLegacyPages(async ({ skip, limit }) => {
    calls.push({ skip, limit });
    return source.slice(skip, skip + limit);
  });

  assert.deepEqual(rows, source);
  assert.deepEqual(calls, [
    { skip: 0, limit: 100 },
    { skip: 100, limit: 100 },
  ]);
});


test("legacy pagination accepts a backend envelope during migration", async () => {
  const calls = [];
  const rows = await fetchAllLegacyPages(async ({ skip, limit }) => {
    calls.push({ skip, limit });
    const items = skip === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }];
    return {
      items,
      total: 3,
      skip,
      limit,
      count: items.length,
      has_next: skip === 0,
      has_previous: skip > 0,
    };
  }, { pageSize: 20 });

  assert.deepEqual(rows, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.deepEqual(calls, [
    { skip: 0, limit: 20 },
    { skip: 2, limit: 20 },
  ]);
});
