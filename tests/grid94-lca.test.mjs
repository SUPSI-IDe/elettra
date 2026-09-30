import test from 'node:test';
import assert from 'node:assert/strict';
import { gridFromDc } from '../src/utils/charging-energy.js';
import { mapParameterizedLca, LCA_METHOD } from '../src/pages/Simulation/YearlyAnalysis/parameterized-lca.js';

test('DC stays DC and electricity is purchased once at 94%', () => {
  assert.equal(gridFromDc(94), 100);
  assert.ok(Math.abs(gridFromDc(150) - 159.5744680851064) < 1e-10);
  assert.throws(() => gridFromDc(-1));
});

test('LCA adapter preserves vehicle impacts separately from operation', () => {
  const raw = {methodology_version:LCA_METHOD,status:'complete',annual_km:50000,
    vehicles:[{diesel_heating_liters:2}],indicators:{gwp100a:{phases:{vehicle:30,energyChain:100},total:130,
      diesel_comparator_phases:{vehicle:20,energyChain:180},diesel_comparator_total:200,diesel_heating_phases:{direct:2},diesel_heating:2}}};
  const state=mapParameterizedLca(raw);
  assert.equal(state.electricYearly.gwp100a.total,130);
  assert.equal(state.rawLca,raw);
  assert.equal(state.electricOnlyYearly,null); // never relabel vehicle manufacture as electricity
  assert.equal(state.emissionsMetadata.methodologyVersion,LCA_METHOD);
});

test('incomplete LCA cannot masquerade as a complete total', () => {
  assert.throws(() => mapParameterizedLca({methodology_version:LCA_METHOD,status:'incomplete',reason:'Missing phase'}), /Missing phase/);
  assert.throws(() => mapParameterizedLca({status:'complete'}));
});
