import test from "node:test";
import assert from "node:assert/strict";
import {newGame,applyAction,assertValid,publicObservation,seededRandom} from "../wingspan/core.js";
import {determinize} from "../wingspan/belief.js";
import {HABITATS} from "../wingspan/scoring.js";

function finishSetup(seed=23,players=4){
  let s=newGame({players,seed});
  while(s.phase==="setup"){
    const p=s.players[s.currentPlayer];
    s=applyAction(s,{type:"setup",keep:p.hand.slice(0,2),
      foodDiscard:["fish","rodent"],bonusId:p.bonusOffer[0]});
  }
  return s;
}
test("belief samples legal full decks without leaking private actor information",()=>{
  for(const players of [2,3,4,5]){
    const real=finishSetup(192+players,players);
    const view=publicObservation(real,players-1);
    const before=JSON.stringify(view);
    assert.ok(!("deck" in view)&&!("bonusDeck" in view));
    assert.ok(!("rngState" in view));
    assert.ok(!("bonusDiscard" in view));
    const sampled=determinize(view,seededRandom(902+players));
    assertValid(sampled);
    assert.deepEqual(sampled.players[players-1].hand,real.players[players-1].hand);
    assert.deepEqual(sampled.players[players-1].bonuses,real.players[players-1].bonuses);
    assert.equal(sampled.deck.length,view.deckCount);
    assert.equal(sampled.bonusDeck.length,view.bonusDeckCount);
    assert.equal(sampled.bonusDiscard.length,view.bonusDiscardCount);
    for(let i=0;i<players-1;i++)
      assert.equal(sampled.players[i].hand.length,real.players[i].hand.length);
    assert.equal(JSON.stringify(view),before,"Inference cannot mutate observation");
  }
});
test("belief determinization is reproducible but does not use hidden deck order",()=>{
  const actual=finishSetup(888,3);
  const a=publicObservation(actual,0);
  const reversed=structuredClone(actual);
  reversed.deck.reverse();
  reversed.bonusDeck.reverse();
  reversed.bonusDiscard.reverse();
  const b=publicObservation(reversed,0);
  assert.deepEqual(a,b);
  const rng=seededRandom(981);
  const sampled=determinize(a,rng);
  const compared=determinize(b,seededRandom(981));
  assert.deepEqual(sampled,compared);
  const different=determinize(a,seededRandom(982));
  assert.notDeepEqual(sampled.deck,different.deck);
});
test("face-down tucked species remain unseen while card counts are preserved",()=>{
  const real=finishSetup(471,2);
  const birdId=real.deck.pop();
  real.players[0].habitats.forest.push({
    id:birdId,eggs:0,cached:[],tucked:[real.deck.pop(),real.deck.pop()]
  });
  assertValid(real);
  const obs=publicObservation(real,0);
  const entry=obs.players[0].habitats.forest[0];
  assert.deepEqual(entry.tucked,[null,null]);
  assert.equal(entry.tuckedCount,2);
  assert.ok(!JSON.stringify(obs).includes(
    '"tucked":['+real.players[0].habitats.forest[0].tucked.join(",")),
    "Tucked species must not leak in observation");
  const state=determinize(obs,seededRandom(481));
  assertValid(state);
  assert.equal(state.players[0].habitats.forest[0].tucked.length,2);
});
test("determinized game can take legitimate main actions",()=>{
  const real=finishSetup(500,2);
  const obs=publicObservation(real,real.currentPlayer);
  const imagined=determinize(obs,seededRandom(777));
  const next=applyAction(imagined,{type:"gainFood",
    dice:[{index:0,food:imagined.feeder[0]==="dual"?"seed":imagined.feeder[0]}]});
  assertValid(next);
  assert.equal(next.remaining[0],7);
});
test("refusing an unredacted state prevents perfect-information AI peeking",()=>{
  const real=newGame({players:2,seed:9});
  assert.throws(()=>determinize(real,seededRandom(10)),/REDACTED/);
});
