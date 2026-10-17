/** Heuristic-guided hidden-world lookahead. No actual excluded identities or deck order are used. */
import {TILES,tile} from './catalog.js';
import {applyAction,analysisBlocker,currentPlayer,currentKing,determinize,legalActions,placements,placementCells,score,territories,rng,winners,owner,totalTiles,observation,DIRECTIONS} from './core.js';
const remainingCache=new WeakMap(),supplyCache=new WeakMap();
export function boardValue(board,remaining=[]) {
 let rates=supplyCache.get(remaining);if(!rates){rates={};for(const t of remaining)for(const c of t.halves)rates[c.terrain]=(rates[c.terrain]??0)+c.crowns/Math.max(1,remaining.length);supplyCache.set(remaining,rates);}
 const groups=territories(board),map=new Set(board.map(c=>`${c.x},${c.y}`));
 const xs=board.map(c=>c.x),ys=board.map(c=>c.y),w=Math.max(...xs)-Math.min(...xs)+1,h=Math.max(...ys)-Math.min(...ys)+1;
 let v=0;for(const g of groups){const crowns=rates[g.terrain]??0;
  let frontier=0;const boundary=new Set();for(const[x,y]of g.cells)for(const[dx,dy]of DIRECTIONS){const k=`${x+dx},${y+dy}`;if(!map.has(k))boundary.add(k);}frontier=boundary.size;
  const capacity=Math.max(0,(25-board.length)/2),future=Math.min(capacity,frontier*.6);
  v+=g.score+Math.min(g.size,8)*crowns*Math.min(3,future)*.65+Math.min(g.crowns,4)*future*.32+(g.crowns?0:Math.min(g.size,6)*.08);
 }
 // Interior empty squares are expensive once the bounding box is fixed.
 let holes=0;for(let x=Math.min(...xs);x<=Math.max(...xs);x++)for(let y=Math.min(...ys);y<=Math.max(...ys);y++)if(!map.has(`${x},${y}`)&&DIRECTIONS.filter(([dx,dy])=>map.has(`${x+dx},${y+dy}`)).length>=3)holes++;
 return v-holes*1.7-(w+h)*.13;
}
function remaining(s){let rem=remainingCache.get(s);if(!rem){const seen=new Set(s.seen);rem=TILES.filter(t=>!seen.has(t.id));remainingCache.set(s,rem);}return rem;}
export function bestPlacement(s,who,id,{simple=false}={}){const board=s.players[who].board,acts=placements(board,id);if(!acts.length)return {value:(simple?score(s.players[who]):boardValue(board,remaining(s)))-5,action:{type:'discard'}};const rem=remaining(s);let best=null;for(const a of acts){const b=[...board,...placementCells(id,a)],v=simple?score({board:b}):boardValue(b,rem);if(!best||v>best.value)best={value:v,action:a};}return best;}
export function grade(s,a,{style='tuned'}={}){
 const who=currentPlayer(s),board=s.players[who].board,rem=remaining(s),simple=style==='greedy',base=simple?score(s.players[who]):boardValue(board,rem);
 if(a.type==='discard')return -8;
 if(a.type==='place')return (simple?score({board:[...board,...placementCells(s.current[s.cursor].id,a)]}):boardValue([...board,...placementCells(s.current[s.cursor].id,a)],rem))-base;
 const best=bestPlacement(s,who,a.id,{simple}),gain=best.value-base;
 if(simple)return gain;
 const available=s.offer.filter(t=>t.king===null),rank=s.offer.findIndex(t=>t.id===a.id),futureTurns=Math.max(0,(totalTiles(s)-s.seen.length)/totalTiles(s));
 // Earlier kings choose first next row. Two-player kings retain individual priorities.
 const initiative=(s.offer.length-1-rank)*.6*futureTurns;
 const enemies=s.players.map((p,i)=>i===who?0:bestPlacement(s,i,a.id).value-boardValue(p.board,rem));
 const deny=Math.max(0,...enemies)*.16;
 const alternatives=available.filter(t=>t.id!==a.id).map(t=>tile(t.id).halves.reduce((n,c)=>n+c.crowns,0));
 return gain+initiative+deny+(alternatives.length?0:.01);
}
export function policy(s,random=rng(1),style='tuned'){
 const acts=legalActions(s);if(!acts.length)throw Error('No action available');
 if(style==='random')return acts[Math.floor(random()*acts.length)];
 const rated=acts.map(a=>({a,v:grade(s,a,{style})})).sort((a,b)=>b.v-a.v);
 if(style==='stochastic'&&random()<.12)return rated[Math.floor(random()*Math.min(4,rated.length))].a;
 const ties=rated.filter(x=>Math.abs(x.v-rated[0].v)<1e-9);return ties[Math.floor(random()*ties.length)].a;
}
export function value(s,who){const rem=remaining(s);return boardValue(s.players[who].board,rem)-Math.max(...s.players.map((p,i)=>i===who?-Infinity:boardValue(p.board,rem)));}
/** Exact final-row optimization: kingdoms no longer interact after the last draft.
 * Each player has at most two pending dominoes; enumerate their complete legal continuations.
 */
function exactBoard(board,ids,edition){if(!ids.length){const gs=territories(board);return gs.reduce((n,g)=>n+g.score,0)+Math.max(0,...gs.map(g=>g.size))*.001+(edition==='original'?gs.reduce((n,g)=>n+g.crowns,0)*.000001:0);}
 const acts=placements(board,ids[0]);if(!acts.length)return exactBoard(board,ids.slice(1),edition);
 let best=-Infinity;for(const a of acts)best=Math.max(best,exactBoard([...board,...placementCells(ids[0],a)],ids.slice(1),edition));return best;
}
export function exactFinalValue(s,who){const ids=s.current.filter(t=>!t.resolved&&owner(s,t.king)===who).map(t=>t.id);return exactBoard(s.players[who].board,ids,s.edition);}
const isFinal=s=>s.seen.length===totalTiles(s)&&!s.offer.length&&s.phase==='place';
function terminalValue(s,who){const our=score(s.players[who]),others=Math.max(...s.players.map((p,i)=>i===who?-Infinity:score(p)));return our-others+(winners(s).includes(who)?12:0);}
export function createSearch(o,{seed=1,horizon=6,beam=12}={}){
 if(analysisBlocker(o))throw Error(analysisBlocker(o));
 // Strip again at the API boundary; callers cannot accidentally inject actual deck order.
 const publicState=observation(o);
 const arms=legalActions(publicState).map(action=>({action,prior:grade(publicState,action),visits:0,sum:0,squares:0})).sort((a,b)=>b.prior-a.prior);
 const actor=currentPlayer(o);
 if(isFinal(publicState)){
  const opponent=Math.max(...publicState.players.map((_,i)=>i===actor?-Infinity:exactFinalValue(publicState,i)));
  for(const arm of arms){const after=applyAction(publicState,arm.action,{validate:false});arm.exact=exactFinalValue(after,actor)-opponent;arm.prior=arm.exact;}
  arms.sort((a,b)=>b.prior-a.prior);
 }else if(publicState.phase==='place'&&publicState.offer.length&&beam>0){
  // Couple placement to this king's ensuing draft, rather than evaluating the two phases in isolation.
  const rem=remaining(publicState),available=publicState.offer.filter(t=>t.king===null),constants=new Map();
  for(const t of available){const rank=publicState.offer.findIndex(x=>x.id===t.id),initiative=(publicState.offer.length-1-rank)*.6*Math.max(0,(totalTiles(publicState)-publicState.seen.length)/totalTiles(publicState)),denial=Math.max(0,...publicState.players.map((p,i)=>i===actor?0:bestPlacement(publicState,i,t.id).value-boardValue(p.board,rem)))*.16;constants.set(t.id,initiative+denial);}
  for(const arm of arms.slice(0,beam)){
   const after=applyAction(publicState,arm.action,{validate:false}),base=boardValue(after.players[actor].board,rem);
   if(available.length)arm.prior+=Math.max(...available.map(t=>bestPlacement(after,actor,t.id).value-base+constants.get(t.id)))*.65;
  }
  arms.sort((a,b)=>b.prior-a.prior);
 }
 const solved=isFinal(publicState);if(solved)for(const arm of arms){arm.visits=1;arm.sum=arm.exact;arm.squares=arm.exact*arm.exact;}
 return {o:publicState,actor,random:rng(seed),horizon,beam,arms,solved,iterations:solved?arms.length:0};
}
export function runSearch(search,n=1){if(search.solved)return;for(let k=0;k<n;k++){
 const width=Math.min(search.arms.length,Math.max(6,Math.floor(6+Math.sqrt(search.iterations)*2))),active=search.arms.slice(0,width);
 const unvisited=active.find(a=>!a.visits),topPrior=search.arms[0].prior;
 const estimate=a=>a.sum/a.visits+2.2*Math.sqrt(Math.log(search.iterations+2)/a.visits)+.15*(a.prior-topPrior)/(1+a.visits*.05);
 const arm=unvisited??active.reduce((a,b)=>estimate(b)>estimate(a)?b:a);
 if(arm.exact!==undefined){arm.visits++;arm.sum+=arm.exact;arm.squares+=arm.exact*arm.exact;search.iterations++;continue;}
 let s=determinize(search.o,search.random);s=applyAction(s,arm.action,{validate:false});
 for(let step=0;step<search.horizon&&s.phase!=='gameover';step++)s=applyAction(s,policy(s,search.random,'stochastic'),{validate:false});
 const utility=s.phase==='gameover'?terminalValue(s,search.actor):value(s,search.actor);arm.visits++;arm.sum+=utility;arm.squares+=utility*utility;search.iterations++;
 }}
export function summary(s){return {iterations:s.iterations,solved:s.solved,legalCount:s.arms.length,considered:s.arms.filter(a=>a.visits).length,candidates:s.arms.map(a=>({action:a.action,visits:a.visits,utility:a.visits?a.sum/a.visits:null,se:a.visits>1?Math.sqrt(Math.max(0,a.squares-a.sum*a.sum/a.visits)/(a.visits-1)/a.visits):null,prior:a.prior,
 // A small prior blend stabilizes undersampled large placement spaces. This is an evaluation, not a probability.
 ranking:a.exact!==undefined?a.exact:a.visits?(a.sum+3*a.prior)/(a.visits+3):a.prior-1000})).sort((a,b)=>b.ranking-a.ranking||b.prior-a.prior)};}
export function choose(s,{iterations=24,seed=1,horizon=6,beam=12}={}){const search=createSearch(s,{seed,horizon,beam});runSearch(search,iterations);return summary(search).candidates[0].action;}
