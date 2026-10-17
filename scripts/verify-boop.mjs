import assert from 'node:assert/strict';
import {newGame,legalActions,applyAction,assertValid,actionKey,seededRandom} from '../boop/core.js';
import {fresh,options,play} from '../validation/boop-reference.js';
const count=Number(process.env.BOOP_GAMES??500),cap=Number(process.env.BOOP_TURN_CAP??600);
if(!Number.isInteger(count)||count<1||count>20000)throw Error('BOOP_GAMES must be 1..20000');
const started=performance.now();let transitions=0,finished=0,capped=0,graduations=0,singles=0,wins=[0,0];
for(let i=0;i<count;i++){
  let state=newGame({starter:i%2,mode:i%3?'digital':'physical'}),ref=fresh(i%2);const rng=seededRandom(719171+i*971);
  for(let turn=0;turn<cap&&state.phase==='play';turn++){
    assertValid(state);
    const actions=legalActions(state),expected=options(ref);
    assert.deepEqual(actions.map(actionKey).sort(),expected.map(actionKey).sort(),`Game ${i} turn ${turn} legal options`);
    assert.ok(actions.length,'No stalled games');
    // Alternate random, promotion-seeking, and adult-preferring policies to
    // exercise both long games and endgames without sharing the AI heuristic.
    let pool=actions;
    if(i%3===1&&actions.some(a=>a.graduate.length===3))pool=actions.filter(a=>a.graduate.length===3);
    if(i%3===2&&actions.some(a=>a.piece===2))pool=actions.filter(a=>a.piece===2);
    const a=pool[Math.floor(rng()*pool.length)];state=applyAction(state,a);ref=play(ref,a);
    assert.deepEqual(state.board,ref.grid.flat(),`Game ${i} board`);assert.deepEqual(state.pools,ref.supplies,`Game ${i} pools`);
    assert.equal(state.winner,ref.winner);assert.equal(state.currentPlayer,ref.turn);assert.equal(state.ply,ref.turns);assertValid(state);
    transitions++;if(a.graduate.length===3)graduations++;if(a.graduate.length===1)singles++;
  }
  if(state.phase==='gameover'){finished++;wins[state.winner]++;}else capped++;
}
console.log(JSON.stringify({status:'PASS',seed:719171,games:count,transitions,finished,capped,graduations,singleRetrievals:singles,wins,durationMs:Math.round(performance.now()-started)},null,2));
