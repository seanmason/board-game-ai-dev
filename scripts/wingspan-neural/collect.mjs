import {performance} from 'node:perf_hooks';
import {newGame,applyAction,assertValid,publicObservation,seededRandom} from '../../wingspan/core.js';
import {scorePlayer,finalOutcome} from '../../wingspan/scoring.js';
import {determinize} from '../../wingspan/belief.js';
import {evaluateLeaf} from '../../wingspan/leaf-evaluators.js';
import {chooseAction} from '../wingspan-study/game.mjs';
import {encodeObservation,FEATURE_VERSION} from './encoder.mjs';
import {buildAuxTargets} from './targets.mjs';
const actor=s=>s.phase==='power'?s.pending[0].owner:s.currentPlayer;
function observationBaseline(observation,viewer,seed){
 const rng=seededRandom(seed>>>0);let margin=0;
 for(let i=0;i<4;i++){const s=determinize(observation,rng);margin+=evaluateLeaf(s,viewer,'opening-plan')-evaluateLeaf(s,1-viewer,'opening-plan');}
 return margin/4;
}
/** Immutable actual rules trajectory. Injected createGame/choose hooks are for
 * tiny functional fixtures only; the coordinator records canonical source hashes.
 * Teacher candidate actions stay solely in ACTING-viewer decision records.
 */
export function collectGame(task,{stepCap=600,choose=chooseAction,createGame=newGame,onDecision,clock=()=>performance.now(),deadlineEpochMs=Infinity,wallClock=()=>Date.now()}={}){
 if(!task?.id||!Number.isSafeInteger(task.seed)||!['calibration','train','dev','test'].includes(task.split))throw Error('Invalid neural collection task');
 const started=clock(),valueExamples=[],teacherDecisions=[],issues=[];
 const budgetSeed=task.budgetSeed??((task.seed^0x5f3759df)>>>0),budgetRng=seededRandom(budgetSeed);
 let state=createGame({players:2,starter:task.seed%2,seed:task.seed}),step=0,result=null;
 try{
  assertValid(state);
  while(state.phase!=='gameover'){
   if(wallClock()>=deadlineEpochMs){issues.push('deadline');break;}
   if(step>=stepCap){issues.push('actual-game-step-cap');break;}step++;
   const active=actor(state);
   if(state.phase==='play'&&!state.pending.length&&!state.turnContext){
    for(const viewer of [0,1]){
     const observation=publicObservation(state,viewer),features=encodeObservation(observation,viewer);
     const baselineSeed=(task.seed^Math.imul(step,2654435761)^Math.imul(viewer+1,2246822519)^0x85ebca6b)>>>0;
     valueExamples.push({gameId:task.id,setupSeed:task.seed,split:task.split,step,viewer,actor:active,round:state.round,phase:state.phase,featureVersion:FEATURE_VERSION,features,observation,
      baselineMargin:observationBaseline(observation,viewer,baselineSeed),baselineSource:'4world-observation-belief'});
    }
   }
   const budget=budgetRng()<.8?100:300,arm={...task.teacherConfig,method:'reference',pipeline:'deployed',budget,horizon:4};
   // Disallow accidental time-mode override of the declared randomized budget.
   delete arm.timeMs;
   const decision=choose(state,arm,{seed:task.seed,step,rolloutStepLimit:192});
   const sd=decision.summary?.diagnostics??{},candidates=decision.summary?.candidates;
   if(!decision.action||!Array.isArray(candidates)||!candidates.length)throw Error('Teacher omitted complete search roots');
   const unvisited=decision.unvisited??candidates.filter(c=>!c.visits).length;
   if(unvisited)issues.push('teacher-unvisited-roots');
   if(sd.safetyCapCount)issues.push('teacher-rollout-safety-cap');
   if(decision.iterations<Math.max(budget,decision.roots??candidates.length))issues.push('teacher-coverage-or-budget-floor');
   const observation=publicObservation(state,active);
   encodeObservation(observation,active); // Enforce the same privacy contract.
   teacherDecisions.push({gameId:task.id,setupSeed:task.seed,split:task.split,step,viewer:active,actor:active,round:state.round,phase:state.phase,observation,
    requestedBudget:budget,actualIterations:decision.iterations,rootCount:decision.roots??candidates.length,unvisited,coverageFloor:Math.max(budget,decision.roots??candidates.length),
    budgetSeed,teacher:{pipeline:'deployed',leafEvaluator:'opening-plan',horizon:4,priorWeight:.18,leafWeight:.82},action:decision.action,candidates,searchDiagnostics:sd,
    elapsedMs:decision.elapsedMs,generationMs:decision.generationMs,searchMs:decision.searchMs});
   onDecision?.({step,actor:active,arm,decision});
   state=applyAction(state,decision.action);assertValid(state);
   if(issues.length)break;
  }
  if(state.phase==='gameover'&&!issues.length){
   const scoreComponents=state.players.map(scorePlayer),scores=scoreComponents.map(s=>s.total);
   for(const e of valueExamples){e.targetMargin=scores[e.viewer]-scores[1-e.viewer];e.targetAux=buildAuxTargets(scoreComponents,e.viewer);}
   result={status:'complete',steps:step,scores,scoreComponents,outcome:finalOutcome(state.players),illegalActions:0,errors:0};
  }else result={status:issues.includes('deadline')?'deadline':'quarantined',steps:step,phase:state.phase,error:issues.join(',')};
 }catch(error){issues.push(error.message);result={status:'quarantined',steps:step,error:error.stack};}
 const valid=result.status==='complete'&&!issues.length;
 if(!valid)for(const e of valueExamples){delete e.targetMargin;delete e.targetAux;}
 return {task,result,valueExamples,teacherDecisions,validation:{valid,issues:[...new Set(issues)]},elapsedMs:clock()-started};
}
