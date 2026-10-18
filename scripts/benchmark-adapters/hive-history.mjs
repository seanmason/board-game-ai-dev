/** Research-only history-v1. Frozen from hive/ai.js at 37b2e10388d91a9161cfad798cfd80b99081bc82.
 * Only equal root evaluations use frozen public played-position visit counts,
 * then the original lexical action key. No repetition adjudication or pruning.
 * This module is not used by the browser policy.
 */
import {PIECES,queenId} from '../../hive/catalog.js';
import {legalActions,locate,describe,actionKey} from '../../hive/actions.js';
import {applyAction,positionKey,boardResult} from '../../hive/core.js';
import {neighbors,height,coordinate,top,lift,connected} from '../../hive/geometry.js';
export const WIN=100000;
export function evaluate(s,viewer){const result=s.result??boardResult(s);if(result)return result.winner===null?0:result.winner===viewer?WIN:-WIN;const value=p=>{const q=locate(s.board,queenId(p)),liberties=q?neighbors(q.at).filter(n=>!height(s.board,n)).length:6;let movable=0,pins=0;for(const k of Object.keys(s.board)){const id=s.board[k].at(-1);if(PIECES[id].player!==p)continue;if(q&&connected(lift(s.board,coordinate(k))))movable++;if(s.board[k].length>1&&PIECES[s.board[k][0]].player!==p)pins++;}return liberties*12+movable*2+pins*3+(11-s.reserves[p].length)*.25;};return value(viewer)-value(1-viewer);}
function terminalValue(s,viewer,ply){const r=s.result??boardResult(s);return !r?null:r.winner===null?0:r.winner===viewer?WIN-ply:-WIN+ply;}
/** Yields at every visited node. A completed depth replaces the prior result
 * atomically; partially searched deeper roots never masquerade as full depth. */
function* minimax(s,depth,alpha,beta,viewer,ancestors,search,ply){search.nodes++;yield;const exact=terminalValue(s,viewer,ply);if(exact!==null)return exact;const hash=positionKey(s);if(ancestors.has(hash)){search.cycleEstimates++;return 0;}if(s.phase==='stalemate-review')return 0;if(depth===0)return evaluate(s,viewer);const cacheKey=`${hash}|${depth}|${ply}|${[...ancestors].sort().join('~')}`;const cached=search.table.get(cacheKey);if(cached!==undefined){search.tableHits++;return cached;}const maximizing=s.currentPlayer===viewer;let best=maximizing?-Infinity:Infinity,cut=false;const nextAncestors=new Set(ancestors);nextAncestors.add(hash);const actions=legalActions(s);actions.sort((a,b)=>(search.order.get(actionKey(b))??0)-(search.order.get(actionKey(a))??0)||actionKey(a).localeCompare(actionKey(b)));
 for(const a of actions){const child=applyAction(s,a),v=yield* minimax(child,depth-1,alpha,beta,viewer,nextAncestors,search,ply+1);best=maximizing?Math.max(best,v):Math.min(best,v);if(maximizing)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(alpha>=beta){cut=true;break;}}
 // Ancestor-sensitive cycle estimates must not be cached as general exact values.
 if(!cut&&search.cycleEstimates===0)search.table.set(cacheKey,best);return best;}
export function compareHistoryRows(search,a,b){return b.evaluation-a.evaluation||(search.rootVisits.get(actionKey(a.action))??0)-(search.rootVisits.get(actionKey(b.action))??0)||actionKey(a.action).localeCompare(actionKey(b.action));}
const rank=(search,rows)=>rows.sort((a,b)=>compareHistoryRows(search,a,b));
/** Check one opponent reply per cooperative step. A known winning reply is a
 * sufficient loss witness; safe requires exhausting every legal reply. */
function* verifyRoot(search,row){
 const info=search.tactics.get(actionKey(row.action));if(info.status!=='unverified')return info.status;
 search.stage='reply-scan';const viewer=search.state.currentPlayer;
 for(const reply of legalActions(info.child)){
  yield;const next=applyAction(info.child,reply);search.nodes++;search.tacticalReplyNodes++;info.repliesChecked++;
  if((next.result??boardResult(next))?.winner===1-viewer){info.status='losing';info.witness=reply;return info.status;}
 }
 info.status='safe';return info.status;
}
function* guardedRanking(search,rows){
 for(const row of rows){const status=yield* verifyRoot(search,row);if(status==='safe'||status==='winning'){
  // Withhold unverified suggestions, rather than imply that shallow scores
  // prove safety. The complete human action surface is unchanged.
  return rows.filter(r=>['safe','winning'].includes(search.tactics.get(actionKey(r.action)).status));
 }}
 // Every legal root has a demonstrated immediate losing reply. Report the
 // proven two-ply loss rather than leave an attractive heuristic on display.
 return rows.map(row=>({...row,evaluation:search.tactics.get(actionKey(row.action)).child.phase==='gameover'?-WIN+1:-WIN+2}));
}
function* iterative(search){
 const s=search.state,viewer=s.currentPlayer,first=[];search.stage='root-scan';
 // First inspect every root for an immediate win, before generic evaluation can
 // choose a superficially attractive but losing alternative.
 for(const action of search.roots){yield;const child=applyAction(s,action),result=child.result??boardResult(child);search.nodes++;search.rootScanCount++;
  const status=result?(result.winner===viewer?'winning':result.winner===null?'safe':'losing'):'unverified';
  search.tactics.set(actionKey(action),{child,status,repliesChecked:0,witness:null});
  search.rootVisits.set(actionKey(action),search.playedVisits.get(positionKey(child))??0);
  first.push({action,label:describe(action),evaluation:terminalValue(child,viewer,1)??evaluate(child,viewer),terminal:child.phase==='gameover'});search.depthRoots=first.length;
 }
 rank(search,first);const wins=first.filter(r=>search.tactics.get(actionKey(r.action)).status==='winning');
 search.candidates=wins.length?wins:yield* guardedRanking(search,first);search.tacticalReady=true;search.completedDepth=1;search.depthRoots=0;
 if(wins.length){search.stage='complete';return;}
 search.roots=first.map(r=>r.action);search.order=new Map(first.map(r=>[actionKey(r.action),r.evaluation]));yield;
 for(let depth=2;depth<=search.maxDepth;depth++){
  search.stage='deepening';const rows=[];for(const action of search.roots){const child=search.tactics.get(actionKey(action)).child,value=yield* minimax(child,depth-1,-Infinity,Infinity,viewer,new Set([positionKey(s)]),search,1);
   rows.push({action,label:describe(action),evaluation:value,terminal:child.phase==='gameover'});search.depthRoots=rows.length;}
  rank(search,rows);const guarded=yield* guardedRanking(search,rows);search.candidates=guarded;search.completedDepth=depth;search.roots=rows.map(r=>r.action);search.order=new Map(rows.map(r=>[actionKey(r.action),r.evaluation]));search.depthRoots=0;yield;
 }
 search.stage='complete';
}
export function createSearch({state,observation,maxDepth=5}={}){const s=structuredClone(state??observation);if(s.phase!=='play')throw Error('Recorded position is not awaiting a move');const roots=legalActions(s);const playedVisits=new Map();for(const key of s.positionHistory)playedVisits.set(key,(playedVisits.get(key)??0)+1);const search={state:s,roots,playedVisits,rootVisits:new Map(),completedDepth:0,depthRoots:0,nodes:0,iterations:0,tableHits:0,cycleEstimates:0,table:new Map(),order:new Map(),tactics:new Map(),rootScanCount:0,tacticalReplyNodes:0,tacticalReady:false,stage:'root-scan',maxDepth:Math.max(1,Math.min(8,Number(maxDepth)||5)),candidates:[],done:false};search.generator=iterative(search);return search;}
export function runSearch(s,iterations=1){for(let i=0;i<iterations;i++){if(s.done){s.iterations++;continue;}const next=s.generator.next();s.iterations++;if(next.done)s.done=true;}}
export function summarizeSearch(s){const counts={winning:0,safe:0,losing:0,unverified:s.roots.length-s.tactics.size};for(const info of s.tactics.values())counts[info.status]++;
 const selected=s.candidates[0],selectedPreviousOccurrences=selected?(s.rootVisits.get(actionKey(selected.action))??0):null;
 return {historyPolicy:'public-history-equal-evaluation-tiebreak-v1',selectedPreviousOccurrences,selectedRepeatedState:selectedPreviousOccurrences===null?null:selectedPreviousOccurrences>0,iterations:s.iterations,nodes:s.nodes,completedDepth:s.completedDepth,depthRoots:s.depthRoots,legalRoots:s.roots.length,searchedRoots:s.completedDepth?s.roots.length:s.depthRoots,unvisitedRoots:s.completedDepth?0:s.roots.length-s.depthRoots,
 candidates:s.candidates.slice(0,12).map(row=>({...row,tacticalStatus:s.tactics.get(actionKey(row.action))?.status})),tableHits:s.tableHits,cycleEstimates:s.cycleEstimates,selective:false,done:s.done,
 tacticalReady:s.tacticalReady,stage:s.stage,rootScanCount:s.rootScanCount,tacticalReplyNodes:s.tacticalReplyNodes,tacticalRootsChecked:counts.safe+counts.losing+counts.winning,tacticalCounts:counts,withheldRecommendations:s.roots.length-s.candidates.length,
 method:'Tactical safeguards and iterative deepening alpha-beta',meaning:'Every root is checked for immediate victory. Recommended nonwinning moves are verified against every immediate opponent reply; if all moves lose, the loss is reported. Unverified advice is withheld, while every legal human action remains available. Deeper searches evaluate all roots. Ancestor cycles remain estimates, never recorded draws.'};}
export function tacticalBaseline(s){const roots=legalActions(s),viewer=s.currentPlayer;return roots.map(action=>{const child=applyAction(s,action);return {action,evaluation:evaluate(child,viewer)};}).sort((a,b)=>b.evaluation-a.evaluation||actionKey(a.action).localeCompare(actionKey(b.action)))[0]?.action??null;}
