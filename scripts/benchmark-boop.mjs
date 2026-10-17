import {newGame,legalActions,applyAction,seededRandom} from '../boop/core.js';
import {createSearch,runSearch,bestAction,heuristicBestAction} from '../boop/ai.js';
import {writeFile} from 'node:fs/promises';
const options=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
const games=Number(options.games??24),ms=Number(options.ms??25),sims=Number(options.simulations??0),seed=Number(options.seed??937291),opponent=options.opponent??'baseline';
const cap=Number(options.cap??250);
if(!Number.isInteger(games)||games<1||ms<0||sims<0||!['baseline','greedy','tactical','random'].includes(opponent))throw Error('Invalid benchmark settings');
const times={guided:[],opponent:[]},records=[];
for(let g=0;g<games;g++){
  const seat=g%2,rng=seededRandom(seed+Math.floor(g/2)*9973),opening=seededRandom(seed+Math.floor(g/2)*9973+1);
  let state=newGame({mode:'digital'}),turn=0;
  // Paired games use identical eight-ply openings, alternating the tested seat.
  for(let k=0;k<8;k++){const actions=legalActions(state);state=applyAction(state,actions[Math.floor(opening()*actions.length)]);}
  while(state.phase==='play'&&turn<cap){
    const guided=state.currentPlayer===seat,start=performance.now();let action,iterations=0;
    if(guided||opponent==='baseline'){
      const search=createSearch(state,{rng,method:guided?'guided':'baseline',rolloutLength:8});
      do{runSearch(search,1);iterations++;}while(sims?iterations<sims:performance.now()-start<ms);
      action=bestAction(search);
    }else if(opponent==='random'){const actions=legalActions(state);action=actions[Math.floor(rng()*actions.length)];}
    else action=heuristicBestAction(state,{tactical:opponent==='tactical'});
    times[guided?'guided':'opponent'].push(performance.now()-start);state=applyAction(state,action);turn++;
  }
  records.push({game:g,seat,winner:state.winner,turns:state.ply,capped:state.phase!=='gameover'});
}
const stats=values=>({moves:values.length,meanMs:values.reduce((a,b)=>a+b,0)/Math.max(1,values.length),maxMs:Math.max(0,...values)});
const wins=records.filter(r=>!r.capped&&r.winner===r.seat).length,losses=records.filter(r=>!r.capped&&r.winner!==r.seat).length,capped=records.filter(r=>r.capped).length;
const result={games,seed,opponent,pairedOpenings:true,nominalMs:sims?null:ms,simulations:sims||null,wins,losses,capped,winRateCompleted:wins/Math.max(1,wins+losses),timing:{guided:stats(times.guided),opponent:stats(times.opponent)},records};
if(options.output)await writeFile(options.output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
