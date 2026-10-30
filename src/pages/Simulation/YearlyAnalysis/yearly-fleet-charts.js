import * as d3 from 'd3';
import { formatNumber, formatChf } from '../../../utils/number-format.js';

const colors = { energy: '#d38a1c', maintenance: '#648d30', infraMaintenance: '#397fa1', electric: '#27813a', diesel: '#d53841' };
const frame = (host, title, max, years = null) => {
  const width = 680, height = 350, margin = { left: 110, right: 25, top: 40, bottom: 48 };
  const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', title);
  svg.append('title').text(title);
  const y = d3.scaleLinear().domain([0, Math.max(1, max)]).nice().range([height - margin.bottom, margin.top]);
  const x = years === null ? d3.scaleBand().domain(['electric', 'diesel']).range([margin.left, width - margin.right]).padding(.45)
    : d3.scaleLinear().domain([0, years]).range([margin.left, width - margin.right]);
  svg.append('g').attr('class', 'annual-chart-grid').attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat('')).call(g => g.select('.domain').remove());
  svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(v => formatChf(v))).call(g => g.select('.domain').remove());
  return { svg, x, y, width, height, margin };
};
const legend = (host, entries) => {
  const list = d3.select(host).append('div').attr('class', 'annual-chart-legend');
  for (const [key, name] of entries) { const item = list.append('span'); item.append('i').style('background', colors[key]); item.append('span').text(name); }
};

export function renderAnnualCostCharts({ opexHost, cumulativeHost, electric, diesel, comparison, divisor, assumptions, label }) {
  const designs = { electric, diesel };
  if (!electric || !diesel) return;
  const { svg, x, y, height, margin } = frame(opexHost, label('opexComparison'), Math.max(electric.annualOpex, diesel.annualOpex) / divisor * 1.18);
  for (const [key, design] of Object.entries(designs)) {
    let offset = 0;
    const values = [
      ['energy', design.operating.filter(c => ['electricity', 'fuel', 'heater'].includes(c.key)).reduce((s, c) => s + c.annual, 0)],
      ['maintenance', design.operating.find(c => c.key === 'maintenance')?.annual ?? 0],
      ['infraMaintenance', design.operating.find(c => c.key === 'infraMaintenance')?.annual ?? 0],
    ];
    for (const [part, total] of values) {
      const value = total / divisor;
      svg.append('rect').attr('x', x(key)).attr('width', x.bandwidth()).attr('y', y(offset + value)).attr('height', y(offset) - y(offset + value)).attr('fill', colors[part])
        .append('title').text(`${label(key)} · ${label(part)}: ${formatChf(value)} / ${label('year')}`);
      offset += value;
    }
    svg.append('text').attr('x', x(key) + x.bandwidth() / 2).attr('y', y(offset) - 12).attr('text-anchor', 'middle').text(formatChf(offset));
  }
  svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickFormat(label));
  legend(opexHost, ['energy', 'maintenance', 'infraMaintenance'].map(k => [k, label(k)]));
  const max = d3.max(comparison.points, p => Math.max(p.electric, p.diesel)) / divisor;
  const line = frame(cumulativeHost, label('cumulative'), max * 1.08, assumptions.horizon);
  line.svg.append('g').attr('transform', `translate(0,${line.height - line.margin.bottom})`).call(d3.axisBottom(line.x).ticks(Math.min(assumptions.horizon, 12)).tickFormat(v => formatNumber(v, 0)));
  line.svg.append('text').attr('x', (line.margin.left + line.width) / 2).attr('y', line.height - 8).attr('text-anchor', 'middle').text(label('years'));
  for (const key of ['electric', 'diesel']) {
    const path = d3.line().x(p => line.x(p.year)).y(p => line.y(p[key] / divisor)).curve(d3.curveStepAfter);
    line.svg.append('path').datum(comparison.points).attr('d', path).attr('fill', 'none').attr('stroke', colors[key]).attr('stroke-width', 2.5);
    for (const p of comparison.points) line.svg.append('circle').attr('cx', line.x(p.year)).attr('cy', line.y(p[key] / divisor)).attr('r', 3).attr('fill', colors[key])
      .append('title').text(`${label(key)} · ${label('year')} ${p.year}${p.event === 'residual' ? ` · ${label('residual')}` : ''}: ${formatChf(p[key] / divisor)}`);
  }
  if (comparison.breakEven !== null && !comparison.residualOnly) {
    line.svg.append('line').attr('x1', line.x(comparison.breakEven)).attr('x2', line.x(comparison.breakEven)).attr('y1', line.margin.top).attr('y2', line.height - line.margin.bottom).attr('stroke', '#647480').attr('stroke-dasharray', '4 4');
  }
  legend(cumulativeHost, ['electric', 'diesel'].map(k => [k, label(k)]));
}
