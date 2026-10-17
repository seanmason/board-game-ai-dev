/** Information-set sampling with adversarial alpha-beta continuations.
 * Finite-depth utilities are estimates, not calibrated win probabilities. */
import {CARDS,WONDERS,PROGRESS} from './catalog.js';
import {analysisBlocker,applyAction,clone,determinize,legalActions,observation,payment,production,rng,science,score,scoreBreakdown,count} from './core.js';
const TERMINAL=10000;
export function value(s,who){if(s.phase==='gameover')return s.result.winners.length===2?0:s.result.winners.includes(who)?TERMINAL:-TERMINAL;
 function city(i){const p=s.players[i],sci=science(p),distinct=new Set(sci).size,prod=production(p),remaining=Math.max(0,3-s.age);
  let v=score(s,i)+Math.min(p.coins,18)*(.18+remaining*.06);
  v+=prod.fixed.reduce((n,x)=>n+Math.min(x,3),0)*(.55+remaining*1.05)+prod.choices.length*(.8+remaining*1.5)+prod.discount.size*(.3+remaining*.5);
  v+=distinct*(1.1+remaining*.3)+Math.max(0,distinct-3)**2*1.1;
  for(const symbol of new Set(sci))if(sci.filter(x=>x===symbol).length===1&&s.progress.length)v+=.4;
  v+=p.progress.reduce((n,id)=>n+({strategy:2.7,economy:1.8,architecture:1.4,masonry:1.8,theology:2.6,urbanism:1.2}[id]??0)*remaining,0);
  v+=p.wonders.filter(id=>!p.built.includes(id)).reduce((n,id)=>n+Math.max(0,1.1-payment(s,i,WONDERS[id]).total*.06),0)*.35;
  const m=s.military*(i===0?1:-1);v+=Math.max(0,m)*.22+Math.max(0,m-4)**2*.6;
  return v;
 }return city(who)-city(1-who);}
/** Tuned one-step baseline deliberately includes science denial and exposing tactics. */
export function grade(s,a){const actor=s.currentPlayer,next=applyAction(s,a,{validate:false});let v=value(next,actor)-value(s,actor);if(Math.abs(v)>1000)return v;
 if(a.slot!==undefined){const c=CARDS[s.board[a.slot].id],opp=s.players[1-actor],symbols=new Set(science(opp));
  if(c.science){v+=(symbols.has(c.science)?1.2:Math.max(0,symbols.size-2)*1.7);if(!symbols.has(c.science)&&symbols.size>=5)v+=50;}
  if(c.shields&&s.military*(actor===0?1:-1)<=-5)v+=c.shields*1.5;
 }
 if(a.type==='discard'&&s.players[actor].coins>12)v-=1;
 return v;}
function children(s,who){return legalActions(s).map(a=>{const next=applyAction(s,a,{validate:false});return{a,s:next,v:value(next,who)};});}
export function heuristic(s,random=rng(1),style='tuned'){const rated=legalActions(s).map(a=>({a,v:grade(s,a)})).sort((a,b)=>b.v-a.v);if(!rated.length)return null;
 const win=rated.find(x=>x.v>TERMINAL/2);if(win)return win.a;
 if(style==='stochastic'&&random()<.15)return rated[Math.floor(random()*Math.min(4,rated.length))].a;
 const ties=rated.filter(x=>Math.abs(x.v-rated[0].v)<1e-8);return ties[Math.floor(random()*ties.length)].a;}
/** All successors are checked for immediate wins before beam pruning.
 * Effect choices extend the horizon without spending a drafting ply. */
export function minimax(s,who,depth=2,alpha=-Infinity,beta=Infinity,{beam=7,nodes=null}={}){
 if(nodes)nodes.count++;if(s.phase==='gameover')return value(s,who);
 const effect=['progress','library','recover','destroy','starter'].includes(s.phase);
 if(depth<=0&&!effect)return value(s,who);
 const all=children(s,who);if(!all.length)return value(s,who);const maximize=s.currentPlayer===who;
 all.sort((a,b)=>maximize?b.v-a.v:a.v-b.v);
 // A terminal victory is available to the moving player: never discard it.
 const direct=all.find(x=>x.s.phase==='gameover'&&x.s.result.winners.includes(s.currentPlayer)&&x.s.result.winners.length===1);if(direct)return direct.v;
 const selected=depth<=1||effect?all:all.slice(0,beam);let best=maximize?-Infinity:Infinity;
 for(const child of selected){const d=effect?depth:depth-1;const v=minimax(child.s,who,d,alpha,beta,{beam,nodes});if(maximize){best=Math.max(best,v);alpha=Math.max(alpha,best);}else{best=Math.min(best,v);beta=Math.min(beta,best);}if(beta<=alpha)break;}
 return best;}
export function createSearch(input,{seed=1,depth=2,beam=7}={}){const o=observation(input,input.currentPlayer),block=analysisBlocker(o);if(block)throw Error(block);const random=rng(seed),world=determinize(o,random),actions=legalActions(o);if(!actions.length)throw Error('No legal actions');
 return{o,actor:o.currentPlayer,random,depth,beam,iterations:0,nodes:0,arms:actions.map(action=>({action,visits:0,sum:0,squares:0,prior:grade(world,action),worst:Infinity,best:-Infinity}))};}
export function runSearch(search,n=1){for(let k=0;k<n;k++){
 const unvisited=search.arms.filter(x=>!x.visits);const ucb=a=>a.sum/a.visits+8*Math.sqrt(Math.log(search.iterations+1)/a.visits)+a.prior*.12/(1+a.visits);
 const arm=(unvisited.length?unvisited:search.arms).reduce((a,b)=>(unvisited.length?b.prior>a.prior:ucb(b)>ucb(a))?b:a);
 const s=determinize(search.o,search.random),next=applyAction(s,arm.action,{validate:false}),nodes={count:0};
 const v=minimax(next,search.actor,search.depth,-Infinity,Infinity,{beam:search.beam,nodes});
 // Bound terminal utility to keep UCB exploration useful after a single losing world.
 const estimate=Math.max(-150,Math.min(150,v));arm.visits++;arm.sum+=estimate;arm.squares+=estimate*estimate;arm.worst=Math.min(arm.worst,estimate);arm.best=Math.max(arm.best,estimate);search.iterations++;search.nodes+=nodes.count;
 }}
export function summary(s){return{iterations:s.iterations,nodes:s.nodes,depth:s.depth,method:'Sampled adversarial alpha-beta',candidates:s.arms.map(a=>({action:a.action,visits:a.visits,utility:a.visits?a.sum/a.visits:null,se:a.visits>1?Math.sqrt(Math.max(0,a.squares-a.sum*a.sum/a.visits)/(a.visits-1)/a.visits):null,prior:a.prior,worst:a.visits?a.worst:null})).sort((a,b)=>(b.utility??-Infinity)-(a.utility??-Infinity)||b.prior-a.prior)};}
export function bestAction(s){const report=summary(s);return report.candidates.find(a=>a.visits)?.action??report.candidates[0]?.action;}
