import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {atomic,read,hash,objectHash,sourceHashes,guard,ROOT,verifyRawRecord,validateRecord,compactRecord} from '../wingspan-selfplay/common.mjs';
import {acquireCampaignLock,assertNoLiveChildren,command,completedTraining,freezeDatasetIndex,comparisonSummary} from '../wingspan-selfplay/run.mjs';
import {runBatch} from '../wingspan-data-efficiency/runtime.mjs';
import {validateDataEfficiencyRecord} from '../wingspan-data-efficiency/collect.mjs';
import {LIMITS,GATES,RECIPES,PARENT,HISTORY,comparisonTasks,collectionTasks,seedBankInventory} from './plan.mjs';

export {acquireCampaignLock,assertNoLiveChildren};
export function freezeSources(extraFiles=[]){
 const hashes=sourceHashes();
 for(const dir of ['scripts/wingspan-data-efficiency','scripts/wingspan-refit'])for(const name of readdirSync(resolve(ROOT,dir)))if(/\.(mjs|py|js)$/.test(name)){const p=resolve(ROOT,dir,name);hashes[p]=hash(readFileSync(p));}
 for(const file of ['docs/plans/wingspan-refit-2026-10-19.md',...extraFiles]){const p=resolve(ROOT,file);hashes[p]=hash(readFileSync(p));}
 return hashes;
}
const modelPath=value=>typeof value==='string'?value:value?.path;
export function validateSeedAudit(audit){
 if(!audit?.path||!isAbsolute(audit.path)||!/^[a-f0-9]{64}$/.test(audit.sha256??'')||hash(readFileSync(audit.path))!==audit.sha256)throw Error('Immutable fresh-seed audit hash required');
 const receipt=read(audit.path);if(receipt.status!=='passed'||receipt.errors?.length||Object.values(receipt.overlaps??{}).some(v=>Array.isArray(v)&&v.length)||receipt.cross?.length||!receipt.banks||typeof receipt.banks!=='object')throw Error('Passed fresh-seed audit required');
 const planned=seedBankInventory().map(ts=>[...new Set(ts.map(t=>t.seed))].sort((a,b)=>a-b)),actual=Object.values(receipt.banks);
 if(actual.length!==6||actual.some(bank=>!Array.isArray(bank)||new Set(bank).size!==bank.length||bank.some(s=>!Number.isSafeInteger(s))))throw Error('Six complete disjoint fresh-seed banks required');
 const seen=new Set();for(const bank of actual)for(const seed of bank){if(seen.has(seed))throw Error('Overlapping fresh-seed audit stage banks');seen.add(seed);}
 const normalize=banks=>banks.map(bank=>JSON.stringify([...bank].sort((a,b)=>a-b))).sort();if(objectHash(normalize(actual))!==objectHash(normalize(planned)))throw Error('Fresh-seed audit does not cover all fixed maximum banks');
 return receipt;
}
export function validateInventory(records,{cycle=false,exact=true}={}){
 if(!Array.isArray(records)||!records.length)throw Error('Explicit fitting inventory required');
 const paths=new Set(),games=new Set(),groups=new Map(),counts={};
 for(const r of records){
  if(!['train','dev'].includes(r.split)||!Number.isSafeInteger(r.generation)||r.generation<1||r.generation>(cycle?6:5)||!Number.isSafeInteger(r.setupSeed)||typeof r.gameId!=='string'||!r.gameId||!isAbsolute(r.path??'')||!/^[a-f0-9]{64}$/.test(r.sha256??''))throw Error('Invalid or forbidden fitting inventory');
  const p=resolve(r.path).toLowerCase(),previous=groups.get(r.setupSeed)??[];
  if(paths.has(p)||games.has(r.gameId)||previous.some(x=>x.split!==r.split||!([4,5].includes(x.generation)&&[4,5].includes(r.generation)&&x.generation!==r.generation)))throw Error('Duplicate/cross-split fitting identity');
  paths.add(p);games.add(r.gameId);groups.set(r.setupSeed,[...previous,r]);const k=`${r.generation}/${r.split}`;counts[k]=(counts[k]??0)+1;
 }
 for(let g=1;g<=(cycle?6:5);g++)for(const split of ['train','dev']){const expected=g<=3?(split==='train'?768:128):g===4?(split==='train'?224:56):(split==='train'?832:208);if(!counts[`${g}/${split}`]||exact&&counts[`${g}/${split}`]!==expected)throw Error('Missing/mismatched generation split inventory '+g+'/'+split);}
 return true;
}
export function verifyInventory(records,options){validateInventory(records,options);for(const r of records){if(hash(readFileSync(r.path))!==r.sha256)throw Error('Frozen replay hash changed '+r.gameId);const raw=read(r.path),t=raw.task;if(t?.kind!=='collect'||t.id!==r.gameId||t.seed!==r.setupSeed||t.split!==r.split||t.generation!==r.generation||raw.validation?.valid!==true||raw.result?.status!=='complete')throw Error('Frozen replay identity invalid '+r.gameId);}}
export function buildDatasetIndex({inventory,featureNames,auxNames,cycle=false,exact=true}){
 validateInventory(inventory,{cycle,exact});const generations=cycle?6:5,generationMass=Object.fromEntries(Array.from({length:generations},(_,i)=>[i+1,1/generations]));
 return {schema:1,featureVersion:'wingspan-compact-v1',featureNames,auxNames,records:inventory.map(r=>({...r})),architecture:[192,32,16,1],replayMass:{training:{generationMass},development:{generationMass}},selection:'identical pooled train/dev; equal generation, setup, game, round and viewer mass; no sealed or strength data'};
}
export function developmentEligible(fit){return fit?.eligible===true&&fit.selectedEpoch>0&&fit.parityPassed===true&&Number.isFinite(fit.dev?.huber)&&Number.isFinite(fit.dev?.mae)&&Number.isFinite(fit.reference?.huber)&&Number.isFinite(fit.epochZero?.huber)&&Number.isFinite(fit.epochZero?.mae)&&fit.dev.huber<fit.reference.huber&&fit.dev.huber<fit.epochZero.huber&&fit.dev.mae<=fit.epochZero.mae;}
// Only inference-affecting fields count: epoch/model IDs and fit provenance do not.
export function inferenceHash(model){return objectHash({version:model.version,featureVersion:model.featureVersion,featureNames:model.featureNames,outputKind:model.outputKind,residualScale:model.residualScale,normalization:model.normalization,layers:model.layers});}
const devOrder=(a,b)=>a.dev.huber-b.dev.huber||a.dev.mae-b.dev.mae||a.recipe.localeCompare(b.recipe);
export function selectFinalists(fits){const seen=new Set();return fits.filter(developmentEligible).sort(devOrder).filter(f=>{if(typeof f.inferenceHash!=='string'||!f.inferenceHash)throw Error('Inference fingerprint required');if(seen.has(f.inferenceHash))return false;seen.add(f.inferenceHash);return true;}).slice(0,2);}
export function summarizeComparison(records,{confirmation=false,gates=GATES}={}){
 if(!Array.isArray(records)||records.length!==(confirmation?200:80)||records.some(r=>r.task?.matchup!=='parent'))throw Error('Whole fixed actual-parent comparison required');
 const summary=comparisonSummary(records,{confirmation,gates});
 // The reused campaign aggregator expects two opponents; this protocol has one
 // actual parent. Its per-matchup test already enforces the full100 paired gate.
 return {...summary,passed:Object.keys(summary.comparisons).length===1&&summary.comparisons.parent?.passed===true};
}
function verifyModels(paths,hashes){for(const [id,p] of Object.entries(paths))if(hash(readFileSync(p))!==hashes[id])throw Error('Frozen model changed '+id);}
export function createController({out,executeStage,now=Date.now,workers=28,frozenHashes={},runtimeConfig={},sourceRevision=null,parentModel,historyModel,inventory=[],seedAudit=null,testOnlySkipInputs=false}){
 if(workers!==28)throw Error('Exactly28 BelowNormal workers required');
 const modelPaths={...(parentModel?{[PARENT]:modelPath(parentModel)}:{}),...(historyModel?{[HISTORY]:modelPath(historyModel)}:{})};
 if(!testOnlySkipInputs){validateInventory(inventory);validateSeedAudit(seedAudit);if(!modelPaths[PARENT]||!modelPaths[HISTORY])throw Error('Parent/history model paths required');}
 const modelHashes=Object.fromEntries(Object.entries(modelPaths).map(([id,p])=>[id,hash(readFileSync(p))]));
 const config={workers,frozenHashes,runtimeConfig,sourceRevision,parentModel,historyModel,modelPaths,modelHashes,inventory,seedAudit,limits:LIMITS,gates:GATES,recipes:RECIPES};
 // JSON normalization also makes optional fields stable across manifest reload.
 const frozenConfig=JSON.parse(JSON.stringify(config)),configHash=objectHash(frozenConfig),path=resolve(out,'manifest.json');
 let state=existsSync(path)?read(path):{schema:1,protocol:'wingspan-refit-v1',config:frozenConfig,configHash,status:'prepared',createdAt:now(),startedAt:null,deadlineEpochMs:null,stages:{},bestTeacher:null,accepted:[],productionPromotion:false,outcomesClosedUntilFixedStageComplete:true};
 if(state.configHash!==configHash||objectHash(state.config)!==configHash)throw Error('Resume configuration/source/model mismatch');
 const save=()=>atomic(path,state),rawPath=(key,task)=>resolve(out,'stages',key,'games',encodeURIComponent(task.id)+'.json');
 function verifyData(){if(testOnlySkipInputs)return;verifyInventory(inventory);for(const [key,e] of Object.entries(state.stages))for(const r of e.result?.recordReceipts??[])verifyRawRecord(r,rawPath(key,r.task));}
 function check({allowExpired=false}={}){guard(frozenHashes);if(objectHash(JSON.parse(JSON.stringify(config)))!==configHash||objectHash(state.config)!==configHash)throw Error('Frozen configuration changed');verifyModels(modelPaths,modelHashes);for(const e of Object.values(state.stages))if(e.result?.models)verifyModels(e.result.models,e.result.modelHashes);if(state.startedAt!==null&&state.deadlineEpochMs!==state.startedAt+LIMITS.elapsedMs)throw Error('Original absolute deadline changed');if(!allowExpired&&state.deadlineEpochMs!==null&&now()>=state.deadlineEpochMs)throw Error('Original absolute three-hour deadline reached');}
 async function stage(key,kind,context){
  check();const contextHash=objectHash(context),prior=state.stages[key];if(prior?.contextHash&&prior.contextHash!==contextHash)throw Error('Frozen stage context mismatch '+key);if(prior?.status==='complete')return prior.result;if(prior)throw Error('Partial/failed stage retained; refusing retry '+key);
  if(kind==='train')verifyData();const entry={stage:key,kind,phase:context.phase,recipe:context.recipe??null,planned:context.tasks?.length??1,status:'running',startedAt:now(),contextHash,tasksHash:context.tasks?objectHash(context.tasks):null};state.stages[key]=entry;save();
  try{const result=await executeStage(kind,{...context,key,out,state,workers,deadlineEpochMs:state.deadlineEpochMs,modelPaths:{...modelPaths,...Object.assign({},...Object.values(state.stages).map(e=>e.result?.models??{}))},check});check();if(kind==='train')verifyData();if(!result||result.complete===false||result.status==='failed')throw Error('Incomplete stage '+key);
   let stored=result;
   if(context.tasks){const records=result.records??result.results;if(result.complete!==true||!Array.isArray(records)||records.length!==context.tasks.length)throw Error('Incomplete fixed batch '+key);const expected=new Map(context.tasks.map(t=>[t.id,t])),seen=new Set();for(const r of records){const t=r.task;if(!t||seen.has(t.id)||!expected.has(t.id))throw Error('Fixed batch task mismatch');const {modelPaths:ignored,...task}=t;if(objectHash(task)!==objectHash(expected.get(t.id)))throw Error('Fixed task fields changed');seen.add(t.id);}
    if(kind==='collect')stored={complete:true,gameCount:records.length,poolWallMs:result.poolWallMs,priority:result.priority,recordReceipts:records.map(r=>({task:r.task,rawSha256:r.rawSha256,exampleCount:r.exampleCount,collectionDiagnostics:r.collectionDiagnostics})),outcomesClosed:true};
    else stored={...result,records:records.map(r=>compactRecord(r,r.rawSha256))};
   }
   if(kind==='train'&&(!stored.candidate||typeof stored.inferenceHash!=='string'))throw Error('Fit candidate/fingerprint missing');
   state.stages[key]={...entry,status:'complete',finishedAt:now(),result:stored};save();return stored;
  }catch(e){state.stages[key]={...entry,status:'failed',finishedAt:now(),error:e.stack,failure:e.receipt??{reason:e.message}};save();throw e;}
 }
 function stop(reason,status='stopped'){state.status=status;state.finishedAt=now();state.stopReason=reason;state.finalBest=state.bestTeacher?{...state.bestTeacher}:null;save();return state;}
 function accept(fit,phase,confirmation){state.bestTeacher={candidate:fit.candidate,recipe:fit.recipe,phase,modelPath:fit.models?.[fit.candidate]??null,modelHash:fit.modelHashes?.[fit.candidate]??null,inferenceHash:fit.inferenceHash,sources:phase?['all-prior-train-dev','collect-1/train-dev']:['generation-1','generation-2','generation-3','generation-4','generation-5'],confirmation,acceptedAt:now()};state.accepted.push({...state.bestTeacher});save();}
 async function evaluate(fit,phase,slot=0){const key=phase?'s1':`s0-${fit.recipe}`,batch=await stage(key,'screen',{phase,recipe:fit.recipe,tasks:comparisonTasks({candidate:fit.candidate,parent:phase?state.bestTeacher.candidate:PARENT,phase,slot,recipe:fit.recipe})});const summary=summarizeComparison(batch.records);state.stages[key].summary=summary;save();return {fit,summary,...summary.comparisons.parent};}
 async function confirm(fit,phase){const key=phase?'c1':'c0',batch=await stage(key,'confirmation',{phase,recipe:fit.recipe,tasks:comparisonTasks({candidate:fit.candidate,parent:phase?state.bestTeacher.candidate:PARENT,phase,confirmation:true})});const summary=summarizeComparison(batch.records,{confirmation:true});state.stages[key].summary=summary;save();if(summary.passed)accept(fit,phase,summary);return summary.passed;}
 async function run(){
  if(['complete','stopped','failed'].includes(state.status)){check({allowExpired:true});verifyData();return state;}
  try{check();verifyData();if(state.startedAt===null){state.startedAt=now();state.deadlineEpochMs=state.startedAt+LIMITS.elapsedMs;state.status='running';save();}
   const fits=[];for(const recipe of RECIPES){const fit=await stage('f0-'+recipe.id,'train',{phase:0,recipe:recipe.id,warmStart:modelPaths[PARENT]??null,inventory,fitSeed:1729});fits.push({...fit,recipe:recipe.id});}
   const finalists=selectFinalists(fits);state.finalists=finalists.map(f=>({candidate:f.candidate,recipe:f.recipe,inferenceHash:f.inferenceHash}));save();if(!finalists.length)return stop('No eligible unique phase0 refit; no rescue');
   const screened=[];for(let slot=0;slot<finalists.length;slot++)screened.push(await evaluate(finalists[slot],0,slot));
   const qualifying=screened.filter(s=>s.summary.passed).sort((a,b)=>b.winShare-a.winShare||b.meanMargin-a.meanMargin||devOrder(a.fit,b.fit));if(!qualifying.length)return stop('Complete fixed screens; no qualifying phase0 teacher');
   const winner=qualifying[0].fit;state.selectedRecipe=winner.recipe;save();if(!await confirm(winner,0))return stop('Phase0 confirmation failed; no research teacher accepted');
   if(state.deadlineEpochMs-now()<LIMITS.cycleMinimumRemainingMs)return stop('Phase0 teacher accepted; fewer than70 original minutes remain; optional cycle omitted','complete');
   const tasks=collectionTasks(state.bestTeacher.candidate),collected=await stage('collect-1','collect',{phase:1,recipe:winner.recipe,tasks});
   const added=collected.recordReceipts.map(r=>({path:rawPath('collect-1',r.task),sha256:r.rawSha256,gameId:r.task.id,generation:6,setupSeed:r.task.seed,split:r.task.split})),cycleInventory=[...inventory,...added];
   if(!testOnlySkipInputs)verifyInventory(cycleInventory,{cycle:true});
   const fit={...await stage('f1','train',{phase:1,recipe:winner.recipe,warmStart:state.bestTeacher.modelPath,inventory:cycleInventory,fitSeed:1729}),recipe:winner.recipe};
   if(!developmentEligible(fit))return stop('Optional cycle development gate failed; preserve accepted phase0 teacher','complete');
   if(fit.inferenceHash===state.bestTeacher.inferenceHash)return stop('Optional cycle inference duplicate; preserve accepted phase0 teacher','complete');
   const screenedCycle=await evaluate(fit,1);if(!screenedCycle.summary.passed)return stop('Optional cycle screen failed; preserve accepted phase0 teacher','complete');
   const accepted=await confirm(fit,1);return stop(accepted?'One optional cycle accepted; bounded protocol complete':'Optional cycle confirmation failed; preserve accepted phase0 teacher','complete');
  }catch(e){state.status='failed';state.failedAt=now();state.stopReason=e.message;state.finalBest=state.bestTeacher?{...state.bestTeacher}:null;save();throw e;}
 }
 if(!existsSync(path))save();return {run,prepare:()=>state,get state(){return state;}};
}

export function realExecutor({python='python',device='cuda',nodeExecutable=process.execPath,ownerToken=null}={}){return async(kind,ctx)=>{
 const stageOut=resolve(ctx.out,'stages',ctx.key),invoke=(exe,args,dir=stageOut)=>command(exe,args,ctx.deadlineEpochMs,dir,{processRoot:resolve(ctx.out,'processes'),ownerToken});
 if(ctx.tasks){const tasks=ctx.tasks.map(t=>({...t,modelPaths:ctx.modelPaths})),batch=await runBatch({tasks,out:stageOut,workers:28,deadlineEpochMs:ctx.deadlineEpochMs,check:ctx.check,validate:kind==='collect'?validateDataEfficiencyRecord:validateRecord,onProgress:(records,active)=>atomic(resolve(stageOut,'progress.json'),{completed:records.length,total:tasks.length,active,at:Date.now(),outcomesClosed:true})});return {...batch,records:batch.results};}
 if(kind!=='train')throw Error('Unknown stage '+kind);
 const {FEATURE_NAMES}=await import('../wingspan-selfplay/encoder.mjs'),{AUX_NAMES}=await import('../wingspan-neural/targets.mjs');verifyInventory(ctx.inventory,{cycle:ctx.phase===1});
 const index=buildDatasetIndex({inventory:ctx.inventory,featureNames:FEATURE_NAMES,auxNames:AUX_NAMES,cycle:ctx.phase===1}),manifest=resolve(ctx.out,ctx.phase?'cycle-1-dataset-index.json':'phase0-dataset-index.json');freezeDatasetIndex(manifest,index);
 const indexHash=hash(readFileSync(manifest)),base=resolve(ROOT,'scripts/wingspan-selfplay/train.py'),wrapper=resolve(ROOT,'scripts/wingspan-refit/train.py'),startedAt=Date.now();
 // command writes process receipts before spawning; keep them outside the
 // trainer's deliberately nonexistent output directory.
 await invoke(python,['-X','utf8',wrapper,'--manifest',manifest,'--out',stageOut,'--warm-start',ctx.warmStart,'--recipe',ctx.recipe,'--device',device],resolve(ctx.out,'fit-command-receipts',ctx.key));
 verifyInventory(ctx.inventory,{cycle:ctx.phase===1});if(hash(readFileSync(manifest))!==indexHash)throw Error('Combined frozen dataset index changed');
 const summary=completedTraining(stageOut,manifest,base);if(!summary||summary.warmStartSha256!==hash(readFileSync(ctx.warmStart))||summary.normalizationFrozen!==true||summary.config?.seed!==1729)throw Error('Fit warm-start/base/config receipt mismatch');
 const wrapperReceipt=read(resolve(stageOut,'recipe-receipt.json'));
 if(wrapperReceipt.status!=='complete'||wrapperReceipt.recipe!==ctx.recipe||wrapperReceipt.wrapperSha256!==hash(readFileSync(wrapper))||wrapperReceipt.baseTrainerSha256!==hash(readFileSync(base))||wrapperReceipt.manifestSha256!==indexHash||wrapperReceipt.warmStartSha256!==summary.warmStartSha256||wrapperReceipt.trainingSummarySha256!==hash(readFileSync(resolve(stageOut,'training-summary.json')))||objectHash(wrapperReceipt.config)!==objectHash(summary.config)||objectHash(wrapperReceipt.readFiles)!==objectHash(summary.readFiles)||objectHash(wrapperReceipt.architecture)!==objectHash([192,32,16,1]))throw Error('Wrapper recipe completion receipt mismatch');
 const recipe=RECIPES.find(r=>r.id===ctx.recipe);if(summary.config.learningRate!==recipe.learningRate||summary.config.auxiliaryWeight!==recipe.auxiliaryWeight)throw Error('Fixed recipe mismatch');
 const model=read(resolve(stageOut,'model.json'));if(objectHash(model.normalization)!==objectHash(read(ctx.warmStart).normalization))throw Error('Frozen normalization changed');
 const parityOut=resolve(stageOut,'export-preflight');await invoke(nodeExecutable,[resolve(ROOT,'scripts/wingspan-selfplay/preflight.mjs'),'--models='+stageOut,'--out='+parityOut],parityOut);
 const candidate=`refit-${ctx.key}`,models={[candidate]:resolve(stageOut,'model.json')},modelHashes={[candidate]:hash(readFileSync(models[candidate]))};
 return {...summary,candidate,models,modelHashes,wrapperReceipt,inferenceHash:inferenceHash(model),parityPassed:read(resolve(stageOut,'parity.json')).passed===true&&read(resolve(parityOut,'preflight.json')).status==='passed',fitWallMs:Date.now()-startedAt};
};}
export async function main(argv=process.argv.slice(2)){
 const options=Object.fromEntries(argv.map(x=>{const [k,...v]=x.replace(/^--/,'').split('=');return [k,v.length?v.join('='):true];}));if(!options.out||!options.config)throw Error('--out=EXTERNAL_PATH and --config=FROZEN_JSON required; default prepares only; --run launches');
 const out=resolve(options.out),root=resolve(ROOT);if(out===root||out.startsWith(root+'\\')||out.startsWith(root+'/')||/[/\\]OneDrive([/\\]|$)/i.test(out))throw Error('Output must be outside repository/OneDrive');
 const supplied=read(resolve(options.config));validateSeedAudit(supplied.seedAudit);
 const runtimeConfig={...supplied.runtimeConfig,nodeExecutable:process.execPath,nodeVersion:process.version};if(!runtimeConfig.python||!/^cuda(?::\d+)?$/.test(runtimeConfig.device??''))throw Error('Explicit Python/CUDA runtime configuration required');
 const old=existsSync(resolve(out,'manifest.json'))?read(resolve(out,'manifest.json')):null,frozenHashes=old?.config.frozenHashes??freezeSources([resolve(options.config),supplied.seedAudit.path,modelPath(supplied.parentModel),modelPath(supplied.historyModel)]),lock=options.run?acquireCampaignLock(out):null;
 try{if(options.run)assertNoLiveChildren(out);const controller=createController({...supplied,runtimeConfig,out,frozenHashes,sourceRevision:old?.config.sourceRevision??execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim(),executeStage:realExecutor({...runtimeConfig,ownerToken:lock?.token})});return options.run?await controller.run():controller.prepare();}finally{lock?.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().then(s=>console.log(JSON.stringify({status:s.status,deadlineEpochMs:s.deadlineEpochMs,bestTeacher:s.bestTeacher?.candidate??null,productionPromotion:false}))).catch(e=>{console.error(e.stack);process.exitCode=1;});


