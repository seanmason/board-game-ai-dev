import test from 'node:test';
import assert from 'node:assert/strict';
import {plan,tasks,selectCandidates} from '../scripts/benchmark-wingspan-specialists.mjs';
test('specialist stages use fresh paired setups and fixed equal compute',()=>{
 const screen=tasks(),confirmation=tasks('confirmation');
 assert.equal(screen.length,120);assert.equal(confirmation.length,240);
 assert.equal(new Set([...screen,...confirmation].map(t=>t.id)).size,360);
 assert.ok(plan.screenSeeds.every(s=>!plan.confirmationSeeds.includes(s)));
 for(const e of plan.evaluators){
  const rows=screen.filter(t=>t.evaluator===e);assert.equal(rows.length,40);
  for(const seed of plan.screenSeeds)assert.deepEqual(rows.filter(t=>t.seed===seed).map(t=>t.seat),[0,1]);
 }
 for(const t of [...screen,...confirmation]){assert.equal(t.budget,t.opponentBudget);assert.equal(t.horizon,4);assert.equal(t.rolloutStepLimit,48);assert.equal(t.budget,t.stage==='screen'?100:300);}
});
test('selection requires complete evidence, positive margin and caps follow-up at two',()=>{
 const rows=tasks().map(t=>({...t,status:'complete',winShare:.6,margin:2}));
 assert.equal(selectCandidates(rows).selected.length,2);
 assert.equal(tasks('confirmation',selectCandidates(rows).selected).length,160);
 const first=plan.evaluators[0];rows.find(r=>r.evaluator===first).status='failed';
 assert.ok(!selectCandidates(rows).selected.includes(first));
 for(const r of rows)if(r.evaluator===plan.evaluators[1])r.margin=0;
 assert.deepEqual(selectCandidates(rows).selected,[plan.evaluators[2]]);
 for(const r of rows)r.winShare=.59;
 assert.deepEqual(selectCandidates(rows).selected,[]);
});
