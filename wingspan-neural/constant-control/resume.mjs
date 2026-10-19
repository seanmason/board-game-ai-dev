/** External preparation/control runner. Default mode cannot create game workers. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setPriority,constants} from 'node:os';
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';
import {CONTROL,RUNTIME,SOURCE,read,hash,write,buildZeroModel,tasks,auditSeeds,assertExecutionAllowed,guard} from './support.mjs';
const fileHash=p=>hash(readFileSync(p));
const moduleURL=(root,path)=>pathToFileURL(resolve(root,path));
export async function execute({approved=false}={}){
 const prepared=read(resolve(CONTROL,'repair-resume-prepared.json'));assertOriginal(prepared);if(!approved)throw Error('Explicit coordinator mechanical-resume signal required');
 const receipt=resolve(CONTROL,'repair-resume-execution.json');if(existsSync(receipt))throw Error('Mechanical resume receipt already exists');
 const plan=read(resolve(CONTROL,'plan.json'));guard(plan);const original=read(resolve(CONTROL,'execution-receipt.json'));
 const started=Date.parse(original.startedAt),deadline=Date.parse(original.deadline),admission=admitResume(plan,deadline);
 setPriority(0,constants.priority.PRIORITY_BELOW_NORMAL);
 writeFileSync(receipt,JSON.stringify({kind:'mechanical-transport-validation-repair',resumedAt:new Date().toISOString(),startedAt:original.startedAt,deadline:original.deadline,originalReceiptSha256:prepared.originalReceiptSha256,sourceSha256:fileHash(resolve(CONTROL,'resume.mjs')),preparedSha256:fileHash(resolve(CONTROL,'repair-resume-prepared.json')),planSha256:original.planSha256,modelHashes:plan.modelHashes,workers:24,pid:process.pid,admission},null,2)+'\n',{flag:'wx'});
 const [{runBatch},{validateResult},{summarize}]=await Promise.all([
  import(moduleURL(plan.sourceRoot,'scripts/wingspan-overnight/runtime.mjs')),
  import(moduleURL(plan.sourceRoot,'scripts/wingspan-neural/analyze.mjs')),
  import(moduleURL(plan.sourceRoot,'scripts/wingspan-study/analyze.mjs'))]);
 const out=resolve(CONTROL,'results');let records=[],status='running';
 const validate=makeValidator(plan,validateResult);
 const progressUpdate=(rs,active=[])=>{records=rs;write(resolve(CONTROL,'repair-resume-checkpoint.json'),{status,stage:'constant-attribution',startedAt:new Date(started).toISOString(),deadline:new Date(deadline).toISOString(),planned:64,finished:rs.length,active,workers:24,modelHashes:plan.modelHashes});};
 function summary(){
  const valid=[],issues=[];for(const r of records){const t=plan.tasks.find(t=>t.id===r.id),es=t?validate(r,t):['unexpected-game'];if(es.length)issues.push({id:r.id,issues:es});else valid.push(r);}
  const pairs=[];for(const seed of [...new Set(plan.tasks.map(t=>t.seed))]){const rs=valid.filter(r=>r.seed===seed);if(rs.length===2&&new Set(rs.map(r=>r.seat)).size===2)pairs.push({seed,share:(rs[0].winShare+rs[1].winShare)/2,margin:(rs[0].margin+rs[1].margin)/2});}
  const latency=side=>{const times=valid.flatMap(r=>r.decisionTimes[side]).sort((a,b)=>a-b);return {n:times.length,meanMs:times.length?times.reduce((a,b)=>a+b)/times.length:null,p95Ms:times.length?times[Math.ceil(times.length*.95)-1]:null,maxMs:times.at(-1)??null,iterations:valid.reduce((n,r)=>n+r.diagnostics[side].iterations,0),learnedLeafCount:valid.reduce((n,r)=>n+r.diagnostics[side].learnedLeafCount,0),learnedFallbackCount:valid.reduce((n,r)=>n+r.diagnostics[side].learnedFallbackCount,0)};};
  return {purpose:'Descriptive/exploratory constant-value attribution only; no promotion claim.',status,complete:status==='finished'&&records.length===64&&valid.length===64&&pairs.length===32&&!issues.length,planned:64,received:records.length,valid:valid.length,independentPairs:pairs.length,issues,missing:plan.tasks.filter(t=>!records.some(r=>r.id===t.id)).map(t=>t.id),
   realModelWinnerShare:summarize(pairs.map(p=>p.share),{bounds:[0,1],alpha:.05}),realModelScoreMargin:summarize(pairs.map(p=>p.margin),{alpha:.05}),latency:{real:latency('candidate'),zero:latency('opponent')},pairs,modelHashes:plan.modelHashes,adoptionRecommended:false,productionDefaultsChanged:false};
 }
 try{
  progressUpdate([]);const result=await runBatch({tasks:plan.tasks,out,workers:24,deadline,workerURL:new URL('./worker.mjs',import.meta.url),validate,check:()=>guard(plan),onProgress:progressUpdate});
  status=result.complete?'finished':'deadline';records=result.results;progressUpdate(records);write(resolve(CONTROL,'repair-resume-analysis.json'),summary());
  if(!result.complete)process.exitCode=2;
 }catch(error){status='interrupted';progressUpdate(records);write(resolve(CONTROL,'repair-resume-analysis.json'),summary());write(resolve(CONTROL,'repair-resume-failure.json'),{error:error.stack,at:new Date().toISOString(),completedRecordsPreserved:true});throw error;}
}

export function plannedIssues(plan,r,t){
 const canonical=plan.tasks.find(x=>x.id===t?.id);if(!canonical)return ['unplanned-task'];
 const issues=[];for(const key of Object.keys(canonical)){
 if(!isDeepStrictEqual(t?.[key],canonical[key]))issues.push('scheduling-plan-'+key);
 if(!isDeepStrictEqual(r?.[key],canonical[key]))issues.push('frozen-task-'+key);
 }return issues;
}
export function makeValidator(plan,validateResult){return (r,t)=>{
 const canonical=plan.tasks.find(x=>x.id===t?.id);const issues=canonical?validateResult(r,canonical):['unplanned-task'];issues.push(...plannedIssues(plan,r,t));
 for(const key of ['neural','linear'])if(r?.modelIds?.[key]!==plan.modelHashes[key])issues.push('actual-model-sha-'+key);
 for(const side of ['candidate','opponent']){const d=r?.diagnostics?.[side];if(d?.mainActions!==26)issues.push(side+'-ordinary-action-count');if(d?.actionTurnsBySeat?.reduce((a,b)=>a+b,0)!==d?.actionTurns)issues.push(side+'-action-seat-count');}
 return issues;
};}
const originalNames=['execution-receipt.json','failure.json','checkpoint.json','analysis.json'];
function retained(){return readdirSync(resolve(CONTROL,'results/games')).filter(x=>x.endsWith('.json')).sort().map(name=>({name,sha256:fileHash(resolve(CONTROL,'results/games',name))}));}
export function originalClock(receipt){if(receipt.startedAt!=='2026-10-19T13:56:48.668Z'||receipt.deadline!=='2026-10-19T14:11:48.668Z')throw Error('Original clock changed');return {started:Date.parse(receipt.startedAt),deadline:Date.parse(receipt.deadline)};}
export function admitResume(plan,deadline,now=Date.now()){
 const remaining=plan.tasks.length-retained().length;
 const estimateMs=Math.ceil(remaining/24)*plan.estimate.canaryMaxMs*1.5;
 if(deadline-now<estimateMs)throw Error('Remaining ORIGINAL deadline does not fit conservative remaining-wave timing: '+JSON.stringify({remainingMs:deadline-now,estimateMs}));
 return {remainingTasks:remaining,remainingMs:deadline-now,estimateMs,method:'ceil(remainingTasks/24)*frozen-canary-max*1.5; no outcomes used',deadline:new Date(deadline).toISOString()};
}
export function assertOriginal(prepared){
 const plan=read(resolve(CONTROL,'plan.json'));guard(plan);
 if(fileHash(resolve(CONTROL,'plan.json'))!=='9041b65d0911148c8cb360244bcc5704f6d7349ad7b268048fc55e290dda6a39')throw Error('Plan changed');
 const original=read(resolve(CONTROL,'execution-receipt.json'));originalClock(original);
 const first=read(resolve(CONTROL,'failure.json')).error.split(/\r?\n/)[0];if(!/^Error: Invalid game .*: frozen-task-startedAt$/.test(first))throw Error('Failure not exact transient-startedAt defect');
 const pid=execFileSync('powershell.exe',['-NoProfile','-Command','[bool](Get-Process -Id '+original.pid+' -ErrorAction SilentlyContinue)'],{encoding:'utf8'}).trim();if(pid!=='False')throw Error('Original PID is not confirmed dead');
 if(read(resolve(RUNTIME,'pilot-result.json')).status!=='finished'||read(resolve(RUNTIME,'progress.json')).status!=='finished')throw Error('Fixed pilot not completed');
 if(fileHash(resolve(RUNTIME,'pilot-result.json'))!==original.pilotResultSha256)throw Error('Pilot result changed');
 if(prepared){for(const [name,sha]of Object.entries(prepared.originalHashes))if(fileHash(resolve(CONTROL,name))!==sha)throw Error('Original artifact changed: '+name);if(!isDeepStrictEqual(retained(),prepared.retained))throw Error('Retained inventory changed');if(fileHash(resolve(CONTROL,'resume.mjs'))!==prepared.sourceSha256||fileHash(resolve(CONTROL,'resume-tests.mjs'))!==prepared.testsSha256)throw Error('Repair source/test changed');}
 return plan;
}
export async function prepare(){
 if(existsSync(resolve(CONTROL,'repair-resume-prepared.json')))throw Error('Repair already prepared; frozen');
 const plan=assertOriginal();const original=read(resolve(CONTROL,'execution-receipt.json'));const {deadline}=originalClock(original);
 const {validateResult}=await import(moduleURL(plan.sourceRoot,'scripts/wingspan-neural/analyze.mjs'));const validate=makeValidator(plan,validateResult);
 for(const {name}of retained()){const r=read(resolve(CONTROL,'results/games',name));const t=plan.tasks.find(t=>t.id===r.id);const issues=validate(r,t);if(issues.length)throw Error('Invalid retained record '+issues.join(','));}
 if(plan.tasks.length!==64||retained().length!==1)throw Error('Expected unchanged 64 tasks and one retained game');
 const admission=admitResume(plan,deadline);const prepared={status:'prepared-only',kind:'mechanical-transport-validation-repair',preparedAt:new Date().toISOString(),startedAt:original.startedAt,deadline:original.deadline,planSha256:fileHash(resolve(CONTROL,'plan.json')),originalReceiptSha256:fileHash(resolve(CONTROL,'execution-receipt.json')),originalHashes:Object.fromEntries(originalNames.map(name=>[name,fileHash(resolve(CONTROL,name))])),retained:retained(),sourceSha256:fileHash(resolve(CONTROL,'resume.mjs')),testsSha256:fileHash(resolve(CONTROL,'resume-tests.mjs')),admission};
 writeFileSync(resolve(CONTROL,'repair-resume-prepared.json'),JSON.stringify(prepared,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(prepared));return prepared;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=new Set(process.argv.slice(2));if(args.has('--execute'))await execute({approved:args.has('--approved-mechanical-resume')});else await prepare();}
