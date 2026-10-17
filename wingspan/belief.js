/**
 * Sample a COMPLETE Wingspan game consistent with public information.
 *
 * Never receive an authoritative hidden game state here. Decks, facedown
 * tucked birds, opponent hands and private bonus objectives are filled
 * solely from the still-unseen inventory using a supplied random stream.
 * The result may be used with the real rules engine for bounded rollouts.
 */
import {BIRDS,BONUSES} from "./catalog.js";
import {HABITATS} from "./scoring.js";
import {assertValid} from "./core.js";

const fail=message=>{throw Error("Invalid Wingspan belief: "+message);};
function shuffled(items,rng){
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){
    const j=Math.min(i,Math.floor(rng()*(i+1)));
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }
  return copy;
}
function knownIds(complete,pending,kind){
  const known=new Set();
  const use=id=>{
    if(!Number.isInteger(id)||id<0||id>=complete)
      fail("unexpected revealed "+kind+" ID "+id);
    if(known.has(id))fail("duplicate public "+kind+" ID "+id);
    known.add(id);
  };
  pending.forEach(use);
  return known;
}
export function determinize(observation,rng=Math.random){
  if("deck" in observation||"bonusDeck" in observation||
     "rngState" in observation)
    fail("expected REDACTED public observation, not actual hidden game");
  const s=structuredClone(observation);
  const birdKnown=[];
  const bonusKnown=[];
  birdKnown.push(...(s.tray??[]),...(s.birdDiscard??[]));
  for(const p of s.players){
    birdKnown.push(...p.hand);
    bonusKnown.push(...p.bonuses,...p.bonusOffer);
    for(const habitat of HABITATS)
      for(const entry of p.habitats[habitat]){
        birdKnown.push(entry.id);
        birdKnown.push(...entry.tucked.filter(Number.isInteger));
      }
  }
  for(const effect of s.pending??[]){
    if(Array.isArray(effect.event?.cards)){
      if(effect.code===1008)birdKnown.push(...effect.event.cards);
      if(effect.code===1013)bonusKnown.push(...effect.event.cards);
    }
  }
  const seenBird=knownIds(BIRDS.length,birdKnown,"bird");
  const seenBonus=knownIds(BONUSES.length,bonusKnown,"bonus");
  let birds=shuffled(Array.from({length:BIRDS.length},(_,i)=>i)
    .filter(id=>!seenBird.has(id)),rng);
  let bonuses=shuffled(Array.from({length:BONUSES.length},(_,i)=>i)
    .filter(id=>!seenBonus.has(id)),rng);
  const takeBird=()=>{if(!birds.length)fail("not enough unobserved birds");return birds.pop();};
  const takeBonus=()=>{if(!bonuses.length)fail("not enough unobserved bonuses");return bonuses.pop();};
  for(const p of s.players){
    const unknownHand=Math.max(0,(p.handCount??p.hand.length)-p.hand.length);
    for(let i=0;i<unknownHand;i++)p.hand.push(takeBird());
    delete p.handCount;
    const bonusCount=Math.max(0,(p.privateBonusCount??p.bonuses.length)-p.bonuses.length);
    for(let i=0;i<bonusCount;i++)p.bonuses.push(takeBonus());
    delete p.privateBonusCount;
    const offered=Math.max(0,(p.bonusOfferCount??p.bonusOffer.length)-p.bonusOffer.length);
    for(let i=0;i<offered;i++)p.bonusOffer.push(takeBonus());
    delete p.bonusOfferCount;
    for(const habitat of HABITATS)
      for(const entry of p.habitats[habitat]){
        // Tucked cards' IDENTITIES are private even when the count is public.
        entry.tucked=entry.tucked.map(id=>
          Number.isInteger(id)?id:takeBird());
        delete entry.tuckedCount;
      }
  }
  for(const effect of s.pending??[]){
    if(effect.event?.cards===undefined&&effect.event?.cardCount){
      const count=effect.event.cardCount;
      effect.event.cards=Array.from({length:count},()=>
        effect.code===1013?takeBonus():takeBird());
      delete effect.event.cardCount;
    }
  }
  const discardCount=s.bonusDiscardCount??0;
  s.bonusDiscard=Array.from({length:discardCount},takeBonus);
  delete s.bonusDiscardCount;
  // Remaining unseen cards are the unknown decks, not invented extra cards.
  if(birds.length!==s.deckCount)fail(
    "unknown bird count "+birds.length+" != published deck count "+s.deckCount);
  if(bonuses.length!==s.bonusDeckCount)fail(
    "unknown bonus count "+bonuses.length+" != published deck count "+s.bonusDeckCount);
  s.deck=birds;
  s.bonusDeck=bonuses;
  delete s.deckCount;
  delete s.bonusDeckCount;
  s.rngState=Math.floor(rng()*0x100000000)>>>0;
  assertValid(s);
  return s;
}
