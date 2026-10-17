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
import {BIRDS,BONUSES} from "./catalog.js";
import {HABITATS,FOOD} from "./scoring.js";
import {cloneGame,assertValid} from "./core.js";
const check=(condition,message)=>{if(!condition)throw Error(message);};
function selectPool(s,zone,player){
  if(zone==="tray")return s.tray;
  if(zone==="hand")return s.players[player]?.hand;
  if(zone==="bonusOffer")return s.players[player]?.bonusOffer;
  if(zone==="bonusOwned")return s.players[player]?.bonuses;
  throw Error("Unknown observation zone");
}
function locate(s,id,bonus) {
  if(bonus){
    if(s.bonusDeck.includes(id))return [s.bonusDeck,s.bonusDeck.indexOf(id)];
    for(const p of s.players)for(const key of ["bonusOffer","bonuses"])
      if(p[key].includes(id))return [p[key],p[key].indexOf(id)];
    return null;
  }
  if(s.deck.includes(id))return [s.deck,s.deck.indexOf(id)];
  for(const p of s.players){
    if(p.hand.includes(id))return [p.hand,p.hand.indexOf(id)];
  }
  if(s.tray.includes(id))return [s.tray,s.tray.indexOf(id)];
  return null;
}
export function reconcileCard(state,{
  zone="hand",player=state.currentPlayer,index=0,cardId
}={}){
  check(state.mode==="physical","Observations are only available in physical mode");
  check(Number.isInteger(player)&&player>=0&&player<state.players.length,
    "Choose a valid player");
  const bonus=zone==="bonusOffer"||zone==="bonusOwned";
  const catalog=bonus?BONUSES:BIRDS;
  check(Number.isInteger(cardId)&&cardId>=0&&cardId<catalog.length,
    "Choose a known original base-game card");
  const s=cloneGame(state);
  const destination=selectPool(s,zone,player);
  check(Array.isArray(destination)&&Number.isInteger(index)&&
    index>=0&&index<destination.length,"Choose an existing card slot");
  if(destination[index]===cardId)return s;
  const source=locate(s,cardId,bonus);
  check(source!==null,
    "Observed card is already public/used, or not in this base-game deck");
  const [sourceList,sourceIndex]=source;
  const previous=destination[index];
  sourceList[sourceIndex]=previous;
  destination[index]=cardId;
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
  const s=cloneGame(state);
  s.players[player].food[food]=count;
  s.lastEvent={type:"observedFood",player,food,count};
  assertValid(s);
  return s;
}
export function reconcileEggs(state,{player=state.currentPlayer,habitat,index,count}={}){
  check(state.mode==="physical","Only physical observations may override recorded eggs");
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
