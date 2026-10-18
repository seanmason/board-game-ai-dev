import {TYPES,ALL_IDS,typeOf} from './catalog.js';
import {clone,assertValid,legalActions,multiset,rememberHand,reveal,physicalDeal,allCards} from './core.js';
import {choiceKey} from './actions.js';
export function publicObservation(s,viewer){
 if(!Number.isInteger(viewer)||viewer<0||viewer>=s.players)throw Error('Invalid viewer');
 const memory=s.memories[viewer],seen=memory[s.packets[viewer]];
 const own=s.hands[viewer].map(typeOf),ownHand=own.includes(null)&&seen?Object.entries(seen.types).flatMap(([t,c])=>Array(c).fill(t)):own;
 return {version:1,edition:s.edition,players:s.players,viewer,round:s.round,pick:s.pick,phase:['choose','allCommitted','awaitHands'].includes(s.phase)?'choose':s.phase,remaining:s.remaining,deckCount:s.deckCount,
  ownHand,ownCommitment:clone(s.commitments[viewer]),tableaux:clone(s.tableaux),puddings:clone(s.puddings),scores:s.scores.slice(),roundScores:clone(s.roundScores),discard:s.discard.slice(),packets:s.packets.slice(),knownPackets:clone(memory),winners:s.winners.slice()};
}
export function analysisBlocker(s,viewer){if(!['choose','allCommitted','awaitHands'].includes(s.phase))return 'Advice is available while choosing a card.';if(publicObservation(s,viewer).ownHand.includes(null))return 'Enter your actual received hand. Other players’ cards may stay unknown.';return '';}
export function recordPhysicalAction(state,a){
 if(state.mode!=='physical')throw Error('Not a physical table');assertValid(state);const s=clone(state);
 if(a.type==='setup'){if(s.phase!=='setup')throw Error('Not awaiting a deal');s.phase='awaitHands';}
 else if(a.type==='nextRound')physicalDeal(s);
 else if(a.type==='commit'){
  if(!Number.isInteger(a.actor)||a.actor<0||a.actor>=s.players||!legalActions(s,a.actor).some(b=>choiceKey(a)===choiceKey(b)))throw Error('Invalid actual pick');s.commitments[a.actor]={cards:a.cards.slice(),returnId:a.returnId??null};s.phase=s.commitments.every(Boolean)?'allCommitted':'choose';
 }else if(a.type==='uncommit'){
  if(!['choose','allCommitted','awaitHands'].includes(s.phase)||!Number.isInteger(a.actor)||a.actor<0||a.actor>=s.players)throw Error('Invalid private cancellation');s.commitments[a.actor]=null;s.phase='choose';
 }else if(a.type==='cancelReveal'){
  if(!['choose','allCommitted','awaitHands'].includes(s.phase))throw Error('No unperformed reveal');s.commitments=Array(s.players).fill(null);s.phase='choose';
 }else throw Error('Unknown physical action');assertValid(s);return s;
}
export function recordObservation(state,e){
 if(state.mode!=='physical')throw Error('Not a physical table');assertValid(state);const s=clone(state);
 if(e.type==='hand'){
  const p=e.player;if(!Number.isInteger(p)||p<0||p>=s.players||!['choose','awaitHands','allCommitted'].includes(s.phase)||!Array.isArray(e.types)||e.types.length!==s.remaining||e.types.some(t=>!TYPES[t]))throw Error('Enter every card in your actual received packet');
  const packet=s.packets[p],observed=multiset(e.types),memory=s.memories[p][packet];
  if(!e.correction&&memory&&Object.keys(TYPES).some(t=>(memory.types[t]??0)!==(observed[t]??0)))throw Error('Received hand contradicts recorded packet memory. Use an explicit correction.');
  const priorCounts=multiset(s.hands[p].filter(Boolean).map(typeOf));
  if(!e.correction&&Object.entries(priorCounts).some(([t,n])=>(observed[t]??0)<n))throw Error('Actual hand contradicts earlier recorded cards. Use an explicit correction.');
  if(e.correction){for(const m of s.memories)delete m[packet];s.events.push({type:'handCorrection',player:p,packet,round:s.round,pick:s.pick,visibility:'private'});}
  const previous=s.hands[p].slice(),used=new Set(allCards(s).filter(Boolean));for(const id of previous)used.delete(id);
  const assigned=[];
  for(const type of e.types){const prior=previous.find(id=>typeOf(id)===type&&!assigned.includes(id)),id=prior??ALL_IDS.find(id=>typeOf(id)===type&&!used.has(id));if(!id)throw Error('Observed cards exceed the original deck');assigned.push(id);used.add(id);}
  s.hands[p]=assigned;s.pendingHands[p]=false;s.commitments[p]=null;s.phase='choose';rememberHand(s,p);
 }else if(e.type==='reveal'){
  if(s.phase!=='allCommitted')throw Error('Record every player’s actual pick before revealing');
  // All choices resolve from the same public position, in one transaction.
  reveal(s);
 }else throw Error('Unknown observation');assertValid(s);return s;
}
