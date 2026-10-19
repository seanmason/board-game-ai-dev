/** External preparation/control runner. Default mode cannot create game workers. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {setPriority,constants} from 'node:os';
import {isDeepStrictEqual} from 'node:util';
export const CONTROL=dirname(fileURLToPath(import.meta.url));
export const RUNTIME=dirname(CONTROL);
export const SOURCE='C:/Users/mason/.codex/worktrees/wingspan-neural-20261019';
export const read=p=>JSON.parse(readFileSync(p,'utf8'));
export const hash=b=>createHash('sha256').update(b).digest('hex');
const fileHash=p=>hash(readFileSync(p));
export function write(p,value){mkdirSync(dirname(p),{recursive:true});writeFileSync(p,JSON.stringify(value,null,2)+'\n');}
const moduleURL=(root,path)=>pathToFileURL(resolve(root,path));
export function buildZeroModel(real,realSha){
 const zero=structuredClone(real),last=zero.layers.at(-1);
 if(last.out!==1||last.activation!=='linear')throw Error('Expected one linear output head');
 last.weights.fill(0);last.bias.fill(0);
 zero.metadata={...zero.metadata,kind:'same-shape-zero-output-attribution-control',realModelSha256:realSha,
  control:'Only final scalar-head weights/bias are zero; full real hidden weights, normalization and dense execution retained.',trainedRidge:false};
 return zero;
}
export function tasks(){
 const arm=(method,role)=>({method,pipeline:'study',policy:'original',priorWeight:.18,blend:.5,budget:300,horizon:4,timeMs:1000,modelRole:role});
 return Array.from({length:32},(_,i)=>48000000+997*i).flatMap(seed=>[0,1].map(seat=>({
  id:`constant-attribution/real-vs-zero/${seed}/${seat}`,stage:'constant-attribution',matchup:'real-mlp-vs-zero-output-mlp',seed,seat,
  candidate:arm('neural','real-selected-mlp-50-percent-blend'),opponent:arm('linear','same-shape-zero-output-mlp-50-percent-blend'),rolloutStepLimit:192,
  purpose:'Fresh exploratory constant-value attribution; no promotion claim. Internal linear slot contains zero-output MLP, NOT trained ridge.'
 })));
}
function scanSeeds(value,seeds,key=''){
 if(['seed','gameSeed','seeds'].includes(key)){
  const add=v=>{if(Number.isSafeInteger(v))seeds.add(v);else if(Array.isArray(v))v.forEach(add);};add(value);
 }
 if(value&&typeof value==='object')for(const[k,v]of Object.entries(value))scanSeeds(v,seeds,k);
}
export function auditSeeds(){
 const target=[...new Set(tasks().map(t=>t.seed))],history=new Set(),sources=[];
 const inspect=(path,expected)=>{const bytes=readFileSync(path),sha=hash(bytes);if(expected&&expected!==sha)throw Error('Historical seed source changed: '+path);const value=JSON.parse(bytes);scanSeeds(value,history);sources.push({path,sha256:sha});return value;};
 const audit=inspect(resolve(RUNTIME,'seed-audit.json'));if(audit.status!=='passed')throw Error('Pilot seed audit not passed');
 for(const values of Object.values(audit.banks??{}))for(const n of values)history.add(n);
 for(const source of audit.sources??[])inspect(source.path,source.sha256);
 const arithmetic=inspect(resolve(SOURCE,'scripts/wingspan-overnight/seed-audit.json'));
 for(const key of ['historicalAllGames','proposedUnion'])for(const run of arithmetic[key]?.arithmeticRuns??[])for(let i=0;i<run.count;i++)history.add(run.start+run.step*i);
 const walk=d=>{for(const e of readdirSync(d,{withFileTypes:true})){const p=resolve(d,e.name);if(p===CONTROL||e.name==='venv'||e.name==='games')continue;if(e.isDirectory())walk(p);else if(e.name.endsWith('.json')&&e.name.toLowerCase().includes('manifest'))inspect(p);}};
 walk(RUNTIME);
 const collisions=target.filter(seed=>history.has(seed));if(collisions.length)throw Error('Control seed collision: '+collisions.join(','));
 return {status:'passed',createdAt:new Date().toISOString(),proposedSeeds:target,independentPairs:32,games:64,knownSeedCount:history.size,collisions,sources,
  limitations:['Conservative retained seed-key and audited arithmetic-bank check; unretained/prose-only seeds cannot be certified.','Paired seats intentionally share one setup seed; control directory excluded from its own prior-seed audit.']};
}
export function assertExecutionAllowed({pilotResult,progress,approved,receiptExists}){
 if(receiptExists)throw Error('Control execution receipt already exists; no automatic rerun or new clock');
 if(!approved)throw Error('Explicit coordinator approval after the fixed pilot is required');
 if(pilotResult?.status!=='finished'||progress?.status!=='finished')throw Error('Fixed pilot has not completed; no overlapping worker pool');
}
export function guard(plan){
 for(const[rel,sha]of Object.entries(plan.sourceHashes))if(fileHash(resolve(plan.sourceRoot,rel))!==sha)throw Error('Frozen source differs: '+rel);
 for(const[rel,sha]of Object.entries(plan.controlHashes))if(fileHash(resolve(CONTROL,rel))!==sha)throw Error('Frozen control differs: '+rel);
 for(const[slot,sha]of Object.entries(plan.modelHashes))if(fileHash(resolve(CONTROL,plan.modelFiles[slot]))!==sha)throw Error('Frozen model differs: '+slot);
 if(fileHash(resolve(RUNTIME,'training/mlp.json'))!==plan.sourceRealModelSha256)throw Error('Certified selected model changed');
 const certification=read(resolve(RUNTIME,'training/offline-report.json'));
 if(certification.selectedModelSha256!==plan.sourceRealModelSha256)throw Error('Selected model no longer matches offline certification');
 const prepared=read(resolve(CONTROL,'prepared.json'));
 if(fileHash(resolve(CONTROL,'plan.json'))!==prepared.planSha256||fileHash(resolve(CONTROL,'protocol.md'))!==prepared.protocolSha256)throw Error('Prepared plan/protocol receipt changed');
}
