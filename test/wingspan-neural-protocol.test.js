import test from 'node:test';
import assert from 'node:assert/strict';
import {dataTasks,screenTasks,canaryTasks,confirmationTasks,admitDataProfile} from '../scripts/wingspan-neural/plan.mjs';
import {analyze,validateResult} from '../scripts/wingspan-neural/analyze.mjs';
const result=t=>{const scores=t.seat?[80,90]:[90,80],diagnostics={};for(const side of ['candidate','opponent']){const learned=['neural','linear'].includes(t[side].method),legacy=t[side].pipeline==='deployed';diagnostics[side]={decisions:1,iterations:10,roots:1,rolloutCount:10,unvisited:0,safetyCapCount:0,illegalActions:0,errors:0,unsettledLeaves:legacy?null:0,settledLeaves:10,endpointMeasurement:legacy?'legacy-not-instrumented':'resolved-boundary',learnedLeafCount:learned?10:0,learnedFallbackCount:0};}return {...t,status:'complete',illegalActions:0,errors:0,scores,margin:10,winShare:1,diagnostics,decisionTimes:{candidate:[1000],opponent:[1000]},modelIds:{neural:'a'.repeat(64),linear:'b'.repeat(64)}};};
test('fixed data profiles keep whole games and all splits/banks separate',()=>{
 const banks=[dataTasks('calibration'),dataTasks('full'),dataTasks('compact'),canaryTasks(),screenTasks(),confirmationTasks()].map(ts=>new Set(ts.map(t=>t.seed)));
 for(let i=0;i<banks.length;i++)for(let j=i+1;j<banks.length;j++)assert.equal([...banks[i]].filter(s=>banks[j].has(s)).length,0);
 for(const [p,counts]of [['full',[320,64,128]],['compact',[160,32,64]]]){const ts=dataTasks(p);assert.deepEqual(['train','dev','test'].map(k=>ts.filter(t=>t.split===k).length),counts);assert(ts.every(t=>Number.isSafeInteger(t.budgetSeed)));}
});
test('calibration profile admission consumes only sixteen valid timings',()=>{const rs=Array.from({length:16},()=>({elapsedMs:30000,validation:{valid:true}}));assert.equal(admitDataProfile(rs).profile,'full');assert.equal(admitDataProfile(rs.map(r=>({...r,elapsedMs:1e6}))).profile,'compact');assert.throws(()=>admitDataProfile(rs.slice(1)));assert.throws(()=>admitDataProfile(rs.map(r=>({...r,validation:{valid:false}}))));});
test('proof requires exact task configuration, complete pairs and measured learned usage',()=>{
 const tasks=screenTasks(),rs=tasks.map(result);assert.equal(analyze(rs,tasks).eligible,true);assert.equal(analyze(rs.slice(1),tasks).eligible,false);assert.equal(analyze([...rs,rs[0]],tasks).complete,false);
 const bad=structuredClone(rs[0]);bad.diagnostics.candidate.learnedLeafCount=0;assert(validateResult(bad,tasks[0]).some(x=>x.includes('usage')));bad.diagnostics.candidate.learnedLeafCount=10;bad.modelIds.neural='unhashed';assert(validateResult(bad,tasks[0]).some(x=>x.includes('model-id')));
 const altered=structuredClone(tasks);altered[0].candidate.horizon=12;assert.equal(analyze(altered.map(result),altered).designValid,false);
});
test('fresh confirmation requires both corrected reference and actual deployed gates',()=>{
 const ts=confirmationTasks(),rs=ts.map(result),a=analyze(rs,ts);assert.equal(a.complete,true);assert.equal(a.adoptionRecommended,true);assert.equal(a.productionDefaultsChanged,false);
 for(const r of rs.filter(r=>r.matchup==='reference')){r.scores.reverse();r.margin=-10;r.winShare=0;}assert.equal(analyze(rs,ts).adoptionRecommended,false);
 const timed=ts.map(result);for(const r of timed)r.decisionTimes.candidate=[1500];assert.equal(analyze(timed,ts).adoptionRecommended,false);
});
