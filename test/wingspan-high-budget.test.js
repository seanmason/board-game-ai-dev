import test from 'node:test';
import assert from 'node:assert/strict';
import {tasks} from '../scripts/benchmark-wingspan-high-budget.mjs';
test('high-budget comparison fixes twenty games with paired seats and balanced starters',()=>{
  const rows=tasks();assert.equal(rows.length,20);
  assert.equal(new Set(rows.map(t=>t.id)).size,20);
  assert.equal(rows.filter(t=>t.seed%2===0).length,10);
  for(const t of rows){assert.equal(t.budget,10000);assert.equal(t.opponentBudget,300);assert.equal(t.opponent,'belief-rollout');}
  const pairs=Map.groupBy(rows,t=>t.seed);assert.equal(pairs.size,10);
  for(const pair of pairs.values())assert.deepEqual(pair.map(t=>t.seat).sort(),[0,1]);
});
