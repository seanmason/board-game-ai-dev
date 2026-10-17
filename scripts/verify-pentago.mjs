/**
 * Pentago complete-game differential validation (separate 2-D reference).
 * Usage: npm run verify:pentago or PENTAGO_GAMES=3000 npm run verify:pentago
 */
import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {
  newGame,legalActions,applyAction,assertValid,actionKey,outcomes
} from "../pentago/core.js";
import {
  fresh,flattened,actions,play
} from "../validation/pentago-reference.js";

function rng(seed){
  let n=seed>>>0;
  return ()=>((n=(Math.imul(n,1664525)+1013904223))>>>0)/4294967296;
}
const cases=Number(process.env.PENTAGO_GAMES??2000);
if(!Number.isInteger(cases)||cases<1||cases>50000)
  throw Error("PENTAGO_GAMES must be integer 1..50000");
const started=performance.now();
let moves=0,immediate=0,twist=0,skip=0,draws=0,whiteWins=0,blackWins=0;
for(let gameIndex=0;gameIndex<cases;gameIndex++){
  const starter=gameIndex%2;
  const mode=gameIndex%3===0?"physical":"digital";
  let real=newGame({starter,mode}),ref=fresh(starter);
  const random=rng((gameIndex*2654435761+239)>>>0);
  let moveLimit=0;
  while(real.phase==="play"){
    if(++moveLimit>36)throw Error("Move limit exceeded");
    assertValid(real);
    assert.equal(real.phase,ref.phase,gameIndex+" phase");
    assert.equal(real.currentPlayer,ref.turn,gameIndex+" turn");
    assert.equal(real.ply,ref.ply,gameIndex+" ply");
    assert.deepEqual(real.board,flattened(ref),gameIndex+" board");
    const expected=actions(ref).map(actionKey).sort();
    const available=legalActions(real).map(actionKey).sort();
    assert.deepEqual(available,expected,"Game "+gameIndex+" legal actions");
    const action=legalActions(real)[Math.floor(random()*available.length)];
    if(action.quadrant<0){
      const placed=[...real.board];placed[action.cell]=real.currentPlayer;
      let win=false;
      for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
        for(let row=0;row<6;row++)for(let col=0;col<6;col++){
          let found=true;
          for(let t=0;t<5;t++){
            const r=row+dr*t,c=col+dc*t;
            if(r<0||r>=6||c<0||c>=6||
               placed[r*6+c]!==real.currentPlayer)found=false;
          }
          if(found)win=true;
        }
      }
      if(win)immediate++;
      else skip++;
    } else twist++;
    const next=applyAction(real,action);
    play(ref,action);
    real=next;
    assertValid(real);
    assert.equal(real.phase,ref.phase,"Game "+gameIndex+" resulting phase");
    assert.equal(real.winner,ref.winner,"Game "+gameIndex+" winner");
    assert.deepEqual(real.board,flattened(ref),"Game "+gameIndex+" resulting board");
    moves++;
  }
  assert.deepEqual(outcomes(real),
    real.winner==="draw"?[.5,.5]:real.winner===0?[1,0]:[0,1]);
  if(real.winner==="draw")draws++;
  else if(real.winner===0)blackWins++;
  else whiteWins++;
}
console.log(JSON.stringify({
  status:"PASS",games:cases,moves,immediateWins:immediate,
  neutralSkips:skip,twists:twist,draws,blackWins,whiteWins,
  durationMs:Math.round(performance.now()-started)
},null,2));
