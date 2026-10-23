import {
  buildDiscountedProjectedCostTrend,
  computeEquivalentAnnualCost,
  computeScheduleResidualValue,
} from "./economic-costs.js";

const finiteNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const nonNegative = (value) => Math.max(0, finiteNumber(value) ?? 0);
const positive = (value) => {
  const numeric = finiteNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
};

export const recurringReplacementYears = (lifetimeYears, horizonYears) => {
  const lifetime = positive(lifetimeYears);
  const horizon = positive(horizonYears);
  if (lifetime === null || horizon === null) return [];
  const years = [];
  for (let year = lifetime; year < horizon; year += lifetime) years.push(year);
  return years;
};

const replacementCosts = (years, cost) =>
  years.reduce((result, year) => {
    result[year] = (result[year] ?? 0) + cost;
    return result;
  }, {});

const replacementPresentValue = (costByYear, rate) =>
  Object.entries(costByYear).reduce((total, [year, cost]) => {
    const discount = rate > 0 ? Math.pow(1 + rate, Number(year)) : 1;
    return total + cost / discount;
  }, 0);

const component = ({
  initialCost,
  lifetimeYears,
  replacementYears,
  replacementCostByYear,
  rate,
  horizonYears,
}) => ({
  initialCostChf: initialCost,
  lifetimeYears,
  annualizedCostChfPerYear: computeEquivalentAnnualCost(
    initialCost,
    rate,
    lifetimeYears,
  ),
  replacementYears,
  replacementPresentValueChf: replacementPresentValue(
    replacementCostByYear,
    rate,
  ),
  residualValueChf: computeScheduleResidualValue({
    purchaseCost: initialCost,
    lifetimeYears,
    purchaseYears: [0, ...replacementYears],
    horizonYears,
  }),
});

/**
 * Build one capital model for annual KPIs and cumulative lifecycle curves.
 *
 * Each physical component is annualized over its own useful life. The curve
 * uses the same component costs and schedules, while crediting unused life at
 * the analysis horizon. Shared infrastructure is never multiplied by the
 * vehicle count.
 */
export const buildYearlyCapitalModel = ({
  annualizationRate = 0,
  horizonYears,
  vehicleCount = 1,
  electricBusCostPerVehicleChf = 0,
  batteryCostPerVehicleChf = 0,
  sharedInfrastructureCostChf = 0,
  dieselBusCostPerVehicleChf = 0,
  busLifetimeYears,
  batteryLifetimeYears,
  infrastructureLifetimeYears,
  dieselBusLifetimeYears,
  electricAnnualOpex = 0,
  dieselAnnualOpex = 0,
} = {}) => {
  const rate = nonNegative(annualizationRate);
  const count = positive(vehicleCount) ?? 1;
  const busLifetime = positive(busLifetimeYears);
  const batteryLifetime = positive(batteryLifetimeYears);
  const infrastructureLifetime = positive(infrastructureLifetimeYears);
  const dieselLifetime = positive(dieselBusLifetimeYears);
  const horizon = positive(horizonYears) ?? busLifetime ?? 0;

  const electricBusCost = nonNegative(electricBusCostPerVehicleChf) * count;
  const batteryCost = nonNegative(batteryCostPerVehicleChf) * count;
  const infrastructureCost = nonNegative(sharedInfrastructureCostChf);
  const dieselBusCost = nonNegative(dieselBusCostPerVehicleChf) * count;

  const busReplacementYears = recurringReplacementYears(busLifetime, horizon);
  const batteryReplacementYears = recurringReplacementYears(batteryLifetime, horizon);
  const infrastructureReplacementYears = recurringReplacementYears(
    infrastructureLifetime,
    horizon,
  );
  const dieselReplacementYears = recurringReplacementYears(dieselLifetime, horizon);

  const busReplacementCostByYear = replacementCosts(
    busReplacementYears,
    electricBusCost,
  );
  const batteryReplacementCostByYear = replacementCosts(
    batteryReplacementYears,
    batteryCost,
  );
  const infrastructureReplacementCostByYear = replacementCosts(
    infrastructureReplacementYears,
    infrastructureCost,
  );
  const dieselReplacementCostByYear = replacementCosts(
    dieselReplacementYears,
    dieselBusCost,
  );

  const components = {
    electricBus: component({
      initialCost: electricBusCost,
      lifetimeYears: busLifetime,
      replacementYears: busReplacementYears,
      replacementCostByYear: busReplacementCostByYear,
      rate,
      horizonYears: horizon,
    }),
    battery: component({
      initialCost: batteryCost,
      lifetimeYears: batteryLifetime,
      replacementYears: batteryReplacementYears,
      replacementCostByYear: batteryReplacementCostByYear,
      rate,
      horizonYears: horizon,
    }),
    chargingInfrastructure: component({
      initialCost: infrastructureCost,
      lifetimeYears: infrastructureLifetime,
      replacementYears: infrastructureReplacementYears,
      replacementCostByYear: infrastructureReplacementCostByYear,
      rate,
      horizonYears: horizon,
    }),
    dieselBus: component({
      initialCost: dieselBusCost,
      lifetimeYears: dieselLifetime,
      replacementYears: dieselReplacementYears,
      replacementCostByYear: dieselReplacementCostByYear,
      rate,
      horizonYears: horizon,
    }),
  };

  const electricInitialCostChf = electricBusCost + batteryCost + infrastructureCost;
  const dieselInitialCostChf = dieselBusCost;
  const electricReplacementPresentValueChf =
    components.electricBus.replacementPresentValueChf +
    components.battery.replacementPresentValueChf +
    components.chargingInfrastructure.replacementPresentValueChf;
  const electricAnnualizedCostChfPerYear =
    components.electricBus.annualizedCostChfPerYear +
    components.battery.annualizedCostChfPerYear +
    components.chargingInfrastructure.annualizedCostChfPerYear;
  const dieselAnnualizedCostChfPerYear =
    components.dieselBus.annualizedCostChfPerYear;

  const electricResidualValue =
    components.electricBus.residualValueChf +
    components.battery.residualValueChf +
    components.chargingInfrastructure.residualValueChf;
  const dieselResidualValue = components.dieselBus.residualValueChf;

  const yearly = buildDiscountedProjectedCostTrend({
    horizonYears: horizon,
    discountRate: rate,
    dieselBusCapexChf: dieselInitialCostChf,
    dieselAnnualOpex,
    dieselBusReplacementCostByYear: dieselReplacementCostByYear,
    dieselResidualValue,
    electricBusCapexChf: electricInitialCostChf,
    electricAnnualOpex,
    electricBusReplacementCostByYear: busReplacementCostByYear,
    batteryReplacementCostByYear,
    infrastructureReplacementCostByYear,
    electricResidualValue,
  });

  return {
    annualizationRate: rate,
    horizonYears: horizon,
    vehicleCount: count,
    components,
    electric: {
      initialCostChf: electricInitialCostChf,
      replacementPresentValueChf: electricReplacementPresentValueChf,
      initialAndReplacementPresentValueChf:
        electricInitialCostChf + electricReplacementPresentValueChf,
      annualizedCostChfPerYear: electricAnnualizedCostChfPerYear,
    },
    diesel: {
      initialCostChf: dieselInitialCostChf,
      replacementPresentValueChf:
        components.dieselBus.replacementPresentValueChf,
      initialAndReplacementPresentValueChf:
        dieselInitialCostChf + components.dieselBus.replacementPresentValueChf,
      annualizedCostChfPerYear: dieselAnnualizedCostChfPerYear,
    },
    yearly,
    lifecycle: yearly.lifecycle,
    breakEvenYear: findBreakEvenYear(yearly),
  };
};

export const findBreakEvenYear = (yearly = []) => {
  if (!Array.isArray(yearly) || yearly.length === 0) return null;
  if (yearly[0].electric <= yearly[0].diesel) return yearly[0].year;
  for (let index = 1; index < yearly.length; index += 1) {
    const previous = yearly[index - 1];
    const current = yearly[index];
    if (previous.diesel <= previous.electric && current.diesel >= current.electric) {
      const delta = (current.diesel - previous.diesel) -
        (current.electric - previous.electric);
      if (current.year === previous.year || Math.abs(delta) < 1e-9) {
        return current.year;
      }
      return previous.year + (previous.electric - previous.diesel) / delta;
    }
  }
  return null;
};
