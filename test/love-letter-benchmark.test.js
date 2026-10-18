import test from 'node:test';
import assert from 'node:assert/strict';
import {runGame,production,comparator,metadata} from '../scripts/benchmark-adapters/love-letter.mjs';
import {newGame,applyAction,legalActions} from '../love-letter/core.js';
import {publicObservation} from '../love-letter/observations.js';
test('Love Letter adapter keeps actor-only knowledge and covers every legal root',()=>{
 let s=newGame({players:2,mode:'digital',seed:23});s=applyAction(s,{type:'draw'});const actions=legalActions(s),plain=publicObservation(s,s.current);
 Object.defineProperty(s.hands,1,{get(){throw Error('opponent hand leak');}});for(const field of ['deck','seed','reserve'])Object.defineProperty(s,field,{get(){throw Error('hidden truth leak');}});
 const obs=publicObservation(s,0);assert.deepEqual(obs,plain);const r=production(obs,actions,{iterations:1});assert.equal(r.iterations,actions.length);assert.equal(r.coveredRoots,r.roots);assert(actions.includes(comparator(obs,actions)));
});
test('Love Letter comparator uses actual known Guard target and handles no-target discard',()=>{
 const obs={ownHand:[1,6],viewer:0,memories:[{}, {known:5}],discards:[[],[]],exclusions:[]},a={type:'play',cardRank:1,target:1,guess:5},b={...a,guess:2};assert.equal(comparator(obs,[b,a]),a);assert.equal(comparator(obs,[{type:'play',cardRank:1}]).cardRank,1);
});
test('Love Letter capped match has no fabricated winner and replay is deterministic',async()=>{
 const options={seed:7,seat:0,players:2,budget:{iterations:1},maxTurns:2},a=await runGame(options),b=await runGame(options);assert.equal(a.status,'capped');assert.equal(a.shares,null);assert.equal(a.scores,null);assert.equal(a.margin,null);assert.equal(a.diagnostics.transcriptHash,b.diagnostics.transcriptHash);assert.equal(a.policyId,metadata.policyId);await assert.rejects(runGame({...options,players:5}));
});
