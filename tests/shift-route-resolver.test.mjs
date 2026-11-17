import assert from "node:assert/strict";
import test from "node:test";

import { createShiftRouteResolver } from "../src/pages/Fleet/Shifts/shift-route-resolver.js";

test("resolves each trip route from its stop and caches shared lookups", async () => {
  const stopCalls = [];
  const routeCalls = [];
  const resolveRoute = createShiftRouteResolver({
    fetchTripsByStop: async (stopId) => {
      stopCalls.push(stopId);
      return [
        { id: "trip-a", trip_id: "gtfs-a", route_id: "route-a" },
        { id: "trip-b", trip_id: "gtfs-b", route_id: "route-b" },
      ];
    },
    fetchRouteById: async (routeId) => {
      routeCalls.push(routeId);
      return {
        id: routeId,
        route_short_name: routeId === "route-a" ? "10" : "20",
      };
    },
  });

  const [tripA, tripB] = await Promise.all([
    resolveRoute({
      id: "trip-a",
      trip_id: "gtfs-a",
      stop_times: [{ id: "shared-stop" }],
    }),
    resolveRoute({
      id: "trip-b",
      trip_id: "gtfs-b",
      stop_times: [{ id: "shared-stop" }],
    }),
  ]);

  assert.deepEqual(
    [tripA.route_id, tripA.route_label, tripB.route_id, tripB.route_label],
    ["route-a", "10", "route-b", "20"]
  );
  assert.deepEqual(stopCalls, ["shared-stop"]);
  assert.deepEqual(routeCalls.sort(), ["route-a", "route-b"]);
});

test("keeps embedded route metadata without querying trips by stop", async () => {
  let stopCalls = 0;
  let routeCalls = 0;
  const resolveRoute = createShiftRouteResolver({
    fetchTripsByStop: async () => {
      stopCalls += 1;
      return [];
    },
    fetchRouteById: async () => {
      routeCalls += 1;
      return null;
    },
  });

  const trip = await resolveRoute({
    id: "trip-a",
    route_id: "route-a",
    route_label: "Linea 10",
  });

  assert.equal(trip.route_id, "route-a");
  assert.equal(trip.route_label, "Linea 10");
  assert.equal(stopCalls, 0);
  assert.equal(routeCalls, 0);
});

test("falls back to shift route metadata when route resolution is unavailable", async () => {
  const resolveRoute = createShiftRouteResolver({
    fetchTripsByStop: async () => [],
    fetchRouteById: async () => null,
  });

  const trip = await resolveRoute(
    { id: "trip-a", stop_times: [{ stop_name: "No database id" }] },
    { fallbackRoute: { id: "fallback-route", name: "301" } }
  );

  assert.equal(trip.route_id, "fallback-route");
  assert.equal(trip.route_label, "301");
});

test("keeps GTFS and service caches separate at the same stop and ignores a misleading shift route", async () => {
  const calls = [];
  const resolve = createShiftRouteResolver({
    fetchTripsByStop: async (stop, { status }) => {
      calls.push([stop, status]);
      return status === "service"
        ? [{ id: "custom", trip_id: "service-custom", route_id: "six" }]
        : [{ id: "original", trip_id: "original-code", route_id: "four" }];
    },
    fetchRouteById: async (id) => ({ route_short_name: id === "six" ? "6" : "4" }),
  });
  const fallback = { fallbackRoute: { id: "four", name: "4" } };
  const [original, custom, repeated] = await Promise.all([
    resolve({ id: "original", trip_id: "original-code", stop_times: [{ id: "station" }] }, fallback),
    resolve({ id: "custom", trip_id: "service-custom", stop_times: [{ id: "station" }] }, fallback),
    resolve({ id: "custom", trip_id: "service-custom", stop_times: [{ id: "station" }] }, fallback),
  ]);
  assert.equal(original.route_label, "4");
  assert.equal(custom.route_id, "six");
  assert.equal(custom.route_label, "6");
  assert.equal(repeated.route_label, "6");
  assert.deepEqual(calls.sort(), [["station", "gtfs"], ["station", "service"]]);
});

test("uses explicit and nested status even when the trip code has no status prefix", async () => {
  const statuses = [];
  const resolve = createShiftRouteResolver({
    fetchTripsByStop: async (_id, { status }) => {
      statuses.push(status);
      return [{ id: "custom", route_id: "six", route_short_name: "6" }];
    },
  });
  for (const metadata of [{ status: "SERVICE" }, { trip: { status: "school" } }]) {
    const trip = await resolve({ id: "custom", trip_id: "no-prefix", stops: [{ id: "station" }], ...metadata });
    assert.equal(trip.route_label, "6");
  }
  assert.deepEqual(statuses, ["service", "school"]);
});

test("recovers a custom trip by UUID when the stop lookup cannot find it, caching concurrent requests", async () => {
  const uuidCalls = [];
  const resolve = createShiftRouteResolver({
    fetchTripsByStop: async () => [],
    fetchTripById: async (id) => {
      uuidCalls.push(id);
      return { id, route_id: "six" };
    },
    fetchRouteById: async () => ({ route_short_name: "6" }),
  });
  const input = { id: "database-uuid", trip_id: "custom-code", stops: [{ id: "station" }] };
  const result = await Promise.all([resolve(input), resolve(input)]);
  assert.deepEqual(uuidCalls, ["database-uuid"]);
  assert.deepEqual(result.map(trip => trip.route_label), ["6", "6"]);
});

test("resolves by UUID even without a usable stop ID", async () => {
  const resolve = createShiftRouteResolver({
    fetchTripsByStop: async () => assert.fail("No stop lookup without a stop id"),
    fetchTripById: async (id) => ({ id, route_id: "six", route_short_name: "6" }),
  });
  assert.equal((await resolve({ id: "database-uuid", stops: [{ stop_name: "Station" }] })).route_label, "6");
});

test("reports lookup failures and still attempts the authoritative UUID lookup", async () => {
  const errors = [];
  const resolve = createShiftRouteResolver({
    fetchTripsByStop: async () => { throw new Error("stop unavailable"); },
    fetchTripById: async () => ({ route_id: "six", route_short_name: "6" }),
    onError: (_error, context) => errors.push(context.type),
  });
  const result = await resolve({ id: "uuid", stops: [{ id: "station" }] });
  assert.equal(result.route_label, "6");
  assert.deepEqual(errors, ["trips-by-stop"]);
});

test("reports a UUID failure before using the existing shift fallback", async () => {
  const errors = [];
  const resolve = createShiftRouteResolver({
    fetchTripById: async () => { throw new Error("trip unavailable"); },
    onError: (_error, context) => errors.push(context.type),
  });
  const result = await resolve({ id: "uuid" }, { fallbackRoute: { id: "four", name: "4" } });
  assert.equal(result.route_label, "4");
  assert.deepEqual(errors, ["trip"]);
});
