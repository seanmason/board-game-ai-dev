import {isDeepStrictEqual} from 'node:util';
import {summarize} from '../wingspan-study/analyze.mjs';
import {canaryTasks,screenTasks,confirmationTasks} from './plan.mjs';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export function validateResult(r,t){
 const issues=[];if(!r||!t)return ['missing-result-or-task'];
 for(const k of ['id','stage','matchup','seed','seat','candidate','opponent','rolloutStepLimit'])if(!isDeepStrictEqual(r[k],t[k]))issues.push('task-'+k);
 if(r.status!=='complete'||r.illegalActions!==0||r.errors!==0)issues.push('invalid-game');
 if(!Array.isArray(r.scores)||r.scores.length!==2||!r.scores.every(Number.isFinite)||!Number.isFinite(r.margin)||r.margin!==r.scores[t.seat]-r.scores[1-t.seat])issues.push('scores');
 if(![0,.5,1].includes(r.winShare)||(r.margin>0&&r.winShare!==1)||(r.margin<0&&r.winShare!==0))issues.push('outcome');
 for(const side of ['candidate','opponent']){
  const d=r.diagnostics?.[side],a=t[side],times=r.decisionTimes?.[side];
  if(!d||!Number.isSafeInteger(d.decisions)||d.decisions<1||!Number.isSafeInteger(d.iterations)||!Number.isSafeInteger(d.roots)||d.roots<d.decisions||d.iterations<d.roots||d.rolloutCount!==d.iterations)issues.push(side+'-accounting');
  for(const k of ['unvisited','safetyCapCount','illegalActions','errors'])if(d?.[k]!==0)issues.push(side+'-'+k);
  if(a.pipeline!=='deployed'&&(d?.unsettledLeaves!==0||d?.settledLeaves!==d?.rolloutCount))issues.push(side+'-boundary');
  if(a.pipeline==='deployed'&&(d?.unsettledLeaves!==null||d?.endpointMeasurement!=='legacy-not-instrumented'))issues.push(side+'-legacy-measurement');
  if(!Array.isArray(times)||times.length!==d?.decisions||times.some(x=>!Number.isFinite(x)||x<0))issues.push(side+'-latency');
  if(['linear','neural'].includes(a.method)){
   if(!Number.isSafeInteger(d?.learnedLeafCount)||d.learnedLeafCount<1||!Number.isSafeInteger(d?.learnedFallbackCount)||d.learnedFallbackCount<0||d.learnedLeafCount+d.learnedFallbackCount!==d.rolloutCount)issues.push(side+'-learned-usage');
   if(!/^[a-f0-9]{64}$/.test(r.modelIds?.[a.method]??''))issues.push(side+'-model-id');
  }
 }
 return issues;
}
function latency(rs,side){const a=rs.flatMap(r=>r.decisionTimes[side]).sort((a,b)=>a-b);return {n:a.length,mean:mean(a),p95:a.length?a[Math.ceil(a.length*.95)-1]:null,max:a.at(-1)??null};}
export function analyze(results,tasks){
 const stage=tasks[0]?.stage,expected=stage==='screen'?screenTasks():stage==='canary'?canaryTasks():stage==='confirmation'?confirmationTasks():[];
 const designValid=expected.length>0&&isDeepStrictEqual(tasks,expected),ids=new Map();for(const r of results)ids.set(r.id,[...(ids.get(r.id)??[]),r]);
 const valid=[],issues=[];
 for(const[id,rs]of ids){const t=tasks.find(t=>t.id===id),es=rs.length===1?validateResult(rs[0],t):['duplicate-result'];if(es.length)issues.push({id,issues:es});else valid.push(rs[0]);}
 const groups={};for(const key of new Set(tasks.map(t=>t.matchup))){
  const ts=tasks.filter(t=>t.matchup===key),rs=valid.filter(r=>r.matchup===key),seeds=[...new Set(ts.map(t=>t.seed))],pairs=[];
  for(const seed of seeds){const pair=rs.filter(r=>r.seed===seed);if(pair.length===2&&new Set(pair.map(r=>r.seat)).size===2)pairs.push({share:mean(pair.map(r=>r.winShare)),margin:mean(pair.map(r=>r.margin))});}
  const share=summarize(pairs.map(p=>p.share),{bounds:[0,1],alpha:.05/2}),margin=summarize(pairs.map(p=>p.margin),{alpha:.05/2}),candidateLatency=latency(rs,'candidate'),opponentLatency=latency(rs,'opponent');
  const meanRatio=opponentLatency.mean>0?candidateLatency.mean/opponentLatency.mean:null,p95Ratio=opponentLatency.p95>0?candidateLatency.p95/opponentLatency.p95:null;
  const latencyGate=meanRatio!==null&&meanRatio<=1.1&&p95Ratio!==null&&p95Ratio<=1.25,complete=designValid&&rs.length===ts.length&&pairs.length===seeds.length;
  groups[key]={expected:ts.length,valid:rs.length,pairs:pairs.length,complete,winShare:share,margin,candidateLatency,opponentLatency,meanRatio,p95Ratio,latencyGate,practicalGate:stage==='confirmation'&&complete&&share.lowerBound>.5&&margin.mean>0&&latencyGate};
 }
 const missing=tasks.filter(t=>!ids.has(t.id)).map(t=>t.id),complete=designValid&&!issues.length&&!missing.length&&results.length===tasks.length&&Object.values(groups).every(g=>g.complete);
 const eligible=stage==='screen'&&complete&&groups.deployed.winShare.mean>=.55&&groups.deployed.margin.mean>0&&groups.reference.margin.mean>0&&groups.deployed.latencyGate&&groups.reference.latencyGate;
 return {stage,designValid,complete,received:results.length,valid:valid.length,expected:tasks.length,issues,missing,groups,eligible:!!eligible,adoptionRecommended:stage==='confirmation'&&complete&&Object.values(groups).every(g=>g.practicalGate),productionDefaultsChanged:false};
}
