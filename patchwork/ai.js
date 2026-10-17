import {PATCHES,INCOME,END} from './catalog.js';
import {applyAction,available,placements,placementCells,scores} from './core.js';
const emptyCount=b=>b.reduce((n,v)=>n+!v,0);
export function packing(board){
 const seen=new Uint8Array(81);let trapped=0,regions=0,perimeter=0,corner=0;
 for(let i=0;i<81;i++)if(board[i]){corner+=(i%9+Math.floor(i/9))*.006;for(const j of neighbours(i))if(!board[j])perimeter++;}
 else if(!seen[i]){regions++;const q=[i];seen[i]=1;for(let k=0;k<q.length;k++)for(const j of neighbours(q[k]))if(!board[j]&&!seen[j]){seen[j]=1;q.push(j);}if(q.length<3)trapped+=3-q.length;}
 // Reward progress toward a contiguous 7×7; retains value until a claimant exists.
 let square=0;for(let y=0;y<3;y++)for(let x=0;x<3;x++){let n=0;for(let dy=0;dy<7;dy++)for(let dx=0;dx<7;dx++)n+=!!board[(y+dy)*9+x+dx];square=Math.max(square,n);}
 return {penalty:trapped*2.2+Math.max(0,regions-1)*1.2+perimeter*.065+corner,square};
}
const NEIGHBOURS=Array.from({length:81},(_,i)=>[i%9?i-1:-1,i%9<8?i+1:-1,i>=9?i-9:-1,i<72?i+9:-1].filter(j=>j>=0));
const neighbours=i=>NEIGHBOURS[i];
function contact(board,a){let n=0;for(const i of placementCells(a.id,a.orientation,a.x,a.y)){n+=((i%9===0)+(i%9===8)+(i<9)+(i>=72))*.9;for(const j of neighbours(i))if(board[j])n++;n-=(i%9+Math.floor(i/9))*.006;}return n;}
export function candidateActions(s,{width=2}={}){
 if(s.phase==='gameover'||s.phase==='setup')return [];
 const p=s.players[s.currentPlayer],ids=s.phase==='leather'?[0]:available(s).filter(id=>PATCHES[id].cost<=p.buttons);
 const out=s.phase==='play'?[{type:'advance'}]:[];
 for(const id of ids){
  const list=placements(p.board,id).map(a=>({a,c:contact(p.board,a)})).sort((a,b)=>b.c-a.c).slice(0,Math.max(width*4,12));
  const ranked=list.map(({a,c})=>{const b=p.board.slice();for(const i of placementCells(id,a.orientation,a.x,a.y))b[i]=1;const pack=packing(b);return {a,value:-pack.penalty+(s.bonusOwner===null?Math.pow(pack.square/49,4)*7:0)+c*.05};}).sort((a,b)=>b.value-a.value);
  out.push(...ranked.slice(0,width).map(x=>x.a));
 }
 return out;
}
export function evaluate(s,seat){
 const sc=scores(s);if(s.phase==='gameover')return sc[seat]-sc[1-seat]+(sc[seat]===sc[1-seat]?(s.firstFinished===seat?.01:-.01):0);
 const v=s.players.map((p,i)=>{
  const future=INCOME.filter(t=>t>p.time).length,remaining=END-p.time,space=emptyCount(p.board),pack=packing(p.board);
  // Time is a consumable resource: expected future net coverage/income purchases.
  const capacity=Math.min(space,remaining*1.15),liquidity=Math.min(12,p.buttons)*remaining/END*.12;
  return sc[i]+p.income*future*.9+capacity*1.15+liquidity-pack.penalty+(s.bonusOwner===null?Math.pow(pack.square/49,4)*7:0);
 });
 return v[seat]-v[1-seat];
}
export function heuristicAction(s){let best=null,value=-Infinity;for(const a of candidateActions(s,{width:1})){const v=evaluate(applyAction(s,a),s.currentPlayer);if(v>value){value=v;best=a;}}return best;}
function ordered(s,seat,width){return candidateActions(s,{width}).map(a=>({action:a,state:applyAction(s,a)})).sort((a,b)=>(evaluate(b.state,seat)-evaluate(a.state,seat))*(s.currentPlayer===seat?1:-1));}
export function createSearch(state,{width=2,maxDepth=Infinity}={}){
 const seat=state.currentPlayer,roots=ordered(state,seat,Math.max(3,width));
 return {state,seat,width,maxDepth,roots:roots.map(r=>({...r,value:evaluate(r.state,seat),depth:0,nodes:0,pv:[r.action],levels:[{value:evaluate(r.state,seat),pv:[r.action]}]})),depth:1,rootIndex:0,stack:[],iterations:0,complete:false,cutoffs:0,round:1};
}
// Explicit DFS stack: a worker slice can stop after any node, including at deep horizons.
export function runSearch(search,count=1){
 if(!search.roots.length){search.complete=true;return;}
 for(let n=0;n<count;n++){
  if(search.complete)return;
  if(!search.stack.length){const r=search.roots[search.rootIndex];search.stack.push({state:r.state,depth:search.depth-1,alpha:-Infinity,beta:Infinity,path:[r.action],entered:false});}
  const f=search.stack.at(-1);search.iterations++;search.roots[search.rootIndex].nodes++;
  let resolved=false,value,pv;
  if(!f.entered){
   f.entered=true;
   if(f.depth<=0||f.state.phase==='gameover'){if(f.state.phase!=='gameover')search.cutoffs++;resolved=true;value=evaluate(f.state,search.seat);pv=f.path;}
   else{f.max=f.state.currentPlayer===search.seat;f.value=f.max?-Infinity:Infinity;f.children=ordered(f.state,search.seat,search.width);f.i=0;f.pv=f.path;}
  }
  if(!resolved&&f.i<f.children.length&&f.alpha<f.beta){const c=f.children[f.i++];search.stack.push({state:c.state,depth:f.depth-1,alpha:f.alpha,beta:f.beta,path:[...f.path,c.action],entered:false});continue;}
  if(!resolved){value=f.value;pv=f.pv;}
  search.stack.pop();
  if(search.stack.length){const p=search.stack.at(-1);if((p.max&&value>p.value)||(!p.max&&value<p.value)){p.value=value;p.pv=pv;}if(p.max)p.alpha=Math.max(p.alpha,value);else p.beta=Math.min(p.beta,value);}
  else{const r=search.roots[search.rootIndex];r.value=value;r.depth=search.depth;r.pv=pv;r.levels[search.depth]={value,pv};search.rootIndex++;if(search.rootIndex===search.roots.length){search.rootIndex=0;search.depth++;if(search.depth>search.maxDepth)search.complete=true;else if(search.cutoffs===0){if(search.width>=648)search.complete=true;else{search.width=Math.min(648,search.width*2);search.round++;search.depth=1;const previous=new Map(search.roots.map(r=>[JSON.stringify(r.action),r]));search.roots=ordered(search.state,search.seat,Math.max(3,search.width)).map(r=>({...r,value:evaluate(r.state,search.seat),depth:0,nodes:previous.get(JSON.stringify(r.action))?.nodes??0,pv:[r.action],levels:[{value:evaluate(r.state,search.seat),pv:[r.action]}]}));}}search.cutoffs=0;}}
 }
}
export function summary(s){const completed=(s.roots.length?Math.min(...s.roots.map(r=>r.depth)):0);return {iterations:s.iterations,depth:s.depth,completedDepth:completed,complete:s.complete,beamWidth:s.width,round:s.round,legalPlacementsExamined:s.roots.length,candidates:s.roots.map(r=>({action:r.action,value:r.levels[completed].value,depth:completed,nodes:r.nodes,pv:r.levels[completed].pv})).sort((a,b)=>b.value-a.value)};}
