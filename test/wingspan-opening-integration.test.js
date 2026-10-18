import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,publicObservation} from '../wingspan/core.js';
import {candidateActions} from '../wingspan/actions.js';
import {createSearch,runSearch,searchSummary} from '../wingspan/analysis.js';
import {evaluateLeaf} from '../wingspan/leaf-evaluators.js';
import {openingSetupActions,openingAdjustment} from '../wingspan/opening-strategy.js';
test('opening strategy dispatches through observation search and preserves baseline',()=>{
 const s=newGame({seed:4}),before=JSON.stringify(s),base=evaluateLeaf(s,0,'practical-combined');
 assert.equal(base,11.795666666666667);
 assert.equal(evaluateLeaf(s,0,'opening-plan'),base+openingAdjustment(s,0));
 const choices=openingSetupActions(s,candidateActions(s));
 const search=createSearch(publicObservation(s,s.currentPlayer),choices,{method:'belief-rollout',leafEvaluator:'opening-plan',horizon:4,rng:()=>.5});
 runSearch(search,choices.length);assert.ok(searchSummary(search).candidates.length>0);
 assert.equal(JSON.stringify(s),before);
});
