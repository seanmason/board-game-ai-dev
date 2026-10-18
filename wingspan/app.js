import {readSession,boundedInteger} from '../shared/session.js';
import {knownCard} from './observation-io.js';
import {physicalPanel,readObservationAnswer} from './physical-ui.js';
import {BIRDS,BONUSES} from "./catalog.js";
import {
  FOOD,HABITATS,scorePlayer,finalOutcome,allBirds,goalQuantity
} from "./scoring.js";
import {
  newGame,applyAction,assertValid,publicObservation,
  ROUND_ACTIONS,RESOURCE_PROGRESSION,EGG_COLUMN_COST
} from "./core.js";
import {reconcileCard,reconcileFood,reconcileEggs,missingPublic,analysisBlocker,
  knownChoiceState,observedCandidates,reconcileFeeder,reconcileGoals,
  recordPhysicalAction,answerObservation,cancelObservation} from "./observations.js";
import {powerDescription} from "./powers.js";
import {advancedEditor,detailedAction} from "./move-editor.js";

const root=document.querySelector("#app");
const KEY="board-game-ai-wingspan-v1";
const MAX_WORKERS=Math.max(1,Math.min(4,(navigator.hardwareConcurrency||2)-1));
const FIRST=newGame({players:2,mode:"digital",seed:912731});
let history=[{state:FIRST,label:"New Wingspan session"}],index=0,game=FIRST;
let seats=["human","human"],view="companion",analysisEnabled=true;
let searchMethod="belief-rollout";
let workerCount=Math.min(2,MAX_WORKERS),workers=[],partResults=new Map();
let analysis=null,generation=0,options=[],notification="";
let pinned=-1,hovered=-1;
let advancedKind="gainFood",advancedBirdId=null,advancedHabitat=null;
let keep=new Set(),discardFood=new Set(),bonusChoice=null;
let observation={zone:"hand",player:0,slot:0,cardId:0,food:"seed",count:1};
const pretty=n=>new Intl.NumberFormat("en-US").format(Math.round(n));
const esc=x=>String(x).replace(/[&<>"']/g,c=>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const button=(action,text,klass="",props="")=>
  '<button type="button" class="'+klass+'" data-action="'+action+'" '+props+'>'+text+'</button>';
const phaseOwner=()=>game.phase==="power"?
  game.pending[0]?.owner??game.currentPlayer:game.currentPlayer;
const isAI=()=>game.mode==="digital"&&seats[phaseOwner()]==="ai";
const foodName=f=>({
  invertebrate:"Invertebrate",seed:"Seed",fish:"Fish",
  fruit:"Fruit",rodent:"Rodent",dual:"Invertebrate / Seed"
})[f]??f;
const habitatTitle=h=>h==="grassland"?"Grassland":h==="forest"?"Forest":"Wetland";
function scorePublic(p){
  const s=scorePlayer(p);
  return {base:s.total-s.bonuses,bonus:s.bonuses,breakdown:s};
}
function titleForState(){
  if(game.phase==="setup")return "Starting choices · Player "+(game.currentPlayer+1);
  if(game.phase==="power"){
    const p=game.pending[0];
    return "Bird power · Player "+(p.owner+1);
  }
  if(game.phase==="gameover"){
    if(game.mode==='physical'&&game.players.some(p=>p.bonuses.some(id=>!knownCard(game,id,true))))
      return 'Game complete · enter private bonuses to confirm final scores';
    const leaders=finalOutcome(game.players);
    return leaders.every(x=>x===leaders[0])?"Game complete · tie":
      "Game complete · Winner "+(leaders.findIndex(x=>x>0)+1);
  }
  return "Round "+game.round+" · Player "+(game.currentPlayer+1)+" to act";
}
function setupHeader(){
  return '<header class="mast"><div><h1>Wingspan</h1>'+
    '<details><summary>Rules &amp; scope</summary><p>Original Wingspan, 170 birds, no expansions. Further rules and device validation remain. Analysis is advisory and has not been validated as expert play.</p></details></div>'+
    '<div class="mast-tools"><a href="../index.html" data-suite-nav>Games</a>'+
    '<select id="players" aria-label="Number of players">'+
    [2,3,4,5].map(n=>'<option value="'+n+'"'+
      (game.players.length===n?" selected":"")+'>'+n+' players</option>').join("")+
    '</select><select id="mode" aria-label="Mode">'+
    '<option value="digital"'+(game.mode==="digital"?" selected":"")+'>Digital</option>'+
    '<option value="physical"'+(game.mode==="physical"?" selected":"")+
      '>Physical tracking</option></select>'+
    '<select id="goal-mode" aria-label="Goal scoring">'+
    '<option value="green"'+(game.goalMode==="green"?" selected":"")+
      '>Competitive goals</option>'+
    '<option value="blue"'+(game.goalMode==="blue"?" selected":"")+
      '>Personal goals</option></select>'+
    '<select id="starter" aria-label="Starting player">'+
    game.players.map((_,i)=>'<option value="'+i+'"'+
      (game.starter===i?" selected":"")+'>'+'Start P'+(i+1)+'</option>').join("")+
    '</select>'+button("new-game","New game","primary")+'</div></header>';
}
function scorePanel(){
  return '<section class="card"><div class="card-head"><div><h2>Players</h2>'+
    '<p>Points from public components; private bonus values are hidden.</p></div>'+
    '<span class="eyebrow">Round '+game.round+' / 4</span></div>'+
    '<div class="score-grid">'+game.players.map((p,i)=>{
      const subtotal=scorePublic(p);
      const current=game.currentPlayer===i&&game.phase!=="gameover";
      const total=game.phase==="gameover"&&p.bonuses.every(id=>knownCard(game,id,true))?subtotal.breakdown.total:
        subtotal.base;
      const activeLabel=game.phase==="gameover"?(p.bonuses.every(id=>knownCard(game,id,true))?"Final":"Public (bonus unknown)"):"Public";
      return '<div class="score-card '+(current?"current":"")+'">'+
        '<strong>Player '+(i+1)+'</strong>'+
        (game.mode==="digital"?
         ' <select aria-label="Seat '+(i+1)+'" data-action="seat" data-player="'+i+'">'+
         ['human','ai'].map(t=>'<option value="'+t+'"'+
           (seats[i]===t?" selected":"")+'>'+t+'</option>').join("")+
         '</select>':"")+
        '<div class="value">'+pretty(total)+'</div>'+
        '<div class="meta">'+activeLabel+' VP · '+
          game.remaining[i]+' actions left</div>'+
        '<div class="meta">'+allBirds(p).length+' birds · '+
          FOOD.reduce((n,f)=>n+p.food[f],0)+' food · '+
          p.hand.length+' cards in hand</div></div>';
    }).join("")+'</div></section>';
}
function birdView(entry,{compact=false,highlight=false}={}){
  if(game.mode==='physical'&&!knownCard(game,entry.id))
    return '<div class="bird unknown"><strong>Unknown / private bird</strong><small>Enter its identity only when observed.</small></div>';
  const b=BIRDS[entry.id];
  const info=FOOD.filter(f=>b.food[f]).map(f=>
    b.food[f]+' '+foodName(f).toLowerCase()).join(" + ")+
    (b.food.wild?' + '+b.food.wild+' any':"");
  return '<div class="bird '+(highlight?"emphasized":"")+'" data-bird-id="'+b.id+'">'+
    '<strong>'+esc(b.name)+'</strong>'+
    '<small>'+b.points+' VP · '+b.nest+' nest · '+b.eggs+' egg slots</small>'+
    (compact?"":
      '<small>Food: '+esc(b.either?'one of '+info:(info||"none"))+'</small>')+
    (b.powerType==="none"?'<small>No power</small>':
      '<small><span class="power-tag '+b.powerType+'">'+b.powerType+'</span> '+
      esc(powerDescription(b.powerCode))+'</small>')+
    (entry.eggs!==undefined?
      '<small>'+entry.eggs+' eggs · '+entry.cached.length+
      ' cached · '+entry.tucked.length+' tucked</small>':"")+
    '</div>';
}
function marketPanel(){
  return '<section class="card"><div class="card-head"><div><h2>Birdfeeder and public tray</h2>'+
    '<p>Food dice persist; visible birds replenish after card-drawing turns.</p></div>'+
    '<span class="eyebrow">'+game.feeder.length+' dice left</span></div>'+
    '<div class="dice">'+game.feeder.map((face,i)=>
      '<span class="die" data-die="'+i+'">'+esc(game.mode==='physical'&&!game.physical?.feederKnown?'Not entered':foodName(face))+'</span>').join("")+
    (game.feeder.length?"":'<span class="meta">Refills on next food draw</span>')+
    '</div><h3 style="margin-top:13px">Face-up birds</h3>'+
    '<div class="tray">'+game.tray.map((id,i)=>
      '<div data-market="'+i+'">'+birdView({id},{compact:true})+'</div>').join("")+
    '</div><p class="meta">'+game.deck.length+' unrevealed deck cards · '+
    game.birdDiscard.length+' discarded</p></section>';
}
function activeMat(){
  const active=phaseOwner(),p=game.players[active];
  const resources=FOOD.map(f=>
    '<span class="resource">'+esc(foodName(f))+': <strong>'+p.food[f]+
    '</strong></span>').join("");
  const habitats=HABITATS.map(h=>{
    const row=p.habitats[h];
    return '<section class="habitat '+h+'" id="habitat-'+h+'">'+
      '<h3>'+habitatTitle(h)+' <span class="meta">'+row.length+'/5</span></h3>'+
      row.map((bird,i)=>birdView(bird)+
        (game.mode==="physical"?
          '<small class="meta">Bird '+(i+1)+' in '+h+'</small>':"")).join("")+
      Array.from({length:5-row.length},()=>
        '<div class="bird empty">Empty</div>').join("")+'</section>';
  }).join("");
  return '<section class="card"><div class="card-head"><div>'+
    '<h2>Player '+(active+1)+' board</h2>'+
    '<p>The three habitat rows; played birds persist across rounds.</p></div>'+
    '<span class="eyebrow">'+p.hand.length+' cards in hand</span></div>'+
    '<div class="resources">'+resources+'</div>'+
    '<div class="columns" style="margin-top:13px">'+habitats+'</div>'+
    '</section>';
}
function handPanel(){
  const owner=phaseOwner(),p=game.players[owner];
  const cards=p.hand.map(id=>birdView({id},{compact:true})).join("");
  return '<section class="card"><div class="card-head"><div><h2>Active player hand</h2>'+
    '<p>Only the active player’s known hand is displayed here.</p></div>'+
    '</div><div class="setup-birds">'+
    (cards||'<span class="meta">No bird cards</span>')+'</div></section>';
}
function goalPanel(){
  if(game.mode==='physical'&&!game.physical?.goalsKnown)return '<section class="card"><h2>Round goals</h2><p>Not entered yet.</p></section>';
  return '<section class="card"><div class="card-head"><h2>Round goals</h2>'+
    '<span class="eyebrow">'+(game.goalMode==="green"?"Competitive":"Personal")+'</span></div>'+
    '<div class="score-grid">'+game.goals.map((g,i)=>{
      const f=g.face;
      const desc=f.kind==="birds"?
        "Birds "+(f.habitat?"in "+f.habitat:"with "+f.nest+" nests")+
          (f.withEgg?" (with eggs)":""):
        f.kind==="eggs"?
          "Eggs "+(f.habitat?"in "+f.habitat:"in "+f.nest+" nests"):
        f.kind==="eggSets"?"Egg sets across habitats":"Total birds";
      const value=game.players.map(p=>goalQuantity(p,f));
      return '<div class="score-card '+(game.round===i+1?"current":"")+'">'+
        '<strong>Round '+(i+1)+'</strong><div class="meta">'+
        esc(desc)+'</div><div class="meta">'+
        value.map((n,j)=>'P'+(j+1)+': '+n).join(' · ')+'</div>'+
        '</div>';
    }).join("")+'</div></section>';
}
function statusPanel(){
  const context=game.phase==="power"?game.pending[0]:null;
  const label=titleForState();
  return '<div class="banner"><strong>'+esc(label)+'</strong> · '+
    (game.phase==="setup"?
      "Keep birds, discard one distinct food per bird, and choose one bonus card.":
     game.phase==="power"?
      "Resolve or skip "+esc(BIRDS[context.birdId].name)+
      " ("+context.timing+" power).":
     game.phase==="gameover"?
      "Final scores include bonus goals, tucked cards, cached food, eggs, and round goals.":
      "Choose a complete action. Suggestions never play automatically.")+
    '</div>';
}
function setupPanel(){
  const p=game.players[game.currentPlayer];
  if(bonusChoice===null||!p.bonusOffer.includes(bonusChoice))
    bonusChoice=p.bonusOffer[0];
  const hand=p.hand.map((id,slot)=>
    '<label class="check-card"><span>Card '+(slot+1)+'</span><input type="checkbox" data-action="keep-card" '+
      'value="'+id+'"'+(keep.has(id)?" checked":"")+'>'+
      birdView({id},{compact:true})+'</label>').join("");
  const options=p.bonusOffer.map(id=>'<label><input type="radio" name="starting-bonus" '+
    'data-action="bonus" value="'+id+'"'+(bonusChoice===id?" checked":"")+'>'+
    esc(knownCard(game,id,true)?BONUSES[id].name:'Unknown private bonus '+(p.bonusOffer.indexOf(id)+1))+'</label>').join("");
  const food=FOOD.map(f=>'<label><input type="checkbox" data-action="discard-food" '+
    'value="'+f+'"'+(discardFood.has(f)?" checked":"")+'>'+
    esc(foodName(f))+'</label>').join("");
  return '<section class="card"><div class="card-head"><h2>Starting choices</h2>'+
    '<span class="eyebrow">Player '+(game.currentPlayer+1)+'</span></div>'+
    '<h3>Bird cards to keep</h3><div class="setup-birds">'+hand+'</div>'+
    '<h3 style="margin-top:15px">Choose one bonus objective</h3>'+
    '<div class="choose">'+options+'</div>'+
    '<h3>Discard starting food (one per kept bird)</h3>'+
    '<div class="choose">'+food+'</div>'+
    '<p class="feedback">Keeping '+keep.size+' birds · Discarding '+
      discardFood.size+' food tokens.</p>'+
    button("confirm-setup","Confirm setup for this player","primary")+
    (isAI()? ' '+button("play-best","Use analyzed setup choice","") : "")+
    '</section>';
}
function powerPanel(){
  const context=game.pending[0];
  return '<section class="card"><div class="card-head"><div><h2>Optional bird power</h2>'+
    '<p>'+esc(BIRDS[context.birdId].name)+' · '+
    esc(powerDescription(context.code))+'</p></div>'+
    '<span class="eyebrow">'+context.timing+'</span></div>'+
    '<div class="action-list">'+options.map((o,i)=>
      button("choose-option",esc(o.label),"",'data-index="'+i+'"')).join("")+
    '</div><p class="risk">Some unusual chained powers are still under validation. '+
    'Skip is never silently substituted for a chosen effect.</p></section>';
}
function actionPanel(){
  const categories=["Bird","Food","Eggs","Cards"],groups=[];
  for(const category of categories){
    const arr=options.map((x,i)=>({...x,i})).filter(x=>x.category===category);
    const visible=arr.slice(0,9);
    const remaining=arr.slice(9);
    const html='<section class="action-group"><h3>'+category+'</h3>'+
      '<div class="action-list">'+visible.map(x=>
        button("choose-option",esc(x.label),"",'data-index="'+x.i+'"')).join("")+
      (remaining.length?'<details><summary class="meta">'+remaining.length+' more</summary>'+
        remaining.map(x=>button("choose-option",esc(x.label),"small",
          'data-index="'+x.i+'"')).join("")+'</details>':"")+
      '</div></section>';
    groups.push(html);
  }
  return '<section class="card"><div class="card-head"><div><h2>Take an action</h2>'+
    '<p>Choose an action below. Play costs are checked.</p>'+
    '</div><span class="eyebrow">Turn '+game.turn+'</span></div>'+
    '<div class="action-grid">'+groups.join("")+'</div>'+
    '<p class="meta" style="margin-top:10px">Each action is committed when selected. '+
    'Undo restores the entire prior position.</p></section>';
}
function observationPanel(){
  if(game.mode!=="physical")return "";
  const zone=observation.zone,player=observation.player;
  const bonus=["bonusOffer","bonusOwned","pendingBonus"].includes(zone);
  const arr=zone==='tray'?game.tray:zone==='bonusOwned'?game.players[player].bonuses:
    zone==='pendingBird'||zone==='pendingBonus'?game.pending.find(p=>p.owner===player&&
      p.code===(zone==='pendingBonus'?1013:1008))?.event.cards??[]:game.players[player][zone]??[];
  const catalog=bonus?BONUSES:BIRDS;
  const zoneNames=[
    ["hand","Player hand"],["tray","Face-up tray"],
    ["bonusOffer","Starting bonus offer"],["bonusOwned","Owned bonus"],
    ["pendingBird","Pending bird offer"],["pendingBonus","Pending bonus offer"]
  ];
  const list=catalog.map(x=>'<option value="'+x.id+'"'+
    (x.id===observation.cardId?" selected":"")+'>'+esc(x.name)+'</option>').join("");
  const slots=arr.map((id,i)=>'<option value="'+i+'"'+
    (i===observation.slot?" selected":"")+'>'+ (i+1)+
    '. '+esc(knownCard(game,id,bonus)?catalog[id]?.name??"Unknown":"Unknown / private")+'</option>').join("");
  return '<section class="card"><details><summary>Record physical observations and corrections</summary>'+
    '<p class="meta">Record a card in its hand or offer slot when you learn its identity. '+
      'Other private cards may stay unknown. For an opponent playing a bird, '+
      'enter that bird in an unknown hand slot, then record the play.</p>'+
    '<div class="toolbar"><label>Zone <select id="obs-zone">'+
      zoneNames.map(([value,label])=>'<option value="'+value+'"'+
        (zone===value?" selected":"")+'>'+label+'</option>').join("")+
    '</select></label><label>Player <select id="obs-player">'+
      game.players.map((_,i)=>'<option value="'+i+'"'+(player===i?" selected":"")+
        '>P'+(i+1)+'</option>').join("")+'</select></label></div>'+
    '<div class="toolbar"><label>Slot <select id="obs-slot">'+slots+'</select></label>'+
      '<label>Observed card <select id="obs-card">'+list+'</select></label>'+
      button("observe-card","Record this card","small primary")+'</div>'+
    '<div class="toolbar"><label>Food <select id="obs-food">'+
      FOOD.map(f=>'<option value="'+f+'">'+esc(foodName(f))+'</option>').join("")+
      '</select></label><label>Count <input id="obs-count" type="number" min="0" max="99" value="1"></label>'+
      button("observe-food","Correct food count","small")+'</div>'+
    '<p class="meta">Setup can be recorded by card slot and food discarded without '+
      'revealing private cards. Enter pending offers here if their owner wants advice.</p></details></section>';
}
function historyPanel(){
  const recent=history.slice(Math.max(0,history.length-35));
  const offset=history.length-recent.length;
  return '<section class="card"><div class="card-head"><h2>Recorded game</h2>'+
    '<span class="meta">'+(index+1)+' of '+history.length+' states</span></div>'+
    '<div class="toolbar">'+button("undo","↶ Undo","small",index?"":"disabled")+
    button("redo","↷ Redo","small",index<history.length-1?"":"disabled")+
    button("export","Export JSON","small")+button("import","Import JSON","small")+
    '<input id="import-file" class="hidden" type="file" accept=".json,application/json">'+
    '</div><ol class="timeline">'+recent.map((event,i)=>{
      const idx=i+offset;
      return '<li class="'+(index===idx?"current":"")+'">'+
        '<span>'+idx+'</span>'+button("jump",esc(event.label),"",
          'data-index="'+idx+'"')+'</li>';
    }).reverse().join("")+'</ol></section>';
}
function rulesPanel(){
  return '<section class="card"><details><summary>How to play</summary>'+
    '<p>Players build three rows of birds over four rounds. Each turn spends one '+
    'action cube to play a bird, gain food, lay eggs, or draw bird cards.</p>'+
    '<ul class="rule-list"><li>Initial bird cards kept cost one starting food each.</li>'+
    '<li>Playing birds also costs eggs from the second habitat column onward.</li>'+
    '<li>Brown powers activate right-to-left after the matching habitat action.</li>'+
    '<li>White powers trigger on playing the bird; pink powers react to opponents.</li>'+
    '<li>Players take 8, then 7, then 6, then 5 turns per round.</li>'+
    '<li>Score birds, bonuses, round goals, eggs, cached food and tucked cards.</li></ul>'+
    '<p><a href="https://stonemaiergames.com/games/wingspan/rules/" '+
    'target="_blank" rel="noopener">Publisher rules and updates ↗</a></p>'+
    '</details></section>';
}
function insightPanel(){
  const blocked=analysisBlocker(game);
  if(blocked)return '<div class="recommendation" id="analysis-blocked">'+esc(blocked)+'</div>';
  const c=analysis?.candidates??[];
  const best=c[0];
  const summary=best?
    '<div class="recommendation"><span class="eyebrow">Current leading candidate</span>'+
    '<strong>'+esc(best.label)+'</strong>'+
    '<p>Sampled utility '+(best.sum/Math.max(1,best.visits)).toFixed(2)+
    ' · '+pretty(best.visits)+' simulations. Not a win percentage.</p>'+
    button("pin-best","Highlight candidate","small")+' '+
    (game.mode==="physical"?
      '<span class="meta">Record real tabletop actions manually; new draws and rolls ask for actual results.</span>':
      button("record-best","Record suggested action","small primary"))+'</div>':
    '<div class="recommendation">Evaluating candidate actions…</div>';
  const stats='<div class="stats">'+
    '<div class="stat"><div class="meta">Samples</div><div class="value">'+
      pretty(analysis?.iterations??0)+'</div></div>'+
    '<div class="stat"><div class="meta">Samples / sec</div><div class="value">'+
      pretty(analysis?.elapsed>0?
        analysis.iterations/(analysis.elapsed/1000):0)+'</div></div>'+
    '<div class="stat"><div class="meta">Candidates</div><div class="value">'+
      pretty(analysis?.alternatives??options.length)+'</div></div></div>';
  const rows=c.slice(0,view==="analysis"?55:12).map((v,i)=>{
    const id=options.findIndex(x=>JSON.stringify(x.action)===JSON.stringify(v.action));
    const mean=v.visits?v.sum/v.visits:0;
    return '<tr data-index="'+id+'" class="'+
      (pinned===id?"selected":"")+'"><td>'+
      button("pin-option",(i+1)+'. '+esc(v.label),"",
        'data-index="'+id+'"')+'</td>'+
      '<td>'+esc(v.category)+'</td>'+
      '<td class="numeric">'+mean.toFixed(2)+'</td>'+
      '<td class="numeric">'+pretty(v.visits)+'</td></tr>';
  }).join("");
  const table='<div class="table-scroll"><table><thead><tr><th>Candidate action</th>'+
    '<th>Type</th><th class="numeric">Utility</th><th class="numeric">Samples</th></tr>'+
    '</thead><tbody>'+ (rows||'<tr><td colspan="4">Waiting for samples</td></tr>')+
    '</tbody></table></div>';
  return '<div id="analysis-content">'+summary+stats+table+
    '<p class="meta">Simulation samples represent possible unseen cards rather '+
    'than the hidden deck actually in play. Utility is not a calibrated score or '+
    'winning chance. The planning engine resets after a committed move.</p></div>';
}
function analysisPanel(){
  return '<section class="card"><div class="card-head"><div>'+
    '<h2>Public-information analysis</h2>'+
    '<p>'+(searchMethod==="belief-rollout"?
      "Hidden-world game rollouts with simulated opponent decisions.":
      "Fast sampled action-utility baseline.")+'</p></div>'+
    '<span class="eyebrow" id="analysis-status">'+
      (game.phase==="gameover"?"Finished":analysisBlocker(game)?"Needs observations":analysisEnabled?"Analyzing":"Paused")+
      '</span></div><div class="toolbar">'+
    '<label class="meta" for="search-method">Method</label>'+
    '<select id="search-method" aria-label="Analysis method">'+
    '<option value="heuristic"'+(searchMethod==="heuristic"?" selected":"")+
      '>Heuristic samples</option>'+
    '<option value="belief-rollout"'+(searchMethod==="belief-rollout"?" selected":"")+
      '>Hidden-world rollouts</option></select>'+
    '<details class="method-help"><summary title="Heuristic samples estimate action value using scoring features and sampled unseen outcomes. Hidden-world rollouts simulate short continuations in plausible hidden worlds, then assess points, useful resources, engines, and goals. Neither sees opponents hands or the hidden deck order; estimates are policy dependent.">About these methods</summary><p>Heuristic samples estimate action value using scoring features and sampled unseen outcomes. Hidden-world rollouts simulate short continuations in plausible hidden worlds, then assess points, useful resources, engines, and goals. Neither sees opponents hands or the hidden deck order; estimates are policy dependent.</p></details>'+
    '<label class="meta" for="worker-count">Workers</label>'+
    '<select id="worker-count">'+Array.from({length:MAX_WORKERS},(_,i)=>
      '<option value="'+(i+1)+'"'+(workerCount===i+1?" selected":"")+
      '>'+(i+1)+'</option>').join("")+'</select>'+
    button("toggle-analysis",analysisEnabled?"Pause":"Resume","small")+
    (isAI()&&game.phase!=="gameover"?
      button("play-best","Play Best Move","small primary",
        analysis?.candidates?.length?"":"disabled"):"")+
    '</div>'+insightPanel()+'</section>';
}
function render(){
  options=observedCandidates(game);
  const waiting=game.mode==='physical'&&(game.pendingObservation||missingPublic(game).length);
  const visible=waiting?'':game.phase==="setup"?setupPanel():
    game.phase==="power"?powerPanel():
    game.phase==="play"?actionPanel():"";
  root.innerHTML='<div class="shell">'+setupHeader()+
    '<nav class="tabs">'+
    button("view","Companion",view==="companion"?"active":"",
      'data-view="companion"')+
    button("view","Analysis",view==="analysis"?"active":"",
      'data-view="analysis"')+
    '<span class="meta">Round '+game.round+' · '+
      (game.mode==="physical"?"Physical tracking":"Digital game")+'</span></nav>'+
    (notification?'<div role="alert" class="banner error">'+esc(notification)+'</div>':"")+
    statusPanel()+'<div class="layout"><main>'+
      physicalPanel(game)+marketPanel()+activeMat()+visible+(waiting?"":advancedEditor(knownChoiceState(game),{
        kind:advancedKind,birdId:advancedBirdId,habitat:advancedHabitat
      }))+handPanel()+(game.pendingObservation?"":observationPanel())+
    '</main><aside>'+analysisPanel()+scorePanel()+goalPanel()+
      historyPanel()+rulesPanel()+'</aside></div></div>';
  highlightPinned();
}
function candidateForHighlight(){
  const idx=hovered>=0?hovered:pinned;
  return idx>=0?options[idx]?.action:null;
}
function highlightPinned(){
  root.querySelectorAll(".highlight").forEach(n=>n.classList.remove("highlight"));
  const a=candidateForHighlight();
  if(!a)return;
  if(a.type==="playBird"){
    root.querySelector('[data-bird-id="'+a.birdId+'"]')?.classList.add("highlight");
    root.querySelector('#habitat-'+a.habitat)?.classList.add("highlight");
  }else if(a.type==="gainFood"){
    root.querySelector('[data-die="'+(a.dice?.[0]?.index??0)+'"]')?.
      classList.add("highlight");
  }else if(a.type==="drawBirds"){
    const idx=a.draws?.find(x=>typeof x==="number");
    if(idx!==undefined)root.querySelector('[data-market="'+idx+'"]')?.
      classList.add("highlight");
  }else if(a.type==="layEggs"){
    root.querySelector('#habitat-'+(a.targets?.[0]?.habitat??"grassland"))?.
      classList.add("highlight");
  }
}
function refreshAnalysis(){
  const panel=root.querySelector("#analysis-content");
  const status=root.querySelector("#analysis-status");
  if(!panel||!status)return;
  panel.outerHTML=insightPanel();
  status.textContent=game.phase==="gameover"?"Finished":
    analysisEnabled?"Analyzing":"Paused";
  const play=root.querySelector('button[data-action="play-best"]');
  if(play)play.disabled=!analysis?.candidates?.length;
  highlightPinned();
}
function combineWorkerResults(){
  const map=new Map();
  let iterations=0,elapsed=0,actor=phaseOwner();
  for(const part of partResults.values()){
    iterations+=part.iterations;
    elapsed=Math.max(elapsed,part.elapsedMs);
    actor=part.actor;
    for(const entry of part.candidates){
      const key=JSON.stringify(entry.action);
      const value=map.get(key)??{action:entry.action,
        label:entry.label,category:entry.category,visits:0,sum:0};
      value.visits+=entry.visits;value.sum+=entry.sum;
      map.set(key,value);
    }
  }
  const candidates=[...map.values()].sort((a,b)=>
    (b.visits?b.sum/b.visits:-Infinity)-(a.visits?a.sum/a.visits:-Infinity));
  analysis={iterations,elapsed,actor,candidates,
    alternatives:options.length};
}
function stopAnalysis(){
  generation++;
  for(const w of workers)w.terminate();
  workers=[];partResults.clear();analysis=null;pinned=-1;hovered=-1;
}
function startAnalysis(){
  stopAnalysis();
  if(game.phase==="gameover"||!options.length||analysisBlocker(game)){
    refreshAnalysis();return;
  }
  if(typeof Worker==="undefined"){
    notification="This browser cannot run the analysis workers; recording is still available.";
    render();return;
  }
  const viewer=phaseOwner();
  const obs=publicObservation(game,viewer);
  const token=generation;
  for(let i=0;i<workerCount;i++){
    const w=new Worker(new URL("./worker.js",import.meta.url),{type:"module"});
    w.onmessage=e=>{
      const result=e.data;
      if(token!==generation||result.generation!==generation)return;
      if(result.type==="error"){
        notification="Analysis error: "+result.message;render();return;
      }
      if(result.type==="progress"){
        partResults.set(i,result);
        combineWorkerResults();
        refreshAnalysis();
      }
    };
    w.onerror=e=>{
      console.error(e);
      notification="Analysis worker could not start; manual actions remain available.";
      render();
    };
    workers.push(w);
    w.postMessage({type:"start",generation:token,observation:obs,
      actions:options,seed:(Math.random()*0x100000000)>>>0,
      method:searchMethod,horizon:4,leafEvaluator:"practical-combined",
      running:analysisEnabled,chunk:searchMethod==="belief-rollout"?1:24});
  }
  refreshAnalysis();
}
function save(){
  try{
    localStorage.setItem(KEY,JSON.stringify({
      version:1,history,index,seats,view,analysisEnabled,workerCount,searchMethod
    }));
  }catch(e){
    console.warn("Wingspan autosave failed",e);
    notification="Browser storage is unavailable; export your game before leaving.";
  }
}
function decodeSession(data,format){
  return readSession(data,{format,playerCount:s=>s.players.length,validateState:s=>{
    assertValid(s);
    if(s.mode==='physical'&&!s.physical)throw Error('Legacy physical session: start a new observation session');
  }});
}
function restore(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return;
    const d=JSON.parse(raw);
    const decoded=decodeSession(d);
    ({history,index,game,seats}=decoded);
    view=d.view==="analysis"?"analysis":"companion";
    analysisEnabled=d.analysisEnabled!==false;
    searchMethod=d.searchMethod==="heuristic"?"heuristic":"belief-rollout";
    workerCount=boundedInteger(d.workerCount,workerCount,1,MAX_WORKERS);
  }catch(e){console.warn("Invalid Wingspan save",e);}
}
function resetSelections(){
  keep=new Set();discardFood=new Set();bonusChoice=null;
  pinned=-1;hovered=-1;notification="";
}
function commit(next,label){
  assertValid(next);
  history=history.slice(0,index+1);
  history.push({state:next,label});
  index=history.length-1;game=next;
  resetSelections();save();render();startAnalysis();
}
function perform(action,label){
  const actor=phaseOwner();
  if(game.pendingObservation)throw Error('Finish the pending tabletop result first');
  commit(game.mode==='physical'?recordPhysicalAction(game,action):applyAction(game,action),
    label??("P"+(actor+1)+" · "+(action.type==="playBird"?
      BIRDS[action.birdId].name:action.type)));
}
function goTo(n){
  if(!Number.isInteger(n)||n<0||n>=history.length)return;
  index=n;game=history[index].state;
  resetSelections();save();render();startAnalysis();
}
function changePause(){
  analysisEnabled=!analysisEnabled;
  save();render();
  if(game.phase==="gameover")return;
  if(!workers.length){startAnalysis();return;}
  for(const w of workers)w.postMessage({
    type:analysisEnabled?"resume":"pause",generation
  });
}
function newSession(){
  const count=Number(root.querySelector("#players").value);
  const starter=Math.min(Number(root.querySelector("#starter").value),count-1);
  const mode=root.querySelector("#mode").value;
  const goalMode=root.querySelector("#goal-mode").value;
  game=newGame({players:count,starter,mode,goalMode,
    seed:(Math.random()*0x100000000)>>>0});
  seats=game.players.map(()=>"human");
  history=[{state:game,label:"New Wingspan session"}];index=0;
  resetSelections();save();render();startAnalysis();
}
function exportGame(){
  const d={format:"board-game-ai-wingspan",version:1,history,index,seats};
  const blob=new Blob([JSON.stringify(d,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="wingspan-session.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),0);
}
async function importGame(file){
  const data=JSON.parse(await file.text());
  const decoded=decodeSession(data,'board-game-ai-wingspan');
  ({history,index,game,seats}=decoded);
  resetSelections();save();render();startAnalysis();
}
function getCurrentAction(idx){
  const i=Number(idx);
  if(!Number.isInteger(i)||i<0||i>=options.length)throw Error("Unknown candidate");
  return options[i].action;
}
function acceptSetup(){
  const p=game.players[game.currentPlayer];
  const birds=[...keep];
  const foods=[...discardFood];
  if(foods.length!==birds.length)throw Error("Discard exactly one food per kept bird");
  perform({type:"setup",keep:birds,bonusId:bonusChoice??p.bonusOffer[0],
    foodDiscard:foods},"Player "+(game.currentPlayer+1)+" · Starting selection");
}
function observedCard(){
  const zone=root.querySelector("#obs-zone")?.value??observation.zone;
  const player=Number(root.querySelector("#obs-player")?.value??observation.player);
  const slot=Number(root.querySelector("#obs-slot")?.value??observation.slot);
  const cardId=Number(root.querySelector("#obs-card")?.value??observation.cardId);
  const next=reconcileCard(game,{zone,player,index:slot,cardId});
  commit(next,"Observed "+(zone==="tray"?"market":zone)+" card");
}
function observedFood(){
  const player=Number(root.querySelector("#obs-player")?.value??observation.player);
  const food=root.querySelector("#obs-food")?.value??"seed";
  const count=Number(root.querySelector("#obs-count")?.value??0);
  const next=reconcileFood(game,{player,food,count});
  commit(next,"Corrected "+food+" · P"+(player+1));
}
root.addEventListener("click",e=>{
  const target=e.target.closest("button[data-action]");
  if(!target||target.disabled)return;
  const a=target.dataset.action;
  try{
    if(a==="new-game")newSession();
    else if(a==="view"){view=target.dataset.view;save();render();}
    else if(a==='answer-observation'){
      commit(answerObservation(game,readObservationAnswer(root,game.pendingObservation.request)),
        'Recorded tabletop result');
    }else if(a==='cancel-observation')commit(cancelObservation(game),'Canceled pending action');
    else if(a==='observe-tray'){
      let next=game;
      for(let i=0;i<game.tray.length;i++){
        const value=root.querySelector('#actual-tray-'+i).value;
        if(value==='')throw Error('Enter each face-up bird');
        next=reconcileCard(next,{zone:'tray',index:i,cardId:Number(value)});
      }
      commit(next,'Recorded face-up tray');
    }else if(a==='observe-feeder'){
      const faces=Array.from({length:5},(_,i)=>root.querySelector('#observed-die-'+i).value).filter(Boolean);
      if(!game.physical.feederKnown&&faces.length!==5)throw Error('Record all five starting feeder dice');
      commit(reconcileFeeder(game,faces),'Recorded feeder dice');
    }else if(a==='observe-goals'){
      const goals=Array.from({length:4},(_,i)=>{
        const value=root.querySelector('#actual-goal-'+i).value;
        if(!value)throw Error('Choose all four round goals');
        const [tile,side]=value.split(':').map(Number);return {tile,side};
      });
      commit(reconcileGoals(game,goals),'Recorded round goals');
    }
    else if(a==="confirm-setup")acceptSetup();
    else if(a==="advanced-commit"){
      const action=detailedAction(root,game);
      perform(action,"P"+(game.currentPlayer+1)+" · Detailed "+action.type);
    }
    else if(a==="choose-option"){
      const idx=Number(target.dataset.index);
      const option=options[idx];
      if(!option)throw Error("Action no longer available");
      perform(option.action,"P"+(game.currentPlayer+1)+" · "+option.label);
    }else if(a==="pin-option"){
      const i=Number(target.dataset.index);
      pinned=pinned===i?-1:i;
      refreshAnalysis();
    }else if(a==="pin-best"){
      const action=analysis?.candidates[0]?.action;
      pinned=options.findIndex(o=>JSON.stringify(o.action)===JSON.stringify(action));
      refreshAnalysis();
    }else if(a==="record-best"||a==="play-best"){
      const top=analysis?.candidates[0];
      if(top)perform(top.action,"P"+(game.currentPlayer+1)+" · "+top.label);
    }else if(a==="toggle-analysis")changePause();
    else if(a==="undo")goTo(index-1);
    else if(a==="redo")goTo(index+1);
    else if(a==="jump")goTo(Number(target.dataset.index));
    else if(a==="export")exportGame();
    else if(a==="import")root.querySelector("#import-file").click();
    else if(a==="observe-card")observedCard();
    else if(a==="observe-food")observedFood();
  }catch(error){notification=error.message;render();}
});
root.addEventListener("change",e=>{
  const t=e.target;
  try{
    if(t.id==="import-file"&&t.files?.length){
      importGame(t.files[0]).catch(error=>{notification=error.message;render();});
    } else if(t.dataset.action==="keep-card"){
      const id=Number(t.value);
      if(t.checked)keep.add(id);else keep.delete(id);
      render();
    }else if(t.dataset.action==="discard-food"){
      if(t.checked)discardFood.add(t.value);else discardFood.delete(t.value);
      render();
    }else if(t.dataset.action==="bonus"){
      bonusChoice=Number(t.value);render();
    }else if(t.dataset.action==="seat"){
      seats[Number(t.dataset.player)]=t.value;save();render();
    }else if(t.id==="search-method"){
      searchMethod=t.value==="belief-rollout"?"belief-rollout":"heuristic";
      save();render();startAnalysis();
    }else if(t.id==="worker-count"){
      workerCount=Math.min(MAX_WORKERS,Math.max(1,Number(t.value)));
      save();render();startAnalysis();
    }else if(t.id==="adv-kind"){
      advancedKind=t.value;render();
      const section=root.querySelector("#advanced-action-editor");
      if(section)section.open=true;
    }else if(t.id==="adv-bird"){
      advancedBirdId=Number(t.value);advancedHabitat=null;
      render();
      const section=root.querySelector("#advanced-action-editor");
      if(section)section.open=true;
    }else if(t.id==="adv-habitat"){
      advancedHabitat=t.value;render();
      const section=root.querySelector("#advanced-action-editor");
      if(section)section.open=true;
    }else if(t.id==="players"){
      const starter=root.querySelector("#starter");
      const n=Number(t.value);
      starter.innerHTML=Array.from({length:n},(_,i)=>
        '<option value="'+i+'">Start P'+(i+1)+'</option>').join("");
    }else if(t.id==="obs-zone"){
      observation.zone=t.value;observation.slot=0;observation.cardId=0;
      render();
    }else if(t.id==="obs-player"){
      observation.player=Number(t.value);observation.slot=0;render();
    }else if(t.id==="obs-card"){
      observation.cardId=Number(t.value);
    }else if(t.id==="obs-slot"){
      observation.slot=Number(t.value);
    }
  }catch(error){notification=error.message;render();}
});
root.addEventListener("pointermove",e=>{
  if(!["mouse","pen"].includes(e.pointerType))return;
  const row=e.target.closest("tr[data-index]");
  const next=row?Number(row.dataset.index):-1;
  if(hovered===next)return;
  hovered=next;highlightPinned();
});
root.addEventListener("pointerleave",()=>{
  hovered=-1;highlightPinned();
});
document.addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"){
    e.preventDefault();goTo(index+(e.shiftKey?1:-1));
  }
});
restore();render();startAnalysis();
