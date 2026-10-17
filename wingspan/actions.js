/**
 * Canonical user-facing representative actions for an enormous branching
 * rules game. This is NOT the full legal-action space: it supplies all four
 * action families and playable defaults, while the UI offers more detailed
 * choices when a user records the physical game's actual decision.
 */
import {BIRDS,BONUSES} from "./catalog.js";
import {FOOD,HABITATS} from "./scoring.js";
import {
  findFoodPayment,RESOURCE_PROGRESSION,EGG_COLUMN_COST,powerChoices
} from "./core.js";

const item=(action,label,category)=>({action,label,category});
const allEntries=p=>HABITATS.flatMap(h=>p.habitats[h].map((e,index)=>
  ({habitat:h,index,id:e.id,eggs:e.eggs,capacity:BIRDS[e.id].eggs})));
function getEggPayment(p,n) {
  const sources=[];
  for(const e of allEntries(p)){
    const used=Math.min(n,e.eggs);
    if(used){sources.push({habitat:e.habitat,index:e.index,count:used});n-=used;}
    if(!n)break;
  }
  return n===0?sources:null;
}
function eggsDistribution(p,quantity,priority) {
  const entries=allEntries(p)
    .sort((a,b)=>priority==="few"?a.eggs-b.eggs:
       priority==="many"?b.eggs-a.eggs:
       a.habitat.localeCompare(b.habitat));
  const targets=[];
  for(const e of entries){
    const available=Math.max(0,e.capacity-e.eggs);
    const n=Math.min(quantity,available);
    if(n){targets.push({habitat:e.habitat,index:e.index,count:n});quantity-=n;}
    if(!quantity)break;
  }
  return targets;
}
function setupActions(s) {
  const p=s.players[s.currentPlayer];
  const result=[];
  const scores=p.hand.map(id=>({id,card:BIRDS[id]})).sort((a,b)=>{
    const value=x=>x.card.points+x.card.eggs*.3-
      FOOD.reduce((n,f)=>n+x.card.food[f],0)*1.5;
    return value(b)-value(a);
  });
  const candidate=[[],scores.slice(0,1).map(x=>x.id),
    scores.slice(0,2).map(x=>x.id),
    scores.slice(0,3).map(x=>x.id)];
  for(const keep of candidate){
    // Preserve food the retained birds appear to require.
    const demand=Object.fromEntries(FOOD.map(f=>[f,0]));
    for(const id of keep)for(const f of FOOD)demand[f]+=BIRDS[id].food[f];
    const discard=[...FOOD].sort((a,b)=>demand[a]-demand[b]).slice(0,keep.length);
    for(const bonusId of p.bonusOffer)
      result.push(item({type:"setup",keep,foodDiscard:discard,bonusId},
        "Keep "+keep.length+" bird"+(keep.length===1?"":"s")+"; "+
        BONUSES[bonusId].name,"Setup"));
  }
  return result;
}
function foodActions(s,p) {
  const birdCount=p.habitats.forest.length;
  const count=RESOURCE_PROGRESSION.forest[birdCount];
  const faces=s.feeder;
  const result=[];
  for(let first=0;first<Math.max(1,faces.length);first++){
    const available=faces[first]??null;
    const firstFood=available==="dual"?"seed":available;
    const dice=Array.from({length:count},(_,i)=>i===0?
      {index:first,...(firstFood?{food:firstFood}:{})}:{index:0});
    result.push(item({type:"gainFood",dice},
      "Gain "+count+" food · "+(firstFood??"refill feeder"),"Food"));
    if(firstFood==="seed"&&available==="dual"){
      result.push(item({type:"gainFood",dice:[{index:first,food:"invertebrate"},
        ...dice.slice(1)]},"Gain "+count+" food · invertebrate first","Food"));
    }
    if(birdCount%2===1&&p.hand.length)
      result.push(item({type:"gainFood",dice:[...dice,{index:0}],
        extra:true,discardCard:p.hand.at(-1)},
        "Discard card for "+(count+1)+" food","Food"));
  }
  if(faces.length>0&&new Set(faces).size===1){
    // Optional all-same-face reroll before selecting this action's first die.
    const dice=Array.from({length:count},(_,i)=>({index:0,
      ...(i===0?{reroll:true}:{})}));
    result.push(item({type:"gainFood",dice},
      "Reroll birdfeeder and gain "+count+" food","Food"));
  }
  return result;
}
function layActions(s,p) {
  const count=p.habitats.grassland.length;
  const base=RESOURCE_PROGRESSION.grassland[count];
  const options=[];
  for(const priority of ["few","many","habitat"]){
    const targets=eggsDistribution(p,base,priority);
    options.push(item({type:"layEggs",targets},
      "Lay "+targets.reduce((n,x)=>n+x.count,0)+" eggs","Eggs"));
  }
  if(count%2===1){
    const food=FOOD.find(f=>p.food[f]>0);
    if(food){
      const targets=eggsDistribution(p,base+1,"few");
      options.push(item({type:"layEggs",targets,extra:true,payment:food},
        "Spend "+food+" for an additional egg","Eggs"));
    }
  }
  return options;
}
function drawActions(s,p) {
  const count=p.habitats.wetland.length;
  const amount=RESOURCE_PROGRESSION.wetland[count];
  const list=[item({type:"drawBirds",draws:Array(amount).fill("deck")},
    "Draw "+amount+" hidden bird"+(amount===1?"":"s"),"Cards")];
  for(let first=0;first<s.tray.length;first++){
    list.push(item({type:"drawBirds",draws:[first,
      ...Array(Math.max(0,amount-1)).fill("deck")]},
      "Take "+BIRDS[s.tray[first]].name+" from tray","Cards"));
  }
  if(count%2===1){
    const source=allEntries(p).find(x=>x.eggs>0);
    if(source){
      list.push(item({type:"drawBirds",draws:Array(amount+1).fill("deck"),
        extra:true,eggSource:{habitat:source.habitat,index:source.index,count:1}},
      "Spend an egg to draw "+(amount+1)+" birds","Cards"));
    }
  }
  return list;
}
function birdActions(s,p) {
  const out=[];
  for(const id of p.hand){
    const bird=BIRDS[id];
    const payment=findFoodPayment(p.food,bird);
    if(!payment)continue;
    for(const habitat of bird.habitats){
      const column=p.habitats[habitat].length;
      if(column>=5)continue;
      const eggs=getEggPayment(p,EGG_COLUMN_COST[column]);
      if(!eggs)continue;
      out.push(item({type:"playBird",birdId:id,habitat,payment,eggs},
        "Play "+bird.name+" in "+habitat,"Bird"));
    }
  }
  return out;
}
export function candidateActions(s) {
  if(s.phase==="setup")return setupActions(s);
  if(s.phase==="power"){
    return powerChoices(s).map(x=>item(x.type==="skip"?
      {type:"power",skip:true}:
      {type:"power",choice:x.choice},
      x.label,x.type==="skip"?"Skip power":"Power"));
  }
  if(s.phase!=="play")return [];
  const p=s.players[s.currentPlayer];
  const all=[...birdActions(s,p),...foodActions(s,p),
    ...layActions(s,p),...drawActions(s,p)];
  // Collapse plans with identical complete action payloads.
  const seen=new Set();
  return all.filter(x=>{
    const key=JSON.stringify(x.action);
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
