/** Outcome-blind timing on the fixed diagnostic bank; never selects methods. */
import {performance} from 'node:perf_hooks';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {setPriority,constants} from 'node:os';
import {diagnosticPositions} from './fixtures.mjs';
import {chooseAction} from './game.mjs';
import {sourceHashes} from './run.mjs';
import {evaluateStudyLeaf,METHODS} from './evaluators.mjs';
const output=process.argv.find(a=>a.startsWith('--out='))?.slice(6);if(!output)throw Error('Use --out=DIR');
setPriority(0,constants.priority.PRIORITY_BELOW_NORMAL);
const positions=diagnosticPositions(),rows=[],profiles={};
for(const method of METHODS){const at=performance.now();for(let repeat=0;repeat<3;repeat++)for(const f of positions)evaluateStudyLeaf(f.state,0,method);profiles[method]=(performance.now()-at)/(3*positions.length);}
for(const [i,f]of positions.entries()){
 const r=chooseAction(f.state,{method:'reference',budget:300,horizon:4,pipeline:'study'},{seed:7000000+i,rolloutStepLimit:192});
 const d=r.summary.diagnostics;if(r.unvisited||d.safetyCapCount||d.unsettledLeaves)throw Error('Diagnostic search failed: '+f.id);
 rows.push({id:f.id,elapsedMs:r.elapsedMs,generationMs:r.generationMs,roots:r.roots,iterations:r.iterations,unvisited:r.unvisited,diagnostics:d});
 console.log(f.id,Math.round(r.elapsedMs)+'ms',r.iterations+' samples');
}
const times=rows.map(r=>r.elapsedMs).sort((a,b)=>a-b),middle=(times[(times.length-1)>>1]+times[times.length>>1])/2;
const result={purpose:'Fixed diagnostic timing only; no game outcomes used for selection or tuning',createdAt:new Date().toISOString(),timeBudgetMs:Math.max(1,Math.ceil(middle)),leafMs:profiles,rows,sourceHashes:sourceHashes()};
mkdirSync(resolve(output),{recursive:true});writeFileSync(resolve(output,'calibration.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({timeBudgetMs:result.timeBudgetMs,leafMs:profiles}));
