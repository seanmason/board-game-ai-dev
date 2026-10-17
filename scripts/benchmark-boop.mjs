import {newGame,legalActions,applyAction,seededRandom} from '../boop/core.js';
import {createSearch,runSearch,bestAction,heuristicBestAction,searchSummary} from '../boop/ai.js';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function statistics(values){
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
  return {count:n,min:n?sorted[0]:null,mean:n?values.reduce((a,b)=>a+b,0)/n:null,
    median:n?sorted[Math.floor((n-1)/2)]:null,p95:n?sorted[Math.ceil(n*.95)-1]:null,max:n?sorted[n-1]:null};
}
export function searchMetrics(search){
  let maxDepth=0,terminalTreeVisits=0,stack=[[search.root,0]];
  while(stack.length){const [node,depth]=stack.pop();maxDepth=Math.max(maxDepth,depth);
    if(node.state.phase==='gameover')terminalTreeVisits+=node.visits;
    for(const child of node.children)stack.push([child,depth+1]);}
  const summary=searchSummary(search);
  return {iterations:search.iterations,nodes:search.nodeCount,maxDepth,legal:summary.rootLegalActions,
    explored:summary.candidates.length,rootCoverage:summary.candidates.length/summary.rootLegalActions,
    terminalTreeVisits,terminalRollouts:search.root.terminalSamples-terminalTreeVisits,
    heuristicLeaves:search.iterations-search.root.terminalSamples,
    selectedVisits:summary.candidates[0]?.visits??0,
    top:summary.candidates.slice(0,3).map(c=>({action:c.action,visits:c.visits,tactic:c.tactic,evaluation:c.valueSum[search.root.state.currentPlayer]/c.visits}))};
}
export function summarizeRecords(records){
  const searched=side=>records.flatMap(r=>r.moves.filter(m=>(m.actor===r.seat?'guided':'opponent')===side&&m.search).map(m=>m.search));
  const allMoves=side=>records.flatMap(r=>r.moves.filter(m=>(m.actor===r.seat?'guided':'opponent')===side));
  const sideStats=side=>{const moves=allMoves(side),searches=searched(side);return {
    timingMs:statistics(moves.map(m=>m.elapsedMs)),initializationMs:statistics(searches.map(s=>s.initializationMs)),
    iterations:statistics(searches.map(s=>s.iterations)),maxDepth:statistics(searches.map(s=>s.maxDepth)),
    rootCoverage:statistics(searches.map(s=>s.rootCoverage)),
    totalIterations:searches.reduce((n,s)=>n+s.iterations,0),terminalTreeVisits:searches.reduce((n,s)=>n+s.terminalTreeVisits,0),
    terminalRollouts:searches.reduce((n,s)=>n+s.terminalRollouts,0),heuristicLeaves:searches.reduce((n,s)=>n+s.heuristicLeaves,0)};};
  const wins=records.filter(r=>!r.capped&&r.winner===r.seat).length,losses=records.filter(r=>!r.capped&&r.winner!==r.seat).length,capped=records.filter(r=>r.capped).length;
  const n=wins+losses,p=n?wins/n:0,z=1.96,denom=1+z*z/Math.max(1,n),center=(p+z*z/(2*Math.max(1,n)))/denom,margin=z*Math.sqrt(p*(1-p)/Math.max(1,n)+z*z/(4*Math.max(1,n)**2))/denom;
  return {games:records.length,wins,losses,capped,winRateCompleted:n?p:null,wilson95:n?[center-margin,center+margin]:null,
    timing:{guided:sideStats('guided'),opponent:sideStats('opponent')}};
}
export async function benchmark(options={}){
  const games=Number(options.games??24),ms=Number(options.ms??25),sims=Number(options.simulations??0),minSims=Number(options['min-simulations']??1),seed=Number(options.seed??937291),opponent=options.opponent??'baseline';
  const cap=Number(options.cap??250),offset=Number(options['game-offset']??0);
  if(!Number.isInteger(games)||games<1||!Number.isFinite(ms)||ms<0||!Number.isInteger(sims)||sims<0||!Number.isInteger(minSims)||minSims<1||!Number.isInteger(seed)||!Number.isInteger(cap)||cap<1||!Number.isInteger(offset)||offset<0||!['baseline','greedy','tactical','random'].includes(opponent))throw Error('Invalid benchmark settings');
  const records=[];
  for(let local=0;local<games;local++){
    const g=offset+local,seat=g%2,rng=seededRandom(seed+Math.floor(g/2)*9973),openingRng=seededRandom(seed+Math.floor(g/2)*9973+1);
    let state=newGame({mode:'digital'}),turn=0;const opening=[],moves=[];
    for(let k=0;k<8;k++){const actions=legalActions(state),action=actions[Math.floor(openingRng()*actions.length)];opening.push(action);state=applyAction(state,action);}
    while(state.phase==='play'&&turn<cap){
      const actor=state.currentPlayer,guided=actor===seat,start=performance.now();let action,diagnostics=null;
      if(guided||opponent==='baseline'){
        const search=createSearch(state,{rng,method:guided?'guided':'baseline',rolloutLength:8}),initializationMs=performance.now()-start;
        do{runSearch(search,1);}while(sims?search.iterations<sims:search.iterations<minSims||performance.now()-start<ms);
        action=bestAction(search);
        // Freeze timing BEFORE inspecting the tree so diagnostics do not consume
        // the move budget or distort reported inference latency.
        const elapsedMs=performance.now()-start;
        diagnostics={...searchMetrics(search),initializationMs};
        moves.push({ply:state.ply,actor,action,elapsedMs,search:diagnostics});
      }else{
        if(opponent==='random'){const actions=legalActions(state);action=actions[Math.floor(rng()*actions.length)];}
        else action=heuristicBestAction(state,{tactical:opponent==='tactical'});
        moves.push({ply:state.ply,actor,action,elapsedMs:performance.now()-start,search:null});
      }
      state=applyAction(state,action);turn++;
    }
    const record={game:g,seat,winner:state.winner,turns:state.ply,capped:state.phase!=='gameover',opening,moves};records.push(record);
    if(options.progress)console.error(JSON.stringify({game:g,seat,winner:record.winner,capped:record.capped,turns:record.turns,...summarizeRecords(records),timing:undefined}));
    if(options.output)await writeFile(options.output,JSON.stringify({config:{games,seed,opponent,pairedOpenings:true,gameOffset:offset,nominalMs:sims?null:ms,simulations:sims||null,minSimulations:sims?null:minSims,cap,freshTreeEachMove:true,maxNodes:10000,rolloutLength:8},...summarizeRecords(records),complete:local===games-1,records},null,2)+'\n');
  }
  return {config:{games,seed,opponent,pairedOpenings:true,gameOffset:offset,nominalMs:sims?null:ms,simulations:sims||null,minSimulations:sims?null:minSims,cap,freshTreeEachMove:true,maxNodes:10000,rolloutLength:8},...summarizeRecords(records),complete:true,records};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const options=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
  const result=await benchmark(options);console.log(JSON.stringify(options.output?{...result,records:undefined,output:options.output}:result,null,2));
}
