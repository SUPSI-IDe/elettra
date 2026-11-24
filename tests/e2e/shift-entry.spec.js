import { test, expect, deferred } from "../../test-support/shift-composer-fixture.js";
import { plannerAction, plannerApi, plannerField, plannerTrip, startPlanner } from "../../test-support/shift-planner-fixture.js";

test("Add vehicle block opens from the list, survives cancel and opens again", async ({ page, composer }) => {
  const state = await composer({ application: true, entry: "shifts", respond: plannerApi });
  for (let attempt = 0; attempt < 3; attempt++) {
    await plannerAction(page, "add-shift").click();
    await expect(plannerField(page, "weekday")).toHaveValue("");
    await startPlanner(page);
    await plannerTrip(page, "night-a").click();
    await plannerAction(page, "confirm-step").click();
    await expect(page.locator("[data-step-index]")).toHaveCount(1);
    await plannerAction(page, "cancel").click();
    await expect(page.locator("section.shifts")).toBeVisible();
  }
  expect(state.writes).toEqual([]);
});

test("Add remains usable while the shift list is loading", async ({ page, composer }) => {
  const gate = deferred();
  const state = await composer({ application: true, entry: "shifts", respond: async (request) => {
    if (request.method === "GET" && request.path.endsWith("/shifts/")) {
      await gate.promise;
      return { json: [] };
    }
    return plannerApi(request);
  } });
  try {
    await plannerAction(page, "add-shift").click();
    await expect(plannerField(page, "weekday")).toBeEnabled();
  } finally {
    gate.resolve();
  }
  await startPlanner(page);
  await expect(plannerTrip(page, "night-a")).toBeVisible();
  expect(state.writes).toEqual([]);
});

test("the translated list opens Add after changing language and a double click", async ({ page, composer }) => {
  const state = await composer({ application: true, entry: "shifts", respond: plannerApi });
  await page.locator(".language-select").selectOption("it");
  const add = plannerAction(page, "add-shift");
  await expect(add).toHaveText("Aggiungi");
  await add.dblclick();
  await expect(page.locator('label[for="planner-weekday"] > span')).toHaveText("Giorno di servizio");
  await startPlanner(page);
  await expect(plannerTrip(page, "night-a")).toBeVisible();
  expect(state.writes).toEqual([]);
});
