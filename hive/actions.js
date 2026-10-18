import {PIECES,TYPES,queenId,NAMES} from './catalog.js';
import {DIRECTIONS,key,coordinate,add,equal,neighbors,height,top,lift,connected,edgeOpen,frontier} from './geometry.js';
export function locate(board,id){for(const [k,stack] of Object.entries(board)){const level=stack.indexOf(id);if(level>=0)return {at:coordinate(k),level};}return null;}
export function destinations(state,id){const info=PIECES[id],found=locate(state.board,id);if(!info||!found||top(state.board,found.at)!==id||!locate(state.board,queenId(info.player)))return [];const from=found.at,board=lift(state.board,from);if(!connected(board))return [];const result=new Map(),put=(to,path)=>{if(!equal(to,from)&&!result.has(key(to)))result.set(key(to),{to,path});};
 if(info.type==='G'){for(const d of DIRECTIONS){let at=add(from,d);if(!height(board,at))continue;const path=[from,at];while(height(board,at)){at=add(at,d);path.push(at);}put(at,path);}}
 else if(info.type==='B'){for(const to of neighbors(from))if(edgeOpen(board,from,to,{beetle:true}))put(to,[from,to]);}
 else if(info.type==='Q'){for(const to of neighbors(from))if(edgeOpen(board,from,to))put(to,[from,to]);}
 else if(info.type==='A'){const seen=new Set([key(from)]),queue=[{at:from,path:[from]}];for(let i=0;i<queue.length;i++){const {at,path}=queue[i];for(const to of neighbors(at)){if(seen.has(key(to))||!edgeOpen(board,at,to))continue;seen.add(key(to));const next=[...path,to];put(to,next);queue.push({at:to,path:next});}}}
 else if(info.type==='S'){const visit=(at,path)=>{if(path.length===4){put(at,path);return;}for(const to of neighbors(at))if(!path.some(p=>equal(p,to))&&edgeOpen(board,at,to))visit(to,[...path,to]);};visit(from,[from]);}
 return [...result.values()].sort((a,b)=>key(a.to).localeCompare(key(b.to)));}
export function placementCells(s,actor=s.currentPlayer){const cells=Object.keys(s.board);if(!cells.length)return [[0,0]];const hasOwn=cells.some(k=>s.board[k].some(id=>PIECES[id].player===actor));return frontier(s.board).filter(p=>{const adjacent=neighbors(p).map(n=>top(s.board,n)).filter(Boolean);return !hasOwn?true:adjacent.length>0&&adjacent.every(id=>PIECES[id].player===actor);});}
export function legalActions(s,actor=s.currentPlayer){if(s.phase!=='play'||actor!==s.currentPlayer)return [];const out=[],queenPlaced=!!locate(s.board,queenId(actor)),mustQueen=!queenPlaced&&s.turns[actor]>=3,cells=placementCells(s,actor);
 for(const type of TYPES){if(mustQueen&&type!=='Q')continue;const id=s.reserves[actor].filter(x=>PIECES[x].type===type).sort((a,b)=>PIECES[a].ordinal-PIECES[b].ordinal)[0];if(id)for(const to of cells)out.push({type:'place',pieceId:id,to});}
 if(queenPlaced)for(const k of Object.keys(s.board)){const id=s.board[k].at(-1);if(PIECES[id].player!==actor)continue;for(const {to,path} of destinations(s,id))out.push({type:'move',pieceId:id,from:coordinate(k),to,path});}
 return out.length?out:[{type:'pass'}];}
export const actionKey=a=>a.type==='pass'?'pass':`${a.type}:${a.pieceId}:${a.from?key(a.from):''}:${key(a.to)}`;
export function describe(a){if(a.type==='pass')return 'Forced pass — no legal placement or movement';const insect=NAMES[PIECES[a.pieceId]?.type]??a.pieceId;return `${a.type==='place'?'Place':'Move'} ${a.pieceId} ${insect}${a.from?` from (${a.from})`:''} to (${a.to})${a.path?.length>2?` via ${a.path.slice(1,-1).map(p=>`(${p})`).join(' → ')}`:''}`;}
