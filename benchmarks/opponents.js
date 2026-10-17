/**
 * Reproducible, strategically different synthetic opponents for headless Azul
 * tournaments. These are behavioral baselines, NOT proxies for human strength.
 */
import {applyAction, legalActions, seededRandom, FLOOR_COSTS} from "../src/azul.js";
import {bestAction, createSearch, heuristicScore, informedHeuristic, runSearch} from "../src/mcts.js";

export const OPPONENT_POLICIES = Object.freeze([
  "random", "heuristic", "informed", "stochastic",
  "floor-averse", "denial", "legacy-uct", "mixed"
]);
export const MIXED_POLICIES = Object.freeze([
  "heuristic", "informed", "stochastic", "floor-averse", "denial"
]);
const takeCount = (state, action) =>
  (action.source < 0 ? state.center : state.factories[action.source])
    .filter(c => c === action.color).length;
function floorPenalty(state, action) {
  const p=state.players[state.currentPlayer];
  const picked=takeCount(state,action);
  const placed=action.row < 0 ? 0 :
    Math.min(picked, action.row + 1 - p.lines[action.row].count);
  const total=picked-placed+
    (action.source < 0 && state.markerAvailable ? 1 : 0);
  let penalty=0;
  for(let k=0;k<total;k++) {
    const slot=p.floor.length+k;
    if(slot<FLOOR_COSTS.length) penalty+=FLOOR_COSTS[slot];
  }
  return penalty;
}
function bestOf(actions,score,rng) {
  let best=-Infinity, options=[];
  for(const action of actions) {
    const evaluation=score(action);
    if(evaluation>best+1e-10){best=evaluation;options=[action];}
    else if(Math.abs(evaluation-best)<=1e-10)options.push(action);
  }
  return options[Math.floor(rng()*options.length)];
}
function temperatureChoice(state,actions,rng) {
  const scores=actions.map(a=>informedHeuristic(state,a));
  const best=Math.max(...scores);
  const temperature=3.75;
  const weights=scores.map(v=>Math.exp((v-best)/temperature));
  const total=weights.reduce((a,b)=>a+b,0);
  let remaining=rng()*total;
  for(let i=0;i<actions.length;i++) {
    if(remaining<weights[i])return actions[i];
    remaining-=weights[i];
  }
  return actions.at(-1);
}
export function chooseOpponentAction(state, policy, rng = Math.random, options = {}) {
  if(!OPPONENT_POLICIES.includes(policy) || policy==="mixed")
    throw Error("Unknown single opponent policy "+policy);
  const legal=legalActions(state);
  if(!legal.length)throw Error("No legal action");
  if(policy==="random")return legal[Math.floor(rng()*legal.length)];
  if(policy==="heuristic")return bestOf(legal,a=>heuristicScore(state,a),rng);
  if(policy==="informed")return bestOf(legal,a=>informedHeuristic(state,a),rng);
  if(policy==="stochastic")return temperatureChoice(state,legal,rng);
  if(policy==="floor-averse") {
    return bestOf(legal,a=>0.5*heuristicScore(state,a)+
      0.5*informedHeuristic(state,a)-3.5*floorPenalty(state,a),rng);
  }
  if(policy==="denial") {
    return bestOf(legal,a=>{
      const after=applyAction(state,a);
      const nextActions=legalActions(after);
      const otherPlayerGain=nextActions.length ?
        Math.max(...nextActions.map(b=>informedHeuristic(after,b))) : 0;
      return informedHeuristic(state,a)-0.65*otherPlayerGain;
    },rng);
  }
  // Baseline two/multiplayer UCT as a nonheuristic comparator.
  const budget=options.playouts ?? 64;
  if(!Number.isInteger(budget)||budget<1)throw Error("Bad opponent playout budget");
  const seed=options.seed ?? Math.floor(rng()*0x100000000);
  const search=createSearch(state,{
    rng:seededRandom(seed), variant:"baseline",
    maxNodes:Math.max(2000,budget+100)
  });
  runSearch(search,budget);
  return bestAction(search);
}
export function resolveOpponentPolicy(policy, seat, gameIndex = 0) {
  if(!OPPONENT_POLICIES.includes(policy))throw Error("Unknown opponent policy");
  return policy==="mixed" ? MIXED_POLICIES[(seat+gameIndex)%MIXED_POLICIES.length] : policy;
}
