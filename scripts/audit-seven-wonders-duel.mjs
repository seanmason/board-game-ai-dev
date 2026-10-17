import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {CARDS,WONDERS,PROGRESS} from '../seven-wonders-duel/catalog.js';
const root=new URL('../seven-wonders-duel/',import.meta.url),ref=JSON.parse(fs.readFileSync(new URL('reference-data.json',root))),provenance=JSON.parse(fs.readFileSync(new URL('provenance.json',root)));
function normalized(c){c=structuredClone(c);c.name=c.name.toLowerCase().replaceAll('-','');for(const k of ['choice','discount'])c[k]?.sort();return c;}
for(const [key,data] of [['cards',CARDS],['wonders',WONDERS]])for(const [id,expected] of Object.entries(ref[key]))assert.deepEqual(normalized(data[id]),normalized(expected),`${key}/${id}`);
assert.deepEqual([Object.keys(CARDS).length,Object.keys(WONDERS).length,Object.keys(PROGRESS).length],[73,12,10]);
// The second reference independently encodes all costs, printed points, science,
// production and chains. Any discrepancy fails the audit.
const cpp=JSON.parse(fs.readFileSync(new URL('indjev-reference.json',root)));let differences=[];
for(const entry of cpp.entries){const actual=entry.kind==='cards'?CARDS[entry.id]:entry.kind==='wonders'?WONDERS[entry.id]:PROGRESS[entry.id];for(const [field,v] of Object.entries(entry.facts))try{assert.deepEqual(actual[field],v);}catch{differences.push(`${entry.id}.${field}`);}}
assert.deepEqual(differences,[]);assert.equal(cpp.entries.length,95);
for(const arg of process.argv.slice(2)){const [flag,file]=arg.split('=');if(!['--bga','--cpp','--rules'].includes(flag))throw Error('Use --bga=Material.php --cpp=objects.cpp --rules=rules.pdf');const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');assert.equal(hash,provenance.sources[flag.slice(2)].sha256,`Pinned ${flag} source bytes`);}
console.log('Audited 73 buildings/guilds, 12 wonders, 10 progress tokens; full BGA facts match. Second-reference facts agree across all95 components. Publisher appendix/FAQ and effect provenance: seven-wonders-duel/provenance.json.');
