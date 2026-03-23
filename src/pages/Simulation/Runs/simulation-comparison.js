import * as d3 from "d3";
import { t } from "../../../i18n";
import { triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";
import {
  fetchEconomicComparison,
  fetchEconomicDefaults,
  fetchOptimizationRun,
  fetchPredictionRun,
} from "../../../api/simulation";
import { fetchBusModelById } from "../../../api/bus-models";
import { fetchShiftYearlyDistance } from "../../../api/shifts";
import {
  DEFAULT_OPEX_ANNUALIZATION_RATE,
  DEFAULT_BUS_LIFETIME_YEARS,
  DEFAULT_DIESEL_BUS_LIFETIME_YEARS,
  DEFAULT_BATTERY_LIFETIME_YEARS,
  getEquivalentDieselBusCapexForLength,
} from "../../../config/economic-defaults";
import "./simulation-comparison.css";

/* ── Shared utilities ─────────────────────────────────────────── */

const toFiniteNumber = (value) => {
  if (value === "" || (typeof value === "string" && value.trim() === ""))
    return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const firstText = (...values) => {
  for (const value of values) {
    const candidate =
      value === null || value === undefined ? "" : String(value).trim();
    if (candidate) return candidate;
  }
  return "";
};

const formatFixed = (val, dec = 1) => {
  const n = Number(val);
  return Number.isNaN(n)
    ? "—"
    : n.toLocaleString("de-CH", {
        maximumFractionDigits: dec,
        minimumFractionDigits: dec,
      });
};

const formatCHF = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("de-CH");
};

const formatChfAxis = (value) => {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${Math.round(value / 1e3)}k`;
  return String(Math.round(value));
};

const formatChfLabel = (value) => {
  if (Math.abs(value) >= 1e6) return `CHF ${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `CHF ${formatCHF(value)}`;
  return `CHF ${Math.round(value)}`;
};

const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

/* ── i18n label helpers ───────────────────────────────────────── */

const busCategoryLabel = (key) =>
  ({
    equivalent_diesel_bus: t("simulation.label_equivalent_diesel_bus"),
    electric_bus: t("simulation.label_electric_bus"),
  })[key] ?? key;

const fuelLabel = (key) =>
  ({
    diesel: t("simulation.label_diesel"),
    electric: t("simulation.label_electric"),
  })[key] ?? key;

const costStackLabel = (key) =>
  ({
    vehicle: t("simulation.cost_stack_vehicle") || "CAPEX",
    energy: t("simulation.cost_stack_energy") || "OPEX usage",
    maintenance: t("simulation.cost_stack_maintenance") || "OPEX maintenance",
  })[key] ?? key;

const chartAriaLabel = (key, fallback) => t(key) || fallback;

/* ── Constants ────────────────────────────────────────────────── */

const COST_STACK_KEYS = ["vehicle", "energy", "maintenance"];
const COST_COLORS = {
  vehicle: "#4f86c6",
  energy: "#d4881f",
  maintenance: "#5f8f2f",
};
const FUEL_COLORS = {
  diesel: "#c0392b",
  electric: "#2e7d32",
};
const PROJECTED_COST_TREND_HORIZON_YEARS = 20;
const COST_ANNUALIZATION_FACTOR = 52;
const DEFAULT_INFRASTRUCTURE_SLOT_COST_CHF = 150000;

const CO2_ANNUAL = [
  { category: "equivalent_diesel_bus", value: 85, color: "#6fbeec" },
  { category: "electric_bus", value: 12, color: "#abe828" },
];
const CO2_CUM = Array.from({ length: 15 }, (_, i) => ({
  year: i + 1,
  saved: (i + 1) * 73,
}));

/* ── Bus model helpers ────────────────────────────────────────── */

const parseBusModelSpecs = (specs) => {
  if (!specs) return {};
  if (typeof specs === "string") {
    try {
      const parsed = JSON.parse(specs);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof specs === "object" ? specs : {};
};

const mergeBusModelData = (current = {}, specs = {}, busModel = {}) => ({
  ...current,
  manufacturer: hasValue(current?.manufacturer)
    ? current.manufacturer
    : (busModel?.manufacturer ?? busModel?.manufacturer_name ?? ""),
  cost: hasValue(current?.cost) ? current.cost : (specs?.cost ?? ""),
  bus_length_m: hasValue(current?.bus_length_m)
    ? current.bus_length_m
    : (specs?.bus_length_m ?? ""),
  max_passengers: hasValue(current?.max_passengers)
    ? current.max_passengers
    : (specs?.max_passengers ?? ""),
  bus_lifetime: hasValue(current?.bus_lifetime)
    ? current.bus_lifetime
    : (specs?.bus_lifetime ?? ""),
  battery_pack_size_kwh: hasValue(current?.battery_pack_size_kwh)
    ? current.battery_pack_size_kwh
    : (specs?.battery_pack_size_kwh ?? ""),
  battery_pack_cost: hasValue(current?.battery_pack_cost)
    ? current.battery_pack_cost
    : (specs?.battery_pack_cost_chf ?? ""),
  max_charging_power_kw: hasValue(current?.max_charging_power_kw)
    ? current.max_charging_power_kw
    : (specs?.max_charging_power_kw ?? ""),
  battery_pack_lifetime: hasValue(current?.battery_pack_lifetime)
    ? current.battery_pack_lifetime
    : (specs?.battery_pack_lifetime ?? ""),
});

/* ── Cost computation helpers ─────────────────────────────────── */

const classifyOpexCost = (item = {}) => {
  const label = String(item?.name ?? "").toLowerCase();
  if (/maint/.test(label)) return "maintenance";
  if (/fuel|energy|electric/.test(label)) return "energy";
  return "maintenance";
};

const sumOpexItemsByType = (items = [], type) =>
  (Array.isArray(items) ? items : []).reduce((total, item) => {
    if (classifyOpexCost(item) !== type) return total;
    return total + (toFiniteNumber(item?.cost_chf_per_year) ?? 0);
  }, 0);

const resolveOptimizedPackCount = (batteryResults = {}) => {
  const optimizedPacks = Object.values(batteryResults ?? {})
    .map((result) => toFiniteNumber(result?.optimized_packs))
    .filter((value) => value != null);
  if (!optimizedPacks.length) return null;
  return d3.max(optimizedPacks);
};

const resolveStationSlots = (...stations) =>
  stations
    .map((s) => toFiniteNumber(s?.num_slots ?? s?.slots))
    .find((v) => v != null);

const resolveStationSlotCosts = (...stations) => {
  for (const station of stations) {
    const slotCosts = Array.isArray(station?.slot_costs_chf)
      ? station.slot_costs_chf
          .map((v) => toFiniteNumber(v))
          .filter((v) => v != null)
      : [];
    if (slotCosts.length) return slotCosts;
  }
  return [];
};

const buildDefaultSlotCosts = (slotCount) => {
  const slots = Math.max(0, Math.round(toFiniteNumber(slotCount) ?? 0));
  if (!slots) return [];
  return Array.from(
    { length: slots },
    (_, i) =>
      i === 0
        ? DEFAULT_INFRASTRUCTURE_SLOT_COST_CHF * 2
        : DEFAULT_INFRASTRUCTURE_SLOT_COST_CHF
  );
};

const resolveInfrastructureInvestment = (optimizationRun = {}, opts = {}) => {
  const inputStations = Array.isArray(
    optimizationRun?.input_params?.charging_stations
  )
    ? optimizationRun.input_params.charging_stations
    : [];
  const installedChargers =
    optimizationRun?.results?.installed_chargers ?? {};
  const inputByStopId = new Map(
    inputStations
      .filter((s) => firstText(s?.stop_id))
      .map((s) => [firstText(s.stop_id), s])
  );
  const installedByStopId = new Map(
    Object.entries(installedChargers)
      .filter(([id]) => firstText(id))
      .map(([id, s]) => [firstText(id), s ?? {}])
  );
  const stopIds = [
    ...new Set([...inputByStopId.keys(), ...installedByStopId.keys()]),
  ];

  const mode = firstText(
    optimizationRun?.input_params?.mode,
    optimizationRun?.input_params?.optimization_mode,
    opts?.optimizationMode
  );

  let totalCostChf = 0;
  let totalSlots = 0;
  let stationCount = 0;
  let usedDefaultCosts = false;

  for (const stopId of stopIds) {
    const inputStation = inputByStopId.get(stopId) ?? null;
    const installedStation = installedByStopId.get(stopId) ?? null;
    const slots = Math.max(
      0,
      Math.round(
        toFiniteNumber(resolveStationSlots(installedStation, inputStation)) ?? 0
      )
    );
    if (!slots) continue;

    const explicit = resolveStationSlotCosts(installedStation, inputStation);
    const slotCosts = explicit.length ? explicit : buildDefaultSlotCosts(slots);
    if (!explicit.length && slotCosts.length) usedDefaultCosts = true;
    if (!slotCosts.length) continue;

    totalCostChf += d3.sum(slotCosts);
    totalSlots += slots;
    stationCount += 1;
  }

  const shouldIncludeInCapex = mode !== "battery_only";
  return {
    stationCount,
    totalSlots,
    totalCostChf: stationCount > 0 ? totalCostChf : null,
    includedInCapex:
      shouldIncludeInCapex && stationCount > 0 && totalCostChf > 0,
    usedDefaultCosts,
  };
};

const resolveElectricBusCapex = (optimizationRun, opts = {}) => {
  const busCostChf = toFiniteNumber(opts?.busModelData?.cost);
  const packCostChf = toFiniteNumber(opts?.busModelData?.battery_pack_cost);
  const infrastructure = resolveInfrastructureInvestment(
    optimizationRun,
    opts
  );
  const infrastructureCapexChf = infrastructure?.includedInCapex
    ? toFiniteNumber(infrastructure?.totalCostChf)
    : null;
  const optimizedPacks = resolveOptimizedPackCount(
    optimizationRun?.results?.battery_results ?? {}
  );
  const totalBatteryChf =
    packCostChf != null && optimizedPacks != null
      ? packCostChf * optimizedPacks
      : null;
  const totalCapexChf =
    busCostChf != null && totalBatteryChf != null
      ? busCostChf + totalBatteryChf + (infrastructureCapexChf ?? 0)
      : null;

  return {
    busCostChf,
    packCostChf,
    optimizedPacks,
    totalBatteryChf,
    infrastructureCapexChf,
    totalCapexChf,
  };
};

const resolveEquivalentDieselBusCapex = (opts = {}) =>
  getEquivalentDieselBusCapexForLength(opts?.busModelData?.bus_length_m);

const resolveBusLifetimeYears = (opts = {}) => {
  const v = toFiniteNumber(opts?.busModelData?.bus_lifetime);
  return v != null && v > 0 ? v : DEFAULT_BUS_LIFETIME_YEARS;
};

const resolveBatteryLifetimeYears = (opts = {}) => {
  const v = toFiniteNumber(opts?.busModelData?.battery_pack_lifetime);
  return v != null && v > 0 ? v : DEFAULT_BATTERY_LIFETIME_YEARS;
};

const resolveDieselBusLifetimeYears = () => DEFAULT_DIESEL_BUS_LIFETIME_YEARS;

const computeEquivalentAnnualCost = (principal, rate, lifetimeYears) => {
  const capex = toFiniteNumber(principal);
  const lifetime = toFiniteNumber(lifetimeYears);
  const annualRate = toFiniteNumber(rate);
  if (capex == null || capex <= 0 || lifetime == null || lifetime <= 0)
    return 0;
  if (annualRate == null || annualRate <= 0) return capex / lifetime;
  const growth = Math.pow(1 + annualRate, lifetime);
  return capex * ((annualRate * growth) / (growth - 1));
};

const computeReplacementYears = (busLifetimeYears, batteryLifetimeYears) => {
  const busLt = toFiniteNumber(busLifetimeYears);
  const batLt = toFiniteNumber(batteryLifetimeYears);
  if (busLt == null || batLt == null || busLt <= 0 || batLt <= 0) return [];
  const count = Math.floor((busLt - 1) / batLt);
  return Array.from({ length: count }, (_, i) => (i + 1) * batLt);
};

const computeRecurringReplacementYears = (lifetimeYears, horizonYears) => {
  const lt = toFiniteNumber(lifetimeYears);
  const hz = toFiniteNumber(horizonYears);
  if (lt == null || lt <= 0 || hz == null || hz <= 0) return [];
  const years = [];
  for (let y = lt; y <= hz; y += lt) years.push(y);
  return years;
};

const computeBatteryReplacementYearsOverHorizon = (
  _busLt,
  batteryLt,
  horizonYears
) => {
  const bl = toFiniteNumber(batteryLt);
  const hz = toFiniteNumber(horizonYears);
  if (bl == null || bl <= 0 || hz == null || hz <= 0) return [];
  return computeRecurringReplacementYears(bl, hz);
};

/* ── Build chart data from API response ───────────────────────── */

const buildEquivalentAnnualCostData = (comparison, opts = {}) => {
  const annualizationRate =
    toFiniteNumber(opts?.annualizationRate) ?? DEFAULT_OPEX_ANNUALIZATION_RATE;
  const electricCapex = resolveElectricBusCapex(opts?.optimizationRun, opts);
  const dieselCapexChf = resolveEquivalentDieselBusCapex(opts) ?? 0;
  const busLifetime = resolveBusLifetimeYears(opts);
  const dieselBusLifetime = resolveDieselBusLifetimeYears();
  const batteryLifetime = resolveBatteryLifetimeYears(opts);
  const batteryReplacementYears = computeReplacementYears(
    busLifetime,
    batteryLifetime
  );
  const batteryReplacementCost =
    toFiniteNumber(electricCapex?.totalBatteryChf) ?? 0;

  const batteryReplacementPv = batteryReplacementYears.reduce((total, year) => {
    if (annualizationRate <= 0) return total + batteryReplacementCost;
    return (
      total + batteryReplacementCost / Math.pow(1 + annualizationRate, year)
    );
  }, 0);
  const electricCapexPv =
    (toFiniteNumber(electricCapex?.busCostChf) ?? 0) +
    (toFiniteNumber(electricCapex?.totalBatteryChf) ?? 0) +
    (toFiniteNumber(electricCapex?.infrastructureCapexChf) ?? 0) +
    batteryReplacementPv;
  const dieselCapexPv = dieselCapexChf;

  const electricCapexAnnual = computeEquivalentAnnualCost(
    electricCapexPv,
    annualizationRate,
    busLifetime
  );
  const dieselCapexAnnual = computeEquivalentAnnualCost(
    dieselCapexPv,
    annualizationRate,
    dieselBusLifetime
  );

  const electricUsage = sumOpexItemsByType(
    comparison?.electric?.opex_items,
    "energy"
  );
  const dieselUsage = sumOpexItemsByType(
    comparison?.diesel?.opex_items,
    "energy"
  );
  const electricMaintenance = sumOpexItemsByType(
    comparison?.electric?.opex_items,
    "maintenance"
  );
  const dieselMaintenance = sumOpexItemsByType(
    comparison?.diesel?.opex_items,
    "maintenance"
  );

  return {
    tco: [
      {
        category: "equivalent_diesel_bus",
        vehicle: dieselCapexAnnual,
        energy: dieselUsage,
        maintenance: dieselMaintenance,
      },
      {
        category: "electric_bus",
        vehicle: electricCapexAnnual,
        energy: electricUsage,
        maintenance: electricMaintenance,
      },
    ],
    annualTotals: {
      diesel: dieselCapexAnnual + dieselUsage + dieselMaintenance,
      electric: electricCapexAnnual + electricUsage + electricMaintenance,
    },
    upfrontCapex: { diesel: dieselCapexChf, electric: electricCapex?.totalCapexChf ?? 0 },
    annualOpex: {
      diesel: dieselUsage + dieselMaintenance,
      electric: electricUsage + electricMaintenance,
    },
    dieselBusLifetime,
    batteryReplacementCost,
  };
};

const buildCostsChartData = (comparison, opts = {}) => {
  if (!comparison) return null;

  const eacData = buildEquivalentAnnualCostData(comparison, opts);
  const horizonYears = PROJECTED_COST_TREND_HORIZON_YEARS;
  const electricAnnualOpex = eacData.annualOpex.electric;
  const dieselAnnualOpex = eacData.annualOpex.diesel;
  const electricBusCapexChf = eacData.upfrontCapex.electric;
  const dieselBusCapexChf = eacData.upfrontCapex.diesel;
  const electricCapexDetails = resolveElectricBusCapex(
    opts?.optimizationRun,
    opts
  );
  const electricBusLifetime = resolveBusLifetimeYears(opts);
  const dieselBusLifetime =
    eacData.dieselBusLifetime ?? resolveDieselBusLifetimeYears();
  const electricBusReplacementYears = computeRecurringReplacementYears(
    electricBusLifetime,
    horizonYears
  );
  const dieselBusReplacementYears = computeRecurringReplacementYears(
    dieselBusLifetime,
    horizonYears
  );
  const batteryReplacementYears = computeBatteryReplacementYearsOverHorizon(
    electricBusLifetime,
    resolveBatteryLifetimeYears(opts),
    horizonYears
  );
  const batteryReplacementCost = eacData.batteryReplacementCost ?? 0;
  const batteryReplacementCostByYear = batteryReplacementYears.reduce(
    (acc, y) => {
      acc[y] = (acc[y] ?? 0) + batteryReplacementCost;
      return acc;
    },
    {}
  );
  const electricVehicleReplacementCost =
    toFiniteNumber(electricCapexDetails?.busCostChf) ?? 0;
  const electricBusReplacementCostByYear = electricBusReplacementYears.reduce(
    (acc, y) => {
      acc[y] = (acc[y] ?? 0) + electricVehicleReplacementCost;
      return acc;
    },
    {}
  );
  const dieselBusReplacementCostByYear = dieselBusReplacementYears.reduce(
    (acc, y) => {
      acc[y] = (acc[y] ?? 0) + (toFiniteNumber(dieselBusCapexChf) ?? 0);
      return acc;
    },
    {}
  );

  const yearly = Array.from({ length: horizonYears }, (_, index) => ({
    year: index + 1,
    diesel:
      dieselBusCapexChf +
      dieselAnnualOpex * (index + 1) +
      d3.sum(
        Array.from({ length: index + 1 }, (_, yi) => {
          const y = yi + 1;
          return dieselBusReplacementCostByYear[y] ?? 0;
        })
      ),
    electric:
      electricBusCapexChf +
      electricAnnualOpex * (index + 1) +
      d3.sum(
        Array.from({ length: index + 1 }, (_, yi) => {
          const y = yi + 1;
          return (
            (electricBusReplacementCostByYear[y] ?? 0) +
            (batteryReplacementCostByYear[y] ?? 0)
          );
        })
      ),
  }));

  if (electricBusCapexChf > 0 || dieselBusCapexChf > 0) {
    yearly.unshift({
      year: 0,
      diesel: dieselBusCapexChf,
      electric: electricBusCapexChf,
    });
  }

  return { tco: eacData.tco, yearly };
};

/* ── Data loading per simulation ──────────────────────────────── */

const selectCostPredictionRun = (predictionRuns = [], batteryResults = {}) => {
  if (!Array.isArray(predictionRuns) || !predictionRuns.length) return null;

  const targetPacks = resolveOptimizedPackCount(batteryResults);
  if (targetPacks != null) {
    const exactMatch = predictionRuns.find(
      (run) =>
        toFiniteNumber(run?.contextual_parameters?.num_battery_packs) ===
        targetPacks
    );
    if (exactMatch) return exactMatch;
  }

  return [...predictionRuns].reduce((best, run) => {
    const bestValue = toFiniteNumber(best?.summary?.consumption_per_km_kwh);
    const candidateValue = toFiniteNumber(run?.summary?.consumption_per_km_kwh);
    if (candidateValue == null) return best;
    if (bestValue == null || candidateValue < bestValue) return run;
    return best;
  }, predictionRuns[0]);
};

const extractYearlyDistanceKm = (payload) => {
  if (payload == null) return null;
  const candidates = [
    payload,
    payload?.yearly_distance_km,
    payload?.yearlyDistanceKm,
    payload?.yearly_distance,
    payload?.annual_distance_km,
    payload?.distance_km,
    payload?.km,
    payload?.value,
    payload?.data?.yearly_distance_km,
    payload?.data?.distance_km,
    payload?.data?.km,
  ];
  return (
    candidates.map((v) => toFiniteNumber(v)).find((v) => v != null) ?? null
  );
};

const resolveChargerPowerKw = (optimizationRun, opts = {}) => {
  const installedChargers = Object.values(
    optimizationRun?.results?.installed_chargers ?? {}
  );
  const inputStations = Array.isArray(
    optimizationRun?.input_params?.charging_stations
  )
    ? optimizationRun.input_params.charging_stations
    : [];

  const candidates = [
    ...installedChargers.flatMap((c) => [
      c?.max_power_per_slot_kw,
      c?.power_per_slot_kw,
      (() => {
        const tp = toFiniteNumber(
          c?.max_total_power_kw ?? c?.total_power_kw ?? c?.max_power_kw
        );
        const s = toFiniteNumber(c?.num_slots ?? c?.slots);
        return tp != null && s != null && s > 0 ? tp / s : null;
      })(),
    ]),
    ...inputStations.flatMap((s) => [
      s?.max_power_per_slot_kw,
      s?.power_per_slot_kw,
    ]),
    opts?.busModelData?.max_charging_power_kw,
  ]
    .map((v) => toFiniteNumber(v))
    .filter((v) => v != null);

  return candidates.length ? d3.max(candidates) : null;
};

const loadSimulationCosts = async (simOptions, economicDefaults = {}) => {
  const rawBmd = simOptions.busModelData ?? {};
  const runId = simOptions.runId;
  const interestRate =
    toFiniteNumber(economicDefaults?.interest_rate) ??
    DEFAULT_OPEX_ANNUALIZATION_RATE;

  /* ── 1. Fetch optimization run (individually guarded) ─────── */
  let optimizationRun = null;
  if (runId) {
    try {
      optimizationRun = await fetchOptimizationRun(runId);
    } catch (err) {
      console.error("[elettra] comparison: fetchOptimizationRun failed:", err);
    }
  }

  /* ── 2. Hydrate bus model (individually guarded) ──────────── */
  let busModelData = { ...rawBmd };
  if (simOptions.busModelId) {
    try {
      const bm = await fetchBusModelById(simOptions.busModelId);
      busModelData = mergeBusModelData(rawBmd, parseBusModelSpecs(bm?.specs), bm);
    } catch (err) {
      console.warn("[elettra] comparison: fetchBusModelById failed:", err);
    }
  }

  /* ── 3. Fetch prediction runs (each one guarded) ──────────── */
  const predRunIds = Array.isArray(optimizationRun?.prediction_run_ids)
    ? optimizationRun.prediction_run_ids
    : [];
  const predictionRuns = [];
  for (const id of predRunIds) {
    try {
      predictionRuns.push(await fetchPredictionRun(id));
    } catch (err) {
      console.warn("[elettra] comparison: fetchPredictionRun failed for", id, err);
    }
  }

  /* ── 4. Resolve parameters from whatever data we got ──────── */
  const batteryResults = optimizationRun?.results?.battery_results ?? {};
  const selectedPredRun = selectCostPredictionRun(predictionRuns, batteryResults);
  const predSummary = selectedPredRun?.summary ?? {};
  const predContext = selectedPredRun?.contextual_parameters ?? {};

  const shiftId = String(
    simOptions.shiftId ??
      optimizationRun?.input_params?.shift_ids?.[0] ??
      ""
  ).trim();

  const busLengthM =
    toFiniteNumber(busModelData?.bus_length_m) ??
    toFiniteNumber(predContext?.bus_length_m);

  const optimizedPacks =
    resolveOptimizedPackCount(batteryResults) ??
    toFiniteNumber(simOptions.numBatteryPacks);
  const packSize = toFiniteNumber(busModelData?.battery_pack_size_kwh);
  const batteryCapacityKwh =
    toFiniteNumber(predContext?.battery_capacity_kwh) ??
    (optimizedPacks != null && packSize != null ? optimizedPacks * packSize : null);

  const chargerPowerKw = resolveChargerPowerKw(optimizationRun, { busModelData });

  const shiftConsumptionKwh = toFiniteNumber(predSummary?.total_consumption_kwh);
  const shiftDistanceKm = toFiniteNumber(predSummary?.total_distance_km);

  let annualizationFactor = COST_ANNUALIZATION_FACTOR;
  if (shiftId && shiftDistanceKm > 0) {
    try {
      const yd = extractYearlyDistanceKm(
        await fetchShiftYearlyDistance(shiftId, { recurrence: "daily" })
      );
      if (yd != null && yd > 0) annualizationFactor = yd / shiftDistanceKm;
    } catch { /* keep default factor */ }
  }

  const annualConsumptionKwh =
    shiftConsumptionKwh != null && shiftConsumptionKwh > 0
      ? shiftConsumptionKwh * annualizationFactor
      : null;

  /* ── 5. Try the economic comparison API ───────────────────── */
  let comparison = null;
  if (shiftId && busLengthM != null) {
    try {
      const batteryPackCost = toFiniteNumber(busModelData?.battery_pack_cost);
      const batteryPackSizeKwh = toFiniteNumber(busModelData?.battery_pack_size_kwh);
      const derivedBatteryCostPerKwh =
        batteryPackCost > 0 && batteryPackSizeKwh > 0
          ? batteryPackCost / batteryPackSizeKwh
          : null;

      comparison = await fetchEconomicComparison({
        shift_id: shiftId,
        recurrence: "weekly_once",
        bus_length_m: busLengthM,
        interest_rate: interestRate,
        lifetime_bus: resolveBusLifetimeYears({ busModelData }),
        lifetime_battery: resolveBatteryLifetimeYears({ busModelData }),
        ...(batteryCapacityKwh != null ? { battery_capacity_kwh: batteryCapacityKwh } : {}),
        ...(chargerPowerKw != null ? { charger_power_kw: chargerPowerKw } : {}),
        ...(annualConsumptionKwh != null ? { annual_consumption_kwh: annualConsumptionKwh } : {}),
        ...(derivedBatteryCostPerKwh != null ? { battery_cost_per_kwh: derivedBatteryCostPerKwh } : {}),
      });
    } catch (err) {
      console.error("[elettra] comparison: fetchEconomicComparison failed:", err);
    }
  }

  /* ── 6. Build chart data — always return something ────────── */
  const opts = { busModelData, optimizationRun, annualizationRate: interestRate };

  if (comparison) {
    const chartData = buildCostsChartData(comparison, opts);
    if (chartData?.tco?.length) {
      return { tco: chartData.tco, yearly: chartData.yearly ?? [], optimizationRun, predictionRuns };
    }
  }

  const electricCapex = resolveElectricBusCapex(optimizationRun, opts);
  const dieselCapexChf = resolveEquivalentDieselBusCapex(opts) ?? 0;
  const busLifetime = resolveBusLifetimeYears(opts);
  const dieselBusLifetime = resolveDieselBusLifetimeYears();

  const electricCapexAnnual = computeEquivalentAnnualCost(
    electricCapex?.totalCapexChf ?? 0, interestRate, busLifetime
  );
  const dieselCapexAnnual = computeEquivalentAnnualCost(
    dieselCapexChf, interestRate, dieselBusLifetime
  );

  const tco = [
    { category: "equivalent_diesel_bus", vehicle: dieselCapexAnnual, energy: 0, maintenance: 0 },
    { category: "electric_bus", vehicle: electricCapexAnnual, energy: 0, maintenance: 0 },
  ];

  const electricUpfront = electricCapex?.totalCapexChf ?? 0;
  const yearly = [
    { year: 0, diesel: dieselCapexChf, electric: electricUpfront },
    ...Array.from({ length: PROJECTED_COST_TREND_HORIZON_YEARS }, (_, i) => ({
      year: i + 1,
      diesel: dieselCapexChf,
      electric: electricUpfront,
    })),
  ];

  return { tco, yearly, optimizationRun, predictionRuns };
};

/* ── SVG helpers ──────────────────────────────────────────────── */

const svgBase = (w, h, ariaLabel) =>
  d3
    .create("svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("role", "img")
    .attr("aria-label", ariaLabel);

const gridLines = (g, scale, innerW, ticks = 5) => {
  g.selectAll(".grid-line")
    .data(scale.ticks(ticks))
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", (d) => scale(d))
    .attr("y2", (d) => scale(d))
    .attr("stroke", "#e5e5e5")
    .attr("stroke-dasharray", "3,3");
};

/* ── Chart renderers ──────────────────────────────────────────── */

const renderStateMessage = (el, message, isError = false) => {
  if (!el) return;
  el.innerHTML = `<p class="costs-state-msg${isError ? " costs-state-msg--error" : ""}">${textContent(message)}</p>`;
};

const renderComparisonCostsBar = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  if (!Array.isArray(data) || data.length === 0) {
    renderStateMessage(
      el,
      t("simulation.costs_empty") || "No cost data available."
    );
    return;
  }
  const margin = { top: 28, right: 24, bottom: 32, left: 72 };
  const W = 620, H = 188;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const stacked = d3.stack().keys(COST_STACK_KEYS)(data);
  const maxVal = d3.max(data, (row) =>
    COST_STACK_KEYS.reduce((sum, key) => sum + (row[key] ?? 0), 0)
  );

  const svg = svgBase(
    W,
    H,
    chartAriaLabel("simulation.chart_aria_tco_stacked", "TCO stacked bar chart")
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.category))
    .range([0, iW])
    .padding(0.35);
  const y = d3
    .scaleLinear()
    .domain([0, maxVal * 1.15])
    .nice()
    .range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickFormat((d) => busCategoryLabel(d)))
    .selectAll("text")
    .attr("font-size", "11px");
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatChfAxis))
    .selectAll("text")
    .attr("font-size", "11px");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -65)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#666")
    .text(t("simulation.axis_cost_chf_per_year") || "CHF / year");

  stacked.forEach((layer) => {
    g.selectAll(`.bar-${layer.key}`)
      .data(layer)
      .join("rect")
      .attr("x", (d) => x(d.data.category))
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth())
      .attr("fill", COST_COLORS[layer.key]);
  });

  data.forEach((d) => {
    const total = COST_STACK_KEYS.reduce((s, k) => s + (d[k] ?? 0), 0);
    g.append("text")
      .attr("x", x(d.category) + x.bandwidth() / 2)
      .attr("y", Math.max(10, y(total) - 6))
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#1c1c1c")
      .text(formatChfLabel(total));
  });

  el.appendChild(svg.node());
};

const renderComparisonCostsLegend = (el) => {
  if (!el) return;
  el.innerHTML = Object.entries(COST_COLORS)
    .map(
      ([key, color]) =>
        `<div class="chart-legend-item">
          <span class="chart-legend-swatch" style="background:${color}"></span>
          ${textContent(costStackLabel(key))}
        </div>`
    )
    .join("");
};

const renderComparisonCostsLine = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  if (!Array.isArray(data) || data.length === 0) {
    renderStateMessage(
      el,
      t("simulation.costs_empty") || "No cost data available."
    );
    return;
  }
  const margin = { top: 16, right: 24, bottom: 32, left: 64 };
  const W = 620, H = 147;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_cost_trend",
      "Projected cumulative cost trend"
    )
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.year))
    .range([0, iW]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => Math.max(d.diesel, d.electric)) * 1.1])
    .nice()
    .range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickValues(data.map((d) => d.year)).tickFormat((d) => `${d}`))
    .selectAll("text")
    .attr("font-size", "10px");
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatChfAxis))
    .selectAll("text")
    .attr("font-size", "10px");
  gridLines(g, y, iW);

  const dieselLine = d3.line().x((d) => x(d.year)).y((d) => y(d.diesel)).curve(d3.curveMonotoneX);
  const elecLine = d3.line().x((d) => x(d.year)).y((d) => y(d.electric)).curve(d3.curveMonotoneX);

  g.append("path").datum(data).attr("d", dieselLine).attr("fill", "none").attr("stroke", FUEL_COLORS.diesel).attr("stroke-width", 2.5);
  g.append("path").datum(data).attr("d", elecLine).attr("fill", "none").attr("stroke", FUEL_COLORS.electric).attr("stroke-width", 2.5);

  g.append("text").attr("x", iW + 4).attr("y", y(data.at(-1).diesel)).attr("font-size", "10px").attr("fill", FUEL_COLORS.diesel).attr("dominant-baseline", "middle").text(fuelLabel("diesel"));
  g.append("text").attr("x", iW + 4).attr("y", y(data.at(-1).electric)).attr("font-size", "10px").attr("fill", FUEL_COLORS.electric).attr("dominant-baseline", "middle").text(fuelLabel("electric"));

  el.appendChild(svg.node());
};

const renderCO2Bar = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 20, bottom: 40, left: 55 };
  const W = 480,
    H = 240;
  const iW = W - margin.left - margin.right,
    iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_co2_bar",
      "CO2 emissions comparison bar chart"
    )
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.category))
    .range([0, iW])
    .padding(0.4);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value) * 1.2])
    .nice()
    .range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickFormat((d) => busCategoryLabel(d)))
    .selectAll("text")
    .attr("font-size", "10px");
  g.append("g")
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat((d) => `${d}`)
    )
    .selectAll("text")
    .attr("font-size", "10px");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -42)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "9px")
    .attr("fill", "#666")
    .text(t("simulation.axis_co2_t_per_year"));

  g.selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("x", (d) => x(d.category))
    .attr("y", (d) => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", (d) => iH - y(d.value))
    .attr("rx", 4)
    .attr("fill", (d) => d.color);

  g.selectAll(".bar-label")
    .data(data)
    .join("text")
    .attr("x", (d) => x(d.category) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.value) - 5)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("font-weight", "600")
    .attr("fill", "#1c1c1c")
    .text((d) => `${d.value} ${t("simulation.unit_tonnes_short")}`);

  el.appendChild(svg.node());
};

const renderCO2Legend = (el, data) => {
  if (!el) return;
  el.innerHTML = data
    .map(
      (d) => `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${d.color}"></span>
      ${textContent(busCategoryLabel(d.category))}
    </div>`
    )
    .join("");
};

const renderCO2Cumulative = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 20, bottom: 40, left: 55 };
  const W = 480,
    H = 220;
  const iW = W - margin.left - margin.right,
    iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_co2_cumulative",
      "Cumulative CO2 savings area chart"
    )
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([1, 15]).range([0, iW]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.saved) * 1.1])
    .nice()
    .range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(15)
        .tickFormat((d) => `${d}`)
    )
    .selectAll("text")
    .attr("font-size", "9px");
  g.append("g")
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat((d) => `${d}`)
    )
    .selectAll("text")
    .attr("font-size", "9px");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -40)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "9px")
    .attr("fill", "#666")
    .text(t("simulation.axis_co2_saved_t"));
  gridLines(g, y, iW);

  const areaGen = d3
    .area()
    .x((d) => x(d.year))
    .y0(iH)
    .y1((d) => y(d.saved))
    .curve(d3.curveMonotoneX);
  const lineGen = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.saved))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(data)
    .attr("d", areaGen)
    .attr("fill", "rgba(171,232,40,0.15)");
  g.append("path")
    .datum(data)
    .attr("d", lineGen)
    .attr("fill", "none")
    .attr("stroke", "#abe828")
    .attr("stroke-width", 2);

  g.selectAll(".dot")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.saved))
    .attr("r", 2.5)
    .attr("fill", "#abe828")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1);

  el.appendChild(svg.node());
};

/* ── Init ──────────────────────────────────────────────────────── */

export const initializeSimulationComparison = (root = document, options = {}) => {
  const section = root.querySelector("section.simulation-comparison-page");
  if (!section) return null;

  const cleanupHandlers = [];
  const renderedTabs = new Set();

  const simA = options.simA ?? {};
  const simB = options.simB ?? {};

  const labelA =
    simA.shiftName || t("simulation.compare_simulation_a") || "Simulation A";
  const labelB =
    simB.shiftName || t("simulation.compare_simulation_b") || "Simulation B";
  const busA = simA.busModelName || "—";
  const busB = simB.busModelName || "—";
  const createdA = simA.createdAt || "—";
  const createdB = simB.createdAt || "—";
  const fullLabelA = `${labelA} — ${busA} — ${createdA}`;
  const fullLabelB = `${labelB} — ${busB} — ${createdB}`;

  const labelElA = section.querySelector('[data-role="label-sim-a"]');
  const labelElB = section.querySelector('[data-role="label-sim-b"]');
  if (labelElA) {
    labelElA.textContent = `${t("simulation.compare_label_prefix_a") || "A"}: ${fullLabelA}`;
  }
  if (labelElB) {
    labelElB.textContent = `${t("simulation.compare_label_prefix_b") || "B"}: ${fullLabelB}`;
  }

  const hasRunIds = Boolean(simA.runId && simB.runId);
  const costDataState = {
    a: { status: hasRunIds ? "loading" : "idle", tco: [], yearly: [], error: null },
    b: { status: hasRunIds ? "loading" : "idle", tco: [], yearly: [], error: null },
  };
  const runDataState = {
    a: { optimizationRun: null, predictionRuns: [] },
    b: { optimizationRun: null, predictionRuns: [] },
  };

  const setTitle = (role, text) => {
    const el = section.querySelector(`[data-role="${role}"]`);
    if (el) el.textContent = text;
  };

  const tcoTitle =
    t("simulation.results_tco_title") || "Annual cost comparison";
  const yearlyTitle =
    t("simulation.results_costs_trend") || "Projected cost trend";
  const co2Title =
    t("simulation.results_co2_title") || "CO₂ emissions comparison";
  const co2CumTitle =
    t("simulation.results_co2_yearly") ||
    "Cumulative CO₂ savings over time";
  setTitle("costs-bar-title-a", `${tcoTitle} — ${fullLabelA}`);
  setTitle("costs-bar-title-b", `${tcoTitle} — ${fullLabelB}`);
  setTitle("costs-line-title-a", `${yearlyTitle} — ${fullLabelA}`);
  setTitle("costs-line-title-b", `${yearlyTitle} — ${fullLabelB}`);

  const efficiencyNotAvailableMsg =
    t("simulation.compare_efficiency_not_available") ||
    "Detailed efficiency comparison is available in the individual simulation results.";

  setTitle("soc-title-a", `${labelA}`);
  setTitle("soc-title-b", `${labelB}`);
  setTitle("energy-title-a", `${labelA}`);
  setTitle("energy-title-b", `${labelB}`);

  setTitle("predictions-title-a", `${t("simulation.tab_predictions") || "Predictions"} — ${fullLabelA}`);
  setTitle("predictions-title-b", `${t("simulation.tab_predictions") || "Predictions"} — ${fullLabelB}`);
  setTitle("co2-bar-title-a", `${co2Title} — ${fullLabelA}`);
  setTitle("co2-bar-title-b", `${co2Title} — ${fullLabelB}`);
  setTitle("co2-cum-title-a", `${co2CumTitle} — ${fullLabelA}`);
  setTitle("co2-cum-title-b", `${co2CumTitle} — ${fullLabelB}`);

  const renderCosts = () => {
    const renderSide = (side, roles) => {
      const sideState = costDataState[side];
      const barEl = section.querySelector(`[data-role="${roles.bar}"]`);
      const legendEl = section.querySelector(`[data-role="${roles.legend}"]`);
      const lineEl = section.querySelector(`[data-role="${roles.line}"]`);

      if (sideState.status === "loading") {
        const msg = t("simulation.costs_loading") || "Loading cost comparison…";
        renderStateMessage(barEl, msg);
        renderStateMessage(lineEl, msg);
        if (legendEl) legendEl.innerHTML = "";
        return;
      }

      if (sideState.status === "error") {
        const msg =
          sideState.error ||
          t("simulation.costs_error") ||
          "Unable to load cost comparison.";
        renderStateMessage(barEl, msg, true);
        renderStateMessage(lineEl, msg, true);
        if (legendEl) legendEl.innerHTML = "";
        return;
      }

      if (sideState.status !== "done") {
        const msg =
          t("simulation.costs_empty") || "No economic comparison data available.";
        renderStateMessage(barEl, msg);
        renderStateMessage(lineEl, msg);
        if (legendEl) legendEl.innerHTML = "";
        return;
      }

      renderComparisonCostsBar(barEl, sideState.tco ?? []);
      renderComparisonCostsLegend(legendEl);
      renderComparisonCostsLine(lineEl, sideState.yearly ?? []);
    };

    renderSide("a", {
      bar: "costs-bar-chart-a",
      legend: "costs-legend-a",
      line: "costs-line-chart-a",
    });
    renderSide("b", {
      bar: "costs-bar-chart-b",
      legend: "costs-legend-b",
      line: "costs-line-chart-b",
    });
  };

  const isSimFeasible = (side) => {
    const run = runDataState[side]?.optimizationRun;
    return run?.results?.electrification_feasible !== false;
  };

  const renderInfeasibleNotice = (el, run) => {
    if (!el) return;
    const summary = run?.results?.electrification_summary;
    const msg = summary?.message ||
      (t("simulation.infeasible_notice") || "The optimization determined that electrification is not feasible for this configuration.");
    el.innerHTML = `
      <div class="infeasibility-tab-notice">
        <div class="infeasibility-tab-notice__icon">⚠</div>
        <h3>${textContent(t("simulation.infeasible_tab_title") || "Electrification not feasible")}</h3>
        <p>${textContent(msg)}</p>
      </div>`;
  };

  const renderEfficiencySide = (suffix) => {
    const side = suffix === "a" ? "a" : "b";
    const run = runDataState[side]?.optimizationRun;
    const socEl = section.querySelector(
      `[data-role="efficiency-soc-chart-${suffix}"]`
    );
    const energyEl = section.querySelector(
      `[data-role="efficiency-energy-chart-${suffix}"]`
    );

    if (!run) {
      const loadingMsg = costDataState[side].status === "loading"
        ? (t("simulation.efficiency_loading") || "Loading efficiency data…")
        : efficiencyNotAvailableMsg;
      renderStateMessage(socEl, loadingMsg);
      renderStateMessage(energyEl, loadingMsg);
      return;
    }

    const results = run.results ?? {};
    const feasible = results.electrification_feasible;
    const summary = results.electrification_summary ?? {};
    const batteryResults = results.battery_results ?? {};
    const batteryEntries = Object.entries(batteryResults);

    let socHtml = "";

    const feasLabel = feasible === true
      ? (t("simulation.feasibility_feasible") || "Feasible")
      : feasible === false
        ? (t("simulation.feasibility_infeasible") || "Infeasible")
        : "—";
    const feasCls = feasible === true ? "efficiency-badge--ok" : feasible === false ? "efficiency-badge--err" : "efficiency-badge--neutral";

    socHtml += `<div class="efficiency-params-grid">
      <div class="efficiency-param">
        <span class="efficiency-param-label">${textContent(t("simulation.opt_solver_status") || "Solver Status")}</span>
        <span class="efficiency-param-value">${textContent(results.solver_status ?? "—")}</span>
      </div>
      <div class="efficiency-param">
        <span class="efficiency-param-label">${textContent(t("simulation.opt_feasibility") || "Electrification Feasibility")}</span>
        <span class="efficiency-param-value"><span class="efficiency-badge ${feasCls}">${textContent(feasLabel)}</span></span>
      </div>
      <div class="efficiency-param">
        <span class="efficiency-param-label">${textContent(t("simulation.opt_solve_time") || "Solve Time (s)")}</span>
        <span class="efficiency-param-value">${textContent(formatFixed(results.solve_time_seconds, 2))}</span>
      </div>
    </div>`;

    if (summary.status === "infeasible" && summary.message) {
      socHtml += `<div class="efficiency-infeasibility-notice">
        <p class="efficiency-infeasibility-msg"><strong>${textContent(
          t("simulation.electrification_infeasible_title") || "Electrification not feasible"
        )}:</strong> ${textContent(summary.message)}</p>
      </div>`;
    }

    if (batteryEntries.length) {
      const uniqueByShift = [];
      const seenShifts = new Set();
      for (const [key, b] of batteryEntries) {
        const shiftKey = b.shift_name ?? key;
        if (seenShifts.has(shiftKey)) continue;
        seenShifts.add(shiftKey);
        uniqueByShift.push(b);
      }
      const rows = uniqueByShift.map((b) => {
        const pf = b.physical_feasible;
        const badge = pf === true ? "efficiency-badge--ok" : pf === false ? "efficiency-badge--err" : "efficiency-badge--neutral";
        return `<tr>
          <td>${textContent(b.shift_name ?? "—")}</td>
          <td class="efficiency-td-num">${textContent(String(b.optimized_packs ?? "—"))}</td>
          <td class="efficiency-td-num">${formatFixed(b.optimized_kwh, 0)}</td>
          <td class="efficiency-td-num">${textContent(String(b.max_physical_packs ?? "—"))}</td>
          <td class="efficiency-td-num">${formatFixed(b.max_physical_kwh, 0)}</td>
          <td><span class="efficiency-badge ${badge}">${textContent(
            pf === true ? (t("simulation.feasibility_feasible") || "Feasible") :
            pf === false ? (t("simulation.feasibility_infeasible") || "Infeasible") : "—"
          )}</span></td>
        </tr>`;
      }).join("");

      socHtml += `
        <div class="efficiency-table-wrap" style="margin-top:0.8rem;">
          <table class="efficiency-table">
            <thead><tr>
              <th class="efficiency-th-text">${textContent(t("simulation.opt_col_shift") || "Shift")}</th>
              <th>${textContent(t("simulation.opt_col_opt_packs") || "Opt. Packs")}</th>
              <th>${textContent(t("simulation.opt_col_opt_kwh") || "Opt. (kWh)")}</th>
              <th>${textContent(t("simulation.opt_col_max_packs") || "Max Physical")}</th>
              <th>${textContent(t("simulation.opt_col_max_kwh") || "Max (kWh)")}</th>
              <th>${textContent(t("simulation.opt_col_feasibility") || "Feasibility")}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    if (socEl) socEl.innerHTML = socHtml;
    if (energyEl) energyEl.innerHTML = "";
  };

  const renderPredictionsSide = (suffix) => {
    const side = suffix === "a" ? "a" : "b";
    const el = section.querySelector(`[data-role="predictions-panel-${suffix}"]`);
    if (!el) return;

    const run = runDataState[side]?.optimizationRun;
    const predRuns = runDataState[side]?.predictionRuns ?? [];

    if (!run || !predRuns.length) {
      const msg = costDataState[side].status === "loading"
        ? (t("simulation.predictions_loading") || "Loading predictions…")
        : (t("simulation.predictions_not_available") || "Prediction data is available in the individual simulation results.");
      el.innerHTML = `<p class="costs-state-msg">${textContent(msg)}</p>`;
      return;
    }

    const summaries = predRuns.map((pred) => {
      const summary = pred?.summary ?? {};
      const ctx = pred?.contextual_parameters ?? {};
      return {
        packs: ctx.num_battery_packs ?? "—",
        totalKwh: formatFixed(summary.total_consumption_kwh, 1),
        distanceKm: formatFixed(summary.total_distance_km, 1),
        perKm: formatFixed(summary.consumption_per_km_kwh, 3),
      };
    });

    const rows = summaries.map((s) => `
      <tr>
        <td class="efficiency-td-num">${textContent(String(s.packs))}</td>
        <td class="efficiency-td-num">${textContent(s.totalKwh)}</td>
        <td class="efficiency-td-num">${textContent(s.distanceKm)}</td>
        <td class="efficiency-td-num">${textContent(s.perKm)}</td>
      </tr>`).join("");

    el.innerHTML = `
      <div class="efficiency-table-wrap">
        <table class="efficiency-table">
          <thead><tr>
            <th>${textContent(t("simulation.efficiency_col_packs") || "# Packs")}</th>
            <th>${textContent(t("simulation.efficiency_col_total_energy") || "Total Energy (kWh)")}</th>
            <th>${textContent(t("simulation.efficiency_col_distance") || "Distance (km)")}</th>
            <th>${textContent(t("simulation.efficiency_col_per_km") || "kWh / km")}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  const TAB_RENDERERS = {
    costs: () => {
      if (!isSimFeasible("a") || !isSimFeasible("b")) {
        const costsPanel = section.querySelector('[data-panel="costs"]');
        if (costsPanel) {
          let html = "";
          if (!isSimFeasible("a")) {
            html += `<div style="margin-bottom:1rem;"><strong>${textContent(fullLabelA)}:</strong></div>`;
            renderInfeasibleNotice(document.createElement("div"), runDataState.a.optimizationRun);
            const tmp = document.createElement("div");
            renderInfeasibleNotice(tmp, runDataState.a.optimizationRun);
            html += tmp.innerHTML;
          }
          if (!isSimFeasible("b")) {
            html += `<div style="margin:1rem 0;"><strong>${textContent(fullLabelB)}:</strong></div>`;
            const tmp = document.createElement("div");
            renderInfeasibleNotice(tmp, runDataState.b.optimizationRun);
            html += tmp.innerHTML;
          }
          if (isSimFeasible("a") && isSimFeasible("b")) {
            renderCosts();
          } else {
            costsPanel.innerHTML = html;
          }
        }
        return;
      }
      renderCosts();
    },
    efficiency: () => {
      renderEfficiencySide("a");
      renderEfficiencySide("b");
    },
    predictions: () => {
      renderPredictionsSide("a");
      renderPredictionsSide("b");
    },
    emissions: () => {
      if (!isSimFeasible("a") || !isSimFeasible("b")) {
        const emissionsPanel = section.querySelector('[data-panel="emissions"]');
        if (emissionsPanel) {
          let html = "";
          if (!isSimFeasible("a")) {
            html += `<div style="margin-bottom:1rem;"><strong>${textContent(fullLabelA)}:</strong></div>`;
            const tmp = document.createElement("div");
            renderInfeasibleNotice(tmp, runDataState.a.optimizationRun);
            html += tmp.innerHTML;
          }
          if (!isSimFeasible("b")) {
            html += `<div style="margin:1rem 0;"><strong>${textContent(fullLabelB)}:</strong></div>`;
            const tmp = document.createElement("div");
            renderInfeasibleNotice(tmp, runDataState.b.optimizationRun);
            html += tmp.innerHTML;
          }
          emissionsPanel.innerHTML = html;
        }
        return;
      }
      renderCO2Bar(
        section.querySelector('[data-role="emissions-bar-chart-a"]'),
        CO2_ANNUAL
      );
      renderCO2Legend(
        section.querySelector('[data-role="emissions-legend-a"]'),
        CO2_ANNUAL
      );
      renderCO2Bar(
        section.querySelector('[data-role="emissions-bar-chart-b"]'),
        CO2_ANNUAL
      );
      renderCO2Legend(
        section.querySelector('[data-role="emissions-legend-b"]'),
        CO2_ANNUAL
      );
      renderCO2Cumulative(
        section.querySelector('[data-role="emissions-line-chart-a"]'),
        CO2_CUM
      );
      renderCO2Cumulative(
        section.querySelector('[data-role="emissions-line-chart-b"]'),
        CO2_CUM
      );
    },
  };

  const activateTab = (tabName) => {
    section.querySelectorAll(".results-tab").forEach((btn) => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    section.querySelectorAll(".tab-panel").forEach((panel) => {
      const active = panel.dataset.panel === tabName;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
    if (!renderedTabs.has(tabName)) {
      renderedTabs.add(tabName);
      TAB_RENDERERS[tabName]?.();
    }
  };

  activateTab("efficiency");

  const handleTabClick = (e) => {
    const btn = e.target.closest(".results-tab");
    if (!btn) return;
    activateTab(btn.dataset.tab);
  };
  const tabList = section.querySelector(".results-tabs");
  if (tabList) {
    tabList.addEventListener("click", handleTabClick);
    cleanupHandlers.push(() =>
      tabList.removeEventListener("click", handleTabClick)
    );
  }

  const handleBack = () => triggerPartialLoad("simulation-runs");
  section.querySelectorAll('[data-action="back"]').forEach((btn) => {
    btn.addEventListener("click", handleBack);
    cleanupHandlers.push(() => btn.removeEventListener("click", handleBack));
  });

  const loadCostData = async () => {
    let economicDefaults = {};
    try {
      economicDefaults = (await fetchEconomicDefaults()) ?? {};
    } catch (err) {
      console.warn("[elettra] comparison: unable to load economic defaults:", err);
    }

    const loadSide = async (simOpts, side) => {
      try {
        const result = await loadSimulationCosts(simOpts, economicDefaults);
        costDataState[side].tco = result.tco;
        costDataState[side].yearly = result.yearly;
        costDataState[side].status = "done";
        if (result.optimizationRun) {
          runDataState[side].optimizationRun = result.optimizationRun;
        }
        if (result.predictionRuns) {
          runDataState[side].predictionRuns = result.predictionRuns;
        }
      } catch (err) {
        costDataState[side].status = "error";
        costDataState[side].error =
          err?.message ||
          t("simulation.costs_error") ||
          "Unable to load cost comparison.";
        console.error(
          `[elettra] comparison: failed to load costs for sim ${side}:`,
          err
        );
      }
    };

    await Promise.all([loadSide(simA, "a"), loadSide(simB, "b")]);

    ["costs", "efficiency", "predictions", "emissions"].forEach((tab) => renderedTabs.delete(tab));
    activateTab(
      section.querySelector(".results-tab.active")?.dataset?.tab ?? "efficiency"
    );
  };

  if (hasRunIds) {
    loadCostData();
  }

  return () => cleanupHandlers.forEach((h) => h());
};
