/** Bounded experimental corrections to practical-combined; no hidden-world reads. */
import {BIRDS} from './catalog.js';
import {FOOD,HABITATS,allBirds,totalEggs,bonusPoints,goalQuantity,roundGoalScores} from './scoring.js';
export const MECHANICS_EVALUATORS=Object.freeze(['ordered-engine','renewable-tucking','food-cache-economy','nest-network','pink-egg-income','pink-food-income','repeat-engine','goal-denial','goal-safe-lead','bonus-progress','late-bird-vs-eggs','adaptive-portfolio']);
const sum=xs=>xs.reduce((a,b)=>a+b,0), cap=(x,n=8)=>Math.max(-n,Math.min(n,x));
const rounds=[8,7,6,5], eggsCost=[0,1,1,2,2];
const tuck=new Set([4,27,32,35,62]), draw=new Set([3,21,24,34,56,59]);
const foodCodes={6:['seed',3],16:['fruit',1],25:['invertebrate',1],29:['fish',3],40:['invertebrate',1],57:['fruit',1],60:['fish',1],63:['seed',1],66:['seed',1]};
const nestCodes={54:'bowl',61:'cavity',67:'ground'};
const pinkNest={2:'ground',18:'cavity',28:'bowl'};
const matching=(b,n)=>b.nest===n||b.nest==='wild';
function payable(p,b){
  const stock=FOOD.map(f=>p.food[f]??0), total=sum(stock);
  if(b.either)return ((b.food.wild??0)>0&&total>0)||FOOD.some((f,i)=>b.food[f]>0&&stock[i]>0)||total>=2;
  const covered=sum(FOOD.map((f,i)=>Math.min(stock[i],b.food[f]??0)));
  const missing=sum(FOOD.map(f=>b.food[f]??0))-covered;
  return total-covered>=2*missing+(b.food.wild??0);
}
const cost=b=>b.either?1:sum(Object.values(b.food));
const room=e=>Math.max(0,BIRDS[e.id].eggs-e.eggs);
function powerYield(e,p){
 const c=BIRDS[e.id].powerCode;
 if(c===31)return 1;
 if(c===1)return .6;
 if([7,10,17,42,46].includes(c))return .45;
 if(c===4)return p.hand.length?1:0;
 if(tuck.has(c))return p.hand.length?(c===27?1+Math.min(1,sum(allBirds(p).map(room))):1.45):0;
 if(foodCodes[c])return .45*foodCodes[c][1];
 if(c===30)return Math.min(1,room(e));
 if(c===14)return Math.min(1,sum(allBirds(p).map(room)));
 if(nestCodes[c])return Math.min(2,allBirds(p).filter(x=>matching(BIRDS[x.id],nestCodes[c])&&room(x)>0).length);
 if(draw.has(c))return .5;
 return 0;
}
export function mechanicsAdjustments(state,player){
 const out=Object.fromEntries(MECHANICS_EVALUATORS.map(k=>[k,0]));
 if(state.phase==='gameover')return out;
 const p=state.players[player], birds=allBirds(p), hand=p.hand.map(id=>BIRDS[id]).filter(Boolean);
 const turns=Math.max(0,state.remaining[player])+sum(rounds.slice(state.round));
 if(turns===0)return out;
 const activations=Math.min(5,turns/3), capacity=Math.min(state.eggSupply??75,sum(birds.map(room)));
 let ordered=0,renewable=0,cache=0,nests=0,repeats=0;
 for(const h of HABITATS){
  const row=p.habitats[h]; let cards=h==='wetland'?1+Math.floor(row.length/2):0;
  const generated={};
  for(let i=row.length-1;i>=0;i--){
   const e=row[i], b=BIRDS[e.id], c=b.powerCode;
   if(b.powerType!=='brown')continue;
   if(draw.has(c))cards+=c===24?2:1;
   if(foodCodes[c]){const [f,n]=foodCodes[c];generated[f]=(generated[f]??0)+n;}
   if(tuck.has(c)){
    ordered+=cards>0?.65:-.25;
    if(c===4){if(cards>0||p.hand.length>0)renewable+=.8;}else if(cards>0){renewable+=c===27?1.1:.7;cards--;}
   }
   if([9,23,36].includes(c)){
    const f=c===23?'seed':'fish', supply=generated[f]??0;
    ordered+=supply>0?.8:0;
    cache+=supply>0?1.1:Math.min(1,(p.food[f]??0)/3)*.6;
    generated[f]=Math.max(0,supply-1);
   }
   if(c===31)cache+=1;
   if(c===1)cache+=(state.feeder??[]).some(f=>f==='seed'||f==='dual')?.65:.15;
   if(nestCodes[c])nests+=Math.min(2, birds.filter(x=>matching(BIRDS[x.id],nestCodes[c])&&room(x)>0).length)*.6;
   if(c===43||c===49){
    const options=row.filter((x,j)=>j!==i&&BIRDS[x.id].powerType==='brown'&&![43,49].includes(BIRDS[x.id].powerCode)&&(c!==49||BIRDS[x.id].powerGroup==='hunting/fishing'));
    repeats+=Math.max(0,...options.map(x=>powerYield(x,p)))*.7;
   }
  }
 }
 out['ordered-engine']=cap(ordered*activations);
 out['renewable-tucking']=cap(renewable*activations);
 out['food-cache-economy']=cap(cache*activations);
 out['nest-network']=cap(Math.min(capacity,nests*activations));
 let pinkEgg=0,pinkFood=0;
 for(const e of birds){
  const b=BIRDS[e.id], c=b.powerCode;if(b.powerType!=='pink')continue;
  // One trigger per own-turn interval, regardless of opponent count.
  const used=(p.pinkUsed??[]).includes(e.id)?1:0, windows=Math.max(0,Math.min(5,turns*.45)-used);
  if(pinkNest[c]){
   const spaces=sum(birds.filter(x=>x!==e&&matching(BIRDS[x.id],pinkNest[c])).map(room));
   pinkEgg+=Math.min(spaces,windows,state.eggSupply??75)*.6;
  }
  if([19,39,22,55].includes(c)){
   const activity=state.players.filter((_,i)=>i!==player).some(o=>c===22?allBirds(o).some(x=>BIRDS[x.id].powerGroup==='hunting/fishing'):c===55?(o.habitats.forest.length>0):o.habitats[c===19?'wetland':'forest'].length<5);
   pinkFood+=activity?windows*(c===55?.3:.22):0;
  }
 }
 out['pink-egg-income']=cap(pinkEgg);out['pink-food-income']=cap(pinkFood);
 out['repeat-engine']=cap(repeats*activations);
 const goal=state.goals?.[state.round-1]?.face;
 if(goal&&p.goalPoints.length<state.round){
  const awards=roundGoalScores(state.players,goal,state.round,state.goalMode), q=goalQuantity(p,goal);
  const opponents=state.players.map((x,i)=>i===player?-1:goalQuantity(x,goal));
  const nearest=Math.max(...opponents), urgency=1/(1+Math.max(0,state.remaining[player]-1));
  if(state.goalMode!=='blue'){
   // Exact public awards with this player's quantity removed isolates denial.
   const absent={...p,habitats:Object.fromEntries(HABITATS.map(h=>[h,[]]))};
   const without=roundGoalScores(state.players.map((x,i)=>i===player?absent:x),goal,state.round,'green');
   out['goal-denial']=cap(sum(without.map((v,i)=>i===player?0:v-awards[i]))*urgency,4);
   out['goal-safe-lead']=q>nearest?cap(awards[player]*Math.min(1,(q-nearest)/Math.max(1,state.remaining.filter((_,i)=>i!==player).reduce((a,b)=>Math.max(a,b),0)*2))*urgency,4):0;
  }
 }
 let progress=0,bestLate=0;
 const eggRate=Math.min(capacity,2+Math.floor(p.habitats.grassland.length/2));
 for(const b of hand){
  for(const h of b.habitats){
   const n=p.habitats[h].length;if(n>=5||!payable(p,b)||totalEggs(p)<eggsCost[n])continue;
   const projected={...p,hand:p.hand.filter(id=>id!==b.id),habitats:{...p.habitats,[h]:[...p.habitats[h],{id:b.id,eggs:0,cached:[],tucked:[]}]}};
   let owed=eggsCost[n];
   projected.habitats=Object.fromEntries(HABITATS.map(row=>[row,projected.habitats[row].map(e=>{const paid=Math.min(owed,e.eggs);owed-=paid;return {...e,eggs:e.eggs-paid};})]));
   const gain=sum(p.bonuses.map(id=>bonusPoints(id,projected)-bonusPoints(id,p)));
   progress=Math.max(progress,gain/(1+.25*cost(b)));
   bestLate=Math.max(bestLate,b.points-eggsCost[n]+gain-eggRate);
  }
 }
 out['bonus-progress']=cap(progress*Math.min(1,turns/3),5);
 out['late-bird-vs-eggs']=turns<=5?cap(bestLate*.6,5):0;
 // Select a concrete production specialty; average it with actionable cashout.
 const production=Math.max(out['renewable-tucking'],out['food-cache-economy'],out['nest-network'],out['repeat-engine']);
 out['adaptive-portfolio']=cap((turns>5?production*.6+out['ordered-engine']*.2:out['late-bird-vs-eggs']*.7)+out['bonus-progress']*.25+out['pink-egg-income']*.2);
 return out;
}



