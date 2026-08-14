import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDepotPrefillFromStructure,
  resolveShiftDepotIds,
} from "../src/pages/Fleet/Shifts/shift-utils.js";

const DEPOT_STOP_UUID = "17c61660-2bd8-49a9-8c16-f96a19c16470";
const VILLARS_STOP_UUID = "b127f6e5-5c4a-4f4d-b436-502c63f535c9";
const FRIBOURG_STOP_UUID = "aa9d41d9-41bf-40d9-afc5-16e6e7388e1a";
const OTHER_DEPOT_STOP_UUID = "635e99bd-8147-4893-a4a8-54e461d80c2d";

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

const stop = (id, name) => ({
  id,
  stop_id: id.startsWith("depot_") ? id : `gtfs-${id}`,
  stop_name: name,
});

const buildL5TestShift = ({
  startDepotName = "Depo",
  endDepotName = "Depo",
  returnDepotStopUuid = DEPOT_STOP_UUID,
} = {}) => ({
  structure: [
    {
      trip_id: "c5998cf8-487a-4ac0-aa96-49a4344deca3",
      sequence_number: 1,
      stop_times: [stop(DEPOT_STOP_UUID, "Depo"), stop(DEPOT_STOP_UUID, "Depo")],
    },
    {
      trip_id: "3cd1887c-d3ed-41d7-bf04-7428846003da",
      sequence_number: 2,
      stop_times: [
        stop(DEPOT_STOP_UUID, startDepotName),
        stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
      ],
    },
    {
      trip_id: "7cc998b8-4aa4-48f8-b69c-2d4ad681ebd9",
      sequence_number: 3,
      stop_times: [
        stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
        stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
      ],
    },
    {
      trip_id: "365bf28d-8835-4f1a-b166-bfdc700d3ac5",
      sequence_number: 4,
      stop_times: [
        stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
        stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
      ],
    },
    {
      trip_id: "e6a4573a-315e-4d08-a87b-79333f0ba4ba",
      sequence_number: 5,
      stop_times: [
        stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
        stop(returnDepotStopUuid, endDepotName),
      ],
    },
  ],
  shiftInfo: {
    trips: [
      {
        id: "c5998cf8-487a-4ac0-aa96-49a4344deca3",
        trip_id: "depot-560f4a44d9b44306964a1f17e55be1d5",
        start_stop_name: "Depo",
        end_stop_name: "Depo",
      },
      {
        id: "3cd1887c-d3ed-41d7-bf04-7428846003da",
        trip_id: "depot-102dda864bc24495b21cceae6d7f318c",
        start_stop_name: startDepotName,
        end_stop_name: "Villars-sur-Glâne, gare",
      },
      {
        id: "7cc998b8-4aa4-48f8-b69c-2d4ad681ebd9",
        trip_id: "260.TA.92-5-A-j26-1.2.H",
        start_stop_name: "Villars-sur-Glâne, gare",
        end_stop_name: "Fribourg, Torry",
      },
      {
        id: "365bf28d-8835-4f1a-b166-bfdc700d3ac5",
        trip_id: "460.TA.92-5-A-j26-1.5.R",
        start_stop_name: "Fribourg, Torry",
        end_stop_name: "Villars-sur-Glâne, gare",
      },
      {
        id: "e6a4573a-315e-4d08-a87b-79333f0ba4ba",
        trip_id: "depot-9aeb2bd4d8cb42b9b82fca5aceb46d59",
        start_stop_name: "Villars-sur-Glâne, gare",
        end_stop_name: endDepotName,
      },
    ],
  },
});

test("start depot via outbound transfer stop UUID", () => {
  const { structure, shiftInfo } = buildL5TestShift();
  const result = resolveDepotPrefillFromStructure({
    shift: { structure },
    shiftInfo,
    loadedDepots: [PRIMARY_DEPOT],
  });
  assert.equal(result.startDepotId, PRIMARY_DEPOT.id);
});

test("return depot via return transfer stop UUID", () => {
  const { structure, shiftInfo } = buildL5TestShift();
  const result = resolveDepotPrefillFromStructure({
    shift: { structure },
    shiftInfo,
    loadedDepots: [PRIMARY_DEPOT],
  });
  assert.equal(result.endDepotId, PRIMARY_DEPOT.id);
});

test("restores both depots when top-level depot IDs are absent", () => {
  const { structure, shiftInfo } = buildL5TestShift();
  const result = resolveShiftDepotIds({
    shift: { structure },
    shiftInfo,
    loadedDepots: [PRIMARY_DEPOT],
  });
  assert.equal(result.startDepotId, PRIMARY_DEPOT.id);
  assert.equal(result.endDepotId, PRIMARY_DEPOT.id);
});

test("does not depend on depot display name when UUIDs match", () => {
  const { structure, shiftInfo } = buildL5TestShift({
    startDepotName: "Completely different display label",
    endDepotName: "Another unrelated label",
  });
  const result = resolveDepotPrefillFromStructure({
    shift: { structure },
    shiftInfo,
    loadedDepots: [{ ...PRIMARY_DEPOT, name: "Main depot" }],
  });
  assert.equal(result.startDepotId, PRIMARY_DEPOT.id);
  assert.equal(result.endDepotId, PRIMARY_DEPOT.id);
});

test("ignores Depo to Depo dwell leg and uses seq 2 and seq 5", () => {
  const { structure, shiftInfo } = buildL5TestShift();
  const result = resolveDepotPrefillFromStructure({
    shift: { structure },
    shiftInfo,
    loadedDepots: [PRIMARY_DEPOT],
  });
  assert.equal(result.startDepotId, PRIMARY_DEPOT.id);
  assert.equal(result.endDepotId, PRIMARY_DEPOT.id);
});

test("resolves a normal shift without dwell leg", () => {
  const shift = {
    structure: [
      {
        trip_id: "aux-out",
        sequence_number: 1,
        stop_times: [
          stop(DEPOT_STOP_UUID, "Depo"),
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
        ],
      },
      {
        trip_id: "gtfs-1",
        sequence_number: 2,
        stop_times: [
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
        ],
      },
      {
        trip_id: "aux-in",
        sequence_number: 3,
        stop_times: [
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
          stop(DEPOT_STOP_UUID, "Depo"),
        ],
      },
    ],
  };
  const shiftInfo = {
    trips: [
      {
        id: "aux-out",
        trip_id: "depot-out",
        start_stop_name: "Depo",
        end_stop_name: "Villars-sur-Glâne, gare",
      },
      {
        id: "gtfs-1",
        trip_id: "260.TA.92-5-A-j26-1.2.H",
        start_stop_name: "Villars-sur-Glâne, gare",
        end_stop_name: "Fribourg, Torry",
      },
      {
        id: "aux-in",
        trip_id: "depot-in",
        start_stop_name: "Fribourg, Torry",
        end_stop_name: "Depo",
      },
    ],
  };

  const result = resolveDepotPrefillFromStructure({
    shift,
    shiftInfo,
    loadedDepots: [PRIMARY_DEPOT],
  });
  assert.equal(result.startDepotId, PRIMARY_DEPOT.id);
  assert.equal(result.endDepotId, PRIMARY_DEPOT.id);
});

test("supports different start and return depots", () => {
  const { structure, shiftInfo } = buildL5TestShift({
    endDepotName: "Main depot",
    returnDepotStopUuid: OTHER_DEPOT_STOP_UUID,
  });
  const result = resolveDepotPrefillFromStructure({
    shift: { structure },
    shiftInfo,
    loadedDepots: [PRIMARY_DEPOT, OTHER_DEPOT],
  });
  assert.equal(result.startDepotId, PRIMARY_DEPOT.id);
  assert.equal(result.endDepotId, OTHER_DEPOT.id);
});

test("returns empty depot IDs when stop UUID does not match any loaded depot", () => {
  const { structure, shiftInfo } = buildL5TestShift();
  const result = resolveDepotPrefillFromStructure({
    shift: { structure },
    shiftInfo,
    loadedDepots: [],
  });
  assert.equal(result.startDepotId, "");
  assert.equal(result.endDepotId, "");
});

test("explicit top-level depot IDs take priority over inferred values", () => {
  const { structure, shiftInfo } = buildL5TestShift();
  const result = resolveShiftDepotIds({
    shift: {
      structure,
      start_depot_id: "explicit-start-id",
      end_depot_id: "explicit-end-id",
    },
    shiftInfo,
    loadedDepots: [PRIMARY_DEPOT],
  });
  assert.equal(result.startDepotId, "explicit-start-id");
  assert.equal(result.endDepotId, "explicit-end-id");
});
