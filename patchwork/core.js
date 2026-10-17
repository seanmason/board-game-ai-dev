import {PATCHES,REGULAR,INCOME,ORIGINAL_LEATHER,END} from './catalog.js';
export const TRACKS=Object.freeze({original:ORIGINAL_LEATHER,corrected:[26,32,38,44,50]});
const clone=s=>structuredClone(s),int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const fail=m=>{throw Error(m);};
export function newGame({mode='physical',starter=0,edition=null,seed=1}={}){
 if(!['physical','digital'].includes(mode)||!int(starter,0,1)||!(edition===null||TRACKS[edition]))fail('Invalid setup options');
 const s={game:'patchwork',version:1,mode,starter,currentPlayer:starter,edition,phase:'setup',ring:[],players:[0,1].map(()=>({board:Array(81).fill(0),placements:[],buttons:5,income:0,time:0})),leather:[],pending:[],discarded:[],bonusOwner:null,firstFinished:null,turn:0};
 if(mode==='digital'){
  let n=seed>>>0;const random=()=>{n=(n+0x6D2B79F5)|0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
  const ring=REGULAR.slice(1).map(p=>p.id);for(let i=ring.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ring[i],ring[j]]=[ring[j],ring[i]];}ring.push(1);
  return observeSetup(s,ring,edition??'corrected');
 }
 return s;
}
export function observeSetup(s,ring,edition){
 if(s.phase!=='setup')fail('Setup is already complete');
 if(!TRACKS[edition])fail('Choose the time board printed in your edition');
 if(!Array.isArray(ring)||ring.length!==33||new Set(ring).size!==33||ring.some(id=>!int(id,1,33))||ring[32]!==1)fail('Enter all 33 patches once, clockwise after the neutral token, ending with the 1×2 patch (#1)');
 const n=clone(s);n.edition=edition;n.ring=[...ring];n.leather=[...TRACKS[edition]];n.phase='play';return n;
}
export function placementCells(id,orientation,x,y){
 const shape=PATCHES[id]?.orientations[orientation];if(!shape||!int(x,0,8)||!int(y,0,8))return null;
 const cells=shape.map(([dx,dy])=>[x+dx,y+dy]);return cells.some(([a,b])=>a>8||b>8)?null:cells.map(([a,b])=>b*9+a);
}
export function canPlace(board,id,orientation,x,y){const cells=placementCells(id,orientation,x,y);return !!cells&&cells.every(i=>board[i]===0);}
export function placements(board,id){const out=[];for(let o=0;o<PATCHES[id].orientations.length;o++)for(let y=0;y<9;y++)for(let x=0;x<9;x++)if(canPlace(board,id,o,x,y))out.push({type:id===0?'leather':'buy',id,orientation:o,x,y});return out;}
export function available(s){return s.phase==='play'?s.ring.slice(0,3):[];}
export function legalActions(s){
 if(s.phase==='setup'||s.phase==='gameover')return [];
 const p=s.players[s.currentPlayer];if(s.phase==='leather')return placements(p.board,0);
 return [{type:'advance'},...available(s).flatMap(id=>p.buttons>=PATCHES[id].cost?placements(p.board,id):[])];
}
export function hasSquare(board){for(let y=0;y<3;y++)for(let x=0;x<3;x++){let full=true;for(let dy=0;dy<7&&full;dy++)for(let dx=0;dx<7;dx++)if(!board[(y+dy)*9+x+dx]){full=false;break;}if(full)return true;}return false;}
function put(s,a,event=null){const p=s.players[s.currentPlayer],cells=placementCells(a.id,a.orientation,a.x,a.y);for(const i of cells)p.board[i]=a.id||100+event;p.placements.push({id:a.id,orientation:a.orientation,x:a.x,y:a.y,...(event===null?{}:{event})});if(s.bonusOwner===null&&hasSquare(p.board))s.bonusOwner=s.currentPlayer;}
function finishTurn(s){
 if(s.pending.length&&s.players[s.currentPlayer].board.some(v=>v===0)){s.phase='leather';return;}
 // A completely filled board cannot hold further leather; it is removed from play.
 s.discarded.push(...s.pending);s.pending=[];s.turn++;const [a,b]=s.players.map(p=>p.time);
 if(a===END&&b===END){s.phase='gameover';return;}
 if(a!==b)s.currentPlayer=a<b?0:1; // A tie leaves the arriving token on top.
 s.phase='play';
}
export function applyAction(state,a){
 if(!a||typeof a!=='object')fail('Invalid action');
 if(!['play','leather'].includes(state.phase))fail('No move available in this phase');
 const s=clone(state),p=s.players[s.currentPlayer],other=s.players[1-s.currentPlayer];
 if(s.phase==='leather'){
  if(a.type!=='leather'||a.id!==0||!canPlace(p.board,0,a.orientation,a.x,a.y))fail('Place the earned leather patch in an empty square');
  put(s,a,s.pending.shift());finishTurn(s);return s;
 }
 let target;
 if(a.type==='buy'){
  const patch=PATCHES[a.id],i=s.ring.indexOf(a.id);
  if(!patch||i<0||i>=3||p.buttons<patch.cost||!canPlace(p.board,a.id,a.orientation,a.x,a.y))fail('Patch must be among the next three, affordable, and fit without overlap');
  put(s,a);p.buttons-=patch.cost;p.income+=patch.income;target=Math.min(END,p.time+patch.time);
  // Neutral remains in the purchased patch's gap. The clockwise successor is first.
  s.ring=[...s.ring.slice(i+1),...s.ring.slice(0,i)];
 }else if(a.type==='advance'){target=Math.min(END,other.time+1);p.buttons+=target-p.time;}
 else fail('Choose advance or buy a patch');
 if(target<=p.time)fail('A finished player cannot move');
 const from=p.time;p.time=target;
 p.buttons+=INCOME.filter(t=>from<t&&t<=target).length*p.income;
 s.pending=s.leather.filter(t=>from<t&&t<=target);s.leather=s.leather.filter(t=>!s.pending.includes(t));
 if(target===END&&s.firstFinished===null)s.firstFinished=s.currentPlayer;
 finishTurn(s);return s;
}
export const score=p=>p.buttons-2*p.board.filter(v=>v===0).length;
export const scores=s=>s.players.map((p,i)=>score(p)+(s.bonusOwner===i?7:0));
export function winners(s){if(s.phase!=='gameover')return [];const a=scores(s);return a[0]===a[1]?[s.firstFinished]:[a[0]>a[1]?0:1];}
export function assertValid(s){
 if(!s||s.game!=='patchwork'||s.version!==1||!['physical','digital'].includes(s.mode)||!int(s.starter,0,1)||!int(s.currentPlayer,0,1)||!['setup','play','leather','gameover'].includes(s.phase)||!int(s.turn,0,200)||!Array.isArray(s.players)||s.players.length!==2)fail('Invalid Patchwork state');
 if(![null,0,1].includes(s.bonusOwner)||![null,0,1].includes(s.firstFinished))fail('Invalid bonus or finish order');
 if(!Array.isArray(s.ring)||s.ring.some(id=>!int(id,1,33))||new Set(s.ring).size!==s.ring.length)fail('Invalid patch ring');
 if(!Array.isArray(s.leather)||!Array.isArray(s.pending)||!Array.isArray(s.discarded))fail('Invalid leather state');
 const used=new Set(s.ring),leathers=new Set([...s.leather,...s.pending,...s.discarded]);if(leathers.size!==s.leather.length+s.pending.length+s.discarded.length)fail('Duplicated leather patch');
 for(const p of s.players){
  if(!p||!int(p.buttons,0,1000)||!int(p.income,0,100)||!int(p.time,0,END)||!Array.isArray(p.board)||p.board.length!==81||!Array.isArray(p.placements))fail('Invalid player');
  const board=Array(81).fill(0);let income=0,purchasedTime=0;
  for(const a of p.placements){
   if(!int(a.id,0,33)||!canPlace(board,a.id,a.orientation,a.x,a.y))fail('Invalid placed patch');
   if(a.id){if(used.has(a.id))fail('Duplicated regular patch');used.add(a.id);income+=PATCHES[a.id].income;purchasedTime+=PATCHES[a.id].time;}
   else {if(!int(a.event,1,END)||a.event>p.time||leathers.has(a.event))fail('Duplicated leather patch');leathers.add(a.event);}
   for(const i of placementCells(a.id,a.orientation,a.x,a.y))board[i]=a.id||100+a.event;
  }
  if(Math.min(purchasedTime,END)>p.time)fail('Placed patches exceed elapsed time');
  if(income!==p.income||board.some((v,i)=>v!==p.board[i]))fail('Board or income disagrees with placements');
 }
 if(s.phase==='setup'){
  if(s.edition!==null&&!TRACKS[s.edition])fail('Invalid edition');
  if(s.ring.length||s.leather.length||s.pending.length||s.turn||s.bonusOwner!==null||s.firstFinished!==null||s.currentPlayer!==s.starter||s.players.some(p=>p.buttons!==5||p.time||p.placements.length))fail('Invalid setup state');return true;
 }
 if(!TRACKS[s.edition]||used.size!==33||leathers.size!==5||[...leathers].some(t=>!TRACKS[s.edition].includes(t)))fail('Missing components or invalid track edition');
 if(s.discarded.some(t=>!s.players.some(p=>!p.board.includes(0)&&p.time>=t)))fail('Leather can be discarded only after crossing with a full quilt');
 // Past unclaimed markers are impossible.
 if(s.leather.some(t=>t<=Math.max(...s.players.map(p=>p.time))))fail('Unclaimed passed leather marker');
 if(s.pending.length&&(s.phase!=='leather'||s.pending.some(t=>t>s.players[s.currentPlayer].time))||s.phase==='leather'&&!s.pending.length)fail('Invalid leather placement phase');
 if(s.bonusOwner!==null&&!hasSquare(s.players[s.bonusOwner].board)||s.bonusOwner===null&&s.players.some(p=>hasSquare(p.board)))fail('Invalid 7×7 bonus');
 const finished=s.players.map(p=>p.time===END);if(finished.some(Boolean)!==(s.firstFinished!==null)||s.firstFinished!==null&&!finished[s.firstFinished]||(s.phase==='gameover')!==(finished.every(Boolean)&&s.pending.length===0))fail('Invalid game end');
 if(s.phase==='play'&&(finished[s.currentPlayer]||s.players[s.currentPlayer].time>s.players[1-s.currentPlayer].time))fail('Wrong player to act');
 return true;
}
