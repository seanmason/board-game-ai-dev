import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {newGame,applyAction,assertValid,publicObservation} from '../wingspan/core.js';
import {candidateActions} from '../wingspan/actions.js';
import {diagnosticPositions} from '../scripts/wingspan-study/fixtures.mjs';
import {createZeroModel,compileModel} from '../scripts/wingspan-selfplay/inference.mjs';
import {FEATURE_NAMES,encodeObservation} from '../scripts/wingspan-selfplay/encoder.mjs';
import {chooseAction as incumbent} from '../scripts/wingspan-selfplay/game.mjs';
import {chooseCheapAction,createActor} from '../scripts/wingspan-data-efficiency/actor.mjs';
import {collectGame,validateDataEfficiencyRecord} from '../scripts/wingspan-data-efficiency/collect.mjs';

const arm={method:'residual',modelId:'fixed',budget:100,horizon:4};
const zero=compileModel(createZeroModel());
function learned(){
 const m=createZeroModel();for(const l of m.layers){l.weights.fill(0);l.bias.fill(0);}
 m.layers[0].weights[FEATURE_NAMES.indexOf('own.food.seed')]=2;
 m.layers[1].weights[0]=1;m.layers[2].weights[0]=1;
 return compileModel(m);
}
const task={id:'fixture',seed:98765432,seat:0,split:'calibration',generation:4,generator:'hybrid',cheapProbability:1,budgetDistribution:true,candidate:arm,opponent:arm};
function finalFixture(){
 let s=newGame({seed:task.seed});while(s.phase==='setup'){const p=s.players[s.currentPlayer];s=applyAction(s,{type:'setup',keep:[],foodDiscard:[],bonusId:p.bonusOffer[0]});}
 s.round=4;s.remaining=[1,0];s.currentPlayer=0;for(const p of s.players)p.goalPoints=[0,0,0];assertValid(s);return s;
}
function rewardView(r){return {action:r.action,candidates:r.summary.candidates,mode:r.actorMode,iterations:r.iterations};}

test('baseline actor preserves incumbent allocation, rewards and deterministic replay exactly',()=>{
 const state=diagnosticPositions().find(x=>x.id==='raven-supported').state,options={seed:47,step:3,models:{fixed:zero}};
 const expected=incumbent(state,arm,options),actual=createActor({...task,generator:'baseline'})(state,arm,options);
 assert.deepEqual(actual.action,expected.action);assert.deepEqual(actual.summary.candidates,expected.summary.candidates);
 assert.deepEqual(actual.summary.diagnostics.actionTurns,expected.summary.diagnostics.actionTurns);
 assert.equal(actual.iterations,expected.iterations);assert.equal(actual.actorMode,'searched');assert.equal(actual.oneStepEvaluations,0);
});

test('cheap successor applies exactly one main root per candidate and settles all triggered powers',()=>{
 const state=diagnosticPositions().find(x=>x.id==='repeat-raven').state;
 const r=chooseCheapAction(state,arm,{seed:91,step:5,models:{fixed:zero}}),d=r.summary.diagnostics;
 assert.equal(r.roots,candidateActions(state).length);assert.equal(r.iterations,r.roots);assert.equal(r.oneStepEvaluations,r.roots);
 assert.equal(d.actionTurns,r.roots);assert.equal(d.rootTransitions,r.roots);assert.equal(d.rolloutCount,r.roots);
 assert.equal(d.settledLeaves,r.roots);assert.equal(d.unsettledLeaves,0);assert.equal(d.safetyCapCount,0);assert.ok(d.powerSteps>0);
 assert.doesNotThrow(()=>assertValid(applyAction(state,r.action)));assert.equal(r.summary.horizonConvention,'root-action-inclusive');
});

test('cheap model correction has deterministic nonzero effect, with legal supported candidates',()=>{
 const state=diagnosticPositions().find(x=>x.id==='raven-supported').state;
 const opts={seed:37,step:7,models:{fixed:learned()}};
 const r=chooseCheapAction(state,arm,opts),again=chooseCheapAction(state,arm,opts),control=chooseCheapAction(state,arm,{...opts,models:{fixed:zero}});
 assert.deepEqual(rewardView(r),rewardView(again));assert.ok(r.summary.diagnostics.learnedLeafCount>0);
 const scores=new Map(control.summary.candidates.map(c=>[JSON.stringify(c.action),c.sum]));
 assert.ok(r.summary.candidates.some(c=>Math.abs(c.sum-scores.get(JSON.stringify(c.action)))>1e-6));
 for(const c of r.summary.candidates)assert.doesNotThrow(()=>assertValid(applyAction(state,c.action)));
});

test('actual deck, private opponent identities and environment RNG do not affect cheap scores',()=>{
 const state=finalFixture();state.players[1].hand.push(state.deck.pop());const copy=structuredClone(state);
 [copy.players[1].hand[0],copy.deck[0]]=[copy.deck[0],copy.players[1].hand[0]];
 [copy.players[1].bonuses[0],copy.bonusDeck[0]]=[copy.bonusDeck[0],copy.players[1].bonuses[0]];
 copy.deck.reverse();copy.rngState^=123;
 assert.deepEqual(publicObservation(copy,0),publicObservation(state,0));
 const opts={seed:37,step:7,models:{fixed:learned()}};
 assert.deepEqual(rewardView(chooseCheapAction(state,arm,opts)),rewardView(chooseCheapAction(copy,arm,opts)));
});

test('independent seeded hybrid policy is reproducible and setup remains searched',()=>{
 const a=createActor({...task,cheapProbability:.8}),b=createActor({...task,cheapProbability:.8});
 const s=finalFixture(),opts={seed:123,models:{fixed:zero}},modes=[];
 for(let step=1;step<=40;step++){const x=a(s,arm,{...opts,step}),y=b(s,arm,{...opts,step});assert.deepEqual(rewardView(x),rewardView(y));modes.push(x.actorMode);}
 assert.ok(modes.includes('searched'));assert.ok(modes.includes('cheap-successor'));
 const setup=newGame({seed:123});assert.equal(createActor(task)(setup,arm,{...opts,step:1}).actorMode,'searched');
});

test('complete actual trajectory preserves both redacted views, four-world baselines and final labels',()=>{
 const record=collectGame(task,{models:{fixed:zero},createGame:finalFixture});
 assert.equal(record.validation.valid,true);assert.equal(record.result.status,'complete');assert.equal(record.valueExamples.length,2);
 assert.equal(record.teacherDecisions.length,1);assert.equal(record.generator,'hybrid');assert.equal(record.collectionDiagnostics.cheapDecisions,1);
 for(const e of record.valueExamples){
  assert.equal(e.generator,'hybrid');assert.equal(e.actorMode,'cheap-successor');assert.equal(e.targetMargin,record.result.scores[e.viewer]-record.result.scores[1-e.viewer]);
  assert.equal(e.baselineSource,'4world-observation-belief');assert.equal(e.targetAux.length,12);assert.deepEqual(e.features,encodeObservation(e.observation,e.viewer));
  assert.equal(e.observation.deck,undefined);assert.deepEqual(e.observation.players[1-e.viewer].hand,[]);assert.equal(e.candidates,undefined);
 }
 assert.equal(record.teacherDecisions[0].actorMode,'cheap-successor');assert.ok(record.teacherDecisions[0].oneStepEvaluations>0);
 assert.equal(record.result.decisions[0].requestedBudget,record.teacherDecisions[0].requestedBudget);
});

test('partial trajectory gets no final outcome labels',()=>{
 const record=collectGame(task,{models:{fixed:zero},stepCap:1,createGame:()=>{const s=finalFixture();s.remaining=[2,1];return s;}});
 assert.equal(record.validation.valid,false);assert.ok(record.valueExamples.length>0);assert.ok(record.valueExamples.every(e=>!('targetMargin' in e)&&!('targetAux'in e)));
});

test('cheap power decisions use existing deterministic priors with no unsupported model call',()=>{
 const s=diagnosticPositions().find(x=>x.id==='repeat-raven').state;
 const state=applyAction(s,candidateActions(s).find(x=>x.action.type==='layEggs').action);
 assert.equal(state.phase,'power');
 const r=chooseCheapAction(state,arm,{seed:12,models:{}});
 assert.equal(r.actorMode,'cheap-prior');assert.equal(r.iterations,0);assert.equal(r.oneStepEvaluations,0);assert.equal(r.summary.diagnostics.learnedLeafCount,0);
 assert.doesNotThrow(()=>assertValid(applyAction(state,r.action)));
});

test('collection validator rejects falsified cheap work and malformed mode without throwing',()=>{
 const t={...task,kind:'collect'},record=collectGame(t,{models:{fixed:zero},createGame:finalFixture});
 record.result.decisions[0].oneStepEvaluations=999;
 assert.ok(validateDataEfficiencyRecord(record,t).includes('invalid one-step work'));
 delete record.result.decisions[0].actorMode;
 assert.ok(validateDataEfficiencyRecord(record,t).includes('invalid decision work records'));
});

test('full rules-game fixture validates complete 26-action accounting and trainer trajectory shape',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wingspan-actor-fixture-')),path=join(dir,'zero.json');
 try{
  writeFileSync(path,JSON.stringify(createZeroModel()));
  const t={...task,kind:'collect',modelPaths:{fixed:path}},record=collectGame(t,{models:{fixed:zero}});
  assert.equal(record.validation.valid,true);assert.deepEqual(validateDataEfficiencyRecord(record,t),[]);
  assert.equal(record.result.diagnostics.candidate.mainActions,26);assert.equal(record.result.diagnostics.opponent.mainActions,26);
  assert.equal(record.collectionDiagnostics.searchedDecisions,2);assert.equal(record.collectionDiagnostics.cheapMainDecisions,52);
  assert.ok(record.collectionDiagnostics.cheapPowerDecisions>0);assert.ok(record.valueExamples.length>=104);
  assert.ok(record.valueExamples.every(e=>e.features.length===FEATURE_NAMES.length&&Number.isFinite(e.targetMargin)));
 }finally{unlinkSync(path);rmdirSync(dir);}
});
