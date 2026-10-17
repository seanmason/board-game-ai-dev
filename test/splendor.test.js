import test from 'node:test';import assert from 'node:assert/strict';
import {CARDS,NOBLES} from '../splendor/catalog.js';
import {newGame,assertValid,applyAction,legalActions,payments,observeSetup,identifyReserved,available,observation,determinize,analysisBlocker,rng,score,bonuses,winners} from '../splendor/core.js';
import {createSearch,runSearch,summary,policy} from '../splendor/ai.js';
const digital=(players=2,starter=0)=>newGame({mode:'digital',players,starter,seed:19});
function give(s,player,id){let t=CARDS[id].tier-1,k=s.decks[t].indexOf(id);if(k>=0)s.decks[t].splice(k,1);else {k=s.market[t].indexOf(id);assert.ok(k>=0);s.market[t][k]=s.decks[t].pop();}s.deckCounts[t]--;s.players[player].cards.push(id);}
function tokens(s,player,v){v.forEach((n,i)=>{s.players[player].tokens[i]+=n;s.bank[i]-=n;});}
function physical(){let s=newGame();const d=digital();return observeSetup(s,d.market,d.nobles);}
test('catalog has 90 unique cards in 40/30/20 levels and ten unique nobles',()=>{
 assert.equal(CARDS.length,90);assert.deepEqual([1,2,3].map(t=>CARDS.filter(c=>c.tier===t).length),[40,30,20]);
 assert.equal(new Set(CARDS.map(({tier,bonus,points,cost})=>JSON.stringify([tier,bonus,points,cost]))).size,90);
 assert.equal(NOBLES.length,10);assert.equal(new Set(NOBLES.map(n=>JSON.stringify(n.cost))).size,10);
 for(const n of NOBLES)assert.ok(n.cost.filter(x=>x>0).every(x=>x===3)||n.cost.filter(x=>x>0).every(x=>x===4));
});
test('setup uses proper player-count supplies, nobles and starting player',()=>{for(const n of [2,3,4]){const s=digital(n,n-1);assert.equal(s.nobles.length,n+1);assert.deepEqual(s.bank,[...Array(5).fill(n===2?4:n===3?5:7),5]);assert.equal(s.currentPlayer,n-1);assertValid(s);}});
test('three different gems and double-gem minimum are enforced atomically',()=>{
 const s=digital(),before=structuredClone(s);assert.throws(()=>applyAction(s,{type:'take',tokens:[1,0,0,0,0,0]}));
 let n=applyAction(s,{type:'take',tokens:[2,0,0,0,0,0]});assert.equal(n.bank[0],2);
 assert.throws(()=>applyAction(n,{type:'take',tokens:[2,0,0,0,0,0]}));
 assert.throws(()=>applyAction(s,{type:'take',tokens:[1,1,0,0,0,1]}));assert.deepEqual(s,before);
});
test('fewer different gems only when fewer colors remain',()=>{
 const s=digital();tokens(s,0,[0,0,4,4,0,0]);tokens(s,1,[0,0,0,0,4,0]);
 const n=applyAction(s,{type:'take',tokens:[1,1,0,0,0,0]});assert.equal(n.players[0].tokens[0],1);assertValid(n);
});
test('token overflow is an explicit choice including just-taken gold',()=>{
 const s=digital();tokens(s,0,[2,2,2,2,2,0]);let n=applyAction(s,{type:'reserve',source:'deck',tier:1,index:0});
 assert.equal(n.phase,'return');assert.equal(n.turn,0);assert.throws(()=>applyAction(n,{type:'return',tokens:[0,0,0,0,0,0]}));
 n=applyAction(n,{type:'return',tokens:[0,0,0,0,0,1]});assert.equal(n.bank[5],5);assert.equal(n.turn,1);
});
test('reservations cap at three; lack of gold does not prevent reservation',()=>{
 const s=digital();tokens(s,1,[0,0,0,0,0,5]);for(let i=0;i<3;i++){const id=s.decks[0].pop();s.deckCounts[0]--;s.players[0].reserved.push({id,tier:1,public:false});}
 assert.throws(()=>applyAction(s,{type:'reserve',source:'deck',tier:1,index:0}));
 s.players[0].reserved.pop(); // restore inventory before testing lack of gold
 const missing=CARDS.filter(c=>c.tier===1&&!s.decks[0].includes(c.id)&&!s.market[0].includes(c.id)&&!s.players[0].reserved.some(r=>r.id===c.id));
 s.decks[0].push(missing[0].id);s.deckCounts[0]++;
 const n=applyAction(s,{type:'reserve',source:'deck',tier:1,index:0});assert.equal(n.players[0].tokens[5],0);assertValid(n);
});
test('all affordable payment alternatives may substitute gold deliberately',()=>{
 const s=digital(),id=s.market[0].find(id=>CARDS[id].cost.reduce((a,b)=>a+b,0)<=4),c=CARDS[id];
 tokens(s,0,[...c.cost,1]);const variants=payments(s.players[0],id);assert.ok(variants.some(v=>v[5]===1));assert.ok(variants.some(v=>v[5]===0));
 const n=applyAction(s,{type:'buy',source:'market',tier:1,index:s.market[0].indexOf(id),payment:variants.find(v=>v[5]===1)});
 assert.ok(n.players[0].cards.includes(id));assert.equal(n.bank[5],5);assertValid(n);
});
test('discounts make purchases free without consuming purchased cards',()=>{
 const s=digital();const target=s.market[0][0];CARDS[target].cost.forEach((n,color)=>{for(let j=0;j<n;j++){const c=CARDS.find(c=>c.bonus===color&&c.id!==target&&!s.players[0].cards.includes(c.id));give(s,0,c.id);}});
 assert.deepEqual(payments(s.players[0],target)[0],[0,0,0,0,0,0]);const before=s.players[0].cards.length;
 const n=applyAction(s,{type:'buy',source:'market',tier:1,index:s.market[0].indexOf(target),payment:[0,0,0,0,0,0]});assert.equal(n.players[0].cards.length,before+1);
});
test('multiple nobles require exactly one chosen visit after any action',()=>{
 const s=digital();s.nobles=[0,1,2];for(const color of [1,2,3])for(let i=0;i<4;i++)give(s,0,CARDS.find(c=>c.bonus===color&&!s.players[0].cards.includes(c.id)).id);
 let n=applyAction(s,{type:'take',tokens:[1,1,1,0,0,0]});assert.equal(n.phase,'noble');assert.equal(n.turn,0);
 assert.deepEqual(legalActions(n).map(a=>a.id),[0,1]);n=applyAction(n,{type:'noble',id:1});assert.deepEqual(n.players[0].nobles,[1]);assert.ok(n.nobles.includes(0));
});
test('15 points finishes the round relative to an arbitrary starting seat',()=>{
 let s=digital(3,1);const high=CARDS.filter(c=>c.points===5).slice(0,3);high.forEach(c=>give(s,1,c.id));
 s=applyAction(s,{type:'take',tokens:[1,1,1,0,0,0]});assert.equal(s.finalRound,true);assert.equal(s.phase,'play');assert.equal(s.currentPlayer,2);
 s=applyAction(s,{type:'take',tokens:[1,1,1,0,0,0]});assert.equal(s.currentPlayer,0);assert.equal(s.phase,'play');
 s=applyAction(s,{type:'take',tokens:[1,1,1,0,0,0]});assert.equal(s.phase,'gameover');assert.equal(s.turn,3);
});
test('ties use fewer purchased cards, then share the win',()=>{
 const s=digital();const c=CARDS.find(c=>c.points===1),z=CARDS.find(c=>c.points===0);s.players[0].cards=[c.id,z.id];s.players[1].cards=[c.id];assert.deepEqual(winners(s),[1]);s.players[0].cards=[c.id];assert.deepEqual(winners(s),[0,1]);
});
test('physical setup never displays randomly generated cards and rejects duplicates',()=>{
 const s=newGame();assert.ok(s.market.flat().every(x=>x===null));assert.equal(s.decks,null);assert.ok(analysisBlocker(s));
 const d=digital();d.market[0][1]=d.market[0][0];assert.throws(()=>observeSetup(s,d.market,d.nobles));
});
test('actual market refill pauses the turn, persists and rejects known or wrong-tier cards',()=>{
 const s=physical();let n=applyAction(s,{type:'reserve',source:'market',tier:1,index:0});assert.equal(n.phase,'reveal');assert.equal(n.turn,0);
 assert.throws(()=>applyAction(n,{type:'reveal',id:s.market[0][1]}));assert.throws(()=>applyAction(n,{type:'reveal',id:available(n,2)[0].id}));
 const actual=available(n,1)[0].id;n=applyAction(JSON.parse(JSON.stringify(n)),{type:'reveal',id:actual});assert.equal(n.turn,1);assert.equal(n.market[0][0],actual);assertValid(n);
});
test('blind reservations can stay unknown, then be identified when played',()=>{
 let s=physical();s=applyAction(s,{type:'reserve',source:'deck',tier:2,index:0});s=applyAction(s,{type:'reveal',id:null});
 assert.equal(s.players[0].reserved[0].id,null);assert.throws(()=>applyAction({...s,currentPlayer:0},{type:'buy',source:'reserved',index:0,payment:[0,0,0,0,0,0]}));
 const id=available(s,2)[0].id;s=identifyReserved(s,0,0,id);assert.equal(s.players[0].reserved[0].id,id);assertValid(s);
});
test('observation and seeded analysis are invariant to actual hidden allocations',()=>{
 let s=digital();s=applyAction(s,{type:'reserve',source:'deck',tier:1,index:0}); // P1 reservation hidden from P2
 const other=structuredClone(s);[other.players[0].reserved[0].id,other.decks[0][0]]=[other.decks[0][0],other.players[0].reserved[0].id];other.decks.forEach(d=>d.reverse());
 const a=observation(s),b=observation(other);assert.deepEqual(a,b);assert.equal(a.decks,undefined);assert.equal(a.players[0].reserved[0].id,null);
 assertValid(determinize(a,rng(8)));const x=createSearch(a,{seed:8,horizon:2}),y=createSearch(b,{seed:8,horizon:2});runSearch(x,20);runSearch(y,20);assert.deepEqual(summary(x),summary(y));
});
test('previously public reservations remain known to every observer',()=>{
 const s=applyAction(digital(),{type:'reserve',source:'market',tier:1,index:0});assert.equal(observation(s).players[0].reserved[0].id,s.players[0].reserved[0].id);
});
test('all generated actions are accepted in mixed-player complete games',()=>{
 const random=rng(317);for(const players of [2,3,4])for(let game=0;game<4;game++){
  let s=newGame({players,mode:'digital',seed:game+19});for(let i=0;i<500&&s.phase!=='gameover';i++){
   const actions=legalActions(s);for(const a of actions)assertValid(applyAction(s,a));s=applyAction(s,policy(s,random,i%4===0?'stochastic':'greedy'));
  }assert.equal(s.phase,'gameover');assert.ok(s.players.some(p=>score(p)>=15));
 }
});
test('exhausted decks leave a market slot empty without asking for invented cards',()=>{
 const s=digital();const old=[...s.decks[0]];for(const id of old)give(s,0,id);
 const n=applyAction(s,{type:'reserve',source:'market',tier:1,index:0});assert.equal(n.market[0][0],null);assert.equal(n.deckCounts[0],0);assertValid(n);
});
test('buying a reserved card frees the slot without drawing a replacement',()=>{
 let s=digital();s=applyAction(s,{type:'reserve',source:'market',tier:1,index:0});s.currentPlayer=0;
 const r=s.players[0].reserved[0];const c=CARDS[r.id];
 for(let i=0;i<5;i++)if(c.cost[i])tokens(s,0,[0,1,2,3,4,5].map(j=>i===j?c.cost[i]:0));
 const before=s.deckCounts.slice();s=applyAction(s,{type:'buy',source:'reserved',index:0,payment:payments(s.players[0],r.id)[0]});assert.equal(s.players[0].reserved.length,0);assert.deepEqual(s.deckCounts,before);
});
