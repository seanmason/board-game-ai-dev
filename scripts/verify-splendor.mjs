import assert from 'node:assert/strict';
import {newGame,applyAction,assertValid,rng} from '../splendor/core.js';
import {policy} from '../splendor/ai.js';import {referenceMove} from '../test/splendor-reference.js';
const count=Number(process.env.SPLENDOR_GAMES??120),random=rng(703519);let transitions=0,stalled=0;
for(let g=0;g<count;g++){
 let s=newGame({mode:'digital',players:2+g%3,starter:g%(2+g%3),seed:g+901});let passes=0;
 for(let n=0;n<1000&&s.phase!=='gameover';n++){
  const a=policy(s,random,n%3?'stochastic':'random'),expected=referenceMove(s,a),next=applyAction(s,a);
  assert.deepEqual(next,expected,`Game ${g}, action ${n}, ${JSON.stringify(a)}`);assertValid(next);s=next;transitions++;passes=a.type==='pass'?passes+1:0;if(passes===s.players.length){stalled++;break;}
 }if(passes<s.players.length)assert.equal(s.phase,'gameover',`Game ${g} did not finish`);
}
console.log(JSON.stringify({games:count,stalled,transitions,discrepancies:0,scope:'Digital rules transitions against separately written oracle; shared card facts'},null,2));
