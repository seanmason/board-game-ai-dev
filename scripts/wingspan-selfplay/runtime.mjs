import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Worker} from 'node:worker_threads';
import {setPriority,getPriority,constants} from 'node:os';
import {atomic,read,validateRecord,compactRecord,verifyRawRecord,hash,objectHash,frozenTask} from './common.mjs';
export {atomic,read} from './common.mjs';
let priorityEstablished=false;
export function ensureBelowNormal(){if(priorityEstablished)return;if(process.platform==='win32'){setPriority(0,constants.priority.PRIORITY_BELOW_NORMAL);if(getPriority(0)<constants.priority.PRIORITY_BELOW_NORMAL)throw Error('Cannot establish BelowNormal process priority');}priorityEstablished=true;}
export async function runBatch({tasks,out,workers=24,deadlineEpochMs,deadline=deadlineEpochMs,validate=validateRecord,check=()=>{},onProgress=()=>{},watchdogMs=300000,workerURL=new URL('./worker.mjs',import.meta.url),WorkerClass=Worker,now=Date.now}){
 if(!Number.isInteger(workers)||workers<1||workers>24)throw Error('Worker cap is 24');
 if(!Number.isFinite(deadline)||!Number.isFinite(watchdogMs)||watchdogMs<=0)throw Error('Finite deadline/watchdog required');
 if(new Set(tasks.map(t=>t.id)).size!==tasks.length)throw Error('Duplicate task ids');
 ensureBelowNormal();
 const results=[],pending=[],active=new Map(),pool=new Set();let stopped=false,timer,heartbeat;
 const path=t=>resolve(out,'games',encodeURIComponent(t.id)+'.json');
 const receiptPath=t=>resolve(out,'receipts',encodeURIComponent(t.id)+'.json');
 for(const task of tasks){if(existsSync(path(task))){if(!existsSync(receiptPath(task)))throw Error('Missing retained raw data hash receipt '+task.id);const receipt=read(receiptPath(task));if(receipt.taskHash!==objectHash(frozenTask(task)))throw Error('Retained task hash mismatch '+task.id);verifyRawRecord(receipt,path(task));const record=read(path(task)),issues=validate(record,task);if(issues.length)throw Error(`Invalid retained task ${task.id}: ${issues.join(', ')}`);results.push(compactRecord(record,receipt.rawSha256));}else if(existsSync(receiptPath(task)))throw Error('Missing retained raw game '+task.id);else pending.push(task);}
 const report=()=>onProgress(results,[...active.values()].map(({task,startedAt})=>({id:task.id,startedAt})));
 try{return await new Promise((done,reject)=>{
  const failure=(reason,task,error)=>{if(stopped)return;stopped=true;const receipt={status:'failed',reason,at:now(),task:task??null,error:error?.stack??String(error??''),active:[...active.values()].map(x=>x.task),pending:pending.map(t=>t.id)};try{atomic(resolve(out,'failures',`${now()}-${reason}.json`),receipt);}catch(e){reject(e);return;}reject(Object.assign(Error(reason+(task?' '+task.id:'')),{receipt}));};
  const finish=()=>{if(!pending.length&&!active.size&&!stopped){stopped=true;done({results,complete:true,deadlineReached:false});}};
  const dispatch=w=>{try{check();if(now()>=deadline){failure('deadline');return;}const task=pending.shift();if(!task){pool.delete(w);w.terminate();finish();return;}const startedAt=now(),watchdog=setTimeout(()=>failure('watchdog',task),Math.min(watchdogMs,Math.max(1,deadline-now())));active.set(w,{task,startedAt,watchdog});w.postMessage({task,deadlineEpochMs:deadline});report();}catch(e){failure('dispatch',null,e);}};
  timer=setTimeout(()=>failure('deadline'),Math.max(1,deadline-now()));heartbeat=setInterval(()=>{try{check();report();}catch(e){failure('frozen-input-changed',null,e);}},1000);
  for(let i=0;i<Math.min(workers,pending.length);i++){try{check();const w=new WorkerClass(workerURL);pool.add(w);w.on('message',record=>{const slot=active.get(w);if(!slot||stopped)return;clearTimeout(slot.watchdog);active.delete(w);try{atomic(path(slot.task),record);const rawSha256=hash(readFileSync(path(slot.task)));atomic(receiptPath(slot.task),{rawSha256,taskHash:objectHash(frozenTask(slot.task))});const issues=validate(record,slot.task);if(issues.length){failure('invalid-result',slot.task,Error(issues.join(', ')));return;}results.push(compactRecord(record,rawSha256));report();dispatch(w);}catch(e){failure('record-error',slot.task,e);}});w.on('error',e=>failure('worker-error',active.get(w)?.task,e));w.on('exit',code=>{pool.delete(w);if(active.has(w)&&!stopped)failure('worker-exit',active.get(w).task,Error('exit '+code));});dispatch(w);}catch(e){failure('spawn-error',null,e);break;}}
  finish();
 });}finally{stopped=true;clearTimeout(timer);clearInterval(heartbeat);for(const slot of active.values())clearTimeout(slot.watchdog);await Promise.all([...pool].map(w=>w.terminate()));active.clear();report();}
}
