import test from 'node:test';
import assert from 'node:assert/strict';
import {plan,tasks,selectCandidates} from '../scripts/benchmark-wingspan-diverse.mjs';
test('diverse screen covers twelve methods, balanced pairs and disjoint confirmation seeds',()=>{
 const rows=tasks();assert.equal(plan.evaluators.length,12);assert.equal(rows.length,576);
 assert.equal(new Set(rows.map(r=>r.id)).size,576);
 assert.ok(plan.screenSeeds.every(s=>!plan.confirmationSeeds.includes(s)));
 for(const e of plan.evaluators){const group=rows.filter(r=>r.evaluator===e);assert.equal(group.length,48);for(const s of plan.screenSeeds)assert.deepEqual(group.filter(r=>r.seed===s).map(r=>r.seat),[0,1]);}
 for(const r of rows){assert.equal(r.budget,100);assert.equal(r.opponentBudget,100);assert.equal(r.horizon,4);}
});
test('diverse confirmation requires all48 valid and caps selection at three',()=>{
 const rows=tasks().map(r=>({...r,status:'complete',winShare:1,margin:1}));
 const selected=selectCandidates(rows).selected;assert.equal(selected.length,3);
 const confirm=tasks('confirmation',selected);assert.equal(confirm.length,240);
 for(const r of confirm){assert.equal(r.budget,300);assert.equal(r.opponentBudget,300);}
 for(const r of rows)r.winShare=.59;
 assert.deepEqual(selectCandidates(rows).selected,[]);
 for(const r of rows)r.winShare=1;
 rows.find(r=>r.evaluator===selected[0]).status='failed';
 assert.ok(!selectCandidates(rows).selected.includes(selected[0]));
});
