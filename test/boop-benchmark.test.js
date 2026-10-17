import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmark,searchMetrics,summarizeRecords} from '../scripts/benchmark-boop.mjs';
import {createSearch,runSearch} from '../boop/ai.js';
import {newGame,applyAction} from '../boop/core.js';
test('benchmark distinguishes completed rollouts, heuristic leaves and terminal tree revisits',()=>{
 const search=createSearch(newGame(),{rolloutLength:0});runSearch(search,20);const m=searchMetrics(search);
 assert.equal(m.iterations,20);assert.equal(m.heuristicLeaves,20);assert.equal(m.terminalRollouts,0);assert.equal(m.terminalTreeVisits,0);assert.ok(m.rootCoverage>0&&m.rootCoverage<=1);
});
test('terminal tree revisits are accounted separately from played-out trajectories',()=>{
 const state=newGame();state.board[12]=2;state.board[13]=2;state.pools[0]=[5,1];
 const search=createSearch(state,{rolloutLength:0});runSearch(search,40);const m=searchMetrics(search);
 assert.ok(m.terminalTreeVisits>0);assert.equal(m.terminalRollouts,0);
 assert.equal(m.terminalTreeVisits+m.terminalRollouts+m.heuristicLeaves,m.iterations);
});
test('fixed-count evaluation honors the full requested count and produces replayable traces',async()=>{
 const result=await benchmark({games:2,simulations:30,opponent:'tactical',seed:1910,cap:3});
 assert.equal(result.games,2);assert.equal(result.config.simulations,30);assert.equal(result.timing.guided.iterations.min,30);assert.equal(result.timing.guided.iterations.max,30);
 for(const r of result.records){let state=newGame({mode:'digital'});for(const a of r.opening)state=applyAction(state,a);for(const move of r.moves){assert.equal(state.currentPlayer,move.actor);assert.equal(state.ply,move.ply);state=applyAction(state,move.action);}assert.equal(state.winner,r.winner);assert.equal(state.ply,r.turns);}
});
test('time-based evaluation still honors a minimum playout requirement',async()=>{
 const r=await benchmark({games:1,ms:0,'min-simulations':25,cap:1,opponent:'tactical'});assert.equal(r.timing.guided.iterations.min,25);
});
test('sharded games preserve global IDs, alternating seats and paired openings',async()=>{
 const a=await benchmark({games:2,simulations:2,cap:1,opponent:'tactical',seed:91});
 const b=await benchmark({games:1,'game-offset':1,simulations:2,cap:1,opponent:'tactical',seed:91});
 assert.equal(b.records[0].game,1);assert.equal(b.records[0].seat,1);assert.deepEqual(a.records[1].opening,b.records[0].opening);assert.deepEqual(a.records[1].moves.map(m=>m.action),b.records[0].moves.map(m=>m.action));
 const sum=summarizeRecords(a.records);assert.equal(sum.capped,2);assert.equal(sum.winRateCompleted,null,'Capped games are not official draws');
});
