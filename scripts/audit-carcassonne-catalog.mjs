import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {TILE_LIST,SOURCE_MANIFEST} from '../carcassonne/catalog.js';
// Offline checks always run; --fetch re-downloads publisher evidence, verifies
// exact PDF bytes and text-extracts all 24 printed inventory multiplicities.
assert.equal(TILE_LIST.reduce((n,t)=>n+t.count,0),72);
assert.deepEqual(TILE_LIST.map(t=>t.id),'ABCDEFGHIJKLMNOPQRSTUVWX'.split(''));
const count=[2,4,1,4,5,2,1,3,2,3,3,3,2,3,2,3,1,3,2,1,8,9,4,1];
assert.deepEqual(TILE_LIST.map(t=>t.count),count);
for(const t of TILE_LIST){for(const f of t.features){assert.equal(new Set(f.ports).size,f.ports.length);if(f.type==='field')for(const c of f.cities)assert.equal(t.features[c].type,'city');}for(let d=0;d<4;d++){assert.equal(t.features.filter(f=>(f.type==='road'||f.type==='city')&&f.ports.includes(d)).length,t.edges[d]==='F'?0:1);for(let half=0;half<2;half++)assert.equal(t.features.filter(f=>f.type==='field'&&f.ports.includes(d*2+half)).length,t.edges[d]==='C'?0:1);}}
const local=process.argv.find(x=>x.startsWith('--evidence='))?.slice(11);
if(process.argv.includes('--fetch')||local){const dir=await mkdtemp(join(tmpdir(),'carcassonne-audit-'));for(const name of ['rules','inventory','farmers']){const source=SOURCE_MANIFEST[name],data=local?await readFile(join(local,name+'.pdf')):Buffer.from(await(await fetch(source.url,{signal:AbortSignal.timeout(45000)})).arrayBuffer());assert.equal(createHash('sha256').update(data).digest('hex'),source.sha256,`${name} changed; review publisher revision`);const path=join(dir,name+'.pdf');await writeFile(path,data);if(name==='inventory'){execFileSync('pdftotext',['-f','22','-l','22','-layout',path,join(dir,'inventory.txt')]);const text=await readFile(join(dir,'inventory.txt'),'utf8');for(const t of TILE_LIST)assert.ok(new RegExp(`V3-${t.id}\\s+${t.count}\\s*×`).test(text),`Publisher multiplicity ${t.id}`);}}}
console.log('Carcassonne catalog: all 72 tiles, 24 types, boundary feature coverage and local field-city adjacency valid'+(process.argv.includes('--fetch')||local?'; pinned publisher PDFs and 24 printed counts verified.':'. Run --fetch to verify pinned publisher PDFs.'));
