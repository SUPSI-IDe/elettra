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
  fetchShiftYearlyImpact,
  fetchLcaVehicles,
  fetchVehicleImpact,
} from "../../../api/environmental";
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

const formatChfAxisWithUnit = (value) => `${formatChfAxis(value)} CHF`;

const formatKChfAxis = (value) => String(Math.round(value / 1000));

const formatKChfLabel = (value) => `${Math.round(value / 1000)} kCHF`;

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

const LCA_INDICATORS = [
  { key: "gwp100a", i18n: "simulation.emissions_lca_gwp100a", fallback: "GWP₁₀₀ₐ" },
  { key: "primaryEnergy", i18n: "simulation.emissions_lca_primary_energy", fallback: "Primary energy" },
  { key: "primaryEnergyNonRenewable", i18n: "simulation.emissions_lca_primary_energy_nr", fallback: "Prim. energy (non-ren.)" },
  { key: "pm10", i18n: "simulation.emissions_lca_pm10", fallback: "PM₁₀" },
  { key: "pm25", i18n: "simulation.emissions_lca_pm25", fallback: "PM₂.₅" },
  { key: "nox", i18n: "simulation.emissions_lca_nox", fallback: "NOx" },
  { key: "nmvoc", i18n: "simulation.emissions_lca_nmvoc", fallback: "NMVOC" },
  { key: "ubp21", i18n: "simulation.emissions_lca_ubp21", fallback: "UBP'21" },
];

const LCA_PHASES = [
  { key: "direct", i18n: "simulation.emissions_phase_direct", fallback: "Direct", color: "#e74c3c" },
  { key: "directNonExhaust", i18n: "simulation.emissions_phase_direct_non_exhaust", fallback: "Non-exhaust", color: "#e67e22" },
  { key: "energyChain", i18n: "simulation.emissions_phase_energy_chain", fallback: "Energy chain", color: "#f1c40f" },
  { key: "maintenance", i18n: "simulation.emissions_phase_maintenance", fallback: "Maintenance", color: "#3498db" },
  { key: "vehicle", i18n: "simulation.emissions_phase_vehicle", fallback: "Vehicle mfg.", color: "#9b59b6" },
  { key: "endOfLife", i18n: "simulation.emissions_phase_end_of_life", fallback: "End of life", color: "#7f8c8d" },
  { key: "infrastructure", i18n: "simulation.emissions_phase_infrastructure", fallback: "Infrastructure", color: "#1abc9c" },
];

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

const buildProjectedCostTrendYearlySeries = ({
  horizonYears,
  dieselBusCapexChf,
  dieselAnnualOpex,
  dieselBusReplacementCostByYear,
  electricBusCapexChf,
  electricAnnualOpex,
  electricBusReplacementCostByYear,
  batteryReplacementCostByYear,
}) => {
  const yearly = [];
  let dieselReplacementCarry = 0;
  let electricReplacementCarry = 0;

  if (electricBusCapexChf > 0 || dieselBusCapexChf > 0) {
    yearly.push({
      year: 0,
      diesel: dieselBusCapexChf,
      electric: electricBusCapexChf,
    });
  }

  for (let year = 1; year <= horizonYears; year += 1) {
    const dieselReplacementCost =
      year < horizonYears ? dieselBusReplacementCostByYear[year] ?? 0 : 0;
    const electricReplacementCost =
      year < horizonYears
        ? (electricBusReplacementCostByYear[year] ?? 0) +
          (batteryReplacementCostByYear[year] ?? 0)
        : 0;

    const dieselPreReplacement =
      dieselBusCapexChf + dieselAnnualOpex * year + dieselReplacementCarry;
    const electricPreReplacement =
      electricBusCapexChf + electricAnnualOpex * year + electricReplacementCarry;

    if (dieselReplacementCost > 0 || electricReplacementCost > 0) {
      yearly.push({
        year,
        diesel: dieselPreReplacement,
        electric: electricPreReplacement,
      });
    }

    dieselReplacementCarry += dieselReplacementCost;
    electricReplacementCarry += electricReplacementCost;

    yearly.push({
      year,
      diesel: dieselPreReplacement + dieselReplacementCost,
      electric: electricPreReplacement + electricReplacementCost,
    });
  }

  return yearly;
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

  const yearly = buildProjectedCostTrendYearlySeries({
    horizonYears,
    dieselBusCapexChf,
    dieselAnnualOpex,
    dieselBusReplacementCostByYear,
    electricBusCapexChf,
    electricAnnualOpex,
    electricBusReplacementCostByYear,
    batteryReplacementCostByYear,
  });

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
        recurrence: "daily",
        bus_length_m: busLengthM,
        interest_rate: interestRate,
        lifetime_bus: resolveBusLifetimeYears({ busModelData }),
        lifetime_battery: resolveBatteryLifetimeYears({ busModelData }),
        include_capex: false,
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
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatKChfAxis))
    .selectAll("text")
    .attr("font-size", "11px");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -54)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#666")
    .text(t("simulation.axis_cost_kchf_per_year") || "kCHF / year");

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
      .text(formatKChfLabel(total));
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

const renderComparisonCostsLineLegend = (el) => {
  if (!el) return;
  el.innerHTML = ["diesel", "electric"]
    .map(
      (key) =>
        `<div class="chart-legend-item">
          <span class="chart-legend-swatch" style="background:${FUEL_COLORS[key]}"></span>
          ${textContent(fuelLabel(key))}
        </div>`
    )
    .join("");
};

const findClosestPointOnPath = (pathNode, pointer) => {
  const totalLength = pathNode.getTotalLength();
  if (!Number.isFinite(totalLength) || totalLength <= 0) return null;

  const samples = Math.max(48, Math.ceil(totalLength / 8));
  let bestLength = 0;
  let bestDistanceSq = Infinity;

  for (let index = 0; index <= samples; index += 1) {
    const length = (totalLength * index) / samples;
    const point = pathNode.getPointAtLength(length);
    const distanceSq =
      (point.x - pointer[0]) ** 2 + (point.y - pointer[1]) ** 2;
    if (distanceSq < bestDistanceSq) {
      bestLength = length;
      bestDistanceSq = distanceSq;
    }
  }

  let step = totalLength / samples;
  while (step > 0.5) {
    const beforeLength = Math.max(0, bestLength - step);
    const afterLength = Math.min(totalLength, bestLength + step);
    const beforePoint = pathNode.getPointAtLength(beforeLength);
    const afterPoint = pathNode.getPointAtLength(afterLength);
    const beforeDistanceSq =
      (beforePoint.x - pointer[0]) ** 2 + (beforePoint.y - pointer[1]) ** 2;
    const afterDistanceSq =
      (afterPoint.x - pointer[0]) ** 2 + (afterPoint.y - pointer[1]) ** 2;

    if (beforeDistanceSq < bestDistanceSq) {
      bestLength = beforeLength;
      bestDistanceSq = beforeDistanceSq;
    } else if (afterDistanceSq < bestDistanceSq) {
      bestLength = afterLength;
      bestDistanceSq = afterDistanceSq;
    } else {
      step /= 2;
    }
  }

  return pathNode.getPointAtLength(bestLength);
};

const attachComparisonCostsLineHover = ({
  layer,
  lineData,
  lineGenerator,
  x,
  y,
  innerWidth,
  innerHeight,
  key,
  color,
}) => {
  if (!lineData.length) return;

  layer
    .append("path")
    .datum(lineData)
    .attr("d", lineGenerator)
    .attr("fill", "none")
    .attr("stroke", color)
    .attr("stroke-width", 2.5);

  const hoverPath = layer
    .append("path")
    .datum(lineData)
    .attr("d", lineGenerator)
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 14)
    .style("cursor", "pointer");

  const focus = layer
    .append("g")
    .style("display", "none")
    .attr("pointer-events", "none");

  focus
    .append("circle")
    .attr("r", 4)
    .attr("fill", "#fff")
    .attr("stroke", color)
    .attr("stroke-width", 2);

  const tooltip = focus.append("g");
  const tooltipBg = tooltip
    .append("rect")
    .attr("fill", "#fff")
    .attr("stroke", color)
    .attr("stroke-width", 1)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("opacity", 0.96);
  const tooltipText = tooltip
    .append("text")
    .attr("fill", "#1c1c1c")
    .attr("font-size", "10px");

  const updateHover = (event) => {
    const pointer = d3.pointer(event, layer.node());
    const closestPoint = findClosestPointOnPath(hoverPath.node(), pointer);
    if (!closestPoint) return;

    const yearValue = x.invert(closestPoint.x);
    const costValue = y.invert(closestPoint.y);
    const yearLabel =
      Math.abs(yearValue - Math.round(yearValue)) < 0.05
        ? formatFixed(Math.round(yearValue), 0)
        : formatFixed(yearValue, 1);

    focus.attr(
      "transform",
      `translate(${closestPoint.x},${closestPoint.y})`
    );
    tooltipText.selectAll("*").remove();
    tooltipText
      .append("tspan")
      .attr("x", 8)
      .attr("y", 14)
      .attr("font-weight", "700")
      .text(fuelLabel(key));
    tooltipText
      .append("tspan")
      .attr("x", 8)
      .attr("dy", "1.25em")
      .text(`${t("simulation.general_year") || "Year"} ${yearLabel}`);
    tooltipText
      .append("tspan")
      .attr("x", 8)
      .attr("dy", "1.25em")
      .text(`CHF ${formatCHF(Math.round(costValue))}`);

    const bbox = tooltipText.node().getBBox();
    const tooltipWidth = bbox.width + 16;
    const tooltipHeight = bbox.height + 10;
    let tooltipX = closestPoint.x + 12;
    let tooltipY = closestPoint.y - tooltipHeight - 12;

    if (tooltipX + tooltipWidth > innerWidth) {
      tooltipX = closestPoint.x - tooltipWidth - 12;
    }
    if (tooltipX < 0) {
      tooltipX = Math.max(0, innerWidth - tooltipWidth);
    }
    if (tooltipY < 0) {
      tooltipY = closestPoint.y + 12;
    }
    if (tooltipY + tooltipHeight > innerHeight) {
      tooltipY = Math.max(0, innerHeight - tooltipHeight);
    }

    tooltip.attr(
      "transform",
      `translate(${tooltipX - closestPoint.x},${tooltipY - closestPoint.y})`
    );
    tooltipBg.attr("width", tooltipWidth).attr("height", tooltipHeight);
    focus.style("display", null);
  };

  hoverPath
    .on("pointerenter", updateHover)
    .on("pointermove", updateHover)
    .on("pointerleave", () => {
      focus.style("display", "none");
    });
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
  const margin = { top: 16, right: 24, bottom: 32, left: 84 };
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
  const tickYears = Array.from(new Set(data.map((d) => d.year)));

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
    .call(d3.axisBottom(x).tickValues(tickYears).tickFormat((d) => `${d}`))
    .selectAll("text")
    .attr("font-size", "10px");
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatChfAxisWithUnit))
    .selectAll("text")
    .attr("font-size", "10px");
  gridLines(g, y, iW);

  const dieselLine = d3.line().x((d) => x(d.year)).y((d) => y(d.diesel));
  const elecLine = d3.line().x((d) => x(d.year)).y((d) => y(d.electric));
  const dieselLayer = g.append("g");
  const electricLayer = g.append("g");

  attachComparisonCostsLineHover({
    layer: dieselLayer,
    lineData: data,
    lineGenerator: dieselLine,
    x,
    y,
    innerWidth: iW,
    innerHeight: iH,
    key: "diesel",
    color: FUEL_COLORS.diesel,
  });
  attachComparisonCostsLineHover({
    layer: electricLayer,
    lineData: data,
    lineGenerator: elecLine,
    x,
    y,
    innerWidth: iW,
    innerHeight: iH,
    key: "electric",
    color: FUEL_COLORS.electric,
  });

  el.appendChild(svg.node());
};

const LCA_SIZE_BUCKETS = ["9m", "13m", "18m"];

const inferLcaSize = (busLengthM, busModelName) => {
  const lengthNum = toFiniteNumber(busLengthM);
  if (lengthNum != null) {
    if (lengthNum <= 10) return "9m";
    if (lengthNum <= 15) return "13m";
    return "18m";
  }
  const nameStr = String(busModelName || "").toLowerCase();
  for (const bucket of LCA_SIZE_BUCKETS) {
    if (nameStr.includes(bucket)) return bucket;
  }
  const mMatch = nameStr.match(/(\d{1,2})m/);
  if (mMatch) {
    const n = parseInt(mMatch[1], 10);
    if (n <= 10) return "9m";
    if (n <= 15) return "13m";
    return "18m";
  }
  return null;
};

const ELECTRIC_PT_KEYWORDS = ["bev", "electric", "battery"];
const DIESEL_PT_KEYWORDS = ["icev-d", "diesel", "ice-d"];

const findVehicleByPowertrainAndSize = (vehicles, powertrain, size) => {
  if (!Array.isArray(vehicles) || !size) return null;
  const sizeLower = size.toLowerCase();
  const ptLower = powertrain.toLowerCase();
  const ptKeywords =
    ELECTRIC_PT_KEYWORDS.some((k) => ptLower.includes(k)) ? ELECTRIC_PT_KEYWORDS :
    DIESEL_PT_KEYWORDS.some((k) => ptLower.includes(k)) ? DIESEL_PT_KEYWORDS :
    [ptLower];

  const isBus = (v) => {
    const vt = (v.vehicleType || "").toLowerCase();
    return vt.includes("bus") || vt.includes("coach") || vt === "";
  };
  const ptMatches = (v) => {
    const vPt = (v.powertrain || "").toLowerCase();
    return ptKeywords.some((k) => vPt.includes(k));
  };

  const candidates = vehicles.filter((v) => isBus(v) && ptMatches(v));
  if (!candidates.length) return null;

  const exactMatch = candidates.find(
    (v) => (v.size || "").toLowerCase() === sizeLower
  );
  if (exactMatch) return exactMatch;

  const sizePrefix = sizeLower.replace(/m$/, "").replace(/-.*/, "");
  const prefixMatches = candidates.filter((v) => {
    const vSz = (v.size || "").toLowerCase();
    return vSz.startsWith(sizeLower) || vSz.startsWith(sizePrefix + "m");
  });
  if (!prefixMatches.length) return null;

  const preferCity = prefixMatches.find((v) =>
    (v.size || "").toLowerCase().includes("city") &&
    !(v.size || "").toLowerCase().includes("double")
  );
  return preferCity || prefixMatches[0];
};

const findDieselEquivalent = (vehicles, electricSize) =>
  findVehicleByPowertrainAndSize(vehicles, "icev-d", electricSize) ||
  findVehicleByPowertrainAndSize(vehicles, "diesel", electricSize);

const scaleDieselImpactToYearly = (perUnitImpact, yearlyDistanceKm, passengers) => {
  if (!perUnitImpact || !yearlyDistanceKm || !passengers) return null;
  const factor = yearlyDistanceKm * passengers;
  const yearly = {};
  for (const ind of LCA_INDICATORS) {
    const bd = perUnitImpact[ind.key];
    if (!bd) continue;
    const entry = { unit: "" };
    for (const phase of LCA_PHASES) {
      const val = toFiniteNumber(bd[phase.key]);
      entry[phase.key] = val != null ? val * factor : null;
    }
    let total = 0;
    for (const phase of LCA_PHASES) {
      if (entry[phase.key] != null) total += entry[phase.key];
    }
    entry.total = total;
    yearly[ind.key] = entry;
  }
  return yearly;
};

const loadEmissionsDataForComparison = async (
  shiftId,
  { recurrence = "daily", busLengthM, busModelName } = {}
) => {
  let yearlyImpact = null;
  let electricYearly = null;

  try {
    yearlyImpact = await fetchShiftYearlyImpact(shiftId, { recurrence });
    electricYearly = yearlyImpact.yearly_impact ?? {};
  } catch (primaryErr) {
    const lcaSize = inferLcaSize(busLengthM, busModelName);
    if (!lcaSize) throw primaryErr;
    const allVehicles = await fetchLcaVehicles();
    const electricMatch =
      findVehicleByPowertrainAndSize(allVehicles, "bev", lcaSize);
    if (!electricMatch) throw primaryErr;
    let yDistKm = null;
    try {
      const yd = await fetchShiftYearlyDistance(shiftId, { recurrence });
      yDistKm = yd.yearly_distance_km;
    } catch (_) { throw primaryErr; }
    if (!yDistKm) throw primaryErr;
    const passengers = 1;
    const electricPerUnit = await fetchVehicleImpact(electricMatch.id, { passengers });
    electricYearly = scaleDieselImpactToYearly(electricPerUnit, yDistKm, passengers) ?? {};
    yearlyImpact = {
      shift_id: shiftId, shift_name: "",
      lca_vehicle: {
        lca_vehicle_id: electricMatch.id,
        lca_vehicle_name: electricMatch.name || electricMatch.id,
        lca_size: lcaSize, powertrain: electricMatch.powertrain || "electric",
      },
      bus_model_name: busModelName || "", bus_model_size: lcaSize,
      passengers, recurrence, yearly_distance_km: yDistKm,
      functional_unit: electricMatch.functionalUnit || "pkm",
      yearly_impact: electricYearly,
    };
  }

  let dieselYearly = null;
  let dieselVehicleName = null;
  try {
    const electricSize =
      yearlyImpact?.lca_vehicle?.lca_size ||
      yearlyImpact?.bus_model_size ||
      inferLcaSize(busLengthM, busModelName) || "";
    if (electricSize) {
      const allVehicles = await fetchLcaVehicles();
      const dieselMatch = findDieselEquivalent(allVehicles, electricSize);
      if (dieselMatch) {
        dieselVehicleName = dieselMatch.name || dieselMatch.id;
        const dieselPerUnit = await fetchVehicleImpact(dieselMatch.id, { passengers: yearlyImpact?.passengers ?? 1 });
        dieselYearly = scaleDieselImpactToYearly(
          dieselPerUnit, yearlyImpact?.yearly_distance_km, yearlyImpact?.passengers ?? 1
        );
      }
    }
  } catch (_) { /* best-effort */ }
  return { yearlyImpact, electricYearly, dieselYearly, dieselVehicleName };
};

const EMISSIONS_POLLUTANTS = [
  { key: "gwp100a", i18n: "simulation.emissions_co2_label", fallback: "CO₂ (carbon dioxide)", color: "#c0392b", unitGroup: "ton", divisor: 1e6, perKmUnit: "g/km" },
  { key: "nox", i18n: "simulation.emissions_nox_label", fallback: "NOx (nitric oxide)", color: "#d4a017", unitGroup: "kg", divisor: 1e6, perKmUnit: "mg/km" },
  { key: "pm10", i18n: "simulation.emissions_pm10_label", fallback: "PM₁₀", color: "#8b6914", unitGroup: "kg", divisor: 1e6, perKmUnit: "mg/km" },
];

const renderComparisonHistogram = (el, legendEl, emState) => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";

  if (!emState || emState.status !== "done" || !emState.electricYearly) {
    el.innerHTML = `<p class="emissions-state-msg">${textContent(
      t("simulation.emissions_no_data") || "No environmental impact data available."
    )}</p>`;
    return;
  }

  const electricY = emState.electricYearly;
  const dieselY = emState.dieselYearly;
  const hasDiesel = !!dieselY;

  const data = EMISSIONS_POLLUTANTS
    .filter((p) => electricY[p.key]?.total != null)
    .map((p) => {
      const eTotal = toFiniteNumber(electricY[p.key]?.total) ?? 0;
      const dTotal = hasDiesel ? (toFiniteNumber(dieselY[p.key]?.total) ?? 0) : 0;
      const displayE = eTotal / p.divisor;
      const displayD = dTotal / p.divisor;
      const unitLabel = p.unitGroup === "ton"
        ? (t("simulation.emissions_unit_ton_year") || "ton/year")
        : (t("simulation.emissions_unit_kg_year") || "kg/year");
      return { key: p.key, label: t(p.i18n) || p.fallback, color: p.color, unitGroup: p.unitGroup, unitLabel, electric: displayE, diesel: displayD };
    });

  if (!data.length) return;

  const unitGroups = [...new Set(data.map((d) => d.unitGroup))];
  const groupData = unitGroups.map((ug) => ({
    unitLabel: data.find((d) => d.unitGroup === ug).unitLabel,
    items: data.filter((d) => d.unitGroup === ug),
  }));

  const barHeight = 28;
  const groupGap = 22;
  const barGap = 5;
  const totalBars = data.length;
  const margin = { top: 12, right: 70, bottom: 20, left: 8 };
  const chartHeight = margin.top + margin.bottom + totalBars * barHeight + (totalBars - 1) * barGap + (unitGroups.length - 1) * groupGap;
  const W = 440;

  const allValues = data.flatMap((d) => hasDiesel ? [d.electric, d.diesel] : [d.electric]);
  const maxVal = d3.max(allValues) * 1.2 || 1;
  const iW = W - margin.left - margin.right;
  const x = d3.scaleLinear().domain([0, maxVal]).nice().range([0, iW]);

  const svg = svgBase(W, chartHeight, chartAriaLabel("simulation.chart_aria_emissions_saved", "Emissions saved"));

  let yOffset = margin.top;
  groupData.forEach((group, gi) => {
    if (gi > 0) yOffset += groupGap;
    svg.append("text")
      .attr("x", W - margin.right + 4).attr("y", yOffset + (group.items.length * (barHeight + barGap)) / 2)
      .attr("dy", "0.35em").attr("font-size", "10px").attr("font-weight", "600").attr("fill", "#666")
      .text(group.unitLabel);
    group.items.forEach((item) => {
      const g = svg.append("g").attr("transform", `translate(${margin.left},${yOffset})`);
      if (hasDiesel) {
        g.append("rect").attr("x", 0).attr("y", 0).attr("width", Math.max(0, x(item.diesel)))
          .attr("height", barHeight / 2 - 1).attr("rx", 2).attr("fill", item.color).attr("opacity", 0.35);
        g.append("text").attr("x", Math.max(0, x(item.diesel)) + 3).attr("y", barHeight / 4)
          .attr("dy", "0.35em").attr("font-size", "8px").attr("fill", "#999").text(formatFixed(item.diesel, 1));
      }
      g.append("rect").attr("x", 0).attr("y", hasDiesel ? barHeight / 2 + 1 : 0)
        .attr("width", Math.max(0, x(item.electric))).attr("height", hasDiesel ? barHeight / 2 - 1 : barHeight)
        .attr("rx", 2).attr("fill", item.color).attr("opacity", 0.85);
      g.append("text").attr("x", Math.max(0, x(item.electric)) + 3).attr("y", hasDiesel ? barHeight * 3 / 4 : barHeight / 2)
        .attr("dy", "0.35em").attr("font-size", "8px").attr("fill", "#333").text(formatFixed(item.electric, 1));
      yOffset += barHeight + barGap;
    });
  });

  el.appendChild(svg.node());

  if (legendEl) {
    const items = EMISSIONS_POLLUTANTS
      .filter((p) => data.some((d) => d.key === p.key))
      .map((p) => `<div class="chart-legend-item"><span class="chart-legend-swatch" style="background:${p.color}"></span>${textContent(t(p.i18n) || p.fallback)}</div>`);
    if (hasDiesel) {
      items.push(`<div class="chart-legend-item" style="margin-left:8px"><span class="chart-legend-swatch" style="background:#999;opacity:0.35"></span>${textContent(t("simulation.emissions_toggle_diesel") || "Diesel bus")}</div>`);
      items.push(`<div class="chart-legend-item"><span class="chart-legend-swatch" style="background:#333;opacity:0.85"></span>${textContent(t("simulation.emissions_toggle_electric") || "Electric bus")}</div>`);
    }
    legendEl.innerHTML = items.join("");
  }
};

const renderComparisonRecapTable = (el, emState) => {
  if (!el) return;
  if (!emState || emState.status !== "done" || !emState.electricYearly) {
    el.innerHTML = `<p class="emissions-state-msg">${textContent(
      t("simulation.emissions_no_data") || "No environmental impact data available."
    )}</p>`;
    return;
  }

  const electricY = emState.electricYearly;
  const dieselY = emState.dieselYearly;
  const hasDiesel = !!dieselY;
  const yearlyDistKm = toFiniteNumber(emState?.yearlyImpact?.yearly_distance_km);

  const pollutantLabel = t("simulation.emissions_table_pollutant") || "Pollutant";
  const electricLabel = t("simulation.emissions_toggle_electric") || "Electric bus";
  const dieselLabel = t("simulation.emissions_toggle_diesel") || "Diesel bus";
  const reductionLabel = t("simulation.emissions_reduction_col") || "Reduction";
  const perYearLabel = t("simulation.emissions_kpi_per_year") || "per year";

  const rows = EMISSIONS_POLLUTANTS
    .filter((p) => electricY[p.key]?.total != null)
    .map((p) => {
      const eTotal = toFiniteNumber(electricY[p.key]?.total) ?? 0;
      const dTotal = hasDiesel ? (toFiniteNumber(dieselY[p.key]?.total) ?? 0) : null;
      const displayE = eTotal / p.divisor;
      const displayD = dTotal != null ? dTotal / p.divisor : null;
      const perKmE = yearlyDistKm ? eTotal / yearlyDistKm : null;
      const perKmD = yearlyDistKm && dTotal != null ? dTotal / yearlyDistKm : null;
      const reduction = dTotal != null && dTotal !== 0 ? ((dTotal - eTotal) / Math.abs(dTotal)) * 100 : null;
      const unit = p.unitGroup === "ton" ? (t("simulation.emissions_unit_ton_year") || "ton/year") : (t("simulation.emissions_unit_kg_year") || "kg/year");
      const indicatorWithUnit = `${t(p.i18n) || p.fallback} ${unit} | ${p.perKmUnit}`;
      const reductionStr = reduction != null ? `${reduction > 0 ? "−" : "+"}${formatFixed(Math.abs(reduction), 0)}%` : "—";
      const tone = reduction != null && reduction > 0 ? "positive" : reduction != null && reduction < 0 ? "negative" : "";
      return `<tr>
        <td>${textContent(indicatorWithUnit)}</td>
        <td>${formatFixed(displayE, 0)}</td>
        <td>${perKmE != null ? formatFixed(perKmE, 0) : "—"}</td>
        ${hasDiesel ? `<td>${displayD != null ? formatFixed(displayD, 0) : "—"}</td>` : ""}
        ${hasDiesel ? `<td>${perKmD != null ? formatFixed(perKmD, 0) : "—"}</td>` : ""}
        ${hasDiesel ? `<td class="emissions-recap-reduction${tone ? ` emissions-recap-reduction--${tone}` : ""}">${textContent(reductionStr)}</td>` : ""}
      </tr>`;
    })
    .join("");

  el.innerHTML = `<div class="emissions-recap-table-wrap">
    <table class="emissions-recap-table">
      <thead>
        <tr>
          <th>${textContent(pollutantLabel)}</th>
          <th>${textContent(`${electricLabel} ${perYearLabel}`)}</th>
          <th>${textContent(`${electricLabel} / km`)}</th>
          ${hasDiesel ? `<th>${textContent(`${dieselLabel} ${perYearLabel}`)}</th>` : ""}
          ${hasDiesel ? `<th>${textContent(`${dieselLabel} / km`)}</th>` : ""}
          ${hasDiesel ? `<th>${textContent(reductionLabel)}</th>` : ""}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
};

const COMP_INTENSITY_DEFS = [
  { key: "gwp100a", i18n: "simulation.emissions_co2_label", fallback: "CO₂", unit: "g/km" },
  { key: "nox", i18n: "simulation.emissions_nox_label", fallback: "NOx", unit: "mg/km" },
  { key: "pm10", i18n: "simulation.emissions_pm10_label", fallback: "PM₁₀", unit: "mg/km" },
];

const renderComparisonIntensityKpis = (el, emState) => {
  if (!el) return;
  const yearlyDistKm = toFiniteNumber(emState?.yearlyImpact?.yearly_distance_km);
  if (!emState || emState.status !== "done" || !emState.electricYearly || !yearlyDistKm) {
    el.innerHTML = "";
    return;
  }
  const electricY = emState.electricYearly;
  const dieselY = emState.dieselYearly;
  const hasDiesel = !!dieselY;

  el.innerHTML = COMP_INTENSITY_DEFS
    .filter((p) => electricY[p.key]?.total != null)
    .map((p) => {
      const eRaw = toFiniteNumber(electricY[p.key]?.total) ?? 0;
      const dRaw = hasDiesel ? (toFiniteNumber(dieselY[p.key]?.total) ?? 0) : null;
      const ePerKm = eRaw / yearlyDistKm;
      const dPerKm = dRaw != null ? dRaw / yearlyDistKm : null;
      const reduction = dRaw != null && dRaw !== 0
        ? ((dRaw - eRaw) / Math.abs(dRaw)) * 100 : null;
      const redStr = reduction != null
        ? `${reduction > 0 ? "−" : "+"}${formatFixed(Math.abs(reduction), 0)}%` : "";
      const tone = reduction != null && reduction > 0 ? "positive"
        : reduction != null && reduction < 0 ? "negative" : "";
      return `<div class="emissions-kpi-card">
        <span class="emissions-kpi-label">${textContent(t(p.i18n) || p.fallback)}</span>
        <span class="emissions-kpi-value">${formatFixed(ePerKm, 1)} ${textContent(p.unit)}</span>
        ${hasDiesel && dPerKm != null ? `<span class="emissions-kpi-sub">${textContent(t("simulation.emissions_toggle_diesel") || "Diesel")}: ${formatFixed(dPerKm, 1)} ${textContent(p.unit)}</span>` : ""}
        ${redStr ? `<span class="emissions-kpi-reduction${tone ? ` emissions-kpi-reduction--${tone}` : ""}">${textContent(redStr)}</span>` : ""}
      </div>`;
    }).join("");
};

const COMP_CO2_PHASE_DIVISOR = 1e6;

const renderComparisonCo2Phase = (el, legendEl, emState) => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";
  if (!emState || emState.status !== "done" || !emState.electricYearly) {
    el.innerHTML = `<p class="emissions-state-msg">${textContent(
      t("simulation.emissions_no_data") || "No environmental impact data available."
    )}</p>`;
    return;
  }
  const electricGwp = emState.electricYearly.gwp100a;
  const dieselGwp = emState.dieselYearly?.gwp100a;
  if (!electricGwp) return;

  const buildPhases = (gwp) =>
    LCA_PHASES.map((p) => ({
      key: p.key, label: t(p.i18n) || p.fallback, color: p.color,
      value: Math.max(0, (toFiniteNumber(gwp[p.key]) ?? 0) / COMP_CO2_PHASE_DIVISOR),
    }));

  const bars = [{ label: t("simulation.emissions_toggle_electric") || "Electric", phases: buildPhases(electricGwp) }];
  if (dieselGwp) bars.push({ label: t("simulation.emissions_toggle_diesel") || "Diesel", phases: buildPhases(dieselGwp) });

  const maxTotal = Math.max(...bars.map((b) => b.phases.reduce((s, p) => s + p.value, 0))) * 1.15 || 1;
  const barHeight = 32;
  const barGap = 14;
  const labelWidth = 70;
  const margin = { top: 10, right: 60, bottom: 24, left: labelWidth };
  const W = 440;
  const chartHeight = margin.top + margin.bottom + bars.length * barHeight + (bars.length - 1) * barGap;

  const svg = svgBase(W, chartHeight, chartAriaLabel("simulation.chart_aria_co2_phase", "CO₂ lifecycle phase breakdown"));
  const iW = W - margin.left - margin.right;
  const x = d3.scaleLinear().domain([0, maxTotal]).nice().range([0, iW]);

  bars.forEach((bar, i) => {
    const y = margin.top + i * (barHeight + barGap);
    svg.append("text").attr("x", margin.left - 6).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .attr("font-size", "10px").attr("font-weight", "600").attr("fill", "#333").text(bar.label);
    let xOff = 0;
    const total = bar.phases.reduce((s, p) => s + p.value, 0);
    bar.phases.forEach((phase) => {
      const w = Math.max(0, x(phase.value));
      if (w > 0.5) {
        const pct = total > 0 ? Math.round((phase.value / total) * 100) : 0;
        svg.append("rect").attr("x", margin.left + xOff).attr("y", y)
          .attr("width", w).attr("height", barHeight).attr("fill", phase.color)
          .attr("rx", xOff === 0 ? 2 : 0)
          .style("cursor", "pointer")
          .append("title")
          .text(`${bar.label} · ${phase.label}: ${formatFixed(phase.value, 1)} ${t("simulation.emissions_unit_ton_year") || "ton/year"} (${pct}%)`);
        xOff += w;
      }
    });
    svg.append("text").attr("x", margin.left + xOff + 4).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("font-size", "9px").attr("fill", "#666")
      .text(`${formatFixed(total, 1)} ${t("simulation.emissions_unit_ton_year") || "ton/year"}`);
  });

  const xAxis = d3.axisBottom(x).ticks(4).tickFormat((d) => formatFixed(d, 0));
  svg.append("g").attr("transform", `translate(${margin.left},${chartHeight - margin.bottom})`)
    .call(xAxis).selectAll("text").attr("font-size", "8px");

  el.appendChild(svg.node());

  if (legendEl) {
    legendEl.innerHTML = LCA_PHASES.map((p) =>
      `<div class="chart-legend-item"><span class="chart-legend-swatch" style="background:${p.color}"></span>${textContent(t(p.i18n) || p.fallback)}</div>`
    ).join("");
  }
};

const COMP_ENERGY_COLORS = { renewable: "#27ae60", nonRenewable: "#e67e22" };

const renderComparisonPrimaryEnergy = (el, legendEl, emState) => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";
  if (!emState || emState.status !== "done" || !emState.electricYearly) {
    el.innerHTML = `<p class="emissions-state-msg">${textContent(
      t("simulation.emissions_no_data") || "No environmental impact data available."
    )}</p>`;
    return;
  }

  const ePE = emState.electricYearly.primaryEnergy;
  const ePENR = emState.electricYearly.primaryEnergyNonRenewable;
  const dPE = emState.dieselYearly?.primaryEnergy;
  const dPENR = emState.dieselYearly?.primaryEnergyNonRenewable;

  if (!ePE || !ePENR) {
    el.innerHTML = `<p class="emissions-state-msg">${textContent(
      t("simulation.emissions_no_data") || "No primary energy data available."
    )}</p>`;
    return;
  }

  const eTotal = toFiniteNumber(ePE.total) ?? 0;
  const eNR = toFiniteNumber(ePENR.total) ?? 0;
  const eRen = Math.max(0, eTotal - eNR);
  const dTotal = dPE ? (toFiniteNumber(dPE.total) ?? 0) : null;
  const dNR = dPENR ? (toFiniteNumber(dPENR.total) ?? 0) : null;
  const dRen = dTotal != null && dNR != null ? Math.max(0, dTotal - dNR) : null;

  const peak = Math.max(...[eTotal, dTotal].filter((v) => v != null));
  let unitDiv = 1;
  let unitLabel = "MJ/year";
  if (peak > 1e6) { unitDiv = 1e3; unitLabel = "GJ/year"; }
  const renewableLabel = t("simulation.emissions_energy_renewable") || "Renewable";
  const nonRenewableLabel = t("simulation.emissions_energy_non_renewable") || "Non-renewable";
  const buildEnergySegments = (renewableValue, nonRenewableValue) => ([
    {
      key: "renewable",
      label: renewableLabel,
      color: COMP_ENERGY_COLORS.renewable,
      value: renewableValue / unitDiv,
    },
    {
      key: "nonRenewable",
      label: nonRenewableLabel,
      color: COMP_ENERGY_COLORS.nonRenewable,
      value: Math.max(0, nonRenewableValue) / unitDiv,
    },
  ]);

  const bars = [{
    label: t("simulation.emissions_toggle_electric") || "Electric",
    segments: buildEnergySegments(eRen, eNR),
  }];
  if (dTotal != null) {
    bars.push({
      label: t("simulation.emissions_toggle_diesel") || "Diesel",
      segments: buildEnergySegments(dRen ?? 0, dNR ?? 0),
    });
  }

  const maxBar = Math.max(...bars.map((bar) => bar.segments.reduce((sum, segment) => sum + segment.value, 0))) * 1.15 || 1;
  const barHeight = 32;
  const barGap = 14;
  const labelWidth = 70;
  const margin = { top: 10, right: 70, bottom: 24, left: labelWidth };
  const W = 440;
  const chartHeight = margin.top + margin.bottom + bars.length * barHeight + (bars.length - 1) * barGap;

  const svg = svgBase(W, chartHeight, chartAriaLabel("simulation.chart_aria_primary_energy", "Primary energy consumption"));
  const iW = W - margin.left - margin.right;
  const x = d3.scaleLinear().domain([0, maxBar]).nice().range([0, iW]);

  bars.forEach((bar, i) => {
    const y = margin.top + i * (barHeight + barGap);
    svg.append("text").attr("x", margin.left - 6).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .attr("font-size", "10px").attr("font-weight", "600").attr("fill", "#333").text(bar.label);
    let xOff = 0;
    const total = bar.segments.reduce((sum, segment) => sum + segment.value, 0);
    bar.segments.forEach((segment) => {
      const w = Math.max(0, x(segment.value));
      if (w > 0.5) {
        const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
        svg.append("rect").attr("x", margin.left + xOff).attr("y", y).attr("width", w).attr("height", barHeight)
          .attr("fill", segment.color).attr("rx", xOff === 0 ? 2 : 0)
          .style("cursor", "pointer")
          .append("title")
          .text(`${bar.label} · ${segment.label}: ${formatFixed(segment.value, 1)} ${unitLabel} (${pct}%)`);
        xOff += w;
      }
    });
    svg.append("text").attr("x", margin.left + xOff + 4).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("font-size", "9px").attr("fill", "#666")
      .text(`${formatFixed(total, 0)} ${unitLabel}`);
  });

  const xAxis = d3.axisBottom(x).ticks(4).tickFormat((d) => formatFixed(d, 0));
  svg.append("g").attr("transform", `translate(${margin.left},${chartHeight - margin.bottom})`)
    .call(xAxis).selectAll("text").attr("font-size", "8px");

  el.appendChild(svg.node());

  if (legendEl) {
    legendEl.innerHTML = `
      <div class="chart-legend-item"><span class="chart-legend-swatch" style="background:${COMP_ENERGY_COLORS.renewable}"></span>${textContent(renewableLabel)}</div>
      <div class="chart-legend-item"><span class="chart-legend-swatch" style="background:${COMP_ENERGY_COLORS.nonRenewable}"></span>${textContent(nonRenewableLabel)}</div>`;
  }
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
  const emissionsDataState = {
    a: { status: "idle", yearlyImpact: null, electricYearly: null, dieselYearly: null, dieselVehicleName: null, error: null },
    b: { status: "idle", yearlyImpact: null, electricYearly: null, dieselYearly: null, dieselVehicleName: null, error: null },
  };

  const setTitle = (role, text) => {
    const el = section.querySelector(`[data-role="${role}"]`);
    if (el) el.textContent = text;
  };

  const tcoTitle =
    t("simulation.results_tco_title") || "Annual cost comparison";
  const yearlyTitle =
    t("simulation.results_costs_trend") || "Projected cost trend";
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
  const emissionsHistogramTitle = t("simulation.emissions_saved_title") || "Emissions saved";
  const emissionsRecapTitle = t("simulation.emissions_recap_title") || "Emissions summary";
  const emissionsIntensityTitle = t("simulation.emissions_intensity_title") || "Emissions per km";
  const emissionsCo2PhaseTitle = t("simulation.emissions_co2_phase_title") || "CO₂ lifecycle breakdown";
  const emissionsEnergyTitle = t("simulation.emissions_energy_title") || "Primary energy consumption";
  setTitle("emissions-kpi-title-a", `${emissionsIntensityTitle} — ${fullLabelA}`);
  setTitle("emissions-kpi-title-b", `${emissionsIntensityTitle} — ${fullLabelB}`);
  setTitle("emissions-histogram-title-a", `${emissionsHistogramTitle} — ${fullLabelA}`);
  setTitle("emissions-histogram-title-b", `${emissionsHistogramTitle} — ${fullLabelB}`);
  setTitle("emissions-recap-title-a", `${emissionsRecapTitle} — ${fullLabelA}`);
  setTitle("emissions-recap-title-b", `${emissionsRecapTitle} — ${fullLabelB}`);
  setTitle("emissions-phase-title-a", `${emissionsCo2PhaseTitle} — ${fullLabelA}`);
  setTitle("emissions-phase-title-b", `${emissionsCo2PhaseTitle} — ${fullLabelB}`);
  setTitle("emissions-energy-title-a", `${emissionsEnergyTitle} — ${fullLabelA}`);
  setTitle("emissions-energy-title-b", `${emissionsEnergyTitle} — ${fullLabelB}`);

  const renderCosts = () => {
    const renderSide = (side, roles) => {
      const sideState = costDataState[side];
      const barEl = section.querySelector(`[data-role="${roles.bar}"]`);
      const legendEl = section.querySelector(`[data-role="${roles.legend}"]`);
      const lineEl = section.querySelector(`[data-role="${roles.line}"]`);
      const lineLegendEl = section.querySelector(
        `[data-role="${roles.lineLegend}"]`
      );

      if (sideState.status === "loading") {
        const msg = t("simulation.costs_loading") || "Loading cost comparison…";
        renderStateMessage(barEl, msg);
        renderStateMessage(lineEl, msg);
        if (legendEl) legendEl.innerHTML = "";
        if (lineLegendEl) lineLegendEl.innerHTML = "";
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
        if (lineLegendEl) lineLegendEl.innerHTML = "";
        return;
      }

      if (sideState.status !== "done") {
        const msg =
          t("simulation.costs_empty") || "No economic comparison data available.";
        renderStateMessage(barEl, msg);
        renderStateMessage(lineEl, msg);
        if (legendEl) legendEl.innerHTML = "";
        if (lineLegendEl) lineLegendEl.innerHTML = "";
        return;
      }

      renderComparisonCostsBar(barEl, sideState.tco ?? []);
      renderComparisonCostsLegend(legendEl);
      renderComparisonCostsLine(lineEl, sideState.yearly ?? []);
      renderComparisonCostsLineLegend(lineLegendEl);
    };

    renderSide("a", {
      bar: "costs-bar-chart-a",
      legend: "costs-legend-a",
      line: "costs-line-chart-a",
      lineLegend: "costs-line-legend-a",
    });
    renderSide("b", {
      bar: "costs-bar-chart-b",
      legend: "costs-legend-b",
      line: "costs-line-chart-b",
      lineLegend: "costs-line-legend-b",
    });
  };

  const isSimFeasible = (side) => {
    const run = runDataState[side]?.optimizationRun;
    return run?.results?.electrification_feasible !== false;
  };

  const renderInfeasibleNotice = (el, run) => {
    if (!el) return;
    const msg =
      t("simulation.infeasible_notice") ||
      "The optimization determined that electrification is not feasible for this configuration.";
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
              <th>${textContent(t("simulation.opt_col_opt_packs") || "Optimized Packs")}</th>
              <th>${textContent(t("simulation.opt_col_opt_kwh") || "Optimized (kWh)")}</th>
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
      const renderEmSide = (side, suffix) => {
        const st = emissionsDataState[side];
        const histEl = section.querySelector(`[data-role="emissions-histogram-${suffix}"]`);
        const histLeg = section.querySelector(`[data-role="emissions-histogram-legend-${suffix}"]`);
        const recapEl = section.querySelector(`[data-role="emissions-recap-table-${suffix}"]`);
        const kpiEl = section.querySelector(`[data-role="emissions-intensity-kpis-${suffix}"]`);
        const phaseEl = section.querySelector(`[data-role="emissions-co2-phase-${suffix}"]`);
        const phaseLeg = section.querySelector(`[data-role="emissions-co2-phase-legend-${suffix}"]`);
        const energyEl = section.querySelector(`[data-role="emissions-primary-energy-${suffix}"]`);
        const energyLeg = section.querySelector(`[data-role="emissions-primary-energy-legend-${suffix}"]`);

        if (st.status === "loading") {
          const msg = t("simulation.emissions_loading") || "Loading environmental impact data…";
          renderStateMessage(histEl, msg);
          [recapEl, kpiEl, phaseEl, energyEl].forEach((e) => { if (e) e.innerHTML = ""; });
          return;
        }
        if (st.status === "error") {
          const msg = st.error || t("simulation.emissions_error") || "Unable to load environmental impact data.";
          renderStateMessage(histEl, msg, true);
          [recapEl, kpiEl, phaseEl, energyEl].forEach((e) => { if (e) e.innerHTML = ""; });
          return;
        }
        renderComparisonIntensityKpis(kpiEl, st);
        renderComparisonHistogram(histEl, histLeg, st);
        renderComparisonRecapTable(recapEl, st);
        renderComparisonCo2Phase(phaseEl, phaseLeg, st);
        renderComparisonPrimaryEnergy(energyEl, energyLeg, st);
      };
      renderEmSide("a", "a");
      renderEmSide("b", "b");
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

    const loadEmissionsSide = async (simOpts, side) => {
      if (!isSimFeasible(side) || !simOpts.shiftId) return;
      emissionsDataState[side].status = "loading";
      try {
        const emData = await loadEmissionsDataForComparison(simOpts.shiftId, {
          busModelName: simOpts.busModelName,
        });
        emissionsDataState[side].yearlyImpact = emData.yearlyImpact;
        emissionsDataState[side].electricYearly = emData.electricYearly;
        emissionsDataState[side].dieselYearly = emData.dieselYearly;
        emissionsDataState[side].dieselVehicleName = emData.dieselVehicleName;
        emissionsDataState[side].status = "done";
      } catch (err) {
        emissionsDataState[side].status = "error";
        emissionsDataState[side].error =
          err?.message || t("simulation.emissions_error") || "Unable to load environmental impact data.";
      }
    };

    await Promise.all([loadEmissionsSide(simA, "a"), loadEmissionsSide(simB, "b")]);
    renderedTabs.delete("emissions");
    if (section.querySelector('.results-tab.active')?.dataset?.tab === "emissions") {
      TAB_RENDERERS.emissions?.();
    }
  };

  if (hasRunIds) {
    loadCostData();
  }

  return () => cleanupHandlers.forEach((h) => h());
};
