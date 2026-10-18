import assert from 'node:assert/strict';
import {newGame,applyAction,legalActions,random,assertValid} from '../lost-cities/core.js';
import {COLORS,cardType} from '../lost-cities/catalog.js';
import {recordPhysicalAction,recordObservation} from '../lost-cities/observations.js';
const rounds=Number(process.env.LOST_CITIES_ROUNDS??12);let completed=0,capped=0,draws=0;
for(let seed=1;seed<=rounds;seed++){
 const rng=random(seed*89);let truth=newGame({mode:'digital',seed}),table=recordPhysicalAction(newGame({seed}),{type:'setup'}),steps=0;
 table=recordObservation(table,{type:'hand',player:0,cards:truth.hands[0]});
 while(truth.phase!=='choose-starter'&&steps++<1200){
  const actions=legalActions(truth),a=actions[Math.floor(rng()*actions.length)],before=structuredClone(truth);truth=applyAction(truth,a);table=recordPhysicalAction(table,a);
  if(a.type==='draw'){
   table=JSON.parse(JSON.stringify(table));assertValid(table);
   const e={type:'draw'};if(a.source==='deck'){if(before.current===0)e.cardId=truth.hands[0].at(-1);}else e.newTop=truth.visibleTops[a.source];table=recordObservation(table,e);draws++;
  }
  for(const f of ['phase','current','round','turn','deckCount','scores','roundScores'])assert.deepEqual(table[f],truth[f],`seed${seed} ${a.type} ${f}`);
  assert.deepEqual(table.expeditions.map(p=>COLORS.map(c=>p[c].map(cardType))),truth.expeditions.map(p=>COLORS.map(c=>p[c].map(cardType))));assert.deepEqual(COLORS.map(c=>table.discards[c].map(cardType)),COLORS.map(c=>truth.discards[c].map(cardType)));assert.equal(table.deck,null);assertValid(table);
 }
 if(truth.phase==='choose-starter')completed++;else capped++;
}
console.log(JSON.stringify({scope:'Single-round physical/digital recording parity, independent semantic oracle lives in tests',rounds,completed,capped,recordedDraws:draws}));if(capped)process.exitCode=1;
const matches=[];
for(const seed of [41,97]){
 const rng=random(seed),agreedStarters=[1,0];let truth=newGame({mode:'digital',seed}),table=recordPhysicalAction(newGame({seed}),{type:'setup'}),steps=0,recordedDraws=0;
 table=recordObservation(table,{type:'hand',player:0,cards:truth.hands[0]});
 while(truth.phase!=='gameover'&&steps++<3600){
  if(truth.phase==='choose-starter'){
   // An explicit operator transcript supplies this agreement; no rule chooses it.
   const choice={type:'chooseStarter',starter:agreedStarters[truth.round-1],basis:'explicit physical transcript agreement'};
   truth=applyAction(truth,choice);table=recordPhysicalAction(table,choice);assert.equal(table.phase,'setup');table=recordPhysicalAction(table,{type:'setup'});table=recordObservation(table,{type:'hand',player:0,cards:truth.hands[0]});continue;
  }
  const aa=legalActions(truth),a=aa[Math.floor(rng()*aa.length)],before=structuredClone(truth);truth=applyAction(truth,a);table=recordPhysicalAction(table,a);
  if(a.type==='draw'){table=JSON.parse(JSON.stringify(table));assertValid(table);table=recordObservation(table,{type:'draw',...(a.source==='deck'?(before.current===0?{cardId:truth.hands[0].at(-1)}:{}):{newTop:truth.visibleTops[a.source]})});recordedDraws++;}
  for(const field of ['phase','current','round','turn','deckCount','scores','roundScores','winners'])assert.deepEqual(table[field],truth[field],`match${seed} ${field}`);assertValid(table);
 }
 assert.equal(truth.phase,'gameover','Three-round transcript cap');assert.equal(table.adjudications.length,2);assert.deepEqual(table.adjudications.map(a=>a.nextStarter),agreedStarters);
 const final=table.roundScores.at(-1).map(p=>p.total);matches.push({seed,completed:true,roundTotals:table.roundScores.map(r=>r.map(p=>p.total)),cumulativeTotals:table.scores,finalRoundHigherSeat:final[0]===final[1]?null:final[0]>final[1]?0:1,cumulativeLeaders:table.winners,agreedNextStarters:agreedStarters,recordedDraws});
}
console.log(JSON.stringify({scope:'Complete physical three-round transcripts with explicit next-starter agreement; round and cumulative adjudication stay distinct',matches}));
