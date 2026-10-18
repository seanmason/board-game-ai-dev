import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../wingspan/core.js';
import {BIRDS} from '../wingspan/catalog.js';
import {scorePlayer} from '../wingspan/scoring.js';
import {evaluateLeaf,actionBudgetProjection,bottleneckIncome,phaseWeights} from '../wingspan/leaf-evaluators.js';
const methods=['action-budget-planner','bottleneck-engine','phase-calibrated'];
const entry=id=>({id,eggs:0,cached:[],tucked:[]});
test('refinements are finite deterministic pure and terminal exact',()=>{
  for(let seed=1;seed<=15;seed++){
    const s=newGame({seed}),before=JSON.stringify(s);
    for(const method of methods){const n=evaluateLeaf(s,0,method);assert.ok(Number.isFinite(n));assert.equal(n,evaluateLeaf(s,0,method));}
    assert.equal(JSON.stringify(s),before);
    s.phase='gameover';for(const method of methods)assert.equal(evaluateLeaf(s,0,method),scorePlayer(s.players[0]).total);
  }
});
test('one final action cannot gather and play or score eggs twice',()=>{
  const s=newGame({seed:1});s.round=4;s.remaining[0]=1;
  s.players[0].food=Object.fromEntries(Object.keys(s.players[0].food).map(f=>[f,0]));
  s.players[0].hand=BIRDS.filter(b=>Object.values(b.food).reduce((a,b)=>a+b,0)>0).slice(0,5).map(b=>b.id);
  const p=actionBudgetProjection(s,0);assert.equal(p.plays,0);assert.equal(p.gain,0);
  s.remaining[0]=0;assert.equal(actionBudgetProjection(s,0).gain,0);
});
test('shared consumption and egg capacity cap aggregate engine income',()=>{
  const s=newGame({seed:2});s.round=4;s.remaining[0]=5;
  const b=BIRDS.find(b=>b.powerCode===23);s.players[0].habitats.forest=[entry(b.id),entry(b.id)];
  // Supply one seed, no gathering actions beyond the explicit shared allowance.
  const f={turns:3,food:1,hand:0,room:0,engine:10};
  const one=bottleneckIncome(s,0,f);s.players[0].habitats.forest.push(entry(b.id),entry(b.id),entry(b.id));
  assert.ok(bottleneckIncome(s,0,f)<one);
  const egg=BIRDS.find(b=>b.powerCode===30);s.players[0].habitats.forest=[entry(egg.id),entry(egg.id)];
  assert.equal(bottleneckIncome(s,0,{...f,room:0}),0);
});
test('phase weights blend continuously at predetermined phase anchors',()=>{
  assert.deepEqual(phaseWeights(26),{resources:.8,engine:.85,productive:.5,goals:.7});
  assert.deepEqual(phaseWeights(13),{resources:.7,engine:.65,productive:.4,goals:1});
  assert.deepEqual(phaseWeights(0),{resources:.35,engine:.2,productive:.15,goals:1.2});
  for(const k of Object.keys(phaseWeights(13)))assert.ok(Math.abs(phaseWeights(13-.0001)[k]-phaseWeights(13+.0001)[k])<.0001);
});
test('practical combined retains recorded prechange baseline values',()=>{
  [1,4,11].forEach((seed,i)=>assert.equal(evaluateLeaf(newGame({seed}),0,'practical-combined'),[15.715666666666667,11.795666666666667,15.435666666666666][i]));
});
