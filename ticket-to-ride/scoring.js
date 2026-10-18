import {ROUTES, ROUTE_BY_ID, ROUTE_POINTS, TICKET_BY_ID} from './catalog.js';

export function connected(routes, from, to) {
 const reached=new Set([from]);
 for(let changed=true;changed;) {changed=false;for(const r of routes) {
  if(reached.has(r.a)&&!reached.has(r.b)){reached.add(r.b);changed=true;}
  if(reached.has(r.b)&&!reached.has(r.a)){reached.add(r.a);changed=true;}
 }}
 return reached.has(to);
}

/** Exact maximum weighted trail: cities can repeat, individual lane IDs cannot. */
export function longestTrail(routes) {
 if(!routes.length)return {length:0,lanes:[]};
 const ids=new Set(); const adjacency=new Map();
 routes.forEach((r,i)=>{
  if(ids.has(r.id)||!Number.isInteger(r.length)||r.length<1)throw Error('Invalid trail graph');ids.add(r.id);
  for(const [a,b] of [[r.a,r.b],[r.b,r.a]]) {if(!adjacency.has(a))adjacency.set(a,[]);adjacency.get(a).push({i,to:b});}
 });
 const memo=new Map();
 function visit(city,used) {
  const key=`${city}:${used}`; if(memo.has(key))return memo.get(key);
  let best={length:0,lanes:[]};
  for(const {i,to} of adjacency.get(city)||[]) {
   const bit=1n<<BigInt(i); if(used&bit)continue;
   const rest=visit(to,used|bit), length=routes[i].length+rest.length;
   if(length>best.length)best={length,lanes:[routes[i].id,...rest.lanes]};
  }
  memo.set(key,best);return best;
 }
 let best={length:0,lanes:[]}; for(const c of adjacency.keys()){const found=visit(c,0n);if(found.length>best.length)best=found;}
 return best;
}
export function score(state) {
 const rows=state.players.map((p,seat)=>{
  const routes=ROUTES.filter(r=>state.claimed[r.id]===seat);
  const routePoints=routes.reduce((n,r)=>n+ROUTE_POINTS[r.length],0);
  const tickets=p.tickets.map(id=>{
   const t=TICKET_BY_ID[id]; return t?{id,complete:connected(routes,t.a,t.b),value:t.value}:null;
  });
  const trail=longestTrail(routes);
  return {seat,routePoints,tickets,trail,completedTickets:tickets.filter(t=>t?.complete).length,
   ticketPoints:tickets.some(t=>!t)?null:tickets.reduce((n,t)=>n+(t.complete?t.value:-t.value),0)};
 });
 const longest=Math.max(...rows.map(r=>r.trail.length));
 return rows.map(r=>({...r,longestBonus:r.trail.length===longest?10:0,
  total:r.ticketPoints===null?null:r.routePoints+r.ticketPoints+(r.trail.length===longest?10:0)}));
}
export function outcome(state) {
 if(state.phase!=='terminal')return null;
 const scores=score(state);if(scores.some(r=>r.total===null))return {complete:false,reason:'Reveal remaining destination tickets',scores};
 let winners=scores.filter(r=>r.total===Math.max(...scores.map(s=>s.total)));
 winners=winners.filter(r=>r.completedTickets===Math.max(...winners.map(s=>s.completedTickets)));
 if(winners.some(r=>r.longestBonus))winners=winners.filter(r=>r.longestBonus);
 return {complete:true,scores,winners:winners.map(r=>r.seat),shares:scores.map(r=>winners.includes(r)?1/winners.length:0)};
}
export function routeScore(id) {const r=ROUTE_BY_ID[id];if(!r)throw Error('Unknown route');return ROUTE_POINTS[r.length];}
