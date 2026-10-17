/** Serializable standard Cascadia rules; observations are explicit atomic inputs. */
import {TILES,STARTERS,CATALOG,SPECIES} from './catalog.js';
import {DIRS,key,neighbors} from './scoring.js';
export {scoreGame,winners} from './scoring.js';
export const copy=s=>structuredClone(s);
export function rng(seed=1){let n=seed>>>0;return ()=>{n=(n+0x6D2B79F5)>>>0;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function shuffle(a,random){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const tile=t=>typeof t==='string'?CATALOG[t]:t;
export function placed(id,q,r,rotation=0){const t=tile(id);if(!t)throw Error('Unknown tile');return {id:t.id,q,r,sides:t.sides,wildlife:t.wildlife,keystone:t.keystone,rotation,token:null};}
export function starterBoard(index,rotation=0){const coords=[[0,0],[0,1],[-1,1]];return STARTERS[index].map((t,i)=>{let [q,r]=coords[i];for(let j=0;j<rotation;j++)[q,r]=[-r,q+r];return placed(t.id,q,r,rotation);});}
export function createGame({players=2,mode='physical',seed=1,cards={},first=0}={}){
 if(!Number.isInteger(players)||players<1||players>4)throw Error('Use 1–4 players');
 if(!['physical','digital'].includes(mode)||!Number.isInteger(first)||first<0||first>=players)throw Error('Invalid setup');
 const s={version:1,mode,players:Array.from({length:players},()=>({board:[],nature:0,turns:0,starter:null})),cards:Object.fromEntries(SPECIES.map(a=>[a,cards[a]??'A'])),first,currentPlayer:first,turn:0,phase:'setup',marketTiles:Array(4).fill(null),marketTokens:Array(4).fill(null),tileRemaining:(players===1?43:players*20+3),seenTiles:[],discardedTiles:[],discardedTokens:Object.fromEntries(SPECIES.map(a=>[a,0])),heldTokens:[],wiped:false,pending:null,draw:null};
 if(mode==='digital'){
  const random=rng(seed),starters=shuffle([0,1,2,3,4],random);s.players.forEach((p,i)=>{p.starter=starters[i];p.board=starterBoard(p.starter);});
  s.tileBag=shuffle(TILES.map(t=>t.id),random).slice(0,s.tileRemaining);s.randomSeed=(random()*4294967296)>>>0;s.phase='observe';s.draw={tiles:[0,1,2,3],tokens:[0,1,2,3],after:'draft'};supplyDigital(s);
 }
 validateState(s);return s;
}
function knownTiles(s){return [...s.players.flatMap(p=>p.board.map(t=>t.id).filter(id=>id.startsWith('t'))),...s.marketTiles.filter(Boolean),...s.discardedTiles,...(s.phase==='tile'&&s.pending?[s.pending.tile]:[])];}
export function availableTileIds(s){const used=new Set(knownTiles(s));return TILES.map(t=>t.id).filter(id=>!used.has(id));}
export function observeStarter(state,seat,index,rotation=0){const s=copy(state);if(s.mode!=='physical'||s.phase!=='setup'||!Number.isInteger(seat)||!s.players[seat]||!Number.isInteger(index)||index<0||index>4||s.players.some((p,i)=>i!==seat&&p.starter===index))throw Error('Invalid or duplicate starter');if(!Number.isInteger(rotation)||rotation<0||rotation>5)throw Error('Invalid starter rotation');s.players[seat].starter=index;s.players[seat].board=starterBoard(index,rotation);validateState(s);return s;}
export function beginPhysical(state){const s=copy(state);if(s.phase!=='setup'||s.players.some(p=>p.starter===null))throw Error('Enter each actual starter first');s.phase='observe';s.draw={tiles:[0,1,2,3],tokens:[0,1,2,3],after:'draft'};return s;}
export function tokenBagCounts(s){const counts=Object.fromEntries(SPECIES.map(a=>[a,20-(s.discardedTokens[a]??0)]));for(const t of s.players.flatMap(p=>p.board))if(t.token)counts[t.token]--;for(const a of [...s.marketTokens,...s.heldTokens])if(a)counts[a]--;if(s.pending?.token)counts[s.pending.token]--;return counts;}
function finishDraw(s){s.phase=s.draw.after;s.draw=null;}
export function observeDraw(state,{tiles=[],tokens=[]}){const s=copy(state);if(s.phase!=='observe'||!s.draw)throw Error('No observation pending');if(tiles.length!==s.draw.tiles.length||tokens.length!==s.draw.tokens.length)throw Error('Fill every requested actual tile/token');
 const available=new Set(availableTileIds(s));for(const id of tiles){if(!available.has(id))throw Error('Tile already observed or unknown');available.delete(id);}
 const counts=tokenBagCounts(s);for(const a of tokens){if(!SPECIES.includes(a)||counts[a]--<=0)throw Error('Impossible wildlife inventory');}
 if(tiles.length>s.tileRemaining)throw Error('Habitat stack exhausted');s.draw.tiles.forEach((slot,i)=>{s.marketTiles[slot]=tiles[i];s.seenTiles.push(tiles[i]);});s.draw.tokens.forEach((slot,i)=>s.marketTokens[slot]=tokens[i]);s.tileRemaining-=tiles.length;finishDraw(s);validateState(s);return s;
}
function supplyDigital(s){if(s.phase!=='observe')return;const random=rng(s.randomSeed);const tiles=s.draw.tiles.map(()=>s.tileBag.pop());const counts=tokenBagCounts(s),tokens=s.draw.tokens.map(()=>{let n=Math.floor(random()*Object.values(counts).reduce((a,b)=>a+b,0));for(const a of SPECIES){if(n<counts[a]){counts[a]--;return a;}n-=counts[a];}throw Error('Empty bag');});s.randomSeed=(random()*4294967296)>>>0;const next=observeDraw(s,{tiles,tokens});Object.assign(s,next);}
export function frontier(board){const occupied=new Set(board.map(t=>key(t.q,t.r))),out=new Map();for(const t of board)for(const [dq,dr]of DIRS){const q=t.q+dq,r=t.r+dr;if(!occupied.has(key(q,r)))out.set(key(q,r),{q,r});}return [...out.values()];}
export function overpopulation(s){for(const a of SPECIES){const slots=s.marketTokens.flatMap((t,i)=>t===a?[i]:[]);if(slots.length>=3)return {species:a,slots,mandatory:slots.length===4};}return null;}
export function analysisBlocker(s){return s.phase==='setup'?'Record all actual starters.':s.phase==='observe'?'Enter the actual replacement tiles and wildlife.':s.phase==='gameover'?'Game complete.':null;}
export function legalActions(s){
 if(s.phase==='draft'){
  const over=overpopulation(s);if(over?.mandatory)return [{type:'wipe',slots:over.slots,reason:'overpopulation'}];const a=[];
  if(over&&!s.wiped)a.push({type:'wipe',slots:over.slots,reason:'overpopulation'});
  if(s.heldTokens.length)a.push({type:'resolve'});
  // Drafting ends the overpopulation sequence and returns held wildlife before placement.
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)if(i===j||s.players[s.currentPlayer].nature>0)a.push({type:'draft',tile:i,token:j});
  if(s.players[s.currentPlayer].nature>0&&!s.heldTokens.length)for(let mask=1;mask<16;mask++)a.push({type:'wipe',slots:[0,1,2,3].filter(i=>mask&(1<<i)),reason:'nature'});
  return a;
 }
 if(s.phase==='tile')return frontier(s.players[s.currentPlayer].board).flatMap(p=>Array.from({length:new Set(CATALOG[s.pending.tile].sides).size===1?1:6},(_,rotation)=>({type:'placeTile',...p,rotation})));
 if(s.phase==='wildlife')return [...s.players[s.currentPlayer].board.filter(t=>!t.token&&t.wildlife.includes(s.pending.token)).map(t=>({type:'placeWildlife',q:t.q,r:t.r})),{type:'release'}];return [];
}
const equal=(a,b)=>JSON.stringify(a,Object.keys(a).sort())===JSON.stringify(b,Object.keys(b).sort());
export function applyAction(state,action,{validate=true}={}){if(validate&&!legalActions(state).some(a=>equal(a,action)))throw Error('Illegal action');const s=copy(state),p=s.players[s.currentPlayer];
 if(action.type==='resolve'){s.heldTokens=[];return s;}
 if(action.type==='wipe'){
  if(action.reason==='nature')p.nature--;else if(action.slots.length===3)s.wiped=true;
  for(const slot of action.slots){s.heldTokens.push(s.marketTokens[slot]);s.marketTokens[slot]=null;}
  s.phase='observe';s.draw={tiles:[],tokens:[...action.slots],after:'draft'};
 }else if(action.type==='draft'){
  s.heldTokens=[];if(action.tile!==action.token)p.nature--;s.pending={tile:s.marketTiles[action.tile],token:s.marketTokens[action.token],tileSlot:action.tile,tokenSlot:action.token};s.marketTiles[action.tile]=null;s.marketTokens[action.token]=null;s.phase='tile';
 }else if(action.type==='placeTile'){
  p.board.push(placed(s.pending.tile,action.q,action.r,action.rotation));s.phase='wildlife';
 }else if(action.type==='placeWildlife'||action.type==='release'){
  if(action.type==='placeWildlife'){const t=p.board.find(t=>t.q===action.q&&t.r===action.r);t.token=s.pending.token;if(t.keystone)p.nature++;}
  // Released token is returned to the bag, not removed from the game.
  p.turns++;s.turn++;
  if(s.players.length===1){const ti=s.marketTiles.findLastIndex(Boolean),wi=s.marketTokens.findLastIndex(Boolean);s.discardedTiles.push(s.marketTiles[ti]);s.discardedTokens[s.marketTokens[wi]]++;s.marketTiles[ti]=null;s.marketTokens[wi]=null;s.marketTiles=s.marketTiles.filter(Boolean);s.marketTokens=s.marketTokens.filter(Boolean);while(s.marketTiles.length<4)s.marketTiles.unshift(null);while(s.marketTokens.length<4)s.marketTokens.unshift(null);}
  s.pending=null;s.wiped=false;s.heldTokens=[];
  if(s.players.every(p=>p.turns===20)){s.phase='gameover';s.draw=null;}else{
   s.currentPlayer=(s.currentPlayer+1)%s.players.length;s.phase='observe';s.draw={tiles:s.marketTiles.flatMap((t,i)=>t===null?[i]:[]),tokens:s.marketTokens.flatMap((t,i)=>t===null?[i]:[]),after:'draft'};
  }
 }else throw Error('Unknown action');
 if(s.mode==='digital')supplyDigital(s);if(validate)validateState(s);return s;
}
export function observation(s){const o=copy(s);delete o.tileBag;delete o.randomSeed;delete o.excluded;return o;}
export function determinize(o,random){const s=observation(o);s.mode='digital';s.tileBag=shuffle(availableTileIds(s),random).slice(0,s.tileRemaining);s.randomSeed=Math.floor(random()*4294967296);return s;}
export function validateState(s){const fail=m=>{throw Error(`Invalid Cascadia state: ${m}`);};
 if(!s||s.version!==1||!['physical','digital'].includes(s.mode)||!Array.isArray(s.players)||s.players.length<1||s.players.length>4||!['setup','observe','draft','tile','wildlife','gameover'].includes(s.phase))fail('shape');
 if(!Number.isInteger(s.currentPlayer)||!s.players[s.currentPlayer]||!Number.isInteger(s.first)||!s.players[s.first])fail('seat');
 for(const a of SPECIES)if(typeof s.cards?.[a]!=='string'||!['A','B','C','D'].includes(s.cards[a]))fail('scoring cards');
 if(!Number.isInteger(s.tileRemaining)||s.tileRemaining<0||s.tileRemaining>83||!Array.isArray(s.marketTiles)||s.marketTiles.length!==4||!Array.isArray(s.marketTokens)||s.marketTokens.length!==4||!Array.isArray(s.discardedTiles)||!Array.isArray(s.heldTokens)||!Array.isArray(s.seenTiles))fail('inventory shape');
 if(s.marketTiles.some(id=>id!==null&&!TILES.some(t=>t.id===id))||s.marketTokens.some(a=>a!==null&&!SPECIES.includes(a))||s.heldTokens.some(a=>!SPECIES.includes(a)))fail('market');
 let turns=0;const starters=[];
 for(const p of s.players){if(!Array.isArray(p.board)||!Number.isInteger(p.nature)||p.nature<0||!Number.isInteger(p.turns)||p.turns<0||p.turns>20)fail('player');turns+=p.turns;if(p.starter!==null){if(!Number.isInteger(p.starter)||p.starter<0||p.starter>4)fail('starter');starters.push(p.starter);}
  const coords=new Set();for(const t of p.board){const c=CATALOG[t.id];if(!c||!Number.isInteger(t.q)||!Number.isInteger(t.r)||Math.abs(t.q)>24||Math.abs(t.r)>24||!Number.isInteger(t.rotation)||t.rotation<0||t.rotation>5||t.sides!==c.sides||t.wildlife!==c.wildlife||t.keystone!==c.keystone||t.token!==null&&(!SPECIES.includes(t.token)||!c.wildlife.includes(t.token)))fail('board tile');const k=key(t.q,t.r);if(coords.has(k))fail('overlapping hexes');coords.add(k);}
  if(p.board.length&&p.board.length!==3+p.turns+(s.players[s.currentPlayer]===p&&s.phase==='wildlife'?1:0))fail('tile count');
  if(p.board.length){const visited=new Set([p.board[0]]);for(let progress=true;progress;){progress=false;for(const t of p.board)if(!visited.has(t)&&[...visited].some(a=>neighbors(a).includes(key(t.q,t.r)))){visited.add(t);progress=true;}}if(visited.size!==p.board.length)fail('disconnected board');}
 }
 if(new Set(starters).size!==starters.length||turns!==s.turn)fail('turn/starter conservation');
 const ids=knownTiles(s);if(new Set(ids).size!==ids.length)fail('duplicate habitat');
 
 const startingCount=s.players.length===1?43:s.players.length*20+3;
 if(s.seenTiles.length+s.tileRemaining!==startingCount||new Set(s.seenTiles).size!==s.seenTiles.length||s.seenTiles.some(id=>!TILES.some(t=>t.id===id))||ids.length!==s.seenTiles.length||ids.some(id=>!s.seenTiles.includes(id)))fail('observed habitat conservation');
 for(const p of s.players){if(p.starter!==null){const anchor=p.board.find(t=>t.id===STARTERS[p.starter][0].id);const rigid=anchor&&[0,1,2,3,4,5].some(rotation=>{const expected=starterBoard(p.starter,rotation);return expected.every(e=>p.board.some(t=>t.id===e.id&&t.q===e.q+anchor.q&&t.r===e.r+anchor.r&&t.rotation===rotation));});if(!rigid)fail('starter geometry');}if(p.starter===null&&p.board.length||p.starter!==null&&(!STARTERS[p.starter].every(t=>p.board.some(b=>b.id===t.id))||p.board.filter(t=>t.id.startsWith('s')).length!==3))fail('starter identity');if(p.board.filter(t=>t.token).length>p.turns||p.nature>p.board.filter(t=>t.keystone&&t.token).length)fail('wildlife/nature count');}
 if(s.phase==='setup'&&(s.mode!=='physical'||s.turn!==0||s.marketTiles.some(Boolean)||s.marketTokens.some(Boolean)||s.heldTokens.length))fail('setup');if(s.phase!=='setup'&&s.players.some(p=>p.starter===null))fail('missing starter');
 const expected=(s.first+s.turn)%s.players.length;
 if(s.currentPlayer!==(s.phase==='gameover'?(expected+s.players.length-1)%s.players.length:expected))fail('turn order');
 if(s.players.some((p,i)=>p.turns!==Math.floor(s.turn/s.players.length)+( (i-s.first+s.players.length)%s.players.length<s.turn%s.players.length?1:0)))fail('unequal turns');
 for(const a of SPECIES)if(!Number.isInteger(s.discardedTokens[a])||s.discardedTokens[a]<0||tokenBagCounts(s)[a]<0)fail('wildlife conservation');
 if(['tile','wildlife'].includes(s.phase)){if(!s.pending||!TILES.some(t=>t.id===s.pending.tile)||!SPECIES.includes(s.pending.token))fail('pending draft');}
 else if(s.pending!==null)fail('unexpected draft');
 if(s.phase==='observe'){if(!s.draw||s.draw.after!=='draft'||!Array.isArray(s.draw.tiles)||!Array.isArray(s.draw.tokens)||[...s.draw.tiles,...s.draw.tokens].some(i=>!Number.isInteger(i)||i<0||i>3)||new Set(s.draw.tiles).size!==s.draw.tiles.length||new Set(s.draw.tokens).size!==s.draw.tokens.length)fail('draw');if(s.marketTiles.some((t,i)=>(t===null)!==s.draw.tiles.includes(i))||s.marketTokens.some((t,i)=>(t===null)!==s.draw.tokens.includes(i)))fail('draw occupied');}else if(s.draw!==null)fail('unexpected draw');
 if(['draft'].includes(s.phase)&&(s.marketTiles.some(t=>!t)||s.marketTokens.some(t=>!t)))fail('incomplete offer');
 if(s.phase==='gameover'&&!s.players.every(p=>p.turns===20))fail('premature end');
 if(s.mode==='digital'&&(!Array.isArray(s.tileBag)||!Number.isInteger(s.randomSeed)||s.randomSeed<0||s.randomSeed>4294967295))fail('digital hidden inventory');
 if(s.tileBag){if(s.mode!=='digital'||s.tileBag.length!==s.tileRemaining||s.tileBag.some(id=>!TILES.some(t=>t.id===id)||ids.includes(id))||new Set(s.tileBag).size!==s.tileBag.length)fail('hidden stack');}
 return true;
}
