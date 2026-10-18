/** Fast deterministic leaf estimates in projected score points; see methods note. */
import {PLANNING_EVALUATORS,planningAdjustments} from './planning-evaluators.js';
import {EFFICIENCY_EVALUATORS,efficiencyAdjustments} from './efficiency-evaluators.js';
import {BIRDS} from './catalog.js';
import {DEVELOPMENT_EVALUATORS,developmentAdjustments} from './development-evaluators.js';
import {MECHANICS_EVALUATORS,mechanicsAdjustments} from './mechanics-evaluators.js';
import {FOOD,HABITATS,allBirds,scorePlayer,bonusPoints,roundGoalScores} from './scoring.js';

export const DIVERSE_EVALUATORS=Object.freeze([
  'bonus-threshold','round-race','future-goals','egg-liquidity',
  'capacity-investment','typed-food','hand-quality','row-unlocks',
  'power-synergy','endgame-cashout','opponent-tempo','strategic-blend'
]);
export const LEAF_EVALUATORS=Object.freeze([
  'points-only','remaining-turns','engine-income','goal-aware',
  'practical-combined','usable-resources','conservative','habitat-productivity',
  'action-budget-planner','bottleneck-engine','phase-calibrated',
  'habitat-specialist','investment-payback','specialist-payback',...DIVERSE_EVALUATORS,
  ...DEVELOPMENT_EVALUATORS,...MECHANICS_EVALUATORS,...PLANNING_EVALUATORS,...EFFICIENCY_EVALUATORS
]);
const sum=a=>a.reduce((n,x)=>n+x,0);
const progression={forest:[1,1,2,2,3,3],grassland:[2,2,3,3,4,4],wetland:[1,1,2,2,3,3]};
const rounds=[8,7,6,5];
export function remainingActions(state,player){
  return state.phase==='gameover'?0:Math.max(0,state.remaining[player])+sum(rounds.slice(state.round));
}
const cost=b=>b.either?1:sum(Object.values(b.food));
function features(state,player){
  const p=state.players[player],birds=allBirds(p),turns=remainingActions(state,player);
  const food=sum(FOOD.map(f=>p.food[f]??0));
  const room=sum(birds.map(e=>BIRDS[e.id].eggs-e.eggs));
  const slots=15-birds.length;
  const hand=p.hand.map(id=>BIRDS[id]).filter(b=>b.habitats.some(h=>p.habitats[h].length<5));
  // No exact payment search: typed deficits include the usual 2:1 conversion.
  const access=b=>{
    const typed=FOOD.map(f=>Math.min(p.food[f]??0,b.food[f]));
    const covered=sum(typed);
    const missing=b.either?Math.max(0,1-covered):Math.max(0,cost(b)-covered);
    return Math.min(1,(food-covered)/(2*Math.max(1,missing))+(missing===0?1:0));
  };
  const plays=Math.min(slots,hand.length,turns/2.5);
  const handValue=hand.map(b=>(Math.max(0,b.points-.6*cost(b)-.8))*(.35+.65*access(b)))
    .sort((a,b)=>b-a).slice(0,Math.ceil(plays));
  const usableHand=sum(handValue)*Math.min(1,plays/Math.max(1,handValue.length));
  const demand=Math.min(turns*1.2,sum(hand.map(cost)),plays*3);
  const usableFood=Math.min(food,demand)*.55;
  const productive=HABITATS.reduce((n,h)=>{
    const output=progression[h][p.habitats[h].length];
    const value=h==='grassland'?Math.min(output,room)*.85:
      h==='forest'?Math.min(output,Math.max(0,demand-food))*.48:
        Math.min(output,Math.max(0,slots-hand.length))*.55;
    return n+value;
  },0)*turns/3;
  const activation=turns/3;
  const engine=sum(birds.map(e=>{
    const b=BIRDS[e.id],c=b.powerCode;
    if(!['brown','pink'].includes(b.powerType))return 0;
    const foodUseful=Math.min(1,Math.max(0,demand-food)/Math.max(1,turns));
    const eggUseful=Math.min(1,room/Math.max(1,turns));
    let value=0;
    if([1,31,55].includes(c))value=c===1?.55: .85; // caches
    if([7,10,17,42,46].includes(c))value=c===42?.7:c===46?.4:.55;
    if([9,23,36].includes(c))value=Math.min(1,p.food[c===23?'seed':'fish'])*1.1;
    if([4,27,32,35,50,62].includes(c))value=Math.min(1,p.hand.length/3)*(.65+(c===27?.5*eggUseful:0));
    if([2,12,14,18,26,28,30,52,54,61,65,67].includes(c)){
      const nest={2:'ground',12:'cavity',18:'cavity',26:'ground',28:'bowl',52:'platform',54:'bowl',61:'cavity',65:'bowl',67:'ground'}[c];
      const targets=c===30?[e]:birds.filter(x=>x!==e||![2,18].includes(c));
      const eligible=targets.filter(x=>!nest||[nest,'wild'].includes(BIRDS[x.id].nest));
      value=Math.min([12,26,52,65].includes(c)?eligible.length:1,
        sum(eligible.map(x=>BIRDS[x.id].eggs-x.eggs)))*eggUseful;
    }
    if([3,21,24,34,41,56,59].includes(c))value=(c===24?.9:c===21?.2:.5)*Math.min(1,slots/5)*Math.max(0,1-p.hand.length/10);
    if([5,11,15,16,19,22,25,29,33,39,40,45,48,53,57,58,60,63,64,66].includes(c))
      value=([29,33].includes(c)?.9:.55)*foodUseful;
    // Repeat/move/extraneous play powers are deliberately assigned no generic income.
    return value*activation*(b.powerType==='pink'?.4:1);
  }));
  const currentGoal=p.goalPoints.length<state.round&&state.goals[state.round-1]?
    roundGoalScores(state.players,state.goals[state.round-1].face,state.round,state.goalMode)[player]*.65:0;
  const bonusGrowth=Math.min(plays,2)*Math.max(0,...hand.flatMap(b=>{
    const h=b.habitats.find(h=>p.habitats[h].length<5);
    const hypothetical={...p,habitats:{...p.habitats,[h]:[...p.habitats[h],{id:b.id,eggs:0,cached:[],tucked:[]}]}};
    return [sum(p.bonuses.map(id=>bonusPoints(id,hypothetical)-bonusPoints(id,p)))];
  }))*.35;
  return {turns,room,food,hand:p.hand.length,engine,productive,usableHand,usableFood,currentGoal,bonusGrowth};
}
// A small greedy arithmetic projection: every play, gathering action and final
// egg action spends the same budget. No hypothetical game states are searched.
export function actionBudgetProjection(state,player){
  const p=state.players[player],turns=remainingActions(state,player);
  let actions=turns,food=sum(FOOD.map(f=>p.food[f]??0));
  let eggs=sum(allBirds(p).map(e=>e.eggs));
  let room=sum(allBirds(p).map(e=>BIRDS[e.id].eggs-e.eggs));
  const lengths=Object.fromEntries(HABITATS.map(h=>[h,p.habitats[h].length]));
  let gain=0,plays=0;
  const cards=p.hand.map(id=>BIRDS[id]).sort((a,b)=>b.points-a.points||a.id-b.id);
  for(const b of cards){
    const h=b.habitats.filter(h=>lengths[h]<5).sort((a,b)=>lengths[a]-lengths[b])[0];
    if(!h)continue;
    const payment=[0,1,1,2,2][lengths[h]],needEgg=Math.max(0,payment-eggs);
    const eggActions=Math.ceil(needEgg/progression.grassland[lengths.grassland]);
    if(needEgg>room)continue;
    const foodActions=Math.ceil(Math.max(0,cost(b)-food)/progression.forest[lengths.forest]);
    const spend=1+foodActions+eggActions;
    // Compare against immediately available egg scoring before committing.
    if(spend>actions||b.points-payment<=Math.min(room,spend*progression.grassland[lengths.grassland]))continue;
    food+=foodActions*progression.forest[lengths.forest]-cost(b);
    const laid=Math.min(room,eggActions*progression.grassland[lengths.grassland]);
    eggs+=laid-payment;room+=payment-laid+b.eggs;
    actions-=spend;gain+=b.points+laid-payment;lengths[h]++;plays++;
  }
  gain+=Math.min(room,actions*progression.grassland[lengths.grassland]);
  return {gain,plays,actionsUsed:turns-actions,eggActions:actions};
}

export function bottleneckIncome(state,player,f=features(state,player)){
  const p=state.players[player],birds=allBirds(p),activation=f.turns/3;
  let foodDemand=0,cardDemand=0,eggDemand=0;
  for(const e of birds){
    const b=BIRDS[e.id];
    if(!['brown','pink'].includes(b.powerType))continue;
    const n=activation*(b.powerType==='pink'?.4:1),c=b.powerCode;
    if([9,23,36].includes(c))foodDemand+=n;
    if([4,27,32,35,50,62].includes(c))cardDemand+=n;
    if([2,12,14,18,26,28,30,52,54,61,65,67].includes(c)){
      const nest={2:'ground',12:'cavity',18:'cavity',26:'ground',28:'bowl',52:'platform',54:'bowl',61:'cavity',65:'bowl',67:'ground'}[c];
      const eligible=(c===30?[e]:birds.filter(x=>x!==e||![2,18].includes(c)))
        .filter(x=>!nest||[nest,'wild'].includes(BIRDS[x.id].nest));
      eggDemand+=n*Math.min([12,26,52,65].includes(c)?eligible.length:1,sum(eligible.map(x=>BIRDS[x.id].eggs-x.eggs)));
    }
    if(c===27)eggDemand+=n;
  }
  // Replenishment shares one action pool; proportional scaling avoids arbitrary
  // bird-order priority. Capacity itself cannot be replenished without new birds.
  const foodRate=progression.forest[p.habitats.forest.length];
  const cardRate=progression.wetland[p.habitats.wetland.length];
  const gathering=Math.max(0,foodDemand-f.food)/foodRate+Math.max(0,cardDemand-f.hand)/cardRate;
  const gatherBudget=f.turns/3;
  const supplyScale=gathering?Math.min(1,gatherBudget/gathering):1;
  const eggScale=eggDemand?Math.min(1,f.room/eggDemand):1;
  return f.engine*supplyScale*eggScale;
}

export function phaseWeights(turns){
  const early=Math.max(0,Math.min(1,(turns-13)/13));
  const late=Math.max(0,Math.min(1,(13-turns)/13));
  const mid=1-early-late;
  return {resources:early*.8+mid*.7+late*.35,
    engine:early*.85+mid*.65+late*.2,
    productive:early*.5+mid*.4+late*.15,
    goals:early*.7+mid+late*1.2};
}
// Approximate repeatable scoring per activation. Only actor-visible cards and
// public rows are consulted; unsupported powers contribute zero.
function repeatIncome(b,p,room,hand){
  const c=b.powerCode;
  if(b.powerType!=='brown')return 0;
  if([1,31].includes(c))return c===1?.55:.85;
  if([7,10,17,42,46].includes(c))return c===42?.7:c===46?.4:.55;
  if([9,23,36].includes(c))return Math.min(1,p.food[c===23?'seed':'fish']??0)*1.1;
  if([4,27,32,35,50,62].includes(c))return Math.min(1,hand/3)*(.65+(c===27?.35*Math.min(1,room):0));
  if([2,12,14,18,26,28,30,52,54,61,65,67].includes(c)){
    const nest={2:'ground',12:'cavity',18:'cavity',26:'ground',28:'bowl',52:'platform',54:'bowl',61:'cavity',65:'bowl',67:'ground'}[c];
    const eligible=allBirds(p).filter(e=>!nest||[nest,'wild'].includes(BIRDS[e.id].nest));
    return Math.min(room,[12,26,52,65].includes(c)?eligible.length:1)*.8;
  }
  return 0;
}

export function specialistProjection(state,player){
  const p=state.players[player],f=features(state,player);
  // Reserve actions for likely bird plays. The remaining row actions all share
  // an allocation budget and common capacity/demand limits.
  const reserve=Math.min(Math.floor(f.turns*.25),p.hand.length,15-allBirds(p).length);
  const actions=Math.max(0,f.turns-reserve),counts={forest:0,grassland:0,wetland:0};
  let room=f.room,foodNeed=Math.max(0,Math.min(f.turns,3*p.hand.length)-f.food);
  let cardNeed=Math.max(0,Math.min(15-allBirds(p).length,f.turns/3)-p.hand.length),gain=0;
  let hand=p.hand.length;
  const supply={...p,food:{...p.food}};
  for(let i=0;i<actions;i++){
    let best=null;
    for(const h of HABITATS){
      const row=p.habitats[h],output=progression[h][row.length];
      const base=h==='forest'?Math.min(output,foodNeed)*.48:h==='wetland'?Math.min(output,cardNeed)*.55:Math.min(output,room)*.85;
      const power=sum(row.map(e=>repeatIncome(BIRDS[e.id],supply,room,hand)));
      const value=base+power;
      if(!best||value>best.value)best={h,value,output};
    }
    if(best.value<=0)break;
    counts[best.h]++;gain+=best.value;
    for(const e of p.habitats[best.h]){
      const b=BIRDS[e.id];if(b.powerType!=='brown')continue;
      if([9,23,36].includes(b.powerCode)){
        const food=b.powerCode===23?'seed':'fish';supply.food[food]=Math.max(0,(supply.food[food]??0)-1);
      }
      if([4,27,32,35,50,62].includes(b.powerCode))hand=Math.max(0,hand-1);
    }
    if(best.h==='wetland')hand+=best.output;
    if(best.h==='forest')foodNeed=Math.max(0,foodNeed-best.output);
    if(best.h==='wetland')cardNeed=Math.max(0,cardNeed-best.output);
    // All scoring powers gradually exhaust a common capacity/consumable horizon.
    const eggPower=sum(p.habitats[best.h].filter(e=>[2,12,14,18,26,27,28,30,52,54,61,65,67].includes(BIRDS[e.id].powerCode)).map(e=>repeatIncome(BIRDS[e.id],supply,room,hand)));
    room=Math.max(0,room-(best.h==='grassland'?best.output:0)-eggPower);
  }
  // Pink income remains the existing conservative uniform estimate.
  const pink=sum(allBirds(p).filter(e=>BIRDS[e.id].powerType==='pink').map(e=>BIRDS[e.id].powerCode===55?.85:.3))*f.turns/3*.4;
  return {gain:gain+pink,counts,reserve};
}

export function investmentPayback(state,player){
  const p=state.players[player],f=features(state,player);
  let best=0;
  for(const id of p.hand){
    const b=BIRDS[id];
    if(b.powerType!=='brown')continue;
    for(const h of b.habitats){
      const row=p.habitats[h];if(row.length===5)continue;
      const eggCost=[0,1,1,2,2][row.length];
      const eggs=sum(allBirds(p).map(e=>e.eggs));
      const foodActions=Math.ceil(Math.max(0,cost(b)-f.food)/progression.forest[p.habitats.forest.length]);
      const eggActions=Math.ceil(Math.max(0,eggCost-eggs)/progression.grassland[p.habitats.grassland.length]);
      const delay=1+foodActions+eggActions;
      if(delay>=f.turns||Math.max(0,eggCost-eggs)>f.room)continue;
      const activations=Math.min(6,(f.turns-delay)/3);
      const per=repeatIncome(b,p,f.room+b.eggs,p.hand.length-1);
      // Only future repeatable benefit is added: printed points/resources already
      // have baseline credit. Discount uncertain payment, row use and opportunity.
      best=Math.max(best,.55*Math.max(0,per*activations-.5*delay));
    }
  }
  return best;
}

// Deficits measured in additional matching food tokens; surplus substitutes 2:1.
export function typedFoodDeficit(p,b){
  const stock=sum(FOOD.map(f=>p.food[f]??0));
  if(b.either){
    const match=b.food.wild>0||FOOD.some(f=>b.food[f]>0&&(p.food[f]??0)>0);
    return match&&stock?0:Math.max(0,1-Math.floor(stock/2));
  }
  const matched=sum(FOOD.map(f=>Math.min(p.food[f]??0,b.food[f]??0)));
  const surplus=stock-matched,wild=b.food.wild??0;
  return Math.max(0,cost(b)-matched-Math.min(wild,surplus)-Math.floor(Math.max(0,surplus-wild)/2));
}
function eggProjection(p,count){
  const habitats=Object.fromEntries(HABITATS.map(h=>[h,p.habitats[h].map(e=>({...e}))]));
  const entries=HABITATS.flatMap(h=>habitats[h]);
  // First spread one egg to empty nests, then build four-egg bonuses, then fill.
  for(const e of entries)if(count>0&&e.eggs===0&&BIRDS[e.id].eggs>0){e.eggs++;count--;}
  for(const target of [4,Infinity])for(const e of entries){
    const n=Math.min(count,Math.max(0,Math.min(target,BIRDS[e.id].eggs)-e.eggs));
    e.eggs+=n;count-=n;if(!count)break;
  }
  return {...p,habitats};
}
export function diverseAdjustments(state,player,f=features(state,player)){
  const p=state.players[player],birds=allBirds(p),T=f.turns;
  const eggRate=progression.grassland[p.habitats.grassland.length];
  const foodRate=progression.forest[p.habitats.forest.length];
  const eggs=sum(birds.map(e=>e.eggs)),slots=15-birds.length;
  const supply=Math.max(0,state.eggSupply??75);
  const eggFuture=eggProjection(p,Math.min(f.room,eggRate,supply));
  const bonus=p=>sum(p.bonuses.map(id=>bonusPoints(id,p)));
  const bonusNow=bonus(p),candidates=[];
  for(const id of p.hand){
    const b=BIRDS[id],deficit=typedFoodDeficit(p,b);
    for(const h of b.habitats){
      const n=p.habitats[h].length;if(n>=5)continue;
      const payment=[0,1,1,2,2][n];
      const delay=1+Math.ceil(deficit/foodRate)+Math.ceil(Math.max(0,payment-eggs)/eggRate);
      const paid=eggProjection(p,Math.max(0,payment-eggs));
      let due=payment;
      // Spend surplus eggs first, preserving one egg per nest where possible.
      const paymentEntries=allBirds(paid).sort((a,b)=>b.eggs-a.eggs);
      for(const floor of [1,0])for(const e of paymentEntries){
        const use=Math.min(due,Math.max(0,e.eggs-floor));e.eggs-=use;due-=use;
      }
      const hypothetical={...paid,hand:p.hand.filter((_,i)=>i!==p.hand.indexOf(id)),habitats:{...paid.habitats,[h]:[...paid.habitats[h],{id,eggs:0,cached:[],tucked:[]}]}};
      candidates.push({b,h,payment,delay,deficit,hypothetical});
    }
  }
  const feasible=candidates.filter(c=>c.delay<=T&&Math.max(0,c.payment-eggs)<=Math.min(f.room,supply));
  const max=(fn)=>Math.max(0,...feasible.map(fn));
  const a={};
  a['bonus-threshold']=.65*Math.max(0,max(c=>(bonus(c.hypothetical)-bonusNow)/c.delay),T?bonus(eggFuture)-bonusNow:0)-f.bonusGrowth;
  const current=state.goals[state.round-1]?.face;
  const unpaid=p.goalPoints.length<state.round;
  if(current&&unpaid){
    const award=roundGoalScores(state.players,current,state.round,state.goalMode)[player];
    const replace=h=>state.players.map((q,i)=>i===player?h:q);
    const eggAward=roundGoalScores(replace(eggFuture),current,state.round,state.goalMode)[player];
    const best=Math.max(award,state.remaining[player]>0?eggAward:award,...feasible.map(c=>c.delay<=state.remaining[player]?roundGoalScores(replace(c.hypothetical),current,state.round,state.goalMode)[player]:award));
    const urgency=1/(1+Math.max(0,state.remaining[player]-1)/3);
    a['round-race']=.65*urgency*Math.max(0,best-award);
  }else a['round-race']=0;
  a['future-goals']=sum(state.goals.slice(state.round).map((g,i)=>roundGoalScores(state.players,g.face,state.round+i+1,state.goalMode)[player]*.25/(i+1)));
  const nextPayment=Math.min(2,...feasible.map(c=>c.payment));
  a['egg-liquidity']=T>1&&feasible.length?.45*Math.min(eggs,nextPayment)+.35*Math.min(f.room,Math.max(0,nextPayment-eggs))-.3*Math.max(0,nextPayment-eggs-f.room):0;
  a['capacity-investment']=.5*max(c=>Math.min(c.b.eggs,Math.max(0,(T-c.delay)*eggRate/3-f.room))/Math.sqrt(c.delay));
  const typedAccess=max(c=>Math.max(0,c.b.points-c.payment-.6*cost(c.b))/(1+c.deficit));
  a['typed-food']=.3*typedAccess-.25*f.usableFood;
  const bestHand=max(c=>Math.max(0,c.b.points-c.payment)/c.delay);
  a['hand-quality']=.45*bestHand-.2*f.usableHand;
  a['row-unlocks']=.45*max(c=>(progression[c.h][p.habitats[c.h].length+1]-progression[c.h][p.habitats[c.h].length])*Math.min(5,Math.max(0,T-c.delay)/3)/c.delay);
  let synergy=0;
  for(const h of HABITATS){
    const codes=p.habitats[h].filter(e=>BIRDS[e.id].powerType==='brown').map(e=>BIRDS[e.id].powerCode);
    const draws=codes.filter(c=>[3,24,34,41,56,59].includes(c)).length;
    const tucks=codes.filter(c=>[4,27,32,35,50,62].includes(c)).length;
    const seed=codes.filter(c=>[35,63,66].includes(c)).length;
    const fish=codes.filter(c=>[29,60].includes(c)).length;
    const foodTuck=codes.filter(c=>c===23).length*Math.min(1,seed)+codes.filter(c=>[9,36].includes(c)).length*Math.min(1,fish);
    synergy+=Math.min(draws,tucks)*.4+foodTuck*.45;
    const targets=p.habitats[h].map(e=>BIRDS[e.id]).filter(b=>b.powerType==='brown'&&![43,49].includes(b.powerCode));
    const bestRepeat=Math.max(0,...targets.map(b=>repeatIncome(b,p,f.room,p.hand.length)));
    const bestPredator=Math.max(0,...targets.filter(b=>[7,10,17,42,46].includes(b.powerCode)).map(b=>repeatIncome(b,p,f.room,p.hand.length)));
    synergy+=codes.filter(c=>c===43).length*Math.min(.75,bestRepeat)*.5;
    synergy+=codes.filter(c=>c===49).length*Math.min(.75,bestPredator)*.5;
  }
  a['power-synergy']=Math.min(4,synergy*Math.min(6,T/3));
  const cashEggs=Math.min(f.room,supply,T*eggRate);
  const cashPlay=max(c=>Math.max(0,c.b.points-c.payment)+Math.min(f.room+c.b.eggs+c.payment,supply+c.payment,Math.max(0,T-c.delay)*eggRate));
  const existing=.7*(f.usableHand+f.usableFood)+.65*f.engine+.4*f.productive+f.bonusGrowth;
  a['endgame-cashout']=Math.max(0,1-T/8)*(.7*Math.max(cashEggs,cashPlay)-existing)||0;
  const visible=q=>sum(allBirds(q).map(e=>BIRDS[e.id].points+e.eggs+e.cached.length+e.tucked.length))+sum(q.goalPoints);
  const mine=visible(p),rivals=state.players.filter((_,i)=>i!==player);
  const lead=mine-(rivals.length?Math.max(...rivals.map(visible)):mine);
  const eggReach=(q,actions)=>Math.min(supply,sum(allBirds(q).map(e=>BIRDS[e.id].eggs-e.eggs)),Math.max(0,actions)*progression.grassland[q.habitats.grassland.length]);
  const ownReach=eggReach(p,state.remaining[player]);
  const rivalReach=Math.max(0,...state.players.map((q,i)=>i===player?0:eggReach(q,state.remaining[i])));
  const actionGap=state.remaining[player]-Math.max(0,...state.remaining.filter((_,i)=>i!==player));
  a['opponent-tempo']=Math.min(1,T/8)*Math.max(-2,Math.min(2,(lead/20+actionGap*.15+(ownReach-rivalReach)*.12)));
  a['strategic-blend']=Math.max(-4,Math.min(6,.5*(a['bonus-threshold']+a['round-race']+a['capacity-investment']+a['row-unlocks']+a['power-synergy'])+.25*(a['typed-food']+a['hand-quality'])+.5*a['endgame-cashout']));
  return a;
}

export function evaluateLeaf(state,player,method='practical-combined'){
  if(!LEAF_EVALUATORS.includes(method))throw Error('Unknown Wingspan leaf evaluator '+method);
  const printed=scorePlayer(state.players[player]).total;
  if(method==='points-only'||state.phase==='gameover')return printed;
  const f=features(state,player),tempo=f.turns/26;
  const resources=f.usableHand+f.usableFood;
  const goals=f.currentGoal+f.bonusGrowth;
  const basic=(Math.min(8,f.hand)*1.1+Math.min(10,f.food)*.9)*tempo;
  const generic=HABITATS.reduce((n,h)=>{
    const birds=state.players[player].habitats[h];
    return n+Math.min(5,birds.filter(e=>BIRDS[e.id].powerType==='brown').length)*.85+birds.length*.4;
  },0)*tempo;
  const values={
    'remaining-turns':basic+generic,
    'engine-income':basic+f.engine,
    'goal-aware':basic+generic+goals,
    'usable-resources':resources,
    'habitat-productivity':f.productive,
    'practical-combined':resources*.7+f.engine*.65+f.productive*.4+goals,
    'conservative':resources*.35+f.engine*.3+f.productive*.2+goals*.5
  };
  if(PLANNING_EVALUATORS.includes(method))return printed+values['practical-combined']+planningAdjustments(state,player)[method];
  if(EFFICIENCY_EVALUATORS.includes(method))return printed+values['practical-combined']+efficiencyAdjustments(state,player)[method];
  if(DEVELOPMENT_EVALUATORS.includes(method))return printed+values['practical-combined']+developmentAdjustments(state,player)[method];
  if(MECHANICS_EVALUATORS.includes(method))return printed+values['practical-combined']+mechanicsAdjustments(state,player)[method];
  if(DIVERSE_EVALUATORS.includes(method))return printed+values['practical-combined']+diverseAdjustments(state,player,f)[method];
  if(method==='action-budget-planner')return printed+actionBudgetProjection(state,player).gain+f.currentGoal;
  if(method==='bottleneck-engine')return printed+resources*.7+bottleneckIncome(state,player,f)*.65+f.productive*.4+goals;
  if(method==='phase-calibrated'){
    const w=phaseWeights(f.turns);
    return printed+resources*w.resources+f.engine*w.engine+f.productive*w.productive+goals*w.goals;
  }
  if(['habitat-specialist','investment-payback','specialist-payback'].includes(method)){
    let value=values['practical-combined'];
    if(method!=='investment-payback')value+=.55*(specialistProjection(state,player).gain*.65-f.engine*.65-f.productive*.4);
    if(method!=='habitat-specialist')value+=investmentPayback(state,player);
    return printed+value;
  }
  return printed+values[method];
}

