/**
 * Imperfect-information, root-parallel sampled action evaluation.
 *
 * IMPORTANT: this is not a perfect-information MCTS or a calibrated win-rate
 * model. The worker receives only a redacted PUBLIC observation plus the
 * current actor's candidate actions. It never receives the hidden deck order
 * or opponents' hands. Random samples represent possible unseen future
 * birds/food, not facts about another player.
 */
import {BIRDS} from "./catalog.js";
import {FOOD,HABITATS} from "./scoring.js";

const median=arr=>arr.slice().sort((a,b)=>a-b)[Math.floor(arr.length/2)]??0;
const allBirds=p=>HABITATS.flatMap(h=>p.habitats[h]);
const countFood=p=>FOOD.reduce((n,k)=>n+(p.food[k]??0),0);
const basicScore=p=>allBirds(p).reduce((n,x)=>
    n+BIRDS[x.id].points+x.eggs+x.cached.length+x.tucked.length,0)+
    (p.goalPoints??[]).reduce((n,x)=>n+x,0);
function futurePowerValue(bird,turnsRemaining) {
  const color=bird.powerType;
  const until=Math.max(0,turnsRemaining);
  if(color==="brown")return Math.min(5,0.42*until);
  if(color==="pink")return Math.min(4,0.25*until);
  if(color==="white")return 1.5;
  return 0;
}
function visibleKnownBirds(observation) {
  const seen=new Set(observation.tray||[]);
  for(const p of observation.players){
    for(const h of HABITATS)
      for(const e of p.habitats[h]) {
        seen.add(e.id);
        for(const c of e.tucked)seen.add(c);
      }
    for(const id of p.hand||[])seen.add(id);
  }
  for(const id of observation.birdDiscard||[])seen.add(id);
  return seen;
}
export function availableUnknownCards(observation){
  const known=visibleKnownBirds(observation);
  return BIRDS.filter(b=>!known.has(b.id));
}
function hSum(food){
  return Object.values(food||{}).reduce((n,v)=>n+(Number(v)||0),0);
}
function gradeAction(observation,action) {
  const viewer=observation.currentPlayer;
  const player=observation.players[viewer];
  const round=observation.round;
  const remainingTurns=[8,7,6,5].slice(round-1).reduce((a,b)=>a+b,0);
  const ability=Math.max(0.2,(5-round)/4);
  if(action.type==="setup"){
    const kept=action.keep??[];
    return kept.reduce((n,id)=>{
      const bird=BIRDS[id],cost=hSum(bird.food);
      return n+bird.points*0.60-cost*1.1+
        futurePowerValue(bird,remainingTurns)*0.65;
    },0)+2*Math.log2(1+kept.length);
  }
  if(action.type==="playBird"){
    const bird=BIRDS[action.birdId];
    const habitatCount=player.habitats[action.habitat].length;
    const eggs=action.eggs?.reduce((n,x)=>n+x.count,0)??0;
    const food=action.payment?.length??0;
    const synergy=player.habitats[action.habitat].filter(
      b=>BIRDS[b.id].powerType==="brown").length;
    return bird.points*0.95+futurePowerValue(bird,remainingTurns) +
      bird.eggs*0.27+synergy*0.24-food*(1.0+0.14*round)-
      eggs*(1.1+0.13*round)-habitatCount*.25;
  }
  if(action.type==="gainFood"){
    const dice=action.dice?.length??0;
    const shortages=player.hand.reduce((n,id)=>{
      const cost=BIRDS[id].food;
      for(const food of FOOD)
        if(cost[food]>player.food[food])n+=cost[food]-player.food[food];
      return n;
    },0);
    return dice*(1.3+0.5*ability)+Math.min(3,shortages)*.3 -
      (action.discardCard!==undefined?1.5:0);
  }
  if(action.type==="layEggs"){
    const number=action.targets?.reduce((n,x)=>n+x.count,0)??0;
    return number*(0.8+round*.32)-
      (action.payment?1.1:0);
  }
  if(action.type==="drawBirds"){
    const number=action.draws?.length??0;
    const handSize=player.hand.length;
    return number*(1.5+0.55*ability)-
      Math.max(0,handSize-6)*0.28-(action.extra?1:0);
  }
  if(action.type==="power") {
    if(action.skip)return -.25;
    return 1.1+((action.choice?.food)?0.3:0);
  }
  return 0;
}
/** Build a sample of *unknown* species from the public information set. */
function sampleOutlook(unknown,rng) {
  if(!unknown.length)return {value:0.6,cost:2.0,brown:0};
  const bird=unknown[Math.floor(rng()*unknown.length)];
  return {
    value:bird.points,
    cost:hSum(bird.food),
    brown:bird.powerType==="brown"?1:0
  };
}
export function evaluateSample(observation,action,unknown,rng) {
  const base=gradeAction(observation,action);
  const future=sampleOutlook(unknown,rng);
  const spread=action.type==="drawBirds"?1.2:action.type==="setup"?.35:.55;
  const anticipation=future.value*.11-future.cost*.08+
    future.brown*.15;
  const jitter=(rng()+rng()-1)*spread;
  // Score is the *projected marginal strategic utility* of an action,
  // not a win probability. Avoid translating it into a percent of games won.
  return base+anticipation+jitter;
}
function chooseIndex(search) {
  // Force each candidate to be sampled before allocating via UCB1.
  const empty=search.arms.findIndex(a=>a.visits===0);
  if(empty>=0)return empty;
  const log=Math.log(search.iterations+1),actor=search.actor;
  let best=0,quality=-Infinity;
  for(let i=0;i<search.arms.length;i++){
    const arm=search.arms[i];
    const exploit=arm.sum/arm.visits;
    const explore=search.exploration*Math.sqrt(log/arm.visits);
    const v=exploit+explore+search.rng()*1e-8;
    if(v>quality){quality=v;best=i;}
  }
  return best;
}
export function createSearch(observation,choices,{
  rng=Math.random,exploration=1.8
}={}) {
  if(!choices.length)throw Error("No candidate actions to analyze");
  const unknown=availableUnknownCards(observation);
  return {
    observation,unknown,rng,exploration,actor:observation.currentPlayer,
    arms:choices.map(x=>({...x,visits:0,sum:0,squared:0})),
    iterations:0
  };
}
export function runSearch(s,iterations=1){
  for(let i=0;i<iterations;i++){
    const arm=s.arms[chooseIndex(s)];
    const reward=evaluateSample(s.observation,arm.action,s.unknown,s.rng);
    arm.visits++;arm.sum+=reward;arm.squared+=reward*reward;
    s.iterations++;
  }
  return s;
}
export function searchSummary(s){
  const arms=s.arms.map(a=>({
    action:a.action,label:a.label,category:a.category,visits:a.visits,
    sum:a.sum,variance:a.visits>1?
      Math.max(0,(a.squared-a.sum*a.sum/a.visits)/(a.visits-1)):0
  })).sort((a,b)=>(b.visits?b.sum/b.visits:-Infinity)-
    (a.visits?a.sum/a.visits:-Infinity));
  return {
    iterations:s.iterations,actor:s.actor,alternatives:s.arms.length,
    candidates:arms
  };
}
