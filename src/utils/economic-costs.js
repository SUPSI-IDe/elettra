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
 * Builds cumulative present-value cost points.
 *
 * Convention: year 0 is initial CAPEX and is not discounted. Year y includes
 * discounted cash flows occurring in years 1..y: annual OPEX and any
 * caller-scheduled replacements for that same year. Replacement-year points
 * include a pre-replacement point followed by the post-replacement jump.
 */
export const buildDiscountedProjectedCostTrend = ({
  horizonYears,
  discountRate = 0,
  dieselBusCapexChf = 0,
  dieselAnnualOpex = 0,
  dieselBusReplacementCostByYear = {},
  electricBusCapexChf = 0,
  electricAnnualOpex = 0,
  electricBusReplacementCostByYear = {},
  batteryReplacementCostByYear = {},
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

  return yearly;
};
