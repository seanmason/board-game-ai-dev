import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {atomic,read,hash,objectHash,sourceHashes,guard,ROOT,compactRecord,verifyRawRecord} from './common.mjs';
import {LIMITS,calibrationTasks,collectionTasks,screenTasks,confirmationTasks,scalingTasks,estimateReserve} from './plan.mjs';
import {runBatch,ensureBelowNormal} from './runtime.mjs';
import {summarize} from '../wingspan-study/analyze.mjs';
const quantile=(xs,q)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.ceil(xs.length*q)-1)]:NaN;
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
export const DEFAULT_GATES=Object.freeze({meanRatio:1.10,p95Ratio:1.25,p99Ms:2000,maxMs:5000,screenShare:.525,alpha:.025});
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
export function verifyStageData(state,out){for(const [key,entry] of Object.entries(state.stages))for(const r of entry.result?.records??[])verifyRawRecord(r,resolve(out,'stages',key,'games',encodeURIComponent(r.task.id)+'.json'));}
function verifyModels(state){for(const e of Object.values(state.stages))for(const [id,h] of Object.entries(e.result?.modelHashes??{})){const p=e.result.models?.[id];if(!p||hash(readFileSync(p))!==h)throw Error('Frozen model changed '+id);}}
export function createController({out,executeStage,now=Date.now,frozenHashes={},workers=24,cycles=3,gates=DEFAULT_GATES,scaling=false,testOnlySkipRawValidation=false}){
 if(!Number.isInteger(workers)||workers<1||workers>24||!Number.isInteger(cycles)||cycles<1||cycles>3)throw Error('Invalid campaign bounds');
 const manifestPath=resolve(out,'manifest.json');
 let state=existsSync(manifestPath)?read(manifestPath):{schema:1,protocol:'wingspan-compact-selfplay-v1',status:'prepared',createdAt:now(),startedAt:null,deadlineEpochMs:null,workers,cycles,gates,scaling,frozenHashes,stages:{},champion:'R',history:[],generation:0,stagnation:0,finalist:null,productionPromotion:false};
 if(objectHash(state.frozenHashes)!==objectHash(frozenHashes)||state.workers!==workers||state.cycles!==cycles||objectHash(state.gates)!==objectHash(gates)||state.scaling!==scaling)throw Error('Resume configuration/source mismatch');
 const save=()=>atomic(manifestPath,state);
 const check=()=>{guard(state.frozenHashes);verifyModels(state);if(state.deadlineEpochMs!==null&&now()>=state.deadlineEpochMs)throw Error('Original absolute deadline reached');};
 async function stage(key,kind,context={}){check();if(state.stages[key]?.status==='complete')return state.stages[key].result;if(state.stages[key]?.status==='failed')throw Error('Retained failed stage '+key);const entry=state.stages[key]??{kind,startedAt:now(),contextHash:objectHash(context)};if(entry.contextHash!==objectHash(context))throw Error('Frozen stage context mismatch '+key);state.stages[key]={...entry,status:'running'};save();try{if(!testOnlySkipRawValidation&&['train','audit'].includes(kind))verifyStageData(state,out);let result=await executeStage(kind,{...context,key,out,deadlineEpochMs:state.deadlineEpochMs,workers,state});check();if(result?.status==='failed'||result?.complete===false)throw Error('Stage failed '+key);if(result.records)result={...result,records:result.records.map(r=>compactRecord(r,r.rawSha256)),planned:context.tasks?.length??result.planned};state.stages[key]={...entry,status:'complete',finishedAt:now(),result};save();return result;}catch(e){state.stages[key]={...entry,status:'failed',finishedAt:now(),error:e.stack};save();throw e;}}
 async function run(){
  try{guard(state.frozenHashes);verifyModels(state);if(!testOnlySkipRawValidation)verifyStageData(state,out);}catch(e){state.status='failed';state.stopReason=e.message;save();throw e;}
  if(['complete','stopped','failed'].includes(state.status))return state;
  if(state.startedAt===null){state.startedAt=now();state.deadlineEpochMs=state.startedAt+LIMITS.elapsedMs;state.status='running';save();}
  try{
   const profile=await stage('profile','profile');if(profile.passed!==true||profile.latency?.p99Ms>gates.p99Ms||profile.latency?.maxMs>gates.maxMs)throw Error('Adversarial latency/zero identity profile failed');
   const preflight=await stage('preflight','preflight');if(preflight.status!=='passed')throw Error('Preflight failed');
   const calibration=await stage('calibration','calibration',{tasks:calibrationTasks()});
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
 save();return {run,prepare:()=>state,get state(){return state;}};
}

async function command(executable,args,deadlineEpochMs,out){ensureBelowNormal();await new Promise((done,fail)=>{const child=spawn(executable,args,{cwd:ROOT,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,OMP_NUM_THREADS:'4',MKL_NUM_THREADS:'4',OPENBLAS_NUM_THREADS:'4'}});let log='';const timer=setTimeout(()=>{child.kill();fail(Error('Subprocess absolute deadline'));},Math.max(1,deadlineEpochMs-Date.now()));child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);child.on('error',e=>{clearTimeout(timer);fail(e);});child.on('exit',code=>{clearTimeout(timer);atomic(resolve(out,'process.json'),{executable,args,code,log});code===0?done():fail(Error('Subprocess failed: '+executable+' '+code));});});}
export function realExecutor({python='python',device='cuda'}={}){return async(kind,ctx)=>{
 const {out,key,deadlineEpochMs,state}=ctx,stageOut=resolve(out,'stages',key),modelPaths={};
 for(const entry of Object.values(state.stages))if(entry.result?.models)Object.assign(modelPaths,entry.result.models);
 if(ctx.tasks){const tasks=ctx.tasks.map(t=>({...t,modelPaths}));const result=await runBatch({tasks,out:stageOut,workers:ctx.workers,deadlineEpochMs,check:()=>{guard(state.frozenHashes);verifyModels(state);},onProgress:(records,active)=>atomic(resolve(stageOut,'progress.json'),{completed:records.length,total:tasks.length,active,at:Date.now()})});return {complete:result.complete,records:result.results};}
 if(kind==='profile'||kind==='preflight'){await command(process.execPath,[resolve(ROOT,'scripts/wingspan-selfplay',kind+'.mjs'),'--out='+stageOut,...(kind==='preflight'?['--models='+resolve(out,'models')]:[])],deadlineEpochMs,stageOut);return read(resolve(stageOut,kind+'.json'));}
 if(kind==='analysis'){const result={status:'complete',finalFreeze:ctx.finalFreeze,confirmation:ctx.confirmation,audit:state.stages.audit.result,generations:Object.fromEntries(Object.entries(state.stages).filter(([k])=>/^(train|screen)-/.test(k)).map(([k,v])=>[k,{result:v.result,summary:v.summary}])),elapsedMs:Date.now()-state.startedAt,deadlineEpochMs:state.deadlineEpochMs,productionPromotion:false};atomic(resolve(stageOut,'analysis.json'),result);return result;}
 if(kind==='train'||kind==='audit'){
  const {FEATURE_NAMES,FEATURE_VERSION}=await import('./encoder.mjs');const {AUX_NAMES}=await import('../wingspan-neural/targets.mjs');const records=[];
  for(const [stageKey,entry] of Object.entries(state.stages))if(stageKey.startsWith('collect-')&&entry.status==='complete')for(const r of entry.result.records){const task=r.task;records.push({path:resolve(out,'stages',stageKey,'games',encodeURIComponent(task.id)+'.json'),split:task.split,gameId:task.id,generation:task.generation,setupSeed:task.seed});}
  const manifest=resolve(stageOut,'dataset-index.json');atomic(manifest,{schema:1,featureVersion:FEATURE_VERSION,featureNames:FEATURE_NAMES,auxNames:AUX_NAMES,records});const args=[resolve(ROOT,'scripts/wingspan-selfplay/train.py'),'--manifest',manifest,'--out',stageOut,'--device',device];
  if(kind==='audit')args.push('--audit','--model',modelPaths[ctx.finalFreeze.candidate]);else if(ctx.champion!=='R')args.push('--warm-start',modelPaths[ctx.champion]);else if(ctx.generation>1){const origin=state.stages['train-1']?.result?.epochZero;if(!origin)throw Error('Frozen first-batch normalization origin missing');args.push('--warm-start',origin);}
  await command(python,args,deadlineEpochMs,stageOut);const summary=read(resolve(stageOut,kind==='audit'?'audit-summary.json':'training-summary.json'));if(kind==='audit')return summary;
  const candidate='generation-'+ctx.generation,zeroModel=candidate+'-zero',epochZero=resolve(stageOut,'epoch-zero.json'),models={[candidate]:resolve(stageOut,'model.json'),[zeroModel]:resolve(stageOut,'zero-model.json'),[candidate+'-epoch-zero']:epochZero},modelHashes=Object.fromEntries(Object.entries(models).map(([id,p])=>[id,hash(readFileSync(p))]));const parity=read(resolve(stageOut,'parity.json'));
  const parityOut=resolve(stageOut,'export-preflight');await command(process.execPath,[resolve(ROOT,'scripts/wingspan-selfplay/preflight.mjs'),'--models='+stageOut,'--out='+parityOut],deadlineEpochMs,parityOut);const exportCheck=read(resolve(parityOut,'preflight.json'));
  return {...summary,eligible:summary.eligible===true&&summary.selectedEpoch!==0,candidate,zeroModel,models,modelHashes,epochZero,parityPassed:(parity.passed===true||parity.status==='passed')&&exportCheck.status==='passed'};
 }
 throw Error('Unknown stage '+kind);
};}
export async function main(argv=process.argv.slice(2)){const options=Object.fromEntries(argv.filter(a=>a.startsWith('--')).map(a=>{const [key,...v]=a.slice(2).split('=');return [key,v.length?v.join('='):true];}));if(!options.out)throw Error('--out=ABSOLUTE_EXTERNAL_DIRECTORY is required');const out=resolve(String(options.out));if(out.startsWith(resolve(ROOT))||/[/\\]OneDrive([/\\]|$)/i.test(out))throw Error('Raw campaign output must be outside repository/OneDrive');const existing=existsSync(resolve(out,'manifest.json'))?read(resolve(out,'manifest.json')):null;const controller=createController({out,frozenHashes:existing?.frozenHashes??sourceHashes(),workers:Number(options.workers??existing?.workers??24),cycles:Number(options.cycles??existing?.cycles??3),scaling:options.scaling===true||existing?.scaling===true,executeStage:realExecutor({python:options.python,device:options.device})});guard(controller.state.frozenHashes);if(options.prepare||options['dry-run'])return controller.prepare();const result=await controller.run();if(result.status==='failed')process.exitCode=1;return result;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().then(s=>console.log(JSON.stringify({status:s.status,out:process.argv.slice(2).find(a=>a.startsWith('--out=')),deadlineEpochMs:s.deadlineEpochMs}))).catch(e=>{console.error(e.stack);process.exitCode=1;});
