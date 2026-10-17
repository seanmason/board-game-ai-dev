/**
 * Physical-board observation reconciliation.
 *
 * Actual observed cards are authoritative. Unknown, privately dealt cards are
 * placeholders until observed; a user observation swaps a matching ID out of
 * the unknown pool into the chosen live hand/tray slot, preserving all 170
 * unique bird cards or 26 bonus cards.
 *
 * This deliberately does NOT infer unseen draw order or opponent hands.
 */
import {BIRDS,BONUSES,GOAL_TILES} from "./catalog.js";
import {HABITATS,FOOD} from "./scoring.js";
import {cloneGame,assertValid,applyAction,FEEDER_FACES} from "./core.js";
import {knownCard,bindCard,ObservationRequired,observationReader} from './observation-io.js';
import {candidateActions} from './actions.js';
const check=(condition,message)=>{if(!condition)throw Error(message);};
function selectPool(s,zone,player){
  if(zone==="tray")return s.tray;
  if(zone==="hand")return s.players[player]?.hand;
  if(zone==="bonusOffer")return s.players[player]?.bonusOffer;
  if(zone==="bonusOwned")return s.players[player]?.bonuses;
  if(zone==='pendingBird'||zone==='pendingBonus')return s.pending.find(p=>
    p.owner===player&&p.code===(zone==='pendingBonus'?1013:1008))?.event.cards;
  throw Error("Unknown observation zone");
}
export function reconcileCard(state,{
  zone="hand",player=state.currentPlayer,index=0,cardId
}={}){
  check(state.mode==="physical","Observations are only available in physical mode");
  check(Number.isInteger(player)&&player>=0&&player<state.players.length,
    "Choose a valid player");
  const bonus=["bonusOffer","bonusOwned","pendingBonus"].includes(zone);
  const catalog=bonus?BONUSES:BIRDS;
  check(Number.isInteger(cardId)&&cardId>=0&&cardId<catalog.length,
    "Choose a known original base-game card");
  check(!state.pendingObservation,'Complete or cancel the pending action first');
  const s=cloneGame(state);
  const destination=selectPool(s,zone,player);
  check(Array.isArray(destination)&&Number.isInteger(index)&&
    index>=0&&index<destination.length,"Choose an existing card slot");
  check(!s.pendingObservation,'Complete or cancel the pending action before correcting cards');
  bindCard(s,destination,index,cardId,bonus);
  s.lastEvent={type:"observedCard",zone,player,index,cardId};
  assertValid(s);
  return s;
}
export function reconcileFood(state,{player=state.currentPlayer,food,count}={}){
  check(state.mode==="physical","Only physical observations may override recorded food");
  check(Number.isInteger(player)&&player>=0&&player<state.players.length,
    "Invalid player");
  check(FOOD.includes(food)&&Number.isInteger(count)&&count>=0&&count<=99,
    "Invalid observed food count");
  check(!state.pendingObservation,'Complete or cancel the pending action first');
  const s=cloneGame(state);
  s.players[player].food[food]=count;
  s.lastEvent={type:"observedFood",player,food,count};
  assertValid(s);
  return s;
}
export function reconcileEggs(state,{player=state.currentPlayer,habitat,index,count}={}){
  check(state.mode==="physical","Only physical observations may override recorded eggs");
  check(!state.pendingObservation,'Complete or cancel the pending action first');
  const s=cloneGame(state);
  check(Number.isInteger(player)&&player>=0&&player<s.players.length,
    "Invalid player");
  check(HABITATS.includes(habitat)&&Number.isInteger(index)&&index>=0,
    "Invalid egg location");
  const bird=s.players[player].habitats[habitat][index];
  check(bird&&Number.isInteger(count)&&count>=0&&count<=BIRDS[bird.id].eggs,
    "Eggs exceed the bird's printed capacity");
  const difference=count-bird.eggs;
  check(s.eggSupply>=difference,"Insufficient game egg supply");
  bird.eggs=count;
  s.eggSupply-=difference;
  s.lastEvent={type:"observedEggs",player,habitat,index,count};
  assertValid(s);
  return s;
}

/** Initial public facts must be known before recording actions or searching. */
export function missingPublic(s){
  if(s.mode!=='physical')return [];
  if(!s.physical)return ['Start a new physical session to track unknown information'];
  const missing=[];
  if(!s.physical.goalsKnown)missing.push('four round goals');
  if(!s.physical.feederKnown)missing.push('birdfeeder dice');
  const n=s.tray.filter(id=>!knownCard(s,id)).length;
  if(n)missing.push(n+' face-up tray card'+(n===1?'':'s'));
  return missing;
}
export function analysisBlocker(s){
  if(s.mode!=='physical')return '';
  if(s.pendingObservation)return 'Finish recording the pending tabletop result.';
  const missing=missingPublic(s);
  if(missing.length)return 'Enter '+missing.join(', ')+'.';
  const owner=s.phase==='power'?s.pending[0].owner:s.currentPlayer;
  const p=s.players[owner];
  if(p.hand.some(id=>!knownCard(s,id))||
    [...p.bonuses,...p.bonusOffer].some(id=>!knownCard(s,id,true)))
    return 'Player '+(owner+1)+' has private cards not entered. Record moves manually, or enter their cards to enable advice.';
  if(s.pending.some(e=>e.owner===owner&&e.event?.cards?.some(id=>!knownCard(s,id,e.code===1013))))
    return 'Enter the active player’s pending card offer to enable advice.';
  return '';
}
/** A presentation-only view: unidentified private cards never become suggested moves. */
export function knownChoiceState(s){
  if(s.mode!=='physical')return s;
  const copy=cloneGame(s);
  for(const p of copy.players){
    p.hand=p.hand.filter(id=>knownCard(s,id));
    p.bonuses=p.bonuses.filter(id=>knownCard(s,id,true));
    p.bonusOffer=p.bonusOffer.filter(id=>knownCard(s,id,true));
  }
  for(const e of copy.pending){
    if(e.event?.cards)e.event.cards=e.event.cards.filter(id=>knownCard(s,id,e.code===1013));
  }
  return copy;
}
export function observedCandidates(s){
  if(s.mode!=='physical')return candidateActions(s);
  if(s.pendingObservation||missingPublic(s).length)return [];
  if(s.phase==='setup'&&analysisBlocker(s))return [];
  const owner=s.phase==='power'?s.pending[0].owner:s.currentPlayer;
  const p=s.players[owner];
  const names=[...p.hand.map((id,i)=>[id,false,'private hand card '+(i+1)]),
    ...p.bonusOffer.map((id,i)=>[id,true,'private bonus '+(i+1)]),
    ...(s.pending[0]?.event?.cards??[]).map((id,i)=>[id,s.pending[0].code===1013,'offer slot '+(i+1)])]
    .filter(([id,bonus])=>!knownCard(s,id,bonus));
  return candidateActions(s).filter(({action:a})=>
    (a.type!=='playBird'||knownCard(s,a.birdId))&&
    (a.choice?.birdId===undefined||knownCard(s,a.choice.birdId)))
    .map(o=>({...o,label:names.reduce((label,[id,bonus,slot])=>
      label.replaceAll((bonus?BONUSES:BIRDS)[id].name,slot),o.label)}));
}
export function reconcileFeeder(state,faces){
  check(state.mode==='physical'&&!state.pendingObservation,'Cannot correct feeder during an action');
  check(Array.isArray(faces)&&faces.length<=5&&faces.every(f=>FEEDER_FACES.includes(f)),
    'Enter up to five valid feeder faces');
  const s=cloneGame(state);s.feeder=[...faces];s.physical.feederKnown=true;
  assertValid(s);return s;
}
export function reconcileGoals(state,goals){
  check(state.mode==='physical'&&!state.pendingObservation,'Only physical goal observations are allowed');
  check(state.turn===0&&state.round===1,'Goals must be recorded before the first turn');
  check(Array.isArray(goals)&&goals.length===4&&new Set(goals.map(g=>g.tile)).size===4,
    'Choose four different physical goal tiles');
  check(goals.every(g=>Number.isInteger(g.tile)&&GOAL_TILES[g.tile]&&[0,1].includes(g.side)),
    'Invalid goal tile/side');
  const s=cloneGame(state);s.goals=goals.map(g=>({...g,face:GOAL_TILES[g.tile][g.side]}));
  s.physical.goalsKnown=true;assertValid(s);return s;
}
export function recordPhysicalAction(state,action,answers=[]){
  check(state.mode==='physical'&&state.physical,'Start a physical observation session first');
  check(!missingPublic(state).length,'Record the public tray, feeder and round goals first');
  if(action.type==='playBird')check(knownCard(state,action.birdId),'Identify the bird before playing it');
  if(action.choice?.birdId!==undefined)check(knownCard(state,action.choice.birdId),'Identify the bird before playing it');
  const base=cloneGame(state);delete base.pendingObservation;
  // The live state is replaced only when all chance outcomes are supplied.
  try{
    return applyAction(base,action,{observations:observationReader(answers)});
  }catch(error){
    if(!(error instanceof ObservationRequired))throw error;
    base.pendingObservation={action:structuredClone(action),answers:structuredClone(answers),
      request:error.request};
    return base;
  }
}
export function answerObservation(state,answer){
  const pending=state.pendingObservation;
  check(!!pending,'No tabletop result is waiting');
  return recordPhysicalAction(state,pending.action,[...pending.answers,answer]);
}
export function cancelObservation(state){
  const s=cloneGame(state);delete s.pendingObservation;return s;
}
