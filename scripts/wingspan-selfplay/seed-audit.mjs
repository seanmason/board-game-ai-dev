/** Historical task identities only. No raw observations/outcomes enter learning. */
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT,hash,atomic} from './common.mjs';
import {calibrationTasks,collectionTasks,screenTasks,confirmationTasks,scalingTasks} from './plan.mjs';
export function auditSeeds({historicalRoots=[resolve(ROOT,'benchmarks')],historicalFiles=[]}={}){
 const history=new Set(),sources=[],errors=[];
 function scan(v,key=''){
  if(['seed','gameSeed','setupSeed','seeds','banks','historicalAllGames','proposedUnion'].includes(key)){
   const add=x=>{if(Number.isSafeInteger(x))history.add(x);else if(Array.isArray(x))x.forEach(add);else if(x&&typeof x==='object')Object.values(x).forEach(add);};add(v);
  }
  if(v&&typeof v==='object'){
   if(Number.isSafeInteger(v.start)&&Number.isSafeInteger(v.step)&&Number.isSafeInteger(v.count)&&v.count>=0&&v.count<=100000)for(let i=0;i<v.count;i++)history.add(v.start+i*v.step);
   for(const[k,x]of Object.entries(v))scan(x,k);
  }
 }
 const inspect=p=>{try{const bytes=readFileSync(p);scan(JSON.parse(bytes));sources.push({path:p,sha256:hash(bytes)});}catch(e){errors.push({path:p,error:e.message});}};
 const walk=d=>{for(const e of readdirSync(d,{withFileTypes:true})){const p=resolve(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.json'))inspect(p);}};
 for(const root of historicalRoots)walk(root);for(const file of historicalFiles){if(existsSync(file))inspect(file);else errors.push({path:file,error:'Missing historical seed inventory'});}
 const banks={calibration:calibrationTasks(),...[1,2,3].map(g=>({['collection-'+g]:collectionTasks(g),['screen-'+g]:screenTasks(g,'C','H')})).reduce((a,b)=>({...a,...b}),{}),confirmation:confirmationTasks('C','Z'),scaling:scalingTasks('C')};
 const sets=Object.fromEntries(Object.entries(banks).map(([k,ts])=>[k,[...new Set(ts.map(t=>t.seed))]]));
 const overlaps=Object.fromEntries(Object.entries(sets).map(([k,ss])=>[k,ss.filter(s=>history.has(s))]));
 const cross=[];for(const[a,ss]of Object.entries(sets))for(const[b,tt]of Object.entries(sets))if(a<b){const bs=new Set(tt),hit=ss.filter(s=>bs.has(s));if(hit.length)cross.push({a,b,seeds:hit});}
 return {schema:1,status:errors.length||cross.length||Object.values(overlaps).some(x=>x.length)?'failed':'passed',createdAt:new Date().toISOString(),historicalCount:history.size,banks:sets,overlaps,cross,errors,sources,
  limitations:['Conservative retained seed-key inventories and arithmetic ranges; unretained/prose-only seeds cannot be certified. Paired seats intentionally reuse each setup.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
 const r=auditSeeds({historicalFiles:(args.history??'').split('|').filter(Boolean)});if(args.out)atomic(resolve(args.out),r);console.log(JSON.stringify({status:r.status,historicalCount:r.historicalCount,proposedCount:Object.values(r.banks).reduce((n,a)=>n+a.length,0),overlaps:r.overlaps,cross:r.cross,errors:r.errors}));if(r.status!=='passed')process.exitCode=1;
}
