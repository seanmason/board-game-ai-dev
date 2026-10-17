import {
  EMPTY,BLACK,WHITE,uniqueLegalActions,legalActions,applyAction,cloneGame,
  outcomes,actionKey,describeAction,windows,fiveLines,seededRandom
} from "./core.js";

const WINDOWS=windows();
const WINDOW_WEIGHT=[0,0.4,3.0,15,85,1800];
/** From black's perspective; terminal outcomes override this heuristic. */
export function positionScore(board) {
  let black=0,white=0;
  for(const window of WINDOWS){
    let b=0,w=0;
    for(const k of window){
      if(board[k]===BLACK)b++;
      else if(board[k]===WHITE)w++;
    }
    if(!w)black+=WINDOW_WEIGHT[b];
    if(!b)white+=WINDOW_WEIGHT[w];
  }
  // Favor stable quadrant centers without overweighting corner tactics.
  for(const k of [7,10,25,28]){
    if(board[k]===BLACK)black+=1.25;
    else if(board[k]===WHITE)white+=1.25;
  }
  return black-white;
}
function perspective(s,player) {
  const difference=positionScore(s.board)*(player===BLACK?1:-1);
  return Math.tanh(difference/85);
}
function outcomeReward(s) {
  if(s.phase==="gameover")return outcomes(s);
  const diff=perspective(s,BLACK);
  const p=Math.max(0.015,Math.min(0.985,0.5+0.43*diff));
  return [p,1-p];
}
function actionScore(s,action) {
  const next=applyAction(s,action);
  const me=s.currentPlayer;
  if(next.phase==="gameover"){
    if(next.winner===me)return 100000;
    if(next.winner==="draw")return 0;
    return -100000;
  }
  return perspective(next,me)*75;
}
/**
 * Low-variance one-step recommendation. Pentago's branching factor is high:
 * at short budgets, MCTS visits are noisy against tactical opponents.
 * This policy is exposed independently from MCTS estimates, not mislabeled
 * as a full-game optimal evaluation.
 */
export function heuristicBestAction(s) {
  if(s.phase!=="play")return null;
  let best=null,score=-Infinity;
  for(const action of uniqueLegalActions(s)){
    const next=applyAction(s,action);
    const value=next.phase==="gameover" ?
      (next.winner===s.currentPlayer?100000:
        next.winner==="draw"?0:-100000) :
      positionScore(next.board)*(s.currentPlayer===BLACK?1:-1);
    if(value>score){score=value;best=action;}
  }
  return best;
}
function getOrdered(s) {
  if(s.phase!=="play")return [];
  // Identical post-rotation boards cannot carry distinct game-tree evidence.
  return uniqueLegalActions(s).map(action=>({
    action,prior:actionScore(s,action)
  })).sort((a,b)=>b.prior-a.prior ||
    actionKey(a.action).localeCompare(actionKey(b.action)));
}
function nodeAt(s,action=null) {
  return {
    action,actor:s.currentPlayer,untried:getOrdered(s),
    children:[],visits:0,winSum:[0,0],valueSum:[0,0]
  };
}
export function createSearch(state,{
  rng=Math.random,maxNodes=14000,exploration=0.93,rolloutLength=10
}={}) {
  if(state.phase!=="play")throw Error("Pentago search requires a playable position");
  const root=nodeAt(state);
  const heuristicAction=heuristicBestAction(state);
  const heuristicKey=heuristicAction?actionKey(heuristicAction):null;
  // Guarantee that the heuristic recommendation is represented by an
  // expanded node even at minimal simulation budgets.
  const pos=root.untried.findIndex(x=>actionKey(x.action)===heuristicKey);
  if(pos>0)root.untried.unshift(root.untried.splice(pos,1)[0]);
  return {
    rootState:cloneGame(state),root,rng,maxNodes,exploration,rolloutLength,
    heuristicAction,heuristicKey,iterations:0,nodeCount:1
  };
}
function width(node){
  return Math.max(2,Math.floor(2.0*Math.pow(node.visits+1,0.58)));
}
function select(node,search){
  const actor=node.actor,log=Math.log(node.visits+1);
  let chosen=node.children[0],value=-Infinity;
  for(const child of node.children){
    const exploit=child.valueSum[actor]/child.visits;
    const explore=search.exploration*Math.sqrt(log/child.visits);
    const jitter=search.rng()*1e-9;
    const result=exploit+explore+jitter;
    if(result>value){value=result;chosen=child;}
  }
  return chosen;
}
function randomSelection(state,rng,n=18) {
  const options=uniqueLegalActions(state);
  if(!options.length)return null;
  // Immediate placement wins must not be overlooked in a sampled rollout.
  const winning=options.find(a=>a.quadrant===-1&&
    applyAction(state,a).winner===state.currentPlayer);
  if(winning)return winning;
  let best=null,rating=-Infinity;
  const count=Math.min(options.length,n);
  for(let i=0;i<count;i++){
    const a=options[Math.floor(rng()*options.length)];
    const scored=actionScore(state,a)+(rng()-0.5)*18;
    if(scored>rating){rating=scored;best=a;}
  }
  return best??options[Math.floor(rng()*options.length)];
}
function finish(state,search){
  let current=state;
  for(let step=0;step<search.rolloutLength&&current.phase==="play";step++){
    const action=randomSelection(current,search.rng,13);
    if(!action)break;
    current=applyAction(current,action);
  }
  return outcomeReward(current);
}
export function runSearch(search,iterations=1){
  for(let i=0;i<iterations;i++){
    let state=cloneGame(search.rootState),node=search.root;
    const route=[node];
    while(state.phase==="play"){
      if(node.untried.length&&search.nodeCount<search.maxNodes &&
         node.children.length<width(node)){
        const move=node.untried.shift();
        state=applyAction(state,move.action);
        const child=nodeAt(state,move.action);
        node.children.push(child);node=child;route.push(child);
        search.nodeCount++;
        break;
      }
      if(!node.children.length)break;
      node=select(node,search);
      state=applyAction(state,node.action);
      route.push(node);
    }
    const reward=finish(state,search);
    for(const point of route) {
      point.visits++;
      for(let p=0;p<2;p++) {
        point.winSum[p]+=reward[p];
        point.valueSum[p]+=reward[p];
      }
    }
    search.iterations++;
  }
  return search;
}
export function searchSummary(search){
  const node=search.root;
  const actions=node.children.map(child=>({
    action:child.action,
    key:actionKey(child.action),
    label:describeAction(child.action),
    visits:child.visits,
    winSum:[...child.winSum],
    valueSum:[...child.valueSum]
  })).sort((a,b)=>b.visits-a.visits ||
    b.valueSum[node.actor]/b.visits-a.valueSum[node.actor]/a.visits);
  return {
    iterations:search.iterations,nodeCount:search.nodeCount,
    currentPlayer:node.actor,rootLegalActions:node.children.length+node.untried.length,
    heuristicAction:search.heuristicAction,heuristicKey:search.heuristicKey,
    candidates:actions
  };
}
export function bestAction(search) {
  // A stable, explicitly named policy recommendation; MCTS results are
  // available separately in searchSummary(search).candidates.
  return search.heuristicAction??searchSummary(search).candidates[0]?.action??null;
}
/** Retain only the subtree conditioned on the actually played action. */
export function advanceSearch(search,action,nextState) {
  if(search.rootState.phase!=="play"||nextState.phase!=="play")
    return {reused:false,reason:"terminal-boundary"};
  let projected;
  try{projected=applyAction(search.rootState,action);}
  catch{return {reused:false,reason:"illegal-move"};}
  if(JSON.stringify(projected)!==JSON.stringify(nextState))
    return {reused:false,reason:"changed-position"};
  const child=search.root.children.find(n=>n.action&&
    actionKey(n.action)===actionKey(action));
  if(!child)return {reused:false,reason:"unexpanded-action"};
  let nodes=0,stack=[child];
  while(stack.length){const n=stack.pop();nodes++;stack.push(...n.children);}
  child.action=null;
  search.root=child;
  search.rootState=cloneGame(nextState);
  search.nodeCount=nodes;
  search.iterations=child.visits;
  search.heuristicAction=heuristicBestAction(nextState);
  search.heuristicKey=search.heuristicAction?actionKey(search.heuristicAction):null;
  const pos=child.untried.findIndex(x=>actionKey(x.action)===search.heuristicKey);
  if(pos>0)child.untried.unshift(child.untried.splice(pos,1)[0]);
  return {reused:true,retainedVisits:child.visits,retainedNodes:nodes};
}
