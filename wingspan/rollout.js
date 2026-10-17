/**
 * Bounded Wingspan imperfect-information game rollouts.
 *
 * Every sample starts with independently imagined unseen cards (belief.js).
 * Decisions and effects are applied to that invented full state via the
 * exact same rules engine used by play. Only PUBLIC observations and the
 * current actor's actually known action choices may enter this module.
 *
 * Rollouts are truncated approximations, not calibrated win probabilities.
 */
import {BIRDS} from "./catalog.js";
import {FOOD,HABITATS,scorePlayer} from "./scoring.js";
import {determinize} from "./belief.js";
import {applyAction} from "./core.js";
import {candidateActions} from "./actions.js";

const sum=array=>array.reduce((n,x)=>n+x,0);
const allBirds=p=>HABITATS.flatMap(h=>p.habitats[h]);
const foodCount=p=>sum(FOOD.map(f=>p.food[f]??0));
const activeSeat=state=>
  state.phase==="power"?(state.pending[0]?.owner??state.currentPlayer):
    state.currentPlayer;
function remainingActions(state){
  return [8,7,6,5].slice(state.round-1).reduce((a,b)=>a+b,0);
}
export function projectedScore(state,player){
  const p=state.players[player];
  const printed=scorePlayer(p).total;
  const future=remainingActions(state)/26;
  const handValue=Math.min(8,p.hand.length)*1.1*future;
  const foodValue=Math.min(10,foodCount(p))*.90*future;
  const engines=HABITATS.reduce((n,h)=>{
    const birds=p.habitats[h];
    const browns=birds.filter(x=>BIRDS[x.id].powerType==="brown").length;
    return n+Math.min(5,browns)*.85*future+birds.length*.40*future;
  },0);
  return printed+handValue+foodValue+engines;
}
export function relativeScore(state,owner){
  const score=projectedScore(state,owner);
  const enemy=Math.max(...state.players.map((_,i)=>
    i===owner?-Infinity:projectedScore(state,i)));
  return score-enemy;
}
export function policyGrade(state,action,owner=activeSeat(state)){
  const p=state.players[owner];
  const stage=remainingActions(state)/26;
  if(action.type==="setup"){
    return (action.keep??[]).reduce((n,id)=>{
      const b=BIRDS[id];
      return n+b.points*.58+stage*b.eggs*.3+
        (b.powerType==="brown"?2.2:0)-FOOD.reduce((a,f)=>a+b.food[f],0)*1.1;
    },0)+.4*action.keep.length;
  }
  if(action.type==="playBird"){
    const b=BIRDS[action.birdId];
    return b.points*.8+(b.powerType==="brown"?2.9*stage:
      b.powerType==="white"?1.3:b.powerType==="pink"?1.6*stage:0)+
      b.eggs*.35*stage-(action.payment?.length??0)*1.0-
      (action.eggs?.reduce((n,x)=>n+x.count,0)??0)*1.2;
  }
  if(action.type==="gainFood"){
    const need=p.hand.reduce((n,id)=>n+FOOD.filter(f=>
      BIRDS[id].food[f]>(p.food[f]??0)).length,0);
    return (action.dice?.length??0)*(1.4+.8*stage)+
      Math.min(3,need)*.2-(action.extra?1.0:0);
  }
  if(action.type==="layEggs"){
    const eggs=action.targets?.reduce((n,x)=>n+x.count,0)??0;
    return eggs*(1.18-stage*.26)-(action.payment?1.1:0);
  }
  if(action.type==="drawBirds"){
    const count=action.draws?.length??0;
    return count*(1.0+stage*.9)-
      Math.max(0,p.hand.length-5)*.32-(action.extra?1.05:0);
  }
  if(action.type==="power"){
    return action.skip?-.5:1.0;
  }
  return 0;
}
function samplePolicy(actions,state,rng,strategy){
  if(actions.length===1)return actions[0];
  const scores=actions.map(x=>policyGrade(state,x.action));
  const top=Math.max(...scores);
  const temp=strategy==="greedy"?.9:strategy==="exploratory"?3.4:1.75;
  const weights=scores.map(x=>Math.exp(Math.max(-60,(x-top)/temp)));
  const maxWeight=sum(weights);
  let chosen=rng()*maxWeight;
  for(let i=0;i<actions.length;i++){
    chosen-=weights[i];
    if(chosen<=0)return actions[i];
  }
  return actions.at(-1);
}
function advanceOne(s,option){
  return applyAction(s,option.action);
}
/** Score an action by sampling a consistent hidden world and several turns. */
export function evaluateBeliefRollout(observation,action,rng=Math.random,{
  horizon=6,strategy="mixed"
}={}){
  const initial=determinize(observation,rng);
  const actor=activeSeat(initial);
  const before=relativeScore(initial,actor);
  const prior=policyGrade(initial,action,actor);
  let s=applyAction(initial,action);
  let actionTurns=0,steps=0;
  while(s.phase!=="gameover"&&steps++<48&&actionTurns<horizon){
    const options=candidateActions(s);
    if(!options.length)break;
    const target=activeSeat(s);
    const style=strategy==="mixed"?
      (target===actor?"greedy":rng()<.65?"greedy":"exploratory"):
      strategy;
    const preferred=samplePolicy(options,s,rng,style);
    // Selection is a heuristic over representative action choices; a
    // dynamic choice can become invalid after a nested power changes state.
    // Retest alternatives, but never "correct" the actual root action.
    let next=null;
    try{next=advanceOne(s,preferred);}
    catch(error){
      for(const option of options){
        if(option===preferred)continue;
        try{next=advanceOne(s,option);break;}
        catch{}
      }
      if(!next)throw Error("No legal rollout action in "+s.phase+": "+
        error.message);
    }
    if(s.phase==="play")actionTurns++;
    s=next;
  }
  const delta=relativeScore(s,actor)-before;
  // Prior only stabilizes small budgets; the majority of the reward comes
  // from actual rules-engine transitions in sampled hidden worlds.
  return 0.82*delta+0.18*prior;
}
