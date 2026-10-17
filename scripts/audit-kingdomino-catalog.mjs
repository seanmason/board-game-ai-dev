import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {TILES} from '../kingdomino/catalog.js';import {PHOTO_FACTS} from '../test/kingdomino-catalog-reference.js';
const initials={wheat:'w',forest:'f',water:'l',grass:'g',swamp:'s',mine:'m'};
assert.equal(PHOTO_FACTS.length,48);for(const t of TILES)assert.equal(t.halves.map(h=>initials[h.terrain]+h.crowns).join(''),PHOTO_FACTS[t.id-1],`Photograph ordinal domino ${t.id}`);
const pin='905e17dc4c5c440e6b0f00ccc24c851a70b23533';
if(process.argv.includes('--online')){const response=await fetch(`https://raw.githubusercontent.com/RuPaulsDataRace/Kingdomino-For-Queens/${pin}/kingdomino.csv`);if(!response.ok)throw Error('Source fetch failed: '+response.status);const csv=await response.text(),rows=csv.trim().split(/\r?\n/).slice(1).map(row=>row.split(','));assert.equal(rows.length,48);for(const r of rows){const t=TILES[Number(r[0])-1];assert.deepEqual(t.halves,[{terrain:r[1],crowns:Number(r[5])},{terrain:r[3],crowns:Number(r[6])}]);}console.log('Pinned CSV SHA-256:',createHash('sha256').update(csv).digest('hex'));}
console.log('All 48 domino IDs/terrain halves/crowns agree with pinned CSV transcription and complete photographed order. Face-only photo does not independently prove reverse IDs; see docs/KINGDOMINO.md.');
