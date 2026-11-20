import { formatNumber } from "../../../utils/number-format";
import { t } from "../../../i18n";
import { textContent as esc } from "../../../ui-helpers";
import { renderAggregateEnergy } from "./aggregate-energy";

const label = (key, values) => t(`simulation.infeasibility_${key}`, values);
const number = value => value === null ? '—' : formatNumber(value, 0);

// All diagnostic help uses the delegated, keyboard/touch-accessible tooltip binder.
export function renderInfeasibilityInfo(id, title, content, attributes = '') {
  return `<button type="button" class="info-icon infeasibility-info" aria-label="${esc(title)}" aria-describedby="${esc(id)}" aria-expanded="false">i<span id="${esc(id)}" class="info-tooltip" role="tooltip" hidden ${attributes}>${content}</span></button>`;
}

export function renderInfeasibilityContext(model, shiftId = null) {
  const row = model.rows.find(row => row.shiftId === shiftId);
  const reasons = model.reasons.filter(reason => !shiftId ||
    (!reason.shift_id && !reason.shift_ids) || reason.shift_id === shiftId || reason.shift_ids?.includes(shiftId));
  // Battery numbers are already visible in the table/graphic. Keep depot
  // resource details in help, including separate constraints at different stops.
  const batteryCodes = [...new Set(reasons.filter(reason => !reason.code.startsWith('depot_')).map(reason => reason.code))];
  const batteryHelp = batteryCodes.map(code => `<span class="infeasibility-help-line" data-reason="${esc(code)}">${esc(label(`help_${code}`))}</span>`).join('');
  const depotReasons = reasons.filter(reason => reason.code.startsWith('depot_'));
  const depotHelp = depotReasons.map(reason => {
    const values = Object.fromEntries(Object.entries(reason).map(([key, value]) =>
      [key, typeof value === 'number' ? formatNumber(value) : value]));
    return `<span class="infeasibility-help-line" data-reason="${esc(reason.code)}">${esc(t(`simulation.diagnostic_${reason.code}`, values))}</span>`;
  }).join('');
  const reasonHtml = batteryHelp + depotHelp;
  const depotIdentified = depotReasons.length > 0;
  const fallback = row?.battery.physical_feasible === true && !row.batteryCritical
    ? label('no_shortfall_note') : t(shiftId && model.reasons.length ? 'simulation.diagnostic_other_block' : 'simulation.diagnostic_unknown');
  return renderInfeasibilityInfo(`infeasibility-context-${shiftId ?? 'general'}`, label('causes'),
    `${row ? `<strong>${esc(row.shiftName)}</strong>` : ''}${reasonHtml || `<span class="infeasibility-help-line">${esc(fallback)}</span>`}
    ${model.dailyCycle && !depotIdentified ? `<span class="infeasibility-help-line" data-role="infeasibility-next-departure" data-status="unverified">${esc(label('help_unverified_cycle'))}</span>` : ''}`,
    `data-role="infeasibility-context"${depotIdentified && model.dailyCycle ? ' data-cycle-status="identified"' : ''}`);
}

export function renderInfeasibilitySummary(model) {
  const rows = model.rows.filter(row => row.critical);
  return `<section data-role="feasibility-critical-shifts">
      <h4 class="efficiency-section-title">${esc(t('simulation.feasibility_critical_shifts'))}</h4>
      ${rows.length ? '' : `<p>${esc(t('simulation.feasibility_critical_shifts_unavailable'))}</p>`}
      ${rows.length ? `<div class="efficiency-table-wrap"><table class="efficiency-table infeasibility-table">
        <thead><tr><th>${esc(t('simulation.opt_col_shift'))}</th>
          <th>${esc(t('simulation.opt_col_selected_packs'))}</th>
          <th>${esc(t('simulation.opt_col_max_packs'))}</th>
          <th>${esc(t('simulation.feasibility_estimated_required_packs'))} ${renderInfeasibilityInfo('infeasibility-required-help', t('simulation.feasibility_estimated_required_packs'), esc(label('help_required')))}</th>
          <th>${esc(label('missing_packs'))} ${renderInfeasibilityInfo('infeasibility-missing-help', label('missing_packs'), esc(label('help_missing')))}</th></tr></thead>
        <tbody>${rows.map(row => `<tr data-shift-id="${esc(row.shiftId)}" data-source="${esc(row.source ?? 'unavailable')}">
          <th scope="row"><button type="button" class="infeasibility-shift-link" data-infeasibility-shift="${esc(row.shiftId)}">${esc(row.shiftName)}</button></th>
          <td class="efficiency-td-num">${number(row.selected)}</td>
          <td class="efficiency-td-num">${number(row.maximum)}</td>
          <td class="efficiency-td-num${row.exceeded > 0 ? ' infeasibility-pack-limit' : ''}"${row.exceeded > 0 ? ` title="${esc(label('beyond_maximum', { count: number(row.exceeded) }))}"` : ''}>${number(row.required)}</td>
          <td class="efficiency-td-num">${row.missing === null ? '—' : row.missing > 0 ? `+${number(row.missing)}` : '0'}</td>
        </tr>`).join('')}</tbody></table></div>` : ''}
    </section>`;
}

export function renderInfeasibilityBattery(run, model, shiftId, energyComparison = null) {
  const row = model.rows.find(row => row.shiftId === shiftId);
  // Rendering a partial historical record would turn null into 0/NaN kWh.
  if (!row?.source || row.selected === null || !(row.maximum > 0) ||
      !(Number(row.battery.pack_size_kwh) > 0 || Number(row.battery.max_physical_kwh) > 0)) {
    return `<section class="result-card" data-role="infeasibility-battery-unavailable">
      <header class="result-card__header"><h3 class="result-card__title">${esc(t('simulation.aggregate_title'))}</h3></header>
      <div class="result-card__body"><p>${esc(label('battery_unavailable'))}</p></div></section>`;
  }
  const batteryHelp = label(row.batteryCritical ? 'help_battery_estimate'
    : model.diagnosticVerified && row.source === 'diagnostic' ? 'help_battery_verified' : 'no_shortfall_note');
  const results = row.source === 'diagnostic' ? run.results.infeasibility_diagnostics : run.results;
  return renderAggregateEnergy({ ...run, results: { ...results,
    ...(row.batteryCritical ? { consumption_analysis: { status: 'unverified' } } : {}),
    battery_results: { [shiftId]: { ...row.battery, shift_name: row.shiftName,
      max_physical_kwh: Number(row.battery.max_physical_kwh) > 0
        ? row.battery.max_physical_kwh : row.maximum * row.battery.pack_size_kwh,
    } },
  } }, shiftId, { diagnostic: true, energyComparison,
    title: t('simulation.aggregate_title'),
    diagnosticHelpHtml: {
      estimate: renderInfeasibilityInfo(`infeasibility-battery-estimate-${shiftId}`, t('simulation.aggregate_title'), esc(batteryHelp)),
      legend: renderInfeasibilityInfo(`infeasibility-battery-legend-${shiftId}`, t('simulation.aggregate_packs'), esc(t('simulation.aggregate_pack_legend'))),
    },
  });
}
