import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {play} from './benchmark-wingspan-screen.mjs';
export const plan={version:1,evaluators:['action-budget-planner','bottleneck-engine','phase-calibrated'],pairs:20,horizon:4,rolloutStepLimit:48,
 screenBudget:100,confirmationBudget:300,minimumWinShare:.6,minimumMeanMargin:0,maxSelected:2,
 screenSeeds:Array.from({length:20},(_,i)=>1608400+i*997),confirmationSeeds:Array.from({length:20},(_,i)=>1718400+i*997)};
export function tasks(stage='screen',selected=plan.evaluators){
 const rows=[],seeds=stage==='screen'?plan.screenSeeds:plan.confirmationSeeds,budget=stage==='screen'?100:300;
 for(const seed of seeds)for(const evaluator of selected)for(const opponentEvaluator of (stage==='screen'?['practical-combined']:['practical-combined','current']))for(const seat of [0,1]){
  const matchup=`${stage}-${evaluator}-v-${opponentEvaluator}`;
  rows.push({id:`${matchup}-${seed}-${seat}`,matchup,stage,seed,seat,evaluator,opponentEvaluator,budget,opponentBudget:budget,opponent:'belief-rollout',horizon:4,opponentHorizon:4,rolloutStepLimit:48});
 }
 return rows;
}
export function selectCandidates(results){
 const summaries=plan.evaluators.map(evaluator=>{
  const rows=results.filter(r=>r.stage==='screen'&&r.evaluator===evaluator),valid=rows.filter(r=>r.status==='complete');
  return {evaluator,games:rows.length,complete:valid.length,winShare:valid.reduce((s,r)=>s+r.winShare,0)/Math.max(1,valid.length),meanMargin:valid.reduce((s,r)=>s+r.margin,0)/Math.max(1,valid.length)};
 });
 const selected=summaries.filter(r=>r.games===40&&r.complete===40&&r.winShare>=plan.minimumWinShare&&r.meanMargin>plan.minimumMeanMargin)
  .sort((a,b)=>b.winShare-a.winShare||b.meanMargin-a.meanMargin||a.evaluator.localeCompare(b.evaluator)).slice(0,plan.maxSelected).map(r=>r.evaluator);
 return {rule:'All 40 valid; win share >= 60%; mean margin > 0; top two by win share then margin',selected,summaries};
}
const atomic=(p,v)=>{writeFileSync(p+'.tmp',JSON.stringify(v,null,2));renameSync(p+'.tmp',p);};
if(!isMainThread)parentPort.on('message',task=>parentPort.postMessage(play(task)));
else if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6),workers=Number(process.argv.find(x=>x.startsWith('--workers='))?.slice(10)||24);
 if(!out||!Number.isInteger(workers)||workers<1||workers>24)throw Error('Use --out=directory --workers=1..24');
 mkdirSync(out,{recursive:true});const root=fileURLToPath(new URL('../',import.meta.url));
 const files=['scripts/benchmark-wingspan-screen.mjs','scripts/benchmark-wingspan-refinements.mjs'];
 const walk=d=>{for(const e of readdirSync(resolve(root,d),{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.(js|json)$/.test(p))files.push(p);}};walk('wingspan');
 const hashes=Object.fromEntries(files.sort().map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')]));
 const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const manifest={plan,revision,hashes,tasks:tasks(),possibleConfirmationTasks:tasks('confirmation')},mp=resolve(out,'manifest.json');
 if(existsSync(mp)&&JSON.stringify(JSON.parse(readFileSync(mp)))!==JSON.stringify(manifest))throw Error('Manifest mismatch; use fresh directory');
 if(!existsSync(mp))atomic(mp,manifest);
 const cp=resolve(out,'checkpoint.json'),startedAt=existsSync(cp)?JSON.parse(readFileSync(cp)).startedAt:new Date().toISOString();
 let scheduled=tasks(),stage='screen',selection=null;const active=new Map(),results=[];
 const checkpoint=()=>atomic(cp,{revision,startedAt,updatedAt:new Date().toISOString(),workers,stage,selection,planned:scheduled.length,finished:results.length,complete:results.filter(r=>r.status==='complete').length,active:[...active.values()],tasks:scheduled,results});
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
 await runBatch(scheduled);selection=selectCandidates(results);atomic(resolve(out,'selection.json'),selection);
 const followup=tasks('confirmation',selection.selected);scheduled=[...scheduled,...followup];
 if(followup.length){stage='confirmation';await runBatch(followup);}
 stage='complete';checkpoint();
}
