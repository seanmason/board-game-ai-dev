import assert from 'node:assert/strict';
import {newGame,applyAction,legalActions,assertValid,random} from '../love-letter/core.js';
import {recordObservation,recordPhysicalAction} from '../love-letter/observations.js';
const games=Number(process.env.LOVE_LETTER_GAMES??12),counts=[];
for(const players of [2,3,4]){
 let turns=0,rounds=0;
 for(let seed=1;seed<=games;seed++){
  const rng=random(seed+players*113);let truth=newGame({players,mode:'digital',seed}),table=newGame({players,mode:'physical',seed});
  table=recordObservation(table,{type:'setup',exclusions:truth.exclusions});
  let steps=0;
  while(truth.phase!=='gameover'){
   assert.ok(steps++<1500,'Complete match cap');
   const actions=legalActions(truth),a=actions[Math.floor(rng()*actions.length)],before=structuredClone(truth);
   truth=applyAction(truth,a);
   if(a.type==='draw')table=recordPhysicalAction(table,a);
   else if(a.type==='nextRound'){
    rounds++;table=recordPhysicalAction(table,a);table=recordObservation(table,{type:'setup',exclusions:truth.exclusions});
   }else{
    turns++;table=recordPhysicalAction(table,a);
    // Persist/reload a pending transaction before entering its actual evidence.
    table=JSON.parse(JSON.stringify(table));assertValid(table);
    const p=before.current,t=a.target,retained=before.hands[p].slice();retained.splice(retained.indexOf(a.cardRank),1);
    const e={type:'effect'};
    if(a.cardRank===8)e.loserRank=retained[0];
    if(t!==undefined){
     const mine=retained[0],other=before.hands[t][0];
     if(a.cardRank===1)e.hit=other===a.guess;
     if(a.cardRank===2)e.seen=other;
     if(a.cardRank===3){e.comparison=Math.sign(mine-other);e.actorRank=mine;e.targetRank=other;if(e.comparison)e.loserRank=e.comparison<0?mine:other;}
     if(a.cardRank===5){e.discard=t===p?mine:other;if(e.discard!==8)e.replacement=truth.hands[t][0];}
     if(a.cardRank===6){e.received=truth.hands[p][0];e.given=truth.hands[t][0];}
    }
    table=recordObservation(table,e);
    if(table.phase==='showdown')table=recordObservation(table,{type:'showdown',ranks:truth.hands.map(h=>h[0]??null)});
   }
   assertValid(table);
   for(const field of ['phase','current','round','turn','alive','protected','discards','affection','drawCount','reserveCount','roundWinners','winners'])assert.deepEqual(table[field],truth[field],`${players}p seed${seed} ${a.type} ${field}`);
   assert.ok(table.deck.every(r=>r===null),'Physical hidden pile never invents identities');
  }
 }
 counts.push({players,matches:games,recordedTurns:turns,roundTransitions:rounds});
}
console.log('Love Letter digital/physical transcript parity passed',JSON.stringify(counts));
console.log('This checks recording against the production digital engine; independent semantic fixtures are in test/love-letter.test.js.');
