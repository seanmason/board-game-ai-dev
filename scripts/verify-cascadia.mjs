import assert from 'node:assert/strict';
import {createGame,applyAction,legalActions,rng,validateState} from '../cascadia/core.js';
import {wildlifeScore,habitatSizes} from '../cascadia/scoring.js';
import {referenceWildlife,referenceHabitats} from '../test/cascadia-reference.js';
const games=Number(process.env.VERIFY_GAMES??40);let transitions=0,comparisons=0;
for(let seed=1;seed<=games;seed++){const players=1+(seed%4),random=rng(seed*193),cards=Object.fromEntries(['B','E','S','H','F'].map((a,i)=>[a,'ABCD'[(seed+i)%4]]));let s=createGame({players,mode:'digital',seed,cards});while(s.phase!=='gameover'){const as=legalActions(s),action=as[Math.floor(random()*as.length)];s=applyAction(s,action);validateState(s);transitions++;if(transitions>games*1500)throw Error('Game failed to terminate');}
 for(const p of s.players){assert.deepEqual(habitatSizes(p.board),referenceHabitats(p.board));comparisons++;for(const animal of ['B','E','S','H','F'])for(const card of 'ABCD'){assert.equal(wildlifeScore(p.board,animal,card),referenceWildlife(p.board,animal,card),`seed ${seed} ${animal}${card}`);comparisons++;}}
}
console.log(JSON.stringify({games,transitions,independentScoringComparisons:comparisons,discrepancies:0}));
