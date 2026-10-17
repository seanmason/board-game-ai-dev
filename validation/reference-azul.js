/**
 * Independent Azul rules oracle for differential testing.
 * This module intentionally DOES NOT import any production Azul code.
 *
 * Representation differs from production: walls store integer colors or
 * null; patterns store individual tiles instead of a (color, count) pair.
 * Mutating transitions are separate, straightforward rules translations.
 */
const MARKER = 5;
const PENALTIES = [1,1,2,2,2,3,3];
const total = a => a.reduce((x,y)=>x+y,0);
const makePlayer = () => ({
  score:0,
  patterns:Array.from({length:5},()=>[]),
  wall:Array.from({length:5},()=>Array(5).fill(null)),
  floor:[]
});
export function createReference(players,starter=0) {
  const factories={2:5,3:7,4:9}[players];
  if (!factories) throw Error("Unsupported player count");
  return {
    phase:"refill", round:1, starter, turn:starter, next:null, token:true,
    displays:Array.from({length:factories},()=>[]), center:[],
    bag:[20,20,20,20,20], lid:[0,0,0,0,0],
    seats:Array.from({length:players},makePlayer)
  };
}
function refillIfNeeded(s) {
  if (total(s.bag)) return;
  s.bag=s.lid.slice();
  s.lid.fill(0);
}
function nextTile(s,rng) {
  refillIfNeeded(s);
  const count=total(s.bag);
  if (!count) return null;
  let index=Math.min(count-1,Math.floor(rng()*count));
  for (let c=0;c<5;c++) {
    if (index<s.bag[c]) {s.bag[c]--;return c;}
    index-=s.bag[c];
  }
  throw Error("Broken reference draw");
}
export function offerReference(s,rng) {
  if(s.phase!=="refill")throw Error("Bad reference phase");
  s.displays=s.displays.map(() => {
    const f=[];
    for(let i=0;i<4;i++){
      const next=nextTile(s,rng);
      if(next!==null)f.push(next);
    }
    return f;
  });
  if (!s.displays.some(f=>f.length))throw Error("Reference bag exhausted");
  s.center=[];
  s.token=true;
  s.next=null;
  s.turn=s.starter;
  s.phase="draft";
}
function isWallColorUsed(p,row,color) {
  return p.wall[row].includes(color);
}
export function choicesReference(s) {
  if(s.phase!=="draft")return [];
  const actions=[];
  const p=s.seats[s.turn];
  for(let source=-1;source<s.displays.length;source++){
    const tiles=source<0?s.center:s.displays[source];
    for(let color=0;color<5;color++){
      if(!tiles.includes(color))continue;
      actions.push({source,color,row:-1});
      for(let row=0;row<5;row++){
        const filled=p.patterns[row];
        if(filled.length>=row+1)continue;
        if(filled.length && filled[0]!==color)continue;
        if(isWallColorUsed(p,row,color))continue;
        actions.push({source,color,row});
      }
    }
  }
  return actions;
}
function floorTile(s,p,tile) {
  if(p.floor.length<7)p.floor.push(tile);
  else if(tile!==MARKER)s.lid[tile]++;
}
function scoreOne(wall,row,col) {
  const span=(dr,dc)=>{
    let n=1;
    for(const dir of [-1,1]) {
      let r=row+dir*dr,c=col+dir*dc;
      while(r>=0 && r<5 && c>=0 && c<5 && wall[r][c]!==null){
        n++;r+=dir*dr;c+=dir*dc;
      }
    }
    return n;
  };
  const across=span(0,1),down=span(1,0);
  return (across>1?across:0)+(down>1?down:0)||1;
}
function rowCount(p) {
  return p.wall.filter(row=>row.every(x=>x!==null)).length;
}
function scoreBonus(p) {
  let bonus=2*rowCount(p);
  for(let c=0;c<5;c++){
    if(p.wall.every(row=>row[c]!==null))bonus+=7;
  }
  for(let color=0;color<5;color++){
    let n=0;
    for(let r=0;r<5;r++)if(p.wall[r].includes(color))n++;
    if(n===5)bonus+=10;
  }
  return bonus;
}
function completeRound(s) {
  for(const p of s.seats){
    for(let row=0;row<5;row++){
      const tiles=p.patterns[row];
      if(tiles.length!==row+1)continue;
      const color=tiles[0];
      const col=(row+color)%5;
      if(p.wall[row][col]!==null)throw Error("Invalid reference wall placement");
      p.wall[row][col]=color;
      p.score+=scoreOne(p.wall,row,col);
      s.lid[color]+=tiles.length-1;
      p.patterns[row]=[];
    }
    const penalty=p.floor.reduce((n,_,slot)=>n+PENALTIES[slot],0);
    p.score=Math.max(0,p.score-penalty);
    for(const color of p.floor) if(color!==MARKER)s.lid[color]++;
    p.floor=[];
  }
  if(s.seats.some(p=>rowCount(p)>0)){
    for(const p of s.seats)p.score+=scoreBonus(p);
    s.phase="gameover";
    return;
  }
  s.round++;
  if(s.next!==null)s.starter=s.next;
  s.turn=s.starter;
  s.next=null;
  s.token=true;
  s.center=[];
  s.displays=s.displays.map(()=>[]);
  s.phase="refill";
}
export function moveReference(s,action) {
  if(!choicesReference(s).some(a=>a.source===action.source &&
     a.color===action.color && a.row===action.row))throw Error("Illegal reference action");
  const p=s.seats[s.turn];
  let kept=[];
  const source=action.source<0?s.center:s.displays[action.source];
  const rest=[];
  for(const color of source) {
    if(color===action.color)kept.push(color);
    else rest.push(color);
  }
  if(action.source<0){
    s.center=rest;
    if(s.token) {
      s.token=false;
      s.next=s.turn;
      floorTile(s,p,MARKER);
    }
  } else {
    s.center.push(...rest);
    s.displays[action.source]=[];
  }
  if(action.row<0) {
    for(const tile of kept)floorTile(s,p,tile);
  } else {
    const row=p.patterns[action.row];
    for(const tile of kept){
      if(row.length<action.row+1)row.push(tile);
      else floorTile(s,p,tile);
    }
  }
  s.turn=(s.turn+1)%s.seats.length;
  if(s.displays.every(f=>f.length===0) && s.center.length===0)completeRound(s);
}
export function winnersReference(s) {
  if(s.phase!=="gameover")throw Error("Incomplete reference game");
  const maxScore=Math.max(...s.seats.map(p=>p.score));
  const leaders=s.seats.map((p,i)=>p.score===maxScore?i:-1).filter(i=>i>=0);
  const rows=Math.max(...leaders.map(i=>rowCount(s.seats[i])));
  const winners=leaders.filter(i=>rowCount(s.seats[i])===rows);
  return s.seats.map((_,i)=>winners.includes(i)?1/winners.length:0);
}
