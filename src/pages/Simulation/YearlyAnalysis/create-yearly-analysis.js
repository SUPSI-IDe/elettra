import "../evaluation-dialogs.css";
import "./create-yearly-analysis.css";
import { createYearlyDialogs } from "./yearly-dialogs";
import { t } from "../../../i18n";
import { fetchAllBusModels, fetchBusModelById } from "../../../api";
import {
  createYearlyPredictionRuns,
  fetchAllOptimizationRuns,
  fetchOptimizationRun,
  fetchPredictionRun,
  fetchPvgisTmy,
  fetchWeatherTemperatureClusters,
  fetchYearlyWeatherReference,
  createWeatherTemperatureClusters,
  createYearlyAnalysis,
  updateYearlyAnalysis,
} from "../../../api/simulation";
import { fetchShiftById } from "../../../api/shifts";
import { isAuthenticated, resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { textContent, resolveBusModelDisplayName } from "../../../ui-helpers";
import {
  DEFAULT_PREDICTION_QUANTILES,
} from "../../../config/simulation-defaults";
import {
  MODE_LABELS,
  MODE_LABEL_KEYS,
} from "./yearly-analysis-store";
import { extractShiftDistanceKm } from "../../../utils/shift-distance";
import { getOptimizationRunDisplayName } from "../../../utils/optimization-run";
import {
  buildFixedYearlyConfiguration,
  buildYearlyPredictionGroups,
  buildYearlyAnalysisResults,
  buildYearlyScenarioOutcome,
  normalizeYearlyScenarios,
} from "../../../utils/yearly-analysis-model";

const text = (v) => (v === null || v === undefined ? "" : String(v));

const modeLabel = (mode) => {
  const key = MODE_LABEL_KEYS[mode];
  return key ? t(key) : MODE_LABELS[mode] ?? mode ?? "—";
};

const toFiniteNumber = (v) => {
  if (v === "" || (typeof v === "string" && v.trim() === "")) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatScenarioValue = (value, decimals = 1) => {
  const numeric = toFiniteNumber(value);
  return numeric != null ? numeric.toFixed(decimals) : "—";
};

const temperatureToColor = (temperature, minTemperature, maxTemperature) => {
  const value = toFiniteNumber(temperature);
  if (value == null) return "hsl(220 78% 55%)";

  const min = toFiniteNumber(minTemperature);
  const max = toFiniteNumber(maxTemperature);
  const ratio = min != null && max != null && max > min ? (value - min) / (max - min) : 0.5;
  const clamped = Math.max(0, Math.min(1, ratio));
  const hue = 220 - (220 * clamped);
  return `hsl(${hue} 78% 55%)`;
};

// ── Extract info from an optimization run ────────────────────────────

const resolveElectrificationFeasible = (run = {}) => {
  if (run?.results?.integrity_audit?.yearly_eligible !== true) return false;
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

// ── Main initializer ─────────────────────────────────────────────────

export const initializeCreateYearlyAnalysis = async (root = document) => {
  const section = root.querySelector("section.create-yearly-analysis");
  if (!section) return null;

  const cleanups = [];
  const form = section.querySelector("form");
  const nameInput = section.querySelector("#ya-analysis-name");
  const baseSelect = section.querySelector('[data-role="base-run-select"]');
  const configSummary = section.querySelector('[data-role="config-summary"]');
  const configSummaryBody = section.querySelector(
    '[data-role="config-summary-body"]'
  );
  const scenariosTbody = section.querySelector('[data-role="scenarios-body"]');
  const totalOccEl = section.querySelector('[data-role="total-occurrences"]');
  const occWarning = section.querySelector('[data-role="occurrences-warning"]');
  const occupancySelect = section.querySelector('[data-role="occupancy-select"]');
  const occupancyNote = section.querySelector('[data-role="occupancy-note"]');
  const feedbackEl = section.querySelector('[data-role="feedback"]');
  const dialogs = createYearlyDialogs(section);
  cleanups.push(() => dialogs.dispose());

  let feasibleRuns = [];
  let resolvedNames = {};
  let modelsById = {};
  const shiftMap = new Map();
  const runDetailPromises = new Map();
  const modelDetailPromises = new Map();
  let runSelectionVersion = 0;
  let scenarioRows = [];
  let weatherReference = null;
  let weatherRequestVersion = 0;
  const weatherReferenceNote = section.querySelector('[data-role="weather-reference"]');

  const setFeedback = (msg, tone = "error") => {
    if (!feedbackEl) return;
    if (msg) { feedbackEl.textContent = msg; feedbackEl.dataset.tone = tone; feedbackEl.hidden = false; }
    else { feedbackEl.textContent = ""; feedbackEl.hidden = true; }
  };
  const showProgress = dialogs.showProgress;
  const hideProgress = dialogs.closeProgress;

  const loadModelDetail = async (modelId) => {
    const id = text(modelId).trim();
    if (!id) return null;
    const cached = modelsById[id];
    if (cached?.specs) return cached;
    if (!modelDetailPromises.has(id)) {
      modelDetailPromises.set(
        id,
        fetchBusModelById(id)
          .then((detail) => {
            const merged = { ...(cached ?? {}), ...(detail ?? {}) };
            modelsById[id] = merged;
            return merged;
          })
          .catch((error) => {
            modelDetailPromises.delete(id);
            throw error;
          })
      );
    }
    return modelDetailPromises.get(id);
  };

  const hydrateRunForSelection = async (summaryRun) => {
    const id = text(summaryRun?.id).trim();
    if (!id) throw new Error(t("yearly_analysis.select_feasibility"));
    if (runDetailPromises.has(id)) return runDetailPromises.get(id);

    const pending = (async () => {
      const run =
        summaryRun?.results && summaryRun?.input_params
          ? summaryRun
          : { ...summaryRun, ...(await fetchOptimizationRun(id)) };

      if (
        resolveElectrificationFeasible(run) !== true ||
        resolveOptimizedPacks(run?.results?.battery_results ?? {}) == null
      ) {
        throw new Error(t("yearly_analysis.no_feasible_evaluations"));
      }

      const shiftIds = resolveShiftIds(run);
      const busModelId = resolveBusModelId(run);
      const predictionIds = run?.input_params?.prediction_run_ids ?? [];
      const firstPredictionId = Array.isArray(predictionIds)
        ? predictionIds[0]
        : null;

      const [busModel, prediction] = await Promise.all([
        loadModelDetail(busModelId),
        firstPredictionId
          ? fetchPredictionRun(firstPredictionId).catch(() => null)
          : Promise.resolve(null),
        ...shiftIds.map(async (shiftId) => {
          if (shiftMap.has(shiftId)) return shiftMap.get(shiftId);
          try {
            const shift = await fetchShiftById(shiftId);
            shiftMap.set(shiftId, shift);
            return shift;
          } catch {
            return null;
          }
        }),
      ]);

      const shiftNamesById = Object.fromEntries(
        shiftIds.map((shiftId) => [
          shiftId,
          text(shiftMap.get(shiftId)?.name ?? "").trim() || shiftId,
        ])
      );
      const shiftNames = shiftIds.map((shiftId) => shiftNamesById[shiftId]);
      const shiftLabel = shiftNames.length
        ? shiftNames.join(", ")
        : shiftIds.map((shiftId) => shiftId.slice(0, 8)).join(", ");
      const modelLabel = busModel
        ? resolveBusModelDisplayName(busModel) || busModelId.slice(0, 8)
        : busModelId.slice(0, 8);
      const modelSpecs =
        typeof busModel?.specs === "string"
          ? JSON.parse(busModel.specs)
          : busModel?.specs;
      const packSizeKwh = toFiniteNumber(modelSpecs?.battery_pack_size_kwh);
      const predParams = prediction
        ? {
            external_temp_celsius: toFiniteNumber(
              prediction.external_temp_celsius
            ),
            occupancy_percent: toFiniteNumber(prediction.occupancy_percent),
            auxiliary_heating_type:
              text(prediction.auxiliary_heating_type).trim() || null,
            model_name: text(prediction.model_name).trim() || null,
            quantiles: prediction?.contextual_parameters?.quantiles ?? null,
          }
        : {};

      resolvedNames[id] = {
        busModelSnapshot: modelSpecs ?? null,
        shiftLabel,
        shiftNames,
        shiftNamesById,
        modelLabel,
        packSizeKwh,
        predParams,
        sizingTemp: predParams.external_temp_celsius ?? null,
      };
      feasibleRuns = feasibleRuns.map((candidate) =>
        text(candidate?.id) === id ? run : candidate
      );
      return run;
    })().catch((error) => {
      runDetailPromises.delete(id);
      throw error;
    });

    runDetailPromises.set(id, pending);
    return pending;
  };

  // ── Scenarios tracking ──────────────────────────────────────────

  const updateTotalOcc = () => {
    const total = scenarioRows.reduce(
      (sum, row) => sum + Math.max(0, Number(row?.occurrences) || 0),
      0
    );
    const hasScenarios = scenarioRows.length > 0;
    const hasInvalidTotal = hasScenarios && total !== 365;
    if (totalOccEl) {
      totalOccEl.textContent = hasScenarios ? String(total) : "—";
      totalOccEl.classList.toggle("ya-total-warn", hasInvalidTotal);
    }
    if (occWarning) occWarning.hidden = !hasInvalidTotal;
  };

  const readScenarios = () =>
    scenarioRows.map((row) => ({
      label: text(row?.label).trim(),
      temperature: Number(row?.temperature ?? 0),
      occurrences: Math.max(0, Number(row?.occurrences ?? 0)),
    }));

  const renderScenariosPlaceholder = (msg) => {
    if (!scenariosTbody) return;
    scenarioRows = [];
    scenariosTbody.innerHTML = `<tr><td colspan="3" class="ya-scenarios-placeholder">${textContent(msg)}</td></tr>`;
    updateTotalOcc();
  };

  const renderClusterScenarios = (clusters) => {
    if (!scenariosTbody || !Array.isArray(clusters) || !clusters.length) return;
    scenarioRows = [...clusters]
      .sort((a, b) => a.temperature - b.temperature)
      .map((cluster, index) => ({
        label: text(cluster.label || t("yearly_analysis.cluster_label", { index: index + 1 })).trim(),
        temperature: Number.isFinite(cluster.temperature) ? cluster.temperature : 0,
        occurrences: Number.isFinite(cluster.occurrences) ? cluster.occurrences : 0,
      }));
    const temperatures = scenarioRows.map((scenario) => scenario.temperature);
    const minTemperature = temperatures.length ? Math.min(...temperatures) : null;
    const maxTemperature = temperatures.length ? Math.max(...temperatures) : null;

    scenariosTbody.innerHTML = scenarioRows.map((scenario) => {
      const temperatureColor = temperatureToColor(scenario.temperature, minTemperature, maxTemperature);
      return `<tr>
        <td class="ya-scenarios-color-cell">
          <span
            class="ya-scenarios-swatch"
            style="background-color: ${temperatureColor};"
            title="${textContent(`${formatScenarioValue(scenario.temperature, 1)} °C`)}"
            aria-label="${textContent(t("yearly_analysis.temperature_degrees_celsius", { value: formatScenarioValue(scenario.temperature, 1) }))}"
          ></span>
        </td>
        <td class="ya-scenarios-number">${formatScenarioValue(scenario.temperature, 1)}</td>
        <td class="ya-scenarios-number">${formatScenarioValue(scenario.occurrences, 0)}</td>
      </tr>`;
    }).join("");
    updateTotalOcc();
  };

  const parseClusters = (payload) => {
    if (!payload) return [];
    const raw = payload.clusters ?? (Array.isArray(payload) ? payload : []);
    if (!Array.isArray(raw)) return [];
    return raw.map((c, i) => {
      const temp = toFiniteNumber(c.centroid_daily_avg_temp ?? c.centroid ?? c.centroid_temperature ?? c.temperature);
      const occ = toFiniteNumber(c.occurrences ?? c.count ?? c.n_days);
      return {
        label: text(c.label || c.name || t("yearly_analysis.cluster_label", { index: i + 1 })),
        temperature: temp != null ? Math.round(temp * 10) / 10 : 0,
        occurrences: occ != null ? Math.round(occ) : 0,
      };
    });
  };

  const loadClustersForRun = async (run) => {
    const version = ++weatherRequestVersion;
    weatherReference = null;
    if (weatherReferenceNote) weatherReferenceNote.hidden = true;
    const sids = resolveShiftIds(run);
    if (!sids.length) {
      renderScenariosPlaceholder(t("yearly_analysis.no_shifts_for_clusters"));
      return;
    }
    renderScenariosPlaceholder(t("yearly_analysis.loading_temperature_clusters"));
    try {
      const reference = await fetchYearlyWeatherReference(run.id);
      if (version !== weatherRequestVersion) return;
      const loc = {lat: reference.latitude, lon: reference.longitude};
      let payload = await fetchWeatherTemperatureClusters({ latitude: loc.lat, longitude: loc.lon });
      if (version !== weatherRequestVersion) return;

      if (!payload) {
        renderScenariosPlaceholder(t("yearly_analysis.creating_temperature_clusters"));
        await fetchPvgisTmy({ latitude: loc.lat, longitude: loc.lon });
        await createWeatherTemperatureClusters({ latitude: loc.lat, longitude: loc.lon });
        payload = await fetchWeatherTemperatureClusters({ latitude: loc.lat, longitude: loc.lon });
      }

      if (!payload) {
        renderScenariosPlaceholder(t("yearly_analysis.no_weather_cluster_data"));
        return;
      }
      if (version !== weatherRequestVersion) return;
      const clusters = parseClusters(payload);
      if (!clusters.length) {
        renderScenariosPlaceholder(t("yearly_analysis.no_clusters_returned"));
        return;
      }
      weatherReference = {...reference, runId: text(run.id)};
      if (weatherReferenceNote) {
        weatherReferenceNote.textContent = t('yearly_analysis.weather_reference', {depot: reference.depot_name});
        weatherReferenceNote.hidden = false;
      }
      renderClusterScenarios(clusters);
    } catch (err) {
      if (version !== weatherRequestVersion) return;
      renderScenariosPlaceholder(t("yearly_analysis.failed_load_clusters", { message: err?.message ?? t("buses.unknown") }));
    }
  };

  updateTotalOcc();

  // ── Base run selection ──────────────────────────────────────────

  const setOccupancyFromRun = (run) => {
    if (!occupancySelect) return;
    const id = text(run?.id);
    const meta = resolvedNames[id] ?? {};
    const feasOcc = toFiniteNumber(meta.predParams?.occupancy_percent) ?? 50;

    const matchOption = [...occupancySelect.options].find((o) => Number(o.value) === feasOcc);
    if (matchOption) {
      occupancySelect.value = matchOption.value;
    } else {
      occupancySelect.value = "50";
    }

    if (occupancyNote) {
      occupancyNote.textContent = t("yearly_analysis.default_occupancy_note", { occupancy: feasOcc });
      occupancyNote.hidden = false;
    }
  };

  const renderConfigSummary = (run) => {
    if (!configSummary || !configSummaryBody || !run) {
      if (configSummary) configSummary.hidden = true;
      if (configSummaryBody) configSummaryBody.innerHTML = "";
      return;
    }
    const id = text(run.id);
    const ip = run.input_params ?? {};
    const meta = resolvedNames[id] ?? {};
    const fixedConfiguration = buildFixedYearlyConfiguration(run, {
      shiftNamesById: meta.shiftNamesById ?? {},
      packSizeKwh: meta.packSizeKwh,
    });
    const selectedSizes = [...new Set(fixedConfiguration.shifts.map(s => s.battery?.selectedPacks).filter(v => v != null))];
    const packs = selectedSizes.join(" / ");
    const kwh = fixedConfiguration.battery.uniform ? fixedConfiguration.battery.nominalKwh : null;
    const mode = ip.mode ?? "—";
    const shiftLabel = meta.shiftLabel ?? "—";
    const sizingTemp = meta.sizingTemp;

    const cell = (value, highlight = false) =>
      `<td${highlight ? ' class="ya-config-table__highlight"' : ""}>${textContent(String(value))}</td>`;

    configSummaryBody.innerHTML = `<tr>
      ${cell(shiftLabel)}
      ${cell(modeLabel(mode))}
      ${cell(sizingTemp != null ? `${sizingTemp} °C` : "—", true)}
      ${cell(packs ?? "—", true)}
      ${cell(kwh != null ? `${Math.round(kwh)} kWh` : "—", true)}
    </tr>`;
    configSummary.hidden = false;

    setOccupancyFromRun(run);
  };

  const formatRunOptionLabel = (run) => {
    const id = text(run?.id);
    const meta = resolvedNames[id] ?? {};
    const date = run?.created_at
      ? new Date(run.created_at).toLocaleDateString()
      : "";
    const parts = [
      getOptimizationRunDisplayName(run, meta.shiftLabel),
      date,
      meta.modelLabel,
    ];

    if (run?.results && run?.input_params) {
      const fixedConfiguration = buildFixedYearlyConfiguration(run, {
        shiftNamesById: meta.shiftNamesById ?? {},
        packSizeKwh: meta.packSizeKwh,
      });
      const selectedSizes = [
        ...new Set(
          fixedConfiguration.shifts
            .map((shift) => shift.battery?.selectedPacks)
            .filter((value) => value != null)
        ),
      ];
      const packs = selectedSizes.join(" / ");
      const kwh = fixedConfiguration.battery.uniform
        ? fixedConfiguration.battery.nominalKwh
        : null;
      parts.push(
        packs ? t("yearly_analysis.packs_value", { count: packs }) : "",
        kwh != null ? `${Math.round(kwh)} kWh` : "",
        meta.sizingTemp != null ? `@ ${meta.sizingTemp} °C` : ""
      );
    }

    return parts.filter(Boolean).join(" · ");
  };

  const handleRunChange = async () => {
    const version = ++runSelectionVersion;
    const id = baseSelect?.value ?? "";
    const summaryRun = feasibleRuns.find((r) => text(r.id) === id);
    renderConfigSummary(null);
    if (!summaryRun) {
      renderScenariosPlaceholder(t("yearly_analysis.select_evaluation_for_scenarios"));
      return;
    }

    setFeedback(t("yearly_analysis.loading_evaluations"), "info");
    try {
      const run = await hydrateRunForSelection(summaryRun);
      if (version !== runSelectionVersion) return;
      const option = Array.from(baseSelect?.options ?? []).find(
        (candidate) => candidate.value === id
      );
      if (option) option.textContent = formatRunOptionLabel(run);
      setFeedback("");
      renderConfigSummary(run);
      void loadClustersForRun(run);
    } catch (error) {
      if (version !== runSelectionVersion) return;
      setFeedback(
        error?.message ?? t("yearly_analysis.failed_load_simulations")
      );
      renderScenariosPlaceholder(
        t("yearly_analysis.select_evaluation_for_scenarios")
      );
    }
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

    const analysisName = text(nameInput?.value).trim();
    if (!analysisName) { alert(t("yearly_analysis.enter_name")); nameInput?.focus(); return; }

    const runId = baseSelect?.value ?? "";
    const summaryRun = feasibleRuns.find((r) => text(r.id) === runId);
    if (!summaryRun) { alert(t("yearly_analysis.select_feasibility")); baseSelect?.focus(); return; }
    let baseRun;
    try {
      baseRun = await hydrateRunForSelection(summaryRun);
    } catch (error) {
      setFeedback(error?.message ?? t("yearly_analysis.failed_load_simulations"));
      return;
    }

    const ip = baseRun.input_params ?? {};
    const shiftIds = resolveShiftIds(baseRun);
    if (!shiftIds.length) { alert(t("yearly_analysis.no_shift_ids")); return; }

    const busModelId = text(ip.bus_model_id ?? "").trim();
    if (!busModelId) { alert(t("yearly_analysis.no_bus_model")); return; }

    const saveMeta = resolvedNames[text(baseRun.id)] ?? {};
    const fixedConfiguration = buildFixedYearlyConfiguration(baseRun, {
      shiftNamesById: saveMeta.shiftNamesById ?? {},
      packSizeKwh: saveMeta.packSizeKwh,
    });
    const commonPacks = fixedConfiguration.battery.packs;
    if (commonPacks == null) { alert(t("yearly_analysis.no_optimized_pack_count")); return; }
    const predictionGroups = buildYearlyPredictionGroups(fixedConfiguration);

    if (weatherReference?.runId !== text(baseRun.id)) {
      setFeedback(t('yearly_analysis.loading_temperature_clusters'));
      return;
    }
    const scenarios = normalizeYearlyScenarios(readScenarios());
    for (let i = 0; i < scenarios.length; i++) {
      const sc = scenarios[i];
      if (!sc.label) { alert(t("yearly_analysis.scenario_label_required", { index: i + 1 })); return; }
      if (!Number.isFinite(sc.temperature)) { alert(t("yearly_analysis.scenario_temperature_invalid", { index: i + 1 })); return; }
      if (sc.occurrences < 0) { alert(t("yearly_analysis.scenario_occurrences_negative", { index: i + 1 })); return; }
    }
    const totalOcc = scenarios.reduce((s, sc) => s + sc.occurrences, 0);
    if (totalOcc === 0) { alert(t("yearly_analysis.total_occurrences_zero")); return; }

    if (!await dialogs.confirm({
      name: analysisName, shiftCount: shiftIds.length,
      scenarioCount: scenarios.length, depot: weatherReference.depot_name,
    })) return;

    const chosenOccupancy = toFiniteNumber(occupancySelect?.value) ?? 50;

    const pp = saveMeta.predParams ?? {};
    const basePredParams = {
      occupancy_percent: chosenOccupancy,
      auxiliary_heating_type: pp.auxiliary_heating_type || "default",
      quantiles: Array.isArray(pp.quantiles) && pp.quantiles.length ? pp.quantiles : DEFAULT_PREDICTION_QUANTILES,
    };

    const submitBtn = form?.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      // 1) Build analysis metadata
      const features = {
        config: {
          shift_ids: shiftIds,
          bus_model_id: busModelId,
          bus_model_snapshot: saveMeta.busModelSnapshot ?? null,
          mode: ip.mode ?? "battery_only",
          min_soc: fixedConfiguration.soc.minFraction,
          max_soc: fixedConfiguration.soc.maxFraction,
          state_of_health: fixedConfiguration.operatingAssumptions.state_of_health,
          operating_assumptions: fixedConfiguration.operatingAssumptions,
          occupancy_percent: basePredParams.occupancy_percent,
          auxiliary_heating_type: basePredParams.auxiliary_heating_type,
          fixedConfiguration,
          weather_reference: weatherReference,
        },
        scenarios,
        meta: {
          shiftNames: saveMeta.shiftNames ?? [],
          shifts: fixedConfiguration.shifts.map(({ shiftId, shiftName }) => ({
            shiftId,
            shiftName,
          })),
          busModelName: saveMeta.modelLabel ?? busModelId,
          modeLabel: modeLabel(ip.mode),
          sizingTemp: saveMeta.sizingTemp,
        },
      };

      const totalPredictions = scenarios.length * shiftIds.length;

      // 2) Create the yearly analysis record on the backend FIRST
      showProgress(t("yearly_analysis.creating_analysis"), 0, totalPredictions);
      const analysis = await createYearlyAnalysis({
        name: analysisName,
        optimization_run_id: text(baseRun.id) || null,
        weather_temperature_series_id: weatherReference.weather_temperature_series_id,
        features,
      });

      const analysisId = text(analysis.id);

      // 3) Submit every weather scenario together, retaining each duty's battery.
      const outcomes = [];
      const reportPredictions = ({ completed = 0, total = totalPredictions } = {}) => {
        showProgress(t("yearly_analysis.combined_prediction_progress", {
          completed, total, scenarios: scenarios.length,
        }), completed, total);
      };
      reportPredictions();
      try {
        const forecasts = await createYearlyPredictionRuns({
          yearly_analysis_id: analysisId, bus_model_id: busModelId,
          scenarios, predictionGroups, prediction_params: basePredParams,
          onProgress: reportPredictions,
        });
        for (const { scenario, predictionRuns } of forecasts) {
          outcomes.push(buildYearlyScenarioOutcome({ scenario, shiftIds, predictionRuns }));
        }
      } catch (err) {
        for (const scenario of scenarios) {
          outcomes.push(buildYearlyScenarioOutcome({
            scenario, shiftIds, failure: err?.message ?? t("yearly_analysis.prediction_failed"),
          }));
        }
      }

      showProgress(t("yearly_analysis.saving_results"), totalPredictions, totalPredictions);

      // 4) Resolve nominal shift distance (reference/planned distance)
      const nominalDailyDistanceKmByShiftId = {};
      for (const sid of shiftIds) {
        const shift = shiftMap.get(sid);
        nominalDailyDistanceKmByShiftId[sid] = shift
          ? extractShiftDistanceKm(shift)
          : null;
      }

      // 5) Update the analysis with computed results
      const annualResults = buildYearlyAnalysisResults({
        scenarios,
        outcomes,
        fixedConfiguration,
        nominalDailyDistanceKmByShiftId,
      });

      await updateYearlyAnalysis(analysisId, {
        features: {
          ...features,
          results: {
            ...annualResults,
            baseOptimizationRunId: text(baseRun.id),
            // Backward-compatible field consumed by the v0.4 results page.
            optimizedPacks: commonPacks,
            baseFeasible: resolveElectrificationFeasible(baseRun),
          },
          status: annualResults.status,
        },
      });

      triggerPartialLoad("yearly-analysis-results", { analysisId });
    } catch (err) {
      hideProgress();
      setFeedback(err?.message ?? t("yearly_analysis.failed"));
    } finally {
      hideProgress();
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  if (form) { form.addEventListener("submit", handleSubmit); cleanups.push(() => form.removeEventListener("submit", handleSubmit)); }

  // ── Load feasible simulations ───────────────────────────────────

  if (isAuthenticated()) {
    try {
      // Both endpoints are paginated server-side now — page through them
      // with their dedicated helpers instead of requesting limit=1000.
      const currentUserId = text(await resolveUserId().catch(() => "")).trim();
      if (!currentUserId) {
        throw new Error("Unable to resolve current user.");
      }
      const [allRuns, models] = await Promise.all([
        fetchAllOptimizationRuns({ includeBasisVariants: true }),
        fetchAllBusModels({ userId: currentUserId }),
      ]);

      const userModels =
        currentUserId && Array.isArray(models)
          ? models.filter((m) => text(m?.user_id) === currentUserId)
          : (models ?? []);
      modelsById = Object.fromEntries(
        userModels.filter((model) => model?.id).map((model) => [text(model.id), model])
      );

      // First pass: cheap server-side filter using fields available on
      // the lightweight list response (status, electrification_feasible).
      const candidateRuns = allRuns.filter((run) => {
        const runUserId = text(run?.user_id ?? run?.userId ?? "").trim();
        if (currentUserId && runUserId && runUserId !== currentUserId) return false;
        const status = text(run?.status ?? "").trim().toLowerCase();
        if (status !== "completed" && status !== "done") return false;
        return (
          run?.electrification_feasible === true &&
          run?.yearly_eligible !== false
        );
      });
      feasibleRuns = candidateRuns;
      resolvedNames = Object.fromEntries(
        feasibleRuns.map((run) => {
          const busModelId = resolveBusModelId(run);
          const busModel = modelsById[busModelId];
          return [
            text(run.id),
            {
              modelLabel: busModel
                ? resolveBusModelDisplayName(busModel) || busModelId.slice(0, 8)
                : busModelId.slice(0, 8),
            },
          ];
        })
      );

      // Populate dropdown
      if (baseSelect) {
        baseSelect.innerHTML = "";
        if (!feasibleRuns.length) {
          const o = document.createElement("option");
          o.value = ""; o.disabled = true; o.selected = true;
          o.textContent = t("yearly_analysis.no_feasible_evaluations");
          baseSelect.appendChild(o);
        } else {
          const placeholder = document.createElement("option");
          placeholder.value = ""; placeholder.disabled = true; placeholder.selected = true;
          placeholder.textContent = t("yearly_analysis.select_evaluation_placeholder");
          baseSelect.appendChild(placeholder);

          for (const run of feasibleRuns) {
            const id = text(run.id);
            const o = document.createElement("option");
            o.value = id;
            o.textContent = formatRunOptionLabel(run);
            baseSelect.appendChild(o);
          }
        }
      }
    } catch (err) {
      setFeedback(err?.message ?? t("yearly_analysis.failed_load_simulations"));
    }
  }

  return () => cleanups.forEach((h) => h());
};
