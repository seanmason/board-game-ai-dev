import test from 'node:test';
import assert from 'node:assert/strict';
import {tasks,play} from '../scripts/benchmark-wingspan-screen.mjs';
import {newGame,publicObservation,seededRandom} from '../wingspan/core.js';
import {candidateActions} from '../wingspan/actions.js';
import {createSearch,runSearch,searchSummary} from '../wingspan/analysis.js';
test('fixed iteration search is equivalent across batched and single-sample execution',()=>{
  const state=newGame({seed:817030});const choices=candidateActions(state);
  const make=()=>createSearch(publicObservation(state,0),choices,{method:'belief-rollout',horizon:4,rng:seededRandom(991)});
  const a=make(),b=make();runSearch(a,30);for(let i=0;i<30;i++)runSearch(b,1);
  assert.deepEqual(searchSummary(a),searchSummary(b));
  assert.equal(a.arms.reduce((n,x)=>n+x.visits,0),30);
});
test('screen pairs identical deals with both candidate seats and fixed budgets',()=>{
  const rows=tasks();assert.equal(rows.length,32);
  for(let i=0;i<rows.length;i+=2){assert.equal(rows[i].seed,rows[i+1].seed);assert.equal(rows[i].seat,0);assert.equal(rows[i+1].seat,1);}
});
test('capped screen games do not publish score or win metrics',()=>{
  const r=play(tasks()[0],{stepCap:0});assert.equal(r.status,'capped');
  assert.equal('scores' in r,false);assert.equal('winShare' in r,false);
});
