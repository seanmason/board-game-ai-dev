import assert from 'node:assert/strict';
import {newGame,applyAction,legalActions,assertValid,scores} from '../patchwork/core.js';
import {referenceStep,referenceOrientations} from '../test/patchwork-reference.js';
import {PATCHES} from '../patchwork/catalog.js';
const games=Number(process.argv.find(a=>a.startsWith('--games='))?.split('=')[1]??process.env.VERIFY_GAMES??120);
let transitions=0;for(const p of PATCHES)assert.deepEqual(p.orientations,referenceOrientations(p.id));
for(let seed=1;seed<=games;seed++){
 let s=newGame({mode:'digital',seed,starter:seed%2,edition:seed%2?'original':'corrected'}),n=seed;
 while(s.phase!=='gameover'){
  assertValid(s);const actions=legalActions(s);n=(Math.imul(n,1664525)+1013904223)>>>0;const a=actions[n%actions.length];const reference=referenceStep(s,a);s=applyAction(s,a);assert.deepEqual(s,reference);transitions++;if(transitions>games*120)throw Error('Game did not terminate');
 }
 assertValid(s);assert(scores(s).every(Number.isFinite));
}
console.log(JSON.stringify({game:'patchwork',games,transitions,editions:['original','corrected'],discrepancies:0,shapeOrientationsCompared:34,oracle:'Independently written transitions and transformations; shared functional component facts'},null,2));
