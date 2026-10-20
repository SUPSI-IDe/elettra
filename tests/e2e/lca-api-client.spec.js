import { expect, test } from "@playwright/test";

test("the LCA client builds clean authenticated requests and forwards cancellation", async ({ page }) => {
  await page.goto("./");

  const result = await page.evaluate(async () => {
    localStorage.setItem("access_token", "lca-client-token");
    const { fetchYearlyAnalysisLca } = await import(
      "/elettra/src/api/simulation.js"
    );
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({
        url: String(url),
        method: options?.method,
        accept: options?.headers?.accept,
        authorization: options?.headers?.Authorization,
        signalMatches: options?.signal === controller.signal,
      });
      return new Response(JSON.stringify({ status: "complete" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const controller = new AbortController();
    try {
      const first = await fetchYearlyAnalysisLca("case /?#", {}, {
        signal: controller.signal,
      });
      await fetchYearlyAnalysisLca("case", {
        annual_km: 0,
        diesel_consumption_l_per_km: "",
        electricity_mix: "CH grid/2025",
      });
      return { first, requests };
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  expect(result.first).toEqual({ status: "complete" });
  expect(result.requests).toEqual([
    {
      url: "/api/v1/yearly-analysis/case%20%2F%3F%23/lca",
      method: "GET",
      accept: "application/json",
      authorization: "Bearer lca-client-token",
      signalMatches: true,
    },
    {
      url: "/api/v1/yearly-analysis/case/lca?annual_km=0&electricity_mix=CH+grid%2F2025",
      method: "GET",
      accept: "application/json",
      authorization: "Bearer lca-client-token",
      signalMatches: false,
    },
  ]);
});

test("the LCA client reports all supported HTTP error shapes", async ({ page }) => {
  await page.goto("./");

  const messages = await page.evaluate(async () => {
    const { fetchYearlyAnalysisLca } = await import(
      "/elettra/src/api/simulation.js"
    );
    const originalFetch = globalThis.fetch;
    const responses = [
      new Response(JSON.stringify({ detail: "Assessment unavailable" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
      new Response(JSON.stringify({
        detail: [{ loc: ["query", "annual_km"], msg: "Value must be positive" }],
      }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }),
      new Response(JSON.stringify({ detail: { message: "Unexpected shape" } }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
      new Response("upstream proxy failure", { status: 502 }),
      new Response(null, { status: 503 }),
    ];
    globalThis.fetch = async () => responses.shift();
    try {
      const errors = [];
      for (let index = 0; index < 5; index += 1) {
        try {
          await fetchYearlyAnalysisLca(`case-${index}`);
        } catch (error) {
          errors.push(error.message);
        }
      }
      try {
        await fetchYearlyAnalysisLca("");
      } catch (error) {
        errors.push(error.message);
      }
      return errors;
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  expect(messages).toEqual([
    "Assessment unavailable",
    "Value must be positive",
    "Unable to load parameterized LCA.",
    "Unable to load parameterized LCA.",
    "Unable to load parameterized LCA.",
    "Missing yearly analysis ID.",
  ]);
});
