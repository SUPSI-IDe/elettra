import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateEnergyModel } from '../src/utils/aggregate-energy-model.js';

for (const basis of ['mean','aggregate_q95']) {
  test(`paired ${basis} only displays its own optimized profile`, () => {
    const cases={mean:{required_usable_kwh:100},aggregate_q95:{required_usable_kwh:120}};
    const run={input_params:{consumption_basis:basis,basis_run_ids:{mean:'a',aggregate_q95:'b'}},
      results:{consumption_analysis:{status:'available',per_shift:{shift:{status:'available',
        selected_packs:basis==='mean'?8:9,max_packs:16,pack_size_kwh:50,cases}}}}};
    const model=aggregateEnergyModel(run,'shift');
    assert.deepEqual(Object.keys(model.cases),[basis]);
    assert.equal(model.selected,basis==='mean'?8:9);
    assert.equal(model.basis,basis);
    assert.equal(model.paired,true);
  });
}

for (const [selected, excess, required, unavailable] of [[10,8,18,2],[10,3,13,0],[16,3,19,3]]) {
  test(`diagnostic ${required} packs distinguishes fixed-battery deficit from the installable limit`, () => {
    const run={results:{battery_results:{shift:{optimized_packs:selected,excess_packs:excess,
      required_total_packs:required,max_physical_packs:16,max_physical_kwh:800}}}};
    const model=aggregateEnergyModel(run,'shift');
    assert.equal(model.selected,selected);
    assert.equal(model.excess,excess);
    assert.equal(model.diagnosticTotal,required);
    assert.equal(model.unavailablePacks,unavailable);
    assert.equal(model.physicalExceeded,unavailable>0);
    delete run.results.battery_results.shift.required_total_packs;
    assert.equal(aggregateEnergyModel(run,'shift').unavailablePacks,unavailable);
  });
}


for (const [policy, usable, minimum] of [['residual_soc',175,.4],['constant_initial_usable',250,.9-.5/.7]]) {
  test(`legacy-compatible result fallback applies ${policy} consistently`, () => {
    const run={input_params:{state_of_health:.7,battery_soc_policy:policy,min_soc:.4,max_soc:.9},
      results:{battery_results:{shift:{optimized_packs:10,max_physical_packs:10,max_physical_kwh:500}}}};
    const model=aggregateEnergyModel(run,'shift');
    assert.equal(model.nominal,500);
    assert.ok(Math.abs(model.usable-usable)<1e-9);
    assert.ok(Math.abs(model.minSoc-minimum)<1e-9);
    assert.equal(model.soh,.7);
  });
}
