import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../wingspan/core.js';
import {BIRDS} from '../wingspan/catalog.js';
import {scorePlayer} from '../wingspan/scoring.js';
import {LEAF_EVALUATORS,evaluateLeaf,remainingActions} from '../wingspan/leaf-evaluators.js';
const entry=id=>({id,eggs:0,cached:[],tucked:[]});
test('all leaf evaluators return actual terminal score and points-only always does',()=>{
  const s=newGame({seed:10});
  s.players[0].habitats.forest.push(entry(0));
  assert.equal(evaluateLeaf(s,0,'points-only'),scorePlayer(s.players[0]).total);
  s.phase='gameover';
  for(const method of LEAF_EVALUATORS)assert.equal(evaluateLeaf(s,0,method),scorePlayer(s.players[0]).total);
  assert.equal(remainingActions(s,0),0);
});
test('remaining-turns uses player actions already spent in current round',()=>{
  const s=newGame({seed:1});
  assert.equal(remainingActions(s,0),26);
  s.players[0].habitats.forest=[entry(0)];
  const base=scorePlayer(s.players[0]).total;
  const weight=Math.min(8,s.players[0].hand.length)*1.1+4.5+.85+.4;
  const early=evaluateLeaf(s,0,'remaining-turns');
  assert.equal(early,base+weight);
  s.remaining[0]=2;
  assert.equal(remainingActions(s,0),20);
  assert.equal(evaluateLeaf(s,0,'remaining-turns'),base+weight*20/26);
  s.round=4;s.remaining[0]=1;
  assert.equal(remainingActions(s,0),1);
});
test('usable resource food saturates at hand and time demand',()=>{
  const s=newGame({seed:4});s.round=4;s.remaining[0]=2;
  for(const f of Object.keys(s.players[0].food))s.players[0].food[f]=30;
  const a=evaluateLeaf(s,0,'usable-resources');
  for(const f of Object.keys(s.players[0].food))s.players[0].food[f]=300;
  assert.equal(evaluateLeaf(s,0,'usable-resources'),a);
  s.players[0].hand=[];s.players[0].food=Object.fromEntries(Object.keys(s.players[0].food).map(f=>[f,0]));
  assert.equal(evaluateLeaf(s,0,'usable-resources'),scorePlayer(s.players[0]).total);
});
test('power income distinguishes actual repeatable codes and egg capacity',()=>{
  const s=newGame({seed:4});s.players[0].hand=[];s.players[0].food=Object.fromEntries(Object.keys(s.players[0].food).map(f=>[f,0]));
  const cache=BIRDS.find(b=>b.powerCode===31&&b.powerType==='brown');
  const moving=BIRDS.find(b=>b.powerCode===20);
  s.players[0].habitats.forest=[entry(cache.id)];
  const income=evaluateLeaf(s,0,'engine-income')-scorePlayer(s.players[0]).total;
  s.players[0].habitats.forest=[entry(moving.id)];
  assert.ok(income>evaluateLeaf(s,0,'engine-income')-scorePlayer(s.players[0]).total);
  const egg=BIRDS.find(b=>b.powerCode===30);
  s.players[0].habitats.forest=[entry(egg.id)];
  const before=evaluateLeaf(s,0,'engine-income')-scorePlayer(s.players[0]).total;
  s.players[0].habitats.forest[0].eggs=egg.eggs;
  assert.ok(before>0);
  assert.equal(evaluateLeaf(s,0,'engine-income'),scorePlayer(s.players[0]).total);
});
test('finite deterministic immutable formulas across seeded states',()=>{
  for(let seed=1;seed<=30;seed++){
    const s=newGame({seed,players:2+seed%4}),before=JSON.stringify(s);
    for(let player=0;player<s.players.length;player++)for(const method of LEAF_EVALUATORS){
      const value=evaluateLeaf(s,player,method);
      assert.ok(Number.isFinite(value),method);
      assert.equal(evaluateLeaf(s,player,method),value);
    }
    assert.equal(JSON.stringify(s),before);
  }
  const s=newGame({seed:11});s.players[0].habitats.forest=[entry(0)];
  const values=LEAF_EVALUATORS.map(method=>evaluateLeaf(s,0,method));
  assert.ok(new Set(values).size>=6);
  assert.throws(()=>evaluateLeaf(s,0,'unknown'),/Unknown Wingspan leaf evaluator/);
});
test('already awarded current goals are not added again',()=>{
  const s=newGame({seed:3});s.players[0].hand=[];s.players[0].food=Object.fromEntries(Object.keys(s.players[0].food).map(f=>[f,0]));
  s.players[0].habitats.forest=[entry(0)];
  s.goals[0].face={kind:'totalBirds'};
  const projected=evaluateLeaf(s,0,'goal-aware')-scorePlayer(s.players[0]).total;
  assert.ok(projected>0);
  s.players[0].goalPoints=[4];
  assert.equal(evaluateLeaf(s,0,'goal-aware'),evaluateLeaf(s,0,'remaining-turns'));
});

