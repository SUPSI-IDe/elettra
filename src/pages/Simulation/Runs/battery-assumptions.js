import { t } from '../../../i18n';
import { textContent as esc } from '../../../ui-helpers';
import { formatNumber } from '../../../utils/number-format';
import { resultBatteryPolicy } from '../../../utils/battery-policy';

export function renderBatteryAssumptions(run, shiftId = null) {
  if (!run) return '';
  let policy;
  try { policy = resultBatteryPolicy(run); } catch {
    return `<p class="aggregate-warning">${esc(t('simulation.battery_invalid'))}</p>`;
  }
  const label = key => t(`simulation.battery_${key}`);
  const pct = value => `${formatNumber(value * 100, 2)}%`;
  const entries = Object.entries(run.results?.battery_results ?? {}).filter(([id]) => !shiftId || id === shiftId);
  const capacities = entries.map(([, row]) => row.battery_energy?.nominal_capacity_kwh ?? row.selected_nominal_kwh
    ?? (row.max_physical_packs > 0 ? row.max_physical_kwh / row.max_physical_packs * row.optimized_packs : null));
  const nominal = capacities.length && capacities.every(Number.isFinite) ? capacities.reduce((sum, v) => sum + v, 0) : null;
  const capacity = nominal == null ? '' : `<p data-role="battery-capacity-summary">${esc(label('nominal'))}: <strong>${formatNumber(nominal)} kWh</strong> · ${esc(label('residual'))}: <strong>${formatNumber(nominal * policy.state_of_health)} kWh</strong> · ${esc(label('usable'))}: <strong>${formatNumber(nominal * policy.usable_fraction_initial)} kWh</strong></p>`;
  return `<section class="battery-assumptions result-card" data-role="battery-assumptions">
    <header class="result-card__header"><h3 class="result-card__title">SOH <span data-role="result-soh">${pct(policy.state_of_health)}</span> · ${esc(label(policy.battery_soc_policy))}</h3></header>
    <div class="result-card__body">${capacity}
      <p>${esc(label('effective_window'))}: <strong data-role="effective-soc-window">${pct(policy.min_soc)}–${pct(policy.max_soc)}</strong>. ${esc(label('soh_basis'))}</p>
      ${policy.battery_soc_policy === 'constant_initial_usable' ? `<p>${esc(label('reference_window'))}: ${pct(policy.reference_min_soc)}–${pct(policy.reference_max_soc)} · ${esc(label('allowed_min'))}: ${pct(policy.allowed_min_soc)} · ${esc(label('allowed_max'))}: ${pct(policy.allowed_max_soc)}</p>${policy.preferred_max_soc_exceeded ? `<p>${esc(label('raised_max'))}</p>` : ''}` : ''}
      <p>${esc(label('technical'))}: <strong>${formatNumber(policy.session_connection_minutes)} min</strong> · ${esc(label('reduction'))}: <strong>${formatNumber(policy.layover_reduction_minutes)} min</strong></p>
      ${policy.low_soc_warning ? `<p class="aggregate-warning" data-role="result-low-soc-warning" role="status">${esc(label('low_warning'))}</p>` : ''}
      <details><summary>${esc(t('simulation.efficiency_operating_conditions'))}</summary><p>${esc(label('connection_help'))}</p><p>${esc(label('layover_help'))}</p><p>${esc(label('limits_help'))}</p></details>
    </div></section>`;
}
