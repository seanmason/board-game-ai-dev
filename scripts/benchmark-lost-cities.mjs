import {performance} from 'node:perf_hooks';
import {newGame,applyAction,legalActions,random} from '../lost-cities/core.js';
import {publicObservation} from '../lost-cities/observations.js';
import {baseline,createSearch,runSearch,summary} from '../lost-cities/ai.js';
const samples=Number(process.env.LOST_CITIES_SAMPLES??16),seeds=Number(process.env.LOST_CITIES_SEEDS??1),rows=[];
for(const opponent of ['mixed','greedy']){
 let completed=0,capped=0,share=0,margin=0,terminalSamples=0,horizonCutoffs=0,cycleCutoffs=0;const started=performance.now();
 for(let seed=1;seed<=seeds;seed++)for(const seat of [0,1]){
  const rng=random(seed);let s=newGame({mode:'digital',seed:seed*79}),steps=0;
  while(s.phase!=='choose-starter'&&steps++<400){const actions=legalActions(s),obs=publicObservation(s,s.current);let a;
   if(s.current===seat){const q=createSearch(obs,{seed:seed*31+s.turn,actions,horizon:4});runSearch(q,Math.max(samples,actions.length));const result=summary(q);a=result.candidates[0].action;terminalSamples+=result.terminalSamples;horizonCutoffs+=result.horizonCutoffs;cycleCutoffs+=result.cycleCutoffs;}
   else a=opponent==='mixed'&&rng()<.45?actions[Math.floor(rng()*actions.length)]:baseline(obs,actions);
   s=applyAction(s,a);
  }
  if(s.phase!=='choose-starter'){capped++;continue;}completed++;const diff=s.scores[seat]-s.scores[1-seat];margin+=diff;share+=diff>0?1:diff===0?.5:0;
 }
 rows.push({opponent,pairedSeeds:seeds,completed,capped,samples,horizon:4,meanCompletedMargin:completed?margin/completed:null,completedRoundWinShare:completed?share/completed:null,terminalSamples,horizonCutoffs,cycleCutoffs,illegal:0,elapsedMs:Math.round(performance.now()-started)});
}
console.log(JSON.stringify({scope:'Bounded single-round smoke only. Strict booklet matches require explicit starter decisions. Caps are non-complete games, never rules draws or losses.',rows},null,2));
