/** Experimental bounded net-realization corrections; additive to practical-combined. */
import {BIRDS} from './catalog.js';
import {FOOD,HABITATS,allBirds,totalEggs,bonusPoints} from './scoring.js';
export const EFFICIENCY_EVALUATORS=Object.freeze(['engine-net-income','engine-saturation','shared-power-net','pink-event-model','predator-expectation','repeat-resource-cost','tuck-card-opportunity','feeder-access','late-conversion','phase-switch','robust-value','scarcity-portfolio']);
const sum=a=>a.reduce((x,y)=>x+y,0), clamp=(x,limit=7)=>Math.max(-limit,Math.min(limit,x));
const rounds=[8,7,6,5], columnEggs=[0,1,1,2,2];
const supply={6:['seed',3],16:['fruit',1],25:['invertebrate',1],29:['fish',3],40:['invertebrate',1],57:['fruit',1],60:['fish',1],63:['seed',1],66:['seed',1]};
const feeder={1:['seed'],15:['fish'],45:['invertebrate'],53:['invertebrate','fruit'],58:['invertebrate'],64:['seed','fruit']};
const sharedFood=new Set([16,40,60,63]), handTuck=new Set([4,27,32,35,62]);
const nest={54:'bowl',61:'cavity',67:'ground'}, pinkNest={2:'ground',18:'cavity',28:'bowl'};
const huntThreshold={17:75,42:100,46:50};
// Fixed original-catalog prior. No state deck or hidden-card identities consulted.
const predatorPrior=Object.fromEntries(Object.entries(huntThreshold).map(([c,n])=>[c,BIRDS.filter(b=>b.wingspan<n).length/BIRDS.length]));
const capacity=e=>Math.max(0,BIRDS[e.id].eggs-e.eggs);
const matches=(b,n)=>b.nest===n||b.nest==='wild';
function paymentCount(p,b){
 const total=sum(FOOD.map(f=>p.food[f]??0));
 if(b.either)return ((b.food.wild??0)>0&&total>0)||FOOD.some(f=>b.food[f]>0&&p.food[f]>0)?1:total>=2?2:Infinity;
 const covered=sum(FOOD.map(f=>Math.min(p.food[f]??0,b.food[f]??0)));
 const missing=sum(FOOD.map(f=>b.food[f]??0))-covered;
 const amount=covered+2*missing+(b.food.wild??0);return amount<=total?amount:Infinity;
}
function payable(p,b){
 const total=sum(FOOD.map(f=>p.food[f]??0));
 if(b.either)return total>=2||((b.food.wild??0)>0&&total>0)||FOOD.some(f=>b.food[f]>0&&p.food[f]>0);
 const covered=sum(FOOD.map(f=>Math.min(p.food[f]??0,b.food[f]??0)));
 const missing=sum(FOOD.map(f=>b.food[f]??0))-covered;
 return total-covered>=2*missing+(b.food.wild??0);
}
function projectedPlay(p,b,h){
 let owed=columnEggs[p.habitats[h].length];
 const habitats=Object.fromEntries(HABITATS.map(row=>[row,p.habitats[row].map(e=>{const used=Math.min(owed,e.eggs);owed-=used;return {...e,eggs:e.eggs-used};})]));
 habitats[h].push({id:b.id,eggs:0,tucked:[],cached:[]});
 const hand=[...p.hand];hand.splice(hand.indexOf(b.id),1);
 return {...p,habitats,hand};
}
export function efficiencyAdjustments(state,player){
 const out=Object.fromEntries(EFFICIENCY_EVALUATORS.map(k=>[k,0]));
 if(state.phase==='gameover')return out;
 const p=state.players[player], turns=Math.max(0,state.remaining[player])+sum(rounds.slice(state.round));
 if(!turns)return out;
 const birds=allBirds(p), others=state.players.filter((_,i)=>i!==player), hand=p.hand.map(id=>BIRDS[id]).filter(Boolean);
 const room=Math.min(state.eggSupply??75,sum(birds.map(capacity))), eggs=totalEggs(p), actions=Math.min(5,turns/3);
 const foodTotal=sum(FOOD.map(f=>p.food[f]??0));
 const demand=Object.fromEntries(FOOD.map(f=>[f,0]));
 for(const b of hand.filter(b=>b.habitats.some(h=>p.habitats[h].length<5)))for(const f of FOOD)demand[f]+=b.either?(b.food[f]>0?1/Math.max(1,FOOD.filter(k=>b.food[k]>0).length):0):b.food[f]??0;
 const foodValue=f=>Math.min(.85,.18+.55*Math.max(0,demand[f]-(p.food[f]??0))/Math.max(1,demand[f])+.12*Math.min(1,turns/8));
 const cardValue=Math.min(.7,.15+Math.max(0,3-p.hand.length)*.15);
 const knownFaces=(state.feeder??[]).filter(Boolean), refill=knownFaces.length===0;
 const feederCount=types=>refill?.5:knownFaces.filter(f=>types.includes(f)||(f==='dual'&&(types.includes('seed')||types.includes('invertebrate')))).length;
 const predator=c=>huntThreshold[c]?predatorPrior[c]:[7,10].includes(c)?1-Math.pow(5/6,Math.max(0,5-(state.feeder?.length??5))):0;
 // Preserve genuinely valuable retained birds when a hand tuck consumes a card.
 const retained=hand.map(b=>{
  let best=0;
  for(const h of b.habitats){const n=p.habitats[h].length;if(n>=5||!payable(p,b)||eggs<columnEggs[n])continue;
   const played=projectedPlay(p,b,h), bonus=sum(p.bonuses.map(id=>bonusPoints(id,played)-bonusPoints(id,p)));
   best=Math.max(best,b.points-columnEggs[n]+bonus-.65*paymentCount(p,b)-1.5);
  }
  return Math.max(0,best)*Math.min(1,turns/3);
 });
 const sacrificed=retained.length?Math.min(...retained):0;
 const cheapCards=retained.filter(x=>x<=1).length;
 function yieldFor(e,h){
  const c=BIRDS[e.id].powerCode;
  if(supply[c])return supply[c][1]*foodValue(supply[c][0]);
  if(feeder[c])return Math.min(c===15||c===58?5:1,feederCount(feeder[c]))*(c===1?1:Math.max(...feeder[c].map(foodValue)));
  if(c===31)return 1;
  if(c===30)return Math.min(1,capacity(e),state.eggSupply??75);
  if(c===14)return Math.min(1,room);
  if(nest[c])return Math.min(2,birds.filter(x=>matches(BIRDS[x.id],nest[c])&&capacity(x)>0).length,room);
  if(c===24||c===34)return 2*cardValue-(c===34?cardValue:0);
  if(c===3)return p.habitats.wetland.length===Math.min(...state.players.map(o=>o.habitats.wetland.length))?cardValue:0;
  if(c===21)return 0;
  if([56,59].includes(c))return cardValue;
  if(c===41)return eggs>0?Math.max(0,2*cardValue-1):0;
  if(c===5||c===33)return birds.some(x=>x!==e&&x.eggs>0)?Math.max(0,(c===33?2:1)*Math.max(...FOOD.map(foodValue))-1):0;
  if(handTuck.has(c))return p.hand.length?Math.max(0,1+(c===27?Math.min(1,capacity(e),state.eggSupply??75):c===4?cardValue:c===32?foodValue('fruit'):c===35?foodValue('seed'):Math.max(foodValue('seed'),foodValue('invertebrate')))-sacrificed):0;
  if([9,23,36].includes(c)){const f=c===23?'seed':'fish';return p.food[f]>0?2-foodValue(f):0;}
  return predator(c);
 }
 let net=0,saturation=0,shared=0,pink=0,hunting=0,repeat=0,tuckPenalty=0,access=0,pinkEggRoom=room;
 const rowValues={forest:0,grassland:0,wetland:0};
 for(const h of HABITATS){
  const row=p.habitats[h];let newCards=h==='wetland'?1+Math.floor(row.length/2):0;
  const available={...p.food};let availableEggs=eggs;
  for(let i=row.length-1;i>=0;i--){
   const e=row[i], b=BIRDS[e.id], c=b.powerCode;
   if(b.powerType==='pink'){
    const windows=Math.max(0,Math.min(4,turns*.5)-((p.pinkUsed??[]).includes(e.id)?1:0));
    let probability=0,unit=0;
    if(pinkNest[c]){probability=1-others.reduce((a,o)=>a*(1-Math.min(.8,.2+.12*o.habitats.grassland.length)),1);
     unit=Math.min(1,state.eggSupply??75,sum(birds.filter(x=>x!==e&&matches(BIRDS[x.id],pinkNest[c])).map(capacity)));
    }else if(c===19||c===39){const rowName=c===19?'wetland':'forest';probability=1-others.reduce((a,o)=>a*(o.habitats[rowName].length<5?.83:1),1);unit=foodValue(c===19?'fish':'invertebrate');}
    else if(c===22){probability=1-others.reduce((a,o)=>a*(1-Math.min(.7,sum(allBirds(o).map(x=>predator(BIRDS[x.id].powerCode)))*.22)),1);unit=Math.max(...FOOD.map(foodValue));}
    else if(c===55){probability=knownFaces.includes('rodent')?.25:.08;unit=1;}
    if(pinkNest[c]){const spaces=sum(birds.filter(x=>x!==e&&matches(BIRDS[x.id],pinkNest[c])).map(capacity));const realized=Math.min(pinkEggRoom,spaces,windows*probability*unit);pink+=realized;pinkEggRoom-=realized;}else pink+=windows*probability*unit;continue;
   }
   if(b.powerType!=='brown')continue;
   const y=yieldFor(e,h);net+=y;rowValues[h]+=y;
   if(supply[c]){const [f,n]=supply[c];available[f]=(available[f]??0)+n;const usable=Math.min(n,Math.max(0,demand[f]-(p.food[f]??0))+.35*Math.min(1,turns/8));saturation-=(n-usable)*.35;}
   if([24,34,56,59].includes(c)){newCards+=c===24?2:1;saturation-=Math.max(0,p.hand.length-turns)*.035;}
   if(nest[c]||c===30||c===14)saturation-=room===0?.6:0;
   if(handTuck.has(c)){
    const renewable=newCards>0;
    if(!renewable)tuckPenalty-=Math.max(0,sacrificed-(c===27?2:1.5))*Math.min(actions,Math.max(0,p.hand.length-cheapCards));
    if(newCards>0)newCards--;
    if(c===4&&p.hand.length+newCards>0)newCards++;
   }
   if(huntThreshold[c]||[7,10].includes(c))hunting+=predator(c)-.5;
   if(feeder[c])access+=y-(c===1?.6:.45);
   if(sharedFood.has(c))shared-=Math.max(...others.map(o=>sum(FOOD.map(f=>o.food[f]??0))<turns?foodValue(supply[c][0]):.15),0);
   if(c===59)shared-=cardValue;
   if(nest[c])shared-=Math.max(0,...others.map(o=>Math.min(1,state.eggSupply??75,allBirds(o).filter(x=>matches(BIRDS[x.id],nest[c])&&capacity(x)>0).length)));
   if(c===11)shared-=.4;
   if(c===43||c===49){
    const targets=row.filter((x,j)=>j!==i&&BIRDS[x.id].powerType==='brown'&&![43,49].includes(BIRDS[x.id].powerCode)&&(c===43||BIRDS[x.id].powerGroup==='hunting/fishing'));
    let best=0;
    for(const target of targets){const tc=BIRDS[target.id].powerCode;
     if([9,23,36].includes(tc)){const f=tc===23?'seed':'fish';best=Math.max(best,(available[f]??0)>=(row.indexOf(target)<i?2:1)?2-foodValue(f):0);}
     else if(tc===41)best=Math.max(best,availableEggs>=(row.indexOf(target)<i?2:1)?Math.max(0,2*cardValue-1):0);
     else if([5,33].includes(tc))best=Math.max(best,availableEggs>=(row.indexOf(target)<i?2:1)&&birds.some(x=>x!==target&&x.eggs>0)?Math.max(0,(tc===33?2:1)*Math.max(...FOOD.map(foodValue))-1):0);
     else best=Math.max(best,yieldFor(target,h));
    }
    repeat+=best-.65;
   }
   if([9,23,36].includes(c)){const f=c===23?'seed':'fish';available[f]=Math.max(0,(available[f]??0)-1);}
   if([5,33,41].includes(c))availableEggs=Math.max(0,availableEggs-1);
  }
 }
 out['engine-net-income']=clamp((net-birds.filter(e=>BIRDS[e.id].powerType==='brown').length*.45)*actions*.5);
 out['engine-saturation']=clamp(saturation*actions);
 out['shared-power-net']=clamp(shared*actions*.65);
 out['pink-event-model']=clamp(pink);
 out['predator-expectation']=clamp(hunting*actions);
 out['repeat-resource-cost']=clamp(repeat*actions);
 out['tuck-card-opportunity']=clamp(tuckPenalty);
 out['feeder-access']=clamp(access*Math.min(3,actions));
 const harvest=Math.min(room,2+Math.floor(p.habitats.grassland.length/2));
 let bestBird=0;const plans=[];
 for(const b of hand)for(const h of b.habitats){const n=p.habitats[h].length;if(n>=5||eggs<columnEggs[n]||!payable(p,b))continue;
  const played=projectedPlay(p,b,h),bonus=sum(p.bonuses.map(id=>bonusPoints(id,played)-bonusPoints(id,p)));
  const gross=b.points-columnEggs[n]+bonus,payment=paymentCount(p,b);
  bestBird=Math.max(bestBird,gross-payment*Math.max(...FOOD.map(foodValue)));plans.push({gross,payment});
 }
 // Explicit alternatives compete for one action; no sum of incompatible plans.
 const immediate=Math.max(harvest+rowValues.grassland,bestBird);
 out['late-conversion']=turns<=5?clamp((immediate-harvest)*.6-foodTotal*.035*Math.max(0,6-turns)):0;
 out['phase-switch']=clamp(turns>10?Math.max(rowValues.forest,rowValues.wetland)*Math.min(3,actions)*.4:turns>5?Math.max(...Object.values(rowValues))*.65:out['late-conversion']);
 // Two plausible realizations of the same alternatives: scarce conversions vs surplus.
 const usableStock=Math.min(foodTotal,sum(Object.values(demand)),turns*1.5);
 const scenario=(price,stockValue)=>Math.max(harvest+rowValues.grassland+usableStock*stockValue,...plans.map(q=>q.gross-q.payment*price+Math.max(0,usableStock-q.payment)*stockValue));
 const scarce=scenario(.85,.55),surplus=scenario(.25,.10);
 out['robust-value']=clamp((Math.min(scarce,surplus)-harvest)*.45);
 out['scarcity-portfolio']=clamp(.35*out['engine-saturation']+.35*out['shared-power-net']+.3*out['tuck-card-opportunity']+.35*out['robust-value']);
 return out;
}






