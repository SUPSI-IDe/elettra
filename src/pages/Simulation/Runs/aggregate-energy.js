import { t } from "../../../i18n";
import { textContent as esc } from "../../../ui-helpers";
import { aggregateEnergyModel } from "../../../utils/aggregate-energy-model";
import { resolveOptimizationBasis } from "../../../api/simulation";
import { triggerPartialLoad } from "../../../events";

const label = (key, values) => t(`simulation.aggregate_${key}`, values);
const number = (value) => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—";
const basisLabel = (basis) => label(basis === "aggregate_q95" ? "q95" : basis === "mean" ? "mean" : "legacy");

function socChart(model) {
  if (!model.available) return "";
  const profiles = Object.entries(model.cases);
  const all = profiles.flatMap(([, value]) => value.soc_kwh);
  const low = Math.min(0, ...all), high = model.nominal * model.soh;
  const y = (v) => 165 - (v-low)/(high-low || 1)*140;
  const x = (i, count) => 52+i/Math.max(1, count-1)*580;
  const lines = profiles.map(([key, value]) => `<polyline class="aggregate-soc--${key}" points="${value.soc_kwh.map((v, i) => `${x(i,value.soc_kwh.length).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>`).join("");
  const verified = model.detail.verified_soc_kwh;
  const verifiedLine = verified?.length ? `<polyline class="aggregate-soc--verified" points="${verified.map((v,i)=>`${x(i,verified.length).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>` : "";
  const clock = (minute) => `${Math.floor(minute/60)%24}`.padStart(2,"0")+":"+`${minute%60}`.padStart(2,"0")+(minute>=1440 ? " +1" : "");
  const sample = profiles[0][1];
  return `<figure class="aggregate-soc"><figcaption>${esc(label("soc"))}</figcaption>
    <svg viewBox="0 0 680 205" role="img" aria-label="${esc(label("soc"))}">
    ${[model.minSoc, model.maxSoc].map(v => `<line x1="52" x2="632" y1="${y(v*high)}" y2="${y(v*high)}" class="aggregate-soc-limit"/><text x="8" y="${y(v*high)+4}">${number(v*100)}%</text>`).join("")}
    ${lines}${verifiedLine}<text x="52" y="192">${clock(sample.first_minute)}</text><text x="632" text-anchor="end" y="192">${clock(sample.first_minute+sample.soc_kwh.length-1)}</text></svg>
    <div class="aggregate-legend"><span class="aggregate-mean-dot">● ${esc(label("mean"))}</span><span class="aggregate-q95-dot">● ${esc(label("q95"))}</span>${verifiedLine ? `<span>⋯ ${esc(label("verified_soc"))}</span>` : ""}</div></figure>`;
}

export function renderAggregateEnergy(run, shiftId) {
  const model = aggregateEnergyModel(run, shiftId);
  const safeCount = Math.min(64, Math.max(0, model.maximum || 0));
  const packs = Array.from({length: safeCount}, (_, i) => `<span class="aggregate-pack ${i<model.selected ? "aggregate-pack--chosen" : "aggregate-pack--unused"}" style="--reserve:${model.minSoc*100}%;--soc-max:${model.maxSoc*100}%" aria-label="${esc(label(i<model.selected ? "chosen" : "unused"))} ${i+1}"><b>${i+1}</b></span>`).join("");
  const overflow = Array.from({length: Math.min(32, model.unavailablePacks)}, (_, i) => `<span class="aggregate-pack aggregate-pack--excess"><b>+${i+1}</b></span>`).join("");
  const scale = model.cases ? Math.max(model.usable, ...Object.values(model.cases).map(v => v.required_usable_kwh))*1.12 : 1;
  const rows = model.cases ? Object.entries(model.cases).map(([key, value]) => `<div class="aggregate-demand" data-basis="${key}">
    <div><strong>${esc(basisLabel(key))}</strong><span>${number(value.required_usable_kwh)} kWh · ${esc(label(value.margin_kwh>=-1e-5 ? "margin" : "deficit"))} ${number(Math.abs(value.margin_kwh))} kWh</span></div>
    <div class="aggregate-demand-track"><span class="aggregate-demand-fill aggregate-demand-fill--${key}" style="width:${Math.max(0,value.required_usable_kwh)/scale*100}%"></span><i style="left:${model.usable/scale*100}%" title="${esc(label("usable"))}: ${number(model.usable)} kWh"></i>${value.margin_kwh < -1e-5 ? `<span class="aggregate-demand-deficit" style="left:${model.usable/scale*100}%;width:${-value.margin_kwh/scale*100}%"></span>` : ""}</div>
    <small>${esc(label("consumed"))}: ${number(value.total_consumption_kwh)} kWh · ${esc(label("charged"))}: ${number(value.accepted_charge_kwh)} kWh</small></div>`).join("") : "";
  const validation = model.detail?.trajectory_validation;
  return `<section class="aggregate-energy result-card" data-role="aggregate-energy" data-status="${model.available ? "available" : "unavailable"}">
    <header class="result-card__header"><div><h3>${esc(label("title"))}</h3><p>${esc(label("current"))}: <strong data-role="aggregate-current-basis">${esc(basisLabel(model.basis))}</strong> · ${esc(label(model.verified ? "verified" : "unverified"))}</p></div>
      <label class="aggregate-basis-control">${esc(label("basis"))}<select data-role="aggregate-basis"><option value="mean" ${model.basis!=="aggregate_q95" ? "selected" : ""}>${esc(label("mean"))}</option><option value="aggregate_q95" ${model.basis==="aggregate_q95" ? "selected" : ""}>${esc(label("q95"))}</option></select></label></header>
    <div class="result-card__body">
    <div class="aggregate-basis-action"><p data-role="aggregate-basis-message" aria-live="polite">${esc(label(model.available ? "switch_help" : "legacy_help"))}</p><button type="button" class="button" data-role="aggregate-basis-action" ${model.available ? "hidden" : ""}>${esc(label("calculate"))}</button></div>
    <div class="aggregate-metrics"><div><strong>${number(model.selected)} / ${number(model.maximum)}</strong><span>${esc(label(run.mode === "charging_only" || run.input_params?.mode === "charging_only" ? "fixed_packs" : "packs"))}</span></div><div><strong>${number(model.nominal)} kWh</strong><span>${esc(label("nominal"))}${model.soh < 1 ? ` · ${esc(label("effective"))}: ${number(model.nominal*model.soh)} kWh` : ""}</span></div><div><strong>${number(model.usable)} kWh</strong><span>${esc(label("usable"))} · SOC ${number(model.minSoc*100)}–${number(model.maxSoc*100)}% · SOH ${number(model.soh*100)}%</span></div></div>
    <div class="aggregate-packs" aria-label="${esc(label("packs"))}">${packs}${overflow ? `<span class="aggregate-overflow">${overflow}</span>` : ""}</div>
    <p class="aggregate-pack-key">${number(Math.max(0,model.maximum-model.selected))} ${esc(label("unused"))} · ${number(model.packKwh)} kWh / pack</p><p class="aggregate-pack-key">${esc(label("pack_legend"))}</p>
    ${model.excess>0 ? `<p class="aggregate-warning" role="status">${esc(label(model.physicalExceeded ? "exceeded" : "fixed_deficit", {count:model.physicalExceeded ? model.unavailablePacks : model.excess,required:model.diagnosticTotal,selected:model.selected,extra:model.excess,maximum:model.maximum}))}</p>` : ""}
    ${model.available ? `<h4>${esc(label("required"))}</h4><p>${esc(label("same_plan"))}</p>${rows}${socChart(model)}${validation ? `<p class="aggregate-coverage">${esc(label("coverage", {percent:number(validation.completion_probability*100),samples:number(validation.samples)}))}</p>` : ""}<details><summary>${esc(label("method"))}</summary><p>${esc(label("assumption"))}</p><p>${esc(label("samples"))}: ${number(model.detail.statistics.samples)} · seed ${model.detail.statistics.seed} · Q95 ${number(model.detail.statistics.q95_total_kwh)} kWh · CI95 [${(model.detail.statistics.q95_monte_carlo_ci95_kwh ?? []).map(number).join("; ")}] kWh</p>${(model.detail.statistics.precision_met===false || model.detail.statistics.capacity_threshold_resolved===false) ? `<p class="aggregate-warning">${esc(label("precision"))}</p>` : ""}<p>${esc(label("coverage_note"))}</p></details>` : `<p class="aggregate-warning">${esc(label(model.verified ? "distribution_missing" : "not_verified"))}</p>`}
    </div></section>`;
}

export function bindAggregateEnergy(container, run) {
  const section = container.querySelector('[data-role="aggregate-energy"]');
  if (!section) return;
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
  select.addEventListener("change", lookup);
  button.addEventListener("click", async () => {
    button.disabled = true; select.disabled = true;
    try {
      const result = candidate ?? await resolveOptimizationBasis(run.id, select.value, {start:true});
      triggerPartialLoad(result.status === "completed" ? "simulation-results" : "simulation-runs", {runId:result.optimization_run_id});
    } catch (error) {
      message.textContent = error.message; button.disabled = false; select.disabled = false;
    }
  });
}
