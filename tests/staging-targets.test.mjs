import assert from "node:assert/strict";
import test from "node:test";

import {
  STAGING_TARGETS,
  resolveStagingTargets,
} from "../test-support/staging-targets.mjs";


test("test targets default to the complete staging stack", () => {
  const targets = resolveStagingTargets({});

  assert.deepEqual(targets, STAGING_TARGETS);
});


for (const [name, value] of [
  ["ELETTRA_TEST_FRONTEND_URL", "http://127.0.0.1:9010"],
  ["ELETTRA_TEST_FRONTEND_URL", "http://example.test:55558"],
  ["ELETTRA_TEST_BACKEND_URL", "http://127.0.0.1:8002"],
  ["ELETTRA_TEST_BACKEND_URL", "http://example.test:9005"],
  ["VITE_API_PROXY_TARGET", "http://127.0.0.1:8002"],
  ["VITE_API_ROOT", "http://127.0.0.1:8002"],
]) {
  test(`test configuration rejects ${name}=${value}`, () => {
    assert.throws(
      () => resolveStagingTargets({ [name]: value }),
      /must be exactly|must be empty/,
    );
  });
}


test("explicit staging values are accepted", () => {
  const targets = resolveStagingTargets({
    ELETTRA_TEST_FRONTEND_URL: STAGING_TARGETS.frontendUrl,
    ELETTRA_TEST_BACKEND_URL: STAGING_TARGETS.backendUrl,
    VITE_API_PROXY_TARGET: STAGING_TARGETS.backendUrl,
    VITE_API_ROOT: "",
  });

  assert.deepEqual(targets, STAGING_TARGETS);
});
