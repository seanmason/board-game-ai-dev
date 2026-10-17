import test from "node:test";
import assert from "node:assert/strict";
import {BIRDS,BONUSES} from "../wingspan/catalog.js";
import {newGame,assertValid,publicObservation,seededRandom} from "../wingspan/core.js";
import {reconcileCard,reconcileFood,reconcileEggs} from "../wingspan/observations.js";
import {candidateActions} from "../wingspan/actions.js";
import {createSearch,runSearch,searchSummary,availableUnknownCards} from "../wingspan/analysis.js";

test("physical observation swaps a real bird into a hand without inventing a card",()=>{
  let s=newGame({players:3,seed:123,mode:"physical"});
  const target=s.deck[4],previous=s.players[0].hand[0];
  const original=JSON.stringify(s);
  s=reconcileCard(s,{zone:"hand",player:0,index:0,cardId:target});
  assert.equal(s.players[0].hand[0],target);
  assert.ok(s.deck.includes(previous));
  assert.equal(s.deck.length,170-3*5-3);
  assertValid(s);
  assert.notEqual(JSON.stringify(s),original);
  assert.throws(()=>reconcileCard(s,{zone:"hand",player:0,index:0,
    cardId:s.birdDiscard[0]??-2}),/known|already public|not in this/);
});
test("market and bonus observations maintain identity and total inventories",()=>{
  let s=newGame({mode:"physical",seed:417});
  const id=s.deck[2];
  s=reconcileCard(s,{zone:"tray",cardId:id,index:0});
  assert.equal(s.tray[0],id);
  assertValid(s);
  const bonus=s.bonusDeck[1];
  s=reconcileCard(s,{zone:"bonusOffer",cardId:bonus,player:0,index:0});
  assert.equal(s.players[0].bonusOffer[0],bonus);
  assertValid(s);
  assert.throws(()=>reconcileCard(s,{zone:"tray",cardId:200,index:1}),/base-game/);
});
test("physical food observations update the chosen player's public resources",()=>{
  let s=newGame({mode:"physical",seed:345});
  s=reconcileFood(s,{player:1,food:"fish",count:6});
  assert.equal(s.players[1].food.fish,6);
  assertValid(s);
  assert.throws(()=>reconcileFood(s,{player:1,food:"fish",count:-1}),/Invalid/);
  assert.throws(()=>reconcileFood({...s,mode:"digital"},{food:"seed",count:8}),
    /Only physical/);
});
test("physical egg correction is constrained by bird capacity and global supply",()=>{
  let s=newGame({mode:"physical",seed:418});
  const id=BIRDS.find(x=>x.habitats.includes("forest")&&x.eggs>=3).id;
  const from=s.deck.indexOf(id);
  if(from>=0)s.deck.splice(from,1);
  else {
    // Find a bird in a private hand to exchange for that existing ID.
    for(const p of s.players) {
      const at=p.hand.indexOf(id);
      if(at>=0){p.hand.splice(at,1);break;}
    }
  }
  const p=s.players[0];
  p.habitats.forest.push({id,eggs:0,cached:[],tucked:[]});
  assertValid(s);
  s=reconcileEggs(s,{player:0,habitat:"forest",index:0,count:2});
  assert.equal(s.players[0].habitats.forest[0].eggs,2);
  assert.equal(s.eggSupply,73);
  assertValid(s);
  assert.throws(()=>reconcileEggs(s,{habitat:"forest",index:0,
    count:99}),/capacity/);
});
test("public-information analysis is invariant to permutations of hidden deck order",()=>{
  const state=newGame({players:3,mode:"digital",seed:151});
  const a=publicObservation(state,0);
  const swapped=structuredClone(state);
  swapped.deck.reverse();
  swapped.bonusDeck.reverse();
  const b=publicObservation(swapped,0);
  assert.deepEqual(a,b);
  const choices=candidateActions(state);
  const first=createSearch(a,choices,{rng:seededRandom(1023)});
  const second=createSearch(b,choices,{rng:seededRandom(1023)});
  runSearch(first,200);runSearch(second,200);
  assert.deepEqual(searchSummary(first),searchSummary(second));
  assert.equal(searchSummary(first).iterations,200);
  assert.equal(searchSummary(first).candidates.reduce((n,x)=>n+x.visits,0),200);
  assert.ok(availableUnknownCards(a).length>=100);
});
test("candidate analysis does not expose an opponent's private hand or bonus",()=>{
  const s=newGame({players:4,seed:777});
  const visible=publicObservation(s,0);
  const json=JSON.stringify(visible);
  assert.equal(visible.players[1].hand.length,0);
  assert.equal(visible.players[1].handCount,5);
  assert.equal("deck" in visible,false);
  assert.equal("bonusDeck" in visible,false);
  const choices=candidateActions(s);
  const summary=searchSummary(runSearch(createSearch(visible,choices,
    {rng:seededRandom(2)}),48));
  assert.ok(summary.candidates.every(x=>x.action.type==="setup"));
  assert.equal(json,JSON.stringify(publicObservation(s,0)));
});
