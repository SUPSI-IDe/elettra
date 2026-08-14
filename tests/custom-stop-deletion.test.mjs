import assert from "node:assert/strict";
import test from "node:test";

import {
  DELETE_ERROR_KIND,
  DeleteResponseError,
  readDeleteResponse,
} from "../src/api/delete-response.js";
import {
  DELETION_BLOCKER_TYPES,
  guardProtectedDeletion,
} from "../src/utils/protected-delete.js";
import { resolveDepotStopIdsFromShiftForDeletion } from "../src/pages/Fleet/Shifts/shift-utils.js";
import {
  aggregateDepotDeletionBlockers,
  collectDepotDeletionBlockers,
  findOptimizationRunBlockersForDepots,
  findShiftBlockersForDepots,
  hydrateRecordsWithDetails,
  prepareCustomStopDeletion,
  resolveCustomStopDeleteFailure,
  resolveDepotIdsFromShift,
  resolveSelectedDepotStopIds,
  runReferencesAnyDepot,
  shiftReferencesAnyDepot,
} from "../src/utils/custom-stop-deletion.js";

const EN = {
  "custom_stops.delete_blocked_intro":
    "The selected custom stop(s) cannot be deleted because they are still used by:",
  "custom_stops.delete_blocked_footer":
    "Delete the related shifts and feasibility evaluations first and then try again.",
  "custom_stops.delete_dependency_check_failed":
    "ELETTRA could not verify whether the selected custom stop(s) are in use. Please try again.",
  "protected_delete.blocked_item_named": '{typeLabel} "{name}"',
  "protected_delete.blocker_type.shift": "Shift",
  "protected_delete.blocker_type.optimization_run": "Feasibility evaluation",
  "delete_error.blocked": "Unable to delete: this resource is still in use.",
  "delete_error.generic": "Unable to delete resource.",
};

const IT = {
  ...EN,
  "custom_stops.delete_blocked_intro":
    "La/le fermata/e personalizzata/e selezionata/e non può/possono essere eliminata/e perché è/sono ancora utilizzata/e da:",
  "protected_delete.blocker_type.shift": "Turno",
  "protected_delete.blocker_type.optimization_run": "Valutazione di fattibilità",
};

const translate = (dict) => (key, params = {}) => {
  let text = dict[key] ?? key;
  Object.entries(params).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, String(value));
  });
  return text;
};

const tEn = translate(EN);
const tIt = translate(IT);

const DEPOT_A_ID = "915c607f-f11e-49ed-8495-5b36ec0b615a";
const DEPOT_A_STOP = "17c61660-2bd8-49a9-8c16-f96a19c16470";
const DEPOT_B_ID = "depot-b-primary";
const DEPOT_B_STOP = "depot-b-stop";
const DEPOT_UNUSED_ID = "depot-unused-primary";
const DEPOT_UNUSED_STOP = "depot-unused-stop";

const depots = [
  { id: DEPOT_A_ID, stop_id: DEPOT_A_STOP, name: "Depo" },
  { id: DEPOT_B_ID, stop_id: DEPOT_B_STOP, name: "Depot B" },
  { id: DEPOT_UNUSED_ID, stop_id: DEPOT_UNUSED_STOP, name: "Unused" },
];

const tripStopsByTripId = {
  "outbound-leg": [
    { id: DEPOT_A_STOP, stop_name: "Depo" },
    { id: "station-a", stop_name: "Villars-sur-Glâne, gare" },
  ],
  "service-leg": [
    { id: "station-a", stop_name: "Villars-sur-Glâne, gare" },
    { id: "station-b", stop_name: "Fribourg, Torry" },
  ],
  "return-leg": [
    { id: "station-b", stop_name: "Fribourg, Torry" },
    { id: DEPOT_A_STOP, stop_name: "Depo" },
  ],
  "outbound-leg-b": [
    { id: DEPOT_B_STOP, stop_name: "Depot B" },
    { id: "station-a", stop_name: "Villars-sur-Glâne, gare" },
  ],
  "return-leg-b": [
    { id: "station-b", stop_name: "Fribourg, Torry" },
    { id: DEPOT_B_STOP, stop_name: "Depot B" },
  ],
  "outbound-only-leg": [
    { id: DEPOT_A_STOP, stop_name: "Depo" },
    { id: "station-a", stop_name: "Villars-sur-Glâne, gare" },
  ],
  "return-only-leg": [
    { id: "station-b", stop_name: "Fribourg, Torry" },
    { id: DEPOT_A_STOP, stop_name: "Depo" },
  ],
  "circular-service-leg": [
    { id: "hub-stop", stop_name: "Hub" },
    { id: "hub-stop", stop_name: "Hub" },
  ],
};

const shiftInfoBothDepotLegs = {
  trips: [
    {
      id: "outbound-leg",
      trip_id: "depot-out-a",
      start_stop_name: "Depo",
      end_stop_name: "Villars-sur-Glâne, gare",
      sequence_number: 1,
    },
    {
      id: "service-leg",
      trip_id: "259.TA.92-5-A-j26-1.2.H",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
      sequence_number: 2,
    },
    {
      id: "return-leg",
      trip_id: "depot-ret-a",
      start_stop_name: "Fribourg, Torry",
      end_stop_name: "Depo",
      sequence_number: 3,
    },
  ],
};

const shiftDetailBothDepotLegs = {
  id: "shift-both",
  name: "14.08.2026_TEST_DELETE",
  bus_id: "bus-1",
  structure: [
    { trip_id: "outbound-leg", sequence_number: 1 },
    { trip_id: "service-leg", sequence_number: 2 },
    { trip_id: "return-leg", sequence_number: 3 },
  ],
};

const shiftDetailDifferentDepots = {
  id: "shift-mixed",
  name: "Mixed depots",
  bus_id: "bus-1",
  structure: [
    { trip_id: "outbound-leg-b", sequence_number: 1 },
    { trip_id: "service-leg", sequence_number: 2 },
    { trip_id: "return-leg-b", sequence_number: 3 },
  ],
};

const shiftInfoDifferentDepots = {
  trips: [
    {
      id: "outbound-leg-b",
      trip_id: "depot-out-b",
      start_stop_name: "Depot B",
      end_stop_name: "Villars-sur-Glâne, gare",
      sequence_number: 1,
    },
    {
      id: "service-leg",
      trip_id: "259.TA.92-5-A-j26-1.2.H",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
      sequence_number: 2,
    },
    {
      id: "return-leg-b",
      trip_id: "depot-ret-b",
      start_stop_name: "Fribourg, Torry",
      end_stop_name: "Depot B",
      sequence_number: 3,
    },
  ],
};

const shiftDetailOutboundOnly = {
  id: "shift-outbound-only",
  name: "Outbound only",
  bus_id: "bus-1",
  structure: [
    { trip_id: "outbound-only-leg", sequence_number: 1 },
    { trip_id: "service-leg", sequence_number: 2 },
  ],
};

const shiftInfoOutboundOnly = {
  trips: [
    {
      id: "outbound-only-leg",
      trip_id: "depot-out-only",
      start_stop_name: "Depo",
      end_stop_name: "Villars-sur-Glâne, gare",
      sequence_number: 1,
    },
    {
      id: "service-leg",
      trip_id: "259.TA.92-5-A-j26-1.2.H",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
      sequence_number: 2,
    },
  ],
};

const shiftDetailReturnOnly = {
  id: "shift-return-only",
  name: "Return only",
  bus_id: "bus-1",
  structure: [
    { trip_id: "service-leg", sequence_number: 1 },
    { trip_id: "return-only-leg", sequence_number: 2 },
  ],
};

const shiftInfoReturnOnly = {
  trips: [
    {
      id: "service-leg",
      trip_id: "259.TA.92-5-A-j26-1.2.H",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
      sequence_number: 1,
    },
    {
      id: "return-only-leg",
      trip_id: "depot-ret-only",
      start_stop_name: "Fribourg, Torry",
      end_stop_name: "Depo",
      sequence_number: 2,
    },
  ],
};

const shiftDetailNoDepotLegs = {
  id: "shift-service-only",
  name: "Service only",
  bus_id: "bus-1",
  structure: [{ trip_id: "service-leg", sequence_number: 1 }],
};

const shiftInfoNoDepotLegs = {
  trips: [
    {
      id: "service-leg",
      trip_id: "259.TA.92-5-A-j26-1.2.H",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
      sequence_number: 1,
    },
  ],
};

const shiftDetailCircularService = {
  id: "shift-circular",
  name: "Circular service",
  bus_id: "bus-1",
  structure: [{ trip_id: "circular-service-leg", sequence_number: 1 }],
};

const shiftInfoCircularService = {
  trips: [
    {
      id: "circular-service-leg",
      trip_id: "259.TA.92-5-A-j26-1.2.H",
      start_stop_name: "Hub",
      end_stop_name: "Hub",
      sequence_number: 1,
    },
  ],
};

const runDetails = [
  {
    id: "run-1",
    name: "14.08.2026_TEST_DELETE_COPY",
    input_params: {
      charging_stations: [{ stop_id: DEPOT_A_STOP }],
    },
  },
  {
    id: "run-2",
    name: "Summer case",
    input_params: { charging_stations: [{ stop_id: DEPOT_B_STOP }] },
  },
  { id: "run-3", name: "Irrelevant", input_params: { charging_stations: [] } },
];

const fetchTripStops = async (tripId) => tripStopsByTripId[tripId] ?? [];

const shiftDetailsById = {
  "shift-both": shiftDetailBothDepotLegs,
  "shift-mixed": shiftDetailDifferentDepots,
  "shift-outbound-only": shiftDetailOutboundOnly,
  "shift-return-only": shiftDetailReturnOnly,
  "shift-service-only": shiftDetailNoDepotLegs,
  "shift-circular": shiftDetailCircularService,
};

const shiftInfoById = {
  "shift-both": shiftInfoBothDepotLegs,
  "shift-mixed": shiftInfoDifferentDepots,
  "shift-outbound-only": shiftInfoOutboundOnly,
  "shift-return-only": shiftInfoReturnOnly,
  "shift-service-only": shiftInfoNoDepotLegs,
  "shift-circular": shiftInfoCircularService,
};

const enrichShift = async (shift) => ({
  ...shift,
  _depotStopIds: await resolveDepotStopIdsFromShiftForDeletion({
    shift,
    shiftInfo: shiftInfoById[shift.id],
    fetchTripStops,
  }),
});

test("resolveSelectedDepotStopIds maps depot.id to depot.stop_id", () => {
  assert.deepEqual(resolveSelectedDepotStopIds([DEPOT_A_ID], depots), {
    ok: true,
    stopIds: [DEPOT_A_STOP],
  });
});

test("resolveSelectedDepotStopIds fails when depot.stop_id is missing", () => {
  assert.deepEqual(resolveSelectedDepotStopIds(["missing-depot"], depots), {
    ok: false,
    stopIds: [],
  });
});

test("findOptimizationRunBlockersForDepots matches charging stop_id to depot.stop_id", () => {
  assert.deepEqual(findOptimizationRunBlockersForDepots(runDetails, [DEPOT_A_STOP]), [
    {
      type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN,
      id: "run-1",
      name: "14.08.2026_TEST_DELETE_COPY",
    },
  ]);
});

test("findOptimizationRunBlockersForDepots does not match depot primary key", () => {
  assert.equal(findOptimizationRunBlockersForDepots(runDetails, [DEPOT_A_ID]).length, 0);
});

test("resolveDepotStopIdsFromShiftForDeletion resolves outbound and return depot legs", async () => {
  const stopIds = await resolveDepotStopIdsFromShiftForDeletion({
    shift: shiftDetailBothDepotLegs,
    shiftInfo: shiftInfoBothDepotLegs,
    fetchTripStops,
  });
  assert.deepEqual(stopIds, [DEPOT_A_STOP]);
});

test("findShiftBlockersForDepots blocks when outbound and return use same depot", async () => {
  const shift = await enrichShift(shiftDetailBothDepotLegs);
  assert.deepEqual(findShiftBlockersForDepots([shift], [DEPOT_A_STOP]), [
    {
      type: DELETION_BLOCKER_TYPES.SHIFT,
      id: "shift-both",
      name: "14.08.2026_TEST_DELETE",
    },
  ]);
});

test("findShiftBlockersForDepots matches only selected depot for mixed depots", async () => {
  const shift = await enrichShift(shiftDetailDifferentDepots);
  assert.deepEqual(findShiftBlockersForDepots([shift], [DEPOT_B_STOP]), [
    { type: DELETION_BLOCKER_TYPES.SHIFT, id: "shift-mixed", name: "Mixed depots" },
  ]);
  assert.equal(findShiftBlockersForDepots([shift], [DEPOT_A_STOP]).length, 0);
});

test("findShiftBlockersForDepots handles outbound-only depot leg", async () => {
  const shift = await enrichShift(shiftDetailOutboundOnly);
  assert.equal(findShiftBlockersForDepots([shift], [DEPOT_A_STOP]).length, 1);
});

test("findShiftBlockersForDepots handles return-only depot leg", async () => {
  const shift = await enrichShift(shiftDetailReturnOnly);
  assert.equal(findShiftBlockersForDepots([shift], [DEPOT_A_STOP]).length, 1);
});

test("findShiftBlockersForDepots ignores shifts without depot legs", async () => {
  const shift = await enrichShift(shiftDetailNoDepotLegs);
  assert.equal(findShiftBlockersForDepots([shift], [DEPOT_A_STOP]).length, 0);
});

test("findShiftBlockersForDepots does not treat circular service leg as depot leg", async () => {
  const shift = await enrichShift(shiftDetailCircularService);
  assert.equal(findShiftBlockersForDepots([shift], ["hub-stop"]).length, 0);
});

test("collectDepotDeletionBlockers aggregates shift and optimization-run blockers", async () => {
  const blockers = await collectDepotDeletionBlockers({
    selectedDepotStopIds: [DEPOT_A_STOP],
    fetchAllShifts: async () => [{ id: "shift-both", name: shiftDetailBothDepotLegs.name }],
    fetchShiftDetail: async (id) => shiftDetailsById[id],
    fetchShiftInfo: async (id) => shiftInfoById[id],
    fetchTripStops,
    fetchAllOptimizationRuns: async () => [{ id: "run-1", name: runDetails[0].name }],
    fetchOptimizationRunDetail: async (id) => runDetails.find((run) => run.id === id),
  });

  assert.equal(blockers.length, 2);
  assert.equal(
    blockers.some((blocker) => blocker.type === DELETION_BLOCKER_TYPES.SHIFT),
    true
  );
  assert.equal(
    blockers.some((blocker) => blocker.type === DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN),
    true
  );
});

test("prepareCustomStopDeletion fails safe when depot.stop_id cannot be resolved", async () => {
  const messages = [];
  const result = await prepareCustomStopDeletion({
    selectedDepotIds: ["missing-depot"],
    depots,
    fetchAllShifts: async () => [],
    fetchShiftDetail: async () => ({}),
    fetchShiftInfo: async () => ({}),
    fetchTripStops,
    fetchAllOptimizationRuns: async () => [],
    fetchOptimizationRunDetail: async () => ({}),
    showFlash: (message) => messages.push(message),
    translate: tEn,
  });

  assert.equal(result.proceed, false);
  assert.equal(result.reason, "dependency_check_failed");
  assert.match(messages[0], /could not verify/i);
});

test("prepareCustomStopDeletion fails safe when shift info lookup fails", async () => {
  const result = await prepareCustomStopDeletion({
    selectedDepotIds: [DEPOT_A_ID],
    depots,
    fetchAllShifts: async () => [{ id: "shift-both", name: "Blocked" }],
    fetchShiftDetail: async (id) => shiftDetailsById[id],
    fetchShiftInfo: async () => {
      throw new Error("shift info failed");
    },
    fetchTripStops,
    fetchAllOptimizationRuns: async () => [],
    fetchOptimizationRunDetail: async () => ({}),
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, false);
  assert.equal(result.reason, "dependency_check_failed");
});

test("prepareCustomStopDeletion fails safe when required trip stop lookup fails", async () => {
  const result = await prepareCustomStopDeletion({
    selectedDepotIds: [DEPOT_A_ID],
    depots,
    fetchAllShifts: async () => [{ id: "shift-both", name: "Blocked" }],
    fetchShiftDetail: async (id) => shiftDetailsById[id],
    fetchShiftInfo: async (id) => shiftInfoById[id],
    fetchTripStops: async () => [],
    fetchAllOptimizationRuns: async () => [],
    fetchOptimizationRunDetail: async () => ({}),
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, false);
  assert.equal(result.reason, "dependency_check_failed");
});

test("prepareCustomStopDeletion blocks before confirm/delete for used depot", async () => {
  const result = await prepareCustomStopDeletion({
    selectedDepotIds: [DEPOT_A_ID],
    depots,
    fetchAllShifts: async () => [{ id: "shift-both", name: shiftDetailBothDepotLegs.name }],
    fetchShiftDetail: async (id) => shiftDetailsById[id],
    fetchShiftInfo: async (id) => shiftInfoById[id],
    fetchTripStops,
    fetchAllOptimizationRuns: async () => runDetails.map(({ id, name }) => ({ id, name })),
    fetchOptimizationRunDetail: async (id) => runDetails.find((run) => run.id === id),
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, false);
  assert.equal(result.blockers.length, 2);
});

test("prepareCustomStopDeletion allows deletion when no blockers exist", async () => {
  const result = await prepareCustomStopDeletion({
    selectedDepotIds: [DEPOT_UNUSED_ID],
    depots,
    fetchAllShifts: async () => [shiftDetailBothDepotLegs],
    fetchShiftDetail: async (id) => shiftDetailsById[id] ?? shiftDetailBothDepotLegs,
    fetchShiftInfo: async (id) => shiftInfoById[id] ?? shiftInfoBothDepotLegs,
    fetchTripStops,
    fetchAllOptimizationRuns: async () => runDetails,
    fetchOptimizationRunDetail: async (id) => runDetails.find((run) => run.id === id),
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, true);
});

test("prepareCustomStopDeletion uses Italian labels for mixed blockers", async () => {
  const messages = [];
  await prepareCustomStopDeletion({
    selectedDepotIds: [DEPOT_A_ID],
    depots,
    fetchAllShifts: async () => [{ id: "shift-both", name: shiftDetailBothDepotLegs.name }],
    fetchShiftDetail: async (id) => shiftDetailsById[id],
    fetchShiftInfo: async (id) => shiftInfoById[id],
    fetchTripStops,
    fetchAllOptimizationRuns: async () => [{ id: "run-1", name: runDetails[0].name }],
    fetchOptimizationRunDetail: async () => runDetails[0],
    showFlash: (message) => messages.push(message),
    translate: tIt,
  });

  assert.match(messages[0], /fermata\/e personalizzata\/e/i);
  assert.match(messages[0], /Turno "14.08.2026_TEST_DELETE"/);
  assert.match(messages[0], /Valutazione di fattibilità "14.08.2026_TEST_DELETE_COPY"/);
});

test("prepareCustomStopDeletion blocks whole multi-select when any depot is used", async () => {
  const result = await prepareCustomStopDeletion({
    selectedDepotIds: [DEPOT_A_ID, DEPOT_UNUSED_ID],
    depots,
    fetchAllShifts: async () => [{ id: "shift-both", name: shiftDetailBothDepotLegs.name }],
    fetchShiftDetail: async (id) => shiftDetailsById[id],
    fetchShiftInfo: async (id) => shiftInfoById[id],
    fetchTripStops,
    fetchAllOptimizationRuns: async () => [],
    fetchOptimizationRunDetail: async () => ({}),
    showFlash: () => {},
    translate: tEn,
  });

  assert.equal(result.proceed, false);
});

test("hydrateRecordsWithDetails loads shift structure from detail endpoint", async () => {
  const fetched = [];
  const hydrated = await hydrateRecordsWithDetails({
    records: [{ id: "shift-both", name: shiftDetailBothDepotLegs.name }],
    getRecordId: (shift) => shift?.id,
    hasReliableFields: (shift) => Array.isArray(shift?.structure) && shift.structure.length > 0,
    fetchDetail: async (id) => {
      fetched.push(id);
      return shiftDetailsById[id];
    },
  });

  assert.deepEqual(fetched, ["shift-both"]);
  assert.equal(hydrated[0].structure.length, 3);
});

test("resolveDepotIdsFromShift keeps explicit-field fallback for legacy shapes", () => {
  assert.deepEqual(resolveDepotIdsFromShift({ start_depot_id: "legacy-id" }), ["legacy-id"]);
});

test("shiftReferencesAnyDepot and runReferencesAnyDepot compare stop ids", () => {
  const selected = new Set([DEPOT_A_STOP]);
  assert.equal(
    shiftReferencesAnyDepot({ _depotStopIds: [DEPOT_A_STOP] }, selected),
    true
  );
  assert.equal(
    runReferencesAnyDepot(
      { input_params: { charging_stations: [{ stop_id: DEPOT_A_STOP }] } },
      selected
    ),
    true
  );
});

test("resolveCustomStopDeleteFailure formats structured 409 blockers", () => {
  const error = new DeleteResponseError("Still referenced.", {
    status: 409,
    kind: DELETE_ERROR_KIND.BLOCKED,
    blockers: [
      { type: DELETION_BLOCKER_TYPES.SHIFT, name: "14.08.2026_TEST_DELETE" },
      { type: DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN, name: "14.08.2026_TEST_DELETE_COPY" },
    ],
  });

  const resolved = resolveCustomStopDeleteFailure(error, tEn);
  assert.match(resolved.message, /custom stop\(s\) cannot be deleted/i);
  assert.match(resolved.message, /14.08.2026_TEST_DELETE/);
});

test("readDeleteResponse success behavior unchanged for depot deletes", async () => {
  const response = new Response(null, { status: 204 });
  await assert.deepEqual(await readDeleteResponse(response), { deleted: true });
});

test("guardProtectedDeletion prevents confirm/delete when blockers exist", () => {
  let confirmReached = false;
  let deleteReached = false;

  const { blocked } = guardProtectedDeletion({
    blockers: [{ type: DELETION_BLOCKER_TYPES.SHIFT, name: "14.08.2026_TEST_DELETE" }],
    showFlash: () => {},
    translate: tEn,
    introKey: "custom_stops.delete_blocked_intro",
    footerKey: "custom_stops.delete_blocked_footer",
  });

  if (!blocked) {
    confirmReached = true;
    deleteReached = true;
  }

  assert.equal(blocked, true);
  assert.equal(confirmReached, false);
  assert.equal(deleteReached, false);
});
