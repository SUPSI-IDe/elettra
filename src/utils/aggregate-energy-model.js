import { resultBatteryPolicy } from './battery-policy.js';
export function aggregateEnergyModel(run, shiftId) {
  const results = run?.results ?? {};
  const input = run?.input_params ?? {};
  const battery = results.battery_results?.[shiftId] ?? {};
  const analysis = results.consumption_analysis;
  const detail = analysis?.per_shift?.[shiftId];
  const available = analysis?.status === "available" && detail?.status === "available";
  const selected = detail?.selected_packs ?? battery.optimized_packs;
  const maximum = detail?.max_packs ?? battery.max_physical_packs;
  const packKwh = detail?.pack_size_kwh ?? (battery.max_physical_kwh / maximum);
  const nominal = Number.isFinite(packKwh * selected) ? packKwh * selected : null;
  const policy = resultBatteryPolicy(run);
  const minSoc = detail?.min_soc ?? policy.min_soc;
  const maxSoc = detail?.max_soc ?? policy.max_soc;
  const soh = detail?.state_of_health ?? policy.state_of_health;
  const usable = battery.battery_energy?.usable_capacity_kwh ?? (nominal === null ? null : nominal * soh * (maxSoc-minSoc));
  const basis = input.consumption_basis ?? ((input.quantile_consumption ?? "mean") === "mean" ? "mean" : "legacy");
  const excess = battery.excess_packs ?? 0;
  const diagnosticTotal = battery.required_total_packs ?? selected + excess;
  const unavailablePacks = Math.max(0, diagnosticTotal - maximum);
  const paired = Boolean(input.basis_run_ids?.mean && input.basis_run_ids?.aggregate_q95);
  return { available, selected, maximum, packKwh, nominal, usable, minSoc, maxSoc, soh, basis,
    excess, diagnosticTotal, unavailablePacks, detail, paired,
    verified: results.forecast_verification?.status === "verified",
    physicalExceeded: unavailablePacks > 0,
    cases: available ? (paired ? { [basis]: detail.cases[basis] } : detail.cases) : null };
}
