import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticPositions} from '../scripts/wingspan-study/fixtures.mjs';
import {publicObservation,seededRandom} from '../wingspan/core.js';
import {createZeroModel,compileModel} from '../scripts/wingspan-selfplay/inference.mjs';
import {chooseAction} from '../scripts/wingspan-selfplay/game.mjs';
import {evaluateBeliefRollout,relativeScore} from '../scripts/wingspan-selfplay/rollout.mjs';
import {doubleRavenFixture} from '../scripts/wingspan-selfplay/profile.mjs';
import {candidateActions} from '../wingspan/actions.js';

test('zero residual preserves actual search rewards, coverage, allocations and action',()=>{
 const zero=compileModel(createZeroModel());
 for(const {state}of diagnosticPositions().filter((_,i)=>i%8===0)){
  const r=chooseAction(state,{method:'reference',budget:100},{seed:47});
  const n=chooseAction(state,{method:'residual',modelId:'z',budget:100},{seed:47,models:{z:zero}});
  assert.deepEqual(n.action,r.action);assert.deepEqual(n.summary.candidates,r.summary.candidates);
  assert.equal(n.iterations,r.iterations);assert.equal(n.unvisited,0);
  const d=n.summary.diagnostics;assert.equal(d.learnedLeafCount+d.learnedFallbackCount,d.rolloutCount);assert.equal(d.unsettledLeaves,0);
 }
});
test('correction has point units, exact terminal fallback and no double subtraction',()=>{
 const raw=createZeroModel();raw.layers[2].bias[0]=.4;const model=compileModel(raw);
 const s=diagnosticPositions().find(f=>f.id==='raven-supported').state;
 const ref=relativeScore(s,0),value=relativeScore(s,0,{method:'residual',model});
 assert.ok(Math.abs(value-ref-10*Math.tanh(Math.fround(.4)))<1e-9);
 const terminal={...s,phase:'gameover'};assert.equal(relativeScore(terminal,0,{method:'residual',model}),relativeScore(terminal,0));
 assert.equal(relativeScore(s,0,{method:'residual',model,allowModel:false}),ref);
});
test('rollouts count actual main actions across both seats and settle the final power queue',()=>{
 const s=diagnosticPositions().find(f=>f.id==='repeat-raven').state,o=publicObservation(s,0),action=candidateActions(s).find(x=>x.action.type==='layEggs').action;
 const diagnostics={},reward=evaluateBeliefRollout(o,action,seededRandom(90210),{horizon:4,diagnostics});
 assert.ok(Number.isFinite(reward));assert.equal(diagnostics.actionTurns,4);assert.deepEqual(diagnostics.actionTurnsBySeat,[2,2]);
 assert.equal(diagnostics.settledLeaves,1);assert.equal(diagnostics.safetyCapCount,0);assert.equal(diagnostics.unsettledLeaves,0);assert.ok(diagnostics.powerSteps>0);
});
test('large raven-stock fixture has complete legal roots after payment deduplication',()=>{
 for(const {state}of doubleRavenFixture()){
  const d=chooseAction(state,{method:'reference',budget:100},{seed:91});assert.equal(d.unvisited,0);assert.equal(d.summary.diagnostics.safetyCapCount,0);
 }
});
