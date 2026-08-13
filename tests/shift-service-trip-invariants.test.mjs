import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEditableTripsFromShift,
  filterServiceTripsForSave,
  isShiftClosedAtDepot,
  mergeStructureWithInfoTrips,
} from "../src/pages/Fleet/Shifts/shift-utils.js";

const DEPOT_STOP_UUID = "17c61660-2bd8-49a9-8c16-f96a19c16470";
const VILLARS_STOP_UUID = "b127f6e5-5c4a-4f4d-b436-502c63f535c9";
const FRIBOURG_STOP_UUID = "aa9d41d9-41bf-40d9-afc5-16e6e7388e1a";

const PRIMARY_DEPOT = {
  id: "915c607f-f11e-49ed-8495-5b36ec0b615a",
  name: "Depo",
  stop_id: DEPOT_STOP_UUID,
};

const OUTBOUND_ID = "3cd1887c-d3ed-41d7-bf04-7428846003da";
const SERVICE_A_ID = "7cc998b8-4aa4-48f8-b69c-2d4ad681ebd9";
const SERVICE_B_ID = "365bf28d-8835-4f1a-b166-bfdc700d3ac5";
const RETURN_ID = "e6a4573a-315e-4d08-a87b-79333f0ba4ba";
const DWELL_ID = "c5998cf8-487a-4ac0-aa96-49a4344deca3";
const STALE_OUTBOUND_ID = "stale-outbound-id";
const STALE_RETURN_ID = "stale-return-id";

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

const dbIds = (trips = []) => trips.map((trip) => trip.id);

const buildCleanFourLegShift = () => ({
  shift: {
    structure: [
      {
        trip_id: OUTBOUND_ID,
        sequence_number: 1,
        stop_times: [stop(DEPOT_STOP_UUID, "Depo"), stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare")],
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
      tripInfo(SERVICE_A_ID, "260.TA.92-5-A-j26-1.2.H", "Villars-sur-Glâne, gare", "Fribourg, Torry"),
      tripInfo(SERVICE_B_ID, "460.TA.92-5-A-j26-1.5.R", "Fribourg, Torry", "Villars-sur-Glâne, gare"),
      tripInfo(RETURN_ID, "depot-return", "Villars-sur-Glâne, gare", "Depo"),
    ],
  },
});

const buildContaminatedFiveLegShift = () => ({
  shift: {
    structure: [
      {
        trip_id: DWELL_ID,
        sequence_number: 1,
        stop_times: [stop(DEPOT_STOP_UUID, "Depo"), stop(DEPOT_STOP_UUID, "Depo")],
      },
      {
        trip_id: OUTBOUND_ID,
        sequence_number: 2,
        stop_times: [stop(DEPOT_STOP_UUID, "Depo"), stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare")],
      },
      {
        trip_id: SERVICE_A_ID,
        sequence_number: 3,
        stop_times: [
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
        ],
      },
      {
        trip_id: SERVICE_B_ID,
        sequence_number: 4,
        stop_times: [
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
        ],
      },
      {
        trip_id: RETURN_ID,
        sequence_number: 5,
        stop_times: [
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
          stop(DEPOT_STOP_UUID, "Depo"),
        ],
      },
    ],
  },
  shiftInfo: {
    trips: [
      tripInfo(DWELL_ID, "depot-dwell", "Depo", "Depo"),
      tripInfo(OUTBOUND_ID, "depot-out", "Depo", "Villars-sur-Glâne, gare"),
      tripInfo(SERVICE_A_ID, "260.TA.92-5-A-j26-1.2.H", "Villars-sur-Glâne, gare", "Fribourg, Torry"),
      tripInfo(SERVICE_B_ID, "460.TA.92-5-A-j26-1.5.R", "Fribourg, Torry", "Villars-sur-Glâne, gare"),
      tripInfo(RETURN_ID, "depot-return", "Villars-sur-Glâne, gare", "Depo"),
    ],
  },
});

const buildLegacyContaminatedShift = () => ({
  shift: {
    structure: [
      {
        trip_id: DWELL_ID,
        sequence_number: 1,
        stop_times: [stop(DEPOT_STOP_UUID, "Depo"), stop(DEPOT_STOP_UUID, "Depo")],
      },
      {
        trip_id: STALE_OUTBOUND_ID,
        sequence_number: 2,
        stop_times: [stop(DEPOT_STOP_UUID, "Depo"), stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare")],
      },
      {
        trip_id: OUTBOUND_ID,
        sequence_number: 3,
        stop_times: [stop(DEPOT_STOP_UUID, "Depo"), stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare")],
      },
      {
        trip_id: SERVICE_A_ID,
        sequence_number: 4,
        stop_times: [
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
        ],
      },
      {
        trip_id: SERVICE_B_ID,
        sequence_number: 5,
        stop_times: [
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
        ],
      },
      {
        trip_id: STALE_RETURN_ID,
        sequence_number: 6,
        stop_times: [
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
          stop(DEPOT_STOP_UUID, "Depo"),
        ],
      },
      {
        trip_id: RETURN_ID,
        sequence_number: 7,
        stop_times: [
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
          stop(DEPOT_STOP_UUID, "Depo"),
        ],
      },
    ],
  },
  shiftInfo: {
    trips: [
      tripInfo(DWELL_ID, "depot-dwell", "Depo", "Depo"),
      tripInfo(STALE_OUTBOUND_ID, "depot-stale-out", "Depo", "Villars-sur-Glâne, gare"),
      tripInfo(OUTBOUND_ID, "depot-out", "Depo", "Villars-sur-Glâne, gare"),
      tripInfo(SERVICE_A_ID, "260.TA.92-5-A-j26-1.2.H", "Villars-sur-Glâne, gare", "Fribourg, Torry"),
      tripInfo(SERVICE_B_ID, "460.TA.92-5-A-j26-1.5.R", "Fribourg, Torry", "Villars-sur-Glâne, gare"),
      tripInfo(STALE_RETURN_ID, "depot-stale-return", "Fribourg, Torry", "Depo"),
      tripInfo(RETURN_ID, "depot-return", "Villars-sur-Glâne, gare", "Depo"),
    ],
  },
});

const buildThreeLegShift = () => ({
  shift: {
    structure: [
      {
        trip_id: OUTBOUND_ID,
        sequence_number: 1,
        stop_times: [stop(DEPOT_STOP_UUID, "Depo"), stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare")],
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
        trip_id: RETURN_ID,
        sequence_number: 3,
        stop_times: [
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
          stop(DEPOT_STOP_UUID, "Depo"),
        ],
      },
    ],
  },
  shiftInfo: {
    trips: [
      tripInfo(OUTBOUND_ID, "depot-out", "Depo", "Villars-sur-Glâne, gare"),
      tripInfo(SERVICE_A_ID, "260.TA.92-5-A-j26-1.2.H", "Villars-sur-Glâne, gare", "Fribourg, Torry"),
      tripInfo(RETURN_ID, "depot-return", "Fribourg, Torry", "Depo"),
    ],
  },
});

const simulateFreshSaveStructure = ({
  shift,
  shiftInfo,
  serviceTripsForSave,
  outboundId = "fresh-outbound",
  returnId = "fresh-return",
}) => {
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });
  const outboundTemplate =
    editable.find((trip) => trip.id === OUTBOUND_ID) ?? editable[0];
  const returnTemplate =
    editable.find((trip) => trip.id === RETURN_ID) ?? editable[editable.length - 1];

  const firstService = serviceTripsForSave[0];
  const lastService = serviceTripsForSave[serviceTripsForSave.length - 1];
  const firstServiceSource = shift.structure.find((item) => item.trip_id === firstService?.id);
  const lastServiceSource = shift.structure.find((item) => item.trip_id === lastService?.id);
  const depotStop =
    shift.structure
      .flatMap((item) => item.stop_times ?? [])
      .find((entry) => entry.id === DEPOT_STOP_UUID) ?? stop(DEPOT_STOP_UUID, "Depo");
  const firstServiceStart = firstServiceSource?.stop_times?.[0];
  const lastServiceEnd =
    lastServiceSource?.stop_times?.[lastServiceSource.stop_times.length - 1];

  const serviceStructure = serviceTripsForSave.map((trip, index) => {
    const source = shift.structure.find((item) => item.trip_id === trip.id);
    return {
      trip_id: trip.id,
      sequence_number: index + 2,
      stop_times: source?.stop_times ?? [],
    };
  });

  const outboundStopTimes =
    firstServiceStart ? [depotStop, firstServiceStart] : (
      shift.structure.find((item) => item.trip_id === outboundTemplate.id)?.stop_times ?? []
    );
  const returnStopTimes =
    lastServiceEnd ? [lastServiceEnd, depotStop] : (
      shift.structure.find((item) => item.trip_id === returnTemplate.id)?.stop_times ?? []
    );

  const structure = [
    {
      trip_id: outboundId,
      sequence_number: 1,
      stop_times: outboundStopTimes,
    },
    ...serviceStructure.map((item, index) => ({
      ...item,
      sequence_number: index + 2,
    })),
    {
      trip_id: returnId,
      sequence_number: serviceStructure.length + 2,
      stop_times: returnStopTimes,
    },
  ];

  const outboundEndName =
    firstService?.start_stop_name ??
    outboundTemplate?.end_stop_name ??
    "Villars-sur-Glâne, gare";
  const returnStartName =
    lastService?.end_stop_name ??
    returnTemplate?.start_stop_name ??
    outboundEndName;

  const trips = [
    tripInfo(
      outboundId,
      `depot-${outboundId}`,
      outboundTemplate?.start_stop_name ?? "Depo",
      outboundEndName
    ),
    ...serviceTripsForSave.map((trip) =>
      tripInfo(trip.id, trip.trip_id, trip.start_stop_name, trip.end_stop_name)
    ),
    tripInfo(
      returnId,
      `depot-${returnId}`,
      returnStartName,
      returnTemplate?.end_stop_name ?? "Depo"
    ),
  ];

  return {
    shift: { structure },
    shiftInfo: { trips },
  };
};

test("canonical Edit load keeps outbound, services, and return in order", () => {
  const { shift, shiftInfo } = buildCleanFourLegShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.deepEqual(dbIds(editable), [OUTBOUND_ID, SERVICE_A_ID, SERVICE_B_ID, RETURN_ID]);
});

test("Depo→Depo dwell leg is removed from editable trips", () => {
  const { shift, shiftInfo } = buildContaminatedFiveLegShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.deepEqual(dbIds(editable), [OUTBOUND_ID, SERVICE_A_ID, SERVICE_B_ID, RETURN_ID]);
  assert.equal(editable.some((trip) => trip.id === DWELL_ID), false);
});

test("contaminated legacy structure keeps one outbound, services, and one return", () => {
  const { shift, shiftInfo } = buildLegacyContaminatedShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.deepEqual(dbIds(editable), [OUTBOUND_ID, SERVICE_A_ID, SERVICE_B_ID, RETURN_ID]);
  assert.equal(editable.some((trip) => trip.id === DWELL_ID), false);
  assert.equal(editable.some((trip) => trip.id === STALE_OUTBOUND_ID), false);
  assert.equal(editable.some((trip) => trip.id === STALE_RETURN_ID), false);
});

test("Save projection keeps only service GTFS trips", () => {
  const { shift, shiftInfo } = buildCleanFourLegShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });
  const serviceTrips = filterServiceTripsForSave(editable);

  assert.deepEqual(dbIds(serviceTrips), [SERVICE_A_ID, SERVICE_B_ID]);
});

test("defensive Save projection ignores contaminated selectedTrips aux legs", () => {
  const contaminatedSelectedTrips = [
    {
      id: DWELL_ID,
      trip_id: "depot-dwell",
      start_stop_name: "Depo",
      end_stop_name: "Depo",
    },
    {
      id: STALE_OUTBOUND_ID,
      trip_id: "depot-stale-out",
      start_stop_name: "Depo",
      end_stop_name: "Villars-sur-Glâne, gare",
    },
    {
      id: SERVICE_A_ID,
      trip_id: "260.TA.92-5-A-j26-1.2.H",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
    },
    {
      id: SERVICE_B_ID,
      trip_id: "460.TA.92-5-A-j26-1.5.R",
      start_stop_name: "Fribourg, Torry",
      end_stop_name: "Villars-sur-Glâne, gare",
    },
    {
      id: STALE_RETURN_ID,
      trip_id: "depot-stale-return",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Depo",
    },
  ];

  const serviceTrips = filterServiceTripsForSave(contaminatedSelectedTrips);
  assert.deepEqual(dbIds(serviceTrips), [SERVICE_A_ID, SERVICE_B_ID]);
});

test("A2 preserved: removing return leg reopens closed shift while Return location stays Depo", () => {
  const { shift, shiftInfo } = buildCleanFourLegShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });
  const initialSelectedTripDbIds = new Set(dbIds(editable));

  assert.equal(
    isShiftClosedAtDepot({
      selectedTrips: editable,
      endDepotId: PRIMARY_DEPOT.id,
      loadedDepots: [PRIMARY_DEPOT],
      shift,
      shiftInfo,
      initialSelectedTripDbIds,
    }),
    true
  );

  const afterRemoval = editable.filter((trip) => trip.id !== RETURN_ID);
  assert.equal(
    isShiftClosedAtDepot({
      selectedTrips: afterRemoval,
      endDepotId: PRIMARY_DEPOT.id,
      loadedDepots: [PRIMARY_DEPOT],
      shift,
      shiftInfo,
      initialSelectedTripDbIds,
    }),
    false
  );
});

test("one service trip save projection yields a single service UUID", () => {
  const { shift, shiftInfo } = buildThreeLegShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });
  const serviceTrips = filterServiceTripsForSave(editable);

  assert.deepEqual(dbIds(serviceTrips), [SERVICE_A_ID]);
  assert.equal(editable.length, 3);
});

test("two service trips save projection yields both service UUIDs", () => {
  const { shift, shiftInfo } = buildCleanFourLegShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });
  const serviceTrips = filterServiceTripsForSave(editable);

  assert.deepEqual(dbIds(serviceTrips), [SERVICE_A_ID, SERVICE_B_ID]);
  assert.equal(editable.length, 4);
});

test("unknown unclassifiable leg is excluded from save projection", () => {
  const selectedTrips = [
    {
      id: OUTBOUND_ID,
      trip_id: "depot-out",
      start_stop_name: "Depo",
      end_stop_name: "Villars-sur-Glâne, gare",
    },
    {
      id: "unknown-leg",
      trip_id: "unknown-leg",
      start_stop_name: "Mystery",
      end_stop_name: "Elsewhere",
    },
    {
      id: SERVICE_A_ID,
      trip_id: "260.TA.92-5-A-j26-1.2.H",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
    },
  ];

  const serviceTrips = filterServiceTripsForSave(selectedTrips);
  assert.deepEqual(dbIds(serviceTrips), [SERVICE_A_ID]);
});

test("4 → 3 → 4 regression stays stable without Depo→Depo accumulation", () => {
  const initial = buildCleanFourLegShift();
  let editable = buildEditableTripsFromShift(initial);
  assert.equal(editable.length, 4);

  let serviceTrips = filterServiceTripsForSave(editable);
  assert.equal(serviceTrips.length, 2);

  const savedFour = simulateFreshSaveStructure({
    shift: initial.shift,
    shiftInfo: initial.shiftInfo,
    serviceTripsForSave: serviceTrips,
    outboundId: "save1-out",
    returnId: "save1-return",
  });
  assert.equal(savedFour.shift.structure.length, 4);
  assert.equal(savedFour.shift.structure.some((item) => item.trip_id === DWELL_ID), false);

  editable = buildEditableTripsFromShift(savedFour);
  serviceTrips = filterServiceTripsForSave(editable.filter((trip) => trip.id !== SERVICE_B_ID));
  assert.equal(serviceTrips.length, 1);

  const savedThree = simulateFreshSaveStructure({
    shift: savedFour.shift,
    shiftInfo: savedFour.shiftInfo,
    serviceTripsForSave: serviceTrips,
    outboundId: "save2-out",
    returnId: "save2-return",
  });
  editable = buildEditableTripsFromShift(savedThree);
  assert.equal(editable.length, 3);

  serviceTrips = filterServiceTripsForSave(editable);
  assert.equal(serviceTrips.length, 1);

  const reloadedThree = buildEditableTripsFromShift(savedThree);
  const returnLeg = reloadedThree.at(-1);
  const serviceB = initial.shiftInfo.trips.find((trip) => trip.id === SERVICE_B_ID);
  const editableWithB = [
    ...reloadedThree.slice(0, -1),
    {
      id: SERVICE_B_ID,
      trip_id: serviceB.trip_id,
      start_stop_name: serviceB.start_stop_name,
      end_stop_name: serviceB.end_stop_name,
    },
    returnLeg,
  ];

  serviceTrips = filterServiceTripsForSave(editableWithB);
  assert.deepEqual(dbIds(serviceTrips), [SERVICE_A_ID, SERVICE_B_ID]);

  const savedFourAgain = simulateFreshSaveStructure({
    shift: {
      structure: [
        ...savedThree.shift.structure,
        ...initial.shift.structure.filter((item) => item.trip_id === SERVICE_B_ID),
      ],
    },
    shiftInfo: savedThree.shiftInfo,
    serviceTripsForSave: serviceTrips,
    outboundId: "save3-out",
    returnId: "save3-return",
  });

  assert.equal(savedFourAgain.shift.structure.length, 4);
  assert.equal(
    savedFourAgain.shift.structure.some((item) => item.trip_id === DWELL_ID),
    false
  );
  assert.equal(
    savedFourAgain.shiftInfo.trips.some(
      (trip) => trip.start_stop_name === "Depo" && trip.end_stop_name === "Depo"
    ),
    false
  );

  const finalEditable = buildEditableTripsFromShift(savedFourAgain);
  assert.equal(finalEditable.length, 4);
  assert.deepEqual(dbIds(filterServiceTripsForSave(finalEditable)), [SERVICE_A_ID, SERVICE_B_ID]);
});

const CENTRAL_STOP_UUID = "c1a2b3c4-d5e6-7890-abcd-ef1234567890";
const CIRCULAR_SERVICE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567891";

const buildCircularServiceShift = ({ sameEndpointBy = "name" } = {}) => {
  const circularStopTimes =
    sameEndpointBy === "id" ?
      [
        stop(CENTRAL_STOP_UUID, "Central"),
        stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
        stop(CENTRAL_STOP_UUID, "Central"),
      ]
    : [
        stop(CENTRAL_STOP_UUID, "Central"),
        stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
        stop(CENTRAL_STOP_UUID, "Central"),
      ];

  return {
    shift: {
      structure: [
        {
          trip_id: OUTBOUND_ID,
          sequence_number: 1,
          stop_times: [stop(DEPOT_STOP_UUID, "Depo"), stop(CENTRAL_STOP_UUID, "Central")],
        },
        {
          trip_id: CIRCULAR_SERVICE_ID,
          sequence_number: 2,
          stop_times: circularStopTimes,
        },
        {
          trip_id: RETURN_ID,
          sequence_number: 3,
          stop_times: [stop(CENTRAL_STOP_UUID, "Central"), stop(DEPOT_STOP_UUID, "Depo")],
        },
      ],
    },
    shiftInfo: {
      trips: [
        tripInfo(OUTBOUND_ID, "depot-out", "Depo", "Central"),
        tripInfo(CIRCULAR_SERVICE_ID, "123.TA.92-5-A-j26-1.2.H", "Central", "Central"),
        tripInfo(RETURN_ID, "depot-return", "Central", "Depo"),
      ],
    },
  };
};

test("M1: circular GTFS service with same endpoint names remains service on Save", () => {
  const circularService = {
    id: CIRCULAR_SERVICE_ID,
    trip_id: "123.TA.92-5-A-j26-1.2.H",
    status: "gtfs",
    start_stop_name: "Central",
    end_stop_name: "Central",
  };

  const selectedTrips = [
    {
      id: OUTBOUND_ID,
      trip_id: "depot-out",
      start_stop_name: "Depo",
      end_stop_name: "Central",
    },
    circularService,
    {
      id: RETURN_ID,
      trip_id: "depot-return",
      start_stop_name: "Central",
      end_stop_name: "Depo",
    },
  ];

  const serviceTrips = filterServiceTripsForSave(selectedTrips);
  assert.deepEqual(dbIds(serviceTrips), [CIRCULAR_SERVICE_ID]);
});

test("M1: circular GTFS service with same endpoint stop IDs remains service on Save", () => {
  const circularService = {
    id: CIRCULAR_SERVICE_ID,
    trip_id: "123.TA.92-5-A-j26-1.2.H",
    status: "gtfs",
    start_stop_name: "Central",
    end_stop_name: "Central",
    stop_times: [
      stop(CENTRAL_STOP_UUID, "Central"),
      stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
      stop(CENTRAL_STOP_UUID, "Central"),
    ],
  };

  const serviceTrips = filterServiceTripsForSave([circularService]);
  assert.deepEqual(dbIds(serviceTrips), [CIRCULAR_SERVICE_ID]);
});

test("M1: non-loop GTFS service still classified as service on Save", () => {
  const service = {
    id: SERVICE_A_ID,
    trip_id: "260.TA.92-5-A-j26-1.2.H",
    status: "gtfs",
    start_stop_name: "Villars-sur-Glâne, gare",
    end_stop_name: "Fribourg, Torry",
  };

  const serviceTrips = filterServiceTripsForSave([service]);
  assert.deepEqual(dbIds(serviceTrips), [SERVICE_A_ID]);
});

test("M1: depot-* same-stop leg remains excluded from Save projection", () => {
  const dwell = {
    id: DWELL_ID,
    trip_id: "depot-dwell",
    start_stop_name: "Depo",
    end_stop_name: "Depo",
  };

  const serviceTrips = filterServiceTripsForSave([dwell]);
  assert.deepEqual(serviceTrips, []);
});

test("M1: depot-* transfer leg remains excluded from Save projection", () => {
  const transfer = {
    id: OUTBOUND_ID,
    trip_id: "depot-out",
    start_stop_name: "Depo",
    end_stop_name: "Villars-sur-Glâne, gare",
  };

  const serviceTrips = filterServiceTripsForSave([transfer]);
  assert.deepEqual(serviceTrips, []);
});

test("M1: circular GTFS service preserved in Edit reconstruction", () => {
  const { shift, shiftInfo } = buildCircularServiceShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.deepEqual(dbIds(editable), [OUTBOUND_ID, CIRCULAR_SERVICE_ID, RETURN_ID]);
  assert.equal(
    editable.find((trip) => trip.id === CIRCULAR_SERVICE_ID)?.start_stop_name,
    "Central"
  );
  assert.equal(
    editable.find((trip) => trip.id === CIRCULAR_SERVICE_ID)?.end_stop_name,
    "Central"
  );
});

test("M1: circular GTFS service with same endpoint IDs preserved in Edit reconstruction", () => {
  const { shift, shiftInfo } = buildCircularServiceShift({ sameEndpointBy: "id" });
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.deepEqual(dbIds(editable), [OUTBOUND_ID, CIRCULAR_SERVICE_ID, RETURN_ID]);
});

test("M1: contaminated Depo→Depo legacy dwell still removed from Edit", () => {
  const { shift, shiftInfo } = buildContaminatedFiveLegShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });

  assert.deepEqual(dbIds(editable), [OUTBOUND_ID, SERVICE_A_ID, SERVICE_B_ID, RETURN_ID]);
  assert.equal(editable.some((trip) => trip.id === DWELL_ID), false);
});

test("M1: conflicting metadata — explicit depot status excludes from Save even with GTFS trip_id shape", () => {
  const conflicting = {
    id: SERVICE_A_ID,
    trip_id: "260.TA.92-5-A-j26-1.2.H",
    status: "depot",
    start_stop_name: "Villars-sur-Glâne, gare",
    end_stop_name: "Fribourg, Torry",
  };

  const serviceTrips = filterServiceTripsForSave([conflicting]);
  assert.deepEqual(serviceTrips, []);
});

test("M1: conflicting metadata — depot-* trip_id excludes from Save even with gtfs status", () => {
  const conflicting = {
    id: DWELL_ID,
    trip_id: "depot-dwell",
    status: "gtfs",
    start_stop_name: "Depo",
    end_stop_name: "Depo",
  };

  const serviceTrips = filterServiceTripsForSave([conflicting]);
  assert.deepEqual(serviceTrips, []);
});

test("M1: circular service Save yields 3-trip persisted structure", () => {
  const { shift, shiftInfo } = buildCircularServiceShift();
  const editable = buildEditableTripsFromShift({ shift, shiftInfo });
  const serviceTrips = filterServiceTripsForSave(editable);

  assert.deepEqual(dbIds(serviceTrips), [CIRCULAR_SERVICE_ID]);

  const saved = simulateFreshSaveStructure({
    shift,
    shiftInfo,
    serviceTripsForSave: serviceTrips,
    outboundId: "fresh-circular-out",
    returnId: "fresh-circular-return",
  });

  assert.equal(saved.shift.structure.length, 3);
  assert.deepEqual(
    dbIds(filterServiceTripsForSave(buildEditableTripsFromShift(saved))),
    [CIRCULAR_SERVICE_ID]
  );
});

test("repeated resave remains 4 → 4 → 4 without auxiliary accumulation", () => {
  const initial = buildCleanFourLegShift();
  let current = {
    shift: initial.shift,
    shiftInfo: initial.shiftInfo,
  };

  for (let round = 0; round < 3; round += 1) {
    const editable = buildEditableTripsFromShift(current);
    assert.equal(editable.length, 4);

    const serviceTrips = filterServiceTripsForSave(editable);
    assert.deepEqual(dbIds(serviceTrips), [SERVICE_A_ID, SERVICE_B_ID]);

    current = simulateFreshSaveStructure({
      shift: current.shift,
      shiftInfo: current.shiftInfo,
      serviceTripsForSave: serviceTrips,
      outboundId: `round-${round}-out`,
      returnId: `round-${round}-return`,
    });

    assert.equal(current.shift.structure.length, 4);
    const merged = mergeStructureWithInfoTrips(
      current.shift.structure,
      current.shiftInfo.trips
    );
    assert.equal(
      merged.some(
        (leg) => leg.start_stop_name === "Depo" && leg.end_stop_name === "Depo"
      ),
      false
    );
  }
});
