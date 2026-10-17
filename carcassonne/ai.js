import {TILE_LIST,rotated} from './catalog.js';
import {applyAction,legalActions,graph,majority,featurePoints,remaining,rng,drawTile,observation,placements} from './core.js';
/** Tuned positional baseline, points-equivalent and intentionally not calibrated. */
function featureValue(c,g,progress,final){if(final||c.type!=='field'&&c.open===0)return featurePoints(c,g,c.open!==0||c.type==='field');
 if(c.type==='field'){let value=0;for(const id of c.cities){const city=g.components.find(x=>x.id===id);if(city)value+=city.open===0?3:3*Math.exp(-city.open*(.38+progress*.8));}return value+Math.min(3,c.tiles.size*.15)*(1-progress);}
 if(c.type==='city')return (c.tiles.size+c.shields)*(1+Math.exp(-c.open*(.3+progress*.55)));
 if(c.type==='monastery')return 1+c.neighbors+(8-c.neighbors)*(.36*(1-progress));
 return c.tiles.size+.45*(1-progress);
}
function graphValue(s,g,added=null,finishing=false){const v=s.players.map(p=>p.score),supply=s.players.map(p=>p.supply),left=remaining(s)+(s.drawn?1:0),progress=1-left/71,final=finishing&&!left;
 if(added!==null)supply[s.currentPlayer]--;
 for(const c of g.components){const counts=Array(v.length).fill(0);for(const m of c.meeples)counts[m.player]++;if(added!==null&&c===g.byNode[s.last+':'+added])counts[s.currentPlayer]++;const max=Math.max(...counts);if(!max)continue;const value=featureValue(c,g,progress,final);for(let p=0;p<v.length;p++){if(counts[p]===max)v[p]+=value;if(final||c.type!=='field'&&c.open===0)supply[p]+=counts[p];}}
 const reserve=final?0:1.25*(1-progress);for(let p=0;p<v.length;p++)v[p]+=reserve*Math.min(supply[p],3)+(final?0:.12*supply[p]);return v;
}
export function evaluate(s){if(s.phase==='gameover')return s.players.map(p=>p.score);return graphValue(s,graph(s));}
export function utility(values,p){const others=values.filter((_,i)=>i!==p);return values[p]-Math.max(...others);}
/** Build each placement graph once, then evaluate its meeple alternatives without
 * re-running the same graph/scoring transition for every empty local feature. */
export function rankedActions(s){const out=[],p=s.currentPlayer;const bases=s.phase==='place'?placements(s).map(action=>({action,next:applyAction(s,action)})):s.phase==='meeple'?[{action:{type:'meeple'},next:s}]:[];
 for(const {action,next}of bases){const g=graph(next),opts=[null];if(next.players[p].supply)for(const f of rotated(next.board[next.last].id,next.board[next.last].r).features)if(!g.byNode[next.last+':'+f.id].meeples.length)opts.push(f.id);for(const feature of opts)out.push({action:{...action,feature},prior:utility(graphValue(next,g,feature,true),p)});}
 return out.sort((a,b)=>b.prior-a.prior||JSON.stringify(a.action).localeCompare(JSON.stringify(b.action)));
}
export function heuristic(s,random=()=>.5,{stochastic=false}={}){const list=rankedActions(s);if(!list.length)return null;if(!stochastic)return list[0].action;const pool=list.slice(0,Math.min(5,list.length));const weights=pool.map(x=>Math.exp((x.prior-pool[0].prior)/1.6));let n=random()*weights.reduce((a,b)=>a+b,0);return pool.find((_,i)=>(n-=weights[i])<=0)?.action??pool[0].action;}
export function sampleDraw(s,random){let n=random()*remaining(s);for(const t of TILE_LIST){n-=s.remaining[t.id];if(n<0)return drawTile(s,t.id);}return s;}
/** Root UCB with progressive widening; each rollout samples ONLY public remaining
 * counts and uses per-seat adversarial positional responses. No stored deck exists.
 * Full-horizon games are costly: default horizon 3 plies + field-aware value. */
export function createSearch(state,{seed=1,horizon=3}={}){const s=observation(state);if(!['place','meeple'].includes(s.phase))throw Error('Record the drawn tile before analysis');return {state:s,random:rng(seed),horizon,iterations:0,candidates:rankedActions(s).map(c=>({...c,visits:0,sum:0,sum2:0}))};}
export function runSearch(search,count=1){const q=search,p=q.state.currentPlayer;for(let k=0;k<count;k++){const width=Math.min(q.candidates.length,Math.max(4,Math.floor(3*Math.sqrt(q.iterations+1))));let c=q.candidates.slice(0,width).find(x=>!x.visits);if(!c)c=q.candidates.slice(0,width).reduce((best,x)=>{const score=x.sum/x.visits+3.2*Math.sqrt(Math.log(q.iterations+1)/x.visits)+.25*(x.prior-q.candidates[0].prior)/(1+x.visits);return !best||score>best.score?{x,score}:best;},null)?.x;if(!c)return;let s=applyAction(q.state,c.action);for(let d=0;d<q.horizon&&s.phase!=='gameover';d++){while(s.phase==='draw')s=sampleDraw(s,q.random);if(s.phase==='gameover')break;const a=heuristic(s,q.random,{stochastic:true});if(!a)break;s=applyAction(s,a);}const value=utility(evaluate(s),p);c.visits++;c.sum+=value;c.sum2+=value*value;q.iterations++;}}
export function summary(q){return {iterations:q.iterations,legal:q.candidates.length,examined:q.candidates.filter(c=>c.visits).length,candidates:q.candidates.map(c=>({action:c.action,prior:c.prior,visits:c.visits,utility:c.visits?c.sum/c.visits:null,se:c.visits>1?Math.sqrt(Math.max(0,(c.sum2-c.sum*c.sum/c.visits)/(c.visits-1))/c.visits):null})).sort((a,b)=>b.visits-a.visits||b.prior-a.prior)};}
