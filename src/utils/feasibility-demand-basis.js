export const Q50_FEASIBILITY_CONSUMPTION_BASIS = "median";

export const FEASIBILITY_DEMAND_BASIS = Object.freeze({
  Q50: "q50",
  LEGACY_MEAN: "legacy_mean",
  CONFIGURED: "configured",
});

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim().toLowerCase();

export const applyQ50FeasibilityBasis = (request = {}) => ({
  ...request,
  quantile_consumption: Q50_FEASIBILITY_CONSUMPTION_BASIS,
});

export const resolveFeasibilityDemandBasis = (inputParams = {}) => {
  const basis = text(inputParams?.quantile_consumption);

  if (["median", "q50", "0.5", "0.50", "0.500"].includes(basis)) {
    return FEASIBILITY_DEMAND_BASIS.Q50;
  }

  // The backend default was `mean`, so historical runs without the persisted
  // field must be treated as mean-based rather than silently relabelled Q50.
  if (!basis || basis === "mean") {
    return FEASIBILITY_DEMAND_BASIS.LEGACY_MEAN;
  }

  return FEASIBILITY_DEMAND_BASIS.CONFIGURED;
};
