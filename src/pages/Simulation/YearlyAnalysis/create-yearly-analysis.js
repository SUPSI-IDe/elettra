import "./create-yearly-analysis.css";
import { fetchBusModels } from "../../../api";
import {
  createSinglePredictionRun,
  fetchOptimizationRuns,
  fetchPredictionRun,
} from "../../../api/simulation";
import { fetchShiftById } from "../../../api/shifts";
import { isAuthenticated, resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { textContent, resolveModelFields } from "../../../ui-helpers";
import {
  DEFAULT_PREDICTION_MODEL_NAME,
  DEFAULT_PREDICTION_QUANTILES,
} from "../../../config/simulation-defaults";
import {
  saveAnalysis,
  computeYearlyTotals,
  MODE_LABELS,
} from "./yearly-analysis-store";

const text = (v) => (v === null || v === undefined ? "" : String(v));

const toFiniteNumber = (v) => {
  if (v === "" || (typeof v === "string" && v.trim() === "")) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ── Extract info from an optimization run ────────────────────────────

const resolveElectrificationFeasible = (run = {}) => {
  const d = run?.results?.electrification_feasible;
  if (d === true) return true;
  if (d === false) return false;
  const s = run?.results?.electrification_summary;
  if (s?.status === "feasible") return true;
  if (s?.status === "infeasible") return false;
  return null;
};

const resolveOptimizedPacks = (batteryResults = {}) => {
  const values = Object.values(batteryResults ?? {})
    .map((r) => toFiniteNumber(r?.optimized_packs))
    .filter((v) => v != null);
  return values.length ? Math.max(...values) : null;
};

const resolveOptimizedKwh = (batteryResults = {}, packSizeKwh = null) => {
  const packs = resolveOptimizedPacks(batteryResults);
  if (packs == null) return null;
  const direct = Object.values(batteryResults ?? {})
    .map((r) => toFiniteNumber(r?.optimized_kwh))
    .find((v) => v != null);
  if (direct != null) return direct;
  if (packSizeKwh != null) return packs * packSizeKwh;
  return null;
};

const resolveShiftIds = (run = {}) => {
  const ids =
    run?.input_params?.shift_ids ??
    run?.shift_ids ??
    [];
  return (Array.isArray(ids) ? ids : []).map((id) => text(id)).filter(Boolean);
};

const resolveBusModelId = (run = {}) =>
  text(
    run?.input_params?.bus_model_id ??
      run?.inputParams?.bus_model_id ??
      run?.bus_model_id ??
      run?.busModelId ??
      ""
  ).trim();

const resolveRunUserId = (run = {}) =>
  text(
    run?.user_id ??
      run?.userId ??
      run?.owner_user_id ??
      run?.ownerUserId ??
      run?.created_by_id ??
      run?.createdById ??
      run?.created_by?.id ??
      run?.createdBy?.id ??
      run?.input_params?.user_id ??
      run?.inputParams?.user_id ??
      ""
  ).trim();

const resolveResourceUserId = (resource = {}) =>
  text(
    resource?.user_id ??
      resource?.userId ??
      resource?.owner_user_id ??
      resource?.ownerUserId ??
      resource?.created_by_id ??
      resource?.createdById ??
      resource?.created_by?.id ??
      resource?.createdBy?.id ??
      ""
  ).trim();

const runBelongsToCurrentUser = (run, currentUserId, modelsById = {}) => {
  if (!currentUserId) return false;

  const runUserId = resolveRunUserId(run);
  if (runUserId) return runUserId === currentUserId;

  const busModelId = resolveBusModelId(run);
  return Boolean(busModelId && modelsById[busModelId]);
};

const extractPredictionOnlyKpis = (predRun) => {
  const s = predRun?.summary ?? {};
  return {
    feasible: null,
    solverStatus: "prediction-only",
    totalEnergyKwh: toFiniteNumber(s.total_consumption_kwh),
    drivetrainEnergyKwh: toFiniteNumber(s.total_drivetrain_kwh),
    auxiliaryEnergyKwh: toFiniteNumber(s.total_auxiliary_kwh),
    distanceKm: toFiniteNumber(s.total_distance_km),
    energyPerKm: toFiniteNumber(s.consumption_per_km_kwh),
  };
};

// ── Main initializer ─────────────────────────────────────────────────

export const initializeCreateYearlyAnalysis = async (root = document) => {
  const section = root.querySelector("section.create-yearly-analysis");
  if (!section) return null;

  const cleanups = [];
  const form = section.querySelector("form");
  const baseSelect = section.querySelector('[data-role="base-run-select"]');
  const configSummary = section.querySelector('[data-role="config-summary"]');
  const scenariosTbody = section.querySelector('[data-role="scenarios-body"]');
  const totalOccEl = section.querySelector('[data-role="total-occurrences"]');
  const occWarning = section.querySelector('[data-role="occurrences-warning"]');
  const feedbackEl = section.querySelector('[data-role="feedback"]');
  const progressOverlay = section.querySelector('[data-role="simulation-progress"]');
  const progressMsg = section.querySelector('[data-role="progress-message"]');

  let feasibleRuns = [];
  let resolvedNames = {};

  const setFeedback = (msg, tone = "error") => {
    if (!feedbackEl) return;
    if (msg) { feedbackEl.textContent = msg; feedbackEl.dataset.tone = tone; feedbackEl.hidden = false; }
    else { feedbackEl.textContent = ""; feedbackEl.hidden = true; }
  };
  const showProgress = (msg) => { if (progressMsg) progressMsg.textContent = msg; if (progressOverlay) progressOverlay.hidden = false; };
  const hideProgress = () => { if (progressOverlay) progressOverlay.hidden = true; };

  // ── Scenarios tracking ──────────────────────────────────────────

  const updateTotalOcc = () => {
    let total = 0;
    (scenariosTbody?.querySelectorAll("tr") ?? []).forEach((row) => {
      total += Math.max(0, Number(row.querySelector('[data-field="occurrences"]')?.value) || 0);
    });
    if (totalOccEl) { totalOccEl.textContent = String(total); totalOccEl.classList.toggle("ya-total-warn", total !== 365); }
    if (occWarning) occWarning.hidden = total === 365;
  };

  const readScenarios = () =>
    [...(scenariosTbody?.querySelectorAll("tr") ?? [])].map((row) => ({
      label: row.querySelector('[data-field="label"]')?.value?.trim() || "",
      temperature: Number(row.querySelector('[data-field="temperature"]')?.value ?? 0),
      occurrences: Math.max(0, Number(row.querySelector('[data-field="occurrences"]')?.value ?? 0)),
    }));

  if (scenariosTbody) { scenariosTbody.addEventListener("input", updateTotalOcc); cleanups.push(() => scenariosTbody.removeEventListener("input", updateTotalOcc)); }
  updateTotalOcc();

  // ── Base run selection ──────────────────────────────────────────

  const renderConfigSummary = (run) => {
    if (!configSummary || !run) { if (configSummary) configSummary.hidden = true; return; }
    const id = text(run.id);
    const ip = run.input_params ?? {};
    const br = run.results?.battery_results ?? {};
    const meta = resolvedNames[id] ?? {};
    const packs = resolveOptimizedPacks(br);
    const kwh = resolveOptimizedKwh(br, meta.packSizeKwh);
    const mode = ip.mode ?? "—";
    const shiftLabel = meta.shiftLabel ?? "—";
    const modelLabel = meta.modelLabel ?? "—";
    const sizingTemp = meta.sizingTemp;

    const param = (label, value, highlight = false) =>
      `<div class="ya-config-param"><span class="ya-config-param-label">${textContent(label)}</span><span class="ya-config-param-value${highlight ? " ya-highlight" : ""}">${textContent(String(value))}</span></div>`;

    configSummary.innerHTML = [
      param("Shift", shiftLabel),
      param("Bus model", modelLabel),
      param("Mode", MODE_LABELS[mode] ?? mode),
      param("Sizing temp.", sizingTemp != null ? `${sizingTemp} °C` : "—", true),
      param("Packs", packs ?? "—", true),
      param("Capacity", kwh != null ? `${Math.round(kwh)} kWh` : "—", true),
    ].join("");
    configSummary.hidden = false;
  };

  const handleRunChange = () => {
    const id = baseSelect?.value ?? "";
    const run = feasibleRuns.find((r) => text(r.id) === id);
    renderConfigSummary(run ?? null);
  };

  if (baseSelect) { baseSelect.addEventListener("change", handleRunChange); cleanups.push(() => baseSelect.removeEventListener("change", handleRunChange)); }

  section.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
    const h = () => triggerPartialLoad("yearly-analysis-runs");
    btn.addEventListener("click", h);
    cleanups.push(() => btn.removeEventListener("click", h));
  });

  // ── Submit ──────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback("");

    const runId = baseSelect?.value ?? "";
    const baseRun = feasibleRuns.find((r) => text(r.id) === runId);
    if (!baseRun) { setFeedback("Select a base simulation."); return; }

    const ip = baseRun.input_params ?? {};
    const shiftIds = resolveShiftIds(baseRun);
    if (!shiftIds.length) { setFeedback("Base simulation has no shift IDs."); return; }

    const busModelId = text(ip.bus_model_id ?? "").trim();
    if (!busModelId) { setFeedback("Base simulation has no bus model."); return; }

    const optimizedPacks = resolveOptimizedPacks(baseRun.results?.battery_results ?? {});
    if (optimizedPacks == null) { setFeedback("Could not determine the optimized pack count from the base simulation."); return; }

    const scenarios = readScenarios();
    for (let i = 0; i < scenarios.length; i++) {
      const sc = scenarios[i];
      if (!sc.label) { setFeedback(`Scenario ${i + 1}: label is required.`); return; }
      if (!Number.isFinite(sc.temperature)) { setFeedback(`Scenario ${i + 1}: invalid temperature.`); return; }
      if (sc.occurrences < 0) { setFeedback(`Scenario ${i + 1}: occurrences cannot be negative.`); return; }
    }
    const totalOcc = scenarios.reduce((s, sc) => s + sc.occurrences, 0);
    if (totalOcc === 0) { setFeedback("Total occurrences cannot be zero."); return; }

    const meta = resolvedNames[text(baseRun.id)] ?? {};
    const pp = meta.predParams ?? {};
    const basePredParams = {
      model_name: pp.model_name || DEFAULT_PREDICTION_MODEL_NAME,
      occupancy_percent: pp.occupancy_percent ?? 50,
      auxiliary_heating_type: pp.auxiliary_heating_type || "default",
      quantiles: Array.isArray(pp.quantiles) && pp.quantiles.length ? pp.quantiles : DEFAULT_PREDICTION_QUANTILES,
    };

    const submitBtn = form?.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const scenarioResults = [];

    try {
      for (let i = 0; i < scenarios.length; i++) {
        const sc = scenarios[i];
        showProgress(`Prediction ${i + 1}/${scenarios.length}: ${sc.label} (${sc.temperature} °C) — ${optimizedPacks} packs…`);

        try {
          const predRuns = await createSinglePredictionRun({
            shift_ids: shiftIds,
            bus_model_id: busModelId,
            prediction_params: { ...basePredParams, external_temp_celsius: sc.temperature },
            num_battery_packs: optimizedPacks,
          });
          const predRun = predRuns[0] ?? null;
          const kpis = extractPredictionOnlyKpis(predRun);
          scenarioResults.push({ ...sc, kpis, error: null });
        } catch (err) {
          scenarioResults.push({ ...sc, kpis: null, error: err?.message ?? "Prediction failed" });
        }
      }

      hideProgress();

      const saveMeta = resolvedNames[text(baseRun.id)] ?? {};
      const yearlyTotals = computeYearlyTotals(scenarioResults);

      const analysis = saveAnalysis({
        status: scenarioResults.every((sr) => !sr.error)
          ? "completed"
          : scenarioResults.every((sr) => sr.error)
            ? "failed"
            : "partial",
        config: {
          shift_ids: shiftIds,
          bus_model_id: busModelId,
          mode: ip.mode ?? "battery_only",
          min_soc: ip.min_soc ?? 0,
          max_soc: ip.max_soc ?? 1,
          occupancy_percent: basePredParams.occupancy_percent,
          auxiliary_heating_type: basePredParams.auxiliary_heating_type,
        },
        scenarios,
        results: {
          scenarioResults,
          yearlyTotals,
          baseOptimizationRunId: text(baseRun.id),
          optimizedPacks,
          baseFeasible: resolveElectrificationFeasible(baseRun),
        },
        meta: {
          shiftNames: saveMeta.shiftNames ?? [],
          busModelName: saveMeta.modelLabel ?? busModelId,
          modeLabel: MODE_LABELS[ip.mode] ?? ip.mode ?? "—",
          sizingTemp: saveMeta.sizingTemp,
        },
      });

      triggerPartialLoad("yearly-analysis-results", { analysisId: analysis.id });
    } catch (err) {
      hideProgress();
      setFeedback(err?.message ?? "Yearly analysis failed.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  if (form) { form.addEventListener("submit", handleSubmit); cleanups.push(() => form.removeEventListener("submit", handleSubmit)); }

  // ── Load feasible simulations ───────────────────────────────────

  if (isAuthenticated()) {
    try {
      const [runsPayload, modelsPayload] = await Promise.all([
        fetchOptimizationRuns(),
        fetchBusModels({ skip: 0, limit: 1000 }),
      ]);

      const allRuns = Array.isArray(runsPayload) ? runsPayload : (runsPayload?.items ?? runsPayload?.results ?? []);
      const models = Array.isArray(modelsPayload) ? modelsPayload : (modelsPayload?.items ?? modelsPayload?.results ?? []);
      const currentUserId = text(await resolveUserId().catch(() => "")).trim();
      const userModels =
        currentUserId && Array.isArray(models)
          ? models.filter((m) => resolveResourceUserId(m) === currentUserId)
          : [];
      const modelsById = Object.fromEntries(userModels.filter((m) => m?.id).map((m) => [text(m.id), m]));

      feasibleRuns = allRuns.filter((run) => {
        if (!runBelongsToCurrentUser(run, currentUserId, modelsById)) return false;
        const status = text(run?.status ?? "").trim().toLowerCase();
        if (status !== "completed" && status !== "done") return false;
        if (resolveElectrificationFeasible(run) !== true) return false;
        if (resolveOptimizedPacks(run?.results?.battery_results ?? {}) == null) return false;
        return true;
      });

      // Resolve shift names (batch-fetch unique shift IDs)
      const shiftIdSet = new Set();
      for (const run of feasibleRuns) resolveShiftIds(run).forEach((id) => shiftIdSet.add(id));
      const shiftMap = new Map();
      const shiftFetches = [...shiftIdSet].map(async (id) => {
        try { const s = await fetchShiftById(id); shiftMap.set(id, s); } catch { /* skip */ }
      });
      await Promise.all(shiftFetches);

      // Resolve temperature + prediction params from each run's first prediction run
      const predParamsMap = new Map();
      const predFetches = feasibleRuns.map(async (run) => {
        const predIds = run?.input_params?.prediction_run_ids ?? [];
        const firstId = (Array.isArray(predIds) ? predIds : [])[0];
        if (!firstId) return;
        try {
          const pred = await fetchPredictionRun(firstId);
          predParamsMap.set(text(run.id), {
            external_temp_celsius: toFiniteNumber(pred?.external_temp_celsius),
            occupancy_percent: toFiniteNumber(pred?.occupancy_percent),
            auxiliary_heating_type: text(pred?.auxiliary_heating_type ?? "").trim() || null,
            model_name: text(pred?.model_name ?? "").trim() || null,
            quantiles: pred?.contextual_parameters?.quantiles ?? null,
          });
        } catch { /* skip */ }
      });
      await Promise.all(predFetches);

      // Build resolved display names per run
      for (const run of feasibleRuns) {
        const id = text(run.id);
        const sids = resolveShiftIds(run);
        const shiftNames = sids.map((sid) => text(shiftMap.get(sid)?.name ?? "")).filter(Boolean);
        const shiftLabel = shiftNames.length ? shiftNames.join(", ") : sids.map((s) => s.slice(0, 8)).join(", ");
        const bmId = resolveBusModelId(run);
        const bm = modelsById[bmId];
        const bmResolved = bm ? resolveModelFields(bm) : {};
        const modelLabel = [bmResolved.manufacturer, bmResolved.model].filter(Boolean).join(" – ") || bmId.slice(0, 8);
        const packSizeKwh = toFiniteNumber(bm?.specs?.battery_pack_size_kwh ?? (typeof bm?.specs === "string" ? JSON.parse(bm.specs)?.battery_pack_size_kwh : null));
        const predParams = predParamsMap.get(id) ?? {};
        resolvedNames[id] = { shiftLabel, shiftNames, modelLabel, packSizeKwh, predParams, sizingTemp: predParams.external_temp_celsius ?? null };
      }

      // Populate dropdown
      if (baseSelect) {
        baseSelect.innerHTML = "";
        if (!feasibleRuns.length) {
          const o = document.createElement("option");
          o.value = ""; o.disabled = true; o.selected = true;
          o.textContent = "No feasible simulations found";
          baseSelect.appendChild(o);
        } else {
          const placeholder = document.createElement("option");
          placeholder.value = ""; placeholder.disabled = true; placeholder.selected = true;
          placeholder.textContent = "Select a simulation…";
          baseSelect.appendChild(placeholder);

          for (const run of feasibleRuns) {
            const id = text(run.id);
            const meta = resolvedNames[id] ?? {};
            const br = run.results?.battery_results ?? {};
            const packs = resolveOptimizedPacks(br);
            const kwh = resolveOptimizedKwh(br, meta.packSizeKwh);
            const date = run.created_at ? new Date(run.created_at).toLocaleDateString() : "";

            const label = [
              date,
              meta.shiftLabel,
              meta.modelLabel,
              packs != null ? `${packs} packs` : "",
              kwh != null ? `${Math.round(kwh)} kWh` : "",
              meta.sizingTemp != null ? `@ ${meta.sizingTemp} °C` : "",
            ].filter(Boolean).join(" · ");

            const o = document.createElement("option");
            o.value = id;
            o.textContent = label;
            baseSelect.appendChild(o);
          }
        }
      }
    } catch (err) {
      setFeedback(err?.message ?? "Failed to load simulations.");
    }
  }

  return () => cleanups.forEach((h) => h());
};
