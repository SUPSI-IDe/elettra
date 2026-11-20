import { buildFeasibilityAssessment } from './feasibility-assessment.js';
import { buildFeasibilityExportDocument } from './feasibility-export.js';
import { resolveFeasibilityDemandBasis } from './feasibility-demand-basis.js';

const id = value => value == null ? null : String(value).trim() || null;
const terminal = run => ['completed', 'done', 'failed', 'error'].includes(run?.status);
const predictionIds = run => [...new Set([
  ...(run.prediction_run_ids ?? []), ...Object.values(run.results?.selected_prediction_run_ids ?? {}),
  ...Object.values(run.results?.initial_reference_prediction_run_ids ?? {}),
  ...Object.values(run.input_params?.reference_prediction_run_ids ?? {}),
].map(id).filter(Boolean))];
const aborted = () => new DOMException('Export cancelled', 'AbortError');

/** Capture the click-time design synchronously, then collect related results with read-only dependencies. */
export async function loadFeasibilityExport({ entryRun, entryPredictionRuns = [], cachedDesigns = new Map(),
  currentBusModel = {}, shiftNamesById = {}, fetchRun, lookupBasis, resolvePredictions,
  signal, requestTimeoutMs = 15000, exportedAt = new Date().toISOString() }) {
  const captured = structuredClone({ entryRun, entryPredictionRuns, cachedDesigns, currentBusModel, shiftNamesById });
  if (!id(captured.entryRun?.id)) throw new Error('No saved feasibility evaluation is loaded');
  const entryId = id(captured.entryRun.id);
  const check = () => { if (signal?.aborted) throw aborted(); };
  const request = async operation => {
    check();
    const controller = new AbortController();
    let timer, rejectAbort;
    const cancellation = new Promise((_, reject) => { rejectAbort = reject; });
    const cancel = () => { controller.abort(); rejectAbort(aborted()); };
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      rejectAbort(new Error('Feasibility export request timed out'));
    }, requestTimeoutMs);
    try { return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), cancellation]); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  };
  const seeds = new Map([[entryId, captured.entryPredictionRuns]]);
  const pendingRuns = new Map();
  const getRun = key => {
    if (pendingRuns.has(key)) return pendingRuns.get(key);
    const pending = (async () => {
      if (key === entryId) return captured.entryRun;
      const cached = captured.cachedDesigns.get(key);
      if (terminal(cached?.run)) {
        seeds.set(key, cached.predictionRuns ?? []);
        return cached.run;
      }
      const run = await request(requestSignal => fetchRun(key, { signal: requestSignal }));
      if (id(run?.id) !== key) throw new Error('Unexpected feasibility design ID');
      return run;
    })();
    pendingRuns.set(key, pending);
    return pending;
  };
  const collectionIssues = [];
  const rootId = id(captured.entryRun.input_params?.basis_source_run_id) ??
    id(captured.entryRun.input_params?.basis_run_ids?.mean) ?? entryId;
  let root;
  try { root = await getRun(rootId); }
  catch (error) {
    check();
    collectionIssues.push({ code: 'source_design_loading_failed', runId: rootId, error: error.message });
  }
  const references = { ...(root?.input_params?.basis_run_ids ?? {}), ...(captured.entryRun.input_params?.basis_run_ids ?? {}) };
  const entryBasis = resolveFeasibilityDemandBasis(captured.entryRun.input_params);
  const profiles = await Promise.all(['mean', 'aggregate_q95'].filter(key => key !== entryBasis).map(async key => {
    let runId = id(references[key]);
    try {
      if (!runId && root && resolveFeasibilityDemandBasis(root.input_params) === key) runId = rootId;
      if (!runId) {
        const found = await request(requestSignal => lookupBasis(rootId, key, { start: false, signal: requestSignal }));
        runId = id(found?.optimization_run_id);
        if (!runId) return { missing: { basis: key, runId: null,
          status: found?.status === 'not_calculated' ? 'not_calculated' : 'unavailable' } };
      }
      const run = root?.id === runId ? root : await getRun(runId);
      if (resolveFeasibilityDemandBasis(run.input_params) !== key) throw new Error('Unexpected feasibility design basis');
      return { run };
    } catch (error) {
      check();
      return { missing: { basis: key, runId, status: 'unavailable', error: error.message } };
    }
  }));
  check();
  const runs = [captured.entryRun, ...profiles.filter(row => row.run).map(row => row.run)];
  const known = new Map();
  for (const run of runs) for (const prediction of seeds.get(id(run.id)) ?? []) {
    if (!known.has(id(prediction.id))) known.set(id(prediction.id), prediction);
  }
  const wantedByRun = new Map(runs.map(run => [id(run.id), [...new Set([
    ...predictionIds(run), ...(seeds.get(id(run.id)) ?? []).map(row => id(row.id)).filter(Boolean),
  ])]]));
  const missingIds = [...new Set([...wantedByRun.values()].flat())].filter(key => !known.has(key));
  if (missingIds.length) {
    try {
      const resolved = await request(requestSignal => resolvePredictions(missingIds, { signal: requestSignal }));
      for (const prediction of resolved.runs ?? []) if (missingIds.includes(id(prediction.id))) known.set(id(prediction.id), prediction);
      for (const failure of resolved.errors ?? []) collectionIssues.push({ code: 'prediction_loading_failed',
        predictionRunId: id(failure.id), error: failure.error?.message ?? String(failure.error) });
    } catch (error) {
      check();
      collectionIssues.push({ code: 'prediction_loading_failed', error: error.message });
    }
  }
  check();
  const designs = runs.map(run => {
    const options = { optimizationRun: run,
      predictionRuns: wantedByRun.get(id(run.id)).map(key => known.get(key)).filter(Boolean),
      currentBusModel: captured.currentBusModel, shiftNamesById: captured.shiftNamesById };
    const assessment = buildFeasibilityAssessment({ ...options, scope: 'general' });
    const shiftIds = [...new Set([...assessment.model.shifts.map(row => row.shiftId),
      ...assessment.infeasibility.rows.map(row => row.shiftId)])];
    return { assessment, shiftAssessments: shiftIds.map(scope => buildFeasibilityAssessment({ ...options, scope })) };
  });
  return buildFeasibilityExportDocument({ designs, entryRunId: entryId, exportedAt, collectionIssues,
    unavailableProfiles: profiles.filter(row => row.missing).map(row => row.missing),
    sourceRun: root && !runs.some(run => id(run.id) === rootId) ? root : null });
}
