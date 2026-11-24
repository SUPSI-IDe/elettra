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

test("enters clocks in minutes and rounds road travel time across midnight", async ({ page, composer }) => {
  const earlyArrival = plannerCatalog.map(trip => trip.id === "night-a" ? { ...trip, arrival_time: "23:57:00" } : trip);
  await composer({ application: true, entry: "shifts", depots: [
    { id: "depot", user_id: "user", name: "Main depot", stop_id: "depot-stop" },
    { id: "second", user_id: "user", name: "Second depot", stop_id: "second-stop" },
    { id: "nearby", user_id: "user", name: "Nearby depot", stop_id: "nearby-stop" },
  ], respond: (request) => {
    if (request.path.endsWith("/shift-planner/catalog")) return { json: earlyArrival };
    if (request.path.endsWith("/shift-planner/route") && request.url.searchParams.get("from_stop_id") === "b1") {
      const seconds = { "depot-stop": 390, "second-stop": 389.9, "nearby-stop": 10 };
      return { json: { duration_seconds: seconds[request.url.searchParams.get("to_stop_id")] } };
    }
    return plannerApi(request);
  } });
  await plannerAction(page, "add-shift").click();
  await plannerField(page, "weekday").selectOption("monday");
  await plannerField(page, "depot").selectOption("depot");
  const start = plannerField(page, "start-time");
  await start.pressSequentially("0500");
  await expect(start).toHaveValue("05:00");
  await plannerField(page, "line").selectOption("line");
  await plannerTrip(page, "night-a").click();
  await expect(role(page, "draft")).toBeVisible();
  await expect(role(page, "catalog")).toBeHidden();
  await expect(plannerField(page, "line")).toBeHidden();
  await expect(plannerAction(page, "choose-stay")).toBeHidden();
  await expect(role(page, "review")).toBeHidden();
  await expect(start).toBeDisabled();
  await plannerAction(page, "cancel-step").click();
  await expect(plannerTrip(page, "night-a")).toBeFocused();
  await expect(plannerField(page, "line")).toHaveValue("line");
  await expect(activity(page, 0)).toHaveCount(0);
  await plannerTrip(page, "night-a").click();
  await plannerAction(page, "confirm-step").click();
  await plannerAction(page, "choose-stay").click();
  await expect(role(page, "activity-choices")).toBeHidden();
  await expect(activity(page, 0).locator('[data-action="remove-step"]')).toBeHidden();
  const arrival = plannerField(page, "transfer-arrival");
  const departure = plannerField(page, "stay-departure");
  const conflict = role(page, "draft").locator('[data-role="step-conflict"]');
  await expect(arrival).toHaveValue("24:04");
  await expect(conflict).toHaveCount(0);
  await expect(plannerAction(page, "confirm-step")).toBeDisabled();
  await departure.fill("2403");
  await expect(conflict).toContainText("before arrival");
  await departure.fill("");
  await expect(conflict).toHaveCount(0);
  await plannerField(page, "stay-depot").selectOption("second");
  await expect(arrival).toHaveValue("24:03");
  await plannerField(page, "stay-depot").selectOption("nearby");
  await expect(arrival).toHaveValue("23:58");
  await arrival.fill("2405");
  await plannerField(page, "transfer-departure").fill("2358");
  await expect(arrival).toHaveValue("24:05");
  await departure.fill("2460");
  await expect(conflict).toContainText("HH:MM");
  await departure.fill("2510");
  await expect(departure).toHaveValue("25:10");
  await plannerAction(page, "confirm-step").click();
  await expect(activity(page, 1)).toContainText("00:05 (+1)–01:10 (+1)");
});

test("shows minute clocks and preserves untouched seconds on reopening a saved programme", async ({ page, composer }) => {
  const programme = { ...storedProgramme.programme, start_time: "23:45:12", steps: [
    { ...savedSteps[0], transfer_departure: "23:45:12", transfer_arrival: "23:50:18" },
    savedSteps[1], { ...savedSteps[2], arrival: "24:50:43" },
  ] };
  const state = await composer({ application: true, entry: "shifts", respond: request =>
    request.path.endsWith("/programmes/sequential") && request.method === "GET"
      ? { json: { ...storedProgramme, programme } } : programmeFixture(request) });
  await rowAction(page.locator('[data-id="sequential"]'), "edit").click();
  await expect(plannerField(page, "start-time")).toHaveValue("23:45");
  await activity(page, 0).locator('[data-action="edit-step"]').click();
  await expect(plannerField(page, "transfer-departure")).toHaveValue("23:45");
  await expect(plannerField(page, "transfer-arrival")).toHaveValue("23:50");
  await plannerAction(page, "confirm-step").click();
  await activity(page, 2).locator('[data-action="edit-step"]').click();
  await expect(plannerField(page, "transfer-arrival")).toHaveValue("24:50");
  await plannerAction(page, "confirm-step").click();
  await plannerAction(page, "save").click();
  await expect(page.locator("section.shifts")).toBeVisible();
  expect(state.writes[0].body.programme).toEqual(programme);
});

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

  const sisterPlatform = role(page, "catalog").locator('[data-trip-id="night-b"]');
  await expect(sisterPlatform.locator("td.actions button")).toHaveText(["Add"]);
  await sisterPlatform.locator('[data-action="add-direct-trip"]').click();
  await expect(role(page, "draft")).toBeHidden();
  await expect(activity(page, 1).locator('[data-action="edit-step"]')).toHaveCount(0);
  expect(state.reads.some((href) => href.includes("from_stop_id=b1&to_stop_id=b2"))).toBe(false);

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
  await expect(includeOtherTermini).toHaveAccessibleName("Include trips that require driving empty");
  await expect(role(page, "catalog")).toContainText("include trips that require driving empty");
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
    if (request.path.endsWith("/shift-planner/catalog")) {
      return { json: plannerCatalog.map(trip => trip.id === "night-b"
        ? { ...trip, id: "night-b-representative", equivalent_trip_ids: ["night-b"] } : trip) };
    }
    if (request.path.endsWith("/shift-planner/route") && request.url.searchParams.get("from_stop_id") === "b1"
      && request.url.searchParams.get("to_stop_id") === "depot-stop") await depotEstimate;
    return programmeFixture(request);
  } });
  const row = page.locator('[data-id="sequential"]');
  await rowAction(row, "edit").click();
  await expect(activity(page, 1)).toContainText("00:15 (+1)–00:35 (+1)");
  await expect(activity(page, 2)).toHaveAttribute("data-kind", "return");
  await expect(plannerField(page, "weekday")).toHaveValue("monday");
  await expect(activity(page, 1).locator('[data-action="edit-step"]')).toHaveCount(0);
  await activity(page, 1).locator('[data-action="insert-before"]').click();
  await expect(plannerField(page, "include-other-termini")).not.toBeChecked();
  await expect(plannerTrip(page, "night-b")).toHaveCount(0);
  await expect(plannerTrip(page, "night-b-representative")).toHaveCount(0);
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
  await expect(arrival).toHaveValue("");
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


test("adds a same-stop service at GTFS times and preserves an older platform transfer on reopening", async ({ page, composer }) => {
  const firstTrip = plannerCatalog.find(({ id }) => id === "night-a");
  const legacyTrip = { ...plannerCatalog.find(({ id }) => id === "night-c"), arrival_time: "24:25:21" };
  const directTrip = {
    id: "night-loop", route_id: "line", line: "1",
    from_stop_id: "last", to_stop_id: "last", from_name: "Last terminus", to_name: "Last terminus",
    first_arrival: "24:25:29", departure_time: "24:26:37", arrival_time: "24:30:42",
  };
  const legacyStep = {
    kind: "service", trip_id: legacyTrip.id, transfer_departure: "24:15:12", transfer_arrival: "24:16:35", force_transfer: true,
  };
  const directStep = {
    kind: "service", trip_id: directTrip.id, transfer_departure: "24:25:21", transfer_arrival: "24:25:29",
  };
  const returnStep = { kind: "return", transfer_departure: "24:30:42", arrival: "24:50:00" };
  const trips = [firstTrip, legacyTrip, directTrip];
  let existing = {
    ...storedProgramme,
    trips,
    programme: { ...storedProgramme.programme, steps: [savedSteps[0], legacyStep, returnStep] },
  };
  const state = await composer({ application: true, entry: "shifts", respond: (request) => {
    if (request.path.endsWith("/shift-planner/catalog")) return { json: trips };
    if (request.path.endsWith("/shift-planner/programmes/sequential")) {
      if (request.method === "PUT") existing = { ...existing, programme: request.request.postDataJSON().programme };
      return { json: existing };
    }
    return programmeFixture(request);
  } });
  const editProgramme = rowAction(page.locator('[data-id="sequential"]'), "edit");
  await editProgramme.click();
  await expect(activity(page, 1)).toContainText("Transfer 00:15 (+1)–00:16 (+1)");
  await activity(page, 1).locator('[data-action="edit-step"]').click();
  await expect(plannerField(page, "transfer-departure")).toHaveValue("24:15");
  await expect(plannerField(page, "transfer-arrival")).toHaveValue("24:16");
  await expect(plannerField(page, "force-transfer")).toHaveCount(0);
  await expect(role(page, "draft-notice")).toContainText("Available transfer time 1 min");
  await plannerAction(page, "confirm-step").click();

  await activity(page, 2).locator('[data-action="insert-before"]').click();
  await plannerField(page, "line").selectOption("line");
  const sameStop = role(page, "catalog").locator('[data-trip-id="night-loop"]');
  await expect(sameStop.locator("td.actions button")).toHaveText(["Add"]);
  await sameStop.locator('[data-action="add-direct-trip"]').click();
  await expect(role(page, "draft")).toBeHidden();
  await expect(activity(page, 2).locator('[data-action="edit-step"]')).toHaveCount(0);
  await expect(activity(page, 2).locator('[data-action="insert-before"]')).toBeVisible();
  await expect(activity(page, 2).locator('[data-action="remove-step"]')).toBeVisible();
  expect(state.reads.some((href) => href.includes("from_stop_id=last&to_stop_id=last"))).toBe(false);
  await plannerAction(page, "save").click();
  await expect(page.locator("section.shifts")).toBeVisible();
  const expectedSteps = [savedSteps[0], legacyStep, directStep, returnStep];
  expect(state.writes[0].body.programme.steps).toEqual(expectedSteps);

  await editProgramme.click();
  await expect(activity(page, 1)).toContainText("Transfer 00:15 (+1)–00:16 (+1)");
  await expect(activity(page, 2)).toContainText("00:26 (+1)–00:30 (+1)");
  await expect(activity(page, 2).locator('[data-action="edit-step"]')).toHaveCount(0);
  await plannerAction(page, "save").click();
  await expect(page.locator("section.shifts")).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].body.programme.steps).toEqual(expectedSteps);
});

test("opens an elevation profile without adding a trip and reuses it in the programme", async ({ page, composer }) => {
  const profileReads = [];
  const stopReads = [];
  const stops = [
    { stop_name: "Town", departure_time: "23:55:00", stop_lat: 46, stop_lon: 8.95 },
    { stop_name: "Market", arrival_time: "24:02:30", departure_time: "24:04:00", stop_lat: 46.005, stop_lon: 8.955 },
    { stop_name: "Station", arrival_time: "24:15:00", stop_lat: 46.01, stop_lon: 8.96 },
  ];
  const points = [
    { latitude: 46, longitude: 8.95, altitude_m: 285, cumulative_distance_m: 0 },
    { latitude: 46.01, longitude: 8.96, altitude_m: 340, cumulative_distance_m: 1040 },
  ];
  await page.route("**/runtime-config.json", route => route.fulfill({ json: { CARTO_API_KEY: "test-key" } }));
  let requestedVoyager = false;
  await page.route("https://basemaps.cartocdn.com/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/rastertiles/voyager/") && url.searchParams.get("key") === "test-key") requestedVoyager = true;
    return route.fulfill({ status: 204 });
  });
  const state = await composer({ application: true, entry: "shifts", respond: (request) => {
    if (request.path.includes("/gtfs-stops/by-trip/")) {
      stopReads.push(request.path.split("/").at(-1));
      return { json: stops };
    }
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
  await expect.poll(() => requestedVoyager).toBe(true);
  await expect(preview.locator(".trip-preview-stop-marker.is-origin")).toHaveAttribute("aria-label", "Town");
  await expect(preview.locator(".trip-preview-stop-marker.is-destination")).toHaveAttribute("aria-label", "Station");
  await expect(preview.locator("svg.elevation-chart-inline")).toContainText("340");
  const timetable = preview.locator('[data-role="stops"] table');
  await expect(timetable.getByRole("columnheader")).toHaveText(["Stop", "Arrival", "Departure"]);
  const calls = timetable.locator("tbody tr");
  await expect(calls).toHaveCount(3);
  await expect(calls.nth(0).locator("td").last()).toHaveText("23:55");
  await expect(calls.nth(0)).toContainText("—");
  await expect(calls.nth(1)).toContainText("24:02");
  await expect(calls.nth(1)).toContainText("24:04");
  await expect(calls.nth(2)).toContainText("24:15");
  await expect(calls.nth(2)).toContainText("—");
  await calls.nth(1).getByRole("button", { name: /Market/ }).click();
  await expect(preview.locator(".trip-preview-stop-popup")).toContainText("Market");
  await expect(preview.locator(".trip-preview-stop-popup")).toContainText("24:04");
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
  await expect(activity(page, 0).locator('[data-role="stops"]')).toContainText("Market");
  expect(profileReads).toEqual(["night-a"]);
  expect(stopReads).toEqual(["night-a"]);
  expect(state.writes).toEqual([]);
});

test("keeps the selected trip visible only while scrolling through its own stops", async ({ page, composer }) => {
  const first = plannerCatalog.find(trip => trip.id === "night-a");
  const following = Array.from({ length: 20 }, (_, i) => ({
    ...first, id: `later-${i}`, departure_time: "24:20:00", arrival_time: "24:40:00",
  }));
  const stops = Array.from({ length: 30 }, (_, i) => ({
    stop_name: `Stop ${i + 1}`, arrival_time: "24:00:00", departure_time: "24:01:00",
  }));
  await composer({ application: true, entry: "shifts", respond: request => {
    if (request.path.endsWith("/shift-planner/catalog")) return { json: [first, ...following] };
    if (request.path.includes("/gtfs-stops/by-trip/")) return { json: stops };
    if (request.path.includes("/elevation-profile/by-trip/")) return { json: { records: [] } };
    return plannerApi(request);
  } });
  await plannerAction(page, "add-shift").click();
  await startPlanner(page);
  const catalog = page.locator(".planner-catalog-scroll");
  const row = catalog.locator('tr[data-trip-id="night-a"]');
  await row.locator('[data-action="preview-trip"]').press("Enter");
  const lastStop = catalog.getByRole("rowheader", { name: "Stop 30", exact: true });
  await expect(lastStop).toBeAttached();
  await catalog.evaluate(node => { node.scrollTop = node.clientHeight; });
  const heading = catalog.locator(".planner-catalog-table > thead");
  const topGap = async () => {
    const [header, trip] = await Promise.all([heading.boundingBox(), row.boundingBox()]);
    return Math.abs(header.y + header.height - trip.y);
  };
  await expect.poll(topGap).toBeLessThan(2);
  await lastStop.scrollIntoViewIfNeeded();
  await expect(lastStop).toBeInViewport();
  await expect.poll(topGap).toBeLessThan(2);
  await catalog.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect.poll(async () => {
    const [header, trip] = await Promise.all([heading.boundingBox(), row.boundingBox()]);
    return trip.y + trip.height <= header.y + header.height + 1;
  }).toBe(true);
});

test("keeps a failed profile retryable and closes it when the candidate disappears", async ({ page, composer }) => {
  let attempts = 0;
  await page.route("**/runtime-config.json", route => route.fulfill({ json: { CARTO_API_KEY: "" } }));
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
  await expect(role(page, "stops").getByRole("table")).toBeVisible();
  await toggle.click();
  await toggle.click();
  await expect(role(page, "elevation").getByRole("img")).toContainText("319");
  await expect(role(page, "stops").getByRole("table")).toBeVisible();
  await plannerField(page, "line").selectOption("");
  await expect(page.locator("#planner-trip-profile")).toHaveCount(0);
  expect(attempts).toBe(2);
});

test("keeps the route visible when stop times fail and retries the timetable on reopening", async ({ page, composer }) => {
  let stopRequests = 0;
  let elevationRequests = 0;
  await page.route("**/runtime-config.json", route => route.fulfill({ json: { CARTO_API_KEY: "" } }));
  await composer({ application: true, entry: "shifts", respond: request => {
    if (request.path.endsWith("/gtfs-stops/by-trip/night-a")) {
      stopRequests += 1;
      if (stopRequests === 1) return { status: 503, json: { detail: "Unavailable" } };
      return { json: [{ stop_name: "Town", departure_time: "23:55:00" }] };
    }
    if (request.path.endsWith("/elevation-profile/by-trip/night-a")) {
      elevationRequests += 1;
      return { json: { records: [
        { latitude: 46, longitude: 9, altitude_m: 310, cumulative_distance_m: 0 },
        { latitude: 46.02, longitude: 9.01, altitude_m: 319, cumulative_distance_m: 1500 },
      ] } };
    }
    return plannerApi(request);
  } });
  await plannerAction(page, "add-shift").click();
  await startPlanner(page);
  const trigger = role(page, "catalog").locator('[data-trip-id="night-a"] [data-action="preview-trip"]');
  await trigger.click();
  await expect(role(page, "elevation").getByRole("img")).toBeVisible();
  await expect(role(page, "map").locator(".leaflet-overlay-pane path").first()).toBeVisible();
  await expect(role(page, "map")).toContainText("Basemap unavailable");
  await expect(role(page, "stops")).toContainText(/failed|unavailable|could not/i);
  await trigger.click();
  await trigger.click();
  await expect(role(page, "stops").getByRole("table")).toContainText("Town");
  expect([elevationRequests, stopRequests]).toEqual([1, 2]);
});

test("distinguishes only visible trips with matching termini and displayed times", async ({ page, composer }) => {
  const direct = {
    ...plannerCatalog.find(({ id }) => id === "night-b"),
    trip_short_name: "1001", stop_count: 10, equivalent_trip_ids: ["same-service"],
  };
  const transfer = {
    ...direct, id: "different-service", from_stop_id: "other", from_parent: null,
    departure_time: "24:15:10", arrival_time: "24:35:10", equivalent_trip_ids: [],
  };
  const unnamed = {
    ...transfer, id: "unnamed-service", departure_time: "24:15:20", trip_short_name: null, stop_count: 1,
  };
  const numbered = { ...transfer, id: "numbered-service", departure_time: "24:15:30", trip_short_name: "1002", stop_count: 8 };
  const differentTime = { ...transfer, id: "different-time", arrival_time: "24:36:00" };
  const trips = [...plannerCatalog.filter(({ id }) => id !== direct.id), direct, transfer, unnamed, numbered, differentTime];
  await composer({ application: true, entry: "shifts", respond: (request) => {
    if (request.path.endsWith("/shift-planner/catalog")) return { json: trips };
    return plannerApi(request);
  } });

  const variant = (id) => role(page, "catalog").locator(`[data-trip-id="${id}"] [data-role="candidate-variant"]`);
  await plannerAction(page, "add-shift").click();
  await startPlanner(page);
  await plannerTrip(page, "night-a").click();
  await plannerAction(page, "confirm-step").click();

  await expect(plannerTrip(page, direct.id)).toBeVisible();
  await expect(plannerTrip(page, transfer.id)).toHaveCount(0);
  await expect(variant(direct.id)).toHaveCount(0);

  const includeOtherTermini = plannerField(page, "include-other-termini");
  await includeOtherTermini.check();
  await expect(variant(direct.id)).toHaveText("Trip 1001 · 10 stops · Variant 1");
  await expect(variant(transfer.id)).toHaveText("Trip 1001 · 10 stops · Variant 2");
  await expect(variant(unnamed.id)).toHaveText("Variant 3 · 1 stop");
  await expect(variant(numbered.id)).toHaveText("Trip 1002 · 8 stops");
  await expect(plannerTrip(page, differentTime.id)).toBeVisible();
  await expect(variant(differentTime.id)).toHaveCount(0);

  for (const [language, tripLabel, fallback] of [
    ["it", "Corsa 1001 · 10 fermate · Variante 1", "Variante 3 · 1 fermata"],
    ["fr", "Course 1001 · 10 arrêts · Variante 1", "Variante 3 · 1 arrêt"],
    ["de", "Fahrt 1001 · 10 Haltestellen · Variante 1", "Variante 3 · 1 Haltestelle"],
  ]) {
    await page.locator(".language-select").selectOption(language);
    await expect(variant(direct.id)).toHaveText(tripLabel);
    await expect(variant(unnamed.id)).toHaveText(fallback);
  }

  await includeOtherTermini.uncheck();
  await expect(variant(direct.id)).toHaveCount(0);
});
