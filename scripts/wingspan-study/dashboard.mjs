import {validateResult,summarize} from './analyze.mjs';
const interval=(values,bounded=false)=>{const s=summarize(values,bounded?{bounds:[0,1]}:{});return {n:s.n,mean:s.mean,low:s.ci95?Math.max(bounded?0:-Infinity,s.ci95[0]):null,high:s.ci95?Math.min(bounded?1:Infinity,s.ci95[1]):null,degenerate:s.degenerate,intervalMethod:s.intervalMethod};};
const names={reference:'Reference',exceptional:'Exceptional powers',chains:'Ordered chains',investment:'Early investment',blend:'Conservative blend'};
const avg=a=>a.length?a.reduce((n,x)=>n+x,0)/a.length:null;
export function healthy(r,task=r){return Boolean(r&&validateResult(r,task).length===0);}
export function snapshot({revision,startedAt,status='planned',stage='screen',workers=18,tasks,results=[],active=[]}){
 const byId=new Map(results.map(r=>[r.id,r])),groups=new Map();
 for(const t of tasks){const key=t.stage+'/'+t.matchup;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
 const rows=[...groups].map(([key,ts])=>{
  const t=ts[0],seen=ts.map(t=>byId.get(t.id)).filter(Boolean),valid=seen.filter(r=>healthy(r,ts.find(t=>t.id===r.id))),seeds=[...new Set(ts.map(t=>t.seed))],shares=[],margins=[];
  for(const seed of seeds){const pair=ts.filter(t=>t.seed===seed).map(t=>byId.get(t.id));if(pair.length!==2||pair.some(r=>!healthy(r,ts.find(t=>t.id===r?.id))))continue;shares.push(avg(pair.map(r=>r.winShare)));margins.push(avg(pair.map(r=>r.margin)));}
  const times=seen.flatMap(r=>r.decisionTimes?.candidate??[]),counts={complete:valid.length,capped:0,unresolved:0,illegal:0,error:0};
  for(const r of seen)if(!healthy(r,ts.find(t=>t.id===r.id))){if(r.status==='capped')counts.capped++;else if(r.illegalActions||r.diagnostics?.candidate?.illegalActions||r.diagnostics?.opponent?.illegalActions)counts.illegal++;else counts.error++;}
  const label=a=>`${a.pipeline==='deployed'?'Deployed':names[a.method]} · ${a.timeMs===undefined?a.budget+' samples':a.timeMs+' ms requested'} · horizon ${a.horizon}`;
  return {game:'wingspan',players:2,matchup:key,policy:t.candidate.method,policyId:`${t.stage==='confirmation'?'Fresh confirmation':'Screen'} · ${label(t.candidate)}`,opponentPolicyId:label(t.opponent),scope:'full match',budget:t.candidate,planned:ts.length,finished:seen.length,counts,seedGroups:seeds.length,completeSeedGroups:shares.length,winShare:interval(shares,true),margin:interval(margins),chance:.5,meanDecisionMs:avg(times),maxDecisionMs:times.length?times.reduce((a,b)=>Math.max(a,b),0):null,limitations:['Root samples use a representative action generator; complete legal human actions remain available. Horizon counts subsequent ordinary actions across both players.','Fresh confirmation is separate from screening. Multiple-comparison decisions and matched compute contrasts are in the report.']};
 });
 return {schema:1,study:'wingspan-evaluator-compute-2026-10-18',revision,startedAt,updatedAt:new Date().toISOString(),status,stage,workers,planned:tasks.length,finished:results.length,active:active.map(a=>({...a,game:'wingspan',players:2})),rows,
 method:'Two-player Wingspan: reference and four evaluator hypotheses, crossed 100/300 root samples × horizons 4/12 against a fixed corrected reference. Forty independent seat pairs per screen cell. At most one selected challenger enters fresh direct strength/compute confirmation. The corrected research pipeline settles pending powers; the deployed pipeline is preserved for a separate matched-requested-time comparison. Production defaults remain unchanged during research.'};
}
