import {TRAIN_COLORS,TICKETS} from './catalog.js';
/** Sample unknown cards from remaining conservation-compatible supply. */
export function sampleBelief(observation,seed=1) {
 let random=seed>>>0;const next=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
 const pool=TRAIN_COLORS.flatMap(c=>Array(c==='locomotive'?14:12).fill(c));
 function remove(color){if(color===null)return;const i=pool.indexOf(color);if(i<0)throw Error('Observation violates color conservation');pool.splice(i,1);}
 observation.market.forEach(remove);observation.discard.forEach(remove);
 observation.players.find(p=>p.seat===observation.viewer).hand.forEach(remove);
 observation.players.filter(p=>p.seat!==observation.viewer).forEach(p=>p.knownHand.forEach(remove));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 const ticketPool=TICKETS.map(t=>t.id),own=observation.players[observation.viewer];
 for(const id of [...own.tickets,...observation.offer])if(id!==null){const i=ticketPool.indexOf(id);if(i<0)throw Error('Ticket observation conflict');ticketPool.splice(i,1);}
 for(let i=ticketPool.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[ticketPool[i],ticketPool[j]]=[ticketPool[j],ticketPool[i]];}
 const ticketAssignments=new Map(observation.players.map(p=>[p.seat,[]]));
 const slots=observation.players.filter(p=>p.seat!==observation.viewer).flatMap(p=>p.ticketAcquiredAt.map(serial=>({seat:p.seat,serial}))).sort((a,b)=>a.serial-b.serial);
 for(const slot of slots){const index=ticketPool.findIndex(id=>!observation.ticketReturns.some(r=>r.id===id&&slot.serial<=r.afterDrawSerial));if(index<0)throw Error('No belief satisfies remembered ticket returns');ticketAssignments.get(slot.seat).push(ticketPool.splice(index,1)[0]);}
 return {players:observation.players.map(p=>p.seat===observation.viewer?{seat:p.seat,hand:[...p.hand],tickets:[...p.tickets]}:
  {seat:p.seat,hand:[...p.knownHand,...pool.splice(0,p.handCount-p.knownHand.length)],tickets:ticketAssignments.get(p.seat)}),remainingTrainCards:pool,remainingTickets:ticketPool};
}
