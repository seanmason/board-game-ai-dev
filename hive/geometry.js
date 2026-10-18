export const DIRECTIONS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
export const key=([q,r])=>`${q},${r}`;
export const coordinate=k=>k.split(',').map(Number);
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
export const equal=(a,b)=>a[0]===b[0]&&a[1]===b[1];
export const neighbors=p=>DIRECTIONS.map(d=>add(p,d));
export const height=(board,p)=>board[key(p)]?.length??0;
export const top=(board,p)=>board[key(p)]?.at(-1)??null;
export function connected(board){const cells=Object.keys(board);if(cells.length<2)return true;const seen=new Set([cells[0]]),todo=[cells[0]];while(todo.length){const at=coordinate(todo.pop());for(const p of neighbors(at)){const k=key(p);if(board[k]?.length&&!seen.has(k)){seen.add(k);todo.push(k);}}}return seen.size===cells.length;}
export function lift(board,from){const next={...board},k=key(from),stack=board[k]?.slice();if(!stack?.length)throw Error('Empty source');stack.pop();if(stack.length)next[k]=stack;else delete next[k];return next;}
export function flanks(from,to){const d=DIRECTIONS.findIndex(v=>equal(add(from,v),to));if(d<0)throw Error('Edge is not adjacent');return [add(from,DIRECTIONS[(d+5)%6]),add(from,DIRECTIONS[(d+1)%6])];}
/** Heights refer to stationary supports after lifting the moving tile. */
export function edgeOpen(board,from,to,{beetle=false}={}){if(!neighbors(from).some(p=>equal(p,to)))return false;const a=height(board,from),b=height(board,to),f=flanks(from,to).map(p=>height(board,p));if(!beetle&&(a>0||b>0))return false;const support=Math.max(a,b);if(f.every(h=>h>support))return false;if(support===0)return (f[0]>0)!==(f[1]>0);return true;}
export function frontier(board){const result=new Map();for(const k of Object.keys(board))for(const p of neighbors(coordinate(k)))if(!height(board,p))result.set(key(p),p);return [...result.values()];}
export function translate(board,delta){return Object.fromEntries(Object.entries(board).map(([k,stack])=>[key(add(coordinate(k),delta)),[...stack]]));}
export const rotate=([q,r])=>[-r,q+r];
export const reflect=([q,r])=>[r,q];
