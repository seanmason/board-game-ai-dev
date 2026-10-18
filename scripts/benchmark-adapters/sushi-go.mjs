import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {newGame,applyAction,legalActions} from '../../sushi-go/core.js';
import {publicObservation} from '../../sushi-go/observations.js';
import {createSearch,runSearch,summary} from '../../sushi-go/ai.js';
import {TYPES,typeOf} from '../../sushi-go/catalog.js';

export const metadata=Object.freeze({game:'sushi-go',supportedPlayers:[2,3,4,5],defaultBudget:{iterations:64},scope:'match',policyId:'sushi-go-browser-sampled-v1',opponentPolicyId:'sushi-go-local-set-greedy-v1',browserIterationLimit:256,limitations:['Explicit benchmark budget below browser256 sample ceiling by default.','Production rollouts finish the current round only.','Comparator uses immediate sets, ordered nigiri and fixed future-card bonuses, without packet inference or opponent modeling.','Full matches include all3rounds, pudding and pudding-count tiebreaks.']});
const key=a=>JSON.stringify([a.type,a.actor,a.cards,a.returnId??null]);
/** Independently coded local scorer, not the production heuristic. */
export function comparator(obs,actions){const value=a=>{
 const c={};for(const e of obs.tableaux[obs.viewer]){const t=typeOf(e.id);c[t]=(c[t]??0)+1;}
 let empty=(c.wasabi??0)-obs.tableaux[obs.viewer].filter(e=>e.wasabi).length,total=0;
 for(const t of a.cards){const n=(c[t]??0)+1;c[t]=n;
  if(t==='tempura')total+=n%2===0?5:1;
  else if(t==='sashimi')total+=n%3===0?10:1;
  else if(t==='dumpling')total+=[1,2,3,4,5,0][Math.min(n,6)-1];
  else if(TYPES[t].nigiri){total+=TYPES[t].nigiri*(empty>0?3:1);if(empty>0)empty--;}
  else if(t==='wasabi'){empty++;total+=obs.remaining>2?1:0;}
  else if(TYPES[t].maki)total+=TYPES[t].maki*.7;
  else if(t==='pudding')total+=1;
  else if(t==='chopsticks')total+=obs.remaining>3?.5:0;
 }return total;
 };return actions.reduce((b,a)=>value(a)>value(b)?a:b,actions[0]);}
export function production(obs,actions,{iterations=64}={}){const q=createSearch(obs,{actions,seed:611}),actual=Math.max(iterations,actions.length);runSearch(q,actual);const r=summary(q);return {action:r.candidates[0].action,iterations:actual,roots:actions.length,coveredRoots:r.candidates.filter(c=>c.visits).length};}
const latency=times=>{const a=times.slice().sort((x,y)=>x-y);return {count:a.length,totalMs:a.reduce((x,y)=>x+y,0),maxMs:a.at(-1)??0,p50Ms:a.length?a[Math.ceil(a.length*.5)-1]:0,p95Ms:a.length?a[Math.ceil(a.length*.95)-1]:0};};
export async function runGame({seed=1,seat=0,players=2,budget={iterations:64},policy='production-default',opponent='simple-v1',scope='match',maxTurns=100}={}){
 if(!metadata.supportedPlayers.includes(players)||!Number.isInteger(seat)||seat<0||seat>=players||!Number.isInteger(seed)||seed<0||seed>0xffffffff||!['match','round'].includes(scope)||policy!=='production-default'||opponent!=='simple-v1'||!Number.isInteger(budget.iterations)||budget.iterations<1||!Number.isInteger(maxTurns)||maxTurns<1)throw Error('Invalid Sushi Go benchmark options');
 let s=newGame({players,mode:'digital',seed}),status='complete',error=null,turns=0,iterations=0,roots=0,coveredRoots=0;const times=[],opponentTimes=[],digest=createHash('sha256'),started=performance.now();
 try{while(s.phase!=='gameover'&&!(scope==='round'&&s.phase==='roundEnd')){
  if(turns>=maxTurns){status='capped';break;}
  if(s.phase==='roundEnd'){s=applyAction(s,{type:'nextRound'});continue;}
  if(s.phase!=='choose'){status='unresolved';error=`Unexpected phase ${s.phase}`;break;}
  // All policies see the same pre-commit position; no current hidden commitment can leak.
  const joint=[];for(let p=0;p<players;p++){
   const actions=legalActions(s,p),obs=publicObservation(s,p),t0=performance.now();let a;
   if(!actions.length){status='unresolved';error='No legal draft choice';break;}
   if(p===seat){let r;try{r=production(obs,actions,budget);}catch(e){status='unresolved';error=`Analysis: ${e.message}`;break;}a=r.action;iterations+=r.iterations;roots+=r.roots;coveredRoots+=r.coveredRoots;times.push(performance.now()-t0);}else{a=comparator(obs,actions);opponentTimes.push(performance.now()-t0);}
   if(!actions.some(x=>key(x)===key(a))){status='illegal';error='Policy selected an illegal commitment';break;}joint.push(a);
  }
  if(status!=='complete')break;
  try{for(const a of joint){digest.update(JSON.stringify(a)+'\n');s=applyAction(s,a);}s=applyAction(s,{type:'reveal'});}catch(e){status='illegal';error=e.message;break;}turns++;
 }}catch(e){status='unresolved';error=e.message;}
 const scores=status==='complete'?s.scores.slice():null,winners=scores?(scope==='match'?s.winners:scores.flatMap((v,p)=>v===Math.max(...scores)?[p]:[])):null,shares=winners?Array.from({length:players},(_,p)=>winners.includes(p)?1/winners.length:0):null;
 return {game:metadata.game,seed,seat,players,policyId:metadata.policyId,opponentPolicyId:metadata.opponentPolicyId,budget:{iterations:budget.iterations,rootCoverageFloor:true},scope,status,shares,winners,scores,margin:scores?scores[seat]-scores.filter((_,p)=>p!==seat).reduce((a,b)=>a+b,0)/(players-1):null,turns,elapsedMs:performance.now()-started,latency:latency(times),opponentLatency:latency(opponentTimes),diagnostics:{rounds:s.round,iterations,roots,coveredRoots,illegal:status==='illegal'?1:0,capped:status==='capped'?1:0,unresolved:status==='unresolved'?1:0,error,transcriptHash:digest.digest('hex'),browserSearchSeed:611,marginMeaning:'Controlled seat minus mean opponent score; full match includes pudding.'}};
}
