/** Cheap continuation-only grades. Never call this for the persistent root prior.
 * Supported costs/output use original catalog codes; unsupported choices return
 * fallbackGrade exactly. No rules transitions, RNG or hidden-world peeking.
 */
import {BIRDS} from '../../wingspan/catalog.js';
import {FOOD,HABITATS,allBirds} from '../../wingspan/scoring.js';
import {knownCard} from '../../wingspan/observation-io.js';
import {remainingActions} from '../../wingspan/leaf-evaluators.js';
const TUCK=new Set([4,27,32,35,62]);
const SUPPORTED=new Set([1,5,9,14,23,30,31,33,36,41,43,47,1000,...TUCK]);
const sum=a=>a.reduce((n,x)=>n+x,0);
export function powerPolicyGrade(state,action,owner,fallbackGrade){
 if(action.type!=='power'||state.phase!=='power')return fallbackGrade;
 const pending=state.pending?.[0];if(!pending||pending.owner!==owner)return fallbackGrade;
 const code=pending.code??BIRDS[pending.birdId]?.powerCode;
 if(!SUPPORTED.has(code))return fallbackGrade;
 if(action.skip)return code===1000?fallbackGrade:0;
 const p=state.players[owner],birds=allBirds(p),hand=p.hand.filter(id=>BIRDS[id]&&(!state.physical||knownCard(state,id))),q=action.choice??{};
 const turns=remainingActions(state,owner),slots=15-birds.length,tucks=birds.filter(e=>BIRDS[e.id].powerType==='brown'&&TUCK.has(BIRDS[e.id].powerCode)).length;
 const cardsWanted=Math.max(turns>0?Math.min(2,slots):0,Math.min(5,2*tucks));
 const drawValue=(n,stock=hand.length)=>1.1*Math.min(n,Math.max(0,cardsWanted-stock));
 const available=turns>0?hand.map(id=>BIRDS[id]).filter(b=>b.habitats.some(h=>p.habitats[h].length<5)):[];
 const demand=Object.fromEntries(FOOD.map(f=>[f,sum(available.map(b=>b.food[f]??0))+birds.filter(e=>(f==='seed'&&BIRDS[e.id].powerCode===23)||(f==='fish'&&[9,36].includes(BIRDS[e.id].powerCode))).length]));
 const foodValue=foods=>{const stock={...p.food};let v=0;for(const f of foods){if(!FOOD.includes(f))return 0;if(stock[f]<demand[f])v+=.9;stock[f]++;}return v;};
 const foodCost=f=>(FOOD.includes(f)&&p.food[f]>0&&p.food[f]<=demand[f]) ? .9 : 0;
 const bestFoods=n=>{let best=[],value=-Infinity;for(const a of FOOD)for(const b of n===2?FOOD:[a]){const foods=n===2?[a,b]:[a],v=foodValue(foods);if(v>value){best=foods;value=v;}}return best;};
 const retain=id=>{const b=BIRDS[id];return b&&b.habitats.some(h=>p.habitats[h].length<5)?Math.min(2,.2*b.points+.05*b.eggs)*Math.min(1,turns/26):0;};
 const eggCost=e=>e?.eggs>0?1+(e.eggs===1?.15:0):Infinity;
 const eggAt=c=>p.habitats[c.habitat]?.[c.index];
 const source=(exclude,choice)=>{if(choice?.habitat!==undefined){const e=eggAt(choice);return e?.id!==exclude?eggCost(e):Infinity;}return Math.min(Infinity,...birds.filter(e=>e.id!==exclude).map(eggCost));};
 const room=e=>e?Math.max(0,BIRDS[e.id].eggs-e.eggs):0;
 const cheapestCard=()=>hand.reduce((a,id)=>a===null||retain(id)<retain(a)?id:a,null);
 function effect(c,e,choice,repeat=false){
  if(c===1000)return hand.includes(choice.cardId)?-retain(choice.cardId):null;
  if(c===33||c===5){const cost=source(e.id,choice),foods=c===33?(choice.foods??bestFoods(2)):(choice.food?[choice.food]:bestFoods(1));return Number.isFinite(cost)?foodValue(foods)-cost:-4;}
  if(c===41){const cost=source(null,choice);return Number.isFinite(cost)?drawValue(2)-cost:-4;}
  if(TUCK.has(c)){const id=choice.cardId??(repeat?cheapestCard():null);if(id===null||!hand.includes(id))return -4;
   const debt=state.pending.filter(x=>x.owner===owner&&x.code===1000).length;if(c!==4&&hand.length<=debt)return -4;
   let value=1-retain(id);if(c===4)value+=drawValue(1,hand.length-1);if(c===27)value+=Math.min(1,room(e),state.eggSupply??75);if(c===32)value+=foodValue(['fruit']);if(c===35)value+=foodValue(['seed']);if(c===62)value+=choice.food?foodValue([choice.food]):Math.max(foodValue(['invertebrate']),foodValue(['seed']));return value;}
  if(c===9||c===23||c===36){const f=c===23?'seed':'fish';return p.food[f]>0?2-foodCost(f):-4;}
  if(c===31)return 1;
  if(c===1){
   if(choice.refill)return null; // Unknown refill outcome retains old grading.
   if(repeat&&choice.food===undefined){
    if(!state.feeder?.length)return null;
    return state.feeder.some(f=>f==='seed'||f==='dual')?Math.max(1,foodValue(['seed'])):0;
   }
   return choice.cache?1:foodValue([choice.food]);
  }
  if(c===47)return p.food[choice.from]>0?foodValue([choice.to])-foodCost(choice.from): -4;
  if(c===14||c===30){const target=choice.habitat!==undefined?eggAt(choice):c===30?e:birds.find(x=>room(x));return Math.min(1,room(target),state.eggSupply??75);}
  if(c===43||c===49){if(repeat)return null;const target=p.habitats[pending.habitat]?.[choice.index],b=target&&BIRDS[target.id];if(!b||target.id===e.id||b.powerType!=='brown'||[43,49].includes(b.powerCode)||(c===49&&b.powerGroup!=='hunting/fishing'))return -4;return effect(b.powerCode,target,{},true);}
  return null;
 }
 const entry=p.habitats[pending.habitat]?.[pending.index]??birds.find(e=>e.id===pending.birdId);
 if(!entry&&code!==1000)return fallbackGrade;
 const value=effect(code,entry,q);return value===null||!Number.isFinite(value)?fallbackGrade:Math.max(-4,Math.min(4,value));
}
