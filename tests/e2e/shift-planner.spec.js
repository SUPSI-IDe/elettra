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
  await expect(role(page, "catalog").locator("[data-trip-id]").first()).toHaveAttribute("data-trip-id", "night-other");
  await plannerField(page, "order").selectOption("direct");
  await expect(role(page, "catalog").locator("[data-trip-id]").first()).toHaveAttribute("data-trip-id", "night-b");

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

test("reopens the saved sequence, marks an insertion conflict and undoes the insertion", async ({ page, composer }) => {
  const state = await composer({ application: true, entry: "shifts", respond: programmeFixture });
  const row = page.locator('[data-id="sequential"]');
  await rowAction(row, "edit").click();
  await expect(activity(page, 1)).toContainText("00:15 (+1)–00:35 (+1)");
  await expect(activity(page, 2)).toHaveAttribute("data-kind", "return");
  await expect(plannerField(page, "weekday")).toHaveValue("monday");
  await activity(page, 1).locator('[data-action="insert-before"]').click();
  await plannerAction(page, "choose-stay").click();
  await plannerField(page, "transfer-arrival").fill("24:20");
  await plannerField(page, "stay-departure").fill("24:25");
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
