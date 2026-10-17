/** Paired, seat-swapped search tournament. Research only; no production policy changes. */
import {performance} from 'node:perf_hooks';
import {cpus} from 'node:os';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {newGame,applyAction,observation,rng,winners,score} from '../splendor/core.js';
import {createSearch,runSearch,summary} from '../splendor/ai.js';

export function pairedInterval(values,seed=91743){
  const random=rng(seed),samples=[];
  for(let k=0;k<10000;k++){let sum=0;for(let j=0;j<values.length;j++)sum+=values[Math.floor(random()*values.length)];samples.push(sum/values.length);}
  samples.sort((a,b)=>a-b);return [samples[250],samples[9749]];
}
export function choose(search,rule='mean'){
  const candidates=summary(search).candidates;
  if(rule==='visits')candidates.sort((a,b)=>b.visits-a.visits||(b.utility??-Infinity)-(a.utility??-Infinity)||b.prior-a.prior);
  return candidates[0];
}
export function decision(o,{horizon=12,ms=30,iterations=0,rule='mean'},seed){
  const start=performance.now(),search=createSearch(o,{seed,horizon});
  do{runSearch(search);}while(iterations?search.iterations<iterations:performance.now()-start<ms);
  const selected=choose(search,rule);
  return {action:selected.action,elapsed:performance.now()-start,iterations:search.iterations,arms:search.arms.length,
    covered:search.arms.every(a=>a.visits>0),selectedVisits:selected.visits};
}
export async function tournament(config){
  const {pairs,players,seed,a,b}=config,results=[],stats=[a,b].map(()=>({decisions:0,iterations:0,ms:0,incompleteCoverage:0,singleSampleChoices:0,maxMs:0}));
  // Warm up both configurations without consuming any tournament randomness.
  for(let i=0;i<4;i++)for(const agent of [a,b])decision(observation(newGame({mode:'digital',seed:73+i,players})),agent,413+i);
  for(let pair=0;pair<pairs;pair++)for(let seat=0;seat<players;seat++){
    const gameSeed=(seed+pair*809)>>>0;
    let s=newGame({mode:'digital',players,starter:pair%players,seed:gameSeed}),steps=0;const work=[],trace=createHash('sha256');
    while(s.phase!=='gameover'&&steps<1000){
      const agent=s.currentPlayer===seat?0:1;
      // Agent sees only its information set, never the true deck/opponent hand.
      const d=decision(observation(s),[a,b][agent],(seed+pair*104729+steps*997+seat*7919)>>>0),st=stats[agent];
      st.decisions++;st.iterations+=d.iterations;st.ms+=d.elapsed;st.maxMs=Math.max(st.maxMs,d.elapsed);
      st.incompleteCoverage+=!d.covered;st.singleSampleChoices+=d.selectedVisits===1;
      work.push(d.iterations);trace.update(JSON.stringify(d.action));s=applyAction(s,d.action);steps++;
    }
    if(s.phase!=='gameover')throw Error(`Game ${pair}/${seat} exceeded the limit; no artificial winner assigned`);
    const win=winners(s),share=win.includes(seat)?1/win.length:0;
    results.push({pair,seat,gameSeed,starter:pair%players,steps,turns:s.turn,scores:s.players.map(score),winners:win,share,work,actionDigest:trace.digest('hex')});
    console.error(`pair ${pair+1}/${pairs} seat ${seat}: ${share} (${s.turn} turns)`);
  }
  const clusters=Array.from({length:pairs},(_,i)=>results.filter(r=>r.pair===i).reduce((n,r)=>n+r.share,0)/players);
  return {config,environment:{node:process.version,cpu:cpus()[0]?.model,platform:process.platform},
    games:results.length,winShare:clusters.reduce((a,b)=>a+b,0)/pairs,pairedBootstrap95:pairedInterval(clusters),stats,results,
    caveat:'Seat rotations share a shuffled deal; bootstrap resamples whole deals. Timed searches are hardware/load dependent, and a rollout may overrun its deadline. Multiplayer measures one A against all B seats. Both agents share rules, evaluation and rollout policy: this is search-configuration evidence, not independent external AI or human strength. No hidden true allocations are passed to either agent.'};
}
export function replayGame(report,game){
  if(!Array.isArray(game.work)||!game.actionDigest)throw Error('This report predates exact work traces; rerun the tournament to capture them');
  const {config}=report,{pair,seat,gameSeed}=game;
  let s=newGame({mode:'digital',players:config.players,starter:game.starter,seed:gameSeed});
  const trace=createHash('sha256');
  for(let step=0;step<game.work.length;step++){
    const agent=s.currentPlayer===seat?config.a:config.b;
    const d=decision(observation(s),{...agent,iterations:game.work[step]},(config.seed+pair*104729+step*997+seat*7919)>>>0);
    trace.update(JSON.stringify(d.action));s=applyAction(s,d.action);
  }
  const digest=trace.digest('hex');
  if(s.phase!=='gameover'||digest!==game.actionDigest||JSON.stringify(s.players.map(score))!==JSON.stringify(game.scores))throw Error('Replay mismatch');
  return digest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const opt=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.split('=')[1]??d;
  const replay=opt('replay','');
  if(replay){const report=JSON.parse(readFileSync(replay,'utf8'));for(const game of report.results)replayGame(report,game);console.log('Exact replay passed for '+report.results.length+' games');process.exit(0);}
  const num=(k,d)=>Number(opt(k,d));
  const config={pairs:num('pairs',12),players:num('players',2),seed:num('seed',713001),
    a:{horizon:num('horizon',4),ms:num('ms',30),iterations:num('iterations',0),rule:opt('rule','mean')},
    b:{horizon:num('opponent-horizon',12),ms:num('opponent-ms',num('ms',30)),iterations:num('opponent-iterations',num('iterations',0)),rule:opt('opponent-rule','mean')}};
  if(!Number.isInteger(config.seed)||!Number.isInteger(config.pairs)||config.pairs<1||![2,3,4].includes(config.players)||[config.a,config.b].some(c=>!Number.isInteger(c.horizon)||c.horizon<1||!Number.isFinite(c.ms)||c.ms<=0||!Number.isInteger(c.iterations)||c.iterations<0||!['mean','visits'].includes(c.rule)))throw Error('Invalid tournament options');
  const result=await tournament(config),json=JSON.stringify(result,null,2)+'\n',out=opt('out','');
  if(out)writeFileSync(out,json);else console.log(json);
  console.error(JSON.stringify({winShare:result.winShare,interval:result.pairedBootstrap95,stats:result.stats}));
}
