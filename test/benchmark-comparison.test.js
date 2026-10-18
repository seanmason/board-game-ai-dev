import test from 'node:test';import assert from 'node:assert/strict';
import {interval,summarize} from '../scripts/benchmark-comparison-summary.mjs';
test('paired uncertainty counts complete seed groups rather than seats and retains failures',()=>{
 const tasks=[10,20,30].flatMap(seed=>[0,1].map(seat=>({id:`${seed}-${seat}`,matchup:'test',game:'test',players:2,seed,seat,policy:'default',budget:{}})));
 const manifest={study:'fixture',tasks,metadata:{test:{scope:'match'}},workers:1};
 const results=tasks.map(t=>({...t,status:t.seed===30&&t.seat===1?'capped':'complete',shares:t.seed===10?[1,0]:[0,1],margin:t.seat===0?2:-2,latency:{count:1,totalMs:5,maxMs:5}}));
 results.at(-1).latency={count:1,totalMs:65,maxMs:65};
 const row=summarize(manifest,results).rows[0];assert.equal(row.meanDecisionMs,15);assert.equal(row.maxDecisionMs,65);assert.equal(row.completeSeedGroups,2);assert.equal(row.winShare.n,2);assert.equal(row.winShare.mean,.5);assert.equal(row.counts.capped,1);assert.equal(row.finished,6);assert.equal(row.margin.mean,0);
});
test('interval handles missing and one group without fabricated certainty',()=>{assert.equal(interval([]).mean,null);assert.equal(interval([.5]).low,null);assert.deepEqual(interval([1,1],true),{mean:1,low:1,high:1,n:2});});
