import assert from "node:assert/strict";
import test from "node:test";

import { translations } from "../src/i18n/translations.js";
import {
  applyQ50FeasibilityBasis,
  FEASIBILITY_DEMAND_BASIS,
  Q50_FEASIBILITY_CONSUMPTION_BASIS,
  resolveFeasibilityDemandBasis,
} from "../src/utils/feasibility-demand-basis.js";

test("the frontend optimization contract always uses the median consumption basis", () => {
  assert.equal(Q50_FEASIBILITY_CONSUMPTION_BASIS, "median");
  assert.deepEqual(
    applyQ50FeasibilityBasis({
      mode: "battery_only",
      quantile_consumption: "mean",
    }),
    {
      mode: "battery_only",
      quantile_consumption: "median",
    }
  );
});

test("median aliases resolve to the Q50-based demand scenario", () => {
  for (const value of ["median", "q50", "0.5", "0.50", "0.500"]) {
    assert.equal(
      resolveFeasibilityDemandBasis({ quantile_consumption: value }),
      FEASIBILITY_DEMAND_BASIS.Q50
    );
  }
});

test("historical runs without a basis remain identified as legacy mean results", () => {
  assert.equal(
    resolveFeasibilityDemandBasis({}),
    FEASIBILITY_DEMAND_BASIS.LEGACY_MEAN
  );
  assert.equal(
    resolveFeasibilityDemandBasis({ quantile_consumption: "mean" }),
    FEASIBILITY_DEMAND_BASIS.LEGACY_MEAN
  );
});

test("an explicitly configured non-Q50 quantile is not mislabelled", () => {
  assert.equal(
    resolveFeasibilityDemandBasis({ quantile_consumption: "0.95" }),
    FEASIBILITY_DEMAND_BASIS.CONFIGURED
  );
});

test("Q50 feasibility and Q05/Q50/Q95 result labels exist in every locale", () => {
  const keys = [
    "simulation.feasibility_q50_feasible",
    "simulation.feasibility_q50_infeasible",
    "simulation.feasibility_legacy_mean_feasible",
    "simulation.feasibility_legacy_mean_infeasible",
    "simulation.feasibility_configured_feasible",
    "simulation.feasibility_configured_infeasible",
    "simulation.feasibility_basis_in_results_feasible",
    "simulation.feasibility_basis_in_results_infeasible",
    "simulation.feasibility_basis_q50",
    "simulation.feasibility_basis_legacy_mean",
    "simulation.feasibility_basis_configured",
    "simulation.feasibility_decision_basis",
    "simulation.feasibility_physical_within_limit",
    "simulation.feasibility_physical_exceeds_limit",
    "simulation.battery_adequacy_q05",
    "simulation.battery_adequacy_q05_above",
    "simulation.battery_adequacy_q05_covered",
    "simulation.battery_adequacy_q50",
    "simulation.battery_adequacy_q95",
    "simulation.sensitivity_q05_demand",
    "simulation.efficiency_col_total_q05",
    "simulation.efficiency_col_total_q50",
    "simulation.efficiency_col_total_q95",
    "simulation.efficiency_col_specific_q05",
    "simulation.efficiency_col_specific_q50",
    "simulation.efficiency_col_specific_q95",
    "simulation.efficiency_col_drivetrain_q50",
    "simulation.efficiency_col_auxiliary_q50",
  ];

  for (const [locale, dictionary] of Object.entries(translations)) {
    for (const key of keys) {
      assert.equal(
        typeof dictionary[key],
        "string",
        `${locale} is missing ${key}`
      );
      assert.notEqual(dictionary[key].trim(), "", `${locale} has an empty ${key}`);
    }
  }
});
