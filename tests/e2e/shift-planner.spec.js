import { test, expect, edition } from "../../test-support/shift-composer-fixture.js";
import {
  plannerAction, plannerApi, plannerCatalog, plannerField, plannerTrip, startPlanner,
} from "../../test-support/shift-planner-fixture.js";

const role = (page, name) => page.locator(`[data-role="${name}"]`);
const activity = (page, index) => role(page, "programme").locator(`[data-step-index="${index}"]`);
const rowAction = (row, name) => row.locator(`[data-row-action="${name}"]`);
const savedSteps = [
  { kind: "service", trip_id: "night-a", transfer_departure: "23:45:00", transfer_arrival: "23:50:00" },
  { kind: "service", trip_id: "night-b", transfer_departure: "24:15:00", transfer_arrival: "24:15:00" },
  { kind: "return", transfer_departure: "24:35:00", arrival: "24:50:00" },
];

const storedProgramme = {
  id: "sequential", name: "Night", bus_id: "bus", gtfs_dataset: edition, revision: 3,
  programme: { version: 1, weekday: "monday", depot_id: "depot", start_time: "23:45:00", steps: savedSteps },
  trips: plannerCatalog.filter(({ id }) => ["night-a", "night-b"].includes(id)),
};

const programmeFixture = (request) => {
  const { path, method } = request;
  if (path.endsWith("/shifts/") && method === "GET") {
    return { json: [
      { id: "sequential", name: "Night", bus_id: "bus", trip_count: 2, start_time: "23:45", end_time: "24:50", daily_distance_km: 30, planner_version: 1, service_weekday: "monday", gtfs_datasets: [edition] },
    ] };
  }
  if (path.endsWith("/shift-planner/programmes/sequential") || path.endsWith("/shift-planner/programmes")) {
    return { json: storedProgramme };
  }
  if (path.endsWith("/buses/bus")) return { json: { id: "bus", user_id: "user", bus_model_id: "model" } };
  return plannerApi(request);
};

test("creates one sequential programme across midnight and retries with the same request ID", async ({ page, composer }) => {
  let requests = 0;
  const state = await composer({ application: true, entry: "shifts", depots: [
    { id: "depot", user_id: "user", name: "Main depot", stop_id: "depot-stop" },
    { id: "charging", user_id: "user", name: "Charging terminus", stop_id: "charging-stop", features: { type: "charging" } },
  ], respond: (request) => {
    if (request.path.endsWith("/shift-planner/programmes") && request.method === "POST") {
      return ++requests === 1 ? { status: 503, json: { detail: "Temporary failure" } } : { json: { id: "new" } };
    }
    return plannerApi(request);
  } });

  await plannerAction(page, "add-shift").click();
  await expect(plannerField(page, "depot")).toBeDisabled();
  await expect(plannerField(page, "line")).toBeHidden();
  await startPlanner(page);
  await expect(plannerField(page, "depot").locator('option[value="charging"]')).toHaveCount(0);
  await expect(plannerField(page, "include-other-termini")).toBeHidden();
  await expect(role(page, "current-state")).toContainText("Main depot from 23:45");
  await expect(plannerTrip(page, "too-early")).toHaveCount(0);
  await expect(role(page, "catalog").locator("[data-trip-id]").first()).toHaveAttribute("data-trip-id", "night-a");
  await expect(role(page, "catalog").locator('[data-trip-id="night-a"] [data-role="step-warning"]')).toContainText("5 min");
  await plannerTrip(page, "night-a").click();
  await expect(plannerField(page, "transfer-arrival")).toHaveValue("23:50");
  await expect(role(page, "draft").locator('[data-role="step-warning"]')).toContainText("5 min");
  await plannerAction(page, "confirm-step").click();
  await expect(role(page, "current-state")).toContainText("Station platform 1 from 00:15 (+1)");
  expect(state.reads.filter((href) => href.includes("from_stop_id=depot-stop&to_stop_id=a"))).toHaveLength(1);
  await expect(plannerField(page, "include-other-termini")).not.toBeChecked();
  await expect(plannerTrip(page, "night-other")).toHaveCount(0);
  await expect(role(page, "catalog").locator("[data-trip-id]").first()).toHaveAttribute("data-trip-id", "night-b");
  await expect(plannerTrip(page, "night-c")).toBeVisible();
  await plannerField(page, "include-other-termini").check();
  await expect(role(page, "catalog").locator("[data-trip-id]").first()).toHaveAttribute("data-trip-id", "night-other");
  await plannerField(page, "include-other-termini").uncheck();

  await plannerTrip(page, "night-b").click();
  await expect(plannerField(page, "transfer-departure")).toHaveValue("24:15");
  await expect(plannerField(page, "transfer-arrival")).toHaveValue("24:15");
  expect(state.reads.some((href) => href.includes("from_stop_id=b1&to_stop_id=b2"))).toBe(false);
  await plannerField(page, "force-transfer").check();
  await expect(role(page, "draft").locator('[data-role="step-conflict"]')).toContainText("positive travel time");
  await plannerField(page, "force-transfer").uncheck();
  await role(page, "catalog").locator('[data-trip-id="night-b"] [data-action="add-direct-trip"]').click();

  await plannerAction(page, "choose-stay").click();
  await expect(plannerField(page, "stay-depot").locator('option[value="charging"]')).toHaveText("Charging terminus");
  await expect(plannerField(page, "transfer-arrival")).toHaveValue("24:50");
  await plannerField(page, "stay-departure").fill("25:10");
  await plannerAction(page, "confirm-step").click();
  await plannerAction(page, "choose-stay").click();
  await expect(plannerField(page, "transfer-arrival")).toHaveValue("25:10");
  await plannerField(page, "stay-departure").fill("25:35");
  await plannerAction(page, "confirm-step").click();

  await expect(plannerAction(page, "save")).toBeDisabled();
  await plannerAction(page, "choose-return").click();
  await plannerAction(page, "confirm-step").click();
  await expect(role(page, "current-state")).toContainText("returned to main depot at 01:35 (+1)", { ignoreCase: true });
  await plannerField(page, "name").fill("Night with stays");
  await plannerField(page, "bus").selectOption("bus");
  await plannerAction(page, "save").click();
  await expect(role(page, "feedback")).toContainText("Temporary failure");
  await plannerAction(page, "save").click();
  await expect(page.locator("section.shifts")).toBeVisible();

  expect(state.writes).toHaveLength(2);
  expect(state.writes[0].body).toEqual(state.writes[1].body);
  expect(state.writes[1]).toEqual({
    path: "/api/v1/user/shift-planner/programmes", method: "POST",
    body: {
      name: "Night with stays", bus_id: "bus", gtfs_dataset: edition, request_id: expect.stringMatching(/^[a-f0-9-]{36}$/),
      programme: { version: 1, weekday: "monday", depot_id: "depot", start_time: "23:45:00", steps: [
        ...savedSteps.slice(0, 2),
        { kind: "stay", depot_id: "depot", transfer_departure: "24:35:00", arrival: "24:50:00", departure: "25:10:00" },
        { kind: "stay", depot_id: "depot", transfer_departure: "25:10:00", arrival: "25:10:00", departure: "25:35:00" },
        { kind: "return", transfer_departure: "25:35:00", arrival: "25:35:00" },
      ] },
    },
  });
});

test("scopes a new line to the current terminus and offers the whole line after a special stop", async ({ page, composer }) => {
  const [otherTrip] = plannerCatalog;
  const otherLine = [
    { ...otherTrip, id: "other-line-early", route_id: "line-2", departure_time: "24:20:00", arrival_time: "24:30:00" },
    { ...otherTrip, id: "other-line-late", route_id: "line-2", departure_time: "24:40:00", arrival_time: "25:00:00" },
  ];
  const state = await composer({ application: true, entry: "shifts", depots: [
    { id: "depot", user_id: "user", name: "Main depot", stop_id: "depot-stop" },
    { id: "charging", user_id: "user", name: "Charging terminus", stop_id: "charging-stop", features: { type: "charging" } },
  ], respond: (request) => {
    if (request.path.endsWith("/shift-planner/catalog") && request.url.searchParams.get("route_id") === "line-2") {
      return { json: otherLine };
    }
    return plannerApi(request);
  } });
  const includeOtherTermini = plannerField(page, "include-other-termini");
  await plannerAction(page, "add-shift").click();
  await startPlanner(page);
  await plannerTrip(page, "night-a").click();
  await plannerAction(page, "confirm-step").click();
  await includeOtherTermini.check();
  await plannerField(page, "line").selectOption("line-2");
  await expect(role(page, "catalog")).toContainText("Station platform 1");
  await expect(role(page, "catalog")).toContainText("Include other termini");
  await expect(includeOtherTermini).not.toBeChecked();
  await expect(plannerTrip(page, "other-line-early")).toHaveCount(0);
  expect(state.reads.some((href) => href.includes("from_stop_id=b1&to_stop_id=other"))).toBe(false);

  await includeOtherTermini.check();
  await expect(plannerTrip(page, "other-line-early")).toBeVisible();
  await expect(role(page, "catalog").locator('[data-trip-id="other-line-early"] [data-role="step-warning"]')).toContainText("5 min");
  expect(state.reads.filter((href) => href.includes("from_stop_id=b1&to_stop_id=other"))).toHaveLength(1);

  await plannerAction(page, "choose-stay").click();
  await plannerField(page, "stay-depot").selectOption("charging");
  await expect(plannerField(page, "transfer-arrival")).toHaveValue("24:30");
  await plannerField(page, "stay-departure").fill("24:35");
  await plannerAction(page, "confirm-step").click();
  await expect(role(page, "current-state")).toContainText("Charging terminus from 00:35 (+1)");
  await expect(includeOtherTermini).toBeHidden();
  await expect(plannerTrip(page, "other-line-early")).toHaveCount(0);
  await expect(plannerTrip(page, "other-line-late")).toBeVisible();
});

test("reopens the saved sequence, marks an insertion conflict and undoes the insertion", async ({ page, composer }) => {
  let releaseEstimate;
  const depotEstimate = new Promise(resolve => { releaseEstimate = resolve; });
  const state = await composer({ application: true, entry: "shifts", respond: async (request) => {
    if (request.path.endsWith("/shift-planner/route") && request.url.searchParams.get("from_stop_id") === "b1"
      && request.url.searchParams.get("to_stop_id") === "depot-stop") await depotEstimate;
    return programmeFixture(request);
  } });
  const row = page.locator('[data-id="sequential"]');
  await rowAction(row, "edit").click();
  await expect(activity(page, 1)).toContainText("00:15 (+1)–00:35 (+1)");
  await expect(activity(page, 2)).toHaveAttribute("data-kind", "return");
  await expect(plannerField(page, "weekday")).toHaveValue("monday");
  await activity(page, 1).locator('[data-action="edit-step"]').click();
  await expect(plannerField(page, "include-other-termini")).not.toBeChecked();
  await expect(plannerTrip(page, "night-b")).toBeVisible();
  await expect(plannerTrip(page, "night-other")).toHaveCount(0);
  await plannerField(page, "include-other-termini").check();
  await expect(plannerTrip(page, "night-other")).toBeVisible();
  await activity(page, 1).locator('[data-action="insert-before"]').click();
  await expect(plannerField(page, "include-other-termini")).not.toBeChecked();
  await expect(plannerTrip(page, "night-b")).toHaveCount(0);
  await expect(plannerTrip(page, "night-c")).toBeVisible();
  await expect(plannerTrip(page, "night-other")).toHaveCount(0);
  await plannerAction(page, "choose-stay").click();
  await plannerField(page, "stay-departure").fill("24:25");
  const arrival = plannerField(page, "transfer-arrival");
  await arrival.press("ControlOrMeta+a");
  const estimated = page.waitForResponse(response => {
    const requested = new URL(response.url());
    return requested.pathname.endsWith("/shift-planner/route") && requested.searchParams.get("from_stop_id") === "b1"
      && requested.searchParams.get("to_stop_id") === "depot-stop";
  });
  releaseEstimate();
  await (await estimated).finished();
  await expect(arrival).toHaveValue("24:15");
  await page.keyboard.insertText("24:20");
  await expect(arrival).toHaveValue("24:20");
  await expect(role(page, "draft-notice")).toContainText("15 min");
  await plannerAction(page, "confirm-step").click();

  await expect(activity(page, 2)).toContainText("Station platform 2");
  await expect(activity(page, 2)).toHaveAttribute("data-conflict", "true");
  await expect(activity(page, 3)).toHaveAttribute("data-kind", "return");
  await expect(plannerAction(page, "save")).toBeDisabled();
  await page.locator(".language-select").selectOption("it");
  await expect(activity(page, 2)).toContainText("La partenza precede la disponibilità del veicolo");
  await plannerAction(page, "undo").click();
  await expect(activity(page, 1)).toHaveAttribute("data-conflict", "false");
  await expect(activity(page, 2)).toHaveAttribute("data-kind", "return");
  await expect(activity(page, 3)).toHaveCount(0);

  await plannerField(page, "name").fill("Night updated");
  await plannerAction(page, "save").click();
  await expect(page.locator("section.shifts")).toBeVisible();
  expect(state.writes).toEqual([{
    path: "/api/v1/user/shift-planner/programmes/sequential", method: "PUT",
    body: { name: "Night updated", bus_id: "bus", gtfs_dataset: edition, revision: 3, programme: storedProgramme.programme },
  }]);
});

test("duplicates the complete persisted programme from the list", async ({ page, composer }) => {
  const state = await composer({ application: true, entry: "shifts", respond: programmeFixture });
  await rowAction(page.locator('[data-id="sequential"]'), "duplicate").click();
  await expect(role(page, "flash")).toBeVisible();
  expect(state.writes).toEqual([{
    path: "/api/v1/user/shift-planner/programmes", method: "POST",
    body: {
      name: "Night_copy_1", bus_id: "bus", gtfs_dataset: edition,
      request_id: expect.stringMatching(/^[a-f0-9-]{36}$/), copy_from: "sequential", programme: storedProgramme.programme,
    },
  }]);
});


test("allows an explicit timed transfer within the same station despite a short driving window", async ({ page, composer }) => {
  const state = await composer({ application: true, entry: "shifts", respond: (request) => {
    if (request.method === "POST" && request.path.endsWith("/shift-planner/programmes")) return { json: { id: "new" } };
    return plannerApi(request);
  } });
  await plannerAction(page, "add-shift").click();
  await startPlanner(page);
  await plannerTrip(page, "night-a").click();
  await plannerAction(page, "confirm-step").click();
  await plannerTrip(page, "night-c").click();
  await plannerField(page, "force-transfer").check();
  await plannerField(page, "transfer-arrival").fill("24:16");
  await expect(role(page, "draft").locator('[data-role="step-warning"]')).toContainText("1 min");
  await plannerAction(page, "confirm-step").click();
  await plannerAction(page, "choose-return").click();
  await expect(plannerField(page, "transfer-arrival")).toHaveValue("24:40");
  await plannerAction(page, "confirm-step").click();
  await plannerField(page, "name").fill("Forced transfer");
  await plannerField(page, "bus").selectOption("bus");
  await plannerAction(page, "save").click();
  await expect(page.locator("section.shifts")).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body.programme.steps[1]).toEqual({
    kind: "service", trip_id: "night-c", transfer_departure: "24:15:00", transfer_arrival: "24:16:00", force_transfer: true,
  });
});

test("opens an elevation profile without adding a trip and reuses it in the programme", async ({ page, composer }) => {
  const profileReads = [];
  const points = [
    { latitude: 46, longitude: 8.95, altitude_m: 285, cumulative_distance_m: 0 },
    { latitude: 46.01, longitude: 8.96, altitude_m: 340, cumulative_distance_m: 1040 },
  ];
  // The geometry and elevation come from the API regardless of the tile provider.
  await page.route("https://tile.openstreetmap.org/**", route => route.abort());
  const state = await composer({ application: true, entry: "shifts", respond: (request) => {
    if (request.path.includes("/elevation-profile/by-trip/")) {
      profileReads.push(request.path.split("/").at(-1));
      return { json: { records: points } };
    }
    return plannerApi(request);
  } });
  await plannerAction(page, "add-shift").click();
  await startPlanner(page);
  const row = role(page, "catalog").locator('tr[data-trip-id="night-a"]');
  const toggle = row.locator('[data-action="preview-trip"]');
  await toggle.focus();
  await toggle.press("Enter");
  const preview = page.locator("#planner-trip-profile");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(preview.getByRole("img", { name: "Elevation profile" })).toBeVisible();
  await expect(preview.locator(".leaflet-overlay-pane path").first()).toBeVisible();
  await expect(preview.locator("svg.elevation-chart-inline")).toContainText("340");
  const textPixels = await preview.locator(".elevation-chart-inline text").first().evaluate(node =>
    parseFloat(getComputedStyle(node).fontSize) * node.getScreenCTM().a);
  expect(textPixels).toBeGreaterThanOrEqual(11);
  await expect(role(page, "programme").locator("[data-step-index]")).toHaveCount(0);
  await toggle.press("Enter");
  await expect(preview).toHaveCount(0);
  await plannerTrip(page, "night-a").click();
  await plannerAction(page, "confirm-step").click();
  await activity(page, 0).locator('[data-action="preview-trip"]').click();
  await expect(activity(page, 0).getByRole("img", { name: "Elevation profile" })).toBeVisible();
  expect(profileReads).toEqual(["night-a"]);
  expect(state.writes).toEqual([]);
});

test("keeps a failed profile retryable and closes it when the candidate disappears", async ({ page, composer }) => {
  let attempts = 0;
  await page.route("https://tile.openstreetmap.org/**", route => route.abort());
  await composer({ application: true, entry: "shifts", respond: (request) => {
    if (request.path.endsWith("/elevation-profile/by-trip/night-a")) {
      if (++attempts === 1) return { status: 503, json: { detail: "Temporary failure" } };
      return { json: { records: [{ altitude_m: 319, cumulative_distance_m: 0 }] } };
    }
    return plannerApi(request);
  } });
  await plannerAction(page, "add-shift").click();
  await startPlanner(page);
  const toggle = role(page, "catalog").locator('tr[data-trip-id="night-a"] [data-action="preview-trip"]');
  await toggle.click();
  await expect(role(page, "elevation")).toContainText("Failed to load elevation");
  await toggle.click();
  await toggle.click();
  await expect(role(page, "elevation").getByRole("img")).toContainText("319");
  await expect(role(page, "map")).toHaveText("No route data available");
  await plannerField(page, "line").selectOption("");
  await expect(page.locator("#planner-trip-profile")).toHaveCount(0);
  expect(attempts).toBe(2);
});
