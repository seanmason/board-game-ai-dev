/** Public aggregate progress; no raw games, observations or feature reads. */
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSelfplayDashboard} from '../wingspan-selfplay/dashboard.mjs';
const read=p=>{try{return JSON.parse(readFileSync(p,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
export function buildRefitDashboard({manifest={},progressByStage={},now=new Date().toISOString()}={}){
 const stages=manifest.stages??{},progress={...progressByStage};
 for(const [key,e]of Object.entries(stages))if(e.kind==='collect')progress[key]={...(progress[key]??{}),completed:e.status==='complete'?e.result?.gameCount??e.result?.records?.length??0:progress[key]?.completed,total:e.planned??1040};
 const dash=buildSelfplayDashboard({manifest:{...manifest,sourceRevision:manifest.config?.sourceRevision,frozenHashes:manifest.config?.frozenHashes},progressByStage:progress,now});
 dash.study='wingspan-refit';
 for(const row of dash.rows){const key=row.matchup.split('/')[0],e=stages[key];row.stage=key;row.comparison=e?.kind==='screen'||e?.kind==='confirmation'?'parent':undefined;row.players=2;row.game='wingspan';row.modelHashes={...(manifest.config?.modelHashes??{}),...Object.assign({},...Object.values(stages).map(stage=>stage.result?.modelHashes??{}))};const first=e?.result?.records?.[0]?.task;if(first){row.candidateModelId=first.candidate?.modelId;row.opponentModelId=first.opponent?.modelId;}
  if(e?.kind==='train'){row.policyId=`Phase ${e.phase??0} ${e.recipe??key} fit`;row.scope='Same small network and development pool; epoch zero remains eligible';}
  else if(e?.kind==='collect'){row.policyId='Confirmed teacher hybrid self-play';row.scope='1040 fresh whole games; 80 percent train and 20 percent development; no sealed or strength labels';row.budget={horizon:4,cheapDecisionProbability:.8,decisionSamples:'80% 100 / 20% 300',horizonConvention:'four subsequent main actions after root; cheap successor includes root only'};}
  else{row.policyId=e?.kind==='confirmation'?'Fresh teacher confirmation':`Exploratory ${e?.recipe??key} screen`;row.opponentPolicyId='Actual parent teacher';row.scope='Two-player research at equal requested decision time';row.budget={timeMs:1000,horizon:4};}
 }
 const active=[];if(manifest.status==='running')for(const [key,e]of Object.entries(stages))if(e.status==='running')for(const a of (progressByStage[key]?.active??[]).slice(0,28))active.push({game:'wingspan',players:2,stage:key,id:String(a.id??'active').slice(0,160)});
 dash.active=active.slice(0,28);dash.workers=dash.active.length;
 dash.method='Fixed 192-input 32/16 residual network. Four refits cross learning rates 0.0005/0.0001 with auxiliary loss 0.05/0. Development selects at most two distinct checkpoints; fresh 40-pair screens and a single 100-pair parent confirmation decide research teacher acceptance. At most one further 1040-game hybrid cycle is conditional on confirmation and the original deadline. No automatic production promotion.';
 return dash;
}
export function loadRefitDashboard(runtime,{now}={}){const manifest=read(resolve(runtime,'manifest.json'))??{},progressByStage={};for(const key of Object.keys(manifest.stages??{})){if(!/^[a-z][a-z0-9-]*$/.test(key))throw Error('Unsafe stage key');progressByStage[key]=read(resolve(runtime,'stages',key,'progress.json'))??{};}return buildRefitDashboard({manifest,progressByStage,now});}
export function main(argv=process.argv.slice(2)){const args=Object.fromEntries(argv.map(a=>{const[k,...v]=a.replace(/^--/,'').split('=');return[k,v.join('=')];}));if(!args.runtime||!args.out)throw Error('--runtime and --out required');const out=resolve(args.out),dash=loadRefitDashboard(args.runtime);mkdirSync(dirname(out),{recursive:true});writeFileSync(out+'.tmp',JSON.stringify(dash,null,2)+'\n');renameSync(out+'.tmp',out);return dash;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
