import {publicObservation,seededRandom} from '../../wingspan/core.js';
import {determinize} from '../../wingspan/belief.js';
import {evaluateLeaf} from '../../wingspan/leaf-evaluators.js';
import {FEATURE_VERSION,encodeObservation} from './encoder.mjs';
import {buildAuxTargets} from '../wingspan-neural/targets.mjs';
import {play} from './game.mjs';

export function observationBaseline(observation,viewer,seed,worlds=4){
 if(!Number.isInteger(worlds)||worlds<1||worlds>128)throw Error('Invalid observation baseline worlds');
 const rng=seededRandom(seed>>>0);let total=0;
 for(let i=0;i<worlds;i++){const s=determinize(observation,rng);total+=evaluateLeaf(s,viewer,'opening-plan')-evaluateLeaf(s,1-viewer,'opening-plan');}
 return total/worlds;
}
/** Full actual trajectories only; imagined-world outcomes never become labels. */
export function collectGame(task,options={}){
 if(!task?.id||!Number.isSafeInteger(task.seed)||!['calibration','train','dev','audit'].includes(task.split)||!Number.isInteger(task.generation)||task.generation<0)throw Error('Invalid self-play collection task');
 const valueExamples=[],teacherDecisions=[];
 const result=play(task,{...options,onDecision:({state,action,summary,detail})=>{
  if(state.phase==='play'&&!state.pending.length&&!state.turnContext)for(const viewer of [0,1]){
   const observation=publicObservation(state,viewer),features=encodeObservation(observation,viewer);
   const baselineSeed=(task.seed^Math.imul(detail.step,2654435761)^Math.imul(viewer+1,2246822519)^0x85ebca6b)>>>0;
   valueExamples.push({gameId:task.id,setupSeed:task.seed,split:task.split,generation:task.generation,step:detail.step,viewer,actor:detail.actor,round:state.round,phase:state.phase,
    featureVersion:FEATURE_VERSION,features,observation,baselineMargin:observationBaseline(observation,viewer,baselineSeed),baselineSeed,baselineSource:'4world-observation-belief'});
  }
  // Candidate lists can reveal the acting player's hand. They stay separate.
  teacherDecisions.push({...detail,viewer:detail.actor,actor:detail.actor,observation:publicObservation(state,detail.actor),action:structuredClone(action),candidates:summary.candidates});
  options.onDecision?.({state,action,summary,detail});
 }});
 if(result.validation.valid){for(const e of valueExamples){e.targetMargin=result.scores[e.viewer]-result.scores[1-e.viewer];e.targetAux=buildAuxTargets(result.scoreComponents,e.viewer);}}
 const issues=[...result.validation.issues];if(result.validation.valid&&!valueExamples.length)issues.push('no-value-examples');
 const validation={valid:result.validation.valid&&!issues.length,issues};
 return {id:task.id,task,result,valueExamples,teacherDecisions,validation,elapsedMs:result.elapsedMs};
}
