import test from "node:test";
import assert from "node:assert/strict";
import {BIRDS,BONUSES,GOAL_TILES} from "../wingspan/catalog.js";
import {FOOD,HABITATS,roundGoalScores,bonusPoints,scorePlayer,finalOutcome,
  validateGoalDefinitions} from "../wingspan/scoring.js";
import {newGame,applyAction,assertValid,findFoodPayment,powerChoices,
  publicObservation,RESOURCE_PROGRESSION,EGG_COLUMN_COST} from "../wingspan/core.js";

function ready(players=2,starter=0,seed=41){
  let state=newGame({players,starter,seed});
  for(let i=0;i<players;i++){
    const owner=state.currentPlayer;
    state=applyAction(state,{type:"setup",keep:[],
      foodDiscard:[],bonusId:state.players[owner].bonusOffer[0]});
  }
  assert.equal(state.phase,"play");
  assertValid(state);
  return state;
}
function findBird(state,predicate,player=state.currentPlayer){
  const id=state.deck.find(id=>predicate(BIRDS[id]));
  assert.ok(id!==undefined,"Expected eligible bird in remaining deck");
  state.deck.splice(state.deck.indexOf(id),1);
  state.players[player].hand.push(id);
  return id;
}
function die(s,index=0){
  const face=s.feeder[index];
  return {index,food:face==="dual"?"seed":face};
}
test("strict base-only factual catalog: 170 birds, 26 bonuses, 8 double-sided goals",()=>{
  assert.equal(BIRDS.length,170);
  assert.equal(BONUSES.length,26);
  assert.equal(GOAL_TILES.length,8);
  assert.ok(GOAL_TILES.every(x=>x.length===2));
  assert.ok(validateGoalDefinitions());
  assert.equal(new Set(BIRDS.map(x=>x.name)).size,170);
  assert.equal(new Set(BONUSES.map(x=>x.name)).size,26);
  const exclusions=["American Redstart","Black-chinned Hummingbird","Brant",
    "Broad-winged Hawk","Canvasback","Painted Whitestart",
    "Red-breasted Merganser","Scaled Quail","Vaux's Swift","White-throated Swift"];
  for(const name of exclusions)
    assert.equal(BIRDS.some(b=>b.name.toLowerCase()===name.toLowerCase()),false);
  assert.deepEqual([...new Set(BIRDS.map(b=>b.powerType))].sort(),
    ["brown","none","pink","white"]);
  assert.equal(BIRDS.filter(b=>b.powerType==="brown").length,116);
  assert.equal(BIRDS.filter(b=>b.powerType==="pink").length,12);
  assert.equal(BIRDS.filter(b=>b.powerType==="white").length,36);
  assert.equal(BIRDS.filter(b=>b.powerType==="none").length,6);
  assert.equal(new Set(BIRDS.map(b=>b.powerCode).filter(n=>n)).size,67);
  for(const b of BIRDS){
    assert.ok(b.habitats.length>=1 && b.habitats.every(x=>HABITATS.includes(x)));
    assert.ok(b.points>=0&&b.eggs>=0&&b.wingspan>0);
    assert.ok(FOOD.every(k=>Number.isInteger(b.food[k])&&b.food[k]>=0));
  }
});
test("setup deals unique birds and bonuses and enforces initial food exchange",()=>{
  let s=newGame({players:4,starter:2,seed:94});
  assertValid(s);
  assert.equal(s.phase,"setup");
  assert.equal(s.currentPlayer,2);
  for(const p of s.players) {
    assert.equal(p.hand.length,5);
    assert.equal(p.bonusOffer.length,2);
    assert.deepEqual(p.food,{invertebrate:1,seed:1,fish:1,fruit:1,rodent:1});
  }
  const p=s.players[2];
  const keep=p.hand.slice(0,2);
  s=applyAction(s,{type:"setup",keep,bonusId:p.bonusOffer[0],
    foodDiscard:["fish","fruit"]});
  assert.deepEqual(s.players[2].hand,keep);
  assert.equal(FOOD.reduce((n,f)=>n+s.players[2].food[f],0),3);
  assertValid(s);
  while(s.phase==="setup"){
    const user=s.currentPlayer;
    s=applyAction(s,{type:"setup",keep:[],
      bonusId:s.players[user].bonusOffer[0],foodDiscard:[]});
  }
  assert.equal(s.phase,"play");
  assert.equal(s.currentPlayer,2);
  assert.deepEqual(s.remaining,[8,8,8,8]);
  assertValid(s);
});
test("four rounds use 8,7,6,5 actions and rotate the starting player",()=>{
  let s=ready(2,1);
  for(let round=1;round<=4;round++){
    let actions=0;
    while(s.phase==="play" && s.round===round){
      s=applyAction(s,{type:"gainFood",dice:[die(s)]});
      actions++;
      assertValid(s);
    }
    assert.equal(actions,2*[8,7,6,5][round-1]);
    assert.equal(s.players[0].goalPoints.length,round);
    assert.equal(s.players[1].goalPoints.length,round);
    if(round<4){
      assert.equal(s.round,round+1);
      assert.equal(s.starter,(1+round)%2);
      assert.deepEqual(s.remaining,Array(2).fill([8,7,6,5][round]));
      assert.equal(s.tray.length,3);
    }
  }
  assert.equal(s.phase,"gameover");
  assert.deepEqual(finalOutcome(s.players),[0.5,0.5]);
});
test("bird playing spends explicit food, eggs and honors allowed habitat",()=>{
  let s=ready();
  const id=findBird(s,b=>b.habitats.includes("forest"));
  const bird=BIRDS[id];
  const food={invertebrate:8,seed:8,fish:8,fruit:8,rodent:8};
  s.players[0].food=food;
  const payment=findFoodPayment(food,bird);
  assert.ok(payment!==null);
  s=applyAction(s,{type:"playBird",birdId:id,habitat:"forest",
    payment,eggs:[]});
  assert.equal(s.players[0].habitats.forest.length,1);
  assert.equal(s.players[0].habitats.forest[0].id,id);
  assert.ok(!s.players[0].hand.includes(id));
  assert.equal(s.remaining[0],7);
  assertValid(s);
});
test("wetland drawing refreshes the public tray only at turn end",()=>{
  let s=ready();
  const first=s.tray[0],before=s.players[0].hand.length;
  s=applyAction(s,{type:"drawBirds",draws:[0]});
  assert.equal(s.players[0].hand.length,before+1);
  assert.ok(s.players[0].hand.includes(first));
  assert.equal(s.tray.length,3);
  assert.ok(!s.tray.includes(first));
  assertValid(s);
});
test("forest/grassland/wetland upgrades expose extra conversion at odd bird counts",()=>{
  assert.deepEqual(RESOURCE_PROGRESSION.forest,[1,1,2,2,3,3]);
  assert.deepEqual(RESOURCE_PROGRESSION.grassland,[2,2,3,3,4,4]);
  assert.deepEqual(RESOURCE_PROGRESSION.wetland,[1,1,2,2,3,3]);
  assert.deepEqual(EGG_COLUMN_COST,[0,1,1,2,2]);
  let s=ready();
  assert.throws(()=>applyAction(s,{type:"gainFood",extra:true,
    discardCard:0,dice:[die(s)]}),/extra-food/);
  assert.throws(()=>applyAction(s,{type:"layEggs",extra:true,payment:"fish",
    targets:[]}),/extra-egg/);
  assert.throws(()=>applyAction(s,{type:"drawBirds",extra:true,draws:[],
    eggSource:null}),/extra-card/);
});
test("round-goal competitive scoring shares tied ranks and blue cap is five",()=>{
  const p=Array.from({length:4},()=>({
    habitats:{forest:[],grassland:[],wetland:[]}
  }));
  p[0].habitats.forest=Array.from({length:5},()=>({id:0,eggs:0}));
  p[1].habitats.forest=Array.from({length:4},()=>({id:0,eggs:0}));
  p[2].habitats.forest=Array.from({length:4},()=>({id:0,eggs:0}));
  const goal={kind:"birds",habitat:"forest"};
  assert.deepEqual(roundGoalScores(p,goal,2,"green"),[5,1,1,0]);
  assert.deepEqual(roundGoalScores(p,goal,1,"blue"),[5,4,4,0]);
});
test("scoring includes bird VP, cached/tucked, egg/bonus and food tie-break",()=>{
  const base=ready(2);
  const p=base.players[0];
  const birdId=base.deck.pop();
  p.habitats.wetland.push({id:birdId,eggs:1,cached:["seed"],tucked:[]});
  const stats=scorePlayer(p);
  assert.equal(stats.birds,BIRDS[birdId].points);
  assert.equal(stats.eggs,1);assert.equal(stats.cached,1);
  assert.equal(stats.total,stats.birds+stats.eggs+stats.cached+stats.bonuses);
  assert.ok(bonusPoints(p.bonuses[0],p)>=0);
  const q=base.players[1];
  q.habitats.wetland.push({id:birdId,eggs:1,cached:["seed"],tucked:[]});
  q.bonuses=[...p.bonuses];
  p.food.seed=9;q.food.seed=1;
  assert.deepEqual(finalOutcome([p,q]),[1,0]);
});
test("white played-card power awaits explicit execute or skip, without silent effects",()=>{
  let s=ready();
  const id=findBird(s,b=>b.powerCode===6);
  s.players[0].food={invertebrate:6,seed:6,fish:6,fruit:6,rodent:6};
  const pay=findFoodPayment(s.players[0].food,BIRDS[id]);
  s=applyAction(s,{type:"playBird",birdId:id,habitat:BIRDS[id].habitats[0],
    payment:pay,eggs:[]});
  assert.equal(s.phase,"power");
  const offered=powerChoices(s);
  assert.ok(offered.length>=2);
  const before=s.players[0].food.seed;
  const used=offered.find(x=>x.type!=="skip");
  s=applyAction(s,{type:"power",choice:used.choice});
  assert.equal(s.players[0].food.seed,before+3);
  assertValid(s);
});
test("private observation redacts deck order and opponent hands",()=>{
  const s=newGame({players:3});
  const a=publicObservation(s,0);
  assert.equal("deck" in a,false);
  assert.equal("rngState" in a,false);
  assert.equal(a.players[0].hand.length,5);
  assert.equal(a.players[1].hand.length,0);
  assert.equal(a.players[1].handCount,5);
  assert.equal(a.players[2].bonuses.length,0);
});
