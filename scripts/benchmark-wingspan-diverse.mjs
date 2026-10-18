import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {play} from './benchmark-wingspan-screen.mjs';
export const plan={version:1,evaluators:["bonus-threshold","round-race","future-goals","egg-liquidity","capacity-investment","typed-food","hand-quality","row-unlocks","power-synergy","endgame-cashout","opponent-tempo","strategic-blend"],pairs:24,horizon:4,rolloutStepLimit:48,
 screenBudget:100,confirmationBudget:300,minimumWinShare:.6,minimumMeanMargin:0,maxSelected:3,
 screenSeeds:Array.from({length:24},(_,i)=>2048400+i*997),confirmationSeeds:Array.from({length:20},(_,i)=>2158400+i*997)};
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
 const selected=summaries.filter(r=>r.games===48&&r.complete===48&&r.winShare>=plan.minimumWinShare&&r.meanMargin>plan.minimumMeanMargin)
  .sort((a,b)=>b.winShare-a.winShare||b.meanMargin-a.meanMargin||a.evaluator.localeCompare(b.evaluator)).slice(0,plan.maxSelected).map(r=>r.evaluator);
 return {rule:'All 48 valid; win share >= 60%; mean margin > 0; top three by win share then margin',selected,summaries};
}
const atomic=(p,v)=>{writeFileSync(p+'.tmp',JSON.stringify(v,null,2));for(let attempt=0;;attempt++){try{renameSync(p+'.tmp',p);return;}catch(e){if(!['EPERM','EBUSY','EACCES'].includes(e.code)||attempt>=8)throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,Math.min(500,25*2**attempt));}}};
if(!isMainThread)parentPort.on('message',task=>parentPort.postMessage(play(task)));
else if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6),workers=Number(process.argv.find(x=>x.startsWith('--workers='))?.slice(10)||24);
 if(!out||!Number.isInteger(workers)||workers<1||workers>24)throw Error('Use --out=directory --workers=1..24');
 mkdirSync(out,{recursive:true});const root=fileURLToPath(new URL('../',import.meta.url));
 const files=['scripts/benchmark-wingspan-screen.mjs','scripts/benchmark-wingspan-diverse.mjs'];
 const walk=d=>{for(const e of readdirSync(resolve(root,d),{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.(js|json)$/.test(p))files.push(p);}};walk('wingspan');
 const hashes=Object.fromEntries(files.sort().map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')]));
 let revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const manifest={plan,revision,hashes,tasks:tasks(),possibleConfirmationTasks:tasks('confirmation')},mp=resolve(out,'manifest.json');
 if(existsSync(mp)&&JSON.stringify(JSON.parse(readFileSync(mp)))!==JSON.stringify(manifest)){
  const frozen=JSON.parse(readFileSync(mp));
  if(!process.argv.includes('--resume-orchestration-update'))throw Error('Manifest mismatch; use fresh directory');
  for(const key of ['plan','tasks','possibleConfirmationTasks'])if(JSON.stringify(frozen[key])!==JSON.stringify(manifest[key]))throw Error('Frozen design mismatch');
  for(const [p,hash] of Object.entries(frozen.hashes))if(p!=='scripts/benchmark-wingspan-diverse.mjs'&&hashes[p]!==hash)throw Error('Frozen game source changed: '+p);
  atomic(resolve(out,'resume-'+Date.now()+'.json'),{at:new Date().toISOString(),reason:'Retry Windows transient rename sharing failures; preserve completed games',originalRevision:frozen.revision,resumeRevision:revision,originalRunnerHash:frozen.hashes['scripts/benchmark-wingspan-diverse.mjs'],resumeRunnerHash:hashes['scripts/benchmark-wingspan-diverse.mjs'],verifiedFrozenGameplay:true});
  revision=frozen.revision;
 }
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
