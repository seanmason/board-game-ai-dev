import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,publicObservation,seededRandom} from '../wingspan/core.js';
import {candidateActions} from '../wingspan/actions.js';
import {createSearch,runSearch,searchSummary} from '../wingspan/analysis.js';
import {evaluateBeliefRollout} from '../wingspan/rollout.js';
import {play} from '../scripts/benchmark-wingspan-screen.mjs';

function fixture(){
  let state=newGame({players:2,seed:141});
  while(state.phase==='setup')state=applyAction(state,candidateActions(state)[0].action);
  return {state,observation:publicObservation(state,state.currentPlayer),choices:candidateActions(state).slice(0,3)};
}
test('depth 20 and bounded optional rollout step limits are accepted without changing defaults',()=>{
  const {observation,choices}=fixture();
  const defaults=createSearch(observation,choices);
  assert.equal(defaults.horizon,6);assert.equal(defaults.rolloutStepLimit,48);
  assert.equal(defaults.diagnostics,undefined);
  assert.equal(createSearch(observation,choices,{horizon:20,rolloutStepLimit:160}).horizon,20);
  for(const horizon of [0,21,1.5])assert.throws(()=>createSearch(observation,choices,{horizon}),/horizon/);
  for(const rolloutStepLimit of [0,513,1.5])assert.throws(()=>createSearch(observation,choices,{rolloutStepLimit}),/step limit/);
});
test('diagnostics preserve rewards, selected actions and RNG consumption',()=>{
  const {observation,choices}=fixture();
  const rngA=seededRandom(981),rngB=seededRandom(981);
  const a=createSearch(observation,choices,{method:'belief-rollout',rng:rngA});
  const b=createSearch(observation,choices,{method:'belief-rollout',rng:rngB,rolloutStepLimit:48,diagnostics:true});
  runSearch(a,6);runSearch(b,6);
  const {diagnostics,...summary}=searchSummary(b);
  assert.deepEqual(searchSummary(a),summary);assert.equal(rngA(),rngB());
  assert.equal(diagnostics.rolloutCount,6);
  assert.equal(diagnostics.actionTurns,36);
  assert.equal(diagnostics.horizonReached,6);
});
test('horizon counts subsequent play actions, excluding the root and setup decisions',()=>{
  const {observation,choices}=fixture();const diagnostics={};
  evaluateBeliefRollout(observation,choices[0].action,seededRandom(7),{horizon:20,maxSteps:160,diagnostics});
  assert.equal(diagnostics.actionTurns,20);assert.equal(diagnostics.horizonReached,1);
  assert.equal(diagnostics.safetyCapCount,0);
  const setup=newGame({players:2,seed:141}),setupDiagnostics={};
  evaluateBeliefRollout(publicObservation(setup,0),candidateActions(setup)[0].action,seededRandom(7),
    {horizon:1,maxSteps:1,diagnostics:setupDiagnostics});
  assert.equal(setupDiagnostics.actionTurns,0);assert.equal(setupDiagnostics.safetyCapCount,1);
});
test('forced safety cap is counted and benchmark separates candidate and opponent diagnostics',()=>{
  const {observation,choices}=fixture();const diagnostics={};
  evaluateBeliefRollout(observation,choices[0].action,seededRandom(7),{horizon:20,maxSteps:1,diagnostics});
  assert.equal(diagnostics.rolloutCount,1);assert.equal(diagnostics.actionTurns,1);
  assert.equal(diagnostics.horizonReached,0);assert.equal(diagnostics.terminalReached,0);
  assert.equal(diagnostics.safetyCapCount,1);
  const result=play({seed:141,seat:0,budget:1,opponent:'belief-rollout',opponentBudget:1,horizon:20,opponentHorizon:20,rolloutStepLimit:1},{stepCap:2});
  assert.equal(result.status,'capped');
  assert.equal(result.rolloutDiagnostics.candidate.rolloutCount,1);
  assert.equal(result.rolloutDiagnostics.opponent.rolloutCount,1);
  assert.equal(result.rolloutDiagnostics.candidate.safetyCapCount,1);
  assert.equal(result.rolloutDiagnostics.opponent.safetyCapCount,1);
});
test('terminal rollouts report game end independently of horizon and cap',()=>{
  const {state}=fixture();state.round=4;state.remaining=state.players.map((_,i)=>i===state.currentPlayer?1:0);
  const action=candidateActions(state).find(x=>x.action.type==='gainFood').action;
  const diagnostics={};
  evaluateBeliefRollout(publicObservation(state,state.currentPlayer),action,seededRandom(7),{horizon:20,maxSteps:1,diagnostics});
  assert.equal(diagnostics.terminalReached,1);assert.equal(diagnostics.actionTurns,0);
  assert.equal(diagnostics.horizonReached,0);assert.equal(diagnostics.safetyCapCount,0);
});
