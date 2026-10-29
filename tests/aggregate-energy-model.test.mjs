import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateEnergyModel } from '../src/utils/aggregate-energy-model.js';

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
