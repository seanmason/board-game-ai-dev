import assert from 'node:assert/strict';import {TILES,STARTERS,SPECIES,HABITATS} from '../cascadia/catalog.js';
// Independent physical-count tables: Hessdepe, 2024-03-07, Reddit post1b8qk3n.
// Order B/E/S/H/F by M/F/P/W/R; this is aggregate corroboration, not a face audit.
const animalHabitat=[[15,13,8,8,15],[14,15,14,9,7],[9,8,14,16,12],[14,8,8,14,15],[8,14,16,12,9]];
const keystones=[[1,2,0,0,2],[2,1,2,0,0],[0,0,2,2,1],[2,0,0,1,2],[0,2,1,2,0]];
const animalPairs=[[32,7,11,8,11],[7,32,9,10,9],[11,9,32,8,8],[8,10,8,32,9],[11,9,8,9,32]];
assert.equal(TILES.length,85);assert.equal(TILES.filter(t=>t.keystone).length,25);assert.equal(STARTERS.flat().length,15);
assert.deepEqual(SPECIES.map(a=>HABITATS.map(h=>TILES.filter(t=>t.wildlife.includes(a)&&t.sides.includes(h)).length)),animalHabitat);
assert.deepEqual(SPECIES.map(a=>HABITATS.map(h=>TILES.filter(t=>t.keystone&&t.wildlife.includes(a)&&t.sides.includes(h)).length)),keystones);
assert.deepEqual(SPECIES.map(a=>SPECIES.map(b=>TILES.filter(t=>t.wildlife.includes(a)&&t.wildlife.includes(b)).length)),animalPairs);
for(const h of HABITATS){assert.equal(TILES.filter(t=>t.sides.includes(h)).length,29);for(const other of HABITATS.filter(a=>a!==h))assert.equal(TILES.filter(t=>t.sides.includes(h)&&t.sides.includes(other)).length,6);}
console.log('Cascadia catalog:85regular/25keystone/15starterhexes; all75physical correlation entries and habitat-pair counts agree. Individual regular tile-face audit remains incomplete.');
