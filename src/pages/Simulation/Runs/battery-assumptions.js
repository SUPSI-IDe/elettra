import { t } from '../../../i18n';
import { textContent as esc } from '../../../ui-helpers';
import { formatNumber } from '../../../utils/number-format';
import { resultBatteryPolicy } from '../../../utils/battery-policy';

export function renderBatteryAssumptions(run, shiftId = null, { open = null } = {}) {
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
  const capacity = nominal == null ? '' : `<div class="battery-assumptions__values" data-role="battery-capacity-summary">
      <p>${esc(label('nominal'))}: ${formatNumber(nominal)} kWh</p>
      <p>${esc(label('residual'))}: ${formatNumber(nominal * policy.state_of_health)} kWh</p>
      <p>${esc(label('usable'))}: ${formatNumber(nominal * policy.usable_fraction_initial)} kWh</p>
    </div>`;
  const batteryOpen = open === true || open === 'battery-assumptions';
  const technicalTimesOpen = open === 'technical-times-assumptions';
  return `<details class="battery-assumptions results-information-disclosure" data-role="battery-assumptions"${batteryOpen ? ' open' : ''}>
    <summary class="battery-assumptions__toggle results-information-toggle">
      <strong class="battery-assumptions__title">SOH <span data-role="result-soh">${pct(policy.state_of_health)}</span> · ${esc(label(policy.battery_soc_policy))}</strong>
    </summary>
    <div class="battery-assumptions__body results-information-content">${capacity}
      <p>${esc(label('effective_window'))}: <span data-role="effective-soc-window">${pct(policy.min_soc)}–${pct(policy.max_soc)}</span></p>
      <p>${esc(label('soh_basis'))}</p>
      ${policy.battery_soc_policy === 'constant_initial_usable' ? `<p>${esc(label('reference_window'))}: ${pct(policy.reference_min_soc)}–${pct(policy.reference_max_soc)}</p><p>${esc(label('allowed_min'))}: ${pct(policy.allowed_min_soc)}</p><p>${esc(label('allowed_max'))}: ${pct(policy.allowed_max_soc)}</p>${policy.preferred_max_soc_exceeded ? `<p>${esc(label('raised_max'))}</p>` : ''}` : ''}
      ${policy.low_soc_warning ? `<p class="aggregate-warning" data-role="result-low-soc-warning" role="status">${esc(label('low_warning'))}</p>` : ''}
      <details><summary class="results-information-content-title"><strong>${esc(t('simulation.efficiency_operating_conditions'))}</strong></summary><p data-role="battery-limits-help">${esc(label('limits_help'))}</p></details>
    </div></details>
    <details class="technical-times-assumptions results-information-disclosure" data-role="technical-times-assumptions"${technicalTimesOpen ? ' open' : ''}>
      <summary class="technical-times-assumptions__toggle results-information-toggle">
        <strong class="technical-times-assumptions__title">${esc(label('technical_times'))}</strong>
      </summary>
      <div class="technical-times-assumptions__body results-information-content">
        <p>${esc(label('technical'))}: <strong>${formatNumber(policy.session_connection_minutes)} min</strong> · ${esc(label('reduction'))}: <strong>${formatNumber(policy.layover_reduction_minutes)} min</strong></p>
        <p class="results-information-content-title" data-role="technical-times-operating-conditions"><strong>${esc(t('simulation.efficiency_operating_conditions'))}</strong></p>
        <p data-role="battery-connection-help">${esc(label('connection_help'))}</p>
        <p data-role="battery-layover-help">${esc(label('layover_help'))}</p>
      </div>
    </details>`;
}
