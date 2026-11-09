import { authHeaders, API_ROOT } from '../../../api/client.js';
import { t } from '../../../i18n/index.js';
import { textContent } from '../../../ui-helpers.js';
import { summarizeHvacAssumptions } from '../../../utils/hvac-assumptions.js';
import './hvac-assumptions.css';

export const mountHvacAssumptions = async (section, id, kind = 'optimization') => {
  const panel = section.querySelector('[data-role="hvac-assumptions"]');
  if (!panel || !id) return;
  const path = kind === 'yearly' ? `yearly-analysis/${encodeURIComponent(id)}`
    : `simulation/optimization-runs/${encodeURIComponent(id)}`;
  const url = `${API_ROOT}/api/v1/${path}/auxiliary-assumptions`;
  const generation = Symbol();
  panel.hvacGeneration = generation;
  const read = async (full = false) => {
    const response = await fetch(`${url}${full ? '?include_inputs=true' : ''}`, { headers: authHeaders() });
    if (!response.ok) throw new Error(t('hvac.unavailable'));
    return response.json();
  };
  try {
    const payload = await read();
    if (panel.hvacGeneration !== generation) return;
    const model = summarizeHvacAssumptions(payload);
    if (!model.runs.length) { panel.hidden = true; return; }
    const legacy = model.policies.every(policy => policy === 'legacy-fixed-100-v1');
    const legacyGreybox = model.runs.every(run => run.assumptions?.solar_used === false);
    const annual = model.policies.includes('annual-pvgis-local-cap10-v1');
    const format = value => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const title = t(legacyGreybox ? 'hvac.legacy_greybox' : legacy ? 'hvac.legacy' : annual ? 'hvac.annual' : 'hvac.feasibility');
    panel.innerHTML = `<details class="hvac-assumptions result-card">
      <summary class="hvac-assumptions__toggle">
        <span class="hvac-assumptions__heading">
          <strong class="hvac-assumptions__title">${textContent(t('hvac.title'))}</strong>
          <span class="hvac-assumptions__subtitle">${textContent(title)}</span>
        </span>
      </summary>
      <div class="hvac-assumptions__body">
        <p>${textContent(t(legacyGreybox ? 'hvac.legacy_greybox_note' : legacy ? 'hvac.legacy_note' : annual ? 'hvac.annual_note' : 'hvac.feasibility_note'))}</p>
        ${legacy ? '' : `<p>${textContent(t('hvac.coefficients'))}</p><p>${textContent(t('hvac.terminal_note'))}</p>`}
        <p>${textContent(t('hvac.table_scope'))}</p>
        <div class="hvac-assumptions__table"><table><thead><tr>
          <th>${textContent(t('hvac.temperature'))}</th><th>GHI (W/m²)</th>
          <th>${textContent(t('hvac.trip_energy'))}</th><th>${textContent(t('hvac.terminal_energy'))}</th>
        </tr></thead><tbody>${model.rows.map(row => `<tr><td>${format(row.temperature)} °C</td><td>${format(row.ghi)}</td><td>${format(row.tripKwh)}</td><td>${row.hasTerminal ? format(row.terminalKwh) : '—'}</td></tr>`).join('')}</tbody></table></div>
        ${annual ? `<p>${textContent(t('hvac.timezone'))}: ${textContent(model.timezones.join(', '))}. ${textContent(t('hvac.year'))}: ${textContent(model.years.join(', '))}.</p>` : ''}
        <details class="hvac-assumptions__traceability"><summary>${textContent(t('hvac.traceability'))}</summary><pre>${textContent(JSON.stringify({ policies: model.policies, weather_checksums: model.weatherChecksums, assumptions: model.runs[0].assumptions }, null, 2))}</pre></details>
        <div class="hvac-assumptions__actions"><button type="button" data-hvac-download="summary">${textContent(t('hvac.download'))}</button><button type="button" data-hvac-download="inputs">${textContent(t('hvac.download_inputs'))}</button></div>
        <p role="status" data-hvac-status></p>
      </div></details>`;
    panel.hidden = false;
    panel.querySelectorAll('[data-hvac-download]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      const status = panel.querySelector('[data-hvac-status]');
      status.textContent = '';
      try {
        const full = button.dataset.hvacDownload === 'inputs';
        const data = full ? await read(true) : payload;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl; link.download = `hvac-${id}${full ? '-inputs' : '-assumptions'}.json`;
        link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    }));
  } catch {
    if (panel.hvacGeneration !== generation) return;
    panel.textContent = t('hvac.unavailable'); panel.hidden = false;
  }
};
