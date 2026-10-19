import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,read,hash,atomic} from './common.mjs';
import {dataTasks,canaryTasks,screenTasks,confirmationTasks} from './plan.mjs';
const history=new Set(),sources=[],errors=[];
function scan(value,key=''){
 if(['seed','gameSeed','seeds'].includes(key)){const add=v=>{if(Number.isSafeInteger(v))history.add(v);else if(Array.isArray(v))v.forEach(add);};add(value);}
 if(value&&typeof value==='object')for(const[k,v]of Object.entries(value))scan(v,k);
}
function inspect(path){try{const bytes=readFileSync(path);scan(JSON.parse(bytes));sources.push({path,sha256:hash(bytes)});}catch(e){errors.push({path,error:e.message});}}
const walk=d=>{for(const e of readdirSync(d,{withFileTypes:true})){const p=resolve(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.json'))inspect(p);}};walk(resolve(ROOT,'benchmarks'));
const previous=read(resolve(ROOT,'scripts/wingspan-overnight/seed-audit.json'));
for(const key of ['historicalAllGames','proposedUnion'])for(const r of previous[key].arithmeticRuns)for(let i=0;i<r.count;i++)history.add(r.start+r.step*i);
const previousRoot='C:/Users/mason/.codex/benchmark-runs/';
for(const p of ['wingspan-evaluator-compute-20261018/study/manifest.json','wingspan-overnight-20261018/campaign/manifest.json','wingspan-overnight-20261018/campaign/possible-confirmation.json'])if(existsSync(resolve(previousRoot,p)))inspect(resolve(previousRoot,p));
const banks={calibration:dataTasks('calibration'),full:dataTasks('full'),compact:dataTasks('compact'),canary:canaryTasks(),screen:screenTasks(),confirmation:confirmationTasks()};
const sets=Object.fromEntries(Object.entries(banks).map(([k,ts])=>[k,[...new Set(ts.map(t=>t.seed))]]));
const overlaps=Object.fromEntries(Object.entries(sets).map(([k,ss])=>[k,ss.filter(s=>history.has(s))]));
const cross=[];for(const[a,ss]of Object.entries(sets))for(const[b,tt]of Object.entries(sets))if(a<b){const hit=ss.filter(s=>tt.includes(s));if(hit.length)cross.push({a,b,seeds:hit});}
const audit={createdAt:new Date().toISOString(),status:errors.length||cross.length||Object.values(overlaps).some(x=>x.length)?'failed':'passed',historicalCount:history.size,banks:sets,overlaps,cross,errors,sources,limitations:['Conservative seed-key audit plus previous audited arithmetic banks; unretained/prose-only seeds cannot be certified.','Paired seats/comparisons intentionally share setup seeds within a bank. Budget RNG streams are not game seeds.']};
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));if(args.out)atomic(resolve(args.out),audit);console.log(JSON.stringify({status:audit.status,historicalCount:history.size,proposedCount:Object.values(sets).reduce((n,a)=>n+a.length,0),errors,overlaps,cross}));if(audit.status!=='passed')process.exitCode=1;
