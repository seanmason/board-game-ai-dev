import test from 'node:test';
import assert from 'node:assert/strict';
import {tasks} from '../scripts/benchmark-wingspan-depth.mjs';
test('depth study holds samples fixed and pairs every matchup with balanced starts',()=>{
  const rows=tasks();assert.equal(rows.length,72);assert.equal(new Set(rows.map(r=>r.id)).size,72);
  const groups=Map.groupBy(rows,r=>`${r.horizon}/${r.opponentHorizon}`);assert.equal(groups.size,6);
  for(const r of rows){assert.equal(r.budget,100);assert.equal(r.opponentBudget,100);assert.ok(r.horizon>r.opponentHorizon);}
  for(const group of groups.values()){
    assert.equal(group.length,12);assert.equal(group.filter(r=>r.seed%2===0).length,6);
    for(const pair of Map.groupBy(group,r=>r.seed).values())assert.deepEqual(pair.map(r=>r.seat).sort(),[0,1]);
  }
});
