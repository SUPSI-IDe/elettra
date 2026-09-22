export const MEAN_FEASIBILITY_CONSUMPTION_BASIS = "mean";

export const FEASIBILITY_DEMAND_BASIS = Object.freeze({
  MEAN: "mean",
  Q50: "q50",
  CONFIGURED: "configured",
});

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim().toLowerCase();

export const applyMeanFeasibilityBasis = (request = {}) => ({
  ...request,
  quantile_consumption: MEAN_FEASIBILITY_CONSUMPTION_BASIS,
});

export const resolveFeasibilityDemandBasis = (inputParams = {}) => {
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
