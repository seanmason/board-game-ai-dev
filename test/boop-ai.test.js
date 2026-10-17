import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,legalActions,seededRandom,actionKey,owner} from '../boop/core.js';
import {createSearch,runSearch,searchSummary,bestAction,advanceSearch,winningActions,heuristicBestAction,positionScore} from '../boop/ai.js';
function fixture(entries,cats=[0,0]){const s=newGame();for(const [i,v] of entries)s.board[i]=v;s.pools=[0,1].map(p=>[8-cats[p]-s.board.filter(v=>owner(v)===p&&Math.abs(v)===1).length,cats[p]-s.board.filter(v=>owner(v)===p&&Math.abs(v)===2).length]);return s;}
test('guided search finds an immediate cat win at one simulation',()=>{
  const s=fixture([[12,2],[13,2]],[3,0]),search=createSearch(s,{rng:seededRandom(72)});runSearch(search,1);
  const a=bestAction(search);assert.equal(applyAction(s,a).winner,0);assert.equal(searchSummary(search).candidates[0].tactic,1);
});
test('guided search and tactical heuristic avoid an opponent one-move win',()=>{
  const s=fixture([[12,-2],[13,-2]],[1,3]);const search=createSearch(s,{rng:seededRandom(73)});runSearch(search,90);
  const a=bestAction(search);assert.equal(winningActions(applyAction(s,a)).length,0);
  const h=heuristicBestAction(s);assert.equal(winningActions(applyAction(s,h)).length,0);
  assert.ok(search.rootTactics.size===legalActions(s).length);
  assert.ok([...search.rootTactics.values()].some(x=>x===-1),'Fixture really contains losing options');
});
test('eight-cat victory is recognized by tactical checks',()=>{
  const s=fixture([[0,2],[2,2],[5,2],[12,2],[17,2],[30,2],[32,2]],[8,0]);
  assert.ok(winningActions(s).some(a=>a.cell===35));const search=createSearch(s);runSearch(search,1);assert.equal(applyAction(s,bestAction(search)).winner,0);
});
test('fixed seeds reproduce the complete search and do not mutate the position',()=>{
  const s=newGame(),before=JSON.stringify(s);
  const run=()=>{const search=createSearch(s,{rng:seededRandom(723),rolloutLength:5});runSearch(search,100);return searchSummary(search);};
  assert.deepEqual(run(),run());assert.equal(JSON.stringify(s),before);
});
test('heuristic leaves are separate from actual terminal outcomes',()=>{
  const search=createSearch(newGame(),{rng:seededRandom(4),rolloutLength:0});runSearch(search,40);
  const sum=searchSummary(search);assert.equal(sum.terminalSamples,0);assert.equal(sum.candidates.reduce((n,c)=>n+c.visits,0),40);
  for(const c of sum.candidates){assert.equal(c.terminalSamples,0);assert.deepEqual(c.terminalWins,[0,0]);assert.ok(Math.abs(c.valueSum[0]+c.valueSum[1]-c.visits)<1e-8);}
  assert.ok(sum.candidates.some(c=>c.valueSum[0]>0));
});
test('all graduation choices remain legal, distinct actions for search',()=>{
  const s=fixture([[6,1],[7,1],[8,1],[24,1],[25,1],[26,1]]),search=createSearch(s,{rng:seededRandom(4),rolloutLength:0,method:'baseline'});runSearch(search,300);
  const candidates=searchSummary(search).candidates.filter(c=>c.action.cell===35);
  assert.equal(candidates.length,2);assert.notEqual(candidates[0].key,candidates[1].key);
  assert.ok(candidates.every(c=>legalActions(s).some(a=>actionKey(a)===c.key)));
});
test('conditional reuse retains only actual child visits and resumes growth',()=>{
  const s=newGame(),search=createSearch(s,{rng:seededRandom(90)});runSearch(search,160);
  const top=searchSummary(search).candidates[0],next=applyAction(s,top.action),result=advanceSearch(search,top.action,next);
  assert.ok(result.reused);assert.equal(result.retainedVisits,top.visits);assert.ok(result.retainedVisits<160);
  assert.equal(searchSummary(search).iterations,top.visits);runSearch(search,20);assert.equal(search.iterations,top.visits+20);
  const other=createSearch(s);runSearch(other,1);const wrong={...next,mode:'digital'};assert.equal(advanceSearch(other,top.action,wrong).reused,false);
});
test('node cap bounds expansion and finite rollouts never invent a game draw',()=>{
  const search=createSearch(newGame(),{rng:seededRandom(80),maxNodes:3,rolloutLength:2});runSearch(search,40);
  assert.ok(search.nodeCount<=3);assert.equal(search.root.state.phase,'play');assert.equal(search.root.state.winner,null);
});
test('evaluation changes sign when the player colors are swapped',()=>{
  const s=fixture([[8,1],[20,-2]],[3,4]),other={...s,board:s.board.map(v=>-v),pools:[s.pools[1],s.pools[0]]};assert.ok(Math.abs(positionScore(s)+positionScore(other))<1e-9);
});

test('repetition identity includes board, pools and actor, ignoring display metadata',async()=>{
  const {positionKey}=await import('../boop/ai.js');const s=newGame();
  assert.equal(positionKey(s),positionKey({...s,ply:100,lastMove:{cell:4},mode:'digital'}));
  for(const changed of [{...s,currentPlayer:1},{...s,pools:[[7,1],[8,0]]},{...s,board:s.board.map((v,i)=>i===0?1:v)}])assert.notEqual(positionKey(s),positionKey(changed));
});
test('history preference survives reuse without changing leaf values or declaring draws',async()=>{
  const {positionKey}=await import('../boop/ai.js');const s=newGame(),search=createSearch(s,{rng:seededRandom(90),rolloutLength:0});runSearch(search,160);
  const top=searchSummary(search).candidates[0],child=search.root.children.find(c=>actionKey(c.action)===top.key),next=child.state;
  const repeated=applyAction(next,legalActions(next)[0]);search.positionCounts.set(positionKey(repeated),3);
  const values=[...child.valueSum];assert.ok(advanceSearch(search,top.action,next).reused);
  assert.deepEqual(search.root.valueSum,values);assert.equal(search.positionCounts.get(positionKey(next)),1);
  runSearch(search,500);const summary=searchSummary(search),repeat=summary.candidates.find(c=>positionKey(applyAction(next,c.action))===positionKey(repeated));
  assert.equal(repeat.repetitions,3);assert.equal(summary.candidates[0].repetitions,0);
  assert.equal(search.root.state.phase,'play');assert.equal(summary.terminalSamples,0);
  assert.equal(actionKey(summary.principalVariation[0]),summary.candidates[0].key);
});
test('history preference keeps immediate wins and safe defenses first',()=>{
  for(const s of [fixture([[12,2],[13,2]],[3,0]),fixture([[12,-2],[13,-2]],[1,3])]){
    const history=legalActions(s).map(a=>applyAction(s,a)).filter(next=>next.phase==='gameover'||!winningActions(next,true).length);
    const search=createSearch(s,{history,rng:seededRandom(8),rolloutLength:0});runSearch(search,120);
    const next=applyAction(s,bestAction(search));
    if(winningActions(s,true).length)assert.equal(next.winner,s.currentPlayer);
    else assert.equal(winningActions(next,true).length,0);
  }
});
test('recorded two-turn cycle is escaped at 3,000 and 10,000 iterations',async()=>{
  const {readFile}=await import('node:fs/promises'),{positionKey}=await import('../boop/ai.js');
  const data=JSON.parse(await readFile(new URL('../benchmarks/boop-long/tactical-10000.json',import.meta.url),'utf8'));
  const game=data.records.find(r=>r.game===11);let state=newGame({mode:'digital'});const history=[state];
  for(const action of [...game.opening,...game.moves.filter(m=>m.ply<35).map(m=>m.action)]){state=applyAction(state,action);history.push(state);}
  const cycle=game.moves.find(m=>m.ply===35).action,cycleKey=positionKey(applyAction(state,cycle));
  assert.ok(history.some(s=>positionKey(s)===cycleKey));const before=JSON.stringify(history);
  for(const count of [3000,10000]){
    const search=createSearch(state,{history,rng:seededRandom(1642911)});runSearch(search,count);
    const summary=searchSummary(search),next=applyAction(state,bestAction(search));
    assert.notEqual(positionKey(next),cycleKey);assert.equal(summary.candidates[0].repetitions,0);
    assert.equal(winningActions(next,true).length,0);assert.equal(summary.iterations,count);
    assert.ok(summary.candidates.find(c=>c.key===actionKey(cycle)).repetitions>0);
  }
  assert.equal(JSON.stringify(history),before);
});
