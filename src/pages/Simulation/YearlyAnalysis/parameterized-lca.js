import { escapeHtml } from "../../../utils/html.js";

export const LCA_METHOD = "mobitool-parameterized-grid94-v1";

const ENERGY_POLICY = "grid-to-bus-dc-94-v1";
const GRID_TO_BUS_EFFICIENCY = 0.94;
const REQUIRED_INDICATORS = [
  "gwp100a",
  "nox",
  "pm10",
  "primaryEnergy",
  "primaryEnergyNonRenewable",
];
const LIFECYCLE_PHASES = [
  "direct",
  "directNonExhaust",
  "energyChain",
  "maintenance",
  "vehicle",
  "endOfLife",
  "infrastructure",
];

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value);
const isNonEmptyString = value => typeof value === "string" && value.trim().length > 0;
const nearlyEqual = (left, right) =>
  isFiniteNumber(left) &&
  isFiniteNumber(right) &&
  Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(left), Math.abs(right));

const collectIncompleteReasons = raw => {
  const reasons = [];
  if (isNonEmptyString(raw?.reason)) reasons.push(raw.reason.trim());
  if (Array.isArray(raw?.vehicles)) {
    raw.vehicles.forEach(vehicle => {
      if (vehicle?.status !== "complete" && isNonEmptyString(vehicle?.reason)) {
        reasons.push(vehicle.reason.trim());
      }
    });
  }
  return [...new Set(reasons)];
};

const validateFiniteField = (issues, value, path, { positive = false, nonNegative = false } = {}) => {
  if (!isFiniteNumber(value)) {
    issues.push(`${path} must be a finite number.`);
    return false;
  }
  if (positive && value <= 0) {
    issues.push(`${path} must be greater than zero.`);
    return false;
  }
  if (nonNegative && value < 0) {
    issues.push(`${path} must be non-negative.`);
    return false;
  }
  return true;
};

const validatePhases = (issues, phases, path) => {
  if (!isRecord(phases)) {
    issues.push(`${path} must be an object.`);
    return false;
  }
  let valid = true;
  LIFECYCLE_PHASES.forEach(phase => {
    if (!validateFiniteField(issues, phases[phase], `${path}.${phase}`)) valid = false;
  });
  return valid;
};

const sumPhases = phases =>
  LIFECYCLE_PHASES.reduce((total, phase) => total + phases[phase], 0);

const validateIndicator = (issues, indicator, key) => {
  const path = `indicators.${key}`;
  if (!isRecord(indicator)) {
    issues.push(`${path} must be an object.`);
    return;
  }
  if (!isNonEmptyString(indicator.unit)) issues.push(`${path}.unit must be a non-empty string.`);

  const numericFields = [
    "electricity_operation",
    "diesel_heating",
    "other_lifecycle",
    "total",
    "diesel_comparator_total",
  ];
  const numericValid = numericFields.reduce(
    (valid, field) => validateFiniteField(issues, indicator[field], `${path}.${field}`) && valid,
    true,
  );
  if (indicator.saving !== undefined) {
    const savingValid = validateFiniteField(issues, indicator.saving, `${path}.saving`);
    if (
      savingValid &&
      isFiniteNumber(indicator.total) &&
      isFiniteNumber(indicator.diesel_comparator_total) &&
      !nearlyEqual(indicator.saving, indicator.diesel_comparator_total - indicator.total)
    ) {
      issues.push(`${path}.saving does not match diesel_comparator_total minus total.`);
    }
  }

  const phasesValid = validatePhases(issues, indicator.phases, `${path}.phases`);
  const dieselPhasesValid = validatePhases(
    issues,
    indicator.diesel_comparator_phases,
    `${path}.diesel_comparator_phases`,
  );
  const heaterPhasesValid = validatePhases(
    issues,
    indicator.diesel_heating_phases,
    `${path}.diesel_heating_phases`,
  );

  if (phasesValid && isFiniteNumber(indicator.total) && !nearlyEqual(sumPhases(indicator.phases), indicator.total)) {
    issues.push(`${path}.phases do not sum to total.`);
  }
  if (
    dieselPhasesValid &&
    isFiniteNumber(indicator.diesel_comparator_total) &&
    !nearlyEqual(sumPhases(indicator.diesel_comparator_phases), indicator.diesel_comparator_total)
  ) {
    issues.push(`${path}.diesel_comparator_phases do not sum to diesel_comparator_total.`);
  }
  if (
    heaterPhasesValid &&
    isFiniteNumber(indicator.diesel_heating) &&
    !nearlyEqual(sumPhases(indicator.diesel_heating_phases), indicator.diesel_heating)
  ) {
    issues.push(`${path}.diesel_heating_phases do not sum to diesel_heating.`);
  }
  if (
    numericValid &&
    !nearlyEqual(
      indicator.electricity_operation + indicator.diesel_heating + indicator.other_lifecycle,
      indicator.total,
    )
  ) {
    issues.push(`${path} components do not sum to total.`);
  }
};

const validateEnergyBoundary = (issues, boundary) => {
  if (!isRecord(boundary)) {
    issues.push("energy_boundary must be an object.");
    return false;
  }
  if (boundary.policy !== ENERGY_POLICY) {
    issues.push(`energy_boundary.policy must be ${ENERGY_POLICY}.`);
  }
  const dcValid = validateFiniteField(issues, boundary.dc_kwh, "energy_boundary.dc_kwh", {
    nonNegative: true,
  });
  const gridValid = validateFiniteField(issues, boundary.grid_kwh, "energy_boundary.grid_kwh", {
    nonNegative: true,
  });
  const lossesValid = validateFiniteField(
    issues,
    boundary.charging_losses_kwh,
    "energy_boundary.charging_losses_kwh",
    { nonNegative: true },
  );
  const efficiencyValid = validateFiniteField(
    issues,
    boundary.grid_to_bus_efficiency,
    "energy_boundary.grid_to_bus_efficiency",
    { positive: true },
  );

  if (efficiencyValid && !nearlyEqual(boundary.grid_to_bus_efficiency, GRID_TO_BUS_EFFICIENCY)) {
    issues.push(`energy_boundary.grid_to_bus_efficiency must be ${GRID_TO_BUS_EFFICIENCY}.`);
  }
  if (dcValid && gridValid && boundary.grid_kwh < boundary.dc_kwh) {
    issues.push("energy_boundary.grid_kwh must not be lower than dc_kwh.");
  }
  if (
    dcValid &&
    gridValid &&
    efficiencyValid &&
    !nearlyEqual(boundary.dc_kwh, boundary.grid_kwh * boundary.grid_to_bus_efficiency)
  ) {
    issues.push("energy_boundary DC and grid energy do not match the declared efficiency.");
  }
  if (
    dcValid &&
    gridValid &&
    lossesValid &&
    !nearlyEqual(boundary.grid_kwh - boundary.dc_kwh, boundary.charging_losses_kwh)
  ) {
    issues.push("energy_boundary charging losses do not match grid_kwh minus dc_kwh.");
  }
  return dcValid && gridValid && lossesValid && efficiencyValid;
};

const validateVehicle = (issues, vehicle, index) => {
  const path = `vehicles[${index}]`;
  if (!isRecord(vehicle)) {
    issues.push(`${path} must be an object.`);
    return false;
  }
  if (vehicle.status !== "complete") issues.push(`${path}.status must be complete.`);
  ["shift_id", "reference_size", "battery_chemistry", "electricity_mix"].forEach(field => {
    if (!isNonEmptyString(vehicle[field])) issues.push(`${path}.${field} must be a non-empty string.`);
  });
  const positiveFields = [
    "bus_length_m",
    "battery_capacity_kwh",
    "lifetime_bus",
    "lifetime_battery",
    "lifetime_diesel_bus",
    "annual_km",
  ];
  positiveFields.forEach(field =>
    validateFiniteField(issues, vehicle[field], `${path}.${field}`, { positive: true }),
  );
  ["dc_kwh", "diesel_heating_liters", "passengers"].forEach(field =>
    validateFiniteField(issues, vehicle[field], `${path}.${field}`, { nonNegative: true }),
  );
  if (vehicle.warnings !== undefined) {
    if (!Array.isArray(vehicle.warnings) || vehicle.warnings.some(item => !isNonEmptyString(item))) {
      issues.push(`${path}.warnings must be an array of non-empty strings.`);
    }
  }
  return true;
};

/**
 * Validate the complete parameterized-LCA contract before totals are exposed.
 * Incomplete backend results keep their explicit reason and are never treated
 * as a partially usable total.
 */
export function validateParameterizedLca(raw) {
  if (!isRecord(raw)) {
    return { valid: false, issues: ["Parameterized LCA response must be an object."] };
  }

  if (raw.status !== "complete") {
    const reasons = collectIncompleteReasons(raw);
    return {
      valid: false,
      issues: reasons.length
        ? reasons
        : ["Incomplete parameterized LCA; no total is available."],
    };
  }

  const issues = [];
  if (raw.methodology_version !== LCA_METHOD) {
    issues.push(`methodology_version must be ${LCA_METHOD}.`);
  }
  const annualKmValid = validateFiniteField(issues, raw.annual_km, "annual_km", { positive: true });

  const vehicleCountValid = Number.isInteger(raw.vehicle_count) && raw.vehicle_count > 0;
  if (!vehicleCountValid) issues.push("vehicle_count must be a positive integer.");
  const vehiclesValid = Array.isArray(raw.vehicles);
  if (!vehiclesValid) {
    issues.push("vehicles must be an array.");
  } else {
    if (vehicleCountValid && raw.vehicles.length !== raw.vehicle_count) {
      issues.push("vehicles length does not match vehicle_count.");
    }
    raw.vehicles.forEach((vehicle, index) => validateVehicle(issues, vehicle, index));
  }

  const boundaryValid = validateEnergyBoundary(issues, raw.energy_boundary);

  if (!isRecord(raw.indicators)) {
    issues.push("indicators must be an object.");
  } else {
    REQUIRED_INDICATORS.forEach(key => validateIndicator(issues, raw.indicators[key], key));
  }

  if (!isRecord(raw.provenance)) {
    issues.push("provenance must be an object.");
  } else if (!isNonEmptyString(raw.provenance.data_version)) {
    issues.push("provenance.data_version must be a non-empty string.");
  }

  if (!Array.isArray(raw.limitations)) {
    issues.push("limitations must be an array.");
  } else if (raw.limitations.some(item => !isNonEmptyString(item))) {
    issues.push("limitations must contain only non-empty strings.");
  }

  if (vehiclesValid && annualKmValid) {
    const annualKmValues = raw.vehicles.map(vehicle => vehicle?.annual_km);
    if (
      annualKmValues.every(isFiniteNumber) &&
      !nearlyEqual(annualKmValues.reduce((total, value) => total + value, 0), raw.annual_km)
    ) {
      issues.push("vehicle annual_km values do not sum to annual_km.");
    }
  }
  if (vehiclesValid && boundaryValid) {
    const dcValues = raw.vehicles.map(vehicle => vehicle?.dc_kwh);
    if (
      dcValues.every(isFiniteNumber) &&
      !nearlyEqual(dcValues.reduce((total, value) => total + value, 0), raw.energy_boundary.dc_kwh)
    ) {
      issues.push("vehicle dc_kwh values do not sum to energy_boundary.dc_kwh.");
    }
  }

  return { valid: issues.length === 0, issues };
}

export function mapParameterizedLca(raw) {
  const validation = validateParameterizedLca(raw);
  if (!validation.valid) {
    throw new Error(validation.issues.join(" "));
  }
  const electricYearly = {}, dieselYearly = {}, heating = {};
  for (const key of REQUIRED_INDICATORS) {
    const value = raw.indicators[key];
    electricYearly[key] = { ...value.phases, total: value.total, unit: value.unit };
    dieselYearly[key] = { ...value.diesel_comparator_phases, total: value.diesel_comparator_total, unit: value.unit };
    heating[key] = { ...value.diesel_heating_phases, total: value.diesel_heating };
  }
  return { rawLca: raw, electricYearly, dieselYearly, dieselHeatingYearly: heating,
    electricOnlyYearly: null, yearlyDistanceKm: raw.annual_km,
    yearlyImpact: { yearly_distance_km: raw.annual_km },
    isDieselHeating: raw.vehicles.some(v => v.diesel_heating_liters > 0),
    emissionsMetadata: { methodologyVersion: raw.methodology_version, provenance: raw.provenance,
      energyBoundary: raw.energy_boundary, vehicles: raw.vehicles }, structured: {
        methodologyVersion: raw.methodology_version,
        ebus: { indicators: electricYearly }, dieselComparator: { indicators: dieselYearly },
        dataCompleteness: { status: "complete" },
        scopeCompleteness: { status: "representative_vehicle_lca", limitations: raw.limitations },
        assumptions: { yearly_distance_km: raw.annual_km, energy_boundary: raw.energy_boundary },
      } };
}

const fmt = value => Number(value).toLocaleString(undefined, {maximumFractionDigits: 2});
const displayUnits = {gwp100a:[1e6,"t CO₂-eq/year","g CO₂-eq/km"],nox:[1e6,"kg NO₂-eq/year","mg NO₂-eq/km"],pm10:[1e6,"kg PM₁₀/year","mg PM₁₀/km"],primaryEnergy:[1000,"GJ/year","MJ/km"],primaryEnergyNonRenewable:[1000,"GJ/year","MJ/km"]};
const indicatorLabels = {gwp100a:"CO₂-eq",nox:"NOx",pm10:"PM₁₀",primaryEnergy:"PE",primaryEnergyNonRenewable:"PE non-renewable"};
const phases = [
  ["direct", "direct", "#3f51b5"], ["directNonExhaust", "direct_non_exhaust", "#78909c"],
  ["energyChain", "energy_chain", "#ff9800"], ["maintenance", "maintenance", "#66bb6a"],
  ["vehicle", "vehicle", "#ab47bc"], ["endOfLife", "end_of_life", "#26a69a"],
  ["infrastructure", "infrastructure", "#ef5350"],
];

export function renderParameterizedLca(element, raw, t) {
  const label = key => escapeHtml(t(`yearly_analysis.lca_${key}`));
  const displayIndicatorKeys = REQUIRED_INDICATORS.filter(key => isRecord(raw.indicators?.[key]));
  const rows = displayIndicatorKeys.map(key => {
    const v = raw.indicators[key];
    const [scale, unit] = displayUnits[key];
    return `<tr><th>${escapeHtml(indicatorLabels[key])} [${escapeHtml(unit)}]</th>
    <td>${fmt(v.electricity_operation/scale)}</td><td>${fmt(v.diesel_heating/scale)}</td><td>${fmt(v.other_lifecycle/scale)}</td>
    <td><strong>${fmt(v.total/scale)}</strong></td><td>${fmt(v.diesel_comparator_total/scale)}</td></tr>`;
  }).join("");
  const perKm = displayIndicatorKeys.map(key => {
    const v = raw.indicators[key];
    return `<tr><th>${escapeHtml(indicatorLabels[key])} [${escapeHtml(displayUnits[key][2])}]</th><td>${fmt(v.total/raw.annual_km)}</td><td>${fmt(v.diesel_comparator_total/raw.annual_km)}</td></tr>`;
  }).join("");
  const gwp = raw.indicators.gwp100a;
  const maximum = Math.max(gwp.total, gwp.diesel_comparator_total, 1);
  const bar = (name, values, total) => `<div style="margin:12px 0"><strong>${name}: ${fmt(total/1e6)} t CO₂-eq</strong>
    <div style="display:flex;height:28px;width:100%;background:#f3f4f6">${phases.map(([key, translation, color]) =>
      `<span title="${escapeHtml(t(`simulation.emissions_phase_${translation}`))}: ${fmt(values[key]/1e6)} t CO₂-eq"
       style="display:block;background:${color};width:${Math.max(0, values[key])/maximum*100}%"></span>`).join("")}</div></div>`;
  const vehicleRows = raw.vehicles.map(v => `<tr><td>${escapeHtml(v.shift_id)}</td><td>${fmt(v.annual_km)}</td>
    <td>${fmt(v.battery_capacity_kwh)} / ${escapeHtml(v.battery_chemistry)}</td><td>${fmt(v.passengers)}</td>
    <td>${fmt(v.lifetime_bus)} / ${fmt(v.lifetime_battery)} / ${fmt(v.lifetime_diesel_bus)}</td></tr>`).join("");
  const warnings = [...new Set(raw.vehicles.flatMap(v => v.warnings ?? []))];
  element.innerHTML = `<h3>${label("title")}</h3><p>${label("boundary")}</p>
    <p>${label("dc_energy")}: <strong>${fmt(raw.energy_boundary.dc_kwh)} kWh</strong> · ${label("grid_energy")}: <strong>${fmt(raw.energy_boundary.grid_kwh)} kWh</strong> · ${label("losses")}: ${fmt(raw.energy_boundary.charging_losses_kwh)} kWh</p>
    <p>${label("activity")}: ${fmt(raw.annual_km)} km · ${escapeHtml(raw.vehicle_count)} ${label("vehicles")}</p>
    <div style="overflow-x:auto"><table class="ya-table"><thead><tr><th>${label("indicator")}</th><th>${label("electricity")}</th><th>${label("heater")}</th><th>${label("other")}</th><th>ELETTRA — ${label("total")}</th><th>Diesel — ${label("total")}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <details><summary>${label("per_km")}</summary><table class="ya-table"><thead><tr><th>${label("indicator")}</th><th>ELETTRA</th><th>Diesel</th></tr></thead><tbody>${perKm}</tbody></table></details>
    <h4>${label("phases")}</h4>${bar("ELETTRA", gwp.phases, gwp.total)}${bar("Diesel", gwp.diesel_comparator_phases, gwp.diesel_comparator_total)}
    <div style="display:flex;gap:12px;flex-wrap:wrap">${phases.map(([,translation,color]) => `<span><span style="display:inline-block;width:12px;height:12px;background:${color}"></span> ${escapeHtml(t(`simulation.emissions_phase_${translation}`))}</span>`).join("")}</div>
    <details><summary>${label("assumptions")}</summary><p>${label("inventory_note")}</p>
    <div style="overflow-x:auto"><table class="ya-table"><thead><tr><th>${label("vehicle")}</th><th>${label("annual_km")}</th><th>${label("battery")} [kWh]</th><th>${label("passengers")}</th><th>${label("lifetimes")}</th></tr></thead><tbody>${vehicleRows}</tbody></table></div>
    <p>${escapeHtml(raw.methodology_version)} · Mobitool ${escapeHtml(raw.provenance?.data_version)}</p>
    <p>PE = ${label("primary_energy")}. ${label("primary_note")}</p>
    <p>${label("limits_note")}</p>
    ${warnings.map(w => `<p>${escapeHtml(w)}</p>`).join("")}<p>${label("export_note")}</p></details>
    <button type="button" data-lca-export>${label("export")}</button>`;
  element.querySelector("[data-lca-export]").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(raw, null, 2)], {type:"application/json"}));
    const a = document.createElement("a"); a.href=url; a.download="parameterized-lca.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
