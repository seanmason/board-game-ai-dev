import {TYPES,ALL_IDS,typeOf} from './catalog.js';
import {applyAction,legalActions,clone,random} from './core.js';
import {choices} from './actions.js';
import {publicObservation} from './observations.js';
import {sampleWorld} from './belief.js';
import {localScore,makiScore,puddingScore} from './scoring.js';
export const actionLabel=a=>a.cards.map(t=>TYPES[t].name).join(' → ')+(a.returnId?' · return one old Chopsticks':'');
export function previewTableau(table,a){
 const result=clone(table),used=new Set(result.map(e=>e.id));
 for(const t of a.cards){const id=ALL_IDS.find(id=>typeOf(id)===t&&!used.has(id));used.add(id);const entry={id,pick:1};if(TYPES[t].nigiri){const empty=result.find(e=>typeOf(e.id)==='wasabi'&&!result.some(n=>n.wasabi===e.id));if(empty)entry.wasabi=empty.id;}result.push(entry);}
 if(a.returnId)result.splice(result.findIndex(e=>e.id===a.returnId),1);return result;
}
export function heuristic(obs,a){
 const p=obs.viewer,before=localScore(obs.tableaux[p]),table=previewTableau(obs.tableaux[p],a),after=localScore(table),count=t=>table.filter(e=>typeOf(e.id)===t).length;
 let value=after.total-before.total;
 const future=obs.remaining-1;
 if(future>0){value+=(count('tempura')%2)*1.55+(count('sashimi')%3===1?.75:count('sashimi')%3===2?2.4:0);const empty=count('wasabi')-table.filter(e=>e.wasabi).length;value+=Math.min(empty,Math.ceil(future/3))*1.2;if(count('chopsticks')&&future>=2)value+=.7;}
 const icons=obs.tableaux.map(t=>localScore(t).makiIcons),old=makiScore(icons);icons[p]=after.makiIcons;value+=(makiScore(icons)[p]-old[p])*.55+(after.makiIcons-before.makiIcons)*.15;
 const pudding=obs.puddings.map((pile,i)=>pile.length+obs.tableaux[i].filter(e=>typeOf(e.id)==='pudding').length),oldDessert=puddingScore(pudding);pudding[p]=obs.puddings[p].length+count('pudding');value+=(puddingScore(pudding)[p]-oldDessert[p])*(obs.round===3?.8:.35)+a.cards.filter(t=>t==='pudding').length*.35;
 return value;
}
export function baseline(obs,actions){return actions.reduce((best,a)=>heuristic(obs,a)>heuristic(obs,best)?a:best,actions[0]);}
function jointTurn(s,rootAction,viewer,rng){
 const joint=Array.from({length:s.players},(_,actor)=>{
  if(actor===viewer&&rootAction)return {...rootAction,type:'commit',actor};
  const actions=legalActions(s,actor),obs=publicObservation(s,actor);
  return rng()<.2?actions[Math.floor(rng()*actions.length)]:baseline(obs,actions);
 });
 for(const a of joint)s=applyAction(s,a);return applyAction(s,{type:'reveal'});
}
function value(s,viewer){const dessert=s.phase==='gameover'?Array(s.players).fill(0):puddingScore(s.puddings.map(p=>p.length)).map(v=>v*.4),scores=s.scores.map((v,p)=>v+dessert[p]);return scores[viewer]-scores.filter((_,p)=>p!==viewer).reduce((a,b)=>a+b,0)/(s.players-1);}
export function createSearch(obs,{seed=1,actions}={}){
 if(!actions)actions=choices(obs.ownHand,obs.tableaux[obs.viewer],{unknown:true}).map(a=>({type:'commit',actor:obs.viewer,...a}));
 if(!actions.length)throw Error('No root choices');const known=obs.packets.every((id,p)=>p===obs.viewer||obs.knownPackets[id]);
 return {observation:obs,rng:random(seed),iterations:0,method:known&&obs.remaining===1?'exact known singleton reveal':'sampled simultaneous round',candidates:actions.map(action=>({action,label:actionLabel(action),prior:heuristic(obs,action),visits:0,sum:0}))};
}
export function runSearch(search,n=1){
 for(let i=0;i<n;i++){
  const c=search.candidates[search.iterations%search.candidates.length],obs=search.observation;let s=sampleWorld(obs,search.rng);s=jointTurn(s,c.action,obs.viewer,search.rng);
  let steps=0;while(!['roundEnd','gameover'].includes(s.phase)){if(steps++>10)throw Error('Draft continuation cap');s=jointTurn(s,null,obs.viewer,search.rng);}
  c.sum+=value(s,obs.viewer);c.visits++;search.iterations++;
 }
 return search;
}
export function summary(s){return {iterations:s.iterations,method:s.method,coverage:`${s.candidates.length} complete ordered root actions; no pruning`,candidates:s.candidates.map(c=>({...c,utility:c.visits?c.sum/c.visits:null})).sort((a,b)=>(b.utility??b.prior)-(a.utility??a.prior))};}
