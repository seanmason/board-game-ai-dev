import test from 'node:test';
import assert from 'node:assert/strict';
import {tasks} from '../scripts/benchmark-wingspan-evaluators.mjs';
import {LEAF_EVALUATORS} from '../wingspan/leaf-evaluators.js';
import {newGame,publicObservation,seededRandom} from '../wingspan/core.js';
import {candidateActions} from '../wingspan/actions.js';
import {createSearch,runSearch,searchSummary} from '../wingspan/analysis.js';
test('evaluator screen isolates leaf scoring across twenty balanced setup pairs',()=>{
 const rows=tasks();assert.equal(rows.length,320);assert.equal(new Set(rows.map(r=>r.id)).size,320);
 const groups=Map.groupBy(rows,r=>r.evaluator);assert.equal(groups.size,8);
 for(const group of groups.values()){
  assert.equal(group.length,40);assert.equal(group.filter(r=>r.seed%2===0).length,20);
  const pairs=Map.groupBy(group,r=>r.seed);assert.equal(pairs.size,20);
  for(const pair of pairs.values())assert.deepEqual(pair.map(r=>r.seat).sort(),[0,1]);
 }
 for(const r of rows){assert.equal(r.opponentEvaluator,'current');assert.equal(r.horizon,4);assert.equal(r.opponentHorizon,4);assert.equal(r.budget,100);assert.equal(r.opponentBudget,100);}
});
test('default evaluator is unchanged and every alternative runs through search',()=>{
 const s=newGame({players:2,seed:179}),o=publicObservation(s,0),a=candidateActions(s);
 const run=leafEvaluator=>{const search=createSearch(o,a,{method:'belief-rollout',horizon:4,rng:seededRandom(88),...(leafEvaluator?{leafEvaluator}:{})});runSearch(search,3);return searchSummary(search);};
 assert.deepEqual(run(),run('current'));
 for(const method of LEAF_EVALUATORS){const result=run(method);assert.equal(result.iterations,3);assert.ok(result.candidates.every(c=>Number.isFinite(c.sum)));}
 assert.throws(()=>run('missing'),/evaluator/);
});
