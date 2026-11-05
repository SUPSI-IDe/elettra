import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFeasibilityFailureGuidance,
  FEASIBILITY_FAILURE_GUIDANCE as GUIDANCE,
} from "../src/utils/feasibility-failure-guidance.js";
import { translations } from "../src/i18n/translations.js";

const guidanceForMessage = (message) =>
  buildFeasibilityFailureGuidance({ failure: { message } })[0];

test("structured daily-cycle errors select actionable depot guidance", () => {
  const cases = [
    ["daily_cycle_depot_mismatch", GUIDANCE.DEPOT_MISMATCH],
    ["daily_cycle_stop_not_depot", GUIDANCE.STOP_NOT_DEPOT],
    ["daily_cycle_depot_not_selected", GUIDANCE.DEPOT_NOT_SELECTED],
  ];

  for (const [code, expected] of cases) {
    const [guidance] = buildFeasibilityFailureGuidance({
      failure: {
        issues: [{ code, shiftName: "40104", message: "Backend detail" }],
      },
    });
    assert.equal(guidance.kind, expected);
    assert.equal(guidance.shiftName, "40104");
  }
});

test("legacy failures are classified into the backend remediation groups", () => {
  const cases = [
    [
      "40104: daily repetition requires the existing trips to start and end at the same depot; no transfers are added",
      GUIDANCE.DEPOT_MISMATCH,
    ],
    [
      "40104: daily repetition requires the common start/end stop to be a registered depot",
      GUIDANCE.STOP_NOT_DEPOT,
    ],
    [
      "40104: select the start/end depot in charging infrastructure",
      GUIDANCE.DEPOT_NOT_SELECTED,
    ],
    [
      "40104: the duty must leave time for a daily depot stay",
      GUIDANCE.DEPOT_DWELL,
    ],
    [
      "Prediction 123 does not cover the current complete shift sequence",
      GUIDANCE.PREDICTION_REFRESH,
    ],
    [
      "prediction row has no requested quantile 'q95'",
      GUIDANCE.PREDICTION_REFRESH,
    ],
    [
      "Prediction mass/capacity is stale; recalculate its forecast",
      GUIDANCE.PREDICTION_REFRESH,
    ],
    [
      "Prediction no longer covers the complete ordered shift",
      GUIDANCE.PREDICTION_REFRESH,
    ],
    [
      "Current model/features do not reproduce the reference forecast; recalculate predictions",
      GUIDANCE.PREDICTION_REFRESH,
    ],
    [
      "Prediction abc has no explicit battery pack count",
      GUIDANCE.PREDICTION_REFRESH,
    ],
    [
      "Prediction abc is not completed",
      GUIDANCE.PREDICTION_REFRESH,
    ],
    [
      "Aggregate Q95 requires a supported complete predictive distribution",
      GUIDANCE.PREDICTION_DISTRIBUTION,
    ],
    [
      "The QRF model has no fitted estimators",
      GUIDANCE.PREDICTION_DISTRIBUTION,
    ],
    [
      "Predictive distribution contains non-finite energy",
      GUIDANCE.PREDICTION_DISTRIBUTION,
    ],
    [
      "Optimization prediction runs must share one model, stack and auxiliary estimator",
      GUIDANCE.PREDICTION_CONSISTENCY,
    ],
    [
      "Battery variants must share bus model, weather, occupancy, heater and model release",
      GUIDANCE.PREDICTION_CONSISTENCY,
    ],
    [
      "Cannot determine bus_model_id for shift abc. Provide bus_model_id in the request or assign a bus with a model to the shift.",
      GUIDANCE.BUS_MODEL,
    ],
    [
      "Prediction capacity does not match the physical bus model",
      GUIDANCE.BUS_MODEL,
    ],
    [
      "The prediction's bus model is no longer available",
      GUIDANCE.BUS_MODEL,
    ],
    [
      "40104: set battery_pack_cost_chf in the bus model before joint optimization",
      GUIDANCE.BUS_COSTS,
    ],
    [
      "Trip 123 has no stop times",
      GUIDANCE.OPERATIONAL_DATA,
    ],
    [
      "Aggregate forecast time budget exhausted",
      GUIDANCE.TIME_BUDGET,
    ],
    [
      "Charging station identifiers must be unique",
      GUIDANCE.CONFIGURATION,
    ],
    [
      "Daily cycles require entire-dwell occupancy",
      GUIDANCE.CONFIGURATION,
    ],
    [
      "Invalid aggregate sample count/limit",
      GUIDANCE.CONFIGURATION,
    ],
    [
      "Unsupported solver 'example'",
      GUIDANCE.SYSTEM,
    ],
    [
      "Optimization worker finished without a terminal result",
      GUIDANCE.SYSTEM,
    ],
    [
      "Unexpected worker failure",
      GUIDANCE.GENERIC,
    ],
  ];

  for (const [message, expected] of cases) {
    assert.equal(guidanceForMessage(message).kind, expected, message);
  }
  assert.equal(guidanceForMessage(cases[0][0]).shiftName, "40104");
});

test("blocked shifts point to the actual blocking vehicle blocks", () => {
  assert.deepEqual(
    buildFeasibilityFailureGuidance({
      failure: { message: "Failure" },
      outcome: { status: "not_evaluated" },
      blockingShiftNames: ["40104", "40106"],
    }),
    [{
      kind: GUIDANCE.BLOCKED,
      blockingShiftNames: ["40104", "40106"],
    }],
  );
});

test("current vehicle-block names override historical names stored in results", () => {
  const [guidance] = buildFeasibilityFailureGuidance({
    failure: {
      issues: [{
        code: "daily_cycle_depot_mismatch",
        shiftId: "shift-40104",
        shiftName: "Historical 40104",
      }],
    },
    shiftNamesById: new Map([["shift-40104", "40104"]]),
  });

  assert.equal(guidance.shiftName, "40104");
});

test("an unreferenced blocked outcome falls back to general recovery guidance", () => {
  assert.deepEqual(
    buildFeasibilityFailureGuidance({
      failure: { message: "Failure" },
      outcome: { status: "not_evaluated" },
    }),
    [{ kind: GUIDANCE.GENERIC }],
  );
});

test("every remediation string is available in all supported languages", () => {
  const keys = [
    "simulation.feasibility_failed_guidance_title",
    "simulation.feasibility_failed_guidance_shift_named",
    "simulation.feasibility_failed_guidance_shift_affected",
    ...Object.values(GUIDANCE).map(
      (kind) => `simulation.feasibility_failed_guidance_${kind}`,
    ),
  ];

  for (const language of ["en", "de", "fr", "it"]) {
    for (const key of keys) {
      assert.equal(
        typeof translations[language]?.[key],
        "string",
        `${language} is missing ${key}`,
      );
      assert.ok(translations[language][key].trim(), `${language} has an empty ${key}`);
    }
  }
});
