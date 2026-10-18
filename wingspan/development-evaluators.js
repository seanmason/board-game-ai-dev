/** Additive, bounded development hypotheses; no hidden deck or rival hand access. */
import {BIRDS,BONUSES} from './catalog.js';
import {FOOD,HABITATS,allBirds,bonusPoints} from './scoring.js';
export const DEVELOPMENT_EVALUATORS=Object.freeze([
 'forest-foundation','wetland-foundation','grassland-foundation','balanced-development',
 'unlock-payback','conversion-options','cheap-bird-tempo','white-power-payback',
 'bonus-card-option','tray-opportunity','hand-flexibility','slot-scarcity'
]);
const sum=a=>a.reduce((n,x)=>n+x,0);
const outputs={forest:[1,1,2,2,3,3],grassland:[2,2,3,3,4,4],wetland:[1,1,2,2,3,3]};
const eggCost=[0,1,1,2,2],rounds=[8,7,6,5];
const clamp=(n,cap=4)=>Math.max(0,Math.min(cap,n));
const symbols=b=>b.either?1:sum(Object.values(b.food));
function deficit(food,b){
 const stock=sum(FOOD.map(f=>food[f]??0));
 if(b.either)return (stock&&(b.food.wild||FOOD.some(f=>b.food[f]&&(food[f]??0))))?0:Math.max(0,1-Math.floor(stock/2));
 const matched=sum(FOOD.map(f=>Math.min(food[f]??0,b.food[f]??0)));
 const wild=Math.min(b.food.wild??0,stock-matched);
 return Math.max(0,symbols(b)-matched-wild-Math.floor((stock-matched-wild)/2));
}
export function developmentAdjustments(state,player){
 const result=Object.fromEntries(DEVELOPMENT_EVALUATORS.map(k=>[k,0]));
 if(state.phase==='gameover')return result;
 const p=state.players[player],birds=allBirds(p),T=Math.max(0,state.remaining[player])+sum(rounds.slice(state.round));
 if(!T)return result;
 const lengths=Object.fromEntries(HABITATS.map(h=>[h,p.habitats[h].length]));
 const food=sum(FOOD.map(f=>p.food[f]??0)),eggs=sum(birds.map(e=>e.eggs));
 const room=sum(birds.map(e=>BIRDS[e.id].eggs-e.eggs)),supply=Math.max(0,state.eggSupply??75),slots=15-birds.length;
 const horizon=Math.min(6,T/3),candidates=[];
 const candidatesFor=(id,draw=0)=>{
  const b=BIRDS[id];if(!b)return [];
  const need=deficit(p.food,b);
  return b.habitats.filter(h=>lengths[h]<5).map(h=>{
   const payment=eggCost[lengths[h]],missing=Math.max(0,payment-eggs);
   const delay=draw+1+Math.ceil(need/outputs.forest[lengths.forest])+Math.ceil(missing/outputs.grassland[lengths.grassland]);
   return {id,b,h,need,payment,delay,feasible:delay<=T&&missing<=Math.min(room,supply)};
  }).filter(c=>c.feasible);
 };
 for(const id of p.hand)candidates.push(...candidatesFor(id));
 const best=fn=>Math.max(0,...candidates.map(fn));
 // Foundations value row setup only when its output has a concrete visible sink.
 const foodDemand=Math.max(0,sum(p.hand.map(id=>symbols(BIRDS[id])))-food);
 const cardDemand=Math.max(0,Math.min(slots,T/3)-p.hand.length);
 const eggDemand=Math.min(room,supply);
 const demands={forest:foodDemand,wetland:cardDemand,grassland:eggDemand};
 const prices={forest:.5,wetland:.6,grassland:.85};
 for(const h of HABITATS){
  const n=lengths[h];
  const currentUseful=Math.min(demands[h],outputs[h][n]*horizon);
  const setup=n===1?.6:n===0?.25:0;
  result[h+'-foundation']=clamp(.4*prices[h]*currentUseful*(setup+Math.max(0,outputs[h][n]-outputs[h][0])*.35),3);
 }
 const rowPresence=HABITATS.map(h=>Math.min(2,lengths[h]));
 result['balanced-development']=clamp(Math.min(...rowPresence)*.5+.25*(Math.cbrt(rowPresence.reduce((n,x)=>n*(x+1),1))-1),2)*Math.min(1,T/10);
 // Real output jump after one affordable bird, amortized over the payoff horizon.
 result['unlock-payback']=clamp(.65*best(c=>{
  const jump=outputs[c.h][lengths[c.h]+1]-outputs[c.h][lengths[c.h]];
  const uses=Math.min(6,Math.max(0,T-c.delay)/3);
  return Math.min(demands[c.h],jump*uses)*prices[c.h]/c.delay;
 }));
 // Odd columns permit one card->food, food->egg, or egg->card conversion.
 const disposable=Math.max(0,p.hand.length-Math.min(slots,T/3));
 const extraFood=lengths.forest%2?Math.min(disposable,foodDemand,horizon)*.35:0;
 const extraEggs=lengths.grassland%2?Math.min(food,Math.max(0,eggDemand-outputs.grassland[lengths.grassland]),horizon)*.45:0;
 const extraCards=lengths.wetland%2?Math.min(eggs,cardDemand,horizon)*.25:0;
 result['conversion-options']=clamp(extraFood+extraEggs+extraCards,3);
 // Reward one inexpensive play's saved actions, never every hand card's points.
 result['cheap-bird-tempo']=clamp(.5*best(c=>Math.max(0,3-c.delay)*Math.min(1,(T-c.delay)/4)*(c.b.points+.3*c.b.eggs-c.payment)/(2+symbols(c.b))),3);
 const whiteBenefit=c=>{
  const code=c.b.powerCode;if(c.b.powerType!=='white')return 0;
  if(code===6||code===29)return Math.min(3,foodDemand)*.4;
  if(code===8||code===24)return Math.min(2,cardDemand)*.55;
  if(code===15||code===58){const f=code===15?'fish':'invertebrate';return Math.min(foodDemand,state.feeder.filter(x=>x===f||(f==='invertebrate'&&x==='dual')).length)*.4;}
  if([12,26,52,65].includes(code)){
   const nest={12:'cavity',26:'ground',52:'platform',65:'bowl'}[code];
   const targets=birds.filter(e=>[nest,'wild'].includes(BIRDS[e.id].nest)&&e.eggs<BIRDS[e.id].eggs).length+([nest,'wild'].includes(c.b.nest)?1:0);
   return Math.min(targets,room+c.b.eggs+c.payment,supply+c.payment)*.7;
  }
  if([37,38,44,51].includes(code)){
   const allowed={37:['forest'],38:['grassland'],44:['wetland'],51:['forest','grassland']}[code];
   // Extra bird pays normal food and column eggs; restrict to zero-food first
   // birds and a currently affordable second bird to avoid reusing payment stock.
   if(symbols(c.b)!==0)return 0;
   const second=candidates.filter(d=>d.id!==c.id&&allowed.includes(d.h)&&d.delay===1&&eggs>=c.payment+d.payment+(d.h===c.h&&lengths[d.h]===0?1:0));
   return Math.min(1,second.length)*.8;
  }
  return 0;
 };
 result['white-power-payback']=clamp(.65*best(c=>whiteBenefit(c)/Math.sqrt(c.delay)),3);
 // Uniform catalogue prior for two bonus options, not the actual hidden bonus deck.
 const optionValue=()=>{
  const values=BONUSES.filter(b=>!p.bonuses.includes(b.id)).map(b=>bonusPoints(b.id,p)).sort((a,b)=>a-b);
  const n=values.length;return n?sum(values.map((v,i)=>v*(2*i+1)/(n*n))):0;
 };
 if(candidates.some(c=>c.b.powerType==='white'&&c.b.powerCode===13))result['bonus-card-option']=clamp(.5*best(c=>c.b.powerCode===13?optionValue()/Math.sqrt(c.delay):0),3);
 const trayCandidates=(state.tray??[]).filter(id=>id!==null).flatMap(id=>candidatesFor(id,1));
 const trayBest=Math.max(0,...trayCandidates.map(c=>Math.max(0,c.b.points-c.payment-.5*symbols(c.b))/c.delay));
 const ownBest=best(c=>Math.max(0,c.b.points-c.payment-.5*symbols(c.b))/c.delay);
 result['tray-opportunity']=clamp(.65*Math.max(0,trayBest-ownBest)*Math.min(1,slots/3),3);
 const covered=new Set(candidates.map(c=>c.h)).size;
 const affordable=new Set(candidates.filter(c=>c.delay<=2).map(c=>c.id)).size;
 result['hand-flexibility']=clamp(.3*Math.max(0,covered-1)*Math.min(3,affordable)*Math.min(1,T/8),2);
 // Full slots destroy placement options; avoid inflating a hand trapped in full rows.
 const stranded=p.hand.filter(id=>BIRDS[id].habitats.every(h=>lengths[h]===5));
 const restricted=p.hand.filter(id=>BIRDS[id].habitats.filter(h=>lengths[h]<5).length===1);
 result['slot-scarcity']=-Math.min(3,(stranded.length*.55+restricted.length*.12)*Math.min(1,T/6));
 return result;
}
