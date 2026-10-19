const dataRoot='https://raw.githubusercontent.com/seanmason/board-game-ai-dev/benchmarks/ai-comparison-2026-10-18/';
// Pin completed neural evidence: cached branch responses can still say running.
const studies={'wingspan-selfplay':{liveRef:'benchmarks/wingspan-selfplay-2026-10-19',remote:'https://raw.githubusercontent.com/seanmason/board-game-ai-dev/3c98b00b303798f8ca0da41334508362a2592d9a/wingspan-selfplay/dashboard.json',fallback:'snapshot-wingspan-selfplay.json',report:'wingspan-selfplay/REVIEW.md',branch:'3c98b00b303798f8ca0da41334508362a2592d9a'},'wingspan-neural':{remote:'https://raw.githubusercontent.com/seanmason/board-game-ai-dev/b5451fb44e89d965e89e21f4ace67683aa0f2d08/wingspan-neural/dashboard.json',fallback:'snapshot-wingspan-neural.json',report:'wingspan-neural/REPORT.md',branch:'benchmarks/wingspan-neural-2026-10-19'},'wingspan-overnight':{remote:'https://raw.githubusercontent.com/seanmason/board-game-ai-dev/benchmarks/wingspan-overnight-2026-10-18/wingspan-overnight/dashboard.json',fallback:'snapshot-wingspan-overnight.json',report:'wingspan-overnight/REPORT.md',branch:'benchmarks/wingspan-overnight-2026-10-18'},'wingspan-evaluator':{remote:dataRoot+'wingspan-evaluator-compute/dashboard.json',fallback:'snapshot-wingspan-evaluator.json',report:'wingspan-evaluator-compute/REPORT.md'},original:{remote:dataRoot+'dashboard.json',fallback:'snapshot.json',report:'REPORT.md'},followup:{remote:dataRoot+'followup/dashboard.json',fallback:'snapshot-followup.json',report:'followup/REPORT.md'},'hive-repetition':{remote:dataRoot+'hive-repetition/dashboard.json',fallback:'snapshot-hive-repetition.json',report:'hive-repetition/REPORT.md'},'good-enough':{remote:dataRoot+'good-enough/dashboard.json',fallback:'snapshot-good-enough.json',report:'good-enough/REPORT.md'}};
const requestedStudy=new URLSearchParams(location.search).get('study');
let selectedStudy=Object.hasOwn(studies,requestedStudy)?requestedStudy:'original',refreshGeneration=0;
const $=id=>document.getElementById(id),names={wingspan:'Wingspan','ticket-to-ride':'Ticket to Ride','love-letter':'Love Letter',jaipur:'Jaipur','sushi-go':'Sushi Go!','lost-cities':'Lost Cities',hive:'Hive'};
let snapshot=null,source='';
const number=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—',percent=n=>Number.isFinite(n)?`${(100*n).toFixed(1)}%`:'—';
const element=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
function displayBudget(study,row){
 if(study==='wingspan-selfplay'&&row.matchup==='calibration')return {timeMs:1000,horizon:4};
 if(study==='wingspan-selfplay'&&row.matchup?.startsWith('scaling/'))return {candidateSamples:300,opponentSamples:100,horizon:4};
 return row.budget;
}
function render(){if(!snapshot)return;const s=snapshot,age=Date.now()-Date.parse(s.updatedAt),stale=s.status==='running'&&age>180000;
 $('status').textContent=`${stale?'Running snapshot is stale; process health unconfirmed':s.status==='finished'?(s.outcomeStatus==='failed'?'Run stopped after a failure':s.outcomeStatus==='stopped'?'Run stopped':'Run finished'):s.status==='running'?'Run in progress':s.status==='interrupted'?'Run interrupted':s.status==='deadline'?'Time limit reached; incomplete comparisons remain inconclusive':'Run planned'} · Last update ${s.updatedAt?new Date(s.updatedAt).toLocaleString():'not started'}${source==='fallback'?' · bundled snapshot':''}${s.stopReason?' · '+s.stopReason:''}`;
 $('totals').textContent=`${s.finished??0} / ${s.planned??0} games recorded · ${s.workers??0} workers${s.stage?' · Stage: '+s.stage:''}`;
 $('method').textContent=s.method??'Forty independent setups per matchup, with all seats rotated. Benchmarks start after the implementation is validated and published.';
 $('revision').textContent=`Source revision: ${s.revision??'awaiting frozen manifest'} · Study: ${s.study}`;
 const value=$('game').value,slugs=[...new Set((s.rows??[]).map(r=>r.game))];$('game').replaceChildren(element('option','All games'));$('game').firstChild.value='all';for(const slug of slugs){const option=element('option',names[slug]??slug);option.value=slug;$('game').append(option);}$('game').value=slugs.includes(value)?value:'all';
 $('results').replaceChildren();for(const row of s.rows??[]){if($('game').value!=='all'&&$('game').value!==row.game)continue;const progressOnly=['progress','loss'].includes(row.metricKind),card=element('article',undefined,'card');card.append(element('h2',`${names[row.game]??row.game} · ${row.players} players`),element('p',`${row.policyId??row.policy} vs ${row.opponentPolicyId??'practical heuristic'}`,'subtle policy'),element('div',progressOnly?`${row.counts.complete} / ${row.planned}`:percent(row.winShare.mean),'metric'),element('div',progressOnly?(row.progressLabel??(row.metricKind==='loss'?'Training runs completed':'Validated data games collected')):`AI winner share · chance reference ${percent(row.chance)}`,'subtle'));
 const track=element('div',undefined,'track'),fill=element('div',undefined,'fill'),chance=element('div',undefined,'chance');fill.style.width=`${Math.max(0,Math.min(100,(progressOnly?(row.planned?row.counts.complete/row.planned:0):(row.winShare.mean??0))*100))}%`;chance.style.left=`${row.chance*100}%`;chance.hidden=progressOnly;track.append(fill,chance);card.append(track);
 const dl=element('dl');for(const [label,text]of [['95% paired interval',`${percent(row.winShare.low)} – ${percent(row.winShare.high)}`],['Complete setup groups',`${row.completeSeedGroups} / ${row.seedGroups}`],[progressOnly?'Records completed':'Games recorded',`${row.finished} / ${row.planned}`],['Completed',row.counts.complete],['Capped / unresolved',`${row.counts.capped} / ${row.counts.unresolved}`],['Illegal / errors',`${row.counts.illegal} / ${row.counts.error}`],['Mean score margin',number(row.margin.mean)],['Margin 95% interval',`${number(row.margin.low)} – ${number(row.margin.high)}`],['Mean AI decision',`${number(row.meanDecisionMs)} ms`],['Slowest AI decision',`${number(row.maxDecisionMs)} ms`]])dl.append(element('dt',label),element('dd',String(text)));card.append(dl,element('p',`${row.scope} · Budget ${JSON.stringify(displayBudget(s.study,row))}`,'subtle'));
 if(row.latency&&Number.isFinite(row.latency.p99Ms))card.append(element('p',`Decision latency p95 ${number(row.latency.p95Ms)} ms · p99 ${number(row.latency.p99Ms)} ms`,'subtle'));
 if(row.training){const t=row.training,fit=t.latestFit,details=[];if(fit)details.push(`Optimization seed ${fit.seed} · epoch ${fit.epoch} · development Huber loss ${number(fit.devValueHuber,4)}`);if(Number.isInteger(t.selectedEpoch))details.push(`Selected epoch ${t.selectedEpoch}`);if(Number.isFinite(t.dev?.mae))details.push(`${s.study==='wingspan-selfplay'&&row.matchup==='audit'?'Sealed audit':'Development'} MAE ${number(t.dev.mae,2)} points`);if(t.selected)details.push(`Selected seed ${t.selected.seed} · epoch ${t.selected.bestEpoch}`);if(typeof t.heldOutLearning==='boolean')details.push(`Held-out learning check: ${t.heldOutLearning?'passed':'failed'}`);const testError=typeof t.testGroupMAE==='number'?t.testGroupMAE:t.testGroupMAE?.mean;if(Number.isFinite(testError))details.push(`Test mean absolute error: ${number(testError,2)} points`);if(details.length)card.append(element('p',details.join(' · '),'subtle'));}
 if(row.winShare.n>1&&row.winShare.low===row.winShare.high)card.append(element('p','The interval has zero observed variation in this sample. It does not imply certainty about future wins.','warnings'));
 if(row.finished>row.counts.complete)card.append(element('p','Incomplete games excluded from the share estimate. Inspect completion counts before comparing policies.','warnings'));
 if(row.limitations?.length)card.append(element('p',Array.isArray(row.limitations)?row.limitations.join(' '):row.limitations,'subtle'));$('results').append(card);}
 $('active').replaceChildren(...(s.active?.length?s.active.map(r=>element('li',`${names[r.game]??r.game}, ${r.players} players · ${r.id}`)):[element('li',s.status==='finished'?'No active games.':'No active games reported in this snapshot.')]));
}
// Branch CDN responses can lag successful pushes. Resolve immutable bytes only
// when needed, with at most one public API lookup per study every three minutes.
const liveRefs=new Map();
async function resolveLiveSnapshot(config,data){
 let result={data,url:config.remote};
 const older=snapshot?.study===data.study&&Date.parse(snapshot.updatedAt)>Date.parse(data.updatedAt);
 const stale=data.status==='running'&&Date.now()-Date.parse(data.updatedAt)>180000;
 if(!config.liveRef||data.study!=='wingspan-selfplay'||(!older&&!stale))return result;
 let ref=liveRefs.get(config.remote);
 if(!ref||Date.now()-ref.checkedAt>=180000){
  ref={checkedAt:Date.now(),sha:ref?.sha??null};liveRefs.set(config.remote,ref);
  try{const branch=config.liveRef.split('/').map(encodeURIComponent).join('/');
   const response=await fetch(`https://api.github.com/repos/seanmason/board-game-ai-dev/git/ref/heads/${branch}?snapshot=${Math.floor(Date.now()/180000)}`,{cache:'no-store'});
   if(!response.ok)throw Error('Live reference unavailable');const value=await response.json();
   if(/^[a-f0-9]{40}$/.test(value.object?.sha??''))ref.sha=value.object.sha;
  }catch{/* Keep the last known snapshot when API access is unavailable. */}
 }
 if(ref?.sha)try{const url=config.remote.replace('/'+config.liveRef+'/','/'+ref.sha+'/');
  const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('Immutable snapshot unavailable');
  const current=await response.json();if(current.schema===1&&Array.isArray(current.rows)&&current.study===data.study&&Date.parse(current.updatedAt)>=Date.parse(data.updatedAt))result={data:current,url};
 }catch{/* Branch or last known data remains available with its honest timestamp. */}
 return result;
}
async function refresh(){
 const generation=++refreshGeneration,config=studies[selectedStudy],remote=config.remote;let lastError;
 for(const [url,kind]of [[`${remote}?snapshot=${Math.floor(Date.now()/60000)}`,'remote'],[config.fallback,'fallback']]){
  try{const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('Snapshot unavailable');let data=await response.json(),loadedURL=kind==='remote'?remote:config.fallback;if(data.schema!==1||!Array.isArray(data.rows))throw Error('Unsupported snapshot');if(kind==='remote'){const resolved=await resolveLiveSnapshot(config,data);data=resolved.data;loadedURL=resolved.url;}if(generation!==refreshGeneration)return;if(snapshot?.study===data.study&&Date.parse(snapshot.updatedAt)>Date.parse(data.updatedAt)){render();return;}snapshot=data;source=kind;$('download').href=loadedURL;$('report').href='https://github.com/seanmason/board-game-ai-dev/blob/'+(config.branch??'benchmarks/ai-comparison-2026-10-18')+'/'+config.report;render();return;}catch(error){lastError=error;}
 }
 if(generation!==refreshGeneration)return;
 $('status').textContent=`Cannot refresh: ${lastError.message}. ${snapshot?'Showing the last successfully loaded snapshot.':'Please try again shortly.'}`;
}
$('study').value=selectedStudy;$('study').onchange=()=>{selectedStudy=$('study').value;const url=new URL(location.href);url.searchParams.set('study',selectedStudy);history.replaceState(null,'',url);snapshot=null;$('results').replaceChildren();$('status').textContent='Loading selected study…';refresh();};
$('game').onchange=render;$('refresh').onclick=refresh;refresh();setInterval(refresh,60000);
