import assert from 'node:assert/strict';
import {CARD_TOTALS,SOURCE,GOODS_TOKENS,BONUS_TOKENS,INVENTORY_ASSUMPTION} from '../jaipur/catalog.js';
import {newGame} from '../jaipur/core.js';
assert.equal(CARD_TOTALS.reduce((a,b)=>a+b,0),55);
assert.equal(SOURCE.exactTokenVectorsVerified,false);
assert.equal(GOODS_TOKENS.flat().length,38);assert.equal(BONUS_TOKENS.flat().length,18);assert.equal(newGame({mode:'digital'}).mode,'digital');
console.log(JSON.stringify({status:'assumed-inventory-enabled',cards:55,goodsTokens:38,bonusTokens:18,exactTokenVectorsCertified:false,generatedDigitalEdition:'enabled-under-user-authorized-assumption',source:SOURCE,assumption:INVENTORY_ASSUMPTION,unresolved:['Complete matching-edition token fronts/backs audit','Publisher full-tie ruling (simulation uses tie redeal)','Publisher empty-bonus ruling (finite supply policy)']},null,2));
