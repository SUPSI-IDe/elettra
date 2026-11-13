import { expect, test } from "@playwright/test";

const pageEnvelope = (items) => ({
  items,
  total: items.length,
  skip: 0,
  limit: 20,
  count: items.length,
  has_next: false,
  has_previous: false,
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "analysis-renaming-test");
    localStorage.setItem("cache.currentUser.id", "user-1");
    localStorage.setItem("elettra_lang", "en");
  });
  await page.route("**/auth/me", (route) => route.fulfill({
    json: { id: "user-1", email: "rename@example.invalid" },
  }));
});

test("a feasibility evaluation can be renamed from its list row", async ({ page }) => {
  const run = {
    id: "run-1",
    user_id: "user-1",
    name: "Original feasibility",
    mode: "battery_only",
    status: "completed",
    created_at: "2026-11-01T10:00:00Z",
    electrification_feasible: true,
    input_params: { shift_ids: [] },
    shift_ids: [],
  };
  const patchBodies = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith("/version")) {
      await route.fulfill({ json: { version: "rename-test" } });
    } else if (path.includes("/user/bus-models/")) {
      await route.fulfill({ json: pageEnvelope([]) });
    } else if (path.endsWith("/simulation/optimization-runs/")) {
      await route.fulfill({ json: pageEnvelope([run]) });
    } else if (path.endsWith("/simulation/optimization-runs/run-1") && request.method() === "PATCH") {
      const body = request.postDataJSON();
      patchBodies.push(body);
      run.name = body.name;
      await route.fulfill({ json: run });
    } else if (path.endsWith("/simulation/optimization-runs/run-1")) {
      await route.fulfill({ json: run });
    } else {
      await route.fulfill({ json: [] });
    }
  });

  await page.goto("./#simulation-runs");
  const row = page.locator('tr[data-id="run-1"]');
  await row.getByRole("button", { name: "Rename: Original feasibility" }).click();

  const dialog = page.getByRole("dialog", { name: "Rename" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Name")).toHaveValue("Original feasibility");
  await dialog.getByLabel("Name").fill("Renamed feasibility");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  await expect(row.locator("td.name")).toHaveText("Renamed feasibility");
  await expect(page.locator('[data-role="flash"]')).toHaveText("Name updated.");
  expect(patchBodies).toEqual([{ name: "Renamed feasibility" }]);
});

test("a yearly analysis can be renamed from its list row", async ({ page }) => {
  const analysis = {
    id: "annual-1",
    optimization_run_id: "run-1",
    name: "Original yearly analysis",
    created_at: "2026-11-01T11:00:00Z",
    features: {
      status: "completed",
      config: { mode: "joint" },
      meta: { shiftNames: ["Morning service"] },
    },
  };
  const patchBodies = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith("/version")) {
      await route.fulfill({ json: { version: "rename-test" } });
    } else if (path.endsWith("/yearly-analysis/")) {
      await route.fulfill({ json: pageEnvelope([analysis]) });
    } else if (path.endsWith("/yearly-analysis/annual-1") && request.method() === "PATCH") {
      const body = request.postDataJSON();
      patchBodies.push(body);
      analysis.name = body.name;
      await route.fulfill({ json: analysis });
    } else if (path.endsWith("/yearly-analysis/annual-1")) {
      await route.fulfill({ json: analysis });
    } else {
      await route.fulfill({ json: [] });
    }
  });

  await page.goto("./#yearly-analysis-runs");
  const row = page.locator('tr[data-id="annual-1"]');
  await row.getByRole("button", { name: "Rename: Original yearly analysis" }).click();

  const dialog = page.getByRole("dialog", { name: "Rename" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Name")).toHaveValue("Original yearly analysis");
  await dialog.getByLabel("Name").fill("Renamed yearly analysis");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  await expect(row.locator("td.name")).toHaveText("Renamed yearly analysis");
  await expect(page.locator('[data-role="flash"]')).toHaveText("Name updated.");
  expect(patchBodies).toEqual([{ name: "Renamed yearly analysis" }]);
});
