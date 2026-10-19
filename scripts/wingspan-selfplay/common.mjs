import {readFileSync,readdirSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const read=path=>JSON.parse(readFileSync(path,'utf8'));
export function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
export const objectHash=value=>hash(JSON.stringify(canonical(value)));
export function atomic(path,value){mkdirSync(dirname(path),{recursive:true});const tmp=path+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(value,null,2));for(let attempt=0;;attempt++){try{renameSync(tmp,path);return;}catch(e){if(!['EBUSY','EPERM','EACCES'].includes(e.code)||attempt===5)throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20*2**attempt);}}}
export function sourceHashes(){const files=[];function walk(dir){for(const e of readdirSync(resolve(ROOT,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()&&e.name!=='__pycache__')walk(p);else if(/\.(mjs|js|json|py)$/.test(p))files.push(p);}}for(const d of ['wingspan','scripts/wingspan-study','scripts/wingspan-neural','scripts/wingspan-selfplay'])walk(d);files.push('docs/plans/wingspan-selfplay-loop-2026-10-19.md');return Object.fromEntries(files.sort().map(p=>[p,hash(readFileSync(resolve(ROOT,p)))]));}
export function guard(hashes){for(const [p,h] of Object.entries(hashes))if(hash(readFileSync(resolve(ROOT,p)))!==h)throw Error('Frozen source/model changed: '+p);}
// Scheduler metadata is deliberately excluded. Every other planned field is frozen.
export function frozenTask(task){return Object.fromEntries(Object.entries(task).filter(([k])=>!['startedAt','workerId','attempt','finishedAt'].includes(k)));}
export function validateRecord(record,task){
 const issues=[];if(!record||!task)return ['missing record/task'];if(objectHash(frozenTask(record.task??record))!==objectHash(frozenTask(task)))issues.push('task identity mismatch');const r=record.result??record;
 if(r.status!=='complete')issues.push('game not complete');for(const v of [record.validation,r.validation])if(v?.valid!==true||v.issues?.length)issues.push('validation not valid');
 if(!Number.isFinite(record.elapsedMs??r.elapsedMs)||(record.elapsedMs??r.elapsedMs)<0)issues.push('invalid elapsed time');
 const scoresValid=Array.isArray(r.scores)&&r.scores.length===2&&r.scores.every(Number.isFinite),foodValid=Array.isArray(r.finalFood)&&r.finalFood.length===2&&r.finalFood.every(n=>Number.isSafeInteger(n)&&n>=0);
 if(!scoresValid||!foodValid||!Number.isFinite(r.margin)||scoresValid&&r.margin!==r.scores[task.seat]-r.scores[1-task.seat])issues.push('invalid scores/margin/food');
 if(scoresValid&&foodValid){const margin=r.scores[task.seat]-r.scores[1-task.seat],tieFood=r.finalFood[task.seat]-r.finalFood[1-task.seat],winner=Math.sign(margin||tieFood),expected=winner>0?1:winner<0?0:.5;if(r.winShare!==expected)issues.push('outcome/tiebreak mismatch');}
 for(const k of ['illegalActions','errors'])if(r[k]!==0)issues.push('nonzero/missing '+k);
 for(const side of ['candidate','opponent']){
  const d=r.diagnostics?.[side],a=task[side],times=r.decisionTimes?.[side];
  for(const k of ['decisions','iterations','roots','rolloutCount','settledLeaves','mainActions','learnedLeafCount','learnedFallbackCount'])if(!Number.isSafeInteger(d?.[k])||d[k]<0)issues.push(side+' invalid '+k);
  if(!(d?.decisions>0)||!(d?.roots>=d?.decisions)||!(d?.iterations>=d?.roots)||d?.rolloutCount!==d?.iterations||d?.settledLeaves!==d?.rolloutCount||d?.mainActions!==26)issues.push(side+' rollout/26-action accounting');
  for(const k of ['unvisited','safetyCapCount','unsettledLeaves','illegalActions','errors'])if(d?.[k]!==0)issues.push(side+' nonzero/missing '+k);
  if(!Array.isArray(times)||times.length!==d?.decisions||!times.length||times.some(t=>!Number.isFinite(t)||t<0))issues.push(side+' invalid decision timing');
  if(a?.method==='residual'){
   if(d?.learnedLeafCount+d?.learnedFallbackCount!==d?.rolloutCount)issues.push(side+' learned accounting');
   const modelPath=task.modelPaths?.[a.modelId];let expected;try{expected=modelPath?read(modelPath).id:undefined;}catch{issues.push(side+' unreadable expected model');}
   if(typeof expected!=='string'||r.modelIds?.[a.modelId]!==expected)issues.push(side+' expected model id mismatch');
  }else if(d?.learnedLeafCount!==0||d?.learnedFallbackCount!==0)issues.push(side+' reference learned count');
 }
 return issues;
}
const RESULT_FIELDS=['status','validation','scores','scoreComponents','finalFood','margin','winShare','diagnostics','decisionTimes','modelIds','errors','illegalActions'];
export function compactRecord(record,rawSha256){const r=record.result??record;return {task:frozenTask(record.task??record),result:Object.fromEntries(RESULT_FIELDS.filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]])),validation:record.validation??r.validation,elapsedMs:record.elapsedMs??r.elapsedMs,exampleCount:record.valueExamples?.length??record.exampleCount??0,rawSha256};}
export function verifyRawRecord(summary,path){if(!/^[a-f0-9]{64}$/.test(summary.rawSha256??'')||hash(readFileSync(path))!==summary.rawSha256)throw Error('Retained raw data hash mismatch: '+path);}
