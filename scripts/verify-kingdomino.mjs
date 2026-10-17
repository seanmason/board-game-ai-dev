import assert from 'node:assert/strict';
import {newGame,applyAction,legalActions,assertValid,score,rng,winners,standings} from '../kingdomino/core.js';
import {referenceActions,referenceStep,referenceScores} from '../test/kingdomino-reference.js';
const games=Number(process.env.VERIFY_GAMES??120);let transitions=0,discarded=0;
for(let g=0;g<games;g++){const players=2+g%3,edition=Math.floor(g/3)%2?'us2':'original';let s=newGame({mode:'digital',players,edition,seed:911+g*101}),random=rng(g+8193);
 while(s.phase!=='gameover'){assertValid(s);const acts=legalActions(s);assert.deepEqual(acts.map(JSON.stringify).sort(),referenceActions(s).map(JSON.stringify).sort());const a=acts[Math.floor(random()*acts.length)];assert.deepEqual(applyAction(s,a),referenceStep(s,a));s=applyAction(s,a);for(const p of s.players)assert.equal(score(p),referenceScores(p.board).score);transitions++;}
 assertValid(s);discarded+=s.players.reduce((n,p)=>n+p.discarded.length,0);const rows=standings(s).sort((a,b)=>b.score-a.score||b.largest-a.largest||(edition==='original'?b.crowns-a.crowns:0));assert.ok(winners(s).includes(rows[0].player));
}
console.log(JSON.stringify({games,transitions,discarded,discrepancies:0,editions:['original','us2'],players:[2,3,4]},null,2));
