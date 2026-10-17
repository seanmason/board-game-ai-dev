import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {REGULAR,orientations} from '../patchwork/catalog.js';
const sources=[
 {name:'Lagerkvist research',revision:'53fc6e7ed2acad800b6ac6a7c5c122f13270dbb4',url:'https://raw.githubusercontent.com/zayenz/cp-mod-ref-2019-patchwork/53fc6e7ed2acad800b6ac6a7c5c122f13270dbb4/code/src/patchwork/tiles.cpp',expectedDifferences:[4]},
 {name:'Zeitz independent implementation',revision:'68fa707bdc2bc7c695f9a9c7dd133a649a30ddd3',url:'https://raw.githubusercontent.com/NicoZeitz/Studienarbeit/68fa707bdc2bc7c695f9a9c7dd133a649a30ddd3/code/patchwork/patchwork-core/src/patch/patch_manager.rs',expectedDifferences:[28]}
];
const canonical=c=>orientations(c).map(JSON.stringify).sort()[0];
function parseResearch(text){const body=text.split('const std::vector<TileSource> base_tiles =')[1]?.split('class TileSources')[0];assert(body,'Missing research catalog');const out=[];for(const m of body.matchAll(/\{(\d+),\s*(\d+), (\d+), (\d+),\s*(\d+), (\d+), (\d+),\s*((?:"[ X]+"\s*)+)\}/g)){const [id,w,h,,cost,time,income]=m.slice(1,8).map(Number),pattern=[...m[8].matchAll(/"([ X]+)"/g)].map(x=>x[1]).join('');assert.equal(pattern.length,w*h);if(id)out.push({id,cost,time,income,cells:[...pattern].flatMap((c,i)=>c==='X'?[[i%w,Math.floor(i/w)]]:[])});}return out;}
function parseRust(text){const out=[];for(const m of text.matchAll(/patch\(\s*id: (\d+),\s*button_cost: (\d+),\s*time_cost: (\d+),\s*button_income: (\d+),\s*tiles:\s*\[([\s\S]*?)\]\s*\)/g)){const [id,cost,time,income]=m.slice(1,5).map(Number);if(id>=33)continue;const rows=JSON.parse(`[${m[5]}]`.replace(/,\s*]/g,']'));out.push({id,cost,time,income,cells:rows.flatMap((r,y)=>r.flatMap((v,x)=>v?[[x,y]]:[]))});}return out;}
const results=[];
for(let i=0;i<sources.length;i++){
 const source=sources[i],file=process.argv[i+2];let content;
 if(file)content=await readFile(file,'utf8');else {const response=await fetch(source.url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`${source.name}: HTTP ${response.status}`);content=await response.text();}
 const patches=(i?parseRust:parseResearch)(content);assert.equal(patches.length,33);
 const differences=REGULAR.filter(p=>!patches.some(q=>p.cost===q.cost&&p.time===q.time&&p.income===q.income&&canonical(p.cells)===canonical(q.cells))).map(p=>p.id);
 assert.deepEqual(differences,source.expectedDifferences,`${source.name} must differ only by the photograph-resolved component error`);
 results.push({source:source.name,revision:source.revision,components:33,matching:33-differences.length,photographResolvedDifferences:differences});
}
assert.equal(REGULAR.reduce((n,p)=>n+p.area,0),166);assert.equal(REGULAR.find(p=>p.id===4).area,4);assert.equal(REGULAR.find(p=>p.id===28).area,8);
console.log(JSON.stringify({game:'patchwork',regularSquares:166,results,photographicResolution:'Local #4 is a solid 2×2 square; local #28 is the eight-square H. Details and primary physical photo links: docs/PATCHWORK.md.'},null,2));
