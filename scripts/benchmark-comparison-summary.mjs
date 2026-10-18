// Seed groups, not seats, are the independent units for uncertainty.
export function interval(values, bounded=false) {
  if (!values.length) return {mean:null,low:null,high:null,n:0};
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  if(values.length<2)return {mean,low:null,high:null,n:values.length};
  const t=[0,12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045,2.042,2.040,2.037,2.035,2.032,2.030,2.028,2.026,2.024,2.023,2.021];
  const df=values.length-1,critical=t[df]??(1.96+2.372/df),se=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/df/values.length);
  return {mean,low:bounded?Math.max(0,mean-critical*se):mean-critical*se,high:bounded?Math.min(1,mean+critical*se):mean+critical*se,n:values.length};
}
export function summarize(manifest,results,active=[],status='running') {
  const byId=new Map(results.map(r=>[r.id,r])),groups=new Map();
  for(const task of manifest.tasks){if(!groups.has(task.matchup))groups.set(task.matchup,[]);groups.get(task.matchup).push(task);}
  const rows=[...groups].map(([matchup,tasks])=>{
    const first=tasks[0],observed=tasks.map(t=>byId.get(t.id)).filter(Boolean),complete=observed.filter(r=>r.status==='complete');
    const seeds=[...new Set(tasks.map(t=>t.seed))],shares=[],margins=[];
    for(const seed of seeds){const group=tasks.filter(t=>t.seed===seed).map(t=>byId.get(t.id));if(group.some(r=>r?.status!=='complete'))continue;
      shares.push(group.reduce((n,r)=>n+r.shares[r.seat],0)/group.length);
      if(group.every(r=>Number.isFinite(r.margin)))margins.push(group.reduce((n,r)=>n+r.margin,0)/group.length);
    }
    const counts=Object.fromEntries(['complete','capped','unresolved','illegal','error'].map(s=>[s,observed.filter(r=>r.status===s).length]));
    const decisions=observed.reduce((n,r)=>n+(r.latency?.count??0),0),totalMs=observed.reduce((n,r)=>n+(r.latency?.totalMs??0),0);
    return {matchup,game:first.game,players:first.players,policy:first.policy,scope:manifest.metadata[first.game].scope,budget:first.budget,policyId:complete[0]?.policyId??manifest.metadata[first.game].policyId,opponentPolicyId:complete[0]?.opponentPolicyId??manifest.metadata[first.game].opponentPolicyId,planned:tasks.length,finished:observed.length,counts,seedGroups:seeds.length,completeSeedGroups:shares.length,winShare:interval(shares,true),margin:interval(margins),chance:1/first.players,meanDecisionMs:decisions?totalMs/decisions:null,maxDecisionMs:Math.max(0,...observed.map(r=>r.latency?.maxMs??0)),elapsedMs:observed.reduce((n,r)=>n+(r.elapsedMs??0),0),limitations:manifest.metadata[first.game].limitations??[]};
  });
  return {schema:1,study:manifest.study,revision:manifest.revision,updatedAt:new Date().toISOString(),startedAt:manifest.startedAt,status,workers:manifest.workers,planned:manifest.tasks.length,finished:results.length,active,method:manifest.method,rows};
}
