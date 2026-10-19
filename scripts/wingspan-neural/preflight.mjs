import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {compileModel,predictFeatures,predictObservation} from './inference.mjs';
import {diagnosticPositions} from '../wingspan-study/fixtures.mjs';
import {publicObservation} from '../../wingspan/core.js';
import {atomic,read,hash} from './common.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
if(!args.models||!args.out)throw Error('Use --models=DIR --out=DIR');const dir=resolve(args.models),out=resolve(args.out);mkdirSync(out,{recursive:true});
const parity=read(resolve(dir,'parity.json')),results={};
if(parity.fixtureSplit!=='dev-only'||!Number.isFinite(parity.maxTorchVsScalarDifferencePoints)||parity.maxTorchVsScalarDifferencePoints>.001)throw Error('Uncertified development-only export parity');
for(const[key,file]of [['mlp','mlp.json'],['linear','linear.json']]){
 const bytes=readFileSync(resolve(dir,file)),model=compileModel(JSON.parse(bytes)),cases=parity.models[key];
 if(!Array.isArray(cases)||cases.length<30)throw Error('Incomplete exported parity inventory');
 for(const round of [1,2,3,4])for(const viewer of [0,1])if(!cases.some(c=>c.round===round&&c.viewer===viewer))throw Error('Parity omits a round/viewer combination');
 const rows=cases.map(c=>{const actual=predictFeatures(model,c.features),expected=c.expectedMargin;
  if(!Number.isFinite(expected))throw Error('Parity case has no point prediction');const error=Math.abs(actual-expected);if(error>.001)throw Error('Python/JS parity failed: '+error);return {error,actual,expected};});
 const times=[];for(const f of diagnosticPositions()){const s=f.state,viewer=s.phase==='power'?s.pending[0].owner:s.currentPlayer,o=publicObservation(s,viewer);for(let i=0;i<3;i++)predictObservation(model,o,viewer);for(let i=0;i<10;i++){const a=performance.now();predictObservation(model,o,viewer);times.push(performance.now()-a);}}
 times.sort((a,b)=>a-b);if(times[Math.ceil(times.length*.95)-1]>20)throw Error('Inference exceeds predeclared20ms p95 gate');results[key]={sha256:hash(bytes),parameterCount:model.parameterCount,parityCases:rows.length,maxParityError:Math.max(...rows.map(r=>r.error)),inferenceIncludingEncoding:{n:times.length,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:times[Math.ceil(times.length*.95)-1]},passed:true};
}
atomic(resolve(out,'preflight.json'),{status:'passed',createdAt:new Date().toISOString(),tolerancePoints:.001,results});console.log(JSON.stringify(results));
