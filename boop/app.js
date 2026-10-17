import {readSession,boundedInteger} from '../shared/session.js';
import {PLAYERS,newGame,cloneGame,legalActions,previewPlacement,applyAction,actionKey,describeAction,assertValid,owner,coord,matchingLines} from './core.js';
const KEY='board-game-ai-boop-v1',FORMAT='board-game-ai-boop',root=document.querySelector('#app');
const MAX_WORKERS=Math.max(1,Math.min(6,(navigator.hardwareConcurrency||2)-1));
let game=newGame(),history=[{state:game,label:'New Boop session'}],index=0,seats=['human','human'];
let view='companion',method='guided',workerCount=1,enabled=true,heatmap=true,piece=1,selection=null,choice=0,pinned=null,hovered=null;
let workers=[],parts=new Map(),analysis=null,generation=0,notification='',recorded=null,target=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('en-US').format(Math.round(n));
const btn=(action,label,extra='',disabled=false)=>`<button type="button" class="button small" data-action="${action}" ${extra} ${disabled?'disabled':''}>${label}</button>`;
const findCandidate=key=>analysis?.candidates.find(c=>c.key===key);
const highlighted=()=>findCandidate(hovered??pinned)?.action;
const selectedAction=()=>selection?{...selection,graduate:previewPlacement(game,selection).choices[choice]??[]}:highlighted();
function quilt(board,{preview=false,action=null}={}){
  const heat=new Map();
  if(!preview&&heatmap)for(const c of analysis?.candidates??[])if(c.action.piece===piece)heat.set(c.action.cell,(heat.get(c.action.cell)??0)+c.visits);
  const max=Math.max(1,...heat.values()),winning=game.phase==='gameover'?new Set(matchingLines(board,game.winner,true).flat()):new Set();
  return `<div class="quilt ${preview?'preview-board':''}" role="group" aria-label="${preview?'Hypothetical result':'Recorded board'}">${board.map((v,i)=>{
    const mark=action?.cell===i?'hover-cell':'',graduate=action?.graduate?.includes(i)?'graduation':'';
    return `<button type="button" class="cell ${mark} ${graduate} ${winning.has(i)?'winning-cell':''}" data-action="${preview?'none':'cell'}" data-cell="${i}" aria-label="${coord(i)} ${v?PLAYERS[owner(v)]+' '+(Math.abs(v)===2?'cat':'kitten'):'empty'}" style="--heat:${heat.has(i)?0.1+0.5*heat.get(i)/max:0}" ${preview||v||game.phase==='gameover'?'disabled':''}><span class="heat"></span><small>${coord(i)}</small>${v?`<span class="cat ${v<0?'gray':''} ${Math.abs(v)===2?'adult':''}">${Math.abs(v)===2?'C':'k'}</span>`:''}</button>`;
  }).join('')}</div>`;
}
function previewHtml(){
  const a=selectedAction();if(!a)return '';
  const next=applyAction(game,a),p=previewPlacement(game,a);
  const movement=p.moved.map(m=>`${coord(m.from)} → ${m.to===null?'pool':coord(m.to)}`).join(' · ');
  const choices=selection&&p.choices.length>1?`<p>Choose exactly one graduation or retrieval:</p><div class="choice-list">${p.choices.map((g,i)=>btn('choice',g.length===1?'Retrieve / graduate '+g.map(coord).join(', '):'Graduate '+g.map(coord).join(', '),`data-choice="${i}" aria-pressed="${i===choice}"`)).join('')}</div>`:'';
  return `<div class="preview-panel"><h3>${selection?'Move preview':'Candidate preview'} · ${esc(describeAction(a))}</h3><p class="details">Recorded position remains unchanged. ${esc(movement||'No pieces pushed.')}</p>${quilt(next.board,{preview:true,action:a})}${choices}${btn('confirm',game.mode==='physical'?'Record this full move':'Play this full move','',!selection)} ${btn('clear','Clear preview')}${!selection?btn('branch','Explore variation'):''}</div>`;
}
function boardHtml(){
  return `<section class="card board-card"><div class="card-head"><div><h2>${recorded?'Variation board':'Recorded board'}</h2><p>Choose a piece, place it, then confirm the full turn.</p></div><span class="eyebrow">Turn ${game.ply+1}</span></div><div class="toolbar">${[1,2].map(p=>btn('piece',`${p===1?'Kitten':'Cat'} · ${game.pools[game.currentPlayer][p-1]} in pool`, `data-piece="${p}" aria-pressed="${piece===p}"`,game.phase!=='play'||!game.pools[game.currentPlayer][p-1])).join('')}</div>${quilt(game.board,{action:selection??highlighted()})}<p class="details">Small k = kitten · Large C = adult cat. Gold heat = visits for the selected piece type.</p><div id="preview">${previewHtml()}</div><div class="pools">${game.pools.map((pool,p)=>`<div class="pool ${game.currentPlayer===p?'current':''}"><strong>${PLAYERS[p]}${game.currentPlayer===p?' · to move':''}</strong><span>Pool: ${pool[0]} kittens · ${pool[1]} cats<br>Graduated: ${pool[1]+game.board.filter(v=>owner(v)===p&&Math.abs(v)===2).length} / 8</span>${game.mode==='digital'?`<select data-action="seat" data-seat="${p}" aria-label="${PLAYERS[p]} seat"><option value="human" ${seats[p]==='human'?'selected':''}>Human</option><option value="ai" ${seats[p]==='ai'?'selected':''}>AI</option></select>`:''}</div>`).join('')}</div></section>`;
}
function detailsHtml(){
  const top=analysis?.candidates[0],me=game.currentPlayer;
  const rows=(analysis?.candidates??[]).slice(0,view==='analysis'?120:8).map((c,i)=>`<tr data-candidate="${c.key}"><td><button data-action="candidate" data-key="${c.key}">${i+1}. ${esc(c.label)}</button>${c.tactic?`<div class="candidate-note">${c.tactic===1?'Wins this turn':'Allows immediate opponent win'}</div>`:''}</td><td class="right">${(c.valueSum[me]/c.visits*100).toFixed(1)}</td><td class="right">${fmt(c.visits)}</td></tr>`).join('');
  return `<div id="analysis-content"><div class="recommendation"><span class="eyebrow">${method==='guided'?'Tactical guided MCTS':'UCT baseline'}</span><div><strong>${top?esc(top.label):game.phase==='gameover'?'Game complete':'Waiting for simulations…'}</strong></div>${top?`${btn('pin','Preview best')} ${btn('record-best',game.mode==='physical'?'Record suggested move':'Play Best Move')} ${btn('branch-best','Explore variation')}`:''}<p>Evaluation is a 0–100 search utility, not a calibrated win percentage. Extra simulations stop at the next report and may exceed the requested increment.</p></div><div class="stats"><div class="stat"><div class="meta">Simulations</div><div class="value" id="simulations">${fmt(analysis?.iterations??0)}</div></div><div class="stat"><div class="meta">Simulations/s</div><div class="value">${fmt(analysis?.elapsed?Math.max(0,analysis.iterations-analysis.retained)/(analysis.elapsed/1000):0)}</div></div><div class="stat"><div class="meta">Tree nodes</div><div class="value">${fmt(analysis?.nodes??0)}</div></div></div><p class="details" id="coverage">Explored ${analysis?.candidates.length??0} / ${analysis?.legal??0} full moves. Retained ${fmt(analysis?.retained??0)} conditional simulations. ${fmt(analysis?.terminalSamples??0)} rollouts reached a real win; other leaves use a heuristic.</p>${top?.terminalSamples?`<p class="details">Best move: ${ (100*top.terminalWins[me]/top.terminalSamples).toFixed(1)}% wins among ${fmt(top.terminalSamples)} completed rollouts only. Cutoff leaves excluded; biased sample, not a win forecast.</p>`:''}<div class="table-scroll"><table class="moves"><thead><tr><th>Complete move</th><th>Eval.</th><th>Visits</th></tr></thead><tbody>${rows||'<tr><td colspan="3">No simulated moves yet.</td></tr>'}</tbody></table></div><p class="details">Continuation (most visited): ${esc((analysis?.pv??[]).map(describeAction).join(' → ')||'—')}. Suggestions never move pieces automatically.</p></div>`;
}
function render(){
  root.innerHTML=`<div class="shell"><header class="mast"><div><h1>Boop</h1><div class="tagline">A quilt, a few kittens, a surprisingly deep game.</div></div><div class="mast-controls"><a href="../" title="Open Azul">Azul ↗</a><select id="mode" aria-label="Game mode"><option value="physical" ${game.mode==='physical'?'selected':''}>Physical board</option><option value="digital" ${game.mode==='digital'?'selected':''}>Digital game</option></select><select id="starter" aria-label="First player">${PLAYERS.map((p,i)=>`<option value="${i}" ${game.starter===i?'selected':''}>${p} first</option>`).join('')}</select>${btn('new-game','New game')}</div></header><nav class="tabs">${btn('view','Companion','data-view="companion"')}${btn('view','Analysis','data-view="analysis"')}</nav>${notification?`<div class="banner error" role="alert">${esc(notification)}</div>`:''}<div class="banner ${recorded?'variation':''}" id="turn-status">${recorded?'HYPOTHETICAL VARIATION · ':''}${game.phase==='gameover'?PLAYERS[game.winner]+' wins':PLAYERS[game.currentPlayer]+' to play'} · ${game.mode==='physical'?'The physical board is authoritative.':'AI seats wait for Play Best Move.'}${recorded?' Recorded game is untouched. '+btn('return','Return to recorded game'):''}</div><main class="layout"><div>${boardHtml()}</div><aside><section class="card"><div class="card-head"><h2>Position analysis</h2><span class="eyebrow" id="analysis-status">${game.phase==='gameover'?'Finished':enabled?'Analyzing':'Paused'}</span></div><div class="search-tools"><select id="method" aria-label="Search method"><option value="guided" ${method==='guided'?'selected':''}>Tactical guided MCTS</option><option value="baseline" ${method==='baseline'?'selected':''}>UCT baseline</option></select><label>Workers <select id="workers">${Array.from({length:MAX_WORKERS},(_,i)=>`<option ${i+1===workerCount?'selected':''}>${i+1}</option>`).join('')}</select></label>${btn('pause',enabled?'Pause':'Resume')} ${btn('more','≥250 more','data-count="250"',game.phase!=='play')}${btn('more','≥1,000 more','data-count="1000"',game.phase!=='play')}<label class="switch"><input type="checkbox" id="heatmap" ${heatmap?'checked':''}> Heatmap</label></div>${detailsHtml()}</section><section class="card"><h2>${recorded?'Variation':'Game'} history</h2><div class="toolbar">${btn('undo','↶ Undo','',!index)}${btn('redo','↷ Redo','',index===history.length-1)}${btn('export','Export recorded JSON')}${btn('import','Import JSON')}<input id="import-file" class="hidden" type="file" accept=".json,application/json"></div><ol class="timeline">${history.map((e,i)=>`<li class="${i===index?'selected':''}"><span class="idx">${i}</span><button data-action="jump" data-index="${i}">${esc(e.label)}</button></li>`).reverse().join('')}</ol></section><section class="card rules"><details><summary>How to play · Rules</summary><p>Place a kitten or cat from your pool on an empty square. It pushes adjacent pieces one square directly away in all eight directions. Occupied destinations block a push; there are no chain reactions. Pieces pushed off the quilt return to their owner's pool.</p><p>Kittens cannot push cats. Cats can push either kind. After pushing, choose one line of three of your pieces to return to your pool, replacing its kittens with cats. With eight pieces on the quilt, you may instead retrieve any one piece, graduating it if it is a kitten. Choose only one option, even if several lines exist.</p><p>After all pushes, three of your adult cats in a line or all eight adult cats on the quilt wins. Only the active player can win on that turn. This implements original Boop; no ghosts or holiday expansions.</p><a href="https://rules.dized.com/game/3_U-I3tNQyW4X0aaWER7YA/boop" target="_blank" rel="noopener">Publisher-maintained rules ↗</a></details></section></aside></main></div>`;
}
function display(){
  const panel=root.querySelector('#analysis-content');if(panel)panel.outerHTML=detailsHtml();
  root.querySelector('#analysis-status').textContent=game.phase==='gameover'?'Finished':enabled?'Analyzing':'Paused';
  const action=selection??highlighted(),heat=new Map();
  if(heatmap)for(const c of analysis?.candidates??[])if(c.action.piece===piece)heat.set(c.action.cell,(heat.get(c.action.cell)??0)+c.visits);
  const max=Math.max(1,...heat.values());
  for(const el of root.querySelectorAll('.quilt:not(.preview-board) .cell')){const i=Number(el.dataset.cell);el.style.setProperty('--heat',heat.has(i)?0.1+0.5*heat.get(i)/max:0);el.classList.toggle('hover-cell',action?.cell===i);el.classList.toggle('graduation',!!action?.graduate?.includes(i));}
}
function combine(){
  const candidates=new Map();let iterations=0,nodes=0,elapsed=0,retained=0,legal=0,terminalSamples=0,pv=[];
  for(const p of parts.values()){
    iterations+=p.iterations;nodes+=p.nodeCount;elapsed=Math.max(elapsed,p.elapsedMs);retained+=p.retainedVisits??0;legal=Math.max(legal,p.rootLegalActions);terminalSamples+=p.terminalSamples;
    if(p.principalVariation.length>pv.length)pv=p.principalVariation;
    for(const c of p.candidates){const old=candidates.get(c.key)??{...c,visits:0,valueSum:[0,0],terminalWins:[0,0],terminalSamples:0};old.visits+=c.visits;old.terminalSamples+=c.terminalSamples;for(let i=0;i<2;i++){old.valueSum[i]+=c.valueSum[i];old.terminalWins[i]+=c.terminalWins[i];}candidates.set(c.key,old);}
  }
  const me=game.currentPlayer,ranked=[...candidates.values()].sort((a,b)=>b.tactic-a.tactic||b.visits-a.visits||b.valueSum[me]/b.visits-a.valueSum[me]/a.visits);
  analysis={iterations,nodes,elapsed,retained,legal,terminalSamples,pv,candidates:ranked};
}
function stop(){generation++;for(const w of workers)w.terminate();workers=[];parts.clear();analysis=null;target=null;}
function fail(message){enabled=false;target=null;for(const w of workers)w.postMessage({type:'pause',generation});notification=message;render();}
function start(){
  stop();if(game.phase!=='play'){display();return;}
  if(typeof Worker==='undefined'){fail('Web Workers are unavailable. Manual move recording remains available.');return;}
  for(let i=0;i<workerCount;i++){
    const w=new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),workerGeneration=generation;
    w.onmessage=({data})=>{if(data.generation!==generation)return;if(data.type==='error'){fail('Search error: '+data.message);return;}
      if(data.type!=='progress')return;parts.set(i,data);combine();
      if(target!==null&&analysis.iterations>=target){enabled=false;target=null;save();for(const worker of workers)worker.postMessage({type:'pause',generation});render();}
      display();};
    w.onerror=()=>{if(workers.includes(w)&&workerGeneration<=generation)fail('Search worker failed. Manual move recording remains available.');};
    workers.push(w);w.postMessage({type:'start',generation,state:game,seed:(Math.random()*2**32)>>>0,method,running:enabled});
  }
  display();
}
function session(){return{format:FORMAT,version:1,history:recorded?.history??history,index:recorded?.index??index,seats};}
function save(){try{localStorage.setItem(KEY,JSON.stringify({...session(),method,workerCount,enabled,heatmap,view}));}catch{notification='Autosave unavailable; export the recorded session to keep it.';}}
function changed(action=null){
  selection=null;choice=0;pinned=null;hovered=null;notification='';target=null;
  if(!game.pools[game.currentPlayer][piece-1])piece=game.pools[game.currentPlayer][0]?1:2;
  save();
  if(action&&game.phase==='play'&&workers.length===workerCount){const previousGeneration=generation;generation++;parts.clear();analysis=null;render();for(const w of workers)w.postMessage({type:'advance',generation,previousGeneration,state:game,action,method,running:enabled,seed:(Math.random()*2**32)>>>0});}
  else{render();start();}
}
function commit(action){const next=applyAction(game,action);assertValid(next);history=history.slice(0,index+1);history.push({state:next,label:PLAYERS[game.currentPlayer]+': '+describeAction(action)});index=history.length-1;game=next;changed(action);}
function branch(action){if(!action)return;if(!recorded)recorded={history,index};commit(action);}
function nav(i){if(i<0||i>=history.length)return;index=i;game=history[i].state;changed();}
function pause(running){enabled=running;target=null;save();render();if(!workers.length){start();return;}for(const w of workers)w.postMessage({type:enabled?'resume':'pause',generation});}
function preview(){root.querySelector('#preview').innerHTML=previewHtml();display();}
root.addEventListener('click',e=>{
  const t=e.target.closest('button[data-action]');if(!t||t.disabled)return;
  try{const a=t.dataset.action;
    if(a==='new-game'){const mode=root.querySelector('#mode').value,starter=Number(root.querySelector('#starter').value);recorded=null;game=newGame({mode,starter});seats=mode==='digital'?['human','ai']:['human','human'];history=[{state:game,label:'New Boop session'}];index=0;changed();}
    else if(a==='piece'){piece=Number(t.dataset.piece);selection=null;render();}
    else if(a==='cell'){selection={cell:Number(t.dataset.cell),piece};choice=0;pinned=null;hovered=null;preview();}
    else if(a==='choice'){choice=Number(t.dataset.choice);preview();}
    else if(a==='confirm'&&selection)commit(selectedAction());
    else if(a==='clear'){selection=null;pinned=null;hovered=null;render();}
    else if(a==='candidate'){selection=null;hovered=null;pinned=t.dataset.key;preview();}
    else if(a==='pin'){selection=null;pinned=analysis?.candidates[0]?.key;preview();}
    else if(a==='record-best'){const best=analysis?.candidates[0]?.action;if(best)commit(best);}
    else if(a==='branch'||a==='branch-best')branch(a==='branch'?highlighted():analysis?.candidates[0]?.action);
    else if(a==='return'&&recorded){history=recorded.history;index=recorded.index;game=history[index].state;recorded=null;changed();}
    else if(a==='undo')nav(index-1);else if(a==='redo')nav(index+1);else if(a==='jump')nav(Number(t.dataset.index));
    else if(a==='pause')pause(!enabled);
    else if(a==='more'){const previous=analysis?.iterations??0;pause(true);target=previous+Number(t.dataset.count);}
    else if(a==='view'){view=t.dataset.view;save();render();}
    else if(a==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(session(),null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='boop-session.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
    else if(a==='import')root.querySelector('#import-file').click();
  }catch(error){notification=error.message;render();}
});
root.addEventListener('change',async e=>{
  const t=e.target;
  try{
    if(t.id==='import-file'&&t.files?.length){const result=readSession(JSON.parse(await t.files[0].text()),{format:FORMAT,validateState:assertValid,playerCount:()=>2});history=result.history;index=result.index;game=result.game;seats=result.seats;recorded=null;changed();}
    else if(t.id==='method'){method=t.value==='baseline'?'baseline':'guided';save();render();start();}
    else if(t.id==='workers'){workerCount=boundedInteger(Number(t.value),1,1,MAX_WORKERS);save();render();start();}
    else if(t.id==='heatmap'){heatmap=t.checked;save();render();}
    else if(t.dataset.action==='seat'){seats[Number(t.dataset.seat)]=t.value;save();render();}
  }catch(error){notification=error.message;render();}
});
root.addEventListener('pointermove',e=>{if(!['mouse','pen'].includes(e.pointerType)||selection)return;const key=e.target.closest('tr[data-candidate]')?.dataset.candidate??null;if(key===hovered)return;hovered=key;preview();});
root.addEventListener('pointerleave',()=>{if(hovered){hovered=null;preview();}});
window.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea'))return;if(e.key==='Escape'){selection=null;hovered=null;pinned=null;render();}else if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();nav(index+(e.shiftKey?1:-1));}});
try{const raw=localStorage.getItem(KEY);if(raw){const d=JSON.parse(raw),s=readSession(d,{format:FORMAT,validateState:assertValid,playerCount:()=>2});history=s.history;index=s.index;game=s.game;seats=s.seats;method=d.method==='baseline'?'baseline':'guided';workerCount=boundedInteger(d.workerCount,1,1,MAX_WORKERS);enabled=d.enabled!==false;heatmap=d.heatmap!==false;view=d.view==='analysis'?'analysis':'companion';}}catch(error){notification='Saved session rejected: '+error.message;}
if(!game.pools[game.currentPlayer][0])piece=2;
render();start();
