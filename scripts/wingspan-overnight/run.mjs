import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {setPriority,constants} from 'node:os';
import {ROOT,read,atomic,guard,runBatch,admitProfile,digest} from './runtime.mjs';
import {canaryTasks,screenTasks,confirmationTasks} from './plan.mjs';
import {validateResult,analyze,selectCandidate} from './analyze.mjs';
import {snapshot} from './dashboard.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
if(!args.config||!args.launch)throw Error('Use --config=READY_JSON --launch=LAUNCH_JSON');
const config=read(resolve(args.config)),launch=read(resolve(args.launch)),out=config.out,deadline=Date.parse(launch.deadline);
if(launch.configHash!==digest(readFileSync(resolve(args.config)))||launch.workers!==30||!Number.isFinite(deadline))throw Error('Launch receipt does not match readiness configuration');
setPriority(0,constants.priority.PRIORITY_BELOW_NORMAL);guard(config.hashes);
let tasks=[],results=[],stage='diagnostics',status='running',selection=null,anchor='reference';
const publish=(active=[])=>{
 atomic(resolve(out,'checkpoint.json'),{revision:config.revision,startedAt:launch.startedAt,updatedAt:new Date().toISOString(),deadline:launch.deadline,status,stage,workers:30,planned:tasks.length,finished:results.length,active,anchor,selection});
 atomic(resolve(out,'dashboard.json'),snapshot({revision:config.revision,startedAt:launch.startedAt,status,stage,workers:30,tasks,results,active,deadline:launch.deadline}));
};
async function batch(next){
 const previous=[...results];tasks.push(...next);publish();
 const done=await runBatch({tasks:next,out,workers:30,deadline,validate:validateResult,check:()=>guard(config.hashes),onProgress:(rs,active)=>{results=[...previous,...rs];publish(active);}});
 if(!done.complete){status='deadline';throw Error('Deadline before fixed stage completed');}
 return done.results;
}
async function diagnostic(){
 const target=resolve(out,'diagnostics');
 const validate=()=>{const d=read(resolve(target,'diagnostics.json'));if(!['complete','time-limited'].includes(d.status)||!d.rows?.length||d.rows.some(r=>r.diagnostics.safetyCapCount||r.diagnostics.unsettledLeaves))throw Error('Invalid diagnostic endpoint/inventory');for(const[p,h]of Object.entries(d.sourceHashes??{}))if(config.hashes[p]!==h)throw Error('Diagnostic source differs');if(Object.keys(d.sourceHashes??{}).length!==7)throw Error('Incomplete diagnostic source inventory');};
 if(existsSync(resolve(target,'diagnostics.json'))){validate();return;}
 const duration=Math.min(600000,deadline-Date.now()-60000);if(duration<1000)throw Error('No time for diagnostic stage');
 await new Promise((ok,fail)=>{const p=spawn(process.execPath,[resolve(ROOT,'scripts/wingspan-overnight/diagnostics.mjs'),'--out='+target,'--max-ms='+duration],{cwd:ROOT,windowsHide:true,stdio:'ignore'});const timer=setTimeout(()=>{p.kill();fail(Error('Diagnostic exceeded bounded grace period'));},duration+60000);p.on('error',e=>{clearTimeout(timer);fail(e);});p.on('exit',code=>{clearTimeout(timer);code===0?ok():fail(Error('Diagnostic failed '+code));});});
 validate();
}
try{
 const prior=read(resolve(config.previousStudy,'analysis.json'));
 if(!prior.screen?.complete||!prior.confirmation?.complete)throw Error('Prior study must finish validly before this campaign');
 anchor=prior.confirmation.adoptionRecommended===true&&prior.selection?.method?prior.selection.method:'reference';
 const base={version:1,revision:config.revision,hashes:config.hashes,startedAt:launch.startedAt,deadline:launch.deadline,workers:30,anchor,anchorEvidenceSha256:digest(readFileSync(resolve(config.previousStudy,'analysis.json'))),productionDefaultsChanged:false,seedAudit:config.seedAudit,optionalScaling:false};
 const manifestPath=resolve(out,'manifest.json');
 if(existsSync(manifestPath)){const old=read(manifestPath);if(JSON.stringify(old)!==JSON.stringify(base))throw Error('Frozen launch manifest differs');}else atomic(manifestPath,base);
 publish();await diagnostic();guard(config.hashes);
 stage='canary';const canaries=await batch(canaryTasks(anchor)),canaryAnalysis=analyze(canaries,canaryTasks(anchor),{stage:'canary'});if(!canaryAnalysis.complete||!canaryAnalysis.designValid)throw Error('Incomplete canary validation');atomic(resolve(out,'canary-analysis.json'),canaryAnalysis);
 const admissionPath=resolve(out,'admission.json');
 const admission=existsSync(admissionPath)?read(admissionPath):admitProfile({remainingMs:deadline-Date.now(),canaryElapsed:canaries.map(r=>r.elapsedMs)});
 const admissionReceipt=resolve(out,'admission-receipt.json');
 if(existsSync(admissionPath)){
  const receipt=read(admissionReceipt),recomputed=admitProfile({remainingMs:admission.remainingMs,canaryElapsed:canaries.map(r=>r.elapsedMs)});
  if(receipt.sha256!==digest(readFileSync(admissionPath))||JSON.stringify(recomputed)!==JSON.stringify(admission))throw Error('Frozen admission differs from canary timing inputs');
 }else{atomic(admissionPath,admission);atomic(admissionReceipt,{sha256:digest(readFileSync(admissionPath)),canaryElapsed:canaries.map(r=>r.elapsedMs),at:new Date().toISOString()});}
 if(!admission.profile){status='finished';stage='diagnostics-only';atomic(resolve(out,'analysis.json'),{status,reason:admission.reason,adoptionRecommended:false,productionDefaultsChanged:false});}
 else{
  stage='screen';const planned=screenTasks(anchor,admission.profile);atomic(resolve(out,'screen-tasks.json'),planned);
  // Freeze all possible held-out branches before the first screen outcome.
  atomic(resolve(out,'possible-confirmation.json'),Object.fromEntries(['power-aware','noprior','both','lean-es'].map(key=>[key,confirmationTasks(key,anchor,admission.profile)])));
  const screen=await batch(planned),screenAnalysis=analyze(screen,planned,{stage:'screen'});if(!screenAnalysis.complete||!screenAnalysis.designValid)throw Error('Invalid completed screen');
  atomic(resolve(out,'screen-analysis.json'),screenAnalysis);selection=selectCandidate(screen,planned);atomic(resolve(out,'selection.json'),selection);
  let confirmation=null;
  if(selection){stage='confirmation';const ts=confirmationTasks(selection,anchor,admission.profile);atomic(resolve(out,'confirmation-tasks.json'),ts);const rs=await batch(ts);confirmation=analyze(rs,ts,{stage:'confirmation'});if(!confirmation.complete||!confirmation.designValid)throw Error('Invalid completed confirmation');atomic(resolve(out,'confirmation-analysis.json'),confirmation);}
  atomic(resolve(out,'analysis.json'),{anchor,profile:admission.profile,screen:screenAnalysis,selection,confirmation,adoptionRecommended:confirmation?.adoptionRecommended===true,productionDefaultsChanged:false});status='finished';stage='complete';
 }
 guard(config.hashes);publish();
}catch(e){if(status!=='deadline')status=Date.now()>=deadline?'deadline':'interrupted';atomic(resolve(out,'failure.json'),{at:new Date().toISOString(),status,error:e.stack,productionDefaultsChanged:false});publish();process.exitCode=status==='deadline'?0:1;}
