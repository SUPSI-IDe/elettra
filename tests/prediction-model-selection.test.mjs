import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildPredictionRunRequestBody } from "../src/api/prediction-request.js";

const baseRequest = {
  shift_ids: ["shift-1"],
  bus_model_id: "bus-model-1",
  external_temp_celsius: -5,
  occupancy_percent: 50,
  auxiliary_heating_type: "default",
};

test("lets the backend select and persist the configured prediction model", () => {
  const body = buildPredictionRunRequestBody(baseRequest);

  assert.equal(Object.hasOwn(body, "model_name"), false);
});

test("does not turn an empty model name into an explicit selection", () => {
  const body = buildPredictionRunRequestBody({
    ...baseRequest,
    model_name: "   ",
  });

  assert.equal(Object.hasOwn(body, "model_name"), false);
});

test("preserves a deliberately selected prediction model", () => {
  const body = buildPredictionRunRequestBody({
    ...baseRequest,
    model_name: " model-release-2 ",
  });

  assert.equal(body.model_name, "model-release-2");
});

test("standard prediction workflows do not embed a frontend model default", () => {
  const workflowFiles = [
    "../src/api/simulation.js",
    "../src/pages/Simulation/Runs/add-simulation.js",
    "../src/pages/Simulation/Runs/simulation-detail.js",
    "../src/pages/Simulation/YearlyAnalysis/create-yearly-analysis.js",
  ];

  for (const relativePath of workflowFiles) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.doesNotMatch(source, /DEFAULT_PREDICTION_MODEL_NAME/);
  }
});
