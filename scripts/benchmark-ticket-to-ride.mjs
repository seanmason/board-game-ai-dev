import {newGame,legalActions,applyAction,outcome} from '../ticket-to-ride/core.js';
import {publicObservation} from '../ticket-to-ride/observations.js';
import {createSearch,runSearch,summarizeSearch} from '../ticket-to-ride/ai.js';
const results=[];
// Bounded smoke screen only. A strength tournament requires the component gates.
for(const players of [2,3,4,5]){
 let s=newGame({mode:'digital',players,seed:players}),steps=0;const started=performance.now();
 while(!['terminal','supplyAdjudication'].includes(s.phase)&&steps<600){
  const actions=legalActions(s);if(!actions.length)break;let action;
  if(s.phase==='keepTickets')action=actions[0];
  else{const search=createSearch({observation:publicObservation(s,s.turn),actions,seed:steps+1});runSearch(search,actions.length);action=summarizeSearch(search).rows[0].action;}
  s=applyAction(s,action);steps++;
 }
 results.push({players,status:s.phase,complete:outcome(s)?.complete||false,steps,elapsedMs:Math.round(performance.now()-started)});
}
console.log(JSON.stringify({method:'One seeded heuristic smoke game per player count; no strength conclusion',results},null,2));
