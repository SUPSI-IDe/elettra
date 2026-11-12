import assert from "node:assert/strict";
import test from "node:test";

import { buildSpaceTimeGroups } from "../src/pages/Fleet/Shifts/shift-space-time.js";
import { mergeStopSequence } from "../src/pages/Fleet/Shifts/shift-utils.js";

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
