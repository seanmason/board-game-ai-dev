/**
 * Matched-position, same-process AI throughput comparison.
 * Run: npm run benchmark:search
 */
import {performance} from "node:perf_hooks";
import {
  newGame, drawFactories, seededRandom, applyAction, legalActions
} from "../src/azul.js";
import {createSearch,runSearch} from "../src/mcts.js";

const variants=["baseline","guided-informed"];
const budget=256, positionsPerCount=12;
const answer={type:"controlled search throughput microbenchmark",budget,results:[]};
for (const players of [2,3,4]) {
  const random=seededRandom(314159+players);
  let state=drawFactories(newGame({players,mode:"digital"}),random);
  const positions=[];
  while(positions.length<positionsPerCount){
    if(state.phase==="gameover"){
      state=drawFactories(newGame({players,mode:"digital"}),random);
    } else if(state.phase==="refill"){
      state=drawFactories(state,random);
    }
    positions.push(state);
    const actions=legalActions(state);
    state=applyAction(state,actions[Math.floor(random()*actions.length)]);
  }
  const time=Object.fromEntries(variants.map(v=>[v,0]));
  const hits=Object.fromEntries(variants.map(v=>[v,0]));
  // Warm each policy and its JS code paths before gathering measurements.
  for (const variant of variants) {
    for (let i=0;i<3;i++){
      const search=createSearch(positions[i],{variant,rng:seededRandom(i+881)});
      runSearch(search,48);
    }
  }
  // Alternate execution order to reduce CPU frequency/JIT warm-state bias.
  for(let i=0;i<positions.length;i++){
    const order=i%2? [...variants].reverse():variants;
    for (const variant of order){
      const search=createSearch(positions[i],{variant,
        rng:seededRandom(1987+i*17),maxNodes:18000});
      const begin=performance.now();
      runSearch(search,budget);
      const elapsed=performance.now()-begin;
      time[variant]+=elapsed;
      hits[variant]+=search.iterations;
    }
  }
  answer.results.push({
    players,positions:positions.length,
    searches:variants.map(variant=>({
      variant,simulations:hits[variant],
      searchMs:+time[variant].toFixed(2),
      simulationsPerSecond:Math.round(1000*hits[variant]/time[variant])
    })),
    speedRatioEnhancedToBaseline:+(time.baseline/time["guided-informed"]).toFixed(2)
  });
}
console.log(JSON.stringify(answer,null,2));
