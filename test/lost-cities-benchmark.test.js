import test from 'node:test';
import assert from 'node:assert/strict';
import {runGame,production,comparator,metadata} from '../scripts/benchmark-adapters/lost-cities.mjs';
import {newGame,legalActions} from '../lost-cities/core.js';
import {publicObservation} from '../lost-cities/observations.js';
test('Lost adapter default is browser practical, never silently sampled',()=>{
 const s=newGame({mode:'digital',seed:23}),actions=legalActions(s),plain=publicObservation(s,0);
 Object.defineProperty(s.hands,1,{get(){throw Error('opponent hand leak');}});for(const field of ['deck','seed'])Object.defineProperty(s,field,{get(){throw Error('hidden truth leak');}});
 const obs=publicObservation(s,0);assert.deepEqual(obs,plain);const practical=production(obs,actions,{iterations:300});assert.equal(practical.iterations,0);assert.equal(practical.coveredRoots,actions.length);assert(actions.includes(comparator(obs,actions)));
 const sampled=production(obs,actions,{policy:'sampled',iterations:1});assert.equal(sampled.iterations,actions.length);assert.equal(sampled.coveredRoots,sampled.roots);
});
test('Lost cap is not a draw; default policy uses zero samples and deterministic parity starters',async()=>{
 const options={seed:6,seat:0,players:2,budget:{iterations:0},maxTurns:4},a=await runGame(options),b=await runGame({...options,seat:1});assert.equal(a.status,'capped');assert.equal(a.shares,null);assert.equal(a.scores,null);assert.equal(a.diagnostics.iterations,0);assert.equal(a.policyId,metadata.policyId);assert.deepEqual(a.diagnostics.starterSchedule,[1,0]);assert.deepEqual(a.diagnostics.starterSchedule,b.diagnostics.starterSchedule);await assert.rejects(runGame({...options,policy:'sampled'}));
});
