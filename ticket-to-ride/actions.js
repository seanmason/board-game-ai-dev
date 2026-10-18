import {COLORS, ROUTES} from './catalog.js';
export function claimPayments(route,hand,allowUnknown=false) {
 if(hand.some(c=>c===null)&&!allowUnknown)return [];
 const unknown=allowUnknown?hand.filter(c=>c===null).length:0;
 const counts=Object.fromEntries([...COLORS,'locomotive'].map(c=>[c,hand.filter(x=>x===c).length]));
 const payments=[];
 for(const color of route.color==='gray'?COLORS:[route.color]) {
  for(let wild=0;wild<=route.length;wild++) {
   if(Math.max(0,wild-counts.locomotive)+Math.max(0,route.length-wild-counts[color])>unknown)continue;
   if(wild===route.length&&payments.some(p=>p.locomotive===wild))continue;
   payments.push({color:wild===route.length?'locomotive':color,count:route.length-wild,locomotive:wild});
  }
 }
 return payments;
}
export function routeAvailable(state,route,seat) {
 if(Object.hasOwn(state.claimed,route.id)||state.players[seat].trains<route.length)return false;
 if(route.parallelGroup) {
  const mates=ROUTES.filter(r=>r.parallelGroup===route.parallelGroup&&Object.hasOwn(state.claimed,r.id));
  if(mates.some(r=>state.claimed[r.id]===seat)||state.players.length<4&&mates.length)return false;
 }
 return true;
}
export function retentionSubsets(count,minimum) {
 const results=[];for(let mask=1;mask<(1<<count);mask++){
  const indices=Array.from({length:count},(_,i)=>i).filter(i=>mask&(1<<i));
  if(indices.length>=minimum)results.push(indices);
 }return results;
}
