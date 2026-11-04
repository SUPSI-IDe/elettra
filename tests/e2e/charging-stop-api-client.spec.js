import { expect, test } from "@playwright/test";

test("the charging-stop client sends one authenticated batch and forwards cancellation", async ({ page }) => {
  await page.goto("./");

  const result = await page.evaluate(async () => {
    localStorage.setItem("access_token", "candidate-token");
    const { fetchChargingStopCandidates } = await import(
      "/elettra/src/api/simulation.js"
    );
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    let captured;
    globalThis.fetch = async (url, options) => {
      captured = {
        url: String(url),
        method: options.method,
        headers: options.headers,
        body: JSON.parse(options.body),
        signalMatches: options.signal === controller.signal,
      };
      return new Response(JSON.stringify([{ stop_id: "stop-1" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    try {
      const payload = await fetchChargingStopCandidates(
        [" shift-b ", "shift-a", "shift-b", ""],
        { signal: controller.signal }
      );
      return { captured, payload };
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  expect(result.captured).toEqual({
    url: "/api/v1/simulation/charging-stops/candidates",
    method: "POST",
    headers: {
      accept: "application/json",
      Authorization: "Bearer candidate-token",
      "Content-Type": "application/json",
    },
    body: { shift_ids: ["shift-b", "shift-a"] },
    signalMatches: true,
  });
  expect(result.payload).toEqual([{ stop_id: "stop-1" }]);
});

test("the charging-stop client skips empty selections and reports backend errors", async ({ page }) => {
  await page.goto("./");

  const result = await page.evaluate(async () => {
    const { fetchChargingStopCandidates } = await import(
      "/elettra/src/api/simulation.js"
    );
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      return new Response(JSON.stringify({ detail: "Vehicle block not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    };
    try {
      const empty = await fetchChargingStopCandidates([]);
      let message = "";
      try {
        await fetchChargingStopCandidates(["foreign-shift"]);
      } catch (error) {
        message = error.message;
      }
      return { empty, message, callCount };
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  expect(result).toEqual({
    empty: [],
    message: "Unable to load charging-stop candidates (HTTP 404): Vehicle block not found",
    callCount: 1,
  });
});
