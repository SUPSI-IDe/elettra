import assert from "node:assert/strict";
import test from "node:test";

import {
  assignDepotTripsToSpaceTimeGroups,
  buildTransferOnlySpaceTimeGroup,
  buildSpaceTimeGroups,
  combineSpaceTimeGroups,
  findDepotConnectionGaps,
  partitionDepotTripsForSpaceTimeGroup,
} from "../src/pages/Fleet/Shifts/shift-space-time.js";
import {
  buildStopOrder,
  mergeStopSequence,
} from "../src/pages/Fleet/Shifts/shift-utils.js";
import { translations } from "../src/i18n/translations.js";

test("uses the general off-route label for depot-style timeline segments", () => {
  assert.equal(translations.en["shifts.timeline_legend_depot"], "Non-revenue trip");
  assert.equal(translations.de["shifts.timeline_legend_depot"], "Leerfahrt");
  assert.equal(translations.fr["shifts.timeline_legend_depot"], "Course haut-le-pied");
  assert.equal(
    translations.it["shifts.timeline_legend_depot"],
    "Corsa fuori linea"
  );
});

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

test("builds route groups for the combined diagram and ignores trips without usable times", () => {
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

test("combines intersecting routes without losing branch stops, return trips or overnight times", () => {
  const trip = (id, route, sequence, stops) => ({
    trip_id: id, route_id: `route-${route}`, route_label: route, sequence_number: sequence,
    stop_times: stops.map(([stop_name, departure_time]) => ({ stop_name, departure_time })),
  });
  const source = [
    trip("fifteen", "15", 1, [["Station", "23:00"], ["Branch 15", "23:10"], ["Muzzano", "23:20"]]),
    trip("sixteen", "16", 2, [["Muzzano", "23:25"], ["Branch 16", "23:35"], ["Station", "23:45"]]),
    trip("fifteen-again", "15", 3, [["Station", "24:00"], ["Branch 15", "24:10"], ["Muzzano", "24:20"]]),
  ];
  const groups = buildSpaceTimeGroups(source);
  const snapshot = structuredClone(groups);
  const combined = combineSpaceTimeGroups(groups);
  assert.deepEqual(combined.routes.map(route => route.label), ["15", "16"]);
  assert.deepEqual(new Set(combined.stops), new Set(["Station", "Branch 15", "Muzzano", "Branch 16"]));
  assert.equal(combined.stops.length, 4);
  assert.deepEqual(combined.trips.map(trip => trip.id), source.map(trip => trip.trip_id));
  assert.deepEqual(combined.trips.map(trip => trip.routeKey), ["route-15", "route-16", "route-15"]);
  assert.deepEqual(combined.trips[1].points.map(point => point.stop), ["Muzzano", "Branch 16", "Station"]);
  assert.equal(combined.trips[2].points.at(-1).minute, 1460);
  assert.deepEqual(groups, snapshot);
});

test("orders route legend numerically and includes disconnected routes on the shared axis", () => {
  const groups = ["10", "2"].map((label, index) => ({
    key: label, label, stops: [`start-${label}`, `end-${label}`],
    trips: [{ id: label, points: [{ stop: `start-${label}`, minute: index * 60 }, { stop: `end-${label}`, minute: index * 60 + 10 }] }],
  }));
  const combined = combineSpaceTimeGroups(groups);
  assert.deepEqual(combined.routes.map(route => route.label), ["2", "10"]);
  assert.equal(combined.stops.length, 4);
});

test("retains single-line groups and handles an empty duty", () => {
  const single = { key: "7", label: "7", stops: ["A", "B"], trips: [] };
  assert.equal(combineSpaceTimeGroups([single]), single);
  assert.equal(combineSpaceTimeGroups([]), null);
});

test("assigns an inter-line transfer exactly once in the combined diagram", () => {
  const groups = buildSpaceTimeGroups([
    { trip_id: "four", route_id: "4", sequence_number: 1, start_stop_name: "A", end_stop_name: "B", departure_time: "07:00", arrival_time: "07:10" },
    { trip_id: "six", route_id: "6", sequence_number: 3, start_stop_name: "C", end_stop_name: "D", departure_time: "07:20", arrival_time: "07:30" },
  ]);
  const combined = combineSpaceTimeGroups(groups);
  const transfer = { trip_id: "depot-transfer", sequence_number: 2, start_stop_name: "B", end_stop_name: "C", departure_time: "07:10", arrival_time: "07:20" };
  const assignments = assignDepotTripsToSpaceTimeGroups([combined], [transfer]);
  assert.deepEqual(assignments.get(combined.key), [transfer]);
  const partition = partitionDepotTripsForSpaceTimeGroup(combined, assignments.get(combined.key));
  assert.equal(partition.connected.length, 1);
  assert.equal(partition.disconnected.length, 0);
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
