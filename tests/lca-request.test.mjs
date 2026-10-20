import assert from "node:assert/strict";
import test from "node:test";

import {
  PARAMETERIZED_LCA_ERROR,
  buildYearlyAnalysisLcaUrl,
  parameterizedLcaErrorMessage,
} from "../src/api/lca-request.js";

test("LCA URLs omit an empty query string and encode the analysis id", () => {
  assert.equal(
    buildYearlyAnalysisLcaUrl("/api/v1/yearly-analysis", "analysis /?#", {}),
    "/api/v1/yearly-analysis/analysis%20%2F%3F%23/lca",
  );
  assert.equal(
    buildYearlyAnalysisLcaUrl("/api/v1/yearly-analysis", "case", {
      annual_km: null,
      diesel_consumption_l_per_km: "",
    }),
    "/api/v1/yearly-analysis/case/lca",
  );
});

test("LCA URLs retain zero and false while filtering only absent parameters", () => {
  assert.equal(
    buildYearlyAnalysisLcaUrl("/api/v1/yearly-analysis", "case", {
      annual_km: 0,
      enabled: false,
      electricity_mix: "CH grid/2025",
      ignored: undefined,
    }),
    "/api/v1/yearly-analysis/case/lca?annual_km=0&enabled=false&electricity_mix=CH+grid%2F2025",
  );
});

test("LCA HTTP errors preserve a non-empty textual detail", () => {
  assert.equal(
    parameterizedLcaErrorMessage({ detail: "  Assessment unavailable  " }),
    "Assessment unavailable",
  );
});

test("LCA HTTP errors extract the first usable FastAPI validation message", () => {
  assert.equal(
    parameterizedLcaErrorMessage({
      detail: [
        { loc: ["query", "annual_km"], msg: "  Value must be positive  " },
        { loc: ["query", "annual_km"], msg: "Second detail" },
      ],
    }),
    "Value must be positive",
  );
  assert.equal(
    parameterizedLcaErrorMessage({ detail: [{ msg: "" }, { msg: "Usable detail" }] }),
    "Usable detail",
  );
});

test("LCA HTTP errors use a safe fallback for absent or malformed details", () => {
  for (const payload of [
    null,
    {},
    { detail: "   " },
    { detail: [] },
    { detail: [{ loc: ["query", "annual_km"] }] },
    { detail: { message: "unexpected shape" } },
  ]) {
    assert.equal(parameterizedLcaErrorMessage(payload), PARAMETERIZED_LCA_ERROR);
  }
  assert.equal(parameterizedLcaErrorMessage(null, "Custom fallback"), "Custom fallback");
});
