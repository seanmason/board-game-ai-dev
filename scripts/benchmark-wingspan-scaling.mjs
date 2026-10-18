import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {play} from './benchmark-wingspan-screen.mjs';

export const plan={version:1,budgets:[30,100,300,1000],pairs:12,horizon:4,stepCap:600,
  baselineSeeds:Array.from({length:12},(_,i)=>928400+i*997),
  headSeeds:Array.from({length:12},(_,i)=>941600+i*997)};
export function tasks(){
  const rows=[];
  for(const budget of plan.budgets)for(const seed of plan.baselineSeeds)for(const seat of [0,1])
    rows.push({id:`b${budget}-${seed}-${seat}`,seed,seat,budget,opponent:'heuristic',opponentBudget:100});
  for(let i=1;i<plan.budgets.length;i++)for(const seed of plan.headSeeds)for(const seat of [0,1])
    rows.push({id:`h${plan.budgets[i]}-${seed}-${seat}`,seed,seat,budget:plan.budgets[i],opponent:'belief-rollout',opponentBudget:plan.budgets[i-1]});
  return rows;
}
const atomic=(path,value)=>{writeFileSync(path+'.tmp',JSON.stringify(value,null,2));renameSync(path+'.tmp',path);};
if(!isMainThread){parentPort.on('message',task=>parentPort.postMessage(play(task)));}
else if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6);
  const workers=Number(process.argv.find(x=>x.startsWith('--workers='))?.slice(10)||8);
  if(!out||!Number.isInteger(workers)||workers<1||workers>24)throw Error('Use --out=directory --workers=1..24');
  mkdirSync(out,{recursive:true});
  const root=fileURLToPath(new URL('../',import.meta.url));
  const files=['scripts/benchmark-wingspan-screen.mjs','scripts/benchmark-wingspan-scaling.mjs'];
  const walk=(dir)=>{for(const e of readdirSync(resolve(root,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.(js|json)$/.test(p))files.push(p);}};
  walk('wingspan');
  const hashes=Object.fromEntries(files.sort().map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')]));
  const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const all=tasks(),manifest={plan,revision,hashes,tasks:all},mp=resolve(out,'manifest.json');
  if(existsSync(mp)&&JSON.stringify(JSON.parse(readFileSync(mp,'utf8')))!==JSON.stringify(manifest))throw Error('Manifest mismatch; use a new directory');
  if(!existsSync(mp))atomic(mp,manifest);
  const results=all.filter(t=>existsSync(resolve(out,t.id+'.json'))).map(t=>JSON.parse(readFileSync(resolve(out,t.id+'.json'),'utf8')));
  const done=new Set(results.map(r=>r.id)),pending=all.filter(t=>!done.has(t.id)),active=new Map();
  const startedAt=new Date().toISOString();
  const checkpoint=()=>atomic(resolve(out,'checkpoint.json'),{revision,startedAt,updatedAt:new Date().toISOString(),workers,planned:all.length,finished:results.length,complete:results.filter(r=>r.status==='complete').length,active:[...active.values()],results});
  const dispatch=w=>{const task=pending.shift();if(!task){active.delete(w);w.terminate();checkpoint();return;}active.set(w,{id:task.id,startedAt:new Date().toISOString()});w.postMessage(task);checkpoint();};
  checkpoint();
  await Promise.all(Array.from({length:Math.min(workers,pending.length)},()=>new Promise((ok,fail)=>{
    const w=new Worker(new URL(import.meta.url));
    w.on('message',result=>{atomic(resolve(out,result.id+'.json'),result);results.push(result);console.log(new Date().toISOString(),result.id,result.status,Math.round(result.elapsedMs));if(result.status!=='complete')process.exitCode=1;dispatch(w);});
    w.on('error',fail);w.on('exit',ok);dispatch(w);
  })));
  checkpoint();
}
