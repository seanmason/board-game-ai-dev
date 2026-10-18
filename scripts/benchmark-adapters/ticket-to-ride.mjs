import {performance} from 'node:perf_hooks';
import {newGame,legalActions,applyAction,assertValid,outcome,actionKey} from '../../ticket-to-ride/core.js';
import {publicObservation} from '../../ticket-to-ride/observations.js';
import {createSearch,runSearch,summarizeSearch} from '../../ticket-to-ride/ai.js';
import {CITIES,ROUTES,ROUTE_BY_ID,TICKET_BY_ID,ROUTE_POINTS,COLORS,CATALOG_GATES} from '../../ticket-to-ride/catalog.js';

export const metadata={game:'ticket-to-ride',supportedPlayers:[2,3,4,5],defaultBudget:{samples:128,maxTurns:600},scope:'match',
 policyId:'ttr-production-network-v1',opponentPolicyId:'ttr-independent-ticket-plan-v1',
 limitations:['Original 30-ticket catalog second visual audit remains open.','Sampled network heuristic, not calibrated win probability.','At least one complete root sweep can exceed requested sample count.','Exhausted supply and caps stay unresolved; no promotion conclusion.']};
const latency=values=>{const v=[...values].sort((a,b)=>a-b);return {count:v.length,totalMs:v.reduce((a,b)=>a+b,0),maxMs:v.at(-1)??0,p50Ms:v.length?v[Math.floor((v.length-1)*.5)]:0,p95Ms:v.length?v[Math.ceil((v.length-1)*.95)]:0};};
const hash=(seed,key)=>{let value=seed>>>0;for(const c of key)value=(Math.imul(value^c.charCodeAt(0),16777619))>>>0;return value;};
function usable(r,o){if(Object.hasOwn(o.claimed,r.id))return o.claimed[r.id]===o.viewer;
 return !(o.players.length<4&&r.parallelGroup&&ROUTES.some(m=>m.parallelGroup===r.parallelGroup&&Object.hasOwn(o.claimed,m.id)));}
/** Independent Dijkstra implementation returning a route witness; no production AI calls. */
function plannedPath(o,from,to,claimed=o.claimed){
 const distance=new Map(CITIES.map(c=>[c.id,Infinity])),previous=new Map(),todo=new Set(distance.keys());distance.set(from,0);
 while(todo.size){let at=null;for(const city of todo)if(at===null||distance.get(city)<distance.get(at))at=city;
  if(distance.get(at)===Infinity||at===to)break;todo.delete(at);
  for(const r of ROUTES){if(r.a!==at&&r.b!==at)continue;const view={...o,claimed};if(!usable(r,view))continue;
   const next=r.a===at?r.b:r.a,cost=claimed[r.id]===o.viewer?0:r.length,newDistance=distance.get(at)+cost;
   if(newDistance<distance.get(next)){distance.set(next,newDistance);previous.set(next,{from:at,route:r.id});}}
 }
 const routes=[];let city=to;while(previous.has(city)){const edge=previous.get(city);routes.unshift(edge.route);city=edge.from;}
 return {cost:distance.get(to),routes};
}
/** Practical opponent: finish inexpensive ticket plans, collect their missing colors, preserve wilds. */
export function chooseBaseline(observation,actions,{seed=1}={}){
 const o=observation,own=o.players[o.viewer],tickets=own.tickets.map(id=>TICKET_BY_ID[id]),plans=tickets.map(t=>({ticket:t,...plannedPath(o,t.a,t.b)}));
 const needs=new Map();for(const p of plans)if(p.cost>0&&Number.isFinite(p.cost))for(const id of p.routes)if(o.claimed[id]!==o.viewer)needs.set(id,(needs.get(id)||0)+p.ticket.value/(p.cost+3));
 const colorNeed=Object.fromEntries([...COLORS,'locomotive'].map(c=>[c,0]));
 for(const [id,priority]of needs){const r=ROUTE_BY_ID[id];const base=r.color==='gray'?COLORS.reduce((a,b)=>own.hand.filter(c=>c===a).length>=own.hand.filter(c=>c===b).length?a:b):r.color;
  const missing=r.length-own.hand.filter(c=>c===base||c==='locomotive').length;if(missing>0){colorNeed[base]+=priority/(1+missing);colorNeed.locomotive+=priority*.65/(1+missing);}}
 const values=actions.map(action=>{let value=-Infinity;
  if(action.type==='keepTickets')value=action.keep.reduce((sum,i)=>{const t=TICKET_BY_ID[o.offer[i]],plan=plannedPath(o,t.a,t.b);return sum+t.value-1.65*plan.cost;},0);
  else if(action.type==='claim'){
   const r=ROUTE_BY_ID[action.route],claimed={...o.claimed,[r.id]:o.viewer};value=ROUTE_POINTS[r.length]*.8-action.payment.locomotive*.9+(needs.get(r.id)||0)*2;
   plans.forEach(p=>{const next=plannedPath(o,p.ticket.a,p.ticket.b,claimed).cost;if(Number.isFinite(p.cost)&&Number.isFinite(next))value+=(p.cost-next)*1.5+(next===0&&p.cost>0?p.ticket.value:0);});
   if(own.trains-r.length<=2)value+=plans.every(p=>plannedPath(o,p.ticket.a,p.ticket.b,claimed).cost===0)?8:-12;
  }else if(action.type==='drawTrain')value=action.source==='blind'?1.1:(colorNeed[o.market[action.index]]||0)+(o.market[action.index]==='locomotive'?.8:1.3);
  else if(action.type==='drawTickets')value=plans.every(p=>p.cost===0)&&own.trains>12?5:-4;
  return {action,value,tie:hash(seed,actionKey(action))};
 });values.sort((a,b)=>b.value-a.value||a.tie-b.tie);return values[0]?.action??null;
}
export function chooseCandidate(observation,actions,{samples=128,seed=1}={}){
 const search=createSearch({observation,actions,seed});const iterations=Math.max(actions.length,Math.floor(samples));runSearch(search,iterations);const summary=summarizeSearch(search);
 return {action:summary.rows[0]?.action??null,diagnostics:{samples:summary.iterations,roots:summary.candidates,coveredRoots:summary.rootCoverage,pruned:summary.pruned}};
}
export async function runGame({seed=1,seat=0,players=2,budget={},policy='production-default',opponent='simple-v1',scope='match'}={}){
 if(!metadata.supportedPlayers.includes(players)||!Number.isInteger(seat)||seat<0||seat>=players)throw Error('Unsupported Ticket to Ride player/seat configuration');
 if(!['production-default',metadata.policyId].includes(policy)||!['simple-v1',metadata.opponentPolicyId].includes(opponent)||scope!=='match')throw Error('Unsupported Ticket to Ride benchmark policy/scope');
 const b={...metadata.defaultBudget,...budget};if(!Number.isInteger(b.samples)||b.samples<1||!Number.isInteger(b.maxTurns)||b.maxTurns<1)throw Error('Invalid benchmark budget');
 const start=performance.now(),candidateTimes=[],baselineTimes=[],allTimes=[],searches=[];let state=newGame({mode:'digital',players,seed,firstPlayer:(seed>>>0)%players}),turns=0,status='capped',illegalActions=0,error=null;
 while(turns<b.maxTurns){
  if(state.phase==='terminal'){status='complete';break;}if(state.phase==='supplyAdjudication'){status='unresolved';break;}
  const actor=state.turn,actions=legalActions(state,actor);if(!actions.length){status='unresolved';break;}
  // These policy functions receive only an actor projection and legal root choices.
  const observation=publicObservation(state,actor),began=performance.now();let action;
  try{if(actor===seat){const chosen=chooseCandidate(observation,actions,{samples:b.samples,seed:(seed>>>0)+turns});action=chosen.action;searches.push(chosen.diagnostics);}else action=chooseBaseline(observation,actions,{seed:(seed>>>0)+turns});
   const ms=performance.now()-began;(actor===seat?candidateTimes:baselineTimes).push(ms);allTimes.push(ms);
   if(!action||!actions.some(a=>actionKey(a)===actionKey(action)))throw Error('Policy returned illegal action');state=applyAction(state,action);assertValid(state);turns++;
  }catch(e){status='illegal';illegalActions++;error=String(e.message);break;}
 }
 if(state.phase==='terminal')status='complete';else if(state.phase==='supplyAdjudication')status='unresolved';
 const result=status==='complete'?outcome(state):null;if(result&&!result.complete)status='unresolved';const complete=status==='complete';
 const scores=complete?result.scores.map(s=>s.total):null;
 return {game:metadata.game,seed,seat,players,policyId:metadata.policyId,opponentPolicyId:metadata.opponentPolicyId,budget:b,scope,status,
  shares:complete?result.shares:null,winners:complete?result.winners:null,scores,margin:complete?scores[seat]-Math.max(...scores.filter((_,i)=>i!==seat)):null,
  turns,elapsedMs:performance.now()-start,latency:latency(candidateTimes),diagnostics:{illegalActions,capped:status==='capped',unresolved:status==='unresolved',error,
   phase:state.phase,reason:state.pending?.reason??null,startingPlayer:state.firstPlayer,baselineLatency:latency(baselineTimes),allLatency:latency(allTimes),
   candidateSamples:searches.reduce((n,s)=>n+s.samples,0),minimumRootCoverage:searches.length?Math.min(...searches.map(s=>s.roots?s.coveredRoots/s.roots:1)):null,
   actualSamplesCanExceedBudget:true,catalogGates:{...CATALOG_GATES},promotion:false}};
}
