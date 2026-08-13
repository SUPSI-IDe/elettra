import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEditableTripsFromShift,
  resolveDepotPrefillFromStructure,
} from "../src/pages/Fleet/Shifts/shift-utils.js";

const DEPOT_STOP_UUID = "17c61660-2bd8-49a9-8c16-f96a19c16470";
const STATION_STOP_UUID = "b127f6e5-5c4a-4f4d-b436-502c63f535c9";
const WRONG_STATION_UUID = "wrong-station-uuid-000000000001";
const OTHER_DEPOT_STOP_UUID = "635e99bd-8147-4893-a4a8-54e461d80c2d";
const FRIBOURG_STOP_UUID = "aa9d41d9-41bf-40d9-afc5-16e6e7388e1a";

const PRIMARY_DEPOT = {
  id: "915c607f-f11e-49ed-8495-5b36ec0b615a",
  name: "Depo",
  stop_id: DEPOT_STOP_UUID,
};

const OTHER_DEPOT = {
  id: "other-depot-user-id",
  name: "Main depot",
  stop_id: OTHER_DEPOT_STOP_UUID,
};

const WRONG_OUTBOUND_ID = "wrong-outbound-id";
const CORRECT_OUTBOUND_ID = "correct-outbound-id";
const WRONG_RETURN_ID = "wrong-return-id";
const CORRECT_RETURN_ID = "correct-return-id";
const SERVICE_ID = "service-trip-id";

const stop = (id, name) => ({
  id,
  stop_id: id.startsWith("depot_") ? id : `gtfs-${id}`,
  stop_name: name,
});

const stopWithoutId = (name) => ({
  stop_id: `gtfs-${name}`,
  stop_name: name,
});

const tripInfo = (id, gtfsTripId, start, end) => ({
  id,
  trip_id: gtfsTripId,
  start_stop_name: start,
  end_stop_name: end,
});

const dbIds = (trips = []) => trips.map((trip) => trip.id);

const buildDualOutboundShift = () => ({
  shift: {
    structure: [
      {
        trip_id: WRONG_OUTBOUND_ID,
        sequence_number: 2,
        stop_times: [
          stop(DEPOT_STOP_UUID, "Depo"),
          stop(WRONG_STATION_UUID, "Station"),
        ],
      },
      {
        trip_id: CORRECT_OUTBOUND_ID,
        sequence_number: 1,
        stop_times: [
          stop(DEPOT_STOP_UUID, "Depo"),
          stop(STATION_STOP_UUID, "Station"),
        ],
      },
      {
        trip_id: SERVICE_ID,
        sequence_number: 3,
        stop_times: [
          stop(STATION_STOP_UUID, "Station"),
          stop(FRIBOURG_STOP_UUID, "Fribourg"),
        ],
      },
    ],
  },
  shiftInfo: {
    trips: [
      tripInfo(WRONG_OUTBOUND_ID, "depot-wrong-out", "Depo", "Station"),
      tripInfo(CORRECT_OUTBOUND_ID, "depot-correct-out", "Depo", "Station"),
      tripInfo(SERVICE_ID, "260.TA.92-5-A-j26-1.2.H", "Station", "Fribourg"),
    ],
  },
});

const buildDualReturnShift = () => ({
  shift: {
    structure: [
      {
        trip_id: CORRECT_OUTBOUND_ID,
        sequence_number: 1,
        stop_times: [
          stop(DEPOT_STOP_UUID, "Depo"),
          stop(STATION_STOP_UUID, "Station"),
        ],
      },
      {
        trip_id: SERVICE_ID,
        sequence_number: 2,
        stop_times: [
          stop(STATION_STOP_UUID, "Station"),
          stop(FRIBOURG_STOP_UUID, "Fribourg"),
        ],
      },
      {
        trip_id: "service-return-leg",
        sequence_number: 3,
        stop_times: [
          stop(FRIBOURG_STOP_UUID, "Fribourg"),
          stop(STATION_STOP_UUID, "Station"),
        ],
      },
      {
        trip_id: WRONG_RETURN_ID,
        sequence_number: 5,
        stop_times: [
          stop(WRONG_STATION_UUID, "Station"),
          stop(DEPOT_STOP_UUID, "Depo"),
        ],
      },
      {
        trip_id: CORRECT_RETURN_ID,
        sequence_number: 4,
        stop_times: [
          stop(STATION_STOP_UUID, "Station"),
          stop(DEPOT_STOP_UUID, "Depo"),
        ],
      },
    ],
  },
  shiftInfo: {
    trips: [
      tripInfo(CORRECT_OUTBOUND_ID, "depot-out", "Depo", "Station"),
      tripInfo(SERVICE_ID, "260.TA.92-5-A-j26-1.2.H", "Station", "Fribourg"),
      tripInfo("service-return-leg", "460.TA.92-5-A-j26-1.5.R", "Fribourg", "Station"),
      tripInfo(WRONG_RETURN_ID, "depot-wrong-return", "Station", "Depo"),
      tripInfo(CORRECT_RETURN_ID, "depot-correct-return", "Station", "Depo"),
    ],
  },
});

test("outbound: matching stop IDs connect regardless of names", () => {
  const { shift, shiftInfo } = buildDualOutboundShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.ok(editable.some((trip) => trip.id === CORRECT_OUTBOUND_ID));
  assert.equal(editable.some((trip) => trip.id === WRONG_OUTBOUND_ID), false);
});

test("outbound: differing stop IDs do not connect even when names match", () => {
  const { shift, shiftInfo } = buildDualOutboundShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.deepEqual(dbIds(editable), [CORRECT_OUTBOUND_ID, SERVICE_ID]);
});

test("outbound: name fallback works when connection stop IDs are unavailable", () => {
  const shift = {
    structure: [
      {
        trip_id: CORRECT_OUTBOUND_ID,
        sequence_number: 1,
        stop_times: [stopWithoutId("Depo"), stopWithoutId("Station")],
      },
      {
        trip_id: SERVICE_ID,
        sequence_number: 2,
        stop_times: [stopWithoutId("Station"), stopWithoutId("Fribourg")],
      },
    ],
  };
  const shiftInfo = {
    trips: [
      tripInfo(CORRECT_OUTBOUND_ID, "depot-out", "Depo", "Station"),
      tripInfo(SERVICE_ID, "260.TA.92-5-A-j26-1.2.H", "Station", "Fribourg"),
    ],
  };

  const editable = buildEditableTripsFromShift({ shift, shiftInfo });
  assert.deepEqual(dbIds(editable), [CORRECT_OUTBOUND_ID, SERVICE_ID]);
});

test("return: matching stop IDs connect regardless of names", () => {
  const { shift, shiftInfo } = buildDualReturnShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.ok(editable.some((trip) => trip.id === CORRECT_RETURN_ID));
  assert.equal(editable.some((trip) => trip.id === WRONG_RETURN_ID), false);
});

test("return: differing stop IDs do not connect even when names match", () => {
  const { shift, shiftInfo } = buildDualReturnShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.deepEqual(dbIds(editable), [
    CORRECT_OUTBOUND_ID,
    SERVICE_ID,
    "service-return-leg",
    CORRECT_RETURN_ID,
  ]);
});

test("return: name fallback works when connection stop IDs are unavailable", () => {
  const shift = {
    structure: [
      {
        trip_id: CORRECT_OUTBOUND_ID,
        sequence_number: 1,
        stop_times: [stop(DEPOT_STOP_UUID, "Depo"), stopWithoutId("Station")],
      },
      {
        trip_id: SERVICE_ID,
        sequence_number: 2,
        stop_times: [stopWithoutId("Station"), stopWithoutId("Fribourg")],
      },
      {
        trip_id: "service-return-leg",
        sequence_number: 3,
        stop_times: [stopWithoutId("Fribourg"), stopWithoutId("Station")],
      },
      {
        trip_id: CORRECT_RETURN_ID,
        sequence_number: 4,
        stop_times: [stopWithoutId("Station"), stop(DEPOT_STOP_UUID, "Depo")],
      },
    ],
  };
  const shiftInfo = {
    trips: [
      tripInfo(CORRECT_OUTBOUND_ID, "depot-out", "Depo", "Station"),
      tripInfo(SERVICE_ID, "260.TA.92-5-A-j26-1.2.H", "Station", "Fribourg"),
      tripInfo("service-return-leg", "460.TA.92-5-A-j26-1.5.R", "Fribourg", "Station"),
      tripInfo(CORRECT_RETURN_ID, "depot-return", "Station", "Depo"),
    ],
  };

  const editable = buildEditableTripsFromShift({ shift, shiftInfo });
  assert.deepEqual(dbIds(editable), [
    CORRECT_OUTBOUND_ID,
    SERVICE_ID,
    "service-return-leg",
    CORRECT_RETURN_ID,
  ]);
});

test("canonical outbound selector prefers ID-correct leg over higher-sequence wrong-ID leg", () => {
  const { shift, shiftInfo } = buildDualOutboundShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.equal(editable[0]?.id, CORRECT_OUTBOUND_ID);
  assert.notEqual(editable[0]?.id, WRONG_OUTBOUND_ID);
});

test("canonical return selector prefers ID-correct leg over higher-sequence wrong-ID leg", () => {
  const { shift, shiftInfo } = buildDualReturnShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.equal(editable.at(-1)?.id, CORRECT_RETURN_ID);
  assert.notEqual(editable.at(-1)?.id, WRONG_RETURN_ID);
});

test("different start and return depots remain supported after ID precedence fix", () => {
  const shift = {
    structure: [
      {
        trip_id: CORRECT_OUTBOUND_ID,
        sequence_number: 1,
        stop_times: [
          stop(DEPOT_STOP_UUID, "Depo"),
          stop(STATION_STOP_UUID, "Station"),
        ],
      },
      {
        trip_id: SERVICE_ID,
        sequence_number: 2,
        stop_times: [
          stop(STATION_STOP_UUID, "Station"),
          stop(FRIBOURG_STOP_UUID, "Fribourg"),
        ],
      },
      {
        trip_id: "service-return-leg",
        sequence_number: 3,
        stop_times: [
          stop(FRIBOURG_STOP_UUID, "Fribourg"),
          stop(STATION_STOP_UUID, "Station"),
        ],
      },
      {
        trip_id: CORRECT_RETURN_ID,
        sequence_number: 4,
        stop_times: [
          stop(STATION_STOP_UUID, "Station"),
          stop(OTHER_DEPOT_STOP_UUID, "Main depot"),
        ],
      },
    ],
  };
  const shiftInfo = {
    trips: [
      tripInfo(CORRECT_OUTBOUND_ID, "depot-out", "Depo", "Station"),
      tripInfo(SERVICE_ID, "260.TA.92-5-A-j26-1.2.H", "Station", "Fribourg"),
      tripInfo("service-return-leg", "460.TA.92-5-A-j26-1.5.R", "Fribourg", "Station"),
      tripInfo(CORRECT_RETURN_ID, "depot-return", "Station", "Main depot"),
    ],
  };

  const result = resolveDepotPrefillFromStructure({
    shift,
    shiftInfo,
    loadedDepots: [PRIMARY_DEPOT, OTHER_DEPOT],
  });

  assert.equal(result.startDepotId, PRIMARY_DEPOT.id);
  assert.equal(result.endDepotId, OTHER_DEPOT.id);
});
