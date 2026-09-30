export const LCA_METHOD = "mobitool-parameterized-grid94-v1";

export function mapParameterizedLca(raw) {
  if (raw?.methodology_version !== LCA_METHOD || raw.status !== "complete") {
    const reasons = raw?.vehicles?.filter(v => v.status !== "complete").map(v => v.reason) ?? [];
    throw new Error(raw?.reason || reasons.join("; ") || "Incomplete parameterized LCA; no total is available.");
  }
  const electricYearly = {}, dieselYearly = {}, heating = {};
  for (const [key, value] of Object.entries(raw.indicators)) {
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

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
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
  const label = key => escape(t(`yearly_analysis.lca_${key}`));
  const rows = Object.entries(raw.indicators).map(([key, v]) => {
    const [scale, unit] = displayUnits[key];
    return `<tr><th>${escape(indicatorLabels[key])} [${escape(unit)}]</th>
    <td>${fmt(v.electricity_operation/scale)}</td><td>${fmt(v.diesel_heating/scale)}</td><td>${fmt(v.other_lifecycle/scale)}</td>
    <td><strong>${fmt(v.total/scale)}</strong></td><td>${fmt(v.diesel_comparator_total/scale)}</td></tr>`;
  }).join("");
  const perKm = Object.entries(raw.indicators).map(([key,v]) => `<tr><th>${escape(indicatorLabels[key])} [${escape(displayUnits[key][2])}]</th><td>${fmt(v.total/raw.annual_km)}</td><td>${fmt(v.diesel_comparator_total/raw.annual_km)}</td></tr>`).join("");
  const gwp = raw.indicators.gwp100a;
  const maximum = Math.max(gwp.total, gwp.diesel_comparator_total, 1);
  const bar = (name, values, total) => `<div style="margin:12px 0"><strong>${name}: ${fmt(total/1e6)} t CO₂-eq</strong>
    <div style="display:flex;height:28px;width:100%;background:#f3f4f6">${phases.map(([key, translation, color]) =>
      `<span title="${escape(t(`simulation.emissions_phase_${translation}`))}: ${fmt(values[key]/1e6)} t CO₂-eq"
       style="display:block;background:${color};width:${Math.max(0, values[key])/maximum*100}%"></span>`).join("")}</div></div>`;
  const vehicleRows = raw.vehicles.map(v => `<tr><td>${escape(v.shift_id)}</td><td>${fmt(v.annual_km)}</td>
    <td>${fmt(v.battery_capacity_kwh)} / ${escape(v.battery_chemistry)}</td><td>${fmt(v.passengers)}</td>
    <td>${fmt(v.lifetime_bus)} / ${fmt(v.lifetime_battery)} / ${fmt(v.lifetime_diesel_bus)}</td></tr>`).join("");
  const warnings = [...new Set(raw.vehicles.flatMap(v => v.warnings ?? []))];
  element.innerHTML = `<h3>${label("title")}</h3><p>${label("boundary")}</p>
    <p>${label("dc_energy")}: <strong>${fmt(raw.energy_boundary.dc_kwh)} kWh</strong> · ${label("grid_energy")}: <strong>${fmt(raw.energy_boundary.grid_kwh)} kWh</strong> · ${label("losses")}: ${fmt(raw.energy_boundary.charging_losses_kwh)} kWh</p>
    <p>${label("activity")}: ${fmt(raw.annual_km)} km · ${raw.vehicle_count} ${label("vehicles")}</p>
    <div style="overflow-x:auto"><table class="ya-table"><thead><tr><th>${label("indicator")}</th><th>${label("electricity")}</th><th>${label("heater")}</th><th>${label("other")}</th><th>ELETTRA — ${label("total")}</th><th>Diesel — ${label("total")}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <details><summary>${label("per_km")}</summary><table class="ya-table"><thead><tr><th>${label("indicator")}</th><th>ELETTRA</th><th>Diesel</th></tr></thead><tbody>${perKm}</tbody></table></details>
    <h4>${label("phases")}</h4>${bar("ELETTRA", gwp.phases, gwp.total)}${bar("Diesel", gwp.diesel_comparator_phases, gwp.diesel_comparator_total)}
    <div style="display:flex;gap:12px;flex-wrap:wrap">${phases.map(([,translation,color]) => `<span><span style="display:inline-block;width:12px;height:12px;background:${color}"></span> ${escape(t(`simulation.emissions_phase_${translation}`))}</span>`).join("")}</div>
    <details><summary>${label("assumptions")}</summary><p>${label("inventory_note")}</p>
    <div style="overflow-x:auto"><table class="ya-table"><thead><tr><th>${label("vehicle")}</th><th>${label("annual_km")}</th><th>${label("battery")} [kWh]</th><th>${label("passengers")}</th><th>${label("lifetimes")}</th></tr></thead><tbody>${vehicleRows}</tbody></table></div>
    <p>${escape(raw.methodology_version)} · Mobitool ${escape(raw.provenance.data_version)}</p>
    <p>PE = ${label("primary_energy")}. ${label("primary_note")}</p>
    <p>${label("limits_note")}</p>
    ${warnings.map(w => `<p>${escape(w)}</p>`).join("")}<p>${label("export_note")}</p></details>
    <button type="button" data-lca-export>${label("export")}</button>`;
  element.querySelector("[data-lca-export]").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(raw, null, 2)], {type:"application/json"}));
    const a = document.createElement("a"); a.href=url; a.download="parameterized-lca.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
