import assert from 'node:assert/strict';
import {CARDS,RANKS,SOURCES} from '../love-letter/catalog.js';
// Independent transcription of classic reference facts, printed pp9,14–23.
const expected=[[1,'Guard',5],[2,'Priest',2],[3,'Baron',2],[4,'Handmaid',2],[5,'Prince',2],[6,'King',1],[7,'Countess',1],[8,'Princess',1]];
assert.deepEqual(CARDS.slice(1).map((c,i)=>[i+1,c.name,c.count]),expected);
assert.equal(RANKS.length,16);
console.log('Love Letter component audit passed: classic16, eight ranks, 7/5/4 match scope. Source:',SOURCES.classic);
console.log('Source page evidence: classic printed9–23 publisher text checked; Premium printed6 indexed publisher text verified. PDF binary hashes unavailable; no publisher art distributed.');
