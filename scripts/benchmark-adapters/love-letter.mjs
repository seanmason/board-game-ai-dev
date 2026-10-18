import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {newGame,applyAction,legalActions} from '../../love-letter/core.js';
import {publicObservation} from '../../love-letter/observations.js';
import {createSearch,runSearch,summary} from '../../love-letter/ai.js';
import {CARDS} from '../../love-letter/catalog.js';

export const metadata=Object.freeze({game:'love-letter',supportedPlayers:[2,3,4],defaultBudget:{iterations:64},scope:'match',policyId:'love-letter-browser-sampled-v1',opponentPolicyId:'love-letter-high-card-public-knowledge-v1',browserIterationLimit:512,limitations:['Explicit benchmark budget below browser512 sample ceiling by default.','Production optimizes round share, not match share.','Comparator retains high ranks and exploits public copies/own private memory without rollouts.']});
const key=a=>JSON.stringify([a.type,a.cardRank,a.target,a.guess]);
/** Independently coded high-card policy, with actual actor knowledge only. */
export function comparator(obs,actions){const value=a=>{
 const keep=obs.ownHand.slice();keep.splice(keep.indexOf(a.cardRank),1);const rank=keep[0]??0,known=obs.memories[a.target]?.known;let v=rank;
 if(a.cardRank===8)return -1000;
 if([1,2,3,5,6].includes(a.cardRank)&&a.target===undefined)return v;
 if(a.cardRank===1){const left=CARDS[a.guess].count-obs.discards.flat().filter(c=>c.rank===a.guess).length-obs.exclusions.filter(r=>r===a.guess).length-obs.ownHand.filter(r=>r===a.guess).length;v+=known?(known===a.guess?20:-10):Math.max(0,left)*.3;}
 if(a.cardRank===3)v+=known?(rank>known?15:rank<known?-20:0):(rank<=3?-3:0);
 if(a.cardRank===5)v+=a.target===obs.viewer?(rank===8?30:-rank):known===8?20:0;
 if(a.cardRank===6&&known)v+=known-rank;return v;
 };return actions.reduce((b,a)=>value(a)>value(b)?a:b,actions[0]);}
/** Observation-only production boundary. Seed matches the browser worker. */
export function production(obs,actions,{iterations=64}={}){const q=createSearch(obs,{actions,seed:173}),actual=Math.max(iterations,actions.length);runSearch(q,actual);const r=summary(q);return {action:r.candidates[0].action,iterations:actual,roots:actions.length,coveredRoots:r.candidates.filter(c=>c.visits).length};}
const latency=times=>{const a=times.slice().sort((x,y)=>x-y);return {count:a.length,totalMs:a.reduce((x,y)=>x+y,0),maxMs:a.at(-1)??0,p50Ms:a.length?a[Math.ceil(a.length*.5)-1]:0,p95Ms:a.length?a[Math.ceil(a.length*.95)-1]:0};};
export async function runGame({seed=1,seat=0,players=2,budget={iterations:64},policy='production-default',opponent='simple-v1',scope='match',maxTurns=2000,starter=0}={}){
 if(!metadata.supportedPlayers.includes(players)||!Number.isInteger(seat)||seat<0||seat>=players||!Number.isInteger(seed)||seed<0||seed>0xffffffff||!['match','round'].includes(scope)||policy!=='production-default'||opponent!=='simple-v1'||!Number.isInteger(budget.iterations)||budget.iterations<1||!Number.isInteger(maxTurns)||maxTurns<1)throw Error('Invalid Love Letter benchmark options');
 let s=newGame({players,mode:'digital',seed,starter}),status='complete',error=null,turns=0,iterations=0,roots=0,coveredRoots=0;const times=[],opponentTimes=[],digest=createHash('sha256'),started=performance.now();
 try{while(s.phase!=='gameover'&&!(scope==='round'&&s.phase==='roundEnd')){
  if(turns>=maxTurns){status='capped';break;}const actions=legalActions(s);if(!actions.length){status='unresolved';error=`No legal action in ${s.phase}`;break;}let a=actions[0];
  if(s.phase==='choosePlay'){const obs=publicObservation(s,s.current),t0=performance.now();if(s.current===seat){let r;try{r=production(obs,actions,budget);}catch(e){status='unresolved';error=`Analysis: ${e.message}`;break;}a=r.action;iterations+=r.iterations;roots+=r.roots;coveredRoots+=r.coveredRoots;times.push(performance.now()-t0);}else{a=comparator(obs,actions);opponentTimes.push(performance.now()-t0);}}
  if(!actions.some(x=>key(x)===key(a))){status='illegal';error='Policy selected an illegal action';break;}
  digest.update(JSON.stringify(a)+'\n');try{s=applyAction(s,a);}catch(e){status='illegal';error=e.message;break;}turns++;
 }}catch(e){status='unresolved';error=e.message;}
 const winners=status==='complete'?(scope==='round'?s.roundWinners:s.winners):null,shares=winners?Array.from({length:players},(_,p)=>winners.includes(p)?1/winners.length:0):null;
 return {game:metadata.game,seed,seat,players,policyId:metadata.policyId,opponentPolicyId:metadata.opponentPolicyId,budget:{iterations:budget.iterations,rootCoverageFloor:true},scope,status,shares,winners,scores:shares?s.affection.slice():null,margin:null,turns,elapsedMs:performance.now()-started,latency:latency(times),opponentLatency:latency(opponentTimes),diagnostics:{starter,rounds:s.round,iterations,roots,coveredRoots,illegal:status==='illegal'?1:0,capped:status==='capped'?1:0,unresolved:status==='unresolved'?1:0,error,transcriptHash:digest.digest('hex'),browserSearchSeed:173,scoreMeaning:'Affection tokens; no card-rank margin substitutes for match outcome.'}};
}
