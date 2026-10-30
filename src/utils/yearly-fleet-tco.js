import { gridFromDc } from './charging-energy.js';
import { getElectricMaintenanceCostForLength, getDieselMaintenanceCostForLength,
  getEquivalentDieselBusCapexForLength, DIESEL_CONSUMPTION_BASE,
  DEFAULT_DIESEL_BUS_LIFETIME_YEARS } from '../config/economic-defaults.js';

const number = value => value == null || value === '' || typeof value === 'boolean'
  ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const sum = values => values.every(v => Number.isFinite(v)) ? values.reduce((a, b) => a + b, 0) : null;
const close = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

export function yearlyTcoDefaults(features = {}, model = {}) {
  let saved = features.config?.bus_model_snapshot ?? {};
  if (typeof saved === 'string') { try { saved = JSON.parse(saved); } catch { saved = {}; } }
  const bodyLife = number(saved.bus_lifetime ?? saved.bus_lifetime_years ?? model.bus_lifetime) || 12;
  const length = number(saved.bus_length_m ?? model.bus_length_m);
  const defaults = {
    horizon: bodyLife, rate: .03,
    bodyLife,
    batteryLife: number(saved.battery_pack_lifetime ?? saved.battery_pack_lifetime_years ?? model.battery_pack_lifetime) || 8,
    pointLife: 15, siteLife: 30,
    energyPrice: .20,
    maintenancePerKm: getElectricMaintenanceCostForLength(saved.bus_length_m ?? model.bus_length_m),
    infrastructureMaintenance: 0,
    infrastructureMaintenanceRate: .02,
    dieselCapex: getEquivalentDieselBusCapexForLength(length),
    dieselLife: number(features.assessment_assumptions?.lifetime_diesel_bus ?? saved.lifetime_diesel_bus) || DEFAULT_DIESEL_BUS_LIFETIME_YEARS,
    dieselConsumption: number(features.assessment_assumptions?.diesel_consumption_l_per_km) ?? (length ? DIESEL_CONSUMPTION_BASE.intercept + DIESEL_CONSUMPTION_BASE.slope * length : null),
    dieselMaintenance: getDieselMaintenanceCostForLength(length),
    fuelPrice: 1.85, heaterMaintenanceFactor: .10,
  };
  const savedTco = features.assessment_assumptions?.tco ?? {};
  const values = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, number(savedTco[key]) ?? value]));
  // Unversioned zero was the first preview's excluded-cost placeholder. Keep
  // actual saved estimates, and preserve an intentional zero in fixed mode.
  values.infrastructureMaintenanceMode = ['rate', 'fixed'].includes(savedTco.infrastructureMaintenanceMode)
    ? savedTco.infrastructureMaintenanceMode : number(savedTco.infrastructureMaintenance) > 0 ? 'fixed' : 'rate';
  values.annualKmByGroup = Object.fromEntries(buildAnnualFleet(features).groups.map(g => [g.id,
    number(savedTco.annualKmByGroup?.[g.id]) > 0 ? Number(savedTco.annualKmByGroup[g.id]) : g.km / g.count]));
  return values;
}

/** Read immutable selected design and annual duty totals, never the fleet maximum. */
export function buildAnnualFleet(features = {}, predictionRuns = []) {
  const fixed = features.config?.fixedConfiguration ?? {};
  const investments = fixed.investment?.rows ?? [];
  const activity = new Map((features.results?.shiftResults ?? []).map(row => [row.shiftId, row]));
  const issues = [];
  const rows = investments.map(row => {
    const duty = activity.get(row.id);
    const km = number(duty?.yearlyTotals?.distanceKm);
    const dc = number(duty?.yearlyTotals?.totalEnergyKwh);
    if (!km || dc === null || (duty.status && duty.status !== 'completed')) issues.push('incomplete_activity');
    if (number(row.busCost) === null || number(row.batteryCost) === null) issues.push('missing_prices');
    const actual = predictionRuns.filter(run => String(run.shift_id) === row.id);
    if (actual.some(run => {
      const capacity = number(run.contextual_parameters?.battery_capacity_kwh);
      return capacity !== null && row.capacity !== null && !close(capacity, row.capacity);
    })) issues.push('battery_mismatch');
    return { ...row, name: duty?.shiftName ?? row.name, km, dc, grid: dc === null ? null : gridFromDc(dc) };
  });
  if (!rows.length || activity.size !== rows.length || rows.length !== fixed.fleet?.vehicleCount) issues.push('missing_fleet');
  const grouped = new Map();
  rows.forEach(row => {
    const key = JSON.stringify([row.modelName || fixed.busModelId, row.packs, row.capacity]);
    if (!grouped.has(key)) grouped.set(key, { id: row.id, members: [], packs: row.packs, capacity: row.capacity, modelName: row.modelName });
    grouped.get(key).members.push(row);
  });
  const totals = Object.fromEntries(['km', 'dc', 'grid', 'busCost', 'batteryCost'].map(key => [key, sum(rows.map(row => row[key]))]));
  const groups = [...grouped.values()].map(group => ({
    ...group, count: group.members.length,
    km: sum(group.members.map(row => row.km)), dc: sum(group.members.map(row => row.dc)),
  }));
  const stations = (fixed.infrastructure?.stations ?? []).filter(site => site.selected).map(site => ({
    ...site,
    points: number(site.costBreakdown?.chargers_cost_chf),
    fixed: number(site.costBreakdown?.site_fixed_cost_chf),
    power: number(site.costBreakdown?.site_power_cost_chf),
    total: number(site.installationCostChf),
  }));
  if (!fixed.infrastructure?.dataAvailable || fixed.infrastructure?.resultAvailable === false || fixed.infrastructure?.selectionComplete === false) issues.push('missing_infrastructure');
  for (const site of stations) {
    const subtotal = sum([site.points, site.fixed, site.power]);
    if (subtotal === null || site.total === null || !close(subtotal, site.total)) issues.push('missing_infrastructure');
  }
  const infrastructure = Object.fromEntries(['points', 'fixed', 'power', 'total'].map(key => [key, sum(stations.map(site => site[key]))]));
  const savedInfrastructureTotal = number(fixed.infrastructure?.totalInstallationCostChf);
  if (savedInfrastructureTotal !== null && (infrastructure.total === null || !close(savedInfrastructureTotal, infrastructure.total))) issues.push('missing_infrastructure');
  const storedKm = number(features.results?.yearlyTotals?.distanceKm);
  const storedDc = number(features.results?.yearlyTotals?.totalEnergyKwh);
  if (storedKm === null || totals.km === null || !close(storedKm, totals.km) ||
      storedDc === null || totals.dc === null || !close(storedDc, totals.dc)) issues.push('incomplete_activity');
  return { rows, groups, totals, stations, infrastructure, count: rows.length, issues: [...new Set(issues)] };
}

/** All components use the same finite horizon; end-of-year operating costs.
 * Replacements occur before the horizon; straight-line terminal residuals are
 * discounted at the horizon. No purchase occurs at the terminal instant.
 */
export function capitalCashFlow(initial, life, horizon, rate) {
  if (number(initial) === null || !(life > 0) || !(horizon > 0) || !(rate >= 0)) throw new Error('Invalid capital assumptions');
  const replacements = [];
  let lastPurchase = 0;
  for (let year = life; year < horizon - 1e-9; year += life) {
    replacements.push({ year, cost: initial, discounted: initial / (1 + rate) ** year });
    lastPurchase = year;
  }
  const residual = initial * Math.max(0, 1 - (horizon - lastPurchase) / life);
  const discountedReplacements = replacements.reduce((total, event) => total + event.discounted, 0);
  const discountedResidual = residual / (1 + rate) ** horizon;
  return { initial, replacements, residual, discountedReplacements, discountedResidual,
    presentValue: initial + discountedReplacements - discountedResidual };
}

export function computeFleetTco(fleet, assumptions, { dieselHeatingLiters = 0 } = {}) {
  if (fleet.issues.length || !fleet.count || !(fleet.totals.km > 0)) return null;
  const a = assumptions;
  if (!Number.isInteger(a.horizon) || a.horizon < 1 || a.horizon > 60 || number(a.rate) === null || a.rate > 1 ||
      ['bodyLife', 'batteryLife', 'pointLife', 'siteLife'].some(key => number(a[key]) === null || !(a[key] >= 1)) ||
      ['energyPrice', 'maintenancePerKm', 'infrastructureMaintenance', 'fuelPrice', 'heaterMaintenanceFactor'].some(key => number(a[key]) === null) ||
      number(dieselHeatingLiters) === null) return null;
  const infrastructureMaintenance = a.infrastructureMaintenanceMode === 'rate'
    ? fleet.infrastructure.total * a.infrastructureMaintenanceRate : a.infrastructureMaintenance;
  if (number(infrastructureMaintenance) === null) return null;
  const annuityFactor = a.rate === 0 ? a.horizon : (1 - (1 + a.rate) ** -a.horizon) / a.rate;
  const components = [
    ['body', fleet.totals.busCost, a.bodyLife], ['battery', fleet.totals.batteryCost, a.batteryLife],
    ['points', fleet.infrastructure.points, a.pointLife], ['site', fleet.infrastructure.fixed, a.siteLife],
    ['connection', fleet.infrastructure.power, a.siteLife],
  ].map(([key, cost, life]) => ({ key, life, ...capitalCashFlow(cost, life, a.horizon, a.rate) }));
  const operating = [
    { key: 'electricity', annual: fleet.totals.grid * a.energyPrice },
    { key: 'maintenance', annual: fleet.totals.km * a.maintenancePerKm },
    { key: 'infraMaintenance', annual: infrastructureMaintenance },
    { key: 'heater', annual: dieselHeatingLiters * a.fuelPrice * (1 + a.heaterMaintenanceFactor) },
  ];
  const initial = sum(components.map(c => c.initial));
  const annualOpex = sum(operating.map(c => c.annual));
  const presentValue = sum(components.map(c => c.presentValue)) + annualOpex * annuityFactor;
  return { components, operating, initial, annualOpex, presentValue, annuityFactor,
    annualEquivalent: presentValue / annuityFactor,
    perKm: presentValue / (fleet.totals.km * annuityFactor),
    residual: sum(components.map(c => c.residual)),
    discountedResidual: sum(components.map(c => c.discountedResidual)),
    discountedReplacements: sum(components.map(c => c.discountedReplacements)),
  };
}

/** Same financial horizon, annual mileage and discounting as the electric bus. */
export function computeDieselTco(fleet, a) {
  if (fleet.issues.length || !fleet.count || !(fleet.totals.km > 0) ||
      !Number.isInteger(a.horizon) || a.horizon < 1 || a.horizon > 60 ||
      number(a.rate) === null || a.rate > 1 || !(a.dieselLife >= 1) ||
      ['dieselCapex', 'dieselConsumption', 'dieselMaintenance', 'fuelPrice'].some(k => number(a[k]) === null)) return null;
  const components = [{ key: 'dieselVehicle', life: a.dieselLife,
    ...capitalCashFlow(fleet.count * a.dieselCapex, a.dieselLife, a.horizon, a.rate) }];
  const operating = [
    { key: 'fuel', annual: fleet.totals.km * a.dieselConsumption * a.fuelPrice },
    { key: 'maintenance', annual: fleet.totals.km * a.dieselMaintenance },
  ];
  const annuityFactor = a.rate === 0 ? a.horizon : (1 - (1 + a.rate) ** -a.horizon) / a.rate;
  const annualOpex = sum(operating.map(c => c.annual));
  const presentValue = sum(components.map(c => c.presentValue)) + annualOpex * annuityFactor;
  return { components, operating, initial: components[0].initial, annualOpex, presentValue, annuityFactor,
    annualEquivalent: presentValue / annuityFactor, perKm: presentValue / (fleet.totals.km * annuityFactor),
    discountedResidual: components[0].discountedResidual,
    discountedReplacements: components[0].discountedReplacements };
}

/** End-of-year OPEX, exact replacement times, and terminal residuals: the final
 * point reconciles to TCO NPV. Preserve jumps instead of smoothing replacements. */
export function cumulativeCostComparison(electric, diesel, a) {
  if (!electric || !diesel) return null;
  const designs = { electric, diesel };
  const years = new Set(Array.from({ length: a.horizon }, (_, i) => i + 1));
  Object.values(designs).forEach(d => d.components.forEach(c => c.replacements.forEach(r => years.add(r.year))));
  const totals = { electric: electric.initial, diesel: diesel.initial };
  const points = [{ year: 0, ...totals, event: 'initial' }];
  for (const year of [...years].sort((x, y) => x - y)) {
    for (const [key, design] of Object.entries(designs)) {
      if (Number.isInteger(year)) totals[key] += design.annualOpex / (1 + a.rate) ** year;
      totals[key] += design.components.reduce((s, c) => s + c.replacements.filter(r => Math.abs(r.year - year) < 1e-9).reduce((n, r) => n + r.discounted, 0), 0);
    }
    points.push({ year, ...totals, event: 'cashflow' });
  }
  const beforeResidual = { ...totals };
  for (const [key, design] of Object.entries(designs)) totals[key] -= design.discountedResidual;
  points.push({ year: a.horizon, ...totals, event: 'residual' });
  // Report a sustained annual crossing; a terminal residual-only crossing is
  // identified separately and must not be advertised as operational payback.
  const first = points.findIndex((p, i) => p.electric <= p.diesel && points.slice(i).every(q => q.electric <= q.diesel));
  return { points, breakEven: first < 0 ? null : points[first].year,
    residualOnly: first >= 0 && points[first].event === 'residual' && beforeResidual.electric > beforeResidual.diesel };
}

/** Scope additive LCA quantities to a representative bus without re-averaging
 * intensities. Preserve original upstream evidence in the export. */
export function scopeFleetLca(raw, group) {
  if (!group || raw?.status !== 'complete') return raw;
  const ids = new Set(group.members.map(m => m.id));
  const vehicles = raw.vehicles.filter(v => (v.shift_ids ?? [v.shift_id]).some(id => ids.has(id)));
  // The backend pools identical physical configurations before LCA. If a UI
  // group spans distinct LCA configurations, do not invent a blended vehicle.
  if (vehicles.length !== 1 || vehicles.some(v => (v.shift_ids ?? [v.shift_id]).some(id => !ids.has(id))) ||
      vehicles.reduce((s, v) => s + (v.vehicle_count ?? 1), 0) !== group.count) return null;
  const weighted = fn => vehicles.reduce((s, v) => s + fn(v) * (v.vehicle_count ?? 1), 0) / group.count;
  const indicators = Object.fromEntries(Object.keys(raw.indicators).map(key => {
    const result = { unit: raw.indicators[key].unit };
    for (const field of ['electricity_operation', 'diesel_heating', 'other_lifecycle', 'total', 'diesel_comparator_total'])
      result[field] = weighted(v => v.indicators[key][field]);
    for (const field of ['phases', 'diesel_comparator_phases', 'diesel_heating_phases'])
      result[field] = Object.fromEntries(Object.keys(raw.indicators[key][field]).map(phase => [phase, weighted(v => v.indicators[key][field][phase])]));
    result.saving = result.diesel_comparator_total - result.total;
    return [key, result];
  }));
  const dc = weighted(v => v.dc_kwh), grid = gridFromDc(dc);
  return { ...raw, vehicles: vehicles.map(v => ({ ...v, vehicle_count: 1 })), indicators, annual_km: weighted(v => v.annual_km), vehicle_count: 1,
    display_scope: { kind: 'representative_bus', physical_bus_count: group.count, shift_ids: [...ids], allocation: 1 / group.count },
    energy_boundary: { ...raw.energy_boundary, dc_kwh: dc, grid_kwh: grid, charging_losses_kwh: grid - dc } };
}

/** A mileage scenario changes utilization, never the selected fleet/design. */
export function scaleAnnualFleet(fleet, annualKmByGroup = {}) {
  const groups = fleet.groups.map(group => {
    const target = number(annualKmByGroup[group.id]);
    const factor = target > 0 && group.km > 0 ? target * group.count / group.km : 1;
    const members = group.members.map(row => ({ ...row, km: row.km * factor, dc: row.dc * factor, grid: row.grid * factor }));
    return { ...group, km: group.km * factor, dc: group.dc * factor, members };
  });
  const rows = groups.flatMap(g => g.members);
  return { ...fleet, rows, groups, totals: { ...fleet.totals,
    ...Object.fromEntries(['km', 'dc', 'grid'].map(k => [k, sum(rows.map(r => r[k]))])) } };
}
