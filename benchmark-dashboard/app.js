const dataRoot='https://raw.githubusercontent.com/seanmason/board-game-ai-dev/benchmarks/ai-comparison-2026-10-18/';
const studies={original:{remote:dataRoot+'dashboard.json',fallback:'snapshot.json',report:'REPORT.md'},followup:{remote:dataRoot+'followup/dashboard.json',fallback:'snapshot-followup.json',report:'followup/REPORT.md'},'hive-repetition':{remote:dataRoot+'hive-repetition/dashboard.json',fallback:'snapshot-hive-repetition.json',report:'hive-repetition/REPORT.md'}};
const requestedStudy=new URLSearchParams(location.search).get('study');
let selectedStudy=Object.hasOwn(studies,requestedStudy)?requestedStudy:'original',refreshGeneration=0;
const $=id=>document.getElementById(id),names={'ticket-to-ride':'Ticket to Ride','love-letter':'Love Letter',jaipur:'Jaipur','sushi-go':'Sushi Go!','lost-cities':'Lost Cities',hive:'Hive'};
let snapshot=null,source='';
const number=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—',percent=n=>Number.isFinite(n)?`${(100*n).toFixed(1)}%`:'—';
const element=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
function render(){if(!snapshot)return;const s=snapshot,age=Date.now()-Date.parse(s.updatedAt),stale=s.status==='running'&&age>180000;
 $('status').textContent=`${stale?'Running snapshot is stale; process health unconfirmed':s.status==='finished'?'Run finished':s.status==='running'?'Run in progress':s.status==='interrupted'?'Run interrupted':'Run planned'} · Last update ${s.updatedAt?new Date(s.updatedAt).toLocaleString():'not started'}${source==='fallback'?' · bundled snapshot':''}`;
 $('totals').textContent=`${s.finished??0} / ${s.planned??0} games recorded · ${s.workers??0} workers`;
 $('method').textContent=s.method??'Forty independent setups per matchup, with all seats rotated. Benchmarks start after the implementation is validated and published.';
 $('revision').textContent=`Source revision: ${s.revision??'awaiting frozen manifest'} · Study: ${s.study}`;
 const value=$('game').value,slugs=[...new Set((s.rows??[]).map(r=>r.game))];$('game').replaceChildren(element('option','All games'));$('game').firstChild.value='all';for(const slug of slugs){const option=element('option',names[slug]??slug);option.value=slug;$('game').append(option);}$('game').value=slugs.includes(value)?value:'all';
 $('results').replaceChildren();for(const row of s.rows??[]){if($('game').value!=='all'&&$('game').value!==row.game)continue;const card=element('article',undefined,'card');card.append(element('h2',`${names[row.game]??row.game} · ${row.players} players`),element('p',`${row.policyId??row.policy} vs ${row.opponentPolicyId??'practical heuristic'}`,'subtle policy'),element('div',percent(row.winShare.mean),'metric'),element('div',`AI winner share · chance reference ${percent(row.chance)}`,'subtle'));
 const track=element('div',undefined,'track'),fill=element('div',undefined,'fill'),chance=element('div',undefined,'chance');fill.style.width=`${Math.max(0,Math.min(100,(row.winShare.mean??0)*100))}%`;chance.style.left=`${row.chance*100}%`;track.append(fill,chance);card.append(track);
 const dl=element('dl');for(const [label,text]of [['95% paired interval',`${percent(row.winShare.low)} – ${percent(row.winShare.high)}`],['Complete setup groups',`${row.completeSeedGroups} / ${row.seedGroups}`],['Games recorded',`${row.finished} / ${row.planned}`],['Completed',row.counts.complete],['Capped / unresolved',`${row.counts.capped} / ${row.counts.unresolved}`],['Illegal / errors',`${row.counts.illegal} / ${row.counts.error}`],['Mean score margin',number(row.margin.mean)],['Margin 95% interval',`${number(row.margin.low)} – ${number(row.margin.high)}`],['Mean AI decision',`${number(row.meanDecisionMs)} ms`],['Slowest AI decision',`${number(row.maxDecisionMs)} ms`]])dl.append(element('dt',label),element('dd',String(text)));card.append(dl,element('p',`${row.scope} · Budget ${JSON.stringify(row.budget)}`,'subtle'));
 if(row.winShare.n>1&&row.winShare.low===row.winShare.high)card.append(element('p','The interval has zero observed variation in this sample. It does not imply certainty about future wins.','warnings'));
 if(row.finished>row.counts.complete)card.append(element('p','Incomplete games excluded from the share estimate. Inspect completion counts before comparing policies.','warnings'));
 if(row.limitations?.length)card.append(element('p',Array.isArray(row.limitations)?row.limitations.join(' '):row.limitations,'subtle'));$('results').append(card);}
 $('active').replaceChildren(...(s.active?.length?s.active.map(r=>element('li',`${names[r.game]??r.game}, ${r.players} players · ${r.id}`)):[element('li',s.status==='finished'?'No active games.':'No active games reported in this snapshot.')]));
}
async function refresh(){
 const generation=++refreshGeneration,config=studies[selectedStudy],remote=config.remote;let lastError;
 for(const [url,kind]of [[`${remote}?snapshot=${Math.floor(Date.now()/60000)}`,'remote'],[config.fallback,'fallback']]){
  try{const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('Snapshot unavailable');const data=await response.json();if(data.schema!==1||!Array.isArray(data.rows))throw Error('Unsupported snapshot');if(generation!==refreshGeneration)return;snapshot=data;source=kind;$('download').href=kind==='remote'?remote:config.fallback;$('report').href='https://github.com/seanmason/board-game-ai-dev/blob/benchmarks/ai-comparison-2026-10-18/'+config.report;render();return;}catch(error){lastError=error;}
 }
 if(generation!==refreshGeneration)return;
 $('status').textContent=`Cannot refresh: ${lastError.message}. ${snapshot?'Showing the last successfully loaded snapshot.':'Please try again shortly.'}`;
}
$('study').value=selectedStudy;$('study').onchange=()=>{selectedStudy=$('study').value;const url=new URL(location.href);url.searchParams.set('study',selectedStudy);history.replaceState(null,'',url);snapshot=null;$('results').replaceChildren();$('status').textContent='Loading selected study…';refresh();};
$('game').onchange=render;$('refresh').onclick=refresh;refresh();setInterval(refresh,60000);
