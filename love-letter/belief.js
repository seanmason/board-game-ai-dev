import {CARDS} from './catalog.js';
import {clone,shuffle} from './core.js';
// Enumerate hand allocations with copy-count weights. The unassigned pool is a
// uniformly shuffled deck/reserve; it is never copied from the digital truth.
export function allocations(obs){
 const counts=CARDS.map(c=>c?.count??0),hands=Array.from({length:obs.players},()=>[]);
 const take=r=>{if(r===null)throw Error('Unknown public or own card');if(--counts[r]<0)throw Error('Inconsistent visible card counts');};
 for(const pile of obs.discards)for(const c of pile)take(c.rank);
 for(const r of obs.exclusions)take(r);
 for(const r of obs.ownHand){take(r);hands[obs.viewer].push(r);}
 const slots=[];
 for(let p=0;p<obs.players;p++)if(p!==obs.viewer)for(let i=0;i<obs.handCounts[p];i++)slots.push(p);
 const result=[];
 function visit(i,weight){
  if(i===slots.length){
   for(const [a,b] of obs.equalities)if(hands[a].length===1&&hands[b].length===1&&hands[a][0]!==hands[b][0])return;
   result.push({hands:clone(hands),pool:counts.flatMap((n,r)=>Array(n).fill(r)),weight});return;
  }
  const p=slots[i],m=obs.memories[p];
  for(let r=1;r<=8;r++)if(counts[r]&&(!m.known||r===m.known)&&!m.excluded.includes(r)){
   const copies=counts[r];counts[r]--;hands[p].push(r);visit(i+1,weight*copies);hands[p].pop();counts[r]++;
  }
 }
 visit(0,1);if(!result.length)throw Error('No compatible hidden worlds; correct conflicting observations');return result;
}
export function sampleWorld(obs,worlds,rng){
 let pick=rng()*worlds.reduce((n,w)=>n+w.weight,0),chosen=worlds.at(-1);for(const w of worlds){pick-=w.weight;if(pick<0){chosen=w;break;}}
 const pool=shuffle(chosen.pool,rng),reserve=obs.reserveCount?pool.pop():null;
 if(pool.length!==obs.drawCount)throw Error('Visible card counts do not conserve sixteen cards');
 return {version:1,edition:obs.edition,mode:'digital',seed:1,players:obs.players,priority:obs.priority.slice(),affection:obs.affection.slice(),round:obs.round,starter:obs.starter,current:obs.current,events:[],roundWinners:obs.roundWinners.slice(),winners:obs.winners.slice(),turn:obs.turn,alive:obs.alive.slice(),protected:obs.protected.slice(),discards:clone(obs.discards),memories:Array.from({length:obs.players},(_,p)=>p===obs.viewer?clone(obs.memories):Array.from({length:obs.players},()=>({known:null,excluded:[]}))),equalities:clone(obs.equalities),pending:null,phase:obs.phase,hands:clone(chosen.hands),deck:pool,drawCount:pool.length,reserve,reserveCount:obs.reserveCount,exclusions:obs.exclusions.slice()};
}
