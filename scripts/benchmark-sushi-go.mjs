import {performance} from 'node:perf_hooks';
import {newGame,applyAction,legalActions,random} from '../sushi-go/core.js';
import {publicObservation} from '../sushi-go/observations.js';
import {baseline,createSearch,runSearch,summary} from '../sushi-go/ai.js';
const samples=Number(process.env.SUSHI_GO_SAMPLES??24),seeds=Number(process.env.SUSHI_GO_SEEDS??1),rows=[];
for(const players of [2,3,4,5])for(const opponent of ['random','greedy']){
 const started=performance.now();let games=0,share=0,margin=0,moves=0;
 for(let seed=1;seed<=seeds;seed++)for(let seat=0;seat<players;seat++){
  let s=newGame({players,mode:'digital',seed:seed*13}),steps=0;const rng=random(seed*211);
  while(s.phase!=='roundEnd'){
   if(steps++>10)throw Error('Round cap');
   const joint=Array.from({length:players},(_,p)=>{const aa=legalActions(s,p),obs=publicObservation(s,p);if(p===seat){const q=createSearch(obs,{seed:seed*71+s.pick,actions:aa});runSearch(q,Math.max(samples,aa.length));moves++;return summary(q).candidates[0].action;}return opponent==='random'?aa[Math.floor(rng()*aa.length)]:baseline(obs,aa);});
   for(const a of joint)s=applyAction(s,a);s=applyAction(s,{type:'reveal'});
  }
  const best=Math.max(...s.scores),winners=s.scores.flatMap((v,p)=>v===best?[p]:[]);share+=winners.includes(seat)?1/winners.length:0;margin+=s.scores[seat]-s.scores.filter((_,p)=>p!==seat).reduce((a,b)=>a+b)/(players-1);games++;
 }
 rows.push({players,opponent,rounds:games,samples,meanRoundMargin:margin/games,roundWinShare:share/games,chanceReference:1/players,analyzedPicks:moves,elapsedMs:Math.round(performance.now()-started),illegal:0,capped:0});
}
console.log(JSON.stringify({scope:'Bounded seat-balanced one-round implementation smoke, not a strength promotion; pudding and future rounds not included in reported round wins',rows},null,2));
