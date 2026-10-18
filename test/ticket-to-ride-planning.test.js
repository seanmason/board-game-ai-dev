import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,applyAction,legalActions} from '../ticket-to-ride/core.js';
import {ROUTES,CITIES,COLORS} from '../ticket-to-ride/catalog.js';
import {publicObservation} from '../ticket-to-ride/observations.js';
import {planningRouteUsable,planningPath,planningDemand,planningTicketPlan,createSearch,runSearch,summarizeSearch} from '../ticket-to-ride/ai.js';
import {chooseCandidate,metadata,runGame} from '../scripts/benchmark-adapters/ticket-to-ride.mjs';
function ready(players=3){let s=newGame({mode:'digital',players,seed:33});while(s.setupRemaining)s=applyAction(s,legalActions(s)[0]);return s;}
// Observation fixtures isolate policy arithmetic, not independent map/rules certification.
function observation(players=3){return {viewer:0,turn:0,phase:'turn',players:Array.from({length:players},(_,seat)=>({seat,trains:45,handCount:4,ticketCount:0,knownHand:[],...(seat===0?{hand:[],tickets:[]}: {})})),market:['red','blue','white','orange','green'],discard:[],claimed:{},offer:[],finalRound:null};}
const lane=(a,b)=>ROUTES.find(r=>[r.a,r.b].includes(a)&&[r.a,r.b].includes(b));
function rank(o,actions){const q=createSearch({observation:o,actions,policy:'planning-v2'});runSearch(q,actions.length);return summarizeSearch(q);}
test('planning collects an actual matching color for a gray ticket lane, not a gray-card fiction',()=>{
 const o=observation();o.players[0].hand=['red'];o.players[0].tickets=['ticket-1'];o.claimed[lane('denver','santa-fe').id]=0;
 const report=rank(o,[{type:'drawTrain',source:'market',index:1},{type:'drawTrain',source:'market',index:0}]);assert.equal(report.rows[0].action.index,0);assert(report.rows[0].utility>report.rows[1].utility);
 const plan=planningTicketPlan(o);assert.equal(plan.requiredTrains,2);assert.equal(plan.demand.assignments[lane('el-paso','santa-fe').id],'red');
});
test('collection respects 2/3-player parallel closure, 4/5-player availability and own mate',()=>{
 const r=lane('vancouver','seattle'),mate=ROUTES.find(x=>x.id!==r.id&&x.parallelGroup===r.parallelGroup);
 for(const players of [2,3,4,5]){const o=observation(players);o.claimed[r.id]=1;assert.equal(planningRouteUsable(o,mate),players>=4);o.claimed[r.id]=0;assert.equal(planningRouteUsable(o,mate),false);assert.equal(planningRouteUsable(o,r),true);}
});
test('joint demand reserves colored cards before gray lanes and shares each wild only once',()=>{
 const o=observation(),red=ROUTES.find(r=>r.color==='red'&&r.length===6),gray=ROUTES.find(r=>r.color==='gray'&&r.length===2);o.players[0].hand=[...Array(6).fill('red'),'blue','blue','locomotive'];
 const d=planningDemand(o,[red.id,gray.id]);assert.equal(d.assignments[gray.id],'blue');assert.equal(d.missingCards,0);assert.equal(d.wildsUsed,0);
 const other=ROUTES.find(r=>r.color==='green'&&r.length===6);const deficit=planningDemand(o,[red.id,other.id,gray.id],['locomotive']);assert.equal(deficit.missingCards,13);assert.equal(deficit.wildsUsed,1);assert.equal(Object.values(deficit.need).reduce((a,b)=>a+b,0),14);
});
test('same claim conserves locomotives rather than spending them without a plan benefit',()=>{
 const o=observation(),r=ROUTES.find(r=>r.color==='red'&&r.length===2);o.players[0].hand=['red','red','locomotive'];
 const wild={type:'claim',route:r.id,payment:{color:'red',count:1,locomotive:1}},plain={type:'claim',route:r.id,payment:{color:'red',count:2,locomotive:0}};assert.equal(rank(o,[wild,plain]).rows[0].action,plain);
});
test('ticket subsets share a joint route union and reject over-train-budget optimism',()=>{
 const o=observation();o.players[0].hand=['red'];const first=planningTicketPlan(o,['ticket-1']),second=planningTicketPlan(o,['ticket-14']),joint=planningTicketPlan(o,['ticket-1','ticket-14']);assert(joint.requiredTrains<first.requiredTrains+second.requiredTrains);assert(joint.utility>first.utility+second.utility);
 o.players[0].trains=1;const short=planningPath(o,'denver','el-paso');assert(!Number.isFinite(short.cost));assert(planningTicketPlan(o,['ticket-1']).blockedValue>0);
});
test('final-round collection is less attractive than useful claim tempo',()=>{
 const o=observation(),r=ROUTES.find(r=>r.color==='red'&&r.length===2);o.players[0].hand=['red','red'];const actions=[{type:'drawTrain',source:'blind'},{type:'claim',route:r.id,payment:{color:'red',count:2,locomotive:0}}];o.finalRound={trigger:1,remaining:1};assert.equal(rank(o,actions).rows[0].action.type,'claim');
});
test('candidate never reads hidden truth and retains complete legal roots and immutability',()=>{
 const s=ready(),actions=legalActions(s),plain=publicObservation(s,0),copy=structuredClone(plain);
 for(let p=1;p<s.players.length;p++)for(const field of ['hand','tickets'])Object.defineProperty(s.players[p],field,{get(){throw Error('Opponent truth leaked');}});
 for(const field of ['trainDeck','ticketDeck','random'])Object.defineProperty(s,field,{get(){throw Error('Deck/RNG truth leaked');}});
 const obs=publicObservation(s,0);assert.deepEqual(obs,plain);const q=createSearch({observation:obs,actions,policy:'planning-v2'});runSearch(q,actions.length);const report=summarizeSearch(q);assert.equal(report.candidates,actions.length);assert.equal(report.rootCoverage,actions.length);assert.equal(report.pruned,0);assert(report.rows.every(r=>Number.isFinite(r.utility)));assert.deepEqual(obs,copy);
});
test('default remains bit-identical to explicit incumbent; paired hidden decks cannot affect candidate',()=>{
 const a=ready(),b=structuredClone(a);b.trainDeck.reverse();b.ticketDeck.reverse();const actions=legalActions(a),oa=publicObservation(a,0),ob=publicObservation(b,0);assert.deepEqual(oa,ob);
 const q=createSearch({observation:oa,actions,seed:41}),explicit=createSearch({observation:oa,actions,seed:41,policy:'production-default'});runSearch(q,actions.length);runSearch(explicit,actions.length);assert.deepEqual(summarizeSearch(q),summarizeSearch(explicit));assert.deepEqual(rank(oa,actions),rank(ob,actions));
 const result=chooseCandidate(oa,actions,{policy:'planning-v2',samples:128});assert.equal(result.diagnostics.samples,0);assert.equal(result.diagnostics.evaluations,actions.length);assert.equal(result.diagnostics.coveredRoots,actions.length);
});
test('adapter exposes candidate vs incumbent and simple comparator without fabricated cap outcomes',async()=>{
 const a=await runGame({seed:3,players:3,seat:0,policy:'planning-v2',opponent:'incumbent-v1',budget:{samples:1,maxTurns:4}});assert.equal(a.status,'capped');assert.equal(a.shares,null);assert.equal(a.policyId,metadata.candidatePolicyId);assert.equal(a.opponentPolicyId,metadata.incumbentPolicyId);assert.equal(a.diagnostics.candidateSamples,0);assert(a.diagnostics.opponentSamples>0);
 const b=await runGame({seed:3,players:3,seat:0,policy:'planning-v2',opponent:'simple-v1',budget:{samples:1,maxTurns:4}});assert.equal(b.opponentPolicyId,metadata.opponentPolicyId);assert.equal(b.shares,null);
});
