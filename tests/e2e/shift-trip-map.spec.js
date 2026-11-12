import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const visualizeShiftHtml = readFileSync(
  new URL("../../src/pages/Fleet/Shifts/visualize-shift.html", import.meta.url),
  "utf8"
);

const trips = [
  {
    id: "depot-db-start",
    trip_id: "depot-start",
    start_stop_name: "Depot Yard",
    end_stop_name: "Terminal A",
    departure_time: "05:45:00",
    arrival_time: "06:00:00",
    stop_times: [
      { stop_name: "Depot Yard", departure_time: "05:45:00" },
      { stop_name: "Terminal A", arrival_time: "06:00:00" },
    ],
  },
  {
    id: "trip-db-1",
    trip_id: "gtfs-1",
    start_stop_name: "Terminal A",
    end_stop_name: "Terminal B",
    departure_time: "06:10:00",
    arrival_time: "06:42:00",
    stop_times: [
      { stop_name: "Terminal A", departure_time: "06:10:00", stop_lat: 46.01, stop_lon: 8.95 },
      { stop_name: "Town Hall", arrival_time: "06:25:00", stop_lat: 46.04, stop_lon: 8.98 },
      { stop_name: "Terminal B", arrival_time: "06:42:00", stop_lat: 46.08, stop_lon: 9.01 },
    ],
  },
  {
    id: "trip-db-2",
    trip_id: "gtfs-2",
    start_stop_name: "Terminal B",
    end_stop_name: "Terminal A",
    departure_time: "07:00:00",
    arrival_time: "07:39:00",
    stop_times: [
      { stop_name: "Terminal B", departure_time: "07:00:00", stop_lat: 46.08, stop_lon: 9.01 },
      { stop_name: "Museum", arrival_time: "07:12:00", stop_lat: 46.065, stop_lon: 8.99 },
      { stop_name: "Station", arrival_time: "07:26:00", stop_lat: 46.035, stop_lon: 8.97 },
      { stop_name: "Terminal A", arrival_time: "07:39:00", stop_lat: 46.01, stop_lon: 8.95 },
    ],
  },
  {
    id: "depot-db-end",
    trip_id: "depot-end",
    start_stop_name: "Terminal A",
    end_stop_name: "Depot Yard",
    departure_time: "07:45:00",
    arrival_time: "08:00:00",
    stop_times: [
      { stop_name: "Terminal A", departure_time: "07:45:00" },
      { stop_name: "Depot Yard", arrival_time: "08:00:00" },
    ],
  },
];

test.beforeEach(async ({ page }) => {
  await page.route("**/runtime-config.json", (route) =>
    route.fulfill({ json: { CARTO_API_KEY: "test-key" } })
  );
  await page.route("https://basemaps.cartocdn.com/**", (route) =>
    route.fulfill({ status: 204 })
  );
  await page.route("**/auth/**", (route) =>
    route.fulfill({ status: 401, json: { detail: "Unauthenticated test" } })
  );
  await page.route("**/api/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/v1/version") {
      return route.fulfill({ json: { version: "test" } });
    }
    if (pathname.includes("/api/v1/gtfs/elevation-profile/by-trip/")) {
      const reverse = pathname.endsWith("trip-db-2");
      return route.fulfill({
        json: {
          records: reverse
            ? [
                { latitude: 46.08, longitude: 9.01 },
                { latitude: 46.05, longitude: 8.985 },
                { latitude: 46.01, longitude: 8.95 },
              ]
            : [
                { latitude: 46.01, longitude: 8.95 },
                { latitude: 46.05, longitude: 8.985 },
                { latitude: 46.08, longitude: 9.01 },
              ],
        },
      });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto("./");
  await expect(page.locator(".landing-page")).toBeVisible();
  await page.evaluate(
    async ({ html, tripData }) => {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const section = parsed.querySelector(".visualize-shift");
      const host = document.querySelector(".layout-article");
      host.replaceChildren(section);
      const { initializeVisualizeShift } = await import(
        "/elettra/src/pages/Fleet/Shifts/visualize-shift.js"
      );
      window.cleanupShiftMapTest = await initializeVisualizeShift(document, {
        name: "Morning block",
        busModelName: "Electric 12 m",
        dailyDistanceKm: 128.4,
        startDepotName: "Depot North",
        startTime: "05:45:00",
        endDepotName: "Depot South",
        endTime: "22:10:00",
        gtfsDatasets: [
          {
            gtfs_year: 2026,
            gtfs_file_date: "2025-09-27",
            valid_from: "2025-12-14",
            valid_to: "2026-12-12",
          },
        ],
        trips: tripData,
      });
    },
    { html: visualizeShiftHtml, tripData: trips }
  );
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.cleanupShiftMapTest?.());
});

test("starts with space-time and switches to an ordered trip-by-trip map", async ({
  page,
}) => {
  const timeline = page.locator('[data-role="timeline"]');
  const mapPanel = page.locator('[data-role="trip-map"]');
  const diagram = page.locator('[data-role="space-time"]');

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Visualize vehicle block - Morning block"
  );
  const generalTable = page.locator(".shift-general-info__table");
  await expect(generalTable).toContainText("Morning block");
  await expect(generalTable).toContainText("Electric 12 m");
  await expect(generalTable).toContainText("128.4 km");
  await expect(generalTable).toContainText("Depot North (05:45)");
  await expect(generalTable).toContainText("Depot South (22:10)");
  await expect(generalTable).toContainText("2026 · file 27/09/2025");
  await expect(page.locator(".shift-summary__schedule")).toHaveCount(0);
  await expect(page.locator("#shift-visualization-heading")).toHaveCount(0);
  await expect(page.locator('[data-role="shift-gtfs-summary"] .gtfs-metadata')).toHaveCSS(
    "white-space",
    "nowrap"
  );
  await expect(timeline).toBeHidden();
  await expect(mapPanel).toBeHidden();
  await expect(diagram).toBeVisible();
  await expect(page.locator('[data-role="timeline-legend"]')).toBeHidden();
  await expect(page.locator(".shift-view-toggle__button")).toHaveText([
    "Space-time",
    "Map",
    "Timeline",
  ]);

  const dataGapsHelp = page.locator("#shift-view-data-gaps-help");
  await expect(dataGapsHelp).toBeHidden();
  await page.locator(".shift-view-help").hover();
  await expect(dataGapsHelp).toBeVisible();
  await expect(dataGapsHelp).toContainText("one trip ends at Stop A");

  const widths = await page.evaluate(() => ({
    information: document.querySelector(".shift-general-info")?.getBoundingClientRect().width,
    visualization: document.querySelector(".shift-visualization")?.getBoundingClientRect().width,
  }));
  expect(Math.abs(widths.information - widths.visualization)).toBeLessThan(2);
  const initialToggleRight = await page.locator(".shift-view-toggle").evaluate(
    (element) => element.getBoundingClientRect().right
  );

  await page.getByRole("button", { name: "Map", exact: true }).click();

  await expect(timeline).toBeHidden();
  await expect(mapPanel).toBeVisible();
  const mapCanvasHeight = await page.locator(".shift-trip-map__canvas").evaluate(
    (element) => element.getBoundingClientRect().height
  );
  expect(mapCanvasHeight).toBeGreaterThanOrEqual(
    (page.viewportSize()?.width ?? 0) <= 900 ? 552 : 648
  );
  const mapToggleRight = await page.locator(".shift-view-toggle").evaluate(
    (element) => element.getBoundingClientRect().right
  );
  expect(Math.abs(initialToggleRight - mapToggleRight)).toBeLessThan(2);
  await expect(page.locator('[data-role="trip-map-counter"]')).toHaveText(
    "Trip 1 of 2"
  );
  await expect(page.locator('[data-role="trip-map-route"]')).toHaveText(
    "Terminal A → Terminal B"
  );
  await expect(page.locator('[data-role="trip-map-stops"] li')).toHaveCount(3);
  await expect(page.locator(".shift-trip-map__marker")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "First trip" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Previous trip" })).toBeDisabled();

  await page.getByRole("button", { name: "Last trip" }).click();

  await expect(page.locator('[data-role="trip-map-counter"]')).toHaveText(
    "Trip 2 of 2"
  );
  await expect(page.locator('[data-role="trip-map-route"]')).toHaveText(
    "Terminal B → Terminal A"
  );
  await expect(page.locator('[data-role="trip-map-stops"] li')).toHaveCount(4);
  await expect(page.locator(".shift-trip-map__marker")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Next trip" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Last trip" })).toBeDisabled();

  await page.getByRole("button", { name: "First trip" }).click();
  await expect(page.locator('[data-role="trip-map-counter"]')).toHaveText(
    "Trip 1 of 2"
  );
  await expect(page.locator('[data-role="trip-map-route"]')).toHaveText(
    "Terminal A → Terminal B"
  );
});

test("returns to the timeline without losing the selected trip", async ({ page }) => {
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page.getByRole("button", { name: "Next trip" }).click();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();

  await expect(page.locator('[data-role="timeline"]')).toBeVisible();
  await expect(page.locator('[data-role="timeline-legend"]')).toBeVisible();
  const timelineMetrics = await page.locator('[data-role="timeline"]').evaluate(
    (element) => ({
      viewportWidth: document.documentElement.clientWidth,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      chartWidth:
        element.querySelector(".timeline__chart")?.getBoundingClientRect().width ?? 0,
    })
  );
  if (timelineMetrics.viewportWidth <= 600) {
    expect(timelineMetrics.scrollWidth).toBeGreaterThan(timelineMetrics.clientWidth);
    expect(timelineMetrics.chartWidth).toBeGreaterThanOrEqual(700);
  }

  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator('[data-role="trip-map-counter"]')).toHaveText(
    "Trip 2 of 2"
  );
});

test("renders a FART-style space-time diagram for all trips", async ({ page }) => {
  const timeline = page.locator('[data-role="timeline"]');
  const mapPanel = page.locator('[data-role="trip-map"]');
  const diagram = page.locator('[data-role="space-time"]');
  const toggle = page.locator(".shift-view-toggle");
  const toggleRight = await toggle.evaluate(
    (element) => element.getBoundingClientRect().right
  );

  await expect(timeline).toBeHidden();
  await expect(mapPanel).toBeHidden();
  await expect(diagram).toBeVisible();
  await expect(page.locator('[data-role="timeline-legend"]')).toBeHidden();
  await expect(diagram.getByRole("heading", { name: "All routes" })).toBeAttached();
  await expect(diagram.getByRole("heading", { name: "All routes" })).toHaveClass("sr-only");
  await expect(diagram).toContainText("2 trips · 5 stops");
  await expect(diagram.locator('[data-role="space-time-trip"]')).toHaveCount(2);
  await expect(diagram.locator('[data-role="space-time-stop-line"]')).toHaveCount(6);
  await expect(diagram.locator('[data-role="space-time-depot-trip"]')).toHaveCount(2);
  await expect(diagram).toContainText("Depot Yard");
  await expect(diagram.locator(".shift-space-time__trip-label")).toHaveCount(0);
  await expect(diagram).not.toContainText("gtfs-1");
  await expect(
    page.getByRole("button", { name: "Space-time", exact: true })
  ).toHaveAttribute("aria-pressed", "true");

  const diagramToggleRight = await toggle.evaluate(
    (element) => element.getBoundingClientRect().right
  );
  expect(Math.abs(toggleRight - diagramToggleRight)).toBeLessThan(2);

});

test("keeps 40104 depot transfers separate from the service stop order", async ({ page }) => {
  const shiftTrips = [
    {
      id: "db-depot-start",
      trip_id: "depot-start",
      start_stop_name: "TPL Rimessa 2",
      end_stop_name: "Pazzallo",
      departure_time: "05:40:00",
      arrival_time: "06:00:00",
      sequence_number: 1,
    },
    {
      id: "db-service",
      trip_id: "service-40104",
      start_stop_name: "Pazzallo",
      end_stop_name: "Lugano Centro",
      departure_time: "06:00:00",
      arrival_time: "06:30:00",
      sequence_number: 2,
    },
    {
      id: "db-service-return",
      trip_id: "service-40104-return",
      start_stop_name: "Lugano Centro",
      end_stop_name: "Pazzallo",
      departure_time: "06:35:00",
      arrival_time: "07:05:00",
      sequence_number: 3,
    },
    {
      id: "db-depot-mid-in",
      trip_id: "depot-mid-in",
      start_stop_name: "Pazzallo",
      end_stop_name: "TPL Rimessa 1",
      departure_time: "08:56:00",
      arrival_time: "09:13:00",
      sequence_number: 4,
    },
    {
      id: "db-depot-mid-out",
      trip_id: "depot-mid-out",
      start_stop_name: "TPL Rimessa 1",
      end_stop_name: "Lugano Centro",
      departure_time: "11:15:00",
      arrival_time: "11:30:00",
      sequence_number: 5,
    },
    {
      id: "db-service-afternoon",
      trip_id: "service-40104-afternoon",
      start_stop_name: "Lugano Centro",
      end_stop_name: "Pazzallo",
      departure_time: "11:30:00",
      arrival_time: "12:00:00",
      sequence_number: 6,
    },
    {
      id: "db-depot-end",
      trip_id: "depot-end",
      start_stop_name: "Pazzallo",
      end_stop_name: "TPL Rimessa 1",
      departure_time: "12:00:00",
      arrival_time: "12:20:00",
      sequence_number: 7,
    },
  ];
  const stopsByTrip = Object.fromEntries(
    shiftTrips.map((trip) => [
      trip.id,
      [
        { stop_name: trip.start_stop_name, departure_time: trip.departure_time },
        { stop_name: trip.end_stop_name, arrival_time: trip.arrival_time },
      ],
    ])
  );

  await page.route("**/api/v1/user/shifts/40104**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/40104/info")) {
      return route.fulfill({
        json: {
          id: "40104",
          name: "40104",
          bus_id: null,
          route: { id: "route-1", name: "1" },
          days_of_week: ["monday"],
          trips: shiftTrips,
          gtfs_datasets: [],
        },
      });
    }
    return route.fulfill({
      json: {
        id: "40104",
        name: "40104",
        bus_id: null,
        daily_distance_km: 10,
        gtfs_datasets: [],
        structure: shiftTrips.map((trip) => ({
          id: `structure-${trip.id}`,
          trip_id: trip.id,
          shift_id: "40104",
          sequence_number: trip.sequence_number,
        })),
      },
    });
  });
  await page.route("**/api/v1/gtfs/gtfs-stops/by-trip/**", (route) => {
    const tripId = new URL(route.request().url()).pathname.split("/").pop();
    return route.fulfill({ json: stopsByTrip[tripId] ?? [] });
  });

  await page.evaluate(() => window.cleanupShiftMapTest?.());
  await page.evaluate(async (html) => {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const section = parsed.querySelector(".visualize-shift");
    document.querySelector(".layout-article").replaceChildren(section);
    const { initializeVisualizeShift } = await import(
      "/elettra/src/pages/Fleet/Shifts/visualize-shift.js"
    );
    window.cleanupShiftMapTest = await initializeVisualizeShift(document, {
      shiftId: "40104",
    });
  }, visualizeShiftHtml);

  await expect(page.locator('[data-field="start-summary"]')).toHaveText(
    "TPL Rimessa 2 (05:40)"
  );
  await expect(page.locator('[data-field="end-summary"]')).toHaveText(
    "TPL Rimessa 1 (12:20)"
  );
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".timeline__depot-line")).toHaveCount(4);
  await expect(page.locator(".timeline__depot-dwell")).toHaveCount(1);
  await expect(page.locator(".timeline__stop-label")).toHaveText([
    "TPL Rimessa 2",
    "Pazzallo",
    "Lugano Centro",
    "TPL Rimessa 1",
  ]);
  await page.getByRole("button", { name: "Space-time", exact: true }).click();
  const diagram = page.locator('[data-role="space-time"]');
  await expect(diagram).toContainText("3 trips · 2 stops");
  await expect(diagram.locator('[data-role="space-time-depot-trip"]')).toHaveCount(4);
  await expect(diagram.locator('[data-role="space-time-depot-dwell"]')).toHaveCount(1);
  await expect(diagram).toContainText("TPL Rimessa 1");
  await expect(diagram).toContainText("TPL Rimessa 2");
  const stopPositions = await diagram.locator("[data-stop-name]").evaluateAll(
    (labels) => Object.fromEntries(
      labels.map((label) => [label.getAttribute("data-stop-name"), label.getBoundingClientRect().top])
    )
  );
  expect(stopPositions["TPL Rimessa 2"]).toBeLessThan(stopPositions.Pazzallo);
  expect(stopPositions["TPL Rimessa 1"]).toBeGreaterThan(stopPositions["Lugano Centro"]);
});

test("separates a multi-line shift using each trip route", async ({ page }) => {
  const shiftTrips = [
    {
      id: "trip-route-10",
      trip_id: "gtfs-route-10",
      start_stop_name: "Shared terminal",
      end_stop_name: "Line 10 terminal",
      departure_time: "06:00:00",
      arrival_time: "06:30:00",
      sequence_number: 1,
    },
    {
      id: "trip-route-20",
      trip_id: "gtfs-route-20",
      start_stop_name: "Shared terminal",
      end_stop_name: "Line 20 terminal",
      departure_time: "06:40:00",
      arrival_time: "07:10:00",
      sequence_number: 2,
    },
  ];
  const stopsByTrip = {
    "trip-route-10": [
      { id: "shared-stop", stop_name: "Shared terminal", departure_time: "06:00:00" },
      { id: "line-10-stop", stop_name: "Line 10 terminal", arrival_time: "06:30:00" },
    ],
    "trip-route-20": [
      { id: "shared-stop", stop_name: "Shared terminal", departure_time: "06:40:00" },
      { id: "line-20-stop", stop_name: "Line 20 terminal", arrival_time: "07:10:00" },
    ],
  };
  let tripsByStopCalls = 0;

  await page.route("**/api/v1/user/shifts/40803**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/40803/info")) {
      return route.fulfill({
        json: {
          id: "40803",
          name: "40803",
          route: { id: "route-10", name: "10" },
          trips: shiftTrips,
          gtfs_datasets: [],
        },
      });
    }
    return route.fulfill({
      json: {
        id: "40803",
        name: "40803",
        gtfs_datasets: [],
        structure: shiftTrips.map((trip) => ({
          trip_id: trip.id,
          sequence_number: trip.sequence_number,
        })),
      },
    });
  });
  await page.route("**/api/v1/gtfs/gtfs-stops/by-trip/**", (route) => {
    const tripId = new URL(route.request().url()).pathname.split("/").pop();
    return route.fulfill({ json: stopsByTrip[tripId] ?? [] });
  });
  await page.route("**/api/v1/gtfs/gtfs-trips/by-stop/**", (route) => {
    tripsByStopCalls += 1;
    return route.fulfill({
      json: [
        { id: "trip-route-10", trip_id: "gtfs-route-10", route_id: "route-10" },
        { id: "trip-route-20", trip_id: "gtfs-route-20", route_id: "route-20" },
      ],
    });
  });
  await page.route("**/api/v1/gtfs/gtfs-routes/**", (route) => {
    const routeId = new URL(route.request().url()).pathname.split("/").pop();
    return route.fulfill({
      json: {
        id: routeId,
        route_short_name: routeId === "route-10" ? "10" : "20",
      },
    });
  });

  await page.evaluate(() => window.cleanupShiftMapTest?.());
  await page.evaluate(async (html) => {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const section = parsed.querySelector(".visualize-shift");
    document.querySelector(".layout-article").replaceChildren(section);
    const { initializeVisualizeShift } = await import(
      "/elettra/src/pages/Fleet/Shifts/visualize-shift.js"
    );
    window.cleanupShiftMapTest = await initializeVisualizeShift(document, {
      shiftId: "40803",
    });
  }, visualizeShiftHtml);

  const groups = page.locator(".shift-space-time__group");
  await expect(groups).toHaveCount(2);
  await expect(groups.locator("h3")).toHaveText(["Line 10", "Line 20"]);
  await expect(groups.nth(0).locator(".shift-space-time__group-metadata"))
    .toContainText(/1 trips? · 2 stops/);
  await expect(groups.nth(1).locator(".shift-space-time__group-metadata"))
    .toContainText(/1 trips? · 2 stops/);
  expect(tripsByStopCalls).toBe(1);
});

test("renders a shift containing only connected transfers in every view", async ({ page }) => {
  const transferTrips = [
    {
      id: "transfer-out",
      trip_id: "depot-transfer-out",
      status: "depot",
      start_stop_name: "TPL Rimessa 2",
      end_stop_name: "Canobbio, Mercato Resega",
      departure_time: "17:16:00",
      arrival_time: "17:21:00",
      stop_times: [
        { id: "depot", stop_name: "TPL Rimessa 2", departure_time: "17:16:00", stop_lat: 46.02, stop_lon: 8.94 },
        { id: "market", stop_name: "Canobbio, Mercato Resega", arrival_time: "17:21:00", stop_lat: 46.04, stop_lon: 8.96 },
      ],
    },
    {
      id: "transfer-in",
      trip_id: "depot-transfer-in",
      status: "depot",
      start_stop_name: "Canobbio, Mercato Resega",
      end_stop_name: "TPL Rimessa 2",
      departure_time: "18:38:00",
      arrival_time: "18:42:00",
      stop_times: [
        { id: "market", stop_name: "Canobbio, Mercato Resega", departure_time: "18:38:00", stop_lat: 46.04, stop_lon: 8.96 },
        { id: "depot", stop_name: "TPL Rimessa 2", arrival_time: "18:42:00", stop_lat: 46.02, stop_lon: 8.94 },
      ],
    },
  ];

  await page.evaluate(() => window.cleanupShiftMapTest?.());
  await page.evaluate(
    async ({ html, tripData }) => {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const section = parsed.querySelector(".visualize-shift");
      document.querySelector(".layout-article").replaceChildren(section);
      const { initializeVisualizeShift } = await import(
        "/elettra/src/pages/Fleet/Shifts/visualize-shift.js"
      );
      window.cleanupShiftMapTest = await initializeVisualizeShift(document, {
        name: "40311",
        startDepotName: "TPL Rimessa 2",
        startTime: "17:16:00",
        endDepotName: "TPL Rimessa 2",
        endTime: "18:42:00",
        trips: tripData,
      });
    },
    { html: visualizeShiftHtml, tripData: transferTrips }
  );

  const diagram = page.locator('[data-role="space-time"]');
  await expect(diagram.locator(".shift-space-time__group-metadata"))
    .toContainText("2 transfers · 1 stops");
  await expect(diagram.locator('[data-role="space-time-depot-trip"]')).toHaveCount(2);
  await expect(diagram.locator('[data-role="space-time-depot-dwell"]')).toHaveCount(1);
  await expect(diagram).not.toContainText("Unconnected transfers");

  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".timeline__depot-line")).toHaveCount(2);
  await expect(page.locator(".timeline__depot-dwell")).toHaveCount(1);
  await expect(page.locator(".timeline__stop-label")).toHaveText([
    "TPL Rimessa 2",
    "Canobbio, Mercato Resega",
  ]);

  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator('[data-role="trip-map-counter"]')).toHaveText("Trip 1 of 2");
  await expect(page.locator('[data-role="trip-map-route"]')).toHaveText(
    "TPL Rimessa 2 → Canobbio, Mercato Resega"
  );
});

test("flags a gap between transfer-only movements", async ({ page }) => {
  const transferTrips = [
    {
      id: "transfer-out",
      trip_id: "depot-transfer-out",
      status: "depot",
      stop_times: [
        { stop_name: "TPL Rimessa 2", departure_time: "07:39:00" },
        { stop_name: "Lugano, Stazione", arrival_time: "07:55:00" },
      ],
    },
    {
      id: "transfer-in",
      trip_id: "depot-transfer-in",
      status: "depot",
      stop_times: [
        { stop_name: "Lugano, Cornaredo", departure_time: "08:12:00" },
        { stop_name: "TPL Rimessa 2", arrival_time: "08:17:00" },
      ],
    },
  ];

  await page.evaluate(() => window.cleanupShiftMapTest?.());
  await page.evaluate(
    async ({ html, tripData }) => {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const section = parsed.querySelector(".visualize-shift");
      document.querySelector(".layout-article").replaceChildren(section);
      const { initializeVisualizeShift } = await import(
        "/elettra/src/pages/Fleet/Shifts/visualize-shift.js"
      );
      window.cleanupShiftMapTest = await initializeVisualizeShift(document, {
        name: "40608",
        startDepotName: "TPL Rimessa 2",
        startTime: "07:39:00",
        endDepotName: "TPL Rimessa 2",
        endTime: "08:17:00",
        trips: tripData,
      });
    },
    { html: visualizeShiftHtml, tripData: transferTrips }
  );

  const gap = page.locator(".shift-space-time__gap-key");
  await expect(gap).toHaveText("Unconnected transfers: 1");
  await expect(gap).toHaveAttribute(
    "title",
    "Lugano, Stazione 07:55 - Lugano, Cornaredo 08:12"
  );
  await expect(page.locator('[data-role="space-time-depot-dwell"]')).toHaveCount(0);
});
