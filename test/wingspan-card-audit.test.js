/**
 * Original Wingspan base: ONE EXECUTABLE SUBTEST PER PHYSICAL BIRD.
 *
 * These tests validate card identity, metadata, habitat, resource cost shape,
 * timing and a representative legal activation under a deliberately rich
 * board fixture. This is a coverage audit, NOT exhaustive proof of all
 * combinations; docs/WINGSPAN_CARD_AUDIT.md states the boundaries.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {BIRDS,BONUSES,GOAL_TILES} from "../wingspan/catalog.js";
import {FOOD,HABITATS} from "../wingspan/scoring.js";
import {newGame,applyAction,assertValid,powerChoices,publicObservation} from "../wingspan/core.js";
import {powerAvailable,powerOptions,powerDescription} from "../wingspan/powers.js";

const POWER_TYPES=new Set(["brown","white","pink","none"]);
const foodSum=b=>[...FOOD,"wild"].reduce((n,f)=>n+(b.food[f]||0),0);
function pull(s,id){
  const pools=[s.deck,s.birdDiscard,s.tray,...s.players.map(p=>p.hand)];
  for(const items of pools){
    const at=items.indexOf(id);
    if(at>=0){items.splice(at,1);return;}
  }
  throw Error("Card "+id+" missing from fixture inventory");
}
function fixture(bird){
  let s=newGame({players:3,seed:1000+bird.id,mode:"digital"});
  while(s.phase==="setup"){
    const p=s.players[s.currentPlayer];
    s=applyAction(s,{type:"setup",keep:[],foodDiscard:[],
      bonusId:p.bonusOffer[0]});
  }
  s.players.forEach(p=>{
    for(const food of FOOD)p.food[food]=12;
  });
  pull(s,bird.id);
  const owner=0;
  const habitat=bird.habitats[0];
  const index=s.players[owner].habitats[habitat].length;
  s.players[owner].habitats[habitat].push({
    id:bird.id,eggs:0,cached:[],tucked:[]
  });
  // A separate bird with eggs makes egg-discard, bowl/cavity/ground-nest,
  // opponent-trigger and simultaneous effects exercisable.
  const support=[...BIRDS].filter(x=>x.id!==bird.id&&x.eggs>=3);
  for(const player of [0,1,2]){
    const pick=support.find(x=>
      x.habitats.length&&
      (player===0||x.nest==="bowl"||x.nest==="cavity"));
    if(pick){
      // Select a fresh support card; duplicates are never permitted.
      const supportId=s.deck.find(id=>BIRDS[id].eggs>=3&&
        !s.players.flatMap(p=>HABITATS.flatMap(h=>p.habitats[h]))
          .some(x=>x.id===id));
      if(supportId!==undefined){
        pull(s,supportId);
        const habitat=BIRDS[supportId].habitats[0];
        s.players[player].habitats[habitat].push({
          id:supportId,eggs:2,cached:[],tucked:[]
        });
        s.eggSupply-=2;
      }
    }
  }
  // Hand cards to tuck/discard or use for a "play second bird" white power.
  for(const player of [0,1,2]){
    for(let i=0;i<3;i++){
      const id=s.deck.pop();
      if(id!==undefined)s.players[player].hand.push(id);
    }
  }
  let event={type:"gainFood",actor:0,foods:["rodent"]};
  if([2,18,28].includes(bird.powerCode))
    event={type:"layEggs",actor:1,count:2};
  else if([19,39,50].includes(bird.powerCode))
    event={type:"playBird",actor:1,habitat:
      bird.powerCode===19?"wetland":bird.powerCode===39?"forest":"grassland"};
  else if(bird.powerCode===22)
    event={type:"predatorSuccess",actor:1};
  else if(bird.powerCode===55)
    event={type:"gainFood",actor:1,foods:["rodent"]};
  const pending={owner,habitat,index,birdId:bird.id,code:bird.powerCode,
    timing:bird.powerType,event};
  s.phase="power";
  s.pending=[pending];
  assertValid(s);
  return s;
}
test("bird source itself: exact 170 original identities, 67 effect codes",()=>{
  assert.equal(BIRDS.length,170);
  assert.equal(BONUSES.length,26);
  assert.equal(GOAL_TILES.length,8);
  assert.equal(new Set(BIRDS.map(b=>b.name)).size,170);
  assert.equal(new Set(BIRDS.map(b=>b.powerCode).filter(Boolean)).size,67);
  assert.ok(BIRDS.every(b=>POWER_TYPES.has(b.powerType)));
});
for(const bird of BIRDS){
  test("Bird card "+String(bird.id).padStart(3,"0")+" · "+bird.name,()=>{
    assert.equal(bird.id,BIRDS.indexOf(bird));
    assert.ok(bird.name&&bird.name.length>3);
    assert.ok(Number.isInteger(bird.points)&&bird.points>=0&&bird.points<=9);
    assert.ok(Number.isInteger(bird.eggs)&&bird.eggs>=0&&bird.eggs<=7);
    assert.ok(bird.habitats.length&&bird.habitats.every(h=>HABITATS.includes(h)));
    assert.ok(bird.nest&&typeof bird.nest==="string");
    assert.ok(foodSum(bird)<=4);
    assert.ok(bird.powerType==="none"?
      bird.powerCode===0:bird.powerCode>=1&&bird.powerCode<=67);
    if(bird.powerCode===0)return;
    assert.ok(powerDescription(bird.powerCode)!=="Resolve optional power");
    const state=fixture(bird);
    const p=state.pending[0];
    assert.equal(p.birdId,bird.id);
    assert.equal(p.timing,bird.powerType);
    // Pink powers may not trigger except for a matching opponent event.
    if(bird.powerType==="pink"){
      assert.ok(powerAvailable(state,p),"Missing pink trigger for "+bird.name);
      assert.equal(powerAvailable(state,{...p,event:{type:"drawBirds",actor:1}}),false);
    }
    const choices=powerOptions(state,p);
    assert.ok(Array.isArray(choices),"Power must enumerate a legal option array");
    for(const option of choices){
      assert.equal(typeof option.label,"string");
      assert.ok(option.choice&&typeof option.choice==="object");
    }
    // Skipping the original optional activation always preserves all cards.
    const skipped=applyAction(state,{type:"power",skip:true});
    assertValid(skipped);
    if(choices.length){
      const choice=choices[0].choice;
      let after;
      assert.doesNotThrow(()=>{after=applyAction(state,{type:"power",choice});},
        "Executable power choice failed for "+bird.name);
      assertValid(after);
    }
  });
}
