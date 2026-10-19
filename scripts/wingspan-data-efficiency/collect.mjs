import {collectGame as incumbentCollect} from '../wingspan-selfplay/collect.mjs';
import {actorOptions,annotateResult} from './game.mjs';
import {validateRecord} from '../wingspan-selfplay/common.mjs';
import {normalizeGenerator} from './actor.mjs';
export {observationBaseline} from '../wingspan-selfplay/collect.mjs';

/** Preserve real complete-trajectory labels and four-world redacted baselines. */
export function collectGame(task,options={}){
 const a=actorOptions(task,options),record=incumbentCollect(task,a.options);
 annotateResult(task,record.result,a.modes);
 record.generator=record.result.generator;record.collectionDiagnostics=record.result.collectionDiagnostics;
 for(const row of record.teacherDecisions)Object.assign(row,a.modes.get(row.step));
 for(const row of record.valueExamples)Object.assign(row,{generator:record.generator,...a.modes.get(row.step)});
 return record;
}

/** Original score, identity, model, outcome and safety gates still apply. Only
 * prior-only power decisions may have roots without imagined rollouts. */
export function validateDataEfficiencyRecord(record,task){
 const ignored=new Set(['candidate rollout/26-action accounting','opponent rollout/26-action accounting']);
 const issues=validateRecord(record,task).filter(x=>!ignored.has(x)),r=record?.result??record;
 let config;try{config=normalizeGenerator(task);}catch(e){return [...issues,e.message];}
 if(record?.generator!==config.generator||r?.generator!==config.generator)issues.push('generator mismatch');
 const decisions=r?.decisions;if(!Array.isArray(decisions))return [...issues,'missing decision work records'];
 for(const side of ['candidate','opponent']){
  const rows=decisions.filter(x=>x.role===side),d=r.diagnostics?.[side];
  const priorRoots=rows.filter(x=>x.actorMode==='cheap-prior').reduce((n,x)=>n+x.roots,0);
  if(rows.length!==d?.decisions||!(d?.decisions>0)||!(d?.roots>=d?.decisions)||!(d?.iterations>=d?.roots-priorRoots)||d?.rolloutCount!==d?.iterations||d?.settledLeaves!==d?.rolloutCount||d?.mainActions!==26)issues.push(side+' actual rollout/26-action accounting');
  for(const row of rows){
   const sd=row.searchDiagnostics??{};
   if(row.generator!==config.generator||!['searched','cheap-successor','cheap-prior'].includes(row.actorMode))issues.push('invalid decision generator/mode');
   if(config.generator==='baseline'&&row.actorMode!=='searched')issues.push('baseline cheap decision');
   if(row.actorMode==='cheap-successor'&&(row.phase!=='play'||row.oneStepEvaluations!==row.roots||row.iterations!==row.roots||sd.rootTransitions!==row.roots||sd.actionTurns!==row.roots||sd.settledLeaves!==row.roots))issues.push('invalid one-step work');
   if(row.actorMode==='cheap-prior'&&(row.phase!=='power'||row.iterations!==0||row.oneStepEvaluations!==0||sd.rolloutCount!==0))issues.push('invalid power-prior work');
   if(row.actorMode==='searched'&&row.oneStepEvaluations!==0)issues.push('searched one-step count');
  }
 }
 if(decisions.some(x=>!['searched','cheap-successor','cheap-prior'].includes(x.actorMode)))return [...new Set([...issues,'invalid decision work records'])];
 const expected=annotateResult(task,{...r,decisions:structuredClone(decisions)},new Map(decisions.map(x=>[x.step,{generator:x.generator,actorMode:x.actorMode,oneStepEvaluations:x.oneStepEvaluations}]))).collectionDiagnostics;
 if(JSON.stringify(record.collectionDiagnostics)!==JSON.stringify(expected)||JSON.stringify(r.collectionDiagnostics)!==JSON.stringify(expected))issues.push('collection work totals mismatch');
 if(task.kind==='collect'){
  if(!Array.isArray(record.valueExamples)||!record.valueExamples.length||!Array.isArray(record.teacherDecisions)||record.teacherDecisions.length!==decisions.length)issues.push('missing trajectory examples');
  for(const e of record.valueExamples??[]){
   if(e.generator!==config.generator||e.targetMargin!==r.scores?.[e.viewer]-r.scores?.[1-e.viewer]||e.baselineSource!=='4world-observation-belief'||!Number.isFinite(e.baselineMargin)||!Array.isArray(e.targetAux)||e.targetAux.length!==12)issues.push('invalid trajectory label');
  }
 }
 return [...new Set(issues)];
}
