// Independently coded Pentago reference: 2-D board, transpose-based rotation,
// and directional scans (no imports from the production Pentago engine).
export const fresh=(starter=0)=>({
  grid:Array.from({length:6},()=>Array(6).fill(-1)),
  starter,turn:starter,ply:0,phase:"play",winner:null
});
const copy=g=>g.map(row=>[...row]);
export const flattened=s=>s.grid.flat();
export function wins(g){
  const result=[false,false];
  for(let r=0;r<6;r++)for(let c=0;c<6;c++){
    const side=g[r][c];
    if(side<0)continue;
    for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
      let count=0;
      for(let k=0;k<5;k++){
        const nr=r+k*dr,nc=c+k*dc;
        if(nr>=0&&nr<6&&nc>=0&&nc<6&&g[nr][nc]===side)count++;
        else break;
      }
      if(count===5)result[side]=true;
    }
  }
  return result;
}
function neutral(g) {
  return [[0,0],[0,3],[3,0],[3,3]].some(([r0,c0])=>{
    for(let r=0;r<3;r++)for(let c=0;c<3;c++)
      if((r!==1||c!==1)&&g[r0+r][c0+c]!==-1)return false;
    return true;
  });
}
function twist(g,q,d){
  const r0=q>=2?3:0,c0=q%2?3:0;
  const patch=Array.from({length:3},(_,r)=>
    Array.from({length:3},(_,c)=>g[r0+r][c0+c]));
  let transpose=Array.from({length:3},(_,r)=>
    Array.from({length:3},(_,c)=>patch[c][r]));
  transpose=d===1?transpose.map(row=>row.reverse()):transpose.reverse();
  const next=copy(g);
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)next[r0+r][c0+c]=transpose[r][c];
  return next;
}
export function actions(s){
  if(s.phase!=="play")return [];
  const moves=[];
  for(let cell=0;cell<36;cell++){
    const row=Math.floor(cell/6),col=cell%6;
    if(s.grid[row][col]!==-1)continue;
    const trial=copy(s.grid);trial[row][col]=s.turn;
    if(wins(trial)[s.turn]){moves.push({cell,quadrant:-1,direction:0});continue;}
    for(let quadrant=0;quadrant<4;quadrant++)
      for(const direction of [1,-1])moves.push({cell,quadrant,direction});
    if(neutral(trial))moves.push({cell,quadrant:-1,direction:0});
  }
  return moves;
}
export function play(s,a){
  if(!actions(s).some(x=>x.cell===a.cell&&x.quadrant===a.quadrant&&x.direction===a.direction))
    throw Error("Reference rejects move");
  const row=Math.floor(a.cell/6),col=a.cell%6;
  const placed=copy(s.grid);placed[row][col]=s.turn;
  const instant=wins(placed)[s.turn];
  s.grid=a.quadrant<0?placed:twist(placed,a.quadrant,a.direction);
  s.ply++;
  const winner=wins(s.grid);
  if(instant){s.winner=s.turn;s.phase="gameover";}
  else if(winner[0]&&winner[1]){s.winner="draw";s.phase="gameover";}
  else if(winner[0]||winner[1]){s.winner=winner[0]?0:1;s.phase="gameover";}
  else if(s.ply===36){s.winner="draw";s.phase="gameover";}
  else s.turn=1-s.turn;
}
