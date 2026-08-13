import assert from "node:assert/strict";
import test from "node:test";

import {
  getEligibleScheduledTrips,
  isShiftClosedAtDepot,
  resolveScheduledTripsEmptyMessageKey,
} from "../src/pages/Fleet/Shifts/shift-utils.js";

const DEPOT_STOP_UUID = "17c61660-2bd8-49a9-8c16-f96a19c16470";
const VILLARS_STOP_UUID = "b127f6e5-5c4a-4f4d-b436-502c63f535c9";
const FRIBOURG_STOP_UUID = "aa9d41d9-41bf-40d9-afc5-16e6e7388e1a";

const PRIMARY_DEPOT = {
  id: "915c607f-f11e-49ed-8495-5b36ec0b615a",
  name: "Depo",
  stop_id: DEPOT_STOP_UUID,
};

const stop = (id, name) => ({
  id,
  stop_id: id.startsWith("depot_") ? id : `gtfs-${id}`,
  stop_name: name,
});

const buildL5ClosedShift = () => ({
  shift: {
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
          stop(DEPOT_STOP_UUID, "Depo"),
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
          stop(DEPOT_STOP_UUID, "Depo"),
        ],
      },
    ],
  },
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
        start_stop_name: "Depo",
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
        end_stop_name: "Depo",
      },
    ],
  },
});

const buildClosedShift = () => ({
  shift: {
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
          stop(DEPOT_STOP_UUID, "Depo"),
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
        trip_id: "e6a4573a-315e-4d08-a87b-79333f0ba4ba",
        sequence_number: 4,
        stop_times: [
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
          stop(DEPOT_STOP_UUID, "Depo"),
        ],
      },
    ],
  },
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
        start_stop_name: "Depo",
        end_stop_name: "Villars-sur-Glâne, gare",
      },
      {
        id: "7cc998b8-4aa4-48f8-b69c-2d4ad681ebd9",
        trip_id: "260.TA.92-5-A-j26-1.2.H",
        start_stop_name: "Villars-sur-Glâne, gare",
        end_stop_name: "Fribourg, Torry",
      },
      {
        id: "e6a4573a-315e-4d08-a87b-79333f0ba4ba",
        trip_id: "depot-9aeb2bd4d8cb42b9b82fca5aceb46d59",
        start_stop_name: "Fribourg, Torry",
        end_stop_name: "Depo",
      },
    ],
  },
});

const buildOpenShift = () => ({
  shift: {
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
        trip_id: "gtfs-2",
        sequence_number: 3,
        stop_times: [
          stop(FRIBOURG_STOP_UUID, "Fribourg, Torry"),
          stop(VILLARS_STOP_UUID, "Villars-sur-Glâne, gare"),
        ],
      },
    ],
  },
  shiftInfo: {
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
        id: "gtfs-2",
        trip_id: "460.TA.92-5-A-j26-1.5.R",
        start_stop_name: "Fribourg, Torry",
        end_stop_name: "Villars-sur-Glâne, gare",
      },
    ],
  },
});

const serviceTripsClosed = [
  {
    id: "3cd1887c-d3ed-41d7-bf04-7428846003da",
    trip_id: "depot-102dda864bc24495b21cceae6d7f318c",
    start_stop_name: "Depo",
    end_stop_name: "Villars-sur-Glâne, gare",
    departure_time: "09:00",
    arrival_time: "09:20",
  },
  {
    id: "7cc998b8-4aa4-48f8-b69c-2d4ad681ebd9",
    trip_id: "260.TA.92-5-A-j26-1.2.H",
    start_stop_name: "Villars-sur-Glâne, gare",
    end_stop_name: "Fribourg, Torry",
    departure_time: "09:41",
    arrival_time: "10:10",
  },
];

const serviceTripsOpen = [
  {
    id: "gtfs-1",
    trip_id: "260.TA.92-5-A-j26-1.2.H",
    start_stop_name: "Villars-sur-Glâne, gare",
    end_stop_name: "Fribourg, Torry",
    departure_time: "09:41",
    arrival_time: "10:10",
  },
  {
    id: "gtfs-2",
    trip_id: "460.TA.92-5-A-j26-1.5.R",
    start_stop_name: "Fribourg, Torry",
    end_stop_name: "Villars-sur-Glâne, gare",
    departure_time: "10:20",
    arrival_time: "10:50",
  },
];

const selectedTripIdsFrom = (trips = []) =>
  new Set(trips.map((trip) => trip.trip_id).filter(Boolean));

const text = (value) => (value === null || value === undefined ? "" : String(value));

const selectedDbIdsFrom = (trips = []) =>
  new Set(trips.map((trip) => text(trip?.id).trim()).filter(Boolean));

test("closed at depot selects the closed-shift empty-state message", () => {
  const { shift, shiftInfo } = buildClosedShift();
  const selectedTrips = serviceTripsClosed;
  const candidateTrips = [
    {
      trip_id: "candidate-1",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
      departure_time: "11:00",
      arrival_time: "11:30",
    },
  ];

  const eligibleTrips = getEligibleScheduledTrips({
    trips: candidateTrips,
    selectedTripIds: selectedTripIdsFrom(selectedTrips),
    lastTripEndTime: "10:10",
    lastTripEndStop: "Fribourg, Torry",
    shiftStartTime: "09:00",
    shiftEndTime: "10:15",
  });

  assert.equal(eligibleTrips.length, 0);
  assert.equal(
    isShiftClosedAtDepot({
      selectedTrips,
      endDepotId: PRIMARY_DEPOT.id,
      loadedDepots: [PRIMARY_DEPOT],
      shift,
      shiftInfo,
    }),
    true
  );
  assert.equal(
    resolveScheduledTripsEmptyMessageKey({
      eligibleTripsCount: eligibleTrips.length,
      currentTripsCount: candidateTrips.length,
      isClosedAtDepot: true,
    }),
    "shifts.shift_closed_at_depot"
  );
});

test("open shift with no eligible candidates keeps the generic empty-state message", () => {
  const { shift, shiftInfo } = buildOpenShift();
  const selectedTrips = serviceTripsOpen;
  const candidateTrips = [
    {
      trip_id: "candidate-1",
      start_stop_name: "Depo",
      end_stop_name: "Villars-sur-Glâne, gare",
      departure_time: "08:00",
      arrival_time: "08:20",
    },
  ];

  const eligibleTrips = getEligibleScheduledTrips({
    trips: candidateTrips,
    selectedTripIds: selectedTripIdsFrom(selectedTrips),
    lastTripEndTime: "10:50",
    lastTripEndStop: "Villars-sur-Glâne, gare",
    shiftStartTime: "09:00",
    shiftEndTime: "11:00",
  });

  assert.equal(eligibleTrips.length, 0);
  assert.equal(
    isShiftClosedAtDepot({
      selectedTrips,
      endDepotId: PRIMARY_DEPOT.id,
      loadedDepots: [PRIMARY_DEPOT],
      shift,
      shiftInfo,
    }),
    false
  );
  assert.equal(
    resolveScheduledTripsEmptyMessageKey({
      eligibleTripsCount: eligibleTrips.length,
      currentTripsCount: candidateTrips.length,
      isClosedAtDepot: false,
    }),
    "shifts.no_valid_trips_to_add"
  );
});

test("eligible candidates do not show an empty-state message", () => {
  const candidateTrips = [
    {
      trip_id: "candidate-1",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
      departure_time: "11:00",
      arrival_time: "11:30",
    },
  ];

  const eligibleTrips = getEligibleScheduledTrips({
    trips: candidateTrips,
    selectedTripIds: selectedTripIdsFrom(serviceTripsOpen),
    lastTripEndTime: "10:50",
    lastTripEndStop: "Villars-sur-Glâne, gare",
    shiftStartTime: "09:00",
    shiftEndTime: "12:00",
  });

  assert.equal(eligibleTrips.length, 1);
  assert.equal(
    resolveScheduledTripsEmptyMessageKey({
      eligibleTripsCount: eligibleTrips.length,
      currentTripsCount: candidateTrips.length,
      isClosedAtDepot: false,
    }),
    null
  );
});

test("removing return leg while keeping Return location configured reopens ADD messaging", () => {
  const { shift, shiftInfo } = buildL5ClosedShift();
  const returnDepotLeg = {
    id: "e6a4573a-315e-4d08-a87b-79333f0ba4ba",
    trip_id: "depot-9aeb2bd4d8cb42b9b82fca5aceb46d59",
    start_stop_name: "Villars-sur-Glâne, gare",
    end_stop_name: "Depo",
    departure_time: "11:00",
    arrival_time: "11:20",
  };
  const selectedTripsWithReturn = [
    {
      id: "7cc998b8-4aa4-48f8-b69c-2d4ad681ebd9",
      trip_id: "260.TA.92-5-A-j26-1.2.H",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
      departure_time: "09:41",
      arrival_time: "10:10",
    },
    {
      id: "365bf28d-8835-4f1a-b166-bfdc700d3ac5",
      trip_id: "460.TA.92-5-A-j26-1.5.R",
      start_stop_name: "Fribourg, Torry",
      end_stop_name: "Villars-sur-Glâne, gare",
      departure_time: "10:20",
      arrival_time: "10:50",
    },
    returnDepotLeg,
  ];
  const initialSelectedTripDbIds = selectedDbIdsFrom(selectedTripsWithReturn);
  const closedArgs = {
    selectedTrips: selectedTripsWithReturn,
    endDepotId: PRIMARY_DEPOT.id,
    loadedDepots: [PRIMARY_DEPOT],
    shift,
    shiftInfo,
    initialSelectedTripDbIds,
  };

  assert.equal(isShiftClosedAtDepot(closedArgs), true);
  assert.equal(
    resolveScheduledTripsEmptyMessageKey({
      eligibleTripsCount: 0,
      currentTripsCount: 2,
      isClosedAtDepot: true,
    }),
    "shifts.shift_closed_at_depot"
  );

  const selectedTripsAfterRemoval = selectedTripsWithReturn.filter(
    (trip) => trip.id !== returnDepotLeg.id
  );

  assert.equal(
    isShiftClosedAtDepot({
      ...closedArgs,
      selectedTrips: selectedTripsAfterRemoval,
    }),
    false
  );

  const candidateTrips = [
    {
      trip_id: "candidate-1",
      start_stop_name: "Villars-sur-Glâne, gare",
      end_stop_name: "Fribourg, Torry",
      departure_time: "11:00",
      arrival_time: "11:30",
    },
  ];
  const eligibleTrips = getEligibleScheduledTrips({
    trips: candidateTrips,
    selectedTripIds: selectedTripIdsFrom(selectedTripsAfterRemoval),
    lastTripEndTime: "10:50",
    lastTripEndStop: "Villars-sur-Glâne, gare",
    shiftStartTime: "09:00",
    shiftEndTime: "12:00",
  });

  assert.equal(eligibleTrips.length, 1);
  assert.equal(
    resolveScheduledTripsEmptyMessageKey({
      eligibleTripsCount: eligibleTrips.length,
      currentTripsCount: candidateTrips.length,
      isClosedAtDepot: false,
    }),
    null
  );
});
