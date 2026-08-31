import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAuxiliaryTripResponse } from "../src/api/auxiliary-trip.js";
import { buildCompleteShiftTripIds } from "../src/pages/Fleet/Shifts/depot-trip-ids.js";

test("unwraps the current auxiliary-trip response envelope", () => {
  const trip = { id: "aux-departure", status: "depot" };
  const payload = {
    trip,
    elevation_job: { id: "job-1", status: "pending" },
  };

  assert.equal(normalizeAuxiliaryTripResponse(payload), trip);
});

test("keeps compatibility with a legacy direct auxiliary-trip response", () => {
  const trip = { id: "aux-return", status: "depot" };
  assert.equal(normalizeAuxiliaryTripResponse(trip), trip);
});

test("rejects a successful response without a trip id", () => {
  assert.throws(
    () => normalizeAuxiliaryTripResponse({ trip: { status: "depot" } }),
    /missing trip\.id/
  );
});

test("places depot trips around scheduled trips in sequence order", () => {
  assert.deepEqual(
    buildCompleteShiftTripIds({
      scheduledTripIds: ["service-1", "service-2"],
      departureTrip: { id: "aux-departure" },
      returnTrip: { id: "aux-return" },
    }),
    ["aux-departure", "service-1", "service-2", "aux-return"]
  );
});

test("blocks an incomplete shift when either depot trip is missing", () => {
  assert.throws(
    () =>
      buildCompleteShiftTripIds({
        scheduledTripIds: ["service-1"],
        departureTrip: { id: "aux-departure" },
      }),
    /return auxiliary trip id/
  );
});
