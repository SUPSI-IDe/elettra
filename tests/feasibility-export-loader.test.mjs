import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFeasibilityExport } from '../src/utils/feasibility-export-loader.js';
import { feasibilityExportFixture as fixture } from '../test-support/feasibility-export-fixture.js';

const setup = () => {
  const mean = fixture(), q95 = fixture({ basis: 'aggregate_q95' });
  const calls = [];
  const predictions = [...mean.predictionRuns, ...q95.predictionRuns];
  const options = { entryRun: mean.optimizationRun, entryPredictionRuns: mean.predictionRuns,
    currentBusModel: mean.currentBusModel, shiftNamesById: mean.shiftNamesById,
    fetchRun: async (key, { signal }) => { calls.push(['run', key]); assert.ok(signal); return q95.optimizationRun; },
    lookupBasis: async () => { throw Error('Unexpected basis lookup'); },
    resolvePredictions: async (ids, { signal }) => {
      calls.push(['predictions', ids]); assert.ok(signal);
      return { runs: predictions.filter(row => ids.includes(row.id)) };
    },
  };
  return { mean, q95, calls, options };
};

test('collects both designs and exact selected/reference IDs while preserving the click-time snapshot', async () => {
  const { mean, calls, options } = setup();
  const pending = loadFeasibilityExport(options);
  mean.optimizationRun.results.battery_results.a.optimized_packs = 999;
  mean.predictionRuns[0].summary.total_consumption_kwh = 999;
  const document = await pending;
  assert.equal(document.dataQuality.status, 'complete');
  assert.equal(document.designs[0].general.investment.rows[0].packs, 10);
  assert.equal(document.designs[0].sourceData.predictionRuns.find(row => row.id === 'initial-a').summary.total_consumption_kwh, 360);
  assert.deepEqual(calls, [['run', 'q95-design'], ['predictions', ['aggregate_q95-a', 'aggregate_q95-b']]]);
});

test('completed cached counterparts are isolated and reused; nonterminal caches are refreshed', async () => {
  const { q95, options, calls } = setup();
  options.cachedDesigns = new Map([['q95-design', { run: q95.optimizationRun, predictionRuns: q95.predictionRuns }]]);
  const pending = loadFeasibilityExport(options);
  q95.optimizationRun.results.total_installation_cost_chf = 999;
  const document = await pending;
  assert.equal(document.designs[1].general.infrastructure.totalInstallationCostChf, 150000);
  assert.deepEqual(calls, []);
  q95.optimizationRun.status = 'running';
  await loadFeasibilityExport(options);
  assert.equal(calls[0][0], 'run');
});

test('legacy lookup is read-only and distinguishes an absent calculation from a failed lookup', async () => {
  const { options } = setup();
  delete options.entryRun.input_params.basis_run_ids;
  const lookups = [];
  options.lookupBasis = async (root, basis, controls) => {
    lookups.push([root, basis, controls.start]);
    return { status: 'not_calculated', optimization_run_id: null };
  };
  const absent = await loadFeasibilityExport(options);
  assert.equal(absent.profiles[1].status, 'not_calculated');
  assert.deepEqual(lookups, [['mean-design', 'aggregate_q95', false]]);
  options.lookupBasis = async () => { throw Error('Offline'); };
  const failed = await loadFeasibilityExport(options);
  assert.equal(failed.profiles[1].status, 'unavailable');
  assert.equal(failed.profiles[1].error, 'Offline');
});

test('an entry Q95 includes its saved source and keeps its own entry identity', async () => {
  const { mean, q95, options, calls } = setup();
  options.entryRun = q95.optimizationRun; options.entryPredictionRuns = q95.predictionRuns;
  options.fetchRun = async key => { calls.push(key); return mean.optimizationRun; };
  const document = await loadFeasibilityExport(options);
  assert.equal(document.evaluation.id, 'mean-design');
  assert.equal(document.evaluation.entryRunId, 'q95-design');
  assert.deepEqual(calls, ['mean-design', ['predictions', ['mean-a', 'mean-b']]]);
  assert.equal(document.designs.length, 2);
});

test('an original Mean source is preserved as audit when a newer compatible Mean is the entry', async () => {
  const { mean, q95, options } = setup();
  delete mean.optimizationRun.input_params.basis_run_ids;
  const entry = structuredClone(mean);
  entry.optimizationRun.id = 'compatible-mean';
  entry.optimizationRun.input_params.basis_source_run_id = 'mean-design';
  delete q95.optimizationRun.input_params.basis_run_ids;
  options.entryRun = entry.optimizationRun; options.entryPredictionRuns = entry.predictionRuns;
  options.fetchRun = async key => key === 'mean-design' ? mean.optimizationRun : q95.optimizationRun;
  options.lookupBasis = async () => ({ optimization_run_id: 'q95-design', status: 'completed' });
  const document = await loadFeasibilityExport(options);
  assert.equal(document.designs.length, 2);
  assert.equal(document.designs[0].run.id, 'compatible-mean');
  assert.equal(document.evaluation.sourceRecord.id, 'mean-design');
  assert.equal(document.evaluation.name, 'Fixture');
  assert.equal(document.dataQuality.issues.some(row => row.code === 'source_design_unavailable'), false);
});

test('a missing source is fetched once and produces an auditable partial export', async () => {
  const { q95, options } = setup();
  options.entryRun = q95.optimizationRun; options.entryPredictionRuns = q95.predictionRuns;
  let requests = 0;
  options.fetchRun = async () => { requests++; throw Error('Source unavailable'); };
  const document = await loadFeasibilityExport(options);
  assert.equal(requests, 1);
  assert.equal(document.designs.length, 1);
  assert.equal(document.profiles[0].status, 'unavailable');
  assert.ok(document.dataQuality.issues.some(row => row.code === 'source_design_loading_failed'));
});

test('profile loading failure can be retried without caching the failure', async () => {
  const { options } = setup();
  const fetch = options.fetchRun;
  options.fetchRun = async () => { throw Error('Offline'); };
  assert.equal((await loadFeasibilityExport(options)).profiles[1].status, 'unavailable');
  options.fetchRun = fetch;
  assert.equal((await loadFeasibilityExport(options)).profiles[1].status, 'available');
});

test('missing forecasts and forecast-service errors retain every known scoped value', async () => {
  const { options } = setup();
  options.resolvePredictions = async () => ({ runs: [], errors: [{ id: 'aggregate_q95-a', error: Error('Offline') }] });
  const document = await loadFeasibilityExport(options);
  assert.equal(document.designs[0].shifts[0].consumption.totalKwh, 300);
  assert.equal(document.designs[1].shifts[0].consumption.totalKwh, 390.123456789);
  assert.equal(document.dataQuality.status, 'partial');
  assert.ok(document.dataQuality.issues.some(row => row.code === 'prediction_loading_failed'));
  assert.deepEqual(document.designs[1].provenance.predictions.missingRunIds, ['aggregate_q95-a', 'aggregate_q95-b']);
});

test('timed-out requests abort their own transport and leave a partial counterpart', async () => {
  const { options } = setup();
  let requestSignal;
  options.requestTimeoutMs = 10;
  options.fetchRun = async (_, { signal }) => { requestSignal = signal; return new Promise(() => {}); };
  const document = await loadFeasibilityExport(options);
  assert.equal(document.profiles[1].status, 'unavailable');
  assert.match(document.profiles[1].error, /timed out/);
  assert.equal(requestSignal.aborted, true);
});

test('cancellation rejects collection and never publishes a late response', async () => {
  const { q95, options } = setup();
  const controller = new AbortController();
  let release;
  const started = new Promise(resolve => { options.fetchRun = async () => {
    resolve(); return new Promise(done => { release = done; });
  }; });
  const pending = loadFeasibilityExport({ ...options, signal: controller.signal });
  await started;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  release(q95.optimizationRun);
  await assert.rejects(loadFeasibilityExport({ ...options, signal: controller.signal }), { name: 'AbortError' });
});

test('wrong family responses cannot be mixed into the click-time design', async () => {
  const { q95, options } = setup();
  q95.optimizationRun.input_params.basis_source_run_id = 'other-family';
  await assert.rejects(loadFeasibilityExport(options), /another family/);
});
