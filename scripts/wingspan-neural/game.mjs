/** Study-only symmetric full-game runner. Production UI and rules stay unchanged. */
import {performance} from 'node:perf_hooks';
import {newGame,applyAction,assertValid,seededRandom,publicObservation,RESOURCE_PROGRESSION} from '../../wingspan/core.js';
import {candidateActions} from '../../wingspan/actions.js';
import {openingSetupActions} from '../../wingspan/opening-strategy.js';
import {BIRDS} from '../../wingspan/catalog.js';
import {scorePlayer,finalOutcome} from '../../wingspan/scoring.js';
import * as study from './search.mjs';
import {compileModel} from './inference.mjs';
import * as deployed from '../wingspan-study/deployed/analysis.js';
import {candidateActions as deployedActions} from '../wingspan-study/deployed/actions.js';
import {openingSetupActions as deployedOpening} from '../wingspan-study/deployed/opening-strategy.js';
import {publicObservation as deployedObservation} from '../wingspan-study/deployed/core.js';

const counter=legacy=>({decisions:0,iterations:0,roots:0,unvisited:0,rolloutCount:0,learnedLeafCount:0,learnedFallbackCount:0,safetyCapCount:0,unsettledLeaves:legacy?null:0,
 endpointMeasurement:legacy?'legacy-not-instrumented':'resolved-boundary',illegalActions:0,errors:0,actionTurns:0,powerSteps:0,settledLeaves:0,
 terminalReached:0,horizonReached:0,steps:0,actionTurnsBySeat:legacy?null:[0,0],priorRewardSum:legacy?null:0,leafRewardSum:legacy?null:0,observationGenerationMs:0,searchMs:0,requestedTimeOverruns:0,coverageFloorOverruns:0,mainActions:0,powerDecisions:0});
const active=s=>s.phase==='power'?s.pending[0].owner:s.currentPlayer;
const resources=p=>({food:Object.values(p.food).reduce((a,b)=>a+b,0),eggs:Object.values(p.habitats).flat().reduce((a,e)=>a+e.eggs,0),hand:p.hand.length,cached:Object.values(p.habitats).flat().reduce((a,e)=>a+e.cached.length,0),tucked:Object.values(p.habitats).flat().reduce((a,e)=>a+e.tucked.length,0)});
const rows=p=>Object.fromEntries(Object.entries(p.habitats).map(([h,row])=>[h,row.length]));

/** Reject mislabeled arms rather than silently ignoring an ablation. */
export function normalizeArm(arm={}){
 const result={pipeline:'study',method:'reference',policy:'original',priorWeight:.18,blend:.5,budget:100,horizon:4,...arm};
 if(!['study','deployed'].includes(result.pipeline))throw Error('Unknown pipeline');
 if(!['reference','neural','linear'].includes(result.method))throw Error('Unknown evaluator');
 if(!['original'].includes(result.policy))throw Error('Unknown continuation policy');
 if(result.priorWeight!==.18)throw Error('Invalid prior weight');
 if(![100,300].includes(result.budget))throw Error('Invalid neural pilot sample budget');
 if(result.horizon!==4)throw Error('Invalid neural pilot horizon');
 if(![0,.5].includes(result.blend))throw Error('Invalid neural blend');
 if(result.timeMs!==undefined&&(!Number.isFinite(result.timeMs)||result.timeMs<=0))throw Error('Invalid decision time budget');
 if(result.pipeline==='deployed'&&(result.method!=='reference'||result.policy!=='original'||result.priorWeight!==.18))throw Error('Deployed pipeline requires its frozen reference, policy and prior');
 return result;
}

export function chooseAction(state,arm,{seed=1,step=1,rolloutStepLimit=192,models={},clock=()=>performance.now()}={}){
 arm=normalizeArm(arm);
 const started=clock(),actor=active(state),legacy=arm.pipeline==='deployed';
 const observe=legacy?deployedObservation:publicObservation;
 const choicesFn=legacy?deployedActions:candidateActions,expand=legacy?deployedOpening:openingSetupActions;
 const observation=observe(state,actor),original=choicesFn(state);
 const choices=state.phase==='setup'?expand(state,original):original;
 const generatedAt=clock(),api=legacy?deployed:study;
 const model=arm.method==='reference'||arm.blend===0?undefined:compileModel(models[arm.method]);
 const options={rng:seededRandom((seed^Math.imul(step,193)^Math.imul(actor+1,982451653))>>>0),horizon:arm.horizon,
  rolloutStepLimit:legacy?48:rolloutStepLimit,diagnostics:true,model,blend:arm.blend};
 const search=api.createSearch(observation,choices,legacy?{...options,method:'belief-rollout',leafEvaluator:'opening-plan'}:{...options,method:arm.method});
 const floor=choices.length,requested=Math.max(arm.budget,floor);
 if(arm.timeMs!==undefined){
  // Observation/generation/initialization are charged before search starts.
  while(search.iterations<floor||clock()-started<arm.timeMs)api.runSearch(search,1);
 }else api.runSearch(search,requested);
 const summary=api.searchSummary(search),finished=clock();
 if(!summary.candidates?.[0]?.action)throw Error('Search produced no recommendation');
 const unvisited=search.arms.filter(a=>!a.visits).length;
 return {action:summary.candidates[0].action,summary,elapsedMs:finished-started,generationMs:generatedAt-started,
  searchMs:finished-generatedAt,roots:floor,iterations:search.iterations,unvisited,
  floorOverrun:arm.timeMs!==undefined&&search.iterations===floor&&finished-started>arm.timeMs};
}

export function play(task,{stepCap=600,onDecision,shouldStop=()=>false,deadlineEpochMs=Infinity,models={},modelIds={}}={}){
 const preparedModels=Object.fromEntries(Object.entries(models).map(([key,model])=>[key,compileModel(model)]));
 const recordedModelIds=Object.fromEntries(Object.entries(preparedModels).map(([key,model])=>[key,modelIds[key]??model.id??null]));
 const started=performance.now();let state=newGame({players:2,starter:task.seed%2,seed:task.seed}),steps=0;
 const diagnostics={candidate:counter(task.candidate.pipeline==='deployed'),opponent:counter(task.opponent.pipeline==='deployed')};
 const decisionTimes={candidate:[],opponent:[]},decisions=[],placements=[],availability=[],seenBirds=[new Set(),new Set()],powerFlows={candidate:{},opponent:{}},actionsByRound={candidate:{},opponent:{}},powerCounts={candidate:{},opponent:{}};
 let currentRole='candidate';
 try{
  while(state.phase!=='gameover'){
   if(shouldStop()||Date.now()>=deadlineEpochMs)return {...task,modelIds:recordedModelIds,status:'deadline',steps,diagnostics,decisionTimes,decisions,placements,elapsedMs:performance.now()-started};
   if(++steps>stepCap)return {...task,modelIds:recordedModelIds,status:'capped',steps,diagnostics,decisionTimes,elapsedMs:performance.now()-started};
   const actor=active(state),role=actor===task.seat?'candidate':'opponent',arm=task[role],d=diagnostics[role];currentRole=role;
   const result=chooseAction(state,arm,{seed:task.seed,step:steps,rolloutStepLimit:task.rolloutStepLimit,models:preparedModels});
   const {action,summary}=result,sd=summary.diagnostics??{};
   d.decisions++;d.iterations+=result.iterations;d.roots+=result.roots;d.unvisited+=result.unvisited;
   d.observationGenerationMs+=result.generationMs;d.searchMs+=result.searchMs;
   for(const k of ['rolloutCount','learnedLeafCount','learnedFallbackCount','safetyCapCount','actionTurns','powerSteps','settledLeaves','terminalReached','horizonReached','steps'])d[k]+=Number(sd[k]??0);
   if(d.unsettledLeaves!==null){d.unsettledLeaves+=Number(sd.unsettledLeaves??0);d.priorRewardSum+=sd.priorRewardSum;d.leafRewardSum+=sd.leafRewardSum;sd.actionTurnsBySeat?.forEach((n,i)=>d.actionTurnsBySeat[i]+=n);}
   if(sd.safetyCapCount||sd.unsettledLeaves)throw Error('Invalid rollout endpoint: capped or unsettled leaf');
   d.requestedTimeOverruns+=Number(arm.timeMs!==undefined&&result.elapsedMs>arm.timeMs);d.coverageFloorOverruns+=Number(result.floorOverrun);
   decisionTimes[role].push(result.elapsedMs);
   const key=String(state.round);actionsByRound[role][key]??={};actionsByRound[role][key][action.type]=(actionsByRound[role][key][action.type]??0)+1;
   if(state.phase==='play')d.mainActions++;
   const code=state.phase==='power'?state.pending[0].code:null;
   if(state.phase==='power'){d.powerDecisions++;powerCounts[role][code]=(powerCounts[role][code]??0)+1;}
   const best=summary.candidates[0],detail={step:steps,actor,role,round:state.round,phase:state.phase,actionType:action.type,
    birdId:action.birdId??null,habitat:action.habitat??null,powerCode:code,skipped:Boolean(action.skip),roots:result.roots,
    iterations:result.iterations,elapsedMs:result.elapsedMs,mean:best.visits?best.sum/best.visits:null,variance:best.variance??null,
    selectedVisits:best.visits,learnedLeafCount:sd.learnedLeafCount??0,learnedFallbackCount:sd.learnedFallbackCount??0,rows:rows(state.players[actor]),priorRewardSum:sd.priorRewardSum??null,leafRewardSum:sd.leafRewardSum??null};
   decisions.push(detail);onDecision?.({state,action,summary,detail});
   for(const id of state.players[actor].hand)if(!seenBirds[actor].has(id)){seenBirds[actor].add(id);availability.push({step:steps,player:actor,round:state.round,id,powerCode:BIRDS[id].powerCode});}
   const beforeResources=resources(state.players[actor]);
   const before=state.players.map(p=>new Set(Object.values(p.habitats).flat().map(e=>e.id)));
   try{state=applyAction(state,action);assertValid(state);}catch(error){d.illegalActions++;throw error;}
   if(code!==null){const flow=powerFlows[role][code]??={count:0,food:0,eggs:0,hand:0,cached:0,tucked:0};flow.count++;const afterResources=resources(state.players[actor]);for(const key of Object.keys(beforeResources))flow[key]+=afterResources[key]-beforeResources[key];}
   for(let p=0;p<2;p++)for(const [habitat,row]of Object.entries(state.players[p].habitats))for(const e of row)if(!before[p].has(e.id))placements.push({step:steps,player:p,round:detail.round,id:e.id,name:BIRDS[e.id].name,habitat});
  }
  const scores=state.players.map(p=>scorePlayer(p).total),scoreComponents=state.players.map(scorePlayer);
  return {...task,modelIds:recordedModelIds,status:'complete',illegalActions:0,errors:0,steps,scores,scoreComponents,margin:scores[task.seat]-scores[1-task.seat],winShare:finalOutcome(state.players)[task.seat],
   diagnostics,decisionTimes,decisions,placements,availability,actionsByRound,powerCounts,powerFlows,elapsedMs:performance.now()-started};
 }catch(error){diagnostics[currentRole].errors++;return {...task,modelIds:recordedModelIds,status:'failed',steps,diagnostics,decisionTimes,decisions,placements,error:error.stack,elapsedMs:performance.now()-started};}
}
