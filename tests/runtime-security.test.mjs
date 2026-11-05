import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { shouldRedirectUnauthorizedResponse } from "../src/api/client.js";


test("authenticated 401 redirects while an authorization 403 stays on the page", () => {
  const headers = new Headers({ Authorization: "Bearer token" });
  const common = { url: "/api/v1/user/shifts/", headers, apiRoot: "/api" };

  assert.equal(
    shouldRedirectUnauthorizedResponse({ ...common, status: 401 }),
    true
  );
  assert.equal(
    shouldRedirectUnauthorizedResponse({ ...common, status: 403 }),
    false
  );
  assert.equal(
    shouldRedirectUnauthorizedResponse({
      ...common,
      headers: new Headers(),
      status: 401,
    }),
    false
  );
});


test("fleet visualizations do not fetch executable code from a CDN", async () => {
  const sources = await Promise.all([
    readFile(new URL("../src/pages/Fleet/Shifts/shift-timeline.js", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Fleet/Shifts/trip-preview.js", import.meta.url), "utf8"),
  ]);
  const combined = sources.join("\n");

  assert.doesNotMatch(combined, /cdn\.jsdelivr\.net|unpkg\.com/);
  assert.doesNotMatch(combined, /createElement\(["']script["']\)/);
  assert.match(combined, /from ["']d3["']/);
  assert.match(combined, /from ["']leaflet["']/);
});


test("staging smoke script requires credentials from the environment", async () => {
  const source = await readFile(
    new URL("../.scratch/grid94-lca/staging-smoke.mjs", import.meta.url),
    "utf8"
  );

  assert.match(source, /GRID94_TEST_LOGIN_EMAIL/);
  assert.match(source, /GRID94_TEST_LOGIN_PASSWORD/);
  assert.doesNotMatch(source, /ci-release@example\.com|CI-release-gate/);
});
