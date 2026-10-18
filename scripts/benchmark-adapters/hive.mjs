import {performance} from 'node:perf_hooks';
import {newGame,legalActions,applyAction,assertValid,outcome,boardResult,positionKey} from '../../hive/core.js';
import {createSearch,runSearch,summarizeSearch} from '../../hive/ai.js';
import {actionKey,locate} from '../../hive/actions.js';
import {PIECES,queenId} from '../../hive/catalog.js';
import {neighbors,height,coordinate,lift,connected} from '../../hive/geometry.js';
import {publicObservation} from '../../hive/observations.js';

export const metadata={game:'hive',supportedPlayers:[2],defaultBudget:{ms:100,maxTurns:160,repetitionLimit:4},scope:'match',
 policyId:'hive-production-alphabeta-v1',opponentPolicyId:'hive-independent-tactical-liberties-v1',
 limitations:['Classic Hive publisher diagram certification remains open.','Candidate uses completed iterative alpha-beta depths with a full depth-one floor; 100ms is a soft budget.','Independent baseline scans immediate wins and one-reply losses before queen-liberty ranking.','Repeated positions and caps are unresolved, not automatic draws.','Time budgets can overrun one synchronous generator step; latency records actual time.']};
const latency=values=>{const v=[...values].sort((a,b)=>a-b);return {count:v.length,totalMs:v.reduce((a,b)=>a+b,0),maxMs:v.at(-1)??0,p50Ms:v.length?v[Math.floor((v.length-1)*.5)]:0,p95Ms:v.length?v[Math.ceil((v.length-1)*.95)]:0};};
const hash=(seed,key)=>{let n=seed>>>0;for(const c of key)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n;};
function liberties(s,seat){const q=locate(s.board,queenId(seat));return q?neighbors(q.at).filter(p=>height(s.board,p)===0).length:6;}
/** Independent one-ply material/mobility estimate; not the production evaluate function. */
function practicalValue(s,viewer){
 const result=boardResult(s);if(result)return result.winner===null?0:result.winner===viewer?1e6:-1e6;
 const freedom=seat=>{let movable=0,pins=0;for(const [at,stack]of Object.entries(s.board)){if(PIECES[stack.at(-1)].player!==seat)continue;
  if(connected(lift(s.board,coordinate(at))))movable++;if(stack.length>1&&PIECES[stack[0]].player!==seat)pins++;}
  return movable*1.5+pins*4+(11-s.reserves[seat].length)*.35;};
 return (liberties(s,viewer)-liberties(s,1-viewer))*14+freedom(viewer)-freedom(1-viewer);
}
/** Full immediate-win scan; highest-ranked safe move avoids every immediate reply win. */
export function chooseBaseline(state,{seed=1,replyChecks=true}={}){
 const viewer=state.currentPlayer,rows=legalActions(state).map(action=>{const child=applyAction(state,action);return {action,child,value:practicalValue(child,viewer),tie:hash(seed,actionKey(action))};});
 rows.sort((a,b)=>b.value-a.value||a.tie-b.tie);const win=rows.find(row=>boardResult(row.child)?.winner===viewer);if(win)return {action:win.action,replyNodes:0};
 let replyNodes=0;if(replyChecks)for(const row of rows){let loses=false;
  if(row.child.phase==='play')for(const reply of legalActions(row.child)){replyNodes++;if(boardResult(applyAction(row.child,reply))?.winner===1-viewer){loses=true;break;}}
  if(!loses)return {action:row.action,replyNodes};
 }
 return {action:rows[0]?.action??null,replyNodes};
}
export function chooseCandidate(observation,{ms=100,maxDepth=5}={}){
 const search=createSearch({observation,maxDepth}),start=performance.now();let iterations=0;
 while(!search.done&&(search.completedDepth===0||performance.now()-start<ms)){runSearch(search,1);iterations++;}
 const summary=summarizeSearch(search);const fallback=false;
 // Unvisited/partially evaluated deeper roots never replace a completed result.
 const chosen=summary.candidates[0]?.action;
 return {action:chosen??null,diagnostics:{nodes:summary.nodes,iterations,completedDepth:summary.completedDepth,searchedRoots:summary.searchedRoots,legalRoots:summary.legalRoots,fallback}};
}
export async function runGame({seed=1,seat=0,players=2,budget={},policy='production-default',opponent='simple-v1',scope='match'}={}){
 if(players!==2||![0,1].includes(seat))throw Error('Hive benchmark supports two players and seats0/1');
 if(!['production-default',metadata.policyId].includes(policy)||!['simple-v1',metadata.opponentPolicyId].includes(opponent)||scope!=='match')throw Error('Unsupported Hive benchmark policy/scope');
 const b={...metadata.defaultBudget,...budget};if(!Number.isFinite(b.ms)||b.ms<=0||!Number.isInteger(b.maxTurns)||b.maxTurns<1||!Number.isInteger(b.repetitionLimit)||b.repetitionLimit<2)throw Error('Invalid Hive benchmark budget');
 const start=performance.now(),candidateTimes=[],baselineTimes=[],searches=[],positions=new Map();let state=newGame({mode:'digital',startingPlayer:(seed>>>0)%2}),turns=0,status='capped',error=null,illegalActions=0,replyNodes=0,reason=null;
 while(turns<b.maxTurns){
  if(state.phase==='gameover'){status='complete';break;}if(state.phase==='stalemate-review'){status='unresolved';reason='two-forced-passes';break;}
  const key=positionKey(state),visits=(positions.get(key)||0)+1;positions.set(key,visits);if(visits>=b.repetitionLimit){status='unresolved';reason='benchmark-repetition-limit';break;}
  const actor=state.currentPlayer,observation=publicObservation(state,actor),actions=legalActions(state),began=performance.now();let action;
  try{if(actor===seat){const chosen=chooseCandidate(observation,b);action=chosen.action;searches.push(chosen.diagnostics);}else{const chosen=chooseBaseline(observation,{seed:(seed>>>0)+turns});action=chosen.action;replyNodes+=chosen.replyNodes;}
   (actor===seat?candidateTimes:baselineTimes).push(performance.now()-began);
   if(!action||!actions.some(a=>actionKey(a)===actionKey(action)))throw Error('Policy returned illegal action');state=applyAction(state,action);assertValid(state);turns++;
  }catch(e){status='illegal';illegalActions++;error=String(e.message);break;}
 }
 if(state.phase==='gameover')status='complete';else if(state.phase==='stalemate-review'){status='unresolved';reason='two-forced-passes';}
 const result=status==='complete'?outcome(state):null,complete=status==='complete';
 return {game:metadata.game,seed,seat,players,policyId:metadata.policyId,opponentPolicyId:metadata.opponentPolicyId,budget:b,scope,status,
  shares:complete?result.shares:null,winners:complete?(result.winner===null?[0,1]:[result.winner]):null,scores:null,margin:null,
  turns,elapsedMs:performance.now()-start,latency:latency(candidateTimes),diagnostics:{illegalActions,capped:status==='capped',unresolved:status==='unresolved',error,reason:reason??result?.reason??null,
   phase:state.phase,startingPlayer:state.startingPlayer,baselineLatency:latency(baselineTimes),allLatency:latency([...candidateTimes,...baselineTimes]),baselineReplyNodes:replyNodes,
   candidateNodes:searches.reduce((n,s)=>n+s.nodes,0),completedDepths:searches.map(s=>s.completedDepth),fallbackDecisions:searches.filter(s=>s.fallback).length,promotion:false}};
}
