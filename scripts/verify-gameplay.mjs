/**
 * Differential validation: complete games against an independently written
 * state machine, with different board representations and scoring logic.
 *
 * Usage: npm run verify:gameplay
 *        VERIFY_GAMES=100 npm run verify:gameplay
 */
import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {
  newGame,drawFactories,legalActions,applyAction,
  assertValid,outcomes,wallColor
} from "../src/azul.js";
import {
  createReference,offerReference,choicesReference,moveReference,winnersReference
} from "../validation/reference-azul.js";

function rng(seed) {
  let n=seed>>>0;
  return ()=> ((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
}
const key = a => [a.source,a.color,a.row].join(":");
function compare(production,reference,where) {
  const assertSame=(a,b,name)=>assert.deepEqual(a,b,where+" "+name);
  assertValid(production);
  assertSame(production.phase,reference.phase,"phase");
  assertSame(production.round,reference.round,"round");
  assertSame(production.starter,reference.starter,"starter");
  assertSame(production.currentPlayer,reference.turn,"turn");
  assertSame(production.nextStarter,reference.next,"nextStarter");
  assertSame(production.markerAvailable,reference.token,"marker");
  assertSame(production.factories,reference.displays,"factories");
  assertSame(production.center,reference.center,"center");
  assertSame(production.bag,reference.bag,"bag");
  assertSame(production.discard,reference.lid,"discard");
  for(let i=0;i<reference.seats.length;i++) {
    const actual=production.players[i],expected=reference.seats[i];
    assertSame(actual.score,expected.score,"P"+i+" score");
    assertSame(actual.floor,expected.floor,"P"+i+" floor");
    for(let row=0;row<5;row++) {
      const x=actual.lines[row],y=expected.patterns[row];
      assertSame(x.count,y.length,"P"+i+" row"+row+" tile count");
      assertSame(x.color,y.length?y[0]:-1,"P"+i+" row"+row+" tile color");
      for(let col=0;col<5;col++){
        const tile=expected.wall[row][col];
        assertSame(actual.wall[row][col],tile!==null,"P"+i+" wall"+row+","+col);
        if(tile!==null)assertSame(tile,wallColor(row,col),"P"+i+" wall color");
      }
    }
  }
}
const games=Number(process.env.VERIFY_GAMES??"10000");
if(!Number.isInteger(games)||games<1||games>1000000)throw Error("VERIFY_GAMES must be integer 1–1000000");
const began=performance.now();
let moves=0,rounds=0,invalid=0,firstMarker=0;
for(let gameIndex=0;gameIndex<games;gameIndex++){
  const players=2+gameIndex%3;
  const starter=(gameIndex*7+1)%players;
  const drawSeed=((gameIndex+1)*0x9e3779b1)>>>0;
  const choiceSeed=(drawSeed^0xD1B54A35)>>>0;
  let actual=newGame({players,starter,mode:"digital"});
  const oracle=createReference(players,starter);
  const drawA=rng(drawSeed),drawB=rng(drawSeed),pick=rng(choiceSeed);
  compare(actual,oracle,"game="+gameIndex+" init");
  let maxMoves=0;
  while(actual.phase!=="gameover"){
    if(++maxMoves>1500)throw Error("Game "+gameIndex+" did not finish");
    if(actual.phase==="refill"){
      actual=drawFactories(actual,drawA);
      offerReference(oracle,drawB);
      rounds++;
    } else {
      const a=legalActions(actual),b=choicesReference(oracle);
      assert.deepEqual(a.map(key).sort(),b.map(key).sort(),
        "game "+gameIndex+" legal moves "+moves);
      const action=b[Math.floor(pick()*b.length)];
      if(!action)throw Error("Reference has no legal action");
      if(action.source<0&&actual.markerAvailable)firstMarker++;
      actual=applyAction(actual,action);
      moveReference(oracle,action);
      moves++;
    }
    compare(actual,oracle,"game="+gameIndex+" step="+maxMoves);
  }
  assert.deepEqual(outcomes(actual),winnersReference(oracle),"game "+gameIndex+" winners");
}
const duration=Math.round(performance.now()-began);
console.log(JSON.stringify({
  status:"PASS",
  games,moves,roundRefills:rounds,firstCenterClaims:firstMarker,
  errors:invalid,elapsedMs:duration
},null,2));
