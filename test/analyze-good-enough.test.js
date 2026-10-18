import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ARM_SPECS,analyze,readArms} from '../scripts/analyze-good-enough.mjs';
import {buildTasks} from '../scripts/benchmark-comparison-plan.mjs';

function fixture() {
  return Object.fromEntries(Object.entries(ARM_SPECS).map(([name,spec])=>{
    const metadata={[spec.game]:{supportedPlayers:spec.players,defaultBudget:spec.budget,scope:'match',policyId:'control-id',historyPolicyId:'history-id',opponentPolicyId:'simple-id'}};
    const tasks=buildTasks(metadata,{...spec,opponent:'simple-v1'});
    const manifest={revision:'85cee8d',pairs:spec.pairs,metadata,tasks,hashes:{'shared.js':'a'.repeat(64),[`${spec.game}/core.js`]:'b'.repeat(64)}};
    const records=tasks.map(t=>({...t,budget:spec.game==='hive'?t.budget:{...t.budget,rootCoverageFloor:true},requestedBudget:t.budget,status:'complete',shares:Array(t.players).fill(1/t.players),policyId:spec.policy==='history-v1'?'history-id':'control-id',opponentPolicyId:'simple-id',margin:spec.game==='sushi-go'?1:null,
      latency:{count:2,totalMs:10,maxMs:6},diagnostics:spec.game==='hive'?{illegalActions:0,opening:{sha256:t.seed.toString(16).padStart(64,'0')}}:{iterations:t.budget.iterations*2,roots:8,coveredRoots:8}}));
    return [name,{manifest,records}];
  }));
}
function incomplete(r,status='unresolved') {Object.assign(r,{status,shares:null,margin:null});}

test('all scheduled seat games aggregate to independent setup groups and preserve actual effort',()=>{
  const arms=fixture();
  for (const r of arms['love-high'].records) {r.shares=Array(r.players).fill(0);r.shares[r.seat]=1;}
  const result=analyze(arms),love=result.strata[0];
  assert.equal(result.strata.length,4);assert.equal(love.setupGroups,40);assert.equal(love.winShareDelta.n,40);assert.equal(love.winShareDelta.mean,.5);
  assert.equal(love.gate.positiveDescriptiveSupport,true);assert.equal(love.gate.promotion,false);
  assert.equal(love.metrics.candidate.iterationsPerDecision,512);assert.equal(love.metrics.candidate.rootCoverage,1);
  assert.equal(love.metrics.candidate.conditionalWinShare.mean,1);assert.equal(love.metrics.candidate.conditionalWinShare.n,40);
  assert.equal(result.strata[2].marginDelta.mean,0);assert.equal(result.strata[3].completionDelta.n,100);
  assert.match(result.method.intervals,/n=100/);assert.match(result.method.multiplicity,/three descriptive exploratory/);
});

test('incomplete games remain unadjudicated and enter all-setup completion and sensitivity bounds',()=>{
  const arms=fixture(),seed=ARM_SPECS['love-high'].seedBase;
  incomplete(arms['love-high'].records.find(r=>r.seed===seed&&r.players===2&&r.seat===0));
  const row=analyze(arms).strata[0];
  assert.equal(row.completePairedGroups,39);assert.equal(row.winShareDelta.n,39);
  assert.equal(row.completionDelta.n,40);assert.equal(row.completionDelta.mean,-.5/40);
  assert.equal(row.observedWinLowerBoundDelta.mean,-.25/40);
  assert.equal(row.sensitivityWinShareDelta.low,-.25/40);assert.equal(row.sensitivityWinShareDelta.high,.25/40);
  assert.equal(row.gate.positiveDescriptiveSupport,false);assert.equal(row.groups[0].winShareDelta,null);
});

test('Hive confirmation uses 100 paired setup completion deltas and observed-win lower bound guard',()=>{
  const arms=fixture();
  for (const r of arms['hive-control'].records) if((r.seed-9382600)/997<30) incomplete(r);
  let hive=analyze(arms).strata[3];
  assert.equal(hive.completionDelta.mean,.3);assert.equal(hive.gate.passed,true);assert.ok(hive.gate.completionOneSided975Lower>0);
  assert.equal(hive.winShareDelta.n,70);assert.equal(hive.observedWinLowerBoundDelta.mean,.15);
  for (const r of arms['hive-history'].records) {r.shares=[0,0];r.shares[1-r.seat]=1;}
  hive=analyze(arms).strata[3];assert.equal(hive.gate.passed,false);assert.equal(hive.gate.observedWinLowerBoundNoWorse,false);
});

test('Hive completion threshold and illegal/error guards cannot be bypassed',()=>{
  let arms=fixture();
  for (const r of arms['hive-control'].records) if((r.seed-9382600)/997<9) incomplete(r);
  assert.equal(analyze(arms).strata[3].gate.passed,false);
  arms=fixture();for(const r of arms['hive-control'].records) if((r.seed-9382600)/997<30) incomplete(r);
  incomplete(arms['hive-history'].records[0],'illegal');
  assert.equal(analyze(arms).strata[3].gate.zeroIllegalErrors,false);assert.equal(analyze(arms).strata[3].gate.passed,false);
  arms['hive-history'].records[0].status='error';delete arms['hive-history'].records[0].latency;delete arms['hive-history'].records[0].diagnostics;
  assert.equal(analyze(arms).strata[3].gate.passed,false);
});

test('latency separates decision weighting from paired per-game means and includes incomplete games',()=>{
  const arms=fixture(),r=arms['love-high'].records.find(r=>r.players===2);
  incomplete(r);r.latency={count:10,totalMs:100,maxMs:10};
  const row=analyze(arms).strata[0];
  assert.equal(row.metrics.candidate.decisionWeightedLatencyMs,(79*10+100)/(79*2+10));
  assert.equal(row.pairedGameMeanLatencyDeltaMs.mean,2.5/40);assert.equal(row.pairedGameMeanLatencyDeltaMs.n,40);
  r.latency={count:0,totalMs:0,maxMs:0};assert.equal(analyze(arms).strata[0].pairedGameMeanLatencyDeltaMs.n,39);
});

test('strict keys, task budgets, seeds, records, statuses and source identity fail closed',()=>{
  const mutations=[
    a=>delete a['love-low'],
    a=>a['love-low'].manifest.tasks.push(a['love-low'].manifest.tasks[0]),
    a=>a['love-low'].manifest.tasks[0].seed++,
    a=>a['love-low'].manifest.tasks[0].budget.iterations=63,
    a=>a['love-low'].records.pop(),
    a=>a['love-low'].records.push(a['love-low'].records[0]),
    a=>a['love-low'].records[0].seat=1,
    a=>a['love-low'].records[0].status='draw',
    a=>a['love-low'].records[0].shares=[1,1],
    a=>a['love-low'].records[0].policyId='wrong',
    a=>a['love-low'].records[0].latency.totalMs=-1,
    a=>a['love-low'].manifest.revision='other',
    a=>a['sushi-low'].manifest.hashes['shared.js']='c'.repeat(64),
    a=>delete a['love-low'].manifest.hashes['love-letter/core.js'],
    a=>a['hive-history'].records[0].diagnostics.opening.sha256='f'.repeat(64),
    a=>incomplete(a['love-low'].records[0])|| (a['love-low'].records[0].shares=[.5,.5])
  ];
  for(const mutation of mutations) {const arms=fixture();mutation(arms);assert.throws(()=>analyze(arms));}
});

test('CLI writes analysis.json only with all required records; reads reject filename/id mismatch',()=>{
  const root=mkdtempSync(resolve(tmpdir(),'good-enough-analysis-'));
  try {
    const arms=fixture();for(const [name,arm]of Object.entries(arms)) {
      const dir=resolve(root,name);mkdirSync(resolve(dir,'games'),{recursive:true});writeFileSync(resolve(dir,'manifest.json'),JSON.stringify(arm.manifest));
      for(const r of arm.records) writeFileSync(resolve(dir,'games',`${r.id}.json`),JSON.stringify(r));
    }
    assert.equal(analyze(readArms(root)).strata.length,4);
    const script=resolve('scripts/analyze-good-enough.mjs');
    const run=spawnSync(process.execPath,[script,`--root=${root}`,`--out=${resolve(root,'output')}`],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(readFileSync(resolve(root,'output/analysis.json'),'utf8')).strata.length,4);
    const r=arms['love-low'].records[0];rmSync(resolve(root,'love-low/games',`${r.id}.json`));
    assert.notEqual(spawnSync(process.execPath,[script,`--root=${root}`],{encoding:'utf8'}).status,0);
    writeFileSync(resolve(root,'love-low/games/wrong.json'),JSON.stringify(r));assert.throws(()=>readArms(root),/filename/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
