/** Research-only root-parallel UCB; production allocation and RNG order retained. */
import {evaluateBeliefRollout} from "./rollout.mjs";

function chooseIndex(search) {
  // Force each candidate to be sampled before allocating via UCB1.
  const empty=search.arms.findIndex(a=>a.visits===0);
  if(empty>=0)return empty;
  const log=Math.log(search.iterations+1);
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
  rng=Math.random,method="reference",horizon=4,rolloutStepLimit=192,diagnostics=true
}={}) {
  if(observation.publicComplete===false)throw Error("Record public observations before analysis");
  if(!choices.length)throw Error("No candidate actions to analyze");
  if(!["reference","exceptional","chains","investment","blend"].includes(method))
    throw Error("Unknown Wingspan study method");
  if(!Number.isInteger(horizon)||horizon<1||horizon>20)
    throw Error("Invalid Wingspan rollout horizon");
  if(!Number.isInteger(rolloutStepLimit)||rolloutStepLimit<1||rolloutStepLimit>512)
    throw Error("Invalid Wingspan rollout step limit");
  return {
    observation,rng,exploration:3.5,method,horizon,rolloutStepLimit,
    ...(diagnostics?{diagnostics:{rolloutCount:0,actionTurns:0,
      actionTurnsBySeat:observation.players.map(()=>0),powerSteps:0,steps:0,
      settledLeaf:0,settledLeaves:0,unsettledLeaves:0,horizonReached:0,terminalReached:0,
      safetyCapCount:0,priorRewardSum:0,leafRewardSum:0}}:{}),
    actor:observation.phase==="power"?
      observation.pending[0]?.owner:observation.currentPlayer,
    arms:choices.map(x=>({...x,visits:0,sum:0,squared:0})),iterations:0
  };
}
export function runSearch(s,iterations=1){
  for(let i=0;i<iterations;i++){
    const arm=s.arms[chooseIndex(s)];
    const reward=evaluateBeliefRollout(s.observation,arm.action,s.rng,{
      horizon:s.horizon,maxSteps:s.rolloutStepLimit,
      diagnostics:s.diagnostics,method:s.method
    });
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
    method:s.method,horizon:s.horizon,candidates:arms,
    ...(s.diagnostics?{diagnostics:structuredClone(s.diagnostics)}:{})
  };
}
