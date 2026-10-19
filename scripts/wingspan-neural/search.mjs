/** Research-only root-parallel UCB; production allocation and RNG order retained. */
import {isCompiledModel,predictObservation} from "./inference.mjs";
import {evaluateBeliefRollout,supportedModelObservation} from "./rollout.mjs";

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
  rng=Math.random,method="reference",horizon=4,rolloutStepLimit=192,diagnostics=true,model,blend=.5
}={}) {
  if(observation.publicComplete===false)throw Error("Record public observations before analysis");
  if(!choices.length)throw Error("No candidate actions to analyze");
  if(!["reference","neural","linear"].includes(method))
    throw Error("Unknown Wingspan study method");
  if(![0,.5].includes(blend))throw Error("Invalid neural pilot blend");
  if(method!=="reference"&&blend!==0&&!isCompiledModel(model))throw Error("Compiled learned value model required");
  if(!Number.isInteger(horizon)||horizon<1||horizon>20)
    throw Error("Invalid Wingspan rollout horizon");
  if(!Number.isInteger(rolloutStepLimit)||rolloutStepLimit<1||rolloutStepLimit>512)
    throw Error("Invalid Wingspan rollout step limit");
  const actor=observation.phase==="power"?(observation.pending[0]?.owner??observation.currentPlayer):observation.currentPlayer;
  // Every belief draw has the same root-viewer observation. Cache only the
  // deterministic learned root baseline; sampled reference values remain per draw.
  const initialLearnedMargin=method!=="reference"&&blend!==0&&supportedModelObservation(observation,actor)?
    predictObservation(model,observation,actor):undefined;
  return {
    observation,rng,initialLearnedMargin,exploration:3.5,method,horizon,rolloutStepLimit,model,blend,
    ...(diagnostics?{diagnostics:{rolloutCount:0,learnedLeafCount:0,learnedFallbackCount:0,actionTurns:0,
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
      diagnostics:s.diagnostics,method:s.method,model:s.model,blend:s.blend,initialLearnedMargin:s.initialLearnedMargin
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
    method:s.method,horizon:s.horizon,blend:s.blend,modelId:s.model?.id??null,candidates:arms,
    ...(s.diagnostics?{diagnostics:structuredClone(s.diagnostics)}:{})
  };
}
