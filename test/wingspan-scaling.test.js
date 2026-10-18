import test from 'node:test';
import assert from 'node:assert/strict';
import {tasks} from '../scripts/benchmark-wingspan-scaling.mjs';

test('scaling comparisons have unique tasks and balanced candidate and starting seats',()=>{
  const rows=tasks();assert.equal(rows.length,168);
  assert.equal(new Set(rows.map(t=>t.id)).size,168);
  const groups=Map.groupBy(rows,t=>`${t.budget}/${t.opponent}/${t.opponentBudget}`);
  assert.equal(groups.size,7);
  for(const group of groups.values()){
    assert.equal(group.length,24);
    assert.equal(group.filter(t=>t.seed%2===0).length,12);
    const pairs=Map.groupBy(group,t=>t.seed);assert.equal(pairs.size,12);
    for(const pair of pairs.values())assert.deepEqual(pair.map(t=>t.seat).sort(),[0,1]);
  }
});
