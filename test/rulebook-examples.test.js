import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,recordFactories,applyAction,legalActions,resolveRound,
  scoreWallPlacement,finalBonus,assertValid,wallColumn,MARKER
} from "../src/azul.js";

/**
 * Independent fixtures transcribed as behavior from the publisher's original
 * Azul rules: https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf
 * Pages 3–6, without copying any artwork or rulebook text.
 */
const board = () => Array.from({length:5},()=>Array(5).fill(false));
const scoreAt=(positions,row,col) => {
  const w=board();
  for(const [r,c] of positions)w[r][c]=true;
  w[row][col]=true;
  return scoreWallPlacement(w,row,col);
};
test("official scoring: isolated 1, contiguous horizontal 3, vertical 3, cross 4+3",()=>{
  assert.equal(scoreAt([],2,2),1);
  assert.equal(scoreAt([[2,1],[2,3]],2,2),3);
  assert.equal(scoreAt([[1,2],[3,2]],2,2),3);
  assert.equal(scoreAt([[2,0],[2,1],[2,3],[1,2],[3,2]],2,2),7);
  assert.equal(scoreAt([[2,1],[2,3],[1,2]],2,2),5); // 3 across + 2 down
});
test("official floor penalty: four tiles and the marker cost eight",()=>{
  const s=newGame();
  s.phase="draft";
  s.players[0].floor=[MARKER,1,1,1,1];
  s.bag[1]-=4;
  const end=resolveRound(s);
  assert.equal(end.players[0].score,0);
  assert.equal(end.discard[1],4);
  assertValid(end);
  // From 20 points, the exact same five-slot floor loses eight.
  s.players[0].score=20;
  const outcome=resolveRound(s);
  assert.equal(outcome.players[0].score,12);
});
test("completed pattern lines score in top-to-bottom order, partial rows carry over",()=>{
  const s=newGame();
  s.phase="draft";
  s.players[0].lines[0]={color:0,count:1}; // wall (0,0)
  s.players[0].lines[1]={color:4,count:2}; // wall (1,0), connected to (0,0)
  s.players[0].lines[2]={color:3,count:2}; // stays incomplete
  s.bag[0]-=1;s.bag[4]-=2;s.bag[3]-=2;
  const end=resolveRound(s);
  assert.equal(end.players[0].score,3); // isolated one, then vertical pair
  assert.equal(end.players[0].lines[2].count,2);
  assert.equal(end.players[0].lines[2].color,3);
  assert.equal(end.players[0].wall[0][wallColumn(0,0)],true);
  assert.equal(end.players[0].wall[1][wallColumn(1,4)],true);
  assertValid(end);
});
test("complete wall awards each horizontal row, vertical column and set bonus",()=>{
  const p=newGame().players[0];
  p.wall.forEach(row=>row.fill(true));
  assert.equal(finalBonus(p),95); // 5*2 + 5*7 + 5*10
});
test("taking the first center tile controls the next round even with a full floor",()=>{
  const s=recordFactories(newGame(),[
    [0,0,1,1],[2,2,3,3],[4,4,0,0],[1,1,2,2],[3,3,4,4]
  ]);
  s.players[0].floor=Array(7).fill(4);
  s.bag[4]-=7;
  s.center=s.factories[0].splice(0,1);
  const chosen=s.center[0];
  assertValid(s);
  const next=applyAction(s,{source:-1,color:chosen,row:-1});
  assert.equal(next.nextStarter,0);
  assert.equal(next.players[0].floor.length,7);
  assert.equal(next.discard[chosen],1);
  assertValid(next);
});
test("starting player may be selected in 2–4 player setup",()=>{
  for(const n of [2,3,4]){
    for(let starter=0;starter<n;starter++){
      const s=newGame({players:n,starter});
      assert.equal(s.currentPlayer,starter);
      assert.equal(s.starter,starter);
      assertValid(s);
    }
  }
});
