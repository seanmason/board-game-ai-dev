/**
 * Reproducible headless AI tournament. This estimates decision quality per
 * computation budget and intentionally makes no claim of calibrated outcomes.
 * Run: node scripts/benchmark-ai.mjs --games 12 --playouts 64 --players 2
 */
import {performance} from "node:perf_hooks";
import {
  newGame,drawFactories,applyAction,legalActions,outcomes
} from "../src/azul.js";
import {createSearch,runSearch,bestAction} from "../src/mcts.js";
import {
  chooseOpponentAction,resolveOpponentPolicy,OPPONENT_POLICIES
} from "../benchmarks/opponents.js";

function config(name,defaultValue) {
  const arg=process.argv.find(a=>a.startsWith("--"+name+"="));
  return arg?arg.split("=").slice(1).join("="):defaultValue;
}
function int(name,defaultValue,min,max) {
  const n=Number(config(name,defaultValue));
  if(!Number.isInteger(n)||n<min||n>max)throw Error("Invalid --"+name);
  return n;
}
function seeded(seed){
  let n=seed>>>0;
  return ()=> ((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
}
const games=int("games",12,1,20000),
  playouts=int("playouts",64,1,100000),
  players=int("players",2,2,4),
  seed=int("seed",147,0,2147483647);
const opponent=config("opponent","heuristic");
const variant=config("variant","guided-informed");
const agent=config("agent","mcts");
const opponentPlayouts=int("opponent-playouts",64,1,100000);
if(!OPPONENT_POLICIES.includes(opponent))throw Error("Unknown --opponent");
if(!["mcts","heuristic","informed"].includes(agent))throw Error("Unknown --agent");

const began=performance.now();
let winShare=0,scores=0,scoreMargins=0,moveCount=0,sims=0,searchMs=0;
let firstWins=0,sharedWins=0;
for(let n=0;n<games;n++){
  // Rotate the AI's seat and initial turn order independently, to avoid
  // systematically advantaging one competitor throughout the tournament.
  const aiSeat=n%players;
  const starter=Math.floor(n/players)%players;
  const draw=seeded((seed^(n*0x9e3779b1))>>>0);
  const random=seeded((seed^((n+1)*0x6c8e9cf5))>>>0);
  let s=drawFactories(newGame({players,starter,mode:"digital"}),draw);
  let moves=0;
  while(s.phase!=="gameover"){
    if(++moves>1500)throw Error("Game did not end at seed "+n);
    if(s.phase==="refill"){s=drawFactories(s,draw);continue;}
    let action;
    const options=legalActions(s);
    if(s.currentPlayer===aiSeat){
      if(agent==="mcts") {
        const search=createSearch(s,{rng:seeded((seed^(n*23431+moves*1237))>>>0),
          maxNodes:Math.max(2000,playouts+50),variant});
        const t=performance.now();
        runSearch(search,playouts);
        searchMs+=performance.now()-t;
        sims+=search.iterations;
        action=bestAction(search);
      } else action=chooseOpponentAction(s,agent,random);
    } else {
      const opposingPolicy=resolveOpponentPolicy(opponent,s.currentPlayer,n);
      action=chooseOpponentAction(s,opposingPolicy,random,{
        playouts:opponentPlayouts,
        seed:(seed ^ (n*23431) ^ (moves*1789) ^ s.currentPlayer) >>> 0
      });
    }
    s=applyAction(s,action);
    moveCount++;
  }
  const wins=outcomes(s);
  const score=s.players[aiSeat].score;
  const otherScores=s.players.filter((_,i)=>i!==aiSeat).map(p=>p.score);
  winShare+=wins[aiSeat];
  if(wins[aiSeat]===1)firstWins++;
  if(wins[aiSeat]>0&&wins[aiSeat]<1)sharedWins++;
  scores+=score;
  scoreMargins+=score-otherScores.reduce((a,b)=>a+b,0)/otherScores.length;
}
const proportion=winShare/games;
// Wilson interval: unlike a naive normal interval, zero observed wins do
// not incorrectly imply a zero upper bound. Shared wins are weighted in the
// estimated share; these bounds remain approximate, not calibrated.
const z=1.96, z2=z*z;
const denominator=1+z2/games;
const center=(proportion+z2/(2*games))/denominator;
const margin=(z/denominator)*Math.sqrt(
  (proportion*(1-proportion)/games)+(z2/(4*games*games))
);
const winRange=[Math.max(0,center-margin),Math.min(1,center+margin)];
console.log(JSON.stringify({
  type:"exploratory tournament (not a strength certification)",
  config:{games,playouts,players,seed,opponent,opponentPlayouts,variant,agent},
  performance:{
    totalMs:Math.round(performance.now()-began),
    searchMs:Math.round(searchMs),
    simulations:sims,simulationsPerSearchSecond:searchMs?Math.round(sims/(searchMs/1000)):0,
    totalMoves:moveCount
  },
  agent:{
    averageScore:Number((scores/games).toFixed(2)),
    averageScoreMargin:Number((scoreMargins/games).toFixed(2)),
    winShare:Number(proportion.toFixed(3)),
    approximate95PercentWinShareRange:winRange.map(n=>Number(n.toFixed(3))),
    outrightWins:firstWins,sharedWins
  }
},null,2));
