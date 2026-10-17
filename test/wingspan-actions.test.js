import test from "node:test";
import assert from "node:assert/strict";
import {BIRDS} from "../wingspan/catalog.js";
import {newGame,applyAction,assertValid,powerChoices} from "../wingspan/core.js";
import {candidateActions} from "../wingspan/actions.js";

const start=(players=2,seed=91)=>{
 let s=newGame({players,seed});
 while(s.phase==="setup"){
   const current=s.currentPlayer;
   s=applyAction(s,{type:"setup",keep:[],
     bonusId:s.players[current].bonusOffer[0],foodDiscard:[]});
 }
 return s;
};
test("every representative setup action is accepted and preserves inventories",()=>{
 let s=newGame({players:3,seed:94});
 const actions=candidateActions(s);
 assert.ok(actions.length>=6);
 for(const item of actions){
   const next=applyAction(s,item.action);
   assertValid(next);
   assert.equal(next.players[0].hand.length,item.action.keep.length);
 }
});
test("all four families of representative main actions are executable",()=>{
 let s=start(2,102);
 const actions=candidateActions(s);
 const found=new Set(actions.map(x=>x.action.type));
 assert.ok(found.has("gainFood")&&found.has("layEggs")&&found.has("drawBirds"));
 for(const candidate of actions){
   const next=applyAction(s,candidate.action);
   assertValid(next);
 }
});
test("representative forest, grassland, wetland actions remain valid with birds",()=>{
 let s=start(2,201);
 const birds=BIRDS.filter(x=>x.powerCode===0&&x.eggs>=3&&
   (x.habitats.includes("forest")||x.habitats.includes("grassland")||
    x.habitats.includes("wetland"))).slice(0,3);
 const p=s.players[0];
 for(const [i,bird] of birds.entries()){
   const h=["forest","grassland","wetland"].find(h=>bird.habitats.includes(h))??bird.habitats[0];
   p.habitats[h].push({id:bird.id,eggs:1,cached:[],tucked:[]});
   s.deck.splice(s.deck.indexOf(bird.id),1);
   s.eggSupply--;
 }
 p.food={invertebrate:4,seed:4,fish:4,fruit:4,rodent:4};
 assertValid(s);
 const actions=candidateActions(s);
 assert.ok(actions.some(x=>x.action.type==="layEggs"&&x.action.targets.length>0));
 for(const candidate of actions){
   try{
     const next=applyAction(s,candidate.action);
     assertValid(next);
   }catch(error){
     assert.fail("Invalid "+candidate.label+": "+error.message);
   }
 }
});
test("power choices surface optional skip and legal explicit decisions",()=>{
 const s=start(2,331);
 const bird=BIRDS.find(x=>x.powerCode===6);
 const pos=s.deck.indexOf(bird.id);
 assert.ok(pos>=0);
 s.deck.splice(pos,1);
 s.players[0].habitats[bird.habitats[0]].push({
   id:bird.id,eggs:0,cached:[],tucked:[]
 });
 s.phase="power";
 s.pending=[{owner:0,habitat:bird.habitats[0],index:0,
   birdId:bird.id,code:bird.powerCode,timing:"white",event:{type:"playBird",actor:0}}];
 assertValid(s);
 const options=candidateActions(s);
 assert.ok(options.find(x=>x.action.skip));
 for(const entry of options)assertValid(applyAction(s,entry.action));
});
