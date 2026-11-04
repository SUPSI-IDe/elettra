import { formatNumber } from "../../../utils/number-format";
import { t } from '../../../i18n';
import { textContent as esc } from '../../../ui-helpers';

const label = key => esc(t(`simulation.depot_${key}`));
const num = formatNumber;
const clock = minute => `${String(Math.floor(minute/60)%24).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}${minute>=1440?` +${Math.floor(minute/1440)}`:''}`;

export function renderDepotCycle(run, shiftId = null) {
  const cycle = run.results?.daily_cycle;
  if (!run.input_params?.daily_cycle) return '';
  const verified = run.results?.forecast_verification?.status === 'verified' && cycle?.status === 'verified';
  if (!verified) return `<section class="result-card" data-role="depot-cycle"><div class="result-card__body"><h3 class="result-card__title">${label('title')}</h3><p class="result-card__note">${label('unverified')}</p></div></section>`;
  const peak = cycle.peak_shaving?.status === 'optimized';
  const header = `<header class="result-card__header"><h3 class="result-card__title">${label('title')}</h3></header>`;
  const metric = (title,value) => `<div><strong>${value}</strong><span>${title}</span></div>`;
  if (shiftId) {
    const row = cycle.per_shift?.[shiftId];
    if (!row) return '';
    const periods = row.charging_intervals ?? [];
    return `<section class="result-card" data-role="depot-cycle">${header}<div class="result-card__body">
      <p class="result-card__note"><strong>${label(row.ready?'ready':'unverified')}</strong> · ${clock(row.next_departure_minute)} · ${num(row.departure_soc_kwh)} / ${num(row.target_soc_kwh)} kWh</p>
      <p class="result-card__note">${esc(row.depot_name)} · ${label('plug')} ${row.slot_number ?? '—'} · ${clock(row.depot_arrival_minute)} – ${clock(row.next_departure_minute)}</p>
      <div class="result-kpis">${metric(label('during'),`${num(row.during_shift_kwh)} kWh`)}${metric(label('outside'),`${num(row.outside_shift_kwh)} kWh`)}${metric(label('total'),`${num(row.total_charged_kwh)} kWh`)}</div>
      <p class="result-card__note">${label('occupancy_help')}</p>
      <details class="result-disclosure"><summary>${label('schedule')}</summary><div class="efficiency-table-wrap"><table class="table-standard depot-cycle-table"><thead><tr><th>${label('interval')}</th><th>kW DC</th><th>kWh</th></tr></thead><tbody>${periods.map(p=>`<tr><td>${clock(p.start_minute)} – ${clock(p.end_minute)}</td><td>${num(p.power_kw_dc)}</td><td>${num(p.energy_kwh)}</td></tr>`).join('')}</tbody></table></div></details>
    </div></section>`;
  }
  const rows = Object.values(cycle.per_shift ?? {});
  const sum = key => rows.reduce((total,row)=>total+(row[key]??0),0);
  return `<section class="result-card" data-role="depot-cycle">${header}<div class="result-card__body">
    <p class="result-card__note"><strong>${rows.filter(row=>row.ready).length} / ${rows.length} ${label('buses_ready')}</strong> · ${label('repeat_help')}</p>
    <div class="result-kpis">${metric(label('during'),`${num(sum('during_shift_kwh'))} kWh`)}${metric(label('outside'),`${num(sum('outside_shift_kwh'))} kWh`)}${metric(label('total'),`${num(sum('total_charged_kwh'))} kWh`)}</div>
    <div class="efficiency-table-wrap"><table class="table-standard depot-cycle-table"><thead><tr><th>${label('location')}</th><th>${label('during')} (kWh)</th><th>${label('outside')} (kWh)</th><th>${label('total')} (kWh)</th><th>${label('site_power')}</th></tr></thead><tbody>${Object.values(cycle.stations??{}).map(site=>`<tr><td>${esc(site.stop_name)}</td><td>${num(site.during_shift_kwh)}</td><td>${num(site.outside_shift_kwh)}</td><td>${num(site.total_charged_kwh)}</td><td>${num(site.available_power_kw_dc)}</td></tr>`).join('')}</tbody></table></div>
    ${peak ? `<details class="result-disclosure" data-role="depot-peak-shaving"><summary>${label('peak_result')}</summary><p class="result-card__note">${label('peak_help')}</p><p class="result-card__note">${label('peak_baseline')}</p><div class="efficiency-table-wrap"><table class="table-standard depot-cycle-table"><thead><tr><th>${label('location')}</th><th>${label('before')} (kW DC)</th><th>${label('after')} (kW DC)</th></tr></thead><tbody>${Object.values(cycle.stations??{}).filter(site=>site.is_depot).map(site=>`<tr><td>${esc(site.stop_name)}</td><td>${num(site.previous_plan_peak_kw_dc)}</td><td>${num(site.simulated_peak_kw_dc)}</td></tr>`).join('')}</tbody></table></div></details>` : run.input_params.depot_peak_shaving ? `<p class="result-card__note">${label('peak_unavailable')}</p>` : ''}
  </div></section>`;
}
