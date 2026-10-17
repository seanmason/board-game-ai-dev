/** Exact standard A–D scoring. Axial hexes; directions run clockwise. */
import {SPECIES,HABITATS} from './catalog.js';
export const DIRS=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
export const key=(q,r)=>`${q},${r}`;
export const neighbors=t=>DIRS.map(([q,r])=>key(t.q+q,t.r+r));
export const distance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
export function groups(board,predicate,connected=(a,b)=>distance(a,b)===1){
 const remaining=board.filter(predicate),out=[];const seen=new Set();
 for(const a of remaining){if(seen.has(a))continue;const g=[a];seen.add(a);for(let i=0;i<g.length;i++)for(const b of remaining)if(!seen.has(b)&&connected(g[i],b)){seen.add(b);g.push(b);}out.push(g);}return out;
}
const table=(xs,n)=>xs[Math.min(n,xs.length-1)]??0;
/** Maximum-weight disjoint groups; every token may score at most once. */
export function bestPartition(n,candidates){
 const by=Array.from({length:n},()=>[]);for(const c of candidates)for(let i=0;i<n;i++)if(c.mask&(1<<i))by[i].push(c);
 const memo=new Map();function solve(mask){if(!mask)return 0;if(memo.has(mask))return memo.get(mask);const bit=mask&-mask,i=31-Math.clz32(bit);let best=solve(mask^bit);for(const c of by[i])if((mask&c.mask)===c.mask)best=Math.max(best,c.points+solve(mask^c.mask));memo.set(mask,best);return best;}return solve((1<<n)-1);
}
export function elkScore(board,card){const elk=board.filter(t=>t.token==='E');
 if(card==='C')return groups(elk,()=>true).reduce((s,g)=>s+table([0,2,4,7,10,14,18,23,28],g.length),0);
 const ix=new Map(elk.map((t,i)=>[key(t.q,t.r),i])),candidates=new Map();
 function add(coords,points){let mask=0;for(const [q,r]of coords){const i=ix.get(key(q,r));if(i===undefined)return;mask|=1<<i;}if(!candidates.has(mask)||points>candidates.get(mask))candidates.set(mask,points);}
 for(const t of elk){add([[t.q,t.r]],2);for(let d=0;d<6;d++){
  const [q,r]=DIRS[d],next=DIRS[(d+1)%6];
  if(card==='A')for(let size=2;size<=4;size++)add(Array.from({length:size},(_,j)=>[t.q+j*q,t.r+j*r]),[0,2,5,9,13][size]);
  if(card==='B'){add([[t.q,t.r],[t.q+q,t.r+r]],5);add([[t.q,t.r],[t.q+q,t.r+r],[t.q+next[0],t.r+next[1]]],9);add([[t.q,t.r],[t.q+q,t.r+r],[t.q+next[0],t.r+next[1]],[t.q+q+next[0],t.r+r+next[1]]],13);}
 }}
 if(card==='D'){
  const centers=new Map();for(const t of elk)for(const [q,r]of DIRS)centers.set(key(t.q+q,t.r+r),[t.q+q,t.r+r]);
  for(const [q,r]of centers.values())for(let d=0;d<6;d++)for(let size=2;size<=6;size++)add(Array.from({length:size},(_,j)=>[q+DIRS[(d+j)%6][0],r+DIRS[(d+j)%6][1]]),[0,2,5,8,12,16,21][size]);
 }
 return bestPartition(elk.length,[...candidates].map(([mask,points])=>({mask,points})));
}
export function sightLines(board){const hawks=board.filter(t=>t.token==='H'),lines=[];for(let i=0;i<hawks.length;i++)for(let j=i+1;j<hawks.length;j++){
 const a=hawks[i],b=hawks[j],dq=b.q-a.q,dr=b.r-a.r;if(!(dq===0||dr===0||dq+dr===0))continue;
 const n=distance(a,b),sq=dq/n,sr=dr/n,between=[];let blocked=false;for(let k=1;k<n;k++){const t=board.find(t=>t.q===a.q+sq*k&&t.r===a.r+sr*k);if(t?.token==='H')blocked=true;if(t?.token)between.push(t.token);}if(!blocked)lines.push({i,j,between});}return {hawks,lines};}
export function wildlifeScore(board,species,card='A'){
 const animals=board.filter(t=>t.token===species),components=groups(animals,()=>true);
 if(species==='E')return elkScore(board,card);
 if(species==='B'){
  if(card==='A')return table([0,4,11,19,27],components.filter(g=>g.length===2).length);
  if(card==='B')return components.filter(g=>g.length===3).length*10;
  if(card==='C')return components.reduce((s,g)=>s+([0,2,5,8][g.length]??0),0)+( [1,2,3].every(n=>components.some(g=>g.length===n))?3:0);
  return components.reduce((s,g)=>s+({2:5,3:8,4:13}[g.length]??0),0);
 }
 if(species==='S')return components.reduce((s,g)=>{
  if(g.some(a=>g.filter(b=>a!==b&&distance(a,b)===1).length>2))return s;
  const n=g.length;if(card==='A')return s+table([0,2,5,8,12,16,20,25],n);if(card==='B')return s+table([0,2,4,9,11,17],n);if(card==='C')return s+(n>=5?15:n===4?12:n===3?10:0);
  const adjacent=new Set();for(const a of g)for(const t of board)if(t.token&&t.token!=='S'&&distance(a,t)===1)adjacent.add(t);return s+n+adjacent.size;
 },0);
 if(species==='H'){
  const {hawks,lines}=sightLines(board);const isolated=hawks.filter(a=>!hawks.some(b=>a!==b&&distance(a,b)===1));
  if(card==='A')return table([0,2,5,8,11,14,18,22,26],isolated.length);
  if(card==='B')return table([0,0,5,9,12,16,20,24,28],isolated.filter(a=>lines.some(l=>hawks[l.i]===a||hawks[l.j]===a)).length);
  if(card==='C')return lines.length*3;
  return bestPartition(hawks.length,lines.map(l=>({mask:(1<<l.i)|(1<<l.j),points:table([0,4,7,9],new Set(l.between).size)})));
 }
 const counts=tiles=>{const set=new Set();for(const a of tiles)for(const t of board)if(t.token&&distance(a,t)===1&&!tiles.includes(t))set.add(t);const c={};for(const t of set)c[t.token]=(c[t.token]??0)+1;return c;};
 if(card==='D'){
  const candidates=[];for(let i=0;i<animals.length;i++)for(let j=i+1;j<animals.length;j++)if(distance(animals[i],animals[j])===1){const c=counts([animals[i],animals[j]]),pairs=SPECIES.filter(s=>s!=='F'&&c[s]>=2).length;candidates.push({mask:(1<<i)|(1<<j),points:[0,5,7,9,11][pairs]});}return bestPartition(animals.length,candidates);
 }
 return animals.reduce((sum,a)=>{const c=counts([a]);if(card==='A')return sum+Object.keys(c).length;if(card==='B')return sum+table([0,3,5,7],SPECIES.filter(s=>s!=='F'&&c[s]>=2).length);return sum+Math.max(0,...SPECIES.filter(s=>s!=='F').map(s=>c[s]??0));},0);
}
export function habitatSizes(board){return Object.fromEntries(HABITATS.map(h=>[h,Math.max(0,...groups(board,t=>t.sides.includes(h),(a,b)=>{const d=DIRS.findIndex(([q,r])=>b.q===a.q+q&&b.r===a.r+r);return d>=0&&a.sides[(d-a.rotation+6)%6]===h&&b.sides[((d+3)%6-b.rotation+6)%6]===h;}).map(g=>g.length))]));}
export function scoreGame(state){const scores=state.players.map(p=>({wildlife:Object.fromEntries(SPECIES.map(s=>[s,wildlifeScore(p.board,s,state.cards[s])])),habitats:habitatSizes(p.board),bonus:Object.fromEntries(HABITATS.map(h=>[h,0])),nature:p.nature}));
 for(const h of HABITATS){const sizes=scores.map(s=>s.habitats[h]),max=Math.max(...sizes),first=sizes.flatMap((s,i)=>s===max?[i]:[]);
  if(scores.length===1){scores[0].bonus[h]=max>=7?2:0;continue;}
  if(scores.length===2){for(const i of first)scores[i].bonus[h]=first.length===1?2:1;continue;}
  for(const i of first)scores[i].bonus[h]=first.length===1?3:first.length===2?2:1;
  if(first.length===1){const second=Math.max(...sizes.filter(s=>s<max)),seconds=sizes.flatMap((s,i)=>s===second?[i]:[]);if(seconds.length===1)scores[seconds[0]].bonus[h]=1;}
 }
 return scores.map(s=>({...s,total:[...Object.values(s.wildlife),...Object.values(s.habitats),...Object.values(s.bonus),s.nature].reduce((a,b)=>a+b,0)}));
}
export function winners(state){const scores=scoreGame(state),best=Math.max(...scores.map(s=>s.total)),tied=scores.flatMap((s,i)=>s.total===best?[i]:[]),nature=Math.max(...tied.map(i=>scores[i].nature));return tied.filter(i=>scores[i].nature===nature);}
