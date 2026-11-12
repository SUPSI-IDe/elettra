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
