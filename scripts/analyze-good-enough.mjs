import {readFileSync, readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildTasks} from './benchmark-comparison-plan.mjs';
import {interval} from './benchmark-comparison-summary.mjs';

export const ARM_SPECS = Object.freeze({
  'love-low': {game:'love-letter', players:[2,4], pairs:40, seedBase:9182600, policy:'production-default', budget:{iterations:64}},
  'love-high': {game:'love-letter', players:[2,4], pairs:40, seedBase:9182600, policy:'production-default', budget:{iterations:512}},
  'sushi-low': {game:'sushi-go', players:[4], pairs:40, seedBase:9282600, policy:'production-default', budget:{iterations:64}},
  'sushi-high': {game:'sushi-go', players:[4], pairs:40, seedBase:9282600, policy:'production-default', budget:{iterations:256}},
  'hive-control': {game:'hive', players:[2], pairs:100, seedBase:9382600, policy:'tactical-v2', budget:{ms:100,openingPlies:6,maxTurns:160,repetitionLimit:4,maxDepth:5}},
  'hive-history': {game:'hive', players:[2], pairs:100, seedBase:9382600, policy:'history-v1', budget:{ms:100,openingPlies:6,maxTurns:160,repetitionLimit:4,maxDepth:5}}
});
const comparisons = [['love-low','love-high',2],['love-low','love-high',4],['sushi-low','sushi-high',4],['hive-control','hive-history',2]];
const fail = message => {throw Error(message);};
const stable = value => JSON.stringify(value && typeof value === 'object' ? Array.isArray(value) ? value.map(v=>JSON.parse(stable(v))) : Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(stable(value[k]))])) : value);
const equal = (a,b) => stable(a) === stable(b);
const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const finite = n => Number.isFinite(n) && n>=0;
const statuses = ['complete','capped','unresolved','illegal','error'];
const key = r => `${r.game}/${r.players}/${r.seed}/${r.seat}`;

function validateArm(name, arm, spec) {
  if (!arm?.manifest || !Array.isArray(arm.records)) fail(`${name}: manifest and records required`);
  const {manifest:m,records} = arm;
  if (!m.revision || !m.hashes || !Object.keys(m.hashes).length || Object.values(m.hashes).some(h=>!/^[0-9a-f]{64}$/.test(h))) fail(`${name}: revision/source hashes required`);
  if (!m.metadata?.[spec.game] || Object.keys(m.metadata).length!==1) fail(`${name}: unexpected metadata game`);
  const expected = buildTasks({[spec.game]:{supportedPlayers:spec.players,defaultBudget:spec.budget,scope:'match'}}, {...spec,opponent:'simple-v1'});
  const tasks = new Map();
  if (!Array.isArray(m.tasks) || m.tasks.length!==expected.length || m.pairs!==spec.pairs) fail(`${name}: wrong scheduled task count`);
  const planned = new Map(expected.map(t=>[t.id,t]));
  for (const t of m.tasks) {
    if (tasks.has(t.id)) fail(`${name}: duplicate task ${t.id}`);
    if (!planned.has(t.id) || !equal(t,planned.get(t.id))) fail(`${name}: unexpected task ${t.id}`);
    tasks.set(t.id,t);
  }
  const byKey = new Map(), ids = new Set();
  for (const r of records) {
    const t = tasks.get(r.id);
    if (!t || ids.has(r.id) || byKey.has(key(r))) fail(`${name}: unexpected or duplicate result ${r.id}`);
    for (const field of ['id','matchup','game','players','seed','seat','policy','opponent','scope']) if (!equal(r[field],t[field])) fail(`${name}: result ${r.id} mismatched ${field}`);
    if (!equal(r.requestedBudget ?? r.budget,t.budget)) fail(`${name}: result ${r.id} mismatched requested budget`);
    if (!statuses.includes(r.status)) fail(`${name}: invalid status ${r.id}`);
    if (r.status==='complete') {
      if (!Array.isArray(r.shares) || r.shares.length!==r.players || r.shares.some(s=>!finite(s)||s>1) || Math.abs(r.shares.reduce((a,b)=>a+b,0)-1)>1e-8) fail(`${name}: invalid shares ${r.id}`);
    } else if (r.shares!=null) fail(`${name}: incomplete result must remain unadjudicated ${r.id}`);
    if (r.margin!=null && !Number.isFinite(r.margin)) fail(`${name}: invalid margin ${r.id}`);
    if (r.status!=='error') {
      const effectiveBudget=spec.game==='hive'?t.budget:{...t.budget,rootCoverageFloor:true};
      if (!equal(r.budget,effectiveBudget)) fail(`${name}: mismatched effective budget ${r.id}`);
      const metadata=m.metadata[spec.game], policyId=spec.policy==='history-v1'?metadata.historyPolicyId:metadata.policyId;
      if (!policyId || r.policyId!==policyId || r.opponentPolicyId!==metadata.opponentPolicyId) fail(`${name}: mismatched policy identity ${r.id}`);
      if (!r.latency || !Number.isInteger(r.latency.count) || r.latency.count<0 || !finite(r.latency.totalMs) || !finite(r.latency.maxMs) || (!r.latency.count && r.latency.totalMs!==0)) fail(`${name}: invalid latency ${r.id}`);
      if (spec.game!=='hive') for (const field of ['iterations','roots','coveredRoots']) if (!finite(r.diagnostics?.[field])) fail(`${name}: missing search diagnostic ${field} ${r.id}`);
      if (spec.game!=='hive' && r.diagnostics.coveredRoots>r.diagnostics.roots) fail(`${name}: covered roots exceed legal roots ${r.id}`);
      if (spec.game==='hive' && (!r.diagnostics?.opening?.sha256 || !/^[0-9a-f]{64}$/.test(r.diagnostics.opening.sha256))) fail(`${name}: missing opening identity ${r.id}`);
    }
    ids.add(r.id); byKey.set(key(r),r);
  }
  if (records.length!==tasks.size) fail(`${name}: missing ${tasks.size-records.length} scheduled results`);
  return {manifest:m,records,byKey};
}

function armMetrics(records) {
  const decisions=records.reduce((n,r)=>n+(r.latency?.count??0),0), totalMs=records.reduce((n,r)=>n+(r.latency?.totalMs??0),0);
  const sum = f => records.every(r=>finite(r.diagnostics?.[f])) ? records.reduce((n,r)=>n+r.diagnostics[f],0) : null;
  const iterations=sum('iterations'), roots=sum('roots'), coveredRoots=sum('coveredRoots');
  const setupRecords=[...new Set(records.map(r=>r.seed))].map(seed=>records.filter(r=>r.seed===seed));
  const completeGroups=setupRecords.filter(rs=>rs.every(r=>r.status==='complete'));
  return {games:records.length, counts:Object.fromEntries(statuses.map(s=>[s,records.filter(r=>r.status===s).length])),
    conditionalWinShare:interval(completeGroups.map(rs=>mean(rs.map(r=>r.shares[r.seat]))),true),
    conditionalMargin:interval(completeGroups.filter(rs=>rs.every(r=>Number.isFinite(r.margin))).map(rs=>mean(rs.map(r=>r.margin)))),
    completion:mean(records.map(r=>+(r.status==='complete'))), observedWinLowerBound:mean(records.map(r=>r.status==='complete'?r.shares[r.seat]:0)),
    observedWinUpperBound:mean(records.map(r=>r.status==='complete'?r.shares[r.seat]:1)),
    decisions,totalDecisionMs:totalMs,decisionWeightedLatencyMs:decisions?totalMs/decisions:null,
    iterations,iterationsPerDecision:iterations!==null&&decisions?iterations/decisions:null,roots,coveredRoots,rootCoverage:roots?coveredRoots/roots:null,
    note:iterations===null?'Actual iteration/root coverage totals are not recorded by this adapter.':null};
}

/** Pure analysis. Each arm contains {manifest, records}; specs override permits small synthetic fixtures. */
export function analyze(arms, {specs=ARM_SPECS}={}) {
  if (!equal(Object.keys(arms).sort(),Object.keys(specs).sort())) fail('Exact six arm keys required');
  const validated=Object.fromEntries(Object.entries(specs).map(([name,spec])=>[name,validateArm(name,arms[name],spec)]));
  const revisions=new Set(Object.values(validated).map(a=>a.manifest.revision));
  if (revisions.size!==1) fail('Source revision mismatch across arms');
  const hashes=new Map();
  for (const [name,{manifest}] of Object.entries(validated)) for (const [path,hash] of Object.entries(manifest.hashes)) {
    if (hashes.has(path) && hashes.get(path)!==hash) fail(`${name}: source hash mismatch ${path}`);
    hashes.set(path,hash);
  }
  const strata=[];
  for (const [controlName,candidateName,players] of comparisons) {
    const control=validated[controlName], candidate=validated[candidateName];
    if (!control || !candidate) continue;
    if (!equal(control.manifest.hashes,candidate.manifest.hashes)) fail(`${candidateName}: paired source hash key mismatch`);
    const game=specs[controlName].game, left=control.records.filter(r=>r.players===players), right=candidate.records.filter(r=>r.players===players);
    const seeds=[...new Set(left.map(r=>r.seed))].sort((a,b)=>a-b), groups=[];
    for (const seed of seeds) {
      const a=left.filter(r=>r.seed===seed).sort((x,y)=>x.seat-y.seat), b=right.filter(r=>r.seed===seed).sort((x,y)=>x.seat-y.seat);
      if (a.length!==players || b.length!==players) fail(`${game}: incomplete scheduled paired setup ${seed}`);
      if (game==='hive') {
        const signatures=[...a,...b].filter(r=>r.status!=='error').map(r=>r.diagnostics.opening.sha256);
        if (new Set(signatures).size>1) fail(`Hive paired opening mismatch ${seed}`);
      }
      const complete=[...a,...b].every(r=>r.status==='complete');
      const lower=rs=>mean(rs.map(r=>r.status==='complete'?r.shares[r.seat]:0));
      const upper=rs=>mean(rs.map(r=>r.status==='complete'?r.shares[r.seat]:1));
      const latencyDeltas=a.map((r,i)=>r.latency?.count && b[i].latency?.count ? b[i].latency.totalMs/b[i].latency.count-r.latency.totalMs/r.latency.count : null);
      groups.push({seed,completePaired:complete,winShareDelta:complete?lower(b)-lower(a):null,
        completionDelta:mean(b.map(r=>+(r.status==='complete')))-mean(a.map(r=>+(r.status==='complete'))),
        observedWinLowerBoundDelta:lower(b)-lower(a),sensitivityDeltaLow:lower(b)-upper(a),sensitivityDeltaHigh:upper(b)-lower(a),
        marginDelta:complete&&[...a,...b].every(r=>Number.isFinite(r.margin))?mean(b.map(r=>r.margin))-mean(a.map(r=>r.margin)):null,
        pairedGameMeanLatencyDeltaMs:latencyDeltas.every(x=>x!==null)?mean(latencyDeltas):null});
    }
    const stat=field=>interval(groups.map(g=>g[field]).filter(x=>x!==null));
    const metrics={control:armMetrics(left),candidate:armMetrics(right)};
    const winShareDelta=stat('winShareDelta'),completionDelta=stat('completionDelta'),observedWinLowerBoundDelta=stat('observedWinLowerBoundDelta');
    const valid=![...left,...right].some(r=>r.status==='illegal'||r.status==='error'||r.error||r.diagnostics?.error||r.diagnostics?.illegalActions>0||r.diagnostics?.illegal>0);
    const allComplete=groups.every(g=>g.completePaired);
    const hive=game==='hive';
    const openings=hive?seeds.map(seed=>left.find(r=>r.seed===seed&&r.diagnostics?.opening)?.diagnostics.opening.sha256).filter(Boolean):[];
    const gate=hive ? {type:'prespecified-primary-completion',passed:valid&&completionDelta.low!==null&&completionDelta.low>0&&completionDelta.mean>=.10&&observedWinLowerBoundDelta.mean>=0,
      completionOneSided975Lower:completionDelta.low,minimumCompletionGain:.10,observedWinLowerBoundNoWorse:observedWinLowerBoundDelta.mean>=0,zeroIllegalErrors:valid,promotion:false,
      note:'Completion improvement only; incomplete Hive outcomes remain unadjudicated. No claim of overall game strength or automatic promotion.'}
      : {type:'exploratory-compute-scaling',positiveDescriptiveSupport:valid&&allComplete&&winShareDelta.low!==null&&winShareDelta.low>0&&winShareDelta.mean>=.05,minimumWinShareGain:.05,allGamesValidAndComplete:valid&&allComplete,promotion:false,
        note:'Three exploratory strata; descriptive 95% intervals are not multiplicity adjusted and do not establish confirmation or promotion.'};
    strata.push({game,players,control:controlName,candidate:candidateName,setupGroups:groups.length,completePairedGroups:groups.filter(g=>g.completePaired).length,
      metrics,winShareDelta,completionDelta,observedWinLowerBoundDelta,
      openingIdentity:hive?{recordedSetupSignatures:openings.length,uniqueSignatures:new Set(openings).size,repeatedSignatures:openings.length-new Set(openings).size,note:'Seed is the analysis unit. Repeated opening signatures, if any, limit the independence interpretation.'}:null,
      conditional:!allComplete,
      sensitivityWinShareDelta:{low:mean(groups.map(g=>g.sensitivityDeltaLow)),high:mean(groups.map(g=>g.sensitivityDeltaHigh)),note:'Identification bounds with each incomplete game assigned any win share in [0,1]; not confidence intervals.'},
      marginDelta:stat('marginDelta'),pairedGameMeanLatencyDeltaMs:stat('pairedGameMeanLatencyDeltaMs'),gate,groups});
  }
  return {schema:1,revision:[...revisions][0],method:{unit:'Independent setup seed; seats averaged within each setup; deltas are candidate minus control.',
    intervals:'Approximate paired Student-t 95% intervals. For n>41, critical value approximated as 1.96 + 2.372/(n-1); at n=100 this approximates t(99, .975). The same lower endpoint is a one-sided 97.5% lower bound. No clipping of paired delta intervals.',
    missing:'Missing scheduled records are an error. Recorded capped/unresolved/illegal/error outcomes remain in completion and observed-win bounds; only fully complete paired setups enter win-share/margin analysis.',
    latency:'Decision-weighted means include all available recorded decisions; paired game means are averaged across seats then independent setup seeds. Setups with any zero-decision game are excluded only from the paired latency estimate.',
    multiplicity:'Hive has one prespecified primary completion test. Love Letter 2p/4p and Sushi Go 4p are three descriptive exploratory scaling strata; no promotions.'},strata};
}

export function readArms(root) {
  return Object.fromEntries(Object.keys(ARM_SPECS).map(name=>{
    const dir=resolve(root,name), manifest=JSON.parse(readFileSync(resolve(dir,'manifest.json'),'utf8'));
    const files=readdirSync(resolve(dir,'games')).filter(f=>f.endsWith('.json'));
    const records=files.map(file=>{const r=JSON.parse(readFileSync(resolve(dir,'games',file),'utf8'));if(file!==`${r.id}.json`)fail(`${name}: result filename/id mismatch ${file}`);return r;});
    return [name,{manifest,records}];
  }));
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const option=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
  const root=resolve(option('root','C:/Users/mason/.codex/benchmark-runs/good-enough-20261018'));
  const out=resolve(option('out',root));
  const analysis=analyze(readArms(root));mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'analysis.json'),JSON.stringify(analysis,null,2)+'\n');
  console.log(JSON.stringify({out:resolve(out,'analysis.json'),strata:analysis.strata.map(s=>({game:s.game,players:s.players,gate:s.gate}))}));
}
