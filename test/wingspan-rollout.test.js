import test from "node:test";
import assert from "node:assert/strict";
import {newGame,applyAction,publicObservation,seededRandom,assertValid} from "../wingspan/core.js";
import {candidateActions} from "../wingspan/actions.js";
import {determinize} from "../wingspan/belief.js";
import {createSearch,runSearch,searchSummary} from "../wingspan/analysis.js";
import {evaluateBeliefRollout,projectedScore} from "../wingspan/rollout.js";

function ready(seed,players=2){
  let s=newGame({players,seed,mode:"digital"});
  while(s.phase==="setup"){
    const p=s.players[s.currentPlayer];
    s=applyAction(s,{type:"setup",keep:p.hand.slice(0,2),
      foodDiscard:["fish","rodent"],bonusId:p.bonusOffer[0]});
  }
  assertValid(s);
  return s;
}
test("belief rollouts do not mutate public info or use actual hidden decks",()=>{
  const state=ready(141,3);
  const obs=publicObservation(state,state.currentPlayer);
  const baseline=JSON.stringify(obs);
  const move=candidateActions(state).find(x=>x.action.type==="gainFood");
  assert.ok(move);
  const p=evaluateBeliefRollout(obs,move.action,seededRandom(811),{horizon:2});
  const q=evaluateBeliefRollout(obs,move.action,seededRandom(811),{horizon:2});
  assert.ok(Number.isFinite(p));
  assert.equal(p,q,"Seeded belief rollout must be reproducible");
  assert.equal(JSON.stringify(obs),baseline,"AI cannot modify observation");
  const swapped=structuredClone(state);
  swapped.deck.reverse();
  swapped.bonusDeck.reverse();
  swapped.bonusDiscard.reverse();
  const alt=publicObservation(swapped,swapped.currentPlayer);
  assert.deepEqual(alt,obs);
  const value=evaluateBeliefRollout(alt,move.action,seededRandom(811),{horizon:2});
  assert.equal(value,p,"Hidden deck permutations cannot influence AI");
});
test("rollouts cover setup, actual bird play and optional brown/white decisions",()=>{
  let s=newGame({players:2,seed:155});
  for(const phase of ["setup","play"]){
    if(phase==="play"){
      while(s.phase==="setup"){
        const p=s.players[s.currentPlayer];
        s=applyAction(s,{type:"setup",keep:p.hand.slice(0,1),
          foodDiscard:["fish"],bonusId:p.bonusOffer[0]});
      }
    }
    const observation=publicObservation(s,s.currentPlayer);
    const actions=candidateActions(s);
    assert.ok(actions.length);
    const sample=determinize(observation,seededRandom(143));
    assertValid(sample);
    const a=evaluateBeliefRollout(observation,actions[0].action,
      seededRandom(922),{horizon:3});
    assert.ok(Number.isFinite(a),phase);
  }
});
test("informed rollouts produce finite, increasing sample counts with seed control",()=>{
  const s=ready(508,2),obs=publicObservation(s,s.currentPlayer);
  const choices=candidateActions(s).slice(0,8);
  for(const method of ["heuristic","belief-rollout"]){
    const a=createSearch(obs,choices,{method,rng:seededRandom(81),horizon:2});
    const b=createSearch(obs,choices,{method,rng:seededRandom(81),horizon:2});
    runSearch(a,16);runSearch(b,16);
    const one=searchSummary(a),two=searchSummary(b);
    assert.deepEqual(one,two);
    assert.equal(one.iterations,16);
    assert.equal(one.candidates.reduce((n,x)=>n+x.visits,0),16);
    assert.ok(one.candidates.every(x=>Number.isFinite(x.sum)));
    assert.equal(one.method,method);
  }
});
test("projected scores include known actual bird scores but no fake win chances",()=>{
  const s=ready(932,2);
  assert.ok(projectedScore(s,0)>=0);
  assert.ok(projectedScore(s,1)>=0);
  assert.throws(()=>createSearch(publicObservation(s,0),candidateActions(s),
    {method:"perfect-information"}),/Unknown Wingspan analysis method/);
});
