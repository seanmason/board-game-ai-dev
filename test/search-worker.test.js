import test from 'node:test';
import assert from 'node:assert/strict';
import {installSearchWorker} from '../shared/search-worker.js';

function fixture(overrides={}) {
  let time=0,id=0;
  const queue=new Map(),messages=[];
  const scope={postMessage:message=>messages.push(structuredClone(message))};
  const adapter={
    create:data=>({visits:0,seed:data.seed}),
    run:search=>{search.visits++;time+=5;},
    summarize:search=>({iterations:search.visits,seed:search.seed}),
    batchSize:()=>10,
    advance:(search,data)=>({search:data.reuse?search:{visits:0},
      metadata:{retainedVisits:data.reuse?search.visits:0}}),
    ...overrides
  };
  const runtime=installSearchWorker(adapter,{scope,now:()=>time,
    schedule:fn=>{queue.set(++id,fn);return id;},cancel:id=>queue.delete(id),reportEveryMs:1,sliceMs:12});
  return {
    messages,queue,runtime,
    send:data=>scope.onmessage({data}),
    step(){const [id,fn]=queue.entries().next().value;queue.delete(id);fn();},
    wait:ms=>{time+=ms;},last:()=>messages.at(-1)
  };
}
test('pause/resume preserves search and PRNG, excludes idle time, and schedules only one loop',()=>{
  const f=fixture();f.send({type:'start',generation:1,seed:42});
  f.step();assert.equal(f.last().iterations,3); // time budget yields before 10 iterations
  f.send({type:'pause',generation:1});
  const paused=f.last();assert.equal(paused.paused,true);assert.equal(f.queue.size,0);
  f.wait(10000);f.send({type:'resume',generation:1});f.send({type:'resume',generation:1});
  assert.equal(f.queue.size,1);f.step();
  assert.equal(f.last().iterations,6);assert.equal(f.last().seed,42);
  assert.equal(f.last().elapsedMs,30);
  f.runtime.dispose();assert.equal(f.queue.size,0);
});
test('paused starts perform no simulations; stop destroys state; stale commands do nothing',()=>{
  const f=fixture();f.send({type:'start',generation:2,running:false});
  assert.equal(f.last().paused,true);assert.equal(f.queue.size,0);
  f.send({type:'resume',generation:1});assert.equal(f.queue.size,0);
  f.send({type:'advance',previousGeneration:1,generation:3,running:true});
  assert.equal(f.last().generation,2);
  f.send({type:'stop',generation:2});f.send({type:'resume',generation:2});
  assert.equal(f.queue.size,0);
});
test('advance preserves only adapter-approved evidence and respects paused state',()=>{
  const f=fixture();f.send({type:'start',generation:1});f.step();
  f.send({type:'advance',previousGeneration:1,generation:2,reuse:true,running:false});
  assert.equal(f.last().iterations,3);assert.equal(f.last().retainedVisits,3);
  assert.equal(f.last().elapsedMs,0);assert.equal(f.queue.size,0);
  f.send({type:'advance',previousGeneration:2,generation:3,reuse:false,running:true});
  assert.equal(f.last().iterations,0);assert.equal(f.last().retainedVisits,0);
  f.runtime.dispose();
});
for(const hook of ['create','run','summarize','advance']) {
  test(`${hook} failure is reported with current generation and cannot resume corrupt state`,()=>{
    let broken=false;
    const f=fixture({[hook]:(...args)=>{
      if(broken)throw Error('Injected failure');
      if(hook==='create')return {visits:0};
      if(hook==='summarize')return {iterations:args[0].visits};
      if(hook==='advance')return {search:args[0]};
    }});
    f.send({type:'start',generation:1,running:false});broken=true;
    const generation=hook==='create'||hook==='advance'?2:1;
    if(hook==='create')f.send({type:'start',generation});
    else if(hook==='advance')f.send({type:'advance',previousGeneration:1,generation});
    else if(hook==='run'){f.send({type:'resume',generation});f.step();}
    else f.send({type:'snapshot',generation});
    assert.deepEqual(f.last(),{type:'error',generation,message:'Injected failure'});
    f.send({type:'resume',generation});assert.equal(f.queue.size,0);
    broken=false;f.send({type:'start',generation:3,running:false});
    assert.equal(f.last().type,'progress');assert.equal(f.last().iterations,0);
  });
}
