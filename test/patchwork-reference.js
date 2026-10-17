// Independently written rules oracle. Shares functional component facts only.
import {PATCHES} from '../patchwork/catalog.js';
const incomes=[5,11,17,23,29,35,41,47,53];
export function referenceStep(input,a){
 const s=structuredClone(input),i=s.currentPlayer,p=s.players[i];
 const fill=(id,event)=>{const shape=referenceOrientations(id)[a.orientation];for(const [x,y] of shape)p.board[(a.y+y)*9+a.x+x]=id||100+event;p.placements.push({id,orientation:a.orientation,x:a.x,y:a.y,...(event===undefined?{}:{event})});
  if(s.bonusOwner===null){for(let sy=0;sy<=2;sy++)for(let sx=0;sx<=2;sx++){let count=0;for(let dy=0;dy<7;dy++)for(let dx=0;dx<7;dx++)if(p.board[(sy+dy)*9+sx+dx])count++;if(count===49)s.bonusOwner=i;}}
 };
 if(a.type==='leather')fill(0,s.pending.shift());
 else {
  const before=p.time;let steps;
  if(a.type==='advance'){steps=Math.min(53,s.players[1-i].time+1)-before;p.buttons+=steps;}
  else {const q=PATCHES[a.id];p.buttons-=q.cost;p.income+=q.income;fill(a.id);steps=Math.min(q.time,53-before);const old=s.ring,idx=old.indexOf(a.id);s.ring=[];for(let k=1;k<old.length;k++)s.ring.push(old[(idx+k)%old.length]);}
  p.time+=steps;
  for(let t=before+1;t<=p.time;t++){
   if(incomes.includes(t))p.buttons+=p.income;
   if(s.leather.includes(t)){s.pending.push(t);s.leather.splice(s.leather.indexOf(t),1);}
  }
  if(p.time===53&&s.firstFinished===null)s.firstFinished=i;
 }
 if(s.pending.length&&p.board.includes(0)){s.phase='leather';return s;}
 s.discarded.push(...s.pending);s.pending=[];s.turn++;
 if(s.players.every(x=>x.time===53))s.phase='gameover';
 else {s.phase='play';if(s.players[0].time<s.players[1].time)s.currentPlayer=0;else if(s.players[1].time<s.players[0].time)s.currentPlayer=1;}
 return s;
}
export function referenceOrientations(id){const rows=PATCHES[id].rows,base=[];rows.forEach((r,y)=>[...r].forEach((v,x)=>{if(v==='X')base.push([x,y]);}));const out=[],keys=[];for(const mirrored of [false,true])for(let rotation=0;rotation<4;rotation++){let shape=base.map(([x,y])=>[mirrored?-x:x,y]);for(let n=0;n<rotation;n++)shape=shape.map(([x,y])=>[-y,x]);let minX=Infinity,minY=Infinity;for(const [x,y]of shape){minX=Math.min(minX,x);minY=Math.min(minY,y);}shape=shape.map(([x,y])=>[x-minX,y-minY]).sort((a,b)=>a[1]*20+a[0]-b[1]*20-b[0]);const k=shape.map(p=>p.join(',')).join(';');if(!keys.includes(k)){keys.push(k);out.push(shape);}}return out;}
