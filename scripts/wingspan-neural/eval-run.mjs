import {resolve} from 'node:path';
import {readFileSync,existsSync} from 'node:fs';
import {setPriority,constants} from 'node:os';
import {execFileSync} from 'node:child_process';
import {runBatch} from '../wingspan-overnight/runtime.mjs';
import {ROOT,read,atomic,hash,hashes,guard} from './common.mjs';
import {canaryTasks,screenTasks,confirmationTasks} from './plan.mjs';
import {validateResult,analyze} from './analyze.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
if(!args.out||!args.models||!['canary','screen','confirmation'].includes(args.stage))throw Error('Use --out=DIR --models=DIR --stage=canary|screen|confirmation --workers=24');
const out=resolve(args.out),models=resolve(args.models),workers=Number(args.workers??24),tasks=args.stage==='canary'?canaryTasks():args.stage==='screen'?screenTasks():confirmationTasks();
if(!Number.isInteger(workers)||workers<1||workers>24)throw Error('Worker cap24');setPriority(0,constants.priority.PRIORITY_BELOW_NORMAL);
const sourceHashes=hashes(),modelHashes={neural:hash(readFileSync(resolve(models,'mlp.json'))),linear:hash(readFileSync(resolve(models,'linear.json')))};
process.env.WINGSPAN_NEURAL_MODEL_DIR=models;for(const[k,h]of Object.entries(modelHashes))process.env['WINGSPAN_NEURAL_'+k.toUpperCase()+'_SHA']=h;
const manifest={version:1,stage:args.stage,tasks,workers,sourceHashes,modelHashes,requestedMs:1000,revision:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim()};
const mp=resolve(out,'manifest.json');if(existsSync(mp)){if(!isSame(read(mp),manifest))throw Error('Frozen evaluation manifest differs');}else atomic(mp,manifest);
function isSame(a,b){return JSON.stringify(a)===JSON.stringify(b);}
let status='running',results=[];const startedAt=new Date().toISOString();
const progress=(rs,active=[])=>{results=rs;atomic(resolve(out,'checkpoint.json'),{stage:args.stage,status,startedAt,updatedAt:new Date().toISOString(),planned:tasks.length,finished:rs.length,workers,active});};
const check=()=>{guard(sourceHashes);for(const[k,f]of [['neural','mlp.json'],['linear','linear.json']])if(hash(readFileSync(resolve(models,f)))!==modelHashes[k])throw Error('Model changed');};
try{
 const r=await runBatch({tasks,out,workers,deadline:Date.now()+4*3600e3,workerURL:new URL('./eval-worker.mjs',import.meta.url),validate:(r,t)=>{const issues=validateResult(r,t);for(const key of ['neural','linear'])if(r.modelIds?.[key]!==modelHashes[key])issues.push('actual-model-hash-'+key);return issues;},check,onProgress:progress});
 if(!r.complete)throw Error('Incomplete fixed evaluation');const summary=analyze(results,tasks);if(!summary.complete)throw Error('Evaluation failed aggregate validation');atomic(resolve(out,'analysis.json'),summary);status='finished';progress(results);
}catch(e){status='interrupted';progress(results);atomic(resolve(out,'failure.json'),{error:e.stack,at:new Date().toISOString()});process.exitCode=1;}
