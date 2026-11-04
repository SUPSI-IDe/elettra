import { expect, test } from "@playwright/test";

test("the feasibility form loads only visible distances until distance sorting requires all rows", async ({ page }) => {
  const shiftCount = 80;
  const shifts = Array.from({ length: shiftCount }, (_, index) => ({
    id: `shift-${String(index).padStart(3, "0")}`,
    name: `Shift ${String(index + 1).padStart(3, "0")}`,
    bus_id: "bus",
    ...(index === 0
      ? { daily_distance_km: 1, yearly_distance_km: 365 }
      : {}),
  }));
  const expectedDistanceRequests = shiftCount - 1;
  const model = {
    id: "model",
    user_id: "user",
    name: "Test bus",
    specs: { min_battery_packs: 10, max_battery_packs: 16 },
  };
  const distanceRequests = [];
  let activeDistanceRequests = 0;
  let maxActiveDistanceRequests = 0;
  let shiftDetailRequests = 0;

  await page.addInitScript(() => {
    localStorage.setItem("access_token", "test");
    localStorage.setItem("elettra_lang", "en");
  });
  await page.route("**/auth/me", (route) =>
    route.fulfill({ json: { id: "user", email: "local@example.invalid" } })
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (path.endsWith("/version")) data = { version: "test" };
    else if (path.endsWith("/bus-models/")) data = [model];
    else if (path.endsWith("/buses/")) {
      data = [{ id: "bus", user_id: "user", bus_model_id: "model" }];
    } else if (path.endsWith("/shifts/")) data = shifts;
    else if (path.endsWith("/yearly-distance")) {
      const shiftId = decodeURIComponent(path.split("/").at(-2));
      const index = shifts.findIndex((shift) => shift.id === shiftId);
      distanceRequests.push(shiftId);
      activeDistanceRequests += 1;
      maxActiveDistanceRequests = Math.max(
        maxActiveDistanceRequests,
        activeDistanceRequests
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
      activeDistanceRequests -= 1;
      data = {
        daily_distance_km: index + 1,
        yearly_distance_km: (index + 1) * 365,
      };
    } else if (path.includes("/shifts/")) {
      shiftDetailRequests += 1;
      data = {};
    }
    await route.fulfill({ json: data });
  });

  await page.goto("./#add-simulation");
  await expect(page.locator('.shift-table tbody tr[data-id]')).toHaveCount(shiftCount);
  await expect.poll(() => distanceRequests.length).toBeGreaterThan(0);
  await page.waitForTimeout(250);

  const initialDistanceRequestCount = distanceRequests.length;
  expect(initialDistanceRequestCount).toBeLessThan(expectedDistanceRequests);
  expect(initialDistanceRequestCount).toBeLessThanOrEqual(20);
  expect(maxActiveDistanceRequests).toBeLessThanOrEqual(4);
  expect(shiftDetailRequests).toBe(0);
  expect(new Set(distanceRequests).size).toBe(distanceRequests.length);

  const wrapper = page.locator(".shift-table-wrapper");
  await wrapper.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => distanceRequests.length).toBeGreaterThan(
    initialDistanceRequestCount
  );
  expect(distanceRequests.length).toBeLessThan(expectedDistanceRequests);

  await page.getByRole("button", { name: "Distance (km)", exact: true }).click();
  await expect.poll(() => distanceRequests.length, { timeout: 15_000 }).toBe(
    expectedDistanceRequests
  );
  await expect(page.locator('tr[data-id="shift-000"] [data-role="shift-distance"]')).toHaveText("1");

  expect(maxActiveDistanceRequests).toBeLessThanOrEqual(4);
  expect(new Set(distanceRequests).size).toBe(expectedDistanceRequests);
  expect(distanceRequests).not.toContain("shift-000");
  expect(shiftDetailRequests).toBe(0);
});
