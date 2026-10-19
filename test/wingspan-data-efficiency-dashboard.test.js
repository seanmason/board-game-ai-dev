import test from 'node:test';import assert from 'node:assert/strict';
import {buildDataEfficiencyDashboard} from '../scripts/wingspan-data-efficiency/dashboard.mjs';
test('new collection dashboard counts28workers without exporting config paths or fake outcomes',()=>{
 const m={status:'running',config:{sourceRevision:'fixture',workers:28,retained:[{path:'C:\\secret\\raw.json',secret:'DO_NOT_EXPORT'}]},stages:{'calibration-hybrid':{kind:'calibration',arm:'hybrid',status:'running',planned:28}}};
 const d=buildDataEfficiencyDashboard({manifest:m,progressByStage:{'calibration-hybrid':{completed:7,total:28,active:Array.from({length:28},(_,i)=>({id:'fixture-'+i}))}}});
 assert.equal(d.study,'wingspan-data-efficiency');assert.equal(d.workers,28);assert.equal(d.finished,7);assert.equal(d.rows[0].winShare.mean,null);assert.equal(d.rows[0].budget.cheapDecisionProbability,.8);assert.doesNotMatch(JSON.stringify(d),/DO_NOT_EXPORT|secret|raw.json/);
});
test('completed collection retains actual time and reports matching independently of fit epochs',()=>{
 const m={status:'running',config:{workers:28},allocation:{counts:{baseline:280,hybrid:560},targetPoolMs:60000},computeMatch:{hybridBaselineRatio:1.02,passed:true,equalComputeClaimAllowed:true},stages:{'collect-baseline':{kind:'collect',arm:'baseline',status:'complete',planned:280,result:{gameCount:280,poolWallMs:60000}},'collect-hybrid':{kind:'collect',arm:'hybrid',status:'complete',planned:560,result:{gameCount:560,poolWallMs:61200}},'train-hybrid':{kind:'train',arm:'hybrid',status:'complete',result:{history:[{epoch:7}],selectedEpoch:3,fitWallMs:1000,dev:{mae:7}}}}};
 const d=buildDataEfficiencyDashboard({manifest:m});assert.equal(d.finished,840);assert.equal(d.workers,0);assert.equal(d.collectionBudget.actualRatio,1.02);assert.equal(d.fitCosts.hybridWallMs,1000);assert.match(d.method,/matching passed/);assert.equal(d.rows[2].training.selectedEpoch,3);
});
test('partial strength remains closed and terminal states expose no active workers',()=>{
 const d=buildDataEfficiencyDashboard({manifest:{status:'stopped',stopReason:'cost mismatch',config:{workers:28},stages:{screen:{kind:'screen',status:'running',planned:80}}},progressByStage:{screen:{completed:30,total:80,active:[{id:'fixture'}]}}});assert.equal(d.workers,0);assert.equal(d.rows[0].winShare.mean,null);assert.match(d.stopReason,/cost mismatch/);
});
