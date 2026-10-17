/** Physical knowledge and chance input. No DOM, RNG or rules-engine dependency. */
import {BIRDS,BONUSES} from './catalog.js';
import {HABITATS} from './scoring.js';
export const knownCard=(s,id,bonus=false)=>!s.physical ||
  s.physical[bonus?'knownBonuses':'knownBirds'].includes(id);
export function initializeKnowledge(s,{goalsKnown=false}={}) {
  s.physical={version:1,knownBirds:[],knownBonuses:[],feederKnown:false,goalsKnown};
  return s;
}
export function markKnown(s,id,bonus=false,known=true){
  if(!s.physical)return;
  const key=bonus?'knownBonuses':'knownBirds';
  s.physical[key]=s.physical[key].filter(x=>x!==id);
  if(known)s.physical[key].push(id);
}
function pools(s,bonus){
  if(bonus)return [s.bonusDeck,s.bonusDiscard,
    ...s.players.flatMap(p=>[p.bonusOffer,p.bonuses]),
    ...s.pending.filter(p=>p.code===1013).map(p=>p.event.cards)];
  return [s.deck,s.birdDiscard,s.tray,...s.players.flatMap(p=>[
    p.hand,...HABITATS.flatMap(h=>p.habitats[h].map(b=>b.tucked))]),
    ...s.pending.filter(p=>p.code===1008).map(p=>p.event.cards)];
}
/** Bind an actual card to a reserved slot without stealing another observed card. */
export function bindCard(s,destination,index,id,bonus=false){
  const catalog=bonus?BONUSES:BIRDS;
  if(!Number.isInteger(id)||!catalog[id])throw Error('Choose a base-game card');
  if(!Array.isArray(destination)||!Number.isInteger(index)||index<0||index>=destination.length)
    throw Error('Choose an existing card slot');
  const old=destination[index];
  if(old===id){markKnown(s,id,bonus);return;}
  const source=pools(s,bonus).find(pool=>pool.includes(id));
  const deck=bonus?s.bonusDeck:s.deck;
  if(!source || (source!==deck && knownCard(s,id,bonus)))
    throw Error('That card is already recorded elsewhere; undo/correct that observation first');
  source[source.indexOf(id)]=old;
  destination[index]=id;
  markKnown(s,old,bonus,false);
  markKnown(s,id,bonus);
}
export class ObservationRequired extends Error {
  constructor(request){super('Record the actual tabletop result');this.request=request;}
}
export function observationReader(answers=[]){
  let cursor=0;
  return {
    read(request){
      if(cursor>=answers.length)throw new ObservationRequired(request);
      return answers[cursor++];
    },
    finish(){if(cursor!==answers.length)throw Error('Unexpected extra observations');}
  };
}
