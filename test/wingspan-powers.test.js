import test from "node:test";
import assert from "node:assert/strict";
import {BIRDS} from "../wingspan/catalog.js";
import {HABITATS,FOOD} from "../wingspan/scoring.js";
import {newGame,applyAction,assertValid,powerChoices,findFoodPayment} from "../wingspan/core.js";

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


test("multiplayer shared bird draw preserves the initial player and all card identities",()=>{
  let s=prepared(207);
  pending(s,8);
  s=applyAction(s,{type:"power",choice:firstChoice(s)});
  assert.equal(s.phase,"power");
  assert.equal(s.pending[0].code,1008);
  assert.equal(s.pending[0].owner,0);
  assert.equal(s.pending[0].event.cards.length,4);
  assertValid(s);
  for(const owner of [0,1,2]){
    assert.equal(s.pending[0].owner,owner);
    const options=powerChoices(s);
    assert.ok(!options.some(x=>x.type==="skip"));
    const pick=firstChoice(s);
    s=applyAction(s,{type:"power",choice:pick});
    assertValid(s);
  }
  assert.equal(s.phase,"play");
  assert.equal(s.players[0].hand.length,2,"Initiator keeps chosen card and the extra");
  assert.equal(s.players[1].hand.length,1);
  assert.equal(s.players[2].hand.length,1);
});


test("Acorn Woodpecker may keep feeder seed as food OR cache it",()=>{
  let s=prepared(455);
  pending(s,1);
  s.feeder=["seed","fish"];
  const choices=powerChoices(s).filter(x=>x.type!=="skip");
  assert.ok(choices.some(x=>x.choice.cache===false));
  assert.ok(choices.some(x=>x.choice.cache===true));
  const inHand=applyAction(s,{type:"power",
    choice:choices.find(x=>x.choice.cache===false).choice});
  const cached=applyAction(s,{type:"power",
    choice:choices.find(x=>x.choice.cache===true).choice});
  const bird=BIRDS.find(x=>x.powerCode===1);
  const habitat=bird.habitats[0];
  assert.equal(inHand.players[0].food.seed,s.players[0].food.seed+1);
  assert.equal(inHand.players[0].habitats[habitat][0].cached.length,0);
  assert.equal(cached.players[0].food.seed,s.players[0].food.seed);
  assert.deepEqual(cached.players[0].habitats[habitat][0].cached,["seed"]);
  assertValid(inHand);assertValid(cached);
});
test("Anna's Hummingbird can choose a different player to start feeder picks",()=>{
  let s=prepared(456);
  pending(s,11);
  s.feeder=["seed","fish","fruit","rodent","invertebrate"];
  const starter=powerChoices(s).find(x=>x.choice?.firstPlayer===2);
  assert.ok(starter);
  s=applyAction(s,{type:"power",choice:starter.choice});
  assert.equal(s.pending[0].code,1011);
  assert.equal(s.pending[0].owner,2);
  const original=s.players.map(p=>FOOD.reduce((n,f)=>n+p.food[f],0));
  const sequence=[];
  while(s.phase==="power"){
    assert.equal(s.pending[0].code,1011);
    sequence.push(s.pending[0].owner);
    s=applyAction(s,{type:"power",choice:firstChoice(s)});
    assertValid(s);
  }
  assert.deepEqual(sequence,[2,0,1]);
  s.players.forEach((p,i)=>assert.equal(
    FOOD.reduce((n,f)=>n+p.food[f],0),original[i]+1));
});
test("pink parasite responds to lay eggs action even if zero eggs were actually laid",async()=>{
  let s=prepared(457);
  const bird=BIRDS.find(x=>x.powerCode===2);
  const powerAvailable=(await import("../wingspan/powers.js")).powerAvailable;
  assert.ok(powerAvailable(s,{
    owner:0,birdId:bird.id,code:2,timing:"pink",
    event:{type:"layEggs",actor:1,count:0}
  }));
  assert.ok(!powerAvailable(s,{
    owner:0,birdId:bird.id,code:2,timing:"pink",
    event:{type:"drawBirds",actor:1}
  }));
});
test("optional card draws defer their mandatory hand discard until the other brown powers",()=>{
  let s=prepared(458);
  pending(s,21);
  const after21=s.pending[0];
  const other=place(s,66,{owner:0});
  s.pending.push({...after21,index:other.index,habitat:other.habitat,
    birdId:other.bird.id,code:66});
  s=applyAction(s,{type:"power",choice:firstChoice(s)});
  assert.equal(s.pending[0].code,66);
  assert.equal(s.pending[1].code,1000);
  s=applyAction(s,{type:"power",choice:firstChoice(s)});
  assert.equal(s.pending[0].code,1000);
  assert.ok(!powerChoices(s).some(x=>x.type==="skip"));
  s=applyAction(s,{type:"power",choice:firstChoice(s)});
  assertValid(s);
});


test("Common Raven and Chihuahuan Raven can select two DIFFERENT foods",()=>{
  for(const code of [33]){
    let s=prepared(810+code);
    support(s,0,2);
    pending(s,code);
    const options=powerChoices(s);
    const selected=options.find(x=>
      x.choice?.foods?.includes("fruit")&&
      x.choice?.foods?.includes("rodent"));
    assert.ok(selected,"Raven must offer mixed food pairs");
    const before={...s.players[0].food};
    s=applyAction(s,{type:"power",choice:selected.choice});
    assert.equal(s.players[0].food.fruit,before.fruit+1);
    assert.equal(s.players[0].food.rodent,before.rodent+1);
    assertValid(s);
  }
});
test("all-player bowl egg powers give owner a distinct extra bird target",()=>{
  let s=prepared(899);
  const addNest=(owner)=>{
    const id=s.deck.find(id=>BIRDS[id].nest==="bowl"&&BIRDS[id].eggs>=2);
    assert.ok(id!==undefined);
    s.deck.splice(s.deck.indexOf(id),1);
    const habitat=BIRDS[id].habitats[0];
    const index=s.players[owner].habitats[habitat].length;
    s.players[owner].habitats[habitat].push({
      id,eggs:0,cached:[],tucked:[]
    });
    return {habitat,index};
  };
  addNest(0);addNest(0);addNest(1);addNest(2);
  pending(s,54);
  s=applyAction(s,{type:"power",choice:firstChoice(s)});
  assert.equal(s.phase,"power");
  let originalTarget=null,secondarySeen=false,steps=0;
  while(s.phase==="power"){
    if(++steps>15)throw Error("all-player egg effect did not terminate");
    const effect=s.pending[0];
    const options=powerChoices(s);
    const choice=options.find(x=>x.type!=="skip")??options[0];
    assert.ok(choice);
    if(effect.owner===0 && !effect.event.secondary){
      originalTarget=choice.choice;
    }
    if(effect.owner===0 && effect.event.secondary){
      secondarySeen=true;
      assert.ok(originalTarget);
      assert.ok(!options.some(x=>x.choice?.habitat===originalTarget.habitat&&
        x.choice?.index===originalTarget.index),
        "Extra egg cannot go on the original bowl bird");
    }
    s=applyAction(s,choice.type==="skip"?
      {type:"power",skip:true}:{type:"power",choice:choice.choice});
    assertValid(s);
  }
  assert.ok(secondarySeen,"Owner had two eligible birds and must see extra option");
});
test('two forest birds played in one white-power chain offer one pink reaction',()=>{
  let s=prepared();
  const pink=place(s,39,{owner:1});
  support(s,0,2);
  const first=BIRDS.find(b=>b.powerCode===37);
  const second=BIRDS.find(b=>b.powerCode===31&&b.id!==first.id);
  for(const b of [first,second]){takeBird(s,b.id);s.players[0].hand.push(b.id);}
  // Start with a normally paid first bird; its white power precedes the pink response.
  const row=s.players[0].habitats.forest;
  // The support bird may live outside the forest; collect a legal egg source explicitly.
  const eggSource=HABITATS.flatMap(h=>s.players[0].habitats[h].map((b,index)=>({h,b,index}))).find(x=>x.b.eggs>0);
  s=applyAction(s,{type:'playBird',birdId:first.id,habitat:'forest',
    payment:findFoodPayment(s.players[0].food,first),eggs:row.length?[{habitat:eggSource.h,index:eggSource.index,count:1}]:[]});
  s=applyAction(s,{type:'power',choice:{birdId:second.id,habitat:'forest'}});
  assert.equal(s.pending.filter(p=>p.birdId===pink.bird.id).length,1);
  const before=s.players[1].food.invertebrate;
  s=applyAction(s,{type:'power',choice:firstChoice(s)});
  assert.equal(s.players[1].food.invertebrate,before+1);
  assert.equal(s.phase,'play');assertValid(s);
});
