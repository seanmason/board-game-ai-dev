import test from 'node:test';
import assert from 'node:assert/strict';
import {decision,pairedInterval,choose} from '../scripts/benchmark-splendor-search.mjs';
import {newGame,observation} from '../splendor/core.js';
test('fixed-work research decisions reproduce exactly',()=>{
  const o=observation(newGame({mode:'digital',seed:71})),config={horizon:2,iterations:12,ms:30,rule:'visits'};
  const a=decision(o,config,12),b=decision(o,config,12);
  assert.deepEqual(a.action,b.action);assert.equal(a.iterations,12);assert.equal(a.selectedVisits,b.selectedVisits);
});
test('mean and visit-count recommendations exercise distinct choices',()=>{
  const s={iterations:11,arms:[{action:{type:'a'},visits:1,sum:9,squares:81,prior:0},{action:{type:'b'},visits:10,sum:50,squares:250,prior:0}]};
  assert.equal(choose(s,'mean').action.type,'a');assert.equal(choose(s,'visits').action.type,'b');
});
test('deal-level bootstrap is seeded and retains degenerate outcomes',()=>{
  assert.deepEqual(pairedInterval([.5,.5,.5]),[.5,.5]);
  assert.deepEqual(pairedInterval([0,.5,1],81),pairedInterval([0,.5,1],81));
});
test('paired tournament rotates seats and recorded work exactly replays a game',async()=>{
  const {tournament,replayGame}=await import('../scripts/benchmark-splendor-search.mjs');
  const config={pairs:1,players:2,seed:9351,a:{horizon:1,ms:1,iterations:1,rule:'mean'},b:{horizon:1,ms:1,iterations:1,rule:'mean'}};
  const report=await tournament(config);
  assert.deepEqual(report.results.map(g=>g.seat),[0,1]);
  assert.equal(report.results[0].gameSeed,report.results[1].gameSeed);
  for(const game of report.results)assert.equal(replayGame(report,game),game.actionDigest);
});
