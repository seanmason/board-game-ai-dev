import test from 'node:test';
import assert from 'node:assert/strict';
import {tasks as original} from '../scripts/benchmark-wingspan-depth-budget.mjs';
import {tasks as extension} from '../scripts/benchmark-wingspan-depth-budget-3000.mjs';
import {tasks as confirmation} from '../scripts/benchmark-wingspan-depth-budget-confidence.mjs';
test('expanded study has 30 balanced setup pairs per matchup without duplicate games',()=>{
 const rows=[...original(),...extension(),...confirmation()];
 assert.equal(rows.length,900);assert.equal(new Set(rows.map(r=>r.id)).size,900);
 const groups=Map.groupBy(rows,r=>[r.horizon,r.budget,r.opponentHorizon,r.opponentBudget].join('/'));
 assert.equal(groups.size,15);
 for(const group of groups.values()){
  assert.equal(group.length,60);assert.equal(group.filter(r=>r.seed%2===0).length,30);
  const pairs=Map.groupBy(group,r=>r.seed);assert.equal(pairs.size,30);
  for(const pair of pairs.values())assert.deepEqual(pair.map(r=>r.seat).sort(),[0,1]);
 }
});
