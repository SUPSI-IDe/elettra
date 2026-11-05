import assert from "node:assert/strict";
import test from "node:test";
import { resolveRouteSlug } from "../src/utils/route-access.js";

test("application entry depends on the validated session", () => {
  assert.equal(resolveRouteSlug("", false), "landing");
  assert.equal(resolveRouteSlug("", true), "home");
});

test("authenticated users cannot navigate back to guest authentication screens", () => {
  for (const slug of ["landing", "login", "register"]) {
    assert.equal(resolveRouteSlug(slug, true), "home");
    assert.equal(resolveRouteSlug(slug, false), slug);
  }
});

test("protected deep links are preserved only with an active session", () => {
  for (const slug of ["home", "buses", "shifts", "simulation-results", "yearly-analysis-results", "settings"]) {
    assert.equal(resolveRouteSlug(slug, true), slug);
    assert.equal(resolveRouteSlug(slug, false), "login");
  }
  assert.equal(resolveRouteSlug("about", true), "about");
  assert.equal(resolveRouteSlug("about", false), "about");
});
