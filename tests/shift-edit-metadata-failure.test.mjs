import assert from "node:assert/strict";
import test from "node:test";

import {
  assessEditRouteReconstruction,
  buildEditableTripsFromShift,
  filterServiceTripsForSave,
  isEditRouteReconstructionSafe,
  mergeStructureWithInfoTrips,
} from "../src/pages/Fleet/Shifts/shift-utils.js";

const DEPOT_STOP_UUID = "17c61660-2bd8-49a9-8c16-f96a19c16470";
const VILLARS_STOP_UUID = "b127f6e5-5c4a-4f4d-b436-502c63f535c9";
const FRIBOURG_STOP_UUID = "aa9d41d9-41bf-40d9-afc5-16e6e7388e1a";

const OUTBOUND_ID = "3cd1887c-d3ed-41d7-bf04-7428846003da";
const SERVICE_A_ID = "7cc998b8-4aa4-48f8-b69c-2d4ad681ebd9";
const SERVICE_B_ID = "365bf28d-8835-4f1a-b166-bfdc700d3ac5";
const RETURN_ID = "e6a4573a-315e-4d08-a87b-79333f0ba4ba";

const stop = (id, name) => ({
  id,
  stop_id: id.startsWith("depot_") ? id : `gtfs-${id}`,
  stop_name: name,
});

const tripInfo = (id, gtfsTripId, start, end) => ({
  id,
  trip_id: gtfsTripId,
  start_stop_name: start,
  end_stop_name: end,
});

const buildCleanFourLegShift = () => ({
  shift: {
    structure: [
      {
        trip_id: OUTBOUND_ID,
        sequence_number: 1,
        stop_times: [
          stop(DEPOT_STOP_UUID, "Depo"),
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
        ],
      },
      {
        trip_id: SERVICE_A_ID,
        sequence_number: 2,
        stop_times: [
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
        ],
      },
      {
        trip_id: SERVICE_B_ID,
        sequence_number: 3,
        stop_times: [
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
        ],
      },
      {
        trip_id: RETURN_ID,
        sequence_number: 4,
        stop_times: [
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
          stop(DEPOT_STOP_UUID, "Depo"),
        ],
      },
    ],
  },
  shiftInfo: {
    trips: [
      tripInfo(OUTBOUND_ID, "depot-out", "Depo", "Villars-sur-Glâne, gare"),
      tripInfo(
        SERVICE_A_ID,
        "260.TA.92-5-A-j26-1.2.H",
        "Villars-sur-Glâne, gare",
        "Fribourg, Torry"
      ),
      tripInfo(
        SERVICE_B_ID,
        "460.TA.92-5-A-j26-1.5.R",
        "Fribourg, Torry",
        "Villars-sur-Glâne, gare"
      ),
      tripInfo(RETURN_ID, "depot-return", "Villars-sur-Glâne, gare", "Depo"),
    ],
  },
});

test("H1: normal Edit reconstruction is safe with valid shift and shiftInfo", () => {
  const { shift, shiftInfo } = buildCleanFourLegShift();
  const assessment = assessEditRouteReconstruction({ shift, shiftInfo });

  assert.equal(assessment.ok, true);
  assert.equal(isEditRouteReconstructionSafe({ shift, shiftInfo }), true);

  const editable = buildEditableTripsFromShift({ shift, shiftInfo });
  assert.equal(filterServiceTripsForSave(editable).length, 2);
});

test("H1: shiftInfo unavailable blocks safe Edit reconstruction", () => {
  const { shift } = buildCleanFourLegShift();
  const assessment = assessEditRouteReconstruction({ shift, shiftInfo: null });

  assert.equal(assessment.ok, false);
  assert.equal(assessment.reason, "missing_shift_info_trips");
  assert.equal(isEditRouteReconstructionSafe({ shift, shiftInfo: null }), false);

  const editable = buildEditableTripsFromShift({ shift, shiftInfo: null });
  assert.equal(editable.length, 0);
});

test("H1: empty or malformed shiftInfo blocks safe Edit reconstruction", () => {
  const { shift } = buildCleanFourLegShift();

  for (const shiftInfo of [{}, { trips: [] }, { trips: null }]) {
    const assessment = assessEditRouteReconstruction({ shift, shiftInfo });
    assert.equal(assessment.ok, false, JSON.stringify(shiftInfo));
    assert.equal(assessment.reason, "missing_shift_info_trips");
  }
});

test("H1: database UUID is not treated as GTFS service trip without info row", () => {
  const structure = [
    {
      trip_id: OUTBOUND_ID,
      sequence_number: 1,
      stop_times: [
        stop(DEPOT_STOP_UUID, "Depo"),
        stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
      ],
    },
  ];

  const merged = mergeStructureWithInfoTrips(structure, []);
  assert.equal(merged[0].gtfs_trip_id, "");
  assert.equal(merged[0].trip_db_id, OUTBOUND_ID);

  const editable = buildEditableTripsFromShift({
    shift: { structure },
    shiftInfo: null,
  });
  assert.equal(editable.length, 0);

  const serviceCandidates = filterServiceTripsForSave([
    {
      id: OUTBOUND_ID,
      trip_id: OUTBOUND_ID,
    },
  ]);
  assert.equal(serviceCandidates.length, 0);
});

test("H1: Create-mode empty structure does not require shiftInfo", () => {
  const assessment = assessEditRouteReconstruction({
    shift: { structure: [] },
    shiftInfo: null,
  });

  assert.equal(assessment.ok, true);
  assert.equal(
    isEditRouteReconstructionSafe({ shift: {}, shiftInfo: null }),
    true
  );
});

test("H1: partial shiftInfo mapping is not saveable", () => {
  const { shift, shiftInfo } = buildCleanFourLegShift();
  const partialShiftInfo = {
    trips: shiftInfo.trips.filter((trip) => trip.id !== SERVICE_B_ID),
  };

  const assessment = assessEditRouteReconstruction({
    shift,
    shiftInfo: partialShiftInfo,
  });

  assert.equal(assessment.ok, false);
  assert.equal(assessment.reason, "incomplete_trip_metadata");
  assert.deepEqual(assessment.missingMetadataDbIds, [SERVICE_B_ID]);
});

test("H1: simulate save guard when reconstruction is blocked", () => {
  const simulateEditSaveAttempt = ({ shift, shiftInfo }) => {
    const assessment = assessEditRouteReconstruction({ shift, shiftInfo });
    if (!assessment.ok) {
      return { allowed: false, reason: assessment.reason };
    }

    const editable = buildEditableTripsFromShift({ shift, shiftInfo });
    const serviceTrips = filterServiceTripsForSave(editable);
    if (serviceTrips.length === 0) {
      return { allowed: false, reason: "no_service_trips" };
    }

    return { allowed: true, serviceTripCount: serviceTrips.length };
  };

  const { shift, shiftInfo } = buildCleanFourLegShift();
  assert.deepEqual(simulateEditSaveAttempt({ shift, shiftInfo }), {
    allowed: true,
    serviceTripCount: 2,
  });

  const blocked = simulateEditSaveAttempt({ shift, shiftInfo: null });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "missing_shift_info_trips");
});
