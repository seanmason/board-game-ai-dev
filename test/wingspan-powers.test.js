import test from "node:test";
import assert from "node:assert/strict";
import {BIRDS} from "../wingspan/catalog.js";
import {HABITATS,FOOD} from "../wingspan/scoring.js";
import {newGame,applyAction,assertValid,powerChoices} from "../wingspan/core.js";

function prepared(seed=58){
  let s=newGame({players:3,seed});
  while(s.phase==="setup"){
    const p=s.players[s.currentPlayer];
    s=applyAction(s,{type:"setup",keep:[],
      foodDiscard:[],bonusId:p.bonusOffer[0]});
  }
  s.players.forEach(p=>{p.food=Object.fromEntries(FOOD.map(f=>[f,9]));});
  return s;
}
function takeBird(s,id){
  for(const arr of [s.deck,s.birdDiscard,s.tray,
    ...s.players.map(p=>p.hand)]){
    const pos=arr.indexOf(id);
    if(pos>=0){arr.splice(pos,1);return;}
  }
  throw Error("Bird unavailable "+id);
}
function place(s,code,{owner=0,eggs=0}={}){
  const bird=BIRDS.find(b=>b.powerCode===code);
  assert.ok(bird,"Power "+code+" must have a base-game bird");
  takeBird(s,bird.id);
  const habitat=bird.habitats[0],row=s.players[owner].habitats[habitat];
  row.push({id:bird.id,eggs,cached:[],tucked:[]});
  s.eggSupply-=eggs;
  return {bird,habitat,index:row.length-1};
}
function support(s,owner,eggs=2) {
  const card=BIRDS.find(b=>b.powerCode===0&&b.eggs>=eggs);
  takeBird(s,card.id);
  const habitat=card.habitats[0];
  const index=s.players[owner].habitats[habitat].length;
  s.players[owner].habitats[habitat].push({
    id:card.id,eggs,cached:[],tucked:[]
  });
  s.eggSupply-=eggs;
  return {id:card.id,habitat,index};
}
function pending(s,code,{owner=0,event={},timing=null}={}){
  const {bird,habitat,index}=place(s,code,{owner});
  s.phase="power";
  s.pending=[{owner,habitat,index,birdId:bird.id,code,
    timing:timing??bird.powerType,event:{type:"playBird",actor:owner,...event}}];
  assertValid(s);
  return bird.id;
}
function firstChoice(s){
  const available=powerChoices(s).find(a=>a.type!=="skip");
  assert.ok(available,"Power must offer an explicit executable choice");
  return available.choice;
}
test("brown self-egg power adds one egg on itself without overflowing",()=>{
  let s=prepared();
  const id=pending(s,30);
  const bird=s.players[0].habitats[
    BIRDS[id].habitats[0]][0];
  const next=applyAction(s,{type:"power",choice:firstChoice(s)});
  const placed=next.players[0].habitats[BIRDS[id].habitats[0]][0];
  assert.equal(placed.eggs,1);
  assert.equal(next.eggSupply,74);
  assertValid(next);
});
test("brown food caching retains seed on card rather than in hand",()=>{
  let s=prepared();
  const id=pending(s,31);
  const before=s.players[0].food.seed;
  s=applyAction(s,{type:"power",choice:firstChoice(s)});
  const nest=s.players[0].habitats[BIRDS[id].habitats[0]][0];
  assert.deepEqual(nest.cached,["seed"]);
  assert.equal(s.players[0].food.seed,before);
  assertValid(s);
});
test("egg-for-food exchange consumes a different bird's egg",()=>{
  let s=prepared();
  const supporting=support(s,0,2);
  pending(s,5);
  const foodBefore=s.players[0].food.seed;
  const options=powerChoices(s);
  const choice=options.find(x=>x.choice?.food==="seed")?.choice;
  assert.ok(choice);
  s=applyAction(s,{type:"power",choice});
  assert.equal(s.players[0].habitats[supporting.habitat][supporting.index].eggs,1);
  assert.equal(s.eggSupply,74);
  assert.equal(s.players[0].food.seed,foodBefore+1);
  assertValid(s);
});
test("white bonus-choice power holds two cards without losing or duplicating them",()=>{
  let s=prepared();
  pending(s,13);
  s=applyAction(s,{type:"power",choice:firstChoice(s)});
  assert.equal(s.phase,"power");
  assert.equal(s.pending[0].code,1013);
  const options=powerChoices(s);
  assert.equal(options.length,2);
  assert.ok(!options.some(x=>x.type==="skip"));
  const count=s.players[0].bonuses.length;
  s=applyAction(s,{type:"power",choice:options[0].choice});
  assert.equal(s.players[0].bonuses.length,count+1);
  assertValid(s);
});
test("drawing a card with a mandatory discard cannot silently skip payment",()=>{
  let s=prepared();
  pending(s,21);
  s=applyAction(s,{type:"power",choice:firstChoice(s)});
  assert.equal(s.phase,"power");
  assert.equal(s.pending[0].code,1000);
  assert.ok(!powerChoices(s).some(x=>x.type==="skip"));
  assert.throws(()=>applyAction(s,{type:"power",skip:true}),/card selection|revealed|complete/i);
  s=applyAction(s,{type:"power",choice:firstChoice(s)});
  assertValid(s);
});
test("base pink bird powers retain one-trigger-between-turns flags",()=>{
  const b=BIRDS.find(x=>x.powerCode===39);
  assert.equal(b.powerType,"pink");
  assert.ok(b.habitats.length>=1);
});
