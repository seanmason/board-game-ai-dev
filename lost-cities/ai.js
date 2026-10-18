import {CARDS,COLORS,label,cardType} from './catalog.js';
import {clone,legalActions,applyAction,random} from './core.js';
import {score,expeditionScore} from './scoring.js';
import {publicObservation} from './observations.js';
import {sampleWorld} from './belief.js';
export const actionLabel=a=>a.type==='draw'?`Draw ${a.source==='deck'?'from draw pile':a.source+' discard top'}`:`${a.type==='play'?'Play':'Discard'} ${label(a.cardId)}`;
function handOpportunity(obs,player,hand){
 let total=0;const clock=obs.deckCount??(obs.deckKnowledge.lower+obs.deckKnowledge.upper)/2,access=Math.min(.85,clock/16);
 for(const c of COLORS){const column=obs.expeditions[player][c],last=column.length?CARDS[column.at(-1)].value:0,held=hand.filter(Boolean).filter(id=>CARDS[id].color===c),numbers=held.filter(id=>CARDS[id].value>last).sort((a,b)=>CARDS[a].value-CARDS[b].value);
  const current=expeditionScore(column),sum=numbers.reduce((n,id)=>n+CARDS[id].value,0);
  if(current.started)total+=sum*access*current.multiplier;
  else total+=Math.max(0,sum*access-20)*.55;
  if(current.started&&column.length+numbers.length>=8)total+=20*Math.min(.6,access);
 }
 return total;
}
export function evaluate(obs){const actual=score({expeditions:obs.expeditions}),own=obs.viewer,other=1-own;if(obs.deckCount===0)return actual[own]-actual[other];return actual[own]-actual[other]+handOpportunity(obs,own,obs.ownHand)-.25*handOpportunity(obs,other,obs.memory.knownHands[other].map(t=>Object.keys(CARDS).find(id=>cardType(id)===t)));}
export function heuristic(obs,a){
 if(a.type==='draw'){
  if(a.source==='deck')return .9;
  const id=obs.visibleTops[a.source],c=CARDS[id],column=obs.expeditions[obs.viewer][c.color],last=column.length?CARDS[column.at(-1)].value:0;
  if(c.value===0){const held=obs.ownHand.filter(Boolean).filter(id=>CARDS[id].color===c.color).reduce((n,id)=>n+CARDS[id].value,0);return last===0?(held>25?1.1:.1):-2;}
  if(c.value<=last)return -1.5;
  if(!column.length){const held=obs.ownHand.filter(Boolean).filter(id=>CARDS[id].color===c.color).reduce((n,id)=>n+CARDS[id].value,0),clock=obs.deckCount??obs.deckKnowledge.upper;return (held+c.value)*Math.min(.85,clock/16)>20?1.4+c.value*.06:.15+c.value*.015;}
  return c.value*.18+.3;
 }
 const after=clone(obs),p=obs.viewer;after.ownHand.splice(after.ownHand.indexOf(a.cardId),1);
 if(a.type==='play')after.expeditions[p][CARDS[a.cardId].color].push(a.cardId);
 let result=evaluate(after)-evaluate(obs);
 if(a.type==='discard'){const card=CARDS[a.cardId],opponent=obs.expeditions[1-p][card.color],last=opponent.length?CARDS[opponent.at(-1)].value:0;if(card.value>last&&opponent.length)result-=card.value*.2;else if(!card.value&&last===0&&opponent.length)result-=1;}
 return result;
}
export function baseline(obs,actions){return actions.reduce((best,a)=>heuristic(obs,a)>heuristic(obs,best)?a:best,actions[0]);}
function signature(s){return JSON.stringify([s.current,s.phase,s.hands,s.expeditions,s.discards,s.deck]);}
export function createSearch(obs,{seed=1,actions,horizon=4}={}){
 if(!actions)actions=legalActions(sampleWorld(obs,random(seed)));
 if(!actions.length)throw Error('No root choices');return {observation:obs,rng:random(seed),horizon:Math.max(1,Math.min(8,horizon)),iterations:0,terminalSamples:0,horizonCutoffs:0,cycleCutoffs:0,candidates:actions.map(action=>({action,label:actionLabel(action),prior:heuristic(obs,action),visits:0,sum:0}))};
}
export function runSearch(search,n=1){for(let i=0;i<n;i++){
 const c=search.candidates[search.iterations%search.candidates.length],root=search.observation.viewer;let s=sampleWorld(search.observation,search.rng),turns=s.turn;s=applyAction(s,c.action);const seen=new Set();let reason='horizon';
 for(let steps=0;steps<search.horizon*2+2;steps++){
  if(['choose-starter','gameover'].includes(s.phase)){reason='terminal';break;}
  if(s.turn-turns>=search.horizon)break;
  const key=signature(s);if(seen.has(key)){reason='cycle';break;}seen.add(key);
  const actions=legalActions(s),obs=publicObservation(s,s.current),a=search.rng()<.2?actions[Math.floor(search.rng()*actions.length)]:baseline(obs,actions);s=applyAction(s,a);
 }
 if(['choose-starter','gameover'].includes(s.phase))reason='terminal';
 if(reason==='terminal')search.terminalSamples++;else if(reason==='cycle')search.cycleCutoffs++;else search.horizonCutoffs++;
 c.sum+=evaluate(publicObservation(s,root));c.visits++;search.iterations++;
 }return search;}
export function summary(s){return {iterations:s.iterations,method:'sampled hidden worlds · four-turn leaf evaluation',terminalSamples:s.terminalSamples,horizonCutoffs:s.horizonCutoffs,cycleCutoffs:s.cycleCutoffs,coverage:`${s.candidates.length} complete phase actions; no pruning; horizon ${s.horizon} turns`,candidates:s.candidates.map(c=>({...c,utility:c.visits?c.sum/c.visits:null})).sort((a,b)=>(b.utility??b.prior)-(a.utility??a.prior))};}
