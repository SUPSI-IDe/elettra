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

test('calculation state uses yellow for active work and red for failed verification', async()=>{
  const {evaluationStatus: status}=await import('../src/utils/paired-feasibility.js');
  for(const state of ['pending','running']) assert.equal(status({status:state}).tone,'warning');
  for(const row of [feasible,infeasible,{status:'done'}]) assert.equal(status(row).tone,'positive');
  assert.deepEqual(status({...infeasible,verification_status:'time_budget_exhausted'}),{state:'failed',tone:'negative',reason:'timeout'});
  assert.equal(status({status:'completed',results:{forecast_verification:{status:'time_budget_exhausted'}}}).reason,'timeout');
  assert.equal(status({status:'completed',solver_status:'maxTimeLimit'}).reason,'timeout');
  for(const verification_status of ['iteration_limit','cycle_detected','solver_not_optimal']) assert.equal(status({status:'completed',verification_status}).tone,'negative');
  for(const state of ['failed','error','unavailable']) assert.equal(status({status:state}).tone,'negative');
});

test('paired calculation status waits for both profiles and keeps infeasibility separate', async()=>{
  const {evaluationStatus: status}=await import('../src/utils/paired-feasibility.js');
  const run=(mean,aggregate_q95)=>({status:'completed',basis_summaries:{mean,aggregate_q95}});
  assert.equal(status(run(feasible,infeasible)).tone,'positive');
  assert.equal(status(run(feasible,{status:'running'})).tone,'warning');
  assert.equal(status(run({status:'failed'},{status:'running'})).tone,'warning');
  assert.equal(status(run(feasible,{status:'failed'})).tone,'negative');
  assert.equal(status(run(feasible,{...infeasible,verification_status:'time_budget_exhausted'})).tone,'negative');
  assert.equal(status(run(feasible,undefined)).tone,'negative');
  assert.equal(pairedFeasibility(run(feasible,{...infeasible,verification_status:'time_budget_exhausted'})).tone,'neutral');
});
