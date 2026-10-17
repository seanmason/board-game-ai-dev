import test from "node:test";
import assert from "node:assert/strict";
import {newGame,legalActions,applyAction,seededRandom,actionKey} from "../pentago/core.js";
import {
  createSearch,runSearch,searchSummary,bestAction,advanceSearch,positionScore
} from "../pentago/ai.js";
function midState(seed=4,steps=4){
  let state=newGame({mode:"digital"});
  const rng=seededRandom(seed);
  for(let k=0;k<steps&&state.phase==="play";k++){
    const actions=legalActions(state);
    state=applyAction(state,actions[Math.floor(rng()*actions.length)]);
  }
  return state;
}
test("Pentago guided search only recommends legal complete turns",()=>{
  const state=midState();
  const search=createSearch(state,{rng:seededRandom(22),maxNodes:400});
  runSearch(search,14);
  const summary=searchSummary(search);
  assert.equal(summary.iterations,14);
  assert.equal(summary.candidates.reduce((n,x)=>n+x.visits,0),14);
  const possible=new Set(legalActions(state).map(actionKey));
  assert.ok(summary.candidates.every(x=>possible.has(x.key)));
  assert.ok(possible.has(actionKey(bestAction(search))));
  assert.equal(summary.currentPlayer,state.currentPlayer);
  assert.ok(summary.rootLegalActions>=summary.candidates.length);
});
test("Pentago MCTS seed reproduces exact candidate visits and outcomes",()=>{
  const s=midState(71,6);
  const a=createSearch(s,{rng:seededRandom(93)});
  const b=createSearch(s,{rng:seededRandom(93)});
  runSearch(a,7);runSearch(b,7);
  assert.deepEqual(searchSummary(a),searchSummary(b));
});
test("Pentago MCTS retains only selected descendant's conditional simulations",()=>{
  const state=midState(53,3);
  const s=createSearch(state,{rng:seededRandom(170),maxNodes:1000});
  runSearch(s,70);
  const choice=searchSummary(s).candidates[0];
  const child=s.root.children.find(n=>actionKey(n.action)===choice.key);
  const oldVisits=s.iterations,oldScore=[...child.winSum];
  const next=applyAction(state,choice.action);
  assert.equal(next.phase,"play");
  const result=advanceSearch(s,choice.action,next);
  assert.equal(result.reused,true);
  assert.equal(s.root,child);
  assert.equal(s.iterations,child.visits);
  assert.ok(s.iterations>0&&s.iterations<=oldVisits);
  assert.deepEqual(s.root.winSum,oldScore);
  runSearch(s,5);
  assert.equal(s.iterations,result.retainedVisits+5);
});
test("Pentago reuse rejects illegal actions, alternate states and terminal roots",()=>{
  const state=midState(77,3);
  const s=createSearch(state,{rng:seededRandom(14)});
  runSearch(s,12);
  const move=searchSummary(s).candidates[0].action;
  const good=applyAction(state,move);
  const wrong={...good,board:[...good.board]};
  wrong.board[35]=1;
  const root=s.root;
  assert.equal(advanceSearch(s,move,wrong).reused,false);
  assert.equal(s.root,root);
  assert.equal(advanceSearch(s,{cell:400,quadrant:0,direction:1},good).reused,false);
  assert.equal(s.root,root);
});
test("Pentago evaluation is antisymmetric and neutral at empty board",()=>{
  const s=newGame();
  assert.equal(positionScore(s.board),0);
  const b=[...s.board];b[7]=0;
  assert.ok(positionScore(b)>0);
  b[7]=1;
  assert.ok(positionScore(b)<0);
});
