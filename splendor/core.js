import {CARDS,NOBLES} from './catalog.js';
const check=(x,m)=>{if(!x)throw Error(m);};
export const total=a=>a.reduce((n,x)=>n+x,0);
export const rng=seed=>()=>{seed=(seed+0x6D2B79F5)>>>0;let x=Math.imul(seed^(seed>>>15),1|seed);x^=x+Math.imul(x^(x>>>7),61|x);return ((x^(x>>>14))>>>0)/4294967296;};
export function shuffle(a,random){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export const bonuses=p=>p.cards.reduce((a,id)=>(a[CARDS[id].bonus]++,a),[0,0,0,0,0]);
export const score=p=>p.cards.reduce((n,id)=>n+CARDS[id].points,0)+3*p.nobles.length;
export const eligible=(s,p=s.players[s.currentPlayer])=>{const b=bonuses(p);return s.nobles.filter(id=>NOBLES[id].cost.every((n,i)=>b[i]>=n));};
export function winners(s){const high=Math.max(...s.players.map(score));const few=Math.min(...s.players.filter(p=>score(p)===high).map(p=>p.cards.length));return s.players.flatMap((p,i)=>score(p)===high&&p.cards.length===few?[i]:[]);}
export function newGame({players=2,mode='physical',starter=0,seed=1}={}){
  check(Number.isInteger(players)&&players>=2&&players<=4,'Choose 2–4 players');
  check(['physical','digital'].includes(mode),'Invalid mode');check(Number.isInteger(starter)&&starter>=0&&starter<players,'Invalid starting player');
  const random=rng(seed),decks=[1,2,3].map(t=>shuffle(CARDS.filter(c=>c.tier===t).map(c=>c.id),random));
  const market=decks.map(d=>d.splice(-4));
  const s={version:1,mode,phase:mode==='physical'?'setup':'play',players:Array.from({length:players},()=>({tokens:[0,0,0,0,0,0],cards:[],reserved:[],nobles:[]})),bank:[...Array(5).fill(players===2?4:players===3?5:7),5],starter,currentPlayer:starter,turn:0,finalRound:false,
    market:mode==='physical'?Array.from({length:3},()=>Array(4).fill(null)):market,
    deckCounts:decks.map(d=>d.length),decks:mode==='digital'?decks:null,
    nobles:mode==='digital'?shuffle(NOBLES.map(n=>n.id),random).slice(0,players+1):[]};
  assertValid(s);return s;
}
export const knownIds=s=>[...s.market.flat().filter(x=>x!==null),...s.players.flatMap(p=>[...p.cards,...p.reserved.map(r=>r.id).filter(x=>x!==null)])];
export function available(s,tier){const ids=new Set(knownIds(s));return CARDS.filter(c=>c.tier===tier&&!ids.has(c.id));}
export function observeSetup(state,market,nobles){
  check(state.phase==='setup','Setup is already recorded');const s=structuredClone(state);
  check(Array.isArray(market)&&market.length===3&&market.every(row=>Array.isArray(row)&&row.length===4),'Enter twelve face-up cards');
  check(market.every((row,t)=>row.every(id=>Number.isInteger(id)&&CARDS[id]?.tier===t+1)),'Choose a card of the matching level');
  check(nobles.length===s.players.length+1,'Choose player count plus one nobles');
  s.market=market;s.nobles=nobles;s.phase='play';assertValid(s);return s;
}
export function identifyReserved(state,player,index,id){
  const s=structuredClone(state),r=s.players[player]?.reserved[index];
  check(s.mode==='physical'&&r&&r.id===null,'Choose an unidentified reservation');
  check(available(s,r.tier).some(c=>c.id===id),'Card is already known or wrong level');r.id=id;assertValid(s);return s;
}
export function payments(p,id){
  const b=bonuses(p),need=CARDS[id].cost.map((n,i)=>Math.max(0,n-b[i])),result=[];
  function walk(i,pay,gold){if(gold>p.tokens[5])return;if(i===5){result.push([...pay,gold]);return;}
    for(let n=Math.min(need[i],p.tokens[i]);n>=0;n--)walk(i+1,[...pay,n],gold+need[i]-n);}
  walk(0,[],0);return result;
}
const vector=a=>Array.isArray(a)&&a.length===6&&a.every(n=>Number.isInteger(n)&&n>=0);
function finish(s){
  if(total(s.players[s.currentPlayer].tokens)>10){s.phase='return';return;}
  const ids=eligible(s);if(ids.length>1){s.phase='noble';return;}
  if(ids.length===1){s.nobles.splice(s.nobles.indexOf(ids[0]),1);s.players[s.currentPlayer].nobles.push(ids[0]);}
  advance(s);
}
function advance(s){
  if(score(s.players[s.currentPlayer])>=15)s.finalRound=true;
  s.turn++;s.currentPlayer=(s.currentPlayer+1)%s.players.length;
  s.phase=s.finalRound&&s.currentPlayer===s.starter?'gameover':'play';delete s.pending;
}
function reveal(s,tier,index,reserved=false){
  if(!s.deckCounts[tier-1])return false;
  s.deckCounts[tier-1]--;
  if(s.mode==='digital'){
    const id=s.decks[tier-1].pop();if(reserved)s.players[s.currentPlayer].reserved[index].id=id;else s.market[tier-1][index]=id;
  }else{s.phase='reveal';s.pending={tier,index,reserved};return true;}return false;
}
export function applyAction(state,a,{validate=true}={}){
  const s=structuredClone(state),p=s.players[s.currentPlayer];check(a&&typeof a==='object','Choose an action');
  if(s.phase==='reveal'){
    check(a.type==='reveal','Record the actual card');const r=s.pending;
    check((r.reserved&&a.id===null)||available(s,r.tier).some(c=>c.id===a.id),'Choose an available card of the matching level');
    if(r.reserved)p.reserved[r.index].id=a.id;else s.market[r.tier-1][r.index]=a.id;
    delete s.pending;finish(s);
  }else if(s.phase==='return'){
    check(a.type==='return'&&vector(a.tokens),'Choose tokens to return');check(total(a.tokens)===total(p.tokens)-10,'Return exactly the excess tokens');
    a.tokens.forEach((n,i)=>{check(n<=p.tokens[i],'You do not have these tokens');p.tokens[i]-=n;s.bank[i]+=n;});finish(s);
  }else if(s.phase==='noble'){
    check(a.type==='noble'&&eligible(s).includes(a.id),'Choose an eligible noble');p.nobles.push(a.id);s.nobles.splice(s.nobles.indexOf(a.id),1);advance(s);
  }else{
    check(s.phase==='play','Finish the current entry first');
    if(a.type==='take'){
      check(vector(a.tokens)&&a.tokens[5]===0,'Choose gem tokens, not gold');
      const colors=a.tokens.filter(n=>n>0).length,n=total(a.tokens),availableColors=s.bank.slice(0,5).filter(n=>n>0).length;
      check((n===2&&colors===1&&s.bank[a.tokens.indexOf(2)]>=4)||(colors===n&&n===Math.min(3,availableColors)&&n>0),'Take three distinct available colors, or two of a color with at least four in supply');
      a.tokens.forEach((n,i)=>{check(n<=s.bank[i],'Insufficient supply');p.tokens[i]+=n;s.bank[i]-=n;});finish(s);
    }else if(a.type==='buy'||a.type==='reserve'){
      const isHand=a.source==='reserved',blind=a.source==='deck';
      check(['market','reserved','deck'].includes(a.source),'Invalid card source');
      check(Number.isInteger(a.index)&&a.index>=0,'Invalid card slot');
      if(!isHand)check(Number.isInteger(a.tier)&&a.tier>=1&&a.tier<=3,'Invalid level');
      const id=isHand?p.reserved[a.index]?.id:blind?null:s.market[a.tier-1]?.[a.index];
      if(a.type==='buy'){
        check(!blind&&Number.isInteger(id)&&CARDS[id],'Identify this card before buying it');
        check(vector(a.payment)&&payments(p,id).some(v=>v.every((n,i)=>n===a.payment[i])),'Invalid gem payment');
        a.payment.forEach((n,i)=>{p.tokens[i]-=n;s.bank[i]+=n;});p.cards.push(id);
        if(isHand)p.reserved.splice(a.index,1);else s.market[a.tier-1][a.index]=null;
      }else{
        check(!isHand&&p.reserved.length<3,'You may hold at most three reserved cards');
        check(blind?s.deckCounts[a.tier-1]>0:Number.isInteger(id)&&!!CARDS[id],'No card in that slot');
        p.reserved.push({id,tier:a.tier,public:!blind});
        if(s.bank[5]){s.bank[5]--;p.tokens[5]++;}
        if(!blind)s.market[a.tier-1][a.index]=null;
      }
      const wait=blind?reveal(s,a.tier,p.reserved.length-1,true):!isHand&&reveal(s,a.tier,a.index);
      if(!wait)finish(s);
    }else if(a.type==='pass'){
      check(p.reserved.every(r=>r.id!==null),'Identify reserved cards to prove no purchase is possible');
      check(legalActions(s,false).length===0,'Passing is allowed only when no action is possible');p.reserved.forEach(r=>r.public=true);finish(s);
    }else throw Error('Unknown action');
  }
  if(validate)assertValid(s);return s;
}
export function legalActions(s,includePass=true){
  const p=s.players[s.currentPlayer],out=[];
  if(s.phase==='return'){
    const count=total(p.tokens)-10;
    function walk(i,left,v){if(i===6){if(!left)out.push({type:'return',tokens:v});return;}for(let n=0;n<=Math.min(left,p.tokens[i]);n++)walk(i+1,left-n,[...v,n]);}
    walk(0,count,[]);return out;
  }
  if(s.phase==='noble')return eligible(s).map(id=>({type:'noble',id}));
  if(s.phase!=='play')return [];
  const colors=[0,1,2,3,4].filter(i=>s.bank[i]>0),n=Math.min(3,colors.length);
  function picks(start,left,v){if(!left){if(n)out.push({type:'take',tokens:v});return;}for(let j=start;j<colors.length;j++){const a=[...v];a[colors[j]]=1;picks(j+1,left-1,a);}}
  picks(0,n,[0,0,0,0,0,0]);
  for(let i=0;i<5;i++)if(s.bank[i]>=4){const a=[0,0,0,0,0,0];a[i]=2;out.push({type:'take',tokens:a});}
  for(let t=0;t<3;t++){
    s.market[t].forEach((id,index)=>{if(id===null)return;for(const payment of payments(p,id))out.push({type:'buy',source:'market',tier:t+1,index,payment});
      if(p.reserved.length<3)out.push({type:'reserve',source:'market',tier:t+1,index});});
    if(s.deckCounts[t]&&p.reserved.length<3)out.push({type:'reserve',source:'deck',tier:t+1,index:0});
  }
  p.reserved.forEach((r,index)=>{if(r.id!==null)for(const payment of payments(p,r.id))out.push({type:'buy',source:'reserved',index,payment});});
  if(!out.length&&includePass&&p.reserved.every(r=>r.id!==null))out.push({type:'pass'});return out;
}
export function observation(s,viewer=s.currentPlayer){const o=structuredClone(s);delete o.decks;
  o.players.forEach((p,i)=>p.reserved.forEach(r=>{if(i!==viewer&&!r.public)r.id=null;}));return o;}
export function analysisBlocker(s){if(['setup','reveal','gameover'].includes(s.phase))return s.phase==='gameover'?'Game finished':'Record the actual table first';
  return s.players[s.currentPlayer].reserved.some(r=>r.id===null)?'Identify the active player’s private reservations for advice; manual recording remains available.':'';}
export function determinize(o,random){
  check(!analysisBlocker(o),'Incomplete observation');const s=structuredClone(o);s.mode='digital';
  const used=new Set(knownIds(s));s.decks=[1,2,3].map(t=>shuffle(CARDS.filter(c=>c.tier===t&&!used.has(c.id)).map(c=>c.id),random));
  s.players.forEach(p=>p.reserved.forEach(r=>{if(r.id===null)r.id=s.decks[r.tier-1].pop();}));assertValid(s);return s;
}
export function assertValid(s){
  check(s?.version===1&&['physical','digital'].includes(s.mode),'Unsupported game');
  check(['setup','play','return','noble','reveal','gameover'].includes(s.phase),'Invalid phase');
  check(Array.isArray(s.players)&&s.players.length>=2&&s.players.length<=4,'Invalid players');
  check(Number.isInteger(s.starter)&&s.starter>=0&&s.starter<s.players.length&&Number.isInteger(s.currentPlayer)&&s.currentPlayer>=0&&s.currentPlayer<s.players.length,'Invalid turn');
  check(Number.isInteger(s.turn)&&s.turn>=0&&typeof s.finalRound==='boolean','Invalid turn counter');
  check(vector(s.bank),'Invalid supply');
  if(s.phase==='setup')check(s.mode==='physical'&&s.turn===0&&s.market.flat().every(id=>id===null),'Invalid setup');
  check(Array.isArray(s.market)&&s.market.length===3&&s.market.every(row=>Array.isArray(row)&&row.length===4),'Invalid market');
  check(Array.isArray(s.deckCounts)&&s.deckCounts.length===3&&s.deckCounts.every(n=>Number.isInteger(n)&&n>=0),'Invalid decks');
  const ids=[],counts=[0,0,0];
  const add=(id,tier)=>{check(Number.isInteger(id)&&CARDS[id]&&(!tier||CARDS[id].tier===tier),'Invalid card');ids.push(id);counts[CARDS[id].tier-1]++;};
  for(let t=0;t<3;t++)for(const id of s.market[t])if(id!==null)add(id,t+1);
  const nobles=[...s.nobles];
  s.players.forEach(p=>{check(vector(p.tokens)&&Array.isArray(p.cards)&&Array.isArray(p.reserved)&&p.reserved.length<=3&&Array.isArray(p.nobles),'Invalid player inventory');
    if(p!==s.players[s.currentPlayer]||!['reveal','return'].includes(s.phase))check(total(p.tokens)<=10,'Too many tokens');
    p.cards.forEach(id=>add(id));p.reserved.forEach(r=>{check([1,2,3].includes(r.tier)&&typeof r.public==='boolean','Invalid reservation');if(r.id!==null)add(r.id,r.tier);else {check(s.mode==='physical'&&!r.public,'Unknown public reservation');counts[r.tier-1]++;}});nobles.push(...p.nobles);});
  for(let t=0;t<3;t++){
    if(!['setup','reveal'].includes(s.phase)&&s.deckCounts[t]>0)check(s.market[t].every(id=>id!==null),'Missing market card');
    if(s.phase==='setup')counts[t]+=4;
    else if(s.phase==='reveal'&&!s.pending?.reserved&&s.pending?.tier===t+1)counts[t]++;
    check(counts[t]+s.deckCounts[t]===[40,30,20][t],'Card conservation failed');
    if(s.mode==='digital'){check(Array.isArray(s.decks?.[t])&&s.decks[t].length===s.deckCounts[t],'Invalid deck size');s.decks[t].forEach(id=>{check(CARDS[id]?.tier===t+1,'Wrong deck level');ids.push(id);});}
  }
  check(new Set(ids).size===ids.length,'Duplicate card');
  check(nobles.every(id=>Number.isInteger(id)&&NOBLES[id])&&new Set(nobles).size===nobles.length,'Invalid nobles');
  check(nobles.length===(s.phase==='setup'?0:s.players.length+1),'Noble conservation failed');
  for(let i=0;i<6;i++)check(s.bank[i]+s.players.reduce((n,p)=>n+p.tokens[i],0)===(i===5?5:s.players.length===2?4:s.players.length===3?5:7),'Token conservation failed');
  if(s.phase==='return')check(total(s.players[s.currentPlayer].tokens)>10&&total(s.players[s.currentPlayer].tokens)<=13,'Invalid return phase');
  if(s.phase==='noble')check(eligible(s).length>=2,'Invalid noble choice');
  if(s.phase==='gameover')check(s.finalRound&&s.currentPlayer===s.starter&&s.players.some(p=>score(p)>=15),'Invalid endgame');
  if(s.phase==='reveal'){const r=s.pending;check(s.mode==='physical'&&r&&[1,2,3].includes(r.tier)&&Number.isInteger(r.index)&&typeof r.reserved==='boolean','Invalid observation request');
    check(r.reserved?s.players[s.currentPlayer].reserved[r.index]?.id===null:r.index>=0&&r.index<4&&s.market[r.tier-1][r.index]===null,'Invalid reveal slot');}
  return true;
}
