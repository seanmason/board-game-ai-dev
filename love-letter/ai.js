import {legalActions,applyAction,random} from './core.js';
import {publicObservation} from './observations.js';
import {allocations,sampleWorld} from './belief.js';
import {CARDS,cardName} from './catalog.js';
/** Practical advice budgets; every legal root still receives a sample. */
export function analysisBudget(players,rootCount,choice='auto'){
 const requested=choice==='auto'?(players===2?512:64):Number(choice);
 if(![64,512].includes(requested))throw Error('Invalid analysis budget');
 return Math.max(requested,rootCount);
}
export function label(a){return a.type==='draw'?'Draw a card':a.type==='nextRound'?'Start next round':`Play ${cardName(a.cardRank)}${a.target===undefined?'':` → Player ${a.target+1}`}${a.guess?` · guess ${a.guess}`:''}`;}
export function baselineValue(obs,a){
 if(a.type!=='play')return 0;
 const own=obs.ownHand.slice();own.splice(own.indexOf(a.cardRank),1);const keep=own[0]??0;
 const known=a.target===undefined?null:obs.memories[a.target].known;
 let value=keep*.12;
 if(a.cardRank===8)return -100;
 if([1,2,3,5,6].includes(a.cardRank)&&a.target===undefined)return value;
 if(a.cardRank===1){const remaining=CARDS[a.guess].count-obs.discards.flat().filter(c=>c.rank===a.guess).length-obs.exclusions.filter(r=>r===a.guess).length-obs.ownHand.filter(r=>r===a.guess).length;value+=(known?(known===a.guess?5:-2):Math.max(0,remaining)*.32);}
 if(a.cardRank===2)value+=.18;
 if(a.cardRank===3)value+=known?(keep>known?4:keep<known?-5:0):(keep>=6?1.1:keep<=2?-1:.1);
 if(a.cardRank===4)value+=.65;
 if(a.cardRank===5)value+=a.target===obs.viewer?(keep===8?3:-keep*.15):(known===8?5:known?known*.1:.3);
 if(a.cardRank===6)value+=known?(known-keep)*.15:(4-keep)*.13;
 return value;
}
export function baseline(obs,actions){return actions.reduce((best,a)=>baselineValue(obs,a)>baselineValue(obs,best)?a:best,actions[0]);}
const roundShare=(s,p)=>s.roundWinners.includes(p)?1/s.roundWinners.length:0;
function continuation(s,root){
 let count=0;while(!['roundEnd','gameover'].includes(s.phase)){
  if(count++>50)throw Error('Round continuation cap');
  const actions=legalActions(s);const a=s.phase==='choosePlay'?baseline(publicObservation(s,s.current),actions):actions[0];s=applyAction(s,a);
 }
 return roundShare(s,root);
}
export function createSearch(observation,{seed=1,actions,method='sampled'}={}){
 const worlds=allocations(observation);
 if(!actions?.length){const world=sampleWorld(observation,worlds,random(seed));actions=legalActions(world);}
 if(!actions.length)throw Error('No root choices');
 return {observation,worlds,rng:random(seed),iterations:0,method:observation.drawCount===0?'exact last-turn worlds':method,candidates:actions.map(action=>({action,label:label(action),visits:0,sum:0,prior:baselineValue(observation,action)}))};
}
export function runSearch(search,iterations=1){
 for(let i=0;i<iterations;i++){
  const c=search.candidates[search.iterations%search.candidates.length];
  if(search.observation.drawCount===0){
   let sum=0,total=0;for(const w of search.worlds){const s=sampleWorld(search.observation,[w],search.rng);sum+=w.weight*continuation(applyAction(s,c.action),search.observation.viewer);total+=w.weight;}c.sum+=sum/total;
  }else{const s=sampleWorld(search.observation,search.worlds,search.rng);c.sum+=continuation(applyAction(s,c.action),search.observation.viewer);}
  c.visits++;search.iterations++;
 }
 return search;
}
export function summary(s){return {iterations:s.iterations,method:s.method,coverage:`${s.candidates.length} complete root actions; ${s.worlds.length} weighted hand allocations`,candidates:s.candidates.map(c=>({...c,utility:c.visits?c.sum/c.visits:null})).sort((a,b)=>(b.utility??b.prior/10)-(a.utility??a.prior/10))};}
