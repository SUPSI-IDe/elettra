import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const visualizeShiftHtml = readFileSync(
  new URL("../../src/pages/Fleet/Shifts/visualize-shift.html", import.meta.url),
  "utf8"
);

const trips = [
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

test("switches from the timeline to an ordered trip-by-trip map", async ({
  page,
}) => {
  const timeline = page.locator('[data-role="timeline"]');
  const mapPanel = page.locator('[data-role="trip-map"]');

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
  await expect(timeline).toBeVisible();
  await expect(mapPanel).toBeHidden();

  const widths = await page.evaluate(() => ({
    information: document.querySelector(".shift-general-info")?.getBoundingClientRect().width,
    visualization: document.querySelector(".shift-visualization")?.getBoundingClientRect().width,
  }));
  expect(Math.abs(widths.information - widths.visualization)).toBeLessThan(2);
  if ((page.viewportSize()?.width ?? 0) > 600) {
    const controlTops = await page.evaluate(() => ({
      legend: document.querySelector('[data-role="timeline-legend"]')?.getBoundingClientRect().top,
      toggle: document.querySelector(".shift-view-toggle")?.getBoundingClientRect().top,
    }));
    expect(Math.abs(controlTops.legend - controlTops.toggle)).toBeLessThan(8);
  }

  const timelineToggleRight = await page.locator(".shift-view-toggle").evaluate(
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
  expect(Math.abs(timelineToggleRight - mapToggleRight)).toBeLessThan(2);
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

  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator('[data-role="trip-map-counter"]')).toHaveText(
    "Trip 2 of 2"
  );
});
