import {performance} from 'node:perf_hooks';
import {newGame,applyAction,legalActions,random} from '../love-letter/core.js';
import {publicObservation} from '../love-letter/observations.js';
import {baseline,createSearch,runSearch,summary} from '../love-letter/ai.js';
// Bounded implementation smoke, not a promotion or human-strength experiment.
const samples=Number(process.env.LOVE_LETTER_SAMPLES??64),seeds=Number(process.env.LOVE_LETTER_SEEDS??3),rows=[];
for(const players of [2,3,4])for(const opponent of ['random','baseline']){
 let share=0,games=0,moves=0;const started=performance.now();
 for(let seed=1;seed<=seeds;seed++)for(let seat=0;seat<players;seat++){
  const rng=random(seed),s0=newGame({players,mode:'digital',seed:seed*97});let s=s0,steps=0;
  while(!['roundEnd','gameover'].includes(s.phase)){
   if(steps++>60)throw Error('Round cap');const actions=legalActions(s);let a=actions[0];
   if(s.phase==='choosePlay'){
    const obs=publicObservation(s,s.current);
    if(s.current===seat){const search=createSearch(obs,{seed:seed*31+s.turn,actions});runSearch(search,Math.max(samples,actions.length));a=summary(search).candidates[0].action;moves++;}
    else a=opponent==='random'?actions[Math.floor(rng()*actions.length)]:baseline(obs,actions);
   }
   s=applyAction(s,a);
  }
  share+=s.roundWinners.includes(seat)?1/s.roundWinners.length:0;games++;
 }
 rows.push({players,opponent,rounds:games,samples,roundWinShare:share/games,chanceReference:1/players,analyzedMoves:moves,elapsedMs:Math.round(performance.now()-started),illegal:0,capped:0});
}
console.log(JSON.stringify({scope:'Seat-balanced bounded round smoke; no strength promotion or calibrated probability claim',rows},null,2));
