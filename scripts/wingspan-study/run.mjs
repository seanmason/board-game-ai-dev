import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {setPriority,getPriority,constants as osConstants,cpus} from 'node:os';
import {play} from './game.mjs';
import {METHODS,screenTasks,canaryTasks,confirmationTasks} from './plan.mjs';
import {analyze,selectCandidate,validateResult,validateResults} from './analyze.mjs';
import {snapshot} from './dashboard.mjs';
import {diagnosticPositions} from './fixtures.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
export function sourceHashes(){
 const paths=[];for(const d of ['wingspan','scripts/wingspan-study']){
  const walk=dir=>{for(const e of readdirSync(resolve(root,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.(mjs|js|json)$/.test(p))paths.push(p);}};walk(d);
 }
 paths.push('docs/work/wingspan-evaluator-compute-2026-10-18.md','benchmarks/wingspan/evaluator-compute-methods.md');
 return Object.fromEntries(paths.sort().map(p=>[p,hash(readFileSync(resolve(root,p)))]));
}
export function validateCalibration(calibration,hashes){
 if(!calibration||!Number.isInteger(calibration.timeBudgetMs)||calibration.timeBudgetMs<1)throw Error('Invalid frozen timing budget');
 const keys=Object.keys(hashes).sort(),old=Object.keys(calibration.sourceHashes??{}).sort();
 if(JSON.stringify(keys)!==JSON.stringify(old))throw Error('Incomplete calibration source inventory');
 for(const p of keys)if(hashes[p]!==calibration.sourceHashes[p])throw Error('Changed calibration source: '+p);
 const expected=new Set(diagnosticPositions().map(f=>f.id)),rows=calibration.rows;
 if(!Array.isArray(rows)||rows.length!==24||new Set(rows.map(r=>r.id)).size!==24||rows.some(r=>!expected.has(r.id)))throw Error('Require all24 diagnostic timing records');
 for(const r of rows){const d=r.diagnostics;
  if(!Number.isFinite(r.elapsedMs)||r.elapsedMs<0||!Number.isFinite(r.generationMs)||r.generationMs<0||r.generationMs>r.elapsedMs||!Number.isSafeInteger(r.roots)||r.roots<1||!Number.isSafeInteger(r.iterations)||r.iterations<Math.max(300,r.roots)||r.unvisited!==0||d?.rolloutCount!==r.iterations||d?.safetyCapCount!==0||d?.unsettledLeaves!==0||d?.settledLeaves!==r.iterations)throw Error('Invalid timing diagnostics: '+r.id);
 }
 const times=rows.map(r=>r.elapsedMs).sort((a,b)=>a-b),median=(times[11]+times[12])/2;
 if(calibration.timeBudgetMs!==Math.max(1,Math.ceil(median)))throw Error('Timing target differs from frozen median');
 return calibration.timeBudgetMs;
}
export function atomic(path,value){mkdirSync(dirname(path),{recursive:true});writeFileSync(path+'.tmp',JSON.stringify(value,null,2));for(let i=0;;i++){try{renameSync(path+'.tmp',path);return;}catch(e){if(!['EPERM','EBUSY','EACCES'].includes(e.code)||i>=8)throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,Math.min(500,25*2**i));}}}
const gamePath=(out,id)=>resolve(out,'games',encodeURIComponent(id)+'.json');
if(!isMainThread){parentPort.on('message',task=>parentPort.postMessage(play(task)));}
else if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
 const mode=args.mode??'study',out=resolve(args.out??''),workers=Number(args.workers??18);
 if(!args.out||!['study','canary','plan'].includes(mode)||!Number.isInteger(workers)||workers<1||workers>18)throw Error('Use --out=DIR --mode=study|canary|plan --workers=1..18');
 setPriority(0,osConstants.priority.PRIORITY_BELOW_NORMAL);
 mkdirSync(out,{recursive:true});
 const hashes=sourceHashes(),revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 let timeBudgetMs=null,calibration=null;
 if(mode!=='canary'){
  if(!args.calibration)throw Error('Freeze --calibration=FILE before planning/running study');
  calibration=JSON.parse(readFileSync(resolve(args.calibration),'utf8'));timeBudgetMs=calibration.timeBudgetMs;
  validateCalibration(calibration,hashes);
 }
 const planned=mode==='canary'?canaryTasks():screenTasks();
 const manifest={version:1,study:'wingspan-evaluator-compute-2026-10-18',mode:mode==='plan'?'study':mode,revision,hashes,workers,priority:getPriority(),cpuCount:cpus().length,
  calibration,timeBudgetMs,tasks:planned,possibleConfirmation:mode==='canary'?null:Object.fromEntries([null,...METHODS.filter(x=>x!=='reference')].map(m=>[m??'none',confirmationTasks(m,timeBudgetMs)]))};
 const mp=resolve(out,'manifest.json');
 if(existsSync(mp)){const prior=JSON.parse(readFileSync(mp));if(JSON.stringify(prior)!==JSON.stringify(manifest))throw Error('Frozen manifest differs; use a distinct execution directory');}else atomic(mp,manifest);
 let scheduled=[...planned],results=[],stage=mode==='canary'?'canary':'screen',status=mode==='plan'?'planned':'running',selection=null;
 const cp=resolve(out,'checkpoint.json'),startedAt=existsSync(cp)?JSON.parse(readFileSync(cp)).startedAt:new Date().toISOString();
 const active=new Map();
 const receiptPath=resolve(out,'execution-receipt.json'),receipts=existsSync(receiptPath)?JSON.parse(readFileSync(receiptPath)):[];
 const invocation={revision,mode,processId:process.pid,node:process.version,platform:process.platform,workers,priority:getPriority(),startedAt:new Date().toISOString()};
 if(mode!=='plan'){receipts.push(invocation);atomic(receiptPath,receipts);}
 const checkSource=()=>{for(const[p,d]of Object.entries(hashes))if(hash(readFileSync(resolve(root,p)))!==d)throw Error('Frozen source changed: '+p);};
 const checkpoint=()=>{
  const running=[...active.values()];atomic(cp,{revision,startedAt,updatedAt:new Date().toISOString(),status,stage,workers,planned:scheduled.length,finished:results.length,selection,active:running,completedIds:results.map(r=>r.id)});
  atomic(resolve(out,'dashboard.json'),snapshot({revision,startedAt,status,stage,workers,tasks:scheduled,results,active:running}));
 };
 const runBatch=async tasks=>{
  const pending=[];for(const t of tasks){const p=gamePath(out,t.id);if(existsSync(p)){const r=JSON.parse(readFileSync(p));const issues=validateResult(r,t);if(issues.length)throw Error('Invalid retained result '+t.id+': '+issues.join(','));results.push(r);}else pending.push(t);}
  checkpoint();checkSource();
  // Deterministic interleaving distributes configurations over the same load interval.
  pending.sort((a,b)=>a.seed-b.seed||a.seat-b.seat||a.matchup.localeCompare(b.matchup));
  const pool=[];let heartbeat;
  try{
   heartbeat=setInterval(()=>checkpoint(),15000);
   await Promise.all(Array.from({length:Math.min(workers,pending.length)},()=>new Promise((ok,fail)=>{
    const w=new Worker(new URL(import.meta.url));pool.push(w);
    const dispatch=()=>{checkSource();const t=pending.shift();if(!t){active.delete(w);w.terminate().then(ok,fail);checkpoint();return;}active.set(w,{id:t.id,stage:t.stage,matchup:t.matchup,seed:t.seed,seat:t.seat,startedAt:new Date().toISOString()});w.postMessage(t);};
    w.on('message',r=>{
     try{const task=tasks.find(t=>t.id===r.id);atomic(gamePath(out,r.id),r);results.push(r);active.delete(w);const issues=validateResult(r,task);console.log(new Date().toISOString(),results.length+'/'+scheduled.length,r.id,r.status,Math.round(r.elapsedMs));checkpoint();if(issues.length){fail(Error('Invalid game '+r.id+': '+issues.join(',')));return;}dispatch();}catch(e){fail(e);}
    });w.on('error',fail);w.on('exit',code=>{if(active.has(w))fail(Error('Unexpected worker exit '+code));});dispatch();
   })));
  }finally{clearInterval(heartbeat);await Promise.all(pool.map(w=>w.terminate()));active.clear();}
 };
 checkpoint();
 if(mode==='plan'){console.log(JSON.stringify({planned:planned.length,maximum:mode==='canary'?8:2800,revision,out}));}
 else{
  try{
   await runBatch(planned);
   if(mode==='study'){
    const screen=analyze(results,{tasks:planned,stage:'screen'});if(!screen.complete)throw Error('Screen did not validate');atomic(resolve(out,'screen-analysis.json'),screen);
    selection=selectCandidate(results);atomic(resolve(out,'selection.json'),selection);
    const followup=confirmationTasks(selection,timeBudgetMs);scheduled=[...planned,...followup];stage='confirmation';checkpoint();checkSource();await runBatch(followup);
    const confirmation=analyze(results.filter(r=>r.stage==='confirmation'),{tasks:followup,stage:'confirmation'});if(!confirmation.complete)throw Error('Confirmation did not validate');atomic(resolve(out,'confirmation-analysis.json'),confirmation);
    atomic(resolve(out,'analysis.json'),{revision,screen,confirmation,selection,productionDefaultsChanged:false});
   }else{const checked=validateResults(results,planned);if(!checked.complete)throw Error('Canary validation failed');atomic(resolve(out,'validation.json'),checked);}
   status='finished';stage='complete';checkSource();checkpoint();invocation.finishedAt=new Date().toISOString();invocation.status=status;atomic(receiptPath,receipts);console.log('Study finished',results.length,'records');
  }catch(e){status='interrupted';invocation.finishedAt=new Date().toISOString();invocation.status=status;atomic(receiptPath,receipts);checkpoint();atomic(resolve(out,'failure.json'),{at:new Date().toISOString(),error:e.stack});throw e;}
 }
}
