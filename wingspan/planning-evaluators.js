/** Bounded actor-visible planning hypotheses; additive projected-point corrections. */
import {BIRDS} from './catalog.js';
import {FOOD,HABITATS,allBirds,bonusPoints,goalQuantity} from './scoring.js';
export const PLANNING_EVALUATORS=Object.freeze(['assignment-hand','matching-slots','food-demand-cap','food-opportunity','draw-option-value','discard-cost','egg-reserve-planning','egg-overflow','investment-break-even','two-bird-plan','goal-transition','bonus-two-step']);
const sum=a=>a.reduce((n,x)=>n+x,0),cap=(v,n=3)=>Math.max(-n,Math.min(n,v));
const output={forest:[1,1,2,2,3,3],grassland:[2,2,3,3,4,4],wetland:[1,1,2,2,3,3]},payments=[0,1,1,2,2];
const symbols=b=>b.either?1:sum(Object.values(b.food));
const stock=f=>sum(FOOD.map(k=>f[k]??0));
function pay(food,b){
 const f={...food};
 const take=k=>{if((f[k]??0)<1)return false;f[k]--;return true;};
 const pair=()=>{if(stock(f)<2)return false;for(let i=0;i<2;i++)take(FOOD.find(k=>f[k]>0));return true;};
 if(b.either){const k=FOOD.find(k=>(b.food[k]||b.food.wild)&&f[k]>0);if(k)take(k);else if(!pair())return null;return f;}
 let missing=0;
 for(const k of FOOD)for(let i=0;i<(b.food[k]??0);i++)if(!take(k))missing++;
 for(let i=0;i<(b.food.wild??0);i++){const k=FOOD.find(k=>f[k]>0);if(!k)return null;take(k);}
 for(let i=0;i<missing;i++)if(!pair())return null;
 return f;
}
const copy=p=>({...p,food:{...p.food},hand:[...p.hand],habitats:Object.fromEntries(HABITATS.map(h=>[h,p.habitats[h].map(e=>({...e}))]))});
const bonus=p=>sum(p.bonuses.map(id=>bonusPoints(id,p)));
function putEggs(p,count){
 const birds=allBirds(p);let laid=0;
 for(const floor of [1,Infinity])for(const e of birds){const n=Math.min(count,Math.max(0,Math.min(floor,BIRDS[e.id].eggs)-e.eggs));e.eggs+=n;count-=n;laid+=n;}
 return laid;
}
function play(plan,c){
 const p=copy(plan.p),row=p.habitats[c.h],b=BIRDS[c.id];if(row.length===5||!p.hand.includes(c.id))return null;
 let actions=plan.actions,supply=plan.supply,spent=0;
 // Gathering is favorably typed but every action and token is shared across plays.
 let paid=pay(p.food,b);
 while(!paid&&actions>1){
  const rate=output.forest[p.habitats.forest.length];
  for(let i=0;i<rate;i++){
   const k=b.either?FOOD.find(k=>b.food[k]>0)??'seed':FOOD.find(k=>(p.food[k]??0)<(b.food[k]??0))??'seed';p.food[k]++;
  }
  actions--;spent++;paid=pay(p.food,b);
 }
 if(!paid)return null;
 const eggPayment=payments[row.length];let eggs=sum(allBirds(p).map(e=>e.eggs));
 while(eggs<eggPayment&&actions>1){const laid=putEggs(p,Math.min(supply,output.grassland[p.habitats.grassland.length]));if(!laid)return null;supply-=laid;eggs+=laid;actions--;spent++;}
 if(eggs<eggPayment||actions<1)return null;
 let due=eggPayment;for(const e of allBirds(p).sort((a,b)=>b.eggs-a.eggs)){const use=Math.min(due,e.eggs);e.eggs-=use;due-=use;}
 supply+=eggPayment;p.food=paid;p.hand.splice(p.hand.indexOf(c.id),1);row.push({id:c.id,eggs:0,cached:[],tucked:[]});actions--;spent++;
 return {p,actions,supply,used:plan.used+spent,ids:[...plan.ids,c.id],pointGain:plan.pointGain+b.points-eggPayment+(eggs-sum(allBirds(plan.p).map(e=>e.eggs))),foodSpent:plan.foodSpent+stock(plan.p.food)-stock(paid)};
}
export function planningPortfolio(state,player){
 const p=state.players[player],T=state.phase==='gameover'?0:Math.max(0,state.remaining[player])+sum([8,7,6,5].slice(state.round));
 const initial={p,actions:T,supply:Math.max(0,state.eggSupply??75),used:0,ids:[],pointGain:0,foodSpent:0};
 const options=p.hand.flatMap((id,index)=>BIRDS[id].habitats.filter(h=>p.habitats[h].length<5).map(h=>({id,index,h})))
 .sort((a,b)=>(BIRDS[b.id].points-.7*symbols(BIRDS[b.id]))-(BIRDS[a.id].points-.7*symbols(BIRDS[a.id]))||a.index-b.index||HABITATS.indexOf(a.h)-HABITATS.indexOf(b.h)).slice(0,6);
 const singles=options.map(c=>play(initial,c)).filter(Boolean),pairs=[];
 for(const first of singles)for(const c of options){const second=play(first,c);if(second)pairs.push(second);}
 return {T,options,singles,pairs};
}
export function planningAdjustments(state,player){
 const a=Object.fromEntries(PLANNING_EVALUATORS.map(k=>[k,0]));if(state.phase==='gameover')return a;
 const p=state.players[player],{T,options,singles,pairs}=planningPortfolio(state,player);if(!T)return a;
 const birds=allBirds(p),room=sum(birds.map(e=>BIRDS[e.id].eggs-e.eggs)),eggs=sum(birds.map(e=>e.eggs));
 const slots=15-birds.length,food=stock(p.food),rate=output.grassland[p.habitats.grassland.length];
 const scorePlan=q=>q.pointGain-.65*q.used;
 const bestOne=Math.max(0,...singles.map(scorePlan)),bestTwo=Math.max(bestOne,...pairs.map(scorePlan));
 const perCard=new Map();for(const q of singles)perCard.set(q.ids[0],Math.max(perCard.get(q.ids[0])??0,scorePlan(q)));
 const ordered=[...perCard.values()].sort((a,b)=>b-a);
 a['assignment-hand']=cap(.3*(bestTwo-Math.max(0,ordered[0]??0)-Math.max(0,ordered[1]??0)));
 // Bipartite matching to actual individual open slots, rather than total slots.
 const open=HABITATS.flatMap(h=>Array.from({length:5-p.habitats[h].length},()=>h)),assigned=[];
 const match=(index,seen)=>{for(let j=0;j<open.length;j++)if(!seen.has(j)&&BIRDS[p.hand[index]].habitats.includes(open[j])){seen.add(j);if(assigned[j]===undefined||match(assigned[j],seen)){assigned[j]=index;return true;}}return false;};
 let matched=0;for(let i=0;i<Math.min(10,p.hand.length);i++)if(match(i,new Set()))matched++;
 a['matching-slots']=cap(.5*(matched-Math.min(10,p.hand.length,slots)));
 const demand=Math.max(0,...[...singles,...pairs].map(q=>Math.max(0,food-stock(q.p.food))));
 a['food-demand-cap']=-Math.min(3,.18*Math.max(0,food-demand));
 const gaps=options.map(c=>{const b=BIRDS[c.id],matching=sum(FOOD.map(f=>Math.min(p.food[f]??0,b.food[f]??0)));return Math.max(0,symbols(b)-matching);});
 a['food-opportunity']=cap(.45*options.reduce((best,c,i)=>Math.max(best,gaps[i]===1?Math.max(0,BIRDS[c.id].points-payments[p.habitats[c.h].length])/(2+symbols(BIRDS[c.id])):0),0),2);
 // Fixed every-fifth catalogue prior; no actual deck contents or order accessed.
 const prior=BIRDS.filter((_,i)=>i%5===0).map(b=>b.habitats.some(h=>p.habitats[h].length<5)?Math.max(0,b.points-.6*symbols(b))/(2+Math.max(0,symbols(b)-food)):0);
 const mean=sum(prior)/prior.length;
 a['draw-option-value']=cap(.4*Math.max(0,mean-bestOne)*Math.min(1,slots/4)*Math.min(1,T/6),2);
 const dead=p.hand.filter(id=>!BIRDS[id].habitats.some(h=>p.habitats[h].length<5));
 const tuck=birds.filter(e=>[4,27,32,35,50,62].includes(BIRDS[e.id].powerCode)&&BIRDS[e.id].powerType==='brown').length;
 a['discard-cost']=cap(Math.min(dead.length,Math.min(3,tuck*T/3))*.4+(p.habitats.forest.length%2?Math.min(dead.length,Math.max(0,3-food))*.2:0),2);
 const minPayment=Math.min(2,...options.map(c=>payments[p.habitats[c.h].length]));
 a['egg-reserve-planning']=options.length?cap(.4*Math.min(eggs,minPayment)+.2*Math.min(room,Math.max(0,minPayment-eggs))-.3*Math.max(0,minPayment-eggs-room),2):0;
 const eggPowers=birds.filter(e=>[12,14,26,28,30,52,54,61,65,67].includes(BIRDS[e.id].powerCode)&&BIRDS[e.id].powerType==='brown').length;
 a['egg-overflow']=-Math.min(3,.25*Math.max(0,Math.min(6,T/3)*(rate+eggPowers)-Math.min(room,state.eggSupply??75)));
 a['investment-break-even']=cap(.35*Math.max(0,...singles.map(q=>{
  const b=BIRDS[q.ids[0]],c=b.powerCode;
  let income=0;
  if(b.powerType==='brown'){
   if([1,31,7,10,17,42,46].includes(c))income=c===31?.85:.55;
   if([4,27,32,35,50,62].includes(c))income=Math.min(1,q.p.hand.length/3)*.65;
   if([9,23,36].includes(c))income=Math.min(1,q.p.food[c===23?'seed':'fish']??0)*1.1;
   if([12,14,26,28,30,52,54,61,65,67].includes(c))income=Math.min(1,sum(allBirds(q.p).map(e=>BIRDS[e.id].eggs-e.eggs)))*.7;
  }
  return Math.max(0,Math.min(5,q.actions/3)*income-q.used*.5);
 })),2);
 a['two-bird-plan']=cap(.35*Math.max(0,bestTwo-bestOne),3);
 const current=state.goals[state.round-1]?.face,next=state.goals[state.round]?.face;
 a['goal-transition']=current&&next?cap(.3*Math.max(0,...[...singles,...pairs].map(q=>Math.max(0,goalQuantity(q.p,next)-goalQuantity(p,next))-.5*Math.max(0,goalQuantity(p,current)-goalQuantity(q.p,current))))*Math.min(1,T/8),2):0;
 const baseBonus=bonus(p),oneBonus=Math.max(0,...singles.map(q=>bonus(q.p)-baseBonus));
 a['bonus-two-step']=cap(.55*Math.max(0,...pairs.map(q=>bonus(q.p)-baseBonus-oneBonus)),3);
 return a;
}
