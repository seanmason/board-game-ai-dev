/**
 * Complete seeded original-base-game transition exercise.
 * Checks every transition's conservation invariant and finishes all 4 rounds.
 *
 * NOT an independent oracle for 67 bird powers; that separate criterion is
 * tracked in docs/WINGSPAN_ARCHITECTURE.md and remains a release gate.
 * Usage: npm run verify:wingspan or WINGSPAN_GAMES=15 npm run verify:wingspan
 */
import {performance} from "node:perf_hooks";
import {BIRDS} from "../wingspan/catalog.js";
import {newGame,applyAction,assertValid,seededRandom} from "../wingspan/core.js";
import {candidateActions} from "../wingspan/actions.js";
import {scorePlayer} from "../wingspan/scoring.js";

const games=Number(process.env.WINGSPAN_GAMES??20);
if(!Number.isInteger(games)||games<1||games>10000)
  throw Error("WINGSPAN_GAMES must be integer 1–10000");
let moves=0,powers=0,activated=0,skipped=0,birds=0,rounds=0;
let gameLength=0;
const start=performance.now();
for(let game=0;game<games;game++){
  const players=2+game%4;
  const rng=seededRandom(84711+game*7919);
  let s=newGame({players,seed:90001+game*317,starter:game%players});
  assertValid(s);
  let ticks=0;
  while(s.phase!=="gameover"){
    if(++ticks>650)throw Error("Full game did not end: "+game+" phase "+s.phase);
    const options=candidateActions(s);
    if(!options.length)throw Error("No actions in "+s.phase+" at game "+game);
    let candidates=options;
    if(s.phase==="setup"){
      candidates=options.filter(x=>x.action.keep.length<=2);
      if(!candidates.length)candidates=options;
    }else if(s.phase==="play"){
      const bias=rng();
      const cat=bias<.32?"Bird":bias<.57?"Food":bias<.79?"Eggs":"Cards";
      const matching=options.filter(x=>x.category===cat);
      if(matching.length)candidates=matching;
    }else if(s.phase==="power"){
      powers++;
      const special=options.filter(x=>!x.action.skip);
      const skip=options.filter(x=>x.action.skip);
      // Once a bird power has revealed or drawn cards, subsequent
      // discards/choices are mandatory. Do not sample an illegal skip.
      if(special.length&&(rng()<.50||!skip.length))candidates=special;
      else candidates=skip;
    }
    const chosen=candidates[Math.floor(rng()*candidates.length)];
    const before=s.phase,round=s.round;
    try{s=applyAction(s,chosen.action);}
    catch(e){throw Error("Game "+game+", "+s.phase+" round "+s.round+
      " tick "+ticks+" option "+chosen.label+": "+e.message);}
    assertValid(s);
    if(before==="play"&&chosen.action.type==="playBird")birds++;
    if(before==="power"){
      if(chosen.action.skip)skipped++;
      else activated++;
    }
    if(s.round!==round)rounds++;
    moves++;
  }
  if(s.round!==4)throw Error("Finished before fourth round");
  if(!s.players.every(p=>p.goalPoints.length===4))
    throw Error("Missing round goal scores");
  for(const p of s.players) {
    const score=scorePlayer(p);
    if(!Number.isFinite(score.total)||score.total<0)throw Error("Invalid scoring");
  }
  gameLength+=s.turn;
}
console.log(JSON.stringify({status:"PASS",games,actions:moves,powers,
  powersActivated:activated,powersSkipped:skipped,birdsPlayed:birds,
  roundTransitions:rounds,meanMainTurns:Number((gameLength/games).toFixed(2)),
  elapsedMs:Math.round(performance.now()-start)},null,2));
