import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {setPriority,constants} from 'node:os';
import {execFileSync} from 'node:child_process';
import {runBatch} from '../wingspan-overnight/runtime.mjs';
import {ROOT,read,atomic,hashes,guard} from './common.mjs';
import {FEATURE_NAMES,FEATURE_VERSION} from './encoder.mjs';
import {AUX_NAMES} from './targets.mjs';
import {dataTasks} from './plan.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
if(!args.out||!args.profile)throw Error('Use --out=DIR --profile=calibration|full|compact --workers=1..24');
const out=resolve(args.out),tasks=dataTasks(args.profile),workers=Number(args.workers??24);
if(!Number.isInteger(workers)||workers<1||workers>24)throw Error('Worker cap24');
setPriority(0,constants.priority.PRIORITY_BELOW_NORMAL);
const sourceHashes=hashes({collection:true});
const manifest={schemaVersion:1,profile:args.profile,featureVersion:FEATURE_VERSION,featureNames:FEATURE_NAMES,auxNames:AUX_NAMES,teacher:{pipeline:'deployed',horizon:4,budgets:[100,300],probabilities:[.8,.2]},sourceHashes,tasks,workers,revision:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim()};
const mp=resolve(out,'manifest.json');if(existsSync(mp)){if(JSON.stringify(read(mp))!==JSON.stringify(manifest))throw Error('Retained manifest differs');}else atomic(mp,manifest);
let status='running',results=[];const startedAt=new Date().toISOString();
const validate=(r,t)=>{const issues=[];if(r.id!==t.id||r.task?.seed!==t.seed||r.task?.split!==t.split)issues.push('task');if(!r.validation?.valid)issues.push(...(r.validation?.issues??['invalid']));if(r.result?.status!=='complete')issues.push('game-status');if(!r.valueExamples?.length)issues.push('no-examples');return issues;};
const progress=(rs,active=[])=>{results=rs;atomic(resolve(out,'checkpoint.json'),{status,stage:args.profile,startedAt,updatedAt:new Date().toISOString(),workers,finished:rs.length,planned:tasks.length,active,examples:rs.reduce((n,r)=>n+r.valueExamples.length,0),valid:rs.filter(r=>r.validation?.valid).length});};
try{
 const r=await runBatch({tasks,out,workers,deadline:Date.now()+4*3600e3,workerURL:new URL('./data-worker.mjs',import.meta.url),validate,check:()=>guard(sourceHashes),onProgress:progress});
 if(!r.complete)throw Error('Dataset exceeded bounded collection window');status='finished';progress(results);
 atomic(resolve(out,'summary.json'),{status,profile:args.profile,games:results.length,valid:results.filter(r=>r.validation.valid).length,examples:results.reduce((n,r)=>n+r.valueExamples.length,0),totalElapsedMs:results.reduce((n,r)=>n+r.elapsedMs,0),elapsed:results.map(r=>({id:r.id,elapsedMs:r.elapsedMs,validation:r.validation})),featureVersion:FEATURE_VERSION,features:FEATURE_NAMES.length});
}catch(e){status='interrupted';progress(results);atomic(resolve(out,'failure.json'),{error:e.stack,at:new Date().toISOString()});process.exitCode=1;}
