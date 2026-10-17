/** Hidden-world root bandit with exact scoring and shape-aware placement screening. */
import {CATALOG,SPECIES} from './catalog.js';
import {analysisBlocker,legalActions,applyAction,determinize,rng,observation} from './core.js';
import {DIRS,distance,key,habitatSizes,wildlifeScore,groups,scoreGame,winners} from './scoring.js';
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
export function boardValue(board,cards,remaining=10){let v=SPECIES.reduce((n,a)=>n+wildlifeScore(board,a,cards[a]),0)+sum(habitatSizes(board));
 if(remaining>0){const bears=groups(board,t=>t.token==='B');for(const g of bears){if(cards.B==='A'&&g.length===1)v+=1.8;if(cards.B==='B'&&g.length<3)v+=g.length*1.6;if(cards.B==='C'&&g.length===2)v+=.5;if(cards.B==='D'&&g.length===1)v+=2;}
  for(const t of board){if(!t.token)v+=t.wildlife.length*.06;else if(t.token==='F')v+=Math.min(3,board.filter(a=>!a.token&&distance(a,t)===1).length)*.17;}
 }return v;
}
function edges(s,a){const p=s.players[s.currentPlayer],t=CATALOG[s.pending?.tile??s.marketTiles[a.tile]],r=a.rotation??0;let v=0;for(let d=0;d<6;d++){const n=p.board.find(n=>n.q===a.q+DIRS[d][0]&&n.r===a.r+DIRS[d][1]);if(n){v+=.12;if(t.sides[(d-r+6)%6]===n.sides[((d+3)%6-n.rotation+6)%6])v+=1;}}return v;}
function tokenBest(s,animal,extra=null){const p=s.players[s.currentPlayer],base=boardValue(p.board,s.cards,20-p.turns);let best=0;for(const t of [...p.board,...(extra?[extra]:[])])if(!t.token&&t.wildlife.includes(animal)){const b=[...p.board,...(extra?[extra]:[])].map(a=>a===t?{...a,token:animal}:a);best=Math.max(best,boardValue(b,s.cards,19-p.turns)-base+(t.keystone?1.25:0));}return best;}
export function rankActions(s,{limit=24,style='tuned'}={}){const actions=legalActions(s),p=s.players[s.currentPlayer];if(!actions.length)return [];
 let ranked;
 if(s.phase==='tile'){
  const screened=actions.map(action=>({action,prior:edges(s,action)})).sort((a,b)=>b.prior-a.prior).slice(0,style==='greedy'?8:28);
  ranked=screened.map(({action,prior})=>{const next=applyAction(s,action,{validate:false});return {action,prior:boardValue(next.players[s.currentPlayer].board,s.cards,20-p.turns)+tokenBest(next,s.pending.token)+prior*.1};});
 }else if(s.phase==='wildlife')ranked=actions.map(action=>{const next=applyAction({...s,mode:'physical'},action,{validate:false});return {action,prior:boardValue(next.players[s.currentPlayer].board,s.cards,20-next.players[s.currentPlayer].turns)+next.players[s.currentPlayer].nature};});
 else {
  const tokenValues=Object.fromEntries(SPECIES.map(a=>[a,tokenBest(s,a)])),tileValues={};for(let i=0;i<4;i++){const t=CATALOG[s.marketTiles[i]];if(!t)continue;const hypothetical={...s,pending:{tile:t.id}},placements=legalActions({...hypothetical,phase:'tile'});tileValues[i]=Math.max(...placements.map(a=>edges(hypothetical,a)))+t.wildlife.length*.14+(t.keystone?.2:0);}
  ranked=actions.map(action=>{if(action.type==='draft'){const animal=s.marketTokens[action.token],t=CATALOG[s.marketTiles[action.tile]],potential=t.wildlife.includes(animal)?(t.keystone?3.3:2.2):0;return {action,prior:tileValues[action.tile]+Math.max(tokenValues[animal],potential)-(action.tile!==action.token?1.3:0)};}
   if(action.type==='resolve')return {action,prior:-3};if(action.reason==='overpopulation')return {action,prior:actions.length===1?20:-.2};return {action,prior:-1.8};});
 }
 return ranked.sort((a,b)=>b.prior-a.prior).slice(0,limit);
}
export function policy(s,random,style='tuned'){const choices=rankActions(s,{style,limit:4});if(style==='stochastic'&&random()<.16)return choices[Math.floor(random()*choices.length)].action;return choices[0].action;}
export function createSearch(o,{seed=1,horizon=2,maxArms=24}={}){const blocker=analysisBlocker(o);if(blocker)throw Error(blocker);const clean=observation(o),actions=rankActions(clean,{limit:maxArms});return {o:clean,actor:o.currentPlayer,random:rng(seed),horizon,iterations:0,totalLegal:legalActions(clean).length,arms:actions.map(a=>({...a,visits:0,sum:0,squares:0}))};}
export function runSearch(s,n=1){for(let k=0;k<n;k++){
 const unseen=s.arms.find(a=>!a.visits),arm=unseen??s.arms.reduce((a,b)=>b.sum/b.visits+3*Math.sqrt(Math.log(s.iterations+1)/b.visits)>a.sum/a.visits+3*Math.sqrt(Math.log(s.iterations+1)/a.visits)?b:a);
 let world=determinize(s.o,s.random);world=applyAction(world,arm.action,{validate:false});const start=s.o.players[s.actor].turns;
 for(let step=0;step<36&&world.phase!=='gameover'&&world.players[s.actor].turns<start+s.horizon;step++){if(world.phase==='observe')throw Error('Unsupplied sampled draw');world=applyAction(world,policy(world,s.random,'stochastic'),{validate:false});}
 const ours=world.players[s.actor],scores=world.players.map(p=>boardValue(p.board,world.cards,20-p.turns)+p.nature),other=scores.length>1?Math.max(...scores.filter((_,i)=>i!==s.actor)):0;
 const terminal=world.phase==='gameover'?scoreGame(world).map(sc=>sc.total):null;const result=terminal?(terminal.length===1?terminal[0]:(winners(world).includes(s.actor)?25:-25)+(terminal[s.actor]-Math.max(...terminal.filter((_,i)=>i!==s.actor)))*.25):scores[s.actor]-other*.25;arm.visits++;arm.sum+=result;arm.squares+=result*result;s.iterations++;
}}
export function summary(s){return {iterations:s.iterations,totalLegal:s.totalLegal,examined:s.arms.length,candidates:s.arms.map(a=>({action:a.action,visits:a.visits,utility:a.visits?a.sum/a.visits:null,se:a.visits>1?Math.sqrt(Math.max(0,a.squares-a.sum*a.sum/a.visits)/(a.visits-1)/a.visits):null,prior:a.prior})).sort((a,b)=>(b.utility??-Infinity)-(a.utility??-Infinity)||b.prior-a.prior)};}
