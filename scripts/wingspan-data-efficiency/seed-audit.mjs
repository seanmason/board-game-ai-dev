/** Conservative identity-only seed audit; never consumes scores as decisions. */
import {readFileSync,existsSync} from 'node:fs';import {resolve,basename} from 'node:path';
import {hash,atomic} from '../wingspan-selfplay/common.mjs';
import {calibrationTasks,collectionTasks,screenTasks,confirmationTasks} from './plan.mjs';
export function auditSeeds(previousAudit){
 const historical=new Set(),seen=new Set(),sources=[],errors=[];
 function scan(v,key=''){
  if(['seed','gameSeed','setupSeed','seeds'].includes(key)){const add=x=>{if(Number.isSafeInteger(x))historical.add(x);else if(Array.isArray(x))x.forEach(add);};add(v);}
  if(key==='arithmeticRuns'&&Array.isArray(v))for(const r of v){if(!Number.isSafeInteger(r.count)||r.count<0||r.count>2000000||!Number.isSafeInteger(r.start)||!Number.isSafeInteger(r.step))throw Error('Invalid historical arithmetic run');for(let i=0;i<r.count;i++)historical.add(r.start+r.step*i);}
  if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))scan(x,k);
 }
 function inspect(p,expected){p=resolve(p);if(seen.has(p))return;seen.add(p);try{const bytes=readFileSync(p),h=hash(bytes);if(expected&&h!==expected)throw Error('Historical source hash changed');const d=JSON.parse(bytes);scan(d);if(d.banks)for(const a of Object.values(d.banks))if(Array.isArray(a))for(const s of a)if(Number.isSafeInteger(s))historical.add(s);sources.push({sourceId:hash(p).slice(0,16),name:basename(p),sha256:h});for(const r of d.sources??[])if(r.path)inspect(r.path,r.sha256);}catch(e){errors.push({sourceId:hash(p).slice(0,16),name:basename(p),error:e.message.replaceAll(p,'[source]')});}}
 inspect(previousAudit);
 const banks={calibration:calibrationTasks('baseline'),collection:collectionTasks('baseline',4080),screen:screenTasks('hybrid','baseline'),confirmation:confirmationTasks('hybrid','baseline')};
 const sets=Object.fromEntries(Object.entries(banks).map(([k,v])=>[k,[...new Set(v.map(t=>t.seed))]]));
 const overlaps=Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,v.filter(s=>historical.has(s))]));const cross=[];
 for(const[a,x]of Object.entries(sets))for(const[b,y]of Object.entries(sets))if(a<b){const sy=new Set(y),hits=x.filter(s=>sy.has(s));if(hits.length)cross.push({a,b,seeds:hits});}
 return {schema:1,status:errors.length||cross.length||Object.values(overlaps).some(a=>a.length)?'failed':'passed',createdAt:new Date().toISOString(),historicalCount:historical.size,banks:sets,overlaps,cross,errors,sources,limitations:['Conservative retained seed-key/arithmetic audit; unretained or prose-only identities cannot be certified.','Collection/calibration prefixes intentionally share setup seeds between generators; train/dev splits match by whole setup. Paired strength seats share setup seeds within banks.']};
}
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith('/'+basename(process.argv[1]))){const a=Object.fromEntries(process.argv.slice(2).map(x=>{const[k,...v]=x.replace(/^--/,'').split('=');return[k,v.join('=')];}));if(!a.previous||!a.out)throw Error('--previous and --out required');const r=auditSeeds(a.previous);atomic(resolve(a.out),r);console.log(JSON.stringify({status:r.status,historicalCount:r.historicalCount,proposedCount:Object.values(r.banks).reduce((n,a)=>n+a.length,0),errors:r.errors,overlaps:r.overlaps,cross:r.cross}));if(r.status!=='passed')process.exitCode=1;}
