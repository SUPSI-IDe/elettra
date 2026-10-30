import { t } from '../../../i18n';
import { textContent } from '../../../ui-helpers';
import { formatChf } from '../../../utils/number-format';

export const COST_DEFAULTS = {
  depot: {point_cost_chf:110000, site_fixed_cost_chf:250000, connection_cost_per_kw_chf:250},
  pantograph: {point_cost_chf:430000, site_fixed_cost_chf:320000, connection_cost_per_kw_chf:320},
};
export const defaultCostModel = type => ({...COST_DEFAULTS[type], station_type:type,
  ac_dc_efficiency:0.95, source:'infras2026-calibrated-v1'});
export const costTotal = (model, slots, dcPower) => slots > 0
  ? slots * model.point_cost_chf + model.site_fixed_cost_chf + dcPower / model.ac_dc_efficiency * model.connection_cost_per_kw_chf : 0;

const fields = [
  ['point_cost_chf', 'cost_point', 1],
  ['site_fixed_cost_chf', 'cost_fixed', 1],
  ['connection_cost_per_kw_chf', 'cost_power', 1],
];
export const readCostModel = card => {
  const model = JSON.parse(card.dataset.model);
  for (const [key,,scale] of fields) {
    const raw = card.querySelector(`[data-cost-field="${key}"]`).value.trim();
    model[key] = raw === '' ? NaN : Number(raw) * scale;
  }
  if (fields.some(([key])=>model[key] !== JSON.parse(card.dataset.model)[key])) model.source='custom';
  return model;
};
export function renderCostCards(container, stops, stored = new Map()) {
  container.innerHTML = stops.map(stop => {
    const type=stop.isDepot ? 'depot' : 'pantograph';
    const model=stored.get(stop.stop_id)?.cost_model ?? defaultCostModel(type);
    return `<div class="station-cost-card" data-cost-stop-id="${textContent(stop.stop_id)}" data-model="${textContent(JSON.stringify(model))}">
      <strong>${textContent(stop.stop_name)} <span class="helper-text">· ${textContent(t('simulation.cost_type_'+model.station_type))}</span></strong>
      <div class="station-cost-fields">${fields.map(([key,label,scale])=>`<label>${textContent(t('simulation.'+label))}
        <input type="number" min="0" step="any" data-cost-field="${key}" value="${model[key]/scale}" /></label>`).join('')}</div>
      <p class="helper-text" data-role="station-cost-total"></p>
    </div>`;
  }).join('');
}
export function syncCostCards(container, tbody) {
  for (const card of container.querySelectorAll('[data-cost-stop-id]')) {
    const row=[...tbody.querySelectorAll('[data-stop-id]')].find(row=>row.dataset.stopId===card.dataset.costStopId);
    card.hidden=!row?.querySelector('input[type="checkbox"]')?.checked;
    if (!row) continue;
    const n=Number(row.querySelector('[data-field="num_slots"]').value);
    const p=Number(row.querySelector('[data-field="max_total_power_kw"]').value);
    card.querySelector('[data-role="station-cost-total"]').textContent = `${t('simulation.cost_configured_total')}: ${formatChf(costTotal(readCostModel(card),n,p))}`;
  }
}

export function infrastructureCostHtml(stations, feasible) {
  const rows=stations.filter(s=>s.selected && s.costBreakdown);
  if (!feasible || !rows.length) return '';
  const value = formatChf;
  const key=k=>textContent(t('simulation.'+k));
  const totals=rows.reduce((a,s)=>{for(const k of Object.keys(a))a[k]+=s.costBreakdown[k];return a;},
    {chargers_cost_chf:0,site_fixed_cost_chf:0,site_power_cost_chf:0,total_cost_chf:0});
  return `<details class="infrastructure-cost-breakdown" open><summary>${key('cost_breakdown')}</summary>
    <p class="helper-text">${key('cost_result_help')}</p>
    <div class="table-scroll"><table class="table-standard"><thead><tr><th>${key('cs_stop_name')}</th><th>${key('cost_type')}</th>
      <th>${key('cost_chargers')}</th><th>${key('cost_fixed_total')}</th><th>${key('cost_power_total')}</th><th>${key('cost_total')}</th></tr></thead>
      <tbody>${rows.map(s=>{const b=s.costBreakdown;return `<tr><td>${textContent(s.stopName)}</td><td>${key('cost_type_'+b.station_type)}</td><td>${value(b.chargers_cost_chf)}</td><td>${value(b.site_fixed_cost_chf)}</td><td>${value(b.site_power_cost_chf)}</td><td>${value(b.total_cost_chf)}</td></tr>`;}).join('')}</tbody>
      <tfoot><tr><th colspan="2">${key('cost_total')}</th>${Object.values(totals).map(v=>`<td>${value(v)}</td>`).join('')}</tr></tfoot></table></div>
    <details><summary>${key('cost_method')}</summary><p class="helper-text">${key('cost_formula_help')}</p><p class="helper-text">${key('cost_source_help')}</p></details>
  </details>`;
}
