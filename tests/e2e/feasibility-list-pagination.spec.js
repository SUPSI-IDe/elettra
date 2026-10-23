import { expect, test } from "@playwright/test";


const TOTAL_RUNS = 45;

const buildEnvelope = (url) => {
  const skip = Number(url.searchParams.get("skip") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const count = Math.max(0, Math.min(limit, TOTAL_RUNS - skip));
  const items = Array.from({ length: count }, (_, index) => {
    const number = skip + index + 1;
    return {
      id: `run-${number}`,
      user_id: "user-1",
      name: `Run ${number}`,
      status: "completed",
      mode: "battery_only",
      created_at: "2026-10-01T00:00:00Z",
      electrification_feasible: true,
      input_params: { shift_ids: [] },
      shift_ids: [],
    };
  });

  return {
    items,
    total: TOTAL_RUNS,
    skip,
    limit,
    count,
    has_next: skip + count < TOTAL_RUNS,
    has_previous: skip > 0,
  };
};

const fulfillJson = (route, body) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(body),
  });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "pagination-test-token");
    localStorage.setItem("cache.currentUser.id", "user-1");
  });

  await page.route("**/auth/me", (route) =>
    fulfillJson(route, { id: "user-1", email: "pagination@example.test" })
  );
  await page.route("**/api/v1/user/bus-models/**", (route) => {
    const url = new URL(route.request().url());
    const skip = Number(url.searchParams.get("skip") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 100);
    return fulfillJson(route, {
      items: [],
      total: 0,
      skip,
      limit,
      count: 0,
      has_next: false,
      has_previous: false,
    });
  });
  await page.route(
    "**/api/v1/simulation/optimization-runs/**",
    (route) => fulfillJson(route, buildEnvelope(new URL(route.request().url())))
  );

  await page.goto("./#simulation-runs");
  await expect(
    page.locator('[data-role="simulation-runs-pagination"]')
  ).toBeVisible();
});

test("feasibility pagination moves forward, backward, and reaches the final page", async ({
  page,
}) => {
  const pagination = page.locator('[data-role="simulation-runs-pagination"]');
  const range = pagination.locator('[data-role="pagination-range"]');
  const previous = pagination.locator('[data-role="pagination-prev"]');
  const next = pagination.locator('[data-role="pagination-next"]');

  await expect(range).toHaveText("Showing 1–20 of 45");
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();

  await next.click();
  await expect(range).toHaveText("Showing 21–40 of 45");
  await expect(previous).toBeEnabled();
  await expect(next).toBeEnabled();

  await next.click();
  await expect(range).toHaveText("Showing 41–45 of 45");
  await expect(previous).toBeEnabled();
  await expect(next).toBeDisabled();

  await previous.click();
  await expect(range).toHaveText("Showing 21–40 of 45");
});

test("changing rows per page reloads from the first result", async ({ page }) => {
  const pagination = page.locator('[data-role="simulation-runs-pagination"]');
  const range = pagination.locator('[data-role="pagination-range"]');
  const pageSize = pagination.locator('[data-role="pagination-page-size"]');
  const previous = pagination.locator('[data-role="pagination-prev"]');
  const next = pagination.locator('[data-role="pagination-next"]');

  await next.click();
  await expect(range).toHaveText("Showing 21–40 of 45");

  await pageSize.selectOption("50");
  await expect(range).toHaveText("Showing 1–45 of 45");
  await expect(previous).toBeDisabled();
  await expect(next).toBeDisabled();

  await pageSize.selectOption("100");
  await expect(range).toHaveText("Showing 1–45 of 45");
  await expect(pageSize).toHaveValue("100");
});
