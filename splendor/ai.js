/** Root UCB allocation over independent hidden-world rollouts. Utility is not win probability. */
import {CARDS,NOBLES} from './catalog.js';
import {analysisBlocker,applyAction,bonuses,determinize,legalActions,rng,score,total,winners} from './core.js';
export function value(s,who){const p=s.players[who],b=bonuses(p);
  const engine=b.reduce((n,x)=>n+Math.min(x,4)*.55+Math.max(0,x-4)*.15,0);
  const noble=Math.max(0,...s.nobles.map(id=>NOBLES[id].cost.reduce((n,x,i)=>n+Math.min(x,b[i]),0)/total(NOBLES[id].cost)));
  return score(p)+engine+total(p.tokens)*.13+noble*.8;
}
export function grade(s,a){const p=s.players[s.currentPlayer],b=bonuses(p);
  if(a.type==='noble')return 10;
  if(a.type==='buy'){const id=a.source==='reserved'?p.reserved[a.index].id:s.market[a.tier-1][a.index],c=CARDS[id];
    return c.points*2.5+2/(1+b[c.bonus]*.2)-total(a.payment)*.2-a.payment[5]*.22;}
  const targets=[...s.market.flat().filter(id=>id!==null),...p.reserved.map(r=>r.id).filter(id=>id!==null)].map(id=>{
    const c=CARDS[id],need=c.cost.map((x,i)=>Math.max(0,x-b[i]-p.tokens[i]));return {c,need,missing:total(need)};});
  const demand=Array(6).fill(.1);demand[5]=1;
  for(const {c,need,missing} of targets)if(missing>0&&missing<=6)for(let i=0;i<5;i++)demand[i]+=Math.min(2,need[i])*(1+c.points*.4)/(1+missing)**2;
  if(a.type==='take')return a.tokens.reduce((n,x,i)=>n+x*demand[i],0)+.25*Math.min(total(a.tokens),Math.max(0,10-total(p.tokens)));
  if(a.type==='return')return -a.tokens.reduce((n,x,i)=>n+x*demand[i],0);
  if(a.type==='reserve')return (s.bank[5]&&total(p.tokens)<10?.65:0)-p.reserved.length*.2+(a.source==='market'?CARDS[s.market[a.tier-1][a.index]].points*.08:0);
  return -10;
}
export function policy(s,random,style='greedy'){
  const choices=legalActions(s);if(style==='random')return choices[Math.floor(random()*choices.length)];
  const rated=choices.map(a=>({a,v:grade(s,a)})).sort((a,b)=>b.v-a.v);
  if(style==='stochastic'&&random()<.2)return rated[Math.floor(random()*Math.min(5,rated.length))].a;
  const ties=rated.filter(x=>Math.abs(x.v-rated[0].v)<1e-8);return ties[Math.floor(random()*ties.length)].a;
}
export function createSearch(o,{seed=1,horizon=12}={}){
  if(analysisBlocker(o))throw Error(analysisBlocker(o));
  const actions=legalActions(o);if(!actions.length)throw Error('No actions');
  return {o,actor:o.currentPlayer,random:rng(seed),horizon,iterations:0,
    arms:actions.map(action=>({action,visits:0,sum:0,squares:0,prior:grade(o,action)}))};
}
export function runSearch(search,n=1){for(let k=0;k<n;k++){
  const unexplored=search.arms.filter(a=>!a.visits);
  const arm=unexplored.length?unexplored.reduce((a,b)=>b.prior>a.prior?b:a):search.arms.reduce((a,b)=>
    b.sum/b.visits+2.5*Math.sqrt(Math.log(search.iterations+1)/b.visits)>a.sum/a.visits+2.5*Math.sqrt(Math.log(search.iterations+1)/a.visits)?b:a);
  let s=determinize(search.o,search.random);s=applyAction(s,arm.action,{validate:false});
  const start=s.turn;
  for(let step=0;step<search.horizon*4&&s.phase!=='gameover'&&s.turn-start<search.horizon;step++)s=applyAction(s,policy(s,search.random,'stochastic'),{validate:false});
  const ours=value(s,search.actor),other=Math.max(...s.players.map((_,i)=>i===search.actor?-Infinity:value(s,i)));
  const result=s.phase==='gameover'?(winners(s).includes(search.actor)?20: -20)+(ours-other)*.1:ours-other;
  arm.visits++;arm.sum+=result;arm.squares+=result*result;search.iterations++;
}}
export function summary(s){return {iterations:s.iterations,candidates:s.arms.map(a=>({action:a.action,visits:a.visits,
  utility:a.visits?a.sum/a.visits:null,se:a.visits>1?Math.sqrt(Math.max(0,a.squares-a.sum*a.sum/a.visits)/(a.visits-1)/a.visits):null,
  prior:a.prior})).sort((a,b)=>(b.utility??-Infinity)-(a.utility??-Infinity)||b.prior-a.prior)};}
