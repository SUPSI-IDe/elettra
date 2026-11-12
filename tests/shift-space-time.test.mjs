import assert from "node:assert/strict";
import test from "node:test";

import {
  assignDepotTripsToSpaceTimeGroups,
  buildTransferOnlySpaceTimeGroup,
  buildSpaceTimeGroups,
  findDepotConnectionGaps,
  partitionDepotTripsForSpaceTimeGroup,
} from "../src/pages/Fleet/Shifts/shift-space-time.js";
import {
  buildStopOrder,
  mergeStopSequence,
} from "../src/pages/Fleet/Shifts/shift-utils.js";

test("builds one ordered space-time group from outbound and return trips", () => {
  const groups = buildSpaceTimeGroups([
    {
      trip_id: "outbound",
      route_id: "301",
      route_label: "301",
      stop_times: [
        { stop_name: "A", departure_time: "06:00:00" },
        { stop_name: "C", arrival_time: "06:20:00" },
      ],
    },
    {
      trip_id: "return",
      route_id: "301",
      route_label: "301",
      stop_times: [
        { stop_name: "C", departure_time: "06:30:00" },
        { stop_name: "B", arrival_time: "06:40:00" },
        { stop_name: "A", arrival_time: "06:50:00" },
      ],
    },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "301");
  assert.deepEqual(groups[0].stops, ["A", "B", "C"]);
  assert.deepEqual(
    groups[0].trips.map((trip) => trip.id),
    ["outbound", "return"]
  );
});

test("separates diagrams by route and ignores trips without usable times", () => {
  const groups = buildSpaceTimeGroups([
    {
      trip_id: "301-1",
      route_id: "301",
      stop_times: [
        { stop_name: "A", departure_time: "06:00" },
        { stop_name: "B", arrival_time: "06:10" },
      ],
    },
    {
      trip_id: "7-1",
      route_id: "7",
      stop_times: [
        { stop_name: "X", departure_time: "07:00" },
        { stop_name: "Y", arrival_time: "07:15" },
      ],
    },
    { trip_id: "invalid", start_stop_name: "Nowhere" },
  ]);

  assert.deepEqual(
    groups.map((group) => group.key),
    ["301", "7"]
  );
});

test("merges TPL 40104 return-only stops into the route instead of appending them", () => {
  const outbound = [
    "Pazzallo, P+R Fornaci",
    "Paradiso, La Sguancia",
    "Paradiso, Carzo",
    "Paradiso, Stazione/Scuole",
    "Paradiso, Debarcadero",
    "Lugano, Malpensata",
    "Lugano, Piazza Luini",
    "Lugano, Piazza Rezzonico",
    "Lugano, Piazza Manzoni",
    "Lugano, Centro",
  ];
  const inbound = [
    "Lugano, Centro",
    "Lugano, Piazza Manzoni",
    "Lugano, Piazza Rezzonico",
    "Lugano, Piazza Luini",
    "Lugano, Malpensata",
    "Lugano, Via Domenico Fontana",
    "Paradiso, Debarcadero",
    "Paradiso, Stazione/Scuole",
    "Paradiso, Stazione",
    "Paradiso, Via Calprino",
    "Paradiso, Carzo",
    "Paradiso, La Sguancia",
    "Pazzallo, P+R Fornaci",
  ];

  assert.deepEqual(mergeStopSequence(outbound, inbound), [
    "Pazzallo, P+R Fornaci",
    "Paradiso, La Sguancia",
    "Paradiso, Carzo",
    "Paradiso, Via Calprino",
    "Paradiso, Stazione",
    "Paradiso, Stazione/Scuole",
    "Paradiso, Debarcadero",
    "Lugano, Via Domenico Fontana",
    "Lugano, Malpensata",
    "Lugano, Piazza Luini",
    "Lugano, Piazza Rezzonico",
    "Lugano, Piazza Manzoni",
    "Lugano, Centro",
  ]);
});

test("uses the longest route variant as the stop axis while preserving direction", () => {
  assert.deepEqual(
    buildStopOrder([
      ["Pista Ghiaccio", "Resega", "Gerra", "Centro"],
      [
        "Centro",
        "Autosilo",
        "Gerra",
        "Resega",
        "Pista Ghiaccio",
        "Davesco",
        "Piano Stampa",
      ],
    ]),
    [
      "Piano Stampa",
      "Davesco",
      "Pista Ghiaccio",
      "Resega",
      "Gerra",
      "Autosilo",
      "Centro",
    ]
  );
});

test("keeps a terminal loop outside the shared route", () => {
  assert.deepEqual(
    buildStopOrder([
      ["Comano", "Rotonda", "Centro"],
      ["Centro", "Rotonda", "Comano", "Cureglia", "Comano"],
    ]),
    ["Cureglia", "Comano", "Rotonda", "Centro"]
  );
});

test("assigns depot arrivals to the previous line and departures to the next line", () => {
  const groups = buildSpaceTimeGroups([
    {
      trip_id: "line-8",
      route_id: "route-8",
      route_label: "8",
      sequence_number: 2,
      stop_times: [
        { stop_name: "Pista Ghiaccio", departure_time: "07:26" },
        { stop_name: "Centro", arrival_time: "07:35" },
      ],
    },
    {
      trip_id: "line-6",
      route_id: "route-6",
      route_label: "6",
      sequence_number: 12,
      stop_times: [
        { stop_name: "Cornaredo", departure_time: "19:23" },
        { stop_name: "Stazione", arrival_time: "19:39" },
      ],
    },
  ]);
  const assignments = assignDepotTripsToSpaceTimeGroups(
    groups,
    [
      {
        trip_id: "depot-in",
        sequence_number: 10,
        stop_times: [
          { stop_name: "Pista Ghiaccio", departure_time: "09:14" },
          { stop_name: "TPL Rimessa 1", arrival_time: "09:18" },
        ],
      },
      {
        trip_id: "depot-out",
        sequence_number: 11,
        stop_times: [
          { stop_name: "TPL Rimessa 1", departure_time: "16:50" },
          { stop_name: "Pista Ghiaccio", arrival_time: "16:56" },
        ],
      },
    ],
    { startDepotName: "TPL Rimessa 1", endDepotName: "TPL Rimessa 1" }
  );

  assert.deepEqual(
    assignments.get("route-8").map((trip) => trip.trip_id),
    ["depot-in"]
  );
  assert.deepEqual(
    assignments.get("route-6").map((trip) => trip.trip_id),
    ["depot-out"]
  );

  const line6 = groups.find((group) => group.key === "route-6");
  const partition = partitionDepotTripsForSpaceTimeGroup(
    line6,
    assignments.get("route-6")
  );
  assert.deepEqual(partition.connected, []);
  assert.deepEqual(
    partition.disconnected.map((trip) => trip.id),
    ["depot-out"]
  );
});

test("builds a transfer-only group without treating the depot as a service stop", () => {
  const group = buildTransferOnlySpaceTimeGroup(
    [
      {
        trip_id: "outbound",
        sequence_number: 1,
        stop_times: [
          { stop_name: "TPL Rimessa 2", departure_time: "17:16" },
          { stop_name: "Canobbio, Mercato Resega", arrival_time: "17:21" },
        ],
      },
      {
        trip_id: "inbound",
        sequence_number: 2,
        stop_times: [
          { stop_name: "Canobbio, Mercato Resega", departure_time: "18:38" },
          { stop_name: "TPL Rimessa 2", arrival_time: "18:42" },
        ],
      },
    ],
    { startDepotName: "TPL Rimessa 2", endDepotName: "TPL Rimessa 2" }
  );

  assert.equal(group.transferOnly, true);
  assert.equal(group.transferCount, 2);
  assert.deepEqual(group.stops, ["Canobbio, Mercato Resega"]);
});

test("flags a missing connection between a depot leg and the next service trip", () => {
  const gaps = findDepotConnectionGaps(
    [
      {
        id: "service",
        sequence: 12,
        points: [
          { stop: "Lugano, Centro", minute: 16 * 60 + 45 },
          { stop: "Piano Stampa", minute: 17 * 60 + 3 },
        ],
      },
    ],
    [
      {
        id: "depot",
        sequence: 11,
        points: [
          { stop: "TPL Rimessa 1", minute: 16 * 60 + 30 },
          { stop: "Lugano, Pista Ghiaccio", minute: 16 * 60 + 36 },
        ],
      },
    ]
  );

  assert.deepEqual(gaps, [
    [
      { stop: "Lugano, Pista Ghiaccio", minute: 16 * 60 + 36 },
      { stop: "Lugano, Centro", minute: 16 * 60 + 45 },
    ],
  ]);
});
