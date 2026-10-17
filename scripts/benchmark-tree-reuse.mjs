/**
 * Quantifies the usable conditional simulations under re-rooting, rather than
 * claiming that all previous-root MCTS visits can be transferred.
 * Run: npm run benchmark:reuse
 */
import {newGame,drawFactories,seededRandom,applyAction,legalActions} from "../src/azul.js";
import {createSearch,runSearch,searchSummary,advanceSearch} from "../src/mcts.js";
const runs=24, playouts=350;
const result=[];
for (const players of [2,3,4]) {
  let attempts=0,reused=0,retainedVisits=0,retainedNodes=0,totalBefore=0;
  let fallback=0, chance=0;
  for(let seed=1;seed<=runs;seed++){
    let s=drawFactories(newGame({players,mode:"digital"}),seededRandom(seed*56147+players));
    const search=createSearch(s,{rng:seededRandom(seed*13117),maxNodes:12000});
    runSearch(search,playouts);
    attempts++;
    totalBefore+=search.iterations;
    const first=searchSummary(search).candidates[0]?.action;
    if(!first)throw Error("Missing best move");
    const next=applyAction(s,first);
    const promoted=advanceSearch(search,first,next);
    if(promoted.reused){
      reused++;
      retainedVisits+=promoted.retainedVisits;
      retainedNodes+=promoted.retainedNodes;
      if(search.iterations!==promoted.retainedVisits)throw Error("Incorrect reroot count");
      if(!legalActions(next).length)throw Error("No legal move after reroot");
      const initial=search.iterations;
      runSearch(search,20);
      if(search.iterations!==initial+20)throw Error("Reused visits not preserved");
    } else {
      fallback++;
      if(next.phase!=="draft")chance++;
    }
  }
  result.push({
    players,attempts,reused,fallback,chanceBoundary:chance,
    sumPreviousRootVisits:totalBefore,
    conditionalVisitsRetained:retainedVisits,
    conditionalNodesRetained:retainedNodes,
    meanRetainedVisitsPerAttempt:Number((retainedVisits/attempts).toFixed(2)),
    fractionOfPreviousRootSimulations:Number((retainedVisits/totalBefore).toFixed(3))
  });
}
console.log(JSON.stringify({kind:"conditioned MCTS reuse on selected moves",
  budget:playouts,runsPerPlayerCount:runs,results:result},null,2));
