import { expect, test } from "@playwright/test";

test("the feasibility form batches stop candidates and reuses them across mode changes", async ({ page }) => {
  const stopId = "11111111-1111-4111-8111-111111111111";
  const opportunityStopId = "22222222-2222-4222-8222-222222222222";
  const model = {
    id: "model",
    user_id: "user",
    name: "Test bus",
    specs: {
      min_battery_packs: 10,
      max_battery_packs: 16,
      battery_pack_size_kwh: 50,
      battery_pack_cost_chf: 6000,
    },
  };
  const shifts = ["shift-a", "shift-b"].map((id) => ({
    id,
    name: id,
    bus_id: "bus",
    distance_km: 10,
    yearly_distance_km: 2000,
  }));
  const candidateRequests = [];
  let legacyTripStopRequests = 0;

  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test");
    localStorage.setItem("elettra_lang", "en");
  });
  await page.route("**/auth/me", (route) =>
    route.fulfill({ json: { id: "user", email: "local@example.invalid" } })
  );
  await page.route("**/api/v1/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data = [];
    if (path.endsWith("/version")) data = { version: "test" };
    else if (path.endsWith("/bus-models/")) data = [model];
    else if (path.endsWith("/bus-models/model")) data = model;
    else if (path.endsWith("/buses/")) {
      data = [{ id: "bus", user_id: "user", bus_model_id: "model" }];
    } else if (path.endsWith("/shifts/")) data = shifts;
    else if (path.endsWith("/simulation/charging-stops/candidates")) {
      const body = request.postDataJSON();
      candidateRequests.push(body);
      data = [
        {
          stop_id: stopId,
          stop_name: "Shared depot",
          is_depot: true,
          is_custom: true,
          depot_bus_count: body.shift_ids.length,
        },
        {
          stop_id: opportunityStopId,
          stop_name: "Opportunity stop",
          is_depot: false,
          is_custom: false,
          depot_bus_count: 0,
        },
      ];
    } else if (path.includes("/gtfs-stops/by-trip/")) {
      legacyTripStopRequests += 1;
      data = [];
    } else if (path.includes("/shifts/")) {
      data = shifts.find((shift) => path.includes(`/shifts/${shift.id}`)) ?? {};
    }
    return route.fulfill({ json: data });
  });

  await page.goto("./#add-simulation");
  const boxes = page.getByRole("checkbox", {
    name: "Select vehicle block",
    exact: true,
  });
  await expect(boxes).toHaveCount(2);

  await boxes.nth(0).check();
  expect(candidateRequests).toHaveLength(0);
  await page.locator("#var-optimization-mode").selectOption("battery_only");
  await expect(page.locator(`tr[data-stop-id="${stopId}"]`)).toBeVisible();
  await expect(
    page.locator(`tr[data-stop-id="${opportunityStopId}"] [data-field="max_total_power_kw"]`)
  ).toHaveValue("900");
  await expect.poll(() => candidateRequests.length).toBe(1);
  expect(candidateRequests[0]).toEqual({ shift_ids: ["shift-a"] });
  expect(legacyTripStopRequests).toBe(0);

  await page.locator("#var-optimization-mode").selectOption("joint");
  await expect(page.locator(`tr[data-stop-id="${stopId}"]`)).toBeVisible();
  expect(candidateRequests).toHaveLength(1);

  await boxes.nth(1).check();
  await expect.poll(() => candidateRequests.length).toBe(2);
  expect(candidateRequests[1]).toEqual({ shift_ids: ["shift-a", "shift-b"] });
  expect(legacyTripStopRequests).toBe(0);

  await boxes.nth(1).uncheck();
  await expect(page.locator(`tr[data-stop-id="${stopId}"]`)).toBeVisible();
  await boxes.nth(1).check();
  await expect(page.locator(`tr[data-stop-id="${stopId}"]`)).toBeVisible();
  expect(candidateRequests).toHaveLength(2);
  expect(legacyTripStopRequests).toBe(0);
});

test("the feasibility form aborts an obsolete batch and ignores its result", async ({ page }) => {
  const firstStopId = "11111111-1111-4111-8111-111111111111";
  const currentStopId = "22222222-2222-4222-8222-222222222222";
  const model = {
    id: "model",
    user_id: "user",
    name: "Test bus",
    specs: { min_battery_packs: 10, max_battery_packs: 16, battery_pack_size_kwh: 50 },
  };
  const shifts = ["shift-a", "shift-b"].map((id) => ({
    id,
    name: id,
    bus_id: "bus",
    distance_km: 10,
    yearly_distance_km: 2000,
  }));
  const candidateRequests = [];
  let releaseFirstRequest;

  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test");
    localStorage.setItem("elettra_lang", "en");
    globalThis.__candidateAbortCount = 0;
    const nativeFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, options = {}) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes("/simulation/charging-stops/candidates")) {
        options.signal?.addEventListener(
          "abort",
          () => { globalThis.__candidateAbortCount += 1; },
          { once: true }
        );
      }
      return nativeFetch(input, options);
    };
  });
  await page.route("**/auth/me", (route) =>
    route.fulfill({ json: { id: "user", email: "local@example.invalid" } })
  );
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data = [];
    let isObsoleteCandidateRequest = false;
    if (path.endsWith("/version")) data = { version: "test" };
    else if (path.endsWith("/bus-models/")) data = [model];
    else if (path.endsWith("/bus-models/model")) data = model;
    else if (path.endsWith("/buses/")) {
      data = [{ id: "bus", user_id: "user", bus_model_id: "model" }];
    } else if (path.endsWith("/shifts/")) data = shifts;
    else if (path.endsWith("/simulation/charging-stops/candidates")) {
      const requestNumber = candidateRequests.push(request.postDataJSON());
      if (requestNumber === 1) {
        isObsoleteCandidateRequest = true;
        await new Promise((resolve) => { releaseFirstRequest = resolve; });
        data = [{ stop_id: firstStopId, stop_name: "Obsolete stop" }];
      } else {
        data = [{ stop_id: currentStopId, stop_name: "Current stop" }];
      }
    } else if (path.includes("/shifts/")) {
      data = shifts.find((shift) => path.includes(`/shifts/${shift.id}`)) ?? {};
    }
    try {
      await route.fulfill({ json: data });
    } catch (error) {
      if (!isObsoleteCandidateRequest) {
        throw error;
      }
    }
  });

  await page.goto("./#add-simulation");
  const boxes = page.getByRole("checkbox", {
    name: "Select vehicle block",
    exact: true,
  });
  await boxes.nth(0).check();
  await page.locator("#var-optimization-mode").selectOption("battery_only");
  await expect.poll(() => candidateRequests.length).toBe(1);

  await boxes.nth(1).check();
  await expect.poll(() => candidateRequests.length).toBe(2);
  await expect.poll(() => page.evaluate(() => globalThis.__candidateAbortCount)).toBe(1);
  await expect(page.locator(`tr[data-stop-id="${currentStopId}"]`)).toBeVisible();

  releaseFirstRequest();
  await expect(page.locator(`tr[data-stop-id="${firstStopId}"]`)).toHaveCount(0);
});
