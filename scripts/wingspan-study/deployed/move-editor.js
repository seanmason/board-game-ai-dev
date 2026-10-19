/**
 * Detailed human turn input for the four original Wingspan action rows.
 * This is intentionally separate from the narrower AI candidate generator:
 * humans must be able to state alternate legal food payments, egg targets,
 * market draws and optional habitat conversions.
 */
import {BIRDS} from "./catalog.js";
import {FOOD,HABITATS} from "./scoring.js";
import {EGG_COLUMN_COST,RESOURCE_PROGRESSION,findFoodPayment} from "./core.js";
const esc=s=>String(s).replace(/[&<>"']/g,c=>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const foodLabel=f=>({
  invertebrate:"Invertebrate",seed:"Seed",fish:"Fish",
  fruit:"Fruit",rodent:"Rodent"
})[f]??f;
const option=(value,label,selected=false)=>'<option value="'+esc(value)+'"'+
  (selected?' selected':'')+'>'+esc(label)+'</option>';
const extraHabitats={37:["forest"],38:["grassland"],44:["wetland"],51:["forest","grassland"]};
const entries=p=>HABITATS.flatMap(h=>p.habitats[h].map((b,i)=>
  ({habitat:h,index:i,bird:b,id:b.id})));
function asField(id,label,body) {
  return '<label class="advanced-field" for="'+id+'">'+esc(label)+' '+body+'</label>';
}
function paymentInputs(p,bird) {
  const suggestion=bird?findFoodPayment(p.food,bird):null;
  const costs=Object.fromEntries(FOOD.map(f=>[f,(suggestion??[]).filter(x=>x===f).length]));
  return '<div class="advanced-grid">'+FOOD.map(f=>asField("adv-food-"+f,
    foodLabel(f),'<input type="number" id="adv-food-'+f+
    '" min="0" max="'+p.food[f]+'" value="'+costs[f]+'">')).join("")+'</div>';
}
function eggInputs(p,prefix="adv-egg",zero=false){
  const all=entries(p);
  return all.length?'<div class="advanced-grid">'+all.map(({habitat,index,bird,id})=>
    asField(prefix+'-'+habitat+'-'+index,BIRDS[id].name+' ('+bird.eggs+
      '/'+BIRDS[id].eggs+' eggs)',
      '<input data-'+prefix+' type="number" min="0" max="'+
      (zero?BIRDS[id].eggs-bird.eggs:bird.eggs)+
      '" value="0" data-habitat="'+habitat+'" data-index="'+index+'">')).join("")+
    '</div>':'<p class="meta">No birds available in your habitats.</p>';
}
export function advancedEditor(s,{
  kind="gainFood",birdId=null,habitat=null
}={}){
  const extra=s.phase==='power'?extraHabitats[s.pending[0]?.code]:null;
  if(s.phase!=="play"&&!extra)return "";
  if(extra)kind='playBird';
  const p=s.players[extra?s.pending[0].owner:s.currentPlayer];
  const birds=p.hand.map(id=>BIRDS[id]).filter(b=>!extra||b.habitats.some(h=>extra.includes(h)));
  if(birdId===null||!birds.some(b=>b.id===birdId))birdId=birds[0]?.id??null;
  const b=birdId!==null?BIRDS[birdId]:null;
  const habitats=b?b.habitats.filter(h=>!extra||extra.includes(h)):[];
  if(b&&!habitats.includes(habitat))habitat=habitats[0];
  let html="";
  if(kind==="playBird"){
    const selectedBird=b?birdId:null,available=habitats;
    const row=b?p.habitats[habitat]:[];
    html='<div class="advanced-grid">'+
      asField("adv-bird","Bird",'<select id="adv-bird">'+
        birds.map(x=>option(x.id,x.name,x.id===selectedBird)).join("")+
      '</select>')+
      asField("adv-habitat","Habitat",'<select id="adv-habitat">'+
        available.map(h=>option(h,h,h===habitat)).join("")+
      '</select>')+'</div>'+
      '<h3>Food tokens to pay</h3>'+
      paymentInputs(p,b)+
      '<h3 style="margin-top:12px">Eggs to discard ('+
      (row?EGG_COLUMN_COST[row.length]??0:0)+' required)</h3>'+
      eggInputs(p);
    if(!birds.length)html='<p class="meta">No bird cards in hand; draw a bird first.</p>';
  } else if(kind==="gainFood"){
    const number=RESOURCE_PROGRESSION.forest[p.habitats.forest.length];
    html='<p class="meta">Select dice by their index in the remaining birdfeeder. '+
      'Each selected die is removed before the next index is read. If the '+
      'feeder empties, the next pick refills it. Mixed dice offer either '+
      'invertebrate or seed.</p>'+
      '<div class="advanced-grid">'+Array.from({length:number},(_,i)=>
        asField("adv-die-"+i,"Die "+(i+1),
          '<input type="number" id="adv-die-'+i+'" min="0" max="4" value="0">')+
        asField("adv-die-food-"+i,"Dual die choice",
          '<select id="adv-die-food-'+i+'">'+
          option("auto","Shown face / default")+
          option("invertebrate","Invertebrate")+option("seed","Seed")+
          '</select>')).join("")+'</div>'+
      asField("adv-reroll","Reroll identical dice before taking food",
        '<input type="checkbox" id="adv-reroll">')+
      (p.habitats.forest.length%2===1&&p.hand.length?
        asField("adv-extra","Spend bird for one additional die",
          '<input type="checkbox" id="adv-extra">')+
        asField("adv-discard","Bird to discard",
          '<select id="adv-discard">'+p.hand.map(id=>option(id,BIRDS[id].name)).join("")+
          '</select>')+
        asField("adv-die-extra","Extra die index",
          '<input type="number" id="adv-die-extra" min="0" max="4" value="0">')
        :"");
  } else if(kind==="layEggs"){
    const count=p.habitats.grassland.length;
    const amount=RESOURCE_PROGRESSION.grassland[count];
    html='<p class="meta">Distribute up to '+amount+
      ' base eggs among birds with remaining capacity. Excess production '+
      'may be lost.</p>'+eggInputs(p,"adv-target",true)+
      (count%2===1?
        asField("adv-extra","Pay food for one additional egg",
          '<input id="adv-extra" type="checkbox">')+
        asField("adv-extra-food","Food to pay",'<select id="adv-extra-food">'+
          FOOD.map(f=>option(f,foodLabel(f))).join("")+'</select>'):"");
  } else if(kind==="drawBirds"){
    const count=p.habitats.wetland.length;
    const number=RESOURCE_PROGRESSION.wetland[count];
    const possibilities=()=>option("deck","Top of hidden deck")+
      s.tray.map((id,i)=>option(String(i),
        "Face-up "+(i+1)+": "+BIRDS[id].name)).join("");
    html='<p class="meta">Select '+number+' bird draws, from the deck or '+
      'face-up tray. The tray refills at the end of the turn, not after '+
      'each pick. Do not select the same face-up slot twice.</p>'+
      '<div class="advanced-grid">'+Array.from({length:number},(_,i)=>
        asField("adv-draw-"+i,"Draw "+(i+1),
          '<select id="adv-draw-'+i+'">'+possibilities()+'</select>')).join("")+
      '</div>'+
      (count%2===1?
        asField("adv-extra","Spend egg for extra bird",
          '<input id="adv-extra" type="checkbox">')+
        asField("adv-extra-source","Egg source",
          '<select id="adv-extra-source">'+entries(p).filter(x=>x.bird.eggs>0)
            .map(x=>option(x.habitat+":"+x.index,BIRDS[x.id].name+
              " ("+x.bird.eggs+" eggs)")).join("")+'</select>')+
        asField("adv-extra-draw","Additional draw",
          '<select id="adv-extra-draw">'+possibilities()+'</select>')
        :"");
  }
  return '<section class="card"><details id="advanced-action-editor">'+
    '<summary>'+ (extra?'Detailed second-bird entry':'Detailed action entry (specific payments and targets)')+'</summary>'+
    '<p class="meta">Overrides the quick suggestions. The engine validates '+
      'the exact cost and targets you specify; invalid actions do not change the game.</p>'+
    '<div class="toolbar">'+asField("adv-kind","Action type",
      '<select id="adv-kind">'+[
        ["playBird","Play a bird"],["gainFood","Gain food"],
        ["layEggs","Lay eggs"],["drawBirds","Draw birds"]
      ].filter(([value])=>!extra||value==='playBird').map(([value,label])=>option(value,label,value===kind)).join("")+
      '</select>')+'</div><div id="advanced-inputs">'+html+'</div>'+
    '<div class="toolbar"><button type="button" class="primary" '+
      'data-action="advanced-commit">Confirm detailed action</button></div>'+
    '</details></section>';
}
const get=(root,id)=>root.querySelector("#"+id);
const amount=(root,id)=>Number(get(root,id)?.value??0);
const optional=(root,id)=>!!get(root,id)?.checked;
function parseTargets(root,selector){
  return [...root.querySelectorAll("["+selector+"]")].filter(el=>Number(el.value)>0)
    .map(el=>({habitat:el.dataset.habitat,index:Number(el.dataset.index),
      count:Number(el.value)}));
}
function drawChoice(root,id){
  const value=get(root,id)?.value;
  return value==="deck"?"deck":Number(value);
}
export function detailedAction(root,state){
  if(state.phase==='power'&&extraHabitats[state.pending[0]?.code]){
    const action=detailedAction(root,{...state,phase:'play',currentPlayer:state.pending[0].owner});
    if(action.type!=='playBird')throw Error('Choose a second bird');
    const {type,...choice}=action;
    return {type:'power',choice};
  }
  if(state.phase!=="play")throw Error("Detailed action requires a main turn or second-bird power");
  const p=state.players[state.currentPlayer];
  const kind=get(root,"adv-kind")?.value;
  if(kind==="playBird"){
    const birdId=amount(root,"adv-bird"),habitat=get(root,"adv-habitat")?.value;
    const payment=FOOD.flatMap(f=>Array.from({length:amount(root,"adv-food-"+f)},()=>f));
    return {type:"playBird",birdId,habitat,payment,
      eggs:parseTargets(root,"data-adv-egg")};
  }
  if(kind==="gainFood"){
    const count=RESOURCE_PROGRESSION.forest[p.habitats.forest.length];
    const dice=Array.from({length:count},(_,i)=>{
      const choice=get(root,"adv-die-food-"+i)?.value;
      return {index:amount(root,"adv-die-"+i),
        ...(choice&&choice!=="auto"?{food:choice}:{})};
    });
    const action={type:"gainFood",dice,reroll:optional(root,"adv-reroll")};
    if(optional(root,"adv-extra")){
      action.extra=true;
      action.discardCard=amount(root,"adv-discard");
      dice.push({index:amount(root,"adv-die-extra")});
    }
    return action;
  }
  if(kind==="layEggs"){
    const action={type:"layEggs",targets:parseTargets(root,"data-adv-target")};
    if(optional(root,"adv-extra")){
      action.extra=true;
      action.payment=get(root,"adv-extra-food")?.value;
    }
    return action;
  }
  if(kind==="drawBirds"){
    const count=RESOURCE_PROGRESSION.wetland[p.habitats.wetland.length];
    const draws=Array.from({length:count},(_,i)=>drawChoice(root,"adv-draw-"+i));
    const action={type:"drawBirds",draws};
    if(optional(root,"adv-extra")){
      const [habitat,index]=String(get(root,"adv-extra-source")?.value??"")
        .split(":");
      action.extra=true;
      action.eggSource={habitat,index:Number(index),count:1};
      draws.push(drawChoice(root,"adv-extra-draw"));
    }
    return action;
  }
  throw Error("Select one of the four main Wingspan actions");
}
