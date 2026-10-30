import { formatNumber } from "../../../utils/number-format";
import { t } from "../../../i18n";
import { textContent as esc } from "../../../ui-helpers";
import { aggregateEnergyModel } from "../../../utils/aggregate-energy-model";
import { resolveOptimizationBasis } from "../../../api/simulation";
import { triggerPartialLoad } from "../../../events";
import { renderEnergyDistribution } from "./energy-distribution";
import { interpolateTripConsumption } from "../../../utils/soc-display-profile";

const label = (key, values) => t(`simulation.aggregate_${key}`, values);
const number = formatNumber;
const basisLabel = (basis) => label(basis === "aggregate_q95" ? "q95" : basis === "mean" ? "mean" : "legacy");
// A late shift-data refresh may rebuild the whole result card. Keep the user's
// requested basis separate from the basis of the stored result being displayed.
const requestedBasisByRun = new Map();

function socChart(model, info) {
  if (!model.available) return "";
  const displaySoc = (soc, profile, key) => interpolateTripConsumption(soc, profile,
    model.detail.trip_intervals, model.detail.trip_profiles_kwh?.[key]);
  const profiles = Object.entries(model.cases).map(([key, value]) => [key,
    {...value, soc_kwh: displaySoc(value.soc_kwh, value, key)}]);
  const all = profiles.flatMap(([, value]) => value.soc_kwh);
  const low = Math.min(0, ...all), high = model.nominal * model.soh;
  const y = (v) => 165 - (v-low)/(high-low || 1)*140;
  const x = (i, count) => 52+i/Math.max(1, count-1)*580;
  const lines = profiles.map(([key, value]) => `<polyline class="aggregate-soc--${key}" points="${value.soc_kwh.map((v, i) => `${x(i,value.soc_kwh.length).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>`).join("");
  const verified = model.detail.verified_soc_kwh && model.detail.cases[model.basis]
    ? displaySoc(model.detail.verified_soc_kwh, model.detail.cases[model.basis], model.basis)
    : model.detail.verified_soc_kwh;
  const verifiedLine = verified?.length ? `<polyline class="aggregate-soc--verified" points="${verified.map((v,i)=>`${x(i,verified.length).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>` : "";
  const clock = (minute) => `${Math.floor(minute/60)%24}`.padStart(2,"0")+":"+`${minute%60}`.padStart(2,"0")+(minute>=1440 ? " +1" : "");
  const sample = profiles[0][1];
  const validation = model.detail.trajectory_validation;
  const explanation = [model.detail.trip_intervals?.length ? label("soc_interpolation") : "",
    validation ? label("coverage", {percent:number(validation.completion_probability*100),samples:number(validation.samples)}) : ""].filter(Boolean).join(" ");
  return `<figure class="aggregate-soc"><figcaption>${esc(label(model.paired ? "selected_soc" : "soc"))} ${explanation ? info("coverage", label("coverage_title"), explanation) : ""}</figcaption>
    <svg viewBox="0 0 680 205" role="img" aria-label="${esc(label(model.paired ? "selected_soc" : "soc"))}">
    ${[model.minSoc, model.maxSoc].map(v => `<line x1="52" x2="632" y1="${y(v*high)}" y2="${y(v*high)}" class="aggregate-soc-limit"/><text x="8" y="${y(v*high)+4}">${number(v*100)}%</text>`).join("")}
    ${lines}${verifiedLine}<text x="52" y="192">${clock(sample.first_minute)}</text><text x="632" text-anchor="end" y="192">${clock(sample.first_minute+sample.soc_kwh.length-1)}</text></svg>
    <div class="aggregate-legend">${profiles.map(([key]) => `<span class="aggregate-${key === 'mean' ? 'mean' : 'q95'}-dot">● ${esc(basisLabel(key))}</span>`).join('')}${verifiedLine ? `<span>⋯ ${esc(label("verified_soc"))}</span>` : ""}</div></figure>`;
}

export function renderAggregateEnergy(run, shiftId, {diagnostic = false} = {}) {
  const model = aggregateEnergyModel(run, shiftId);
  const info = (key, title, content) => {
    const id = `aggregate-info-${key}-${shiftId}`;
    return `<button type="button" class="info-icon aggregate-info" aria-label="${esc(title)}" aria-describedby="${esc(id)}" aria-expanded="false">i<span id="${esc(id)}" class="info-tooltip" role="tooltip">${esc(content)}</span></button>`;
  };
  const requestedBasis = model.paired ? model.basis : requestedBasisByRun.get(run.id) ?? model.basis;
  const hasDiagnosticRequirement = model.diagnosticTotal > model.selected;
  const packCount = hasDiagnosticRequirement ? model.diagnosticTotal : model.selected;
  const fixedBattery = run.mode === "charging_only" || run.input_params?.mode === "charging_only";
  const packLabel = hasDiagnosticRequirement ? "required_packs"
    : fixedBattery ? "fixed_packs" : diagnostic ? "required_packs" : "packs";
  const safeCount = Math.min(64, Math.max(0, model.maximum || 0));
  const packs = Array.from({length: safeCount}, (_, i) => `<span class="aggregate-pack ${i<model.selected ? "aggregate-pack--chosen" : "aggregate-pack--unused"}" style="--reserve:${model.minSoc*100}%;--soc-max:${model.maxSoc*100}%" aria-label="${esc(label(i<model.selected ? "chosen" : "unused"))} ${i+1}"><b>${i+1}</b></span>`).join("");
  const overflow = Array.from({length: Math.min(32, model.unavailablePacks)}, (_, i) => `<span class="aggregate-pack aggregate-pack--excess"><b>+${i+1}</b></span>`).join("");
  const scale = model.cases ? Math.max(model.usable, ...Object.values(model.cases).map(v => v.required_usable_kwh))*1.12 : 1;
  const rows = model.cases ? Object.entries(model.cases).map(([key, value]) => `<div class="aggregate-demand" data-basis="${key}">
    <div>${model.paired ? "" : `<strong>${esc(basisLabel(key))}</strong>`}<span class="aggregate-demand-value">${number(value.required_usable_kwh)} kWh · ${esc(label(value.margin_kwh>=-1e-5 ? "margin" : "deficit"))} ${number(Math.abs(value.margin_kwh))} kWh</span></div>
    <div class="aggregate-demand-track"><span class="aggregate-demand-fill aggregate-demand-fill--${key}" style="width:${Math.max(0,value.required_usable_kwh)/scale*100}%"></span><i style="left:${model.usable/scale*100}%" title="${esc(label("usable"))}: ${number(model.usable)} kWh"></i>${value.margin_kwh < -1e-5 ? `<span class="aggregate-demand-deficit" style="left:${model.usable/scale*100}%;width:${-value.margin_kwh/scale*100}%"></span>` : ""}</div>
    <small>${esc(label("consumed"))}: ${number(value.total_consumption_kwh)} kWh · ${esc(label("charged"))}: ${number(value.accepted_charge_kwh)} kWh</small></div>`).join("") : "";
  return `<section class="aggregate-energy result-card" data-role="aggregate-energy" data-status="${model.available ? "available" : "unavailable"}">
    <header class="result-card__header"><div><h3 class="result-card__title">${esc(diagnostic ? t(fixedBattery && !hasDiagnosticRequirement ? "simulation.diagnostic_fixed_battery_title" : "simulation.diagnostic_battery_title", {shift:run.results.battery_results[shiftId].shift_name}) : label("title"))}</h3><p class="result-card__subtitle">${esc(label("current"))}: <strong data-role="aggregate-current-basis">${esc(basisLabel(model.basis))}</strong> · ${esc(label(model.verified ? "verified" : "unverified"))}</p></div>
      ${model.paired || diagnostic ? "" : `<label class="aggregate-basis-control">${esc(label("basis"))}<select data-role="aggregate-basis"><option value="mean" ${requestedBasis!=="aggregate_q95" ? "selected" : ""}>${esc(label("mean"))}</option><option value="aggregate_q95" ${requestedBasis==="aggregate_q95" ? "selected" : ""}>${esc(label("q95"))}</option></select></label>`}</header>
    <div class="result-card__body">
    ${model.paired || diagnostic ? "" : `<div class="aggregate-basis-action"><p class="helper-text" data-role="aggregate-basis-message" aria-live="polite">${esc(label(model.available ? "switch_help" : "legacy_help"))}</p><button type="button" class="button" data-role="aggregate-basis-action" ${model.available ? "hidden" : ""}>${esc(label("calculate"))}</button></div>`}
    <div class="result-kpis"><div><strong class="${model.physicalExceeded ? "aggregate-pack-count--exceeded" : ""}">${number(packCount)} / ${number(model.maximum)}</strong><span>${esc(label(packLabel))}</span></div><div><strong>${number(model.nominal)} kWh</strong><span>${esc(label(hasDiagnosticRequirement ? "selected_nominal" : "nominal"))}${model.soh < 1 ? ` · ${esc(label("effective"))}: ${number(model.nominal*model.soh)} kWh` : ""}</span></div><div><strong>${number(model.usable)} kWh</strong><span>${esc(label(hasDiagnosticRequirement ? "selected_usable" : "usable"))} · SOC ${number(model.minSoc*100)}–${number(model.maxSoc*100)}% · SOH ${number(model.soh*100)}%</span></div></div>
    <div class="aggregate-packs" aria-label="${esc(label("packs"))}">${packs}${overflow ? `<span class="aggregate-overflow">${overflow}</span>` : ""}</div>
    <p class="aggregate-pack-key">${number(Math.max(0,model.maximum-model.selected))} ${esc(label("unused"))} · ${number(model.packKwh)} kWh / pack</p><p class="aggregate-pack-key">${esc(label("pack_legend"))}</p>
    ${model.excess>0 ? `<p class="aggregate-warning" role="status">${esc(label(model.physicalExceeded ? "exceeded" : "fixed_deficit", {count:model.physicalExceeded ? model.unavailablePacks : model.excess,required:model.diagnosticTotal,selected:model.selected,extra:model.excess,maximum:model.maximum}))}</p>` : ""}
    ${model.available ? `<h4 class="card-title">${esc(label("required"))} ${info("capacity", label("required"), label(model.paired ? "selected_plan" : "same_plan"))}</h4>${rows}<div class="aggregate-charts">${renderEnergyDistribution(model, info)}${socChart(model, info)}</div><details class="result-disclosure"><summary>${esc(label("method"))}</summary><p>${esc(label("assumption"))}</p><p>${esc(label("samples"))}: ${number(model.detail.statistics.samples)} · seed ${model.detail.statistics.seed} · Q95 ${number(model.detail.statistics.q95_total_kwh)} kWh · CI95 [${(model.detail.statistics.q95_monte_carlo_ci95_kwh ?? []).map(number).join("; ")}] kWh</p>${(model.detail.statistics.precision_met===false || model.detail.statistics.capacity_threshold_resolved===false) ? `<p class="aggregate-warning">${esc(label("precision"))}</p>` : ""}<p>${esc(label("coverage_note"))}</p></details>` : `<p class="aggregate-warning">${esc(diagnostic ? t(model.verified ? "simulation.diagnostic_verified" : "simulation.diagnostic_unverified") : label(model.verified ? "distribution_missing" : "not_verified"))}</p>`}
    ${run.results?.charging_schedule_policy?.status === "optimized" ? `<p class="aggregate-coverage result-card__note">${esc(label("reserve_policy"))}</p>` : ""}
    </div></section>`;
}

function bindInfoTooltips(section) {
  section.querySelectorAll('.aggregate-info').forEach(button => {
    const positionTooltip = () => {
      const tooltip = button.querySelector('.info-tooltip');
      const left = button.getBoundingClientRect().left;
      const width = Math.min(320, window.innerWidth - 32);
      tooltip.style.width = `${width}px`;
      tooltip.style.maxWidth = `${width}px`;
      tooltip.style.left = `${Math.max(16, Math.min(left, window.innerWidth - width - 16)) - left}px`;
      tooltip.style.right = 'auto';
    };
    button.addEventListener('mouseenter', positionTooltip);
    button.addEventListener('focus', positionTooltip);
    button.addEventListener('click', () => button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')));
    button.addEventListener('blur', () => button.setAttribute('aria-expanded', 'false'));
    button.addEventListener('keydown', event => {
      if (event.key === 'Escape') button.setAttribute('aria-expanded', 'false');
    });
  });
}

export function bindAggregateEnergy(container, run) {
  const section = container.querySelector('[data-role="aggregate-energy"]');
  if (!section) return;
  bindInfoTooltips(section);
  if (run.input_params?.basis_run_ids) return;
  const select = section.querySelector('[data-role="aggregate-basis"]');
  const message = section.querySelector('[data-role="aggregate-basis-message"]');
  const button = section.querySelector('[data-role="aggregate-basis-action"]');
  let generation = 0, candidate = null;
  const lookup = async () => {
    const token = ++generation;
    candidate = null; button.hidden = false; button.disabled = true;
    message.textContent = label("loading");
    try {
      const found = await resolveOptimizationBasis(run.id, select.value);
      if (token !== generation || !section.isConnected) return;
      candidate = found.optimization_run_id ? found : null;
      message.textContent = label(candidate ? (candidate.status === "completed" ? "cached" : "pending") : "new_required");
      button.textContent = label(candidate ? "open" : "calculate");
      button.disabled = false;
    } catch (error) {
      if (token === generation) { message.textContent = error.message; button.disabled = true; }
    }
  };
  select.addEventListener("change", () => {
    requestedBasisByRun.set(run.id, select.value);
    // Bound session-only UI state without persisting user choices to a server.
    if (requestedBasisByRun.size > 64) requestedBasisByRun.delete(requestedBasisByRun.keys().next().value);
    void lookup();
  });
  button.addEventListener("click", async () => {
    button.disabled = true; select.disabled = true;
    try {
      const result = candidate ?? await resolveOptimizationBasis(run.id, select.value, {start:true});
      triggerPartialLoad(result.status === "completed" ? "simulation-results" : "simulation-runs", {runId:result.optimization_run_id});
    } catch (error) {
      message.textContent = error.message; button.disabled = false; select.disabled = false;
    }
  });
  if (requestedBasisByRun.has(run.id)) void lookup();
}


function bindPairedControl(section, run, onRunChange) {
  const select = section.querySelector('[data-role="aggregate-basis"]');
  const message = section.querySelector('[data-role="aggregate-basis-message"]');
  select.addEventListener("change", async () => {
    const basis = select.value;
    if (basis === run.input_params.consumption_basis) return;
    select.disabled = true;
    message.hidden = false;
    message.textContent = label("loading");
    try {
      const candidate = await resolveOptimizationBasis(run.id, basis);
      if (!section.isConnected) return;
      if (candidate.status === "completed" && candidate.optimization_run_id) {
        await onRunChange(candidate.optimization_run_id);
        return;
      }
      message.textContent = label(candidate.status === "failed" || candidate.status === "not_calculated"
        ? "paired_failed" : "pending");
    } catch (error) { message.textContent = error.message; }
    // Never relabel the design while its alternative is pending or unavailable.
    select.value = run.input_params.consumption_basis;
    select.disabled = false;
  });
}

export function renderPairedBasisSwitch(container, run, onRunChange) {
  if (!container) return;
  const paired = Boolean(run.input_params?.basis_run_ids);
  container.hidden = !paired;
  if (!paired) { container.innerHTML = ""; return; }
  const basis = run.input_params.consumption_basis;
  container.innerHTML = `<div class="results-basis-switch__control"><label class="aggregate-basis-control"><span>${esc(label("basis"))}</span>
    <select data-role="aggregate-basis">${["mean", "aggregate_q95"].map(key =>
      `<option value="${key}" ${basis === key ? "selected" : ""}>${esc(basisLabel(key))}</option>`).join("")}</select></label>
    <button type="button" class="info-icon aggregate-info" aria-label="${esc(label("basis"))}" aria-describedby="paired-basis-help" aria-expanded="false">i<span id="paired-basis-help" class="info-tooltip" role="tooltip">${esc(label("paired_switch_help"))}</span></button></div>
    <p class="helper-text" data-role="aggregate-basis-message" aria-live="polite" hidden></p>`;
  bindInfoTooltips(container);
  bindPairedControl(container, run, onRunChange);
}
