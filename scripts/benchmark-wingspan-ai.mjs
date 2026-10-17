/**
 * Reproducible pilot AI tournament against distinct synthetic opponents.
 *
 * Two methods: original fast heuristic sampling and new imperfect-information
 * game rollouts. These tournaments do NOT measure human Elo or calibrated
 * win probabilities. Usage:
 * node scripts/benchmark-wingspan-ai.mjs --games=6 --samples=12 --method=belief-rollout
 */
import {performance} from "node:perf_hooks";
import {
  newGame,applyAction,assertValid,seededRandom,publicObservation
} from "../wingspan/core.js";
import {candidateActions} from "../wingspan/actions.js";
import {createSearch,runSearch,searchSummary} from "../wingspan/analysis.js";
import {policyGrade} from "../wingspan/rollout.js";
import {scorePlayer,finalOutcome} from "../wingspan/scoring.js";

const option=(name,def)=>{
  const arg=process.argv.find(x=>x.startsWith("--"+name+"="));
  return arg?arg.slice(name.length+3):def;
};
const bounded=(name,def,min,max)=>{
  const n=Number(option(name,def));
  if(!Number.isInteger(n)||n<min||n>max)throw Error("Invalid --"+name);
  return n;
};
const games=bounded("games",6,1,1000);
const players=bounded("players",2,2,5);
const samples=bounded("samples",12,1,1000);
const timeMs=bounded("time-ms",0,0,10000);
const horizon=bounded("horizon",4,1,12);
const seed=bounded("seed",15963,0,2147483647);
const method=option("method","belief-rollout");
if(!["heuristic","belief-rollout"].includes(method))throw Error("Invalid method");
const opponent=option("opponent","greedy");
if(!["greedy","random","stochastic","heuristic","belief-rollout"].includes(opponent))throw Error("Invalid opponent");
const started=performance.now();
let searches=0,simulations=0,searchMs=0,actions=0,won=0,scoreShare=0,margin=0;
const tally=[];
function pickFrom(choices,s,rng,style) {
  if(style==="random")return choices[Math.floor(rng()*choices.length)];
  const rated=choices.map(x=>({x,score:policyGrade(s,x.action)}));
  if(style==="greedy"){
    const top=Math.max(...rated.map(x=>x.score));
    const tied=rated.filter(x=>Math.abs(x.score-top)<1e-9);
    return tied[Math.floor(rng()*tied.length)].x;
  }
  const max=Math.max(...rated.map(x=>x.score));
  const weights=rated.map(x=>Math.exp(Math.max(-40,(x.score-max)/3)));
  let pick=rng()*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<weights.length;i++){
    pick-=weights[i];
    if(pick<=0)return choices[i];
  }
  return choices.at(-1);
}
for(let game=0;game<games;game++){
  const aiSeat=game%players;
  const starter=Math.floor(game/players)%players;
  const rng=seededRandom(seed+game*1597);
  let state=newGame({players,starter,seed:(seed^((game+1)*30103))>>>0});
  let steps=0;
  while(state.phase!=="gameover"){
    if(++steps>600)throw Error("Wingspan turn processing exceeded limit");
    const actor=state.phase==="power"?
      state.pending[0].owner:state.currentPlayer;
    const choices=candidateActions(state);
    if(!choices.length)throw Error("No legal candidates in "+state.phase);
    let action=null;
    if(actor===aiSeat){
      const obs=publicObservation(state,actor);
      const search=createSearch(obs,choices,{
        rng:seededRandom((seed^(game*982451653+steps*193))>>>0),
        method,horizon
      });
      const at=performance.now();
      if(timeMs){do{runSearch(search,1);}while(performance.now()-at<timeMs);}
      else runSearch(search,samples);
      searchMs+=performance.now()-at;
      searches++;
      simulations+=search.iterations;
      action=searchSummary(search).candidates[0].action;
    }else if(['heuristic','belief-rollout'].includes(opponent)){
      const search=createSearch(publicObservation(state,actor),choices,{
        rng:seededRandom((seed^(game*982451653+steps*197))>>>0),method:opponent,horizon});
      const at=performance.now();
      if(timeMs){do{runSearch(search,1);}while(performance.now()-at<timeMs);}
      else runSearch(search,samples);
      action=searchSummary(search).candidates[0].action;
    }else action=pickFrom(choices,state,rng,opponent).action;
    try{state=applyAction(state,action);}
    catch(error){
      throw Error("Invalid "+method+" action in game "+game+
        " at "+state.phase+" step "+steps+": "+error.message);
    }
    assertValid(state);
    actions++;
  }
  const shares=finalOutcome(state.players);
  const scores=state.players.map(scorePlayer).map(x=>x.total);
  const ours=scores[aiSeat],theirs=scores.filter((_,i)=>i!==aiSeat);
  const delta=ours-Math.max(...theirs);
  scoreShare+=shares[aiSeat];margin+=delta;
  if(shares[aiSeat]===1)won++;
  tally.push({game,aiSeat,starter,score:ours,opponentMax:Math.max(...theirs),
    margin:delta,winShare:shares[aiSeat]});
}
console.log(JSON.stringify({
  mode:"exploratory imperfect-information Wingspan benchmark",
  config:{games,players,samples,timeMs,horizon,seed,method,opponent},
  performance:{elapsedMs:Math.round(performance.now()-started),
    searchMs:Math.round(searchMs),searches,simulations,actions,
    simulationsPerSecond:searchMs?Math.round(simulations*1000/searchMs):0},
  outcome:{winShare:Number((scoreShare/games).toFixed(3)),
    wins:won,meanScoreMargin:Number((margin/games).toFixed(2))},
  games:tally
},null,2));
