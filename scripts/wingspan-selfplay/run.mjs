import {existsSync,readFileSync,mkdirSync,readdirSync,renameSync,unlinkSync,rmdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {atomic,read,hash,objectHash,sourceHashes,guard,ROOT,compactRecord,verifyRawRecord} from './common.mjs';
import {LIMITS,calibrationTasks,collectionTasks,screenTasks,confirmationTasks,scalingTasks,estimateReserve} from './plan.mjs';
import {runBatch,ensureBelowNormal} from './runtime.mjs';
import {summarize} from '../wingspan-study/analyze.mjs';
const quantile=(xs,q)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.ceil(xs.length*q)-1)]:NaN;
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
export const DEFAULT_GATES=Object.freeze({meanRatio:1.10,p95Ratio:1.25,p99Ms:2000,maxMs:5000,screenShare:.525,alpha:.025});
export function calibrationSummary(records,gates=DEFAULT_GATES){const times=[];let valid=Array.isArray(records)&&records.length===32;for(const row of records??[]){const r=row.result??row;if(row.validation?.valid!==true||r.validation?.valid!==true||r.status!=='complete')valid=false;for(const side of ['candidate','opponent']){const ts=r.decisionTimes?.[side];if(!Array.isArray(ts)||!ts.length||ts.some(t=>!Number.isFinite(t)||t<0))valid=false;else times.push(...ts);}}const latency={decisionCount:times.length,meanMs:mean(times),p95Ms:quantile(times,.95),p99Ms:quantile(times,.99),maxMs:Math.max(...times)};return {valid,gameCount:records?.length??0,latency,passed:valid&&times.length>0&&latency.p99Ms<=gates.p99Ms&&latency.maxMs<=gates.maxMs,outcomeBlind:true};}
export function comparisonSummary(records,{confirmation=false,gates=DEFAULT_GATES}={}){
 const groups=Map.groupBy(records,r=>(r.task??r).matchup),comparisons={};
 for(const [name,rs] of groups){const pairs=Map.groupBy(rs,r=>(r.task??r).seed),values=[],margins=[],times=[],opponentTimes=[];let valid=pairs.size===(confirmation?100:40);
  for(const ps of pairs.values()){if(ps.length!==2||new Set(ps.map(r=>(r.task??r).seat)).size!==2){valid=false;continue;}const games=ps.map(r=>r.result??r);if(games.some(g=>g.status!=='complete'||g.validation?.valid!==true||![0,.5,1].includes(g.winShare)||!Number.isFinite(g.margin)))valid=false;values.push(mean(games.map(g=>g.winShare)));margins.push(mean(games.map(g=>g.margin)));}
  for(const row of rs){const r=row.result??row;times.push(...(r.decisionTimes?.candidate??[]));opponentTimes.push(...(r.decisionTimes?.opponent??[]));}
  const latency={meanMs:mean(times),p95Ms:quantile(times,.95),p99Ms:quantile(times,.99),maxMs:Math.max(...times),opponentMeanMs:mean(opponentTimes),opponentP95Ms:quantile(opponentTimes,.95)};
  const latencyValid=times.length>0&&opponentTimes.length>0&&[...times,...opponentTimes].every(t=>Number.isFinite(t)&&t>=0)&&latency.p99Ms<=gates.p99Ms&&latency.maxMs<=gates.maxMs&&latency.meanMs<=gates.meanRatio*latency.opponentMeanMs&&latency.p95Ms<=gates.p95Ratio*latency.opponentP95Ms;
  const shareSummary=summarize(values,{bounds:[0,1],alpha:gates.alpha}),marginSummary=summarize(margins,{alpha:gates.alpha});const winShare=shareSummary.mean,lower=shareSummary.lowerBound,margin=marginSummary.mean;
  comparisons[name]={pairs:values.length,winShare,shareSummary,marginSummary,lowerWinnerShare:lower,meanMargin:margin,valid,latency,latencyValid,passed:valid&&latencyValid&&margin>0&&(confirmation?lower>.5:winShare>=gates.screenShare)};
 }
 return {comparisons,passed:Object.keys(comparisons).length===(confirmation?2:Object.keys(comparisons).length)&&Object.keys(comparisons).length>0&&Object.values(comparisons).every(c=>c.passed),bound:'paired Student t approximate, one-sided alpha .025 per comparison; bounded Hoeffding backup for degenerate samples'};
}
export function verifyStageData(state,out,{allowAudit=!!state.finalFreeze}={}){for(const [key,entry] of Object.entries(state.stages))for(const r of entry.result?.records??[]){if(r.task.split==='audit'&&!allowAudit)continue;verifyRawRecord(r,resolve(out,'stages',key,'games',encodeURIComponent(r.task.id)+'.json'));}}
function verifyModels(state){for(const e of Object.values(state.stages))for(const [id,h] of Object.entries(e.result?.modelHashes??{})){const p=e.result.models?.[id];if(!p||hash(readFileSync(p))!==h)throw Error('Frozen model changed '+id);}}
export function processAlive(pid){if(!Number.isSafeInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;return true;}}
export function acquireCampaignLock(out,{isAlive=processAlive,pid=process.pid,now=Date.now}={}){
 const lockDir=resolve(out,'.controller-lock'),ownerPath=resolve(lockDir,'owner.json'),token=randomUUID();mkdirSync(out,{recursive:true});
 for(let attempt=0;attempt<3;attempt++){
  try{mkdirSync(lockDir);const owner={pid,startedAt:now(),token,status:'owned'};atomic(ownerPath,owner);return {token,release(){if(!existsSync(ownerPath)||read(ownerPath).token!==token)throw Error('Campaign lock ownership changed');atomic(resolve(out,'lock-receipts',token+'.json'),{...owner,status:'released',releasedAt:now()});unlinkSync(ownerPath);rmdirSync(lockDir);}};}catch(e){if(e.code!=='EEXIST')throw e;}
  if(!existsSync(ownerPath))throw Error('Campaign lock initialization incomplete; refuse overlapping controller');const previous=read(ownerPath);if(isAlive(previous.pid))throw Error('Campaign already owned by live controller PID '+previous.pid);
  // A claimant directory serializes stale-lock recovery. An interrupted recovery
  // remains evidence and fails closed rather than risking a second live owner.
  const reclaim=resolve(lockDir,'reclaim');try{mkdirSync(reclaim);}catch{throw Error('Campaign stale-lock recovery already reserved');}
  atomic(resolve(reclaim,'owner.json'),{pid,token,startedAt:now()});const current=read(ownerPath);if(current.token!==previous.token||isAlive(current.pid))throw Error('Campaign lock owner changed during recovery');
  const archive=resolve(out,'lock-receipts','stale-'+randomUUID());mkdirSync(resolve(out,'lock-receipts'),{recursive:true});renameSync(lockDir,archive);
 }
 throw Error('Unable to acquire campaign lock');
}
export function assertNoLiveChildren(out,{isAlive=processAlive}={}){const dir=resolve(out,'processes');if(!existsSync(dir))return;for(const name of readdirSync(dir)){if(!name.endsWith('.json'))continue;const receipt=read(resolve(dir,name));if(receipt.status==='starting'&&!receipt.pid)throw Error('Unresolved subprocess launch; preserve receipt '+name);if(['starting','running','deadline-kill-requested'].includes(receipt.status)&&isAlive(receipt.pid))throw Error('Live owned subprocess PID '+receipt.pid+'; refuse overlapping work');}}
export function freezeDatasetIndex(path,index){if(existsSync(path)){if(objectHash(read(path))!==objectHash(index))throw Error('Frozen dataset index changed');}else atomic(path,index);}
export function completedTraining(stageOut,manifest,trainer){
 const path=resolve(stageOut,'training-summary.json'),artifacts=['model.json','zero-model.json','epoch-zero.json','linear-model.json','parity.json'];
 if(!existsSync(path)){if(artifacts.some(p=>existsSync(resolve(stageOut,p)))||existsSync(resolve(stageOut,'process.json')))throw Error('Partial training evidence without completed summary; refusing overwrite');return null;}
 const summary=read(path);if(summary.manifestSha256!==hash(readFileSync(manifest))||summary.trainerSha256!==hash(readFileSync(trainer)))throw Error('Completed fit manifest/trainer hash mismatch');
 for(const name of artifacts)if(summary.hashes?.[name]!==hash(readFileSync(resolve(stageOut,name))))throw Error('Completed fit artifact hash mismatch '+name);
 const expected=new Map(read(manifest).records.filter(r=>['train','dev'].includes(r.split)).map(r=>[resolve(r.path),r]));if(!Array.isArray(summary.readFiles)||summary.readFiles.length!==expected.size)throw Error('Completed fit record inventory mismatch');
 const seen=new Set();for(const r of summary.readFiles){const p=resolve(r.path);if(seen.has(p)||!expected.has(p)||r.split!==expected.get(p).split||r.sha256!==hash(readFileSync(p)))throw Error('Completed fit source record hash/inventory mismatch');seen.add(p);}
 return summary;
}
export function createController({out,executeStage,now=Date.now,frozenHashes={},workers=24,cycles=3,gates=DEFAULT_GATES,scaling=false,runtimeConfig={},sourceRevision=null,testOnlySkipRawValidation=false}){
 if(!Number.isInteger(workers)||workers<1||workers>24||!Number.isInteger(cycles)||cycles<1||cycles>3)throw Error('Invalid campaign bounds');
 const manifestPath=resolve(out,'manifest.json');
 let state=existsSync(manifestPath)?read(manifestPath):{schema:1,protocol:'wingspan-compact-selfplay-v1',status:'prepared',createdAt:now(),startedAt:null,deadlineEpochMs:null,workers,cycles,gates,scaling,runtimeConfig,sourceRevision,frozenHashes,stages:{},champion:'R',history:[],generation:0,stagnation:0,finalist:null,productionPromotion:false};
 if(objectHash(state.runtimeConfig??{})!==objectHash(runtimeConfig)||objectHash(state.frozenHashes)!==objectHash(frozenHashes)||state.workers!==workers||state.cycles!==cycles||objectHash(state.gates)!==objectHash(gates)||state.scaling!==scaling)throw Error('Resume configuration/source mismatch');
 const save=()=>atomic(manifestPath,state);
 const check=()=>{guard(state.frozenHashes);verifyModels(state);if(state.deadlineEpochMs!==null&&now()>=state.deadlineEpochMs)throw Error('Original absolute deadline reached');};
 async function stage(key,kind,context={}){check();if(state.stages[key]?.status==='complete')return state.stages[key].result;if(state.stages[key]?.status==='failed')throw Error('Retained failed stage '+key);const entry=state.stages[key]??{kind,startedAt:now(),contextHash:objectHash(context)};if(entry.contextHash!==objectHash(context))throw Error('Frozen stage context mismatch '+key);state.stages[key]={...entry,status:'running'};save();try{if(!testOnlySkipRawValidation&&['train','audit'].includes(kind))verifyStageData(state,out);let result=await executeStage(kind,{...context,key,out,deadlineEpochMs:state.deadlineEpochMs,workers,state});check();if(result?.status==='failed'||result?.complete===false)throw Error('Stage failed '+key);if(result.records)result={...result,records:result.records.map(r=>compactRecord(r,r.rawSha256)),planned:context.tasks?.length??result.planned};state.stages[key]={...entry,status:'complete',finishedAt:now(),result};save();return result;}catch(e){state.stages[key]={...entry,status:'failed',finishedAt:now(),error:e.stack,failure:e.receipt??{reason:e.message,at:now(),error:e.stack}};save();throw e;}}
 async function run(){
  try{guard(state.frozenHashes);verifyModels(state);if(!testOnlySkipRawValidation)verifyStageData(state,out);}catch(e){state.status='failed';state.stopReason=e.message;save();throw e;}
  if(['complete','stopped','failed'].includes(state.status))return state;
  if(state.startedAt===null){state.startedAt=now();state.deadlineEpochMs=state.startedAt+LIMITS.elapsedMs;state.status='running';save();}
  try{
   const profile=await stage('profile','profile');if(profile.passed!==true||profile.latency?.p99Ms>gates.p99Ms||profile.latency?.maxMs>gates.maxMs)throw Error('Adversarial latency/zero identity profile failed');
   const preflight=await stage('preflight','preflight');if(preflight.status!=='passed')throw Error('Preflight failed');
   const calibration=await stage('calibration','calibration',{tasks:calibrationTasks()});
   state.calibration=calibrationSummary(calibration.records??calibration.results,gates);state.stages.calibration.summary=state.calibration;save();if(!state.calibration.passed)throw Error('Calibration validity/latency tail gate failed');
   if(!state.reserve){state.reserve=estimateReserve(calibration.records??calibration.results,workers);state.reserve.confirmationMs=Math.max(state.reserve.confirmationMs,400*120000/workers);save();}
   for(let generation=state.generation+1;generation<=cycles;generation++){
    const estimate=1024*state.reserve.gameMs/workers+160*state.reserve.gameMs/workers+120000;
    if(now()+estimate+state.reserve.confirmationMs+state.reserve.analysisMs>=state.deadlineEpochMs){state.stopReason='Insufficient time for another complete cycle and reserved confirmation';break;}
    const champion=state.champion,history=[...state.history];
    await stage(`collect-${generation}`,'collect',{generation,tasks:collectionTasks(generation,champion,history)});
    const fit=await stage(`train-${generation}`,'train',{generation,champion});
    let advanced=false;
    if(fit.eligible===true){if(fit.parityPassed!==true||!fit.candidate||!fit.zeroModel)throw Error('Eligible candidate lacks parity/model receipts');const screened=await stage(`screen-${generation}`,'screen',{generation,tasks:screenTasks(generation,fit.candidate,champion)});const summary=comparisonSummary(screened.records??screened.results,{gates});state.stages[`screen-${generation}`].summary=summary;if(summary.passed){if(champion!=='R'&&!state.history.includes(champion))state.history.push(champion);state.champion=fit.candidate;state.finalist={candidate:fit.candidate,zeroModel:fit.zeroModel,generation,modelHashes:fit.modelHashes};advanced=true;}}
    state.stagnation=fit.eligible===true||advanced?0:state.stagnation+1;state.generation=generation;save();if(state.stagnation>=2){state.stopReason='Two consecutive cycles without development or screen improvement';break;}
   }
   if(!state.finalist){state.status='stopped';state.stopReason??='No promising candidate';save();return state;}
   if(!state.finalFreeze){state.finalFreeze={...state.finalist,frozenAt:now(),hash:objectHash(state.finalist)};save();}
   const audit=await stage('audit','audit',{finalFreeze:state.finalFreeze});
   if(audit.valid!==true||audit.eligible!==true){state.status='stopped';state.stopReason='Frozen finalist offline audit failed or ineligible';save();return state;}
   if(now()+state.reserve.confirmationMs+state.reserve.analysisMs>=state.deadlineEpochMs){state.status='stopped';state.stopReason='Insufficient reserved time for fixed confirmation';save();return state;}
   const confirmation=await stage('confirmation','confirmation',{tasks:confirmationTasks(state.finalFreeze.candidate,state.finalFreeze.zeroModel),finalFreeze:state.finalFreeze});
   state.confirmation=comparisonSummary(confirmation.records??confirmation.results,{confirmation:true,gates});
   if(scaling&&now()+160*state.reserve.gameMs/workers+state.reserve.analysisMs<state.deadlineEpochMs)await stage('scaling','scaling',{tasks:scalingTasks(state.finalFreeze.candidate)});
   await stage('analysis','analysis',{finalFreeze:state.finalFreeze,confirmation:state.confirmation});state.status='complete';state.finishedAt=now();save();return state;
  }catch(e){state.status='failed';state.stopReason=e.message;state.failedAt=now();save();throw e;}
 }
 if(!existsSync(manifestPath))save();return {run,prepare:()=>state,get state(){return state;}};
}

export async function command(executable,args,deadlineEpochMs,out,{processRoot=resolve(out,'processes'),ownerToken=null}={}){
 ensureBelowNormal();const id=randomUUID(),path=resolve(processRoot,id+'.json'),receipt={id,ownerToken,controllerPid:process.pid,executable,args,startedAt:Date.now(),status:'starting',pid:null};const persist=()=>{atomic(path,receipt);atomic(resolve(out,'process.json'),receipt);};persist();
 await new Promise((done,fail)=>{const child=spawn(executable,args,{cwd:ROOT,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,OMP_NUM_THREADS:'4',MKL_NUM_THREADS:'4',OPENBLAS_NUM_THREADS:'4'}});receipt.pid=child.pid??null;receipt.status=child.pid?'running':'starting';persist();let log='';let settled=false;const finish=(error,code)=>{if(settled)return;settled=true;clearTimeout(timer);receipt.status=error?'failed':'complete';receipt.finishedAt=Date.now();receipt.code=code;receipt.log=log;receipt.error=error?.stack;persist();error?fail(error):done();};const timer=setTimeout(()=>{receipt.status='deadline-kill-requested';persist();child.kill('SIGKILL');},Math.max(1,deadlineEpochMs-Date.now()));child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',e=>finish(e,null));child.on('exit',code=>finish(code===0&&receipt.status!=='deadline-kill-requested'?null:Error('Subprocess failed/deadline: '+executable+' '+code),code));});
}
export function realExecutor({python='python',device='cuda',ownerToken=null}={}){return async(kind,ctx)=>{
 const {out,key,deadlineEpochMs,state}=ctx,stageOut=resolve(out,'stages',key),modelPaths={};
 const invoke=(exe,args,deadline,dir)=>command(exe,args,deadline,dir,{processRoot:resolve(out,'processes'),ownerToken});
 for(const entry of Object.values(state.stages))if(entry.result?.models)Object.assign(modelPaths,entry.result.models);
 if(ctx.tasks){const tasks=ctx.tasks.map(t=>({...t,modelPaths}));const result=await runBatch({tasks,out:stageOut,workers:ctx.workers,deadlineEpochMs,check:()=>{guard(state.frozenHashes);verifyModels(state);},onProgress:(records,active)=>atomic(resolve(stageOut,'progress.json'),{completed:records.length,total:tasks.length,active,counts:{complete:records.length,capped:0,failed:0,active:active.length,pending:tasks.length-records.length-active.length},exampleCount:records.reduce((n,r)=>n+(r.exampleCount??0),0),at:Date.now()})});return {complete:result.complete,records:result.results};}
 if(kind==='profile'||kind==='preflight'){await invoke(process.execPath,[resolve(ROOT,'scripts/wingspan-selfplay',kind+'.mjs'),'--out='+stageOut,...(kind==='preflight'?['--models='+resolve(out,'models')]:[])],deadlineEpochMs,stageOut);return read(resolve(stageOut,kind+'.json'));}
 if(kind==='analysis'){const result={status:'complete',finalFreeze:ctx.finalFreeze,confirmation:ctx.confirmation,audit:state.stages.audit.result,generations:Object.fromEntries(Object.entries(state.stages).filter(([k])=>/^(train|screen)-/.test(k)).map(([k,v])=>[k,{result:v.result,summary:v.summary}])),elapsedMs:Date.now()-state.startedAt,deadlineEpochMs:state.deadlineEpochMs,productionPromotion:false};atomic(resolve(stageOut,'analysis.json'),result);return result;}
 if(kind==='train'||kind==='audit'){
  const {FEATURE_NAMES,FEATURE_VERSION}=await import('./encoder.mjs');const {AUX_NAMES}=await import('../wingspan-neural/targets.mjs');const records=[];
  for(const [stageKey,entry] of Object.entries(state.stages))if(stageKey.startsWith('collect-')&&entry.status==='complete')for(const r of entry.result.records){const task=r.task;records.push({path:resolve(out,'stages',stageKey,'games',encodeURIComponent(task.id)+'.json'),split:task.split,gameId:task.id,generation:task.generation,setupSeed:task.seed});}
  const manifest=resolve(stageOut,'dataset-index.json');freezeDatasetIndex(manifest,{schema:1,featureVersion:FEATURE_VERSION,featureNames:FEATURE_NAMES,auxNames:AUX_NAMES,records});const trainer=resolve(ROOT,'scripts/wingspan-selfplay/train.py'),args=[trainer,'--manifest',manifest,'--out',stageOut,'--device',device];
  if(kind==='audit')args.push('--audit','--model',modelPaths[ctx.finalFreeze.candidate]);else if(ctx.champion!=='R')args.push('--warm-start',modelPaths[ctx.champion]);else if(ctx.generation>1){const origin=state.stages['train-1']?.result?.epochZero;if(!origin)throw Error('Frozen first-batch normalization origin missing');args.push('--warm-start',origin);}
  const prior=kind==='train'?completedTraining(stageOut,manifest,trainer):null;if(!prior)await invoke(python,args,deadlineEpochMs,stageOut);const summary=prior??(kind==='train'?completedTraining(stageOut,manifest,trainer):read(resolve(stageOut,'audit-summary.json')));if(kind==='audit')return summary;
  const candidate='generation-'+ctx.generation,zeroModel=candidate+'-zero',epochZero=resolve(stageOut,'epoch-zero.json'),models={[candidate]:resolve(stageOut,'model.json'),[zeroModel]:resolve(stageOut,'zero-model.json'),[candidate+'-epoch-zero']:epochZero},modelHashes=Object.fromEntries(Object.entries(models).map(([id,p])=>[id,hash(readFileSync(p))]));const parity=read(resolve(stageOut,'parity.json'));
  const parityOut=resolve(stageOut,'export-preflight');await invoke(process.execPath,[resolve(ROOT,'scripts/wingspan-selfplay/preflight.mjs'),'--models='+stageOut,'--out='+parityOut],deadlineEpochMs,parityOut);const exportCheck=read(resolve(parityOut,'preflight.json'));
  return {...summary,eligible:summary.eligible===true&&summary.selectedEpoch!==0,candidate,zeroModel,models,modelHashes,epochZero,parityPassed:(parity.passed===true||parity.status==='passed')&&exportCheck.status==='passed'};
 }
 throw Error('Unknown stage '+kind);
};}
export async function main(argv=process.argv.slice(2)){
 const options=Object.fromEntries(argv.filter(a=>a.startsWith('--')).map(a=>{const [key,...v]=a.slice(2).split('=');return [key,v.length?v.join('='):true];}));if(!options.out)throw Error('--out=ABSOLUTE_EXTERNAL_DIRECTORY is required');
 const out=resolve(String(options.out));if(out.startsWith(resolve(ROOT))||/[/\\]OneDrive([/\\]|$)/i.test(out))throw Error('Raw campaign output must be outside repository/OneDrive');
 const preparing=options.prepare||options['dry-run'],lock=preparing?null:acquireCampaignLock(out);
 try{
  if(!preparing)assertNoLiveChildren(out);
  const existing=existsSync(resolve(out,'manifest.json'))?read(resolve(out,'manifest.json')):null,runtimeConfig={python:String(options.python??existing?.runtimeConfig?.python??'python'),device:String(options.device??existing?.runtimeConfig?.device??'cuda'),nodeExecutable:process.execPath,nodeVersion:process.version},sourceRevision=existing?.sourceRevision??execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim();
  const controller=createController({out,runtimeConfig,sourceRevision,frozenHashes:existing?.frozenHashes??sourceHashes(),workers:Number(options.workers??existing?.workers??24),cycles:Number(options.cycles??existing?.cycles??3),scaling:options.scaling===true||existing?.scaling===true,executeStage:realExecutor({...runtimeConfig,ownerToken:lock?.token})});guard(controller.state.frozenHashes);verifyModels(controller.state);
  if(preparing)return controller.prepare();const result=await controller.run();if(result.status==='failed')process.exitCode=1;return result;
 }finally{lock?.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().then(s=>console.log(JSON.stringify({status:s.status,out:process.argv.slice(2).find(a=>a.startsWith('--out=')),deadlineEpochMs:s.deadlineEpochMs}))).catch(e=>{console.error(e.stack);process.exitCode=1;});
