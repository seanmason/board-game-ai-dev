// Replay the archived cycle, then continue with history-aware guided search.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {newGame,applyAction,seededRandom} from '../boop/core.js';
import {createSearch,runSearch,bestAction,heuristicBestAction,positionKey,searchSummary} from '../boop/ai.js';
import {fresh,play} from '../validation/boop-reference.js';
const archived=JSON.parse(await readFile(new URL('../benchmarks/boop-long/tactical-10000.json',import.meta.url),'utf8'));
const original=archived.records.find(r=>r.game===11);let state=newGame({mode:'digital'}),ref=fresh();const history=[state];
function verify(next,action){ref=play(ref,action);assert.deepEqual(next.board,ref.grid.flat());assert.deepEqual(next.pools,ref.supplies);assert.equal(next.winner,ref.winner);assert.equal(next.currentPlayer,ref.turn);}
for(const action of [...original.opening,...original.moves.filter(m=>m.ply<35).map(m=>m.action)]){state=applyAction(state,action);verify(state,action);history.push(state);}
const startPly=state.ply,moves=[],rng=seededRandom(1642911),iterations=3000;
while(state.phase==='play'&&moves.length<100){
  const search=state.currentPlayer===1?createSearch(state,{history,rng}):null;
  if(search)runSearch(search,iterations);
  const action=search?bestAction(search):heuristicBestAction(state),next=applyAction(state,action);
  verify(next,action);
  moves.push({ply:state.ply,actor:state.currentPlayer,action,repetitions:history.filter(s=>positionKey(s)===positionKey(next)).length,iterations:search?.iterations??0,utility:search?searchSummary(search).candidates[0].valueSum[1]/searchSummary(search).candidates[0].visits:null});
  state=next;history.push(state);
}
assert.equal(moves[0].repetitions,0,'First guided move escapes the archived cycle');
const result={source:'tactical-10000.json game 11',startPly,iterationsPerGuidedMove:iterations,opponent:'tactical greedy',seed:1642911,winner:state.winner,capped:state.phase!=='gameover',endPly:state.ply,moves};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,moves:moves.length},null,2));
