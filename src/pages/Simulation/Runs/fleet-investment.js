import { t } from '../../../i18n';
import { textContent } from '../../../ui-helpers';
import { buildFleetInvestment } from '../../../utils/fleet-investment';
import { formatNumber as fmt, formatChf } from '../../../utils/number-format';

export function fleetInvestmentHtml(run, currentModel) {
  const model = buildFleetInvestment(run, currentModel);
  const key = name => textContent(t(`simulation.fleet_${name}`));
  const values = row => `<td>${fmt(row.packs)}</td><td>${fmt(row.capacity)}</td>
    <td>${formatChf(row.busCost)}</td><td>${formatChf(row.batteryCost)}${row.packCost != null && row.packs != null
      ? `<small class="fleet-investment__unit">${fmt(row.packs)} × ${formatChf(row.packCost)}</small>` : ''}</td>
    <td>${formatChf(row.totalCost)}</td>`;
  return `<section class="fleet-investment" data-role="feasibility-fleet-battery">
    <h4 class="efficiency-section-title">${key('investment_title')}</h4>
    <p class="helper-text">${key('investment_help')}</p>
    ${!model.verified ? `<p class="helper-text">${key('investment_unverified')}</p>` : ''}
    <div class="table-scroll"><table class="table-standard">
      <thead><tr><th>${key('block')}</th><th>${key('packs')}</th><th>${key('capacity')}</th>
        <th>${key('bus_cost')}</th><th>${key('battery_cost')}</th><th>${key('vehicle_cost')}</th></tr></thead>
      <tbody>${model.rows.map(row => `<tr data-shift-id="${textContent(row.id)}"><th scope="row">${textContent(row.name)}${row.modelName
        ? `<small class="fleet-investment__unit">${textContent(row.modelName)}</small>` : ''}</th>${values(row)}</tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row">${key('total')} (${model.rows.length} ${key(model.rows.length === 1 ? 'bus' : 'buses')})</th>${values(model.totals)}</tr></tfoot>
    </table></div>
    ${model.usesCurrentPrices ? `<p class="helper-text">${key('current_prices')}</p>` : ''}
    ${model.missingPrices ? `<p class="helper-text">${key('missing_prices')}</p>` : ''}
  </section>`;
}
