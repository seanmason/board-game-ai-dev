/** Bounded round-one candidate diversity and concrete two-placement options. */
import {BIRDS,BONUSES} from './catalog.js';
import {FOOD,HABITATS,allBirds,totalEggs,bonusPoints} from './scoring.js';
import {findFoodPayment,RESOURCE_PROGRESSION,EGG_COLUMN_COST} from './core.js';
const cap=(n,max)=>Math.max(0,Math.min(max,n));
const stock=p=>Object.fromEntries(FOOD.map(f=>[f,Math.min(6,p.food[f]??0)]));
const debit=(food,payment)=>{const next={...food};for(const f of payment)next[f]--;return next;};
function access(food,b){
 const direct=findFoodPayment(food,b);if(direct)return {payment:direct,gathers:0,food};
 for(const f of FOOD){const next={...food,[f]:food[f]+1},payment=findFoodPayment(next,b);if(payment)return {payment,gathers:1,food:next};}
 return null;
}
function production(b){
 if(b.powerType==='pink')return .25;
 if(b.powerType!=='brown')return 0;
 if([25,57,66,31].includes(b.powerCode))return .65;
 if([4,34,56].includes(b.powerCode))return .45;
 if([14,30].includes(b.powerCode))return .5;
 if([16,40,59,60,63].includes(b.powerCode))return .2;
 return .15;
}
const quality=b=>.23*b.points+.07*b.eggs+production(b);
function bestPlan(p,supply=75){
 const food=stock(p),eggs=totalEggs(p),rowSize=Object.fromEntries(HABITATS.map(h=>[h,p.habitats[h].length]));
 let best={score:0,first:null,immediate:false,near:false,pair:false,habitat:null};
 for(const id of p.hand){const b=BIRDS[id];if(!b)continue;const a=access(food,b);if(!a)continue;
  for(const h of b.habitats){const n=rowSize[h];if(n>=5)continue;const eggCost=EGG_COLUMN_COST[n],missing=Math.max(0,eggCost-eggs);
   const room=Math.min(supply,allBirds(p).reduce((v,e)=>v+Math.max(0,BIRDS[e.id].eggs-e.eggs),0));
   if(missing>room)continue;
   const eggActions=missing?1:0,delay=1+a.gathers+eggActions;
   let score=quality(b)/delay,paired=false;
   const after=debit(a.food,a.payment);
   for(const secondId of p.hand){if(secondId===id)continue;const second=BIRDS[secondId],other=access(after,second);if(!other)continue;
    for(const h2 of second.habitats){const m=rowSize[h2]+(h2===h?1:0);if(m>=5)continue;
     const secondEgg=EGG_COLUMN_COST[m],remainingEggs=Math.max(0,eggs-eggCost);
     const deficit=Math.max(0,secondEgg-remainingEggs);
     if(deficit>Math.min(supply+eggCost,room+b.eggs))continue;
     const secondDelay=1+other.gathers+(deficit?1:0);
     const unlock=RESOURCE_PROGRESSION[h2][m+1]-RESOURCE_PROGRESSION[h2][m];
     const pairScore=quality(b)/delay+.45*(quality(second)+.45*unlock)/(delay+secondDelay);
     if(pairScore>score){score=pairScore;paired=true;}
    }
   }
   if(score>best.score)best={score,first:id,immediate:a.gathers===0&&eggActions===0,near:a.gathers===1,pair:paired,habitat:h};
  }
 }
 return best;
}
const actionKey=a=>JSON.stringify([a.bonusId,[...a.keep].sort((a,b)=>a-b),[...a.foodDiscard].sort()]);
/** Retain supplied candidates; add ranked diverse alternatives up to 24 total. */
export function openingSetupActions(state,existingActions){
 if(state.phase!=='setup')return [...existingActions];
 const p=state.players[state.currentPlayer];
 // Original setup has five known cards and five distinct starting foods.
 if(p.hand.length!==5||p.hand.some(id=>!BIRDS[id]))return [...existingActions];
 const result=[...existingActions],seen=new Set(existingActions.filter(x=>x.action?.type==='setup').map(x=>actionKey(x.action)));
 const alternatives=[];
 for(let mask=0;mask<32;mask++){
  const keep=p.hand.filter((_,i)=>mask&(1<<i));
  for(let foods=0;foods<32;foods++){
   const foodDiscard=FOOD.filter((_,i)=>foods&(1<<i));if(foodDiscard.length!==keep.length)continue;
   const food={...p.food};for(const f of foodDiscard)food[f]--;
   if(FOOD.some(f=>food[f]<0))continue;
   const plan=bestPlan({...p,hand:keep,food},state.eggSupply??75);
   for(const bonusId of p.bonusOffer){
    const action={type:'setup',keep:[...keep],foodDiscard:[...foodDiscard],bonusId};if(seen.has(actionKey(action)))continue;
    const projected={...p,hand:keep,food,bonuses:[bonusId]};
    // Exact current objective value is usually zero; hand-count bonuses differ.
    const score=plan.score+.12*bonusPoints(bonusId,projected)-.025*keep.length;
    alternatives.push({action,label:'Opening plan: keep '+keep.length+'; '+BONUSES[bonusId].name,category:'Setup',score,plan});
   }
  }
 }
 alternatives.sort((a,b)=>b.score-a.score||actionKey(a.action).localeCompare(actionKey(b.action)));
 const add=x=>{if(result.length>=24||seen.has(actionKey(x.action)))return;seen.add(actionKey(x.action));result.push({action:x.action,label:x.label,category:x.category});};
 // Reserve alternatives for each first bird, then habitat and plan family.
 for(const id of p.hand){const x=alternatives.find(x=>x.plan.first===id&&x.plan.immediate);if(x)add(x);}
 for(const h of HABITATS){const x=alternatives.find(x=>x.plan.habitat===h);if(x)add(x);}
 for(const key of ['immediate','near','pair']){const x=alternatives.find(x=>x.plan[key]);if(x)add(x);}
 for(const bonusId of p.bonusOffer){const x=alternatives.find(x=>x.action.bonusId===bonusId);if(x)add(x);}
 for(const x of alternatives){if(result.length>=24)break;add(x);}
 return result;
}
/** Small nonnegative additive estimate, expiring smoothly within round one. */
export function openingAdjustment(state,player){
 if(state.phase==='gameover'||state.round!==1)return 0;
 const p=state.players[player];if(state.phase==='setup'&&!p.setupDone)return 0;
 const fade=cap(state.remaining[player],8)/8;if(!fade)return 0;
 const plan=bestPlan(p,state.eggSupply??75);
 const installed=cap(allBirds(p).map(e=>quality(BIRDS[e.id])).sort((a,b)=>b-a).slice(0,2).reduce((n,q)=>n+.7*q,0),2);
 return cap((cap(plan.score*.35,1)+installed)*fade,3);
}


