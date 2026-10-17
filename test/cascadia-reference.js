/** Independently written scorer for differential verification. No rules/scoring imports. */
const ds=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
const dist=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function components(xs){const todo=[...xs],out=[];while(todo.length){const c=[todo.pop()];for(let i=0;i<c.length;i++)for(let j=todo.length-1;j>=0;j--)if(dist(c[i],todo[j])===1)c.push(todo.splice(j,1)[0]);out.push(c);}return out;}
function pack(n,groups){const memo=new Map();function f(used){if(memo.has(used))return memo.get(used);let i=0;while(i<n&&(used&(1<<i)))i++;if(i===n)return 0;let v=f(used|(1<<i));for(const [mask,points]of groups)if((mask&(1<<i))&&!(used&mask))v=Math.max(v,points+f(used|mask));memo.set(used,v);return v;}return f(0);}
const capped=(a,n)=>a[Math.min(a.length-1,n)]??0;
export function referenceWildlife(board,species,card){const xs=board.filter(t=>t.token===species),cs=components(xs);
 if(species==='B'){const sizes=cs.map(c=>c.length);if(card==='A')return capped([0,4,11,19,27],sizes.filter(n=>n===2).length);if(card==='B')return sizes.filter(n=>n===3).length*10;if(card==='C')return sizes.reduce((s,n)=>s+({1:2,2:5,3:8}[n]??0),0)+([1,2,3].every(n=>sizes.includes(n))?3:0);return sizes.reduce((s,n)=>s+({2:5,3:8,4:13}[n]??0),0);}
 if(species==='E'){
  if(card==='C')return cs.reduce((s,c)=>s+capped([0,2,4,7,10,14,18,23,28],c.length),0);
  const shapes=[];for(let mask=1;mask<(1<<xs.length);mask++){const part=xs.filter((_,i)=>mask&(1<<i)),n=part.length;if(n>(card==='D'?6:4))continue;let valid=n===1;
   if(card==='A'){const q=new Set(part.map(t=>t.q)),r=new Set(part.map(t=>t.r)),z=new Set(part.map(t=>t.q+t.r));valid=(q.size===1||r.size===1||z.size===1)&&Math.max(...part.flatMap(a=>part.map(b=>dist(a,b))))===n-1;}
   if(card==='B'){const degrees=part.map(a=>part.filter(b=>a!==b&&dist(a,b)===1).length).sort();valid=n===1||n===2&&degrees.join()==='1,1'||n===3&&degrees.join()==='2,2,2'||n===4&&degrees.join()==='2,2,3,3';}
   if(card==='D'&&n>1){valid=false;for(const a of part)for(const [dq,dr]of ds){const center={q:a.q+dq,r:a.r+dr};if(part.every(t=>dist(t,center)===1)){const ring=ds.map(([q,r])=>part.some(t=>t.q===center.q+q&&t.r===center.r+r));if(n===6||ring.filter((on,i)=>on&&!ring[(i+5)%6]).length===1)valid=true;}}}
   if(valid)shapes.push([mask,(card==='D'?[0,2,5,8,12,16,21]:[0,2,5,9,13])[n]]);
  }return pack(xs.length,shapes);
 }
 if(species==='S')return cs.reduce((score,c)=>{if(c.some(a=>c.filter(b=>a!==b&&dist(a,b)===1).length>2))return score;const n=c.length;if(card==='A')return score+capped([0,2,5,8,12,16,20,25],n);if(card==='B')return score+capped([0,2,4,9,11,17],n);if(card==='C')return score+(n<3?0:n===3?10:n===4?12:15);return score+n+board.filter(t=>t.token&&t.token!=='S'&&c.some(a=>dist(a,t)===1)).length;},0);
 const adjacent=part=>board.filter(t=>t.token&&!part.includes(t)&&part.some(a=>dist(a,t)===1));
 if(species==='H'){
  const lines=[];for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++){const a=xs[i],b=xs[j];if(!(a.q===b.q||a.r===b.r||a.q+a.r===b.q+b.r))continue;const between=board.filter(t=>t!==a&&t!==b&&dist(a,t)+dist(t,b)===dist(a,b)&&(a.q===b.q?t.q===a.q:a.r===b.r?t.r===a.r:t.q+t.r===a.q+a.r));if(!between.some(t=>t.token==='H'))lines.push({i,j,between});}
  const isolated=xs.map((a,i)=>({a,i})).filter(({a})=>xs.every(b=>a===b||dist(a,b)>1));if(card==='A')return capped([0,2,5,8,11,14,18,22,26],isolated.length);if(card==='B')return capped([0,0,5,9,12,16,20,24,28],isolated.filter(({i})=>lines.some(l=>l.i===i||l.j===i)).length);if(card==='C')return lines.length*3;return pack(xs.length,lines.map(l=>[(1<<l.i)|(1<<l.j),capped([0,4,7,9],new Set(l.between.filter(t=>t.token).map(t=>t.token)).size)]));
 }
 function pairs(near){return ['B','E','S','H'].filter(a=>near.filter(t=>t.token===a).length>=2).length;}
 if(card==='D'){const options=[];for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)if(dist(xs[i],xs[j])===1)options.push([(1<<i)|(1<<j),[0,5,7,9,11][pairs(adjacent([xs[i],xs[j]]))]]);return pack(xs.length,options);}
 return xs.reduce((s,t)=>{const near=adjacent([t]);if(card==='A')return s+new Set(near.map(t=>t.token)).size;if(card==='B')return s+[0,3,5,7][pairs(near)];return s+Math.max(0,...['B','E','S','H'].map(a=>near.filter(t=>t.token===a).length));},0);
}
export function referenceHabitats(board){const result={};for(const h of ['M','F','P','W','R']){const parent=board.map((_,i)=>i),find=i=>parent[i]===i?i:parent[i]=find(parent[i]);for(let i=0;i<board.length;i++)for(let j=i+1;j<board.length;j++){const a=board[i],b=board[j],d=ds.findIndex(([q,r])=>b.q-a.q===q&&b.r-a.r===r);if(d>=0&&a.sides[(d+6-a.rotation)%6]===h&&b.sides[(d+9-b.rotation)%6]===h)parent[find(i)]=find(j);}const sizes={};board.forEach((t,i)=>{if(t.sides.includes(h))sizes[find(i)]=(sizes[find(i)]??0)+1;});result[h]=Math.max(0,...Object.values(sizes));}return result;}
