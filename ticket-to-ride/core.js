import {EDITION,CATALOG_VERSION,TRAIN_COLORS,ROUTES,ROUTE_BY_ID,TICKETS,TICKET_BY_ID,ROUTE_POINTS} from './catalog.js';
import {claimPayments,routeAvailable,retentionSubsets} from './actions.js';
export {score,outcome} from './scoring.js';
const clone=x=>structuredClone(x);
const validSeat=(s,p)=>Number.isInteger(p)&&p>=0&&p<s.players.length;
export function actionKey(action) {
 if(!action||typeof action!=='object')return '';
 if(action.type==='claim')return JSON.stringify(['claim',action.route,action.payment?.color,action.payment?.count,action.payment?.locomotive]);
 if(action.type==='drawTrain')return JSON.stringify(['drawTrain',action.source,action.source==='market'?action.index:null]);
 if(action.type==='keepTickets')return Array.isArray(action.keep)?JSON.stringify(['keepTickets',[...action.keep].sort((a,b)=>a-b)]):'';
 return ['drawTickets'].includes(action.type)?action.type:'';
}
function rng(s){s.random=(Math.imul(s.random,1664525)+1013904223)>>>0;return s.random/4294967296;}
function shuffle(s,a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function newGame({players=2,mode='physical',edition=EDITION,seed=1,firstPlayer=0}={}) {
 if(!Number.isInteger(players)||players<2||players>5||!['physical','digital'].includes(mode)||edition!==EDITION||!Number.isInteger(firstPlayer)||firstPlayer<0||firstPlayer>=players)throw Error('Unsupported setup');
 const s={version:1,edition,catalogVersion:CATALOG_VERSION,mode,random:Number(seed)>>>0,turn:firstPlayer,firstPlayer,
 phase:mode==='physical'?'setup':'keepTickets',players:Array.from({length:players},()=>({hand:[],tickets:[],ticketAcquiredAt:[],publicHand:[],trains:45})),
 market:[],trainDeck:[],discard:[],ticketDeck:[],claimed:{},offer:[],setupSeat:firstPlayer,setupRemaining:players,
 finalRound:null,pending:null,events:[],adjudications:[],ticketReturns:[],ticketDrawSerial:0};
 const trains=TRAIN_COLORS.flatMap(c=>Array(c==='locomotive'?14:12).fill(c));
 if(mode==='physical') {
  s.players.forEach(p=>{p.hand=Array(4).fill(null);p.tickets=Array(2).fill(null);p.ticketAcquiredAt=[0,0];});
  s.market=Array(5).fill(null);s.trainDeck=Array(110-4*players-5).fill(null);s.ticketDeck=Array(30-2*players).fill(null);
 }else{
  s.trainDeck=shuffle(s,trains);s.ticketDeck=shuffle(s,TICKETS.map(t=>t.id));
  s.players.forEach(p=>{p.hand=s.trainDeck.splice(0,4);});s.market=s.trainDeck.splice(0,5);
  stabilize(s);if(s.phase!=='supplyAdjudication'){s.offer=s.ticketDeck.splice(0,3);s.phase='keepTickets';}
 }
 updateCounts(s);assertValid(s);return s;
}
export const currentPlayer=s=>s.turn;
export function analysisBlocker(s,seat=s.turn) {
 if(seat!==s.turn)return 'Advice is available for the active seat';
 if(['setup','supplyAdjudication','trainObservation','refill','ticketObservation'].includes(s.phase))return 'Resolve the pending tabletop observation or adjudication';
 if(s.players[seat].hand.includes(null))return 'Enter the active player’s actual train cards';
 if(s.players[seat].tickets.includes(null))return 'Enter the active player’s actual destination tickets';
 if(s.offer.includes(null))return 'Enter the destination ticket offer';return null;
}
function sources(s,second=false){
 // USA 2015 p3, Train Car Cards: an empty deck AND discard prohibit
 // the entire train-card draw action, including still-visible face-up cards.
 if(!s.trainDeck.length&&!s.discard.length)return [];
 const a=[];s.market.forEach((c,index)=>{if(c!==null&&(!second||c!=='locomotive'))a.push({type:'drawTrain',source:'market',index});});
 if(s.trainDeck.length||s.discard.length)a.push({type:'drawTrain',source:'blind'});return a;
}
function paymentHand(p){const hand=[...p.hand];for(const c of TRAIN_COLORS){const missing=Math.max(0,p.publicHand.filter(x=>x===c).length-hand.filter(x=>x===c).length);for(let i=0;i<missing;i++){const pos=hand.indexOf(null);if(pos>=0)hand[pos]=c;}}return hand;}
export function legalActions(s,actor=s.turn) {
 if(actor!==s.turn||s.phase==='terminal')return [];
 if(s.phase==='keepTickets')return s.offer.includes(null)?[]:retentionSubsets(s.offer.length,s.setupRemaining?2:1).map(keep=>({type:'keepTickets',keep}));
 if(s.phase==='secondDraw')return sources(s,true);
 if(s.phase!=='turn')return [];
 const actions=[...sources(s)];
 if(s.ticketDeck.length)actions.push({type:'drawTickets'});
 for(const r of ROUTES)if(routeAvailable(s,r,actor))for(const payment of claimPayments(r,paymentHand(s.players[actor]),s.mode==='physical'))actions.push({type:'claim',route:r.id,payment});
 return actions;
}
function enterAdjudication(s,reason,snapshot=null) {
 s.phase='supplyAdjudication';s.pending={reason,preTransaction:snapshot,pendingTransaction:s.pending,
 observedSupply:{deck:s.trainDeck.length,discard:s.discard.length,market:[...s.market]},legalAlternativeActions:[]};
}
function replenish(s){if(!s.trainDeck.length&&s.discard.length)s.trainDeck=shuffle(s,s.discard.splice(0));}
function take(s){replenish(s);return s.trainDeck.length?s.trainDeck.shift():undefined;}
function stabilize(s,after=null) {
 let tries=0;
 while(s.market.filter(c=>c==='locomotive').length>=3) {
  const available=[...s.trainDeck,...s.discard,...s.market];
  if(available.filter(c=>c!=='locomotive').length<3||++tries>200){enterAdjudication(s,'Market cannot be resolved under pinned rules');return;}
  s.discard.push(...s.market);s.market=[];
  if(s.mode==='physical'){s.pending={kind:'flush',remaining:5,after:after||s.pending?.after||'turn'};s.phase='refill';return;}
  for(let i=0;i<5;i++){const c=take(s);if(c===undefined){enterAdjudication(s,'Incomplete market refill');return;}s.market.push(c);}
 }
}
function finishTurn(s) {
 if(s.finalRound)s.finalRound.remaining--;
 else if(s.players[s.turn].trains<=2)s.finalRound={trigger:s.turn,remaining:s.players.length};
 s.pending=null;s.offer=[];
 if(s.finalRound?.remaining===0){s.phase='terminal';return;}
 s.turn=(s.turn+1)%s.players.length;s.phase='turn';
 if(!legalActions(s).length)enterAdjudication(s,'No ordinary legal action remains');
}
function afterDraw(s,first,locomotive=false) {
 if(first&&!locomotive){s.phase='secondDraw';s.pending=null;if(!sources(s,true).length)enterAdjudication(s,'Only one drawable train card or no second source remains');}
 else finishTurn(s);
}
export function applyAction(state,action) {
 assertValid(state);
 const canonical=legalActions(state).find(a=>actionKey(a)===actionKey(action));if(!canonical)throw Error('Illegal action');action=canonical;
 const s=clone(state),p=s.players[s.turn];s.events.push({type:'action',seat:s.turn,action:clone(action)});
 if(action.type==='claim'){
  const r=ROUTE_BY_ID[action.route],pay=action.payment;
  const spend=[...Array(pay.count).fill(pay.color),...Array(pay.locomotive).fill('locomotive')];
  for(const c of spend){let pos=p.hand.indexOf(c);if(pos<0)pos=p.hand.indexOf(null);p.hand.splice(pos,1);const known=p.publicHand.indexOf(c);if(known>=0)p.publicHand.splice(known,1);s.discard.push(c);}p.trains-=r.length;s.claimed[r.id]=s.turn;finishTurn(s);
 }else if(action.type==='drawTickets'){
  s.ticketDrawSerial++;
  // Hidden selection from a formerly known returned pool is not an observed identity.
  if(s.mode==='physical')s.ticketDeck.fill(null);
  const count=Math.min(3,s.ticketDeck.length);s.offer=s.ticketDeck.splice(0,count);
  s.phase=s.mode==='physical'?'ticketObservation':'keepTickets';s.pending=null;
 }else if(action.type==='keepTickets'){
  const kept=new Set(action.keep);p.tickets.push(...s.offer.filter((_,i)=>kept.has(i)));
  p.ticketAcquiredAt.push(...action.keep.map(()=>s.ticketDrawSerial));
  s.offer.forEach((id,i)=>{if(!kept.has(i)&&id!==null)s.ticketReturns.push({viewer:s.turn,id,afterDrawSerial:s.ticketDrawSerial});});
  s.ticketDeck.push(...s.offer.filter((_,i)=>!kept.has(i)));s.offer=[];
  if(s.setupRemaining){s.setupRemaining--;if(s.setupRemaining){s.turn=(s.turn+1)%s.players.length;s.offer=s.ticketDeck.splice(0,3);s.phase='keepTickets';}else{s.turn=s.firstPlayer;s.phase='turn';}}
  else finishTurn(s);
 }else if(action.type==='drawTrain'){
  const first=s.phase==='turn';const face=action.source==='market';
  if(s.mode==='physical'){
   if(face){const c=s.market[action.index];p.hand.push(c);p.publicHand.push(c);s.market[action.index]=null;
    s.pending={kind:'single',index:action.index,after:first&&c!=='locomotive'?'secondDraw':'finishTurn'};s.phase='refill';
    if(!s.trainDeck.length&&!s.discard.length)enterAdjudication(s,'Face-up draw cannot be refilled',clone(state));
 }else{s.phase='trainObservation';s.pending={first,kind:'blind',preTransaction:clone(state)};}
  }else{
   const c=face?s.market[action.index]:take(s);p.hand.push(c);if(face)p.publicHand.push(c);
   if(face){const replacement=take(s);if(replacement===undefined){s.market[action.index]=null;enterAdjudication(s,'Face-up draw cannot be refilled',clone(state));}
    else{s.market[action.index]=replacement;stabilize(s);}}
   if(s.phase!=='supplyAdjudication')afterDraw(s,first,face&&c==='locomotive');
  }
 }
 updateCounts(s);assertValid(s);return s;
}
function physicalKnownTake(s,color){
 replenish(s);if(!s.trainDeck.length)throw Error('No card available');
 const i=s.trainDeck.indexOf(color),unknown=s.trainDeck.indexOf(null);
 if(i>=0)s.trainDeck.splice(i,1);else if(unknown>=0)s.trainDeck.splice(unknown,1);else throw Error('Observed card conflicts with known supply');
}
function physicalUnknownTake(s){
 replenish(s);if(!s.trainDeck.length)throw Error('No card available');
 // Conservatively forget shuffled-pool identity positions, never fabricate a color removal.
 s.trainDeck.fill(null);s.trainDeck.shift();
}
/** Record facts only; no random physical outcomes are generated. */
export function recordObservation(state,observation) {
 assertValid(state);const s=clone(state);
 if(s.mode!=='physical')throw Error('Physical observations require physical mode');
 if(observation.type==='privateCards'){
  if(!validSeat(s,observation.seat))throw Error('Invalid seat');
  const p=s.players[observation.seat];
  if(!Array.isArray(observation.hand)||observation.hand.length!==p.hand.length||!Array.isArray(observation.tickets)||observation.tickets.length!==p.tickets.length)throw Error('Preserve observed card counts');
  if(p.hand.some((c,i)=>c!==null&&c!==observation.hand[i])||p.tickets.some((t,i)=>t!==null&&t!==observation.tickets[i]))throw Error('Changing a known card requires an explicit correction reason');
  p.hand=clone(observation.hand);p.tickets=clone(observation.tickets);
 }else if(s.phase==='setup'&&observation.type==='setup'){
  if(!Array.isArray(observation.market)||observation.market.length!==5)throw Error('Five market cards required');
  s.market=clone(observation.market);
  if(observation.keptCounts){if(observation.keptCounts.length!==s.players.length||observation.keptCounts.some(n=>![2,3].includes(n)))throw Error('Initial keep count is two or three');
   s.players.forEach((p,i)=>{p.tickets=Array(observation.keptCounts[i]).fill(null);p.ticketAcquiredAt=Array(p.tickets.length).fill(0);});s.ticketDeck=Array(30-s.players.reduce((n,p)=>n+p.tickets.length,0)).fill(null);}
  s.setupRemaining=0;s.phase='turn';stabilize(s);
 }else if(s.phase==='trainObservation'&&observation.type==='trainCard'){
  if(observation.color!==null&&!TRAIN_COLORS.includes(observation.color))throw Error('Enter observed color or an explicit unknown blind card');
  if(observation.color===null)physicalUnknownTake(s);else physicalKnownTake(s,observation.color);
  s.players[s.turn].hand.push(observation.color);const first=s.pending.first;s.events.push({type:'blindObservation',seat:s.turn,color:observation.color});afterDraw(s,first);
 }else if(s.phase==='refill'&&observation.type==='trainCard'){
  if(!TRAIN_COLORS.includes(observation.color))throw Error('Enter observed refill color');
  physicalKnownTake(s,observation.color);const pending=s.pending;
  if(pending.kind==='flush'){s.market.push(observation.color);pending.remaining--;if(pending.remaining)return checked(s);}
  else s.market[pending.index]=observation.color;
  s.phase=pending.after;s.pending=null;stabilize(s,pending.after);
  if(s.phase==='finishTurn')finishTurn(s);else if(s.phase==='secondDraw'&&!sources(s,true).length)enterAdjudication(s,'No second train-card source remains');
 }else if(s.phase==='ticketObservation'&&observation.type==='ticketOffer'){
  if(!Array.isArray(observation.tickets)||observation.tickets.length!==s.offer.length||observation.tickets.some(id=>!Object.hasOwn(TICKET_BY_ID,id)))throw Error('Enter every offered ticket');
  s.offer=clone(observation.tickets);s.phase='keepTickets';
 }else if(s.phase==='ticketObservation'&&observation.type==='unknownTicketRetention'){
  const count=observation.keptCount;if(!Number.isInteger(count)||count<1||count>s.offer.length)throw Error('Keep at least one of the offered tickets');
  const p=s.players[s.turn];p.tickets.push(...Array(count).fill(null));p.ticketAcquiredAt.push(...Array(count).fill(s.ticketDrawSerial));
  s.ticketDeck.push(...Array(s.offer.length-count).fill(null));s.offer=[];finishTurn(s);
 }else if(s.phase==='terminal'&&observation.type==='finalTickets'){
  if(!validSeat(s,observation.seat))throw Error('Invalid final seat');const p=s.players[observation.seat];
  if(!Array.isArray(observation.tickets)||observation.tickets.length!==p.tickets.length||observation.tickets.some(t=>!Object.hasOwn(TICKET_BY_ID,t)))throw Error('Reveal every final destination ticket');
  if(p.tickets.some((t,i)=>t!==null&&t!==observation.tickets[i]))throw Error('Known final ticket conflicts; record a correction');
  p.tickets=clone(observation.tickets);s.ticketDeck=s.ticketDeck.map(t=>observation.tickets.includes(t)?null:t);
 }else if(observation.type==='correction'){
  if(typeof observation.reason!=='string'||!observation.reason.trim()||!observation.state)throw Error('Correction needs reason and snapshot');
  const corrected=clone(observation.state);assertValid(corrected);if(corrected.mode!=='physical'||corrected.players.length!==s.players.length)throw Error('Correction cannot change game mode or player count');
  corrected.events.push({type:'correction',reason:observation.reason});return checked(corrected);
 }else if(s.phase==='supplyAdjudication'&&observation.type==='recordAdjudication'){
  if(!observation.policyId?.trim()||!observation.evidence?.trim()||!observation.state)throw Error('Adjudication needs policy, evidence and corrected continuation');
  const corrected=clone(observation.state);assertValid(corrected);if(corrected.mode!=='physical'||corrected.players.length!==s.players.length)throw Error('Invalid adjudicated continuation');
  corrected.adjudications.push({policyId:observation.policyId,evidence:observation.evidence,reason:s.pending.reason});corrected.events.push({type:'adjudication',policyId:observation.policyId});return checked(corrected);
 }else throw Error('Observation does not match pending phase');
 s.events.push({type:'observation',seat:s.turn,observation:clone(observation)});return checked(s);
}
function updateCounts(s){s.players.forEach(p=>{p.handCount=p.hand.length;p.ticketCount=p.tickets.length;});s.pileCounts={train:s.trainDeck.length,tickets:s.ticketDeck.length};}
function checked(s){updateCounts(s);assertValid(s);return s;}
export const recordPhysicalAction=(s,a)=>{if(s.mode!=='physical')throw Error('Physical mode required');return applyAction(s,a);};
export function cancelPending(state) {
 assertValid(state);
 if(state.phase==='trainObservation'&&state.pending?.preTransaction){const restored=clone(state.pending.preTransaction);restored.events.push({type:'cancelledUnobservedDraw'});return checked(restored);}
 if(state.mode==='digital'&&state.phase==='supplyAdjudication'&&state.pending?.preTransaction){const restored=clone(state.pending.preTransaction);restored.events.push({type:'cancelledSupplyTransaction'});return checked(restored);}
 throw Error('Observed tabletop effects require a recorded correction or adjudication');
}
export function assertValid(s,depth=0) {
 if(depth>4)throw Error('Nested transaction snapshot limit');
 if(!s||s.version!==1||s.edition!==EDITION||s.catalogVersion!==CATALOG_VERSION||!['digital','physical'].includes(s.mode)||!Array.isArray(s.players)||s.players.length<2||s.players.length>5||!validSeat(s,s.turn)||!validSeat(s,s.firstPlayer))throw Error('Invalid game schema');
 if(!['setup','turn','keepTickets','secondDraw','trainObservation','refill','ticketObservation','supplyAdjudication','terminal'].includes(s.phase))throw Error('Invalid phase');
 if(!s.claimed||typeof s.claimed!=='object'||Array.isArray(s.claimed)||!Array.isArray(s.market)||s.market.length>5||!Array.isArray(s.trainDeck)||!Array.isArray(s.discard)||!Array.isArray(s.ticketDeck)||!Array.isArray(s.offer)||!Array.isArray(s.events)||!Array.isArray(s.adjudications))throw Error('Invalid piles');
 const eventTypes=['action','observation','blindObservation','correction','adjudication','cancelledUnobservedDraw','cancelledSupplyTransaction'];
 if(s.events.some(e=>!e||!eventTypes.includes(e.type)||(e.seat!==undefined&&!validSeat(s,e.seat))||(e.type==='action'&&!actionKey(e.action))))throw Error('Invalid event record');
 if(!Number.isInteger(s.random)||s.random<0||s.random>4294967295||!validSeat(s,s.setupSeat)||s.setupSeat!==s.firstPlayer||!Number.isInteger(s.setupRemaining)||s.setupRemaining<0||s.setupRemaining>s.players.length)throw Error('Invalid setup lifecycle');
 if(!Number.isInteger(s.ticketDrawSerial)||s.ticketDrawSerial<0||!Array.isArray(s.ticketReturns)||s.ticketReturns.some(r=>!validSeat(s,r.viewer)||!Object.hasOwn(TICKET_BY_ID,r.id)||!Number.isInteger(r.afterDrawSerial)||r.afterDrawSerial<0||r.afterDrawSerial>s.ticketDrawSerial))throw Error('Invalid private ticket memory');
 if(!s.pileCounts||s.pileCounts.train!==s.trainDeck.length||s.pileCounts.tickets!==s.ticketDeck.length)throw Error('Invalid canonical pile counts');
 for(const [id,owner] of Object.entries(s.claimed))if(!Object.hasOwn(ROUTE_BY_ID,id)||!validSeat(s,owner))throw Error('Invalid route ownership');
 s.players.forEach((p,seat)=>{
  if(!Array.isArray(p.hand)||!Array.isArray(p.tickets)||!Array.isArray(p.ticketAcquiredAt)||p.ticketAcquiredAt.length!==p.tickets.length||p.ticketAcquiredAt.some(n=>!Number.isInteger(n)||n<0||n>s.ticketDrawSerial)||!Array.isArray(p.publicHand)||p.publicHand.some(c=>!TRAIN_COLORS.includes(c))||p.publicHand.length>p.hand.length||!Number.isInteger(p.trains)||p.trains<0||p.trains>45)throw Error('Invalid player');
  if(p.handCount!==p.hand.length||p.ticketCount!==p.tickets.length)throw Error('Invalid canonical player counts');
  const alreadySelected=s.mode==='physical'||s.setupRemaining===0||(seat-s.firstPlayer+s.players.length)%s.players.length<s.players.length-s.setupRemaining;
  if(alreadySelected&&p.tickets.length<2)throw Error('A player must retain at least two initial destination tickets');
  const deficits=TRAIN_COLORS.reduce((n,c)=>n+Math.max(0,p.publicHand.filter(x=>x===c).length-p.hand.filter(x=>x===c).length),0);
  if(deficits>p.hand.filter(c=>c===null).length)throw Error('Public card memory conflicts with hand');
  if(45-p.trains!==ROUTES.filter(r=>s.claimed[r.id]===seat).reduce((n,r)=>n+r.length,0))throw Error('Train conservation');
 });
 for(const group of new Set(ROUTES.map(r=>r.parallelGroup).filter(Boolean))){const owned=ROUTES.filter(r=>r.parallelGroup===group&&Object.hasOwn(s.claimed,r.id)).map(r=>s.claimed[r.id]);if(owned.length>1&&(s.players.length<4||new Set(owned).size!==owned.length))throw Error('Illegal parallel ownership');}
 const cards=[...s.market,...s.trainDeck,...s.discard,...s.players.flatMap(p=>p.hand)];
 // A null face-up slot awaits refill; its card is still in the deck, so omit that slot.
 const missingMarket=s.phase==='refill'||s.phase==='supplyAdjudication'?s.market.filter(c=>c===null).length:0;
 if(cards.length-missingMarket!==110||cards.some(c=>c!==null&&!TRAIN_COLORS.includes(c)))throw Error('Train-card conservation');
 for(const c of TRAIN_COLORS){const lower=[...s.market,...s.trainDeck,...s.discard].filter(x=>x===c).length+s.players.reduce((n,p)=>n+Math.max(p.hand.filter(x=>x===c).length,p.publicHand.filter(x=>x===c).length),0);if(lower>(c==='locomotive'?14:12))throw Error('Too many cards of one color');}
 const tickets=[...s.ticketDeck,...s.offer,...s.players.flatMap(p=>p.tickets)];
 if(tickets.length!==30||tickets.some(t=>t!==null&&!Object.hasOwn(TICKET_BY_ID,t))||new Set(tickets.filter(t=>t!==null)).size!==tickets.filter(t=>t!==null).length)throw Error('Destination conservation');
 if(s.mode==='digital'&&(cards.includes(null)||tickets.includes(null))&&s.phase!=='supplyAdjudication')throw Error('Unknown digital card');
 if(s.finalRound&&(!validSeat(s,s.finalRound.trigger)||s.players[s.finalRound.trigger].trains>2||!Number.isInteger(s.finalRound.remaining)||s.finalRound.remaining<0||s.finalRound.remaining>s.players.length))throw Error('Invalid final round');
 if(s.phase==='terminal'&&s.finalRound?.remaining!==0)throw Error('Invalid terminal state');
 if(s.finalRound?.remaining===0&&s.phase!=='terminal')throw Error('Finished countdown must be terminal');
 if(s.finalRound&&s.phase!=='terminal'&&s.turn!==(s.finalRound.trigger+s.players.length-s.finalRound.remaining+1)%s.players.length)throw Error('Invalid final-round turn order');
 if(s.phase==='terminal'&&s.turn!==s.finalRound.trigger)throw Error('Final trigger must receive its subsequent turn');
 if(s.phase==='setup'&&(s.mode!=='physical'||s.setupRemaining!==s.players.length||s.turn!==s.firstPlayer))throw Error('Invalid physical setup phase');
 if(s.setupRemaining&&s.phase!=='setup'&&s.phase!=='supplyAdjudication'&&(s.mode!=='digital'||s.phase!=='keepTickets'||s.turn!==(s.firstPlayer+s.players.length-s.setupRemaining)%s.players.length))throw Error('Invalid initial ticket lifecycle');
 if(['keepTickets','ticketObservation'].includes(s.phase)){if(s.offer.length<(s.setupRemaining?2:1)||s.offer.length>3)throw Error('Invalid ticket offer');}
 else if(s.offer.length&&s.phase!=='supplyAdjudication')throw Error('Ticket offer outside selection phase');
 if(s.phase==='ticketObservation'&&s.mode!=='physical')throw Error('Digital ticket observation');
 if(['trainObservation','refill','supplyAdjudication'].includes(s.phase)){
  if(!s.pending||typeof s.pending!=='object')throw Error('Missing pending transaction');
  if(s.phase==='trainObservation'){
   if(s.mode!=='physical'||s.pending.kind!=='blind'||typeof s.pending.first!=='boolean'||!s.pending.preTransaction)throw Error('Invalid blind observation phase');
   assertValid(s.pending.preTransaction,depth+1);if(s.pending.preTransaction.phase!==(s.pending.first?'turn':'secondDraw')||s.pending.preTransaction.turn!==s.turn||s.pending.preTransaction.mode!==s.mode||s.pending.preTransaction.players.length!==s.players.length)throw Error('Invalid blind draw origin');
  }else if(s.phase==='refill'){
   if(s.mode!=='physical'||!['single','flush'].includes(s.pending.kind)||!['turn','secondDraw','finishTurn'].includes(s.pending.after))throw Error('Invalid refill phase');
   if(s.pending.kind==='single'&&(!Number.isInteger(s.pending.index)||s.pending.index<0||s.pending.index>4||s.market.length!==5||s.market[s.pending.index]!==null||s.market.filter(c=>c===null).length!==1))throw Error('Invalid refill slot');
   if(s.pending.kind==='flush'&&(!Number.isInteger(s.pending.remaining)||s.pending.remaining<1||s.pending.remaining>5||s.market.length!==5-s.pending.remaining||s.market.includes(null)))throw Error('Invalid flush observation');
  }else{
   if(typeof s.pending.reason!=='string'||!s.pending.reason.trim()||!s.pending.observedSupply||!Array.isArray(s.pending.legalAlternativeActions))throw Error('Invalid adjudication phase');
   if(s.pending.preTransaction)assertValid(s.pending.preTransaction,depth+1);
  }
 }else if(s.pending!==null)throw Error('Unexpected pending transaction');
 if(!['setup','refill','supplyAdjudication'].includes(s.phase)&&(s.market.length!==5||s.market.includes(null)))throw Error('Invalid public market');
 if(s.discard.some(c=>!TRAIN_COLORS.includes(c)))throw Error('Discard cards are public known colors');
 return true;
}
