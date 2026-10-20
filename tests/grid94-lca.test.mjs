import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gridFromDc } from '../src/utils/charging-energy.js';
import { mapParameterizedLca, LCA_METHOD } from '../src/pages/Simulation/YearlyAnalysis/parameterized-lca.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/grid94-lca.json', import.meta.url), 'utf8'),
).base;

test('DC stays DC and electricity is purchased once at 94%', () => {
  assert.equal(gridFromDc(94), 100);
  assert.ok(Math.abs(gridFromDc(150) - 159.5744680851064) < 1e-10);
  assert.throws(() => gridFromDc(-1));
});

test('LCA adapter preserves vehicle impacts separately from operation', () => {
  const raw = structuredClone(fixture);
  const state=mapParameterizedLca(raw);
  assert.equal(state.electricYearly.gwp100a.total,raw.indicators.gwp100a.total);
  assert.equal(state.rawLca,raw);
  assert.equal(state.electricOnlyYearly,null); // never relabel vehicle manufacture as electricity
  assert.equal(state.emissionsMetadata.methodologyVersion,LCA_METHOD);
});

test('incomplete LCA cannot masquerade as a complete total', () => {
  assert.throws(() => mapParameterizedLca({methodology_version:LCA_METHOD,status:'incomplete',reason:'Missing phase'}), /Missing phase/);
  assert.throws(() => mapParameterizedLca({status:'complete'}));
});
