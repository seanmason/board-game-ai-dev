import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {play} from './benchmark-wingspan-screen.mjs';
export const plan={version:1,evaluators:['slot-scarcity','robust-value','final-space-robust','final-space-saturation','final-robust-saturation','final-space-robust-saturation','final-development-options','final-cautious-portfolio'],pairs:40,horizon:4,rolloutStepLimit:48,screenBudget:300,confirmationBudget:300,minimumWinShare:.55,minimumMeanMargin:0,maxSelected:2,confirmationAlpha:.025,confirmationTCritical:1.9842169515,screenSeeds:Array.from({length:40},(_,i)=>2708400+i*997),confirmationSeeds:Array.from({length:100},(_,i)=>2818400+i*997)};
export function tasks(stage='screen',selected=plan.evaluators){
 const rows=[],seeds=stage==='screen'?plan.screenSeeds:plan.confirmationSeeds,budget=300;
 for(const seed of seeds)for(const evaluator of selected)for(const opponentEvaluator of ['practical-combined'])for(const seat of [0,1]){
  const matchup=`${stage}-${evaluator}-v-${opponentEvaluator}`;
  rows.push({id:`${matchup}-${seed}-${seat}`,matchup,stage,seed,seat,evaluator,opponentEvaluator,budget,opponentBudget:budget,opponent:'belief-rollout',horizon:4,opponentHorizon:4,rolloutStepLimit:48});
 }
 return rows;
}
export function selectCandidates(results){
 const summaries=plan.evaluators.map(evaluator=>{
  const rows=results.filter(r=>r.stage==='screen'&&r.evaluator===evaluator),expected=tasks('screen',[evaluator]),byId=new Map(rows.map(r=>[r.id,r])),valid=expected.map(t=>byId.get(t.id)).filter((r,i)=>r?.status==='complete'&&r.seed===expected[i].seed&&r.seat===expected[i].seat&&r.opponentEvaluator==='practical-combined'&&r.budget===300&&r.opponentBudget===300&&[0,.5,1].includes(r.winShare)&&Number.isFinite(r.margin));
  return {evaluator,games:rows.length,complete:valid.length,winShare:valid.reduce((s,r)=>s+r.winShare,0)/Math.max(1,valid.length),meanMargin:valid.reduce((s,r)=>s+r.margin,0)/Math.max(1,valid.length)};
 });
 const selected=summaries.filter(r=>r.games===80&&r.complete===80&&r.winShare>=plan.minimumWinShare&&r.meanMargin>plan.minimumMeanMargin)
  .sort((a,b)=>b.winShare-a.winShare||b.meanMargin-a.meanMargin||a.evaluator.localeCompare(b.evaluator)).slice(0,plan.maxSelected).map(r=>r.evaluator);
 return {rule:'All 80 valid; win share >= 55%; mean margin > 0; top two by win share then margin',selected,summaries};
}
export function decideFinal(results,selected){
 if(selected.length>2||new Set(selected).size!==selected.length||selected.some(e=>!plan.evaluators.includes(e)))throw Error('Final decision requires at most two distinct planned finalists');
 const summaries=selected.map(evaluator=>{
  const expected=tasks('confirmation',[evaluator]),rows=results.filter(r=>r.stage==='confirmation'&&r.evaluator===evaluator),byId=new Map(rows.map(r=>[r.id,r]));
  const valid=rows.length===expected.length&&byId.size===expected.length&&expected.every(t=>{const r=byId.get(t.id);return r?.status==='complete'&&r.seed===t.seed&&r.seat===t.seat&&r.opponentEvaluator===t.opponentEvaluator&&r.budget===300&&r.opponentBudget===300&&[0,.5,1].includes(r.winShare)&&Number.isFinite(r.margin)});
  if(!valid)return {evaluator,valid:false,games:rows.length,promote:false,reason:'Requires all 200 valid unique confirmation games and 100 complete seed pairs'};
  const pairShares=plan.confirmationSeeds.map(seed=>rows.filter(r=>r.seed===seed).reduce((n,r)=>n+r.winShare,0)/2),winShare=pairShares.reduce((a,b)=>a+b,0)/pairShares.length,meanMargin=rows.reduce((a,r)=>a+r.margin,0)/rows.length,sampleVariance=pairShares.reduce((a,x)=>a+(x-winShare)**2,0)/(pairShares.length-1),standardError=Math.sqrt(sampleVariance/pairShares.length),lowerBound=winShare-plan.confirmationTCritical*standardError;
  return {evaluator,valid:true,games:rows.length,pairs:pairShares.length,winShare,meanMargin,lowerBound,standardError,alpha:plan.confirmationAlpha,promote:lowerBound>.5&&meanMargin>0};
 });
 const qualified=summaries.filter(r=>r.promote).sort((a,b)=>b.lowerBound-a.lowerBound||b.meanMargin-a.meanMargin||(a.evaluator.split('-').length-b.evaluator.split('-').length)||a.evaluator.localeCompare(b.evaluator));
 return {baseline:'practical-combined',choice:qualified[0]?.evaluator??'practical-combined',promote:!!qualified.length,rule:'Independent fresh confirmation: approximate one-sided 97.5% paired t lower bound > 0.5 (100 seed pairs; t99=1.9842169515), positive mean margin, all 200 valid and no complete-game caps/errors; Bonferroni across at most two finalists gives approximate 5% family error',summaries};
}
export const atomic=(p,v,io={writeFileSync,renameSync},pause=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms))=>{io.writeFileSync(p+'.tmp',JSON.stringify(v,null,2));for(let attempt=0;;attempt++){try{io.renameSync(p+'.tmp',p);return;}catch(e){if(!['EPERM','EBUSY','EACCES'].includes(e.code)||attempt>=8)throw e;pause(Math.min(500,25*2**attempt));}}};
if(!isMainThread)parentPort.on('message',task=>parentPort.postMessage(play(task)));
else if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6),workers=Number(process.argv.find(x=>x.startsWith('--workers='))?.slice(10)||24);
 if(!out||!Number.isInteger(workers)||workers<1||workers>24)throw Error('Use --out=directory --workers=1..24');
 mkdirSync(out,{recursive:true});const root=fileURLToPath(new URL('../',import.meta.url));
 const files=['scripts/benchmark-wingspan-screen.mjs','scripts/benchmark-wingspan-final.mjs'];
 const walk=d=>{for(const e of readdirSync(resolve(root,d),{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.(js|json)$/.test(p))files.push(p);}};walk('wingspan');
 const hashes=Object.fromEntries(files.sort().map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')]));
 const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const manifest={plan,revision,hashes,tasks:tasks(),possibleConfirmationTasks:tasks('confirmation')},mp=resolve(out,'manifest.json');
 if(existsSync(mp)&&JSON.stringify(JSON.parse(readFileSync(mp)))!==JSON.stringify(manifest))throw Error('Manifest mismatch; use fresh directory');
 if(!existsSync(mp))atomic(mp,manifest);

 const cp=resolve(out,'checkpoint.json');let startedAt=existsSync(cp)?JSON.parse(readFileSync(cp)).startedAt:new Date().toISOString();
 let scheduled=tasks(),stage='screen',selection=null;const active=new Map(),results=[];
 const queuedAt=new Date().toISOString();
 const checkpoint=()=>atomic(cp,{revision,startedAt,queuedAt,updatedAt:new Date().toISOString(),workers,stage,selection,decision:stage==='complete'?decideFinal(results,selection?.selected??[]):null,planned:scheduled.length,finished:results.length,complete:results.filter(r=>r.status==='complete').length,active:[...active.values()],tasks:scheduled,results});
 const runBatch=async batch=>{
  const pending=[];for(const t of batch){const p=resolve(out,t.id+'.json');if(existsSync(p))results.push(JSON.parse(readFileSync(p)));else pending.push(t);}
  checkpoint();
  await Promise.all(Array.from({length:Math.min(workers,pending.length)},()=>new Promise((ok,fail)=>{
   const w=new Worker(new URL(import.meta.url));
   const dispatch=()=>{const t=pending.shift();if(!t){active.delete(w);w.terminate().then(ok,fail);checkpoint();return;}active.set(w,{id:t.id,startedAt:new Date().toISOString()});w.postMessage(t);checkpoint();};
   w.on('message',r=>{atomic(resolve(out,r.id+'.json'),r);results.push(r);console.log(new Date().toISOString(),r.id,r.status,Math.round(r.elapsedMs));if(r.status!=='complete')process.exitCode=1;dispatch();});
   w.on('error',fail);dispatch();
  })));
 };
 for(const [p,hash] of Object.entries(hashes))if(createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')!==hash)throw Error('Source changed while queued: '+p);
 await runBatch(scheduled);selection=selectCandidates(results);atomic(resolve(out,'selection.json'),selection);
 const followup=tasks('confirmation',selection.selected);scheduled=[...scheduled,...followup];
 if(followup.length){stage='confirmation';await runBatch(followup);}
 const decision=decideFinal(results,selection.selected);atomic(resolve(out,'decision.json'),decision);stage='complete';checkpoint();
}
