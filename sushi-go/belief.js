import {ALL_IDS,TYPES,typeOf} from './catalog.js';
import {clone,multiset,shuffle} from './core.js';
// Reconstruct from public cards and this viewer's packet memories only. A known
// packet is held fixed; unseen packets are dealt without replacement from copies.
export function sampleWorld(obs,rng){
 const used=new Set([...obs.discard,...obs.tableaux.flatMap(p=>p.map(e=>e.id)),...obs.puddings.flat()]);
 let pool=ALL_IDS.filter(id=>!used.has(id));const hands=Array.from({length:obs.players},()=>null);
 const take=types=>types.map(t=>{const i=pool.findIndex(id=>typeOf(id)===t);if(i<0)throw Error('Conflicting visible cards or packet memory');return pool.splice(i,1)[0];});
 hands[obs.viewer]=take(obs.ownHand);
 for(let p=0;p<obs.players;p++)if(p!==obs.viewer){const known=obs.knownPackets[obs.packets[p]];if(known){if(known.size!==obs.remaining)throw Error('Packet size changed without a recorded public reveal');hands[p]=take(Object.entries(known.types).flatMap(([t,c])=>Array(c).fill(t)));}}
 pool=shuffle(pool,rng);for(let p=0;p<obs.players;p++)if(!hands[p])hands[p]=Array.from({length:obs.remaining},()=>pool.pop());
 if(pool.length!==obs.deckCount)throw Error('Visible cards do not conserve 108 copies');
 const memories=Array.from({length:obs.players},()=>({}));
 // Opponents know their sampled own hand, not the root's other private packets.
 for(let p=0;p<obs.players;p++)memories[p][obs.packets[p]]={types:multiset(hands[p].map(typeOf)),size:obs.remaining,pick:obs.pick,provenance:'Sampled own hand'};
 memories[obs.viewer]=clone(obs.knownPackets);
 return {version:1,edition:obs.edition,players:obs.players,mode:'digital',seed:0,round:obs.round,pick:obs.pick,remaining:obs.remaining,deck:pool,deckCount:pool.length,discard:obs.discard.slice(),hands,tableaux:clone(obs.tableaux),puddings:clone(obs.puddings),scores:obs.scores.slice(),roundScores:clone(obs.roundScores),winners:[],events:[],memories,packets:obs.packets.slice(),commitments:Array(obs.players).fill(null),pendingHands:Array(obs.players).fill(false),phase:'choose'};
}
