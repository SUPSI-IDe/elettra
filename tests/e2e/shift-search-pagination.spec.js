import { expect, test } from "@playwright/test";


const shifts = [
  ...Array.from({ length: 25 }, (_, index) => ({
    id: `group-${index + 1}`,
    name: `Groupable shift ${String(index + 1).padStart(2, "0")}`,
  })),
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `ordinary-${index + 1}`,
    name: `Ordinary shift ${String(index + 1).padStart(2, "0")}`,
  })),
  { id: "needle-35", name: "Deep needle shift" },
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `tail-${index + 1}`,
    name: `Tail shift ${String(index + 1).padStart(2, "0")}`,
  })),
].map((shift) => ({
  ...shift,
  bus_id: null,
  trip_count: 1,
  start_time: "08:00",
  end_time: "09:00",
  daily_distance_km: 12,
}));

const envelopeFor = (url) => {
  const skip = Number(url.searchParams.get("skip") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const search = (url.searchParams.get("search") ?? "").toLowerCase();
  const filtered = search
    ? shifts.filter((shift) => shift.name.toLowerCase().includes(search))
    : shifts;
  const items = filtered.slice(skip, skip + limit);
  return {
    items,
    total: filtered.length,
    skip,
    limit,
    count: items.length,
    has_next: skip + items.length < filtered.length,
    has_previous: skip > 0,
  };
};

const fulfillJson = (route, body) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(body),
  });

const expectNeedleShift = async (page) => {
  const row = page.locator(
    'tbody[data-role="shifts-body"] tr[data-id="needle-35"]'
  );
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("data-name", "Deep needle shift");
};

test.beforeEach(async ({ page }) => {
  page.shiftListRequests = [];
  page.onShiftListRequest = null;
  page.slowShiftResponse = null;

  await page.addInitScript(() => {
    localStorage.setItem("access_token", "shift-pagination-token");
    localStorage.setItem("cache.currentUser.id", "user-1");
  });

  await page.route("**/auth/me", (route) =>
    fulfillJson(route, { id: "user-1", email: "shifts@example.test" })
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
  await page.route("**/api/v1/user/shifts/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/v1/user/shifts/") {
      return fulfillJson(route, {});
    }

    page.shiftListRequests.push(url.toString());
    page.onShiftListRequest?.(url);
    if (url.searchParams.get("search") === "slow" && page.slowShiftResponse) {
      await page.slowShiftResponse;
    }
    return fulfillJson(route, envelopeFor(url)).catch(() => {});
  });

  await page.goto("./#shifts");
  await expect(page.locator('[data-role="shifts-pagination"]')).toBeVisible();
});


test("search runs before pagination and clearing it restores the legacy list", async ({
  page,
}) => {
  const pagination = page.locator('[data-role="shifts-pagination"]');
  const range = pagination.locator('[data-role="pagination-range"]');
  const previous = pagination.locator('[data-role="pagination-prev"]');
  const next = pagination.locator('[data-role="pagination-next"]');
  const search = page.locator("#shifts-filter");

  await expect(range).toHaveText("Showing 1–20 of 45");
  await next.click();
  await expect(range).toHaveText("Showing 21–40 of 45");

  await search.fill("deep needle");
  await expectNeedleShift(page);
  await expect(range).toHaveText("Showing 1–1 of 1");
  await expect(previous).toBeDisabled();
  await expect(next).toBeDisabled();

  const filteredRequest = new URL(page.shiftListRequests.at(-1));
  expect(filteredRequest.searchParams.get("search")).toBe("deep needle");
  expect(filteredRequest.searchParams.get("skip")).toBe("0");

  await search.fill("");
  await expect(range).toHaveText("Showing 1–20 of 45");
  const restoredRequest = new URL(page.shiftListRequests.at(-1));
  expect(restoredRequest.searchParams.has("search")).toBe(false);
  expect(restoredRequest.searchParams.get("skip")).toBe("0");
});


test("filtered pagination preserves the search and page-size changes restart it", async ({
  page,
}) => {
  const pagination = page.locator('[data-role="shifts-pagination"]');
  const range = pagination.locator('[data-role="pagination-range"]');
  const next = pagination.locator('[data-role="pagination-next"]');
  const pageSize = pagination.locator('[data-role="pagination-page-size"]');

  await page.locator("#shifts-filter").fill("groupable");
  await expect(range).toHaveText("Showing 1–20 of 25");
  await next.click();
  await expect(range).toHaveText("Showing 21–25 of 25");

  const secondPageRequest = new URL(page.shiftListRequests.at(-1));
  expect(secondPageRequest.searchParams.get("search")).toBe("groupable");
  expect(secondPageRequest.searchParams.get("skip")).toBe("20");

  await pageSize.selectOption("50");
  await expect(range).toHaveText("Showing 1–25 of 25");
  const resizedRequest = new URL(page.shiftListRequests.at(-1));
  expect(resizedRequest.searchParams.get("search")).toBe("groupable");
  expect(resizedRequest.searchParams.get("skip")).toBe("0");
  expect(resizedRequest.searchParams.get("limit")).toBe("50");
});


test("search is debounced and a late response cannot replace the latest result", async ({
  page,
}) => {
  const search = page.locator("#shifts-filter");
  const initialRequestCount = page.shiftListRequests.length;

  await search.evaluate((input) => {
    for (const value of ["dee", "deep", "deep needle"]) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await expectNeedleShift(page);
  const debouncedRequests = page.shiftListRequests.slice(initialRequestCount);
  expect(debouncedRequests).toHaveLength(1);
  expect(new URL(debouncedRequests[0]).searchParams.get("search")).toBe(
    "deep needle"
  );

  let releaseSlow;
  page.slowShiftResponse = new Promise((resolve) => {
    releaseSlow = resolve;
  });
  const slowStarted = new Promise((resolve) => {
    page.onShiftListRequest = (url) => {
      if (url.searchParams.get("search") === "slow") resolve();
    };
  });

  await search.fill("slow");
  await slowStarted;
  await search.fill("deep needle");
  await expectNeedleShift(page);
  releaseSlow();
  await page.waitForTimeout(100);
  await expectNeedleShift(page);
  await expect(page.locator('[data-role="pagination-range"]')).toHaveText(
    "Showing 1–1 of 1"
  );
});
