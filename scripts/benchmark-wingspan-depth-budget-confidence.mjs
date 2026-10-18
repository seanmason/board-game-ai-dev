import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {play} from './benchmark-wingspan-screen.mjs';

export const plan={version:1,depths:[12,16,20],budgets:[500,1000,3000],pairs:24,rolloutStepLimit:160,stepCap:600,
  seeds:Array.from({length:24},(_,i)=>1276400+(i+6)*997)};
export function tasks(){
  const matchups=[];
  for(const horizon of plan.depths)for(const [budget,opponentBudget] of [[1000,500],[3000,1000]])matchups.push({horizon,opponentHorizon:horizon,budget,opponentBudget});
  for(const budget of plan.budgets)for(let i=1;i<plan.depths.length;i++)for(let j=0;j<i;j++)
    matchups.push({horizon:plan.depths[i],opponentHorizon:plan.depths[j],budget,opponentBudget:budget});
  const rows=[];
  for(const seed of plan.seeds)for(const matchup of matchups)for(const seat of [0,1])
    rows.push({...matchup,id:`d${matchup.horizon}b${matchup.budget}-d${matchup.opponentHorizon}b${matchup.opponentBudget}-${seed}-${seat}`,seed,seat,opponent:'belief-rollout',rolloutStepLimit:plan.rolloutStepLimit});
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
  const files=['scripts/benchmark-wingspan-screen.mjs','scripts/benchmark-wingspan-depth-budget-confidence.mjs'];
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
  const predecessors=process.argv.filter(x=>x.startsWith('--after=')).map(x=>x.slice(8));
  if(predecessors.length!==2)throw Error('Specify both predecessor runtime directories using --after=');
  const predecessorPids=predecessors.map(dir=>Number(readFileSync(resolve(dir,'pid.txt'),'utf8').trim()));
  const occupied=()=>{
    for(const pid of predecessorPids){
      try{process.kill(pid,0);return workers;}catch(error){if(error.code!=='ESRCH')throw error;}
    }
    return 0;
  };
  checkpoint();
  await new Promise((ok,fail)=>{
    let stopped=false;
    const tick=()=>{
      if(stopped)return;
      try{
        const capacity=Math.max(0,workers-occupied());
        while(pending.length&&active.size<capacity){
          const task=pending.shift(),w=new Worker(new URL(import.meta.url));
          active.set(w,{id:task.id,startedAt:new Date().toISOString()});
          w.on('message',async result=>{
            atomic(resolve(out,result.id+'.json'),result);results.push(result);
            console.log(new Date().toISOString(),result.id,result.status,Math.round(result.elapsedMs));
            if(result.status!=='complete')process.exitCode=1;
            await w.terminate();active.delete(w);checkpoint();tick();
          });
          w.on('error',error=>{stopped=true;clearInterval(timer);fail(error);});
          w.postMessage(task);
        }
        checkpoint();
        if(!pending.length&&!active.size){stopped=true;clearInterval(timer);ok();}
      }catch(error){console.error('Waiting for reliable capacity information:',error.message);}
    };
    const timer=setInterval(tick,5000);tick();
  });
  checkpoint();
}
