import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBatch} from '../scripts/wingspan-overnight/runtime.mjs';

function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'wingspan-pool-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const worker=join(dir,'mock-worker.mjs'),log=join(dir,'events.ndjson');
 writeFileSync(worker,`
 import {parentPort} from 'node:worker_threads';
 import {appendFileSync} from 'node:fs';
 parentPort.on('message',async({task,deadline})=>{
  appendFileSync(task.log,JSON.stringify({event:'start',id:task.id})+'\\n');
  if(task.crash)process.exit(7);
  await new Promise(r=>setTimeout(r,task.delayMs??25));
  appendFileSync(task.log,JSON.stringify({event:'end',id:task.id})+'\\n');
  parentPort.postMessage({...task,status:task.returnDeadline?'deadline':'complete',valid:!task.invalid,
   scores:[75,65],margin:10,winShare:1,diagnostics:{mock:true}});
 });
 `);
 const tasks=n=>Array.from({length:n},(_,i)=>({id:'mock-'+i,seed:100+i,seat:i%2,stage:'test',matchup:'mock',log}));
 return {dir,log,tasks,workerURL:pathToFileURL(worker),out:join(dir,'results')};
}
const validate=(r,t)=>[...(r.id!==t.id?['id']:[]),...(r.status!=='complete'?['status']:[]),...(r.valid!==true?['valid']:[])];
const events=f=>existsSync(f.log)?readFileSync(f.log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];

test('pool never exceeds worker cap and fills an initially small queue',async t=>{
 const f=fixture(t),tasks=f.tasks(4);tasks.forEach(task=>task.delayMs=150);
 const result=await runBatch({...f,tasks,workers:4,deadline:Date.now()+5000,validate});
 assert.equal(result.complete,true);assert.equal(result.results.length,4);
 let current=0,max=0;
 for(const e of events(f)){current+=e.event==='start'?1:-1;max=Math.max(max,current);assert.ok(current>=0);assert.ok(current<=4);}
 assert.equal(current,0);assert.equal(max,4,'four queued tasks should fill four requested workers');
 await assert.rejects(runBatch({...f,tasks,workers:31,deadline:Date.now()+5000,validate}),/Worker cap/);
});

test('atomic completed records resume without rerunning or replacing retained games',async t=>{
 const f=fixture(t),tasks=f.tasks(3),options={...f,tasks,workers:2,deadline:Date.now()+5000,validate};
 const first=await runBatch(options);assert.equal(first.complete,true);
 const count=events(f).length,record=readFileSync(resolve(f.out,'games','mock-0.json'),'utf8');
 const second=await runBatch(options);assert.equal(second.complete,true);
 assert.equal(events(f).length,count);assert.equal(readFileSync(resolve(f.out,'games','mock-0.json'),'utf8'),record);
 writeFileSync(resolve(f.out,'games','mock-0.json'),JSON.stringify({...first.results.find(r=>r.id==='mock-0'),valid:false}));
 await assert.rejects(runBatch(options),/Invalid retained game/);assert.equal(events(f).length,count);
});

test('invalid returned results are retained but fail closed without retries',async t=>{
 const f=fixture(t),tasks=f.tasks(2);tasks[0].invalid=true;
 await assert.rejects(runBatch({...f,tasks,workers:1,deadline:Date.now()+5000,validate}),/Invalid game mock-0/);
 const raw=JSON.parse(readFileSync(resolve(f.out,'games','mock-0.json'),'utf8'));
 assert.equal(raw.valid,false);assert.equal(existsSync(resolve(f.out,'retry-log.json')),false);
 assert.equal(events(f).filter(e=>e.event==='start').length,1);
});

test('worker crash retries once then rejects with the attempt log',async t=>{
 const f=fixture(t),tasks=f.tasks(1);tasks[0].crash=true;
 await assert.rejects(runBatch({...f,tasks,workers:1,deadline:Date.now()+5000,validate}),/Repeated worker crash/);
 assert.equal(JSON.parse(readFileSync(resolve(f.out,'retry-log.json'),'utf8'))['mock-0'],2);
 assert.equal(events(f).filter(e=>e.event==='start').length,2);
 assert.equal(existsSync(resolve(f.out,'games','mock-0.json')),false);
});

test('global deadline terminates long workers and preserves complete records only',async t=>{
 const f=fixture(t),tasks=f.tasks(3);tasks.forEach(task=>task.delayMs=10000);
 const started=Date.now();
 const result=await runBatch({...f,tasks,workers:2,deadline:started+120,validate});
 assert.equal(result.complete,false);assert.equal(result.deadlineReached,true);
 assert.equal(result.results.length,0);assert.ok(Date.now()-started<2000);
 assert.equal(existsSync(resolve(f.out,'games','mock-0.json')),false);
 const interrupted=JSON.parse(readFileSync(resolve(f.out,'deadline-interruption.json'),'utf8'));
 assert.ok(interrupted.active.length>0);
 assert.equal(interrupted.active.length+interrupted.pending.length,tasks.length);
});

test('cooperative deadline records interruptions without inventing a completed game',async t=>{
 const f=fixture(t),tasks=f.tasks(1);tasks[0].returnDeadline=true;
 const result=await runBatch({...f,tasks,workers:1,deadline:Date.now()+5000,validate});
 assert.equal(result.complete,false);assert.equal(result.results.length,0);
 assert.equal(existsSync(resolve(f.out,'games','mock-0.json')),false);
 assert.equal(JSON.parse(readFileSync(resolve(f.out,'interruptions','mock-0.json'),'utf8')).status,'deadline');
});


test('a source guard failure while replacing a crashed worker rejects cleanly',async t=>{
 const f=fixture(t),tasks=f.tasks(1);tasks[0].crash=true;let checks=0;
 await assert.rejects(runBatch({...f,tasks,workers:1,deadline:Date.now()+5000,validate,
  check:()=>{if(++checks>=3)throw Error('Frozen source changed during retry');}}),/Frozen source changed during retry/);
 assert.equal(events(f).filter(e=>e.event==='start').length,1);
});
