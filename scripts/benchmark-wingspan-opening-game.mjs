/** Frozen, resumable two-player screen. Iterations are truncated belief samples. */
import {performance} from 'node:perf_hooks';
import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newGame,applyAction,assertValid,seededRandom,publicObservation} from '../wingspan/core.js';
import {candidateActions} from '../wingspan/actions.js';
import {openingSetupActions} from '../wingspan/opening-strategy.js';
import {RESOURCE_PROGRESSION} from '../wingspan/core.js';
import {createSearch,runSearch,searchSummary} from '../wingspan/analysis.js';
import {scorePlayer,finalOutcome} from '../wingspan/scoring.js';

/** Expansion is isolated to actual candidate setup roots; rollout action generators are unchanged. */
export function openingChoices(state,task,actor){const choices=candidateActions(state);return actor===task.seat&&state.phase==='setup'&&['setup-only','both'].includes(task.method)?openingSetupActions(state,choices):choices;}
export function recordOpeningPlacements(beforeRows,players,openingMetrics,round){
      for(let i=0;i<players.length;i++)for(const [habitat,row] of Object.entries(players[i].habitats))for(const bird of row){
        if(beforeRows[i][habitat].has(bird.id))continue;
        // Ignore moved existing birds; a new placement was absent from every prior row.
        if(Object.values(beforeRows[i]).some(ids=>ids.has(bird.id)))continue;
        const record={mainAction:openingMetrics[i].mainActions,foodActionsBefore:openingMetrics[i].foodActions,round:round,birdId:bird.id,habitat};
        if(!openingMetrics[i].firstBird)openingMetrics[i].firstBird=record;else if(!openingMetrics[i].secondBird)openingMetrics[i].secondBird=record;
      }
}
export function play(task,{stepCap=600,onEvent}={}){
  let state=newGame({players:2,starter:task.seed%2,seed:task.seed});
  const started=performance.now();let steps=0,iterations=0,searchMs=0,alternatives=0,unvisited=0;
  const counters=()=>({rolloutCount:0,actionTurns:0,horizonReached:0,terminalReached:0,safetyCapCount:0});
  const rolloutDiagnostics={candidate:counters(),opponent:counters()};
  const openingMetrics=state.players.map(()=>({setup:null,mainActions:0,foodActions:0,firstBird:null,secondBird:null,endRound1:null,candidateGenerationMs:0,searchMs:0,alternatives:0,unvisited:0}));
  const snapshot=p=>({score:scorePlayer(p),food:{...p.food},eggs:Object.values(p.habitats).flat().reduce((n,e)=>n+e.eggs,0),rows:Object.fromEntries(Object.entries(p.habitats).map(([h,row])=>[h,row.length])),basicProduction:Object.fromEntries(Object.entries(p.habitats).map(([h,row])=>[h,RESOURCE_PROGRESSION[h][row.length]]))});
  try{
    while(state.phase!=='gameover'){
      if(++steps>stepCap)return {...task,status:'capped',steps,openingMetrics,rolloutDiagnostics,elapsedMs:performance.now()-started};
      const actor=state.phase==='power'?state.pending[0].owner:state.currentPlayer;
      const generationAt=performance.now(),choices=openingChoices(state,task,actor);openingMetrics[actor].candidateGenerationMs+=performance.now()-generationAt;
      const search=createSearch(publicObservation(state,actor),choices,{
        rng:seededRandom((task.seed^Math.imul(steps,193)^Math.imul(actor+1,982451653))>>>0),
        rolloutStepLimit:task.rolloutStepLimit??48,diagnostics:true,
        leafEvaluator:actor===task.seat?(task.evaluator??"current"):(task.opponentEvaluator??"current"),
        method:actor===task.seat?'belief-rollout':task.opponent,horizon:actor===task.seat?(task.horizon??4):(task.opponentHorizon??4)});
      const at=performance.now();runSearch(search,actor===task.seat?task.budget:task.opponentBudget);
      const spent=performance.now()-at;searchMs+=spent;iterations+=search.iterations;openingMetrics[actor].searchMs+=spent;openingMetrics[actor].alternatives+=search.arms.length;openingMetrics[actor].unvisited+=search.arms.filter(a=>!a.visits).length;
      const totals=rolloutDiagnostics[actor===task.seat?'candidate':'opponent'];
      for(const key of Object.keys(totals))totals[key]+=search.diagnostics[key];
      alternatives+=search.arms.length;unvisited+=search.arms.filter(a=>!a.visits).length;
      const summary=searchSummary(search),action=summary.candidates[0].action,metrics=openingMetrics[actor];
      if(action.type==='setup')metrics.setup={keep:[...action.keep],foodDiscard:[...action.foodDiscard],bonusId:action.bonusId};
      if(state.phase==='play'){
        metrics.mainActions++;
        if(action.type==='gainFood')metrics.foodActions++;
      }
      onEvent?.({state,actor,step:steps,action,choices,summary});
      const priorRound=state.round,beforeRows=state.players.map(p=>Object.fromEntries(Object.entries(p.habitats).map(([h,row])=>[h,new Set(row.map(b=>b.id))])));
      state=applyAction(state,action);assertValid(state);
      recordOpeningPlacements(beforeRows,state.players,openingMetrics,priorRound);
      if(action.type==='setup')metrics.setup.foodKept={...state.players[actor].food};
      if(priorRound===1&&state.round>1)for(let i=0;i<state.players.length;i++){openingMetrics[i].endRound1=snapshot(state.players[i]);openingMetrics[i].endRound1.scoreBeforeRoundGoal=openingMetrics[i].endRound1.score.total-(state.players[i].goalPoints[0]??0);}
    }
    const scores=state.players.map(p=>scorePlayer(p).total);
    return {...task,status:'complete',steps,openingMetrics,rolloutDiagnostics,iterations,searchMs,alternatives,unvisited,
      elapsedMs:performance.now()-started,scores,margin:scores[task.seat]-scores[1-task.seat],
      winShare:finalOutcome(state.players)[task.seat]};
  }catch(error){return {...task,status:'failed',steps,openingMetrics,rolloutDiagnostics,elapsedMs:performance.now()-started,error:error.stack};}
}
