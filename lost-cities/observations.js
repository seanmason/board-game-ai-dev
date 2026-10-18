import {CARDS,ALL_IDS,COLORS,cardType} from './catalog.js';
import {clone,assertValid,allCards,legalActions,placeCard,drawCard,chooseStarter,endRound} from './core.js';
import {actionKey} from './actions.js';
const multiset=a=>a.reduce((m,t)=>(m[t]=(m[t]??0)+1,m),{});
export function publicSnapshot(s){return {version:1,edition:s.edition,profile:s.profile,players:2,round:s.round,current:s.current,phase:s.phase,turn:s.turn,expeditions:clone(s.expeditions),visibleTops:clone(s.visibleTops),discardSizes:clone(s.discardSizes),discardDepthKnown:clone(s.discardDepthKnown),deckCount:s.deckCount,deckKnowledge:clone(s.deckKnowledge),lastDiscard:s.lastDiscard,handCounts:[0,1].map(p=>(s.phase==='draw'||s.phase==='pending-observation')&&p===s.current?7:8),scores:s.scores.slice(),roundScores:clone(s.roundScores),winners:s.winners.slice(),proposedStarter:s.proposedStarter};}
export function publicObservation(s,viewer){if(![0,1].includes(viewer))throw Error('Invalid viewer');return {...publicSnapshot(s),viewer,phase:s.phase==='pending-observation'?'draw':s.phase,ownHand:s.hands[viewer].slice(),memory:clone(s.memories[viewer]),starter:s.starter};}
export function analysisBlocker(s,viewer=s.current){if(viewer!==s.current)return 'Advice belongs to the active player. Pass the private view to that player.';if(!['place','draw'].includes(s.phase))return 'Finish the pending observation or round setup first.';if(s.hands[viewer].includes(null))return 'Enter the active player’s actual hand. Opponent hands may stay unknown.';return '';}
export function recordPhysicalAction(state,a){
 if(state.mode!=='physical')throw Error('Not a physical table');assertValid(state);const s=clone(state);
 if(a.type==='setup'){if(s.phase!=='setup')throw Error('Not awaiting setup');s.phase='place';}
 else if(a.type==='chooseStarter')chooseStarter(s,a);
 else if(a.type==='cancel'){if(!s.pending)throw Error('No unperformed draw');s.pending=null;s.phase='draw';}
 else{const legal=legalActions(s).find(b=>a.type==='draw'?actionKey(b)===actionKey(a):b.type===a.type&&cardType(b.cardId)===cardType(a.cardId));if(!legal)throw Error('Illegal actual action');if(a.type==='draw'){s.pending={source:a.source,performed:false};s.phase='pending-observation';}else placeCard(s,legal);}
 assertValid(s);return s;
}
function freeCard(s,id,used=new Set(allCards(s).filter(Boolean))){if(id===null)return null;if(!CARDS[id])throw Error('Invalid card');if(!used.has(id))return id;const alternate=ALL_IDS.find(c=>cardType(c)===cardType(id)&&!used.has(c));if(!alternate)throw Error('That card is already recorded elsewhere');return alternate;}
export function recordObservation(state,e){
 if(state.mode!=='physical')throw Error('Not a physical table');assertValid(state);let s=clone(state);
 if(e.type==='draw'){
  if(s.phase!=='pending-observation')throw Error('Choose and confirm a draw source first');const pending=s.pending;
  let cardId=e.cardId??null;if(pending.source==='deck'&&cardId)cardId=freeCard(s,cardId);
  let newTop=e.newTop;
  if(pending.source!=='deck'){
   const next=s.discards[pending.source].length>1?s.discards[pending.source].at(-2):null;
   if(next&&newTop!==undefined){if(cardType(next)!==cardType(newTop))throw Error('Exposed top contradicts the recorded pile');newTop=next;}
   else if(newTop)newTop=freeCard(s,newTop);
  }
  drawCard(s,{type:'draw',source:pending.source},{cardId,lastCard:e.lastCard,newTop});
 }else if(e.type==='hand'){
  const p=e.player;if(![0,1].includes(p)||!Array.isArray(e.cards)||e.cards.length!==s.hands[p].length||e.cards.some(id=>id!==null&&!CARDS[id]))throw Error('Enter the correct number of hand slots');if(s.pending)throw Error('Cancel the unperformed draw before correcting a hand');
  const old=s.hands[p],actual=multiset(e.cards.filter(Boolean).map(cardType)),prior=multiset(old.filter(Boolean).map(cardType));if(!e.correction&&Object.entries(prior).some(([t,n])=>(actual[t]??0)<n))throw Error('Use an explicit correction to replace a previously observed card');
  const used=new Set(allCards(s).filter(Boolean));for(const id of old)used.delete(id);const assigned=[];
  for(const id of e.cards){if(id===null){assigned.push(null);continue;}const same=old.find(c=>c&&cardType(c)===cardType(id)&&!assigned.includes(c)),chosen=same??freeCard(s,id,used);assigned.push(chosen);used.add(chosen);}
  s.hands[p]=assigned;if(e.correction){for(const m of s.memories)m.knownHands[p]=[];s.events.push({type:'handCorrection',observer:p,visibility:'private'});}
 }else if(e.type==='memory'){
  if(s.pending||![0,1].includes(e.observer)||![0,1].includes(e.holder)||!Array.isArray(e.types)||e.types.some(t=>!ALL_IDS.some(id=>cardType(id)===t)))throw Error('Invalid remembered public holdings');
  s.memories[e.observer].knownHands[e.holder]=e.types.slice();s.events.push({type:'holdingMemoryCorrection',observer:e.observer,holder:e.holder,provenance:'Explicitly entered remembered public pickups'});
 }else if(e.type==='deck'){
  if(s.pending)throw Error('Finish the pending draw before reconciling the pile');
  if(e.count===null){const lower=e.lower??1,upper=e.upper??s.unseenCount;if(!Number.isInteger(lower)||!Number.isInteger(upper)||lower<1||upper<lower||upper>s.unseenCount)throw Error('Invalid deck bounds');s.deckCount=null;s.deckKnowledge={kind:'unknown',lower,upper};}
  else{if(!Number.isInteger(e.count)||e.count<1||e.count>s.unseenCount)throw Error('Invalid agreed deck count');s.deckCount=e.count;s.deckKnowledge={kind:'agreed',lower:e.count,upper:e.count};}s.events.push({type:'deckReconciliation',knowledge:clone(s.deckKnowledge)});
 }else if(e.type==='table')s=tableCorrection(s,e);
 else throw Error('Unknown physical observation');assertValid(s);return s;
}
function tableCorrection(s,e){
 if(s.pending)throw Error('Cancel an unperformed draw before editing the table');
 if(![0,1].includes(e.current)||!['place','draw'].includes(e.phase)||!Number.isInteger(e.round)||e.round<1||e.round>3)throw Error('Invalid table phase or round');
 s.current=e.current;s.phase=e.phase;s.round=e.round;s.expeditions=clone(e.expeditions);s.discards=clone(e.discards);s.discardDepthKnown=clone(e.depthKnown);s.lastDiscard=null;s.pending=null;s.winners=[];s.proposedStarter=null;
 s.hands=[0,1].map(p=>Array(p===s.current&&s.phase==='draw'?7:8).fill(null));if(e.ownCards){if(![0,1].includes(e.viewer)||e.ownCards.length!==s.hands[e.viewer].length)throw Error('Wrong private hand size');s.hands[e.viewer]=e.ownCards.slice();}
 s.visibleTops=Object.fromEntries(COLORS.map(c=>[c,s.discards[c].at(-1)??null]));s.discardSizes=Object.fromEntries(COLORS.map(c=>[c,s.discardDepthKnown[c]?s.discards[c].length:null]));
 if(e.forbiddenColor){if(e.phase!=='draw'||!COLORS.includes(e.forbiddenColor)||!s.visibleTops[e.forbiddenColor])throw Error('Invalid just-discarded pile');s.lastDiscard=s.visibleTops[e.forbiddenColor];}
 s.deck=null;s.unseenCount=60-s.hands.flat().length-s.expeditions.flatMap(p=>COLORS.flatMap(c=>p[c])).length-COLORS.flatMap(c=>s.discards[c]).length;
 s.deckCount=e.deckCount;s.deckKnowledge=e.deckCount===null?{kind:'unknown',lower:e.lower??1,upper:e.upper??s.unseenCount}:{kind:'agreed',lower:e.deckCount,upper:e.deckCount};
 if(e.previousRounds){if(e.previousRounds.length!==s.round-1||e.previousRounds.some(r=>!Array.isArray(r)||r.length!==2||r.some(v=>!Number.isInteger(v))))throw Error('Enter one pair of totals per earlier round');s.roundScores=e.previousRounds.map(r=>r.map(total=>({manual:true,total,parts:null,provenance:'Operator recorded historical total'})));}
 else s.roundScores=s.roundScores.slice(0,s.round-1);
 s.scores=[0,1].map(p=>s.roundScores.reduce((n,r)=>n+r[p].total,0));
 s.memories=Array.from({length:2},(_,viewer)=>({knownHands:[[],[]],discards:Object.fromEntries(COLORS.map(c=>[c,s.discards[c].map((id,i)=>viewer===e.viewer||i===s.discards[c].length-1?id:null)]))}));
 if(e.knownOpponent){if(![0,1].includes(e.viewer)||e.knownOpponent.some(t=>!ALL_IDS.some(id=>cardType(id)===t)))throw Error('Invalid remembered public pickups');s.memories[e.viewer].knownHands[1-e.viewer]=e.knownOpponent.slice();}
 s.events.push({type:'tableCorrection',viewer:e.viewer,provenance:'Actual table transcription; unknown buried cards remain unknown'});
 if(s.deckCount===0){if(s.phase!=='place')throw Error('A last-card draw must leave eight-card hands');endRound(s);}
 return s;
}
