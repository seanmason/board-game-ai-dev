import assert from 'node:assert/strict';
import {PIECES,IDS,COUNTS,SOURCE} from '../hive/catalog.js';
import {newGame,assertValid,legalActions} from '../hive/core.js';
assert.equal(IDS.length,22);for(const p of [0,1])for(const [type,n] of Object.entries(COUNTS))assert.equal(IDS.filter(id=>PIECES[id].player===p&&PIECES[id].type===type).length,n);assertValid(newGame());assert(legalActions(newGame()).some(a=>a.pieceId==='WQ1'));
console.log(JSON.stringify({status:'component-and-opening-audit-passed',pieces:22,perSide:COUNTS,scope:'Gen42 classic English 2010, no expansions; Queen opening legal',source:SOURCE,remainingGate:'Direct publisher movement-diagram pixel inspection/hash; coordinate fixtures do not by themselves certify publisher elevated-gate diagrams'},null,2));
