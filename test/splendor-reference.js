// Independently written transition oracle. Imports card facts only, never engine helpers.
import assert from 'node:assert/strict';import {CARDS,NOBLES} from '../splendor/catalog.js';
export function referenceMove(input,a){
 const s=JSON.parse(JSON.stringify(input)),p=s.players[s.currentPlayer],sum=v=>v.reduce((x,y)=>x+y,0);
 const discount=()=>[0,1,2,3,4].map(i=>p.cards.filter(id=>CARDS[id].bonus===i).length);
 const eligible=()=>s.nobles.filter(id=>NOBLES[id].cost.every((n,i)=>discount()[i]>=n));
 const end=()=>{if(p.cards.reduce((n,id)=>n+CARDS[id].points,0)+p.nobles.length*3>=15)s.finalRound=true;
  s.turn+=1;s.currentPlayer=(s.currentPlayer+1)%s.players.length;s.phase=s.finalRound&&s.currentPlayer===s.starter?'gameover':'play';};
 const settle=()=>{if(sum(p.tokens)>10){s.phase='return';return;}const e=eligible();if(e.length>1){s.phase='noble';return;}if(e.length){p.nobles.push(e[0]);s.nobles=s.nobles.filter(id=>id!==e[0]);}end();};
 if(s.phase==='return'){assert.equal(a.type,'return');assert.equal(sum(a.tokens),sum(p.tokens)-10);for(let i=0;i<6;i++){assert.ok(a.tokens[i]<=p.tokens[i]);p.tokens[i]-=a.tokens[i];s.bank[i]+=a.tokens[i];}settle();return s;}
 if(s.phase==='noble'){assert.equal(a.type,'noble');assert.ok(eligible().includes(a.id));p.nobles.push(a.id);s.nobles=s.nobles.filter(id=>id!==a.id);end();return s;}
 assert.equal(s.phase,'play');
 if(a.type==='take'){
  const distinct=a.tokens.slice(0,5).filter(n=>n>0).length;
  assert.equal(a.tokens[5],0);
  if(a.tokens.includes(2)){assert.equal(distinct,1);assert.equal(sum(a.tokens),2);assert.ok(s.bank[a.tokens.indexOf(2)]>=4);}
  else {assert.ok(a.tokens.every(n=>n===0||n===1));assert.equal(distinct,Math.min(3,s.bank.slice(0,5).filter(n=>n>0).length));}
  a.tokens.forEach((n,i)=>{assert.ok(n<=s.bank[i]);s.bank[i]-=n;p.tokens[i]+=n;});
 }else if(a.type==='buy'||a.type==='reserve'){
  const hand=a.source==='reserved',blind=a.source==='deck';const id=hand?p.reserved[a.index].id:blind?null:s.market[a.tier-1][a.index];
  if(a.type==='buy'){
   const d=discount(),need=CARDS[id].cost.map((n,i)=>Math.max(0,n-d[i]));
   let gold=0;for(let i=0;i<5;i++){assert.ok(a.payment[i]<=need[i]);gold+=need[i]-a.payment[i];}assert.equal(gold,a.payment[5]);
   a.payment.forEach((n,i)=>{assert.ok(n<=p.tokens[i]);p.tokens[i]-=n;s.bank[i]+=n;});p.cards.push(id);if(hand)p.reserved.splice(a.index,1);
  }else{assert.ok(p.reserved.length<3);const card=blind?s.decks[a.tier-1].pop():id;p.reserved.push({id:card,tier:a.tier,public:!blind});if(s.bank[5]>0){p.tokens[5]++;s.bank[5]--;}}
  if(!hand&&!blind)s.market[a.tier-1][a.index]=s.decks[a.tier-1].pop()??null;
  s.deckCounts=s.decks.map(d=>d.length);
 }else if(a.type==='pass'){
  assert.ok(s.bank.slice(0,5).every(n=>n===0));p.reserved.forEach(r=>r.public=true);
  assert.ok(p.reserved.length===3||s.deckCounts.every(n=>n===0)&&s.market.flat().every(id=>id===null));
  const d=discount();for(const id of [...s.market.flat(),...p.reserved.map(r=>r.id)].filter(id=>id!==null))
    assert.ok(CARDS[id].cost.reduce((n,x,i)=>n+Math.max(0,x-d[i]-p.tokens[i]),0)>p.tokens[5]);
 }else throw Error('Unknown reference action');
 settle();return s;
}
