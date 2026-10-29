export const MEAN_FEASIBILITY_CONSUMPTION_BASIS = "mean";

export const FEASIBILITY_DEMAND_BASIS = Object.freeze({
  MEAN: "mean",
  AGGREGATE_Q95: "aggregate_q95",
  Q50: "q50",
  CONFIGURED: "configured",
});

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim().toLowerCase();

export const applyMeanFeasibilityBasis = (request = {}) => ({
  ...request,
  consumption_basis: request.consumption_basis === "aggregate_q95" ? "aggregate_q95" : "mean",
  quantile_consumption: MEAN_FEASIBILITY_CONSUMPTION_BASIS,
});

export const resolveFeasibilityDemandBasis = (inputParams = {}) => {
  if (inputParams.consumption_basis === "aggregate_q95") return FEASIBILITY_DEMAND_BASIS.AGGREGATE_Q95;
  const basis = text(inputParams?.quantile_consumption);

  if (["median", "q50", "0.5", "0.50", "0.500"].includes(basis)) {
    return FEASIBILITY_DEMAND_BASIS.Q50;
  }

  // The backend default is `mean`, so runs created before the field was
  // persisted are also mean-based.
  if (!basis || basis === "mean") {
    return FEASIBILITY_DEMAND_BASIS.MEAN;
  }

  return FEASIBILITY_DEMAND_BASIS.CONFIGURED;
};
