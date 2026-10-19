/** Research-only actual game runner. Rules/complete human actions are shared. */
import {performance} from 'node:perf_hooks';
import {newGame,applyAction,assertValid,publicObservation,seededRandom,ROUND_ACTIONS} from '../../wingspan/core.js';
import {candidateActions} from '../../wingspan/actions.js';
import {openingSetupActions} from '../../wingspan/opening-strategy.js';
import {scorePlayer,finalOutcome,FOOD} from '../../wingspan/scoring.js';
import {compileModel} from './inference.mjs';
import * as api from './search.mjs';

export const activePlayer=s=>s.phase==='power'?s.pending[0].owner:s.currentPlayer;
export function normalizeArm(a={}){
 const arm={method:'reference',budget:100,horizon:4,...a};
 if(!['reference','residual'].includes(arm.method)||![100,300].includes(arm.budget)||arm.horizon!==4)throw Error('Unsupported self-play arm');
 if(arm.method==='residual'&&(typeof arm.modelId!=='string'||!arm.modelId))throw Error('Residual arm requires a model id');
 if(arm.timeMs!==undefined&&(!Number.isFinite(arm.timeMs)||arm.timeMs<=0||arm.timeMs>5000))throw Error('Invalid whole-decision time');
 for(const key of ['pipeline','blend','priorWeight','policy'])if(key in a)throw Error('Unsupported self-play override '+key);
 return arm;
}
export function chooseAction(state,arm,{seed=1,step=1,models={},clock=()=>performance.now(),iterations,explorationRng,exploration}={}){
 arm=normalizeArm(arm);const started=clock(),actor=activePlayer(state),observation=publicObservation(state,actor);
 const original=candidateActions(state),choices=state.phase==='setup'?openingSetupActions(state,original):original;
 if(!choices.length)throw Error('No legal representative search choices');
 const generated=clock(),model=arm.method==='residual'?compileModel(models[arm.modelId]):undefined;
 const search=api.createSearch(observation,choices,{rng:seededRandom((seed^Math.imul(step,193)^Math.imul(actor+1,982451653))>>>0),method:arm.method,model,horizon:4,rolloutStepLimit:192,diagnostics:true});
 const floor=choices.length;
 if(iterations!==undefined){if(!Number.isInteger(iterations)||iterations<floor)throw Error('Replay iteration count below coverage');api.runSearch(search,iterations);}
 else if(arm.timeMs!==undefined){while(search.iterations<floor||clock()-started<arm.timeMs)api.runSearch(search,1);}
 else api.runSearch(search,Math.max(floor,arm.budget));
 const summary=api.searchSummary(search),finished=clock();
 let selected=summary.candidates[0],explored=false;
 if(exploration&&explorationRng&&state.phase==='play'&&ROUND_ACTIONS[state.round-1]-state.remaining[actor]<exploration.earlyActionsPerRound){
  const best=selected.sum/selected.visits,eligible=summary.candidates.filter(c=>c.visits>0&&best-c.sum/c.visits<=exploration.safetyMargin);
  const weights=eligible.map(c=>Math.exp((c.sum/c.visits-best)/exploration.temperature));let target=explorationRng()*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<eligible.length;i++){target-=weights[i];if(target<=0){selected=eligible[i];break;}}
  explored=selected!==summary.candidates[0];
 }
 return {action:selected.action,summary,elapsedMs:finished-started,generationMs:generated-started,searchMs:finished-generated,roots:floor,iterations:search.iterations,
  unvisited:search.arms.filter(a=>a.visits===0).length,explored,selectedVisits:selected.visits,
  floorOverrun:arm.timeMs!==undefined&&search.iterations===floor&&finished-started>arm.timeMs};
}
const counters=()=>({decisions:0,iterations:0,roots:0,unvisited:0,rolloutCount:0,learnedLeafCount:0,learnedFallbackCount:0,safetyCapCount:0,unsettledLeaves:0,settledLeaves:0,illegalActions:0,errors:0,mainActions:0,powerDecisions:0,observationGenerationMs:0,searchMs:0,coverageFloorOverruns:0,determinizationMs:0,generationMs:0,transitionMs:0,evaluationMs:0});
export function play(task,{models={},deadlineEpochMs=Infinity,stepCap=600,onDecision,createGame=newGame,choose=chooseAction}={}){
 const started=performance.now(),prepared=Object.fromEntries(Object.entries(models).map(([id,m])=>[id,compileModel(m)]));
 let state=createGame({players:2,starter:task.seed%2,seed:task.seed}),step=0,role='candidate';
 const diagnostics={candidate:counters(),opponent:counters()},decisionTimes={candidate:[],opponent:[]},decisions=[],issues=[];
 const budgets=seededRandom(task.budgetSeed??((task.seed^0x5f3759df)>>>0)),explore=seededRandom((task.seed^0x7f4a7c15)>>>0);
 try{
  assertValid(state);
  while(state.phase!=='gameover'){
   if(Date.now()>=deadlineEpochMs){issues.push('deadline');break;}
   if(++step>stepCap){issues.push('actual-game-step-cap');break;}
   const actor=activePlayer(state);role=actor===task.seat?'candidate':'opponent';
   const base=normalizeArm(task[role]),budget=task.budgetDistribution?(budgets()<.8?100:300):base.budget;
   const arm={...base,budget};if(task.budgetDistribution)delete arm.timeMs;
   const result=choose(state,arm,{seed:task.seed,step,models:prepared,explorationRng:explore,exploration:task.exploration});
   const d=diagnostics[role],sd=result.summary.diagnostics??{};d.decisions++;d.iterations+=result.iterations;d.roots+=result.roots;d.unvisited+=result.unvisited;
   d.observationGenerationMs+=result.generationMs;d.searchMs+=result.searchMs;d.coverageFloorOverruns+=Number(result.floorOverrun);
   for(const key of ['rolloutCount','learnedLeafCount','learnedFallbackCount','safetyCapCount','unsettledLeaves','settledLeaves','determinizationMs','generationMs','transitionMs','evaluationMs'])d[key]+=sd[key]??0;
   if(sd.safetyCapCount||sd.unsettledLeaves||result.unvisited)throw Error('Invalid search coverage or endpoint');
   if(state.phase==='play')d.mainActions++;if(state.phase==='power')d.powerDecisions++;
   decisionTimes[role].push(result.elapsedMs);
   const detail={step,actor,role,round:state.round,phase:state.phase,powerCode:state.phase==='power'?state.pending[0].code:null,action:structuredClone(result.action),requestedBudget:budget,
    iterations:result.iterations,roots:result.roots,elapsedMs:result.elapsedMs,generationMs:result.generationMs,searchMs:result.searchMs,explored:result.explored,selectedVisits:result.selectedVisits,modelId:arm.modelId??null,searchDiagnostics:sd};
   decisions.push(detail);onDecision?.({state,action:result.action,summary:result.summary,detail});
   try{state=applyAction(state,result.action);assertValid(state);}catch(e){d.illegalActions++;throw e;}
  }
 }catch(error){diagnostics[role].errors++;issues.push(error.stack??String(error));}
 const complete=state.phase==='gameover'&&!issues.length;
 const scoreComponents=complete?state.players.map(scorePlayer):null,scores=scoreComponents?.map(s=>s.total)??null;
 return {...task,status:complete?'complete':issues.includes('deadline')?'deadline':'failed',validation:{valid:complete,issues},elapsedMs:performance.now()-started,steps:step,
  scores,scoreComponents,finalFood:complete?state.players.map(p=>FOOD.map(f=>p.food[f]).reduce((a,b)=>a+b,0)):null,margin:complete?scores[task.seat]-scores[1-task.seat]:null,
  winShare:complete?finalOutcome(state.players)[task.seat]:null,illegalActions:diagnostics.candidate.illegalActions+diagnostics.opponent.illegalActions,
  errors:diagnostics.candidate.errors+diagnostics.opponent.errors,diagnostics,decisionTimes,decisions,modelIds:Object.fromEntries(Object.entries(prepared).map(([id,m])=>[id,m.id]))};
}
