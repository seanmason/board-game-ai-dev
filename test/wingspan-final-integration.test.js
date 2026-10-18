import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../wingspan/core.js';
import {evaluateLeaf,LEAF_EVALUATORS} from '../wingspan/leaf-evaluators.js';
import {FINAL_EVALUATORS,finalAdjustments} from '../wingspan/final-evaluators.js';
import {createSearch,runSearch,searchSummary} from '../wingspan/analysis.js';
import {publicObservation} from '../wingspan/core.js';
import {candidateActions} from '../wingspan/actions.js';
test('final methods dispatch through public-observation search without changing baseline',()=>{
 const s=newGame({seed:4}),before=JSON.stringify(s),base=evaluateLeaf(s,0,'practical-combined');
 assert.equal(base,11.795666666666667);
 for(const method of FINAL_EVALUATORS){
  assert.ok(LEAF_EVALUATORS.includes(method));
  assert.equal(evaluateLeaf(s,0,method),base+finalAdjustments(s,0)[method]);
  const search=createSearch(publicObservation(s,s.currentPlayer),candidateActions(s),{method:'belief-rollout',leafEvaluator:method,horizon:4,rng:()=>.5});
  runSearch(search,3);assert.ok(searchSummary(search).candidates.length>0);
 }
 assert.equal(JSON.stringify(s),before);
});
