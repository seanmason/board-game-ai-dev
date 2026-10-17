/** Run reproducible benchmark shards in ordinary child processes, not agents.
 * No gameplay/search changes: only budget, diagnostics and tournament tooling. */
import {spawn} from 'node:child_process';
import {open,mkdir,readFile,writeFile} from 'node:fs/promises';
import {summarizeRecords} from './benchmark-boop.mjs';
const directory=process.argv[2]??'benchmarks/boop-long';
const concurrency=Number(process.env.BOOP_EVAL_WORKERS??6);
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>8)throw Error('BOOP_EVAL_WORKERS must be 1..8');
await mkdir(`${directory}/shards`,{recursive:true});
const settings=[
 {name:'tactical-3000',games:24,simulations:3000},
 {name:'tactical-10000',games:24,simulations:10000},
 {name:'tactical-5s-min3000',games:12,ms:5000,'min-simulations':3000}
];
const tasks=[];
// Interleave configurations so pilot results arrive across budgets early.
for(let offset=0;offset<24;offset+=2)for(const config of settings){
 if(offset>=config.games)continue;tasks.push({config,offset,path:`${directory}/shards/${config.name}-${offset}.json`});
}
let cursor=0,done=0;const started=Date.now();
async function worker(){while(cursor<tasks.length){const task=tasks[cursor++];
 try{const cached=JSON.parse(await readFile(task.path,'utf8'));if(cached.complete&&cached.records.length===2){done++;continue;}}catch{}
 const args=['scripts/benchmark-boop.mjs','--games=2',`--game-offset=${task.offset}`,'--seed=1642911','--opponent=tactical','--progress=true',`--output=${task.path}`];
 for(const [key,value]of Object.entries(task.config))if(!['name','games'].includes(key))args.push(`--${key}=${value}`);
 const log=await open(`${task.path}.log`,'w');
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{stdio:['ignore',log.fd,log.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${task.config.name}/${task.offset} exited ${code}`)));});await log.close();done++;
 console.log(JSON.stringify({done,total:tasks.length,name:task.config.name,offset:task.offset,elapsedSeconds:Math.round((Date.now()-started)/1000)}));
 }}
await Promise.all(Array.from({length:concurrency},worker));
const results=[];
for(const config of settings){const shards=await Promise.all(tasks.filter(t=>t.config.name===config.name).map(async t=>JSON.parse(await readFile(t.path,'utf8'))));
 const records=shards.flatMap(s=>s.records).sort((a,b)=>a.game-b.game),result={config:{...shards[0].config,games:config.games,gameOffset:0,evaluationConcurrency:concurrency},...summarizeRecords(records),complete:true,records};
 await writeFile(`${directory}/${config.name}.json`,JSON.stringify(result,null,2)+'\n');results.push({...result,records:undefined});
}
await writeFile(`${directory}/summary.json`,JSON.stringify({elapsedSeconds:(Date.now()-started)/1000,settings:results},null,2)+'\n');console.log(JSON.stringify(results,null,2));
