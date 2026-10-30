import {test} from 'node:test';
import assert from 'node:assert/strict';
import {basisOutcome, pairedFeasibility} from '../src/utils/paired-feasibility.js';
const feasible = {status:'completed',verification_status:'verified',electrification_feasible:true};
const infeasible = {status:'completed',verification_status:'infeasible',electrification_feasible:false};
const pair = (mean,q95) => pairedFeasibility({basis_summaries:{mean,aggregate_q95:q95}});
test('the combined colour distinguishes mixed results in either direction',()=>{
  assert.equal(pair(feasible,feasible).tone,'positive');
  assert.equal(pair(infeasible,infeasible).tone,'negative');
  assert.deepEqual(pair(feasible,infeasible),{tone:'warning',key:'mean_only'});
  assert.deepEqual(pair(infeasible,feasible),{tone:'warning',key:'q95_only'});
  assert.equal(pair(feasible,{...infeasible,verification_status:'physical_limits_exceeded'}).tone,'warning');
});
test('pending, failed and unverified results never mean proven infeasibility',()=>{
  for(const row of [{...infeasible,status:'running'},{...infeasible,status:'failed'},
    {...infeasible,verification_status:'time_budget_exhausted'},{}]){
    assert.equal(pair(feasible,row).tone,'neutral');
    assert.notEqual(basisOutcome(row),'infeasible');
  }
  assert.equal(pairedFeasibility({}),null);
});
