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
import {BIRDS} from "../../wingspan/catalog.js";
import {FOOD,HABITATS,scorePlayer} from "../../wingspan/scoring.js";
import {determinize} from "../../wingspan/belief.js";
import {applyAction,publicObservation} from "../../wingspan/core.js";
import {candidateActions} from "../../wingspan/actions.js";
import {evaluateLeaf} from "../../wingspan/leaf-evaluators.js";
import {predictObservation,isCompiledModel} from "./inference.mjs";
import {supportedModelObservation} from './encoder.mjs';
export {supportedModelObservation} from './encoder.mjs';
import {performance} from 'node:perf_hooks';

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
/** Whether this endpoint actually receives a learned blend (not a root cache call). */
export function usesLearnedValue(state,{method="reference",blend=1,allowModel=true}={}){
 return method!=="reference"&&blend!==0&&allowModel&&state.players.length===2&&state.phase==="play"&&
  !state.pending.length&&!state.turnContext&&state.mode==="digital";
}
/** Reference margin plus observation-only correction, in ROOT-VIEWER points. */
export function relativeScore(state,owner,{method="reference",model,blend=1,allowModel=true,learnedMargin}={}){
  const reference=evaluateLeaf(state,owner,"opening-plan")-Math.max(...state.players.map((_,i)=>
    i===owner?-Infinity:evaluateLeaf(state,i,"opening-plan")));
  if(!usesLearnedValue(state,{method,blend,allowModel}))return reference;
  if(!isCompiledModel(model))throw Error("Compiled learned value model required");
  const learned=learnedMargin===undefined?predictObservation(model,publicObservation(state,owner),owner):learnedMargin;
  if(!Number.isFinite(learned))throw Error("Nonfinite learned margin");
  return reference+blend*learned;
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
/**
 * Score an action in a sampled hidden world. Horizon counts subsequent play
 * actions across all seats, excluding the root and setup/power decisions.
 * maxSteps bounds all subsequent decisions; diagnostics consume no randomness.
 */
export function evaluateBeliefRollout(observation,action,rng=Math.random,{
  horizon=4,strategy="mixed",maxSteps=192,diagnostics,method="reference",model,blend=1,initialLearnedMargin,onLeaf
}={}){
  if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>512)
    throw Error("Invalid Wingspan rollout step limit");
  if(!["reference","residual"].includes(method))throw Error("Unknown neural pilot method");
  if(![0,1].includes(blend))throw Error("Invalid neural pilot blend");
  if(method!=="reference"&&blend!==0&&!isCompiledModel(model))throw Error("Compiled learned value model required");
  const determinizeStart=performance.now();
  const initial=determinize(observation,rng);
  const determinizationMs=performance.now()-determinizeStart;
  let generationMs=0,transitionMs=0;
  const actor=activeSeat(initial);
  const allowModel=supportedModelObservation(observation,actor);
  const valueOptions={method,model,blend,allowModel};
  const before=relativeScore(initial,actor,{...valueOptions,learnedMargin:initialLearnedMargin});
  let s=applyAction(initial,action);
  const prior=policyGrade(initial,action,actor);
  let actionTurns=0,steps=0,powerSteps=0;
  const actionTurnsBySeat=initial.players.map(()=>0);
  const boundary=()=>["play","gameover"].includes(s.phase)&&
    !s.pending.length&&!s.turnContext;
  while(s.phase!=="gameover"&&steps<maxSteps){
    // Resolve all effects of the final action, but never start an extra action.
    if(actionTurns>=horizon&&boundary())break;
    steps++;
    const generationStart=performance.now();
    const options=candidateActions(s);
    generationMs+=performance.now()-generationStart;
    if(!options.length)throw Error("No candidate rollout action in "+s.phase);
    const target=activeSeat(s);
    const style=strategy==="mixed"?
      (target===actor?"greedy":rng()<.65?"greedy":"exploratory"):
      strategy;
    const preferred=samplePolicy(options,s,rng,style);
    // Selection is a heuristic over representative action choices; a
    // dynamic choice can become invalid after a nested power changes state.
    // Retest alternatives, but never "correct" the actual root action.
    const transitionStart=performance.now();
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
    transitionMs+=performance.now()-transitionStart;
    if(s.phase==="play"){
      actionTurns++;
      actionTurnsBySeat[target]++;
    }
    if(s.phase==="power")powerSteps++;
    s=next;
  }
  const settled=boundary();
  const horizonReached=actionTurns>=horizon;
  const terminalReached=s.phase==="gameover";
  const safetyCap=steps>=maxSteps&&!(terminalReached||(horizonReached&&settled));
  const evaluationStart=performance.now();
  const delta=relativeScore(s,actor,valueOptions)-before;
  const evaluationMs=performance.now()-evaluationStart;
  const priorReward=.18*prior,leafReward=.82*delta;
  const learnedLeafCount=Number(usesLearnedValue(s,valueOptions));
  const learnedFallbackCount=Number(method!=="reference"&&blend!==0&&!learnedLeafCount);
  const leafInfo={learnedLeafCount,learnedFallbackCount,actionTurns,actionTurnsBySeat,powerSteps,steps,settled,
    horizonReached,terminalReached,safetyCap,phase:s.phase,pendingCount:s.pending.length,determinizationMs,generationMs,transitionMs,evaluationMs,
    priorReward,leafReward};
  if(diagnostics){
    const add=(key,value)=>diagnostics[key]=(diagnostics[key]??0)+value;
    for(const [key,n] of Object.entries({determinizationMs,generationMs,transitionMs,evaluationMs}))add(key,n);
    add("rolloutCount",1);
    add("learnedLeafCount",learnedLeafCount);
    add("learnedFallbackCount",learnedFallbackCount);
    add("actionTurns",actionTurns);
    diagnostics.actionTurnsBySeat??=initial.players.map(()=>0);
    actionTurnsBySeat.forEach((n,i)=>diagnostics.actionTurnsBySeat[i]+=n);
    add("powerSteps",powerSteps);
    add("steps",steps);
    add("settledLeaf",Number(settled));
    add("settledLeaves",Number(settled));
    add("unsettledLeaves",Number(!settled));
    add("horizonReached",Number(horizonReached));
    add("terminalReached",Number(terminalReached));
    add("safetyCapCount",Number(safetyCap));
    add("priorRewardSum",priorReward);
    add("leafRewardSum",leafReward);
  }
  // Instrumentation observes the leaf after scoring and consumes no randomness.
  if(onLeaf)onLeaf(s,leafInfo);
  return leafReward+priorReward;
}
