import {TILES,tile,TERRAINS} from './catalog.js';
export const DIRECTIONS=[[1,0],[0,1],[-1,0],[0,-1]];
export const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
export function shuffle(a,random){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const clone=s=>structuredClone(s), key=(x,y)=>`${x},${y}`;
export const owner=(s,k)=>s.players.length===2?Math.floor(k/2):k;
export const rowSize=s=>s.players.length===3&&s.edition==='original'?3:4;
export const totalTiles=s=>s.players.length===2?24:s.players.length===3&&s.edition==='original'?36:48;
export const currentKing=s=>s.current.length?s.current[s.cursor]?.king:s.initialOrder[s.cursor];
export const currentPlayer=s=>owner(s,currentKing(s));
export function newGame({players=2,mode='physical',edition='original',seed=1,initialOrder}={}){
 if(![2,3,4].includes(players)||!['physical','digital'].includes(mode)||!['original','us2'].includes(edition))throw Error('Invalid setup');
 const random=rng(seed),kings=Array.from({length:players===2?4:players},(_,i)=>i);
 const order=initialOrder??(mode==='digital'?shuffle(kings,random):kings);
 if(order.length!==kings.length||new Set(order).size!==kings.length||order.some(k=>!kings.includes(k)))throw Error('Initial order must include each king once');
 const s={version:1,mode,edition,players:Array.from({length:players},()=>({board:[{x:0,y:0,id:0,half:0}],discarded:[]})),initialOrder:[...order],phase:'draw',current:[],offer:[],cursor:0,round:0,rowCount:0,seen:[],unclaimed:[],turn:0};
 if(mode==='digital'){s.deck=shuffle(TILES.map(t=>t.id),random).slice(0,totalTiles(s));return drawDigital(s);}return s;
}
export function occupied(board){return new Map(board.map(c=>[key(c.x,c.y),c]));}
export const terrain=c=>c.id===0?'castle':tile(c.id).halves[c.half].terrain;
export function placementCells(id,a){const [dx,dy]=DIRECTIONS[a.rotation]??[];return [{x:a.x,y:a.y,id,half:0},{x:a.x+dx,y:a.y+dy,id,half:1}];}
export function canPlace(board,id,a){
 if(!tile(id)||!Number.isInteger(a.x)||!Number.isInteger(a.y)||!Number.isInteger(a.rotation)||a.rotation<0||a.rotation>3)return false;
 const cells=placementCells(id,a),map=occupied(board);
 if(cells.some(c=>map.has(key(c.x,c.y))))return false;
 const all=[...board,...cells],xs=all.map(c=>c.x),ys=all.map(c=>c.y);
 if(Math.max(...xs)-Math.min(...xs)>4||Math.max(...ys)-Math.min(...ys)>4)return false;
 return cells.some(c=>DIRECTIONS.some(([dx,dy])=>{const n=map.get(key(c.x+dx,c.y+dy));return n&&(n.id===0||terrain(n)===terrain(c));}));
}
export function placements(board,id){
 const out=[],same=tile(id).halves[0].terrain===tile(id).halves[1].terrain&&tile(id).halves[0].crowns===tile(id).halves[1].crowns;
 const anchors=new Set();for(const c of board)for(const [dx,dy]of DIRECTIONS){anchors.add(key(c.x+dx,c.y+dy));for(const [ex,ey]of DIRECTIONS)anchors.add(key(c.x+dx-ex,c.y+dy-ey));}
 for(const k of anchors){const [x,y]=k.split(',').map(Number);for(let rotation=0;rotation<(same?2:4);rotation++){const a={type:'place',x,y,rotation};if(canPlace(board,id,a))out.push(a);}}
 return out;
}
export function legalActions(s){if(s.phase==='draft')return s.offer.filter(t=>t.king===null).map(t=>({type:'pick',id:t.id}));if(s.phase==='place'){const acts=placements(s.players[currentPlayer(s)].board,s.current[s.cursor].id);return acts.length?acts:[{type:'discard'}];}return [];}
function promote(s){
 s.unclaimed.push(...s.offer.filter(t=>t.king===null).map(t=>t.id));s.current=s.offer.filter(t=>t.king!==null).map(t=>({...t,resolved:false}));s.offer=[];s.cursor=0;s.round++;
 s.phase=s.seen.length<totalTiles(s)?'draw':'place';if(s.mode==='digital'&&s.phase==='draw')return drawDigital(s);return s;
}
export function observeRow(state,ids){
 if(state.phase!=='draw')throw Error('Not waiting for a row');
 if(!Array.isArray(ids)||ids.length!==rowSize(state)||ids.some(id=>!Number.isInteger(id)||!tile(id)||state.seen.includes(id))||new Set(ids).size!==ids.length)throw Error('Enter distinct, previously unseen domino numbers for the whole row');
 const s=clone(state);s.offer=[...ids].sort((a,b)=>a-b).map(id=>({id,king:null}));s.seen.push(...ids);s.rowCount++;s.phase=s.current.length?'place':'draft';return s;
}
function drawDigital(state){const ids=state.deck.slice(0,rowSize(state)),s=observeRow(state,ids);s.deck=state.deck.slice(rowSize(state));return s;}
export function applyAction(state,a,{validate=true}={}){
 if(validate&&!legalActions(state).some(x=>x.type===a?.type&&(x.type==='pick'?x.id===a.id:x.type==='place'?x.x===a.x&&x.y===a.y&&x.rotation===a.rotation:true)))throw Error('Illegal action');
 const s=clone(state);if(s.phase==='draft'&&a.type==='pick'){
  const t=s.offer.find(t=>t.id===a.id&&t.king===null);if(!t)throw Error('Domino already claimed');t.king=currentKing(s);s.turn++;
  if(!s.current.length){s.cursor++;if(s.cursor===s.initialOrder.length)return promote(s);}
  else {s.cursor++;if(s.cursor===s.current.length)return promote(s);s.phase='place';}
 }else if(s.phase==='place'&&(a.type==='place'||a.type==='discard')){
  const entry=s.current[s.cursor],p=s.players[currentPlayer(s)];
  if(a.type==='place')p.board.push(...placementCells(entry.id,a));else p.discarded.push(entry.id);entry.resolved=true;s.turn++;
  if(s.offer.length)s.phase='draft';else {s.cursor++;if(s.cursor===s.current.length)s.phase='gameover';}
 }else throw Error('Wrong action phase');return s;
}
export function territories(board){const map=occupied(board),visited=new Set(),groups=[];for(const c of board){const k=key(c.x,c.y);if(c.id===0||visited.has(k))continue;const group={terrain:terrain(c),size:0,crowns:0,cells:[]},stack=[c];visited.add(k);while(stack.length){const n=stack.pop();group.size++;group.crowns+=tile(n.id).halves[n.half].crowns;group.cells.push([n.x,n.y]);for(const[dx,dy]of DIRECTIONS){const m=map.get(key(n.x+dx,n.y+dy)),mk=m&&key(m.x,m.y);if(m&&m.id!==0&&!visited.has(mk)&&terrain(m)===group.terrain){visited.add(mk);stack.push(m);}}}group.score=group.size*group.crowns;groups.push(group);}return groups;}
export function score(player){return territories(player.board).reduce((n,g)=>n+g.score,0);}
export function standings(s){return s.players.map((p,i)=>{const gs=territories(p.board);return {player:i,score:score(p),largest:Math.max(0,...gs.map(g=>g.size)),crowns:gs.reduce((n,g)=>n+g.crowns,0)};});}
export function winners(s){const rows=standings(s),cmp=(a,b)=>b.score-a.score||b.largest-a.largest||(s.edition==='original'?b.crowns-a.crowns:0);rows.sort(cmp);return rows.filter(r=>cmp(rows[0],r)===0).map(r=>r.player);}
export function observation(s){const fields=['version','mode','edition','initialOrder','phase','current','offer','cursor','round','rowCount','seen','unclaimed','turn'];const o=Object.fromEntries(fields.map(k=>[k,s[k]]));o.players=s.players.map(p=>({board:p.board,discarded:p.discarded}));return clone(o);}
export function determinize(o,random){const s=clone(o);s.mode='digital';s.deck=shuffle(TILES.map(t=>t.id).filter(id=>!s.seen.includes(id)),random).slice(0,totalTiles(s)-s.seen.length);return s;}
export function analysisBlocker(s){return s.phase==='draw'?'Enter the actual observed row before analysis.':s.phase==='gameover'?'Game complete.':null;}
export function assertValid(s){
 const fail=m=>{throw Error('Invalid Kingdomino state: '+m);},integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 if(!s||s.version!==1||!['physical','digital'].includes(s.mode)||!['original','us2'].includes(s.edition)||!Array.isArray(s.players)||![2,3,4].includes(s.players.length))fail('setup');
 const nk=s.players.length===2?4:s.players.length;
 if(!Array.isArray(s.initialOrder)||s.initialOrder.length!==nk||new Set(s.initialOrder).size!==nk||s.initialOrder.some(k=>!integer(k,0,nk-1)))fail('initial king order');
 if(!['draw','draft','place','gameover'].includes(s.phase)||!integer(s.cursor,0,nk)||!integer(s.round,0,12)||!integer(s.rowCount,0,12)||!integer(s.turn,0,200))fail('phase counters');
 if(!Array.isArray(s.seen)||new Set(s.seen).size!==s.seen.length||s.seen.some(id=>!integer(id,1,48))||s.seen.length!==s.rowCount*rowSize(s)||s.seen.length>totalTiles(s))fail('seen inventory');
 const accounted=[],liveKings=[];for(const p of s.players){
  if(!Array.isArray(p.board)||!Array.isArray(p.discarded)||p.board.length%2!==1||p.board.length>25)fail('board');
  const map=occupied(p.board);if(map.size!==p.board.length||!p.board.some(c=>c.id===0&&c.x===0&&c.y===0)||p.board.filter(c=>c.id===0).length!==1)fail('castle/overlap');
  const xs=p.board.map(c=>c.x),ys=p.board.map(c=>c.y);if(Math.max(...xs)-Math.min(...xs)>4||Math.max(...ys)-Math.min(...ys)>4)fail('5×5 bounds');
  const ids=new Set();for(const c of p.board){if(!integer(c.x,-4,4)||!integer(c.y,-4,4)||!integer(c.id,0,48)||!integer(c.half,0,1))fail('cell');if(c.id)ids.add(c.id);}
  for(const id of ids){const cs=p.board.filter(c=>c.id===id);if(cs.length!==2||cs[0].half===cs[1].half||Math.abs(cs[0].x-cs[1].x)+Math.abs(cs[0].y-cs[1].y)!==1)fail('domino halves');accounted.push(id);}
  // Every occupied square must connect to the castle geometrically. Historical matching is enforced by transitions.
  const reached=new Set(['0,0']),stack=[[0,0]];while(stack.length){const[x,y]=stack.pop();for(const[dx,dy]of DIRECTIONS){const k=key(x+dx,y+dy);if(map.has(k)&&!reached.has(k)){reached.add(k);stack.push([x+dx,y+dy]);}}}if(reached.size!==p.board.length)fail('disconnected board');
  // A kingdom must be reachable via legal domino-to-domino matching contacts.
  const linked=new Map([[0,new Set()]]);for(const id of ids)linked.set(id,new Set());
  for(const c of p.board)for(const[dx,dy]of DIRECTIONS){const n=map.get(key(c.x+dx,c.y+dy));if(n&&n.id!==c.id&&(c.id===0||n.id===0||terrain(c)===terrain(n))){linked.get(c.id).add(n.id);linked.get(n.id).add(c.id);}}
  const reachedIds=new Set([0]),todo=[0];while(todo.length){for(const id of linked.get(todo.pop()))if(!reachedIds.has(id)){reachedIds.add(id);todo.push(id);}}if(reachedIds.size!==ids.size+1)fail('unmatched domino connection');
  accounted.push(...p.discarded);
 }
 if(!Array.isArray(s.unclaimed)||!Array.isArray(s.current)||!Array.isArray(s.offer)||s.current.length>nk||s.offer.length>rowSize(s))fail('rows');accounted.push(...s.unclaimed);
 for(const row of [s.current,s.offer]){if(row.some((t,i)=>!integer(t.id,1,48)||(i&&row[i-1].id>=t.id)||!(t.king===null||integer(t.king,0,nk-1))))fail('row entry');}
 for(const t of s.current){if(t.king===null||typeof t.resolved!=='boolean')fail('current king');liveKings.push(t.king);if(!t.resolved)accounted.push(t.id);}
 if(s.current.length&&(s.current.length!==nk||new Set(liveKings).size!==nk))fail('current kings');
 const offerKings=s.offer.filter(t=>t.king!==null).map(t=>t.king);if(new Set(offerKings).size!==offerKings.length)fail('duplicate offer king');accounted.push(...s.offer.map(t=>t.id));
 if(accounted.length!==s.seen.length||new Set(accounted).size!==accounted.length||accounted.some(id=>!s.seen.includes(id)))fail('domino conservation');
 if(s.mode==='physical'&&s.deck!==undefined)fail('physical hidden deck');
 if(s.mode==='digital'&&!Array.isArray(s.deck))fail('missing digital deck');
 if(s.deck!==undefined&&(!Array.isArray(s.deck)||s.deck.length!==totalTiles(s)-s.seen.length||new Set(s.deck).size!==s.deck.length||s.deck.some(id=>!integer(id,1,48)||s.seen.includes(id))))fail('hidden deck');
 if(!s.current.length&&(s.rowCount>1||s.round!==0||s.players.some(p=>p.board.length!==1||p.discarded.length)))fail('initial round shape');
 const kingsPerPlayer=s.players.length===2?2:1;
 for(let i=0;i<s.players.length;i++){const p=s.players[i],placed=(p.board.length-1)/2+p.discarded.length,expected=s.current.length?(s.round-1)*kingsPerPlayer+s.current.filter(t=>t.resolved&&owner(s,t.king)===i).length:0;if(placed!==expected)fail('player turn inventory');}
 const placedCount=s.players.reduce((n,p)=>n+(p.board.length-1)/2+p.discarded.length,0);
 if(s.turn!==placedCount+s.round*nk+offerKings.length)fail('turn count');
 if(s.unclaimed.length!==(s.players.length===3&&s.edition==='us2'?s.round:0))fail('unclaimed count');
 if(s.current.length&&s.current.some((t,i)=>t.resolved!==(i<s.cursor||(i===s.cursor&&s.phase==='draft'))))fail('resolved queue');
 if(s.offer.length&&s.offer.length!==rowSize(s))fail('offer size');
 if(s.round!==(s.current.length?s.rowCount-(s.offer.length?1:0):0))fail('round counter');
 const expectedClaims=s.current.length?s.current.slice(0,s.cursor+(s.phase==='draft'?0:0)).map(t=>t.king):s.initialOrder.slice(0,s.cursor);
 if(s.offer.length&&(offerKings.length!==expectedClaims.length||offerKings.some(k=>!expectedClaims.includes(k))))fail('draft order claims');
 if(s.phase==='draw'&&(s.offer.length||s.seen.length===totalTiles(s)||s.cursor!==0||s.current.some(t=>t.resolved)))fail('draw shape');
 if(s.phase==='draft'&&(!s.offer.some(t=>t.king===null)||s.cursor>=(s.current.length||nk)||s.current.length&&!s.current[s.cursor].resolved))fail('draft shape');
 if(s.phase==='place'&&(!s.current.length||s.cursor>=nk||s.current[s.cursor].resolved))fail('placement shape');
 if(s.phase==='gameover'&&(s.cursor!==nk||s.offer.length||s.current.some(t=>!t.resolved)||s.seen.length!==totalTiles(s)))fail('gameover shape');
 return true;
}
