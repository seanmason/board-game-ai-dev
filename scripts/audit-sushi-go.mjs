import assert from 'node:assert/strict';
import {TYPES,ALL_IDS,CARDS,SOURCES} from '../sushi-go/catalog.js';
// Separate transcription: original author2012 p1 and Gamewright2014 p2.
const expected={tempura:14,sashimi:14,dumpling:14,maki1:6,maki2:12,maki3:8,egg:5,salmon:10,squid:5,pudding:10,wasabi:6,chopsticks:4};
assert.deepEqual(Object.fromEntries(Object.entries(TYPES).map(([t,c])=>[t,c.count])),expected);assert.equal(ALL_IDS.length,108);assert.equal(new Set(ALL_IDS).size,108);for(const id of ALL_IDS)assert.equal(CARDS[id].id,id);
console.log('Sushi Go catalog audit passed:108 unique copies,12 original printed types; no Party cards.');
console.log('Source:',SOURCES.author,'p1 catalog/p3 zero-maki/p4 dessert; publisher2014 p2–5; designer:',SOURCES.designerAttribution,SOURCES.designerQuote);
