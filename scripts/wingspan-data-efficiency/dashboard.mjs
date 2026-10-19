/** Public counts and complete paired results; never reads actual game files. */
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSelfplayDashboard} from '../wingspan-selfplay/dashboard.mjs';
const number=x=>Number.isFinite(x)?x:null;
const read=p=>{try{return JSON.parse(readFileSync(p,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const label=arm=>arm==='hybrid'?'Hybrid generator':'Search generator';
export function buildDataEfficiencyDashboard({manifest={},progressByStage={},now=new Date().toISOString()}={}){
 const stages=manifest.stages??{},progress={...progressByStage};
 for(const [key,e]of Object.entries(stages))if(['calibration','collect'].includes(e.kind)){
  const p=progress[key]??{};progress[key]={...p,completed:e.status==='complete'?e.result?.gameCount??p.completed:p.completed,
   total:e.planned??p.total,exampleCount:(e.result?.recordReceipts??[]).reduce((n,r)=>n+(r.exampleCount??0),0)};
 }
 const view={...manifest,sourceRevision:manifest.config?.sourceRevision,frozenHashes:manifest.config?.frozenHashes};
 const dash=buildSelfplayDashboard({manifest:view,progressByStage:progress,now});dash.study='wingspan-data-efficiency';
 for(const row of dash.rows){
  const key=row.matchup.split('/')[0],entry=stages[key],arm=entry?.arm;
  if(['calibration','collect'].includes(entry?.kind)){
   row.policyId=label(arm)+(entry.kind==='calibration'?' · calibration excluded from learning':' · new collection');
   row.scope=entry.kind==='calibration'?'Outcome-blind whole collection batch, including features, targets and writes':'Whole setup groups; 80% train / 20% common development; supplied AI actions remain representative';
   row.budget={decisionSamples:'80% 100 / 20% 300',horizon:4,horizonConvention:'four subsequent main actions after root',...(arm==='hybrid'?{cheapDecisionProbability:.8,cheapMain:'one sampled root successor per candidate; settle powers',cheapPower:'action prior',setup:'unchanged searched setup'}:{})};
   const ms=number(entry.result?.poolWallMs);if(ms!==null)row.scope+=` · Collection pool wall ${(ms/60000).toFixed(2)} minutes`;
   row.limitations=['Collection games and correlated positions do not establish playing strength.','Equal-time attribution requires the actual collection-cost matching gate.'];
  }else if(entry?.kind==='train'){
   row.policyId=(arm==='hybrid'?'Hybrid-data':'Search-data')+' · fixed small network fit';
   row.scope='Same warm start and architecture; identical common development pool; training replay mass 75% retained / 25% own fresh';
  }else if(['screen','confirmation'].includes(entry?.kind)){
   row.policyId=(entry.kind==='screen'?'Exploratory screen':'Fresh confirmation')+' · hybrid-data model';
   row.opponentPolicyId=row.matchup.endsWith('/frozen-generation-3')?'Frozen generation 3':'Search-data model';
   row.budget={timeMs:1000,horizon:4,horizonConvention:'four subsequent main actions after root'};
   row.scope='Original two-player Wingspan; fixed complete seat pairs at equal requested decision time';
  }
 }
 const active=[];if(manifest.status==='running')for(const [stage,e]of Object.entries(stages))if(e.status==='running')for(const a of (progressByStage[stage]?.active??[]).slice(0,28))active.push({game:'wingspan',players:2,stage,id:String(a.id??'active').slice(0,180)});
 dash.active=active.slice(0,28);dash.workers=Math.min(manifest.config?.workers??28,dash.active.length);
 const a=manifest.allocation,c=manifest.computeMatch;
 dash.collectionBudget={targetPoolMs:number(a?.targetPoolMs),baselineGroups:number(a?.counts?.baseline),hybridGroups:number(a?.counts?.hybrid),baselinePoolWallMs:number(stages['collect-baseline']?.result?.poolWallMs),hybridPoolWallMs:number(stages['collect-hybrid']?.result?.poolWallMs),actualRatio:number(c?.hybridBaselineRatio),equalComputeClaimAllowed:c?.equalComputeClaimAllowed===true};
 dash.fitCosts={baselineWallMs:number(stages['train-baseline']?.result?.fitWallMs),hybridWallMs:number(stages['train-hybrid']?.result?.fitWallMs)};
 const timing=dash.collectionBudget;
 dash.method='Two fixed 192→32→16 residual networks, identical warm start and development pool. Compare original search-generated data with 80% one-step / 20% searched decisions; setup stays searched. Horizon 4 excludes the chosen root move. Calibration chooses counts from timing only; actual collection wall costs must match within 10%. Fit and end-to-end costs are separate. '
  +(a?`Frozen collection counts: search ${a.counts.baseline}, hybrid ${a.counts.hybrid}; common target ${(a.targetPoolMs/60000).toFixed(2)} minutes. `:'Collection counts await outcome-blind calibration. ')
  +(c?`Actual hybrid/search collection wall ratio ${c.hybridBaselineRatio.toFixed(3)}; matching ${c.passed?'passed':'failed'}. `:'')
  +'Winner shares stay hidden until complete valid fixed seat pairs. No production promotion.';
 dash.limitations=['Old audit and strength games are excluded from fitting; new development is selection data, not a sealed test.','Calibration is one noisy 28-worker batch per arm; a cost mismatch stops without resizing or rescue.','Raw observations, features, actual games and local paths are not read by this dashboard.'];
 return dash;
}
export function loadDataEfficiencyDashboard(runtime,{now}={}){
 const manifest=read(resolve(runtime,'manifest.json'))??{},progressByStage={};
 for(const key of Object.keys(manifest.stages??{})){if(!/^[a-z][a-z0-9-]*$/.test(key))throw Error('Unsafe stage key');progressByStage[key]=read(resolve(runtime,'stages',key,'progress.json'))??{};}
 return buildDataEfficiencyDashboard({manifest,progressByStage,now});
}
export function main(argv=process.argv.slice(2)){
 const args=Object.fromEntries(argv.map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return[k,v.join('=')];}));if(!args.runtime||!args.out)throw Error('--runtime and --out required');
 const dash=loadDataEfficiencyDashboard(args.runtime),out=resolve(args.out);mkdirSync(dirname(out),{recursive:true});writeFileSync(out+'.tmp',JSON.stringify(dash,null,2)+'\n');renameSync(out+'.tmp',out);return dash;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
