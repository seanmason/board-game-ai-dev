/** Separate, slow 2-D rules oracle, deliberately imports no production code.
 * Agrees with publisher-maintained Dized rules including its active-player FAQ.
 * This is an in-project cross-check, not external certification. */
const color=n=>n===0?-1:n>0?0:1;
const inBoard=(r,c)=>r>=0&&c>=0&&r<6&&c<6;
export function fresh(starter=0){return{grid:Array.from({length:6},()=>Array(6).fill(0)),supplies:[[8,0],[8,0]],turn:starter,turns:0,winner:null};}
function lines(grid,player,adults=false){
  const result=[];
  for(let r=0;r<6;r++)for(let c=0;c<6;c++)for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){
    const cells=[];for(let k=0;k<3;k++){const y=r+dr*k,x=c+dc*k;if(!inBoard(y,x)||color(grid[y][x])!==player||(adults&&Math.abs(grid[y][x])!==2))break;cells.push(y*6+x);}
    if(cells.length===3)result.push(cells);
  }
  return result;
}
function placement(ref,row,col,kind){
  const next=structuredClone(ref),p=ref.turn;
  next.supplies[p][kind-1]--;next.grid[row][col]=(p===0?1:-1)*kind;
  // Collect all changes first, then apply them together.
  const changes=[];
  for(let r=0;r<6;r++)for(let c=0;c<6;c++){
    if(Math.max(Math.abs(row-r),Math.abs(col-c))!==1)continue;
    const value=ref.grid[r][c];if(!value||Math.abs(value)>kind)continue;
    const nr=r+(r-row),nc=c+(c-col);
    if(inBoard(nr,nc)&&ref.grid[nr][nc])continue;
    changes.push({r,c,nr,nc,value});
  }
  for(const {r,c,nr,nc,value} of changes){next.grid[r][c]=0;if(inBoard(nr,nc))next.grid[nr][nc]=value;else next.supplies[color(value)][Math.abs(value)-1]++;}
  const cats=next.grid.flat().filter(v=>v===(p===0?2:-2)).length;
  if(cats===8||lines(next.grid,p,true).length)next.winner=p;
  const choices=[];
  if(next.winner===null){
    choices.push(...lines(next.grid,p));
    const occupied=[];for(let r=0;r<6;r++)for(let c=0;c<6;c++)if(color(next.grid[r][c])===p)occupied.push(r*6+c);
    if(occupied.length===8)choices.push(...occupied.map(i=>[i]));
  }
  return{next,choices:choices.length?choices:[[]]};
}
export function options(ref){
  if(ref.winner!==null)return [];
  const result=[];
  for(let r=0;r<6;r++)for(let c=0;c<6;c++)if(!ref.grid[r][c])for(let kind=1;kind<=2;kind++)if(ref.supplies[ref.turn][kind-1]){
    for(const graduate of placement(ref,r,c,kind).choices)result.push({cell:r*6+c,piece:kind,graduate});
  }
  return result;
}
export function play(ref,action){
  const r=Math.floor(action.cell/6),c=action.cell%6;
  const {next,choices}=placement(ref,r,c,action.piece);
  const canonical=g=>[...g].sort((a,b)=>a-b).join(',');
  if(!choices.some(g=>canonical(g)===canonical(action.graduate)))throw Error('Oracle rejected graduation');
  for(const cell of action.graduate){next.grid[Math.floor(cell/6)][cell%6]=0;next.supplies[ref.turn][1]++;}
  next.turns++;if(next.winner===null)next.turn=1-ref.turn;
  return next;
}
