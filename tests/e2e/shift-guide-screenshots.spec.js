import { test, expect, language, edition } from "../../test-support/shift-composer-fixture.js";
import {
  plannerAction, plannerApi, plannerCatalog, plannerField, plannerTrip, startPlanner,
} from "../../test-support/shift-planner-fixture.js";

const dataset = { ...edition, valid_from: "2025-12-14", valid_to: "2026-12-12" };
const output = "guide/images";
const stopNames = {
  a: "Borgo",
  b1: "Stazione, binario 1",
  b2: "Stazione, binario 2",
  b3: "Stazione, binario 3",
  other: "Piazza",
  last: "Capolinea Lago",
};
const catalog = plannerCatalog.map(trip => ({
  ...trip,
  ...(trip.id === "night-other" && { departure_time: "24:25:00", arrival_time: "24:42:00" }),
  from_name: stopNames[trip.from_stop_id],
  to_name: stopNames[trip.to_stop_id],
}));

test.use({ deviceScaleFactor: 2, locale: "it-CH" });
test.beforeEach(async ({ page, baseURL }, testInfo) => {
  test.skip(process.env.UPDATE_GUIDE_SCREENSHOTS !== "1" || testInfo.project.name !== "chromium",
    "Guide screenshots are generated on demand with desktop Chromium");
  await page.route("**/*", route =>
    new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort()
  );
});

test("captures the sequential planner in Italian", async ({ page, composer }) => {
  await page.setViewportSize({ width: 1360, height: 1450 });
  const state = await composer({ application: true, entry: "shifts", datasets: [dataset], depots: [
    { id: "depot", user_id: "user", name: "Deposito Nord", stop_id: "depot-stop" },
    { id: "charging", user_id: "user", name: "Capolinea con ricarica", stop_id: "charging-stop", features: { type: "charging" } },
  ], respond: request =>
    request.path.endsWith("/shift-planner/catalog") ? { json: catalog } :
    request.path.endsWith("/shift-planner/route") ? { json: { duration_seconds: 180, distance_m: 1400 } } : plannerApi(request)
  });
  await language(page, "it");
  await plannerAction(page, "add-shift").click();
  await expect(page.locator(".shift-planner h1")).toHaveText("Aggiungi turno macchina");
  await startPlanner(page);
  await plannerTrip(page, "night-a").click();
  await plannerAction(page, "confirm-step").click();
  await expect(page.locator("[data-role=current-state]")).toContainText("Stazione, binario 1");
  await expect(page.locator("[data-role=programme] [data-step-index='0']")).toBeVisible();
  await expect(plannerTrip(page, "night-b")).toBeVisible();
  await plannerField(page, "include-other-termini").check();
  await expect(plannerTrip(page, "night-other")).toBeVisible();
  await expect(page.locator("#planner-next-heading")).toHaveText("Prossima attività");
  await expect(page.locator("#planner-programme-heading")).toHaveText("La tua giornata di servizio");
  expect(state.writes).toEqual([]);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.locator(".shift-planner").screenshot({ path: `${output}/shift-planner.png`, animations: "disabled" });
});

function movement(id, tripId, stops, route = null) {
  return {
    id,
    trip_id: tripId,
    start_stop_name: stops[0][0],
    end_stop_name: stops.at(-1)[0],
    departure_time: stops[0][1],
    arrival_time: stops.at(-1)[1],
    status: route ? "gtfs" : "depot",
    ...(route && { route_id: "line", route_label: route, route_short_name: route }),
    stop_times: stops.map(([stop_name, time], index) => ({
      id: stop_name.toLowerCase().replaceAll(" ", "-"),
      stop_name,
      arrival_time: time,
      departure_time: time,
      stop_lat: 46.02 + index * 0.005,
      stop_lon: 8.94 + index * 0.005,
    })),
  };
}

const singleRouteMovements = [
  movement("out", "depot-start", [["Deposito Nord", "23:45:00"], ["Borgo", "23:50:00"]]),
  movement("trip-a", "gtfs-night-a", [["Borgo", "23:55:00"], ["Municipio", "24:06:00"], ["Stazione", "24:15:00"]], "1"),
  movement("trip-b", "gtfs-night-b", [["Stazione", "24:15:00"], ["Piazza", "24:26:00"], ["Capolinea Lago", "24:35:00"]], "1"),
  movement("back", "depot-end", [["Capolinea Lago", "24:35:00"], ["Deposito Nord", "24:50:00"]]),
];

const movements = singleRouteMovements.map(trip => trip.id === "trip-b"
  ? { ...trip, route_id: "line-2", route_label: "2", route_short_name: "2" }
  : trip);

test("captures the multiline space-time diagram in Italian", async ({ page, composer }) => {
  await page.setViewportSize({ width: 1640, height: 1200 });
  const row = {
    id: "demo",
    name: "Servizio serale su due linee",
    bus_id: "bus",
    bus_model_name: "Autobus elettrico 12 m",
    start_depot: { name: "Deposito Nord" },
    end_depot: { name: "Deposito Nord" },
    trip_count: 2,
    start_time: "23:45:00",
    end_time: "24:50:00",
    daily_distance_km: 24.8,
    planner_version: 1,
    service_weekday: "monday",
    gtfs_datasets: [dataset],
  };
  await composer({ application: true, entry: "shifts", respond: request => {
    if (request.path.endsWith("/buses/bus")) return { json: { id: "bus", bus_model_id: "model", bus_model_name: "Autobus elettrico 12 m" } };
    if (request.path.endsWith("/bus-models/model")) return { json: { id: "model", name: "Autobus elettrico 12 m" } };
    if (request.path.endsWith("/shifts/")) return { json: [row] };
    if (request.path.endsWith("/shifts/demo")) return {
      json: {
        ...row,
        structure: movements.map((trip, index) => ({
          trip_id: trip.id,
          sequence_number: index + 1,
          trip,
        })),
      },
    };
    if (request.path.endsWith("/shifts/demo/info")) return {
      json: { trips: movements, route: { id: "line", route_short_name: "1" }, days_of_week: ["monday"] },
    };
    return plannerApi(request);
  } });
  await language(page, "it");
  await page.locator('tr[data-id=demo] [data-row-action=details]').click();
  await expect(page.locator(".visualize-shift")).toBeVisible();
  const diagram = page.locator("[data-role=space-time]");
  await expect(diagram.locator(".shift-space-time__group")).toHaveCount(1);
  await expect(diagram.locator(".shift-space-time__chart")).toHaveCount(1);
  await expect(diagram.locator(".shift-space-time__route-key")).toHaveText(["Linea 1", "Linea 2"]);
  await expect(diagram.locator(".shift-space-time__depot-line")).toHaveCount(2);
  await expect(diagram.locator(".shift-space-time__depot-key")).toHaveText("Corsa fuori linea");
  await expect(diagram.locator(".shift-space-time__trip")).toHaveCount(2);
  await expect.poll(() => diagram.locator('[data-role="space-time-trip"]').evaluateAll(nodes =>
    nodes.map(node => [node.getAttribute("data-route-id"), node.querySelector("path").getAttribute("stroke")])
  )).toEqual([["line", "#4e79a7"], ["line-2", "#b07aa1"]]);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.locator(".visualize-shift").screenshot({ path: `${output}/shift-visualisation.png`, animations: "disabled" });
});

test("captures editing a historical vehicle block in Italian", async ({ page, composer }) => {
  await page.setViewportSize({ width: 1500, height: 1340 });
  const row = {
    id: "storico",
    name: "Servizio del mattino",
    bus_id: "bus",
    start_depot_id: "depot",
    end_depot_id: "depot",
    start_depot: { name: "Deposito Nord" },
    end_depot: { name: "Deposito Nord" },
    trip_count: 2,
    start_time: "07:30:00",
    end_time: "10:30:00",
    gtfs_datasets: [dataset],
  };
  const trips = [
    movement("trip-a", "gtfs-a", [["Borgo", "08:00:00"], ["Stazione", "08:25:00"]], "1"),
    movement("trip-b", "gtfs-b", [["Stazione", "08:35:00"], ["Borgo", "09:00:00"]], "1"),
    movement("trip-c", "gtfs-c", [["Borgo", "09:40:00"], ["Stazione", "10:05:00"]], "1"),
  ];
  const state = await composer({
    application: true,
    entry: "shifts",
    datasets: [dataset],
    trips,
    models: [{ id: "model", user_id: "user", name: "Autobus elettrico 12 m" }],
    depots: [{ id: "depot", user_id: "user", name: "Deposito Nord", stop_id: "depot-stop" }],
    respond: ({ path }) => {
      if (path.endsWith("/shifts/")) return { json: [row] };
      if (path.endsWith("/buses/bus")) return { json: { id: "bus", bus_model_id: "model" } };
      if (path.endsWith("/shifts/storico/yearly-distance")) return { json: { daily_distance_km: 28.4 } };
      if (path.endsWith("/shifts/storico")) return { json: {
        ...row,
        structure: trips.slice(0, 2).map(({ id }, index) => ({ trip_id: id, sequence_number: index + 1 })),
      } };
      if (path.endsWith("/shifts/storico/info")) return {
        json: { trips: trips.slice(0, 2), route_id: "line", days_of_week: ["monday"] },
      };
      return undefined;
    },
  });
  await language(page, "it");
  await page.locator('tr[data-id="storico"] [data-row-action="edit"]').click();
  const editor = page.locator("section.shift-form");
  await expect(editor.locator("h1")).toHaveText("Modifica turno macchina");
  await expect(editor.locator("form")).toHaveAttribute("data-composer-step", "compose");
  await expect(editor.locator('[data-role="shift-trips-body"] tr')).toHaveCount(2);
  await expect(editor.locator('[data-action="add-trip"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await editor.screenshot({ path: `${output}/shift-composer.png`, animations: "disabled" });
  expect(state.writes).toEqual([]);
});
