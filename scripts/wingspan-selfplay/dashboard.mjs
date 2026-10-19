/** Public aggregate view: reads controller manifests and live progress, never games. */
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {summarize} from '../wingspan-study/analyze.mjs';

const finite=Number.isFinite;
const avg=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
const empty=()=>({n:0,mean:null,low:null,high:null});
const count=x=>Number.isSafeInteger(x)&&x>=0?x:0;
const safeText=x=>typeof x==='string'?x.replace(/(?:[A-Za-z]:[\\/]|\/(?:Users|home|tmp)\/|\\\\)[^\r\n]*/g,'[local-path]').slice(0,2000):null;
const timestamp=x=>typeof x==='number'?new Date(x).toISOString():typeof x==='string'?x:null;
const kindOf=(key,e)=>e.kind??key.replace(/-\d+$/,'');
const latency=xs=>{const a=xs.filter(x=>finite(x)&&x>=0).sort((a,b)=>a-b),q=p=>a.length?a[Math.max(0,Math.ceil(a.length*p)-1)]:null;return {n:a.length,meanMs:avg(a),p95Ms:q(.95),p99Ms:q(.99),maxMs:a.at(-1)??null};};
const hashes=input=>Object.fromEntries(Object.entries(input??{}).filter(([,v])=>typeof v==='string'&&/^[a-f\d]{64}$/i.test(v)).map(([k,v])=>[/^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(k)?basename(k.replaceAll('\\','/')):k.replaceAll('\\','/'),v]));
function interval(values,bounded=false){const s=summarize(values,bounded?{bounds:[0,1]}:{});return {n:s.n,mean:s.mean,low:s.ci95?Math.max(bounded?0:-Infinity,s.ci95[0]):null,high:s.ci95?Math.min(bounded?1:Infinity,s.ci95[1]):null};}
function row(key,label,planned=0){return {game:'wingspan',players:2,matchup:key,policy:key,policyId:label,opponentPolicyId:'No playing-strength measurement',scope:'Original two-player research experiment',budget:{},planned,finished:0,counts:{complete:0,capped:0,invalid:0,unresolved:0,illegal:0,error:0},seedGroups:0,completeSeedGroups:0,winShare:empty(),margin:empty(),chance:.5,meanDecisionMs:null,maxDecisionMs:null,metricKind:'progress',limitations:['Data generation and prediction loss do not establish playing strength.']};}
function recordsOf(entry){return Array.isArray(entry.result?.records)?entry.result.records:[];}
function resultOf(record){return record.result??record;}
function validated(record){const r=resultOf(record),v=record.validation??r.validation;return r.status==='complete'&&v?.valid===true&&!r.illegalActions&&!r.errors&&!['candidate','opponent'].some(s=>r.diagnostics?.[s]?.illegalActions||r.diagnostics?.[s]?.errors);}
function account(r,records,progress){
 const ids=new Map();for(const record of records){const id=record.task?.id??record.id;ids.set(id,(ids.get(id)??0)+1);}
 const valid=records.filter(record=>validated(record)&&ids.get(record.task?.id??record.id)===1);
 r.finished=Math.min(r.planned,Math.max(records.length,count(progress.completed??progress.finished)));
 r.counts.complete=Math.min(r.finished,valid.length);
 r.counts.capped=records.filter(a=>resultOf(a).status==='capped').length;
 r.counts.unresolved=records.filter(a=>['deadline','timeout','unresolved'].includes(resultOf(a).status)).length;
 r.counts.illegal=records.filter(a=>resultOf(a).illegalActions||['candidate','opponent'].some(s=>resultOf(a).diagnostics?.[s]?.illegalActions)).length;
 r.counts.invalid=records.filter(a=>!validated(a)&&resultOf(a).status==='complete').length;
 r.counts.error=Math.max(0,records.length-valid.length-r.counts.capped-r.counts.unresolved-r.counts.illegal);
 if(!records.length&&progress.counts)for(const key of Object.keys(r.counts))r.counts[key]=Math.min(r.finished,count(progress.counts[key]));
 const times=records.flatMap(a=>resultOf(a).decisionTimes?.candidate??[]);
 r.latency=latency(times);r.meanDecisionMs=r.latency.meanMs;r.maxDecisionMs=r.latency.maxMs;
 if(!times.length&&progress.latency){for(const key of ['n','meanMs','p95Ms','p99Ms','maxMs'])if(finite(progress.latency[key])&&progress.latency[key]>=0)r.latency[key]=progress.latency[key];r.meanDecisionMs=r.latency.meanMs;r.maxDecisionMs=r.latency.maxMs;}
 r.coverage={decisions:0,roots:0,unvisited:0,iterations:0,learnedLeafCount:0,learnedFallbackCount:0,errors:0};
 for(const a of records){const d=resultOf(a).diagnostics?.candidate??{};for(const key of Object.keys(r.coverage))r.coverage[key]+=count(d[key]);}
 if(!records.length&&progress.coverage)for(const key of Object.keys(r.coverage))r.coverage[key]=count(progress.coverage[key]);
 return valid;
}
function publicMetrics(m){if(!m||typeof m!=='object')return null;return Object.fromEntries(['huber','mae','saturation','correctionMean','examples','games','setups'].filter(k=>finite(m[k])).map(k=>[k,m[k]]));}
function publicStrata(s){return Object.fromEntries(['generation','round','viewer','engineActivity'].filter(k=>s?.[k]).map(k=>[k,Object.fromEntries(Object.entries(s[k]).map(([name,v])=>[safeText(name),publicMetrics(v)??safeText(v)]))]));}

export function buildSelfplayDashboard({manifest={},progressByStage={},now=new Date().toISOString()}={}){
 const rows=[],active=[],running=manifest.status==='running',terminal=['complete','stopped','failed','finished','deadline'].includes(manifest.status);
 const stages=Object.entries(manifest.stages??{});
 for(const [key,e]of stages){
  const kind=kindOf(key,e),progress=progressByStage[key]??{},records=recordsOf(e),generation=Number(key.match(/-(\d+)$/)?.[1]??e.result?.generation??0);
  const result=e.result??{},planned=count(e.planned??result.planned??progress.total??({calibration:32,collect:1024,confirmation:400,scaling:160}[kind]))||records.length;
  if(running&&e.status==='running')for(const a of (progress.active??[]).slice(0,24)){active.push({game:'wingspan',players:2,stage:key,id:safeText(a.id??a.taskId??a.task?.id??'active'),elapsedMs:finite(a.elapsedMs)?a.elapsedMs:null});}
  if(['calibration','collect'].includes(kind)){
   const r=row(key,kind==='calibration'?'Calibration · excluded from learning':`Generation ${generation} · collection`,planned);r.generation=generation;r.status=e.status;r.scope=kind==='collect'?'Whole independent setup groups; train/dev/sealed audit remain separate':'Outcome-blind runtime calibration; excluded from learning';account(r,records,progress);r.examples=records.reduce((n,a)=>n+count(a.exampleCount),0);r.seedGroups=planned;r.completeSeedGroups=r.counts.complete;r.budget={horizon:4,decisionSamples:'80% 100 / 20% 300'};rows.push(r);
  }else if(kind==='train'){
   const history=(result.history??progress.history??[]).map(h=>({epoch:count(h.epoch),trainHuber:finite(h.trainHuber)?h.trainHuber:null,devValueHuber:finite(h.dev?.huber??h.devValueHuber)?h.dev?.huber??h.devValueHuber:null})),last=history.at(-1);
   const r=row(key,`Generation ${generation} · compact residual fit`,count(result.config?.epochs??24));r.generation=generation;r.metricKind='loss';r.status=e.status;r.finished=last?.epoch??0;r.scope='Optimization epochs; development Huber selects one candidate, including epoch zero';r.training={latestFit:last?{seed:result.config?.seed??1729,epoch:last.epoch,devValueHuber:last.devValueHuber}:null,selectedEpoch:result.selectedEpoch??null,eligible:result.eligible===true,curves:history,dev:publicMetrics(result.dev),epochZero:publicMetrics(result.epochZero),linear:publicMetrics(result.linear),strata:publicStrata(result.strata)};r.modelHashes=hashes(result.modelHashes??result.hashes);rows.push(r);
  }else if(['screen','confirmation','scaling'].includes(kind)){
   const matchups=[...new Set(records.map(a=>a.task?.matchup??a.matchup).filter(x=>typeof x==='string'))];
   if(!matchups.length){const r=row(key,`${kind} · awaiting complete pairs`,planned);r.status=e.status;r.metricKind='win-share';r.finished=Math.min(planned,count(progress.completed));rows.push(r);}
   for(const matchup of matchups){
    const rs=records.filter(a=>(a.task?.matchup??a.matchup)===matchup),expectedPairs=kind==='confirmation'?100:40,r=row(key+'/'+matchup,`${kind==='confirmation'?'Fresh confirmation':kind==='scaling'?'Exploratory compute scaling':`Generation ${generation} screen`} · ${safeText(matchup)}`,expectedPairs*2);
    r.generation=generation;r.metricKind='win-share';r.status=e.status;r.seedGroups=expectedPairs;
    const valid=account(r,rs,{}).filter(a=>[0,.5,1].includes(resultOf(a).winShare)&&finite(resultOf(a).margin)),pairs=new Map();
    for(const a of valid){const seed=a.task?.seed??a.seed;pairs.set(seed,[...(pairs.get(seed)??[]),a]);}
    const complete=[...pairs.values()].filter(ps=>ps.length===2&&new Set(ps.map(a=>a.task?.seat??a.seat)).size===2&&ps.every(a=>[0,1].includes(a.task?.seat??a.seat)));
    r.completeSeedGroups=complete.length;
    const fixedComplete=e.status==='complete'&&rs.length===expectedPairs*2&&valid.length===rs.length&&complete.length===expectedPairs;
    if(fixedComplete){r.winShare=interval(complete.map(ps=>avg(ps.map(a=>resultOf(a).winShare))),true);r.margin=interval(complete.map(ps=>avg(ps.map(a=>resultOf(a).margin))));}
    r.inferenceComplete=fixedComplete;r.opponentPolicyId=safeText(rs[0]?.task?.opponent?.modelId??rs[0]?.task?.opponent?.method??'reference');r.budget={timeMs:rs[0]?.task?.candidate?.timeMs??null,horizon:rs[0]?.task?.candidate?.horizon??4};
    r.limitations=['Only fixed-count complete valid seat-paired comparisons expose winner shares and intervals. Partial outcomes remain hidden.','Screening is exploratory. Confirmation and latency gates are distinct from offline prediction eligibility.'];rows.push(r);
   }
  }else if(kind==='audit'&&e.status==='complete'){
   const r=row('audit','Frozen finalist · sealed offline audit');r.metricKind='loss';r.status=e.status;r.scope='Once-only frozen-candidate prediction audit; no checkpoint reselection';r.training={dev:publicMetrics(result.selected),linear:publicMetrics(result.linear),eligible:result.eligible===true,valid:result.valid===true};rows.push(r);
  }
 }
 const current=stages.find(([,e])=>e.status==='running')?.[0]??stages.at(-1)?.[0]??'prepared';
 const games=rows.filter(r=>r.metricKind!=='loss'&&!r.matchup.startsWith('scaling'));
 return {schema:1,study:'wingspan-selfplay',revision:safeText(manifest.revision??manifest.sourceRevision),startedAt:timestamp(manifest.startedAt??manifest.createdAt),updatedAt:now,status:running?'running':terminal?'finished':'planned',outcomeStatus:safeText(manifest.status??'prepared'),stage:current,stopReason:safeText(manifest.stopReason),workers:running?Math.min(24,active.length):0,active:running?active.slice(0,24):[],planned:games.reduce((n,r)=>n+r.planned,0),finished:games.reduce((n,r)=>n+r.finished,0),rows,generation:count(manifest.generation),sourceHashes:hashes(manifest.frozenHashes),champion:safeText(manifest.champion),finalist:manifest.finalFreeze?{candidate:safeText(manifest.finalFreeze.candidate),generation:manifest.finalFreeze.generation,modelHashes:hashes(manifest.finalFreeze.modelHashes)}:null,profileLatency:manifest.stages?.profile?.result?.latency?Object.fromEntries(['meanMs','p95Ms','p99Ms','maxMs'].filter(k=>finite(manifest.stages.profile.result.latency[k])).map(k=>[k,manifest.stages.profile.result.latency[k]])):null,method:'Original two-player Wingspan compact residual self-play research. Collection is not strength evidence; training rows report prediction loss. Winner shares require every scheduled valid seat pair. Production promotion is separate.',limitations:['Stopped campaigns retain their stop reason; finished status does not mean every proposed cycle ran.','No raw observations, hidden state, game files or sealed audit records are read for this snapshot.']};
}

function read(path){try{return JSON.parse(readFileSync(path,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
export function loadSelfplayDashboard(runtime,{now}={}){const manifest=read(resolve(runtime,'manifest.json'))??{},progressByStage={};for(const key of Object.keys(manifest.stages??{})){if(!/^[a-z][a-z0-9-]*$/.test(key))throw Error('Unsafe stage key');progressByStage[key]=read(resolve(runtime,'stages',key,'progress.json'))??{};}return buildSelfplayDashboard({manifest,progressByStage,now});}
export function main(argv=process.argv.slice(2)){const args=Object.fromEntries(argv.map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return [k,v.join('=')];}));if(!args.runtime||!args.out)throw Error('Use --runtime=DIR --out=FILE');const dash=loadSelfplayDashboard(args.runtime),out=resolve(args.out);mkdirSync(dirname(out),{recursive:true});writeFileSync(out+'.tmp',JSON.stringify(dash,null,2)+'\n');renameSync(out+'.tmp',out);return dash;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
