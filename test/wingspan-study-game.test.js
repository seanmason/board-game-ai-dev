import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {newGame,seededRandom,publicObservation} from '../wingspan/core.js';
import {candidateActions} from '../wingspan/actions.js';
import {openingSetupActions} from '../wingspan/opening-strategy.js';
import * as current from '../wingspan/analysis.js';
import * as deployed from '../scripts/wingspan-study/deployed/analysis.js';
import {chooseAction,play} from '../scripts/wingspan-study/game.mjs';
import {arm} from '../scripts/wingspan-study/plan.mjs';

test('deployed snapshot has exactly frozen hashes and original seeded search behavior',()=>{
 const ledger=JSON.parse(readFileSync(new URL('../scripts/wingspan-study/deployed/source.json',import.meta.url)));
 assert.equal(ledger.revision,'66444d1868c364e11712253d73542d50b9cb0705');
 for(const [path,hash]of Object.entries(ledger.hashes))assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/wingspan-study/deployed/'+path.replace(/^wingspan\//,''),import.meta.url))).digest('hex'),hash,path);
 const state=newGame({players:2,seed:179}),observation=publicObservation(state,0),choices=openingSetupActions(state,candidateActions(state));
 const build=api=>api.createSearch(observation,choices,{rng:seededRandom(42),method:'belief-rollout',leafEvaluator:'opening-plan',horizon:4,rolloutStepLimit:48,diagnostics:true});
 const a=build(current),b=build(deployed);current.runSearch(a,24);deployed.runSearch(b,24);assert.deepEqual(current.searchSummary(a),deployed.searchSummary(b));
});
test('study actual setup expansion is symmetric and requests cannot bypass root coverage',()=>{
 for(const starter of [0,1]){
  const state=newGame({players:2,seed:179,starter}),expected=openingSetupActions(state,candidateActions(state)).length;
  const r=chooseAction(state,{...arm(),budget:1},{seed:179});
  assert.equal(r.roots,expected);assert.ok(expected>8);assert.equal(r.iterations,expected);assert.equal(r.unvisited,0);
 }
});
test('timed decisions charge generation and finish the mandatory coverage floor',()=>{
 let time=0;const r=chooseAction(newGame({players:2,seed:179}),arm('reference',300,4,'study',1),{clock:()=>time++});
 assert.equal(r.iterations,r.roots);assert.equal(r.unvisited,0);assert.equal(r.floorOverrun,true);assert.ok(r.elapsedMs>=r.generationMs);
});
test('capped study games retain progress and do not invent scores or a winner',()=>{
 const a={...arm(),budget:1};const r=play({id:'cap',seed:179,seat:0,candidate:a,opponent:a,rolloutStepLimit:192},{stepCap:2});
 assert.equal(r.status,'capped');assert.equal(r.winShare,undefined);assert.equal(r.scores,undefined);
 assert.ok(r.diagnostics.candidate.iterations>0);assert.ok(r.diagnostics.opponent.iterations>0);
});


test('timing calibration fails closed on omitted evidence, changed source and incorrect median',async()=>{
 const {validateCalibration}=await import('../scripts/wingspan-study/run.mjs');
 const {diagnosticPositions}=await import('../scripts/wingspan-study/fixtures.mjs');
 const hashes={a:'frozen'},rows=diagnosticPositions().map((f,i)=>({id:f.id,elapsedMs:i+1,generationMs:0,roots:2,iterations:300,unvisited:0,diagnostics:{rolloutCount:300,safetyCapCount:0,unsettledLeaves:0,settledLeaves:300}}));
 const good={timeBudgetMs:13,rows,sourceHashes:hashes};assert.equal(validateCalibration(good,hashes),13);
 assert.throws(()=>validateCalibration({timeBudgetMs:13},hashes),/inventory/);
 assert.throws(()=>validateCalibration({...good,sourceHashes:{a:'changed'}},hashes),/Changed/);
 assert.throws(()=>validateCalibration({...good,rows:rows.slice(1)},hashes),/24/);
 assert.throws(()=>validateCalibration({...good,timeBudgetMs:14},hashes),/median/);
 const bad=structuredClone(good);bad.rows[0].diagnostics.unsettledLeaves=1;assert.throws(()=>validateCalibration(bad,hashes),/diagnostics/);
});
test('dashboard uses strict result validation and conservative uncertainty for constant outcomes',async()=>{
 const {snapshot,healthy}=await import('../scripts/wingspan-study/dashboard.mjs');
 const {screenTasks}=await import('../scripts/wingspan-study/plan.mjs');const tasks=screenTasks().slice(0,4);
 const records=tasks.map(t=>({...t,status:'complete',scores:t.seat===0?[80,60]:[60,80],margin:20,winShare:1,illegalActions:0,errors:0,
  diagnostics:Object.fromEntries(['candidate','opponent'].map(s=>[s,{decisions:1,iterations:t[s].budget,rolloutCount:t[s].budget,roots:2,unvisited:0,safetyCapCount:0,unsettledLeaves:0,illegalActions:0,errors:0}])),decisionTimes:{candidate:[1],opponent:[1]}}));
 const data=snapshot({revision:'test',tasks,results:records});assert.equal(data.rows[0].completeSeedGroups,2);assert.equal(data.rows[0].winShare.mean,1);assert.ok(data.rows[0].winShare.low<1);
 assert.equal(healthy({...records[0],candidate:{...records[0].candidate,budget:999}},tasks[0]),false);
 const broken=structuredClone(records);delete broken[0].errors;assert.equal(snapshot({revision:'test',tasks,results:broken}).rows[0].counts.complete,3);
});
