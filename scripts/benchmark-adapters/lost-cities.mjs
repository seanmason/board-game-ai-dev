import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {newGame,applyAction,legalActions} from '../../lost-cities/core.js';
import {publicObservation} from '../../lost-cities/observations.js';
import {heuristic,createSearch,runSearch,summary} from '../../lost-cities/ai.js';
import {CARDS} from '../../lost-cities/catalog.js';

export const metadata=Object.freeze({game:'lost-cities',supportedPlayers:[2],defaultBudget:{iterations:0},scope:'match',policyId:'lost-cities-browser-practical-v1',sampledPolicyId:'lost-cities-browser-sampled-horizon4-v1',opponentPolicyId:'lost-cities-immediate-expedition-v1',browserIterationLimit:300,limitations:['Default deterministic practical ranking runs no samples.','Optional sampled policy is separate, never substituted for default.','Strict booklet next starters use predeclared benchmark administration: (seed + nextRound - 1) mod2, independent of scores/controlled seat.','Discard-cycle caps are incomplete; no forced draw or terminal.']});
const key=a=>JSON.stringify([a.type,a.cardId??null,a.source??null]);
/** Independent one-step policy: extend plausible suits; ignore opponents and remembered pickups. */
export function comparator(obs,actions){const value=a=>{
 if(a.type==='draw'){if(a.source==='deck')return 1;const c=CARDS[obs.visibleTops[a.source]],col=obs.expeditions[obs.viewer][c.color],last=col.length?CARDS[col.at(-1)].value:0;return c.value>last&&col.length?c.value*.2:0;}
 const c=CARDS[a.cardId],col=obs.expeditions[obs.viewer][c.color],wagers=col.filter(id=>CARDS[id].value===0).length;
 if(a.type==='discard')return -.05*c.value;
 if(col.length)return c.value===0?0:c.value*(1+wagers);
 const held=obs.ownHand.filter(id=>CARDS[id].color===c.color).reduce((n,id)=>n+CARDS[id].value,0);return held>=24?(c.value===0?2:c.value*.4):-20+c.value;
 };return actions.reduce((b,a)=>value(a)>value(b)?a:b,actions[0]);}
export function production(obs,actions,{policy='production-default',iterations=64}={}){
 if(policy==='production-default')return {action:actions.map(action=>({action,value:heuristic(obs,action)})).sort((a,b)=>b.value-a.value)[0].action,iterations:0,roots:actions.length,coveredRoots:actions.length,terminalSamples:0,horizonCutoffs:0,cycleCutoffs:0};
 const q=createSearch(obs,{actions,seed:1321,horizon:4}),actual=Math.max(iterations,actions.length);runSearch(q,actual);const r=summary(q);return {action:r.candidates[0].action,iterations:actual,roots:actions.length,coveredRoots:r.candidates.filter(c=>c.visits).length,terminalSamples:r.terminalSamples,horizonCutoffs:r.horizonCutoffs,cycleCutoffs:r.cycleCutoffs};
}
const latency=times=>{const a=times.slice().sort((x,y)=>x-y);return {count:a.length,totalMs:a.reduce((x,y)=>x+y,0),maxMs:a.at(-1)??0,p50Ms:a.length?a[Math.ceil(a.length*.5)-1]:0,p95Ms:a.length?a[Math.ceil(a.length*.95)-1]:0};};
export async function runGame({seed=1,seat=0,players=2,budget={iterations:0},policy='production-default',opponent='simple-v1',scope='match',maxTurns=2400,starter=0}={}){
 if(players!==2||![0,1].includes(seat)||!Number.isInteger(seed)||seed<0||seed>0xffffffff||!['match','round'].includes(scope)||!['production-default','sampled'].includes(policy)||opponent!=='simple-v1'||!Number.isInteger(budget.iterations)||budget.iterations<0||(policy==='sampled'&&budget.iterations<1)||!Number.isInteger(maxTurns)||maxTurns<1)throw Error('Invalid Lost Cities benchmark options');
 let s=newGame({players,mode:'digital',seed,starter}),status='complete',error=null,turns=0,iterations=0,roots=0,coveredRoots=0,terminalSamples=0,horizonCutoffs=0,cycleCutoffs=0;const times=[],opponentTimes=[],digest=createHash('sha256'),started=performance.now(),starterSchedule=[(seed+1)%2,(seed+2)%2];
 try{while(s.phase!=='gameover'&&!(scope==='round'&&s.phase==='choose-starter')){
  if(turns>=maxTurns){status='capped';break;}
  if(s.phase==='choose-starter'){const a={type:'chooseStarter',starter:starterSchedule[s.round-1],basis:'benchmark predeclared seed/round parity; not a publisher ruling'};s=applyAction(s,a);digest.update(JSON.stringify(a)+'\n');continue;}
  if(!['place','draw'].includes(s.phase)){status='unresolved';error=`Unexpected phase ${s.phase}`;break;}
  const actions=legalActions(s),obs=publicObservation(s,s.current),t0=performance.now();let a;if(!actions.length){status='unresolved';error='No legal action';break;}
  if(s.current===seat){let r;try{r=production(obs,actions,{policy,iterations:budget.iterations});}catch(e){status='unresolved';error=`Analysis: ${e.message}`;break;}a=r.action;iterations+=r.iterations;roots+=r.roots;coveredRoots+=r.coveredRoots;terminalSamples+=r.terminalSamples;horizonCutoffs+=r.horizonCutoffs;cycleCutoffs+=r.cycleCutoffs;times.push(performance.now()-t0);}else{a=comparator(obs,actions);opponentTimes.push(performance.now()-t0);}
  if(!actions.some(x=>key(x)===key(a))){status='illegal';error='Policy selected an illegal action';break;}
  digest.update(JSON.stringify(a)+'\n');try{s=applyAction(s,a);}catch(e){status='illegal';error=e.message;break;}turns++;
 }}catch(e){status='unresolved';error=e.message;}
 const scores=status==='complete'?s.scores.slice():null,winners=scores?scores.flatMap((v,p)=>v===Math.max(...scores)?[p]:[]):null,shares=winners?[0,1].map(p=>winners.includes(p)?1/winners.length:0):null;
 return {game:metadata.game,seed,seat,players,policyId:policy==='sampled'?metadata.sampledPolicyId:metadata.policyId,opponentPolicyId:metadata.opponentPolicyId,budget:{iterations:policy==='sampled'?budget.iterations:0,requestedIterations:budget.iterations,rootCoverageFloor:policy==='sampled',horizon:policy==='sampled'?4:null},scope,status,shares,winners,scores,margin:scores?scores[seat]-scores[1-seat]:null,turns,elapsedMs:performance.now()-started,latency:latency(times),opponentLatency:latency(opponentTimes),diagnostics:{starter,starterSchedule,rounds:s.round,roundScores:s.roundScores.map(r=>r.map(p=>p.total)),iterations,roots,coveredRoots,terminalSamples,horizonCutoffs,cycleCutoffs,illegal:status==='illegal'?1:0,capped:status==='capped'?1:0,unresolved:status==='unresolved'?1:0,error,transcriptHash:digest.digest('hex'),browserSearchSeed:policy==='sampled'?1321:null}};
}
