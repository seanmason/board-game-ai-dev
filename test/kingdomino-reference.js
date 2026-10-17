/** Independent rule oracle: no core/AI imports. Catalog facts are the only shared input. */
import {tile} from '../kingdomino/catalog.js';
const vec=[[1,0],[0,1],[-1,0],[0,-1]],where=(x,y)=>x+','+y;
const owner=(s,k)=>s.players.length===2?Math.floor(k/2):k;
export function referenceActions(s){
 if(s.phase==='draft')return s.offer.filter(t=>t.king===null).map(t=>({type:'pick',id:t.id}));if(s.phase!=='place')return [];
 const id=s.current[s.cursor].id,b=s.players[owner(s,s.current[s.cursor].king)].board,t=tile(id),same=t.halves[0].terrain===t.halves[1].terrain&&t.halves[0].crowns===t.halves[1].crowns,out=[];
 for(let x=-4;x<=4;x++)for(let y=-4;y<=4;y++)for(let rotation=0;rotation<(same?2:4);rotation++){
 const [dx,dy]=vec[rotation],cs=[{x,y,half:0},{x:x+dx,y:y+dy,half:1}];
 if(cs.some(c=>b.some(n=>n.x===c.x&&n.y===c.y)))continue;
 const all=[...b,...cs];if(Math.max(...all.map(c=>c.x))-Math.min(...all.map(c=>c.x))>=5||Math.max(...all.map(c=>c.y))-Math.min(...all.map(c=>c.y))>=5)continue;
 let connect=false;for(const c of cs)for(const n of b)if(Math.abs(c.x-n.x)+Math.abs(c.y-n.y)===1&&(n.id===0||tile(n.id).halves[n.half].terrain===t.halves[c.half].terrain))connect=true;
 if(connect)out.push({type:'place',x,y,rotation});
 }return out.length?out:[{type:'discard'}];
}
function reveal(s){const size=s.players.length===3&&s.edition==='original'?3:4,ids=s.deck.splice(0,size);s.seen.push(...ids);s.rowCount++;s.offer=ids.sort((a,b)=>a-b).map(id=>({id,king:null}));s.phase=s.current.length?'place':'draft';}
export function referenceStep(state,a){const s=structuredClone(state),nk=s.initialOrder.length;
 function promote(){s.unclaimed.push(...s.offer.filter(t=>t.king===null).map(t=>t.id));s.current=s.offer.filter(t=>t.king!==null).map(t=>({...t,resolved:false}));s.offer=[];s.cursor=0;s.round++;if(s.deck.length)reveal(s);else s.phase='place';}
 if(a.type==='pick'){s.offer.find(t=>t.id===a.id).king=s.current.length?s.current[s.cursor].king:s.initialOrder[s.cursor];s.cursor++;s.turn++;if(s.cursor===nk)promote();else if(s.current.length)s.phase='place';}
 else {const t=s.current[s.cursor],p=s.players[owner(s,t.king)];if(a.type==='discard')p.discarded.push(t.id);else {const [dx,dy]=vec[a.rotation];p.board.push({x:a.x,y:a.y,id:t.id,half:0},{x:a.x+dx,y:a.y+dy,id:t.id,half:1});}t.resolved=true;s.turn++;if(s.offer.length)s.phase='draft';else {s.cursor++;if(s.cursor===nk)s.phase='gameover';}}
 return s;
}
export function referenceScores(board){const cells=board.filter(c=>c.id),parents=cells.map((_,i)=>i),find=i=>parents[i]===i?i:parents[i]=find(parents[i]);for(let i=0;i<cells.length;i++)for(let j=0;j<i;j++)if(Math.abs(cells[i].x-cells[j].x)+Math.abs(cells[i].y-cells[j].y)===1&&tile(cells[i].id).halves[cells[i].half].terrain===tile(cells[j].id).halves[cells[j].half].terrain)parents[find(i)]=find(j);
 const groups=new Map();for(let i=0;i<cells.length;i++){const k=find(i),g=groups.get(k)??{size:0,crowns:0};g.size++;g.crowns+=tile(cells[i].id).halves[cells[i].half].crowns;groups.set(k,g);}const gs=[...groups.values()];return {score:gs.reduce((n,g)=>n+g.size*g.crowns,0),largest:Math.max(0,...gs.map(g=>g.size)),crowns:gs.reduce((n,g)=>n+g.crowns,0)};
}
