import {performance} from 'node:perf_hooks';import {newGame,applyAction,observation,rng,winners,score} from '../splendor/core.js';
import {createSearch,runSearch,summary,policy} from '../splendor/ai.js';
const opt=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.split('=')[1]??d;
const games=Number(opt('games',12)),ms=Number(opt('ms',20)),players=Number(opt('players',2)),seed=Number(opt('seed',645901)),opponent=opt('opponent','greedy');
let visits=0,elapsed=0,winShare=0;const results=[];
for(let g=0;g<games;g++){
 let s=newGame({mode:'digital',players,starter:Math.floor(g/players)%players,seed:seed+g*809}),steps=0;const seat=g%players,random=rng(seed+g);
 while(s.phase!=='gameover'&&steps++<1000){let a;
  if(s.currentPlayer===seat){const search=createSearch(observation(s),{seed:seed+g*997+steps,horizon:12}),at=performance.now();do{runSearch(search);}while(performance.now()-at<ms);elapsed+=performance.now()-at;visits+=search.iterations;a=summary(search).candidates[0].action;}
  else a=policy(s,random,opponent);
  s=applyAction(s,a);
 }
 if(s.phase!=='gameover')throw Error('Benchmark exceeded limit');const w=winners(s),share=w.includes(seat)?1/w.length:0;winShare+=share;
 results.push({game:g,seat,turns:s.turn,scores:s.players.map(score),winShare:share});
}
console.log(JSON.stringify({config:{games,ms,players,seed,opponent},winShare:winShare/games,visits,searchMs:Math.round(elapsed),results,
 caveat:'Synthetic opponents; greedy baseline uses no search. Equal time per searched decision, not an equal-compute opponent comparison. Utility is not calibrated win probability.'},null,2));
