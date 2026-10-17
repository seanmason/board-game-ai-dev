/**
 * Pentago (standard 2-player, 6x6 edition).
 * Original dependency-free rules implementation; zero official artwork.
 *
 * This version follows the printed rules: placement-five wins immediately,
 * neutral quadrants make rotation optional, and a post-twist simultaneous
 * five-in-a-row is a draw.
 */
export const SIZE=6;
export const EMPTY=-1;
export const BLACK=0;
export const WHITE=1;
export const PLAYERS=["Black","White"];
export const QUADRANTS=["NW","NE","SW","SE"];
export const indexOf=(row,column)=>row*SIZE+column;
export const coord=cell=>String.fromCharCode(65+cell%6)+(Math.floor(cell/6)+1);
export const actionKey=action=>[action.cell,action.quadrant,action.direction].join(":");
export function describeAction(a) {
  return coord(a.cell)+(a.quadrant<0?" · no twist":
    " · "+QUADRANTS[a.quadrant]+" "+(a.direction===1?"↻":"↺"));
}
const sum=a=>a.reduce((s,x)=>s+x,0);
const CHECK=(condition,message)=>{if(!condition)throw Error(message)};
export const seededRandom=(seed=1)=>{
  let value=seed>>>0;
  return ()=>{
    value+=0x6D2B79F5;
    let x=value;
    x=Math.imul(x^(x>>>15),x|1);
    x^=x+Math.imul(x^(x>>>7),x|61);
    return ((x^(x>>>14))>>>0)/4294967296;
  };
};
const WIN_SEGMENTS=[];
for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
  for(let row=0;row<6;row++)for(let col=0;col<6;col++){
    const endR=row+4*dr,endC=col+4*dc;
    if(endR<0||endR>5||endC<0||endC>5)continue;
    WIN_SEGMENTS.push(Array.from({length:5},(_,i)=>indexOf(row+i*dr,col+i*dc)));
  }
}
export const fiveLines=board=>{
  const lines=[[],[]];
  for(const positions of WIN_SEGMENTS){
    const color=board[positions[0]];
    if((color===BLACK||color===WHITE)&&positions.every(k=>board[k]===color)){
      lines[color].push(positions);
    }
  }
  return lines;
};
export const windows=()=>WIN_SEGMENTS.map(s=>[...s]);
export function newGame({starter=BLACK,mode="physical"}={}){
  CHECK((starter===BLACK||starter===WHITE),"Invalid starter");
  CHECK(mode==="physical"||mode==="digital","Invalid game mode");
  return {
    version:1,mode,board:Array(36).fill(EMPTY),starter,
    currentPlayer:starter,phase:"play",winner:null,ply:0,lastMove:null
  };
}
export const cloneGame=s=>({...s,board:[...s.board],
  lastMove:s.lastMove?{...s.lastMove}:null});
const origin=quadrant=>[
  quadrant>=2?3:0,quadrant%2?3:0
];
export function rotate(board,quadrant,direction) {
  CHECK(Number.isInteger(quadrant)&&quadrant>=0&&quadrant<4,
    "Choose NW, NE, SW or SE");
  CHECK(direction===1||direction===-1,"Rotation must be 90° clockwise or counterclockwise");
  CHECK(board.length===36,"Invalid board size");
  const [row0,col0]=origin(quadrant);
  const result=[...board];
  for(let r=0;r<3;r++)for(let c=0;c<3;c++){
    const nr=direction===1?c:2-c;
    const nc=direction===1?2-r:r;
    result[indexOf(row0+nr,col0+nc)]=board[indexOf(row0+r,col0+c)];
  }
  return result;
}
export function neutralQuadrants(board){
  const neutral=[];
  for(let q=0;q<4;q++){
    const [r0,c0]=origin(q);
    let okay=true;
    for(let r=0;r<3;r++)for(let c=0;c<3;c++){
      if(r===1&&c===1)continue;
      if(board[indexOf(r0+r,c0+c)]!==EMPTY)okay=false;
    }
    if(okay)neutral.push(q);
  }
  return neutral;
}
function afterPlacement(s,cell) {
  CHECK(s.phase==="play","The game has ended");
  CHECK(Number.isInteger(cell)&&cell>=0&&cell<36,"Invalid placement");
  CHECK(s.board[cell]===EMPTY,"That socket is occupied");
  const board=[...s.board];
  board[cell]=s.currentPlayer;
  return board;
}
export function legalActions(s){
  if(s.phase!=="play")return [];
  const result=[];
  for(let cell=0;cell<36;cell++){
    if(s.board[cell]!==EMPTY)continue;
    const board=[...s.board];
    board[cell]=s.currentPlayer;
    // The printed rules end the game before any twist if placement wins.
    if(fiveLines(board)[s.currentPlayer].length){
      result.push({cell,quadrant:-1,direction:0});
      continue;
    }
    for(let quadrant=0;quadrant<4;quadrant++){
      result.push({cell,quadrant,direction:1});
      result.push({cell,quadrant,direction:-1});
    }
    if(neutralQuadrants(board).length){
      result.push({cell,quadrant:-1,direction:0});
    }
  }
  return result;
}
export function applyAction(s,action){
  CHECK(action&&typeof action==="object","Missing turn action");
  const board=afterPlacement(s,action.cell);
  const immediate=!!fiveLines(board)[s.currentPlayer].length;
  const noTwist=action.quadrant===-1&&action.direction===0;
  if(immediate)CHECK(noTwist,"Placement wins immediately; do not twist");
  else if(noTwist)CHECK(neutralQuadrants(board).length>0,
    "A twist is required when no neutral quadrant remains");
  else CHECK(Number.isInteger(action.quadrant)&&action.quadrant>=0&&
    action.quadrant<4&&(action.direction===1||action.direction===-1),
    "Choose a 90° quadrant twist");
  const next=cloneGame(s);
  next.board=immediate||noTwist?board:rotate(board,action.quadrant,action.direction);
  next.ply++;
  next.lastMove={cell:action.cell,quadrant:action.quadrant,
    direction:action.direction,player:s.currentPlayer};
  const wins=fiveLines(next.board);
  if(immediate){
    next.phase="gameover";next.winner=s.currentPlayer;
  } else if(wins[BLACK].length&&wins[WHITE].length){
    next.phase="gameover";next.winner="draw";
  } else if(wins[BLACK].length||wins[WHITE].length){
    next.phase="gameover";next.winner=wins[BLACK].length?BLACK:WHITE;
  } else if(next.ply===36){
    next.phase="gameover";next.winner="draw";
  } else next.currentPlayer=1-s.currentPlayer;
  return next;
}
/**
 * Collapse actions producing the same board *for this actual placement*.
 * A twist on a neutral quadrant is equivalent to doing nothing.
 * The canonical action returned remains legal and applicable.
 */
export function uniqueLegalActions(s) {
  const actions=legalActions(s),distinct=[],seen=new Set();
  for(const action of actions){
    const board=[...s.board];
    board[action.cell]=s.currentPlayer;
    const result=action.quadrant<0?board:rotate(board,action.quadrant,action.direction);
    const key=result.join("");
    if(seen.has(key))continue;
    seen.add(key);
    distinct.push(action);
  }
  return distinct;
}
export function outcomes(s){
  CHECK(s.phase==="gameover","Game not finished");
  if(s.winner==="draw")return [0.5,0.5];
  return s.winner===BLACK?[1,0]:[0,1];
}
export function assertValid(s) {
  CHECK(s&&s.version===1,"Unsupported Pentago state");
  CHECK(s.mode==="physical"||s.mode==="digital","Bad mode");
  CHECK(s.phase==="play"||s.phase==="gameover","Bad phase");
  CHECK(s.starter===0||s.starter===1,"Bad first player");
  CHECK(s.currentPlayer===0||s.currentPlayer===1,"Bad active player");
  CHECK(Array.isArray(s.board)&&s.board.length===36 &&
    s.board.every(x=>x===EMPTY||x===BLACK||x===WHITE),"Bad board");
  CHECK(Number.isInteger(s.ply)&&s.ply>=0&&s.ply<=36,"Bad move count");
  const occupied=s.board.filter(x=>x!==EMPTY).length;
  CHECK(occupied===s.ply,"Board occupancy does not match move count");
  for(const player of [BLACK,WHITE]){
    const expected=Math.floor((s.ply+(s.starter===player?1:0))/2);
    CHECK(s.board.filter(c=>c===player).length===expected,
      "Player marble count contradicts turn order");
  }
  const expectedNext=s.ply%2===0?s.starter:1-s.starter;
  if(s.phase==="play"){
    CHECK(s.winner===null,"Playing game cannot have a winner");
    CHECK(s.currentPlayer===expectedNext,"Bad turn order");
    CHECK(s.ply<36,"Full board must end the game");
    CHECK(!fiveLines(s.board).some(lines=>lines.length),"Unresolved five-in-a-row");
  } else {
    const wins=fiveLines(s.board);
    if(s.winner==="draw") CHECK(
      (wins[0].length&&wins[1].length)||s.ply===36,
      "Draw requires both winning lines or a full board");
    else CHECK((s.winner===0||s.winner===1)&&wins[s.winner].length,
      "Winner must have five in a row");
  }
  CHECK(s.lastMove===null||(
    Number.isInteger(s.lastMove.cell)&&s.lastMove.cell>=0&&s.lastMove.cell<36 &&
    (s.lastMove.quadrant===-1||
     (s.lastMove.quadrant>=0&&s.lastMove.quadrant<=3)) &&
    [0,1].includes(s.lastMove.player)
  ),"Invalid last move");
  return true;
}
