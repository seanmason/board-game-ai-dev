import {EDITION,CATALOG_VERSION} from './catalog.js';
export {recordObservation,recordPhysicalAction} from './core.js';
/** Explicit projection: never inspect opponent card fields or true deck fields. */
export function publicObservation(s,viewer) {
 if(!Number.isInteger(viewer)||viewer<0||viewer>=s.players.length)throw Error('Invalid viewer');
 return {edition:EDITION,catalogVersion:CATALOG_VERSION,viewer,turn:s.turn,phase:s.phase,mode:s.mode,
  players:s.players.map((p,i)=>({seat:i,trains:p.trains,handCount:p.handCount,ticketCount:p.ticketCount,ticketAcquiredAt:[...p.ticketAcquiredAt],knownHand:[...p.publicHand],
   ...(i===viewer?{hand:[...p.hand],tickets:[...p.tickets]}:{})})),
  market:[...s.market],discard:[...s.discard],claimed:{...s.claimed},pileCounts:{...s.pileCounts},
  offer:s.turn===viewer?[...s.offer]:Array(s.offer.length).fill(null),
  ticketReturns:s.ticketReturns.filter(r=>r.viewer===viewer).map(r=>({...r})),ticketDrawSerial:s.ticketDrawSerial,
  finalRound:s.finalRound?{...s.finalRound}:null,
  pending:s.pending?{reason:s.pending.reason||null,kind:s.pending.kind||null}:null,
  events:s.events.map(e=>{
   if(e.type==='action'&&e.action.type==='claim')return {type:'claim',seat:e.seat,route:e.action.route,payment:{...e.action.payment}};
   if(e.type==='action'&&e.action.type==='drawTrain')return {type:'draw',seat:e.seat,source:e.action.source,index:e.action.index};
   if(e.type==='blindObservation')return e.seat===viewer?{...e}:{type:e.type,seat:e.seat};
   // Private observation objects, offers, keep indices and correction snapshots stay local.
   return {type:e.type,seat:e.seat};
  })};
}
