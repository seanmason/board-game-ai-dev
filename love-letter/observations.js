import {clone,assertValid,legalActions,resolvePlay,finishTurn,physicalNextRound,forget,remember} from './core.js';
const actionKey=a=>JSON.stringify([a.type,a.cardRank??null,a.target??null,a.guess??null]);
export function publicObservation(s,viewer){
 if(!Number.isInteger(viewer)||viewer<0||viewer>=s.players)throw Error('Invalid viewer');
 const revealed=s.drawCount===0&&['roundEnd','gameover','showdown'].includes(s.phase);
 const own=s.hands[viewer].slice();
 if(own.length===1&&own[0]===null&&s.memories[viewer][viewer].known)own[0]=s.memories[viewer][viewer].known;
 return {version:1,edition:s.edition,players:s.players,viewer,phase:s.phase,current:s.current,round:s.round,turn:s.turn,
  affection:s.affection.slice(),priority:s.priority.slice(),starter:s.starter,
  alive:s.alive.slice(),protected:s.protected.slice(),discards:clone(s.discards),exclusions:s.exclusions.slice(),
  drawCount:s.drawCount,reserveCount:s.reserveCount,ownHand:own,
  handCounts:s.alive.map((a,p)=>a?(['choosePlay','resolve'].includes(s.phase)&&p===s.current?2:1):0),
  memories:clone(s.memories[viewer]),equalities:clone(s.equalities),
  revealed:revealed?s.alive.map((a,p)=>a?s.hands[p].slice():[]):null,
  roundWinners:s.roundWinners.slice(),winners:s.winners.slice(),pending:s.pending?clone(s.pending):null};
}
export function analysisBlocker(s,viewer=s.current){
 if(viewer!==s.current)return 'Pass the device to the current player before analysis.';
 if(s.phase!=='choosePlay')return s.pending?'Finish or cancel the pending tabletop effect.':'Draw and enter your cards to analyze a play.';
 if(s.exclusions.includes(null))return 'Enter the three public unused cards.';
 if(publicObservation(s,viewer).ownHand.includes(null))return 'Enter the active player’s two cards. Opponent cards may stay unknown.';
 return '';
}
export function recordPhysicalAction(state,action){
 if(state.mode!=='physical')throw Error('Physical recording requires a physical table');
 assertValid(state);const s=clone(state);
 if(action.type==='nextRound'){const next=physicalNextRound(s);assertValid(next);return next;}
 if(action.type==='draw'){
  if(s.phase!=='awaitDraw')throw Error('Not awaiting a draw');
  s.protected[s.current]=false;s.deck.pop();s.drawCount--;s.hands[s.current].push(null);s.phase='choosePlay';
 }else if(action.type==='cancel'){
  if(s.phase!=='resolve')throw Error('No pending action');s.pending=null;s.phase='choosePlay';
 }else{
  if(!legalActions(s).some(a=>actionKey(a)===actionKey(action)))throw Error('Illegal declared play');
  s.pending={action:clone(action),performed:false};s.phase='resolve';
 }
 assertValid(s);return s;
}
export function recordObservation(state,e){
 if(state.mode!=='physical')throw Error('Not a physical table');assertValid(state);const s=clone(state);
 if(e.type==='setup'){
  if(s.phase!=='setup')throw Error('Not awaiting setup');
  if(s.players===2){if(!Array.isArray(e.exclusions)||e.exclusions.length!==3||e.exclusions.some(r=>!Number.isInteger(r)||r<1||r>8))throw Error('Enter three public unused cards');s.exclusions=e.exclusions.slice();}
  s.phase='awaitDraw';
 }else if(e.type==='hand'){
  const p=e.player;if(!Number.isInteger(p)||p<0||p>=s.players||!Array.isArray(e.ranks)||e.ranks.length!==s.hands[p].length||e.ranks.some(r=>r!==null&&(!Number.isInteger(r)||r<1||r>8)))throw Error('Invalid hand correction');
  if(s.pending)throw Error('Cancel the unperformed preview before correcting');
  // Corrections explicitly invalidate derived information; no stale downstream certainty.
  s.memories=s.memories.map(row=>row.map(()=>({known:null,excluded:[]})));s.equalities=[];
  s.hands[p]=e.ranks.slice();s.events.push({type:'correction',player:p,visibility:'private',observer:p});
 }else if(e.type==='private'){
  if(s.phase==='resolve')throw Error('Confirm the actual effect to record its private look');
  remember(s,e.observer,e.holder,e.rank,'Recorded real private look');s.events.push({type:'look',observer:e.observer,holder:e.holder,visibility:'private'});
 }else if(e.type==='effect'){
  if(s.phase!=='resolve')throw Error('No pending effect');s.phase='choosePlay';resolvePlay(s,s.pending.action,e);
 }else if(e.type==='showdown'){
  if(s.phase!=='showdown')throw Error('Not awaiting public showdown');
  if(!Array.isArray(e.ranks)||e.ranks.length!==s.players)throw Error('Enter surviving ranks');
  for(let p=0;p<s.players;p++)if(s.alive[p]){const r=e.ranks[p];if(!Number.isInteger(r)||r<1||r>8)throw Error('Enter each survivor’s public rank');if(s.hands[p][0]!==null&&s.hands[p][0]!==r)throw Error('Showdown contradicts recorded hand');s.hands[p]=[r];}
  finishTurn(s);
 }else throw Error('Unknown observation');
 assertValid(s);return s;
}
