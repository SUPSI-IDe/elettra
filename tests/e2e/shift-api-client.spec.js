import { expect, test } from "@playwright/test";


test("the shift client forwards server search, pagination, filters, and cancellation", async ({
  page,
}) => {
  await page.goto("./");

  const result = await page.evaluate(async () => {
    localStorage.setItem("access_token", "shift-search-token");
    const { fetchShifts } = await import("/elettra/src/api/shifts.js");
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    let captured;

    globalThis.fetch = async (url, options) => {
      captured = {
        url: String(url),
        method: options.method,
        headers: options.headers,
        signalMatches: options.signal === controller.signal,
      };
      return new Response(
        JSON.stringify({
          items: [{ id: "shift-35", name: "Deep needle" }],
          total: 1,
          skip: 0,
          limit: 50,
          count: 1,
          has_next: false,
          has_previous: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    try {
      const payload = await fetchShifts({
        skip: 0,
        limit: 50,
        busId: "bus-1",
        userId: "user-1",
        search: "  Deep needle & return  ",
        signal: controller.signal,
      });
      return { captured, payload };
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  const url = new URL(result.captured.url, "http://example.test");
  expect(url.pathname).toBe("/api/v1/user/shifts/");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    skip: "0",
    limit: "50",
    bus_id: "bus-1",
    user_id: "user-1",
    search: "Deep needle & return",
  });
  expect(result.captured.method).toBe("GET");
  expect(result.captured.headers).toEqual({
    accept: "application/json",
    Authorization: "Bearer shift-search-token",
  });
  expect(result.captured.signalMatches).toBe(true);
  expect(result.payload).toMatchObject({
    items: [{ id: "shift-35", name: "Deep needle" }],
    total: 1,
    count: 1,
  });
});


test("the shift client preserves the legacy URL when search is empty", async ({
  page,
}) => {
  await page.goto("./");

  const capturedUrl = await page.evaluate(async () => {
    const { fetchShifts } = await import("/elettra/src/api/shifts.js");
    const originalFetch = globalThis.fetch;
    let url = "";
    globalThis.fetch = async (input) => {
      url = String(input);
      return new Response(
        JSON.stringify({
          items: [],
          total: 0,
          skip: 20,
          limit: 20,
          count: 0,
          has_next: false,
          has_previous: true,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    try {
      await fetchShifts({ skip: 20, limit: 20, search: "   " });
      return url;
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  const url = new URL(capturedUrl, "http://example.test");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    skip: "20",
    limit: "20",
  });
  expect(url.searchParams.has("search")).toBe(false);
});
