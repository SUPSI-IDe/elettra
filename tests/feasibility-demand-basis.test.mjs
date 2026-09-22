import assert from "node:assert/strict";
import test from "node:test";

import { translations } from "../src/i18n/translations.js";
import {
  applyMeanFeasibilityBasis,
  FEASIBILITY_DEMAND_BASIS,
  MEAN_FEASIBILITY_CONSUMPTION_BASIS,
  resolveFeasibilityDemandBasis,
} from "../src/utils/feasibility-demand-basis.js";

test("the frontend optimization contract always uses the mean consumption basis", () => {
  assert.equal(MEAN_FEASIBILITY_CONSUMPTION_BASIS, "mean");
  assert.deepEqual(
    applyMeanFeasibilityBasis({
      mode: "battery_only",
      quantile_consumption: "median",
    }),
    {
      mode: "battery_only",
      quantile_consumption: "mean",
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

test("explicit and default backend mean runs resolve to the mean decision basis", () => {
  assert.equal(
    resolveFeasibilityDemandBasis({}),
    FEASIBILITY_DEMAND_BASIS.MEAN
  );
  assert.equal(
    resolveFeasibilityDemandBasis({ quantile_consumption: "mean" }),
    FEASIBILITY_DEMAND_BASIS.MEAN
  );
});

test("an explicitly configured non-Q50 quantile is not mislabelled", () => {
  assert.equal(
    resolveFeasibilityDemandBasis({ quantile_consumption: "0.95" }),
    FEASIBILITY_DEMAND_BASIS.CONFIGURED
  );
});

test("mean-decision and Q05/mean/Q50/Q95 result labels exist in every locale", () => {
  const keys = [
    "simulation.feasibility_mean_feasible",
    "simulation.feasibility_mean_infeasible",
    "simulation.feasibility_q50_feasible",
    "simulation.feasibility_q50_infeasible",
    "simulation.feasibility_configured_feasible",
    "simulation.feasibility_configured_infeasible",
    "simulation.feasibility_basis_in_results_feasible",
    "simulation.feasibility_basis_in_results_infeasible",
    "simulation.feasibility_basis_mean",
    "simulation.feasibility_basis_q50",
    "simulation.feasibility_basis_configured",
    "simulation.feasibility_decision_basis",
    "simulation.feasibility_physical_within_limit",
    "simulation.feasibility_physical_exceeds_limit",
    "simulation.predictions_col_mean",
    "simulation.predictions_col_mean_short",
    "simulation.predictions_overview_subtitle",
    "simulation.predictions_overview_per_km_subtitle",
    "simulation.quantile_help",
    "simulation.battery_adequacy_note",
    "simulation.battery_adequacy_q05",
    "simulation.battery_adequacy_q05_above",
    "simulation.battery_adequacy_q05_covered",
    "simulation.battery_adequacy_mean",
    "simulation.battery_adequacy_mean_above",
    "simulation.battery_adequacy_mean_covered",
    "simulation.battery_adequacy_q50",
    "simulation.battery_adequacy_q95",
    "simulation.sensitivity_q05_demand",
    "simulation.sensitivity_mean_demand",
    "simulation.sensitivity_margin_mean",
    "simulation.sensitivity_q50_exceeds_mean_decision",
    "simulation.efficiency_col_total_q05",
    "simulation.efficiency_col_total_mean",
    "simulation.efficiency_col_total_q50",
    "simulation.efficiency_col_total_q95",
    "simulation.efficiency_col_specific_q05",
    "simulation.efficiency_col_specific_mean",
    "simulation.efficiency_col_specific_q50",
    "simulation.efficiency_col_specific_q95",
    "simulation.overview_consumption_shift_mean",
    "simulation.overview_consumption_km_mean",
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
