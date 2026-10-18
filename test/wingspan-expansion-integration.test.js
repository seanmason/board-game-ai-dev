import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../wingspan/core.js';
import {scorePlayer} from '../wingspan/scoring.js';
import {evaluateLeaf,LEAF_EVALUATORS} from '../wingspan/leaf-evaluators.js';
import {DEVELOPMENT_EVALUATORS} from '../wingspan/development-evaluators.js';
import {MECHANICS_EVALUATORS} from '../wingspan/mechanics-evaluators.js';
import {plan} from '../scripts/benchmark-wingspan-expansion.mjs';
test('all24 scheduled evaluators dispatch through production leaf interface and preserve terminal scores',()=>{
 assert.deepEqual(plan.evaluators,[...DEVELOPMENT_EVALUATORS,...MECHANICS_EVALUATORS]);
 for(const seed of [1,4,11]){
  const s=newGame({seed}),before=JSON.stringify(s);
  for(const name of plan.evaluators){assert.ok(LEAF_EVALUATORS.includes(name));assert.ok(Number.isFinite(evaluateLeaf(s,0,name)));}
  assert.equal(JSON.stringify(s),before);
  s.phase='gameover';for(const name of plan.evaluators)assert.equal(evaluateLeaf(s,0,name),scorePlayer(s.players[0]).total);
 }
 [1,4,11].forEach((seed,i)=>assert.equal(evaluateLeaf(newGame({seed}),0),[15.715666666666667,11.795666666666667,15.435666666666666][i]));
});
