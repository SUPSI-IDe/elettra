import { formatNumber } from "../../../utils/number-format";
import { t } from "../../../i18n";
import { textContent as esc } from "../../../ui-helpers";
import { renderAggregateEnergy } from "./aggregate-energy";

const label = (key, values) => t(`simulation.infeasibility_${key}`, values);
const number = value => value === null ? '—' : formatNumber(value, 0);

function diagnosticBatteryNote(model, row) {
  if (row?.source === 'diagnostic' && model.diagnosticVerified) return t('simulation.diagnostic_verified');
  if (row?.battery.physical_feasible === true && !row.batteryCritical) return label('no_shortfall_note');
  return row?.source === 'diagnostic' ? t('simulation.diagnostic_unverified') : label('result_estimate');
}

export function renderInfeasibilityContext(model, shiftId = null) {
  const rows = model.rows.filter(row => !shiftId || row.shiftId === shiftId);
  const sources = new Set(rows.map(row => row.source));
  const reasons = model.reasons.filter(reason => !shiftId ||
    (!reason.shift_id && !reason.shift_ids) || reason.shift_id === shiftId || reason.shift_ids?.includes(shiftId));
  const batteryReasons = reasons.filter(reason => ['battery_limit', 'fixed_battery'].includes(reason.code));
  const reasonHtml = (!shiftId && batteryReasons.length
    ? `<p class="aggregate-warning" data-reason="battery_shortfall">${esc(label('battery_shortfall'))}</p>` : '') +
    reasons.filter(reason => shiftId || !batteryReasons.includes(reason)).map(reason => {
    const values = Object.fromEntries(Object.entries(reason).map(([key, value]) =>
      [key, typeof value === 'number' ? formatNumber(value) : value]));
    return `<p class="aggregate-warning" data-reason="${esc(reason.code)}">${esc(t(`simulation.diagnostic_${reason.code}`, values))}</p>`;
  }).join('');
  const notes = [
    sources.has('result') && rows.some(row => row.batteryCritical)
      ? `<p data-source="result">${esc(label('result_estimate'))}</p>` : '',
    sources.has('diagnostic') || (!shiftId && model.diagnosticAvailable)
      ? `<p data-source="diagnostic">${esc(t('simulation.diagnostic_scope'))}</p>
        ${shiftId && rows[0]?.battery.physical_feasible === true && !rows[0].batteryCritical && !model.diagnosticVerified
          ? '' : `<p>${esc(shiftId ? diagnosticBatteryNote(model, rows[0]) : t(model.diagnosticVerified ? 'simulation.diagnostic_verified' : 'simulation.diagnostic_unverified'))}</p>`}` : '',
  ].join('');
  const depotIdentified = reasons.some(reason => reason.code.startsWith('depot_'));
  return `<section class="infeasibility-context" data-role="infeasibility-context">
    <h4 class="efficiency-section-title">${esc(label('causes'))}</h4>
    ${reasonHtml || `<p>${esc(shiftId && rows[0]?.battery.physical_feasible === true && !rows[0].batteryCritical
      ? label('no_shortfall_status') : t(shiftId && model.reasons.length ? 'simulation.diagnostic_other_block' : 'simulation.diagnostic_unknown'))}</p>`}
    ${notes ? `<div class="helper-text" data-role="infeasibility-estimate-scope">${notes}</div>` : ''}
    ${model.dailyCycle ? `<p data-role="infeasibility-next-departure" data-status="${depotIdentified ? 'identified' : 'unverified'}"><strong>${esc(label('next_departure'))}:</strong> ${esc(label(depotIdentified ? 'depot_identified' : 'depot_unverified'))}</p>` : ''}
  </section>`;
}

export function renderInfeasibilitySummary(model) {
  const rows = model.rows.filter(row => row.critical);
  return `${renderInfeasibilityContext(model)}
    <section data-role="feasibility-critical-shifts">
      <h4 class="efficiency-section-title">${esc(t('simulation.feasibility_critical_shifts'))}</h4>
      <p>${esc(rows.length ? label('critical_intro') : t('simulation.feasibility_critical_shifts_unavailable'))}</p>
      ${rows.length ? `<div class="efficiency-table-wrap"><table class="efficiency-table infeasibility-table">
        <thead><tr><th>${esc(t('simulation.opt_col_shift'))}</th>
          <th>${esc(t('simulation.opt_col_selected_packs'))}</th>
          <th>${esc(t('simulation.opt_col_max_packs'))}</th>
          <th>${esc(t('simulation.feasibility_estimated_required_packs'))}</th>
          <th>${esc(label('missing_packs'))}</th></tr></thead>
        <tbody>${rows.map(row => `<tr data-shift-id="${esc(row.shiftId)}" data-source="${esc(row.source ?? 'unavailable')}">
          <th scope="row"><button type="button" class="infeasibility-shift-link" data-infeasibility-shift="${esc(row.shiftId)}">${esc(row.shiftName)}</button></th>
          <td class="efficiency-td-num">${number(row.selected)}</td>
          <td class="efficiency-td-num">${number(row.maximum)}</td>
          <td class="efficiency-td-num${row.exceeded > 0 ? ' infeasibility-pack-limit' : ''}"${row.exceeded > 0 ? ` title="${esc(label('beyond_maximum', { count: number(row.exceeded) }))}"` : ''}>${number(row.required)}</td>
          <td class="efficiency-td-num">${row.missing === null ? '—' : row.missing > 0 ? `+${number(row.missing)}` : '0'}</td>
        </tr>`).join('')}</tbody></table></div>
        <p class="helper-text">${esc(label('table_help'))}</p>` : ''}
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
  const results = row.source === 'diagnostic' ? run.results.infeasibility_diagnostics : run.results;
  return renderAggregateEnergy({ ...run, results: { ...results,
    ...(row.batteryCritical ? { consumption_analysis: { status: 'unverified' } } : {}),
    battery_results: { [shiftId]: { ...row.battery, shift_name: row.shiftName,
      max_physical_kwh: Number(row.battery.max_physical_kwh) > 0
        ? row.battery.max_physical_kwh : row.maximum * row.battery.pack_size_kwh,
    } },
  } }, shiftId, { diagnostic: true, energyComparison,
    title: t('simulation.aggregate_title'), unavailableMessage: row.batteryCritical
      ? t('simulation.aggregate_not_verified') : diagnosticBatteryNote(model, row),
  });
}
