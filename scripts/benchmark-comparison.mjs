import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {readFileSync,writeFileSync,renameSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {summarize} from './benchmark-comparison-summary.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const atomic=(path,value)=>{writeFileSync(path+'.tmp',JSON.stringify(value,null,2));renameSync(path+'.tmp',path);};
const adapter=game=>import(new URL(`./benchmark-adapters/${game}.mjs`,import.meta.url));
if(!isMainThread){
  parentPort.on('message',async task=>{const start=performance.now();try{const {runGame}=await adapter(task.game);const result=await runGame(task);if(!['complete','capped','unresolved','illegal'].includes(result.status))throw Error('Invalid adapter result status');if(result.status==='complete'&&(!Array.isArray(result.shares)||result.shares.length!==task.players||result.shares.some(x=>!Number.isFinite(x)||x<0||x>1)||Math.abs(result.shares.reduce((a,b)=>a+b,0)-1)>1e-8))throw Error('Invalid complete winner shares');parentPort.postMessage({...result,...task,budget:result.budget,requestedBudget:task.budget,status:result.status});}catch(error){parentPort.postMessage({...task,status:'error',shares:null,margin:null,elapsedMs:performance.now()-start,error:String(error.stack??error)});}});
}else if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const opt=(k,d)=>process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3)??d;
  const out=resolve(opt('out','local-run/ai-comparison-2026-10-18')),workers=Number(opt('workers','12')),pairs=Number(opt('pairs','40'));
  if(!Number.isInteger(workers)||workers<1||workers>24||!Number.isInteger(pairs)||pairs<1)throw Error('Use workers1..24 and positive integer pairs');
  const games=opt('games','ticket-to-ride,love-letter,jaipur,sushi-go,lost-cities,hive').split(',');
  if(games.some(g=>!/^[a-z-]+$/.test(g)))throw Error('Invalid game slug');
  try{os.setPriority(0,os.constants.priority.PRIORITY_BELOW_NORMAL);}catch(error){console.warn('Could not set BelowNormal priority:',error.message);}
  const metadata={},tasks=[];
  for(const game of games){metadata[game]=(await adapter(game)).metadata;const m=metadata[game];for(const players of m.supportedPlayers)for(let i=0;i<pairs;i++)for(let seat=0;seat<players;seat++){const seed=5182600+i*997,policy='production-default',matchup=`${game}-${players}p-${policy}`;tasks.push({id:`${matchup}-${seed}-${seat}`,matchup,game,players,seed,seat,policy,opponent:'simple-v1',budget:m.defaultBudget,scope:m.scope});}}
  const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),hashes={};
  const collect=dir=>{for(const e of readdirSync(resolve(root,dir),{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())collect(p);else if(/\.(?:mjs|js|json)$/.test(p))hashes[p]=createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');}};
  games.forEach(collect);collect('scripts/benchmark-adapters');for(const p of ['scripts/benchmark-comparison.mjs','scripts/benchmark-comparison-summary.mjs'])hashes[p]=createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
  mkdirSync(out,{recursive:true});mkdirSync(resolve(out,'games'),{recursive:true});
  const manifestPath=resolve(out,'manifest.json'),existing=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath)):null;
  const manifest={study:'ai-comparison-2026-10-18',revision,startedAt:existing?.startedAt??new Date().toISOString(),workers,pairs,runtime:existing?.runtime??{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,priority:os.getPriority(0)},metadata,tasks,hashes,method:'40 independent setup seeds per matchup by default, every candidate seat rotated against heuristic opponents. Approximate 95% paired Student-t intervals use complete seed-group means, not independent seat games. Incomplete groups excluded from estimates and reported. Fixed modest policy-specific budgets; latency is measured, not equal-time strength. No promotion or confirmation claim.'};
  if(existing&&JSON.stringify(existing)!==JSON.stringify(manifest))throw Error('Manifest mismatch; choose a fresh output directory');
  atomic(manifestPath,manifest);const results=[],pending=[];
  for(const task of tasks){const file=resolve(out,'games',task.id+'.json');if(existsSync(file)){const result=JSON.parse(readFileSync(file));if(result.id!==task.id)throw Error('Result ID mismatch');results.push(result);}else pending.push(task);}
  const active=new Map();let finalStatus=process.argv.includes('--plan-only')?'planned':'running';
  const checkpoint=()=>atomic(resolve(out,'dashboard.json'),summarize(manifest,results,[...active.values()],finalStatus));checkpoint();
  if(!process.argv.includes('--plan-only')){
    const timer=setInterval(checkpoint,10000),pool=new Set();
    try{await Promise.all(Array.from({length:Math.min(workers,pending.length)},()=>new Promise((done,reject)=>{
      const w=new Worker(new URL(import.meta.url));pool.add(w);let current=null,watchdog=null,ending=false;
      const dispatch=()=>{clearTimeout(watchdog);current=pending.shift();if(!current){ending=true;active.delete(w.threadId);pool.delete(w);w.terminate().then(done,reject);checkpoint();return;}watchdog=setTimeout(()=>reject(Error(`Worker exceeded 30-minute safety limit: ${current.id}`)),1800000);active.set(w.threadId,{id:current.id,game:current.game,players:current.players,startedAt:new Date().toISOString()});w.postMessage(current);checkpoint();};
      w.on('message',result=>{atomic(resolve(out,'games',result.id+'.json'),result);results.push(result);console.log(`${results.length}/${tasks.length} ${result.id} ${result.status}`);dispatch();});w.on('error',reject);w.on('exit',code=>{clearTimeout(watchdog);if(!ending)reject(Error(`Worker exited unexpectedly (${code}): ${current?.id}`));});dispatch();
    })));finalStatus='finished';}catch(error){finalStatus='interrupted';throw error;}finally{clearInterval(timer);await Promise.all([...pool].map(w=>w.terminate()));active.clear();checkpoint();}
  }
  console.log(JSON.stringify({status:finalStatus,out,planned:tasks.length,finished:results.length}));
}
