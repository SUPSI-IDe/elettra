import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInfeasibilityPresentation, infeasibilityDetailRun } from '../src/utils/infeasibility-presentation.js';
import { translations } from '../src/i18n/translations.js';

const battery = { shift_name: 'Saved name', optimized_packs: 8, required_total_packs: 37,
  max_physical_packs: 8, excess_packs: 29, physical_feasible: false };
const run = (results = {}) => ({ status: 'completed', input_params: { shift_ids: ['duty'], daily_cycle: true },
  results: { electrification_feasible: false, ...results } });

test('main and relaxed battery limits share the same rows without changing saved results', () => {
  const main = run({ solver_status: 'optimal', forecast_verification: { status: 'physical_limits_exceeded' },
    battery_results: { duty: battery } });
  const diagnostic = run({ solver_status: 'infeasible', battery_results: {}, infeasibility_diagnostics: {
    status: 'available', battery_results: { duty: battery }, reasons: [] } });
  const before = structuredClone([main, diagnostic]);
  const a = buildInfeasibilityPresentation(main);
  const b = buildInfeasibilityPresentation(diagnostic);
  assert.equal(a.active, true);
  assert.equal(b.active, true);
  for (const key of ['selected', 'maximum', 'required', 'missing', 'exceeded', 'critical'])
    assert.equal(a.rows[0][key], b.rows[0][key], key);
  assert.equal(a.rows[0].source, 'result');
  assert.equal(b.rows[0].source, 'diagnostic');
  assert.equal(a.rows[0].missing, 29);
  assert.equal(a.reasons[0].code, 'battery_limit');
  assert.deepEqual([main, diagnostic], before);
});

test('fixed-battery deficits within the physical maximum are distinct from overflow', () => {
  const model = buildInfeasibilityPresentation(run({ battery_results: { duty: {
    ...battery, optimized_packs: 10, required_total_packs: 13, max_physical_packs: 16, excess_packs: 3,
  } } }));
  assert.equal(model.rows[0].missing, 3);
  assert.equal(model.rows[0].exceeded, 0);
  assert.equal(model.reasons[0].code, 'fixed_battery');
  assert.equal(model.reasons[0].available_packs, 10);
});

test('an incomplete main design is never filled from a different relaxed design', () => {
  const model = buildInfeasibilityPresentation(run({ battery_results: { duty: { optimized_packs: 4 } },
    infeasibility_diagnostics: { status: 'available', battery_results: { duty: battery } } }));
  assert.equal(model.rows[0].selected, 4);
  assert.equal(model.rows[0].required, null);
  assert.equal(model.rows[0].missing, null);
  assert.equal(model.rows[0].maximum, null);
  assert.equal(model.rows[0].source, 'result');
});

test('depot constraints can identify affected shifts without inventing battery counts', () => {
  for (const code of ['depot_plugs', 'depot_constraints']) {
    const reason = { code, stop_name: 'Depot', required_plugs: 2, available_plugs: 1,
      ...(code === 'depot_plugs' ? { shift_ids: ['duty'] } : {}) };
    const model = buildInfeasibilityPresentation(run({ infeasibility_diagnostics: {
      status: 'available', reasons: [reason], battery_results: {},
    } }));
    assert.equal(model.reasons[0].code, code);
    assert.equal(model.rows[0].critical, code === 'depot_plugs');
    assert.equal(model.rows[0].selected, null);
    assert.equal(model.rows[0].required, null);
    assert.equal(model.rows[0].missing, null);
  }
});

test('incomplete, unknown and unavailable diagnostics do not establish specific causes', () => {
  for (const status of ['available', 'unavailable', undefined]) {
    const model = buildInfeasibilityPresentation(run({ infeasibility_diagnostics: { status,
      reasons: [{code:'depot_power', shift_id:'duty'}, {code:'future_reason', message:'raw failure'}],
      battery_results: status === 'unavailable' ? { duty: battery } : {},
    } }));
    assert.equal(model.active, true);
    assert.deepEqual(model.reasons, []);
    assert.equal(model.rows[0].source, null);
  }
});

test('current shift names are used consistently in table and reasons', () => {
  const model = buildInfeasibilityPresentation(run({ battery_results: { duty: battery } }), {
    shiftNamesById: new Map([['duty', 'Current name']]),
  });
  assert.equal(model.rows[0].shiftName, 'Current name');
  assert.equal(model.reasons[0].shift_name, 'Current name');
});

test('a valid shift in an infeasible fleet has no invented battery deficit', () => {
  const model = buildInfeasibilityPresentation(run({ battery_results: {
    duty: { ...battery, required_total_packs: 8, excess_packs: 0, physical_feasible: true },
    other: battery,
  } }));
  assert.equal(model.rows[0].critical, false);
  assert.equal(model.rows[1].critical, true);
  assert.equal(model.reasons.length, 1);
  assert.equal(model.reasons[0].shift_id, 'other');
});

test('feasible, unverified, running and failed calculations do not enter the infeasible presentation', () => {
  const candidates = [
    run({ electrification_feasible: true }),
    ...['time_budget_exhausted', 'solver_not_optimal', 'iteration_limit', 'cycle_detected', 'running']
      .map(status => run({ forecast_verification: { status } })),
    ...['pending', 'running'].map(status => ({...run(), status})),
    {status: 'failed', results: {}},
    run({ failure: { message: 'Invalid inputs' } }), run({ error: 'Worker error' }),
    { status: 'completed', results: {} },
  ];
  for (const candidate of candidates) assert.equal(buildInfeasibilityPresentation(candidate).active, false);
});

test('every supported language contains the same complete infeasibility vocabulary', () => {
  const keys = Object.keys(translations.en).filter(key => key.startsWith('simulation.infeasibility_'));
  assert.ok(keys.length >= 9);
  for (const lang of ['en', 'it', 'de', 'fr']) for (const key of keys)
    assert.ok(translations[lang][key]?.length > 5, `${lang}: ${key}`);
});


test('a historical failed execution with a proven infeasible result keeps its technical verdict', () => {
  const historical = {...run({solver_status: 'infeasible'}), status: 'failed'};
  assert.equal(buildInfeasibilityPresentation(historical).active, true);
});

test('a relaxed diagnosis cannot attach contradictory pack requirements to the main design', () => {
  const model = buildInfeasibilityPresentation(run({battery_results: {duty: battery},
    infeasibility_diagnostics: {status: 'available', battery_results: {duty: {...battery, required_total_packs: 4}},
      reasons: [{code: 'battery_limit', shift_id: 'duty', shift_name: 'Saved name', required_packs: 4, available_packs: 3}]},
  }));
  assert.equal(model.reasons.length, 1);
  assert.equal(model.reasons[0].required_packs, 37);
  assert.equal(model.reasons[0].available_packs, 8);
});

test('unverified diagnostics cannot quantify a deficit even when incorrectly marked available', () => {
  const model = buildInfeasibilityPresentation(run({infeasibility_diagnostics: {status: 'available',
    forecast_verification: {status: 'time_budget_exhausted'}, battery_results: {duty: battery},
    reasons: [{code: 'depot_constraints'}]},
  }));
  assert.equal(model.active, true);
  assert.equal(model.diagnosticAvailable, false);
  assert.equal(model.rows[0].source, null);
  assert.equal(model.reasons.length, 0);
});


test('a diagnostic detail preserves the original verdict without leaking another design’s operations', () => {
  const original = run({battery_results: {other: battery},
    per_bus_summary: [{shift_id: 'other', total_charged_kwh: 700}], daily_cycle: {status: 'unverified'},
    installed_chargers: {depot: {num_slots: 2}}, total_installation_cost_chf: 400,
    infeasibility_diagnostics: {status: 'available', battery_results: {duty: battery}},
  });
  const before = structuredClone(original);
  const row = buildInfeasibilityPresentation(original).rows.find(row => row.shiftId === 'duty');
  const detail = infeasibilityDetailRun(original, row);
  assert.equal(detail.results.electrification_feasible, false);
  assert.deepEqual(detail.results.battery_results, {duty: battery});
  assert.deepEqual(detail.results.per_bus_summary, []);
  assert.deepEqual(detail.results.daily_cycle, {});
  assert.deepEqual(detail.results.installed_chargers, original.results.installed_chargers);
  assert.deepEqual(original, before);
});

test('a detail without battery data cannot inherit another shift’s selected battery', () => {
  const original = run({battery_results: {other: battery}});
  const row = buildInfeasibilityPresentation(original).rows.find(row => row.shiftId === 'duty');
  assert.equal(row.source, null);
  const detail = infeasibilityDetailRun(original, row);
  assert.deepEqual(detail.results.battery_results, {});
  assert.deepEqual(detail.results.per_bus_summary, []);
});

test('main result details keep their original run and data', () => {
  const original = run({battery_results: {duty: battery}});
  const row = buildInfeasibilityPresentation(original).rows[0];
  assert.equal(infeasibilityDetailRun(original, row), original);
});
