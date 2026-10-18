import assert from 'node:assert/strict';
import {CARD_TOTALS,SOURCE} from '../jaipur/catalog.js';
import {newGame} from '../jaipur/core.js';
assert.equal(CARD_TOTALS.reduce((a,b)=>a+b,0),55);
assert.equal(SOURCE.exactTokenVectorsVerified,false);
assert.throws(()=>newGame({mode:'digital'}));
console.log(JSON.stringify({status:'physical-entered-only',cards:55,goodsTokens:38,bonusTokens:18,exactTokenVectorsCertified:false,generatedDigitalEdition:'blocked',hiddenBonusSampling:'blocked',source:SOURCE,unresolved:['Complete matching-edition token fronts/backs audit','Publisher full-tie ruling','Publisher empty-bonus ruling']},null,2));
