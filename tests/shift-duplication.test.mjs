import assert from "node:assert/strict";
import test from "node:test";

import { buildDuplicateShiftPayload } from "../src/pages/Fleet/Shifts/shift-utils.js";

const OPTS = { copySuffix: "(copy)", untitledLabel: "Untitled shift" };

test("appends the copy suffix to the shift name", () => {
  const payload = buildDuplicateShiftPayload(
    { name: "40308", bus_id: "bus-1", structure: [] },
    OPTS
  );
  assert.equal(payload.name, "40308 (copy)");
});

test("falls back to the untitled label when the name is missing", () => {
  const payload = buildDuplicateShiftPayload(
    { bus_id: "bus-1", structure: [] },
    OPTS
  );
  assert.equal(payload.name, "Untitled shift (copy)");
});

test("resolves busId from top-level bus_id", () => {
  const payload = buildDuplicateShiftPayload(
    { name: "S", bus_id: "bus-top", structure: [] },
    OPTS
  );
  assert.equal(payload.busId, "bus-top");
});

test("resolves busId from a nested bus object when bus_id is absent", () => {
  const payload = buildDuplicateShiftPayload(
    { name: "S", bus: { id: "bus-nested" }, structure: [] },
    OPTS
  );
  assert.equal(payload.busId, "bus-nested");
});

test("collects trip UUIDs from structure trip_id in sequence order", () => {
  // Deliberately provide the structure out of sequence order.
  const shift = {
    name: "40308",
    bus_id: "bus-1",
    structure: [
      { id: "row-2", trip_id: "trip-b", sequence_number: 2 },
      { id: "row-1", trip_id: "trip-a", sequence_number: 1 },
      { id: "row-3", trip_id: "trip-c", sequence_number: 3 },
    ],
  };
  const payload = buildDuplicateShiftPayload(shift, OPTS);
  assert.deepEqual(payload.tripIds, ["trip-a", "trip-b", "trip-c"]);
});

test("keeps original order when sequence numbers are missing", () => {
  const shift = {
    name: "S",
    bus_id: "bus-1",
    structure: [
      { id: "row-1", trip_id: "trip-x" },
      { id: "row-2", trip_id: "trip-y" },
    ],
  };
  const payload = buildDuplicateShiftPayload(shift, OPTS);
  assert.deepEqual(payload.tripIds, ["trip-x", "trip-y"]);
});

test("ignores structure entries without a trip id", () => {
  const shift = {
    name: "S",
    bus_id: "bus-1",
    structure: [
      { id: "row-1", trip_id: "trip-a", sequence_number: 1 },
      { id: "row-2", sequence_number: 2 },
      { id: "row-3", trip_id: "", sequence_number: 3 },
    ],
  };
  const payload = buildDuplicateShiftPayload(shift, OPTS);
  assert.deepEqual(payload.tripIds, ["trip-a"]);
});

test("returns an empty trip list when structure is missing", () => {
  const payload = buildDuplicateShiftPayload(
    { name: "S", bus_id: "bus-1" },
    OPTS
  );
  assert.deepEqual(payload.tripIds, []);
});

test("does not mutate the source structure array", () => {
  const structure = [
    { id: "row-2", trip_id: "trip-b", sequence_number: 2 },
    { id: "row-1", trip_id: "trip-a", sequence_number: 1 },
  ];
  const snapshot = structure.map((item) => item.id);
  buildDuplicateShiftPayload({ name: "S", bus_id: "b", structure }, OPTS);
  assert.deepEqual(
    structure.map((item) => item.id),
    snapshot
  );
});
