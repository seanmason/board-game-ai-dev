import test from 'node:test';
import assert from 'node:assert/strict';
import {plan,tasks,selectCandidates,atomic} from '../scripts/benchmark-wingspan-expansion.mjs';
test('checkpoint publication survives transient Windows reader locks and exposes permanent failures',()=>{
 let attempts=0,writes=0;const pauses=[];
 atomic('checkpoint',{finished:1},{writeFileSync:()=>writes++,renameSync:()=>{if(++attempts<3)throw Object.assign(new Error('reader lock'),{code:'EPERM'});}},ms=>pauses.push(ms));
 assert.equal(writes,1);assert.equal(attempts,3);assert.deepEqual(pauses,[25,50]);
 assert.throws(()=>atomic('checkpoint',{}, {writeFileSync:()=>{},renameSync:()=>{throw Object.assign(new Error('disk fault'),{code:'EIO'});}},()=>{}),/disk fault/);
 attempts=0;assert.throws(()=>atomic('checkpoint',{}, {writeFileSync:()=>{},renameSync:()=>{attempts++;throw Object.assign(new Error('permanent lock'),{code:'EPERM'});}},()=>{}),/permanent lock/);assert.equal(attempts,9);
});
test('expansion screen covers twenty-four methods, balanced pairs and disjoint confirmation seeds',()=>{
 const rows=tasks();assert.equal(plan.evaluators.length,24);assert.equal(rows.length,1152);
 assert.equal(new Set(rows.map(r=>r.id)).size,1152);
 assert.ok(plan.screenSeeds.every(s=>!plan.confirmationSeeds.includes(s)));
 for(const e of plan.evaluators){const group=rows.filter(r=>r.evaluator===e);assert.equal(group.length,48);for(const s of plan.screenSeeds)assert.deepEqual(group.filter(r=>r.seed===s).map(r=>r.seat),[0,1]);}
 for(const r of rows){assert.equal(r.budget,100);assert.equal(r.opponentBudget,100);assert.equal(r.horizon,4);}
});
test('expansion confirmation requires all48 valid and caps selection at four',()=>{
 const rows=tasks().map(r=>({...r,status:'complete',winShare:1,margin:1}));
 const selected=selectCandidates(rows).selected;assert.equal(selected.length,4);
 const confirm=tasks('confirmation',selected);assert.equal(confirm.length,480);
 for(const r of confirm){assert.equal(r.budget,300);assert.equal(r.opponentBudget,300);}
 for(const r of rows)r.winShare=.59;
 assert.deepEqual(selectCandidates(rows).selected,[]);
 for(const r of rows)r.winShare=1;
 rows.find(r=>r.evaluator===selected[0]).status='failed';
 assert.ok(!selectCandidates(rows).selected.includes(selected[0]));
});
