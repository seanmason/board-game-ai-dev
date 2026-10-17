/** Original Boop base-game engine. A move includes exactly one graduation choice.
 * Signed board: 0 empty, ±1 kitten, ±2 cat; positive Orange, negative Gray.
 * Publisher-maintained Dized rules/FAQ are pinned in docs/BOOP_RESEARCH.md.
 */
export const PLAYERS=['Orange','Gray'];
export const owner=v=>v===0?null:v>0?0:1;
export const token=(player,piece)=>(player===0?1:-1)*piece;
export const coord=i=>String.fromCharCode(65+i%6)+(Math.floor(i/6)+1);
export const seededRandom=(seed=1)=>{let n=seed>>>0;return()=>{n+=0x6D2B79F5;let x=n;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296;};};
const check=(ok,message)=>{if(!ok)throw Error(message);};
const inside=(r,c)=>r>=0&&r<6&&c>=0&&c<6;
export const LINES=[];
for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]])for(let r=0;r<6;r++)for(let c=0;c<6;c++){
  if(inside(r+dr*2,c+dc*2))LINES.push([r*6+c,(r+dr)*6+c+dc,(r+dr*2)*6+c+dc*2]);
}
export const cloneGame=s=>({...s,board:[...s.board],pools:s.pools.map(p=>[...p]),lastMove:s.lastMove?{...s.lastMove,graduate:[...s.lastMove.graduate]}:null});
export function newGame({mode='physical',starter=0}={}){
  check(['physical','digital'].includes(mode),'Invalid game mode');check([0,1].includes(starter),'Invalid starter');
  return {version:1,game:'boop',mode,starter,currentPlayer:starter,phase:'play',board:Array(36).fill(0),pools:[[8,0],[8,0]],ply:0,winner:null,lastMove:null};
}
export const matchingLines=(board,player,catsOnly=false)=>LINES.filter(line=>line.every(i=>owner(board[i])===player&&(!catsOnly||Math.abs(board[i])===2)));
export const hasWin=(board,player)=>board.filter(v=>v===token(player,2)).length===8||matchingLines(board,player,true).length>0;
export const actionKey=a=>`${a.piece}:${a.cell}:${[...(a.graduate??[])].sort((a,b)=>a-b).join('.')}`;
export const describeAction=a=>`${a.piece===2?'Cat':'Kitten'} ${coord(a.cell)}${a.graduate?.length?' · '+(a.graduate.length===1?'retrieve / graduate ':'graduate ')+a.graduate.map(coord).join(', '):''}`;
export function previewPlacement(s,{cell,piece}){
  check(s.phase==='play','The game has ended');
  check(Number.isInteger(cell)&&cell>=0&&cell<36,'Invalid placement');
  check(piece===1||piece===2,'Choose a kitten or cat');
  check(s.board[cell]===0,'That square is occupied');
  const me=s.currentPlayer;
  check(s.pools[me][piece-1]>0,'That piece is not available in your pool');
  const next=cloneGame(s),before=[...s.board],r=Math.floor(cell/6),c=cell%6,moved=[];
  next.pools[me][piece-1]--;next.board[cell]=token(me,piece);
  // All pushes read the same pre-boop occupancy. No chains, jumps, or pushes
  // into occupied squares. The eight rays have distinct destinations.
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    if(!dr&&!dc)continue;
    const rr=r+dr,cc=c+dc;if(!inside(rr,cc))continue;
    const from=rr*6+cc,v=before[from];
    if(!v||Math.abs(v)>piece)continue;
    const tr=r+dr*2,tc=c+dc*2;
    if(inside(tr,tc)&&before[tr*6+tc]!==0)continue;
    next.board[from]=0;
    const to=inside(tr,tc)?tr*6+tc:null;
    if(to===null)next.pools[owner(v)][Math.abs(v)-1]++;
    else next.board[to]=v;
    moved.push({from,to,piece:v});
  }
  // Only the active player can win (publisher FAQ), after ALL pushes finish.
  const winner=hasWin(next.board,me)?me:null;
  let choices=[];
  if(winner===null){
    choices=matchingLines(next.board,me).map(line=>[...line]);
    const mine=next.board.flatMap((v,i)=>owner(v)===me?[i]:[]);
    if(mine.length===8)choices.push(...mine.map(i=>[i]));
  }
  if(!choices.length)choices=[[]];
  return {state:next,choices,winner,moved};
}
export function legalActions(s){
  if(s.phase!=='play')return [];
  const result=[];
  for(const piece of [1,2])if(s.pools[s.currentPlayer][piece-1]>0)for(let cell=0;cell<36;cell++){
    if(s.board[cell])continue;
    const preview=previewPlacement(s,{cell,piece});
    for(const graduate of preview.choices)result.push({cell,piece,graduate});
  }
  return result;
}
export function applyAction(s,a){
  check(a&&typeof a==='object','Missing Boop action');
  const result=previewPlacement(s,a),next=result.state;
  check(Array.isArray(a.graduate)&&a.graduate.every(Number.isInteger),'Choose a legal graduation');
  const key=actionKey(a);
  check(result.choices.some(graduate=>actionKey({...a,graduate})===key),'Choose exactly one legal graduation or retrieval');
  const me=s.currentPlayer;
  for(const cell of a.graduate){next.board[cell]=0;next.pools[me][1]++;}
  next.ply++;next.lastMove={cell:a.cell,piece:a.piece,graduate:[...a.graduate].sort((a,b)=>a-b),player:me};
  if(result.winner!==null){next.phase='gameover';next.winner=me;}
  else next.currentPlayer=1-me;
  return next;
}
/** Position validity, not a proof of historical reachability. Opponent lines may
 * exist during play: only the mover's end-of-turn lines resolve. No invented
 * repetition/move-limit draw is part of the published base game. */
export function assertValid(s){
  check(s&&s.version===1&&s.game==='boop','Unsupported Boop state');
  check(['physical','digital'].includes(s.mode),'Bad mode');
  check(['play','gameover'].includes(s.phase),'Bad phase');
  check([0,1].includes(s.starter)&&[0,1].includes(s.currentPlayer),'Bad player');
  check(Number.isSafeInteger(s.ply)&&s.ply>=0,'Bad turn count');
  check(Array.isArray(s.board)&&s.board.length===36&&s.board.every(v=>Number.isInteger(v)&&v>=-2&&v<=2),'Bad board');
  check(Array.isArray(s.pools)&&s.pools.length===2&&s.pools.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isInteger(n)&&n>=0&&n<=8)),'Bad piece pool');
  for(let p=0;p<2;p++)check(s.board.filter(v=>owner(v)===p).length+s.pools[p][0]+s.pools[p][1]===8,'Each player must have exactly eight active pieces');
  if(s.phase==='play'){
    check(s.winner===null,'Playing game cannot have a winner');
    check(s.currentPlayer===(s.ply%2?1-s.starter:s.starter),'Bad turn order');
    check(s.pools[s.currentPlayer][0]+s.pools[s.currentPlayer][1]>0,'Active player has no available piece');
    if(s.ply>0)check(!hasWin(s.board,1-s.currentPlayer),'Previous mover has an unresolved win');
  }else{
    check(s.ply>0&&s.currentPlayer===(s.ply%2?s.starter:1-s.starter),'Bad final turn order');
    check(s.winner===s.currentPlayer&&hasWin(s.board,s.winner),'Winner must satisfy the active-player win condition');
  }
  check(s.lastMove===null||([0,1].includes(s.lastMove.player)&&Number.isInteger(s.lastMove.cell)&&s.lastMove.cell>=0&&s.lastMove.cell<36&&[1,2].includes(s.lastMove.piece)&&Array.isArray(s.lastMove.graduate)&&[0,1,3].includes(s.lastMove.graduate.length)&&new Set(s.lastMove.graduate).size===s.lastMove.graduate.length&&s.lastMove.graduate.every(i=>Number.isInteger(i)&&i>=0&&i<36)),'Bad last move');
  return true;
}
