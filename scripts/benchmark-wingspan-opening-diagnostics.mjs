/** Small reference-only diagnostic replay; never launches the opening tournament. */
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {play} from './benchmark-wingspan-opening-game.mjs';
export const replaySeeds=[{role:'weak-reference',seed:2730334},{role:'typical-reference',seed:2728340},{role:'strong-reference',seed:2724352}];
if(!isMainThread){parentPort.postMessage(play(workerData));parentPort.close();}
else if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);if(!out)throw Error('Use --out=directory');mkdirSync(out,{recursive:true});
 const priorRoot=resolve(out,'..','wingspan-final-20261018');
 const checkpoint=JSON.parse(readFileSync(resolve(priorRoot,'checkpoint.json'))),priorResults=new Map(checkpoint.results.map(r=>[r.id,r]));
 const tasks=replaySeeds.flatMap(({role,seed})=>[0,1].map(seat=>{
  const original=checkpoint.tasks.find(t=>t.seed===seed&&t.seat===seat&&t.evaluator==='slot-scarcity');if(!original)throw Error('Missing original task');
  const expected=priorResults.get(original.id);
  return {...original,id:`reference-${role}-${seed}-${seat}`,originalTaskId:original.id,role,method:'reference',baselinePlayer:1-seat,expectedScores:expected.scores,expectedMargin:expected.margin};
 }));
 const files=['scripts/benchmark-wingspan-opening-diagnostics.mjs','scripts/benchmark-wingspan-opening-game.mjs','wingspan/opening-strategy.js'];
 writeFileSync(resolve(out,'manifest.json'),JSON.stringify({purpose:'Six actual slot-scarcity vs practical-combined task replays selected by priorfinal baseline-margin strata, not a comparison trial',maxConcurrentGames:2,tasks,sourceHashes:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))},null,2));
 const pending=[...tasks],results=[];
 const worker=()=>new Promise((ok,fail)=>{const task=pending.shift();if(!task)return ok();const w=new Worker(new URL(import.meta.url),{workerData:task});w.once('message',r=>{r.reproducedPriorScores=JSON.stringify(r.scores)===JSON.stringify(task.expectedScores)&&r.margin===task.expectedMargin;results.push(r);writeFileSync(resolve(out,r.id+'.json'),JSON.stringify(r,null,2));writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2));console.log(r.id,r.status,r.scores);});w.once('error',fail);w.once('exit',code=>code?fail(Error('Replay worker exited '+code)):worker().then(ok,fail));});
 await Promise.all([worker(),worker()]);
}

