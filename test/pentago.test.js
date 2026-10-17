import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,rotate,neutralQuadrants,legalActions,uniqueLegalActions,
  applyAction,fiveLines,actionKey,outcomes,assertValid,seededRandom
} from "../pentago/core.js";
test("first moves: 36 placements, 8 twist choices and optional neutral skip",()=>{
  for(const starter of [0,1]){
    const s=newGame({starter});
    assertValid(s);
    assert.equal(legalActions(s).length,36*9);
    const t=applyAction(s,{cell:0,quadrant:-1,direction:0});
    assert.equal(t.currentPlayer,1-starter);
    assert.equal(t.board[0],starter);
    assert.equal(s.board[0],-1);
    assertValid(t);
    assert.throws(()=>applyAction(t,{cell:0,quadrant:0,direction:1}),/occupied/);
  }
});
test("all quadrants rotate correctly with inverse and fourfold closure",()=>{
  const source=Array.from({length:36},(_,i)=>i);
  for(let q=0;q<4;q++){
    assert.deepEqual(rotate(rotate(source,q,1),q,-1),source);
    let copy=source;
    for(let k=0;k<4;k++)copy=rotate(copy,q,1);
    assert.deepEqual(copy,source);
    const r=q>=2?3:0,c=q%2?3:0;
    assert.equal(rotate(source,q,1)[r*6+c+2],source[r*6+c]);
  }
});
test("neutral skip is permitted until all quadrants have noncenter pieces",()=>{
  const s=newGame();
  const initial=applyAction(s,{cell:7,quadrant:-1,direction:0});
  assert.ok(neutralQuadrants(initial.board).includes(0));
  s.board[0]=0;s.board[3]=1;s.board[18]=0;s.board[21]=1;s.ply=4;
  assertValid(s);
  assert.equal(legalActions(s).some(a=>a.quadrant<0),false);
  assert.throws(()=>applyAction(s,{cell:31,quadrant:-1,direction:0}),/twist is required/i);
});
test("the fifth marble by placement wins without a rotation",()=>{
  const s=newGame();for(const k of [0,1,2,3])s.board[k]=0;
  for(const k of [6,8,10,12])s.board[k]=1;s.ply=8;
  assertValid(s);
  assert.deepEqual(legalActions(s).filter(a=>a.cell===4),[{cell:4,quadrant:-1,direction:0}]);
  const end=applyAction(s,{cell:4,quadrant:-1,direction:0});
  assert.equal(end.winner,0);assert.equal(end.phase,"gameover");
  assert.deepEqual(outcomes(end),[1,0]);assertValid(end);
  assert.throws(()=>applyAction(s,{cell:4,quadrant:0,direction:1}),/immediately/);
});
test("simultaneous five after a twist is a draw",()=>{
  const s=newGame();for(const k of [0,3,4,6,12])s.board[k]=0;
  for(const k of [1,7,9,10,13])s.board[k]=1;s.ply=10;
  assertValid(s);
  const end=applyAction(s,{cell:2,quadrant:0,direction:1});
  assert.equal(end.winner,"draw");
  assert.ok(fiveLines(end.board)[0].length&&fiveLines(end.board)[1].length);
  assert.deepEqual(outcomes(end),[0.5,0.5]);assertValid(end);
});
test("a twist can give the opponent the winning row",()=>{
  const s=newGame();for(const k of [1,7,13,9,10])s.board[k]=1;
  for(const k of [30,32,24,26,23])s.board[k]=0;s.ply=10;
  assertValid(s);
  const end=applyAction(s,{cell:35,quadrant:0,direction:1});
  assert.equal(end.winner,1);assert.deepEqual(outcomes(end),[0,1]);
  assertValid(end);
});
test("unique search actions remove only equivalent board outcomes",()=>{
  for(let seed=1;seed<=8;seed++){
    let s=newGame();const rng=seededRandom(seed*71);
    for(let t=0;t<9&&s.phase==="play";t++){
      const legal=legalActions(s);
      s=applyAction(s,legal[Math.floor(rng()*legal.length)]);
    }
    assertValid(s);
    const legalKeys=new Set(legalActions(s).map(actionKey));
    const seen=new Set();
    for(const a of uniqueLegalActions(s)){
      assert.ok(legalKeys.has(actionKey(a)));
      const next=applyAction(s,a);
      const key=next.board.join(",");
      assert.ok(!seen.has(key));seen.add(key);assertValid(next);
    }
  }
});
