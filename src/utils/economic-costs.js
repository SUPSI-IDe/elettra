const toFiniteNumber = (value) => {
  if (value === "" || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const computeEquivalentAnnualCost = (principal, rate, lifetimeYears) => {
  const capex = toFiniteNumber(principal);
  const lifetime = toFiniteNumber(lifetimeYears);
  const annualRate = toFiniteNumber(rate);

  if (capex == null || capex <= 0 || lifetime == null || lifetime <= 0) return 0;
  if (annualRate == null || annualRate <= 0) return capex / lifetime;

  const growth = Math.pow(1 + annualRate, lifetime);
  return capex * ((annualRate * growth) / (growth - 1));
};

/**
 * Linear (straight-line) residual value of a single capital asset at the
 * analysis horizon.
 *
 * FINANCIAL-SEMANTICS DECISION (residual value convention):
 * A vehicle or battery bought (or replaced) before the horizon may still have
 * remaining useful life when the analysis stops. Charging its full purchase
 * cost without any credit unfairly penalises whichever technology happened to
 * be replaced shortly before the horizon (typically the shorter-lived diesel
 * comparator). We therefore credit back the unused fraction of the asset using
 * straight-line depreciation:
 *
 *   remaining = max(0, purchaseYear + lifetime - horizon)   // years of life left
 *   residual  = purchaseCost * remaining / lifetime          // nominal value at horizon
 *
 * The caller is responsible for discounting this nominal residual to present
 * value at the horizon (see buildDiscountedProjectedCostTrend).
 */
export const computeLinearResidualValue = ({
  purchaseCost,
  lifetimeYears,
  purchaseYear,
  horizonYears,
}) => {
  const cost = toFiniteNumber(purchaseCost) ?? 0;
  const lifetime = toFiniteNumber(lifetimeYears) ?? 0;
  const purchase = toFiniteNumber(purchaseYear) ?? 0;
  const horizon = toFiniteNumber(horizonYears) ?? 0;
  if (cost <= 0 || lifetime <= 0) return 0;
  // Clamp remaining life to [0, lifetime] so an asset bought exactly at the
  // horizon (remaining === lifetime) or long before it (remaining <= 0) stays
  // within sensible bounds.
  const remaining = Math.min(Math.max(0, purchase + lifetime - horizon), lifetime);
  return cost * (remaining / lifetime);
};

/**
 * Residual value at the horizon for an asset that is (re)purchased on a fixed
 * schedule. Only the latest purchase strictly before the horizon can still
 * hold remaining useful life; earlier units are fully consumed and units bought
 * exactly at the horizon belong to the next lifecycle and are ignored here.
 */
export const computeScheduleResidualValue = ({
  purchaseCost,
  lifetimeYears,
  purchaseYears = [0],
  horizonYears,
}) => {
  const horizon = toFiniteNumber(horizonYears) ?? 0;
  const candidates = (Array.isArray(purchaseYears) ? purchaseYears : [purchaseYears])
    .map((year) => toFiniteNumber(year))
    .filter((year) => year != null && year < horizon);
  if (!candidates.length) return 0;
  const latestPurchaseYear = Math.max(...candidates);
  return computeLinearResidualValue({
    purchaseCost,
    lifetimeYears,
    purchaseYear: latestPurchaseYear,
    horizonYears: horizon,
  });
};

/**
 * Builds cumulative present-value cost points.
 *
 * Convention: year 0 is initial CAPEX and is not discounted. Year y includes
 * discounted cash flows occurring in years 1..y: annual OPEX and any
 * caller-scheduled replacements for that same year. Replacement-year points
 * include a pre-replacement point followed by the post-replacement jump.
 *
 * FINANCIAL-SEMANTICS DECISION:
 * - Chart points are gross cumulative discounted costs: CAPEX, discounted
 *   OPEX, and discounted replacements before the horizon. Residual value is
 *   not drawn as a negative cost in the curve, so the plotted line remains
 *   monotonic non-decreasing.
 * - KPI economics are net lifecycle costs: gross final cost minus discounted
 *   residual value. The returned array carries this separate summary on its
 *   `lifecycle` property for callers that render lifecycle savings.
 */
export const buildDiscountedProjectedCostTrend = ({
  horizonYears,
  discountRate = 0,
  dieselBusCapexChf = 0,
  dieselAnnualOpex = 0,
  dieselBusReplacementCostByYear = {},
  dieselResidualValue = 0,
  electricBusCapexChf = 0,
  electricAnnualOpex = 0,
  electricBusReplacementCostByYear = {},
  batteryReplacementCostByYear = {},
  electricResidualValue = 0,
}) => {
  const horizon = Math.max(0, Math.floor(toFiniteNumber(horizonYears) ?? 0));
  const rate = toFiniteNumber(discountRate) ?? 0;
  const dieselCapex = toFiniteNumber(dieselBusCapexChf) ?? 0;
  const electricCapex = toFiniteNumber(electricBusCapexChf) ?? 0;
  const dieselOpex = toFiniteNumber(dieselAnnualOpex) ?? 0;
  const electricOpex = toFiniteNumber(electricAnnualOpex) ?? 0;

  const yearly = [];
  let dieselPresentValue = dieselCapex;
  let electricPresentValue = electricCapex;

  if (electricCapex > 0 || dieselCapex > 0) {
    yearly.push({ year: 0, diesel: dieselPresentValue, electric: electricPresentValue });
  }

  for (let year = 1; year <= horizon; year += 1) {
    const discountFactor = rate > 0 ? Math.pow(1 + rate, year) : 1;
    const dieselReplacementCost = toFiniteNumber(dieselBusReplacementCostByYear?.[year]) ?? 0;
    const electricReplacementCost =
      (toFiniteNumber(electricBusReplacementCostByYear?.[year]) ?? 0) +
      (toFiniteNumber(batteryReplacementCostByYear?.[year]) ?? 0);

    dieselPresentValue += dieselOpex / discountFactor;
    electricPresentValue += electricOpex / discountFactor;

    if (dieselReplacementCost > 0 || electricReplacementCost > 0) {
      yearly.push({ year, diesel: dieselPresentValue, electric: electricPresentValue });
      dieselPresentValue += dieselReplacementCost / discountFactor;
      electricPresentValue += electricReplacementCost / discountFactor;
    }

    yearly.push({ year, diesel: dieselPresentValue, electric: electricPresentValue });
  }

  const dieselResidual = toFiniteNumber(dieselResidualValue) ?? 0;
  const electricResidual = toFiniteNumber(electricResidualValue) ?? 0;
  const horizonDiscount = rate > 0 ? Math.pow(1 + rate, horizon) : 1;
  const dieselDiscountedResidual = dieselResidual / horizonDiscount;
  const electricDiscountedResidual = electricResidual / horizonDiscount;
  const grossFinalDiesel = dieselPresentValue;
  const grossFinalElectric = electricPresentValue;
  const netFinalDiesel = grossFinalDiesel - dieselDiscountedResidual;
  const netFinalElectric = grossFinalElectric - electricDiscountedResidual;

  Object.defineProperty(yearly, "lifecycle", {
    configurable: true,
    enumerable: false,
    value: {
      horizonYears: horizon,
      grossFinalDiesel,
      grossFinalElectric,
      dieselResidualValue: dieselResidual,
      electricResidualValue: electricResidual,
      dieselDiscountedResidual,
      electricDiscountedResidual,
      netFinalDiesel,
      netFinalElectric,
      lifecycleSaving: netFinalDiesel - netFinalElectric,
    },
  });

  return yearly;
};
