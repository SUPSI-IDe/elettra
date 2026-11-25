import { translations } from "../../src/i18n/translations.js";
import { test, expect, language, edition } from "../../test-support/shift-composer-fixture.js";
import {
  plannerAction, plannerApi, plannerCatalog, plannerField, plannerTrip, startPlanner,
} from "../../test-support/shift-planner-fixture.js";

const dataset = { ...edition, valid_from: "2025-12-14", valid_to: "2026-12-12" };
const scenarios = {
  en: { locale: "en-GB", morning: "Morning service", daytime: "Daytime service on two lines", bus: "12 m electric bus" },
  de: { locale: "de-CH", morning: "Morgendienst", daytime: "Tagesbetrieb auf zwei Linien", bus: "12-m-Elektrobus" },
  fr: { locale: "fr-CH", morning: "Service du matin", daytime: "Service de jour sur deux lignes", bus: "Bus électrique de 12 m" },
  it: { locale: "it-CH", morning: "Servizio del mattino", daytime: "Servizio diurno su due linee", bus: "Autobus elettrico 12 m" },
};
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

test.use({ deviceScaleFactor: 2 });
test.beforeEach(async ({ page, baseURL }, testInfo) => {
  test.skip(process.env.UPDATE_GUIDE_SCREENSHOTS !== "1" || testInfo.project.name !== "chromium",
    "Guide screenshots are generated on demand with desktop Chromium");
  await page.route("**/*", route =>
    new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort()
  );
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
    ...(route && { route_id: route === "1" ? "line" : `line-${route}`, route_label: route, route_short_name: route }),
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

const terminalRoutes = {
  "1": { stops: ["Borgo", "Municipio", "Stazione"], km: 7.5 },
  "2": { stops: ["Stazione", "Piazza", "Capolinea Lago"], km: 8.5 },
};

const stopCoordinates = {
  "Deposito Nord": [46.064, 8.958],
  Borgo: [46.042, 8.954],
  Municipio: [46.025, 8.956],
  Stazione: [45.992, 8.939],
  Piazza: [45.966, 8.934],
  "Capolinea Lago": [45.939, 8.909],
};

function corridorMovement(id, stops, clocks, km, route) {
  const trip = movement(id, `demo-${id}`, stops.map((stop, index) => [stop, `${clocks[index]}:00`]), route);
  return {
    ...trip,
    distance_km: km,
    stop_times: trip.stop_times.map(stop => ({
      ...stop,
      stop_lat: stopCoordinates[stop.stop_name][0],
      stop_lon: stopCoordinates[stop.stop_name][1],
    })),
  };
}

function serviceMovement(number, route, direction, clocks) {
  const { stops, km } = terminalRoutes[route];
  return corridorMovement(`service-${number}`, direction === "outbound" ? stops : stops.toReversed(), clocks, km, route);
}

const movements = [
  corridorMovement("out", ["Deposito Nord", "Borgo"], ["05:50", "06:00"], 3),
  serviceMovement(1, "1", "outbound", ["06:10", "06:24", "06:40"]),
  serviceMovement(2, "1", "inbound", ["06:52", "07:08", "07:22"]),
  serviceMovement(3, "1", "outbound", ["07:34", "07:48", "08:04"]),
  serviceMovement(4, "2", "outbound", ["08:30", "08:46", "09:02"]),
  serviceMovement(5, "2", "inbound", ["09:14", "09:30", "09:46"]),
  serviceMovement(6, "2", "outbound", ["09:58", "10:14", "10:30"]),
  serviceMovement(7, "2", "inbound", ["10:42", "10:58", "11:14"]),
  serviceMovement(8, "1", "inbound", ["11:50", "12:06", "12:20"]),
  serviceMovement(9, "1", "outbound", ["12:32", "12:46", "13:02"]),
  serviceMovement(10, "1", "inbound", ["13:14", "13:30", "13:44"]),
  corridorMovement("back", ["Borgo", "Deposito Nord"], ["13:50", "14:00"], 3),
];
const serviceTrips = movements.filter(trip => trip.status === "gtfs");

for (const [lang, { locale, morning, daytime, bus }] of Object.entries(scenarios)) {
  test.describe(lang, () => {
    test.use({ locale });
    const labels = translations[lang];
    const output = `guide/images/${lang}`;

    test("captures the sequential planner", async ({ page, composer }) => {
      await page.setViewportSize({ width: 1360, height: 1450 });
      const state = await composer({
        application: true,
        entry: "shifts",
        datasets: [dataset],
        models: [{ id: "model", user_id: "user", name: bus }],
        depots: [
          { id: "depot", user_id: "user", name: "Deposito Nord", stop_id: "depot-stop" },
          { id: "charging", user_id: "user", name: "Capolinea con ricarica", stop_id: "charging-stop", features: { type: "charging" } },
        ],
        respond: request => {
          if (request.path.endsWith("/shift-planner/catalog")) return { json: catalog };
          if (request.path.endsWith("/shift-planner/route")) return { json: { duration_seconds: 180, distance_m: 1400 } };
          return plannerApi(request);
        },
      });
      await language(page, lang);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await plannerAction(page, "add-shift").click();
      await expect(page.locator(".shift-planner h1")).toHaveText(labels["shifts.add_shift"]);
      await startPlanner(page);
      await plannerTrip(page, "night-a").click();
      await plannerAction(page, "confirm-step").click();
      await expect(page.locator("[data-role=current-state]")).toContainText("Stazione, binario 1");
      await expect(page.locator("[data-role=programme] [data-step-index='0']")).toBeVisible();
      await expect(plannerTrip(page, "night-b")).toBeVisible();
      await plannerField(page, "include-other-termini").check();
      await expect(plannerTrip(page, "night-other")).toBeVisible();
      await expect(page.locator("#planner-next-heading")).toHaveText(labels["shift_planner.next_trip"]);
      await expect(page.locator("#planner-programme-heading")).toHaveText(labels["shifts.composer_programme"]);
      expect(state.writes).toEqual([]);
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await page.locator(".shift-planner").screenshot({ path: `${output}/shift-planner.png`, animations: "disabled" });
    });

    test("captures the multiline space-time diagram", async ({ page, composer }) => {
      await page.setViewportSize({ width: 1640, height: 1200 });
      const row = {
        id: "demo",
        name: daytime,
        bus_id: "bus",
        bus_model_name: bus,
        start_depot: { name: "Deposito Nord" },
        end_depot: { name: "Deposito Nord" },
        trip_count: serviceTrips.length,
        start_time: movements[0].departure_time,
        end_time: movements.at(-1).arrival_time,
        daily_distance_km: movements.reduce((sum, trip) => sum + trip.distance_km, 0),
        planner_version: 1,
        service_weekday: "monday",
        gtfs_datasets: [dataset],
      };
      await composer({ application: true, entry: "shifts", respond: request => {
        if (request.path.endsWith("/buses/bus")) return { json: { id: "bus", bus_model_id: "model", bus_model_name: bus } };
        if (request.path.endsWith("/bus-models/model")) return { json: { id: "model", name: bus } };
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
      await language(page, lang);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await page.locator('tr[data-id=demo] [data-row-action=details]').click();
      const visualisation = page.locator(".visualize-shift");
      await expect(visualisation.locator("[data-i18n='shifts.visualize_title']")).toHaveText(labels["shifts.visualize_title"]);
      await expect(visualisation.locator("[data-field='heading-name']")).toContainText(daytime);
      const spaceTimeButton = visualisation.getByRole("button", { name: labels["shifts.view_space_time"], exact: true });
      await expect(spaceTimeButton).toHaveAttribute("aria-pressed", "true");
      await expect(visualisation.getByRole("button", { name: labels["shifts.view_map"], exact: true })).toBeVisible();
      const diagram = page.locator("[data-role=space-time]");
      await expect(diagram.locator(".shift-space-time__group")).toHaveCount(1);
      await expect(diagram.locator(".shift-space-time__chart")).toHaveCount(1);
      const routeLabels = ["1", "2"].map(route => labels["shifts.space_time_route"].replace("{route}", route));
      await expect(diagram.locator(".shift-space-time__route-key")).toHaveText(routeLabels);
      await expect(diagram.locator(".shift-space-time__depot-line")).toHaveCount(2);
      await expect(diagram.locator(".shift-space-time__depot-key")).toHaveText(labels["shifts.timeline_legend_depot"]);
      await expect(diagram.locator(".shift-space-time__trip")).toHaveCount(10);
      for (const [route, count, color] of [["line", 6, "#4e79a7"], ["line-2", 4, "#b07aa1"]]) {
        const strokes = diagram.locator(`[data-route-id="${route}"] > path`);
        await expect(strokes).toHaveCount(count);
        for (const stroke of await strokes.all()) {
          await expect(stroke).toHaveAttribute("stroke", color);
        }
      }
      const scroll = diagram.locator(".shift-space-time__scroll");
      await expect.poll(() => scroll.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
      for (const [previous, next] of movements.slice(1).map((trip, index) => [movements[index], trip])) {
        expect(previous.end_stop_name).toBe(next.start_stop_name);
        expect(previous.arrival_time < next.departure_time).toBe(true);
      }
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await visualisation.screenshot({ path: `${output}/shift-visualisation.png`, animations: "disabled" });
    });

    test("captures editing a historical vehicle block", async ({ page, composer }) => {
      await page.setViewportSize({ width: 1500, height: 1340 });
      const row = {
        id: "storico",
        name: morning,
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
        models: [{ id: "model", user_id: "user", name: bus }],
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
      await language(page, lang);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await page.locator('tr[data-id="storico"] [data-row-action="edit"]').click();
      const editor = page.locator("section.shift-form");
      await expect(editor.locator("h1")).toHaveText(labels["shifts.edit_shift"]);
      await expect(editor.locator("#add-stops-heading")).toHaveText(labels["shifts.composer_available"]);
      await expect(editor.locator("form")).toHaveAttribute("data-composer-step", "compose");
      await expect(editor.locator('[data-role="shift-trips-body"] tr')).toHaveCount(2);
      await expect(editor.locator('[data-action="add-trip"]')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await editor.screenshot({ path: `${output}/shift-composer.png`, animations: "disabled" });
      expect(state.writes).toEqual([]);
    });
  });
}
