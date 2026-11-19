// Presentation only: relaxed diagnostics never replace the saved design,
// feasibility verdict, infrastructure or investment values.
import { hasFeasibilityEvaluationFailure } from './feasibility-result-model.js';

const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const number = value => !['string', 'number'].includes(typeof value) || (typeof value === 'string' && !value.trim())
  ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;

export const INFEASIBILITY_REASON_FIELDS = Object.freeze({
  battery_limit: ['shift_name', 'required_packs', 'available_packs'],
  fixed_battery: ['shift_name', 'required_packs', 'available_packs'],
  depot_power: ['stop_name', 'shift_name', 'required_recharge_kwh', 'maximum_recharge_kwh',
    'minimum_shortfall_kwh', 'available_power_kw_dc', 'minimum_average_power_kw_dc'],
  depot_no_plug: ['stop_name', 'shift_name', 'required_recharge_kwh'],
  depot_time: ['stop_name', 'shift_name', 'required_recharge_kwh'],
  depot_plugs: ['stop_name', 'required_plugs', 'available_plugs'],
  depot_constraints: [],
});

// A scoped, transient view of the diagnostic data. Keep the parent verdict
// and saved run untouched; never promote a daytime diagnostic to a full design.
export function infeasibilityDetailRun(run, row) {
  if (row?.source === 'result') return run;
  const diagnostic = row?.source === 'diagnostic' ? record(run.results?.infeasibility_diagnostics) : {};
  return { ...run, results: { ...run.results,
    battery_results: row?.source ? { [row.shiftId]: { ...row.battery, shift_name: row.shiftName } } : {},
    electrification_summary: { ...record(run.results?.electrification_summary),
      status: run.results?.electrification_summary?.status ?? 'infeasible',
      infeasible_buses: row?.batteryCritical ? [{ ...row.battery,
        shift_id: row.shiftId, shift_name: row.shiftName,
      }] : [],
    },
    per_bus_summary: Array.isArray(diagnostic.per_bus_summary) ? diagnostic.per_bus_summary : [],
    consumption_analysis: diagnostic.consumption_analysis ?? { status: 'unavailable' },
    daily_cycle: {}, charging_schedule_policy: {},
  } };
}

export function buildInfeasibilityPresentation(run = {}, { shiftNamesById = {} } = {}) {
  const results = record(run.results);
  const verification = results.forecast_verification?.status;
  const active = results.electrification_feasible !== true &&
    !hasFeasibilityEvaluationFailure(run) && !['pending', 'running'].includes(run.status) &&
    (!verification || ['verified', 'physical_limits_exceeded', 'infeasible'].includes(verification)) &&
    (results.electrification_feasible === false || results.solver_status === 'infeasible' ||
      ['physical_limits_exceeded', 'infeasible'].includes(verification));
  if (!active) return { active: false, rows: [], reasons: [], sources: [] };

  const diagnostic = record(results.infeasibility_diagnostics);
  const diagnosticVerification = diagnostic.forecast_verification?.status;
  const diagnosticAvailable = diagnostic.status === 'available' && (!diagnosticVerification ||
    ['verified', 'physical_limits_exceeded'].includes(diagnosticVerification));
  const main = record(results.battery_results);
  const hasMain = id => Object.keys(record(main[id])).length > 0;
  const relaxed = diagnosticAvailable ? record(diagnostic.battery_results) : {};
  const nameFor = (id, fallback) => text(shiftNamesById instanceof Map
    ? shiftNamesById.get(id) : record(shiftNamesById)[id]) ?? text(fallback) ?? id;
  const reasons = diagnosticAvailable && Array.isArray(diagnostic.reasons)
    ? diagnostic.reasons.filter(reason => reason && Object.hasOwn(INFEASIBILITY_REASON_FIELDS, reason.code))
      .map(reason => ({ ...reason,
        ...(reason.shift_ids ? { shift_ids: Array.isArray(reason.shift_ids)
          ? reason.shift_ids.filter(id => typeof id === 'string' && !hasMain(id)) : [] } : {}),
        ...(reason.shift_id ? {
          shift_name: nameFor(reason.shift_id, reason.shift_name),
      } : {}) }))
      // A relaxed diagnosis must not explain the counts of another saved design.
      .filter(reason => (!reason.shift_id || !hasMain(reason.shift_id)) &&
        (!reason.shift_ids || reason.shift_ids.length > 0))
      .filter(reason => INFEASIBILITY_REASON_FIELDS[reason.code].every(key =>
        key.endsWith('_name') ? text(reason[key]) : number(reason[key]) !== null))
    : [];
  const reasonShiftIds = reasons.flatMap(reason => reason.shift_id
    ? [reason.shift_id] : Array.isArray(reason.shift_ids) ? reason.shift_ids : []);
  const requestedIds = Array.isArray(run.input_params?.shift_ids) ? run.input_params.shift_ids : [];
  const ids = [...new Set([...requestedIds, ...Object.keys(main),
    ...Object.keys(relaxed), ...reasonShiftIds])];
  const rows = ids.filter(id => typeof id === 'string').map(shiftId => {
    // Do not combine fields from different designs to fill holes in a row.
    const source = Object.keys(record(main[shiftId])).length ? 'result'
      : Object.keys(record(relaxed[shiftId])).length ? 'diagnostic' : null;
    const battery = record(source === 'result' ? main[shiftId] : relaxed[shiftId]);
    const selected = number(battery.optimized_packs);
    const required = number(battery.required_total_packs);
    const maximum = number(battery.max_physical_packs);
    const missing = selected !== null && required !== null ? Math.max(0, required - selected) : null;
    const exceeded = maximum !== null && required !== null ? Math.max(0, required - maximum) : null;
    const batteryCritical = battery.physical_feasible === false ||
      String(battery.feasibility_status ?? '').startsWith('infeasible') ||
      number(battery.excess_packs) > 0 || missing > 0 || exceeded > 0;
    const shiftReasons = reasons.filter(reason => reason.shift_id === shiftId || reason.shift_ids?.includes(shiftId));
    return { shiftId, shiftName: nameFor(shiftId, battery.shift_name ?? shiftReasons[0]?.shift_name),
      source, battery, selected, required, maximum, missing, exceeded, batteryCritical,
      critical: batteryCritical || shiftReasons.length > 0, reasons: shiftReasons };
  });
  for (const row of rows.filter(row => row.batteryCritical)) {
    const available = row.exceeded > 0 ? row.maximum : row.selected;
    if (row.required === null || available === null || row.required <= available ||
        row.reasons.some(reason => ['battery_limit', 'fixed_battery'].includes(reason.code))) continue;
    const reason = { code: row.exceeded > 0 ? 'battery_limit' : 'fixed_battery',
      shift_id: row.shiftId, shift_name: row.shiftName, required_packs: row.required,
      available_packs: row.exceeded > 0 ? row.maximum : row.selected };
    reasons.push(reason);
    row.reasons.push(reason);
  }
  return { active: true, rows, reasons,
    sources: [...new Set(rows.filter(row => row.critical).map(row => row.source).filter(Boolean))],
    diagnosticAvailable, diagnosticVerified: diagnostic.forecast_verification?.status === 'verified',
    dailyCycle: run.input_params?.daily_cycle === true,
  };
}
