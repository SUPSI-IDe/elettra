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
import {
  fetchShiftById,
  fetchShiftInfo,
  fetchShiftYearlyDistance,
} from "../../../api/shifts";
import {
  DEFAULT_OPEX_ANNUALIZATION_RATE,
  DEFAULT_BUS_LIFETIME_YEARS,
  DEFAULT_DIESEL_BUS_LIFETIME_YEARS,
  DEFAULT_BATTERY_LIFETIME_YEARS,
  getEquivalentDieselBusCapexForLength,
} from "../../../config/economic-defaults";
import "./simulation-results.css";

/* ── Fake simulation-data fields ──────────────────────────────── */

const FAKE_GENERAL_INFO = {
  creation_date: "—",
  simulation_type: "—",
  day: "—",
  lines: "—",
  shift_name: "—",
};

const FAKE_BUS_INFO = {
  bus_name: "—",
  manufacturer: "—",
  cost_chf: "—",
  bus_length_m: "—",
  max_passengers: "—",
  bus_lifetime_years: "—",
  single_pack_battery_cost_chf: "—",
  battery_pack_lifetime_years: "—",
};

const generalLabels = () => ({
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
  manufacturer: t("simulation.bus_manufacturer") || "Manufacturer",
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
  diesel: "#c0392b",
  electric: "#2e7d32",
};
const COST_COLORS = { vehicle: "#4f86c6", energy: "#d4881f", maintenance: "#5f8f2f" };
const COST_ANNUALIZATION_FACTOR = 52;


const CO2_ANNUAL = [
  { category: "equivalent_diesel_bus", value: 85, color: "#6fbeec" },
  { category: "electric_bus", value: 12, color: "#abe828" },
];

const CO2_CUM = Array.from({ length: 15 }, (_, i) => ({
  year: i + 1,
  saved: (i + 1) * 73,
}));

const DEFAULT_INFRASTRUCTURE_SLOT_COST_CHF = 150000;
const DEFAULT_FUEL_COST_PER_L = 1.85;
const DEFAULT_ENERGY_PRICE_SLIDER_VALUE = 0.2;
const DEFAULT_INTEREST_RATE_SLIDER_VALUE = 0.03;
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

const resolveShiftPresentation = async (shiftId, fallbackName = "") => {
  if (!shiftId) {
    return { shiftName: fallbackName || "—", lineLabel: "—", weekdayLabel: "—" };
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

  return {
    shiftName: resolveShiftDisplayName(shift, fallbackName),
    lineLabel: resolveShiftLineLabel(shift),
    weekdayLabel: resolveShiftWeekday(shift),
  };
};

const resolveShiftSummary = async (shiftIds = []) => {
  const ids = [...new Set((Array.isArray(shiftIds) ? shiftIds : []).map((id) => firstText(id)).filter(Boolean))];
  if (!ids.length) {
    return { lines: "—", days: "—" };
  }

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
      },
    ];
  }

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
  Number(value) >= 0 &&
  Number(value) <= 1
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
  if (toFiniteNumber(current?.bus_length_m) != null) return current;

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
        status: installedStation ? "Installed" : "Configured",
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
    .attr("stroke", "#e5e5e5")
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

const resolveEquivalentDieselBusCapex = (options = {}) =>
  getEquivalentDieselBusCapexForLength(options?.busModelData?.bus_length_m);

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

  const years = [];
  for (let year = lifetime; year <= horizon; year += lifetime) {
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

const computeEquivalentAnnualCost = (principal, rate, lifetimeYears) => {
  const capex = toFiniteNumber(principal);
  const lifetime = toFiniteNumber(lifetimeYears);
  const annualRate = toFiniteNumber(rate);

  if (capex == null || capex <= 0 || lifetime == null || lifetime <= 0) return 0;
  if (annualRate == null || annualRate <= 0) return capex / lifetime;

  const growth = Math.pow(1 + annualRate, lifetime);
  return capex * ((annualRate * growth) / (growth - 1));
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
  const horizonYears = PROJECTED_COST_TREND_HORIZON_YEARS;
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
  const yearly = Array.from({ length: horizonYears }, (_, index) => ({
    year: index + 1,
    diesel:
      dieselBusCapexChf +
      dieselAnnualOpex * (index + 1) +
      d3.sum(
        Array.from({ length: index + 1 }, (_, yearIndex) => {
          const year = yearIndex + 1;
          return dieselBusReplacementCostByYear[year] ?? 0;
        })
      ),
    electric:
      electricBusCapexChf +
      electricAnnualOpex * (index + 1) +
      d3.sum(
        Array.from({ length: index + 1 }, (_, yearIndex) => {
          const year = yearIndex + 1;
          return (
            (electricBusReplacementCostByYear[year] ?? 0) +
            (batteryReplacementCostByYear[year] ?? 0)
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

  return {
    tco: eacData.tco,
    annualTotals: eacData.annualTotals,
    replacementYears: {
      electricBus: electricBusReplacementYears,
      dieselBus: dieselBusReplacementYears,
      battery: batteryReplacementYears,
    },
    yearly,
  };
};

const renderCostsKpis = (el, comparison, annualTotals = null) => {
  if (!el) return;
  if (!comparison) {
    el.innerHTML = "";
    return;
  }

  const electricOpex = sumOpexItems(comparison?.electric?.opex_items);
  const dieselOpex = sumOpexItems(comparison?.diesel?.opex_items);
  const kpis = [
    {
      label: costKpiLabel("electric_total"),
      value: `CHF ${formatCHF(toFiniteNumber(annualTotals?.electric) ?? 0)}`,
      tone: "",
    },
    {
      label: costKpiLabel("diesel_total"),
      value: `CHF ${formatCHF(toFiniteNumber(annualTotals?.diesel) ?? 0)}`,
      tone: "",
    },
    {
      label: t("simulation.costs_kpi_electric_opex") || "Electric yearly OPEX",
      value: `CHF ${formatCHF(electricOpex)}`,
      tone: "",
    },
    {
      label: t("simulation.costs_kpi_diesel_opex") || "Diesel yearly OPEX",
      value: `CHF ${formatCHF(dieselOpex)}`,
      tone: "",
    },
  ];

  el.innerHTML = kpis
    .map(
      ({ label, value, tone }) => `
        <div class="costs-kpi-card">
          <span class="costs-kpi-label">${textContent(label)}</span>
          <span class="costs-kpi-value${tone ? ` costs-kpi-value--${tone}` : ""}">${textContent(value)}</span>
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
  return `CHF ${formatFixed(cost / distance, 3)}/km`;
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

const buildOpexBreakdownTable = (items = [], yearlyDistanceKm = null) => {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => {
    const annualCost = toFiniteNumber(item?.cost_chf_per_year);
    const type = classifyOpexCost(item);
    return {
      name: firstText(item?.name, item?.label, item?.type) || "—",
      type,
      annualCost,
      costPerKm: formatChfPerKmValue(annualCost, yearlyDistanceKm),
    };
  });

  const usageTotal = sumOpexItemsByType(items, "energy");
  const maintenanceTotal = sumOpexItemsByType(items, "maintenance");
  const totalOpex = sumOpexItems(items);

  const typeLabel = (type) =>
    type === "energy"
      ? translateOr("simulation.costs_input_usage", "Usage")
      : translateOr("simulation.costs_input_maintenance", "Maintenance");

  const bodyRows = normalizedItems.length
    ? normalizedItems
        .map(
          (row) => `
            <tr>
              <td>${textContent(row.name)}</td>
              <td>${textContent(typeLabel(row.type))}</td>
              <td>${textContent(formatChfValue(row.annualCost, 0))}</td>
              <td>${textContent(row.costPerKm)}</td>
            </tr>`
        )
        .join("")
    : `<tr><td colspan="4">${textContent(
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
              <td>${textContent(translateOr("simulation.costs_input_summary", "Summary"))}</td>
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
          <th>${textContent(translateOr("simulation.costs_input_item_type", "Type"))}</th>
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

const renderOpexInputsTable = (el, state) => {
  if (!el) return;
  if (state.status !== "done" || !state.costInputs) {
    el.innerHTML = "";
    return;
  }

  const opexAnnualizationRateValue =
    state.costInputs.opexAnnualizationRate == null
      ? "—"
      : `${formatFixed(state.costInputs.opexAnnualizationRate * 100, 1)}%`;
  const predictedShiftConsumptionPerKm =
    state.costInputs.predictedShiftDistanceKm != null &&
    state.costInputs.predictedShiftDistanceKm > 0 &&
    state.costInputs.predictedShiftConsumptionKwh != null
      ? state.costInputs.predictedShiftConsumptionKwh /
        state.costInputs.predictedShiftDistanceKm
      : null;

  const scenarioRows = [
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
      t("simulation.costs_input_prediction_consumption") ||
        "Prediction consumption per shift (kWh)",
      state.costInputs.predictedShiftConsumptionKwh == null
        ? "—"
        : formatFixed(state.costInputs.predictedShiftConsumptionKwh, 3),
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
    [
      t("simulation.costs_input_capex_annualization_rate") ||
        "CAPEX annualization rate",
      opexAnnualizationRateValue,
    ],
  ];

  el.innerHTML = `
    <div class="costs-inputs-layout">
      <section class="costs-inputs-section">
        <h3 class="costs-inputs-section-title">${textContent(
          translateOr("simulation.costs_input_section_scaling", "Scenario and scaling")
        )}</h3>
        ${buildSimpleRowsTable(scenarioRows)}
      </section>
    </div>`;
};

const renderCostApiParamsSection = (el, state) => {
  if (!el) return;
  if (state.status !== "done" || !state.costInputs) {
    el.innerHTML = "";
    return;
  }

  const apiRows = [
    [
      translateOr("simulation.costs_input_shift_id", "Shift ID"),
      state.costInputs.economicComparisonParams?.shift_id ?? "—",
    ],
    [
      translateOr("simulation.costs_input_recurrence_api", "Recurrence"),
      state.costInputs.economicComparisonParams?.recurrence ?? "—",
    ],
    [
      t("simulation.costs_input_annual_consumption") ||
        "Annual consumption (kWh)",
      state.costInputs.economicComparisonParams?.annual_consumption_kwh == null
        ? "—"
        : formatFixed(
            state.costInputs.economicComparisonParams.annual_consumption_kwh,
            3
          ),
    ],
    [
      t("simulation.costs_input_bus_length") || "Bus length (m)",
      state.costInputs.economicComparisonParams?.bus_length_m == null
        ? "—"
        : formatFixed(state.costInputs.economicComparisonParams.bus_length_m, 0),
    ],
    [
      t("simulation.costs_input_battery_capacity") ||
        "Battery capacity (kWh)",
      state.costInputs.economicComparisonParams?.battery_capacity_kwh == null
        ? "—"
        : formatFixed(
            state.costInputs.economicComparisonParams.battery_capacity_kwh,
            0
          ),
    ],
    [
      t("simulation.costs_input_charger_power") || "Charger power (kW)",
      state.costInputs.economicComparisonParams?.charger_power_kw == null
        ? "—"
        : formatFixed(state.costInputs.economicComparisonParams.charger_power_kw, 0),
    ],
    [
      t("simulation.costs_input_battery_cost_per_kwh") ||
        "Battery cost per kWh (CHF)",
      state.costInputs.economicComparisonParams?.battery_cost_per_kwh == null
        ? "—"
        : formatFixed(
            state.costInputs.economicComparisonParams.battery_cost_per_kwh,
            2
          ),
    ],
    [
      translateOr("simulation.costs_input_interest_rate", "Interest rate"),
      state.costInputs.economicComparisonParams?.interest_rate == null
        ? "—"
        : `${formatFixed(
            state.costInputs.economicComparisonParams.interest_rate * 100,
            1
          )}%`,
    ],
    [
      translateOr(
        "simulation.costs_input_energy_price_per_kwh",
        "Electricity price (CHF/kWh)"
      ),
      state.costInputs.economicComparisonParams?.energy_price_per_kwh == null
        ? translateOr(
            "simulation.costs_input_backend_default",
            "Backend default (not overridden)"
          )
        : formatFixed(
            state.costInputs.economicComparisonParams.energy_price_per_kwh,
            2
          ),
    ],
    [
      t("simulation.costs_input_bus_lifetime") || "Bus lifetime (years)",
      state.costInputs.economicComparisonParams?.lifetime_bus == null
        ? "—"
        : formatFixed(state.costInputs.economicComparisonParams.lifetime_bus, 0),
    ],
    [
      translateOr("simulation.costs_input_diesel_bus_lifetime", "Diesel bus lifetime (years)"),
      state.costInputs.dieselBusLifetime == null
        ? "—"
        : formatFixed(state.costInputs.dieselBusLifetime, 0),
    ],
    [
      t("simulation.costs_input_battery_lifetime") ||
        "Battery lifetime (years)",
      state.costInputs.economicComparisonParams?.lifetime_battery == null
        ? "—"
        : formatFixed(
            state.costInputs.economicComparisonParams.lifetime_battery,
            0
          ),
    ],
    [
      translateOr("simulation.costs_input_fuel_cost_per_l", "Fuel cost per liter (CHF/l)"),
      state.costInputs.economicComparisonParams?.fuel_cost_per_l == null
        ? "—"
        : formatFixed(state.costInputs.economicComparisonParams.fuel_cost_per_l, 2),
    ],
  ];

  el.innerHTML = `
    <p class="costs-inputs-note">${textContent(
      translateOr(
        "simulation.costs_input_api_note",
        "These are the exact parameters sent by the frontend to the economic comparison endpoint. Default cost values are loaded from the backend and can then be adjusted here."
      )
    )}</p>
    ${buildSimpleRowsTable(apiRows)}`;
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

const formatChfLabel = (value) => {
  if (Math.abs(value) >= 1e6) return `CHF ${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `CHF ${formatCHF(value)}`;
  return `CHF ${Math.round(value)}`;
};

const renderInvestmentTable = (el, state, options = {}) => {
  if (!el) return;
  if (state.status !== "done" || !state.optimizationRun) {
    el.innerHTML = "";
    return;
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
  const dieselBusCapexChf = resolveEquivalentDieselBusCapex(options);

  if (
    !entries.length &&
    busCostChf == null &&
    packCostChf == null &&
    dieselBusCapexChf == null
  ) {
    el.innerHTML = "";
    return;
  }

  const dash = "—";
  const fmtChf = (v) => v != null ? `CHF ${formatCHF(v)}` : dash;

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
    [
      t("simulation.inv_diesel_default") || "Equivalent diesel bus (default)",
      fmtChf(dieselBusCapexChf),
    ],
  ];

  const totalRow = totalCapexChf != null
    ? `<tr class="investment-table__total">
         <td>${textContent(t("simulation.inv_grand_total") || "Total investment")}</td>
         <td>${textContent(fmtChf(totalCapexChf))}</td>
       </tr>`
    : "";

  const investmentNote = infrastructure?.usedBatteryOnlyDefaults
    ? `<p class="investment-table__note">${textContent(
        translateOr(
          "simulation.inv_battery_only_note",
          `Battery-only optimization does not optimize charging infrastructure cost. A default assumption of CHF ${formatCHF(infrastructure.defaultSlotCostChf)} per plug is shown for reference and is not included in the total investment.`
        )
      )}</p>`
    : "";

  el.innerHTML = `
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
    </table>
    ${investmentNote}`;
};

const renderCostsBar = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  if (!Array.isArray(data) || data.length === 0) {
    el.innerHTML = costsStateHtml(
      t("simulation.costs_empty") || "No economic comparison data available."
    );
    return;
  }
  const margin = { top: 16, right: 24, bottom: 32, left: 72 };
  const W = 620, H = 168;
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
      .attr("fill", COST_COLORS[layer.key])
      .each(function addTooltip(d) {
        const segmentValue = Math.max(0, (d[1] ?? 0) - (d[0] ?? 0));
        const totalValue = COST_STACK_KEYS.reduce(
          (sum, key) => sum + (d.data[key] ?? 0),
          0
        );
        d3.select(this)
          .append("title")
          .text(
            [
              busCategoryLabel(d.data.category),
              `${costStackLabel(layer.key)}: ${formatChfValue(segmentValue)}`,
              `${t("simulation.label_total") || "Total"}: ${formatChfValue(totalValue)}`,
            ].join("\n")
          );
      });
  });

  data.forEach((d) => {
    const total = COST_STACK_KEYS.reduce((s, k) => s + d[k], 0);
    g.append("text")
      .attr("x", x(d.category) + x.bandwidth() / 2)
      .attr("y", y(total) - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#1c1c1c")
      .text(formatChfLabel(total));
  });

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

const renderCostsLine = (el, data) => {
  if (!el) return;
  el.innerHTML = "";
  if (!Array.isArray(data) || data.length === 0) {
    el.innerHTML = costsStateHtml(
      t("simulation.costs_empty") || "No economic comparison data available."
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
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain(d3.extent(data, (d) => d.year))
    .range([0, iW]);
  const y = d3.scaleLinear()
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

const toFiniteNumber = (value) => {
  if (value === "" || (typeof value === "string" && value.trim() === "")) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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
  optimal: "efficiency-badge--ok",
  feasible: "efficiency-badge--ok",
  infeasible: "efficiency-badge--err",
  error: "efficiency-badge--err",
};

const OPTIMIZATION_BATTERY_COLORS = {
  base: "#cfd8e3",
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

  const solverStatus = results.solver_status ?? "—";
  const badgeCls = SOLVER_STATUS_CLASS[solverStatus] ?? "efficiency-badge--neutral";

  const kpis = [
    { label: t("simulation.opt_solver_status") || "Solver Status", value: `<span class="efficiency-badge ${badgeCls}">${textContent(solverStatus)}</span>`, raw: true },
    { label: t("simulation.opt_objective_value") || "Objective Value", value: formatFixed(results.objective_value, 0) },
    { label: t("simulation.opt_solve_time") || "Solve Time (s)", value: formatFixed(results.solve_time_seconds, 2) },
  ];

  const kpisHtml = kpis.map(({ label, value, raw }) => `
    <div class="efficiency-param">
      <span class="efficiency-param-label">${textContent(label)}</span>
      <span class="efficiency-param-value">${raw ? value : textContent(value)}</span>
    </div>`).join("");

  const batteryResults = results.battery_results ?? {};
  const batteryEntries = Object.entries(batteryResults).filter(([shiftKey, result]) =>
    matchesSelectedShift(result, shiftKey, viewOptions)
  );

  let batteryTableHtml = "";
  if (batteryEntries.length) {
    const rows = batteryEntries.map(([, b]) => `
      <tr>
        <td>${textContent(b.shift_name ?? "—")}</td>
        <td class="efficiency-td-num">${textContent(String(b.base_packs ?? "—"))}</td>
        <td class="efficiency-td-num">${formatFixed(b.base_kwh, 0)}</td>
        <td class="efficiency-td-num efficiency-td-highlight">${textContent(String(b.optimized_packs ?? "—"))}</td>
        <td class="efficiency-td-num efficiency-td-highlight">${formatFixed(b.optimized_kwh, 0)}</td>
        <td class="efficiency-td-num">${textContent(String(b.excess_packs ?? 0))}</td>
      </tr>`).join("");

    batteryTableHtml = `
      <h4 class="efficiency-subsection-title">${textContent(t("simulation.opt_battery_results") || "Battery Sizing")}</h4>
      <div class="efficiency-table-wrap">
        <table class="efficiency-table">
          <thead>
            <tr>
              <th class="efficiency-th-text">${textContent(t("simulation.opt_col_shift") || "Shift")}</th>
              <th>${textContent(t("simulation.opt_col_base_packs") || "Base Packs")}</th>
              <th>${textContent(t("simulation.opt_col_base_kwh") || "Base (kWh)")}</th>
              <th>${textContent(t("simulation.opt_col_opt_packs") || "Opt. Packs")}</th>
              <th>${textContent(t("simulation.opt_col_opt_kwh") || "Opt. (kWh)")}</th>
              <th>${textContent(t("simulation.opt_col_excess") || "Excess Packs")}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  const installedChargers = results.installed_chargers ?? {};
  const inputChargingStations = Array.isArray(inputParams?.charging_stations)
    ? inputParams.charging_stations
    : [];
  const inputStationsByStopId = new Map(
    inputChargingStations
      .filter((station) => station?.stop_id)
      .map((station) => [String(station.stop_id), station])
  );
  const chargerEntries = Object.entries(installedChargers);
  let chargersHtml = "";
  if (chargerEntries.length) {
    const rows = chargerEntries.map(([stopId, info]) => {
      const slots = info?.num_slots ?? info?.slots ?? "—";
      const matchingInputStation = inputStationsByStopId.get(String(stopId));
      const directPowerPerPlug = [
        info?.max_power_per_slot_kw,
        info?.power_per_slot_kw,
        matchingInputStation?.max_power_per_slot_kw,
        matchingInputStation?.power_per_slot_kw,
      ].find((value) => Number.isFinite(Number(value)));
      const resolvedPower =
        directPowerPerPlug ??
        (() => {
          const totalPower = [
            info?.max_total_power_kw,
            info?.total_power_kw,
            info?.max_power_kw,
            matchingInputStation?.max_total_power_kw,
          ].find((value) => Number.isFinite(Number(value)));
          const numericSlots = Number(slots);
          if (Number.isFinite(Number(totalPower)) && Number.isFinite(numericSlots) && numericSlots > 0) {
            return Number(totalPower) / numericSlots;
          }
          return "—";
        })();
      return `
        <tr>
          <td>${textContent(info?.stop_name ?? stopId.slice(0, 8) + "…")}</td>
          <td class="efficiency-td-num">${textContent(String(slots))}</td>
          <td class="efficiency-td-num">${formatFixed(resolvedPower, 0)}</td>
        </tr>`;
    }).join("");

    chargersHtml = `
      <h4 class="efficiency-subsection-title">${textContent(t("simulation.opt_installed_chargers") || "Installed Chargers")}</h4>
      <div class="efficiency-table-wrap">
        <table class="efficiency-table">
          <thead>
            <tr>
              <th class="efficiency-th-text">${textContent(t("simulation.opt_col_stop") || "Stop")}</th>
              <th>${textContent(t("simulation.opt_col_slots") || "Slots")}</th>
              <th>${textContent(t("simulation.cs_power_per_plug") || "kW / plug")}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  return `
    <div class="efficiency-section">
      <h3 class="efficiency-section-title">${textContent(t("simulation.opt_section_title") || "Optimization Results")}</h3>
      <div class="efficiency-params-grid">${kpisHtml}</div>
      ${batteryTableHtml}
      ${chargersHtml}
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

const buildUnifiedPredictionData = (predictionRuns, perBusSummary, batteryResults = {}) => {
  const sorted = [...(predictionRuns ?? [])].sort((a, b) =>
    Number(a?.contextual_parameters?.num_battery_packs ?? 0) - Number(b?.contextual_parameters?.num_battery_packs ?? 0)
  );

  const perBusArr = Array.isArray(perBusSummary) ? perBusSummary : [];
  const optimizedPackSet = new Set(
    Object.values(batteryResults ?? {})
      .map((result) => toFiniteNumber(result?.optimized_packs))
      .filter((value) => value != null)
  );

  const rows = sorted.map((run, idx) => {
    const cp = run?.contextual_parameters ?? {};
    const s = run?.summary ?? {};
    const bus = perBusArr[idx] ?? {};

    return {
      numBatteryPacks: toFiniteNumber(cp.num_battery_packs),
      batteryCapacityKwh: toFiniteNumber(cp.battery_capacity_kwh),
      totalWeightKg: toFiniteNumber(cp.total_weight_kg),
      totalDistanceKm: toFiniteNumber(s.total_distance_km),
      totalConsumptionKwh: toFiniteNumber(s.total_consumption_kwh),
      consumptionPerKmKwh: toFiniteNumber(s.consumption_per_km_kwh),
      totalDrivetrainKwh: toFiniteNumber(s.total_drivetrain_kwh),
      totalAuxiliaryKwh: toFiniteNumber(s.total_auxiliary_kwh),
      minSocKwh: toFiniteNumber(bus.min_soc_kwh),
      maxSocKwh: toFiniteNumber(bus.max_soc_kwh),
      numChargingSessions: toFiniteNumber(bus.num_charging_sessions),
      totalChargedKwh: toFiniteNumber(bus.total_charged_kwh),
    };
  });

  if (!optimizedPackSet.size) {
    const bestRow = rows.reduce((best, row) => {
      if (row.consumptionPerKmKwh == null) return best;
      if (!best || row.consumptionPerKmKwh < best.consumptionPerKmKwh) return row;
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

const buildUnifiedPredictionRows = (rows) =>
  rows.map((row) => `
      <tr>
        <td class="efficiency-td-num">${textContent(String(row.numBatteryPacks ?? "—"))}</td>
        <td class="efficiency-td-num">${formatFixed(row.batteryCapacityKwh, 0)}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalWeightKg, 0)}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalDistanceKm, 1)}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalConsumptionKwh, 1)}</td>
        <td class="efficiency-td-num efficiency-td-highlight">${formatFixed(row.consumptionPerKmKwh, 3)}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalDrivetrainKwh, 1)}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalAuxiliaryKwh, 1)}</td>
        <td class="efficiency-td-num">${formatFixed(row.minSocKwh, 1)}</td>
        <td class="efficiency-td-num">${formatFixed(row.maxSocKwh, 1)}</td>
        <td class="efficiency-td-num">${textContent(String(row.numChargingSessions ?? "—"))}</td>
        <td class="efficiency-td-num">${formatFixed(row.totalChargedKwh, 1)}</td>
      </tr>`)
    .join("");

const renderEfficiencyCurveChart = (el, rows) => {
  if (!el) return;
  el.innerHTML = "";

  const data = rows.filter(
    (row) => row.numBatteryPacks != null && row.consumptionPerKmKwh != null
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
  const minY = d3.min(data, (d) => d.consumptionPerKmKwh);
  const maxY = d3.max(data, (d) => d.consumptionPerKmKwh);
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
    .attr("font-size", "10px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => d3.format(".3~f")(d)))
    .selectAll("text")
    .attr("font-size", "10px");

  g.append("text")
    .attr("x", iW / 2)
    .attr("y", iH + 38)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(t("simulation.axis_packs") || "# Packs");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -iH / 2)
    .attr("y", -46)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(t("simulation.efficiency_col_per_km") || "kWh / km");

  const line = d3
    .line()
    .x((d) => x(d.numBatteryPacks))
    .y((d) => y(d.consumptionPerKmKwh))
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
    .attr("cy", (d) => y(d.consumptionPerKmKwh))
    .attr("r", (d) => (d.isOptimized ? 5.5 : 4))
    .attr("fill", (d) => (d.isOptimized ? "#abe828" : "#00639a"))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .each(function addTooltip(d) {
      d3.select(this)
        .append("title")
        .text(
          [
            `${d.numBatteryPacks} ${t("simulation.unit_packs") || "packs"}`,
            `${formatFixed(d.consumptionPerKmKwh, 3)} ${t("simulation.efficiency_col_per_km") || "kWh / km"}`,
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
    .attr("y", (d) => y(d.consumptionPerKmKwh) - 12)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
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
  const W = 620;
  const H = 280;
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
    .attr("font-size", "10px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => d3.format(".3~s")(d)))
    .selectAll("text")
    .attr("font-size", "10px");

  g.append("text")
    .attr("x", iW / 2)
    .attr("y", iH + 38)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(t("simulation.axis_packs") || "# Packs");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -iH / 2)
    .attr("y", -46)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
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
    .attr("font-size", "10px")
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
    .attr("font-size", "10px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => d3.format(".3~s")(d)))
    .selectAll("text")
    .attr("font-size", "10px");

  g.append("text")
    .attr("x", iW / 2)
    .attr("y", iH + 38)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(t("simulation.axis_packs") || "# Packs");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -iH / 2)
    .attr("y", -46)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
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
    .attr("font-size", "9px")
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
      ${textContent(t("simulation.opt_col_opt_packs") || "Opt. Packs")}
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
    .attr("font-size", "10px")
    .attr("transform", "rotate(-18)")
    .style("text-anchor", "end");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`))
    .selectAll("text")
    .attr("font-size", "10px");

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
                : (t("simulation.opt_col_opt_packs") || "Opt. Packs")
            }: ${formatFixed(d[key], 0)}`
          );
      });
  });

  el.appendChild(svg.node());
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
  const ip = optimizationRun?.input_params ?? {};
  const results = optimizationRun?.results ?? {};
  const firstRun = predictionRuns?.[0] ?? {};
  const perBusSummary = results.per_bus_summary ?? [];
  const batteryResults = results.battery_results ?? {};

  const conditions = [
    ...(viewOptions?.selectedShiftName
      ? [
          {
            label: t("simulation.general_shift_name") || "Shift name",
            value: textContent(viewOptions.selectedShiftName),
          },
        ]
      : []),
    { label: t("simulation.var_optimization_mode") || "Mode", value: modeLabel(ip.mode ?? "") },
    { label: t("simulation.efficiency_min_soc") || "Min SoC", value: formatPct(ip.min_soc ?? 0.4) },
    { label: t("simulation.efficiency_max_soc") || "Max SoC", value: formatPct(ip.max_soc ?? 0.9) },
    { label: t("simulation.efficiency_soh") || "State of Health", value: formatPct(ip.state_of_health ?? 1.0) },
    { label: t("simulation.var_external_temp") || "Temperature (°C)", value: firstRun.external_temp_celsius != null ? `${firstRun.external_temp_celsius} °C` : "—" },
    { label: t("simulation.var_occupancy") || "Occupancy (%)", value: firstRun.occupancy_percent != null ? `${firstRun.occupancy_percent}%` : "—" },
    {
      label: t("simulation.var_heating_type") || "Heating Type",
      value: textContent(
        t(HEATING_LABELS[firstRun.auxiliary_heating_type]) ??
          firstRun.auxiliary_heating_type ??
          "—"
      ),
    },
    { label: t("simulation.efficiency_quantile") || "Quantile", value: textContent(ip.quantile_consumption ?? "mean") },
  ];

  const conditionsHtml = conditions.map(({ label, value }) => `
    <div class="efficiency-param">
      <span class="efficiency-param-label">${textContent(label)}</span>
      <span class="efficiency-param-value">${value}</span>
    </div>`).join("");

  const optimizationHtml = buildOptimizationResultsHtml(results, ip, viewOptions);
  const optimizationBatteryChartData = buildOptimizationBatteryChartData(
    batteryResults,
    viewOptions
  );

  const predictionData = buildUnifiedPredictionData(
    predictionRuns,
    perBusSummary,
    batteryResults
  );
  const unifiedRows = buildUnifiedPredictionRows(predictionData);
  const hasPerBus = perBusSummary.length > 0;

  const tableBody = predictionData.length === 0
    ? `<tr><td colspan="${hasPerBus ? 12 : 8}" class="efficiency-no-data">${textContent(t("simulation.efficiency_no_predictions") || "No prediction data available.")}</td></tr>`
    : unifiedRows;

  const perBusHeaders = hasPerBus ? `
              <th>${textContent(t("simulation.opt_col_min_soc") || "Min SoC (kWh)")}</th>
              <th>${textContent(t("simulation.opt_col_max_soc") || "Max SoC (kWh)")}</th>
              <th>${textContent(t("simulation.opt_col_sessions") || "Chg. Sessions")}</th>
              <th>${textContent(t("simulation.opt_col_charged") || "Charged (kWh)")}</th>` : "";

  const chartCards = [];

  if (predictionData.length > 0) {
    chartCards.push(`
        <div class="chart-section efficiency-chart-card">
          <div class="efficiency-chart-copy">
            <h4>${textContent(t("simulation.efficiency_curve_title") || "Energy efficiency by battery configuration")}</h4>
            <p>${textContent(t("simulation.efficiency_curve_subtitle") || "Lower kWh / km indicates a more efficient setup.")}</p>
          </div>
          <div class="chart-container efficiency-chart-container" data-role="efficiency-curve-chart"></div>
        </div>`);

    chartCards.push(`
        <div class="chart-section efficiency-chart-card">
          <div class="efficiency-chart-copy">
            <h4>${textContent(t("simulation.efficiency_energy_breakdown_title") || "Energy consumption breakdown")}</h4>
            <p>${textContent(t("simulation.efficiency_energy_breakdown_subtitle") || "Compare drivetrain and auxiliary demand for each battery-pack scenario.")}</p>
          </div>
          <div class="chart-container efficiency-chart-container" data-role="efficiency-energy-chart"></div>
          <div class="chart-legend efficiency-chart-legend" data-role="efficiency-energy-legend"></div>
        </div>`);

    chartCards.push(`
        <div class="chart-section efficiency-chart-card">
          <div class="efficiency-chart-copy">
            <h4>${textContent(t("simulation.efficiency_soc_title") || "State of charge operating window")}</h4>
            <p>${textContent(t("simulation.efficiency_soc_subtitle") || "Compare minimum and maximum state of charge reached for each battery-pack scenario.")}</p>
          </div>
          <div class="chart-container efficiency-chart-container" data-role="efficiency-soc-chart"></div>
        </div>`);
  }

  if (optimizationBatteryChartData.length > 0) {
    chartCards.push(`
        <div class="chart-section efficiency-chart-card">
          <div class="efficiency-chart-copy">
            <h4>${textContent(t("simulation.opt_battery_chart_title") || "Battery sizing comparison")}</h4>
            <p>${textContent(t("simulation.opt_battery_chart_subtitle") || "Compare the base and optimized battery-pack recommendation for each shift.")}</p>
          </div>
          <div class="chart-container efficiency-chart-container" data-role="optimization-battery-chart"></div>
          <div class="chart-legend efficiency-chart-legend" data-role="optimization-battery-legend"></div>
        </div>`);
  }

  const chartsHtml = chartCards.length > 0
    ? `
    <div class="efficiency-section">
      <h3 class="efficiency-section-title">${textContent(t("simulation.efficiency_graphical_analysis") || "Graphical analysis")}</h3>
      <div class="efficiency-chart-grid">
        ${chartCards.join("")}
      </div>
    </div>`
    : "";

  el.innerHTML = `
    <div class="efficiency-section">
      <h3 class="efficiency-section-title">${textContent(t("simulation.efficiency_operating_conditions") || "Operating Conditions")}</h3>
      <div class="efficiency-params-grid">${conditionsHtml}</div>
    </div>
    ${chartsHtml}
    ${optimizationHtml}
    <div class="efficiency-section">
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
              <th>${textContent(t("simulation.efficiency_col_drivetrain") || "Drivetrain (kWh)")}</th>
              <th>${textContent(t("simulation.efficiency_col_auxiliary") || "Auxiliary (kWh)")}</th>
              ${perBusHeaders}
            </tr>
          </thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
    </div>`;

  renderEfficiencyCurveChart(
    el.querySelector('[data-role="efficiency-curve-chart"]'),
    predictionData
  );
  renderEfficiencyEnergySplitChart(
    el.querySelector('[data-role="efficiency-energy-chart"]'),
    predictionData
  );
  renderEfficiencyEnergyLegend(
    el.querySelector('[data-role="efficiency-energy-legend"]')
  );
  renderEfficiencySocEnvelopeChart(
    el.querySelector('[data-role="efficiency-soc-chart"]'),
    predictionData
  );
  renderOptimizationBatteryChart(
    el.querySelector('[data-role="optimization-battery-chart"]'),
    optimizationBatteryChartData
  );
  renderOptimizationBatteryLegend(
    el.querySelector('[data-role="optimization-battery-legend"]')
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
    const bestValue = toFiniteNumber(best?.summary?.consumption_per_km_kwh);
    const candidateValue = toFiniteNumber(run?.summary?.consumption_per_km_kwh);
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

const buildEconomicComparisonParams = async (optimizationRun, predictionRuns, options = {}) => {
  const inputParams = optimizationRun?.input_params ?? {};
  const batteryResults = optimizationRun?.results?.battery_results ?? {};
  const selectedPredictionRun = selectCostPredictionRun(
    predictionRuns,
    batteryResults,
    options
  );
  const predictionSummary = selectedPredictionRun?.summary ?? {};
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
  const [annualization, shiftPresentation] = await Promise.all([
    resolveCostAnnualization(shiftId, predictionSummary),
    resolveShiftPresentation(shiftId),
  ]);
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
  const projectedTrendHorizonYears = PROJECTED_COST_TREND_HORIZON_YEARS;
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
  };

  return {
    params: economicComparisonParams,
    annualization: {
      ...annualization,
      opexAnnualizationRate: interestRate,
    },
    inputs: {
      shiftId,
      shiftLineLabel: shiftPresentation.lineLabel,
      shiftWeekdayLabel: shiftPresentation.weekdayLabel,
      recurrence: annualization.recurrence,
      yearlyDistanceKm: annualization.yearlyDistanceKm,
      predictedShiftDistanceKm: annualization.predictedShiftDistanceKm,
      predictedShiftConsumptionKwh: annualization.predictedShiftConsumptionKwh,
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

const renderCostsSection = (sec, state, options = {}) => {
  if (!sec) return;

  renderCostVariablesSection(sec, state, options);

  const investEl = sec.querySelector('[data-role="costs-investment"]');
  const electricOpexEl = sec.querySelector('[data-role="costs-electric-opex"]');
  const dieselOpexEl = sec.querySelector('[data-role="costs-diesel-opex"]');
  const apiParamsEl = sec.querySelector('[data-role="costs-api-params"]');
  const kpiEl = sec.querySelector('[data-role="costs-kpis"]');
  const noteEl = sec.querySelector('[data-role="costs-assumption"]');
  const barEl = sec.querySelector('[data-role="costs-bar-chart"]');
  const legendEl = sec.querySelector('[data-role="costs-legend"]');
  const lineEl = sec.querySelector('[data-role="costs-line-chart"]');
  const inputsEl = sec.querySelector('[data-role="costs-opex-inputs"]');

  const hasResolvedCostData =
    !!state.comparison && !!state.annualization && !!state.costInputs;

  if ((state.status === "idle" || state.status === "loading") && !hasResolvedCostData) {
    renderInvestmentTable(investEl, state, options);
    renderElectricOpexSection(electricOpexEl, state);
    renderDieselOpexSection(dieselOpexEl, state);
    renderCostApiParamsSection(apiParamsEl, state);
    renderCostsKpis(kpiEl, null);
    renderCostsAssumption(noteEl, state.annualization);
    renderOpexInputsTable(inputsEl, state);
    if (barEl) {
      barEl.innerHTML = costsStateHtml(
        t("simulation.costs_loading") || "Loading cost comparison…"
      );
    }
    if (legendEl) legendEl.innerHTML = "";
    if (lineEl) {
      lineEl.innerHTML = costsStateHtml(
        t("simulation.costs_loading") || "Loading cost comparison…"
      );
    }
    return;
  }

  if (state.status === "error" && !hasResolvedCostData) {
    renderInvestmentTable(investEl, state, options);
    renderElectricOpexSection(electricOpexEl, state);
    renderDieselOpexSection(dieselOpexEl, state);
    renderCostApiParamsSection(apiParamsEl, state);
    renderCostsKpis(kpiEl, null);
    renderCostsAssumption(noteEl, state.annualization);
    renderOpexInputsTable(inputsEl, state);
    if (barEl) {
      barEl.innerHTML = costsStateHtml(
        state.error ||
          t("simulation.costs_error") ||
          "Unable to load cost comparison.",
        "error"
      );
    }
    if (legendEl) legendEl.innerHTML = "";
    if (lineEl) {
      lineEl.innerHTML = costsStateHtml(
        state.error ||
          t("simulation.costs_error") ||
          "Unable to load cost comparison.",
        "error"
      );
    }
    return;
  }

  renderInvestmentTable(investEl, state, options);
  renderElectricOpexSection(electricOpexEl, state);
  renderDieselOpexSection(dieselOpexEl, state);
  renderCostApiParamsSection(apiParamsEl, state);
  const chartData = buildCostsChartData(state.comparison, {
    ...options,
    annualizationRate: state.annualization?.opexAnnualizationRate,
    optimizationRun: state.optimizationRun,
  });
  renderCostsKpis(kpiEl, state.comparison, chartData?.annualTotals);
  renderCostsAssumption(noteEl, state.annualization);
  renderOpexInputsTable(inputsEl, state);
  renderCostsBar(barEl, chartData?.tco ?? []);
  renderCostsLegend(legendEl);
  renderCostsLine(lineEl, chartData?.yearly ?? []);
};

/* ── Emissions tab charts ─────────────────────────────────────── */

const renderCO2Bar = (el) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const W = 620, H = 280;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_co2_bar",
      "CO2 emissions comparison bar chart"
    )
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(CO2_ANNUAL.map((d) => d.category)).range([0, iW]).padding(0.4);
  const y = d3.scaleLinear().domain([0, 100]).nice().range([iH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(x).tickFormat((d) => busCategoryLabel(d)))
    .selectAll("text")
    .attr("font-size", "11px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "11px");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -45)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(t("simulation.axis_co2_t_per_year"));

  g.selectAll(".bar").data(CO2_ANNUAL).join("rect")
    .attr("x", (d) => x(d.category)).attr("y", (d) => y(d.value))
    .attr("width", x.bandwidth()).attr("height", (d) => iH - y(d.value))
    .attr("rx", 4).attr("fill", (d) => d.color);

  g.selectAll(".bar-label").data(CO2_ANNUAL).join("text")
    .attr("x", (d) => x(d.category) + x.bandwidth() / 2)
    .attr("y", (d) => y(d.value) - 6)
    .attr("text-anchor", "middle").attr("font-size", "12px").attr("font-weight", "600").attr("fill", "#1c1c1c")
    .text((d) => `${d.value} ${t("simulation.unit_tonnes_short")}`);

  el.appendChild(svg.node());
};

const renderCO2Legend = (el) => {
  if (!el) return;
  el.innerHTML = CO2_ANNUAL.map(
    (d) => `
    <div class="chart-legend-item">
      <span class="chart-legend-swatch" style="background:${d.color}"></span>
      ${textContent(busCategoryLabel(d.category))}
    </div>`
  ).join("");
};

const renderCO2Cumulative = (el) => {
  if (!el) return;
  el.innerHTML = "";
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const W = 620, H = 260;
  const iW = W - margin.left - margin.right, iH = H - margin.top - margin.bottom;

  const svg = svgBase(
    W,
    H,
    chartAriaLabel(
      "simulation.chart_aria_co2_cumulative",
      "Cumulative CO2 savings area chart"
    )
  );
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([1, 15]).range([0, iW]);
  const y = d3.scaleLinear().domain([0, d3.max(CO2_CUM, (d) => d.saved) * 1.1]).nice().range([iH, 0]);

  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).ticks(15).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "10px");
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`)).selectAll("text").attr("font-size", "10px");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -45)
    .attr("x", -iH / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text(t("simulation.axis_co2_saved_t"));
  gridLines(g, y, iW);

  const area = d3.area().x((d) => x(d.year)).y0(iH).y1((d) => y(d.saved)).curve(d3.curveMonotoneX);
  const line = d3.line().x((d) => x(d.year)).y((d) => y(d.saved)).curve(d3.curveMonotoneX);

  g.append("path").datum(CO2_CUM).attr("d", area).attr("fill", "rgba(171,232,40,0.15)");
  g.append("path").datum(CO2_CUM).attr("d", line).attr("fill", "none").attr("stroke", "#abe828").attr("stroke-width", 2.5);

  g.selectAll(".dot").data(CO2_CUM).join("circle")
    .attr("cx", (d) => x(d.year)).attr("cy", (d) => y(d.saved)).attr("r", 3)
    .attr("fill", "#abe828").attr("stroke", "#fff").attr("stroke-width", 1.5);

  el.appendChild(svg.node());
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
  };
  const economicDefaults = {
    fuelCostPerL: normalizeFuelCostPerL(options?.economicDefaults?.fuelCostPerL),
    energyPricePerKwh: normalizeEnergyPricePerKwh(
      options?.economicDefaults?.energyPricePerKwh
    ),
    interestRate: normalizeInterestRate(options?.economicDefaults?.interestRate),
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

  const refreshCostsTab = () => {
    if (!renderedTabs.has("costs")) return;
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
      { selectedShiftId: activeShiftId, selectedShiftName: activeShiftName }
    );
  };

  const TAB_RENDERERS = {
    costs: (sec) => {
      renderCostsSection(sec.querySelector('[data-panel="costs"]') ?? sec, costState, options);
    },
    efficiency: (sec) => {
      renderEfficiencyTable(
        sec.querySelector('[data-role="efficiency-table"]'),
        efficiencyState,
        { selectedShiftId: activeShiftId, selectedShiftName: activeShiftName }
      );
    },
    emissions: (sec) => {
      renderCO2Bar(sec.querySelector('[data-role="emissions-bar-chart"]'));
      renderCO2Legend(sec.querySelector('[data-role="emissions-legend"]'));
      renderCO2Cumulative(sec.querySelector('[data-role="emissions-line-chart"]'));
    },
  };

  const simNameEl = section.querySelector('[data-role="sim-name"]');
  const busModelEl = section.querySelector('[data-role="sim-bus-model"]');
  const shiftTabsEl = section.querySelector('[data-role="shift-tabs"]');
  const overlay = section.querySelector('[data-role="sim-data-overlay"]');
  const subtitleEl = section.querySelector('[data-role="sim-data-subtitle"]');
  const fuelCostInput = section.querySelector('[data-role="cost-variable-fuel-cost"]');
  const energyPriceInput = section.querySelector('[data-role="cost-variable-energy-price"]');
  const interestRateInput = section.querySelector('[data-role="cost-variable-interest-rate"]');
  const fuelCostResetBtn = section.querySelector('[data-role="cost-variable-fuel-cost-reset"]');
  const energyPriceResetBtn = section.querySelector('[data-role="cost-variable-energy-price-reset"]');
  const interestRateResetBtn = section.querySelector('[data-role="cost-variable-interest-rate-reset"]');

  const busModelName = options.busModelName || "";

  if (simNameEl) simNameEl.textContent = activeShiftName;
  if (busModelEl) busModelEl.textContent = busModelName;

  const renderGeneralInfo = (overrides = {}) => {
    const generalInfo = {
      ...FAKE_GENERAL_INFO,
      shift_name: activeShiftName,
      ...compactFieldEntries({
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
      ...(bmd.manufacturer ? { manufacturer: bmd.manufacturer } : {}),
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

    const firstPredictionRun = loadedPredictionRuns[0] ?? {};
    renderGeneralInfo({
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

  activateTab("costs");

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
      const predRunIds = Array.isArray(optimizationRun?.prediction_run_ids)
        ? optimizationRun.prediction_run_ids
        : [];
      const predictionRuns = predRunIds.length
        ? await Promise.all(predRunIds.map((id) => fetchPredictionRun(id)))
        : [];
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
  };

  loadResultData();

  return () => {
    if (costVariableRefreshTimer) {
      clearTimeout(costVariableRefreshTimer);
    }
    cleanupHandlers.forEach((h) => h());
  };
};
