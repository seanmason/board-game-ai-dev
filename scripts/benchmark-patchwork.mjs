import {writeFile} from 'node:fs/promises';
import {newGame,applyAction,assertValid,scores,winners} from '../patchwork/core.js';
import {PATCHES,INCOME,END} from '../patchwork/catalog.js';
import {createSearch,runSearch,summary,candidateActions} from '../patchwork/ai.js';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
const games=Number(args.games??16),nodes=Number(args.nodes??256),ms=args.ms===undefined?null:Number(args.ms),seed=Number(args.seed??73001),opponent=args.opponent??'tuned';
if(!Number.isInteger(games)||games<1||!Number.isInteger(nodes)||nodes<1||ms!==null&&!(ms>0)||!['tuned','search'].includes(opponent))throw Error('Use --games=N --nodes=N [--ms=N] --opponent=tuned|search --seed=N [--out=path]');
function tuned(s){let best=null,bv=-Infinity;const p=s.players[s.currentPlayer],other=s.players[1-s.currentPlayer];for(const a of candidateActions(s,{width:2})){let v;if(a.type==='advance'){const target=Math.min(END,other.time+1),gain=target-p.time;v=gain+INCOME.filter(t=>p.time<t&&t<=target).length*p.income-gain*1.8;}else if(a.type==='leather')v=0;else {const q=PATCHES[a.id],remaining=INCOME.filter(t=>t>p.time).length,actual=Math.min(q.time,END-p.time);v=(2*q.area-q.cost+q.income*remaining*.94)/Math.pow(actual,.72);if(p.time+actual<=other.time)v+=1.5;if(p.buttons-q.cost<2&&remaining>3)v-=1.2;}if(v>bv){bv=v;best=a;}}return best;}
function search(s,width){const began=performance.now(),q=createSearch(s,{width});if(ms===null)runSearch(q,nodes);else while(performance.now()-began<ms&&!q.complete)runSearch(q,1);return {action:summary(q).candidates[0].action,nodes:q.iterations,elapsed:performance.now()-began};}
const results=[];let wins=0,elapsed=0,totalNodes=0;
for(let g=0;g<games;g++){
 const seat=g%2,gameSeed=seed+Math.floor(g/2),edition=args.edition??'corrected';let s=newGame({mode:'digital',seed:gameSeed,edition}),trace=[],decisions=0;
 while(s.phase!=='gameover'){
  const player=s.currentPlayer,began=performance.now();let choice;if(player===seat)choice=search(s,2);else if(opponent==='search')choice=search(s,1);else choice={action:tuned(s),nodes:0,elapsed:performance.now()-began};
  if(player===seat){elapsed+=choice.elapsed;totalNodes+=choice.nodes;}s=applyAction(s,choice.action);assertValid(s);trace.push({player,action:choice.action,nodes:choice.nodes,ms:choice.elapsed});if(++decisions>120)throw Error('Nonterminating game');
 }
 const won=winners(s).includes(seat);wins+=won;const sc=scores(s);results.push({seed:gameSeed,seat,edition,scores:sc,win:won,difference:sc[seat]-sc[1-seat],trace});
}
const p=wins/games,z=1.96,den=1+z*z/games,center=(p+z*z/(2*games))/den,half=z*Math.sqrt(p*(1-p)/games+z*z/(4*games*games))/den;
const timings=results.flatMap(r=>r.trace.map(t=>({...t,main:t.player===r.seat})));
const timingSummary=main=>{const values=timings.filter(t=>t.main===main);return {decisions:values.length,meanMs:values.reduce((n,t)=>n+t.ms,0)/values.length,maxMs:Math.max(...values.map(t=>t.ms)),meanBudgetOverrunMs:ms===null?null:values.reduce((n,t)=>n+Math.max(0,t.ms-ms),0)/values.length,maxBudgetOverrunMs:ms===null?null:Math.max(...values.map(t=>Math.max(0,t.ms-ms)))};};
const output={game:'patchwork',catalog:'original-33-corrected-square-v1',timing:{main:timingSummary(true),opponent:timingSummary(false)},opponent,budget:ms===null?{nodes}:{ms},games,seed,wins,winRate:p,wilson95:[center-half,center+half],meanScoreDifference:results.reduce((n,r)=>n+r.difference,0)/games,totalSearchMs:elapsed,totalNodes,notes:'Paired seeded rings with seats reversed. Search width2 versus tuned heuristic or width1 adversarial search. Finite sample and shared placement/evaluation biases; not human Elo. Timed budgets include candidate generation and may overshoot by one node.',results};
if(args.out)await writeFile(args.out,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({...output,results:output.results.map(({trace,...r})=>({...r,plies:trace.length}))},null,2));
