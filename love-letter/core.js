import {EDITION,CARDS,RANKS} from './catalog.js';
export const clone=s=>structuredClone(s);
export const currentPlayer=s=>s.phase==='showdown'?s.alive.findIndex(Boolean):s.current;
export const targetFor=n=>({2:7,3:5,4:4})[n];
export function random(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function shuffle(a,rng){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function newGame({players=2,mode='physical',edition=EDITION,seed=1,starter=0,priority}={}){
 if(![2,3,4].includes(players)||!['digital','physical'].includes(mode)||edition!==EDITION||!Number.isInteger(starter)||starter<0||starter>=players)throw Error('Unsupported setup');
 priority??=Array.from({length:players},(_,i)=>(starter+i)%players);
 if(new Set(priority).size!==players||priority.some(p=>!Number.isInteger(p)||p<0||p>=players))throw Error('Enter every seat once in date/age priority');
 const s={version:1,edition,mode,seed:seed>>>0,players,priority:priority.slice(),affection:Array(players).fill(0),round:0,starter,current:starter,events:[],roundWinners:[],winners:[]};
 startRound(s);assertValid(s);return s;
}
function startRound(s){
 s.round++;s.turn=0;s.current=s.starter;s.alive=Array(s.players).fill(true);s.protected=Array(s.players).fill(false);s.discards=Array.from({length:s.players},()=>[]);s.memories=Array.from({length:s.players},()=>Array.from({length:s.players},()=>({known:null,excluded:[]})));s.equalities=[];s.roundWinners=[];s.pending=null;s.events=[];
 const deck=s.mode==='digital'?shuffle(RANKS,random(s.seed+s.round*7919)):Array(16).fill(null);
 s.reserve=deck.pop();s.reserveCount=1;s.exclusions=s.players===2?[deck.pop(),deck.pop(),deck.pop()]:[];
 s.hands=Array.from({length:s.players},()=>[deck.pop()]);s.deck=deck;s.drawCount=deck.length;
 s.phase=s.mode==='physical'?'setup':'awaitDraw';
}
export function legalActions(s,actor=s.current){
 if(actor!==s.current)return [];
 if(s.phase==='awaitDraw')return [{type:'draw'}];
 if(s.phase==='roundEnd')return [{type:'nextRound'}];
 if(s.phase!=='choosePlay')return [];
 const hand=s.hands[actor],ranks=[...new Set(hand.includes(null)?[1,2,3,4,5,6,7,8]:hand)];
 const mandatory=hand.includes(7)&&(hand.includes(5)||hand.includes(6));
 return ranks.filter(r=>!mandatory||r===7).flatMap(cardRank=>{
   if(![1,2,3,5,6].includes(cardRank))return [{type:'play',cardRank}];
   const targets=s.alive.flatMap((alive,t)=>alive&&(t===actor?cardRank===5:!s.protected[t])?[t]:[]);
   if(!targets.length)return [{type:'play',cardRank}];
   return targets.flatMap(target=>cardRank===1?Array.from({length:7},(_,i)=>({type:'play',cardRank,target,guess:i+2})):[{type:'play',cardRank,target}]);
 });
}
const key=a=>JSON.stringify([a.type,a.cardRank??null,a.target??null,a.guess??null]);
export function applyAction(state,action){
 if(state.mode!=='digital')throw Error('Record actual tabletop results in physical mode');
 assertValid(state);const s=clone(state);
 if(!legalActions(s).some(a=>key(a)===key(action)))throw Error('Illegal action');
 if(action.type==='nextRound'){s.starter=s.priority.find(p=>s.roundWinners.includes(p));startRound(s);}
 else if(action.type==='draw'){s.protected[s.current]=false;s.hands[s.current].push(s.deck.pop());s.drawCount--;s.phase='choosePlay';}
 else resolvePlay(s,action,{});
 assertValid(s);return s;
}
export function domainPlay(s,holder,rank){
 for(const row of s.memories){const m=row[holder];if(m.known===rank)m.known=null;if(!m.excluded.includes(rank))m.excluded=[];}
 s.equalities=s.equalities.filter(e=>!e.includes(holder));
}
export function forget(s,holder){for(const row of s.memories)row[holder]={known:null,excluded:[]};s.equalities=s.equalities.filter(e=>!e.includes(holder));}
export function remember(s,observer,holder,rank,provenance){
 if(rank===null||rank===undefined)return;
 if(!Number.isInteger(rank)||rank<1||rank>8)throw Error('Invalid private rank');
 s.memories[observer][holder]={known:rank,excluded:[],provenance,event:s.events.length};
}
function bind(s,holder,rank){
 let i=s.hands[holder].indexOf(rank);if(i<0)i=s.hands[holder].indexOf(null);
 if(i<0)throw Error('Observed card contradicts hand');s.hands[holder][i]=rank;return i;
}
function remove(s,holder,rank,kind){const i=bind(s,holder,rank);s.hands[holder].splice(i,1);s.discards[holder].push({rank,kind,turn:s.turn});}
function eliminated(s,p,evidenceRank){
 if(s.hands[p].length){const rank=s.hands[p][0]??evidenceRank;if(!rank)throw Error('Enter eliminated player’s public card');remove(s,p,rank,'eliminated');}
 s.alive[p]=false;s.protected[p]=false;forget(s,p);
}
export function resolvePlay(s,a,e){
 const p=s.current,t=a.target,r=a.cardRank;remove(s,p,r,'played');domainPlay(s,p,r);
 if((r===5||r===6)&&(s.hands[p][0]===7||(r===5&&t===p&&e.discard===7)||(r===6&&e.given===7)))throw Error('Countess must be played with Prince or King');
 s.events.push({type:'play',actor:p,cardRank:r,...(t===undefined?{}:{target:t}),...(r===1?{guess:a.guess}:{})});
 const event=s.events.at(-1);
 if(r===5||r===6)for(const row of s.memories)row[p].excluded=[...new Set([...row[p].excluded,7])];
 if(r===8)eliminated(s,p,e.loserRank);
 if(r===4)s.protected[p]=true;
 if(t!==undefined){
  const consistent=(actual,entered)=>{if(entered&&actual!==null&&actual!==entered)throw Error('Observed rank contradicts the recorded hand');};
  if(r===1){
   const hit=s.mode==='digital'?s.hands[t][0]===a.guess:e.hit;
   if(typeof hit!=='boolean')throw Error('Enter Guard success or failure');event.hit=hit;
   if(hit){bind(s,t,a.guess);eliminated(s,t);}else{if(s.hands[t][0]===a.guess||s.memories.some(row=>row[t].known===a.guess))throw Error('Guard result contradicts entered hand');for(const row of s.memories)row[t].excluded=[...new Set([...row[t].excluded,a.guess])];}
  }
  if(r===2){consistent(s.hands[t][0],e.seen);const rank=s.hands[t][0]??e.seen;remember(s,p,t,rank,'Priest');if(s.mode==='digital')remember(s,p,p,s.hands[p][0],'own');}
  if(r===3){
   consistent(s.hands[p][0],e.actorRank);consistent(s.hands[t][0],e.targetRank);
   const mine=s.hands[p][0]??e.actorRank,other=s.hands[t][0]??e.targetRank;
   const result=s.mode==='digital'?Math.sign(mine-other):e.comparison;
   if(![-1,0,1].includes(result))throw Error('Enter Baron comparison');
   if(mine&&other&&Math.sign(mine-other)!==result)throw Error('Baron result contradicts entered ranks');
   event.comparison=result;
   remember(s,p,t,other,'Baron');remember(s,t,p,mine,'Baron');
   if(result===0)s.equalities.push([p,t]);
   else {
    const loser=result<0?p:t,winner=result<0?t:p,rank=s.hands[loser][0]??e.loserRank;
    eliminated(s,loser,e.loserRank??(result<0?mine:other));
    if(rank)for(const row of s.memories)row[winner].excluded=[...new Set([...row[winner].excluded,...Array.from({length:rank},(_,i)=>i+1)])];
   }
  }
  if(r===5){
   consistent(s.hands[t][0],e.discard);
   const old=s.hands[t][0]??e.discard;if(!old)throw Error('Enter Prince’s public discard');
   remove(s,t,old,'prince');forget(s,t);event.discard=old;
   if(old===8)eliminated(s,t);else{
    let replacement;
    if(s.deck.length){replacement=s.deck.pop();s.drawCount--;}else{if(!s.reserveCount)throw Error('Reserve unavailable');replacement=s.reserve;s.reserve=null;s.reserveCount=0;}
    if(s.mode==='physical')replacement=e.replacement??null;
    s.hands[t]=[replacement];
   }
  }
  if(r===6){
   [s.hands[p],s.hands[t]]=[s.hands[t],s.hands[p]];
   for(const row of s.memories)[row[p],row[t]]=[row[t],row[p]];
   s.equalities=s.equalities.map(pair=>pair.map(x=>x===p?t:x===t?p:x));
   remember(s,p,p,s.hands[p][0]??e.received,'King received');remember(s,p,t,s.hands[t][0]??e.given,'King given');
   remember(s,t,t,s.hands[t][0]??e.given,'King received');remember(s,t,p,s.hands[p][0]??e.received,'King given');
   if(s.mode==='physical'){
    if(e.received){if(s.hands[p][0]!==null&&s.hands[p][0]!==e.received)throw Error('King received card contradicts hand');s.hands[p][0]=e.received;}
    if(e.given){if(s.hands[t][0]!==null&&s.hands[t][0]!==e.given)throw Error('King given card contradicts hand');s.hands[t][0]=e.given;}
   }
  }
 }
 s.turn++;s.pending=null;finishTurn(s);
}
export function finishTurn(s){
 const alive=s.alive.flatMap((v,i)=>v?[i]:[]);
 if(alive.length===1){award(s,alive);return;}
 if(!s.deck.length){
  if(alive.some(p=>s.hands[p][0]===null)){s.phase='showdown';return;}
  let best=Math.max(...alive.map(p=>s.hands[p][0]));let tied=alive.filter(p=>s.hands[p][0]===best);
  const total=p=>s.discards[p].reduce((a,c)=>a+c.rank,0);best=Math.max(...tied.map(total));award(s,tied.filter(p=>total(p)===best));return;
 }
 do{s.current=(s.current+1)%s.players;}while(!s.alive[s.current]);s.phase='awaitDraw';
}
function award(s,winners){s.roundWinners=winners;for(const p of winners)s.affection[p]++;s.winners=s.affection.flatMap((v,p)=>v>=targetFor(s.players)?[p]:[]);s.phase=s.winners.length?'gameover':'roundEnd';}
export const score=s=>s.affection.slice();
export const outcome=s=>s.phase==='gameover'?s.affection.map((_,p)=>s.winners.includes(p)?1/s.winners.length:0):null;
export function physicalNextRound(s){s=clone(s);if(s.phase!=='roundEnd')throw Error('Round is not complete');s.starter=s.priority.find(p=>s.roundWinners.includes(p));startRound(s);return s;}
export function assertValid(s){
 const fail=()=>{throw Error('Invalid Love Letter position');};
 if(!s||s.version!==1||s.edition!==EDITION||![2,3,4].includes(s.players)||!['digital','physical'].includes(s.mode))fail();
 const n=s.players;
 if(!['setup','awaitDraw','choosePlay','resolve','showdown','roundEnd','gameover'].includes(s.phase)||!Number.isInteger(s.current)||s.current<0||s.current>=n||!Number.isInteger(s.round)||s.round<1||!Number.isInteger(s.turn)||s.turn<0)fail();
 for(const field of ['hands','alive','protected','discards','affection','memories'])if(!Array.isArray(s[field])||s[field].length!==n)fail();
 if(!Array.isArray(s.priority)||s.priority.length!==n||new Set(s.priority).size!==n||s.priority.some(x=>!Number.isInteger(x)||x<0||x>=n))fail();
 if(!Array.isArray(s.deck)||s.drawCount!==s.deck.length||!Array.isArray(s.exclusions)||![0,1].includes(s.reserveCount)||s.exclusions.length!==(n===2?3:0)||!Array.isArray(s.events)||!Array.isArray(s.equalities)||!Array.isArray(s.roundWinners)||!Array.isArray(s.winners))fail();
 if(!Number.isInteger(s.seed)||s.seed<0||!Number.isInteger(s.starter)||s.starter<0||s.starter>=n)fail();
 const cards=[...s.deck,...s.exclusions,...(s.reserveCount?[s.reserve]:[])];
 for(let p=0;p<n;p++){
  if(typeof s.alive[p]!=='boolean'||typeof s.protected[p]!=='boolean'||(!s.alive[p]&&s.protected[p])||!Number.isInteger(s.affection[p])||s.affection[p]<0||!Array.isArray(s.hands[p])||!Array.isArray(s.discards[p]))fail();
  const expected=s.alive[p]?(['choosePlay','resolve'].includes(s.phase)&&p===s.current?2:1):0;
  if(s.hands[p].length!==expected)fail();cards.push(...s.hands[p]);
  for(const c of s.discards[p]){if(!c||!['played','prince','eliminated'].includes(c.kind)||!Number.isInteger(c.turn)||c.turn<0)fail();cards.push(c.rank);}
  if(!Array.isArray(s.memories[p])||s.memories[p].length!==n)fail();
  for(const m of s.memories[p])if(!m||!(m.known===null||(Number.isInteger(m.known)&&m.known>=1&&m.known<=8))||!Array.isArray(m.excluded)||m.excluded.some(r=>!Number.isInteger(r)||r<1||r>8))fail();
 }
 if(cards.length!==16||cards.some(r=>r!==null&&(!Number.isInteger(r)||r<1||r>8))||(s.mode==='digital'&&cards.includes(null)))fail();
 if(s.mode==='physical'&&(s.deck.some(r=>r!==null)||(s.reserveCount&&s.reserve!==null)))fail();
 for(let r=1;r<=8;r++)if(cards.filter(c=>c===r).length>CARDS[r].count)fail();
 if(s.mode==='digital')for(let r=1;r<=8;r++)if(cards.filter(c=>c===r).length!==CARDS[r].count)fail();
 if(!s.alive.some(Boolean)||(!['roundEnd','gameover','showdown'].includes(s.phase)&&!s.alive[s.current]))fail();
 if(s.pending&&(s.phase!=='resolve'||!s.pending.action))fail();if(s.phase==='resolve'&&!s.pending)fail();
 if(s.pending&&!legalActions({...s,phase:'choosePlay'}).some(a=>key(a)===key(s.pending.action)))fail();
 for(const pair of s.equalities)if(!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||pair.some(p=>!Number.isInteger(p)||p<0||p>=n))fail();
 for(const list of [s.roundWinners,s.winners])if(new Set(list).size!==list.length||list.some(p=>!Number.isInteger(p)||p<0||p>=n))fail();
 if(['roundEnd','gameover'].includes(s.phase)&&!s.roundWinners.length)fail();
 if(s.phase==='gameover'&&(!s.winners.length||s.winners.some(p=>s.affection[p]<targetFor(n))))fail();
 if(s.phase==='awaitDraw'&&s.drawCount===0)fail();
 if(s.phase==='setup'&&(s.mode!=='physical'||s.turn!==0||s.discards.some(p=>p.length)))fail();
 if(s.phase==='showdown'&&(s.drawCount!==0||s.alive.filter(Boolean).length<2))fail();
 const qualified=s.affection.flatMap((v,p)=>v>=targetFor(n)?[p]:[]);
 if((s.phase==='gameover')!==(qualified.length>0)||(s.phase==='gameover'&&JSON.stringify(s.winners.slice().sort())!==JSON.stringify(qualified)))fail();
 for(const row of s.memories)for(let p=0;p<n;p++)if(s.hands[p].length===1&&s.hands[p][0]!==null){const m=row[p];if((m.known!==null&&m.known!==s.hands[p][0])||m.excluded.includes(s.hands[p][0]))fail();}
 return true;
}
