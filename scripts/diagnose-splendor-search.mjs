/** Inspect root coverage at increasing time budgets on fixed public positions. */
import {writeFileSync} from 'node:fs';
import {newGame,applyAction,observation,rng} from '../splendor/core.js';
import {policy} from '../splendor/ai.js';
import {decision} from './benchmark-splendor-search.mjs';
const positions=[];
for(let g=0;g<4;g++){
 let s=newGame({mode:'digital',seed:864331+g,players:g%2+2}),r=rng(915+g),last=-1;
 while(s.phase!=='gameover'&&s.turn<60){
  if(s.phase==='play'&&s.turn%10===0&&s.turn!==last){positions.push({game:g,turn:s.turn,players:s.players.length,o:observation(s)});last=s.turn;}
  s=applyAction(s,policy(s,r,'stochastic'));
 }
}
const results=[];
for(let i=0;i<4;i++)decision(positions[i].o,{ms:100,horizon:12},101+i);
for(const [i,p] of positions.entries())for(const ms of Array.from({length:3},(_,j)=>[30,150,500][(i+j)%3])){
 const {o,...position}=p,d=decision(o,{ms,horizon:12},10147+i);
 results.push({...position,ms,...d});
}
const summaries=[30,150,500].map(ms=>{const rows=results.filter(r=>r.ms===ms);return {ms,positions:rows.length,
 meanIterations:rows.reduce((n,r)=>n+r.iterations,0)/rows.length,incompleteCoverage:rows.filter(r=>!r.covered).length,
 singleSampleChoices:rows.filter(r=>r.selectedVisits===1).length,meanActualMs:rows.reduce((n,r)=>n+r.elapsed,0)/rows.length};});
writeFileSync(process.argv[2]??'/tmp/splendor-diagnostics.json',JSON.stringify({seed:864331,summaries,results,caveat:'Fixed heuristic-generated positions, not a representative distribution of human play. Four warmups excluded; budget order rotates by position to reduce order effects. Timings depend on hardware.'},null,2)+'\n');
console.log(JSON.stringify(summaries));
