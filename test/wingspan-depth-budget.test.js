import test from 'node:test';
import assert from 'node:assert/strict';
import {tasks} from '../scripts/benchmark-wingspan-depth-budget.mjs';
test('depth-budget matrix isolates each variable with balanced paired seeds',()=>{
 const rows=tasks();assert.equal(rows.length,108);assert.equal(new Set(rows.map(r=>r.id)).size,108);
 const groups=Map.groupBy(rows,r=>`${r.horizon}/${r.budget}/${r.opponentHorizon}/${r.opponentBudget}`);
 assert.equal(groups.size,9);
 for(const r of rows){assert.equal(r.rolloutStepLimit,160);assert.notEqual(r.horizon===r.opponentHorizon,r.budget===r.opponentBudget);}
 for(const group of groups.values()){
  assert.equal(group.length,12);assert.equal(group.filter(r=>r.seed%2===0).length,6);
  const pairs=Map.groupBy(group,r=>r.seed);assert.equal(pairs.size,6);
  for(const pair of pairs.values())assert.deepEqual(pair.map(r=>r.seat).sort(),[0,1]);
 }
});
