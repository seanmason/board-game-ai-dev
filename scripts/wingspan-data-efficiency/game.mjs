import {play as incumbentPlay} from '../wingspan-selfplay/game.mjs';
import {createActor,normalizeGenerator} from './actor.mjs';

/** Adapt existing callback API without changing its arm or trainer schemas. */
export function actorOptions(task,options={}){
 const modes=new Map(),choose=options.choose??createActor(task);
 return {modes,options:{...options,choose:(state,arm,context)=>{
  const result=choose(state,arm,context);modes.set(context.step,{generator:task.generator??'baseline',actorMode:result.actorMode??'searched',oneStepEvaluations:result.oneStepEvaluations??0});return result;
 }}};
}
export function annotateResult(task,result,modes){
 const config=normalizeGenerator(task),d={...config,cheapDecisions:0,searchedDecisions:0,cheapMainDecisions:0,cheapPowerDecisions:0,oneStepEvaluations:0,searchedIterations:0,cheapPriorEvaluations:0,roots:0,iterations:0,rolloutCount:0,learnedLeafCount:0,rootTransitions:0,powerSteps:0,subsequentMainTransitions:0,elapsedMs:0,gameElapsedMs:result.elapsedMs,generationMs:0,searchMs:0};
 for(const detail of result.decisions){
  Object.assign(detail,modes.get(detail.step));const cheap=detail.actorMode.startsWith('cheap');
  d[cheap?'cheapDecisions':'searchedDecisions']++;if(cheap)d[detail.phase==='power'?'cheapPowerDecisions':'cheapMainDecisions']++;
  if(!cheap)d.searchedIterations+=detail.iterations;if(detail.actorMode==='cheap-prior')d.cheapPriorEvaluations+=detail.roots;
  for(const k of ['oneStepEvaluations','roots','iterations','elapsedMs','generationMs','searchMs'])d[k]+=detail[k]??0;
  for(const k of ['rolloutCount','learnedLeafCount','powerSteps'])d[k]+=detail.searchDiagnostics[k]??0;
  d.rootTransitions+=detail.searchDiagnostics.rootTransitions??detail.searchDiagnostics.rolloutCount??0;
  if(!cheap)d.subsequentMainTransitions+=detail.searchDiagnostics.actionTurns??0;
 }
 result.generator=config.generator;result.collectionDiagnostics=d;return result;
}
export function play(task,options={}){
 const a=actorOptions(task,options);return annotateResult(task,incumbentPlay(task,a.options),a.modes);
}
