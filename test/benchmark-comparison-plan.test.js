import test from 'node:test';import assert from 'node:assert/strict';import {buildTasks} from '../scripts/benchmark-comparison-plan.mjs';
const metadata={fixture:{supportedPlayers:[2,3,4],scope:'match',defaultBudget:{samples:128,maxTurns:600}}};
test('focused plan rotates every seat once per independent seed and identifies both policies',()=>{
 const tasks=buildTasks(metadata,{pairs:2,seedBase:910000,players:[3,4],policy:'planning-v2',opponent:'incumbent-v1',budget:{samples:64}});
 assert.equal(tasks.length,14);assert.equal(new Set(tasks.map(t=>t.id)).size,14);assert.deepEqual([...new Set(tasks.map(t=>t.seed))],[910000,910997]);
 for(const players of [3,4])for(const seed of [910000,910997])assert.deepEqual(tasks.filter(t=>t.players===players&&t.seed===seed).map(t=>t.seat),Array.from({length:players},(_,i)=>i));
 assert(tasks.every(t=>t.opponent==='incumbent-v1'&&t.matchup.endsWith('-vs-incumbent-v1')&&t.budget.samples===64&&t.budget.maxTurns===600));assert.equal(metadata.fixture.defaultBudget.samples,128);
});
test('plan rejects unsupported counts and wrapping seeds instead of silently shortening the study',()=>{
 assert.throws(()=>buildTasks(metadata,{players:[5]}),/Unsupported/);assert.throws(()=>buildTasks(metadata,{players:[2,2]}),/selection/);assert.throws(()=>buildTasks(metadata,{seedBase:0xffffffff,pairs:2}),/seed/);
 assert.equal(buildTasks(metadata,{pairs:1,players:[2]})[0].id,'fixture-2p-production-default-5182600-0');
});
