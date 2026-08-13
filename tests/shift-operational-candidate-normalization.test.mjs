import assert from "node:assert/strict";
import test from "node:test";

import { normalizeOperationalTripCandidates } from "../src/pages/Fleet/Shifts/shift-utils.js";

const baseOperationalFields = {
  status: "gtfs",
  route_id: "79fec482-1465-4866-977b-e0053ee47fe8",
  direction_id: "0",
  shape_id: "shape-line-5",
  start_stop_name: "Villars-sur-Glâne, gare",
  end_stop_name: "Fribourg, Torry",
  departure_time: "09:41",
  arrival_time: "10:10",
  trip_headsign: "Fribourg, Torry",
};

const buildGtfsTrip = (overrides = {}) => ({
  ...baseOperationalFields,
  id: "997274ed-21a2-4798-8120-42c31aefeb61",
  trip_id: "210.TA.92-5-A-j26-1.2.H",
  gtfs_service_id: "TA+bo000",
  service_id: "c3a776ad-0000-4000-8000-000000000001",
  trip_short_name: "65219",
  ...overrides,
});

test("calendar-variant pair with identical operational fields collapses to one", () => {
  const variantA = buildGtfsTrip();
  const variantB = buildGtfsTrip({
    id: "434c3891-3226-478e-bb0a-4348d23e4d92",
    trip_id: "211.TA.92-5-A-j26-1.2.H",
    gtfs_service_id: "TA+yf000",
    service_id: "f83d30ec-0000-4000-8000-000000000002",
    trip_short_name: "65217",
  });

  const normalized = normalizeOperationalTripCandidates([variantA, variantB]);
  assert.equal(normalized.length, 1);
});

test("singleton GTFS trip remains unchanged", () => {
  const singleton = buildGtfsTrip();
  const normalized = normalizeOperationalTripCandidates([singleton]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, singleton.id);
});

test("different shape_id does not collapse", () => {
  const left = buildGtfsTrip({ shape_id: "shape-a" });
  const right = buildGtfsTrip({
    id: "434c3891-3226-478e-bb0a-4348d23e4d92",
    trip_id: "211.TA.92-5-A-j26-1.2.H",
    shape_id: "shape-b",
  });

  const normalized = normalizeOperationalTripCandidates([left, right]);
  assert.equal(normalized.length, 2);
});

test("different direction_id does not collapse", () => {
  const left = buildGtfsTrip({ direction_id: "0" });
  const right = buildGtfsTrip({
    id: "434c3891-3226-478e-bb0a-4348d23e4d92",
    trip_id: "211.TA.92-5-A-j26-1.2.H",
    direction_id: "1",
  });

  const normalized = normalizeOperationalTripCandidates([left, right]);
  assert.equal(normalized.length, 2);
});

test("different departure or arrival time does not collapse", () => {
  const left = buildGtfsTrip();
  const right = buildGtfsTrip({
    id: "434c3891-3226-478e-bb0a-4348d23e4d92",
    trip_id: "211.TA.92-5-A-j26-1.2.H",
    departure_time: "09:42",
    arrival_time: "10:11",
  });

  const normalized = normalizeOperationalTripCandidates([left, right]);
  assert.equal(normalized.length, 2);
});

test("different endpoints do not collapse", () => {
  const left = buildGtfsTrip();
  const right = buildGtfsTrip({
    id: "434c3891-3226-478e-bb0a-4348d23e4d92",
    trip_id: "211.TA.92-5-A-j26-1.2.H",
    end_stop_name: "Fribourg, gare",
  });

  const normalized = normalizeOperationalTripCandidates([left, right]);
  assert.equal(normalized.length, 2);
});

test("auxiliary depot trip remains alongside GTFS candidates", () => {
  const gtfsTrip = buildGtfsTrip();
  const auxiliaryTrip = {
    id: "e6a4573a-315e-4d08-a87b-79333f0ba4ba",
    trip_id: "depot-560f4a44d9b44306964a1f17e55be1d5",
    status: "depot",
    trip_type: "auxiliary",
    start_stop_name: "Villars-sur-Glâne, gare",
    end_stop_name: "Depo",
    departure_time: "10:00",
    arrival_time: "10:15",
  };

  const normalized = normalizeOperationalTripCandidates([gtfsTrip, auxiliaryTrip]);
  assert.equal(normalized.length, 2);
  assert.ok(normalized.some((trip) => trip.id === auxiliaryTrip.id));
});

test("representative selection is deterministic regardless of input order", () => {
  const variantA = buildGtfsTrip({
    gtfs_service_id: "TA+bo000",
    trip_id: "210.TA.92-5-A-j26-1.2.H",
    id: "997274ed-21a2-4798-8120-42c31aefeb61",
  });
  const variantB = buildGtfsTrip({
    gtfs_service_id: "TA+yf000",
    trip_id: "211.TA.92-5-A-j26-1.2.H",
    id: "434c3891-3226-478e-bb0a-4348d23e4d92",
  });

  const forward = normalizeOperationalTripCandidates([variantA, variantB]);
  const reverse = normalizeOperationalTripCandidates([variantB, variantA]);

  assert.equal(forward.length, 1);
  assert.equal(reverse.length, 1);
  assert.equal(forward[0].id, reverse[0].id);
  assert.equal(forward[0].trip_id, "210.TA.92-5-A-j26-1.2.H");
});

test("missing critical identity field prevents collapse", () => {
  const left = buildGtfsTrip({ shape_id: "" });
  const right = buildGtfsTrip({
    id: "434c3891-3226-478e-bb0a-4348d23e4d92",
    trip_id: "211.TA.92-5-A-j26-1.2.H",
    shape_id: "",
  });

  const normalized = normalizeOperationalTripCandidates([left, right]);
  assert.equal(normalized.length, 2);
});

test("mixed duplicate pairs and singletons collapse to expected count", () => {
  const pairOneA = buildGtfsTrip({
    id: "pair1-a",
    trip_id: "100.TA.route.1.H",
    departure_time: "08:00",
    arrival_time: "08:30",
    gtfs_service_id: "TA+bo000",
  });
  const pairOneB = buildGtfsTrip({
    id: "pair1-b",
    trip_id: "101.TA.route.1.H",
    departure_time: "08:00",
    arrival_time: "08:30",
    gtfs_service_id: "TA+yf000",
  });
  const pairTwoA = buildGtfsTrip({
    id: "pair2-a",
    trip_id: "102.TA.route.1.H",
    departure_time: "09:00",
    arrival_time: "09:30",
    gtfs_service_id: "TA+bo000",
  });
  const pairTwoB = buildGtfsTrip({
    id: "pair2-b",
    trip_id: "103.TA.route.1.H",
    departure_time: "09:00",
    arrival_time: "09:30",
    gtfs_service_id: "TA+yf000",
  });
  const pairThreeA = buildGtfsTrip({
    id: "pair3-a",
    trip_id: "104.TA.route.1.H",
    departure_time: "10:00",
    arrival_time: "10:30",
    gtfs_service_id: "TA+bo000",
  });
  const pairThreeB = buildGtfsTrip({
    id: "pair3-b",
    trip_id: "105.TA.route.1.H",
    departure_time: "10:00",
    arrival_time: "10:30",
    gtfs_service_id: "TA+yf000",
  });
  const singletonOne = buildGtfsTrip({
    id: "single1",
    trip_id: "106.TA.route.1.H",
    departure_time: "11:00",
    arrival_time: "11:30",
    gtfs_service_id: "TA+bo000",
  });
  const singletonTwo = buildGtfsTrip({
    id: "single2",
    trip_id: "107.TA.route.1.H",
    departure_time: "12:00",
    arrival_time: "12:30",
    gtfs_service_id: "TA+bo000",
  });

  const input = [
    pairOneA,
    pairOneB,
    pairTwoA,
    pairTwoB,
    pairThreeA,
    pairThreeB,
    singletonOne,
    singletonTwo,
  ];

  const normalized = normalizeOperationalTripCandidates(input);
  assert.equal(normalized.length, 5);
});
