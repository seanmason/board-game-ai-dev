import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame} from '../wingspan/core.js';
import {BIRDS} from '../wingspan/catalog.js';
import {scorePlayer} from '../wingspan/scoring.js';
import {evaluateLeaf,specialistProjection,investmentPayback,remainingActions} from '../wingspan/leaf-evaluators.js';
const methods=['habitat-specialist','investment-payback','specialist-payback'];
const entry=id=>({id,eggs:0,cached:[],tucked:[]});
test('specialist batch remains pure finite deterministic and terminal exact',()=>{
 for(let seed=1;seed<=12;seed++){
  const s=newGame({seed}),before=JSON.stringify(s);
  for(const m of methods){const v=evaluateLeaf(s,0,m);assert.ok(Number.isFinite(v));assert.equal(v,evaluateLeaf(s,0,m));}
  assert.equal(JSON.stringify(s),before);s.phase='gameover';
  for(const m of methods)assert.equal(evaluateLeaf(s,0,m),scorePlayer(s.players[0]).total);
 }
});
test('specialist allocation shares an action budget and favors a scoring row',()=>{
 const s=newGame({seed:1}),p=s.players[0];p.hand=[];
 const b=BIRDS.find(b=>b.powerCode===31&&b.powerType==='brown');
 p.habitats.forest=[entry(b.id)];
 // Eliminate egg scoring as a competing action.
 p.habitats.forest[0].eggs=b.eggs;
 const projection=specialistProjection(s,0);
 assert.equal(projection.counts.forest,remainingActions(s,0));
 assert.ok(Object.values(projection.counts).reduce((a,b)=>a+b,0)+projection.reserve<=remainingActions(s,0));
});
test('investment takes only best payoff and vanishes with no time to activate',()=>{
 const s=newGame({seed:2}),p=s.players[0];
 const b=BIRDS.find(b=>b.powerCode===31&&b.powerType==='brown');p.hand=[b.id];
 for(const food of Object.keys(p.food))p.food[food]=10;
 const one=investmentPayback(s,0);assert.ok(one>0);
 p.hand=[b.id,b.id,b.id];assert.equal(investmentPayback(s,0),one);
 s.round=4;s.remaining[0]=1;assert.equal(investmentPayback(s,0),0);
});
test('complementary batch adjustments combine additively',()=>{
 const s=newGame({seed:9}),base=evaluateLeaf(s,0);
 assert.ok(Math.abs(evaluateLeaf(s,0,'specialist-payback')-(evaluateLeaf(s,0,'habitat-specialist')+evaluateLeaf(s,0,'investment-payback')-base))<1e-10);
 [1,4,11].forEach((seed,i)=>assert.equal(evaluateLeaf(newGame({seed}),0),[15.715666666666667,11.795666666666667,15.435666666666666][i]));
});
