import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAgencyNetworkLines } from "../src/utils/agency-network-preview.js";

test("agency network normalization keeps finite geographic lines", () => {
  const normalized = normalizeAgencyNetworkLines([
      {
        label: "A",
        points: [
          { lat: 46.1, lon: 8.9 },
          { lat: 46.2, lon: 9.0 },
          { lat: 46.3, lon: 9.2 },
        ],
      },
      {
        label: "B",
        points: [
          { lat: 46.15, lon: 8.95 },
          { lat: 46.25, lon: 9.1 },
        ],
      },
    ]);

  assert.equal(normalized.length, 2);
  assert.deepEqual(normalized[0].points[0], { lat: 46.1, lon: 8.9 });
});

test("agency network normalization ignores malformed and incomplete lines", () => {
  const normalized = normalizeAgencyNetworkLines([
    { points: [{ lat: 46, lon: 9 }] },
    { points: [{ lat: "bad", lon: 9 }, { lat: 46, lon: null }] },
  ]);

  assert.deepEqual(normalized, []);
});
