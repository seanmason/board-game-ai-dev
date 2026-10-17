import {BIRDS,BONUSES,GOAL_TILES} from './catalog.js';
import {FEEDER_FACES} from './core.js';
import {knownCard} from './observation-io.js';
import {missingPublic,analysisBlocker} from './observations.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(value,label,selected=false)=>`<option value="${value}"${selected?' selected':''}>${esc(label)}</option>`;
const faceName=f=>f==='dual'?'Invertebrate / seed':f;
const button=(action,label)=>`<button type="button" data-action="${action}" class="primary">${label}</button>`;
const cardSelect=(id,bonus=false,current=null,allowUnknown=false)=>`<select id="${id}" aria-label="${bonus?'Observed bonus':'Observed bird'}">`+
  option('','Select the actual card…',current===null)+
  (allowUnknown?option('unknown','Keep private / unknown'): '')+
  (bonus?BONUSES:BIRDS).map(c=>option(c.id,c.name,c.id===current)).join('')+'</select>';
const diceInputs=(id,count,faces=[])=>'<div class="toolbar">'+Array.from({length:count},(_,i)=>
  `<label>Die ${i+1} <select id="${id}-${i}">`+option('','Not entered / no die',!faces[i])+
    FEEDER_FACES.map(f=>option(f,faceName(f),faces[i]===f)).join('')+'</select></label>').join('')+'</div>';
function goalName(g){
  const type=g.kind==='eggSets'?'Egg sets across habitats':g.kind==='eggs'?'Eggs':'Birds';
  return type+(g.habitat?' in '+g.habitat:g.nest?' with '+g.nest+' nests':'')+(g.withEgg?' with eggs':'');
}
export function physicalPanel(s){
  if(s.mode!=='physical')return '';
  const pending=s.pendingObservation;
  if(pending){
    const r=pending.request;
    let fields='';
    if(r.kind==='bird'||r.kind==='bonus')fields=cardSelect('actual-card',r.kind==='bonus',null,r.allowUnknown);
    else if(r.kind==='feeder'||r.kind==='outsideDice')fields=diceInputs('actual-die',r.count);
    else if(r.kind==='foodChoice')fields='<label>Die taken <select id="actual-pick">'+option('','Select actual die…')+
      r.faces.flatMap((f,i)=>(f==='dual'?['invertebrate','seed']:[f]).map(food=>option(i+':'+food,'Die '+(i+1)+' · '+food))).join('')+'</select></label>';
    return '<section class="card" id="physical-prompt"><h2>Record tabletop result</h2><p>'+esc(r.label)+
      (Number.isInteger(r.owner)?' · Player '+(r.owner+1):'')+'</p>'+fields+
      '<div class="toolbar">'+button('answer-observation','Continue recording')+
      '<button data-action="cancel-observation" type="button">Cancel pending action</button></div>'+
      '<p class="meta">The action is pending. Cards and dice are never generated for the real table. '+
      'You can save or leave this page and continue later.</p></section>';
  }
  const missing=missingPublic(s);
  const tray='<div class="toolbar">'+s.tray.map((id,i)=>'<label>Tray '+(i+1)+' '+
    cardSelect('actual-tray-'+i,false,knownCard(s,id)?id:null)+'</label>').join('')+'</div>'+button('observe-tray','Record visible tray');
  const goals='<div class="toolbar">'+Array.from({length:4},(_,i)=>'<label>Round '+(i+1)+' <select id="actual-goal-'+i+'">'+
    option('','Select goal…',!s.physical?.goalsKnown)+
    GOAL_TILES.flatMap((tile,t)=>tile.map((g,side)=>option(t+':'+side,goalName(g),
      s.physical?.goalsKnown&&s.goals[i].tile===t&&s.goals[i].side===side))).join('')+'</select></label>').join('')+'</div>'+button('observe-goals','Record round goals');
  return '<section class="card" id="physical-observations"><h2>Record the real table</h2><p>'+esc(missing.length?
    'Still needed: '+missing.join(', '):'Public table recorded. New draws and rolls will prompt when needed.')+'</p>'+
    '<details'+(missing.length?' open':'')+'><summary>Public tray, feeder and goals</summary><h3>Face-up birds</h3>'+tray+
    '<h3>Birdfeeder</h3>'+diceInputs('observed-die',5,s.physical?.feederKnown?s.feeder:[])+button('observe-feeder','Record feeder')+
    (s.turn===0?'<h3>Round goals</h3>'+goals:'')+'</details>'+
    '<p class="meta">'+esc(analysisBlocker(s)||'Advice uses recorded facts and samples unseen cards.')+'</p></section>';
}
export function readObservationAnswer(root,request){
  const value=id=>root.querySelector('#'+id)?.value;
  if(request.kind==='bird'||request.kind==='bonus'){
    const v=value('actual-card');if(v==='unknown')return null;
    if(v==='')throw Error('Select the card you observed, or keep a private card unknown');
    return Number(v);
  }
  if(request.kind==='feeder'||request.kind==='outsideDice')return Array.from({length:request.count},(_,i)=>value('actual-die-'+i));
  if(request.kind==='foodChoice'){
    const v=value('actual-pick');if(!v)throw Error('Choose the actual die taken');
    const [index,food]=v.split(':');return {index:Number(index),food};
  }
  throw Error('Unknown observation request');
}
