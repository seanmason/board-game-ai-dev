import {ALL_IDS,CARDS,COLORS,cardType} from './catalog.js';
import {clone,shuffle} from './core.js';
export function sampleWorld(obs,rng){
 for(let attempt=0;attempt<80;attempt++){
  try{
   const used=new Set([...obs.ownHand,...obs.expeditions.flatMap(p=>COLORS.flatMap(c=>p[c]))]);if(used.has(null))throw Error('Unknown actor hand');
   const discards=Object.fromEntries(COLORS.map(c=>[c,obs.memory.discards[c].slice()]));
   for(const c of COLORS){if(discards[c].length)discards[c][discards[c].length-1]=obs.visibleTops[c];for(const id of discards[c])if(id){if(used.has(id))throw Error('Conflicting remembered card');used.add(id);}}
   let pool=shuffle(ALL_IDS.filter(id=>!used.has(id)),rng);
   const take=predicate=>{const i=pool.findIndex(predicate);if(i<0)throw Error('No compatible card');return pool.splice(i,1)[0];};
   const hands=[[],[]];hands[obs.viewer]=obs.ownHand.slice();const other=1-obs.viewer;
   for(const t of obs.memory.knownHands[other])hands[other].push(take(id=>cardType(id)===t));
   for(const c of COLORS)for(let i=0;i<discards[c].length;i++)if(discards[c][i]===null)discards[c][i]=take(id=>CARDS[id].color===c);
   while(hands[other].length<obs.handCounts[other])hands[other].push(pool.pop());
   if(hands[other].some(id=>!id))throw Error('No compatible opponent hand');
   const lower=obs.deckCount??Math.max(1,obs.deckKnowledge.lower),upper=obs.deckCount??Math.min(pool.length,obs.deckKnowledge.upper);
   if(lower>upper||pool.length<lower)throw Error('Impossible deck count');const count=obs.deckCount??lower+Math.floor(rng()*(upper-lower+1)),extra=pool.length-count;
   for(let i=0;i<extra;i++){const id=take(id=>!obs.discardDepthKnown[CARDS[id].color]);discards[CARDS[id].color].unshift(id);}
   if(pool.length!==count)throw Error('Inventory mismatch');
   const memories=[0,1].map(viewer=>({knownHands:clone(obs.memory.knownHands),discards:Object.fromEntries(COLORS.map(c=>[c,discards[c].map((id,i)=>{
    if(i===discards[c].length-1)return id;
    if(viewer!==obs.viewer)return null;
    const offset=discards[c].length-obs.memory.discards[c].length;return i>=offset?obs.memory.discards[c][i-offset]:null;
   })]))}));
   return {version:1,edition:obs.edition,profile:obs.profile,players:2,mode:'digital',seed:0,round:obs.round,starter:obs.starter,current:obs.current,scores:obs.scores.slice(),roundScores:clone(obs.roundScores),adjudications:[],winners:[],turn:obs.turn,expeditions:clone(obs.expeditions),discards,visibleTops:clone(obs.visibleTops),discardDepthKnown:Object.fromEntries(COLORS.map(c=>[c,true])),discardSizes:Object.fromEntries(COLORS.map(c=>[c,discards[c].length])),hands,deck:pool,deckCount:count,deckKnowledge:{kind:'sampled',lower:count,upper:count},unseenCount:0,lastDiscard:obs.lastDiscard,pending:null,events:[],memories,phase:obs.phase,proposedStarter:null};
  }catch(error){if(attempt===79)throw Error('No compatible world: reconcile the hand, deck bounds or remembered pickups. '+error.message);}
 }
}
