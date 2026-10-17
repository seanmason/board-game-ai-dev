import {readSession, boundedInteger} from '../shared/session.js';
import {
  BLACK,WHITE,EMPTY,PLAYERS,QUADRANTS,newGame,applyAction,legalActions,
  uniqueLegalActions,neutralQuadrants,actionKey,describeAction,fiveLines,
  assertValid,outcomes,rotate,coord
} from "./core.js";

const KEY="board-game-ai-pentago-v1";
const root=document.querySelector("#app");
const MAX_WORKERS=Math.max(1,Math.min(6,(navigator.hardwareConcurrency||2)-1));
const initial=newGame();
let game=initial,history=[{state:initial,label:"New Pentago session"}],index=0;
let seats=["human","human"],view="companion",selectedCell=null,hoverKey=null,pinnedKey=null;
let analysisEnabled=true,heatmapEnabled=true,workerCount=Math.min(2,MAX_WORKERS);
let selectionPolicy="heuristic";
let workers=[],partial=new Map(),analysis=null,generation=0,notification="";
const fmt=n=>new Intl.NumberFormat("en-US").format(Math.round(n));
const esc=s=>String(s).replace(/[&<>"']/g,c=>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const button=(action,title,klass="",props="")=>
  '<button type="button" class="button '+klass+'" data-action="'+action+'" '+props+'>'+title+'</button>';
const isAI=()=>game.mode==="digital"&&seats[game.currentPlayer]==="ai";
const winnerName=winner=>winner==="draw"?"Draw":PLAYERS[winner]+" wins";
function selectedAction(){return analysis?.candidates.find(c=>c.key===pinnedKey)?.action??null;}
function hoveredAction(){return analysis?.candidates.find(c=>c.key===hoverKey)?.action??null;}
function highlightAction(){return hoveredAction()??selectedAction();}
function winningCells(){
  if(game.phase!=="gameover")return new Set();
  return new Set(fiveLines(game.board).flat(2));
}
function recentCell(){
  const a=game.lastMove;
  if(!a)return -1;
  const r=Math.floor(a.cell/6),c=a.cell%6;
  const r0=a.quadrant>=2?3:0,c0=a.quadrant%2?3:0;
  if(a.quadrant<0||r<r0||r>=r0+3||c<c0||c>=c0+3)return a.cell;
  const dr=r-r0,dc=c-c0;
  const nr=a.direction===1?dc:2-dc;
  const nc=a.direction===1?2-dr:dr;
  return (r0+nr)*6+c0+nc;
}
function placementIntensity(){
  const result=new Map();
  if(!analysis?.candidates.length)return result;
  for(const item of analysis.candidates){
    result.set(item.action.cell,(result.get(item.action.cell)??0)+item.visits);
  }
  const max=Math.max(1,...result.values());
  for(const [cell,visits] of result)
    result.set(cell,Math.min(0.66,0.07+0.58*visits/max));
  return result;
}
function boardHtml(){
  const heat=placementIntensity(),winning=winningCells();
  const active=selectedCell;
  const last=recentCell();
  const preview=highlightAction();
  const quadrants=Array.from({length:4},(_,q)=>{
    const row0=q>=2?3:0,col0=q%2?3:0;
    const cells=Array.from({length:3},(_,r)=>Array.from({length:3},(_,c)=>{
      const cell=(row0+r)*6+col0+c;
      const color=game.board[cell];
      const ghost=active===cell&&color===EMPTY;
      const heatAlpha=heatmapEnabled&&color===EMPTY&&!ghost?(heat.get(cell)??0):0;
      const marble=(color===BLACK||color===WHITE)?
        '<span class="marble '+(color===BLACK?'black':'white')+'"></span>':
        (ghost?'<span class="marble ghost '+(game.currentPlayer===BLACK?'black':'white')+'"></span>':'');
      const label=coord(cell)+" "+(color===EMPTY?"empty":PLAYERS[color]+" marble");
      const klass=[
        "cell",
        winning.has(cell)?"winning-cell":"",
        cell===last?"last-cell":"",
        (preview?.cell===cell)?"hover-cell":""
      ].filter(Boolean).join(" ");
      return '<button type="button" class="'+klass+'" data-action="cell" data-cell="'+cell+
        '" aria-label="'+esc(label)+'" '+(color!==EMPTY||game.phase==="gameover"?"disabled":"")+
        ' style="--heat:'+heatAlpha.toFixed(3)+'">'+
        '<span class="heat"></span>'+marble+'</button>';
    }).join("")).join("");
    const choose=active!==null&&game.phase==="play";
    const controls=[-1,1].map(dir=>
      '<button type="button" class="turn-button" data-action="rotate" data-quadrant="'+q+
      '" data-direction="'+dir+'" '+(choose?"":"disabled")+
      ' aria-label="Rotate '+QUADRANTS[q]+' '+(dir===1?"clockwise":"counterclockwise")+
      '" title="'+(dir===1?"Clockwise":"Counterclockwise")+'">'+
      (dir===1?"↻":"↺")+'</button>').join("");
    return '<section class="quadrant" data-quadrant="'+q+'">'+
      '<div class="quad-label"><span>'+QUADRANTS[q]+'</span><div class="quad-controls">'+
      controls+'</div></div><div class="cells">'+cells+'</div></section>';
  }).join("");
  const neutral=active!==null?(()=>{
    const candidate=[...game.board];candidate[active]=game.currentPlayer;
    return neutralQuadrants(candidate).length>0;
  })():false;
  const prompt=game.phase==="gameover" ?
    winnerName(game.winner)+'. '+fmt(game.ply)+' turns played.':
    active===null ? "Select an empty socket to place "+PLAYERS[game.currentPlayer].toLowerCase()+
      ". Then choose any quadrant's 90° rotation.":
      "Placing at "+coord(active)+". Choose ↻ or ↺ on any quadrant to finish the turn."+
      (neutral?" You may also skip the twist while a neutral quadrant remains.":"");
  return '<section class="card board-card"><div class="card-head"><div>'+
    '<h2>Board</h2><p>Place one marble, then rotate any quadrant</p></div>'+
    '<span class="eyebrow">'+fmt(game.ply)+' / 36 placed</span></div>'+
    '<div class="board-and-tools"><div class="board-shell">'+
    '<div class="board">'+quadrants+'</div>'+
    '<div class="choose-prompt" id="move-instruction">'+esc(prompt)+'</div>'+
    '<div class="board-bottom">'+
      (active!==null?button("cancel-place","Cancel placement","small ghost"):"")+
      (neutral?button("skip-twist","No twist (neutral quadrant)","small"):"")+
    '</div></div></div><div class="legend">'+
    '<span><i class="spot dark"></i>Black</span>'+
    '<span><i class="spot light"></i>White</span>'+
    (heatmapEnabled?'<span>Gold tint = search visits by placement</span>':"")+
    '</div></section>';
}
function setupHtml(){
  return '<header class="mast"><div><h1>Pentago</h1>'+
    '<div class="tagline">Two players · Place and rotate · Five in a row</div></div>'+
    '<div class="mast-controls"><a href="../" title="Open Azul">Azul ↗</a>'+
    '<select id="mode" aria-label="Game mode">'+
    '<option value="physical"'+(game.mode==="physical"?" selected":"")+
      '>Physical board</option><option value="digital"'+(game.mode==="digital"?" selected":"")+
      '>Digital game</option></select>'+
    '<select id="starter" aria-label="First player">'+
    [BLACK,WHITE].map(p=>'<option value="'+p+'"'+(game.starter===p?" selected":"")+
      '>'+PLAYERS[p]+' first</option>').join("")+'</select>'+
    button("new-game","New game","primary")+'</div></header>';
}
function statusHtml(){
  const current=game.phase==="play"?PLAYERS[game.currentPlayer]:"";
  const lines=game.phase==="gameover"?
    '<strong>'+esc(winnerName(game.winner))+'</strong> · Game finished.':
    '<strong>'+current+' to play</strong> · '+(isAI()?"AI waits for Play Best Move. ":
      "Record a real move or play digitally. ")+
    "Analysis suggestions never change the board automatically.";
  return '<div id="turn-status" class="banner">'+lines+'</div>';
}
function seatsHtml(){
  return '<section class="card"><div class="card-head"><div><h2>Players</h2>'+
    '<p>AI seats only move when explicitly instructed.</p></div></div>'+
    '<div class="info-row">'+[BLACK,WHITE].map(p=>
      '<div class="pill '+(game.phase==="play"&&game.currentPlayer===p?"current":"")+'">'+
      '<i class="mini-marble '+(p===BLACK?"dark":"light")+'"></i>'+
      PLAYERS[p]+(game.mode==="digital"?
        ' <select data-action="seat" data-seat="'+p+'" aria-label="'+PLAYERS[p]+' seat">'+
          ['human','ai'].map(k=>'<option value="'+k+'"'+(seats[p]===k?" selected":"")+
          '>'+ (k==="ai"?"AI":"Human")+'</option>').join("")+'</select>':"")+
      '</div>').join("")+'</div></section>';
}
function analysisControls(){
  return '<div class="search-tools">'+
    '<label for="move-policy">Recommendation</label>'+
    '<select id="move-policy" data-action="move-policy" aria-label="How to select the leading move">'+
    '<option value="heuristic"'+(selectionPolicy==="heuristic"?" selected":"")+'>Tactical heuristic</option>'+
    '<option value="mcts"'+(selectionPolicy==="mcts"?" selected":"")+'>MCTS visits</option>'+
    '</select>'+
    '<label for="workers">Workers</label><select id="workers" data-action="workers">'+
    Array.from({length:MAX_WORKERS},(_,i)=>'<option value="'+(i+1)+'"'+
      (workerCount===i+1?" selected":"")+'>'+(i+1)+'</option>').join("")+
    '</select>'+button("toggle-search",analysisEnabled?"Pause":"Resume","small")+
    '<label class="switch"><input id="heatmap" type="checkbox" '+(heatmapEnabled?"checked":"")+
    '> Placement heatmap</label>'+
    (isAI()&&game.phase==="play"?
      button("play-best","Play Best Move","small primary",
        analysis?.candidates.length?"":'disabled title="Wait for search results"'):"")+
    '</div>';
}
function searchDetails(){
  const s=analysis,top=s?.candidates[0],active=game.phase==="play";
  const recommendation=top?
    '<div class="recommendation"><span class="eyebrow">'+
    (selectionPolicy==="heuristic"?"Heuristic recommendation":"MCTS most-visited move")+
    '</span>'+
    '<div><strong>'+esc(top.label)+'</strong></div>'+
    '<p>Estimated outcomes come from simulated or heuristic continuations; not calibrated probabilities.</p>'+
    button("pin-best","Highlight move","small")+' '+
    button("record-best",game.mode==="physical"?"Record suggested move":"Play suggested move",
      "small primary")+'</div>':
    '<div class="recommendation">Waiting for analysis of this position…</div>';
  const stats='<div class="stats">'+
    '<div class="stat"><div class="meta">Simulations</div><div class="value">'+
      fmt(s?.iterations??0)+'</div></div>'+
    '<div class="stat"><div class="meta">Simulations/s</div><div class="value">'+
      fmt(s?.elapsed>0?Math.max(0,s.iterations-s.retainedVisits)/(s.elapsed/1000):0)+'</div></div>'+
    '<div class="stat"><div class="meta">Tree nodes</div><div class="value">'+
      fmt(s?.nodes??0)+'</div></div></div>';
  const max=view==="analysis"?45:12;
  const rows=(s?.candidates??[]).slice(0,max).map((c,i)=>{
    const estimate=c.visits?(c.winSum[s.currentPlayer]/c.visits*100).toFixed(1)+"%":"—";
    return '<tr data-candidate-key="'+c.key+'" class="'+(pinnedKey===c.key?"pinned":"")+
      '"><td><button data-action="candidate" data-key="'+c.key+'" type="button">'+
      (i+1)+'. '+esc(c.label)+'</button></td>'+
      '<td class="right">'+estimate+'</td>'+
      '<td class="right">'+fmt(c.visits)+'</td></tr>';
  }).join("");
  const table='<div class="table-scroll"><table class="moves"><thead><tr>'+
    '<th>Full move</th><th class="right">Win est.</th>'+
    '<th class="right">Visits</th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="3">No simulated moves yet.</td></tr>')+
    '</tbody></table></div>';
  const coverage=s?.rootLegalActions?
    "Explored "+s.candidates.length+" of "+s.rootLegalActions+" distinct move outcomes.":
    "Search is starting.";
  const retained=s?.reusedWorkers?
    "Retained "+fmt(s.retainedVisits)+" conditional simulations across "+
      s.reusedWorkers+" worker(s) after the previous move.":
    "No prior-position simulations retained.";
  return '<div id="analysis-content">'+(active?recommendation:
    '<p class="meta">The game has ended. Use Undo to analyze an earlier position.</p>')+
    stats+'<p class="details" id="search-coverage">'+coverage+'</p>'+
    '<p class="details" id="search-reuse">'+retained+'</p>'+table+
    '<p class="details">A candidate combines a placement and a specific quadrant rotation. '+
    'Placement heat reflects search visits, not a unique recommended twist. '+
    'Click any candidate to pin its highlight.</p></div>';
}
function analysisHtml(){
  return '<section class="card"><div class="card-head"><div><h2>Position analysis</h2>'+
    '<p>Independent continuous Pentago search</p></div>'+
    '<span class="eyebrow" id="analysis-status">'+
    (game.phase!=="play"?"Finished":analysisEnabled?"Analyzing":"Paused")+
    '</span></div>'+analysisControls()+searchDetails()+'</section>';
}
function historyHtml(){
  return '<section class="card"><div class="card-head"><div><h2>Game history</h2>'+
    '<p>'+history.length+' saved positions in this session</p></div></div>'+
    '<div class="toolbar">'+button("undo","↶ Undo","small",index?"":"disabled")+
    button("redo","↷ Redo","small",index<history.length-1?"":"disabled")+
    button("export","Export JSON","small")+
    button("import","Import JSON","small")+
    '<input class="hidden" id="import-file" type="file" accept=".json,application/json">'+
    '</div><ol class="timeline">'+history.map((entry,i)=>
      '<li class="'+(i===index?"selected":"")+'"><span class="idx">'+i+'</span>'+
      '<button type="button" data-action="jump" data-index="'+i+'">'+
      esc(entry.label)+'</button></li>').reverse().join("")+'</ol></section>';
}
function rulesHtml(){
  return '<section class="card rules"><details><summary>How to play · Rules</summary>'+
    '<p>Pentago uses a 6×6 board made of four rotating 3×3 quadrants. '+
    'Players alternate placing black and white marbles into empty sockets.</p>'+
    '<ul><li>After placing, rotate any quadrant 90° clockwise or counterclockwise.</li>'+
    '<li>Five in a row horizontally, vertically, or diagonally wins.</li>'+
    '<li>If the placement itself completes five, that player wins immediately without rotating.</li>'+
    '<li>While a neutral quadrant remains (empty, or only its center occupied), '+
    'the rotation can be skipped. No 180° twists.</li>'+
    '<li>If a rotation creates five-in-a-row for both colors, the game is a draw. '+
    'A full board without five also draws.</li></ul>'+
    '<p><a href="https://zacatrus.es/media/instrucciones/Pentago_Reglas_zacatrus.pdf" '+
    'target="_blank" rel="noopener">Printed rules reference ↗</a></p></details></section>';
}
function render(){
  root.innerHTML='<div class="shell">'+setupHtml()+
    '<nav class="tabs">'+
    button("view","Companion","tab "+(view==="companion"?"active":""),'data-view="companion"')+
    button("view","Analysis","tab "+(view==="analysis"?"active":""),'data-view="analysis"')+
    '<span class="meta">'+(game.mode==="physical"?"Physical tracking":"Digital play")+
    ' · Move '+(game.ply+1)+'</span></nav>'+
    (notification?'<div class="banner error" role="alert">'+esc(notification)+'</div>':"")+
    statusHtml()+'<main class="layout"><div>'+boardHtml()+seatsHtml()+
    '</div><aside>'+analysisHtml()+historyHtml()+rulesHtml()+'</aside></main></div>';
  applyHover();
}
function applyHover(){
  for(const node of root.querySelectorAll(".hover-cell,.hover-twist,.hovered")){
    node.classList.remove("hover-cell","hover-twist","hovered");
  }
  const a=highlightAction();
  if(!a)return;
  root.querySelector('.cell[data-cell="'+a.cell+'"]')?.classList.add("hover-cell");
  if(a.quadrant>=0)
    root.querySelector('.quadrant[data-quadrant="'+a.quadrant+'"]')?.classList.add("hover-twist");
  if(hoverKey)
    [...root.querySelectorAll("tr[data-candidate-key]")].find(n=>
      n.dataset.candidateKey===hoverKey)?.classList.add("hovered");
}
function displayAnalysis(){
  const panel=root.querySelector("#analysis-content");
  const state=root.querySelector("#analysis-status");
  if(!panel||!state)return;
  state.textContent=game.phase!=="play"?"Finished":analysisEnabled?"Analyzing":"Paused";
  panel.outerHTML=searchDetails();
  const play=root.querySelector('button[data-action="play-best"]');
  if(play)play.disabled=!(analysis?.candidates.length);
  // Update placement heat without replacing the entire board and losing focus.
  if(heatmapEnabled){
    const heat=placementIntensity();
    for(const cell of root.querySelectorAll('.cell[data-cell]')){
      const id=Number(cell.dataset.cell);
      const alpha=game.board[id]===EMPTY?(heat.get(id)??0):0;
      cell.style.setProperty("--heat",alpha.toFixed(3));
    }
  }
  applyHover();
}
function combineResults(){
  const candidates=new Map();
  let iterations=0,nodes=0,elapsed=0,rootLegalActions=0;
  let currentPlayer=game.currentPlayer,reusedWorkers=0,retainedVisits=0,heuristicKey=null;
  for(const part of partial.values()){
    iterations+=part.iterations;nodes+=part.nodeCount;
    elapsed=Math.max(elapsed,part.elapsedMs);
    currentPlayer=part.currentPlayer;
    heuristicKey=part.heuristicKey??heuristicKey;
    rootLegalActions=Math.max(rootLegalActions,part.rootLegalActions??0);
    if(part.reused){reusedWorkers++;retainedVisits+=part.retainedVisits??0;}
    for(const candidate of part.candidates){
      const entry=candidates.get(candidate.key)??{
        key:candidate.key,action:candidate.action,label:candidate.label,
        visits:0,winSum:[0,0],valueSum:[0,0]
      };
      entry.visits+=candidate.visits;
      for(let p=0;p<2;p++){
        entry.winSum[p]+=candidate.winSum[p];
        entry.valueSum[p]+=candidate.valueSum[p];
      }
      candidates.set(candidate.key,entry);
    }
  }
  const ranked=[...candidates.values()].sort((a,b)=>{
    if(selectionPolicy==="heuristic"&&heuristicKey){
      if(a.key===heuristicKey)return -1;
      if(b.key===heuristicKey)return 1;
    }
    return b.visits-a.visits ||
      b.valueSum[currentPlayer]/Math.max(1,b.visits)-
        a.valueSum[currentPlayer]/Math.max(1,a.visits);
  });
  analysis={iterations,nodes,elapsed,candidates:ranked,currentPlayer,
    heuristicKey,rootLegalActions,reusedWorkers,retainedVisits};
}
function stopAnalysis(){
  generation++;
  for(const w of workers)w.terminate();
  workers=[];partial.clear();analysis=null;hoverKey=null;pinnedKey=null;
}
function startAnalysis(){
  stopAnalysis();
  if(game.phase!=="play"){displayAnalysis();return;}
  if(typeof Worker==="undefined"){
    notification="Web Workers are unavailable; moves can still be recorded.";
    render();return;
  }
  for(let i=0;i<workerCount;i++){
    const worker=new Worker(new URL("./worker.js",import.meta.url),{type:"module"});
    worker.onmessage=e=>{
      const result=e.data;
      if(result.generation!==generation)return;
      if(result.type==="error"){
        notification="Search error: "+result.message;
        render();return;
      }
      if(result.type==="progress"){
        partial.set(i,result);combineResults();displayAnalysis();
      }
    };
    worker.onerror=e=>{
      console.error(e);
      notification="The search worker failed. Manual game recording is still available.";
      render();
    };
    workers.push(worker);
    worker.postMessage({type:"start",generation,state:game,
      seed:(Math.random()*0x100000000)>>>0,
      maxNodes:14000,batch:3,rolloutLength:10,running:analysisEnabled});
  }
  displayAnalysis();
}
function afterChange(playedAction=null){
  selectedCell=null;hoverKey=null;pinnedKey=null;notification="";
  save();
  const use=playedAction&&game.phase==="play"&&workers.length===workerCount;
  if(use){
    const oldGeneration=generation;
    generation++;
    partial.clear();analysis=null;
    render();
    for(const worker of workers)worker.postMessage({
      type:"advance",previousGeneration:oldGeneration,generation,
      action:playedAction,state:game,
      seed:(Math.random()*0x100000000)>>>0,
      running:analysisEnabled,maxNodes:14000
    });
  }else{
    render();startAnalysis();
  }
}
function commitAction(action){
  const next=applyAction(game,action);
  assertValid(next);
  history=history.slice(0,index+1);
  history.push({state:next,label:PLAYERS[game.currentPlayer]+": "+describeAction(action)});
  index=history.length-1;game=next;
  afterChange(action);
}
function newSession(){
  const mode=root.querySelector("#mode").value;
  const starter=Number(root.querySelector("#starter").value);
  game=newGame({mode,starter});
  seats=mode==="digital"?["human","ai"]:["human","human"];
  history=[{state:game,label:"New Pentago game"}];index=0;
  afterChange();
}
function navTo(target){
  if(!Number.isInteger(target)||target<0||target>=history.length)return;
  game=history[target].state;index=target;
  afterChange();
}
function changePause(){
  analysisEnabled=!analysisEnabled;
  save();render();
  if(game.phase!=="play")return;
  if(!workers.length){startAnalysis();return;}
  for(const w of workers)w.postMessage({
    type:analysisEnabled?"resume":"pause",generation
  });
}
function save(){
  try{
    localStorage.setItem(KEY,JSON.stringify({
      version:1,history,index,seats,view,analysisEnabled,
      heatmapEnabled,workerCount,selectionPolicy
    }));
  }catch(error){console.warn("Could not autosave Pentago:",error);}
}
function restore(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return;
    const data=JSON.parse(raw);
    const restored=readSession(data,{validateState:assertValid,playerCount:()=>2});
    history=restored.history;index=restored.index;game=restored.game;seats=restored.seats;
    view=data.view==="analysis"?"analysis":"companion";
    analysisEnabled=data.analysisEnabled!==false;
    heatmapEnabled=data.heatmapEnabled!==false;
    selectionPolicy=data.selectionPolicy==="mcts"?"mcts":"heuristic";
    workerCount=boundedInteger(data.workerCount,workerCount,1,MAX_WORKERS);
  }catch(error){console.warn("Invalid saved Pentago session:",error);}
}
function exportGame(){
  const file={format:"board-game-ai-pentago",version:1,history,index,seats};
  const blob=new Blob([JSON.stringify(file,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;anchor.download="pentago-session.json";anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),0);
}
async function importGame(file){
  const data=JSON.parse(await file.text());
  const restored=readSession(data,{format:'board-game-ai-pentago',
    validateState:assertValid,playerCount:()=>2});
  history=restored.history;index=restored.index;game=restored.game;seats=restored.seats;
  afterChange();
}
root.addEventListener("click",event=>{
  const target=event.target.closest("button[data-action]");
  if(!target||target.disabled)return;
  const action=target.dataset.action;
  try{
    if(action==="new-game")newSession();
    else if(action==="cell"){
      if(game.phase!=="play")return;
      const cell=Number(target.dataset.cell);
      const instant=legalActions(game).find(a=>a.cell===cell&&a.quadrant<0);
      if(instant){
        const placed=[...game.board];placed[cell]=game.currentPlayer;
        if(fiveLines(placed)[game.currentPlayer].length){
          commitAction(instant);return;
        }
      }
      selectedCell=cell;pinnedKey=null;hoverKey=null;render();
    } else if(action==="rotate"){
      if(selectedCell===null)return;
      commitAction({cell:selectedCell,quadrant:Number(target.dataset.quadrant),
        direction:Number(target.dataset.direction)});
    } else if(action==="skip-twist"){
      if(selectedCell!==null)commitAction({cell:selectedCell,quadrant:-1,direction:0});
    } else if(action==="cancel-place"){selectedCell=null;render();}
    else if(action==="undo")navTo(index-1);
    else if(action==="redo")navTo(index+1);
    else if(action==="jump")navTo(Number(target.dataset.index));
    else if(action==="view"){view=target.dataset.view;save();render();}
    else if(action==="candidate"){
      pinnedKey=pinnedKey===target.dataset.key?null:target.dataset.key;
      selectedCell=null;render();
    } else if(action==="pin-best"){
      pinnedKey=analysis?.candidates[0]?.key??null;selectedCell=null;render();
    } else if(action==="record-best"||action==="play-best"){
      const best=analysis?.candidates[0]?.action;
      if(best)commitAction(best);
    } else if(action==="toggle-search")changePause();
    else if(action==="export")exportGame();
    else if(action==="import")root.querySelector("#import-file").click();
  }catch(error){notification=error.message;render();}
});
root.addEventListener("change",event=>{
  const target=event.target;
  if(target.id==="import-file"&&target.files?.length){
    importGame(target.files[0]).catch(e=>{notification=e.message;render();});
  }else if(target.dataset.action==="seat"){
    seats[Number(target.dataset.seat)]=target.value;save();render();
  }else if(target.dataset.action==="move-policy"){
    selectionPolicy=target.value==="mcts"?"mcts":"heuristic";
    if(analysis) {
      const key=analysis.heuristicKey;
      analysis.candidates.sort((a,b)=>{
        if(selectionPolicy==="heuristic"&&key){
          if(a.key===key)return -1;
          if(b.key===key)return 1;
        }
        return b.visits-a.visits ||
          b.valueSum[analysis.currentPlayer]/Math.max(1,b.visits)-
          a.valueSum[analysis.currentPlayer]/Math.max(1,a.visits);
      });
    }
    pinnedKey=null;save();render();
  }else if(target.dataset.action==="workers"){
    workerCount=Math.max(1,Math.min(MAX_WORKERS,Number(target.value)));
    save();render();startAnalysis();
  }else if(target.id==="heatmap"){
    heatmapEnabled=target.checked;save();render();
  }
});
root.addEventListener("pointermove",event=>{
  if(!["mouse","pen"].includes(event.pointerType))return;
  const row=event.target.closest("tr[data-candidate-key]");
  const key=row?.dataset.candidateKey??null;
  if(hoverKey===key)return;
  hoverKey=key;applyHover();
});
root.addEventListener("pointerleave",()=>{
  if(!hoverKey)return;hoverKey=null;applyHover();
});
document.addEventListener("keydown",event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="z"){
    event.preventDefault();navTo(index+(event.shiftKey?1:-1));return;
  }
  if(event.target.closest("input,select,textarea"))return;
  if(event.key==="Escape"&&selectedCell!==null){
    selectedCell=null;render();
  }
});
restore();render();startAnalysis();
