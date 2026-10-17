import assert from 'node:assert/strict';import {CARDS,WONDERS} from '../seven-wonders-duel/catalog.js';
import {createGame,applyAction,legalActions,payment,score,validateState,rng} from '../seven-wonders-duel/core.js';
import {referencePayment,referenceScore,referenceTransition} from '../test/seven-wonders-duel-reference.js';
const games=Number(process.env.VERIFY_GAMES??120);let transitions=0,quotes=0;const wins={civilian:0,military:0,science:0};
for(let seed=1;seed<=games;seed++){const random=rng(seed*971);let s=createGame({mode:'digital',seed,firstPlayer:seed%2}),steps=0;while(s.phase!=='gameover'){
 for(let p=0;p<2;p++){assert.equal(score(s,p),referenceScore(s,p).total);for(const c of [...s.board.filter(x=>x.up&&x.id&&!x.removed).map(x=>CARDS[x.id]),...s.players[p].wonders.filter(id=>!s.players[p].built.includes(id)).map(id=>WONDERS[id])]){const a=payment(s,p,c),b=referencePayment(s,p,c);assert.equal(a.total,b.total);assert.equal(a.trade,b.trade);quotes++;}}
 const actions=legalActions(s);assert.ok(actions.length,`Stall seed ${seed} ${s.phase}`);let a=actions[Math.floor(random()*actions.length)];if(s.phase==='play'&&random()<.65){const builds=actions.filter(x=>x.type==='build'||x.type==='wonder');if(builds.length)a=builds[Math.floor(random()*builds.length)];}const next=applyAction(s,a);referenceTransition(s,a,next);validateState(next);s=next;transitions++;assert.ok(++steps<110);}
 wins[s.result.reason]++;for(let p=0;p<2;p++)assert.equal(s.result.scores[p],referenceScore(s,p).total);
}
console.log(JSON.stringify({games,transitions,paymentComparisons:quotes,discrepancies:0,results:wins,oracle:'Independent arithmetic/transition oracle with pinned factual data; not external certification'},null,2));
