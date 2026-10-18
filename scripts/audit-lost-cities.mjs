import assert from 'node:assert/strict';
import {COLORS,CARDS,ALL_IDS,SOURCES} from '../lost-cities/catalog.js';
assert.deepEqual(COLORS,['yellow','blue','white','green','red']);assert.equal(ALL_IDS.length,60);assert.equal(new Set(ALL_IDS).size,60);
for(const color of ['yellow','blue','white','green','red']){const group=Object.values(CARDS).filter(c=>c.color===color);assert.deepEqual(group.filter(c=>c.value).map(c=>c.value),[2,3,4,5,6,7,8,9,10]);assert.equal(group.filter(c=>c.value===0).length,3);}
console.log('Lost Cities original60 catalog audit passed:45 numbers,15 wagers,five named suits.');console.log('Publisher source:',SOURCES.directory);console.log('Planning PDF SHA256 (not independently downloaded this run):',SOURCES.planSHA256);
