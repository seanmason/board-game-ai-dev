import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {atomic,read,hash,objectHash,sourceHashes,guard,ROOT,verifyRawRecord} from '../wingspan-selfplay/common.mjs';
import {acquireCampaignLock,assertNoLiveChildren,command,completedTraining,freezeDatasetIndex,comparisonSummary} from '../wingspan-selfplay/run.mjs';
import {runBatch} from './runtime.mjs';
import {ARMS,GEN3,LIMITS,GATES,calibrationTasks,collectionTasks,screenTasks,confirmationTasks,freezeAllocation,computeMatch} from './plan.mjs';

export {acquireCampaignLock,assertNoLiveChildren};
export function freezeSources(extraFiles=[]){
 const hashes=sourceHashes();
 const protocol=resolve(ROOT,'docs/plans/wingspan-data-efficiency-2026-10-19.md');hashes[protocol]=hash(readFileSync(protocol));
 const dir=resolve(ROOT,'scripts/wingspan-data-efficiency');
 for(const name of readdirSync(dir))if(/\.(mjs|py|js)$/.test(name)){const p=resolve(dir,name);hashes[p]=hash(readFileSync(p));}
 for(const p of extraFiles)hashes[resolve(p)]=hash(readFileSync(p));
 return hashes;
}
export function validateRetainedInventory(records){
 if(!Array.isArray(records)||records.length!==2688)throw Error('Exactly 2304 retained train and 384 retained dev records required');
 const groups=new Set(),ids=new Set(),paths=new Set(),counts={train:0,dev:0};
 for(const r of records){if(!['train','dev'].includes(r.split)||![1,2,3].includes(r.generation)||!Number.isSafeInteger(r.setupSeed)||!r.gameId||!isAbsolute(r.path)||!/^[a-f0-9]{64}$/.test(r.sha256??''))throw Error('Invalid retained collection identity/hash');
  if(groups.has(r.setupSeed)||ids.has(r.gameId)||paths.has(resolve(r.path).toLowerCase()))throw Error('Duplicate retained group/game/path');groups.add(r.setupSeed);ids.add(r.gameId);paths.add(resolve(r.path).toLowerCase());counts[r.split]++;
 }
 if(counts.train!==2304||counts.dev!==384)throw Error('Retained split counts mismatch');
 for(const g of [1,2,3])if(records.filter(r=>r.generation===g&&r.split==='train').length!==768||records.filter(r=>r.generation===g&&r.split==='dev').length!==128)throw Error('Retained generation counts mismatch');
 return true;
}
export function verifyRetained(records){validateRetainedInventory(records);for(const r of records){if(hash(readFileSync(r.path))!==r.sha256)throw Error('Retained replay changed '+r.gameId);const raw=read(r.path);if(raw.task?.kind!=='collect'||raw.task.id!==r.gameId||raw.task.seed!==r.setupSeed||raw.task.generation!==r.generation||raw.task.split!==r.split||raw.validation?.valid!==true||raw.result?.status!=='complete')throw Error('Retained replay identity invalid '+r.gameId);}}
export function buildDatasetIndex({retained,collections,arm,out,featureNames,auxNames}){
 validateRetainedInventory(retained);if(!ARMS.includes(arm))throw Error('Invalid fit arm');
 const records=retained.map(r=>({...r}));
 for(const generator of ARMS)for(const task of collections[generator])if(task.split==='dev'||generator===arm&&task.split==='train')records.push({path:resolve(out,'stages','collect-'+generator,'games',encodeURIComponent(task.id)+'.json'),split:task.split,gameId:task.id,generation:task.generation,setupSeed:task.seed});
 if(records.some(r=>!['train','dev'].includes(r.split)))throw Error('Forbidden fitting inventory');
 return {schema:1,featureVersion:'wingspan-compact-v1',featureNames,auxNames,records,replayMass:{training:{retained:.75,freshOwn:.25},development:{retained:.6,baselineFresh:.2,hybridFresh:.2}},selection:'identical pooled development objective; equal-generation weighting',architecture:[192,32,16,1]};
}
export function developmentEligible(fit){return fit?.eligible===true&&fit.selectedEpoch>0&&fit.parityPassed===true&&Number.isFinite(fit.dev?.huber)&&fit.dev.huber<fit.reference?.huber-1e-8&&fit.dev.huber<fit.epochZero?.huber-1e-8;}
function verifyModels(models,modelHashes){for(const [id,p] of Object.entries(models))if(hash(readFileSync(p))!==modelHashes[id])throw Error('Frozen model changed '+id);}
export function createController({out,executeStage,now=Date.now,workers=28,frozenHashes={},runtimeConfig={},sourceRevision=null,modelPaths={},retained=[],limits=LIMITS,gates=GATES,testOnlySkipInputs=false}){
 if(!Number.isInteger(workers)||workers<1||workers>28||limits.elapsedMs>LIMITS.elapsedMs||limits.workers>28)throw Error('Invalid three-hour/28-worker bounds');
 if(!testOnlySkipInputs){validateRetainedInventory(retained);for(const id of [GEN3,'frozen-generation-1'])if(!modelPaths[id])throw Error('Fixed generation 3/history model paths required');}
 const modelHashes=Object.fromEntries(Object.entries(modelPaths).map(([id,p])=>[id,hash(readFileSync(p))]));
 const config={workers,frozenHashes,runtimeConfig,sourceRevision,modelPaths,modelHashes,retained,limits,gates};
 const configHash=objectHash(config),path=resolve(out,'manifest.json');
 let state=existsSync(path)?read(path):{schema:1,protocol:'wingspan-data-efficiency-v1',config,configHash,status:'prepared',createdAt:now(),startedAt:null,deadlineEpochMs:null,stages:{},allocation:null,candidate:null,productionPromotion:false,disclosure:{calibration:'one whole batch per arm at 28 workers; noisy throughput estimate',horizonConvention:'searched horizon 4 excludes root; cheap one-step includes root only',trainingReplayMass:.75,commonDevelopment:true,outcomesClosedUntilFixedStageComplete:true}};
 if(state.configHash!==configHash||objectHash(state.config)!==configHash)throw Error('Resume configuration/source/model mismatch');
 const save=()=>atomic(path,state);
 function check({allowExpired=false}={}){guard(frozenHashes);verifyModels(modelPaths,modelHashes);for(const e of Object.values(state.stages))if(e.result?.models)verifyModels(e.result.models,e.result.modelHashes);if(state.startedAt!==null&&state.deadlineEpochMs!==state.startedAt+limits.elapsedMs)throw Error('Original deadline changed');if(state.allocation&&objectHash(state.allocation)!==state.allocationHash)throw Error('Frozen collection allocation changed');if(!allowExpired&&state.deadlineEpochMs!==null&&now()>=state.deadlineEpochMs)throw Error('Original absolute three-hour deadline reached');}
 const rawPath=(key,task)=>resolve(out,'stages',key,'games',encodeURIComponent(task.id)+'.json');
 function verifyCollections(){if(testOnlySkipInputs)return;verifyRetained(retained);for(const [key,entry] of Object.entries(state.stages))for(const r of entry.result?.recordReceipts??[])verifyRawRecord(r,rawPath(key,r.task));}
 async function stage(key,kind,context={}){
  check();const prior=state.stages[key],contextHash=objectHash(context);
  if(prior?.contextHash&&prior.contextHash!==contextHash)throw Error('Frozen stage task/context mismatch '+key);
  if(prior?.status==='complete')return prior.result;
  if(prior)throw Error('Partial/failed stage retained; refusing rerun '+key);
  if(kind==='train')verifyCollections();
  const entry={kind,arm:context.arm??null,planned:context.tasks?.length??null,status:'running',startedAt:now(),contextHash,tasksHash:context.tasks?objectHash(context.tasks):null};state.stages[key]=entry;save();
  const reserveMs=['calibration','collect'].includes(kind)?limits.confirmationReserveMs+limits.fitReserveMs+limits.analysisReserveMs:kind==='train'?limits.confirmationReserveMs+limits.analysisReserveMs:limits.analysisReserveMs;
  const stageDeadlineEpochMs=state.deadlineEpochMs-reserveMs;
  if(now()>=stageDeadlineEpochMs)throw Error('Reserved fixed comparisons budget reached');
  try{const result=await executeStage(kind,{...context,key,out,state,workers,deadlineEpochMs:stageDeadlineEpochMs,modelPaths:{...modelPaths,...Object.assign({},...Object.values(state.stages).map(e=>e.result?.models??{}))},check});check();if(kind==='train')verifyCollections();if(result?.complete===false||result?.status==='failed')throw Error('Incomplete stage '+key);
   // Scores from calibration/collection never enter the controller allocation or dashboard state.
   let stored=result;
   if(['calibration','collect'].includes(kind)){if(!Number.isFinite(result.poolWallMs)||result.poolWallMs<=0||result.gameCount!==context.tasks.length||result.complete!==true)throw Error('Missing whole-batch timing/inventory');stored={complete:true,poolWallMs:result.poolWallMs,processCpuMicros:result.processCpuMicros,priority:result.priority,planned:context.tasks.length,gameCount:result.gameCount,recordReceipts:(result.records??result.results??[]).map(r=>({task:r.task,rawSha256:r.rawSha256,exampleCount:r.exampleCount,collectionDiagnostics:r.collectionDiagnostics})),outcomesClosed:true};if(stored.recordReceipts.length!==context.tasks.length)throw Error('Missing task receipts');}
   state.stages[key]={...entry,status:'complete',finishedAt:now(),result:stored};save();return stored;
  }catch(e){state.stages[key]={...entry,status:'failed',finishedAt:now(),error:e.stack,failure:e.receipt??{reason:e.message}};save();throw e;}
 }
 async function run(){
  // A terminal receipt remains immutable on later inspection, including after
  // its absolute deadline. Source/model/data verification still applies.
  if(['complete','stopped','failed'].includes(state.status)){check({allowExpired:true});verifyCollections();return state;}
  try{check();verifyCollections();if(['complete','stopped','failed'].includes(state.status))return state;
   if(state.startedAt===null){state.startedAt=now();state.deadlineEpochMs=state.startedAt+limits.elapsedMs;state.status='running';save();}
   const calibration={};for(const arm of ARMS)calibration[arm]=await stage('calibration-'+arm,'calibration',{arm,tasks:calibrationTasks(arm,limits.calibrationPerArm)});
   if(!state.allocation){state.allocation=freezeAllocation(calibration,{workers,limits,targetPoolMs:limits.targetPoolMs,availableMs:state.deadlineEpochMs-now()});state.allocationHash=objectHash(state.allocation);save();}
   const tasks=Object.fromEntries(ARMS.map(a=>[a,collectionTasks(a,state.allocation.counts[a])]));
   const collection={};for(const arm of ARMS){if(now()+state.allocation.estimatedPoolMs[arm]+state.allocation.reserveMs>=state.deadlineEpochMs)throw Error('Insufficient reserved time for fixed collection');collection[arm]=await stage('collect-'+arm,'collect',{arm,tasks:tasks[arm]});}
   state.computeMatch=computeMatch(collection);save();verifyCollections();
   if(!state.computeMatch.passed){state.status='stopped';state.finishedAt=now();state.equalComputeClaimAllowed=false;state.stopReason='Actual collection compute matching failed; preserve corpora; no resizing or strength rescue';save();return state;}
   const fits={};for(const arm of ARMS)fits[arm]=await stage('train-'+arm,'train',{arm,collections:tasks,warmStart:modelPaths[GEN3],fitSeed:1729,commonDevelopment:true});
   if(now()+limits.confirmationReserveMs+limits.analysisReserveMs>=state.deadlineEpochMs)throw Error('Insufficient reserved time for fixed screen/confirmation');
   if(!fits.baseline.candidate||!fits.hybrid.candidate||!fits.baseline.parityPassed||!fits.hybrid.parityPassed)throw Error('Both fixed fits require exported models and JS parity');
   const screen=await stage('screen','screen',{tasks:screenTasks(fits.hybrid.candidate,fits.baseline.candidate)});
   state.screen=comparisonSummary(screen.records??screen.results,{gates});
   const eligible=developmentEligible(fits.hybrid);
   state.candidate=eligible&&state.screen.passed?fits.hybrid.candidate:null;save();
   if(state.candidate){const confirmation=await stage('confirmation','confirmation',{tasks:confirmationTasks(state.candidate,fits.baseline.candidate)});state.confirmation=comparisonSummary(confirmation.records??confirmation.results,{confirmation:true,gates});}
   state.status='complete';state.finishedAt=now();state.stopReason=state.candidate?'Fixed comparisons completed':'Complete fixed screen; no eligible promising hybrid candidate; no rescue';state.equalComputeClaimAllowed=state.computeMatch.passed;save();return state;
  }catch(e){state.status='failed';state.failedAt=now();state.stopReason=e.message;save();throw e;}
 }
 if(!existsSync(path))save();return {run,prepare:()=>state,get state(){return state;}};
}

export function realExecutor({python='python',device='cuda',ownerToken=null,retained=[]}={}){return async(kind,ctx)=>{
 const stageOut=resolve(ctx.out,'stages',ctx.key);
 if(ctx.tasks){const {validateDataEfficiencyRecord}=await import('./collect.mjs');const {validateRecord}=await import('../wingspan-selfplay/common.mjs');const tasks=ctx.tasks.map(t=>({...t,modelPaths:ctx.modelPaths}));const batch=await runBatch({tasks,out:stageOut,workers:ctx.workers,deadlineEpochMs:ctx.deadlineEpochMs,check:ctx.check,validate:kind==='calibration'||kind==='collect'?validateDataEfficiencyRecord:validateRecord,onProgress:(records,active)=>atomic(resolve(stageOut,'progress.json'),{completed:records.length,total:tasks.length,active,at:Date.now(),outcomesClosed:true})});return {...batch,records:batch.results};}
 if(kind!=='train')throw Error('Unknown stage '+kind);
 const {FEATURE_NAMES}=await import('../wingspan-selfplay/encoder.mjs');const {AUX_NAMES}=await import('../wingspan-neural/targets.mjs');
 const index=buildDatasetIndex({retained,collections:ctx.collections,arm:ctx.arm,out:ctx.out,featureNames:FEATURE_NAMES,auxNames:AUX_NAMES});const manifest=resolve(stageOut,'dataset-index.json');freezeDatasetIndex(manifest,index);
 const trainer=resolve(ROOT,'scripts/wingspan-selfplay/train.py');const start=Date.now();
 // Python's process_time includes every CPU thread in the fit subprocess; GPU time is represented by whole fit wall time.
 const cpuPath=resolve(stageOut,'fit-cpu.json');
 const wrapper="import runpy,sys,time,json,os\np=sys.argv.pop(1)\ns=time.process_time_ns()\nsys.argv=sys.argv[1:]\ntry:\n runpy.run_path(sys.argv[0],run_name='__main__')\nfinally:\n t=p+'.tmp'\n with open(t,'w') as f: json.dump({'processCpuMicros':(time.process_time_ns()-s)/1000},f)\n os.replace(t,p)";
 await command(python,['-c',wrapper,cpuPath,trainer,'--manifest',manifest,'--out',stageOut,'--warm-start',ctx.warmStart,'--device',device],ctx.deadlineEpochMs,stageOut,{processRoot:resolve(ctx.out,'processes'),ownerToken});
 const fitWallMs=Date.now()-start,fitProcessCpuMicros=read(cpuPath).processCpuMicros,summary=completedTraining(stageOut,manifest,trainer);
 if(!summary||summary.warmStartSha256!==hash(readFileSync(ctx.warmStart))||summary.normalizationFrozen!==true||summary.config?.seed!==1729)throw Error('Fit warm-start/normalization/config receipt mismatch');
 const model=read(resolve(stageOut,'model.json'));if(objectHash(model.normalization)!==objectHash(read(ctx.warmStart).normalization))throw Error('Fit normalization changed');
 const parityOut=resolve(stageOut,'export-preflight');await command(process.execPath,[resolve(ROOT,'scripts/wingspan-selfplay/preflight.mjs'),'--models='+stageOut,'--out='+parityOut],ctx.deadlineEpochMs,parityOut,{processRoot:resolve(ctx.out,'processes'),ownerToken});
 const candidate='trained-'+ctx.arm,models={[candidate]:resolve(stageOut,'model.json')},modelHashes={[candidate]:hash(readFileSync(models[candidate]))};
 return {...summary,candidate,models,modelHashes,parityPassed:read(resolve(parityOut,'preflight.json')).status==='passed',fitWallMs,fitProcessCpuMicros,fitCpuScope:'Python time.process_time_ns; all subprocess CPU threads'};
};}
export async function main(argv=process.argv.slice(2)){
 const options=Object.fromEntries(argv.map(x=>{const [k,...v]=x.replace(/^--/,'').split('=');return [k,v.length?v.join('='):true];}));
 if(!options.out||!options.config)throw Error('--out=EXTERNAL_PATH and --config=FROZEN_JSON required; default prepares only; --run explicitly launches');
 const out=resolve(options.out);if(out===resolve(ROOT)||out.startsWith(resolve(ROOT)+'\\')||out.startsWith(resolve(ROOT)+'/')||/[/\\]OneDrive([/\\]|$)/i.test(out))throw Error('Output must be outside repository/OneDrive');
 const supplied=read(resolve(options.config)),old=existsSync(resolve(out,'manifest.json'))?read(resolve(out,'manifest.json')):null;
 const frozenHashes=old?.config.frozenHashes??freezeSources([resolve(options.config),...Object.values(supplied.modelPaths??{})]);
 const lock=options.run?acquireCampaignLock(out):null;
 try{if(options.run)assertNoLiveChildren(out);const controller=createController({...supplied,out,frozenHashes,sourceRevision:old?.config.sourceRevision??execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim(),executeStage:realExecutor({...supplied.runtimeConfig,retained:supplied.retained,ownerToken:lock?.token})});return options.run?await controller.run():controller.prepare();}finally{lock?.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().then(s=>console.log(JSON.stringify({status:s.status,deadlineEpochMs:s.deadlineEpochMs,productionPromotion:false}))).catch(e=>{console.error(e.stack);process.exitCode=1;});

