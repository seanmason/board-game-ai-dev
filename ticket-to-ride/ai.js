import {CITIES,COLORS,TRAIN_COLORS,ROUTES,ROUTE_BY_ID,TICKET_BY_ID,ROUTE_POINTS} from './catalog.js';
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
// Explicit candidate only. The sampled incumbent above remains the browser default.
export const PLANNING_POLICY='planning-v2';
const colorCounts=hand=>Object.fromEntries(TRAIN_COLORS.map(c=>[c,hand.filter(x=>x===c).length]));
export function planningRouteUsable(o,r){
 if(Object.hasOwn(o.claimed,r.id))return o.claimed[r.id]===o.viewer;
 if(r.length>o.players[o.viewer].trains)return false;
 const mates=r.parallelGroup?ROUTES.filter(m=>m.parallelGroup===r.parallelGroup&&Object.hasOwn(o.claimed,m.id)):[];
 return !mates.some(m=>o.claimed[m.id]===o.viewer)&&!(o.players.length<4&&mates.length);
}
/** Route witness through owned/available lanes. Gray means one chosen real color,
 * never an imaginary 'gray' card; wild counts cannot exceed the actor's holding. */
export function planningPath(o,from,to,reused=new Set()){
 const held=colorCounts(o.players[o.viewer].hand),distance=new Map(CITIES.map(c=>[c.id,Infinity])),previous=new Map(),todo=new Set(distance.keys());distance.set(from,0);
 while(todo.size){let at=null;for(const city of todo)if(at===null||distance.get(city)<distance.get(at))at=city;
  if(at===to||!Number.isFinite(distance.get(at)))break;todo.delete(at);
  for(const r of ROUTES){if(r.a!==at&&r.b!==at||!planningRouteUsable(o,r))continue;const next=r.a===at?r.b:r.a;if(!todo.has(next))continue;
   const colored=r.color==='gray'?Math.max(...COLORS.map(c=>held[c])):held[r.color],missing=Math.max(0,r.length-colored-held.locomotive);
   const cost=o.claimed[r.id]===o.viewer?0:(1+missing*.65+r.length*.12)*(reused.has(r.id)?.25:1),d=distance.get(at)+cost;
   if(d<distance.get(next)){distance.set(next,d);previous.set(next,{from:at,route:r.id});}
  }
 }
 const routes=[];let at=to;while(previous.has(at)){const edge=previous.get(at);routes.unshift(edge.route);at=edge.from;}
 return {cost:distance.get(to),routes,requiredTrains:routes.reduce((n,id)=>n+(o.claimed[id]===o.viewer?0:ROUTE_BY_ID[id].length),0)};
}
/** Demand shares the hand once across the whole union, not once per ticket.
 * Colored routes reserve their colors before gray lanes choose remaining surplus. */
export function planningDemand(o,routeIds,hand=o.players[o.viewer].hand){
 const held=colorCounts(hand),need=Object.fromEntries(COLORS.map(c=>[c,0])),assignments={};
 const routes=[...new Set(routeIds)].map(id=>ROUTE_BY_ID[id]).filter(r=>o.claimed[r.id]!==o.viewer);
 for(const r of routes.filter(r=>r.color!=='gray')){need[r.color]+=r.length;assignments[r.id]=r.color;}
 for(const r of routes.filter(r=>r.color==='gray').sort((a,b)=>b.length-a.length||a.id.localeCompare(b.id))){
  const color=COLORS.reduce((best,c)=>held[c]-need[c]+o.market.filter(x=>x===c).length*.15>held[best]-need[best]+o.market.filter(x=>x===best).length*.15?c:best,COLORS[0]);need[color]+=r.length;assignments[r.id]=color;
 }
 const deficits=Object.fromEntries(COLORS.map(c=>[c,Math.max(0,need[c]-held[c])])),rawMissing=Object.values(deficits).reduce((a,b)=>a+b,0);
 return {need,deficits,assignments,missingCards:Math.max(0,rawMissing-held.locomotive),wildsUsed:Math.min(rawMissing,held.locomotive)};
}
export function planningTicketPlan(o,ticketIds=o.players[o.viewer].tickets){
 const own=o.players[o.viewer],tickets=ticketIds.map(id=>TICKET_BY_ID[id]),network=new Set(),paths=[],importance=new Map();let blockedValue=0;
 const ordered=tickets.map(ticket=>({ticket,...planningPath(o,ticket.a,ticket.b)})).sort((a,b)=>a.cost/(a.ticket.value+3)-b.cost/(b.ticket.value+3)||a.ticket.id.localeCompare(b.ticket.id));
 for(const entry of ordered){const path=planningPath(o,entry.ticket.a,entry.ticket.b,network);if(!Number.isFinite(path.cost)){blockedValue+=entry.ticket.value;continue;}
  paths.push({...path,ticket:entry.ticket});for(const id of path.routes)if(o.claimed[id]!==o.viewer){network.add(id);importance.set(id,(importance.get(id)??0)+entry.ticket.value/Math.max(1,path.requiredTrains));}
 }
 const routes=[...network],requiredTrains=routes.reduce((n,id)=>n+ROUTE_BY_ID[id].length,0),demand=planningDemand(o,routes),value=tickets.reduce((n,t)=>n+t.value,0);
 const effort=routes.length+demand.missingCards*.6,overBudget=Math.max(0,requiredTrains-own.trains);
 return {routes,paths,importance,requiredTrains,demand,blockedValue,effort,utility:value*1.25-requiredTrains*.9-demand.missingCards*1.6-routes.length*1.8-overBudget*6-blockedValue*3};
}
function planningContext(o){
 const plan=planningTicketPlan(o),own=o.players[o.viewer],pool=Object.fromEntries(TRAIN_COLORS.map(c=>[c,c==='locomotive'?14:12]));
 // Public lower bounds only; never read opponent actual hands or any deck.
 for(const c of [...own.hand,...o.market,...o.discard,...o.players.filter(p=>p.seat!==o.viewer).flatMap(p=>p.knownHand)])if(c!==null)pool[c]=Math.max(0,pool[c]-1);
 return {o,plan,pool,owned:ROUTES.filter(r=>o.claimed[r.id]===o.viewer),endgame:!!o.finalRound||Math.min(...o.players.map(p=>p.trains))<=8};
}
function planningValue(context,a){
 const {o,plan,pool,owned,endgame}=context,own=o.players[o.viewer];
 if(a.type==='keepTickets')return planningTicketPlan(o,[...own.tickets,...a.keep.map(i=>o.offer[i])]).utility;
 if(a.type==='drawTickets')return plan.paths.every(p=>p.cost===0)&&!plan.blockedValue&&!endgame&&own.trains>=14?5:-15;
 if(a.type==='claim'){
  const r=ROUTE_BY_ID[a.route],importance=plan.importance.get(r.id)??0,afterHand=own.hand.slice();
  for(const c of [...Array(a.payment.count).fill(a.payment.color),...Array(a.payment.locomotive).fill('locomotive')])afterHand.splice(afterHand.indexOf(c),1);
  const remaining=plan.routes.filter(id=>id!==r.id),before=planningDemand(o,remaining),after=planningDemand(o,remaining,afterHand),opportunity=Math.max(0,after.missingCards-before.missingCards);
  let value=ROUTE_POINTS[r.length]*.9+importance*r.length*2-opportunity*.8-a.payment.locomotive*.8;
  for(const p of plan.paths)if(p.cost>0&&connected([...owned,r],p.ticket.a,p.ticket.b))value+=p.ticket.value*1.5;
  if(importance){const pressure=o.players.filter(p=>p.seat!==o.viewer).reduce((n,p)=>n+(p.handCount>=r.length?1:0),0);value+=pressure*.35;}
  if(own.trains-r.length<=2){const unfinished=plan.paths.filter(p=>!connected([...owned,r],p.ticket.a,p.ticket.b)).reduce((n,p)=>n+p.ticket.value,0)+plan.blockedValue;value+=unfinished?-unfinished*.5:6;}
  return value;
 }
 if(a.type==='drawTrain'){
  const gain=color=>{const next=planningDemand(o,plan.routes,[...own.hand,color]);return plan.demand.missingCards-next.missingCards;};
  const immediate=color=>plan.routes.some(id=>{const r=ROUTE_BY_ID[id],base=plan.demand.assignments[id],held=colorCounts(own.hand);return (color===base||color==='locomotive')&&r.length-held[base]-held.locomotive===1;});
  if(a.source==='blind'){const total=Object.values(pool).reduce((n,v)=>n+v,0)||1;return .65+TRAIN_COLORS.reduce((n,c)=>n+pool[c]*(gain(c)*2.5+(immediate(c)?1:0)),0)/total-(endgame?1.5:0);}
  const color=o.market[a.index],firstWild=color==='locomotive'&&o.phase==='turn',value=.55+gain(color)*2.5+(immediate(color)?1:0);
  return value*(firstWild?.65:1)-(endgame?1.5:0);
 }
 return 0;
}
export function createSearch({observation,actions,seed=1,policy='production-default'}) {
 if(!observation||!Array.isArray(actions))throw Error('Observation and legal root actions required');
 if(!['production-default',PLANNING_POLICY].includes(policy))throw Error('Unknown Ticket to Ride policy');
 return {observation,actions,seed:seed>>>0,policy,planning:policy===PLANNING_POLICY?planningContext(observation):null,iterations:0,rows:actions.map(action=>({action,samples:0,total:0}))};
}
export function runSearch(search,iterations=1) {
 for(let i=0;i<iterations;i++){if(!search.rows.length)break;const row=search.rows[search.iterations%search.rows.length];
  if(search.policy===PLANNING_POLICY){row.total+=planningValue(search.planning,row.action);row.samples++;search.iterations++;continue;}
  const belief=sampleBelief(search.observation,search.seed+Math.floor(search.iterations/search.rows.length));
  row.total+=evaluate(search.observation,row.action,belief);row.samples++;search.iterations++;}return search;
}
export function summarizeSearch(s){return {iterations:s.iterations,candidates:s.rows.length,pruned:0,rootCoverage:s.rows.filter(r=>r.samples).length,
 method:s.policy===PLANNING_POLICY?'Deterministic joint-ticket collection plan; no sampled worlds or win probability':'Sampled destination pressure and network-cost heuristic; no win probability',
 rows:s.rows.map(r=>({action:r.action,samples:r.samples,utility:r.samples?r.total/r.samples:null})).sort((a,b)=>(b.utility??-Infinity)-(a.utility??-Infinity))};}
