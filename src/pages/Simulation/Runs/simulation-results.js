import * as d3 from "d3";
import { t } from "../../../i18n";
import { triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";
import {
  fetchEconomicComparison,
  fetchEconomicDefaults,
  fetchOptimizationRun,
  fetchPredictionRunPredictions,
  resolvePredictionRuns,
} from "../../../api/simulation";
import { fetchBusModelById } from "../../../api/bus-models";
import {
  fetchShiftById,
  fetchShiftInfo,
  fetchShiftYearlyDistance,
  screenShiftIds,
} from "../../../api/shifts";
import { fetchStopsByTripId } from "../../../api/gtfs";
import {
  fetchShiftYearlyImpact,
  fetchLcaVehicles,
  fetchVehicleImpact,
} from "../../../api/environmental";
import { resolveShiftDailyDistanceKm } from "../../../utils/shift-distance";
import {
  CHART_PLOT_HEIGHT,
  CHART_FONT_TICK,
  CHART_FONT_LABEL,
  CHART_FONT_EMPHASIS,
  CHART_FONT_TOOLTIP,
  chartCanvasWidth,
  horizontalBandGeometry,
} from "../../../utils/chart-frame";
import {
  CHART_LCA_PHASE_COLORS,
  CHART_VEHICLE_BAR_COLORS,
} from "../../../utils/chart-palette";
import {
  DEFAULT_OPEX_ANNUALIZATION_RATE,
  DEFAULT_BUS_LIFETIME_YEARS,
  DEFAULT_DIESEL_BUS_LIFETIME_YEARS,
  DEFAULT_BATTERY_LIFETIME_YEARS,
  getEquivalentDieselBusCapexForLength,
  getDieselEfficiencyForLength,
  getDieselMaintenanceCostForLength,
  getElectricMaintenanceCostForLength,
  getBusParameterDefaults,
  rescaleLinearModelFromAnchor,
  DIESEL_CONSUMPTION_BASE,
  DIESEL_MAINT_BASE,
  ELECTRIC_MAINT_BASE,
} from "../../../config/economic-defaults";
import {
  buildDiscountedProjectedCostTrend as buildProjectedCostTrendYearlySeries,
  computeEquivalentAnnualCost,
  computeScheduleResidualValue,
} from "../../../utils/economic-costs";
import { getOptimizationRunName } from "../../../utils/optimization-run";
import "./simulation-results.css";

/* ── Fake simulation-data fields ──────────────────────────────── */

const FAKE_GENERAL_INFO = {
  name: "—",
  optimization_id: "—",
  creation_date: "—",
  simulation_type: "—",
  day: "—",
  lines: "—",
  shift_name: "—",
};

const FAKE_BUS_INFO = {
  bus_name: "—",
  cost_chf: "—",
  bus_length_m: "—",
  max_passengers: "—",
  bus_lifetime_years: "—",
  single_pack_battery_cost_chf: "—",
  battery_pack_lifetime_years: "—",
};

const generalLabels = () => ({
  name: t("simulation.field_name") || "Name",
  optimization_id: t("simulation.general_optimization_id") || "Optimization ID",
  creation_date: t("simulation.general_creation_date") || "Creation date",
  simulation_type: t("simulation.general_simulation_type") || "Simulation type",
  day: t("simulation.general_day") || "Day",
  lines: t("simulation.general_lines") || "Lines",
  shift_name: t("simulation.general_shift_name") || "Shift name",
  min_soc: t("simulation.efficiency_min_soc") || "Min SoC",
  max_soc: t("simulation.efficiency_max_soc") || "Max SoC",
  external_temp_celsius:
    t("simulation.general_external_temp") || "External temperature",
  occupancy_percent:
    t("simulation.general_occupancy") || "Avg. passenger occupancy",
  heating_type: t("simulation.general_heating_type") || "Auxiliary heating type",
  battery_packs:
    t("simulation.general_battery_packs") || "Number of battery packs",
});
const busLabels = () => ({
  bus_name: t("simulation.bus_name") || "Bus name",
  cost_chf: t("simulation.bus_cost") || "Cost (CHF)",
  bus_length_m: t("simulation.bus_length_m_label") || "Bus length (m)",
  max_passengers:
    t("simulation.bus_max_passengers") || "Maximum number of passengers",
  bus_lifetime_years:
    t("simulation.bus_lifetime_years") || "Bus lifetime (years)",
  single_pack_battery_cost_chf:
    t("simulation.bus_single_pack_battery_cost") ||
    "Single pack battery cost (CHF)",
  battery_pack_lifetime_years:
    t("simulation.bus_battery_pack_lifetime_years") ||
    "Battery pack lifetime (years)",
});
/* ── Chart data helpers ───────────────────────────────────────── */

const COST_STACK_KEYS = ["vehicle", "energy", "maintenance"];
const FUEL_COLORS = {
  diesel: "var(--color-danger)",
  electric: "#2e7d32",
};
const COST_COLORS = { vehicle: "#4f86c6", energy: "#d4881f", maintenance: "#5f8f2f" };
const COST_ANNUALIZATION_FACTOR = 52;
const MOBITOOL_URL = "https://www.i14y.admin.ch/en/catalog/dataservices/171b09a4-5b5f-4577-8921-3af7fc6eee39/description";
const MOBITOOL_LINK_HTML = `<a href="${MOBITOOL_URL}" target="_blank" rel="noopener noreferrer">Mobitool</a>`;
const linkifyMobitoolHtml = (value) =>
  (value === null || value === undefined ? "" : String(value)).replace(/Mobitool/g, MOBITOOL_LINK_HTML);
const linkifyMobitoolElement = (el) => {
  if (!el || el.querySelector(`a[href="${MOBITOOL_URL}"]`)) return;
  const currentHtml = el.innerHTML;
  if (!currentHtml || !currentHtml.includes("Mobitool")) return;
  el.innerHTML = linkifyMobitoolHtml(currentHtml);
};


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
  { key: "direct", i18n: "simulation.emissions_phase_direct", fallback: "Direct", color: CHART_LCA_PHASE_COLORS.direct },
  { key: "directNonExhaust", i18n: "simulation.emissions_phase_direct_non_exhaust", fallback: "Non-exhaust", color: CHART_LCA_PHASE_COLORS.directNonExhaust },
  { key: "energyChain", i18n: "simulation.emissions_phase_energy_chain", fallback: "Energy chain", color: CHART_LCA_PHASE_COLORS.energyChain },
  { key: "maintenance", i18n: "simulation.emissions_phase_maintenance", fallback: "Maintenance", color: CHART_LCA_PHASE_COLORS.maintenance },
  { key: "vehicle", i18n: "simulation.emissions_phase_vehicle", fallback: "Vehicle mfg.", color: CHART_LCA_PHASE_COLORS.vehicle },
  { key: "endOfLife", i18n: "simulation.emissions_phase_end_of_life", fallback: "End of life", color: CHART_LCA_PHASE_COLORS.endOfLife },
  { key: "infrastructure", i18n: "simulation.emissions_phase_infrastructure", fallback: "Infrastructure", color: CHART_LCA_PHASE_COLORS.infrastructure },
];

const emissionsStateHtml = (message, tone = "default") =>
  `<p class="emissions-state-msg${tone === "error" ? " emissions-state-msg--error" : ""}">${textContent(message)}</p>`;

const lcaIndicatorLabel = (key) => {
  const def = LCA_INDICATORS.find((d) => d.key === key);
  return def ? (t(def.i18n) || def.fallback) : key;
};
const lcaPhaseLabel = (key) => {
  const def = LCA_PHASES.find((d) => d.key === key);
  return def ? (t(def.i18n) || def.fallback) : key;
};

const DEFAULT_INFRASTRUCTURE_SLOT_COST_CHF = 150000;
const DEFAULT_FUEL_COST_PER_L = 1.85;
const DEFAULT_ENERGY_PRICE_SLIDER_VALUE = 0.2;
const MIN_INTEREST_RATE = 0.02;
const MAX_INTEREST_RATE = 0.1;
const DEFAULT_INTEREST_RATE_SLIDER_VALUE = DEFAULT_OPEX_ANNUALIZATION_RATE;
const PROJECTED_COST_TREND_HORIZON_YEARS = 20;
const COST_VARIABLE_REFRESH_DEBOUNCE_MS = 450;

/* ── Shared helpers ───────────────────────────────────────────── */

const formatCHF = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("de-CH");
};

const firstText = (...values) => {
  for (const value of values) {
    const candidate = value === null || value === undefined ? "" : String(value).trim();
    if (candidate) {
      return candidate;
    }
  }
  return "";
};

const resolveSimulationName = (optimizationRun = {}, options = {}) =>
  getOptimizationRunName(optimizationRun, options?.simulationName);

const resolveOptimizationId = (optimizationRun = {}, options = {}) =>
  firstText(
    optimizationRun?.id,
    optimizationRun?.optimization_run_id,
    optimizationRun?.optimizationRunId,
    optimizationRun?.run_id,
    options?.optimizationId,
    options?.runId
  );

const WEEKDAY_LABELS = {
  monday: "simulation.day_monday",
  tuesday: "simulation.day_tuesday",
  wednesday: "simulation.day_wednesday",
  thursday: "simulation.day_thursday",
  friday: "simulation.day_friday",
  saturday: "simulation.day_saturday",
  sunday: "simulation.day_sunday",
};

const formatWeekdayLabel = (value) => {
  const raw = firstText(value);
  if (!raw) {
    return "—";
  }
  const normalized = raw.toLowerCase();
  return (WEEKDAY_LABELS[normalized] && t(WEEKDAY_LABELS[normalized])) ??
    `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
};

const resolveShiftLineLabel = (shift = {}) => {
  const firstItem = Array.isArray(shift?.structure) ? shift.structure[0] ?? {} : {};
  const firstTrip = firstItem?.trip ?? firstItem;
  return (
    firstText(
      shift?.route_short_name,
      shift?.route_long_name,
      shift?.route_label,
      shift?.route?.route_short_name,
      shift?.route?.route_long_name,
      shift?.route?.name,
      shift?.route_name,
      shift?.routeName,
      firstTrip?.route_short_name,
      firstTrip?.route_long_name,
      firstTrip?.route_label,
      firstTrip?.route?.route_short_name,
      firstTrip?.route?.route_long_name,
      firstTrip?.route?.name
    ) || "—"
  );
};

const resolveShiftWeekday = (shift = {}) => {
  const daysOfWeek = shift?.days_of_week ?? shift?.daysOfWeek;
  const firstItem = Array.isArray(shift?.structure) ? shift.structure[0] ?? {} : {};
  const firstTrip = firstItem?.trip ?? firstItem;
  const rawDay = Array.isArray(daysOfWeek) && daysOfWeek.length
    ? daysOfWeek[0]
    : firstText(
        shift?.day_of_week,
        shift?.dayOfWeek,
        shift?.service_day,
        shift?.serviceDay,
        firstTrip?.day_of_week,
        firstTrip?.dayOfWeek,
        firstTrip?.service_day,
        firstTrip?.serviceDay
      );
  return formatWeekdayLabel(rawDay);
};

const resolveShiftDisplayName = (shift = {}, fallback = "") =>
  firstText(shift?.name, shift?.shift_name, shift?.shiftName, fallback) || "—";

const resolveStopName = (...candidates) =>
  firstText(
    ...candidates.flatMap((candidate) => [
      candidate && typeof candidate !== "object" ? candidate : null,
      candidate?.stop_name,
      candidate?.stopName,
      candidate?.name,
      candidate?.label,
    ])
  ).trim();

const buildTripStopLookup = (shift = {}) => {
  const lookup = new Map();
  const structure = Array.isArray(shift?.structure) ? shift.structure : [];

  structure.forEach((item = {}) => {
    const trip = item?.trip ?? item;
    const startStop = resolveStopName(
      trip?.start_stop_name,
      trip?.startStopName,
      trip?.start_stop,
      trip?.startStop,
      item?.start_stop_name,
      item?.startStopName,
      item?.start_stop,
      item?.startStop
    );
    const endStop = resolveStopName(
      trip?.end_stop_name,
      trip?.endStopName,
      trip?.end_stop,
      trip?.endStop,
      item?.end_stop_name,
      item?.endStopName,
      item?.end_stop,
      item?.endStop
    );

    if (!startStop && !endStop) return;

    [
      item?.trip_id,
      item?.tripId,
      trip?.id,
      trip?.trip_id,
      trip?.tripId,
    ]
      .map((id) => firstText(id).trim())
      .filter(Boolean)
      .forEach((id) => lookup.set(id, { startStop, endStop }));
  });

  return lookup;
};

const missingShiftPresentation = (fallbackName = "") => ({
  shiftName: resolveShiftDisplayName(null, fallbackName),
  lineLabel: "—",
  weekdayLabel: "—",
  tripStopLookup: new Map(),
});

const resolveShiftPresentation = async (shiftId, fallbackName = "") => {
  if (!shiftId) {
    return { shiftName: fallbackName || "—", lineLabel: "—", weekdayLabel: "—" };
  }

  // Free once a caller has primed the screen with the whole id list: a shift
  // already proven gone costs nothing here instead of a failed `/info` and a
  // failed detail fallback. Before any sweep the id comes back a candidate, so
  // the single-shift paths behave exactly as they did.
  const { missing } = await screenShiftIds([shiftId]);
  if (missing.length) {
    return missingShiftPresentation(fallbackName);
  }

  let shift = null;
  try {
    shift = await fetchShiftInfo(shiftId);
  } catch (error) {
    console.warn("[elettra] Unable to load shift info for OPEX inputs:", error);
    try {
      shift = await fetchShiftById(shiftId);
    } catch (fallbackError) {
      console.warn("[elettra] Unable to load shift details for OPEX inputs:", fallbackError);
    }
  }

  if (shift && !Array.isArray(shift?.structure)) {
    try {
      shift = { ...shift, ...(await fetchShiftById(shiftId)) };
    } catch (detailError) {
      console.warn("[elettra] Unable to load shift details for trip stops:", detailError);
    }
  }

  return {
    shiftName: resolveShiftDisplayName(shift, fallbackName),
    lineLabel: resolveShiftLineLabel(shift),
    weekdayLabel: resolveShiftWeekday(shift),
    tripStopLookup: buildTripStopLookup(shift),
  };
};

const resolveShiftSummary = async (shiftIds = []) => {
  const ids = [...new Set((Array.isArray(shiftIds) ? shiftIds : []).map((id) => firstText(id)).filter(Boolean))];
  if (!ids.length) {
    return { lines: "—", days: "—" };
  }

  // Prime the screen with the whole list, so the presentations below can skip
  // the ids that no longer exist without a request each.
  await screenShiftIds(ids);
  const presentations = await Promise.all(ids.map((shiftId) => resolveShiftPresentation(shiftId)));
  const lines = [...new Set(presentations.map((item) => item?.lineLabel).filter((value) => value && value !== "—"))];
  const days = [...new Set(presentations.map((item) => item?.weekdayLabel).filter((value) => value && value !== "—"))];

  return {
    lines: lines.join(", ") || "—",
    days: days.join(", ") || "—",
  };
};

const resolveShiftTabs = async (
  shiftIds = [],
  { fallbackShiftId = "", fallbackShiftName = "" } = {}
) => {
  const ids = [
    ...new Set(
      (Array.isArray(shiftIds) ? shiftIds : [])
        .map((id) => firstText(id))
        .filter(Boolean)
    ),
  ];

  if (!ids.length && fallbackShiftId) {
    return [
      {
        id: fallbackShiftId,
        shiftName: fallbackShiftName || fallbackShiftId,
        lineLabel: "—",
        weekdayLabel: "—",
        tripStopLookup: new Map(),
      },
    ];
  }

  // Prime the screen with the whole list, so the presentations below can skip
  // the ids that no longer exist without a request each.
  await screenShiftIds(ids);
  const presentations = await Promise.all(
    ids.map((shiftId, index) =>
      resolveShiftPresentation(
        shiftId,
        index === 0 ? fallbackShiftName : ""
      )
    )
  );

  return ids.map((id, index) => ({
    id,
    shiftName: presentations[index]?.shiftName || fallbackShiftName || id,
    lineLabel: presentations[index]?.lineLabel || "—",
    weekdayLabel: presentations[index]?.weekdayLabel || "—",
    tripStopLookup: presentations[index]?.tripStopLookup ?? new Map(),
  }));
};

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
    vehicle: t("simulation.cost_stack_capex") || "CAPEX",
    energy: t("simulation.cost_stack_opex_usage") || "OPEX usage",
    maintenance: t("simulation.cost_stack_opex_maintenance") || "OPEX maintenance",
  })[key] ?? key;

const costKpiLabel = (key) =>
  ({
    electric_total: t("simulation.costs_kpi_electric_total") || "Electric annual cost",
    diesel_total: t("simulation.costs_kpi_diesel_total") || "Diesel annual cost",
    annual_saving: t("simulation.costs_kpi_annual_saving") || "Annual saving",
    annual_km: t("simulation.costs_kpi_annual_km") || "Annual distance",
  })[key] ?? key;

const economicInputLabel = (key) =>
  ({
    shift_id: t("simulation.costs_input_shift") || "shift",
    bus_length_m:
      t("simulation.costs_input_bus_length_short") || "bus length",
    battery_capacity_kwh:
      t("simulation.costs_input_battery_capacity_short") ||
      "battery capacity",
    charger_power_kw:
      t("simulation.costs_input_charger_power_short") || "charger power",
    annual_consumption_kwh:
      t("simulation.costs_input_annual_consumption_short") ||
      "annual consumption",
  })[key] ?? key;

const chartAriaLabel = (key, fallback) => t(key) || fallback;
const translateOr = (key, fallback, params = {}) => {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
};

const quantileHelpText = () =>
  translateOr(
    "simulation.quantile_help",
    "Q50 is the median prediction. Q05 is a low-demand estimate and Q95 is a high-demand estimate. Q05-Q95 shows the central prediction spread across simulations; wider intervals indicate higher uncertainty."
  );

const normalizeFuelCostPerL = (value) =>
  toFiniteNumber(value) != null && Number(value) > 0
    ? Number(value)
    : null;

const normalizeEnergyPricePerKwh = (value) =>
  toFiniteNumber(value) != null && Number(value) > 0
    ? Number(value)
    : null;

const normalizeInterestRate = (value) =>
  toFiniteNumber(value) != null &&
  Number(value) >= MIN_INTEREST_RATE &&
  Number(value) <= MAX_INTEREST_RATE
    ? Number(value)
    : null;

const resolveFuelCostPerL = (options = {}) =>
  normalizeFuelCostPerL(options?.costOverrides?.fuelCostPerL) ??
  normalizeFuelCostPerL(
    options?.economicDefaults?.fuelCostPerL ??
    options?.economicDefaults?.fuel_cost_per_l
  ) ??
  DEFAULT_FUEL_COST_PER_L;

const resolveEnergyPricePerKwh = (options = {}) =>
  normalizeEnergyPricePerKwh(options?.costOverrides?.energyPricePerKwh) ??
  normalizeEnergyPricePerKwh(
    options?.economicDefaults?.energyPricePerKwh ??
    options?.economicDefaults?.energy_price_per_kwh
  ) ??
  DEFAULT_ENERGY_PRICE_SLIDER_VALUE;

const resolveInterestRate = (options = {}) =>
  normalizeInterestRate(options?.costOverrides?.interestRate) ??
  normalizeInterestRate(
    options?.economicDefaults?.interestRate ??
    options?.economicDefaults?.interest_rate
  ) ??
  DEFAULT_INTEREST_RATE_SLIDER_VALUE;

const setRangeProgress = (input, value) => {
  if (!input) return;
  const min = Number(input.min);
  const max = Number(input.max);
  const numeric = Number(value);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(numeric)) {
    input.style.setProperty("--slider-progress", "0%");
    return;
  }
  const progress = ((numeric - min) / (max - min)) * 100;
  input.style.setProperty("--slider-progress", `${Math.min(100, Math.max(0, progress))}%`);
};

const applySliderRange = (input, range) => {
  if (!input || !range) return;
  input.min = String(range.min);
  input.max = String(range.max);
  const scaleEl = input
    .closest(".results-cost-variables__field")
    ?.querySelector(".results-cost-variables__range-scale");
  if (scaleEl) {
    const spans = scaleEl.querySelectorAll("span");
    if (spans[0]) spans[0].textContent = String(range.min);
    if (spans[1]) spans[1].textContent = String(range.max);
  }
};

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

const hasValue = (value) => value !== null && value !== undefined && value !== "";

const mergeBusModelData = (current = {}, specs = {}, busModel = {}) => ({
  ...current,
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
  empty_weight_kg: hasValue(current?.empty_weight_kg)
    ? current.empty_weight_kg
    : (specs?.empty_weight_kg ?? ""),
  min_battery_packs: hasValue(current?.min_battery_packs)
    ? current.min_battery_packs
    : (specs?.min_battery_packs ?? ""),
  max_battery_packs: hasValue(current?.max_battery_packs)
    ? current.max_battery_packs
    : (specs?.max_battery_packs ?? ""),
  battery_pack_lifetime: hasValue(current?.battery_pack_lifetime)
    ? current.battery_pack_lifetime
    : (specs?.battery_pack_lifetime ?? ""),
});

const hydrateBusModelDataFromOptimization = async (optimizationRun, options = {}) => {
  const current = options?.busModelData ?? {};
  if (
    toFiniteNumber(current?.bus_length_m) != null &&
    toFiniteNumber(current?.battery_pack_size_kwh) != null
  ) {
    return current;
  }

  const modelId = String(
    options?.busModelId ??
    optimizationRun?.input_params?.bus_model_id ??
    optimizationRun?.bus_model_id ??
    ""
  ).trim();
  if (!modelId) return current;

  const busModel = await fetchBusModelById(modelId);
  const specs = parseBusModelSpecs(busModel?.specs);
  const merged = mergeBusModelData(current, specs, busModel);

  options.busModelId = modelId;
  options.busModelData = merged;
  return merged;
};

const renderFieldsInto = (container, dataObj, labelMap = {}) => {
  if (!container) return;
  container.innerHTML = Object.entries(dataObj)
    .map(([key, value]) => {
      const label = labelMap[key] ?? key.replace(/_/g, " ");
      return `
        <div class="sim-data-field">
          <div class="sim-data-field-label">${textContent(label)}</div>
          <div class="sim-data-field-value">${textContent(String(value))}</div>
        </div>`;
    })
    .join("");
};

const resolveStationSlots = (...stations) =>
  stations
    .map((station) => toFiniteNumber(station?.num_slots ?? station?.slots))
    .find((value) => value != null);

const resolveStationTotalPowerKw = (...stations) => {
  for (const station of stations) {
    const totalPower = toFiniteNumber(
      station?.max_total_power_kw ?? station?.total_power_kw ?? station?.max_power_kw
    );
    if (totalPower != null) {
      return totalPower;
    }
  }

  const slots = resolveStationSlots(...stations);
  const powerPerSlot = stations
    .map((station) => toFiniteNumber(station?.max_power_per_slot_kw ?? station?.power_per_slot_kw))
    .find((value) => value != null);
  return slots != null && powerPerSlot != null ? slots * powerPerSlot : null;
};

const resolveStationPowerPerSlotKw = (...stations) => {
  for (const station of stations) {
    const powerPerSlot = toFiniteNumber(
      station?.max_power_per_slot_kw ?? station?.power_per_slot_kw
    );
    if (powerPerSlot != null) {
      return powerPerSlot;
    }
  }

  const totalPower = stations
    .map((station) =>
      toFiniteNumber(station?.max_total_power_kw ?? station?.total_power_kw ?? station?.max_power_kw)
    )
    .find((value) => value != null);
  const slots = resolveStationSlots(...stations);
  return totalPower != null && slots != null && slots > 0 ? totalPower / slots : null;
};

const resolveStationSlotCosts = (...stations) => {
  for (const station of stations) {
    const slotCosts = Array.isArray(station?.slot_costs_chf)
      ? station.slot_costs_chf.map((value) => toFiniteNumber(value)).filter((value) => value != null)
      : [];
    if (slotCosts.length) {
      return slotCosts;
    }
  }
  return [];
};

const buildChargingStationRows = (optimizationRun = {}) => {
  const inputStations = Array.isArray(optimizationRun?.input_params?.charging_stations)
    ? optimizationRun.input_params.charging_stations
    : [];
  const installedChargers = optimizationRun?.results?.installed_chargers ?? {};
  const inputByStopId = new Map(
    inputStations
      .filter((station) => firstText(station?.stop_id))
      .map((station) => [firstText(station.stop_id), station])
  );
  const installedByStopId = new Map(
    Object.entries(installedChargers)
      .filter(([stopId]) => firstText(stopId))
      .map(([stopId, station]) => [firstText(stopId), station ?? {}])
  );
  const stopIds = [...new Set([...inputByStopId.keys(), ...installedByStopId.keys()])];

  return stopIds
    .map((stopId) => {
      const inputStation = inputByStopId.get(stopId) ?? null;
      const installedStation = installedByStopId.get(stopId) ?? null;
      const slotCosts = resolveStationSlotCosts(installedStation, inputStation);
      const stopName = firstText(
        installedStation?.stop_name,
        inputStation?.stop_name,
        inputStation?.name,
        stopId
      );

      return {
        stopId,
        stopName,
        status: installedStation
          ? t("simulation.costs_input_station_installed")
          : t("simulation.costs_input_station_configured"),
        slots: resolveStationSlots(installedStation, inputStation),
        powerPerSlotKw: resolveStationPowerPerSlotKw(installedStation, inputStation),
        totalPowerKw: resolveStationTotalPowerKw(installedStation, inputStation),
        slotCosts,
      };
    })
    .sort((a, b) => a.stopName.localeCompare(b.stopName));
};

const resolveOptimizationMode = (optimizationRun = {}, options = {}) =>
  firstText(
    optimizationRun?.input_params?.mode,
    optimizationRun?.input_params?.optimization_mode,
    optimizationRun?.mode,
    optimizationRun?.optimization_mode,
    options?.optimizationMode
  );

const buildDefaultSlotCosts = (slotCount) => {
  const slots = Math.max(0, Math.round(toFiniteNumber(slotCount) ?? 0));
  if (!slots) return [];
  return Array.from(
    { length: slots },
    (_, index) =>
      index === 0
        ? DEFAULT_INFRASTRUCTURE_SLOT_COST_CHF * 2
        : DEFAULT_INFRASTRUCTURE_SLOT_COST_CHF
  );
};

const resolveInfrastructureInvestment = (optimizationRun = {}, options = {}) => {
  const rows = buildChargingStationRows(optimizationRun);
  const mode = resolveOptimizationMode(optimizationRun, options);

  let totalCostChf = 0;
  let totalSlots = 0;
  let stationCount = 0;
  let usedDefaultCosts = false;

  for (const row of rows) {
    const slots = Math.max(0, Math.round(toFiniteNumber(row?.slots) ?? 0));
    if (!slots) continue;

    const explicitSlotCosts = Array.isArray(row?.slotCosts)
      ? row.slotCosts.map((value) => toFiniteNumber(value)).filter((value) => value != null)
      : [];
    const slotCosts = explicitSlotCosts.length
      ? explicitSlotCosts
      : buildDefaultSlotCosts(slots);

    if (!explicitSlotCosts.length && slotCosts.length) {
      usedDefaultCosts = true;
    }

    if (!slotCosts.length) continue;

    totalCostChf += d3.sum(slotCosts);
    totalSlots += slots;
    stationCount += 1;
  }

  const shouldIncludeInCapex = mode !== "battery_only";

  return {
    mode,
    stationCount,
    totalSlots,
    totalCostChf: stationCount > 0 ? totalCostChf : null,
    includedInCapex:
      shouldIncludeInCapex && stationCount > 0 && totalCostChf > 0,
    usedDefaultCosts,
    usedBatteryOnlyDefaults: mode === "battery_only" && usedDefaultCosts,
    defaultSlotCostChf: DEFAULT_INFRASTRUCTURE_SLOT_COST_CHF,
  };
};

const renderChargingInfrastructure = (container, optimizationRun = null, options = {}) => {
  if (!container) return;
  if (options.loading) {
    container.innerHTML =
      `<p class="efficiency-chart-empty">${textContent(
        t("simulation.loading_charging_infrastructure") ||
          "Loading charging infrastructure…"
      )}</p>`;
    return;
  }

  const rows = buildChargingStationRows(optimizationRun);
  if (!rows.length) {
    container.innerHTML =
      `<p class="efficiency-chart-empty">${textContent(
        t("simulation.no_charging_stations") ||
          "No charging stations configured."
      )}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="efficiency-table-wrap">
      <table class="efficiency-table">
        <thead>
          <tr>
            <th class="efficiency-th-text">${textContent(t("simulation.cs_stop_name") || "Stop")}</th>
            <th>${textContent(t("simulation.opt_col_slots") || "Slots")}</th>
            <th>${textContent(t("simulation.cs_power_per_plug") || "kW / plug")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              return `
                <tr>
                  <td>${textContent(row.stopName)}</td>
                  <td class="efficiency-td-num">${row.slots == null ? "—" : textContent(String(row.slots))}</td>
                  <td class="efficiency-td-num">${row.powerPerSlotKw == null ? "—" : textContent(formatFixed(row.powerPerSlotKw, 0))}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
};

const svgBase = (w, h, ariaLabel) =>
  d3.create("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img").attr("aria-label", ariaLabel);

const gridLines = (g, scale, innerW, ticks = 5) => {
  g.selectAll(".grid-line")
    .data(scale.ticks(ticks))
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", (d) => scale(d))
    .attr("y2", (d) => scale(d))
    .attr("stroke", "var(--color-border-light)")
    .attr("stroke-dasharray", "3,3");
};

/* ── Costs tab charts ─────────────────────────────────────────── */

const costsStateHtml = (message, tone = "default") =>
  `<p class="costs-state-msg${tone === "error" ? " costs-state-msg--error" : ""}">${textContent(message)}</p>`;

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

const sumOpexItems = (items = []) =>
  (Array.isArray(items) ? items : []).reduce(
    (total, item) => total + (toFiniteNumber(item?.cost_chf_per_year) ?? 0),
    0
  );

const resolveOptimizedPackCount = (batteryResults = {}) => {
  const optimizedPacks = Object.values(batteryResults ?? {})
    .map((result) => toFiniteNumber(result?.optimized_packs))
    .filter((value) => value != null);

  if (!optimizedPacks.length) return null;
  return d3.max(optimizedPacks);
};

const resolveOptimizedPackCountForView = (batteryResults = {}, viewOptions = {}) => {
  const entries = Object.entries(batteryResults ?? {});
  const scopedEntries = entries.filter(([shiftKey, result]) =>
    matchesSelectedShift(result, shiftKey, viewOptions)
  );
  const optimizedPacks = (scopedEntries.length ? scopedEntries : entries)
    .map(([, result]) => toFiniteNumber(result?.optimized_packs))
    .filter((value) => value != null);

  if (!optimizedPacks.length) return null;
  return d3.max(optimizedPacks);
};

const resolveElectricBusCapex = (optimizationRun, options = {}) => {
  const busCostChf = toFiniteNumber(options?.busModelData?.cost);
  const packCostChf = toFiniteNumber(options?.busModelData?.battery_pack_cost);
  const packSizeKwh = toFiniteNumber(options?.busModelData?.battery_pack_size_kwh);
  const infrastructure = resolveInfrastructureInvestment(optimizationRun, options);
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
    packSizeKwh,
    optimizedPacks,
    totalBatteryChf,
    infrastructure,
    infrastructureCapexChf,
    totalCapexChf,
  };
};

const resolveEquivalentDieselBusCapex = (options = {}) => {
  const override = toFiniteNumber(options?.costOverrides?.dieselBusCapex);
  if (override != null && override > 0) return override;
  const apiDefault = toFiniteNumber(options?.economicDefaults?.dieselBusCapex);
  if (apiDefault != null && apiDefault > 0) return apiDefault;
  return getEquivalentDieselBusCapexForLength(options?.busModelData?.bus_length_m);
};

const resolveBusLengthM = (options = {}) =>
  toFiniteNumber(options?.busModelData?.bus_length_m);

const resolveDieselEfficiency = (options = {}) => {
  const override = toFiniteNumber(options?.costOverrides?.dieselEfficiency);
  if (override != null && override > 0) return override;
  const busLength = resolveBusLengthM(options);
  if (busLength != null) return getDieselEfficiencyForLength(busLength);
  const apiDefault = toFiniteNumber(options?.economicDefaults?.dieselConsumptionConst);
  if (apiDefault != null && apiDefault > 0) return apiDefault;
  return 0.40;
};

const resolveDieselMaintenanceCost = (options = {}) => {
  const override = toFiniteNumber(options?.costOverrides?.dieselMaintenanceCost);
  if (override != null && override > 0) return override;
  const busLength = resolveBusLengthM(options);
  if (busLength != null) return getDieselMaintenanceCostForLength(busLength);
  const apiDefault = toFiniteNumber(options?.economicDefaults?.dieselMaintCostConst);
  if (apiDefault != null && apiDefault > 0) return apiDefault;
  return 0.20;
};

const resolveElectricMaintenanceCost = (options = {}) => {
  const override = toFiniteNumber(options?.costOverrides?.electricMaintenanceCost);
  if (override != null && override > 0) return override;
  const busLength = resolveBusLengthM(options);
  if (busLength != null) return getElectricMaintenanceCostForLength(busLength);
  const apiDefault = toFiniteNumber(options?.economicDefaults?.electricMaintCostConst);
  if (apiDefault != null && apiDefault > 0) return apiDefault;
  return 0.15;
};

const resolveBusLifetimeYears = (options = {}) => {
  const value = toFiniteNumber(options?.busModelData?.bus_lifetime);
  return value != null && value > 0 ? value : DEFAULT_BUS_LIFETIME_YEARS;
};

const resolveBatteryLifetimeYears = (options = {}) => {
  const value = toFiniteNumber(options?.busModelData?.battery_pack_lifetime);
  return value != null && value > 0 ? value : DEFAULT_BATTERY_LIFETIME_YEARS;
};

const resolveDieselBusLifetimeYears = () => DEFAULT_DIESEL_BUS_LIFETIME_YEARS;

const computeReplacementYears = (busLifetimeYears, batteryLifetimeYears) => {
  const busLifetime = toFiniteNumber(busLifetimeYears);
  const batteryLifetime = toFiniteNumber(batteryLifetimeYears);
  if (
    busLifetime == null ||
    batteryLifetime == null ||
    busLifetime <= 0 ||
    batteryLifetime <= 0
  ) {
    return [];
  }

  const count = Math.floor((busLifetime - 1) / batteryLifetime);
  return Array.from({ length: count }, (_, index) => (index + 1) * batteryLifetime);
};

const computeRecurringReplacementYears = (lifetimeYears, horizonYears) => {
  const lifetime = toFiniteNumber(lifetimeYears);
  const horizon = toFiniteNumber(horizonYears);
  if (lifetime == null || lifetime <= 0 || horizon == null || horizon <= 0) {
    return [];
  }

  // Exclusive of the horizon: a replacement landing exactly at the horizon
  // belongs to the next lifecycle and must not be charged in this view.
  const years = [];
  for (let year = lifetime; year < horizon; year += lifetime) {
    years.push(year);
  }
  return years;
};

const computeBatteryReplacementYearsOverHorizon = (
  _busLifetimeYears,
  batteryLifetimeYears,
  horizonYears
) => {
  const batteryLifetime = toFiniteNumber(batteryLifetimeYears);
  const horizon = toFiniteNumber(horizonYears);

  if (
    batteryLifetime == null ||
    batteryLifetime <= 0 ||
    horizon == null ||
    horizon <= 0
  ) {
    return [];
  }

  return computeRecurringReplacementYears(batteryLifetime, horizon);
};

const buildEquivalentAnnualCostData = (comparison, options = {}) => {
  const annualizationRate =
    toFiniteNumber(options?.annualizationRate) ?? DEFAULT_OPEX_ANNUALIZATION_RATE;
  const electricCapex = resolveElectricBusCapex(options?.optimizationRun, options);
  const dieselCapexChf = resolveEquivalentDieselBusCapex(options) ?? 0;
  const busLifetime = resolveBusLifetimeYears(options);
  const dieselBusLifetime = resolveDieselBusLifetimeYears();
  const batteryLifetime = resolveBatteryLifetimeYears(options);
  const batteryReplacementYears = computeReplacementYears(busLifetime, batteryLifetime);
  const batteryReplacementCost = toFiniteNumber(electricCapex?.totalBatteryChf) ?? 0;

  const batteryReplacementPv = batteryReplacementYears.reduce((total, year) => {
    if (annualizationRate <= 0) return total + batteryReplacementCost;
    return total + batteryReplacementCost / Math.pow(1 + annualizationRate, year);
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

  const electricUsage = sumOpexItemsByType(comparison?.electric?.opex_items, "energy");
  const dieselUsage = sumOpexItemsByType(comparison?.diesel?.opex_items, "energy");
  const electricMaintenance = sumOpexItemsByType(
    comparison?.electric?.opex_items,
    "maintenance"
  );
  const dieselMaintenance = sumOpexItemsByType(
    comparison?.diesel?.opex_items,
    "maintenance"
  );

  return {
    annualizationRate,
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
    upfrontCapex: {
      diesel: dieselCapexChf,
      electric: electricCapex?.totalCapexChf ?? 0,
    },
    annualOpex: {
      diesel: dieselUsage + dieselMaintenance,
      electric: electricUsage + electricMaintenance,
    },
    replacementYears: batteryReplacementYears,
    dieselBusLifetime,
    batteryReplacementCost,
  };
};

const buildCostsChartData = (comparison, options = {}) => {
  if (!comparison) return null;

  const eacData = buildEquivalentAnnualCostData(comparison, options);
  const electricAnnualOpex = eacData.annualOpex.electric;
  const dieselAnnualOpex = eacData.annualOpex.diesel;
  const electricBusCapexChf = eacData.upfrontCapex.electric;
  const dieselBusCapexChf = eacData.upfrontCapex.diesel;
  const electricCapexDetails = resolveElectricBusCapex(
    options?.optimizationRun,
    options
  );
  const electricBusLifetime = resolveBusLifetimeYears(options);
  const dieselBusLifetime = eacData.dieselBusLifetime ?? resolveDieselBusLifetimeYears();
  // Default horizon = e-bus lifespan (discounted lifecycle view), not a fixed
  // long horizon. Replacements landing exactly at the horizon are excluded.
  const horizonYears = electricBusLifetime;
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
    resolveBatteryLifetimeYears(options),
    horizonYears
  );
  const batteryReplacementCost = eacData.batteryReplacementCost ?? 0;
  const batteryReplacementCostByYear = batteryReplacementYears.reduce((acc, year) => {
    acc[year] = (acc[year] ?? 0) + batteryReplacementCost;
    return acc;
  }, {});
  const electricVehicleReplacementCost =
    toFiniteNumber(electricCapexDetails?.busCostChf) ?? 0;
  const electricBusReplacementCostByYear = electricBusReplacementYears.reduce((acc, year) => {
    acc[year] = (acc[year] ?? 0) + electricVehicleReplacementCost;
    return acc;
  }, {});
  const dieselBusReplacementCostByYear = dieselBusReplacementYears.reduce((acc, year) => {
    acc[year] = (acc[year] ?? 0) + (toFiniteNumber(dieselBusCapexChf) ?? 0);
    return acc;
  }, {});

  // Residual value credited at the horizon for assets with remaining useful
  // life (see computeLinearResidualValue). Infrastructure is not replaced and
  // holds no residual here.
  const dieselResidualValue = computeScheduleResidualValue({
    purchaseCost: dieselBusCapexChf,
    lifetimeYears: dieselBusLifetime,
    purchaseYears: [0, ...dieselBusReplacementYears],
    horizonYears,
  });
  const electricResidualValue =
    computeScheduleResidualValue({
      purchaseCost: electricVehicleReplacementCost,
      lifetimeYears: electricBusLifetime,
      purchaseYears: [0, ...electricBusReplacementYears],
      horizonYears,
    }) +
    computeScheduleResidualValue({
      purchaseCost: batteryReplacementCost,
      lifetimeYears: resolveBatteryLifetimeYears(options),
      purchaseYears: [0, ...batteryReplacementYears],
      horizonYears,
    });

  const yearly = buildProjectedCostTrendYearlySeries({
    horizonYears,
    discountRate: eacData.annualizationRate,
    dieselBusCapexChf,
    dieselAnnualOpex,
    dieselBusReplacementCostByYear,
    dieselResidualValue,
    electricBusCapexChf,
    electricAnnualOpex,
    electricBusReplacementCostByYear,
    batteryReplacementCostByYear,
    electricResidualValue,
  });

  return {
    tco: eacData.tco,
    annualTotals: eacData.annualTotals,
    upfrontCapex: eacData.upfrontCapex,
    annualOpex: eacData.annualOpex,
    horizonYears,
    lifecycle: yearly.lifecycle,
    replacementYears: {
      electricBus: electricBusReplacementYears,
      dieselBus: dieselBusReplacementYears,
      battery: batteryReplacementYears,
    },
    yearly,
  };
};

const computeBreakEvenYear = (yearlyData) => {
  if (!Array.isArray(yearlyData) || yearlyData.length < 2) return null;
  for (let i = 1; i < yearlyData.length; i += 1) {
    const prev = yearlyData[i - 1];
    const curr = yearlyData[i];
    if (prev.diesel <= prev.electric && curr.diesel >= curr.electric) {
      const dDiesel = curr.diesel - prev.diesel;
      const dElectric = curr.electric - prev.electric;
      const dDiff = dDiesel - dElectric;
      if (Math.abs(dDiff) < 1e-6) return curr.year;
      const fraction = (prev.electric - prev.diesel) / dDiff;
      return prev.year + fraction;
    }
  }
  return null;
};

const renderCostsKpis = (el, comparison, chartData = null) => {
  if (!el) return;
  if (!comparison) {
    el.innerHTML = "";
    return;
  }

  const annualTotals = chartData?.annualTotals;
  const yearlyData = chartData?.yearly;

  const electricAnnual = toFiniteNumber(annualTotals?.electric) ?? 0;
  const dieselAnnual = toFiniteNumber(annualTotals?.diesel) ?? 0;
  const annualSaving = dieselAnnual - electricAnnual;

  const breakEvenYear = computeBreakEvenYear(yearlyData);

  const lastPoint = Array.isArray(yearlyData) ? yearlyData[yearlyData.length - 1] : null;
  // Lifecycle horizon = e-bus lifespan, taken from the trend itself so the KPI
  // label reflects the actual model lifespan rather than a fixed constant.
  const horizonYears =
    toFiniteNumber(chartData?.lifecycle?.horizonYears) ??
    toFiniteNumber(chartData?.horizonYears) ??
    toFiniteNumber(lastPoint?.year) ??
    PROJECTED_COST_TREND_HORIZON_YEARS;
  const lifetimeSaving =
    toFiniteNumber(chartData?.lifecycle?.lifecycleSaving) ??
    (lastPoint != null
      ? (toFiniteNumber(lastPoint.diesel) ?? 0) - (toFiniteNumber(lastPoint.electric) ?? 0)
      : null);

  const upfrontDelta =
    (chartData?.upfrontCapex?.electric ?? 0) - (chartData?.upfrontCapex?.diesel ?? 0);
  const annualOpexSaving =
    (toFiniteNumber(chartData?.annualOpex?.diesel) ?? 0) -
    (toFiniteNumber(chartData?.annualOpex?.electric) ?? 0);
  const paybackYears =
    annualOpexSaving > 0 && upfrontDelta > 0
      ? upfrontDelta / annualOpexSaving
      : null;

  const roi =
    upfrontDelta > 0 && lifetimeSaving != null
      ? (lifetimeSaving / upfrontDelta) * 100
      : null;

  const kpis = [
    {
      label: costKpiLabel("annual_saving"),
      value: `CHF ${formatCHF(Math.round(annualSaving))}`,
      tone: annualSaving > 0 ? "positive" : annualSaving < 0 ? "negative" : "",
      tooltip:
        t("simulation.kpi_tip_annual_saving") ||
        "Diesel − electric equivalent annual cost (EAC + OPEX). Positive = electric is cheaper.",
    },
    {
      hidden: breakEvenYear == null,
      label:
        t("simulation.costs_kpi_break_even") || "Break-even",
      value:
        breakEvenYear != null
          ? `${t("simulation.general_year") || "Yr"} ${formatFixed(breakEvenYear, 1)}`
          : "—",
      tone: breakEvenYear != null ? "positive" : "",
      tooltip:
        t("simulation.kpi_tip_break_even") ||
        "Year when cumulative present-value electric costs fall below diesel on the projected discounted cost trend.",
    },
    {
      hidden: lifetimeSaving == null,
      label:
        t("simulation.costs_kpi_lifetime_saving", { years: horizonYears }) ||
        `${horizonYears}-yr savings`,
      value:
        lifetimeSaving != null
          ? `CHF ${formatCHF(Math.round(lifetimeSaving))}`
          : "—",
      tone:
        lifetimeSaving != null && lifetimeSaving > 0
          ? "positive"
          : lifetimeSaving != null && lifetimeSaving < 0
            ? "negative"
            : "",
      tooltip:
        t("simulation.kpi_tip_lifetime_saving", { years: horizonYears }) ||
        `Present-value savings over the ${horizonYears}-year horizon, incl. discounted replacements.`,
    },
    {
      hidden: paybackYears == null,
      label: t("simulation.costs_kpi_payback") || "Payback",
      value:
        paybackYears != null
          ? `${formatFixed(paybackYears, 1)} ${t("simulation.general_years") || "yr"}`
          : "—",
      tone: paybackYears != null && paybackYears <= 10 ? "positive" : "",
      tooltip:
        t("simulation.kpi_tip_payback") ||
        "Years to recover the extra electric CAPEX through annual OPEX savings (simple payback).",
    },
    {
      hidden: roi == null,
      label: t("simulation.costs_kpi_roi") || "ROI",
      value: roi != null ? `${formatFixed(roi, 0)}%` : "—",
      tone: roi != null && roi > 0 ? "positive" : roi != null && roi < 0 ? "negative" : "",
      tooltip:
        t("simulation.kpi_tip_roi", { years: horizonYears }) ||
        `${horizonYears}-year savings ÷ upfront CAPEX difference.`,
    },
  ];

  el.innerHTML = kpis
    .filter(({ hidden }) => !hidden)
    .map(
      ({ label, value, tone, tooltip }) => `
        <div class="costs-kpi-card">
          <span class="costs-kpi-label">${textContent(label)}</span>
          <span class="costs-kpi-value${tone ? ` costs-kpi-value--${tone}` : ""}">${textContent(value)}</span>
          ${tooltip ? `<span class="costs-kpi-tooltip">${textContent(tooltip)}</span>` : ""}
        </div>`
    )
    .join("");
};

const renderCostsAssumption = (el, annualization = null) => {
  if (!el) return;
  if (
    annualization?.mode === "yearly_distance" &&
    annualization?.yearlyDistanceKm != null
  ) {
    el.textContent =
      t("simulation.costs_assumption_yearly_distance", {
        distance: formatFixed(annualization.yearlyDistanceKm, 0),
        recurrence: annualization.recurrence,
        rate: formatFixed(
          (annualization?.opexAnnualizationRate ??
            DEFAULT_OPEX_ANNUALIZATION_RATE) * 100,
          1
        ),
      }) ||
      `Annual cost comparison is scaled to ${formatFixed(annualization.yearlyDistanceKm, 0)} km/year using recurrence=${annualization.recurrence}. CAPEX is annualized at ${formatFixed((annualization?.opexAnnualizationRate ?? DEFAULT_OPEX_ANNUALIZATION_RATE) * 100, 1)}% in the EAC calculation.`;
    return;
  }
  el.textContent =
    t("simulation.costs_assumption_weekly_once_detailed", {
      rate: formatFixed(
        (annualization?.opexAnnualizationRate ??
          DEFAULT_OPEX_ANNUALIZATION_RATE) * 100,
        1
      ),
    }) ||
    `Current economic comparison assumes \`weekly_once\` recurrence. CAPEX is annualized at ${formatFixed((annualization?.opexAnnualizationRate ?? DEFAULT_OPEX_ANNUALIZATION_RATE) * 100, 1)}% in the EAC calculation.`;
};

const formatChfValue = (value, fractionDigits = 0) => {
  const numeric = toFiniteNumber(value);
  if (numeric == null) return "—";
  return `CHF ${numeric.toLocaleString("de-CH", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
};

const formatChfPerKmValue = (annualCost, yearlyDistanceKm) => {
  const cost = toFiniteNumber(annualCost);
  const distance = toFiniteNumber(yearlyDistanceKm);
  if (cost == null || distance == null || distance <= 0) return "—";
  return `(${formatFixed(cost / distance, 3)} CHF/km)`;
};

const buildSimpleRowsTable = (rows = []) => `
  <table class="costs-inputs-table">
    <tbody>
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td>${textContent(label)}</td><td>${textContent(String(value ?? "—"))}</td></tr>`
        )
        .join("")}
    </tbody>
  </table>`;

const formatSlotCostsSummary = (slotCosts = []) => {
  const normalizedCosts = (Array.isArray(slotCosts) ? slotCosts : [])
    .map((value) => toFiniteNumber(value))
    .filter((value) => value != null);

  return normalizedCosts.length
    ? normalizedCosts.map((value) => formatChfValue(value, 0)).join(", ")
    : "—";
};

const formatChargingStationStatus = (status) => {
  const normalized = firstText(status).toLowerCase();
  return (
    {
      installed: translateOr(
        "simulation.costs_input_station_installed",
        "Installed"
      ),
      configured: translateOr(
        "simulation.costs_input_station_configured",
        "Configured"
      ),
    }[normalized] ??
    firstText(status, translateOr("simulation.costs_input_station_configured", "Configured"))
  );
};

const buildChargingConfigurationSection = (costInputs = {}) => {
  const rows = Array.isArray(costInputs?.chargingStationRows)
    ? costInputs.chargingStationRows
    : [];
  const mode = firstText(costInputs?.optimizationMode, "battery_only");
  const includeStatus = mode !== "battery_only";
  const includeSlotCosts = mode === "charging_only" || mode === "joint";

  const noteByMode = {
    battery_only: translateOr(
      "simulation.costs_input_charging_mode_battery_only",
      "Battery-only mode shows the configured charging locations and technical limits used for the shift."
    ),
    charging_only: translateOr(
      "simulation.costs_input_charging_mode_charging_only",
      "Charging mode shows the configured charging locations, plug costs, and technical limits."
    ),
    joint: translateOr(
      "simulation.costs_input_charging_mode_joint",
      "Joint mode shows the configured charging locations, plug costs, and technical limits."
    ),
  };

  const tableHtml = rows.length
    ? `
      <div class="efficiency-table-wrap">
        <table class="efficiency-table">
          <thead>
            <tr>
              <th class="efficiency-th-text">${textContent(
                t("simulation.cs_stop_name") || "Stop"
              )}</th>
              ${includeStatus
                ? `<th class="efficiency-th-text">${textContent(
                    translateOr("simulation.costs_input_station_status", "Status")
                  )}</th>`
                : ""}
              <th>${textContent(t("simulation.cs_num_plugs") || "Plugs")}</th>
              <th>${textContent(t("simulation.cs_power_per_plug") || "kW / plug")}</th>
              <th>${textContent(
                translateOr("simulation.costs_input_total_power", "Total power (kW)")
              )}</th>
              ${includeSlotCosts
                ? `<th>${textContent(
                    translateOr("simulation.costs_input_slot_costs", "Slot costs")
                  )}</th>`
                : ""}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => `
                <tr>
                  <td>${textContent(row.stopName || row.stopId || "—")}</td>
                  ${includeStatus
                    ? `<td>${textContent(
                        formatChargingStationStatus(row.status)
                      )}</td>`
                    : ""}
                  <td class="efficiency-td-num">${
                    row.slots == null ? "—" : textContent(formatFixed(row.slots, 0))
                  }</td>
                  <td class="efficiency-td-num">${
                    row.powerPerSlotKw == null
                      ? "—"
                      : textContent(formatFixed(row.powerPerSlotKw, 0))
                  }</td>
                  <td class="efficiency-td-num">${
                    row.totalPowerKw == null
                      ? "—"
                      : textContent(formatFixed(row.totalPowerKw, 0))
                  }</td>
                  ${includeSlotCosts
                    ? `<td class="efficiency-td-num">${textContent(formatSlotCostsSummary(row.slotCosts))}</td>`
                    : ""}
                </tr>`)
              .join("")}
          </tbody>
        </table>
      </div>`
    : `<p class="costs-inputs-note">${textContent(
        t("simulation.no_charging_stations") ||
          "No charging stations configured."
      )}</p>`;

  return `
    <section class="costs-inputs-section">
      <h3 class="costs-inputs-section-title">${textContent(
        translateOr(
          "simulation.costs_input_charging_configuration",
          "Charging station configuration"
        )
      )}</h3>
      <p class="costs-inputs-note">${textContent(
        noteByMode[mode] || noteByMode.battery_only
      )}</p>
      ${tableHtml}
    </section>`;
};

const buildOpexBreakdownTable = (items = [], yearlyDistanceKm = null) => {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => {
    const annualCost = toFiniteNumber(item?.cost_chf_per_year);
    return {
      name: firstText(item?.name, item?.label, item?.type) || "—",
      annualCost,
      costPerKm: formatChfPerKmValue(annualCost, yearlyDistanceKm),
    };
  });

  const usageTotal = sumOpexItemsByType(items, "energy");
  const maintenanceTotal = sumOpexItemsByType(items, "maintenance");
  const totalOpex = sumOpexItems(items);

  const bodyRows = normalizedItems.length
    ? normalizedItems
        .map(
          (row) => `
            <tr>
              <td>${textContent(row.name)}</td>
              <td>${textContent(formatChfValue(row.annualCost, 0))}</td>
              <td>${textContent(row.costPerKm)}</td>
            </tr>`
        )
        .join("")
    : `<tr><td colspan="3">${textContent(
        translateOr(
          "simulation.costs_input_no_opex_items",
          "No OPEX items returned by the economic comparison."
        )
      )}</td></tr>`;

  const summaryRows = normalizedItems.length
    ? [
        [
          translateOr("simulation.costs_input_total_usage", "Total OPEX usage"),
          usageTotal,
        ],
        [
          translateOr(
            "simulation.costs_input_total_maintenance",
            "Total OPEX maintenance"
          ),
          maintenanceTotal,
        ],
        [translateOr("simulation.costs_input_total_opex", "Total OPEX"), totalOpex],
      ]
        .map(
          ([label, value]) => `
            <tr class="costs-inputs-table__summary">
              <td>${textContent(label)}</td>
              <td>${textContent(formatChfValue(value, 0))}</td>
              <td>${textContent(formatChfPerKmValue(value, yearlyDistanceKm))}</td>
            </tr>`
        )
        .join("")
    : "";

  return `
    <table class="costs-inputs-table costs-inputs-table--detailed">
      <thead>
        <tr>
          <th>${textContent(translateOr("simulation.costs_input_param", "Component"))}</th>
          <th>${textContent(translateOr("simulation.costs_input_annual_cost", "Annual cost"))}</th>
          <th>${textContent(translateOr("simulation.costs_input_cost_per_km", "Cost per km"))}</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        ${summaryRows}
      </tbody>
    </table>`;
};

const buildInvestmentTableHtml = (state, options = {}) => {
  if (!state.optimizationRun) {
    return "";
  }

  const batteryResults = state.optimizationRun?.results?.battery_results ?? {};
  const entries = Object.values(batteryResults);
  const busModelName = options?.busModelName || "";
  const busLengthM = options?.busModelData?.bus_length_m;
  const {
    busCostChf,
    packCostChf,
    packSizeKwh,
    optimizedPacks,
    totalBatteryChf,
    infrastructure,
    infrastructureCapexChf,
    totalCapexChf,
  } = resolveElectricBusCapex(state.optimizationRun, options);

  if (!entries.length && busCostChf == null && packCostChf == null) {
    return "";
  }

  const dash = "—";
  const fmtChf = (v) => (v != null ? `CHF ${formatCHF(v)}` : dash);

  const rows = [
    [
      t("simulation.inv_bus_model") || "Bus model",
      busModelName ? busModelName : dash,
    ],
    [
      t("simulation.inv_bus_length") || "Bus length",
      busLengthM != null && busLengthM !== "" ? `${busLengthM} m` : dash,
    ],
    [
      t("simulation.inv_bus_cost") || "Electric bus (body)",
      fmtChf(busCostChf),
    ],
    [
      t("simulation.inv_pack_cost") || "Battery pack (unit cost)",
      packCostChf != null ? `CHF ${formatCHF(packCostChf)}` : dash,
    ],
    [
      t("simulation.inv_pack_size") || "Battery pack size",
      packSizeKwh != null ? `${packSizeKwh} kWh` : dash,
    ],
    [
      t("simulation.inv_opt_packs") || "Optimized battery packs",
      optimizedPacks != null ? String(optimizedPacks) : dash,
    ],
    [
      t("simulation.inv_total_battery") || "Total battery investment",
      fmtChf(totalBatteryChf),
    ],
    [
      translateOr(
        "simulation.inv_infra_stations",
        "Charging stations included"
      ),
      infrastructure?.stationCount ? String(infrastructure.stationCount) : dash,
    ],
    [
      translateOr("simulation.inv_infra_slots", "Charging plugs included"),
      infrastructure?.totalSlots ? String(infrastructure.totalSlots) : dash,
    ],
    [
      translateOr(
        "simulation.inv_infra_cost_assumption",
        "Charging plug cost assumption"
      ),
      infrastructure?.usedDefaultCosts
        ? `CHF ${formatCHF(infrastructure.defaultSlotCostChf)} / plug`
        : dash,
    ],
    [
      translateOr(
        "simulation.inv_total_infrastructure",
        "Total charging infrastructure investment"
      ),
      infrastructure?.usedBatteryOnlyDefaults
        ? translateOr("simulation.inv_not_included", "Not included")
        : fmtChf(infrastructureCapexChf),
    ],
  ];

  const totalRow = totalCapexChf != null
    ? `<tr class="investment-table__total">
         <td>${textContent(t("simulation.inv_grand_total") || "Total investment")}</td>
         <td>${textContent(fmtChf(totalCapexChf))}</td>
       </tr>`
    : "";

  return `
    <table class="investment-table">
      <tbody>
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td>${textContent(label)}</td><td>${textContent(value)}</td></tr>`
          )
          .join("")}
        ${totalRow}
      </tbody>
    </table>`;
};

const buildInvestmentNoteHtml = (state, options = {}) => {
  if (!state.optimizationRun) {
    return "";
  }

  const { infrastructure } = resolveElectricBusCapex(state.optimizationRun, options);
  if (!infrastructure?.usedBatteryOnlyDefaults) {
    return "";
  }

  return `<p class="investment-table__note">${textContent(
    translateOr(
      "simulation.inv_battery_only_note",
      `Battery-only optimization does not optimize charging infrastructure cost. A default assumption of CHF ${formatCHF(infrastructure.defaultSlotCostChf)} per plug is shown for reference and is not included in the total investment.`,
      { cost: formatCHF(infrastructure.defaultSlotCostChf) }
    )
  )}</p>`;
};

const renderInvestmentSection = (el, state, options = {}) => {
  if (!el) return;

  const investmentTableHtml = buildInvestmentTableHtml(state, options);
  if (!investmentTableHtml) {
    el.innerHTML = costsStateHtml(
      t("simulation.costs_empty") || "No economic comparison data available."
    );
    return;
  }

  el.innerHTML = `
    ${investmentTableHtml}
    ${buildInvestmentNoteHtml(state, options)}`;
};

const renderOpexInputsTable = (el, state, options = {}) => {
  if (!el) return;
  if (state.status === "loading" || state.status === "refreshing") {
    el.innerHTML = costsStateHtml(
      t("simulation.costs_loading") || "Loading cost comparison…"
    );
    return;
  }
  if (state.status === "error") {
    el.innerHTML = costsStateHtml(
      state.error || t("simulation.costs_error") || "Unable to load cost comparison.",
      "error"
    );
    return;
  }
  if (state.status !== "done" || !state.costInputs) {
    el.innerHTML = costsStateHtml(
      t("simulation.costs_empty") || "No economic comparison data available."
    );
    return;
  }

  const opexAnnualizationRateValue =
    state.costInputs.opexAnnualizationRate == null
      ? "—"
      : `${formatFixed(state.costInputs.opexAnnualizationRate * 100, 1)}%`;

  const scenarioRows = [
    [
      t("simulation.general_shift_name") || "Shift name",
      state.costInputs.shiftName || "—",
    ],
    [t("simulation.costs_input_line") || "Line", state.costInputs.shiftLineLabel],
    [
      t("simulation.costs_input_week_day") || "Week day",
      state.costInputs.shiftWeekdayLabel,
    ],
    [
      t("simulation.costs_input_recurrence") || "Recurrence",
      state.costInputs.recurrence,
    ],
    [
      translateOr("simulation.costs_input_daily_distance", "Daily distance (km)"),
      state.costInputs.dailyShiftDistanceKm == null
        ? "—"
        : formatFixed(state.costInputs.dailyShiftDistanceKm, 3),
    ],
    [
      t("simulation.costs_input_eac_equation") || "EAC equation",
      "EAC_CAPEX = CAPEX * [r(1+r)^n] / [(1+r)^n - 1]",
    ],
    [
      t("simulation.costs_input_annual_total_equation") ||
        "Annual total equation",
      "Annual total = EAC_CAPEX + OPEX usage + OPEX maintenance",
    ],
    [
      t("simulation.costs_input_trend_equation") || "Trend equation",
      "Cumulative total by year = upfront CAPEX + bus replacements + battery replacements + yearly OPEX * year",
    ],
    [
      translateOr("simulation.costs_input_usage_equation", "OPEX usage equation"),
      translateOr(
        "simulation.costs_input_usage_equation_value",
        "OPEX usage = sum of returned fuel or energy cost items"
      ),
    ],
    [
      translateOr(
        "simulation.costs_input_maintenance_equation",
        "OPEX maintenance equation"
      ),
      translateOr(
        "simulation.costs_input_maintenance_equation_value",
        "OPEX maintenance = sum of returned maintenance cost items"
      ),
    ],
    [
      translateOr(
        "simulation.costs_input_cost_per_km_equation",
        "Cost per km equation"
      ),
      translateOr(
        "simulation.costs_input_cost_per_km_equation_value",
        "Cost per km = annual cost / yearly distance"
      ),
    ],
    [
      t("simulation.costs_input_battery_replacement_years") ||
        "Battery replacement years",
      (state.costInputs.trendBatteryReplacementYears ?? []).join(", ") || "—",
    ],
    [
      translateOr("simulation.costs_input_electric_bus_replacement_years", "Electric bus replacement years"),
      (state.costInputs.electricBusReplacementYears ?? []).join(", ") || "—",
    ],
    [
      translateOr("simulation.costs_input_diesel_bus_replacement_years", "Diesel bus replacement years"),
      (state.costInputs.dieselBusReplacementYears ?? []).join(", ") || "—",
    ],
    [
      translateOr("simulation.costs_input_projection_horizon", "Projection horizon (years)"),
      state.costInputs.projectedTrendHorizonYears == null
        ? "—"
        : formatFixed(state.costInputs.projectedTrendHorizonYears, 0),
    ],
    [
      t("simulation.costs_input_yearly_distance") || "Yearly distance (km)",
      state.costInputs.yearlyDistanceKm == null
        ? "—"
        : formatFixed(state.costInputs.yearlyDistanceKm, 0),
    ],
    [
      t("simulation.costs_input_prediction_distance") ||
        "Prediction distance per shift (km)",
      state.costInputs.predictedShiftDistanceKm == null
        ? "—"
        : formatFixed(state.costInputs.predictedShiftDistanceKm, 3),
    ],
    [
      t("simulation.costs_input_capex_annualization_rate") ||
        "CAPEX annualization rate",
      opexAnnualizationRateValue,
    ],
  ];

  el.innerHTML = `
    <div class="costs-inputs-layout">
      ${buildSimpleRowsTable(scenarioRows)}
      ${buildChargingConfigurationSection(state.costInputs)}
    </div>`;
};

const renderEfficiencyPredictionSummary = (costInputs) => {
  const predictedShiftConsumption = toFiniteNumber(
    costInputs?.predictedShiftConsumptionMedianKwh
  );
  const predictedShiftConsumptionPerKm = toFiniteNumber(
    costInputs?.predictedShiftConsumptionPerKmMedianKwh
  );

  const items = [
    [
      t("simulation.costs_input_prediction_consumption") ||
        "Prediction consumption per shift (kWh)",
      predictedShiftConsumption == null ? "—" : formatFixed(predictedShiftConsumption, 0),
    ],
    [
      translateOr(
        "simulation.costs_input_prediction_consumption_per_km",
        "Prediction consumption per km (kWh/km)"
      ),
      predictedShiftConsumptionPerKm == null
        ? "—"
        : formatFixed(predictedShiftConsumptionPerKm, 3),
    ],
  ];

  return `
    <div class="efficiency-summary-table-wrap">
      <div class="efficiency-summary-grid">
        ${items
          .map(
            ([label, value]) => `
              <div class="efficiency-summary-item">
                <span class="efficiency-summary-item__label">${textContent(label)}</span>
                <span class="efficiency-summary-item__value">${textContent(value)}</span>
              </div>`
          )
          .join("")}
      </div>
    </div>`;
};

const renderElectricOpexSection = (el, state) => {
  if (!el) return;
  if (state.status !== "done" || !state.costInputs) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <p class="costs-inputs-note">${textContent(
      translateOr(
        "simulation.costs_input_opex_note",
        "OPEX usage and OPEX maintenance are the sums of the itemized costs returned by the economic comparison."
      )
    )}</p>
    ${buildOpexBreakdownTable(
      state.comparison?.electric?.opex_items,
      state.costInputs.yearlyDistanceKm
    )}`;
};

const renderDieselOpexSection = (el, state) => {
  if (!el) return;
  if (state.status !== "done" || !state.costInputs) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <p class="costs-inputs-note">${textContent(
      translateOr(
        "simulation.costs_input_opex_note",
        "OPEX usage and OPEX maintenance are the sums of the itemized costs returned by the economic comparison."
      )
    )}</p>
    ${buildOpexBreakdownTable(
      state.comparison?.diesel?.opex_items,
      state.costInputs.yearlyDistanceKm
    )}`;
};

const formatChfAxis = (value) => {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${Math.round(value / 1e3)}k`;
  return String(Math.round(value));
};

const formatChfAxisWithUnit = (value) => `${formatChfAxis(value)} CHF`;

const formatKChfAxis = (value) => String(Math.round(value / 1000));

const formatKChfLabel = (value) => `${Math.round(value / 1000)} kCHF`;

const COST_STACK_DESCRIPTIONS = {
  vehicle:
    "Annualized capital expenditure (bus body, battery packs, and charging infrastructure where applicable), spread over the vehicle lifetime using the Equivalent Annual Cost formula.",
  energy:
    "Annual energy or fuel cost based on expected yearly consumption and the configured tariff or diesel price.",
  maintenance:
    "Annual maintenance cost as returned by the economic comparison API, including scheduled servicing and component wear.",
};

const costStackDescription = (key) =>
  t(`simulation.cost_stack_desc_${key}`) || COST_STACK_DESCRIPTIONS[key] || "";

const renderCostsBar = (el, data, yearlyDistanceKm = null) => {
  if (!el) return;
  el.innerHTML = "";
  if (!Array.isArray(data) || data.length === 0) {
    el.innerHTML = costsStateHtml(
      t("simulation.costs_empty") || "No economic comparison data available."
    );
    return;
  }
  const margin = { top: 28, right: 24, bottom: 32, left: 72 };
  const W = chartCanvasWidth(el, () => renderCostsBar(el, data, yearlyDistanceKm));
  const H = CHART_PLOT_HEIGHT;
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
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map((d) => d.category)).range([0, iW]).padding(0.35);
  const y = d3.scaleLinear()
    .domain([0, maxVal * 1.15])
    .nice()
    .range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickFormat((d) => busCategoryLabel(d)))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatKChfAxis))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -54)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(t("simulation.axis_cost_kchf_per_year") || "kCHF / year");

  let tooltipGroup, tooltipBg, tooltipText;

  const showBarTooltip = (event, d, layerKey) => {
    const segmentValue = Math.max(0, (d[1] ?? 0) - (d[0] ?? 0));
    const totalValue = COST_STACK_KEYS.reduce(
      (sum, key) => sum + (d.data[key] ?? 0),
      0
    );
    const pct = totalValue > 0 ? ((segmentValue / totalValue) * 100).toFixed(0) : "0";

    const segPerKm = formatChfPerKmValue(segmentValue, yearlyDistanceKm);

    tooltipText.selectAll("*").remove();
    tooltipText
      .append("tspan")
      .attr("x", 8)
      .attr("dy", 14)
      .attr("font-weight", "600")
      .attr("fill", "#1c1c1c")
      .text(
        `${costStackLabel(layerKey)}: ${formatKChfLabel(segmentValue)}` +
        (segPerKm !== "—" ? ` · ${segPerKm}` : "") +
        ` (${pct}%)`
      );

    const bbox = tooltipText.node().getBBox();
    const tw = bbox.width + 16;
    const th = bbox.height + 8;
    tooltipBg.attr("width", tw).attr("height", th);

    const barCenterX = x(d.data.category) + x.bandwidth() / 2;
    const barTopY = y(d[1]);
    let tx = barCenterX - tw / 2;
    let ty = barTopY - th - 6;
    if (tx < 0) tx = 0;
    if (tx + tw > iW) tx = iW - tw;
    if (ty < 0) ty = barTopY + (y(d[0]) - y(d[1])) + 6;

    tooltipGroup.attr("transform", `translate(${tx},${ty})`);
    tooltipGroup.style("display", null);
  };

  const hideBarTooltip = () => {
    tooltipGroup.style("display", "none");
  };

  stacked.forEach((layer) => {
    g.selectAll(`.bar-${layer.key}`)
      .data(layer)
      .join("rect")
      .attr("x", (d) => x(d.data.category))
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth())
      .attr("fill", COST_COLORS[layer.key])
      .style("cursor", "pointer")
      .on("pointerenter", function (event, d) {
        d3.select(this).attr("opacity", 0.82);
        showBarTooltip(event, d, layer.key);
      })
      .on("pointermove", function (event, d) {
        showBarTooltip(event, d, layer.key);
      })
      .on("pointerleave", function () {
        d3.select(this).attr("opacity", 1);
        hideBarTooltip();
      });
  });

  data.forEach((d) => {
    const total = COST_STACK_KEYS.reduce((s, k) => s + d[k], 0);
    const totalPerKm = formatChfPerKmValue(total, yearlyDistanceKm);
    const hasPerKm = totalPerKm !== "—";
    const labelY = Math.max(10, y(total) - (hasPerKm ? 18 : 6));
    const label = g.append("text")
      .attr("x", x(d.category) + x.bandwidth() / 2)
      .attr("y", labelY)
      .attr("text-anchor", "middle")
      .attr("font-size", CHART_FONT_EMPHASIS)
      .attr("font-weight", "600")
      .attr("fill", "#1c1c1c")
      .attr("pointer-events", "none");

    label
      .append("tspan")
      .attr("x", x(d.category) + x.bandwidth() / 2)
      .text(formatKChfLabel(total));

    if (hasPerKm) {
      label
        .append("tspan")
        .attr("x", x(d.category) + x.bandwidth() / 2)
        .attr("dy", "1.1em")
        .attr("font-size", CHART_FONT_LABEL)
        .attr("font-weight", "500")
        .text(totalPerKm);
    }
  });

  tooltipGroup = g.append("g")
    .style("display", "none")
    .attr("pointer-events", "none");
  tooltipBg = tooltipGroup
    .append("rect")
    .attr("fill", "var(--color-tooltip-surface)")
    .attr("stroke", "var(--color-chart-neutral)")
    .attr("stroke-width", 1)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("opacity", 0.97)
    .attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,.12))");
  tooltipText = tooltipGroup
    .append("text")
    .attr("fill", "var(--color-tooltip-text)")
    .attr("font-size", CHART_FONT_TOOLTIP);

  el.appendChild(svg.node());
};

const renderCostsLegend = (el) => {
  if (!el) return;
  el.innerHTML = Object.entries(COST_COLORS)
    .map(
      ([key, color]) => `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${color}"></span>
      ${textContent(costStackLabel(key))}
    </div>`
    )
    .join("");
};

const renderCostsLineLegend = (el) => {
  if (!el) return;
  el.innerHTML = ["diesel", "electric"]
    .map(
      (key) => `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${FUEL_COLORS[key]}"></span>
      ${textContent(fuelLabel(key))}
    </div>`
    )
    .join("");
};

const renderCostPerKmBar = (el, data, yearlyDistanceKm = null) => {
  if (!el) return;
  el.innerHTML = "";
  const distance = toFiniteNumber(yearlyDistanceKm);
  if (!Array.isArray(data) || data.length === 0 || distance == null || distance <= 0) {
    el.innerHTML = costsStateHtml(
      t("simulation.costs_cpk_no_distance") ||
        "Cost per km requires a valid yearly distance."
    );
    return;
  }

  const cpkData = data.map((d) => ({
    category: d.category,
    vehicle: (d.vehicle ?? 0) / distance,
    energy: (d.energy ?? 0) / distance,
    maintenance: (d.maintenance ?? 0) / distance,
  }));

  const margin = { top: 28, right: 24, bottom: 32, left: 72 };
  const W = 620, H = 188;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const stacked = d3.stack().keys(COST_STACK_KEYS)(cpkData);
  const maxVal = d3.max(cpkData, (row) =>
    COST_STACK_KEYS.reduce((sum, key) => sum + (row[key] ?? 0), 0)
  );

  const svg = svgBase(
    W,
    H,
    chartAriaLabel("simulation.chart_aria_cpk", "Cost per kilometer comparison")
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(cpkData.map((d) => d.category)).range([0, iW]).padding(0.35);
  const y = d3.scaleLinear()
    .domain([0, maxVal * 1.15])
    .nice()
    .range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickFormat((d) => busCategoryLabel(d)))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((v) => v.toFixed(2)))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -54)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(
      t("simulation.axis_cost_per_km_chf") ||
        "Cost per kilometer (CHF / km)"
    );

  let tooltipGroup, tooltipBg, tooltipText;

  const showCpkTooltip = (event, d, layerKey) => {
    const segVal = Math.max(0, (d[1] ?? 0) - (d[0] ?? 0));
    const totalVal = COST_STACK_KEYS.reduce(
      (sum, k) => sum + (d.data[k] ?? 0),
      0
    );
    const pct = totalVal > 0 ? ((segVal / totalVal) * 100).toFixed(0) : "0";

    tooltipText.selectAll("*").remove();
    tooltipText
      .append("tspan")
      .attr("x", 8)
      .attr("dy", 14)
      .attr("font-weight", "600")
      .attr("fill", "#1c1c1c")
      .text(`${costStackLabel(layerKey)}: CHF ${segVal.toFixed(2)}/km (${pct}%)`);

    const bbox = tooltipText.node().getBBox();
    const tw = bbox.width + 16;
    const th = bbox.height + 8;
    tooltipBg.attr("width", tw).attr("height", th);

    const barCenterX = x(d.data.category) + x.bandwidth() / 2;
    const barTopY = y(d[1]);
    let tx = barCenterX - tw / 2;
    let ty = barTopY - th - 6;
    if (tx < 0) tx = 0;
    if (tx + tw > iW) tx = iW - tw;
    if (ty < 0) ty = barTopY + (y(d[0]) - y(d[1])) + 6;

    tooltipGroup.attr("transform", `translate(${tx},${ty})`);
    tooltipGroup.style("display", null);
  };

  const hideCpkTooltip = () => {
    tooltipGroup.style("display", "none");
  };

  stacked.forEach((layer) => {
    g.selectAll(`.cpk-bar-${layer.key}`)
      .data(layer)
      .join("rect")
      .attr("x", (d) => x(d.data.category))
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth())
      .attr("fill", COST_COLORS[layer.key])
      .style("cursor", "pointer")
      .on("pointerenter", function (event, d) {
        d3.select(this).attr("opacity", 0.82);
        showCpkTooltip(event, d, layer.key);
      })
      .on("pointermove", function (event, d) {
        showCpkTooltip(event, d, layer.key);
      })
      .on("pointerleave", function () {
        d3.select(this).attr("opacity", 1);
        hideCpkTooltip();
      });
  });

  cpkData.forEach((d) => {
    const total = COST_STACK_KEYS.reduce((s, k) => s + d[k], 0);
    const labelY = Math.max(10, y(total) - 6);
    g.append("text")
      .attr("x", x(d.category) + x.bandwidth() / 2)
      .attr("y", labelY)
      .attr("text-anchor", "middle")
      .attr("font-size", CHART_FONT_EMPHASIS)
      .attr("font-weight", "600")
      .attr("fill", "#1c1c1c")
      .attr("pointer-events", "none")
      .text(`CHF ${total.toFixed(2)}/km`);
  });

  tooltipGroup = g.append("g")
    .style("display", "none")
    .attr("pointer-events", "none");
  tooltipBg = tooltipGroup
    .append("rect")
    .attr("fill", "var(--color-tooltip-surface)")
    .attr("stroke", "var(--color-tooltip-border)")
    .attr("stroke-width", 1)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("opacity", 0.97)
    .attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,.12))");
  tooltipText = tooltipGroup
    .append("text")
    .attr("fill", "var(--color-tooltip-text)")
    .attr("font-size", CHART_FONT_TOOLTIP);

  el.appendChild(svg.node());
};

const renderCostPerKmLegend = (el) => {
  if (!el) return;
  el.innerHTML = Object.entries(COST_COLORS)
    .map(
      ([key, color]) => `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${color}"></span>
      ${textContent(costStackLabel(key))}
    </div>`
    )
    .join("");
};

const renderCumulativeSavings = (el, yearlyData) => {
  if (!el) return;
  el.innerHTML = "";
  if (!Array.isArray(yearlyData) || yearlyData.length < 2) {
    el.innerHTML = costsStateHtml(
      t("simulation.costs_empty") || "No economic comparison data available."
    );
    return;
  }

  const savingsData = yearlyData.map((d) => ({
    year: d.year,
    saving: (d.diesel ?? 0) - (d.electric ?? 0),
  }));

  const margin = { top: 20, right: 24, bottom: 32, left: 84 };
  const W = 620, H = 160;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel("simulation.chart_aria_savings", "Cumulative savings over time")
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const xExtent = d3.extent(savingsData, (d) => d.year);
  const yExtent = d3.extent(savingsData, (d) => d.saving);
  const yMin = Math.min(0, yExtent[0]) * 1.1;
  const yMax = Math.max(0, yExtent[1]) * 1.1;

  const x = d3.scaleLinear().domain(xExtent).range([0, iW]);
  const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([iH, 0]);

  const tickYears = Array.from(new Set(savingsData.map((d) => d.year)));
  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickValues(tickYears).tickFormat((d) => `${d}`))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatChfAxisWithUnit))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);
  gridLines(g, y, iW);

  g.append("line")
    .attr("x1", 0)
    .attr("x2", iW)
    .attr("y1", y(0))
    .attr("y2", y(0))
    .attr("stroke", "var(--color-tooltip-border)")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4,3");

  const area = d3.area()
    .x((d) => x(d.year))
    .y0(y(0))
    .y1((d) => y(d.saving));

  g.append("path")
    .datum(savingsData)
    .attr("d", area)
    .attr("fill", savingsData[savingsData.length - 1].saving >= 0 ? "rgba(61,122,0,0.12)" : "rgba(192,57,43,0.12)");

  const line = d3.line().x((d) => x(d.year)).y((d) => y(d.saving));
  g.append("path")
    .datum(savingsData)
    .attr("d", line)
    .attr("fill", "none")
    .attr("stroke", "#2e7d32")
    .attr("stroke-width", 2.5);

  const breakEven = computeBreakEvenYear(
    yearlyData.map((d) => ({ year: d.year, diesel: d.diesel, electric: d.electric }))
  );

  if (breakEven != null) {
    const bx = x(breakEven);
    const by = y(0);

    g.append("line")
      .attr("x1", bx)
      .attr("x2", bx)
      .attr("y1", 0)
      .attr("y2", iH)
      .attr("stroke", "#2e7d32")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5,3");

    g.append("circle")
      .attr("cx", bx)
      .attr("cy", by)
      .attr("r", 5)
      .attr("fill", "#2e7d32")
      .attr("stroke", "var(--color-surface)")
      .attr("stroke-width", 2);

    g.append("text")
      .attr("x", bx)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("font-size", CHART_FONT_LABEL)
      .attr("font-weight", "700")
      .attr("fill", "#2e7d32")
      .text(`${t("simulation.label_break_even") || "Break-even"}: ${t("simulation.general_year") || "Yr"} ${formatFixed(breakEven, 1)}`);
  }

  el.appendChild(svg.node());
};

const WATERFALL_COLORS = {
  start: "var(--color-danger)",
  end: "#2e7d32",
  saving: "var(--color-success)",
  extra: "var(--color-danger)",
};

const renderWaterfall = (el, tcoData) => {
  if (!el) return;
  el.innerHTML = "";
  if (!Array.isArray(tcoData) || tcoData.length < 2) {
    el.innerHTML = costsStateHtml(
      t("simulation.costs_empty") || "No economic comparison data available."
    );
    return;
  }

  const diesel = tcoData.find((d) => d.category === "equivalent_diesel_bus") ?? tcoData[0];
  const electric = tcoData.find((d) => d.category === "electric_bus") ?? tcoData[1];

  const steps = [
    {
      label: `Δ ${costStackLabel("vehicle")}`,
      value: (electric.vehicle ?? 0) - (diesel.vehicle ?? 0),
      type: "delta",
    },
    {
      label: `Δ ${costStackLabel("energy")}`,
      value: (electric.energy ?? 0) - (diesel.energy ?? 0),
      type: "delta",
    },
    {
      label: `Δ ${costStackLabel("maintenance")}`,
      value: (electric.maintenance ?? 0) - (diesel.maintenance ?? 0),
      type: "delta",
    },
  ];

  let running = 0;
  const bars = steps.map((step) => {
    const prev = running;
    running += step.value;
    return {
      ...step,
      startValue: prev,
      endValue: running,
      y0: Math.min(prev, running),
      y1: Math.max(prev, running),
      runAfter: running,
      color: step.value <= 0 ? WATERFALL_COLORS.saving : WATERFALL_COLORS.extra,
    };
  });

  const margin = { top: 28, right: 24, bottom: 48, left: 72 };
  const W = 620, H = 210;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const minY = d3.min([0, ...bars.map((b) => Math.min(b.startValue, b.endValue))]) ?? 0;
  const maxY = d3.max([0, ...bars.map((b) => Math.max(b.startValue, b.endValue))]) ?? 0;
  const spanY = maxY - minY || 1;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel("simulation.chart_aria_waterfall", "Annual cost waterfall")
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(bars.map((b) => b.label)).range([0, iW]).padding(0.25);
  const y = d3
    .scaleLinear()
    .domain([minY - spanY * 0.1, maxY + spanY * 0.15])
    .nice()
    .range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK)
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-25)");
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatChfAxis))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -54)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(t("simulation.axis_cost_chf_per_year") || "CHF / year");

  bars.forEach((b, i) => {
    g.append("rect")
      .attr("x", x(b.label))
      .attr("y", y(b.y1))
      .attr("height", y(b.y0) - y(b.y1))
      .attr("width", x.bandwidth())
      .attr("fill", b.color)
      .attr("rx", 2);

    if (i > 0) {
      const prevBar = bars[i - 1];
      const prevRight = x(prevBar.label) + x.bandwidth();
      const currLeft = x(b.label);
      const connectorY = y(prevBar.runAfter);
      g.append("line")
        .attr("x1", prevRight)
        .attr("x2", currLeft)
        .attr("y1", connectorY)
        .attr("y2", connectorY)
        .attr("stroke", "var(--color-chart-neutral)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,2");
    }

    const labelY = b.value >= 0 ? y(b.y1) - 5 : y(b.y0) + 14;
    g.append("text")
      .attr("x", x(b.label) + x.bandwidth() / 2)
      .attr("y", Math.min(iH - 4, Math.max(12, labelY)))
      .attr("text-anchor", "middle")
      .attr("font-size", CHART_FONT_LABEL)
      .attr("font-weight", "600")
      .attr("fill", b.color === WATERFALL_COLORS.saving ? "#2e7d32" : b.color === WATERFALL_COLORS.extra ? "var(--color-danger)" : "#1c1c1c")
      .text(
        b.type === "delta"
          ? `${b.value <= 0 ? "" : "+"}${formatChfAxis(Math.round(b.value))}`
          : formatChfAxis(Math.round(b.value))
      );
  });

  el.appendChild(svg.node());
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

const attachCostsLineHover = ({
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

  const visiblePath = layer
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
    .attr("fill", "var(--color-surface)")
    .attr("stroke", color)
    .attr("stroke-width", 2);

  const tooltip = focus.append("g");
  const tooltipBg = tooltip
    .append("rect")
    .attr("fill", "var(--color-tooltip-surface)")
    .attr("stroke", color)
    .attr("stroke-width", 1)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("opacity", 0.96);
  const tooltipText = tooltip
    .append("text")
    .attr("fill", "var(--color-tooltip-text)")
    .attr("font-size", CHART_FONT_TOOLTIP);

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

  return visiblePath;
};

const renderCostsLine = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  if (!Array.isArray(data) || data.length === 0) {
    el.innerHTML = costsStateHtml(
      t("simulation.costs_empty") || "No economic comparison data available."
    );
    return;
  }
  const margin = { top: 14, right: 24, bottom: 30, left: 84 };
  const W = chartCanvasWidth(el, () => renderCostsLine(el, data));
  const H = CHART_PLOT_HEIGHT;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_cost_trend",
      "Projected cumulative present-value cost trend"
    )
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const tickYears = Array.from(new Set(data.map((d) => d.year)));

  const x = d3.scaleLinear()
    .domain(d3.extent(data, (d) => d.year))
    .range([0, iW]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(data, (d) => Math.max(d.diesel, d.electric)) * 1.1])
    .nice()
    .range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickValues(tickYears).tickFormat((d) => `${d}`))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);
  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatChfAxisWithUnit))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);
  gridLines(g, y, iW);

  const dieselLine = d3.line().x((d) => x(d.year)).y((d) => y(d.diesel));
  const elecLine = d3.line().x((d) => x(d.year)).y((d) => y(d.electric));
  const dieselLayer = g.append("g");
  const electricLayer = g.append("g");

  attachCostsLineHover({
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
  attachCostsLineHover({
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

const modeLabel = (key) =>
  ({
    battery_only: t("simulation.mode_battery_only"),
    charging_only: t("simulation.mode_charging"),
    joint: t("simulation.mode_joint"),
  })[key] ?? key;

const resolveSimulationType = (optimizationRun = {}, options = {}) =>
  modeLabel(
    firstText(
      optimizationRun?.input_params?.mode,
      optimizationRun?.input_params?.optimization_mode,
      optimizationRun?.mode,
      optimizationRun?.optimization_mode,
      options?.optimizationMode
    )
  ) || "—";

/* ── Efficiency tab recap table ──────────────────────────────── */

const formatPct = (val) => {
  const n = Number(val);
  return Number.isNaN(n) ? "—" : `${(n * 100).toFixed(0)}%`;
};

const formatFixed = (val, dec = 1) => {
  const n = Number(val);
  return Number.isNaN(n) ? "—" : n.toLocaleString("de-CH", { maximumFractionDigits: dec, minimumFractionDigits: dec });
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttr = (value) => escapeHtml(value).replace(/\n/g, "&#10;");

const toFiniteNumber = (value) => {
  if (value === "" || (typeof value === "string" && value.trim() === "")) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toOptionalFiniteNumber = (value) => {
  if (value === null || value === undefined) return null;
  return toFiniteNumber(value);
};

const normalizeSocFraction = (value) => {
  const numeric = toOptionalFiniteNumber(value);
  if (numeric == null) return null;
  return numeric > 1 ? numeric / 100 : numeric;
};

const resolveUsableSocFraction = (inputParams = {}) => {
  const minSoc = normalizeSocFraction(inputParams?.min_soc);
  const maxSoc = normalizeSocFraction(inputParams?.max_soc);

  if (minSoc != null && maxSoc != null && maxSoc >= minSoc) {
    return maxSoc - minSoc;
  }

  return normalizeSocFraction(
    inputParams?.usable_soc_percent ?? inputParams?.usableSocPercent
  );
};

const applyUsableSocWindow = (nominalKwh, usableSocFraction) => {
  const nominal = toOptionalFiniteNumber(nominalKwh);
  if (nominal == null) return null;
  if (usableSocFraction === null || usableSocFraction === undefined) return nominal;
  const usable = toFiniteNumber(usableSocFraction);
  return usable == null ? nominal : nominal * usable;
};

const buildUsableSocCapacityNoteHtml = () => "";

const buildUsableSocTooltip = ({
  inputParams = {},
  nominalKwh = null,
  usableKwh = null,
} = {}) => {
  const base =
    t("simulation.opt_usable_soc_tooltip") ||
    "This kWh value applies the min/max SoC window: usable kWh = nominal kWh * (max SoC - min SoC).";
  const minSoc = normalizeSocFraction(inputParams?.min_soc);
  const maxSoc = normalizeSocFraction(inputParams?.max_soc);
  const usableSoc = resolveUsableSocFraction(inputParams);
  const nominal = toOptionalFiniteNumber(nominalKwh);
  const usable = toOptionalFiniteNumber(usableKwh);

  if (minSoc == null || maxSoc == null || usableSoc == null || nominal == null || usable == null) {
    return base;
  }

  const caseLine =
    t("simulation.opt_usable_soc_tooltip_case", {
      nominal_kwh: formatFixed(nominal, 0),
      usable_soc: formatPct(usableSoc),
      usable_kwh: formatFixed(usable, 0),
      min_soc: formatPct(minSoc),
      max_soc: formatPct(maxSoc),
    }) ||
    `In this case ${formatFixed(nominal, 0)} kWh x ${formatPct(
      usableSoc
    )} = ${formatFixed(usable, 0)} kWh (${formatPct(minSoc)}-${formatPct(maxSoc)}).`;

  return `${base}\n${caseLine}`;
};

const usableSocInfoLabelHtml = (label, tooltipOptions = {}) => {
  const tooltip = buildUsableSocTooltip(tooltipOptions);

  return `<span class="efficiency-label-with-info">${escapeHtml(
    label
  )}<span class="efficiency-info-icon" tabindex="0" role="img" aria-label="${escapeAttr(
    tooltip
  )}" title="${escapeAttr(tooltip)}">i</span></span>`;
};

const maxUsableLimitCellHtml = (maxUsableKwh, shiftConsumptionKwh) => {
  if (maxUsableKwh == null) return "—";
  const comparison = toOptionalFiniteNumber(shiftConsumptionKwh);
  const valueHtml = formatFixed(maxUsableKwh, 0);

  if (comparison == null || maxUsableKwh >= comparison) {
    return valueHtml;
  }

  const message =
    t("simulation.opt_max_usable_limit_exceeded", {
      consumption_kwh: formatFixed(comparison, 0),
    }) ||
    `Limit exceeded: shift needs ${formatFixed(comparison, 0)} kWh.`;

  return `<span class="efficiency-limit-cell">
    <span>${valueHtml}</span>
    <span class="efficiency-limit-cell__warning" title="${escapeAttr(message)}">${escapeHtml(message)}</span>
  </span>`;
};

const chartEmptyStateHtml = () =>
  `<p class="efficiency-chart-empty">${textContent(
    t("simulation.efficiency_chart_empty") || "No chart data available."
  )}</p>`;

const HEATING_LABELS = {
  default: "simulation.heating_default",
  hp: "simulation.heating_hp",
  electric: "simulation.heating_electric",
  diesel: "simulation.heating_diesel",
  "ebus-dh": "simulation.heating_diesel",
};

const formatTemperatureValue = (value) => {
  const numeric = toFiniteNumber(value);
  return numeric == null ? null : `${numeric} °C`;
};

const formatOccupancyValue = (value) => {
  const numeric = toFiniteNumber(value);
  return numeric == null ? null : `${numeric}%`;
};

const formatHeatingTypeValue = (value) => {
  const heatingType = firstText(value);
  if (!heatingType) return null;
  return t(HEATING_LABELS[heatingType]) || heatingType;
};

const formatSocValue = (value) => {
  const numeric = toFiniteNumber(value);
  return numeric == null ? null : formatPct(numeric);
};

const compactFieldEntries = (entries = {}) =>
  Object.fromEntries(
    Object.entries(entries).filter(
      ([, value]) => value !== null && value !== undefined && value !== ""
    )
  );

const SOLVER_STATUS_CLASS = {
  optimal: "badge--positive",
  feasible: "badge--positive",
  infeasible: "badge--negative",
  error: "badge--negative",
};

const OPTIMIZATION_BATTERY_COLORS = {
  base: "var(--color-chart-track)",
  optimized: "#abe828",
};

const matchesSelectedShift = (batteryResult = {}, shiftKey = "", viewOptions = {}) => {
  const selectedShiftId = firstText(viewOptions?.selectedShiftId);
  const selectedShiftName = firstText(viewOptions?.selectedShiftName);

  if (!selectedShiftId && !selectedShiftName) return true;
  if (selectedShiftId && firstText(batteryResult?.shift_id, shiftKey) === selectedShiftId) {
    return true;
  }
  if (selectedShiftName && firstText(batteryResult?.shift_name) === selectedShiftName) {
    return true;
  }
  return false;
};

const buildOptimizationResultsHtml = (results, inputParams = {}, viewOptions = {}) => {
  if (!results || typeof results !== "object" || !Object.keys(results).length) return "";

  const usableSocFraction = resolveUsableSocFraction(inputParams);
  const usableSocNoteHtml = buildUsableSocCapacityNoteHtml(inputParams);

  const electSummary = results.electrification_summary ?? {};
  let electrificationSummaryHtml = "";
  if (electSummary.status === "infeasible") {
    const infeasibleBuses = Array.isArray(electSummary.infeasible_buses) ? electSummary.infeasible_buses : [];
    const predictedShiftConsumptionKwh = toOptionalFiniteNumber(
      viewOptions?.predictedShiftConsumptionMedianKwh ??
      viewOptions?.costInputs?.predictedShiftConsumptionMedianKwh ??
      viewOptions?.predictedShiftConsumptionKwh ??
      viewOptions?.costInputs?.predictedShiftConsumptionKwh
    );
    const uniqueByShift = [];
    const seenShifts = new Set();
    for (const bus of infeasibleBuses) {
      const key = bus.shift_id ?? bus.shift_name ?? "";
      if (key && seenShifts.has(key)) continue;
      if (key) seenShifts.add(key);
      uniqueByShift.push(bus);
    }

    let electSummaryRequiredTooltipOptions = {};
    let electSummaryMaxTooltipOptions = {};
    const detailRows = uniqueByShift.map((bus) => {
      const req = toFiniteNumber(bus.required_total_packs);
      const max = toFiniteNumber(bus.max_physical_packs);
      const over = req != null && max != null && req > max;
      const bo = over ? "<strong>" : "";
      const bc = over ? "</strong>" : "";
      const maxPhysicalKwh = toOptionalFiniteNumber(bus.max_physical_kwh);
      const electSummaryKwhPerPack =
        maxPhysicalKwh != null && max > 0
          ? maxPhysicalKwh / max
          : null;
      const requiredNominalKwh =
        toOptionalFiniteNumber(bus.required_total_kwh) ??
        (req != null && electSummaryKwhPerPack != null
          ? req * electSummaryKwhPerPack
          : null);
      const requiredUsableKwh = applyUsableSocWindow(
        requiredNominalKwh,
        usableSocFraction
      );
      const maxUsableKwh = applyUsableSocWindow(
        maxPhysicalKwh,
        usableSocFraction
      );
      if (uniqueByShift.length === 1) {
        electSummaryRequiredTooltipOptions = {
          inputParams,
          nominalKwh: requiredNominalKwh,
          usableKwh: requiredUsableKwh,
        };
        electSummaryMaxTooltipOptions = {
          inputParams,
          nominalKwh: maxPhysicalKwh,
          usableKwh: maxUsableKwh,
        };
      }
      return `
      <tr>
        <td>${textContent(bus.shift_name ?? "—")}</td>
        <td class="efficiency-td-num">${bo}${textContent(String(bus.required_total_packs ?? "—"))}${bc}</td>
        <td class="efficiency-td-num">${bo}${requiredUsableKwh == null ? "—" : formatFixed(requiredUsableKwh, 0)}${bc}</td>
        <td class="efficiency-td-num">${textContent(String(bus.max_physical_packs ?? "—"))}</td>
        <td class="efficiency-td-num">${maxUsableLimitCellHtml(maxUsableKwh, predictedShiftConsumptionKwh)}</td>
        <td class="efficiency-td-num">${textContent(String(bus.excess_packs ?? 0))}</td>
      </tr>`;
    }).join("");

    const detailTableHtml = uniqueByShift.length ? `
      <div class="efficiency-table-wrap">
        <table class="efficiency-table">
          <thead>
            <tr>
              <th class="efficiency-th-text">${textContent(t("simulation.opt_col_shift") || "Shift")}</th>
              <th>${textContent(t("simulation.opt_col_required_packs") || "Required Packs")}</th>
              <th>${usableSocInfoLabelHtml(t("simulation.opt_col_required_usable_kwh") || "Required usable (kWh)", electSummaryRequiredTooltipOptions)}</th>
              <th>${textContent(t("simulation.opt_col_max_packs") || "Max Physical Packs")}</th>
              <th>${usableSocInfoLabelHtml(t("simulation.opt_col_max_usable_kwh") || "Max usable (kWh)", electSummaryMaxTooltipOptions)}</th>
              <th>${textContent(t("simulation.opt_col_excess") || "Excess Packs")}</th>
            </tr>
          </thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>` : "";

    electrificationSummaryHtml = detailTableHtml
      ? `
      <div class="efficiency-infeasibility-notice">
        ${detailTableHtml}
      </div>`
      : "";
  }

  const batteryResults = results.battery_results ?? {};
  const batteryEntries = Object.entries(batteryResults).filter(([shiftKey, result]) =>
    matchesSelectedShift(result, shiftKey, viewOptions)
  );

  let batteryTableHtml = "";
  if (batteryEntries.length) {
    let batteryOptimizedTooltipOptions = {};
    const rows = batteryEntries.map(([, b]) => {
      const physFeasible = b.physical_feasible;
      const feasBadge = physFeasible === true
        ? "badge--positive"
        : physFeasible === false
          ? "badge--negative"
          : "badge--neutral";
      const reqPacks = toFiniteNumber(b.required_total_packs);
      const maxPacks = toFiniteNumber(b.max_physical_packs);
      const overLimit = reqPacks != null && maxPacks != null && reqPacks > maxPacks;
      const bOpen = overLimit ? "<strong>" : "";
      const bClose = overLimit ? "</strong>" : "";
      const optimizedKwh = resolveOptimizedInstalledNominalKwh({
        batteryEntry: b,
        batteryResults,
        viewOptions,
      });
      const optimizedUsableKwh = applyUsableSocWindow(
        optimizedKwh,
        usableSocFraction
      );
      if (batteryEntries.length === 1) {
        batteryOptimizedTooltipOptions = {
          inputParams,
          nominalKwh: optimizedKwh,
          usableKwh: optimizedUsableKwh,
        };
      }
      return `
      <tr>
        <td class="efficiency-td-num efficiency-td-highlight">${textContent(String(b.optimized_packs ?? "—"))}</td>
        <td class="efficiency-td-num efficiency-td-highlight">${optimizedUsableKwh == null ? "—" : formatFixed(optimizedUsableKwh, 0)}</td>
        <td class="efficiency-td-num">${textContent(String(b.max_physical_packs ?? "—"))}</td>
        <td class="efficiency-td-num">${bOpen}${textContent(String(b.required_total_packs ?? "—"))}${bClose}</td>
        <td class="efficiency-td-num">${textContent(String(b.excess_packs ?? 0))}</td>
        <td><span class="badge badge--compact ${feasBadge}">${textContent(
          physFeasible === true ? (t("simulation.feasibility_feasible") || "Feasible") :
          physFeasible === false ? (t("simulation.feasibility_infeasible") || "Infeasible") : "—"
        )}</span></td>
      </tr>`;
    }).join("");

    batteryTableHtml = `
      <h4 class="efficiency-subsection-title">${textContent(t("simulation.opt_battery_results") || "Battery Sizing Results")}</h4>
      <div class="efficiency-table-wrap">
        <table class="efficiency-table">
          <thead>
            <tr>
              <th>${textContent(t("simulation.opt_col_opt_packs") || "Optimized Packs")}</th>
              <th>${usableSocInfoLabelHtml(
                t("simulation.opt_col_opt_usable_kwh") || "Optimized usable (kWh)",
                batteryOptimizedTooltipOptions
              )}</th>
              <th>${textContent(t("simulation.opt_col_max_packs") || "Max Physical")}</th>
              <th>${textContent(t("simulation.opt_col_required_packs") || "Required")}</th>
              <th>${textContent(t("simulation.opt_col_excess") || "Excess")}</th>
              <th class="efficiency-th-text">${textContent(t("simulation.opt_col_feasibility") || "Feasibility")}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  return `
    <div class="efficiency-section">
      <h3 class="efficiency-section-title">${textContent(t("simulation.opt_section_title") || "Optimization Results")}</h3>
      ${usableSocNoteHtml}
      ${electrificationSummaryHtml}
      ${batteryTableHtml}
    </div>`;
};

const buildOptimizationBatteryChartData = (batteryResults = {}, viewOptions = {}) =>
  Object.entries(batteryResults ?? {})
    .filter(([shiftKey, result]) => matchesSelectedShift(result, shiftKey, viewOptions))
    .map(([shiftKey, result], index) => ({
      shiftName:
        result?.shift_name ??
        shiftKey ??
        `${t("simulation.opt_col_shift") || "Shift"} ${index + 1}`,
      basePacks: toFiniteNumber(result?.base_packs),
      optimizedPacks: toFiniteNumber(result?.optimized_packs),
    }))
    .filter((row) => row.basePacks != null || row.optimizedPacks != null);

const deriveSocKwh = (batteryCapacityKwh, socFraction) => {
  const capacity = toFiniteNumber(batteryCapacityKwh);
  const soc = toFiniteNumber(socFraction);

  if (capacity == null || soc == null) return null;
  return capacity * soc;
};

const buildUnifiedPredictionData = (predictionRuns, perBusSummary, batteryResults = {}, viewOptions = {}) => {
  const allRuns = [...(predictionRuns ?? [])];
  const selectedShiftId = firstText(viewOptions?.selectedShiftId);
  const minSocFraction = toFiniteNumber(viewOptions?.inputParams?.min_soc);
  const maxSocFraction = toFiniteNumber(viewOptions?.inputParams?.max_soc);

  const filtered = selectedShiftId
    ? allRuns.filter((run) => firstText(run?.shift_id) === selectedShiftId)
    : allRuns;

  const sorted = filtered.sort((a, b) =>
    Number(a?.contextual_parameters?.num_battery_packs ?? 0) - Number(b?.contextual_parameters?.num_battery_packs ?? 0)
  );

  const perBusArr = Array.isArray(perBusSummary) ? perBusSummary : [];
  const filteredPerBus = selectedShiftId
    ? perBusArr.filter((entry) => firstText(entry?.shift_id) === selectedShiftId)
    : perBusArr;

  const optimizedPackSet = new Set(
    Object.entries(batteryResults ?? {})
      .filter(([shiftKey, result]) =>
        !selectedShiftId || firstText(result?.shift_id, shiftKey) === selectedShiftId
      )
      .map(([, result]) => toFiniteNumber(result?.optimized_packs))
      .filter((value) => value != null)
  );

  const rows = sorted.map((run) => {
    const cp = run?.contextual_parameters ?? {};
    const s = run?.summary ?? {};
    const packs = toFiniteNumber(cp.num_battery_packs);
    const batteryCapacityKwh = toFiniteNumber(cp.battery_capacity_kwh);
    const totalConsumptionMedianKwh = readPredictionTotalQuantileValue(s, {
      kind: "absolute",
      quantileKey: "q50",
    });
    const totalConsumptionQ95Kwh = readPredictionTotalQuantileValue(s, {
      kind: "absolute",
      quantileKey: "q95",
    });
    const consumptionPerKmMedianKwh = readPredictionTotalQuantileValue(s, {
      kind: "per_km",
      quantileKey: "q50",
    });
    const consumptionPerKmQ95Kwh = readPredictionTotalQuantileValue(s, {
      kind: "per_km",
      quantileKey: "q95",
    });
    const matchedBus = filteredPerBus.find((entry) => {
      const entryPacks = toFiniteNumber(entry?.optimized_packs ?? entry?.num_battery_packs);
      return entryPacks != null && entryPacks === packs;
    }) ?? {};

    return {
      numBatteryPacks: packs,
      batteryCapacityKwh,
      totalWeightKg: toFiniteNumber(cp.total_weight_kg),
      totalDistanceKm: toFiniteNumber(s.total_distance_km),
      totalConsumptionKwh: toFiniteNumber(s.total_consumption_kwh),
      totalConsumptionMedianKwh,
      totalConsumptionQ95Kwh,
      consumptionPerKmKwh: toFiniteNumber(s.consumption_per_km_kwh),
      consumptionPerKmMedianKwh,
      consumptionPerKmQ95Kwh,
      totalDrivetrainKwh: toFiniteNumber(s.total_drivetrain_kwh),
      totalAuxiliaryKwh: toFiniteNumber(s.total_auxiliary_kwh),
      minSocKwh:
        deriveSocKwh(batteryCapacityKwh, minSocFraction) ??
        toFiniteNumber(matchedBus.min_soc_kwh),
      maxSocKwh:
        deriveSocKwh(batteryCapacityKwh, maxSocFraction) ??
        toFiniteNumber(matchedBus.max_soc_kwh),
    };
  });

  if (!optimizedPackSet.size) {
    const bestRow = rows.reduce((best, row) => {
      if (row.consumptionPerKmMedianKwh == null) return best;
      if (!best || row.consumptionPerKmMedianKwh < best.consumptionPerKmMedianKwh) {
        return row;
      }
      return best;
    }, null);
    if (bestRow?.numBatteryPacks != null) {
      optimizedPackSet.add(bestRow.numBatteryPacks);
    }
  }

  return rows.map((row) => ({
    ...row,
    isOptimized:
      row.numBatteryPacks != null && optimizedPackSet.has(row.numBatteryPacks),
  }));
};

const formatOptionalFixed = (val, dec = 1) =>
  val === null || val === undefined ? "—" : formatFixed(val, dec);

const buildUnifiedPredictionRows = (rows, { includePerBus = false } = {}) =>
  rows.map((row) => `
      <tr>
        <td class="efficiency-td-num">${textContent(String(row.numBatteryPacks ?? "—"))}</td>
        <td class="efficiency-td-num">${formatFixed(row.batteryCapacityKwh, 0)}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalWeightKg, 0)}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalDistanceKm, 1)}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalConsumptionKwh, 1)}</td>
        <td class="efficiency-td-num efficiency-td-highlight">${formatFixed(row.consumptionPerKmKwh, 3)}</td>
        <td class="efficiency-td-num">${formatOptionalFixed(row.totalConsumptionMedianKwh, 1)}</td>
        <td class="efficiency-td-num">${formatOptionalFixed(row.totalConsumptionQ95Kwh, 1)}</td>
        <td class="efficiency-td-num">${formatOptionalFixed(row.consumptionPerKmMedianKwh, 3)}</td>
        <td class="efficiency-td-num">${formatOptionalFixed(row.consumptionPerKmQ95Kwh, 3)}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalDrivetrainKwh, 1)}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalAuxiliaryKwh, 1)}</td>
        ${includePerBus
          ? `<td class="efficiency-td-num">${formatFixed(row.minSocKwh, 0)}</td>
        <td class="efficiency-td-num">${formatFixed(row.maxSocKwh, 0)}</td>`
          : ""}
      </tr>`)
    .join("");

const PREDICTION_QUANTILE_KEYS = ["q05", "q50", "q95"];
const PREDICTION_CONSUMPTION_COLORS = {
  drivetrain: "#6fbeec",
  auxiliary: "#f5a623",
  total: "#00639a",
};
const PREDICTION_QUANTILE_SERIES_COLORS = {
  q05: "#6fbeec",
  q50: "#00639a",
  q95: "#f5a623",
};

const predictionConsumptionLabel = (key) =>
  ({
    drivetrain:
      t("simulation.predictions_consumption_drivetrain") || "Drivetrain",
    auxiliary:
      t("simulation.predictions_consumption_auxiliary") || "Auxiliary",
    total: t("simulation.predictions_consumption_total") || "Total",
  })[key] ?? key;

const readPredictionQuantiles = (summary = {}, candidateKeys = []) => {
  const sourceKey = candidateKeys.find((key) => {
    const value = summary?.[key];
    return value && typeof value === "object" && !Array.isArray(value);
  });
  const source = sourceKey ? summary[sourceKey] : {};

  return Object.fromEntries(
    PREDICTION_QUANTILE_KEYS.map((key) => [key, toFiniteNumber(source?.[key])])
  );
};

const hasPredictionQuantiles = (quantiles = {}) =>
  PREDICTION_QUANTILE_KEYS.some((key) => quantiles?.[key] != null);

const readPredictionTotalQuantiles = (
  summary = {},
  { kind = "absolute" } = {}
) =>
  readPredictionQuantiles(
    summary,
    kind === "per_km"
      ? [
          "consumption_per_km_kwh_quantiles",
          "total_consumption_per_km_kwh_quantiles",
          "total_per_km_kwh_quantiles",
        ]
      : ["quantiles", "total_quantiles", "consumption_quantiles"]
  );

const readPredictionTotalQuantileValue = (
  summary = {},
  { kind = "absolute", quantileKey = "q50" } = {}
) => toFiniteNumber(readPredictionTotalQuantiles(summary, { kind })?.[quantileKey]);

const subtractPredictionQuantiles = (total = {}, drivetrain = {}) =>
  Object.fromEntries(
    PREDICTION_QUANTILE_KEYS.map((key) => {
      const totalValue = toFiniteNumber(total?.[key]);
      const drivetrainValue = toFiniteNumber(drivetrain?.[key]);
      return [
        key,
        totalValue != null && drivetrainValue != null
          ? totalValue - drivetrainValue
          : null,
      ];
    })
  );

const buildPredictionQuantileRows = (summary = {}, kind = "absolute") => {
  const isPerKm = kind === "per_km";
  const totalQuantiles = readPredictionTotalQuantiles(summary, {
    kind: isPerKm ? "per_km" : "absolute",
  });
  const drivetrainQuantiles = readPredictionQuantiles(
    summary,
    isPerKm ? ["drivetrain_per_km_kwh_quantiles"] : ["drivetrain_quantiles"]
  );
  const auxiliaryQuantilesDirect = readPredictionQuantiles(
    summary,
    isPerKm ? ["auxiliary_per_km_kwh_quantiles"] : ["auxiliary_quantiles"]
  );
  const auxiliaryQuantiles = hasPredictionQuantiles(auxiliaryQuantilesDirect)
    ? auxiliaryQuantilesDirect
    : subtractPredictionQuantiles(totalQuantiles, drivetrainQuantiles);

  return [
    {
      key: "drivetrain",
      label: predictionConsumptionLabel("drivetrain"),
      mean: toFiniteNumber(
        isPerKm ? summary?.drivetrain_per_km_kwh : summary?.total_drivetrain_kwh
      ),
      quantiles: drivetrainQuantiles,
      derived: false,
    },
    {
      key: "auxiliary",
      label: predictionConsumptionLabel("auxiliary"),
      mean: toFiniteNumber(
        isPerKm ? summary?.auxiliary_per_km_kwh : summary?.total_auxiliary_kwh
      ),
      quantiles: auxiliaryQuantiles,
      derived: !hasPredictionQuantiles(auxiliaryQuantilesDirect),
    },
    {
      key: "total",
      label: predictionConsumptionLabel("total"),
      mean: toFiniteNumber(
        isPerKm ? summary?.consumption_per_km_kwh : summary?.total_consumption_kwh
      ),
      quantiles: totalQuantiles,
      derived: false,
    },
  ].filter((row) => row.mean != null || hasPredictionQuantiles(row.quantiles));
};

const buildPredictionScenarioTitle = (run = {}, index = 0) => {
  const packs = toFiniteNumber(run?.contextual_parameters?.num_battery_packs);
  if (packs != null) {
    return translateOr(
      "simulation.predictions_scenario_title",
      `Scenario ${formatFixed(packs, 0)} packs`,
      { packs: formatFixed(packs, 0) }
    );
  }

  return translateOr(
    "simulation.predictions_scenario_fallback",
    `Scenario ${index + 1}`,
    { index: String(index + 1) }
  );
};

const renderPredictionsQuantileTable = (
  title,
  rows,
  { decimals = 1, unit = "", chartRole = "" } = {}
) => `
  <section class="predictions-card-section">
    <div class="predictions-card-section__header">
      <h4>${textContent(title)}</h4>
      <span class="predictions-card-section__unit">${textContent(unit)}</span>
    </div>
    <div
      class="chart-container predictions-chart-container"
      data-predictions-chart="${textContent(chartRole)}"
    ></div>
    <div
      class="chart-legend predictions-chart-legend"
      data-predictions-legend="${textContent(chartRole)}"
    ></div>
    <div class="predictions-table-wrap">
      <table class="predictions-table">
        <thead>
          <tr>
            <th>${textContent(
              t("simulation.predictions_col_consumption") || "Consumption"
            )}</th>
            <th>${textContent(t("simulation.predictions_col_q05") || "Q05")}</th>
            <th>${textContent(t("simulation.predictions_col_q50") || "Q50")}</th>
            <th>${textContent(t("simulation.predictions_col_q95") || "Q95")}</th>
            <th>${textContent(t("simulation.predictions_col_mean") || "Mean")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <th scope="row">${textContent(row.label)}</th>
                  <td>${textContent(formatFixed(row.quantiles?.q05, decimals))}</td>
                  <td>${textContent(formatFixed(row.quantiles?.q50, decimals))}</td>
                  <td>${textContent(formatFixed(row.quantiles?.q95, decimals))}</td>
                  <td>${textContent(formatFixed(row.mean, decimals))}</td>
                </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </section>`;

const buildPredictionChartData = (rows = []) =>
  PREDICTION_QUANTILE_KEYS.map((quantileKey) => ({
    quantileKey,
    quantileLabel: quantileKey.toUpperCase(),
    ...Object.fromEntries(
      rows.map((row) => [row.key, toFiniteNumber(row?.quantiles?.[quantileKey])])
    ),
  })).filter((item) =>
    rows.some((row) => item?.[row.key] != null)
  );

const renderPredictionsChartLegend = (el, rows = []) => {
  if (!el) return;
  el.innerHTML = rows
    .map(
      (row) => `
        <div class="chart-legend-item">
          <span class="chart-legend-swatch" style="background:${PREDICTION_CONSUMPTION_COLORS[row.key] ?? "#00639a"}"></span>
          ${textContent(row.label)}
        </div>`
    )
    .join("");
};

const buildPredictionOverviewData = (
  runs = [],
  { kind = "absolute" } = {}
) =>
  runs
    .map((run, index) => {
      const summary = run?.summary ?? {};
      const packs = toFiniteNumber(run?.contextual_parameters?.num_battery_packs);
      const totalQuantiles = readPredictionTotalQuantiles(summary, { kind });

      return {
        scenarioLabel:
          packs != null ? formatFixed(packs, 0) : String(index + 1),
        scenarioTitle: buildPredictionScenarioTitle(run, index),
        q05: toFiniteNumber(totalQuantiles?.q05),
        q50: toFiniteNumber(totalQuantiles?.q50),
        q95: toFiniteNumber(totalQuantiles?.q95),
      };
    })
    .filter((item) => item.q05 != null || item.q50 != null || item.q95 != null);

const resolvePredictionOverviewSeriesKeys = (data = []) =>
  PREDICTION_QUANTILE_KEYS.filter((key) =>
    (Array.isArray(data) ? data : []).some((row) => toFiniteNumber(row?.[key]) != null)
  );

const TRIP_PREDICTION_CACHE = new Map();
const TRIP_STOP_LOOKUP_CACHE = new Map();
const TRIP_STOP_EDGES_CACHE = new Map();

const extractTripPredictionRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return [
    payload.items,
    payload.predictions,
    payload.data,
    payload.results,
  ].find(Array.isArray) ?? [];
};

const readTripQuantileValue = (row = {}, quantileKey = "q50") => {
  const quantiles =
    row?.quantiles && typeof row.quantiles === "object" && !Array.isArray(row.quantiles)
      ? row.quantiles
      : {};
  const aliases = {
    q05: ["q05", "0.05", "0.050", "5", "p05", "P05"],
    q50: ["q50", "0.5", "0.50", "0.500", "50", "p50", "P50"],
    q95: ["q95", "0.95", "0.950", "95", "p95", "P95"],
  };

  for (const key of aliases[quantileKey] ?? [quantileKey]) {
    const value = toOptionalFiniteNumber(quantiles?.[key] ?? row?.[key]);
    if (value != null) return value;
  }
  return null;
};

const tripPredictionLabel = (row = {}, index = 0) => {
  const sequence = toFiniteNumber(
    row?.sequence_number ?? row?.sequence ?? row?.trip_sequence ?? row?.trip_index
  );
  if (sequence != null) return formatFixed(sequence, 0);
  const tripId = firstText(row?.trip_id, row?.tripId, row?.id).trim();
  return tripId ? tripId.slice(0, 8) : String(index + 1);
};

const extractStopRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return [
    payload.items,
    payload.stops,
    payload.stop_times,
    payload.stopTimes,
    payload.data,
    payload.results,
  ].find(Array.isArray) ?? [];
};

const stopSequenceValue = (stop = {}, fallback = 0) =>
  toFiniteNumber(stop?.stop_sequence ?? stop?.stopSequence ?? stop?.sequence) ?? fallback;

const fetchTripStopEdgesCached = async (tripId) => {
  const id = firstText(tripId).trim();
  if (!id) return null;
  if (TRIP_STOP_EDGES_CACHE.has(id)) return TRIP_STOP_EDGES_CACHE.get(id);

  const promise = fetchStopsByTripId(id)
    .then((payload) => {
      const stops = extractStopRows(payload)
        .map((stop, index) => ({ stop, index }))
        .sort((a, b) =>
          stopSequenceValue(a.stop, a.index) - stopSequenceValue(b.stop, b.index)
        )
        .map(({ stop }) => stop);
      const firstStop = stops[0] ?? null;
      const lastStop = stops[stops.length - 1] ?? null;

      return {
        startStop: resolveStopName(firstStop),
        endStop: resolveStopName(lastStop),
      };
    })
    .catch((error) => {
      console.warn("[elettra] Unable to load trip stops for uncertainty tooltip:", error);
      return null;
    });

  TRIP_STOP_EDGES_CACHE.set(id, promise);
  return promise;
};

const buildTripStopLookupForRows = async (rows = [], baseLookup = new Map()) => {
  const lookup = new Map(baseLookup instanceof Map ? baseLookup : []);
  const tripIds = [
    ...new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row) => firstText(row?.trip_id, row?.tripId).trim())
        .filter(Boolean)
    ),
  ].filter((id) => {
    const existing = lookup.get(id);
    return !existing?.startStop || !existing?.endStop;
  });

  await Promise.all(
    tripIds.map(async (tripId) => {
      const edges = await fetchTripStopEdgesCached(tripId);
      if (edges?.startStop || edges?.endStop) {
        lookup.set(tripId, {
          ...lookup.get(tripId),
          ...edges,
        });
      }
    })
  );

  return lookup;
};

const resolveTripStopInfo = (row = {}, tripStopLookup = new Map()) => {
  const tripId = firstText(row?.trip_id, row?.tripId, row?.id).trim();
  const lookupEntry = tripId && tripStopLookup instanceof Map
    ? tripStopLookup.get(tripId)
    : null;

  return {
    startStop: resolveStopName(
      row?.start_stop_name,
      row?.startStopName,
      row?.start_stop,
      row?.startStop,
      row?.origin_stop_name,
      row?.originStopName,
      row?.origin_stop,
      row?.originStop,
      lookupEntry?.startStop
    ),
    endStop: resolveStopName(
      row?.end_stop_name,
      row?.endStopName,
      row?.end_stop,
      row?.endStop,
      row?.destination_stop_name,
      row?.destinationStopName,
      row?.destination_stop,
      row?.destinationStop,
      lookupEntry?.endStop
    ),
  };
};

const formatTripTooltipTitle = (row = {}) => {
  if (row.startStop && row.endStop) {
    return `${translateOr("simulation.trip_uncertainty_trip", "Trip")}: ${row.startStop} -> ${row.endStop}`;
  }
  if (row.startStop || row.endStop) {
    return `${translateOr("simulation.trip_uncertainty_trip", "Trip")}: ${row.startStop || "—"} -> ${row.endStop || "—"}`;
  }
  return `${translateOr("simulation.trip_uncertainty_trip", "Trip")}: ${row.label}`;
};

const normalizeTripPredictionRow = (row = {}, index = 0, tripStopLookup = new Map()) => {
  const q50 = readTripQuantileValue(row, "q50");
  const median = q50 ?? toOptionalFiniteNumber(row?.prediction_median_kwh);
  const { startStop, endStop } = resolveTripStopInfo(row, tripStopLookup);

  return {
    index: index + 1,
    label: tripPredictionLabel(row, index),
    tripId: firstText(row?.trip_id, row?.tripId, row?.id).trim(),
    startStop,
    endStop,
    q05: readTripQuantileValue(row, "q05"),
    q50,
    q95: readTripQuantileValue(row, "q95"),
    median,
    medianSource: q50 != null ? "q50" : row?.prediction_median_kwh != null ? "prediction_median_kwh" : null,
    drivetrainKwh: toOptionalFiniteNumber(row?.drivetrain_kwh),
    auxiliaryKwh: toOptionalFiniteNumber(row?.auxiliary_kwh),
    massSensitivityKwhPerKwhBatt: toOptionalFiniteNumber(row?.mass_sensitivity_kwh_per_kwh_batt),
  };
};

const buildTripUncertaintyChartData = (rows = [], tripStopLookup = new Map()) =>
  (Array.isArray(rows) ? rows : [])
    .map((row, index) => normalizeTripPredictionRow(row, index, tripStopLookup))
    .filter(
      (row) =>
        row.q05 != null ||
        row.q50 != null ||
        row.q95 != null ||
        row.median != null
    );

const tripUncertaintyEmptyHtml = (message) =>
  `<p class="efficiency-chart-empty predictions-trip-empty">${textContent(message)}</p>`;

const renderTripUncertaintyLegend = (
  el,
  { hasBand = false, hasMedian = false } = {}
) => {
  if (!el) return;
  const items = [
    ...(hasBand
      ? [{
          label: translateOr("simulation.trip_uncertainty_spread", "Q05-Q95 spread"),
          color: "rgba(0, 99, 154, 0.18)",
        }]
      : []),
    ...(hasMedian
      ? [{
          label: translateOr("simulation.trip_uncertainty_median", "Q50 / median"),
          color: PREDICTION_QUANTILE_SERIES_COLORS.q50,
        }]
      : []),
  ];

  el.innerHTML = items
    .map(
      (item) => `
        <div class="chart-legend-item">
          <span class="chart-legend-swatch" style="background:${item.color}"></span>
          ${textContent(item.label)}
        </div>`
    )
    .join("");
};

const renderTripUncertaintyChart = (el, rows = [], { tripStopLookup = new Map() } = {}) => {
  if (!el) return;
  el.innerHTML = "";

  const data = buildTripUncertaintyChartData(rows, tripStopLookup);
  if (!data.length) {
    el.innerHTML = tripUncertaintyEmptyHtml(
      translateOr(
        "simulation.trip_uncertainty_empty",
        "Trip-level stochastic data is available, but no Q05/Q50/Q95 or median values could be plotted."
      )
    );
    renderTripUncertaintyLegend(
      el.parentElement?.querySelector("[data-trip-uncertainty-legend]")
    );
    return;
  }

  const values = data.flatMap((row) =>
    [row.q05, row.q50, row.q95, row.median].filter((value) => value != null)
  );
  if (!values.length) {
    el.innerHTML = chartEmptyStateHtml();
    renderTripUncertaintyLegend(
      el.parentElement?.querySelector("[data-trip-uncertainty-legend]")
    );
    return;
  }

  const hasBand = data.some((row) => row.q05 != null && row.q95 != null);
  const hasMedian = data.some((row) => row.median != null);
  const margin = { top: 20, right: 20, bottom: 48, left: 64 };
  const W = chartCanvasWidth(el, () =>
    renderTripUncertaintyChart(el, rows, { tripStopLookup })
  );
  const H = CHART_PLOT_HEIGHT;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;
  const svg = svgBase(
    W,
    H,
    translateOr(
      "simulation.trip_uncertainty_aria",
      "Trip-level prediction spread chart"
    )
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3
    .scalePoint()
    .domain(data.map((row) => row.label))
    .range([0, iW])
    .padding(0.5);
  const maxValue = d3.max(values) ?? 0;
  const y = d3
    .scaleLinear()
    .domain([0, maxValue * 1.12 || 1])
    .nice()
    .range([iH, 0]);

  gridLines(g, y, iW);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickValues(data.length > 16 ? data.filter((_, index) => index % Math.ceil(data.length / 12) === 0).map((row) => row.label) : data.map((row) => row.label)))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((value) => d3.format(".3~s")(value)))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("text")
    .attr("x", iW / 2)
    .attr("y", iH + 38)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(translateOr("simulation.trip_uncertainty_x_axis", "Trip sequence"));

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -iH / 2)
    .attr("y", -46)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(t("simulation.axis_energy_kwh") || "kWh");

  if (hasBand) {
    const bandData = data.filter((row) => row.q05 != null && row.q95 != null);
    const area = d3
      .area()
      .x((row) => x(row.label))
      .y0((row) => y(row.q05))
      .y1((row) => y(row.q95))
      .defined((row) => row.q05 != null && row.q95 != null)
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(bandData)
      .attr("d", area)
      .attr("fill", "rgba(0, 99, 154, 0.18)");
  }

  const medianData = data.filter((row) => row.median != null);
  if (medianData.length) {
    const medianLine = d3
      .line()
      .x((row) => x(row.label))
      .y((row) => y(row.median))
      .curve(d3.curveMonotoneX);
    g.append("path")
      .datum(medianData)
      .attr("d", medianLine)
      .attr("fill", "none")
      .attr("stroke", PREDICTION_QUANTILE_SERIES_COLORS.q50)
      .attr("stroke-width", 2.5);
  }

  g.selectAll(".trip-uncertainty-dot")
    .data(medianData)
    .join("circle")
    .attr("cx", (row) => x(row.label))
    .attr("cy", (row) => y(row.median))
    .attr("r", 3.5)
    .attr("fill", PREDICTION_QUANTILE_SERIES_COLORS.q50)
    .attr("stroke", "var(--color-surface)")
    .attr("stroke-width", 1.2)
    .each(function addTooltip(row) {
      const lines = [
        formatTripTooltipTitle(row),
        row.q05 != null
          ? translateOr("simulation.trip_uncertainty_tooltip_q05", "Q05: {value} kWh", { value: formatFixed(row.q05, 1) })
          : null,
        row.q50 != null
          ? translateOr("simulation.trip_uncertainty_tooltip_q50", "Q50: {value} kWh", { value: formatFixed(row.q50, 1) })
          : row.median != null
            ? `${translateOr("simulation.trip_uncertainty_median", "Median")}: ${formatFixed(row.median, 1)} kWh`
            : null,
        row.q95 != null
          ? translateOr("simulation.trip_uncertainty_tooltip_q95", "Q95: {value} kWh", { value: formatFixed(row.q95, 1) })
          : null,
        row.drivetrainKwh != null
          ? translateOr("simulation.trip_uncertainty_tooltip_drivetrain", "Drivetrain: {value} kWh", { value: formatFixed(row.drivetrainKwh, 1) })
          : null,
        row.auxiliaryKwh != null
          ? translateOr("simulation.trip_uncertainty_tooltip_auxiliary", "Auxiliary: {value} kWh", { value: formatFixed(row.auxiliaryKwh, 1) })
          : null,
        row.massSensitivityKwhPerKwhBatt != null
          ? translateOr(
              "simulation.trip_uncertainty_tooltip_mass_sensitivity",
              "Mass sensitivity: {value} kWh/kWh batt",
              { value: formatFixed(row.massSensitivityKwhPerKwhBatt, 4) }
            )
          : null,
      ].filter(Boolean);
      d3.select(this).append("title").text(lines.join("\n"));
    });

  el.appendChild(svg.node());
  renderTripUncertaintyLegend(el.parentElement?.querySelector("[data-trip-uncertainty-legend]"), {
    hasBand,
    hasMedian,
  });
};

const fetchTripPredictionsCached = (runId) => {
  const id = firstText(runId).trim();
  if (!id) return Promise.reject(new Error("Missing prediction run id"));
  const cached = TRIP_PREDICTION_CACHE.get(id);
  if (cached?.status === "loaded") return Promise.resolve(cached.rows);
  if (cached?.status === "loading") return cached.promise;
  if (cached?.status === "error") return Promise.reject(cached.error);

  const promise = fetchPredictionRunPredictions(id)
    .then((payload) => {
      const rows = extractTripPredictionRows(payload);
      TRIP_PREDICTION_CACHE.set(id, { status: "loaded", rows });
      return rows;
    })
    .catch((error) => {
      TRIP_PREDICTION_CACHE.set(id, { status: "error", error });
      throw error;
    });
  TRIP_PREDICTION_CACHE.set(id, { status: "loading", promise });
  return promise;
};

const renderTripUncertaintyLoading = (container) => {
  const chartEl = container?.querySelector("[data-trip-uncertainty-chart]");
  const legendEl = container?.querySelector("[data-trip-uncertainty-legend]");
  if (chartEl) {
    chartEl.innerHTML = tripUncertaintyEmptyHtml(
      translateOr(
        "simulation.trip_uncertainty_loading",
        "Loading trip-level stochastic data…"
      )
    );
  }
  if (legendEl) legendEl.innerHTML = "";
};

const renderTripUncertaintyUnavailable = (container) => {
  const chartEl = container?.querySelector("[data-trip-uncertainty-chart]");
  const legendEl = container?.querySelector("[data-trip-uncertainty-legend]");
  if (chartEl) {
    chartEl.innerHTML = tripUncertaintyEmptyHtml(
      translateOr(
        "simulation.trip_uncertainty_unavailable",
        "Trip-level stochastic data is not available for this prediction run."
      )
    );
  }
  if (legendEl) legendEl.innerHTML = "";
};

const loadTripUncertaintySection = async (detailsEl) => {
  const runId = firstText(detailsEl?.dataset?.tripPredictionsRunId).trim();
  if (!runId || detailsEl?.dataset?.tripPredictionsLoaded === "true") return;
  const container = detailsEl.querySelector("[data-trip-uncertainty-content]");
  renderTripUncertaintyLoading(container);

  try {
    const rows = await fetchTripPredictionsCached(runId);
    const tripStopLookup = await buildTripStopLookupForRows(
      rows,
      TRIP_STOP_LOOKUP_CACHE.get(runId) ?? new Map()
    );
    TRIP_STOP_LOOKUP_CACHE.set(runId, tripStopLookup);
    if (!detailsEl.isConnected) return;
    renderTripUncertaintyChart(
      container?.querySelector("[data-trip-uncertainty-chart]"),
      rows,
      { tripStopLookup }
    );
    detailsEl.dataset.tripPredictionsLoaded = "true";
  } catch {
    if (!detailsEl.isConnected) return;
    renderTripUncertaintyUnavailable(container);
  }
};

const installTripUncertaintyLoaders = (el) => {
  el.querySelectorAll("details[data-trip-predictions-run-id]").forEach((detailsEl) => {
    const handleToggle = () => {
      if (detailsEl.open) {
        loadTripUncertaintySection(detailsEl);
      }
    };
    detailsEl.addEventListener("toggle", handleToggle);
    if (detailsEl.open) handleToggle();
  });
};

const renderTripUncertaintySection = (run = {}, { tripStopLookup = new Map() } = {}) => {
  const runId = firstText(run?.id, run?.prediction_run_id, run?.predictionRunId).trim();
  if (!runId) {
    return `
      <section class="predictions-card-section predictions-trip-section">
        <div class="predictions-card-section__header">
          <h4>${textContent(translateOr("simulation.trip_uncertainty_title", "Trip-level uncertainty"))}</h4>
        </div>
        ${tripUncertaintyEmptyHtml(
          translateOr(
            "simulation.trip_uncertainty_missing_run",
            "Trip-level stochastic data is not available because the prediction run id is missing."
          )
        )}
      </section>`;
  }

  TRIP_STOP_LOOKUP_CACHE.set(runId, tripStopLookup);

  return `
    <details class="predictions-trip-section" data-trip-predictions-run-id="${escapeAttr(runId)}">
      <summary class="predictions-trip-summary">${textContent(
        translateOr("simulation.trip_uncertainty_title", "Trip-level uncertainty")
      )}</summary>
      <div class="predictions-trip-content" data-trip-uncertainty-content>
        <p class="predictions-overview__copy">${textContent(
          translateOr(
            "simulation.trip_uncertainty_help",
            "Q50 shows the median predicted trip consumption. Q05-Q95 shows the prediction spread across simulations."
          )
        )}</p>
        <div
          class="chart-container predictions-chart-container predictions-trip-chart"
          data-trip-uncertainty-chart
        >
          ${tripUncertaintyEmptyHtml(
            translateOr(
              "simulation.trip_uncertainty_open_to_load",
              "Open this section to load trip-level stochastic data."
            )
          )}
        </div>
        <div
          class="chart-legend predictions-chart-legend"
          data-trip-uncertainty-legend
        ></div>
      </div>
    </details>`;
};

const computeBatteryAdequacyStatus = ({
  usableEnergyKwh,
  q50DemandKwh,
  q95DemandKwh,
} = {}) => {
  const usableEnergy = toOptionalFiniteNumber(usableEnergyKwh);
  const q50Demand = toOptionalFiniteNumber(q50DemandKwh);
  const q95Demand = toOptionalFiniteNumber(q95DemandKwh);

  return {
    usableEnergy,
    q50Demand,
    q95Demand,
    canEvaluateEnergy: usableEnergy != null,
    canEvaluateQuantiles: q50Demand != null && q95Demand != null,
    q50Covered: usableEnergy != null && q50Demand != null ? usableEnergy >= q50Demand : null,
    q95Covered: usableEnergy != null && q95Demand != null ? usableEnergy >= q95Demand : null,
  };
};

const renderBatteryAdequacyPanel = (status = {}) => {
  const title = translateOr(
    "simulation.battery_adequacy_title",
    "Battery adequacy check"
  );
  const note = translateOr(
    "simulation.battery_adequacy_note",
    "This is a quantile-based adequacy indicator, not a true exceedance probability."
  );

  if (!status.canEvaluateEnergy) {
    return `
      <div class="efficiency-adequacy-panel">
        <h5>${textContent(title)}</h5>
        <p>${textContent(
          translateOr(
            "simulation.battery_adequacy_missing_energy",
            "Battery adequacy cannot be evaluated because usable battery energy is unavailable."
          )
        )}</p>
        <p class="efficiency-adequacy-note">${textContent(note)}</p>
      </div>`;
  }

  if (!status.canEvaluateQuantiles) {
    return `
      <div class="efficiency-adequacy-panel">
        <h5>${textContent(title)}</h5>
        <p>${textContent(
          translateOr(
            "simulation.battery_adequacy_missing_quantiles",
            "Battery adequacy cannot be evaluated because quantiles are unavailable."
          )
        )}</p>
        <p class="efficiency-adequacy-note">${textContent(note)}</p>
      </div>`;
  }

  const q50Label = status.q50Covered
    ? translateOr(
        "simulation.battery_adequacy_q50_covered",
        "covered"
      )
    : translateOr(
        "simulation.battery_adequacy_q50_above",
        "above usable energy"
      );
  const q95Label = status.q95Covered
    ? translateOr(
        "simulation.battery_adequacy_q95_covered",
        "within usable battery energy"
      )
    : translateOr(
        "simulation.battery_adequacy_q95_above",
        "above usable energy"
      );

  return `
    <div class="efficiency-adequacy-panel">
      <h5>${textContent(title)}</h5>
      <div class="efficiency-adequacy-grid">
        <span>${textContent(translateOr("simulation.battery_adequacy_usable", "Usable energy"))}</span>
        <strong>${textContent(formatFixed(status.usableEnergy, 1))} kWh</strong>
        <span>${textContent(translateOr("simulation.battery_adequacy_q50", "Q50 demand"))}</span>
        <strong>${textContent(formatFixed(status.q50Demand, 1))} kWh <span class="badge badge--compact ${status.q50Covered ? "badge--positive" : "badge--negative"}">${textContent(q50Label)}</span></strong>
        <span>${textContent(translateOr("simulation.battery_adequacy_q95", "Q95 demand"))}</span>
        <strong>${textContent(formatFixed(status.q95Demand, 1))} kWh <span class="badge badge--compact ${status.q95Covered ? "badge--positive" : "badge--negative"}">${textContent(q95Label)}</span></strong>
      </div>
      <p class="efficiency-adequacy-note">${textContent(note)}</p>
    </div>`;
};

const renderPredictionOverviewLegend = (
  el,
  { seriesKeys = PREDICTION_QUANTILE_KEYS, extraItems = [] } = {}
) => {
  if (!el) return;
  const items = [
    ...(Array.isArray(seriesKeys) ? seriesKeys : []).map((key) => ({
      label: key.toUpperCase(),
      color: PREDICTION_QUANTILE_SERIES_COLORS[key],
    })),
    ...((Array.isArray(extraItems) ? extraItems : []).filter(
      (item) => item?.label && item?.color
    )),
  ];

  el.innerHTML = items.map(
    (item) => `
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:${item.color}"></span>
        ${textContent(item.label)}
      </div>`
  ).join("");
};

const renderPredictionOverviewChart = (el, data = [], options = {}) => {
  if (!el) return;
  el.innerHTML = "";

  const {
    unit = "kWh",
    ariaLabel = "Total consumption quantiles across simulations",
    yAxisLabel = "Total consumption",
    decimals = 1,
    markers = [],
  } = options ?? {};

  const chartData = Array.isArray(data) ? data : [];
  const chartMarkers = (Array.isArray(markers) ? markers : [])
    .map((marker) => ({
      ...marker,
      value: toFiniteNumber(marker?.value),
    }))
    .filter((marker) => marker.value != null);
  const quantileValues = chartData.flatMap((row) =>
    PREDICTION_QUANTILE_KEYS.map((key) => toFiniteNumber(row?.[key])).filter(
      (value) => value != null
    )
  );
  const markerValues = chartMarkers
    .map((marker) => toFiniteNumber(marker?.value))
    .filter((value) => value != null);
  const values = [...quantileValues, ...markerValues];
  const xDomain = [
    ...new Set(
      [...chartData.map((row) => row?.scenarioLabel), ...chartMarkers.map((marker) => marker?.scenarioLabel)]
        .map((label) => (label == null ? "" : String(label)))
        .filter(Boolean)
    ),
  ];

  if (!xDomain.length || !values.length) {
    el.innerHTML = chartEmptyStateHtml();
    return;
  }

  const margin = { top: 16, right: 20, bottom: 48, left: 68 };
  const W = chartCanvasWidth(el, () =>
    renderPredictionOverviewChart(el, data, options)
  );
  const H = CHART_PLOT_HEIGHT;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    ariaLabel
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scalePoint()
    .domain(xDomain)
    .range([0, iW])
    .padding(0.5);
  const y = d3
    .scaleLinear()
    .domain([d3.min(values) * 0.95, d3.max(values) * 1.05])
    .nice()
    .range([iH, 0]);

  gridLines(g, y, iW);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("g")
    .call(
      d3.axisLeft(y).ticks(6).tickFormat((value) =>
        unit === "kWh/km" ? d3.format(".3~f")(value) : d3.format(".3~s")(value)
      )
    )
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("text")
    .attr("x", iW / 2)
    .attr("y", iH + 38)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(t("simulation.axis_packs") || "# Packs");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -iH / 2)
    .attr("y", -48)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(yAxisLabel);

  PREDICTION_QUANTILE_KEYS.forEach((key) => {
    const seriesData = chartData.filter((row) => toFiniteNumber(row?.[key]) != null);
    if (!seriesData.length) return;

    const line = d3
      .line()
      .x((row) => x(row.scenarioLabel))
      .y((row) => y(row[key]))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(seriesData)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", PREDICTION_QUANTILE_SERIES_COLORS[key])
      .attr("stroke-width", 2.5);

    g.selectAll(`.predictions-overview-dot-${key}`)
      .data(seriesData)
      .join("circle")
      .attr("cx", (row) => x(row.scenarioLabel))
      .attr("cy", (row) => y(row[key]))
      .attr("r", 4)
      .attr("fill", PREDICTION_QUANTILE_SERIES_COLORS[key])
      .attr("stroke", "var(--color-surface)")
      .attr("stroke-width", 1.5)
      .each(function addTooltip(row) {
        d3.select(this)
          .append("title")
          .text(
            [
              row.scenarioTitle,
              `${key.toUpperCase()}: ${formatFixed(row[key], decimals)} ${unit}`,
            ].join("\n")
          );
      });
  });

  if (chartMarkers.length) {
    const markerSymbol = d3.symbol().type(d3.symbolCircle).size(120);

    g.selectAll(".predictions-overview-marker-guide")
      .data(chartMarkers)
      .join("line")
      .attr("x1", (marker) => x(marker.scenarioLabel))
      .attr("x2", (marker) => x(marker.scenarioLabel))
      .attr("y1", iH)
      .attr("y2", (marker) => y(marker.value))
      .attr("stroke", (marker) => marker.color ?? OPTIMIZATION_BATTERY_COLORS.optimized)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4")
      .attr("opacity", 0.35);

    g.selectAll(".predictions-overview-marker")
      .data(chartMarkers)
      .join("path")
      .attr(
        "transform",
        (marker) => `translate(${x(marker.scenarioLabel)},${y(marker.value)})`
      )
      .attr("d", markerSymbol)
      .attr("fill", (marker) => marker.color ?? OPTIMIZATION_BATTERY_COLORS.optimized)
      .attr("stroke", "var(--color-surface)")
      .attr("stroke-width", 1.5)
      .each(function addTooltip(marker) {
        d3.select(this)
          .append("title")
          .text(
            [
              marker.scenarioTitle ?? marker.scenarioLabel,
              `${marker.label}: ${formatFixed(marker.value, decimals)} ${unit}`,
              ...((Array.isArray(marker.tooltipLines) ? marker.tooltipLines : []).filter(Boolean)),
            ].join("\n")
          );
      });
  }

  el.appendChild(svg.node());
};

const renderPredictionsQuantileChart = (
  el,
  rows,
  { decimals = 1, unit = "" } = {}
) => {
  if (!el) return;
  el.innerHTML = "";

  const chartRows = Array.isArray(rows) ? rows : [];
  const data = buildPredictionChartData(chartRows);
  if (!data.length) {
    el.innerHTML = chartEmptyStateHtml();
    return;
  }

  const keys = chartRows.map((row) => row.key);
  const values = data.flatMap((item) =>
    keys.map((key) => toFiniteNumber(item?.[key])).filter((value) => value != null)
  );
  if (!values.length) {
    el.innerHTML = chartEmptyStateHtml();
    return;
  }

  const margin = { top: 20, right: 16, bottom: 40, left: 64 };
  const W = chartCanvasWidth(el, () =>
    renderPredictionsQuantileChart(el, rows, { decimals, unit })
  );
  const H = CHART_PLOT_HEIGHT;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    `${textContent(
      translateOr(
        "simulation.predictions_chart_aria",
        "Prediction quantiles chart"
      )
    )} (${textContent(unit)})`
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3
    .scaleBand()
    .domain(data.map((item) => item.quantileLabel))
    .range([0, iW])
    .padding(0.24);
  const x1 = d3
    .scaleBand()
    .domain(keys)
    .range([0, x0.bandwidth()])
    .padding(0.14);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(values) * 1.15])
    .nice()
    .range([iH, 0]);

  gridLines(g, y, iW);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("g")
    .call(
      d3.axisLeft(y).ticks(5).tickFormat((value) =>
        unit === "kWh/km" ? d3.format(".3~f")(value) : d3.format(".3~s")(value)
      )
    )
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -iH / 2)
    .attr("y", -46)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(unit);

  keys.forEach((key) => {
    g.selectAll(`.predictions-bar-${key}`)
      .data(data)
      .join("rect")
      .attr("x", (item) => x0(item.quantileLabel) + x1(key))
      .attr("y", (item) => y(item?.[key] ?? 0))
      .attr("width", x1.bandwidth())
      .attr("height", (item) => iH - y(item?.[key] ?? 0))
      .attr("rx", 4)
      .attr("fill", PREDICTION_CONSUMPTION_COLORS[key] ?? "#00639a")
      .each(function addTooltip(item) {
        const value = toFiniteNumber(item?.[key]);
        d3.select(this)
          .append("title")
          .text(
            [
              item.quantileLabel,
              `${predictionConsumptionLabel(key)}: ${
                value == null ? "—" : formatFixed(value, decimals)
              } ${unit}`,
            ].join("\n")
          );
      });
  });

  el.appendChild(svg.node());
};

const renderPredictionsPanel = (el, state, viewOptions = {}) => {
  if (!el) return;

  if (state.status === "idle" || state.status === "loading") {
    el.innerHTML = `<p class="efficiency-state-msg">${textContent(
      t("simulation.predictions_loading") ||
        "Loading prediction summaries…"
    )}</p>`;
    return;
  }

  if (state.status === "error") {
    el.innerHTML = `<p class="efficiency-state-msg efficiency-state-error">${textContent(
      state.error ??
        t("simulation.predictions_error") ??
        "Failed to load prediction summaries."
    )}</p>`;
    return;
  }

  const predictionRuns = Array.isArray(state.predictionRuns) ? state.predictionRuns : [];
  const sortedRuns = scopePredictionRunsByShift(predictionRuns, viewOptions);
  const optimizedPacks = resolveOptimizedPackCountForView(
    state.optimizationRun?.results?.battery_results ?? {},
    viewOptions
  );

  if (!sortedRuns.length) {
    el.innerHTML = `<div class="efficiency-section"><p class="efficiency-state-msg">${textContent(
      t("simulation.predictions_no_data") ||
        "No prediction summaries available."
    )}</p></div>`;
    return;
  }

  let hasDerivedAuxiliaryQuantiles = false;
  const chartPlans = [];
  const overviewData = buildPredictionOverviewData(sortedRuns, {
    kind: "absolute",
  });
  const overviewPerKmData = buildPredictionOverviewData(sortedRuns, {
    kind: "per_km",
  });
  const optimizedScenarioRuns =
    optimizedPacks == null
      ? []
      : sortedRuns.filter((run) => {
          const runPacks = toFiniteNumber(run?.contextual_parameters?.num_battery_packs);
          return runPacks != null && runPacks === optimizedPacks;
        });
  const cardRuns = optimizedScenarioRuns.length ? optimizedScenarioRuns : sortedRuns;

  const cardsHtml = cardRuns
    .map((run, index) => {
      const summary = run?.summary ?? {};
      const contextualParameters = run?.contextual_parameters ?? {};
      const runPacks = toFiniteNumber(contextualParameters?.num_battery_packs);
      const showTripUncertainty =
        optimizedPacks != null && runPacks != null && runPacks === optimizedPacks;
      const absoluteRows = buildPredictionQuantileRows(summary, "absolute");
      const perKmRows = buildPredictionQuantileRows(summary, "per_km");
      const usesDerivedAuxiliary = [...absoluteRows, ...perKmRows].some(
        (row) => row.key === "auxiliary" && row.derived
      );

      if (usesDerivedAuxiliary) {
        hasDerivedAuxiliaryQuantiles = true;
      }

      const metricItems = [
        {
          label: t("simulation.predictions_metric_packs") || "Battery packs",
          value:
            toFiniteNumber(contextualParameters?.num_battery_packs) == null
              ? "—"
              : formatFixed(contextualParameters.num_battery_packs, 0),
        },
        {
          label: t("simulation.predictions_metric_capacity") || "Battery capacity",
          value:
            toFiniteNumber(contextualParameters?.battery_capacity_kwh) == null
              ? "—"
              : `${formatFixed(contextualParameters.battery_capacity_kwh, 0)} kWh`,
        },
        {
          label: t("simulation.predictions_metric_weight") || "Total weight",
          value:
            toFiniteNumber(contextualParameters?.total_weight_kg) == null
              ? "—"
              : `${formatFixed(contextualParameters.total_weight_kg, 0)} kg`,
        },
        {
          label: t("simulation.predictions_metric_distance") || "Distance",
          value:
            toFiniteNumber(summary?.total_distance_km) == null
              ? "—"
              : `${formatFixed(summary.total_distance_km, 1)} km`,
        },
        {
          label:
            t("simulation.predictions_metric_total_consumption") ||
            "Total consumption",
          value:
            toFiniteNumber(summary?.total_consumption_kwh) == null
              ? "—"
              : `${formatFixed(summary.total_consumption_kwh, 1)} kWh`,
        },
        {
          label:
            t("simulation.predictions_metric_specific_consumption") ||
            "Specific consumption",
          value:
            toFiniteNumber(summary?.consumption_per_km_kwh) == null
              ? "—"
              : `${formatFixed(summary.consumption_per_km_kwh, 3)} kWh/km`,
        },
      ];

      const metricHtml = metricItems
        .map(
          (item) => `
            <div class="predictions-metric">
              <span class="predictions-metric__label">${textContent(item.label)}</span>
              <span class="predictions-metric__value">${textContent(item.value)}</span>
            </div>`
        )
        .join("");

      const sections = [];
      if (absoluteRows.length) {
        const chartRole = `predictions-chart-${index}-absolute`;
        chartPlans.push({
          chartRole,
          rows: absoluteRows,
          options: { decimals: 1, unit: "kWh" },
        });
        sections.push(
          renderPredictionsQuantileTable(
            t("simulation.predictions_absolute_title") ||
              "Quantiles by consumption type",
            absoluteRows,
            { decimals: 1, unit: "kWh", chartRole }
          )
        );
      }
      if (perKmRows.length) {
        const chartRole = `predictions-chart-${index}-per-km`;
        chartPlans.push({
          chartRole,
          rows: perKmRows,
          options: { decimals: 3, unit: "kWh/km" },
        });
        sections.push(
          renderPredictionsQuantileTable(
            t("simulation.predictions_per_km_title") ||
              "Specific consumption quantiles",
            perKmRows,
            { decimals: 3, unit: "kWh/km", chartRole }
          )
        );
      }

      if (!sections.length) {
        sections.push(
          `<p class="efficiency-state-msg">${textContent(
            t("simulation.predictions_no_data") ||
              "No prediction summaries available."
          )}</p>`
        );
      }

      return `
        <article class="efficiency-section predictions-card">
          <header class="predictions-card__header">
            <h3 class="efficiency-section-title predictions-card__title">${textContent(
              buildPredictionScenarioTitle(run, index)
            )}</h3>
          </header>
          <div class="kpi-grid predictions-metrics-grid">${metricHtml}</div>
          <div class="predictions-card-grid">
            ${sections.join("")}
          </div>
          ${showTripUncertainty ? renderTripUncertaintySection(run, {
            tripStopLookup: viewOptions?.tripStopLookup,
          }) : ""}
        </article>`;
    })
    .join("");

  const derivedAuxiliaryNote = hasDerivedAuxiliaryQuantiles
    ? `<p class="predictions-note">${textContent(
        t("simulation.predictions_auxiliary_note") ||
          "Auxiliary quantiles are derived from total minus drivetrain when the API summary does not provide them directly."
      )}</p>`
    : "";

  const overviewHtml = overviewData.length
    ? `
      <section class="efficiency-section predictions-overview">
        <h3 class="efficiency-section-title">${textContent(
          translateOr(
            "simulation.predictions_overview_title",
            "Total consumption quantiles across simulations"
          )
        )}</h3>
        <p class="predictions-overview__copy">${textContent(
          translateOr(
            "simulation.predictions_overview_subtitle",
            "This view keeps only total consumption and shows how Q05, Q50, and Q95 move across the prediction scenarios."
          )
        )}</p>
        <p class="predictions-overview__copy">${textContent(quantileHelpText())}</p>
        <div
          class="chart-container predictions-overview__chart"
          data-predictions-overview-chart
        ></div>
        <div
          class="chart-legend predictions-chart-legend"
          data-predictions-overview-legend
        ></div>
      </section>`
    : "";

  const overviewPerKmHtml = overviewPerKmData.length
    ? `
      <section class="efficiency-section predictions-overview">
        <h3 class="efficiency-section-title">${textContent(
          translateOr(
            "simulation.predictions_overview_per_km_title",
            "Total specific-consumption quantiles across simulations"
          )
        )}</h3>
        <p class="predictions-overview__copy">${textContent(
          translateOr(
            "simulation.predictions_overview_per_km_subtitle",
            "This view keeps only total consumption normalized by distance and shows how Q05, Q50, and Q95 move across the prediction scenarios."
          )
        )}</p>
        <p class="predictions-overview__copy">${textContent(quantileHelpText())}</p>
        <div
          class="chart-container predictions-overview__chart"
          data-predictions-overview-per-km-chart
        ></div>
        <div
          class="chart-legend predictions-chart-legend"
          data-predictions-overview-per-km-legend
        ></div>
      </section>`
    : "";

  const overviewGridHtml =
    overviewHtml || overviewPerKmHtml
      ? `<div class="predictions-overview-grid">${overviewHtml}${overviewPerKmHtml}</div>`
      : "";

  el.innerHTML = `${derivedAuxiliaryNote}${overviewGridHtml}${cardsHtml}`;

  renderPredictionOverviewChart(
    el.querySelector("[data-predictions-overview-chart]"),
    overviewData,
    {
      unit: "kWh",
      ariaLabel: translateOr(
        "simulation.predictions_overview_aria",
        "Total consumption quantiles across simulations"
      ),
      yAxisLabel: `${
        t("simulation.predictions_metric_total_consumption") ||
        "Total consumption"
      } (kWh)`,
      decimals: 1,
    }
  );
  renderPredictionOverviewLegend(
    el.querySelector("[data-predictions-overview-legend]"),
    {
      seriesKeys: resolvePredictionOverviewSeriesKeys(overviewData),
    }
  );
  renderPredictionOverviewChart(
    el.querySelector("[data-predictions-overview-per-km-chart]"),
    overviewPerKmData,
    {
      unit: "kWh/km",
      ariaLabel: translateOr(
        "simulation.predictions_overview_per_km_aria",
        "Total specific-consumption quantiles across simulations"
      ),
      yAxisLabel: `${
        t("simulation.predictions_metric_specific_consumption") ||
        "Specific consumption"
      } (kWh/km)`,
      decimals: 3,
    }
  );
  renderPredictionOverviewLegend(
    el.querySelector("[data-predictions-overview-per-km-legend]"),
    {
      seriesKeys: resolvePredictionOverviewSeriesKeys(overviewPerKmData),
    }
  );

  chartPlans.forEach((plan) => {
    renderPredictionsQuantileChart(
      el.querySelector(`[data-predictions-chart="${plan.chartRole}"]`),
      plan.rows,
      plan.options
    );
    renderPredictionsChartLegend(
      el.querySelector(`[data-predictions-legend="${plan.chartRole}"]`),
      plan.rows
    );
  });
  installTripUncertaintyLoaders(el);
};

const renderEfficiencyCurveChart = (el, rows) => {
  if (!el) return;
  el.innerHTML = "";

  const data = rows.filter(
    (row) => row.numBatteryPacks != null && row.consumptionPerKmMedianKwh != null
  );
  if (!data.length) {
    el.innerHTML = chartEmptyStateHtml();
    return;
  }

  const margin = { top: 24, right: 20, bottom: 44, left: 64 };
  const W = 620;
  const H = 280;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const minX = d3.min(data, (d) => d.numBatteryPacks);
  const maxX = d3.max(data, (d) => d.numBatteryPacks);
  const minY = d3.min(data, (d) => d.consumptionPerKmMedianKwh);
  const maxY = d3.max(data, (d) => d.consumptionPerKmMedianKwh);
  const yPadding = Math.max(((maxY ?? 0) - (minY ?? 0)) * 0.15, 0.02);

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_efficiency_curve",
      "Energy efficiency by battery configuration"
    )
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleLinear()
    .domain(minX === maxX ? [minX - 1, maxX + 1] : [minX, maxX])
    .range([0, iW]);
  const y = d3
    .scaleLinear()
    .domain([Math.max(0, minY - yPadding), maxY + yPadding])
    .nice()
    .range([iH, 0]);

  gridLines(g, y, iW);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(data.map((d) => d.numBatteryPacks))
        .tickFormat((d) => `${d}`)
    )
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => d3.format(".3~f")(d)))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("text")
    .attr("x", iW / 2)
    .attr("y", iH + 38)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(t("simulation.axis_packs") || "# Packs");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -iH / 2)
    .attr("y", -46)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(t("simulation.efficiency_col_per_km") || "kWh / km");

  const line = d3
    .line()
    .x((d) => x(d.numBatteryPacks))
    .y((d) => y(d.consumptionPerKmMedianKwh))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(data)
    .attr("d", line)
    .attr("fill", "none")
    .attr("stroke", "#00639a")
    .attr("stroke-width", 2.5);

  g.selectAll(".efficiency-dot")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(d.numBatteryPacks))
    .attr("cy", (d) => y(d.consumptionPerKmMedianKwh))
    .attr("r", (d) => (d.isOptimized ? 5.5 : 4))
    .attr("fill", (d) => (d.isOptimized ? "#abe828" : "#00639a"))
    .attr("stroke", "var(--color-surface)")
    .attr("stroke-width", 2)
    .each(function addTooltip(d) {
      d3.select(this)
        .append("title")
        .text(
          [
            `${d.numBatteryPacks} ${t("simulation.unit_packs") || "packs"}`,
            `${t("simulation.predictions_col_q50") || "Q50"}: ${formatFixed(
              d.consumptionPerKmMedianKwh,
              3
            )} ${t("simulation.efficiency_col_per_km") || "kWh / km"}`,
            `${t("simulation.efficiency_col_capacity") || "Capacity (kWh)"}: ${formatFixed(d.batteryCapacityKwh, 0)} kWh`,
            `${t("simulation.efficiency_col_weight") || "Weight (kg)"}: ${formatFixed(d.totalWeightKg, 0)} kg`,
            `${t("simulation.opt_col_sessions") || "Charging Sessions"}: ${formatFixed(d.numChargingSessions, 0)}`,
          ].join("\n")
        );
    });

  g.selectAll(".efficiency-opt-label")
    .data(data.filter((d) => d.isOptimized))
    .join("text")
    .attr("x", (d) => x(d.numBatteryPacks))
    .attr("y", (d) => y(d.consumptionPerKmMedianKwh) - 12)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("font-weight", "600")
    .attr("fill", "#587a00")
    .text(t("simulation.chart_label_optimized") || "Optimized");

  el.appendChild(svg.node());
};

const ENERGY_SPLIT_KEYS = ["totalDrivetrainKwh", "totalAuxiliaryKwh"];
const ENERGY_SPLIT_COLORS = {
  totalDrivetrainKwh: "#6fbeec",
  totalAuxiliaryKwh: "#f5a623",
};

const renderEfficiencyEnergyLegend = (el) => {
  if (!el) return;
  el.innerHTML = `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${ENERGY_SPLIT_COLORS.totalDrivetrainKwh}"></span>
      ${textContent(t("simulation.efficiency_col_drivetrain") || "Drivetrain (kWh)")}
    </div>
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${ENERGY_SPLIT_COLORS.totalAuxiliaryKwh}"></span>
      ${textContent(t("simulation.efficiency_col_auxiliary") || "Auxiliary (kWh)")}
    </div>`;
};

const renderEfficiencyEnergySplitChart = (el, rows) => {
  if (!el) return;
  el.innerHTML = "";

  const data = rows
    .filter((row) => row.numBatteryPacks != null)
    .map((row) => ({
      ...row,
      totalDrivetrainKwh: row.totalDrivetrainKwh ?? 0,
      totalAuxiliaryKwh: row.totalAuxiliaryKwh ?? 0,
    }))
    .filter((row) => row.totalDrivetrainKwh > 0 || row.totalAuxiliaryKwh > 0);

  if (!data.length) {
    el.innerHTML = chartEmptyStateHtml();
    return;
  }

  const margin = { top: 24, right: 20, bottom: 44, left: 64 };
  const W = chartCanvasWidth(el, () => renderEfficiencyEnergySplitChart(el, rows));
  const H = CHART_PLOT_HEIGHT;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_energy_breakdown",
      "Energy consumption breakdown"
    )
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(data.map((d) => String(d.numBatteryPacks)))
    .range([0, iW])
    .padding(0.3);
  const y = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(
        data,
        (d) => (d.totalDrivetrainKwh ?? 0) + (d.totalAuxiliaryKwh ?? 0)
      ) * 1.15,
    ])
    .nice()
    .range([iH, 0]);

  gridLines(g, y, iW);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => d3.format(".3~s")(d)))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("text")
    .attr("x", iW / 2)
    .attr("y", iH + 38)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(t("simulation.axis_packs") || "# Packs");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -iH / 2)
    .attr("y", -46)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(t("simulation.axis_energy_kwh") || "kWh");

  const stack = d3.stack().keys(ENERGY_SPLIT_KEYS)(data);

  stack.forEach((layer) => {
    g.selectAll(`.split-${layer.key}`)
      .data(layer)
      .join("rect")
      .attr("x", (d) => x(String(d.data.numBatteryPacks)))
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth())
      .attr("rx", 4)
      .attr("fill", ENERGY_SPLIT_COLORS[layer.key])
      .each(function addTooltip(d) {
        const segmentValue = d.data[layer.key];
        d3.select(this)
          .append("title")
          .text(
            [
              `${d.data.numBatteryPacks} ${t("simulation.unit_packs") || "packs"}`,
              `${layer.key === "totalDrivetrainKwh"
                ? (t("simulation.efficiency_col_drivetrain") || "Drivetrain (kWh)")
                : (t("simulation.efficiency_col_auxiliary") || "Auxiliary (kWh)")}: ${formatFixed(segmentValue, 1)} kWh`,
              `${t("simulation.label_total") || "Total"}: ${formatFixed(
                d.data.totalDrivetrainKwh + d.data.totalAuxiliaryKwh,
                1
              )} kWh`,
            ].join("\n")
          );
      });
  });

  g.selectAll(".efficiency-total-label")
    .data(data)
    .join("text")
    .attr("x", (d) => x(String(d.numBatteryPacks)) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.totalDrivetrainKwh + d.totalAuxiliaryKwh) - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("font-weight", "600")
    .attr("fill", "#1c1c1c")
    .text((d) => formatFixed(d.totalConsumptionKwh, 0));

  el.appendChild(svg.node());
};

const renderEfficiencySocEnvelopeChart = (el, rows) => {
  if (!el) return;
  el.innerHTML = "";

  const data = rows.filter(
    (row) =>
      row.numBatteryPacks != null &&
      row.minSocKwh != null &&
      row.maxSocKwh != null
  );

  if (!data.length) {
    el.innerHTML = chartEmptyStateHtml();
    return;
  }

  const margin = { top: 24, right: 20, bottom: 44, left: 64 };
  const W = 620;
  const H = 280;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_soc_window",
      "State of charge operating window"
    )
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scalePoint()
    .domain(data.map((d) => String(d.numBatteryPacks)))
    .range([0, iW])
    .padding(0.5);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.maxSocKwh) * 1.1])
    .nice()
    .range([iH, 0]);

  gridLines(g, y, iW);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => d3.format(".3~s")(d)))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  g.append("text")
    .attr("x", iW / 2)
    .attr("y", iH + 38)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(t("simulation.axis_packs") || "# Packs");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -iH / 2)
    .attr("y", -46)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text(t("simulation.axis_energy_kwh") || "kWh");

  g.selectAll(".soc-range")
    .data(data)
    .join("line")
    .attr("x1", (d) => x(String(d.numBatteryPacks)))
    .attr("x2", (d) => x(String(d.numBatteryPacks)))
    .attr("y1", (d) => y(d.minSocKwh))
    .attr("y2", (d) => y(d.maxSocKwh))
    .attr("stroke", "#6fbeec")
    .attr("stroke-width", 8)
    .attr("stroke-linecap", "round")
    .attr("opacity", 0.45);

  g.selectAll(".soc-min-dot")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(String(d.numBatteryPacks)))
    .attr("cy", (d) => y(d.minSocKwh))
    .attr("r", 4)
    .attr("fill", "#00639a");

  g.selectAll(".soc-max-dot")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(String(d.numBatteryPacks)))
    .attr("cy", (d) => y(d.maxSocKwh))
    .attr("r", 4)
    .attr("fill", "#abe828");

  g.selectAll(".soc-session-label")
    .data(data.filter((d) => d.numChargingSessions != null))
    .join("text")
    .attr("x", (d) => x(String(d.numBatteryPacks)))
    .attr("y", (d) => y(d.maxSocKwh) - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", CHART_FONT_LABEL)
    .attr("fill", "#666")
    .text((d) => `${formatFixed(d.numChargingSessions, 0)}x`);

  g.selectAll(".soc-tooltip-target")
    .data(data)
    .join("rect")
    .attr("x", (d) => x(String(d.numBatteryPacks)) - 12)
    .attr("y", (d) => y(d.maxSocKwh))
    .attr("width", 24)
    .attr("height", (d) => y(d.minSocKwh) - y(d.maxSocKwh))
    .attr("fill", "transparent")
    .each(function addTooltip(d) {
      d3.select(this)
        .append("title")
        .text(
          [
            `${d.numBatteryPacks} ${t("simulation.unit_packs") || "packs"}`,
            `${t("simulation.opt_col_min_soc") || "Min SoC (kWh)"}: ${formatFixed(d.minSocKwh, 1)} kWh`,
            `${t("simulation.opt_col_max_soc") || "Max SoC (kWh)"}: ${formatFixed(d.maxSocKwh, 1)} kWh`,
            `${t("simulation.opt_col_sessions") || "Charging Sessions"}: ${formatFixed(d.numChargingSessions, 0)}`,
            `${t("simulation.opt_col_charged") || "Total Charged (kWh)"}: ${formatFixed(d.totalChargedKwh, 1)} kWh`,
          ].join("\n")
        );
    });

  el.appendChild(svg.node());
};

const renderOptimizationBatteryLegend = (el) => {
  if (!el) return;
  el.innerHTML = `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${OPTIMIZATION_BATTERY_COLORS.base}"></span>
      ${textContent(t("simulation.opt_col_base_packs") || "Base Packs")}
    </div>
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${OPTIMIZATION_BATTERY_COLORS.optimized}"></span>
      ${textContent(t("simulation.opt_col_opt_packs") || "Optimized Packs")}
    </div>`;
};

const renderOptimizationBatteryChart = (el, rows) => {
  if (!el) return;
  el.innerHTML = "";

  const data = rows.filter(
    (row) => row.basePacks != null || row.optimizedPacks != null
  );
  if (!data.length) {
    el.innerHTML = chartEmptyStateHtml();
    return;
  }

  const margin = { top: 24, right: 20, bottom: 64, left: 56 };
  const W = 620;
  const H = 300;
  const iW = W - margin.left - margin.right;
  const iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_battery_sizing",
      "Battery sizing comparison"
    )
  );
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x0 = d3
    .scaleBand()
    .domain(data.map((d) => d.shiftName))
    .range([0, iW])
    .padding(0.25);
  const x1 = d3
    .scaleBand()
    .domain(["basePacks", "optimizedPacks"])
    .range([0, x0.bandwidth()])
    .padding(0.16);
  const y = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(data, (d) => Math.max(d.basePacks ?? 0, d.optimizedPacks ?? 0)) * 1.2,
    ])
    .nice()
    .range([iH, 0]);

  gridLines(g, y, iW);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK)
    .attr("transform", "rotate(-18)")
    .style("text-anchor", "end");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`))
    .selectAll("text")
    .attr("font-size", CHART_FONT_TICK);

  ["basePacks", "optimizedPacks"].forEach((key) => {
    g.selectAll(`.battery-sizing-${key}`)
      .data(data)
      .join("rect")
      .attr("x", (d) => x0(d.shiftName) + x1(key))
      .attr("y", (d) => y(d[key] ?? 0))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => iH - y(d[key] ?? 0))
      .attr("rx", 4)
      .attr(
        "fill",
        key === "basePacks"
          ? OPTIMIZATION_BATTERY_COLORS.base
          : OPTIMIZATION_BATTERY_COLORS.optimized
      )
      .each(function addTooltip(d) {
        d3.select(this)
          .append("title")
          .text(
            `${d.shiftName}\n${
              key === "basePacks"
                ? (t("simulation.opt_col_base_packs") || "Base Packs")
                : (t("simulation.opt_col_opt_packs") || "Optimized Packs")
            }: ${formatFixed(d[key], 0)}`
          );
      });
  });

  el.appendChild(svg.node());
};

const resolveSinglePackCapacityKwh = (predictionRun = {}, batteryResults = {}, viewOptions = {}) => {
  const cp = predictionRun?.contextual_parameters ?? {};
  const predictionCapacity = toOptionalFiniteNumber(cp.battery_capacity_kwh);
  const predictionPacks = toOptionalFiniteNumber(cp.num_battery_packs);
  if (predictionCapacity != null && predictionPacks > 0) {
    return predictionCapacity / predictionPacks;
  }

  const batteryEntry = Object.entries(batteryResults ?? {})
    .find(([shiftKey, result]) => matchesSelectedShift(result, shiftKey, viewOptions))?.[1];
  const maxPhysicalKwh = toOptionalFiniteNumber(batteryEntry?.max_physical_kwh);
  const maxPhysicalPacks = toOptionalFiniteNumber(batteryEntry?.max_physical_packs);
  if (maxPhysicalKwh != null && maxPhysicalPacks > 0) {
    return maxPhysicalKwh / maxPhysicalPacks;
  }

  return null;
};

const resolveOptimizedInstalledNominalKwh = ({
  batteryEntry = {},
  matchedRun = null,
  scopedRuns = [],
  batteryResults = {},
  viewOptions = {},
} = {}) => {
  const optimizedPacks = toOptionalFiniteNumber(batteryEntry?.optimized_packs);
  const matchedRunCapacity = toOptionalFiniteNumber(
    matchedRun?.contextual_parameters?.battery_capacity_kwh
  );
  const matchedRunPacks = toOptionalFiniteNumber(
    matchedRun?.contextual_parameters?.num_battery_packs
  );
  if (
    optimizedPacks != null &&
    matchedRunCapacity != null &&
    matchedRunPacks === optimizedPacks
  ) {
    return matchedRunCapacity;
  }

  const maxPhysicalKwh = toOptionalFiniteNumber(batteryEntry?.max_physical_kwh);
  const maxPhysicalPacks = toOptionalFiniteNumber(batteryEntry?.max_physical_packs);
  if (
    optimizedPacks != null &&
    maxPhysicalKwh != null &&
    maxPhysicalPacks === optimizedPacks
  ) {
    return maxPhysicalKwh;
  }

  if (optimizedPacks != null) {
    const singlePackCapacityKwh = resolveSinglePackCapacityKwh(
      matchedRun ?? scopedRuns[0] ?? {},
      batteryResults,
      viewOptions
    );
    if (singlePackCapacityKwh != null) {
      return singlePackCapacityKwh * optimizedPacks;
    }
  }

  return toOptionalFiniteNumber(batteryEntry?.optimized_kwh);
};

const resolveOptimizedBatteryCoverageMarker = (
  predictionRuns = [],
  batteryResults = {},
  inputParams = {},
  viewOptions = {}
) => {
  const scopedRuns = scopePredictionRunsByShift(predictionRuns, viewOptions);
  const batteryEntries = Object.entries(batteryResults ?? {})
    .filter(([shiftKey, result]) => matchesSelectedShift(result, shiftKey, viewOptions))
    .map(([, result]) => result);
  const optimizedPacksValues = batteryEntries
    .map((entry) => toFiniteNumber(entry?.optimized_packs))
    .filter((value) => value != null);
  const optimizedPacks = optimizedPacksValues.length ? d3.max(optimizedPacksValues) : null;
  const batteryEntryForOptimized =
    batteryEntries.find(
      (entry) => toFiniteNumber(entry?.optimized_packs) === optimizedPacks
    ) ?? batteryEntries[0] ?? {};
  const matchedRun =
    optimizedPacks == null
      ? null
      : scopedRuns.find(
          (run) =>
            toFiniteNumber(run?.contextual_parameters?.num_battery_packs) ===
            optimizedPacks
        ) ?? null;
  const matchedRunIndex = matchedRun ? scopedRuns.indexOf(matchedRun) : -1;

  const optimizedNominalKwh = resolveOptimizedInstalledNominalKwh({
    batteryEntry: batteryEntryForOptimized,
    matchedRun,
    scopedRuns,
    batteryResults,
    viewOptions,
  });

  const optimizedCoveredKwh =
    applyUsableSocWindow(optimizedNominalKwh, resolveUsableSocFraction(inputParams)) ??
    optimizedNominalKwh;

  if (optimizedCoveredKwh == null) {
    return null;
  }

  const scenarioLabel =
    optimizedPacks != null
      ? formatFixed(optimizedPacks, 0)
      : (t("simulation.chart_label_optimized") || "Optimized");
  const scenarioTitle =
    matchedRun && matchedRunIndex >= 0
      ? buildPredictionScenarioTitle(matchedRun, matchedRunIndex)
      : optimizedPacks != null
        ? translateOr(
            "simulation.predictions_scenario_title",
            `Scenario ${formatFixed(optimizedPacks, 0)} packs`,
            { packs: formatFixed(optimizedPacks, 0) }
          )
        : (t("simulation.chart_label_optimized") || "Optimized");
  const tooltipLines = [];

  if (optimizedPacks != null) {
    tooltipLines.push(
      `${t("simulation.opt_col_opt_packs") || "Optimized Packs"}: ${formatFixed(
        optimizedPacks,
        0
      )}`
    );
  }
  if (
    optimizedNominalKwh != null &&
    Math.abs(optimizedCoveredKwh - optimizedNominalKwh) > 1e-9
  ) {
    tooltipLines.push(
      `${t("simulation.opt_col_opt_nominal_kwh") || "Optimized nominal (kWh)"}: ${formatFixed(
        optimizedNominalKwh,
        1
      )} kWh`
    );
  }

  return {
    scenarioLabel,
    scenarioTitle,
    value: optimizedCoveredKwh,
    nominalKwh: optimizedNominalKwh,
    label:
      translateOr(
        "simulation.efficiency_coverage_legend",
        "Optimized battery-covered energy"
      ),
    color: OPTIMIZATION_BATTERY_COLORS.optimized,
    tooltipLines,
  };
};

/* ── Sensitivity / Feasibility Insight Card ──────────────── */

const MARGIN_ADEQUATE_PCT = 0.15;
const MARGIN_TIGHT_PCT = 0.05;

const resolveBatteryMarginPresentation = ({ marginKwh, marginPct } = {}) => {
  if (marginKwh == null) return null;

  let marginLabel = "";
  let marginClass = "";
  if (marginPct != null) {
    if (marginPct < 0) {
      marginLabel = translateOr(
        "simulation.sensitivity_margin_exceeds",
        "Demand exceeds usable energy"
      );
      marginClass = "efficiency-sensitivity-card__margin-danger";
    } else if (marginPct < MARGIN_TIGHT_PCT) {
      marginLabel = translateOr("simulation.sensitivity_margin_very_tight", "Very tight");
      marginClass = "efficiency-sensitivity-card__margin-danger";
    } else if (marginPct < MARGIN_ADEQUATE_PCT) {
      marginLabel = translateOr("simulation.sensitivity_margin_tight", "Tight");
      marginClass = "efficiency-sensitivity-card__margin-tight";
    } else {
      marginLabel = translateOr("simulation.sensitivity_margin_adequate", "Adequate");
      marginClass = "efficiency-sensitivity-card__margin-ok";
    }
  } else {
    marginLabel =
      marginKwh < 0
        ? translateOr(
            "simulation.sensitivity_margin_exceeds",
            "Demand exceeds usable energy"
          )
        : translateOr("simulation.sensitivity_margin_adequate", "Adequate");
    marginClass =
      marginKwh < 0
        ? "efficiency-sensitivity-card__margin-danger"
        : "efficiency-sensitivity-card__margin-ok";
  }

  return { marginLabel, marginClass };
};

const formatBatteryMarginSummary = ({ marginKwh, marginPct } = {}) => {
  const presentation = resolveBatteryMarginPresentation({ marginKwh, marginPct });
  if (!presentation) return null;

  const pctStr =
    marginPct != null ? ` (${(marginPct * 100).toFixed(1)}%)` : "";

  return {
    text: `${formatFixed(marginKwh, 1)} kWh${pctStr} \u2014 ${presentation.marginLabel}`,
    marginClass: presentation.marginClass,
  };
};

const overviewMarginToneClass = (marginClass = "") => {
  if (marginClass === "efficiency-sensitivity-card__margin-ok") {
    return "overview-highlight--positive";
  }
  if (marginClass === "efficiency-sensitivity-card__margin-danger") {
    return "overview-highlight--negative";
  }
  return "overview-highlight--neutral";
};

const resolveSensitivityFeasibilityCardData = (
  results,
  ip,
  firstRun,
  viewOptions,
  { optimizedCoverageMarker = null, adequacyScenario = null } = {}
) => {
  const feasibility = results?.electrification_feasible;
  if (feasibility === null || feasibility === undefined) return null;

  const batteryResults = results?.battery_results ?? {};
  const batteryEntries = Object.entries(batteryResults).filter(
    ([shiftKey, result]) => matchesSelectedShift(result, shiftKey, viewOptions)
  );
  const batteryEntry = batteryEntries[0]?.[1] ?? Object.values(batteryResults)[0] ?? null;
  if (!batteryEntry) return null;

  const mode = ip?.mode ?? "";
  const optimizedPacks = toOptionalFiniteNumber(batteryEntry?.optimized_packs);
  const optimizedNominalKwh =
    toOptionalFiniteNumber(optimizedCoverageMarker?.nominalKwh) ??
    resolveOptimizedInstalledNominalKwh({
      batteryEntry,
      batteryResults,
      viewOptions,
    });
  const usableSocFraction = resolveUsableSocFraction(ip);
  const optimizedUsableKwh =
    toOptionalFiniteNumber(optimizedCoverageMarker?.value) ??
    applyUsableSocWindow(optimizedNominalKwh, usableSocFraction);
  const maxPhysicalPacks = toOptionalFiniteNumber(batteryEntry?.max_physical_packs);

  const externalTempCelsius = toOptionalFiniteNumber(firstRun?.external_temp_celsius);
  const heatingType = firstRun?.auxiliary_heating_type ?? null;
  const occupancyPercent = toOptionalFiniteNumber(firstRun?.occupancy_percent);

  const q50DemandKwh =
    toOptionalFiniteNumber(adequacyScenario?.q50) ??
    readPredictionTotalQuantileValue(firstRun?.summary ?? {}, {
      kind: "absolute",
      quantileKey: "q50",
    });
  const q95DemandKwh =
    toOptionalFiniteNumber(adequacyScenario?.q95) ??
    readPredictionTotalQuantileValue(firstRun?.summary ?? {}, {
      kind: "absolute",
      quantileKey: "q95",
    });

  let marginKwh = null;
  let marginPct = null;
  if (optimizedUsableKwh != null && q50DemandKwh != null) {
    marginKwh = optimizedUsableKwh - q50DemandKwh;
    marginPct = q50DemandKwh > 0 ? marginKwh / q50DemandKwh : null;
  }

  const atPhysicalLimit =
    optimizedPacks != null &&
    maxPhysicalPacks != null &&
    optimizedPacks >= maxPhysicalPacks;

  const chargingStations = Array.isArray(ip?.charging_stations)
    ? ip.charging_stations
    : [];
  const chargingStationsCount = chargingStations.length > 0
    ? chargingStations.length
    : null;

  const yearlyDistanceKm = toOptionalFiniteNumber(
    viewOptions?.costInputs?.yearlyDistanceKm
  );

  return {
    feasibility,
    mode,
    optimizedPacks,
    optimizedNominalKwh,
    usableSocFraction,
    optimizedUsableKwh,
    maxPhysicalPacks,
    externalTempCelsius,
    heatingType,
    occupancyPercent,
    q50DemandKwh,
    q95DemandKwh,
    marginKwh,
    marginPct,
    atPhysicalLimit,
    chargingStationsCount,
    yearlyDistanceKm,
  };
};

const buildSensitivityFeasibilityCardHtml = (data) => {
  if (!data) return "";

  const isFeasible = data.feasibility !== false;
  const feasBadgeClass = isFeasible ? "badge--positive" : "badge--negative";
  const feasLabel = isFeasible
    ? (t("simulation.feasibility_feasible") || "Feasible")
    : (t("simulation.feasibility_infeasible") || "Infeasible");

  const marginPresentation = resolveBatteryMarginPresentation({
    marginKwh: data.marginKwh,
    marginPct: data.marginPct,
  });
  const marginLabel = marginPresentation?.marginLabel ?? "";
  const marginClass = marginPresentation?.marginClass ?? "";

  const energyRows = [];

  if (data.optimizedUsableKwh != null) {
    energyRows.push(`
      <div class="efficiency-sensitivity-card__row">
        <span>${textContent(translateOr("simulation.sensitivity_usable_energy", "Usable energy"))}</span>
        <strong>${textContent(formatFixed(data.optimizedUsableKwh, 1))} kWh</strong>
      </div>`);
  }

  if (data.q50DemandKwh != null) {
    energyRows.push(`
      <div class="efficiency-sensitivity-card__row">
        <span>${textContent(translateOr("simulation.sensitivity_median_demand", "Median demand (Q50)"))}</span>
        <strong>${textContent(formatFixed(data.q50DemandKwh, 1))} kWh</strong>
      </div>`);
  }

  if (data.q95DemandKwh != null) {
    energyRows.push(`
      <div class="efficiency-sensitivity-card__row">
        <span>${textContent(translateOr("simulation.sensitivity_q95_demand", "Q95 demand"))}</span>
        <strong>${textContent(formatFixed(data.q95DemandKwh, 1))} kWh</strong>
      </div>`);
  }

  if (data.marginKwh != null) {
    const pctStr = data.marginPct != null
      ? ` (${(data.marginPct * 100).toFixed(1)}%)`
      : "";
    energyRows.push(`
      <div class="efficiency-sensitivity-card__row">
        <span>${textContent(translateOr("simulation.sensitivity_margin", "Battery margin"))}</span>
        <strong class="${marginClass}">${textContent(formatFixed(data.marginKwh, 1))} kWh${textContent(pctStr)} \u2014 ${textContent(marginLabel)}</strong>
      </div>`);
  }

  const warningRows = [];

  if (
    data.q95DemandKwh != null &&
    data.optimizedUsableKwh != null &&
    data.q95DemandKwh > data.optimizedUsableKwh
  ) {
    warningRows.push(`
      <div class="efficiency-sensitivity-card__row efficiency-sensitivity-card__margin-tight">
        \u26a0 ${textContent(translateOr("simulation.sensitivity_q95_exceeds", "Q95 demand exceeds usable energy."))}
      </div>`);
  }

  if (data.atPhysicalLimit) {
    warningRows.push(`
      <div class="efficiency-sensitivity-card__row efficiency-sensitivity-card__margin-danger">
        \u26a0 ${textContent(translateOr("simulation.sensitivity_physical_limit_warning", "Optimized pack count reaches the physical pack limit."))}
      </div>`);
  }

  const bodyRows = [...energyRows, ...warningRows];
  const bodyHtml = bodyRows.length
    ? `<div class="efficiency-sensitivity-card__body">${bodyRows.join("")}</div>`
    : "";

  const drivers = [];

  if (data.mode) {
    drivers.push(`<span class="efficiency-sensitivity-card__chip">${textContent(t("simulation.var_optimization_mode") || "Mode")}: ${textContent(modeLabel(data.mode))}</span>`);
  }

  if (data.usableSocFraction != null) {
    drivers.push(`<span class="efficiency-sensitivity-card__chip">${textContent(translateOr("simulation.sensitivity_driver_usable_soc", "Usable SoC"))}: ${textContent(formatPct(data.usableSocFraction))}</span>`);
  }

  if (data.externalTempCelsius != null) {
    drivers.push(`<span class="efficiency-sensitivity-card__chip">${textContent(translateOr("simulation.efficiency_external_temp_short", "External temperature"))}: ${textContent(String(data.externalTempCelsius))} \u00b0C</span>`);
  }

  if (data.heatingType) {
    const htLabel = t(HEATING_LABELS[data.heatingType]) ?? data.heatingType;
    drivers.push(`<span class="efficiency-sensitivity-card__chip">${textContent(translateOr("simulation.efficiency_heating_type_short", "Heating type"))}: ${textContent(htLabel)}</span>`);
  }

  if (data.occupancyPercent != null) {
    drivers.push(`<span class="efficiency-sensitivity-card__chip">${textContent(translateOr("simulation.efficiency_occupancy_short", "Occupancy"))}: ${textContent(String(data.occupancyPercent))}%</span>`);
  }

  if (data.optimizedPacks != null) {
    drivers.push(`<span class="efficiency-sensitivity-card__chip">${textContent(translateOr("simulation.sensitivity_driver_opt_packs", "Optimized packs"))}: ${textContent(String(data.optimizedPacks))}</span>`);
  }

  if (data.chargingStationsCount != null) {
    const chargingChipLabel =
      data.chargingStationsCount === 1
        ? translateOr(
            "simulation.sensitivity_driver_charging_available_one",
            "Charging available: 1 station"
          )
        : translateOr(
            "simulation.sensitivity_driver_charging_available_count",
            "Charging available: {count} stations",
            { count: formatFixed(data.chargingStationsCount, 0) }
          );
    drivers.push(
      `<span class="efficiency-sensitivity-card__chip">${textContent(chargingChipLabel)}</span>`
    );
  }

  if (data.yearlyDistanceKm != null) {
    drivers.push(
      `<span class="efficiency-sensitivity-card__chip">${textContent(
        translateOr(
          "simulation.sensitivity_driver_annual_distance",
          "Annual distance: {distance} km",
          { distance: formatFixed(data.yearlyDistanceKm, 0) }
        )
      )}</span>`
    );
  }

  const driversHtml = drivers.length
    ? `<div class="efficiency-sensitivity-card__drivers">
        <span class="efficiency-sensitivity-card__drivers-label">${textContent(translateOr("simulation.sensitivity_drivers_label", "Sensitivity drivers"))}</span>
        <div class="efficiency-sensitivity-card__chips">${drivers.join("")}</div>
      </div>`
    : "";

  return `
  <div class="efficiency-sensitivity-card">
    <div class="efficiency-sensitivity-card__header">
      <span class="efficiency-sensitivity-card__title">${textContent(translateOr("simulation.sensitivity_card_title", "Sensitivity / Feasibility Insight"))}</span>
      <span class="badge badge--compact ${feasBadgeClass}">${textContent(feasLabel)}</span>
    </div>
    ${bodyHtml}
    ${driversHtml}
    <p class="efficiency-sensitivity-card__disclaimer">${textContent(translateOr("simulation.sensitivity_disclaimer", "Indicative summary only. The detailed tables and charts below are the source of truth."))}</p>
  </div>`;
};

const renderEfficiencyTable = (el, state, viewOptions = {}) => {
  if (!el) return;

  if (state.status === "idle" || state.status === "loading") {
    el.innerHTML = `<p class="efficiency-state-msg">${textContent(t("simulation.efficiency_loading") || "Loading efficiency data…")}</p>`;
    return;
  }

  if (state.status === "error") {
    el.innerHTML = `<p class="efficiency-state-msg efficiency-state-error">${textContent(
      state.error ??
        t("simulation.efficiency_error") ??
        "Failed to load efficiency data."
    )}</p>`;
    return;
  }

  const { optimizationRun, predictionRuns } = state;
  const scopedPredictionRuns = scopePredictionRunsByShift(
    predictionRuns,
    viewOptions
  );
  const ip = optimizationRun?.input_params ?? {};
  const results = optimizationRun?.results ?? {};
  const firstRun = scopedPredictionRuns[0] ?? predictionRuns?.[0] ?? {};
  const perBusSummary = results.per_bus_summary ?? [];
  const batteryResults = results.battery_results ?? {};
  const singlePackCapacityKwh = resolveSinglePackCapacityKwh(
    firstRun,
    batteryResults,
    viewOptions
  );

  const conditions = [
    { label: t("simulation.var_optimization_mode") || "Mode", value: modeLabel(ip.mode ?? "") },
    {
      label:
        translateOr("simulation.efficiency_soc_range", "Min / Max SoC"),
      value: `${formatPct(ip.min_soc ?? 0.4)} / ${formatPct(ip.max_soc ?? 0.9)}`,
    },
    {
      label: t("simulation.overview_single_pack_capacity") || "Single pack capacity",
      value: singlePackCapacityKwh == null ? "—" : `${formatFixed(singlePackCapacityKwh, 0)} kWh`,
    },
    { label: t("simulation.efficiency_soh") || "State of Health", value: formatPct(ip.state_of_health ?? 1.0) },
    {
      label:
        translateOr("simulation.efficiency_external_temp_short", "External temperature"),
      value: firstRun.external_temp_celsius != null ? `${firstRun.external_temp_celsius} °C` : "—",
    },
    {
      label:
        translateOr("simulation.efficiency_occupancy_short", "Average passengers"),
      value: firstRun.occupancy_percent != null ? `${firstRun.occupancy_percent}%` : "—",
    },
    {
      label:
        translateOr("simulation.efficiency_heating_type_short", "Heating type"),
      value: textContent(
        t(HEATING_LABELS[firstRun.auxiliary_heating_type]) ??
          firstRun.auxiliary_heating_type ??
          "—"
      ),
    },
  ];

  const conditionsHtml = conditions.map(({ label, value }) => `
    <div class="efficiency-param">
      <span class="efficiency-param-label">${textContent(label)}</span>
      <span class="efficiency-param-value">${value}</span>
    </div>`).join("");
  const predictionSummaryHtml = renderEfficiencyPredictionSummary(
    viewOptions?.costInputs ?? null
  );

  const optimizationHtml = buildOptimizationResultsHtml(results, ip, {
    ...viewOptions,
    predictedShiftConsumptionMedianKwh:
      toOptionalFiniteNumber(viewOptions?.costInputs?.predictedShiftConsumptionMedianKwh) ??
      readPredictionTotalQuantileValue(firstRun?.summary ?? {}, {
        kind: "absolute",
        quantileKey: "q50",
      }) ??
      toOptionalFiniteNumber(firstRun?.summary?.total_consumption_kwh),
    predictedShiftConsumptionKwh:
      toOptionalFiniteNumber(viewOptions?.costInputs?.predictedShiftConsumptionKwh) ??
      toOptionalFiniteNumber(firstRun?.summary?.total_consumption_kwh),
  });
  const isFeasible = results.electrification_feasible !== false;

  const predictionData = buildUnifiedPredictionData(
    scopedPredictionRuns,
    perBusSummary,
    batteryResults,
    {
      ...viewOptions,
      inputParams: ip,
    }
  );
  const consumptionOverviewData = buildPredictionOverviewData(
    scopedPredictionRuns,
    { kind: "absolute" }
  );
  const optimizedCoverageMarker = resolveOptimizedBatteryCoverageMarker(
    scopedPredictionRuns,
    batteryResults,
    ip,
    viewOptions
  );
  const adequacyScenario = optimizedCoverageMarker
    ? consumptionOverviewData.find(
        (item) => item?.scenarioLabel === optimizedCoverageMarker.scenarioLabel
      ) ?? null
    : null;
  const batteryAdequacyHtml = optimizedCoverageMarker
    ? renderBatteryAdequacyPanel(
        computeBatteryAdequacyStatus({
          usableEnergyKwh: optimizedCoverageMarker.value,
          q50DemandKwh: adequacyScenario?.q50,
          q95DemandKwh: adequacyScenario?.q95,
        })
      )
    : "";
  const hasPerBus = perBusSummary.length > 0;
  const unifiedRows = buildUnifiedPredictionRows(predictionData, {
    includePerBus: hasPerBus,
  });

  const tableBody = predictionData.length === 0
    ? `<tr><td colspan="${hasPerBus ? 14 : 12}" class="efficiency-no-data">${textContent(t("simulation.efficiency_no_predictions") || "No prediction data available.")}</td></tr>`
    : unifiedRows;

  const perBusHeaders = hasPerBus ? `
              <th>${textContent(t("simulation.opt_col_min_soc") || "Min SoC (kWh)")}</th>
              <th>${textContent(t("simulation.opt_col_max_soc") || "Max SoC (kWh)")}</th>` : "";

  const chartCards = [];

  if (predictionData.length > 0) {
    chartCards.push(`
        <div class="chart-section efficiency-chart-card">
          <div class="efficiency-chart-copy">
            <h4>${textContent(t("simulation.efficiency_energy_breakdown_title") || "Energy consumption breakdown")}</h4>
            <p>${textContent(t("simulation.efficiency_energy_breakdown_subtitle") || "Compare drivetrain and auxiliary demand for each battery-pack scenario.")}</p>
          </div>
          <div class="chart-container efficiency-chart-container" data-role="efficiency-energy-chart"></div>
      <div class="chart-legend efficiency-chart-legend" data-role="efficiency-energy-legend"></div>
        </div>`);
  }

  if (consumptionOverviewData.length || optimizedCoverageMarker) {
    chartCards.unshift(`
        <div class="chart-section efficiency-chart-card">
          <div class="efficiency-chart-copy">
            <h4>${textContent(
              translateOr(
                "simulation.efficiency_consumption_coverage_title",
                "Consumption quantiles and battery-covered energy"
              )
            )}</h4>
            <p>${textContent(
              translateOr(
                "simulation.efficiency_consumption_coverage_subtitle",
                "Compare simulated total-consumption quantiles with the energy available from the optimized battery-pack setup."
              )
            )}</p>
            <p>${textContent(quantileHelpText())}</p>
          </div>
          <div
            class="chart-container efficiency-chart-container"
            data-role="efficiency-consumption-coverage-chart"
          ></div>
          <div
            class="chart-legend efficiency-chart-legend"
            data-role="efficiency-consumption-coverage-legend"
          ></div>
          ${batteryAdequacyHtml}
        </div>`);
  }

  const chartGridClass =
    chartCards.length === 2
      ? "efficiency-chart-grid efficiency-chart-grid--two"
      : "efficiency-chart-grid";
  const chartsHtml = chartCards.length > 0
    ? `
    <div class="efficiency-section">
      <h3 class="efficiency-section-title">${textContent(t("simulation.efficiency_graphical_analysis") || "Visual analysis")}</h3>
      <div class="${chartGridClass}">
        ${chartCards.join("")}
      </div>
    </div>`
    : "";

  const predictionTableHtml = isFeasible || predictionData.length > 0
    ? `
    <section class="efficiency-section">
      <h3 class="efficiency-section-title">${textContent(t("simulation.efficiency_prediction_table_title") || "Energy Predictions by Battery Configuration")}</h3>
      <div class="efficiency-table-wrap">
        <table class="efficiency-table">
          <thead>
            <tr>
              <th>${textContent(t("simulation.efficiency_col_packs") || "# Packs")}</th>
              <th>${textContent(t("simulation.efficiency_col_capacity") || "Capacity (kWh)")}</th>
              <th>${textContent(t("simulation.efficiency_col_weight") || "Weight (kg)")}</th>
              <th>${textContent(t("simulation.efficiency_col_distance") || "Distance (km)")}</th>
              <th>${textContent(t("simulation.efficiency_col_total_energy") || "Total Energy (kWh)")}</th>
              <th>${textContent(t("simulation.efficiency_col_per_km") || "kWh / km")}</th>
              <th>${textContent(translateOr("simulation.efficiency_col_total_q50", "Total Q50 (kWh)"))}</th>
              <th>${textContent(translateOr("simulation.efficiency_col_total_q95", "Total Q95 (kWh)"))}</th>
              <th>${textContent(translateOr("simulation.efficiency_col_specific_q50", "Specific Q50 (kWh/km)"))}</th>
              <th>${textContent(translateOr("simulation.efficiency_col_specific_q95", "Specific Q95 (kWh/km)"))}</th>
              <th>${textContent(t("simulation.efficiency_col_drivetrain") || "Drivetrain (kWh)")}</th>
              <th>${textContent(t("simulation.efficiency_col_auxiliary") || "Auxiliary (kWh)")}</th>
              ${perBusHeaders}
            </tr>
          </thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
    </section>`
    : "";

  const sensitivityFeasibilityCardHtml = buildSensitivityFeasibilityCardHtml(
    resolveSensitivityFeasibilityCardData(results, ip, firstRun, viewOptions, {
      optimizedCoverageMarker,
      adequacyScenario,
    })
  );

  el.innerHTML = `
    ${isFeasible ? chartsHtml : ""}
    ${sensitivityFeasibilityCardHtml}
    <details class="efficiency-more-information">
      <summary class="efficiency-more-information__toggle">${textContent(t("simulation.efficiency_more_information") || "More information")}</summary>
      <div class="efficiency-more-information__content">
        <div class="efficiency-section">
          <h3 class="efficiency-section-title">${textContent(t("simulation.efficiency_operating_conditions") || "Operating Conditions")}</h3>
          <div class="kpi-grid efficiency-params-grid">${conditionsHtml}</div>
          ${predictionSummaryHtml}
        </div>
        ${optimizationHtml}
        ${predictionTableHtml}
      </div>
    </details>`;

  renderEfficiencyEnergySplitChart(
    el.querySelector('[data-role="efficiency-energy-chart"]'),
    predictionData
  );
  renderEfficiencyEnergyLegend(
    el.querySelector('[data-role="efficiency-energy-legend"]')
  );
  renderPredictionOverviewChart(
    el.querySelector('[data-role="efficiency-consumption-coverage-chart"]'),
    consumptionOverviewData,
    {
      unit: "kWh",
      ariaLabel: translateOr(
        "simulation.chart_aria_consumption_coverage",
        "Consumption quantiles and battery-covered energy chart"
      ),
      yAxisLabel: t("simulation.axis_energy_kwh") || "kWh",
      decimals: 1,
      markers: optimizedCoverageMarker ? [optimizedCoverageMarker] : [],
    }
  );
  renderPredictionOverviewLegend(
    el.querySelector('[data-role="efficiency-consumption-coverage-legend"]'),
    {
      seriesKeys: resolvePredictionOverviewSeriesKeys(consumptionOverviewData),
      extraItems: optimizedCoverageMarker
        ? [
            {
              label: optimizedCoverageMarker.label,
              color: optimizedCoverageMarker.color,
            },
          ]
        : [],
    }
  );
};

const firstFiniteValue = (...values) =>
  values.map((value) => toFiniteNumber(value)).find((value) => value != null) ?? null;

const extractYearlyDistanceKm = (payload) =>
  firstFiniteValue(
    payload,
    payload?.yearly_distance_km,
    payload?.yearlyDistanceKm,
    payload?.yearly_distance,
    payload?.yearlyDistance,
    payload?.annual_distance_km,
    payload?.annualDistanceKm,
    payload?.distance_km,
    payload?.distanceKm,
    payload?.km,
    payload?.value,
    payload?.data?.yearly_distance_km,
    payload?.data?.yearlyDistanceKm,
    payload?.data?.yearly_distance,
    payload?.data?.distance_km,
    payload?.data?.km
  );

const resolvePredictionRunShiftIds = (predictionRun = {}) => {
  const directIds = [
    predictionRun?.shift_ids,
    predictionRun?.shiftIds,
    predictionRun?.summary?.shift_ids,
    predictionRun?.summary?.shiftIds,
    predictionRun?.contextual_parameters?.shift_ids,
    predictionRun?.contextual_parameters?.shiftIds,
  ].find((value) => Array.isArray(value) && value.length);

  if (Array.isArray(directIds) && directIds.length) {
    return directIds.map((value) => firstText(value)).filter(Boolean);
  }

  const directId = firstText(
    predictionRun?.shift_id,
    predictionRun?.shiftId,
    predictionRun?.summary?.shift_id,
    predictionRun?.summary?.shiftId,
    predictionRun?.contextual_parameters?.shift_id,
    predictionRun?.contextual_parameters?.shiftId
  );

  return directId ? [directId] : [];
};

const resolvePredictionRunShiftNames = (predictionRun = {}) => {
  const directNames = [
    predictionRun?.shift_names,
    predictionRun?.shiftNames,
    predictionRun?.summary?.shift_names,
    predictionRun?.summary?.shiftNames,
    predictionRun?.contextual_parameters?.shift_names,
    predictionRun?.contextual_parameters?.shiftNames,
  ].find((value) => Array.isArray(value) && value.length);

  if (Array.isArray(directNames) && directNames.length) {
    return directNames.map((value) => firstText(value)).filter(Boolean);
  }

  const directName = firstText(
    predictionRun?.shift_name,
    predictionRun?.shiftName,
    predictionRun?.summary?.shift_name,
    predictionRun?.summary?.shiftName,
    predictionRun?.contextual_parameters?.shift_name,
    predictionRun?.contextual_parameters?.shiftName
  );

  return directName ? [directName] : [];
};

const matchesPredictionRunShift = (predictionRun = {}, options = {}) => {
  const selectedShiftId = firstText(options?.selectedShiftId, options?.shiftId);
  const selectedShiftName = firstText(options?.selectedShiftName, options?.shiftName);

  if (!selectedShiftId && !selectedShiftName) return true;

  const runShiftIds = resolvePredictionRunShiftIds(predictionRun);
  if (selectedShiftId && runShiftIds.includes(selectedShiftId)) {
    return true;
  }

  const runShiftNames = resolvePredictionRunShiftNames(predictionRun);
  if (selectedShiftName && runShiftNames.includes(selectedShiftName)) {
    return true;
  }

  return false;
};

const scopePredictionRunsByShift = (predictionRuns = [], options = {}) => {
  const runs = Array.isArray(predictionRuns) ? predictionRuns : [];
  const shiftMatchedRuns = runs.filter((run) =>
    matchesPredictionRunShift(run, options)
  );
  const scopedRuns = shiftMatchedRuns.length ? shiftMatchedRuns : runs;

  return [...scopedRuns].sort(
    (a, b) =>
      (toFiniteNumber(a?.contextual_parameters?.num_battery_packs) ??
        Number.MAX_SAFE_INTEGER) -
      (toFiniteNumber(b?.contextual_parameters?.num_battery_packs) ??
        Number.MAX_SAFE_INTEGER)
  );
};

const selectCostPredictionRun = (predictionRuns = [], batteryResults = {}, options = {}) => {
  if (!Array.isArray(predictionRuns) || !predictionRuns.length) return null;

  const shiftMatchedRuns = predictionRuns.filter((run) =>
    matchesPredictionRunShift(run, options)
  );
  const candidateRuns = shiftMatchedRuns.length ? shiftMatchedRuns : predictionRuns;
  const targetPacks = resolveOptimizedPackCount(batteryResults);
  if (targetPacks != null) {
    const exactMatch = candidateRuns.find(
      (run) =>
        toFiniteNumber(run?.contextual_parameters?.num_battery_packs) === targetPacks
    );
    if (exactMatch) return exactMatch;
  }

  return [...candidateRuns].reduce((best, run) => {
    const bestValue = readPredictionTotalQuantileValue(best?.summary, {
      kind: "per_km",
      quantileKey: "q50",
    });
    const candidateValue = readPredictionTotalQuantileValue(run?.summary, {
      kind: "per_km",
      quantileKey: "q50",
    });
    if (candidateValue == null) return best;
    if (bestValue == null || candidateValue < bestValue) return run;
    return best;
  }, candidateRuns[0]);
};

const resolveChargerPowerKw = (optimizationRun, options = {}) => {
  const installedChargers = Object.values(
    optimizationRun?.results?.installed_chargers ?? {}
  );
  const inputStations = Array.isArray(optimizationRun?.input_params?.charging_stations)
    ? optimizationRun.input_params.charging_stations
    : [];

  const perSlotCandidates = [
    ...installedChargers.flatMap((charger) => [
      charger?.max_power_per_slot_kw,
      charger?.power_per_slot_kw,
      (() => {
        const totalPower = toFiniteNumber(
          charger?.max_total_power_kw ?? charger?.total_power_kw ?? charger?.max_power_kw
        );
        const slots = toFiniteNumber(charger?.num_slots ?? charger?.slots);
        return totalPower != null && slots != null && slots > 0
          ? totalPower / slots
          : null;
      })(),
    ]),
    ...inputStations.flatMap((station) => [
      station?.max_power_per_slot_kw,
      station?.power_per_slot_kw,
      (() => {
        const totalPower = toFiniteNumber(
          station?.max_total_power_kw ?? station?.total_power_kw ?? station?.max_power_kw
        );
        const slots = toFiniteNumber(station?.num_slots);
        return totalPower != null && slots != null && slots > 0
          ? totalPower / slots
          : null;
      })(),
    ]),
    options?.busModelData?.max_charging_power_kw,
  ]
    .map((value) => toFiniteNumber(value))
    .filter((value) => value != null);

  return perSlotCandidates.length ? d3.max(perSlotCandidates) : null;
};

const DEFAULT_SHIFT_YEARLY_DISTANCE_RECURRENCE = "daily";

const resolveCostAnnualization = async (shiftId, predictionSummary = {}) => {
  const shiftDistanceKm = toFiniteNumber(predictionSummary?.total_distance_km);
  const shiftConsumptionKwh = toFiniteNumber(predictionSummary?.total_consumption_kwh);

  let yearlyDistanceKm = null;
  if (shiftId) {
    try {
      yearlyDistanceKm = extractYearlyDistanceKm(
        await fetchShiftYearlyDistance(shiftId, {
          recurrence: DEFAULT_SHIFT_YEARLY_DISTANCE_RECURRENCE,
        })
      );
    } catch (error) {
      console.warn(
        "[elettra] Unable to load shift yearly distance, falling back to weekly annualization:",
        error
      );
    }
  }

  const canUseYearlyDistance =
    yearlyDistanceKm != null &&
    yearlyDistanceKm > 0 &&
    shiftDistanceKm != null &&
    shiftDistanceKm > 0;
  const annualizationFactor = canUseYearlyDistance
    ? yearlyDistanceKm / shiftDistanceKm
    : COST_ANNUALIZATION_FACTOR;
  const annualConsumptionKwh =
    shiftConsumptionKwh != null && annualizationFactor > 0
      ? shiftConsumptionKwh * annualizationFactor
      : 0;

  return {
    mode: canUseYearlyDistance ? "yearly_distance" : "weekly_once",
    recurrence: canUseYearlyDistance
      ? DEFAULT_SHIFT_YEARLY_DISTANCE_RECURRENCE
      : "weekly_once",
    factor: annualizationFactor,
    opexAnnualizationRate: DEFAULT_OPEX_ANNUALIZATION_RATE,
    yearlyDistanceKm: canUseYearlyDistance ? yearlyDistanceKm : null,
    predictedShiftDistanceKm: shiftDistanceKm,
    predictedShiftConsumptionKwh: shiftConsumptionKwh,
    annualConsumptionKwh: Number(annualConsumptionKwh.toFixed(3)),
  };
};

const buildLinearModelParams = (prefix, valueAtLength, busLengthM, base) => {
  const v = toFiniteNumber(valueAtLength);
  if (v == null || v <= 0) return { [`${prefix}_const`]: null, [`${prefix}_per_m`]: null };
  const l = toFiniteNumber(busLengthM);
  if (l == null) return { [`${prefix}_const`]: v, [`${prefix}_per_m`]: null };
  const { intercept, slope } = rescaleLinearModelFromAnchor(
    l, v, base.intercept, base.slope
  );
  return { [`${prefix}_const`]: intercept, [`${prefix}_per_m`]: slope };
};

const buildEconomicComparisonParams = async (optimizationRun, predictionRuns, options = {}) => {
  const inputParams = optimizationRun?.input_params ?? {};
  const batteryResults = optimizationRun?.results?.battery_results ?? {};
  const selectedPredictionRun = selectCostPredictionRun(
    predictionRuns,
    batteryResults,
    options
  );
  const predictionSummary = selectedPredictionRun?.summary ?? {};
  const predictionTotalConsumptionQuantiles = readPredictionTotalQuantiles(
    predictionSummary
  );
  const predictionConsumptionPerKmQuantiles = readPredictionTotalQuantiles(
    predictionSummary,
    { kind: "per_km" }
  );
  const predictionContext = selectedPredictionRun?.contextual_parameters ?? {};
  const shiftId =
    String(options.shiftId ?? inputParams?.shift_ids?.[0] ?? "").trim();
  const busLengthM = firstFiniteValue(
    options?.busModelData?.bus_length_m,
    predictionContext?.bus_length_m
  );
  const batteryCapacityKwh = firstFiniteValue(
    predictionContext?.battery_capacity_kwh,
    (() => {
      const packCount = resolveOptimizedPackCount(batteryResults);
      const packSize = toFiniteNumber(options?.busModelData?.battery_pack_size_kwh);
      return packCount != null && packSize != null ? packCount * packSize : null;
    })()
  );
  const chargerPowerKw = resolveChargerPowerKw(optimizationRun, options);
  const optimizationMode = resolveOptimizationMode(optimizationRun, options) || "battery_only";
  const chargingStationRows = buildChargingStationRows(optimizationRun);
  const [annualization, shiftPresentation, resolvedDailyShiftDistanceKm] = await Promise.all([
    resolveCostAnnualization(shiftId, predictionSummary),
    resolveShiftPresentation(shiftId),
    resolveShiftDailyDistanceKm({ id: shiftId }),
  ]);
  const dailyShiftDistanceKm =
    annualization.yearlyDistanceKm != null &&
    annualization.recurrence === DEFAULT_SHIFT_YEARLY_DISTANCE_RECURRENCE
      ? annualization.yearlyDistanceKm / 365
      : resolvedDailyShiftDistanceKm;
  const interestRate = resolveInterestRate(options);
  const annualConsumptionKwh = annualization.annualConsumptionKwh;

  const invalidInputs = [
    !shiftId ? "shift_id" : null,
    busLengthM == null || busLengthM <= 0 ? "bus_length_m" : null,
    batteryCapacityKwh == null || batteryCapacityKwh <= 0
      ? "battery_capacity_kwh"
      : null,
    chargerPowerKw == null || chargerPowerKw <= 0 ? "charger_power_kw" : null,
    annualConsumptionKwh <= 0 ? "annual_consumption_kwh" : null,
  ].filter(Boolean);

  if (invalidInputs.length) {
    throw new Error(
      `${t("simulation.costs_not_enough_data") ||
        "Not enough optimization or prediction data to compute costs."} ${invalidInputs
        .map((key) => economicInputLabel(key))
        .join(", ")}.`
    );
  }

  const batteryPackCost = toFiniteNumber(options?.busModelData?.battery_pack_cost);
  const batteryPackSize = toFiniteNumber(options?.busModelData?.battery_pack_size_kwh);
  const derivedBatteryCostPerKwh =
    batteryPackCost != null && batteryPackCost > 0 &&
    batteryPackSize != null && batteryPackSize > 0
      ? batteryPackCost / batteryPackSize
      : null;

  const positiveOrNull = (v) => {
    const n = toFiniteNumber(v);
    return n != null && n > 0 ? n : null;
  };

  const lifetimeBus = resolveBusLifetimeYears(options);
  const dieselBusLifetime = resolveDieselBusLifetimeYears();
  const lifetimeBattery = resolveBatteryLifetimeYears(options);
  const batteryCostPerKwh = positiveOrNull(
    firstFiniteValue(inputParams?.battery_cost_per_kwh, derivedBatteryCostPerKwh)
  );
  const fuelCostPerL = positiveOrNull(resolveFuelCostPerL(options));
  const energyPricePerKwh = positiveOrNull(resolveEnergyPricePerKwh(options));
  // Discounted lifecycle horizon = e-bus lifespan.
  const projectedTrendHorizonYears = lifetimeBus;
  const electricBusReplacementYears = computeRecurringReplacementYears(
    lifetimeBus,
    projectedTrendHorizonYears
  );
  const dieselBusReplacementYears = computeRecurringReplacementYears(
    dieselBusLifetime,
    projectedTrendHorizonYears
  );
  const trendBatteryReplacementYears = computeBatteryReplacementYearsOverHorizon(
    lifetimeBus,
    lifetimeBattery,
    projectedTrendHorizonYears
  );

  const economicComparisonParams = {
    shift_id: shiftId,
    recurrence: annualization.recurrence,
    bus_length_m: busLengthM,
    battery_capacity_kwh: batteryCapacityKwh,
    charger_power_kw: chargerPowerKw,
    annual_consumption_kwh: annualConsumptionKwh,
    interest_rate: interestRate,
    lifetime_bus: lifetimeBus,
    lifetime_battery: lifetimeBattery,
    battery_cost_per_kwh: batteryCostPerKwh,
    fuel_cost_per_l: fuelCostPerL,
    energy_price_per_kwh: energyPricePerKwh,
    ...buildLinearModelParams(
      "diesel_consumption",
      resolveDieselEfficiency(options),
      busLengthM,
      DIESEL_CONSUMPTION_BASE
    ),
    ...buildLinearModelParams(
      "diesel_maint_cost",
      resolveDieselMaintenanceCost(options),
      busLengthM,
      DIESEL_MAINT_BASE
    ),
    ...buildLinearModelParams(
      "electric_maint_cost",
      resolveElectricMaintenanceCost(options),
      busLengthM,
      ELECTRIC_MAINT_BASE
    ),
    include_capex: false,
  };

  return {
    params: economicComparisonParams,
    annualization: {
      ...annualization,
      opexAnnualizationRate: interestRate,
    },
    inputs: {
      shiftId,
      shiftName: shiftPresentation.shiftName,
      shiftLineLabel: shiftPresentation.lineLabel,
      shiftWeekdayLabel: shiftPresentation.weekdayLabel,
      optimizationMode,
      chargingStationRows,
      recurrence: annualization.recurrence,
      dailyShiftDistanceKm,
      yearlyDistanceKm: annualization.yearlyDistanceKm,
      predictedShiftDistanceKm: annualization.predictedShiftDistanceKm,
      predictedShiftConsumptionKwh: annualization.predictedShiftConsumptionKwh,
      predictedShiftConsumptionPerKmKwh: toFiniteNumber(
        predictionSummary?.consumption_per_km_kwh
      ),
      predictedShiftConsumptionMedianKwh: toFiniteNumber(
        predictionTotalConsumptionQuantiles?.q50
      ),
      predictedShiftConsumptionPerKmMedianKwh: toFiniteNumber(
        predictionConsumptionPerKmQuantiles?.q50
      ),
      annualizationFactor: annualization.factor,
      opexAnnualizationRate: interestRate,
      annualConsumptionKwh,
      busLengthM,
      batteryCapacityKwh,
      chargerPowerKw,
      interestRate,
      batteryCostPerKwh,
      fuelCostPerL,
      energyPricePerKwh,
      lifetimeBus,
      dieselBusLifetime,
      lifetimeBattery,
      replacementYears: computeReplacementYears(lifetimeBus, lifetimeBattery),
      electricBusReplacementYears,
      dieselBusReplacementYears,
      trendBatteryReplacementYears,
      projectedTrendHorizonYears,
      economicComparisonParams,
      batteryReplacementCost:
        resolveElectricBusCapex(options?.optimizationRun, options)?.totalBatteryChf ?? null,
    },
  };
};

const loadCostComparison = async (optimizationRun, predictionRuns, options = {}) => {
  const { params, annualization, inputs } = await buildEconomicComparisonParams(
    optimizationRun,
    predictionRuns,
    options
  );
  return {
    comparison: await fetchEconomicComparison(params),
    annualization,
    inputs,
  };
};

const renderCostVariablesSection = (sec, state, options = {}) => {
  if (!sec) return;

  const fuelInput = sec.querySelector('[data-role="cost-variable-fuel-cost"]');
  const energyInput = sec.querySelector('[data-role="cost-variable-energy-price"]');
  const interestRateInput = sec.querySelector('[data-role="cost-variable-interest-rate"]');
  const fuelValueEl = sec.querySelector('[data-role="cost-variable-fuel-cost-value"]');
  const energyValueEl = sec.querySelector('[data-role="cost-variable-energy-price-value"]');
  const interestRateValueEl = sec.querySelector('[data-role="cost-variable-interest-rate-value"]');
  const fuelResetBtn = sec.querySelector('[data-role="cost-variable-fuel-cost-reset"]');
  const energyResetBtn = sec.querySelector('[data-role="cost-variable-energy-price-reset"]');
  const interestRateResetBtn = sec.querySelector('[data-role="cost-variable-interest-rate-reset"]');
  const noteEl = sec.querySelector('[data-role="cost-variables-note"]');
  const fuelCostPerL = resolveFuelCostPerL(options);
  const energyPricePerKwh = resolveEnergyPricePerKwh(options);
  const interestRate = resolveInterestRate(options);
  const controlsDisabled = !state.optimizationRun;
  const energyIsDefault =
    normalizeEnergyPricePerKwh(options?.costOverrides?.energyPricePerKwh) == null;
  const interestRateIsDefault =
    normalizeInterestRate(options?.costOverrides?.interestRate) == null;

  if (fuelInput) {
    fuelInput.value = String(fuelCostPerL);
    fuelInput.disabled = controlsDisabled;
    setRangeProgress(fuelInput, fuelCostPerL);
  }
  if (energyInput) {
    energyInput.value = String(energyPricePerKwh);
    energyInput.disabled = controlsDisabled;
    setRangeProgress(energyInput, energyPricePerKwh);
  }
  if (interestRateInput) {
    interestRateInput.value = String(interestRate);
    interestRateInput.disabled = controlsDisabled;
    setRangeProgress(interestRateInput, interestRate);
  }
  if (fuelValueEl) {
    fuelValueEl.textContent = `CHF ${formatFixed(fuelCostPerL, 2)}`;
  }
  if (energyValueEl) {
    energyValueEl.textContent =
      energyIsDefault
        ? `${translateOr("simulation.costs_variable_default", "Default")} CHF ${formatFixed(energyPricePerKwh, 2)}`
        : `CHF ${formatFixed(energyPricePerKwh, 2)}`;
  }
  if (interestRateValueEl) {
    interestRateValueEl.textContent =
      interestRateIsDefault
        ? `${translateOr("simulation.costs_variable_default", "Default")} ${formatFixed(
            interestRate * 100,
            1
          )}%`
        : `${formatFixed(interestRate * 100, 1)}%`;
  }
  if (fuelResetBtn) {
    fuelResetBtn.disabled = controlsDisabled;
  }
  if (energyResetBtn) {
    energyResetBtn.disabled = controlsDisabled;
  }
  if (interestRateResetBtn) {
    interestRateResetBtn.disabled = controlsDisabled;
  }

  const capexInput = sec.querySelector('[data-role="diesel-var-capex"]');
  const efficiencyInput = sec.querySelector('[data-role="diesel-var-efficiency"]');
  const maintenanceInput = sec.querySelector('[data-role="diesel-var-maintenance"]');
  const capexValueEl = sec.querySelector('[data-role="diesel-var-capex-value"]');
  const efficiencyValueEl = sec.querySelector('[data-role="diesel-var-efficiency-value"]');
  const maintenanceValueEl = sec.querySelector('[data-role="diesel-var-maintenance-value"]');
  const capexResetBtn = sec.querySelector('[data-role="diesel-var-capex-reset"]');
  const efficiencyResetBtn = sec.querySelector('[data-role="diesel-var-efficiency-reset"]');
  const maintenanceResetBtn = sec.querySelector('[data-role="diesel-var-maintenance-reset"]');

  const busLenLabel = resolveBusLengthM(options);
  const efficiencyLabelEl = sec.querySelector('[data-role="diesel-var-efficiency-label"]');
  const maintLabelEl = sec.querySelector('[data-role="diesel-var-maintenance-label"]');
  const elecMaintLabelEl = sec.querySelector('[data-role="electric-var-maintenance-label"]');
  if (busLenLabel != null) {
    const lenStr = String(busLenLabel);
    if (efficiencyLabelEl) {
      efficiencyLabelEl.textContent =
        (t("simulation.var_diesel_efficiency_for_length") || "Diesel consumption for {length} m bus (l / km)")
          .replace("{length}", lenStr);
    }
    if (maintLabelEl) {
      maintLabelEl.textContent =
        (t("simulation.var_diesel_maintenance_for_length") || "Diesel maintenance for {length} m bus (CHF / km)")
          .replace("{length}", lenStr);
    }
    if (elecMaintLabelEl) {
      elecMaintLabelEl.textContent =
        (t("simulation.var_electric_maintenance_for_length") || "Electric maintenance for {length} m bus (CHF / km)")
          .replace("{length}", lenStr);
    }
  }

  const busParamDefaults = getBusParameterDefaults(busLenLabel);
  applySliderRange(efficiencyInput, busParamDefaults.diesel_consumption_l_per_km);
  applySliderRange(maintenanceInput, busParamDefaults.diesel_maintenance_chf_per_km);

  const dieselCapex = resolveEquivalentDieselBusCapex(options);
  const dieselEfficiency = resolveDieselEfficiency(options);
  const dieselMaintenance = resolveDieselMaintenanceCost(options);

  if (capexInput) {
    capexInput.value = String(dieselCapex ?? 350000);
    capexInput.disabled = controlsDisabled;
    setRangeProgress(capexInput, dieselCapex ?? 350000);
  }
  if (efficiencyInput) {
    efficiencyInput.value = String(dieselEfficiency);
    efficiencyInput.disabled = controlsDisabled;
    setRangeProgress(efficiencyInput, dieselEfficiency);
  }
  if (maintenanceInput) {
    maintenanceInput.value = String(dieselMaintenance);
    maintenanceInput.disabled = controlsDisabled;
    setRangeProgress(maintenanceInput, dieselMaintenance);
  }
  if (capexValueEl) {
    capexValueEl.textContent = dieselCapex != null ? `CHF ${formatCHF(dieselCapex)}` : "—";
  }
  if (efficiencyValueEl) {
    efficiencyValueEl.textContent = `${formatFixed(dieselEfficiency, 2)} l/km`;
  }
  if (maintenanceValueEl) {
    maintenanceValueEl.textContent = `CHF ${formatFixed(dieselMaintenance, 2)} /km`;
  }
  if (capexResetBtn) capexResetBtn.disabled = controlsDisabled;
  if (efficiencyResetBtn) efficiencyResetBtn.disabled = controlsDisabled;
  if (maintenanceResetBtn) maintenanceResetBtn.disabled = controlsDisabled;

  const elecMaintInput = sec.querySelector('[data-role="electric-var-maintenance"]');
  const elecMaintValueEl = sec.querySelector('[data-role="electric-var-maintenance-value"]');
  const elecMaintResetBtn = sec.querySelector('[data-role="electric-var-maintenance-reset"]');
  applySliderRange(elecMaintInput, busParamDefaults.electric_maintenance_chf_per_km);
  const electricMaintenance = resolveElectricMaintenanceCost(options);

  if (elecMaintInput) {
    elecMaintInput.value = String(electricMaintenance);
    elecMaintInput.disabled = controlsDisabled;
    setRangeProgress(elecMaintInput, electricMaintenance);
  }
  if (elecMaintValueEl) {
    elecMaintValueEl.textContent = `CHF ${formatFixed(electricMaintenance, 2)} /km`;
  }
  if (elecMaintResetBtn) elecMaintResetBtn.disabled = controlsDisabled;

  if (!noteEl) return;

  noteEl.hidden = true;

  if (
    (state.status === "loading" || state.status === "refreshing") &&
    state.optimizationRun
  ) {
    noteEl.textContent =
      t("simulation.costs_loading") || "Loading cost comparison…";
    noteEl.dataset.tone = "info";
    noteEl.hidden = false;
    return;
  }

  if (state.status === "error") {
    noteEl.textContent =
      state.error ||
      t("simulation.costs_error") ||
      "Unable to load cost comparison.";
    noteEl.dataset.tone = "error";
    noteEl.hidden = false;
    return;
  }
  noteEl.textContent = "";
  noteEl.removeAttribute("data-tone");
};

/* ── Overview tab: compact 3-column recap ─────────────────────── */

const overviewRowHtml = (label, value, raw = false, rawLabel = false) =>
  `<div class="overview-row">
    <span class="overview-row__label">${rawLabel ? label : textContent(label)}</span>
    <span class="overview-row__value">${raw ? value : textContent(value)}</span>
  </div>`;

const overviewColShell = (icon, title, bodyHtml) =>
  `<div class="overview-col">
    <div class="overview-col__header">
      <span class="overview-col__icon" aria-hidden="true">${icon}</span>
      <h3 class="overview-col__title">${textContent(title)}</h3>
    </div>
    ${bodyHtml}
  </div>`;

const renderOverviewPanel = (el, effState, cState, emState, opts = {}) => {
  if (!el) return;

  const allLoading =
    effState.status === "loading" ||
    effState.status === "idle" ||
    cState.status === "loading" ||
    cState.status === "idle";

  if (allLoading) {
    el.innerHTML = `<p class="overview-state-msg">${textContent(
      t("simulation.overview_loading") || "Loading overview data…"
    )}</p>`;
    return;
  }

  const columns = [];

  /* ── Column 1: Efficiency ────────────────────────────────────── */
  {
    const optRun = effState.optimizationRun;
    const results = optRun?.results ?? {};
    const ip = optRun?.input_params ?? {};
    const batteryResults = results.battery_results ?? {};
    const batteryEntry = Object.values(batteryResults)[0] ?? {};

    const feasible = results.electrification_feasible;
    const feasBadge =
      feasible === true ? "badge--positive"
        : feasible === false ? "badge--negative"
          : "badge--neutral";
    const feasLabel =
      feasible === true ? t("simulation.feasibility_feasible") || "Feasible"
        : feasible === false ? t("simulation.feasibility_infeasible") || "Infeasible"
          : "—";

    const optPacks = batteryEntry.optimized_packs;
    const optKwh = batteryEntry.optimized_kwh;

    const reqPacks = toFiniteNumber(batteryEntry.required_total_packs);
    const maxPacks = toFiniteNumber(batteryEntry.max_physical_packs);
    const optimizedKwh = toOptionalFiniteNumber(optKwh);
    const optimizedPacks = toOptionalFiniteNumber(optPacks);
    const maxPhysicalKwh = toOptionalFiniteNumber(batteryEntry.max_physical_kwh);
    const kwhPerPack =
      (optimizedKwh != null && optimizedPacks > 0)
        ? optimizedKwh / optimizedPacks
        : (maxPhysicalKwh != null && maxPacks > 0)
          ? maxPhysicalKwh / maxPacks
          : null;
    const singlePackCapacityKwh =
      toFiniteNumber(opts?.busModelData?.battery_pack_size_kwh) ?? kwhPerPack;
    const requiredKwh =
      toOptionalFiniteNumber(batteryEntry.required_total_kwh) ??
      (reqPacks != null && kwhPerPack != null ? reqPacks * kwhPerPack : null);
    const requiredUsableKwh = applyUsableSocWindow(
      requiredKwh,
      resolveUsableSocFraction(ip)
    );

    const predictedConsumption = firstFiniteValue(
      cState.costInputs?.predictedShiftConsumptionMedianKwh,
      cState.costInputs?.predictedShiftConsumptionKwh
    );
    const predictedDistance = cState.costInputs?.predictedShiftDistanceKm;
    const consumptionPerKm = firstFiniteValue(
      cState.costInputs?.predictedShiftConsumptionPerKmMedianKwh,
      cState.costInputs?.predictedShiftConsumptionPerKmKwh,
      predictedDistance > 0 && predictedConsumption != null
        ? predictedConsumption / predictedDistance
        : null
    );

    const overviewOptimizedUsableKwh = applyUsableSocWindow(
      optimizedKwh,
      resolveUsableSocFraction(ip)
    );
    const overviewQ50DemandKwh = toOptionalFiniteNumber(predictedConsumption);
    let overviewMarginKwh = null;
    let overviewMarginPct = null;
    if (overviewOptimizedUsableKwh != null && overviewQ50DemandKwh != null) {
      overviewMarginKwh = overviewOptimizedUsableKwh - overviewQ50DemandKwh;
      overviewMarginPct =
        overviewQ50DemandKwh > 0 ? overviewMarginKwh / overviewQ50DemandKwh : null;
    }
    const overviewMarginSummary = formatBatteryMarginSummary({
      marginKwh: overviewMarginKwh,
      marginPct: overviewMarginPct,
    });

    const body = [
      overviewRowHtml(
        t("simulation.opt_feasibility") || "Feasibility",
        `<span class="badge badge--compact ${feasBadge}">${textContent(feasLabel)}</span>`,
        true
      ),
      overviewRowHtml(
        t("simulation.var_optimization_mode") || "Mode",
        modeLabel(ip.mode ?? "")
      ),
      overviewRowHtml(
        t("simulation.opt_col_opt_packs") || "Optimized packs",
        optPacks != null ? String(optPacks) : "—"
      ),
      overviewRowHtml(
        t("simulation.overview_single_pack_capacity") || "Single pack capacity",
        singlePackCapacityKwh != null ? `${formatFixed(singlePackCapacityKwh, 0)} kWh` : "—"
      ),
      overviewRowHtml(
        t("simulation.overview_optimized_nominal_capacity") || "Optimized nominal capacity",
        optKwh != null ? `${formatFixed(optKwh, 0)} kWh` : "—"
      ),
      overviewRowHtml(
        usableSocInfoLabelHtml(
          t("simulation.opt_col_required_usable_kwh") || "Required usable (kWh)",
          { inputParams: ip, nominalKwh: requiredKwh, usableKwh: requiredUsableKwh }
        ),
        requiredUsableKwh != null ? `${formatFixed(requiredUsableKwh, 0)} kWh` : "—",
        false,
        true
      ),
      overviewRowHtml(
        t("simulation.overview_consumption_shift") || "Consumption / shift",
        predictedConsumption != null ? `${formatFixed(predictedConsumption, 0)} kWh` : "—"
      ),
      overviewRowHtml(
        t("simulation.overview_consumption_km") || "Consumption / km",
        consumptionPerKm != null ? `${formatFixed(consumptionPerKm, 3)} kWh` : "—"
      ),
      ...(overviewMarginSummary
        ? [
            overviewRowHtml(
              translateOr("simulation.sensitivity_margin", "Battery margin"),
              `<span class="overview-highlight ${overviewMarginToneClass(
                overviewMarginSummary.marginClass
              )}">${textContent(overviewMarginSummary.text)}</span>`,
              true
            ),
          ]
        : []),
    ].join("");

    columns.push(overviewColShell("⚡", t("simulation.tab_efficiency") || "Efficiency", body));
  }

  /* ── Column 2: Costs ─────────────────────────────────────────── */
  {
    const feasible =
      effState.optimizationRun?.results?.electrification_feasible !== false;
    const hasCostData = cState.status === "done" && cState.comparison;

    if (!feasible) {
      columns.push(overviewColShell(
        "💰",
        t("simulation.tab_costs") || "Costs",
        `<p class="overview-col__msg">${textContent(
          t("simulation.infeasible_costs_note") || "Not available — infeasible."
        )}</p>`
      ));
    } else if (!hasCostData) {
      const msg =
        cState.status === "error"
          ? cState.error || t("simulation.costs_error") || "Unable to load cost data."
          : t("simulation.overview_loading") || "Loading…";
      columns.push(overviewColShell(
        "💰",
        t("simulation.tab_costs") || "Costs",
        `<p class="overview-col__msg">${textContent(msg)}</p>`
      ));
    } else {
      const chartData = buildCostsChartData(cState.comparison, {
        ...opts,
        annualizationRate: cState.annualization?.opexAnnualizationRate,
        optimizationRun: cState.optimizationRun,
      });

      const annualTotals = chartData?.annualTotals;
      const yearlyData = chartData?.yearly;
      const electricAnnual = toFiniteNumber(annualTotals?.electric) ?? 0;
      const dieselAnnual = toFiniteNumber(annualTotals?.diesel) ?? 0;
      const annualSaving = dieselAnnual - electricAnnual;
      const breakEvenYear = computeBreakEvenYear(yearlyData);

      const electricCapex = chartData?.upfrontCapex?.electric ?? 0;
      const dieselCapex = chartData?.upfrontCapex?.diesel ?? 0;
      const electricOpex = toFiniteNumber(chartData?.annualOpex?.electric) ?? 0;
      const dieselOpex = toFiniteNumber(chartData?.annualOpex?.diesel) ?? 0;
      const yearlyKm = toFiniteNumber(
        cState.costInputs?.yearlyDistanceKm ?? cState.annualization?.yearlyDistanceKm
      );
      const electricPerKm = yearlyKm > 0 ? electricAnnual / yearlyKm : null;
      const dieselPerKm = yearlyKm > 0 ? dieselAnnual / yearlyKm : null;

      const toneCls = (val) =>
        val > 0 ? "overview-highlight--positive"
          : val < 0 ? "overview-highlight--negative"
            : "overview-highlight--neutral";

      const body = [
        overviewRowHtml(
          t("simulation.overview_capex_electric") || "CAPEX electric",
          `CHF ${formatCHF(Math.round(electricCapex))}`
        ),
        overviewRowHtml(
          t("simulation.overview_capex_diesel") || "CAPEX diesel",
          `CHF ${formatCHF(Math.round(dieselCapex))}`
        ),
        overviewRowHtml(
          t("simulation.overview_opex_electric") || "OPEX electric / yr",
          `CHF ${formatCHF(Math.round(electricOpex))}`
        ),
        overviewRowHtml(
          t("simulation.overview_opex_diesel") || "OPEX diesel / yr",
          `CHF ${formatCHF(Math.round(dieselOpex))}`
        ),
        overviewRowHtml(
          t("simulation.overview_electric_annual") || "Electric total / yr",
          `CHF ${formatCHF(Math.round(electricAnnual))}`
        ),
        overviewRowHtml(
          t("simulation.overview_diesel_annual") || "Diesel total / yr",
          `CHF ${formatCHF(Math.round(dieselAnnual))}`
        ),
        overviewRowHtml(
          t("simulation.overview_cost_per_km_electric") || "Cost / km electric",
          electricPerKm != null ? `${formatFixed(electricPerKm, 3)} CHF/km` : "—"
        ),
        overviewRowHtml(
          t("simulation.overview_cost_per_km_diesel") || "Cost / km diesel",
          dieselPerKm != null ? `${formatFixed(dieselPerKm, 3)} CHF/km` : "—"
        ),
        overviewRowHtml(
          costKpiLabel("annual_saving"),
          `<span class="overview-highlight ${toneCls(annualSaving)}">CHF ${formatCHF(Math.round(annualSaving))}</span>`,
          true
        ),
        overviewRowHtml(
          t("simulation.costs_kpi_break_even") || "Break-even",
          breakEvenYear != null
            ? `${t("simulation.general_year") || "Yr"} ${formatFixed(breakEvenYear, 1)}`
            : "—"
        ),
      ].join("");

      columns.push(overviewColShell("💰", t("simulation.tab_costs") || "Costs", body));
    }
  }

  /* ── Column 3: Emissions ─────────────────────────────────────── */
  {
    const feasible =
      effState.optimizationRun?.results?.electrification_feasible !== false;

    if (!feasible) {
      columns.push(overviewColShell(
        "🌿",
        t("simulation.tab_emissions") || "Emissions",
        `<p class="overview-col__msg">${textContent(
          t("simulation.infeasible_emissions_note") || "Not available — infeasible."
        )}</p>`
      ));
    } else if (!emState || emState.status !== "done" || !emState.electricYearly) {
      const msg =
        emState?.status === "error"
          ? emState.error || t("simulation.emissions_error") || "Unable to load data."
          : t("simulation.overview_loading") || "Loading…";
      columns.push(overviewColShell(
        "🌿",
        t("simulation.tab_emissions") || "Emissions",
        `<p class="overview-col__msg">${textContent(msg)}</p>`
      ));
    } else {
      const electricY = emState.electricYearly;
      const dieselY = emState.dieselYearly;
      const hasDiesel = !!dieselY;

      const emissionDefs = [
        { key: "gwp100a", label: "CO₂", i18n: "simulation.env_kpi_co2", unit: "t/yr", divisor: 1e6 },
        { key: "nox", label: "NOx", i18n: "simulation.env_kpi_nox", unit: "kg/yr", divisor: 1e6 },
        { key: "pm10", label: "PM₁₀", i18n: "simulation.env_kpi_pm10", unit: "kg/yr", divisor: 1e6 },
      ];

      const body = emissionDefs
        .filter((def) => electricY[def.key]?.total != null)
        .map((def) => {
          const eRaw = toFiniteNumber(electricY[def.key]?.total) ?? 0;
          const dRaw = hasDiesel ? (toFiniteNumber(dieselY[def.key]?.total) ?? 0) : null;
          const eVal = eRaw / def.divisor;
          const pctChange =
            dRaw != null && dRaw !== 0
              ? ((dRaw - eRaw) / Math.abs(dRaw)) * 100
              : null;
          const pctStr =
            pctChange != null
              ? `${pctChange > 0 ? "↓" : "↑"} ${formatFixed(Math.abs(pctChange), 0)}%`
              : "";
          const toneCls =
            pctChange != null && pctChange > 0 ? "overview-highlight--positive"
              : pctChange != null && pctChange < 0 ? "overview-highlight--negative"
                : "overview-highlight--neutral";

          const indicatorName = t(def.i18n) || def.label;
          const valueStr = pctStr
            ? `${formatFixed(eVal, 0)} <span class="overview-highlight ${toneCls}">${textContent(pctStr)}</span>`
            : `${formatFixed(eVal, 0)}`;

          return overviewRowHtml(
            `${indicatorName} (${def.unit})`,
            valueStr,
            true
          );
        })
        .join("");

      columns.push(overviewColShell("🌿", t("simulation.tab_emissions") || "Emissions", body));
    }
  }

  el.innerHTML = `<div class="overview-grid">${columns.join("")}</div>`;
};

const renderCostsSection = (sec, state, options = {}) => {
  if (!sec) return;

  renderCostVariablesSection(sec, state, options);

  const electricOpexEl = sec.querySelector('[data-role="costs-electric-opex"]');
  const dieselOpexEl = sec.querySelector('[data-role="costs-diesel-opex"]');
  const kpiEl = sec.querySelector('[data-role="costs-kpis"]');
  const noteEl = sec.querySelector('[data-role="costs-assumption"]');
  const barEl = sec.querySelector('[data-role="costs-bar-chart"]');
  const legendEl = sec.querySelector('[data-role="costs-legend"]');
  const lineEl = sec.querySelector('[data-role="costs-line-chart"]');
  const lineLegendEl = sec.querySelector('[data-role="costs-line-legend"]');
  const hasResolvedCostData =
    !!state.comparison && !!state.annualization && !!state.costInputs;

  const clearCharts = (message, tone) => {
    if (barEl) barEl.innerHTML = costsStateHtml(message, tone);
    if (legendEl) legendEl.innerHTML = "";
    if (lineLegendEl) lineLegendEl.innerHTML = "";
    if (lineEl) lineEl.innerHTML = costsStateHtml(message, tone);
  };

  if ((state.status === "idle" || state.status === "loading") && !hasResolvedCostData) {
    renderElectricOpexSection(electricOpexEl, state);
    renderDieselOpexSection(dieselOpexEl, state);
    renderCostsKpis(kpiEl, null);
    renderCostsAssumption(noteEl, state.annualization);
    clearCharts(t("simulation.costs_loading") || "Loading cost comparison…");
    return;
  }

  if (state.status === "error" && !hasResolvedCostData) {
    renderElectricOpexSection(electricOpexEl, state);
    renderDieselOpexSection(dieselOpexEl, state);
    renderCostsKpis(kpiEl, null);
    renderCostsAssumption(noteEl, state.annualization);
    clearCharts(
      state.error || t("simulation.costs_error") || "Unable to load cost comparison.",
      "error"
    );
    return;
  }

  renderElectricOpexSection(electricOpexEl, state);
  renderDieselOpexSection(dieselOpexEl, state);
  const chartData = buildCostsChartData(state.comparison, {
    ...options,
    annualizationRate: state.annualization?.opexAnnualizationRate,
    optimizationRun: state.optimizationRun,
  });
  const yearlyDistanceKm =
    state.costInputs?.yearlyDistanceKm ?? state.annualization?.yearlyDistanceKm;
  renderCostsKpis(kpiEl, state.comparison, chartData);
  renderCostsAssumption(noteEl, state.annualization);
  renderCostsBar(barEl, chartData?.tco ?? [], yearlyDistanceKm);
  renderCostsLegend(legendEl);
  renderCostsLine(lineEl, chartData?.yearly ?? []);
  renderCostsLineLegend(lineLegendEl);
};

/* ── Emissions tab ────────────────────────────────────────────── */

const EMISSIONS_POLLUTANTS = [
  { key: "gwp100a", i18n: "simulation.emissions_co2_label", fallback: "CO₂ (carbon dioxide)", color: "var(--color-danger)", unitGroup: "ton", divisor: 1e6, perKmUnit: "g/km" },
  { key: "nox", i18n: "simulation.emissions_nox_label", fallback: "NOx (nitric oxide)", color: "#d4a017", unitGroup: "kg", divisor: 1e6, perKmUnit: "mg/km" },
  { key: "pm10", i18n: "simulation.emissions_pm10_label", fallback: "PM₁₀", color: "#8b6914", unitGroup: "kg", divisor: 1e6, perKmUnit: "mg/km" },
];

/* ── Environmental page: Mission summary bar ─────────────────── */

const renderEnvMissionBar = (el, emState, pageOptions = {}) => {
  if (!el) return;

  const yi = emState?.yearlyImpact;
  const shiftName = pageOptions.shiftName || yi?.shift_name || "—";
  const busSize = yi?.bus_model_size || yi?.lca_vehicle?.lca_size || pageOptions.busModelData?.bus_length_m || "—";
  const yearlyKm = toFiniteNumber(yi?.yearly_distance_km);
  const yearlyKmStr = yearlyKm != null ? t("simulation.km_per_year_value", { value: formatFixed(yearlyKm, 0) }) : "—";
  const comparisonType = t("simulation.env_comparison_vs", {
    electric: t("simulation.emissions_toggle_electric") || "Electric",
    diesel: t("simulation.emissions_toggle_diesel") || "Diesel",
  });

  const items = [
    { label: t("simulation.env_mission_line") || "Mission", value: shiftName },
    { label: t("simulation.env_mission_bus") || "Bus", value: busSize },
    { label: t("simulation.env_mission_distance") || "Annual distance", value: yearlyKmStr },
    { label: t("simulation.env_mission_comparison") || "Comparison", value: comparisonType },
  ];

  el.innerHTML = items.map((item) => `
    <div class="env-mission-item">
      <span class="env-mission-item__label">${textContent(item.label)}:</span>
      <span class="env-mission-item__value">${textContent(item.value)}</span>
    </div>
  `).join("");
};

/* ── Environmental page: Main KPI cards ──────────────────────── */

const ENV_KPI_DEFS = [
  { key: "gwp100a", label: "CO₂", i18n: "simulation.env_kpi_co2", unit: "t/year", divisor: 1e6 },
  { key: "nox", label: "NOx", i18n: "simulation.env_kpi_nox", unit: "kg/year", divisor: 1e6 },
  { key: "pm10", label: "PM₁₀", i18n: "simulation.env_kpi_pm10", unit: "kg/year", divisor: 1e6 },
];

const renderEnvKpiCards = (el, emState) => {
  if (!el) return;

  if (!emState || emState.status !== "done" || !emState.electricYearly) {
    el.innerHTML = "";
    return;
  }

  const electricY = emState.electricYearly;
  const dieselY = emState.dieselYearly;
  const hasDiesel = !!dieselY;

  el.innerHTML = ENV_KPI_DEFS
    .filter((def) => electricY[def.key]?.total != null)
    .map((def) => {
      const eRaw = toFiniteNumber(electricY[def.key]?.total) ?? 0;
      const dRaw = hasDiesel ? (toFiniteNumber(dieselY[def.key]?.total) ?? 0) : null;

      let eDisplay = eRaw / def.divisor;
      let dDisplay = dRaw != null ? dRaw / def.divisor : null;
      let unitLabel = def.unit;

      const absDiff = dDisplay != null ? dDisplay - eDisplay : null;
      const pctChange = dRaw != null && dRaw !== 0
        ? ((dRaw - eRaw) / Math.abs(dRaw)) * 100
        : null;

      const isPositive = pctChange != null && pctChange > 0;
      const isNegative = pctChange != null && pctChange < 0;
      const tone = isPositive ? "positive" : isNegative ? "negative" : "neutral";

      const arrow = isPositive ? "↓" : isNegative ? "↑" : "";
      const pctStr = pctChange != null
        ? `${arrow} ${formatFixed(Math.abs(pctChange), 0)}%`
        : "—";
      const diffStr = absDiff != null
        ? `${absDiff > 0 ? "−" : "+"}${formatFixed(Math.abs(absDiff), 0)}`
        : "";

      const electricLabel = t("simulation.emissions_toggle_electric") || "Electric";
      const dieselLabel = t("simulation.emissions_toggle_diesel") || "Diesel";
      const decimals = 0;
      return `<div class="env-kpi-card env-kpi-card--${tone}">
        <p class="env-kpi-card__title">${textContent(t(def.i18n) || def.label)} <span class="env-kpi-card__unit-inline">(${textContent(unitLabel)})</span></p>
        <div class="env-kpi-card__values">
          <span class="env-kpi-card__val-label">${textContent(electricLabel)}</span>
          <span class="env-kpi-card__val-num">${formatFixed(eDisplay, decimals)}</span>
          ${hasDiesel && dDisplay != null ? `
            <span class="env-kpi-card__val-label">${textContent(dieselLabel)}</span>
            <span class="env-kpi-card__val-num">${formatFixed(dDisplay, decimals)}</span>
          ` : ""}
        </div>
        ${hasDiesel ? `
          <div class="env-kpi-card__delta">
            <span class="badge ${tone === "positive" ? "badge--positive" : tone === "negative" ? "badge--negative" : "badge--neutral"}">${textContent(pctStr)}</span>
            ${diffStr ? `<span class="env-kpi-card__abs-diff">${textContent(diffStr)}</span>` : ""}
          </div>
        ` : ""}
      </div>`;
    })
    .join("");
};

/* ── Environmental page: recap table ─────────────────────────── */

const ENV_TABLE_ROWS = [
  { key: "gwp100a", label: "CO₂ emissions", i18n: "simulation.env_table_co2", unit: "t/year", perKmUnit: "g/km", divisor: 1e6, decimals: 0, perKmDecimals: 0, rowTone: "green" },
  { key: "nox", label: "NOx emissions", i18n: "simulation.env_table_nox", unit: "kg/year", perKmUnit: "mg/km", divisor: 1e6, decimals: 0, perKmDecimals: 0, rowTone: "green" },
  { key: "pm10", label: "PM₁₀ emissions", i18n: "simulation.env_table_pm10", unit: "kg/year", perKmUnit: "mg/km", divisor: 1e6, decimals: 0, perKmDecimals: 0, rowTone: "amber" },
];

const renderEnvRecapTable = (el, emState) => {
  if (!el) return;
  if (!emState || emState.status !== "done" || !emState.electricYearly) {
    el.innerHTML = emissionsStateHtml(
      t("simulation.emissions_no_data") || "No environmental impact data available."
    );
    return;
  }

  const electricY = emState.electricYearly;
  const dieselY = emState.dieselYearly;
  const hasDiesel = !!dieselY;
  const yearlyDistKm = toFiniteNumber(emState?.yearlyImpact?.yearly_distance_km);

  const indicatorLabel = t("simulation.emissions_table_indicator") || "Indicator";
  const electricLabel = t("simulation.emissions_toggle_electric") || "Electric bus";
  const dieselLabel = t("simulation.emissions_toggle_diesel") || "Diesel bus";
  const diffLabel = t("simulation.emissions_saved_col") || "Difference (Diesel − Electric)";
  const reductionLabel = t("simulation.emissions_reduction_col") || "Reduction";
  const yearlySubLabel = t("simulation.env_table_subhead_yearly") || "yearly";
  const perKmSubLabel = t("simulation.env_table_subhead_per_km") || "per km";

  const resolveValue = (yearly, def) => toFiniteNumber(yearly?.[def.key]?.total) ?? 0;

  const visibleDefs = ENV_TABLE_ROWS.filter((def) => {
    if (def.key === "_renewablePrimaryEnergy") return electricY.primaryEnergy?.total != null;
    return electricY[def.key]?.total != null;
  });

  const rows = visibleDefs
    .map((def) => {
      const eRaw = resolveValue(electricY, def);
      const dRaw = hasDiesel ? resolveValue(dieselY, def) : null;
      const eDisplay = eRaw / def.divisor;
      const dDisplay = dRaw != null ? dRaw / def.divisor : null;
      const ePerKm = yearlyDistKm ? eRaw / yearlyDistKm : null;
      const dPerKm = yearlyDistKm && dRaw != null ? dRaw / yearlyDistKm : null;
      const diff = dDisplay != null ? dDisplay - eDisplay : null;
      const diffPerKm = dPerKm != null && ePerKm != null ? dPerKm - ePerKm : null;
      const pct = dRaw != null && dRaw !== 0
        ? ((dRaw - eRaw) / Math.abs(dRaw)) * 100
        : null;

      const pctStr = pct != null
        ? `${pct > 0 ? "−" : "+"}${formatFixed(Math.abs(pct), 0)}%`
        : "—";
      const pctTone = pct != null && pct > 0 ? "positive"
        : pct != null && pct < 0 ? "negative" : "";

      const unitSuffix = `<span class="env-cell-unit">${textContent(def.unit)}</span>`;
      const perKmUnitSuffix = `<span class="env-cell-unit">${textContent(def.perKmUnit)}</span>`;

      return `<tr class="env-row env-row--${def.rowTone}">
        <td>${textContent(t(def.i18n) || def.label)}</td>
        <td>${formatFixed(eDisplay, def.decimals)} ${unitSuffix}</td>
        <td>${ePerKm != null ? formatFixed(ePerKm, def.perKmDecimals) : "—"} ${perKmUnitSuffix}</td>
        ${hasDiesel ? `<td>${dDisplay != null ? formatFixed(dDisplay, def.decimals) : "—"} ${unitSuffix}</td>` : ""}
        ${hasDiesel ? `<td>${dPerKm != null ? formatFixed(dPerKm, def.perKmDecimals) : "—"} ${perKmUnitSuffix}</td>` : ""}
        ${hasDiesel ? `<td>${diff != null ? formatFixed(diff, def.decimals) : "—"} ${unitSuffix}</td>` : ""}
        ${hasDiesel ? `<td>${diffPerKm != null ? formatFixed(diffPerKm, def.perKmDecimals) : "—"} ${perKmUnitSuffix}</td>` : ""}
        ${hasDiesel ? `<td class="emissions-recap-reduction${pctTone ? ` emissions-recap-reduction--${pctTone}` : ""}">${textContent(pctStr)}</td>` : ""}
      </tr>`;
    })
    .join("");

  el.innerHTML = `<div class="emissions-recap-table-wrap">
    <table class="emissions-recap-table emissions-recap-table--env">
      <thead>
        <tr class="env-header-main">
          <th rowspan="2">${textContent(indicatorLabel)}</th>
          <th colspan="2">${textContent(electricLabel)}</th>
          ${hasDiesel ? `<th colspan="2">${textContent(dieselLabel)}</th>` : ""}
          ${hasDiesel ? `<th colspan="2">${textContent(diffLabel)}</th>` : ""}
          ${hasDiesel ? `<th rowspan="2">${textContent(reductionLabel)}</th>` : ""}
        </tr>
        <tr class="env-header-sub">
          <th>${textContent(yearlySubLabel)}</th>
          <th>${textContent(perKmSubLabel)}</th>
          ${hasDiesel ? `<th>${textContent(yearlySubLabel)}</th>` : ""}
          ${hasDiesel ? `<th>${textContent(perKmSubLabel)}</th>` : ""}
          ${hasDiesel ? `<th>${textContent(yearlySubLabel)}</th>` : ""}
          ${hasDiesel ? `<th>${textContent(perKmSubLabel)}</th>` : ""}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
};

const DIESEL_BAR_COLOR = CHART_VEHICLE_BAR_COLORS.diesel;
const ELECTRIC_BAR_COLOR = CHART_VEHICLE_BAR_COLORS.electric;

const renderEmissionsHistogram = (el, legendEl, emState) => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";

  if (!emState || emState.status !== "done" || !emState.electricYearly) {
    el.innerHTML = emissionsStateHtml(
      t("simulation.emissions_no_data") || "No environmental impact data available."
    );
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
      const displayElectric = eTotal / p.divisor;
      const displayDiesel = dTotal / p.divisor;
      const displaySaved = displayDiesel - displayElectric;
      const pctReduction = dTotal !== 0 ? ((dTotal - eTotal) / Math.abs(dTotal)) * 100 : 0;
      const unitLabel = p.unitGroup === "ton"
        ? (t("simulation.emissions_unit_ton_year") || "ton/year")
        : (t("simulation.emissions_unit_kg_year") || "kg/year");
      return {
        key: p.key,
        label: t(p.i18n) || p.fallback,
        color: p.color,
        unitGroup: p.unitGroup,
        unitLabel,
        saved: displaySaved,
        pctReduction,
        electric: displayElectric,
        diesel: displayDiesel,
      };
    });

  if (!data.length) {
    el.innerHTML = emissionsStateHtml(
      t("simulation.emissions_no_data") || "No environmental impact data available."
    );
    return;
  }

  const labelWidth = 120;
  const subBarGap = 3;
  const margin = { top: 12, right: 140, bottom: 28, left: labelWidth };
  const W = chartCanvasWidth(el, () =>
    renderEmissionsHistogram(el, legendEl, emState)
  );
  const chartHeight = CHART_PLOT_HEIGHT;
  // Bars are sized from the fixed canvas instead of the other way round, so the
  // chart is the same height whatever the pollutant count.
  const { band: groupHeight, gap: groupGap, offsetTop } = horizontalBandGeometry(
    data.length,
    margin,
    { height: chartHeight, maxBand: 64 }
  );
  const subBarHeight = hasDiesel ? (groupHeight - subBarGap) / 2 : groupHeight;

  const allValues = data.flatMap((d) => hasDiesel ? [d.electric, d.diesel] : [d.electric]);
  const maxVal = d3.max(allValues) * 1.15 || 1;

  const svg = svgBase(W, chartHeight,
    chartAriaLabel("simulation.chart_aria_emissions_saved", "Emissions saved horizontal bar chart"));

  const iW = W - margin.left - margin.right;
  const x = d3.scaleLinear().domain([0, maxVal]).nice().range([0, iW]);

  const gridG = svg.append("g");
  x.ticks(4).forEach((tick) => {
    gridG.append("line")
      .attr("x1", margin.left + x(tick)).attr("x2", margin.left + x(tick))
      .attr("y1", margin.top).attr("y2", chartHeight - margin.bottom)
      .attr("stroke", "var(--color-border-light)").attr("stroke-dasharray", "3,3");
  });

  data.forEach((item, i) => {
    const yBase = offsetTop + i * (groupHeight + groupGap);

    svg.append("text")
      .attr("x", margin.left - 10).attr("y", yBase + groupHeight / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .attr("font-size", CHART_FONT_LABEL).attr("font-weight", "600").attr("fill", "var(--color-text-main)")
      .text(item.label);

    if (hasDiesel) {
      svg.append("rect")
        .attr("x", margin.left).attr("y", yBase)
        .attr("width", Math.max(0, x(item.diesel)))
        .attr("height", subBarHeight)
        .attr("rx", 3)
        .attr("fill", DIESEL_BAR_COLOR)
        .append("title")
        .text(`${t("simulation.emissions_toggle_diesel") || "Diesel"}: ${formatFixed(item.diesel, 2)} ${item.unitLabel}`);

      svg.append("text")
        .attr("x", margin.left + Math.max(0, x(item.diesel)) + 4)
        .attr("y", yBase + subBarHeight / 2)
        .attr("dy", "0.35em")
        .attr("font-size", CHART_FONT_LABEL).attr("fill", "#888")
        .text(formatFixed(item.diesel, 2));
    }

    const electricY2 = hasDiesel ? yBase + subBarHeight + subBarGap : yBase;
    svg.append("rect")
      .attr("x", margin.left).attr("y", electricY2)
      .attr("width", Math.max(0, x(item.electric)))
      .attr("height", subBarHeight)
      .attr("rx", 3)
      .attr("fill", ELECTRIC_BAR_COLOR)
      .append("title")
      .text(`${t("simulation.emissions_toggle_electric") || "Electric"}: ${formatFixed(item.electric, 2)} ${item.unitLabel}`);

    svg.append("text")
      .attr("x", margin.left + Math.max(0, x(item.electric)) + 4)
      .attr("y", electricY2 + subBarHeight / 2)
      .attr("dy", "0.35em")
      .attr("font-size", CHART_FONT_LABEL).attr("fill", "var(--color-text-main)")
      .text(formatFixed(item.electric, 2));

    if (hasDiesel) {
      const savedPositive = item.saved > 0;
      const arrow = savedPositive ? "↓" : "↑";
      const tone = savedPositive ? "var(--color-success)" : "var(--color-danger)";
      const pctStr = `${arrow} ${formatFixed(Math.abs(item.pctReduction), 0)}%`;
      const savedStr = `${savedPositive ? "−" : "+"}${formatFixed(Math.abs(item.saved), 2)} ${item.unitLabel}`;

      svg.append("text")
        .attr("x", W - margin.right + 10).attr("y", yBase + groupHeight / 2 - 6)
        .attr("dy", "0.35em")
        .attr("font-size", CHART_FONT_LABEL).attr("font-weight", "700").attr("fill", tone)
        .text(pctStr);

      svg.append("text")
        .attr("x", W - margin.right + 10).attr("y", yBase + groupHeight / 2 + 8)
        .attr("dy", "0.35em")
        .attr("font-size", CHART_FONT_LABEL).attr("fill", "#888")
        .text(savedStr);
    }
  });

  const xAxis = d3.axisBottom(x).ticks(4).tickFormat((d) => formatFixed(d, 0));
  svg.append("g")
    .attr("transform", `translate(${margin.left},${chartHeight - margin.bottom})`)
    .call(xAxis)
    .selectAll("text").attr("font-size", CHART_FONT_TICK);

  el.appendChild(svg.node());

  if (legendEl) {
    const electricLabel = t("simulation.emissions_toggle_electric") || "Electric bus";
    const dieselLabel = t("simulation.emissions_toggle_diesel") || "Diesel bus";
    let html = "";
    if (hasDiesel) {
      html += `
        <div class="chart-legend-item">
          <span class="chart-legend-swatch" style="background:${DIESEL_BAR_COLOR}"></span>
          ${textContent(dieselLabel)}
        </div>`;
    }
    html += `
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:${ELECTRIC_BAR_COLOR}"></span>
        ${textContent(electricLabel)}
      </div>`;
    legendEl.innerHTML = html;
  }
};

const renderEmissionsRecapTable = (el, emState) => {
  if (!el) return;
  if (!emState || emState.status !== "done" || !emState.electricYearly) {
    el.innerHTML = emissionsStateHtml(
      t("simulation.emissions_no_data") || "No environmental impact data available."
    );
    return;
  }

  const electricY = emState.electricYearly;
  const dieselY = emState.dieselYearly;
  const hasDiesel = !!dieselY;
  const yearlyDistKm = toFiniteNumber(emState?.yearlyImpact?.yearly_distance_km);

  const pollutantLabel = t("simulation.emissions_table_pollutant") || "Pollutant";
  const electricLabel = t("simulation.emissions_toggle_electric") || "Electric bus";
  const dieselLabel = t("simulation.emissions_toggle_diesel") || "Diesel bus";
  const savedLabel = t("simulation.emissions_saved_col") || "Saved";
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
      const saved = displayD != null ? displayD - displayE : null;
      const savedPerKm = perKmD != null && perKmE != null ? perKmD - perKmE : null;
      const reduction = dTotal != null && dTotal !== 0
        ? ((dTotal - eTotal) / Math.abs(dTotal)) * 100
        : null;
      const unit = p.unitGroup === "ton"
        ? (t("simulation.emissions_unit_ton_year") || "ton/year")
        : (t("simulation.emissions_unit_kg_year") || "kg/year");
      const indicatorWithUnit = `${t(p.i18n) || p.fallback} ${unit} | ${p.perKmUnit}`;

      const reductionStr = reduction != null
        ? `${reduction > 0 ? "−" : "+"}${formatFixed(Math.abs(reduction), 0)}%`
        : "—";
      const reductionTone = reduction != null && reduction > 0 ? "positive"
        : reduction != null && reduction < 0 ? "negative" : "";

      return `<tr>
        <td>${textContent(indicatorWithUnit)}</td>
        <td>${formatFixed(displayE, 0)}</td>
        <td>${perKmE != null ? formatFixed(perKmE, 0) : "—"}</td>
        ${hasDiesel ? `<td>${displayD != null ? formatFixed(displayD, 0) : "—"}</td>` : ""}
        ${hasDiesel ? `<td>${perKmD != null ? formatFixed(perKmD, 0) : "—"}</td>` : ""}
        ${hasDiesel ? `<td>${saved != null ? formatFixed(saved, 0) : "—"}</td>` : ""}
        ${hasDiesel ? `<td>${savedPerKm != null ? formatFixed(savedPerKm, 0) : "—"}</td>` : ""}
        ${hasDiesel ? `<td class="emissions-recap-reduction${reductionTone ? ` emissions-recap-reduction--${reductionTone}` : ""}">${textContent(reductionStr)}</td>` : ""}
      </tr>`;
    })
    .join("");

  const CO2_SANITY_LIMIT_TON = 200;
  const co2Entry = EMISSIONS_POLLUTANTS.find((p) => p.key === "gwp100a");
  const co2Electric = co2Entry && electricY[co2Entry.key]?.total != null
    ? (toFiniteNumber(electricY[co2Entry.key].total) ?? 0) / co2Entry.divisor : 0;
  const co2Diesel = co2Entry && hasDiesel && dieselY[co2Entry.key]?.total != null
    ? (toFiniteNumber(dieselY[co2Entry.key].total) ?? 0) / co2Entry.divisor : 0;
  const co2Outlier = co2Electric > CO2_SANITY_LIMIT_TON || co2Diesel > CO2_SANITY_LIMIT_TON;
  if (co2Outlier) {
    console.warn(
      `[Emissions sanity] CO₂ exceeds ${CO2_SANITY_LIMIT_TON} ton/year for a single bus — ` +
      `electric: ${formatFixed(co2Electric, 1)} ton/year, diesel: ${formatFixed(co2Diesel, 1)} ton/year. ` +
      `Check raw API values and unit conversion divisors.`
    );
  }
  const sanityHtml = co2Outlier
    ? `<p class="emissions-state-msg emissions-state-msg--error" style="margin-bottom:var(--space-sm)">⚠ ${textContent(
        t("simulation.emissions_co2_sanity_warning") ||
        `CO₂ value exceeds ${CO2_SANITY_LIMIT_TON} ton/year for a single bus — please verify the data source.`
      )}</p>`
    : "";

  el.innerHTML = `${sanityHtml}<div class="emissions-recap-table-wrap">
    <table class="emissions-recap-table">
      <thead>
        <tr>
          <th>${textContent(pollutantLabel)}</th>
          <th>${textContent(`${electricLabel} ${perYearLabel}`)}</th>
          <th>${textContent(`${electricLabel} / km`)}</th>
          ${hasDiesel ? `<th>${textContent(`${dieselLabel} ${perYearLabel}`)}</th>` : ""}
          ${hasDiesel ? `<th>${textContent(`${dieselLabel} / km`)}</th>` : ""}
          ${hasDiesel ? `<th>${textContent(`${savedLabel} ${perYearLabel}`)}</th>` : ""}
          ${hasDiesel ? `<th>${textContent(`${savedLabel} / km`)}</th>` : ""}
          ${hasDiesel ? `<th>${textContent(reductionLabel)}</th>` : ""}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
};

const INTENSITY_DEFS = [
  { key: "gwp100a", i18n: "simulation.emissions_co2_label", fallback: "CO₂", unit: "g/km" },
  { key: "nox", i18n: "simulation.emissions_nox_label", fallback: "NOx", unit: "mg/km" },
  { key: "pm10", i18n: "simulation.emissions_pm10_label", fallback: "PM₁₀", unit: "mg/km" },
];

const renderEmissionsIntensityKpis = (el, emState) => {
  if (!el) return;
  const yearlyDistKm = toFiniteNumber(emState?.yearlyImpact?.yearly_distance_km);
  if (!emState || emState.status !== "done" || !emState.electricYearly || !yearlyDistKm) {
    el.innerHTML = "";
    return;
  }

  const electricY = emState.electricYearly;
  const dieselY = emState.dieselYearly;
  const hasDiesel = !!dieselY;

  el.innerHTML = INTENSITY_DEFS
    .filter((p) => electricY[p.key]?.total != null)
    .map((p) => {
      const eRaw = toFiniteNumber(electricY[p.key]?.total) ?? 0;
      const dRaw = hasDiesel ? (toFiniteNumber(dieselY[p.key]?.total) ?? 0) : null;
      const ePerKm = eRaw / yearlyDistKm;
      const dPerKm = dRaw != null ? dRaw / yearlyDistKm : null;
      const reduction = dRaw != null && dRaw !== 0
        ? ((dRaw - eRaw) / Math.abs(dRaw)) * 100
        : null;
      const redStr = reduction != null
        ? `${reduction > 0 ? "−" : "+"}${formatFixed(Math.abs(reduction), 0)}%`
        : "";
      const tone = reduction != null && reduction > 0 ? "positive"
        : reduction != null && reduction < 0 ? "negative" : "";

      return `<div class="emissions-kpi-card">
        <span class="emissions-kpi-label">${textContent(t(p.i18n) || p.fallback)}</span>
        <span class="emissions-kpi-value">${formatFixed(ePerKm, 1)} ${textContent(p.unit)}</span>
        ${hasDiesel && dPerKm != null ? `<span class="emissions-kpi-sub">${textContent(t("simulation.emissions_toggle_diesel") || "Diesel")}: ${formatFixed(dPerKm, 1)} ${textContent(p.unit)}</span>` : ""}
        ${redStr ? `<span class="emissions-kpi-reduction${tone ? ` emissions-kpi-reduction--${tone}` : ""}">${textContent(redStr)}</span>` : ""}
      </div>`;
    })
    .join("");
};

const CO2_PHASE_DIVISOR = 1e6;

const renderCo2PhaseBreakdown = (el, legendEl, emState) => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";

  if (!emState || emState.status !== "done" || !emState.electricYearly) {
    el.innerHTML = emissionsStateHtml(
      t("simulation.emissions_no_data") || "No environmental impact data available."
    );
    return;
  }

  const electricGwp = emState.electricYearly.gwp100a;
  const dieselGwp = emState.dieselYearly?.gwp100a;
  if (!electricGwp) {
    el.innerHTML = emissionsStateHtml(
      t("simulation.emissions_no_data") || "No CO₂ phase data available."
    );
    return;
  }

  const buildPhases = (gwp) =>
    LCA_PHASES.map((p) => ({
      key: p.key,
      label: t(p.i18n) || p.fallback,
      color: p.color,
      value: Math.max(0, (toFiniteNumber(gwp[p.key]) ?? 0) / CO2_PHASE_DIVISOR),
    }));

  const bars = [
    { label: t("simulation.emissions_toggle_electric") || "Electric", phases: buildPhases(electricGwp) },
  ];
  if (dieselGwp) {
    bars.push({ label: t("simulation.emissions_toggle_diesel") || "Diesel", phases: buildPhases(dieselGwp) });
  }

  const maxTotal = Math.max(...bars.map((b) => b.phases.reduce((s, p) => s + p.value, 0))) * 1.15 || 1;

  const labelWidth = 80;
  const margin = { top: 12, right: 64, bottom: 28, left: labelWidth };
  const W = chartCanvasWidth(el, () =>
    renderCo2PhaseBreakdown(el, legendEl, emState)
  );
  const chartHeight = CHART_PLOT_HEIGHT;
  const { band: barHeight, gap: barGap, offsetTop } = horizontalBandGeometry(
    bars.length,
    margin,
    { height: chartHeight, maxBand: 64 }
  );

  const svg = svgBase(W, chartHeight,
    chartAriaLabel("simulation.chart_aria_co2_phase", "CO₂ lifecycle phase breakdown"));
  const iW = W - margin.left - margin.right;
  const x = d3.scaleLinear().domain([0, maxTotal]).nice().range([0, iW]);

  bars.forEach((bar, i) => {
    const y = offsetTop + i * (barHeight + barGap);
    svg.append("text")
      .attr("x", margin.left - 8).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .attr("font-size", CHART_FONT_LABEL).attr("font-weight", "600").attr("fill", "var(--color-text-main)")
      .text(bar.label);

    let xOff = 0;
    const total = bar.phases.reduce((s, p) => s + p.value, 0);
    bar.phases.forEach((phase) => {
      const w = Math.max(0, x(phase.value));
      if (w > 0.5) {
        const pct = total > 0 ? Math.round((phase.value / total) * 100) : 0;
        svg.append("rect")
          .attr("x", margin.left + xOff).attr("y", y)
          .attr("width", w).attr("height", barHeight)
          .attr("fill", phase.color)
          .attr("rx", xOff === 0 ? 3 : 0)
          .style("cursor", "pointer")
          .append("title")
          .text(`${bar.label} · ${phase.label}: ${formatFixed(phase.value, 1)} ${t("simulation.emissions_unit_ton_year") || "ton/year"} (${pct}%)`);
        xOff += w;
      }
    });
    svg.append("text")
      .attr("x", margin.left + xOff + 6).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("font-size", CHART_FONT_LABEL).attr("fill", "#666")
      .text(`${formatFixed(total, 1)} ${t("simulation.emissions_unit_ton_year") || "ton/year"}`);
  });

  const xAxis = d3.axisBottom(x).ticks(5).tickFormat((d) => formatFixed(d, 0));
  svg.append("g")
    .attr("transform", `translate(${margin.left},${chartHeight - margin.bottom})`)
    .call(xAxis)
    .selectAll("text").attr("font-size", CHART_FONT_TICK);

  el.appendChild(svg.node());

  if (legendEl) {
    legendEl.innerHTML = LCA_PHASES.map((p) => `
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:${p.color}"></span>
        ${textContent(t(p.i18n) || p.fallback)}
      </div>`).join("");
  }
};

const ENERGY_COLORS = { renewable: "var(--color-success)", nonRenewable: "#e67e22" };

const renderPrimaryEnergy = (el, legendEl, emState) => {
  if (!el) return;
  el.innerHTML = "";
  if (legendEl) legendEl.innerHTML = "";

  if (!emState || emState.status !== "done" || !emState.electricYearly) {
    el.innerHTML = emissionsStateHtml(
      t("simulation.emissions_no_data") || "No environmental impact data available."
    );
    return;
  }

  const ePE = emState.electricYearly.primaryEnergy;
  const ePENR = emState.electricYearly.primaryEnergyNonRenewable;
  const dPE = emState.dieselYearly?.primaryEnergy;
  const dPENR = emState.dieselYearly?.primaryEnergyNonRenewable;

  if (!ePE || !ePENR) {
    el.innerHTML = emissionsStateHtml(
      t("simulation.emissions_no_data") || "No primary energy data available."
    );
    return;
  }

  const eTotal = toFiniteNumber(ePE.total) ?? 0;
  const eNR = toFiniteNumber(ePENR.total) ?? 0;
  const eRen = Math.max(0, eTotal - eNR);

  const dTotal = dPE ? (toFiniteNumber(dPE.total) ?? 0) : null;
  const dNR = dPENR ? (toFiniteNumber(dPENR.total) ?? 0) : null;
  const dRen = dTotal != null && dNR != null ? Math.max(0, dTotal - dNR) : null;

  const allTotals = [eTotal, dTotal].filter((v) => v != null);
  const peak = Math.max(...allTotals);
  let unitDiv = 1;
  let unitLabel = "MJ/year";
  if (peak > 1e6) { unitDiv = 1e3; unitLabel = "GJ/year"; }
  const renewableLabel = t("simulation.emissions_energy_renewable") || "Renewable";
  const nonRenewableLabel = t("simulation.emissions_energy_non_renewable") || "Non-renewable";
  const buildEnergySegments = (renewableValue, nonRenewableValue) => ([
    {
      key: "renewable",
      label: renewableLabel,
      color: ENERGY_COLORS.renewable,
      value: renewableValue / unitDiv,
    },
    {
      key: "nonRenewable",
      label: nonRenewableLabel,
      color: ENERGY_COLORS.nonRenewable,
      value: Math.max(0, nonRenewableValue) / unitDiv,
    },
  ]);

  const bars = [
    { label: t("simulation.emissions_toggle_electric") || "Electric", segments: buildEnergySegments(eRen, eNR) },
  ];
  if (dTotal != null) {
    bars.push({
      label: t("simulation.emissions_toggle_diesel") || "Diesel",
      segments: buildEnergySegments(dRen ?? 0, dNR ?? 0),
    });
  }

  const maxBar = Math.max(...bars.map((bar) => bar.segments.reduce((sum, segment) => sum + segment.value, 0))) * 1.15 || 1;

  const barHeight = 36;
  const barGap = 16;
  const labelWidth = 80;
  const margin = { top: 12, right: 80, bottom: 28, left: labelWidth };
  const W = 560;
  const chartHeight = margin.top + margin.bottom + bars.length * barHeight + (bars.length - 1) * barGap;

  const svg = svgBase(W, chartHeight,
    chartAriaLabel("simulation.chart_aria_primary_energy", "Primary energy consumption"));
  const iW = W - margin.left - margin.right;
  const x = d3.scaleLinear().domain([0, maxBar]).nice().range([0, iW]);

  bars.forEach((bar, i) => {
    const y = margin.top + i * (barHeight + barGap);
    svg.append("text")
      .attr("x", margin.left - 8).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .attr("font-size", CHART_FONT_LABEL).attr("font-weight", "600").attr("fill", "var(--color-text-main)")
      .text(bar.label);

    let xOff = 0;
    const total = bar.segments.reduce((sum, segment) => sum + segment.value, 0);
    bar.segments.forEach((segment) => {
      const w = Math.max(0, x(segment.value));
      if (w > 0.5) {
        const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
        svg.append("rect")
          .attr("x", margin.left + xOff).attr("y", y)
          .attr("width", w).attr("height", barHeight)
          .attr("fill", segment.color)
          .attr("rx", xOff === 0 ? 3 : 0)
          .style("cursor", "pointer")
          .append("title")
          .text(`${bar.label} · ${segment.label}: ${formatFixed(segment.value, 1)} ${unitLabel} (${pct}%)`);
        if (w > 50) {
          svg.append("text")
            .attr("x", margin.left + xOff + w / 2).attr("y", y + barHeight / 2)
            .attr("dy", "0.35em").attr("text-anchor", "middle")
            .attr("font-size", CHART_FONT_LABEL).attr("font-weight", "600").attr("fill", "var(--color-surface)")
            .attr("pointer-events", "none")
            .text(`${pct}%`);
        }
        xOff += w;
      }
    });
    svg.append("text")
      .attr("x", margin.left + xOff + 6).attr("y", y + barHeight / 2)
      .attr("dy", "0.35em").attr("font-size", CHART_FONT_LABEL).attr("fill", "#666")
      .text(`Total: ${formatFixed(total, 0)} ${unitLabel}`);
  });

  const xAxis = d3.axisBottom(x).ticks(5).tickFormat((d) => formatFixed(d, 0));
  svg.append("g")
    .attr("transform", `translate(${margin.left},${chartHeight - margin.bottom})`)
    .call(xAxis)
    .selectAll("text").attr("font-size", CHART_FONT_TICK);

  el.appendChild(svg.node());

  if (legendEl) {
    legendEl.innerHTML = `
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:${ENERGY_COLORS.renewable}"></span>
        ${textContent(renewableLabel)}
      </div>
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:${ENERGY_COLORS.nonRenewable}"></span>
        ${textContent(nonRenewableLabel)}
      </div>`;
  }
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

const loadEmissionsData = async (
  shiftId,
  { recurrence = "daily", passengers = 1, busLengthM, busModelName, yearlyDistanceKm } = {}
) => {
  let yearlyImpact = null;
  let electricYearly = null;

  try {
    yearlyImpact = await fetchShiftYearlyImpact(shiftId, { recurrence, passengers });
    electricYearly = yearlyImpact.yearly_impact ?? {};
  } catch (primaryErr) {
    const lcaSize = inferLcaSize(busLengthM, busModelName);
    if (!lcaSize) throw primaryErr;

    const allVehicles = await fetchLcaVehicles();
    const electricMatch =
      findVehicleByPowertrainAndSize(allVehicles, "bev", lcaSize);
    if (!electricMatch) throw primaryErr;

    let yDistKm = toFiniteNumber(yearlyDistanceKm);
    if (yDistKm == null) {
      try {
        const yd = await fetchShiftYearlyDistance(shiftId, { recurrence });
        yDistKm = yd.yearly_distance_km;
      } catch (_) {
        throw primaryErr;
      }
    }
    if (!yDistKm) throw primaryErr;

    const electricPerUnit = await fetchVehicleImpact(electricMatch.id, { passengers });
    electricYearly = scaleDieselImpactToYearly(electricPerUnit, yDistKm, passengers) ?? {};
    yearlyImpact = {
      shift_id: shiftId,
      shift_name: "",
      lca_vehicle: {
        lca_vehicle_id: electricMatch.id,
        lca_vehicle_name: electricMatch.name || electricMatch.id,
        lca_size: lcaSize,
        powertrain: electricMatch.powertrain || "electric",
      },
      bus_model_name: busModelName || "",
      bus_model_size: lcaSize,
      passengers,
      recurrence,
      yearly_distance_km: yDistKm,
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
      inferLcaSize(busLengthM, busModelName) ||
      "";
    if (electricSize) {
      const allVehicles = await fetchLcaVehicles();
      const dieselMatch = findDieselEquivalent(allVehicles, electricSize);
      if (dieselMatch) {
        dieselVehicleName = dieselMatch.name || dieselMatch.id;
        const dieselPerUnit = await fetchVehicleImpact(dieselMatch.id, { passengers });
        dieselYearly = scaleDieselImpactToYearly(
          dieselPerUnit,
          yearlyImpact?.yearly_distance_km,
          yearlyImpact?.passengers ?? passengers
        );
      }
    }
  } catch (_) {
    /* diesel comparison is best-effort */
  }

  return { yearlyImpact, electricYearly, dieselYearly, dieselVehicleName };
};

/* ── Chart render registry (lazy per tab) ─────────────────────── */

/* ── Init ──────────────────────────────────────────────────────── */

export const initializeSimulationResults = (root = document, options = {}) => {
  const section = root.querySelector("section.simulation-results-page");
  if (!section) return null;

  const cleanupHandlers = [];
  const renderedTabs = new Set();
  const costOverrides = {
    fuelCostPerL: normalizeFuelCostPerL(options?.costOverrides?.fuelCostPerL),
    energyPricePerKwh: normalizeEnergyPricePerKwh(
      options?.costOverrides?.energyPricePerKwh
    ),
    interestRate: normalizeInterestRate(options?.costOverrides?.interestRate),
    dieselBusCapex: toFiniteNumber(options?.costOverrides?.dieselBusCapex),
    dieselEfficiency: toFiniteNumber(options?.costOverrides?.dieselEfficiency),
    dieselMaintenanceCost: toFiniteNumber(options?.costOverrides?.dieselMaintenanceCost),
    electricMaintenanceCost: toFiniteNumber(options?.costOverrides?.electricMaintenanceCost),
  };
  const economicDefaults = {
    fuelCostPerL: normalizeFuelCostPerL(options?.economicDefaults?.fuelCostPerL),
    energyPricePerKwh: normalizeEnergyPricePerKwh(
      options?.economicDefaults?.energyPricePerKwh
    ),
    interestRate: normalizeInterestRate(options?.economicDefaults?.interestRate),
    dieselBusCapex: toFiniteNumber(options?.economicDefaults?.dieselBusCapex),
    dieselConsumptionConst: toFiniteNumber(options?.economicDefaults?.dieselConsumptionConst),
    dieselConsumptionPerM: toFiniteNumber(options?.economicDefaults?.dieselConsumptionPerM),
    dieselMaintCostConst: toFiniteNumber(options?.economicDefaults?.dieselMaintCostConst),
    dieselMaintCostPerM: toFiniteNumber(options?.economicDefaults?.dieselMaintCostPerM),
    electricMaintCostConst: toFiniteNumber(options?.economicDefaults?.electricMaintCostConst),
    electricMaintCostPerM: toFiniteNumber(options?.economicDefaults?.electricMaintCostPerM),
  };
  let activeShiftId = options.shiftId || "";
  let activeShiftName = options.shiftName || "";
  let availableShiftTabs = [];
  let loadedOptimizationRun = null;
  let loadedPredictionRuns = [];
  let shiftRefreshSeq = 0;
  let costVariableRefreshTimer = null;

  options.costOverrides = costOverrides;
  options.economicDefaults = economicDefaults;

  /* Async data — populated after loading the run */
  const costState = {
    status: "idle",
    comparison: null,
    optimizationRun: null,
    annualization: null,
    costInputs: null,
    error: null,
  };
  const efficiencyState = { status: "idle", optimizationRun: null, predictionRuns: [], error: null };

  const emissionsState = {
    status: "idle",
    yearlyImpact: null,
    electricYearly: null,
    dieselYearly: null,
    dieselVehicleName: null,
    error: null,
  };

  const isElectrificationFeasible = () =>
    loadedOptimizationRun?.results?.electrification_feasible !== false;

  const renderInfeasibleNotice = (container) => {
    if (!container) return;
    const msg =
      (t("simulation.infeasible_notice") ||
        "The optimization determined that electrification is not feasible for this configuration. Cost and emission data cannot be computed.");

    const batteryResults = loadedOptimizationRun?.results?.battery_results ?? {};
    const batteryEntries = Object.entries(batteryResults ?? {});
    const scopedEntries = batteryEntries.filter(([shiftKey, result]) =>
      matchesSelectedShift(result, shiftKey, { selectedShiftId: activeShiftId })
    );
    const usableSocFraction = resolveUsableSocFraction(
      loadedOptimizationRun?.input_params ?? {}
    );

    const maxPhysicalRows = (scopedEntries.length ? scopedEntries : batteryEntries)
      .map(([shiftKey, result], index) => {
        const maxNominalKwh = toOptionalFiniteNumber(result?.max_physical_kwh);
        return {
          shiftName:
            result?.shift_name ??
            shiftKey ??
            `${t("simulation.opt_col_shift") || "Shift"} ${index + 1}`,
          maxPacks: toFiniteNumber(result?.max_physical_packs),
          maxNominalKwh,
          maxKwh: applyUsableSocWindow(maxNominalKwh, usableSocFraction),
        };
      })
      .filter((row) => row.maxPacks != null || row.maxKwh != null);
    const maxPhysicalTooltipOptions =
      maxPhysicalRows.length === 1
        ? {
            inputParams: loadedOptimizationRun?.input_params ?? {},
            nominalKwh: maxPhysicalRows[0].maxNominalKwh,
            usableKwh: maxPhysicalRows[0].maxKwh,
          }
        : {};

    const maxPhysicalHtml = maxPhysicalRows.length
      ? `
        <div class="efficiency-table-wrap" style="margin-top: 1rem;">
          <table class="efficiency-table">
            <thead>
              <tr>
                <th class="efficiency-th-text">${textContent(
                  t("simulation.opt_col_shift") || "Shift"
                )}</th>
                <th>${textContent(
                  t("simulation.opt_col_max_packs") || "Max Physical Packs"
                )}</th>
                <th>${usableSocInfoLabelHtml(
                  t("simulation.opt_col_max_usable_kwh") || "Max usable (kWh)",
                  maxPhysicalTooltipOptions
                )}</th>
              </tr>
            </thead>
            <tbody>
              ${maxPhysicalRows
                .map(
                  (row) => `
                <tr>
                  <td>${textContent(row.shiftName ?? "—")}</td>
                  <td class="efficiency-td-num">${
                    row.maxPacks == null ? "—" : textContent(String(row.maxPacks))
                  }</td>
                  <td class="efficiency-td-num">${
                    row.maxKwh == null ? "—" : formatFixed(row.maxKwh, 0)
                  }</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`
      : "";

    container.innerHTML = `
      <div class="infeasibility-tab-notice">
        <div class="infeasibility-tab-notice__icon">⚠</div>
        <h3>${textContent(
          t("simulation.infeasible_tab_title") || "Electrification not feasible"
        )}</h3>
        <p>${textContent(msg)}</p>
        ${maxPhysicalHtml}
      </div>`;
  };

  const refreshCostsTab = () => {
    renderOpexInputsTable(scenarioScalingContentEl, costState, options);
    renderInvestmentSection(investmentContentEl, costState, options);
    refreshEfficiencyTab();
    refreshPredictionsTab();
    refreshOverviewTab();
    if (!renderedTabs.has("costs")) return;
    if (!isElectrificationFeasible()) {
      renderInfeasibleNotice(section.querySelector('[data-panel="costs"]'));
      return;
    }
    renderCostsSection(
      section.querySelector('[data-panel="costs"]'),
      costState,
      options
    );
  };

  const refreshCostVariableControls = () => {
    if (!renderedTabs.has("costs")) return;
    renderCostVariablesSection(
      section.querySelector('[data-panel="costs"]'),
      costState,
      options
    );
  };

  const refreshEfficiencyTab = () => {
    if (!renderedTabs.has("efficiency")) return;
    renderEfficiencyTable(
      section.querySelector('[data-role="efficiency-table"]'),
      efficiencyState,
      {
        selectedShiftId: activeShiftId,
        selectedShiftName: activeShiftName,
        costInputs: costState.costInputs,
      }
    );
  };

  const refreshPredictionsTab = () => {
    if (!renderedTabs.has("predictions")) return;
    const activeShift =
      availableShiftTabs.find((shift) => shift.id === activeShiftId) ?? null;
    renderPredictionsPanel(
      section.querySelector('[data-role="predictions-panel"]'),
      efficiencyState,
      {
        selectedShiftId: activeShiftId,
        selectedShiftName: activeShiftName,
        tripStopLookup: activeShift?.tripStopLookup,
      }
    );
  };

  const renderEmissionsPanel = (sec) => {
    const panel = sec.querySelector('[data-panel="emissions"]') ?? sec;
    const dynamicSlots = panel.querySelectorAll(
      '[data-role="env-mission-bar"], [data-role="env-kpi-cards"], ' +
      '[data-role="emissions-recap-table"], [data-role="emissions-histogram"], ' +
      '[data-role="emissions-histogram-legend"], [data-role="emissions-co2-phase"], ' +
      '[data-role="emissions-co2-phase-legend"]'
    );
    if (emissionsState.status === "loading") {
      dynamicSlots.forEach((el) => {
        el.innerHTML = emissionsStateHtml(
          t("simulation.emissions_loading") || "Loading environmental impact data…"
        );
      });
      return;
    }
    if (emissionsState.status === "error") {
      const msg = emissionsState.error || t("simulation.emissions_error") || "Unable to load environmental impact data.";
      dynamicSlots.forEach((el) => {
        el.innerHTML = emissionsStateHtml(msg, "error");
      });
      return;
    }
    try { renderEnvMissionBar(sec.querySelector('[data-role="env-mission-bar"]'), emissionsState, options); } catch (e) { console.error("[Emissions] renderEnvMissionBar failed:", e); }
    try { renderEnvKpiCards(sec.querySelector('[data-role="env-kpi-cards"]'), emissionsState); } catch (e) { console.error("[Emissions] renderEnvKpiCards failed:", e); }
    try { renderEmissionsIntensityKpis(sec.querySelector('[data-role="emissions-intensity-kpis"]'), emissionsState); } catch (e) { console.error("[Emissions] renderEmissionsIntensityKpis failed:", e); }
    try { renderEmissionsHistogram(sec.querySelector('[data-role="emissions-histogram"]'), sec.querySelector('[data-role="emissions-histogram-legend"]'), emissionsState); } catch (e) { console.error("[Emissions] renderEmissionsHistogram failed:", e); }
    try { renderEnvRecapTable(sec.querySelector('[data-role="emissions-recap-table"]'), emissionsState); } catch (e) { console.error("[Emissions] renderEnvRecapTable failed:", e); }
    try { renderCo2PhaseBreakdown(sec.querySelector('[data-role="emissions-co2-phase"]'), sec.querySelector('[data-role="emissions-co2-phase-legend"]'), emissionsState); } catch (e) { console.error("[Emissions] renderCo2PhaseBreakdown failed:", e); }
    linkifyMobitoolElement(panel.querySelector(".env-page__subtitle"));
    linkifyMobitoolElement(panel.querySelector('[data-role="env-methodology-note"] p'));
  };

  const refreshEmissionsTab = () => {
    if (!renderedTabs.has("emissions")) return;
    if (!isElectrificationFeasible()) {
      renderInfeasibleNotice(section.querySelector('[data-panel="emissions"]'));
      return;
    }
    renderEmissionsPanel(section);
  };

  const refreshOverviewTab = () => {
    if (!renderedTabs.has("overview")) return;
    renderOverviewPanel(
      section.querySelector('[data-role="overview-panel"]'),
      efficiencyState,
      costState,
      emissionsState,
      options
    );
  };

  const TAB_RENDERERS = {
    overview: (sec) => {
      renderOverviewPanel(
        sec.querySelector('[data-role="overview-panel"]'),
        efficiencyState,
        costState,
        emissionsState,
        options
      );
    },
    costs: (sec) => {
      const panel = sec.querySelector('[data-panel="costs"]') ?? sec;
      if (!isElectrificationFeasible()) {
        renderInfeasibleNotice(panel);
        return;
      }
      renderCostsSection(panel, costState, options);
    },
    efficiency: (sec) => {
      renderEfficiencyTable(
        sec.querySelector('[data-role="efficiency-table"]'),
        efficiencyState,
        {
          selectedShiftId: activeShiftId,
          selectedShiftName: activeShiftName,
          costInputs: costState.costInputs,
        }
      );
    },
    predictions: (sec) => {
      const activeShift =
        availableShiftTabs.find((shift) => shift.id === activeShiftId) ?? null;
      renderPredictionsPanel(
        sec.querySelector('[data-role="predictions-panel"]'),
        efficiencyState,
        {
          selectedShiftId: activeShiftId,
          selectedShiftName: activeShiftName,
          tripStopLookup: activeShift?.tripStopLookup,
        }
      );
    },
    emissions: (sec) => {
      if (!isElectrificationFeasible()) {
        const panel = sec.querySelector('[data-panel="emissions"]');
        renderInfeasibleNotice(panel);
        return;
      }
      renderEmissionsPanel(sec);
    },
  };

  const pageTitleEl = section.querySelector('[data-role="results-page-title"]');
  const simNameEl = section.querySelector('[data-role="sim-name"]');
  const evaluationNameEl = section.querySelector('[data-role="results-evaluation-name"]');
  const busModelEl = section.querySelector('[data-role="sim-bus-model"]');
  const shiftTabsEl = section.querySelector('[data-role="shift-tabs"]');
  const overlay = section.querySelector('[data-role="sim-data-overlay"]');
  const subtitleEl = section.querySelector('[data-role="sim-data-subtitle"]');
  const scenarioScalingContentEl = section.querySelector(
    '[data-role="scenario-scaling-content"]'
  );
  const investmentContentEl = section.querySelector('[data-role="investment-content"]');
  const fuelCostInput = section.querySelector('[data-role="cost-variable-fuel-cost"]');
  const energyPriceInput = section.querySelector('[data-role="cost-variable-energy-price"]');
  const interestRateInput = section.querySelector('[data-role="cost-variable-interest-rate"]');
  const fuelCostResetBtn = section.querySelector('[data-role="cost-variable-fuel-cost-reset"]');
  const energyPriceResetBtn = section.querySelector('[data-role="cost-variable-energy-price-reset"]');
  const interestRateResetBtn = section.querySelector('[data-role="cost-variable-interest-rate-reset"]');
  const dieselCapexInput = section.querySelector('[data-role="diesel-var-capex"]');
  const dieselEfficiencyInput = section.querySelector('[data-role="diesel-var-efficiency"]');
  const dieselMaintenanceInput = section.querySelector('[data-role="diesel-var-maintenance"]');
  const dieselCapexResetBtn = section.querySelector('[data-role="diesel-var-capex-reset"]');
  const dieselEfficiencyResetBtn = section.querySelector('[data-role="diesel-var-efficiency-reset"]');
  const dieselMaintenanceResetBtn = section.querySelector('[data-role="diesel-var-maintenance-reset"]');
  const electricMaintenanceInput = section.querySelector('[data-role="electric-var-maintenance"]');
  const electricMaintenanceResetBtn = section.querySelector('[data-role="electric-var-maintenance-reset"]');

  const busModelName = options.busModelName || "";
  const renderPageTitle = () => {
    if (!pageTitleEl) return;
    pageTitleEl.textContent =
      t("simulation.results_page_title") || "Feasibility evaluation results";
  };
  const renderEvaluationName = () => {
    if (!evaluationNameEl) return;
    evaluationNameEl.textContent =
      resolveSimulationName(loadedOptimizationRun, options) || "—";
  };
  const getResultsSubtitle = () =>
    firstText(options.simulationName, activeShiftName);

  renderPageTitle();
  renderEvaluationName();
  if (simNameEl) simNameEl.textContent = activeShiftName;
  if (busModelEl) busModelEl.textContent = busModelName;
  if (subtitleEl) {
    const subtitle = getResultsSubtitle();
    subtitleEl.textContent = subtitle;
    subtitleEl.hidden = !subtitle;
  }

  const renderGeneralInfo = (overrides = {}) => {
    const generalInfo = {
      ...FAKE_GENERAL_INFO,
      shift_name: activeShiftName,
      ...compactFieldEntries({
        name: options.simulationName,
        optimization_id: resolveOptimizationId(loadedOptimizationRun, options),
        creation_date: options.createdAt,
        external_temp_celsius: formatTemperatureValue(options.externalTemp),
        occupancy_percent: formatOccupancyValue(options.occupancyPercent),
        heating_type: formatHeatingTypeValue(options.heatingType),
        battery_packs: options.numBatteryPacks,
      }),
      ...compactFieldEntries(overrides),
    };
    renderFieldsInto(
      section.querySelector('[data-role="general-info"]'),
      generalInfo,
      generalLabels()
    );
  };

  const renderBusInfo = () => {
    const bmd = options.busModelData ?? {};
    const busInfo = {
      ...FAKE_BUS_INFO,
      bus_name: busModelName,
      ...(bmd.cost != null && bmd.cost !== "" ? { cost_chf: formatCHF(bmd.cost) } : {}),
      ...(bmd.bus_length_m != null && bmd.bus_length_m !== "" ? { bus_length_m: bmd.bus_length_m } : {}),
      ...(bmd.max_passengers != null && bmd.max_passengers !== "" ? { max_passengers: bmd.max_passengers } : {}),
      ...(bmd.bus_lifetime != null && bmd.bus_lifetime !== "" ? { bus_lifetime_years: bmd.bus_lifetime } : {}),
      ...(bmd.battery_pack_cost != null && bmd.battery_pack_cost !== "" ? { single_pack_battery_cost_chf: formatCHF(bmd.battery_pack_cost) } : {}),
      ...(bmd.battery_pack_lifetime != null && bmd.battery_pack_lifetime !== "" ? { battery_pack_lifetime_years: bmd.battery_pack_lifetime } : {}),
    };

    renderFieldsInto(
      section.querySelector('[data-role="bus-info"]'),
      busInfo,
      busLabels()
    );
  };

  const renderShiftTabs = () => {
    if (!shiftTabsEl) return;
    if (!availableShiftTabs.length) {
      shiftTabsEl.hidden = true;
      shiftTabsEl.innerHTML = "";
      return;
    }

    shiftTabsEl.hidden = false;
    shiftTabsEl.innerHTML = availableShiftTabs
      .map(
        (shift) => `
          <button
            type="button"
            class="results-shift-tab${shift.id === activeShiftId ? " active" : ""}"
            data-action="select-shift"
            data-shift-id="${textContent(shift.id)}"
            aria-pressed="${shift.id === activeShiftId ? "true" : "false"}"
          >
            ${textContent(shift.shiftName)}
          </button>`
      )
      .join("");
  };

  const refreshShiftScopedData = async ({ preserveExistingCostData = false } = {}) => {
    const currentSeq = ++shiftRefreshSeq;
    const activeShift =
      availableShiftTabs.find((shift) => shift.id === activeShiftId) ?? null;

    activeShiftName =
      activeShift?.shiftName || options.shiftName || activeShiftId || "—";
    options.shiftId = activeShiftId;
    options.shiftName = activeShiftName;
    renderShiftTabs();

    if (simNameEl) simNameEl.textContent = activeShiftName;
    if (subtitleEl) {
      const subtitle = getResultsSubtitle();
      subtitleEl.textContent = subtitle;
      subtitleEl.hidden = !subtitle;
    }
    renderEvaluationName();

    const firstPredictionRun = loadedPredictionRuns[0] ?? {};
    renderGeneralInfo({
      optimization_id: resolveOptimizationId(loadedOptimizationRun, options),
      simulation_type: resolveSimulationType(loadedOptimizationRun, options),
      lines: activeShift?.lineLabel || "—",
      day: activeShift?.weekdayLabel || "—",
      min_soc: formatSocValue(loadedOptimizationRun?.input_params?.min_soc),
      max_soc: formatSocValue(loadedOptimizationRun?.input_params?.max_soc),
      external_temp_celsius: formatTemperatureValue(
        firstPredictionRun.external_temp_celsius
      ),
      occupancy_percent: formatOccupancyValue(
        firstPredictionRun.occupancy_percent
      ),
      heating_type: formatHeatingTypeValue(
        firstPredictionRun.auxiliary_heating_type
      ),
    });

    refreshEfficiencyTab();
    refreshPredictionsTab();

    if (!loadedOptimizationRun) return;

    costState.status = preserveExistingCostData ? "refreshing" : "loading";
    if (!preserveExistingCostData) {
      costState.comparison = null;
      costState.annualization = null;
      costState.costInputs = null;
    }
    costState.error = null;
    costState.optimizationRun = loadedOptimizationRun;
    refreshCostsTab();

    try {
      const costPayload = await loadCostComparison(
        loadedOptimizationRun,
        loadedPredictionRuns,
        options
      );
      if (currentSeq !== shiftRefreshSeq) return;
      costState.comparison = costPayload.comparison;
      costState.annualization = costPayload.annualization;
      costState.costInputs = costPayload.inputs;
      costState.status = "done";
    } catch (costErr) {
      if (currentSeq !== shiftRefreshSeq) return;
      costState.status = "error";
      costState.costInputs = null;
      costState.error =
        costErr?.message ??
        t("simulation.costs_error") ??
        "Unable to load cost comparison.";
    }

    refreshCostsTab();

    if (isElectrificationFeasible() && activeShiftId) {
      emissionsState.status = "loading";
      emissionsState.error = null;
      refreshEmissionsTab();

      try {
        const recurrence = "daily";
        const emData = await loadEmissionsData(activeShiftId, {
          recurrence,
          busLengthM: options?.busModelData?.bus_length_m,
          busModelName: options?.busModelName,
          yearlyDistanceKm: costState.costInputs?.yearlyDistanceKm,
        });
        if (currentSeq !== shiftRefreshSeq) return;
        emissionsState.yearlyImpact = emData.yearlyImpact;
        emissionsState.electricYearly = emData.electricYearly;
        emissionsState.dieselYearly = emData.dieselYearly;
        emissionsState.dieselVehicleName = emData.dieselVehicleName;
        emissionsState.status = "done";
      } catch (emErr) {
        if (currentSeq !== shiftRefreshSeq) return;
        emissionsState.status = "error";
        emissionsState.error =
          emErr?.message ??
          t("simulation.emissions_error") ??
          "Unable to load environmental impact data.";
      }

      refreshEmissionsTab();
      refreshOverviewTab();
    }
  };

  if (subtitleEl) {
    subtitleEl.textContent = "";
    subtitleEl.hidden = true;
  }
  renderGeneralInfo();
  renderBusInfo();
  renderChargingInfrastructure(section.querySelector('[data-role="charging-info"]'), null, {
    loading: true,
  });

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
      TAB_RENDERERS[tabName]?.(section);
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
    cleanupHandlers.push(() => tabList.removeEventListener("click", handleTabClick));
  }

  const handleBack = () => triggerPartialLoad("simulation-runs");
  section.querySelectorAll('[data-action="back"]').forEach((btn) => {
    btn.addEventListener("click", handleBack);
    cleanupHandlers.push(() => btn.removeEventListener("click", handleBack));
  });

  const toggleOverlay = () => { if (overlay) overlay.hidden = !overlay.hidden; };
  section.querySelectorAll('[data-action="toggle-sim-data"]').forEach((btn) => {
    btn.addEventListener("click", toggleOverlay);
    cleanupHandlers.push(() => btn.removeEventListener("click", toggleOverlay));
  });

  const closeOverlay = () => { if (overlay) overlay.hidden = true; };
  section.querySelectorAll('[data-action="close-sim-data"]').forEach((btn) => {
    btn.addEventListener("click", closeOverlay);
    cleanupHandlers.push(() => btn.removeEventListener("click", closeOverlay));
  });

  if (overlay) {
    const onBg = (e) => { if (e.target === overlay) closeOverlay(); };
    overlay.addEventListener("click", onBg);
    cleanupHandlers.push(() => overlay.removeEventListener("click", onBg));
  }

  const activateRawDataTab = (tabName) => {
    section.querySelectorAll(".sim-data-tab").forEach((btn) => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    section.querySelectorAll(".sim-data-tab-panel").forEach((panel) => {
      const active = panel.dataset.panel === tabName;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
  };
  const rawDataTabs = section.querySelector(".sim-data-tabs");
  if (rawDataTabs) {
    const handleRawDataTabClick = (event) => {
      const btn = event.target.closest(".sim-data-tab");
      if (btn) activateRawDataTab(btn.dataset.tab);
    };
    rawDataTabs.addEventListener("click", handleRawDataTabClick);
    cleanupHandlers.push(() =>
      rawDataTabs.removeEventListener("click", handleRawDataTabClick)
    );
  }

  if (shiftTabsEl) {
    const handleShiftTabClick = (event) => {
      const btn = event.target.closest('[data-action="select-shift"]');
      if (!btn) return;
      const nextShiftId = firstText(btn.dataset.shiftId);
      if (!nextShiftId || nextShiftId === activeShiftId) return;
      activeShiftId = nextShiftId;
      refreshShiftScopedData({ preserveExistingCostData: false }).catch((error) => {
        console.error("[elettra] Unable to refresh shift-specific results:", error);
      });
    };
    shiftTabsEl.addEventListener("click", handleShiftTabClick);
    cleanupHandlers.push(() =>
      shiftTabsEl.removeEventListener("click", handleShiftTabClick)
    );
  }

  const scheduleCostVariableRefresh = () => {
    if (!loadedOptimizationRun) return;
    if (costVariableRefreshTimer) {
      clearTimeout(costVariableRefreshTimer);
    }
    costVariableRefreshTimer = setTimeout(() => {
      costVariableRefreshTimer = null;
      refreshShiftScopedData({ preserveExistingCostData: true }).catch((error) => {
        console.error("[elettra] Unable to refresh cost comparison:", error);
      });
    }, COST_VARIABLE_REFRESH_DEBOUNCE_MS);
  };

  const handleFuelCostInput = () => {
    costOverrides.fuelCostPerL = normalizeFuelCostPerL(fuelCostInput?.value);
    setRangeProgress(fuelCostInput, resolveFuelCostPerL(options));
    refreshCostVariableControls();
    scheduleCostVariableRefresh();
  };

  const handleEnergyPriceInput = () => {
    costOverrides.energyPricePerKwh = normalizeEnergyPricePerKwh(
      energyPriceInput?.value
    );
    setRangeProgress(
      energyPriceInput,
      resolveEnergyPricePerKwh(options)
    );
    refreshCostVariableControls();
    scheduleCostVariableRefresh();
  };

  const handleInterestRateInput = () => {
    costOverrides.interestRate = normalizeInterestRate(interestRateInput?.value);
    setRangeProgress(interestRateInput, resolveInterestRate(options));
    refreshCostVariableControls();
    scheduleCostVariableRefresh();
  };

  const handleFuelCostReset = () => {
    costOverrides.fuelCostPerL = null;
    const nextFuelCostPerL = resolveFuelCostPerL(options);
    if (fuelCostInput) {
      fuelCostInput.value = String(nextFuelCostPerL);
      setRangeProgress(fuelCostInput, nextFuelCostPerL);
    }
    scheduleCostVariableRefresh();
    refreshCostVariableControls();
  };

  const handleEnergyPriceReset = () => {
    costOverrides.energyPricePerKwh = null;
    const nextEnergyPricePerKwh = resolveEnergyPricePerKwh(options);
    if (energyPriceInput) {
      energyPriceInput.value = String(nextEnergyPricePerKwh);
      setRangeProgress(energyPriceInput, nextEnergyPricePerKwh);
    }
    scheduleCostVariableRefresh();
    refreshCostVariableControls();
  };

  const handleInterestRateReset = () => {
    costOverrides.interestRate = null;
    const nextInterestRate = resolveInterestRate(options);
    if (interestRateInput) {
      interestRateInput.value = String(nextInterestRate);
      setRangeProgress(interestRateInput, nextInterestRate);
    }
    scheduleCostVariableRefresh();
    refreshCostVariableControls();
  };

  if (fuelCostInput) {
    fuelCostInput.addEventListener("input", handleFuelCostInput);
    fuelCostInput.addEventListener("change", handleFuelCostInput);
    cleanupHandlers.push(() => {
      fuelCostInput.removeEventListener("input", handleFuelCostInput);
      fuelCostInput.removeEventListener("change", handleFuelCostInput);
    });
  }

  if (energyPriceInput) {
    energyPriceInput.addEventListener("input", handleEnergyPriceInput);
    energyPriceInput.addEventListener("change", handleEnergyPriceInput);
    cleanupHandlers.push(() => {
      energyPriceInput.removeEventListener("input", handleEnergyPriceInput);
      energyPriceInput.removeEventListener("change", handleEnergyPriceInput);
    });
  }

  if (interestRateInput) {
    interestRateInput.addEventListener("input", handleInterestRateInput);
    interestRateInput.addEventListener("change", handleInterestRateInput);
    cleanupHandlers.push(() => {
      interestRateInput.removeEventListener("input", handleInterestRateInput);
      interestRateInput.removeEventListener("change", handleInterestRateInput);
    });
  }

  if (fuelCostResetBtn) {
    fuelCostResetBtn.addEventListener("click", handleFuelCostReset);
    cleanupHandlers.push(() =>
      fuelCostResetBtn.removeEventListener("click", handleFuelCostReset)
    );
  }

  if (energyPriceResetBtn) {
    energyPriceResetBtn.addEventListener("click", handleEnergyPriceReset);
    cleanupHandlers.push(() =>
      energyPriceResetBtn.removeEventListener("click", handleEnergyPriceReset)
    );
  }

  if (interestRateResetBtn) {
    interestRateResetBtn.addEventListener("click", handleInterestRateReset);
    cleanupHandlers.push(() =>
      interestRateResetBtn.removeEventListener("click", handleInterestRateReset)
    );
  }

  const handleDieselCapexInput = () => {
    costOverrides.dieselBusCapex = toFiniteNumber(dieselCapexInput?.value);
    setRangeProgress(dieselCapexInput, resolveEquivalentDieselBusCapex(options));
    refreshCostVariableControls();
    scheduleCostVariableRefresh();
  };

  const handleDieselEfficiencyInput = () => {
    costOverrides.dieselEfficiency = toFiniteNumber(dieselEfficiencyInput?.value);
    setRangeProgress(dieselEfficiencyInput, resolveDieselEfficiency(options));
    refreshCostVariableControls();
    scheduleCostVariableRefresh();
  };

  const handleDieselMaintenanceInput = () => {
    costOverrides.dieselMaintenanceCost = toFiniteNumber(dieselMaintenanceInput?.value);
    setRangeProgress(dieselMaintenanceInput, resolveDieselMaintenanceCost(options));
    refreshCostVariableControls();
    scheduleCostVariableRefresh();
  };

  const handleDieselCapexReset = () => {
    costOverrides.dieselBusCapex = null;
    const next = resolveEquivalentDieselBusCapex(options);
    if (dieselCapexInput) {
      dieselCapexInput.value = String(next ?? 350000);
      setRangeProgress(dieselCapexInput, next ?? 350000);
    }
    scheduleCostVariableRefresh();
    refreshCostVariableControls();
  };

  const handleDieselEfficiencyReset = () => {
    costOverrides.dieselEfficiency = null;
    const next = resolveDieselEfficiency(options);
    if (dieselEfficiencyInput) {
      dieselEfficiencyInput.value = String(next);
      setRangeProgress(dieselEfficiencyInput, next);
    }
    scheduleCostVariableRefresh();
    refreshCostVariableControls();
  };

  const handleDieselMaintenanceReset = () => {
    costOverrides.dieselMaintenanceCost = null;
    const next = resolveDieselMaintenanceCost(options);
    if (dieselMaintenanceInput) {
      dieselMaintenanceInput.value = String(next);
      setRangeProgress(dieselMaintenanceInput, next);
    }
    scheduleCostVariableRefresh();
    refreshCostVariableControls();
  };

  if (dieselCapexInput) {
    dieselCapexInput.addEventListener("input", handleDieselCapexInput);
    dieselCapexInput.addEventListener("change", handleDieselCapexInput);
    cleanupHandlers.push(() => {
      dieselCapexInput.removeEventListener("input", handleDieselCapexInput);
      dieselCapexInput.removeEventListener("change", handleDieselCapexInput);
    });
  }

  if (dieselEfficiencyInput) {
    dieselEfficiencyInput.addEventListener("input", handleDieselEfficiencyInput);
    dieselEfficiencyInput.addEventListener("change", handleDieselEfficiencyInput);
    cleanupHandlers.push(() => {
      dieselEfficiencyInput.removeEventListener("input", handleDieselEfficiencyInput);
      dieselEfficiencyInput.removeEventListener("change", handleDieselEfficiencyInput);
    });
  }

  if (dieselMaintenanceInput) {
    dieselMaintenanceInput.addEventListener("input", handleDieselMaintenanceInput);
    dieselMaintenanceInput.addEventListener("change", handleDieselMaintenanceInput);
    cleanupHandlers.push(() => {
      dieselMaintenanceInput.removeEventListener("input", handleDieselMaintenanceInput);
      dieselMaintenanceInput.removeEventListener("change", handleDieselMaintenanceInput);
    });
  }

  if (dieselCapexResetBtn) {
    dieselCapexResetBtn.addEventListener("click", handleDieselCapexReset);
    cleanupHandlers.push(() =>
      dieselCapexResetBtn.removeEventListener("click", handleDieselCapexReset)
    );
  }

  if (dieselEfficiencyResetBtn) {
    dieselEfficiencyResetBtn.addEventListener("click", handleDieselEfficiencyReset);
    cleanupHandlers.push(() =>
      dieselEfficiencyResetBtn.removeEventListener("click", handleDieselEfficiencyReset)
    );
  }

  if (dieselMaintenanceResetBtn) {
    dieselMaintenanceResetBtn.addEventListener("click", handleDieselMaintenanceReset);
    cleanupHandlers.push(() =>
      dieselMaintenanceResetBtn.removeEventListener("click", handleDieselMaintenanceReset)
    );
  }

  const handleElectricMaintenanceInput = () => {
    costOverrides.electricMaintenanceCost = toFiniteNumber(electricMaintenanceInput?.value);
    setRangeProgress(electricMaintenanceInput, resolveElectricMaintenanceCost(options));
    refreshCostVariableControls();
    scheduleCostVariableRefresh();
  };

  const handleElectricMaintenanceReset = () => {
    costOverrides.electricMaintenanceCost = null;
    const next = resolveElectricMaintenanceCost(options);
    if (electricMaintenanceInput) {
      electricMaintenanceInput.value = String(next);
      setRangeProgress(electricMaintenanceInput, next);
    }
    scheduleCostVariableRefresh();
    refreshCostVariableControls();
  };

  if (electricMaintenanceInput) {
    electricMaintenanceInput.addEventListener("input", handleElectricMaintenanceInput);
    electricMaintenanceInput.addEventListener("change", handleElectricMaintenanceInput);
    cleanupHandlers.push(() => {
      electricMaintenanceInput.removeEventListener("input", handleElectricMaintenanceInput);
      electricMaintenanceInput.removeEventListener("change", handleElectricMaintenanceInput);
    });
  }

  if (electricMaintenanceResetBtn) {
    electricMaintenanceResetBtn.addEventListener("click", handleElectricMaintenanceReset);
    cleanupHandlers.push(() =>
      electricMaintenanceResetBtn.removeEventListener("click", handleElectricMaintenanceReset)
    );
  }

  /* Async: fetch optimization run + prediction runs, then derive costs */
  const loadResultData = async () => {
    if (!options.runId) return;

    costState.status = "loading";
    costState.comparison = null;
    costState.annualization = null;
    costState.costInputs = null;
    costState.error = null;
    efficiencyState.status = "loading";
    efficiencyState.error = null;
    refreshEfficiencyTab();
    refreshPredictionsTab();
    refreshCostsTab();

    try {
      const [optimizationRun, economicDefaultsPayload] = await Promise.all([
        fetchOptimizationRun(options.runId),
        fetchEconomicDefaults().catch((error) => {
          console.warn("[elettra] Unable to load economic defaults:", error);
          return null;
        }),
      ]);
      economicDefaults.fuelCostPerL = normalizeFuelCostPerL(
        economicDefaultsPayload?.fuel_cost_per_l
      );
      economicDefaults.energyPricePerKwh = normalizeEnergyPricePerKwh(
        economicDefaultsPayload?.energy_price_per_kwh
      );
      economicDefaults.interestRate = normalizeInterestRate(
        economicDefaultsPayload?.interest_rate
      );
      economicDefaults.dieselBusCapex = toFiniteNumber(
        economicDefaultsPayload?.equivalent_diesel_bus_capex
      );
      economicDefaults.dieselConsumptionConst = toFiniteNumber(
        economicDefaultsPayload?.diesel_consumption_const
      );
      economicDefaults.dieselConsumptionPerM = toFiniteNumber(
        economicDefaultsPayload?.diesel_consumption_per_m
      );
      economicDefaults.dieselMaintCostConst = toFiniteNumber(
        economicDefaultsPayload?.diesel_maint_cost_const
      );
      economicDefaults.dieselMaintCostPerM = toFiniteNumber(
        economicDefaultsPayload?.diesel_maint_cost_per_m
      );
      economicDefaults.electricMaintCostConst = toFiniteNumber(
        economicDefaultsPayload?.electric_maint_cost_const
      );
      economicDefaults.electricMaintCostPerM = toFiniteNumber(
        economicDefaultsPayload?.electric_maint_cost_per_m
      );
      refreshCostsTab();
      try {
        await hydrateBusModelDataFromOptimization(optimizationRun, options);
        renderBusInfo();
      } catch (busModelErr) {
        console.warn(
          "[elettra] Unable to hydrate bus model data from optimization run:",
          busModelErr
        );
      }
      renderChargingInfrastructure(
        section.querySelector('[data-role="charging-info"]'),
        optimizationRun
      );
      loadedOptimizationRun = optimizationRun;
      options.simulationName = resolveSimulationName(optimizationRun, options);
      renderPageTitle();
      renderEvaluationName();
      const predRunIds = Array.isArray(optimizationRun?.prediction_run_ids)
        ? optimizationRun.prediction_run_ids
        : [];
      const { runs: predictionRuns, missing, errors } = predRunIds.length
        ? await resolvePredictionRuns(predRunIds)
        : { runs: [], missing: [], errors: [] };
      // Prediction runs an optimization references can be gone — the panels
      // already have an empty state for that, so one line here beats failing
      // the whole page and logging once per id.
      if (errors.length) {
        console.warn(
          `[elettra] Unable to load ${errors.length} of ${predRunIds.length} prediction runs:`,
          errors[0].error
        );
      } else if (missing.length) {
        console.warn(
          `[elettra] ${missing.length} of ${predRunIds.length} prediction runs no longer exist.`
        );
      }
      loadedPredictionRuns = predictionRuns;

      const inputShiftIds = Array.isArray(optimizationRun?.input_params?.shift_ids)
        ? optimizationRun.input_params.shift_ids
        : [];
      availableShiftTabs = await resolveShiftTabs(inputShiftIds, {
        fallbackShiftId: options.shiftId,
        fallbackShiftName: options.shiftName,
      });
      activeShiftId =
        availableShiftTabs.find((shift) => shift.id === activeShiftId)?.id ??
        availableShiftTabs[0]?.id ??
        activeShiftId;
      activeShiftName =
        availableShiftTabs.find((shift) => shift.id === activeShiftId)?.shiftName ??
        activeShiftName;
      renderShiftTabs();

      efficiencyState.status = "done";
      efficiencyState.optimizationRun = optimizationRun;
      efficiencyState.predictionRuns = predictionRuns;

      costState.optimizationRun = optimizationRun;
      await refreshShiftScopedData();
    } catch (err) {
      renderChargingInfrastructure(section.querySelector('[data-role="charging-info"]'));
      costState.status = "error";
      costState.annualization = null;
      costState.costInputs = null;
      costState.error =
        err?.message ??
        t("simulation.costs_error") ??
        "Unable to load cost comparison.";
      efficiencyState.status = "error";
      efficiencyState.error =
        err?.message ??
        t("simulation.efficiency_error") ??
        "Failed to load efficiency data.";
    }

    refreshCostsTab();
    refreshEfficiencyTab();
    refreshPredictionsTab();
    refreshEmissionsTab();
  };

  loadResultData();

  return () => {
    if (costVariableRefreshTimer) {
      clearTimeout(costVariableRefreshTimer);
    }
    cleanupHandlers.forEach((h) => h());
  };
};
