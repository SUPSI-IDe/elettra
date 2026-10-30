import { formatNumber } from "../../../utils/number-format";
import { scaleLinear, max } from "d3";
import { t } from "../../../i18n";
import { textContent as esc } from "../../../ui-helpers";

const label = (key, values) => t(`simulation.aggregate_${key}`, values);
const number = formatNumber;

export function renderEnergyDistribution(model, info) {
  const stats = model.detail?.statistics;
  const histogram = stats?.total_energy_histogram;
  const edges = histogram?.bin_edges_kwh;
  const counts = histogram?.counts;
  const marker = model.basis === "aggregate_q95" ? stats?.q95_total_kwh : stats?.mean_total_kwh;
  const valid = model.available && model.verified
    && model.detail?.reference?.battery_packs === model.selected
    && Array.isArray(edges) && Array.isArray(counts) && counts.length > 0
    && edges.length === counts.length + 1 && Number.isFinite(marker)
    && edges.every((v, i) => Number.isFinite(v) && (i === 0 || v > edges[i - 1]))
    && counts.every(v => Number.isInteger(v) && v >= 0)
    && counts.reduce((sum, v) => sum + v, 0) === stats.samples;
  if (!valid) return `<p class="aggregate-pack-key" data-role="energy-distribution-unavailable">${esc(label("histogram_missing"))}</p>`;

  const x = scaleLinear().domain([Math.min(edges[0], marker), Math.max(edges.at(-1), marker)]).range([74, 652]);
  const y = scaleLinear().domain([0, max(counts)]).nice(4).range([220, 26]);
  const basis = label(model.basis === "aggregate_q95" ? "q95" : "mean");
  return `<figure class="aggregate-distribution" data-role="energy-distribution" data-packs="${model.selected}">
    <figcaption>${esc(label("histogram_title"))} ${info("histogram", label("histogram_title"), label("histogram_help", {packs: model.selected, samples: number(stats.samples)}))}</figcaption>
    <div class="aggregate-distribution-legend"><span class="aggregate-marker-key aggregate-marker-key--${model.basis}"></span>${esc(basis)}: <strong>${number(marker)} kWh</strong><span class="aggregate-pack-key">· ${esc(label("histogram_packs", {packs: model.selected}))}</span></div>
    <svg viewBox="0 0 680 278" role="img" aria-label="${esc(label("histogram_title"))}">
      <title>${esc(label("histogram_help", {packs: model.selected, samples: number(stats.samples)}))}</title>
      ${y.ticks(4).map(v => `<line x1="74" x2="652" y1="${y(v)}" y2="${y(v)}" class="aggregate-distribution-grid"/><text x="65" y="${y(v) + 4}" text-anchor="end">${number(v)}</text>`).join("")}
      ${counts.map((count, i) => `<rect data-role="energy-distribution-bin" x="${x(edges[i])}" y="${y(count)}" width="${Math.max(.1, x(edges[i + 1]) - x(edges[i]) - .6)}" height="${220 - y(count)}"><title>${number(edges[i])}–${number(edges[i + 1])} kWh · ${number(count)}</title></rect>`).join("")}
      <line data-role="energy-distribution-marker" data-basis="${model.basis}" data-value="${marker}" class="aggregate-distribution-marker aggregate-soc--${model.basis}" x1="${x(marker)}" x2="${x(marker)}" y1="22" y2="220"/>
      ${x.ticks(6).map(v => `<text x="${x(v)}" y="240" text-anchor="middle">${number(v)}</text>`).join("")}
      <text x="363" y="270" text-anchor="middle">${esc(label("histogram_x"))}</text>
      <text transform="translate(16,123) rotate(-90)" text-anchor="middle">${esc(label("histogram_y"))}</text>
    </svg>
  </figure>`;
}
