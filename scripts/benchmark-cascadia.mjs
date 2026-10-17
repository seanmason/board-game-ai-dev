import {writeFile,mkdir} from 'node:fs/promises';
import {createGame,applyAction,observation,rng} from '../cascadia/core.js';
import {createSearch,runSearch,summary,policy} from '../cascadia/ai.js';
import {scoreGame,winners} from '../cascadia/scoring.js';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('='))),games=Number(args.games??8),players=Number(args.players??2),iterations=Number(args.iterations??8),opponent=args.opponent??'tuned',seed=Number(args.seed??41377),ms=Number(args.ms??0);
if(!['tuned','greedy','search'].includes(opponent))throw Error('Opponent: tuned|greedy|search');
const records=[],started=performance.now();let decisions=0,totalSamples=0,searchMs=0;
function choose(s,style,random,moveSeed){if(style!=='search'&&style!=='baseline-search')return policy(observation(s),random,style);const t=performance.now(),search=createSearch(observation(s),{seed:moveSeed,horizon:style==='baseline-search'?1:2});if(ms){do{runSearch(search,1);}while(performance.now()-t<ms);}else runSearch(search,iterations);searchMs+=performance.now()-t;totalSamples+=search.iterations;decisions++;return summary(search).candidates[0].action;}
for(let game=0;game<games;game++){const gameSeed=seed+Math.floor(game/players),seat=game%players,random=rng(gameSeed+313),cards=Object.fromEntries(['B','E','S','H','F'].map((a,i)=>[a,'ABCD'[(Math.floor(game/players)+i)%4]]));let s=createGame({mode:'digital',players,seed:gameSeed,cards}),trace=[];
 for(let step=0;s.phase!=='gameover';step++){if(step>2000)throw Error('Stalled game');const style=s.currentPlayer===seat?'search':opponent==='search'?'baseline-search':opponent,action=choose(s,style,random,gameSeed*10000+step);trace.push({player:s.currentPlayer,action});s=applyAction(s,action);}
 const scores=scoreGame(s).map(s=>s.total),won=winners(s);records.push({game,gameSeed,seat,cards,scores,winners:won,winShare:won.includes(seat)?1/won.length:0,trace});console.error(`Cascadia ${game+1}/${games}: seat${seat+1} scores${scores.join('/')} winner${won.map(i=>i+1)}`);
}
const wins=records.reduce((n,r)=>n+r.winShare,0),result={label:'Exploratory synthetic opponent comparison; no human-strength or matched-compute claim',games,players,iterations,ms,opponent,seed,winShare:wins/games,meanScore:records.reduce((n,r)=>n+r.scores[r.seat],0)/games,meanMargin:records.reduce((n,r)=>n+r.scores[r.seat]-Math.max(...r.scores.filter((_,i)=>i!==r.seat)),0)/games,searchDecisions:decisions,samples:totalSamples,searchMs,elapsedMs:performance.now()-started,records};
if(args.output){await mkdir(new URL('../benchmarks/results/',import.meta.url),{recursive:true});await writeFile(args.output,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({...result,records:undefined},null,2));
