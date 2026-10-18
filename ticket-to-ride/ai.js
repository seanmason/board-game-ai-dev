import {CITIES,ROUTES,ROUTE_BY_ID,TICKET_BY_ID,ROUTE_POINTS} from './catalog.js';
import {connected} from './scoring.js';
import {sampleBelief} from './belief.js';
/** Shortest additional train expenditure through owned/open routes; opponents block lanes. */
export function connectionCost(claimed,seat,from,to,players=4) {
 const d=Object.fromEntries(CITIES.map(c=>[c.id,Infinity]));d[from]=0;const done=new Set();
 for(let i=0;i<CITIES.length;i++){
  const city=CITIES.filter(c=>!done.has(c.id)).sort((a,b)=>d[a.id]-d[b.id])[0]?.id;
  if(city===undefined||d[city]===Infinity)break;if(city===to)return d[city];done.add(city);
  for(const r of ROUTES){if(r.a!==city&&r.b!==city)continue;if(Object.hasOwn(claimed,r.id)&&claimed[r.id]!==seat)continue;
   if(players<4&&claimed[r.id]!==seat&&r.parallelGroup&&ROUTES.some(m=>m.parallelGroup===r.parallelGroup&&Object.hasOwn(claimed,m.id)))continue;
   const next=r.a===city?r.b:r.a;d[next]=Math.min(d[next],d[city]+(claimed[r.id]===seat?0:r.length));}
 }return d[to];
}
function evaluate(o,a,belief) {
 const seat=o.viewer,own=o.players[seat];
 if(a.type==='keepTickets')return a.keep.reduce((n,i)=>{const t=TICKET_BY_ID[o.offer[i]],cost=connectionCost(o.claimed,seat,t.a,t.b,o.players.length);return n+t.value-cost*1.3;},0);
 if(a.type==='drawTickets')return own.tickets.every(id=>{const t=TICKET_BY_ID[id];return t&&connected(ROUTES.filter(r=>o.claimed[r.id]===seat),t.a,t.b);})?3:-3;
 if(a.type==='claim'){
  const r=ROUTE_BY_ID[a.route],claimed={...o.claimed,[r.id]:seat};let utility=ROUTE_POINTS[r.length]*0.7-a.payment.locomotive*0.65;
  for(const id of own.tickets){const t=TICKET_BY_ID[id];if(!t)continue;const before=connectionCost(o.claimed,seat,t.a,t.b,o.players.length),after=connectionCost(claimed,seat,t.a,t.b,o.players.length);
   if(Number.isFinite(before)&&Number.isFinite(after))utility+=(before-after)*(1+t.value/15)+(after===0&&before>0?t.value:0);}
  // Sampled opponent destination pressure is a possibility, never observed fact.
  for(const p of belief.players)if(p.seat!==seat)for(const id of p.tickets){const t=TICKET_BY_ID[id];if(t&&[t.a,t.b].some(c=>c===r.a||c===r.b))utility+=0.04*t.value;}
  if(own.trains-r.length<=2)utility+=own.tickets.every(id=>{const t=TICKET_BY_ID[id];return t&&connected(ROUTES.filter(r=>claimed[r.id]===seat),t.a,t.b);})?6:-8;
  return utility;
 }
 if(a.type==='drawTrain'){
  const color=a.source==='blind'?belief.remainingTrainCards[0]:o.market[a.index];
  let value=color==='locomotive'?2.4:0.7;
  for(const r of ROUTES)if(!Object.hasOwn(o.claimed,r.id)&&(r.color==='gray'||r.color===color||color==='locomotive')){
   const held=own.hand.filter(c=>c===r.color||c==='locomotive').length;if(held===r.length-1)value=Math.max(value,2.5);}
  return value;
 }return 0;
}
export function createSearch({observation,actions,seed=1}) {
 if(!observation||!Array.isArray(actions))throw Error('Observation and legal root actions required');
 return {observation,actions,seed:seed>>>0,iterations:0,rows:actions.map(action=>({action,samples:0,total:0}))};
}
export function runSearch(search,iterations=1) {
 for(let i=0;i<iterations;i++){if(!search.rows.length)break;const row=search.rows[search.iterations%search.rows.length];
  const belief=sampleBelief(search.observation,search.seed+Math.floor(search.iterations/search.rows.length));
  row.total+=evaluate(search.observation,row.action,belief);row.samples++;search.iterations++;}return search;
}
export function summarizeSearch(s){return {iterations:s.iterations,candidates:s.rows.length,pruned:0,rootCoverage:s.rows.filter(r=>r.samples).length,
 method:'Sampled destination pressure and network-cost heuristic; no win probability',
 rows:s.rows.map(r=>({action:r.action,samples:r.samples,utility:r.samples?r.total/r.samples:null})).sort((a,b)=>(b.utility??-Infinity)-(a.utility??-Infinity))};}
