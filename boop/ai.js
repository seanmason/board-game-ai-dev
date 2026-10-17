import {legalActions,applyAction,previewPlacement,cloneGame,actionKey,describeAction,owner,token,LINES,assertValid} from './core.js';

/** Orange-positive positional score. Original heuristic inspired by the feature
 * families in Richoux (2024), not a reproduction of its solver or trained AI. */
export function positionScore(s){
  if(s.phase==='gameover')return s.winner===0?10000:-10000;
  const scores=[0,0];
  for(let p=0;p<2;p++)scores[p]+=s.pools[p][1]*12;
  for(let i=0;i<36;i++){
    const v=s.board[i];if(!v)continue;
    const p=owner(v),r=Math.floor(i/6),c=i%6,central=Math.min(r,5-r,c,5-c);
    scores[p]+=(Math.abs(v)===2?15:1.7)+central*(Math.abs(v)===2?1.8:0.7);
  }
  for(const line of LINES){
    for(let p=0;p<2;p++){
      if(line.some(i=>s.board[i]&&owner(s.board[i])!==p))continue;
      const pieces=line.filter(i=>owner(s.board[i])===p),cats=pieces.filter(i=>Math.abs(s.board[i])===2).length;
      if(pieces.length===2)scores[p]+=cats===2?8:cats===1?2.8:1.5;
      // An opponent-made triple survives until that player's next turn.
      if(pieces.length===3)scores[p]+=cats===3?90:5;
    }
  }
  return scores[0]-scores[1];
}
export function winningActions(s,firstOnly=false){
  if(s.phase!=='play')return [];
  const result=[];
  for(const piece of [2,1]){
    if(!s.pools[s.currentPlayer][piece-1])continue;
    // Without two cats on the bed, no placement can create a cat line/eight.
    if(s.board.filter(v=>v===token(s.currentPlayer,2)).length<2)continue;
    for(let cell=0;cell<36;cell++)if(!s.board[cell]){
      if(previewPlacement(s,{cell,piece}).winner===s.currentPlayer){
        result.push({cell,piece,graduate:[]});if(firstOnly)return result;
      }
    }
  }
  return result;
}
function edgesFor(s,guided){
  const me=s.currentPlayer;
  return legalActions(s).map(action=>{const state=applyAction(s,action);return{action,prior:positionScore(state)*(me===0?1:-1)};})
    .sort((a,b)=>guided?b.prior-a.prior||actionKey(a.action).localeCompare(actionKey(b.action)):0);
}
function nodeAt(state,action=null){return{state,action,edges:null,children:[],visits:0,valueSum:[0,0],terminalWins:[0,0],terminalSamples:0};}
function prepareRoot(search){
  const root=search.root;
  root.edges??=edgesFor(root.state,search.method==='guided');
  // Exact one-turn tactical check. Graduation alternatives remain distinct.
  for(const edge of root.edges){
    const state=applyAction(root.state,edge.action);
    edge.tactic=state.phase==='gameover'?1:
      search.method==='guided'&&winningActions(state,true).length?-1:0;
  }
  root.edges.sort((a,b)=>b.tactic-a.tactic|| (search.method==='guided'?b.prior-a.prior:0));
  search.rootTactics=new Map(root.edges.map(e=>[actionKey(e.action),e.tactic]));
  search.legalCount=root.edges.length+root.children.length;
  // On re-root, expanded children need the same tactical checks as new edges.
  for(const child of root.children)search.rootTactics.set(actionKey(child.action),child.state.phase==='gameover'?1:search.method==='guided'&&winningActions(child.state,true).length?-1:0);
}
export function createSearch(state,{rng=Math.random,method='guided',maxNodes=10000,rolloutLength=8,exploration=0.8}={}){
  assertValid(state);if(state.phase!=='play')throw Error('Boop search requires a playable position');
  const search={root:nodeAt(cloneGame(state)),rng,method:method==='baseline'?'baseline':'guided',maxNodes,rolloutLength,exploration,nodeCount:1,iterations:0};
  prepareRoot(search);return search;
}
function rollout(s,search){
  let state=s;
  for(let i=0;i<search.rolloutLength&&state.phase==='play';i++){
    let action;
    if(search.method==='baseline'){
      const actions=legalActions(state);action=actions[Math.floor(search.rng()*actions.length)];
    }else{
      action=winningActions(state,true)[0];
      if(!action){
        // Sample legal placements, then enumerate their complete graduation
        // choices. Exact root tactics are separate from this cheap rollout.
        const empty=state.board.flatMap((v,i)=>v?[]:[i]),pool=state.pools[state.currentPlayer],pieces=[1,2].filter(p=>pool[p-1]);
        let best=-Infinity;
        for(let k=0;k<7;k++){
          const cell=empty[Math.floor(search.rng()*empty.length)],piece=pieces[Math.floor(search.rng()*pieces.length)];
          const preview=previewPlacement(state,{cell,piece});
          for(const graduate of preview.choices){
            const a={cell,piece,graduate},next=applyAction(state,a);
            const score=positionScore(next)*(state.currentPlayer===0?1:-1)+(search.rng()-0.5)*5;
            if(score>best){best=score;action=a;}
          }
        }
      }
    }
    if(!action)break;
    state=applyAction(state,action);
  }
  if(state.phase==='gameover')return{values:state.winner===0?[1,0]:[0,1],winner:state.winner};
  const v=0.5+0.48*Math.tanh(positionScore(state)/42);
  return{values:[v,1-v],winner:null};
}
export function runSearch(search,count=1){
  for(let i=0;i<count;i++){
    let node=search.root;const route=[node];
    while(node.state.phase==='play'){
      node.edges??=edgesFor(node.state,search.method==='guided');
      const width=search.method==='baseline'?Infinity:Math.max(2,Math.floor(2.2*Math.pow(node.visits+1,0.55)));
      if(node.edges.length&&node.children.length<width&&search.nodeCount<search.maxNodes){
        const edge=search.method==='baseline'?node.edges.splice(Math.floor(search.rng()*node.edges.length),1)[0]:node.edges.shift();
        const child=nodeAt(applyAction(node.state,edge.action),edge.action);node.children.push(child);node=child;route.push(node);search.nodeCount++;break;
      }
      if(!node.children.length)break;
      const actor=node.state.currentPlayer,log=Math.log(node.visits+1);
      let best=-Infinity,choice=null;
      for(const child of node.children){
        const tactic=node===search.root?(search.rootTactics.get(actionKey(child.action))??0):0;
        const score=child.valueSum[actor]/child.visits+search.exploration*Math.sqrt(log/child.visits)+tactic*100;
        if(score>best){best=score;choice=child;}
      }
      node=choice;route.push(node);
      // Cycles are legal in Boop. Bound tree traversal as well as rollouts;
      // the resulting leaf estimate is never recorded as an actual draw.
      if(route.length>=160)break;
    }
    const result=rollout(node.state,search);
    for(const n of route){n.visits++;for(let p=0;p<2;p++)n.valueSum[p]+=result.values[p];
      if(result.winner!==null){n.terminalSamples++;n.terminalWins[result.winner]++;}}
    search.iterations++;
  }
  return search;
}
export function searchSummary(search){
  const root=search.root,me=root.state.currentPlayer;
  const candidates=root.children.map(child=>({action:child.action,key:actionKey(child.action),label:describeAction(child.action),visits:child.visits,valueSum:[...child.valueSum],terminalWins:[...child.terminalWins],terminalSamples:child.terminalSamples,tactic:search.rootTactics.get(actionKey(child.action))??0}))
    .sort((a,b)=>b.tactic-a.tactic||b.visits-a.visits||b.valueSum[me]/b.visits-a.valueSum[me]/a.visits);
  const principalVariation=[];let node=root;
  for(let i=0;i<6;i++){
    const child=[...node.children].sort((a,b)=>b.visits-a.visits)[0];if(!child)break;
    principalVariation.push(child.action);node=child;
  }
  return{iterations:search.iterations,nodeCount:search.nodeCount,currentPlayer:me,rootLegalActions:search.legalCount,candidates,principalVariation,terminalSamples:root.terminalSamples};
}
export const bestAction=search=>searchSummary(search).candidates[0]?.action??null;
export function heuristicBestAction(s,{tactical=true}={}){
  const edges=edgesFor(s,true);
  if(tactical)for(const edge of edges){
    const next=applyAction(s,edge.action);
    if(next.phase==='gameover')return edge.action;
    if(!winningActions(next,true).length)return edge.action;
  }
  return edges[0]?.action??null;
}
export function advanceSearch(search,action,nextState){
  if(nextState.phase!=='play')return{reused:false};
  let projected;try{projected=applyAction(search.root.state,action);}catch{return{reused:false};}
  if(JSON.stringify(projected)!==JSON.stringify(nextState))return{reused:false};
  const child=search.root.children.find(c=>actionKey(c.action)===actionKey(action));if(!child)return{reused:false};
  search.root=child;child.action=null;search.iterations=child.visits;
  let nodes=0,stack=[child];while(stack.length){const n=stack.pop();nodes++;stack.push(...n.children);}
  search.nodeCount=nodes;prepareRoot(search);
  return{reused:true,retainedVisits:child.visits,retainedNodes:nodes};
}
