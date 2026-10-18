import assert from 'node:assert/strict';
import {newGame,applyAction,legalActions,assertValid,random} from '../sushi-go/core.js';
import {typeOf} from '../sushi-go/catalog.js';
import {recordPhysicalAction,recordObservation,publicObservation} from '../sushi-go/observations.js';
const games=Number(process.env.SUSHI_GO_GAMES??6),rows=[];
const tableShape=table=>table.map(e=>({type:typeOf(e.id),pick:e.pick,wasabi:e.wasabi?table.findIndex(w=>w.id===e.wasabi):null}));
for(const players of [2,3,4,5]){
 let reveals=0,rounds=0;
 for(let seed=1;seed<=games;seed++){
  let truth=newGame({players,mode:'digital',seed}),table=recordPhysicalAction(newGame({players,mode:'physical',seed}),{type:'setup'});const rng=random(seed*53);
  while(truth.phase!=='gameover'){
   if(truth.phase==='roundEnd'){truth=applyAction(truth,{type:'nextRound'});table=recordPhysicalAction(table,{type:'nextRound'});table=recordPhysicalAction(table,{type:'setup'});rounds++;}
   // One viewer records each actual received hand; opponents remain unentered.
   table=recordObservation(table,{type:'hand',player:0,types:truth.hands[0].map(typeOf)});
   const joint=Array.from({length:players},(_,p)=>{const aa=legalActions(truth,p);return aa[Math.floor(rng()*aa.length)];});
   for(let p=0;p<players;p++){
    const a=joint[p],returnIndex=a.returnId?truth.tableaux[p].filter(e=>typeOf(e.id)==='chopsticks').findIndex(e=>e.id===a.returnId):-1;
    const returnId=returnIndex<0?null:table.tableaux[p].filter(e=>typeOf(e.id)==='chopsticks')[returnIndex].id;
    truth=applyAction(truth,a);table=recordPhysicalAction(table,{type:'commit',actor:p,cards:a.cards,returnId});
    // A reload and private handoff cannot reveal partial commitments publicly.
    table=JSON.parse(JSON.stringify(table));assertValid(table);assert.deepEqual(table.tableaux.map(tableShape),truth.tableaux.map(tableShape));
   }
   truth=applyAction(truth,{type:'reveal'});table=recordObservation(table,{type:'reveal'});reveals++;
   for(const f of ['round','pick','remaining','scores','roundScores','winners','deckCount'])assert.deepEqual(table[f],truth[f],`${players}p seed${seed} ${f}`);
   assert.deepEqual(table.tableaux.map(tableShape),truth.tableaux.map(tableShape));assert.deepEqual(table.puddings.map(p=>p.length),truth.puddings.map(p=>p.length));assert.ok(table.deck.every(c=>c===null));assertValid(table);
   assert.equal(publicObservation(table,0).phase,publicObservation(truth,0).phase);
  }
 }
 rows.push({players,matches:games,jointReveals:reveals,roundTransitions:rounds});
}
console.log('Sushi Go complete physical/digital transcript parity passed',JSON.stringify(rows));
console.log('Recording-path parity uses production transitions. Independent score/legal-choice oracles are in test/sushi-go.test.js.');
