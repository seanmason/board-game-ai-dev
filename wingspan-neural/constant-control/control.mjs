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
export async function prepare(){
 if(existsSync(resolve(CONTROL,'plan.json'))){const p=read(resolve(CONTROL,'plan.json'));guard(p);console.log(JSON.stringify({status:'already-prepared-not-launched',planSha256:fileHash(resolve(CONTROL,'plan.json'))}));return p;}
 const pilotSource=read(resolve(RUNTIME,'source-manifest.json')),sourceHashes={...pilotSource.sourceHashes};
 sourceHashes['scripts/wingspan-overnight/runtime.mjs']=fileHash(resolve(SOURCE,'scripts/wingspan-overnight/runtime.mjs'));
 for(const[rel,sha]of Object.entries(sourceHashes))if(fileHash(resolve(SOURCE,rel))!==sha)throw Error('Pilot frozen source changed: '+rel);
 const realBytes=readFileSync(resolve(RUNTIME,'training/mlp.json')),realSha=hash(realBytes),report=read(resolve(RUNTIME,'training/offline-report.json'));
 if(report.selectedModelSha256!==realSha)throw Error('Uncertified real model');
 const real=JSON.parse(realBytes),zero=buildZeroModel(real,realSha);
 mkdirSync(resolve(CONTROL,'models'),{recursive:true});
 writeFileSync(resolve(CONTROL,'models/real-mlp.json'),realBytes,{flag:'wx'});
 write(resolve(CONTROL,'models/zero-output-mlp.json'),zero);
 const modelFiles={neural:'models/real-mlp.json',linear:'models/zero-output-mlp.json'},modelHashes=Object.fromEntries(Object.entries(modelFiles).map(([k,p])=>[k,fileHash(resolve(CONTROL,p))]));
 const audit=auditSeeds();write(resolve(CONTROL,'seed-audit.json'),audit);
 const controlHashes=Object.fromEntries(['control.mjs','support.mjs','worker.mjs','tests.mjs','protocol.md'].map(p=>[p,fileHash(resolve(CONTROL,p))]));
 const canary=read(resolve(RUNTIME,'canary/analysis.json')),canaryFiles=readdirSync(resolve(RUNTIME,'canary/games')).filter(p=>p.endsWith('.json')).map(p=>read(resolve(RUNTIME,'canary/games',p)));
 if(!canary.complete||canaryFiles.length!==8)throw Error('Eight valid pilot canaries required for outcome-blind estimate');
 const maximum=Math.max(...canaryFiles.map(r=>r.elapsedMs)),mean=canaryFiles.reduce((n,r)=>n+r.elapsedMs,0)/8;
 const estimateMs=64*maximum*1.5/24+2*maximum;
 const plan={version:1,revisionAtPreparation:execFileSync('git',['rev-parse','HEAD'],{cwd:SOURCE,encoding:'utf8'}).trim(),revisionIsProvenanceOnly:true,purpose:'Prepared exploratory constant-value attribution; no games launched and no promotion claim.',createdAt:new Date().toISOString(),sourceRoot:SOURCE,runtime:RUNTIME,
  pilotSourceManifestSha256:fileHash(resolve(RUNTIME,'source-manifest.json')),sourceHashes,controlHashes,sourceRealModelSha256:realSha,modelFiles,modelHashes,
  labels:{neural:'real selected MLP',linear:'same-shape zero-output MLP; internal transport slot only, NOT trained ridge'},tasks:tasks(),workers:24,timeMs:1000,horizon:4,rolloutStepLimit:192,maxWallMs:900000,
  seedAuditSha256:fileHash(resolve(CONTROL,'seed-audit.json')),estimate:{method:'64*max(valid canary game)*1.5/24 + 2*max game; timing only, no outcomes used',canaryMeanMs:mean,canaryMaxMs:maximum,projectedMs:estimateMs,admitted:estimateMs<=900000,
   limitations:['Canaries used at most8 simultaneous games; wall-clock decision budgets limit latency but zero-control trajectories and worker contention can differ.','This is a cost projection, not a guaranteed completion time; unfinished fixed N cannot yield a complete result.']},
  execution:'Only after separate explicit coordinator signal and completed fixed pilot; default CLI is prepare-only; existing execution receipt always refuses.'};
 if(!plan.estimate.admitted)throw Error('Timing estimate does not fit the 15-minute bounded control; no execution admission');
 write(resolve(CONTROL,'plan.json'),plan);
 write(resolve(CONTROL,'prepared.json'),{status:'prepared-not-launched',createdAt:new Date().toISOString(),planSha256:fileHash(resolve(CONTROL,'plan.json')),protocolSha256:fileHash(resolve(CONTROL,'protocol.md')),seedAuditSha256:plan.seedAuditSha256,modelHashes});
 const tests=await import(new URL('./tests.mjs',import.meta.url));await tests.runTests(plan,{provisional:true});
 console.log(JSON.stringify({status:'prepared-not-launched',games:64,independentPairs:32,workers:24,maxWallMs:900000,estimateMs:plan.estimate.projectedMs,modelHashes}));return plan;
}
export async function execute({approved=false}={}){
 const receipt=resolve(CONTROL,'execution-receipt.json');
 const pilotResult=existsSync(resolve(RUNTIME,'pilot-result.json'))?read(resolve(RUNTIME,'pilot-result.json')):null;
 const progress=existsSync(resolve(RUNTIME,'progress.json'))?read(resolve(RUNTIME,'progress.json')):null;
 assertExecutionAllowed({pilotResult,progress,approved,receiptExists:existsSync(receipt)});
 const plan=read(resolve(CONTROL,'plan.json'));guard(plan);const freshAudit=auditSeeds();
 if(freshAudit.status!=='passed')throw Error('Fresh seed audit failed');
 setPriority(0,constants.priority.PRIORITY_BELOW_NORMAL);
 const tests=await import(new URL('./tests.mjs',import.meta.url));await tests.runTests(plan,{provisional:false});
 const started=Date.now(),deadline=started+plan.maxWallMs;
 writeFileSync(receipt,JSON.stringify({startedAt:new Date(started).toISOString(),deadline:new Date(deadline).toISOString(),planSha256:fileHash(resolve(CONTROL,'plan.json')),pilotResultSha256:fileHash(resolve(RUNTIME,'pilot-result.json')),approvedAfterFixedPilot:true,workers:24,modelHashes:plan.modelHashes,pid:process.pid},null,2)+'\n',{flag:'wx'});
 write(resolve(CONTROL,'execution-seed-audit.json'),freshAudit);
 const [{runBatch},{validateResult},{summarize}]=await Promise.all([
  import(moduleURL(plan.sourceRoot,'scripts/wingspan-overnight/runtime.mjs')),
  import(moduleURL(plan.sourceRoot,'scripts/wingspan-neural/analyze.mjs')),
  import(moduleURL(plan.sourceRoot,'scripts/wingspan-study/analyze.mjs'))]);
 const out=resolve(CONTROL,'results');let records=[],status='running';
 const validate=(r,t)=>{
  const issues=validateResult(r,t);
  for(const key of ['neural','linear'])if(r?.modelIds?.[key]!==plan.modelHashes[key])issues.push('actual-model-sha-'+key);
  for(const key of Object.keys(t))if(!isDeepStrictEqual(r?.[key],t[key]))issues.push('frozen-task-'+key);
  for(const side of ['candidate','opponent']){
   const d=r?.diagnostics?.[side];if(d?.mainActions!==26)issues.push(side+'-ordinary-action-count');
   if(d?.actionTurnsBySeat?.reduce((a,b)=>a+b,0)!==d?.actionTurns)issues.push(side+'-action-seat-count');
  }
  return issues;
 };
 const progressUpdate=(rs,active=[])=>{records=rs;write(resolve(CONTROL,'checkpoint.json'),{status,stage:'constant-attribution',startedAt:new Date(started).toISOString(),deadline:new Date(deadline).toISOString(),planned:64,finished:rs.length,active,workers:24,modelHashes:plan.modelHashes});};
 function summary(){
  const valid=[],issues=[];for(const r of records){const t=plan.tasks.find(t=>t.id===r.id),es=t?validate(r,t):['unexpected-game'];if(es.length)issues.push({id:r.id,issues:es});else valid.push(r);}
  const pairs=[];for(const seed of [...new Set(plan.tasks.map(t=>t.seed))]){const rs=valid.filter(r=>r.seed===seed);if(rs.length===2&&new Set(rs.map(r=>r.seat)).size===2)pairs.push({seed,share:(rs[0].winShare+rs[1].winShare)/2,margin:(rs[0].margin+rs[1].margin)/2});}
  const latency=side=>{const times=valid.flatMap(r=>r.decisionTimes[side]).sort((a,b)=>a-b);return {n:times.length,meanMs:times.length?times.reduce((a,b)=>a+b)/times.length:null,p95Ms:times.length?times[Math.ceil(times.length*.95)-1]:null,maxMs:times.at(-1)??null,iterations:valid.reduce((n,r)=>n+r.diagnostics[side].iterations,0),learnedLeafCount:valid.reduce((n,r)=>n+r.diagnostics[side].learnedLeafCount,0),learnedFallbackCount:valid.reduce((n,r)=>n+r.diagnostics[side].learnedFallbackCount,0)};};
  return {purpose:'Descriptive/exploratory constant-value attribution only; no promotion claim.',status,complete:status==='finished'&&records.length===64&&valid.length===64&&pairs.length===32&&!issues.length,planned:64,received:records.length,valid:valid.length,independentPairs:pairs.length,issues,missing:plan.tasks.filter(t=>!records.some(r=>r.id===t.id)).map(t=>t.id),
   realModelWinnerShare:summarize(pairs.map(p=>p.share),{bounds:[0,1],alpha:.05}),realModelScoreMargin:summarize(pairs.map(p=>p.margin),{alpha:.05}),latency:{real:latency('candidate'),zero:latency('opponent')},pairs,modelHashes:plan.modelHashes,adoptionRecommended:false,productionDefaultsChanged:false};
 }
 try{
  progressUpdate([]);const result=await runBatch({tasks:plan.tasks,out,workers:24,deadline,workerURL:new URL('./worker.mjs',import.meta.url),validate,check:()=>guard(plan),onProgress:progressUpdate});
  status=result.complete?'finished':'deadline';records=result.results;progressUpdate(records);write(resolve(CONTROL,'analysis.json'),summary());
  if(!result.complete)process.exitCode=2;
 }catch(error){status='interrupted';progressUpdate(records);write(resolve(CONTROL,'analysis.json'),summary());write(resolve(CONTROL,'failure.json'),{error:error.stack,at:new Date().toISOString(),completedRecordsPreserved:true});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=new Set(process.argv.slice(2));
 if(args.has('--execute')&&args.has('--prepare-only'))throw Error('Choose preparation or explicit execution, never both');
 if(args.has('--execute'))await execute({approved:args.has('--approved-after-fixed-pilot')});
 else await prepare();
}
