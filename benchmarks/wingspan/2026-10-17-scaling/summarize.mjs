import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const dir=process.argv[2];
if(!dir)throw Error('Pass the runtime directory');
const manifest=JSON.parse(readFileSync(resolve(dir,'manifest.json'),'utf8'));
const checkpoint=JSON.parse(readFileSync(resolve(dir,'checkpoint.json'),'utf8'));
const results=checkpoint.results.slice().sort((a,b)=>a.id.localeCompare(b.id));
assert.equal(results.length,168);assert.equal(new Set(results.map(r=>r.id)).size,168);
assert.deepEqual(results.map(r=>r.id).sort(),manifest.tasks.map(t=>t.id).sort());
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const interval=a=>{const m=mean(a),sd=Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)),half=2.201*sd/Math.sqrt(a.length);return [m-half,m+half];};
const groups=[];
for(const [key,rows] of Map.groupBy(results,r=>`${r.budget}/${r.opponent}/${r.opponentBudget}`)){
  const valid=rows.filter(r=>r.status==='complete');
  const pairs=[...Map.groupBy(valid,r=>r.seed)].filter(([,r])=>r.length===2).map(([seed,r])=>({seed,margin:mean(r.map(x=>x.margin)),winShare:mean(r.map(x=>x.winShare))}));
  groups.push({key,games:rows.length,complete:valid.length,failed:rows.filter(r=>r.status==='failed').length,capped:rows.filter(r=>r.status==='capped').length,
    wins:valid.filter(r=>r.winShare===1).length,draws:valid.filter(r=>r.winShare===0.5).length,losses:valid.filter(r=>r.winShare===0).length,
    meanMargin:mean(valid.map(r=>r.margin)),pairedMarginCI95:pairs.length===12?interval(pairs.map(p=>p.margin)):null,
    meanGameSeconds:mean(valid.map(r=>r.elapsedMs/1000)),maxGameSeconds:Math.max(...valid.map(r=>r.elapsedMs/1000)),
    unvisitedFraction:valid.reduce((s,r)=>s+r.unvisited,0)/valid.reduce((s,r)=>s+r.alternatives,0),
    candidateStarterWinShare:mean(valid.filter(r=>r.seat===r.seed%2).map(r=>r.winShare)),
    candidateNonstarterWinShare:mean(valid.filter(r=>r.seat!==r.seed%2).map(r=>r.winShare)),pairs});
}
const output={manifest,startedAt:checkpoint.startedAt,finishedAt:checkpoint.updatedAt,
  wallSeconds:(Date.parse(checkpoint.updatedAt)-Date.parse(checkpoint.startedAt))/1000,workers:checkpoint.workers,groups,results};
writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({...output,manifest:undefined,results:undefined,groups:groups.map(({pairs,...g})=>g)},null,2));
