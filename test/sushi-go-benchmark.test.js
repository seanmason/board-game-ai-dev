import test from 'node:test';
import assert from 'node:assert/strict';
import {runGame,production,comparator,metadata} from '../scripts/benchmark-adapters/sushi-go.mjs';
import {newGame,legalActions} from '../sushi-go/core.js';
import {publicObservation} from '../sushi-go/observations.js';
test('Sushi adapter only sees own packet/memory, covering all ordered roots',()=>{
 const s=newGame({players:2,mode:'digital',seed:23}),actions=legalActions(s,0),plain=publicObservation(s,0);
 Object.defineProperty(s.hands,1,{get(){throw Error('opponent packet leak');}});Object.defineProperty(s.commitments,1,{get(){throw Error('hidden commitment leak');}});Object.defineProperty(s,'deck',{get(){throw Error('deck leak');}});
 const obs=publicObservation(s,0);assert.deepEqual(obs,plain);const r=production(obs,actions,{iterations:1});assert.equal(r.iterations,actions.length);assert.equal(r.coveredRoots,r.roots);assert(actions.includes(comparator(obs,actions)));
});
test('Independent Sushi comparator respects Wasabi/Nigiri order',()=>{
 const obs={viewer:0,tableaux:[[]],remaining:5},good={cards:['wasabi','squid']},bad={cards:['squid','wasabi']};assert.equal(comparator(obs,[bad,good]),good);
});
test('Sushi incomplete match nulls outcomes and seeded joint decisions replay',async()=>{
 const options={seed:5,seat:1,players:2,budget:{iterations:1},maxTurns:1},a=await runGame(options),b=await runGame(options);assert.equal(a.status,'capped');assert.equal(a.shares,null);assert.equal(a.scores,null);assert.equal(a.diagnostics.transcriptHash,b.diagnostics.transcriptHash);assert.equal(a.policyId,metadata.policyId);await assert.rejects(runGame({...options,seat:2}));
});
