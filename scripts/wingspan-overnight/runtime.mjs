import {readFileSync,writeFileSync,mkdirSync,renameSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const digest=b=>createHash('sha256').update(b).digest('hex');
export const read=p=>JSON.parse(readFileSync(p,'utf8'));
export function atomic(p,value){mkdirSync(dirname(p),{recursive:true});writeFileSync(p+'.tmp',JSON.stringify(value,null,2));for(let i=0;;i++){try{renameSync(p+'.tmp',p);return;}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code)||i===8)throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25*2**i);}}}
export function sourceHashes(){const files=[];for(const dir of ['wingspan','scripts/wingspan-study','scripts/wingspan-overnight']){const walk=d=>{for(const e of readdirSync(resolve(ROOT,d),{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.(mjs|js|json|py|ps1)$/.test(p))files.push(p);}};walk(dir);}files.push('docs/work/wingspan-overnight-2026-10-18.md');return Object.fromEntries(files.sort().map(p=>[p,digest(readFileSync(resolve(ROOT,p)))]));}
export function guard(hashes){for(const[p,h]of Object.entries(hashes))if(digest(readFileSync(resolve(ROOT,p)))!==h)throw Error('Frozen source changed: '+p);}
export function admitProfile({remainingMs,canaryElapsed,workers=30}){
 if(!Number.isInteger(workers)||workers<1||workers>30||!Number.isFinite(remainingMs)||remainingMs<0)throw Error('Invalid timing or worker allocation');
 if(canaryElapsed.length!==8||canaryElapsed.some(n=>!Number.isFinite(n)||n<=0))throw Error('Require eight valid canary timings');
 const mean=canaryElapsed.reduce((a,b)=>a+b,0)/8;
 // Soft one-second budgets dominate duration; conservatively cover higher load,
 // unseen engines, and the distinct deployed opponent. No outcomes enter admission.
 const gameMs=Math.max(mean*1.75,Math.max(...canaryElapsed)*1.25);
 const reserveMs=Math.max(30*60e3,remainingMs*.20);
 for(const [profile,count]of [['full',1280],['compact',720]]){
  const estimateMs=count*gameMs/workers+2*Math.max(...canaryElapsed);
  if(estimateMs+reserveMs<=remainingMs)return {profile,scaling:false,gameMs,estimateMs,reserveMs,remainingMs,reason:'Complete screen and both confirmations fit conservative timing; optional scaling omitted to prioritize completion.'};
 }
 return {profile:null,scaling:false,gameMs,reserveMs,remainingMs,reason:'Neither fixed strength campaign fits; retain diagnostics and canaries without starting a truncated screen.'};
}
/** Atomic records, strict retention validation, bounded retries only for crashes
 * without a returned result. Invalid returned games fail closed immediately. */
export async function runBatch({tasks,out,workers=30,deadline,validate,check=()=>{},onProgress=()=>{},workerURL=new URL('./worker.mjs',import.meta.url)}){
 if(!Number.isInteger(workers)||workers<1||workers>30)throw Error('Worker cap is 30');
 const results=[],pending=[],active=new Map(),attempts=new Map(),pool=new Set();let stopped=false;
 for(const task of tasks){const p=resolve(out,'games',encodeURIComponent(task.id)+'.json');if(existsSync(p)){const r=read(p),issues=validate(r,task);if(issues.length)throw Error('Invalid retained game '+task.id+': '+issues.join(','));results.push(r);}else pending.push(task);}
 pending.sort((a,b)=>a.seed-b.seed||a.seat-b.seat||a.matchup.localeCompare(b.matchup));
 const report=()=>onProgress(results,[...active.values()].map(t=>({id:t.id,stage:t.stage,matchup:t.matchup,seed:t.seed,seat:t.seat,startedAt:t.startedAt})));
 let heartbeat,timer;
 try{
  await new Promise((done,fail)=>{
   const finish=()=>{if(!active.size&&(!pending.length||stopped))done();};
   const stop=()=>{if(stopped)return;stopped=true;atomic(resolve(out,'deadline-interruption.json'),{at:new Date().toISOString(),active:[...active.values()],pending:pending.map(t=>t.id)});for(const w of pool)w.terminate();active.clear();report();done();};
   timer=setTimeout(stop,Math.max(1,deadline-Date.now()));heartbeat=setInterval(()=>{try{report();}catch(e){fail(e);}},15000);
   const spawn=()=>{
    if(stopped||Date.now()>=deadline){stop();return;}check();
    const w=new Worker(workerURL);pool.add(w);let intentional=false;
    const dispatch=()=>{try{check();if(stopped||Date.now()>=deadline){stop();return;}const task=pending.shift();if(!task){intentional=true;pool.delete(w);w.terminate();finish();return;}active.set(w,{...task,startedAt:new Date().toISOString()});w.postMessage({task,deadline});report();}catch(e){fail(e);}};
    w.on('message',r=>{try{const task=active.get(w);if(!task||stopped)return;active.delete(w);if(r.status==='deadline'){atomic(resolve(out,'interruptions',encodeURIComponent(task.id)+'.json'),r);stop();return;}atomic(resolve(out,'games',encodeURIComponent(task.id)+'.json'),r);results.push(r);const issues=validate(r,task);report();if(issues.length){fail(Error('Invalid game '+task.id+': '+issues.join(',')));return;}dispatch();}catch(e){fail(e);}});
    w.on('error',e=>{atomic(resolve(out,'worker-errors',`${Date.now()}-${w.threadId}.json`),{error:e.stack});});
    w.on('exit',code=>{try{pool.delete(w);const task=active.get(w);active.delete(w);if(stopped||intentional)return;if(task){const n=(attempts.get(task.id)??0)+1;attempts.set(task.id,n);atomic(resolve(out,'retry-log.json'),Object.fromEntries(attempts));if(n>1){fail(Error('Repeated worker crash '+task.id+' code '+code));return;}pending.unshift(task);spawn();}finish();}catch(e){fail(e);}});dispatch();
   };
   const initialWorkers=Math.min(workers,pending.length);for(let i=0;i<initialWorkers;i++)spawn();report();finish();
  });
 }finally{stopped=true;clearTimeout(timer);clearInterval(heartbeat);await Promise.all([...pool].map(w=>w.terminate()));active.clear();report();}
 return {results,complete:results.length===tasks.length,deadlineReached:Date.now()>=deadline};
}
