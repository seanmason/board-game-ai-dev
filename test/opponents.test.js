import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,drawFactories,legalActions,seededRandom,applyAction
} from "../src/azul.js";
import {
  chooseOpponentAction,resolveOpponentPolicy,
  OPPONENT_POLICIES,MIXED_POLICIES
} from "../benchmarks/opponents.js";

test("all synthetic opponents choose legal moves without modifying the state", () => {
  for(const players of [2,3,4]){
    const state=drawFactories(newGame({players,mode:"digital"}),seededRandom(800+players));
    const legal=new Set(legalActions(state).map(a=>[a.source,a.color,a.row].join(":")));
    const before=JSON.stringify(state);
    for(const policy of OPPONENT_POLICIES.filter(p=>p!=="mixed")){
      const a=chooseOpponentAction(state,policy,seededRandom(60),{
        seed:22911,playouts:10
      });
      assert.ok(legal.has([a.source,a.color,a.row].join(":")),policy+" must be legal");
      assert.ok(applyAction(state,a),"Opponent action should be applicable");
      assert.equal(JSON.stringify(state),before,"Policy "+policy+" mutated game state");
    }
  }
});
test("stochastic and randomized opponents remain reproducible with fixed seeds", () => {
  const s=drawFactories(newGame({players:4,mode:"digital"}),seededRandom(7789));
  for(const policy of ["random","stochastic","heuristic","informed","floor-averse","denial","legacy-uct"]){
    const first=Array.from({length:10},(_,n)=>
      chooseOpponentAction(s,policy,seededRandom(300+n),{seed:n*93,playouts:8}));
    const again=Array.from({length:10},(_,n)=>
      chooseOpponentAction(s,policy,seededRandom(300+n),{seed:n*93,playouts:8}));
    assert.deepEqual(first,again,policy);
  }
});
test("mixed opponents vary policy by seat and game index", () => {
  const unique=new Set();
  for(let i=0;i<8;i++){
    for(let seat=0;seat<4;seat++){
      const p=resolveOpponentPolicy("mixed",seat,i);
      assert.ok(MIXED_POLICIES.includes(p));
      unique.add(p);
    }
  }
  assert.deepEqual([...unique].sort(),[...MIXED_POLICIES].sort());
  assert.equal(resolveOpponentPolicy("informed",2,8),"informed");
  assert.throws(()=>resolveOpponentPolicy("not-real",0,0),/Unknown opponent policy/);
});
