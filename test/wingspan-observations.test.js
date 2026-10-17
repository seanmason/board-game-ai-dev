import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,assertValid,publicObservation,seededRandom} from '../wingspan/core.js';
import {BIRDS} from '../wingspan/catalog.js';
import {knownCard} from '../wingspan/observation-io.js';
import {determinize} from '../wingspan/belief.js';
import {reconcileCard,reconcileFeeder,reconcileGoals,missingPublic,analysisBlocker,
  recordPhysicalAction,answerObservation,cancelObservation,observedCandidates} from '../wingspan/observations.js';
function publicSetup(){
  let s=newGame({mode:'physical',seed:83});
  s=reconcileGoals(s,[0,1,2,3].map(tile=>({tile,side:0})));
  s=reconcileFeeder(s,['seed','fruit','rodent','fish','dual']);
  for(let i=0;i<3;i++)s=reconcileCard(s,{zone:'tray',index:i,cardId:s.tray[i]});
  return s;
}
function playState(){
  let s=publicSetup();
  while(s.phase==='setup'){
    const p=s.players[s.currentPlayer];
    s=recordPhysicalAction(s,{type:'setup',keep:[],bonusId:p.bonusOffer[0],foodDiscard:[]});
  }
  return s;
}
test('unentered public facts and private identities never become physical advice',()=>{
  let s=newGame({mode:'physical'});
  assert.equal(missingPublic(s).length,3);assert.deepEqual(observedCandidates(s),[]);
  assert.throws(()=>recordPhysicalAction(s,{type:'layEggs',targets:[]}),/public tray/);
  const obs=publicObservation(s,0);
  assert.deepEqual(obs.players[0].hand,[]);assert.equal(obs.players[0].handCount,5);
  assert.deepEqual(obs.tray,[null,null,null]);
  assert.deepEqual(obs.goals,[null,null,null,null]);
  assert.ok(obs.feeder.every(x=>x===null));
  assert.equal(obs.publicComplete,false);
  assert.throws(()=>determinize(obs,seededRandom(1)),/public/);
  assert.equal(obs.physical,undefined);assert.equal(obs.rngState,undefined);
  s=publicSetup();assert.deepEqual(missingPublic(s),[]);
  assert.match(analysisBlocker(s),/private cards/);
  // Confirming an identity already used internally must still mark it observed.
  const id=s.players[0].hand[0];
  s=reconcileCard(s,{zone:'hand',index:0,cardId:id});assert.ok(knownCard(s,id));
  assert.deepEqual(publicObservation(s,0).players[0].hand,[id]);
});
test('card reconciliation cannot steal a confirmed tray/hand card or duplicate goals',()=>{
  const s=publicSetup(),before=JSON.stringify(s);
  assert.throws(()=>reconcileCard(s,{zone:'hand',index:0,cardId:s.tray[0]}),/already recorded/);
  assert.throws(()=>reconcileGoals(s,[0,0,1,2].map(tile=>({tile,side:0}))),/different/);
  assert.equal(JSON.stringify(s),before);
});
test('a private draw waits for observation, survives serialization, and can remain unknown',()=>{
  const s=playState(),before=JSON.stringify(s);
  const waiting=recordPhysicalAction(s,{type:'drawBirds',draws:['deck']});
  assert.equal(waiting.pendingObservation.request.kind,'bird');
  assert.equal(waiting.pendingObservation.request.allowUnknown,true);
  assert.equal(waiting.turn,s.turn);assert.equal(waiting.players[0].hand.length,0);
  assert.equal(JSON.stringify(s),before);
  const next=answerObservation(JSON.parse(JSON.stringify(waiting)),null);
  assert.equal(next.turn,s.turn+1);assert.equal(next.players[0].hand.length,1);
  assert.ok(!knownCard(next,next.players[0].hand[0]));assertValid(next);
  const obs=publicObservation(next,0);
  assert.deepEqual(obs.players[0].hand,[]);assert.equal(obs.players[0].handCount,1);
  assert.deepEqual(obs.birdDiscard,[]);assert.equal(obs.birdDiscardCount,10);
  assertValid(determinize(obs,seededRandom(4)));
  assert.deepEqual(cancelObservation(waiting),s);
});
test('tray draws request actual replacements; invalid public answers are atomic',()=>{
  const s=playState(),taken=s.tray[0];
  const waiting=recordPhysicalAction(s,{type:'drawBirds',draws:[0]});
  assert.equal(waiting.pendingObservation.request.allowUnknown,false);
  assert.throws(()=>answerObservation(waiting,null),/public/);
  assert.throws(()=>answerObservation(waiting,s.tray[1]),/already recorded/);
  const observed=s.deck[3];
  const next=answerObservation(waiting,observed);
  assert.ok(next.players[0].hand.includes(taken));assert.ok(next.tray.includes(observed));
  assert.ok(knownCard(next,observed));assertValid(next);
});
test('feeder exhaustion asks for real roll and then actual die choice',()=>{
  const s=reconcileFeeder(playState(),[]);
  const waiting=recordPhysicalAction(s,{type:'gainFood',dice:[{index:0}]});
  assert.equal(waiting.pendingObservation.request.kind,'feeder');
  assert.throws(()=>answerObservation(waiting,['seed']),/five|5/);
  const choosing=answerObservation(waiting,['fruit','seed','dual','rodent','fish']);
  assert.equal(choosing.pendingObservation.request.kind,'foodChoice');
  const next=answerObservation(choosing,{index:2,food:'seed'});
  assert.equal(next.players[0].food.seed,s.players[0].food.seed+1);
  assert.deepEqual(next.feeder,['fruit','seed','rodent','fish']);assertValid(next);
});
test('optional reroll never uses generated faces or a pre-roll food choice',()=>{
  const s=reconcileFeeder(playState(),['seed']);
  let next=recordPhysicalAction(s,{type:'gainFood',dice:[{index:0,reroll:true,food:'seed'}]});
  next=answerObservation(next,['fish','fruit','rodent','fruit','fish']);
  next=answerObservation(next,{index:1,food:'fruit'});
  assert.equal(next.players[0].food.fruit,s.players[0].food.fruit+1);
  assert.equal(next.players[0].food.seed,s.players[0].food.seed);assertValid(next);
});
test('round-end replacements pause until all three observed cards are entered',()=>{
  const s=playState();s.remaining=[1,0];
  let next=recordPhysicalAction(s,{type:'layEggs',targets:[]});
  for(let i=0;i<3;i++){
    assert.ok(next.pendingObservation);assert.equal(next.round,1);
    next=answerObservation(next,s.deck[i]);
  }
  assert.equal(next.pendingObservation,undefined);assert.equal(next.round,2);
  assert.deepEqual(next.tray,s.deck.slice(0,3));assertValid(next);
});
test('private placeholder permutations cannot affect observed information or known action choices',()=>{
  const s=playState();s.players[0].hand.push(s.deck.pop());
  const other=structuredClone(s);
  [other.players[0].hand[0],other.deck[0]]=[other.deck[0],other.players[0].hand[0]];
  other.deck.reverse();other.rngState=999;
  assert.deepEqual(publicObservation(s,0),publicObservation(other,0));
  assert.deepEqual(observedCandidates(s),observedCandidates(other));
  assert.deepEqual(determinize(publicObservation(s,0),seededRandom(1)),
    determinize(publicObservation(other,0),seededRandom(1)));
});

test('unidentified birds cannot be played by bypassing the UI',()=>{
  const s=playState();s.players[0].hand.push(s.deck.pop());
  assert.throws(()=>recordPhysicalAction(s,{type:'playBird',birdId:s.players[0].hand[0]}),/Identify/);
});
