import {readFileSync,existsSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {diagnosticPositions} from '../wingspan-study/fixtures.mjs';
import {publicObservation} from '../../wingspan/core.js';
import {compileModel,createZeroModel,predictFeatures,predictObservation} from './inference.mjs';
import {chooseAction} from './game.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export function checkPreflight({modelsDir,out}={}){
 const modelPath=modelsDir&&resolve(modelsDir,'model.json'),hasModel=modelPath&&existsSync(modelPath);
 const json=hasModel?read(modelPath):createZeroModel(),model=compileModel(json),zero=compileModel(createZeroModel({normalization:json.normalization}));
 const parity=hasModel?read(resolve(modelsDir,'parity.json')):null,errors=[];
 if(parity){if(!parity.passed||!Array.isArray(parity.cases)||parity.cases.length<1)throw Error('Missing certified export cases');
  for(const c of parity.cases){const actual=predictFeatures(model,c.features);if(!Number.isFinite(c.expected)||Math.abs(actual-c.expected)>.0002||Math.abs(actual-c.torchExpected)>.0002)throw Error('Actual JS/Python/Torch parity failure');}}
 const times=[],positions=diagnosticPositions();
 for(const fixture of positions){const o=publicObservation(fixture.state,0);for(let i=0;i<3;i++)predictObservation(model,o,0);for(let i=0;i<5;i++){const start=performance.now();predictObservation(model,o,0);times.push(performance.now()-start);}}
 // No learned randomness; zero head preserves full root allocation and scores.
 for(const {state,id}of positions.filter((_,i)=>i%6===0)){
  const a=chooseAction(state,{method:'reference',budget:100},{seed:90210});
  const b=chooseAction(state,{method:'residual',modelId:'zero',budget:100},{seed:90210,models:{zero}});
  const roots=x=>x.summary.candidates.map(c=>({action:c.action,visits:c.visits,sum:c.sum,variance:c.variance}));
  if(JSON.stringify(roots(a))!==JSON.stringify(roots(b))||JSON.stringify(a.action)!==JSON.stringify(b.action))errors.push('Zero residual changes '+id);
 }
 times.sort((a,b)=>a-b);const p95=times[Math.ceil(.95*times.length)-1];if(p95>20)errors.push('Encoding+inference p95 above20ms');
 const result={schema:1,status:errors.length?'failed':'passed',passed:!errors.length,at:new Date().toISOString(),modelSha256:hasModel?sha(modelPath):null,
  featureVersion:model.featureVersion,parameters:model.parameterCount,parityCases:parity?.cases.length??0,zeroIdentityFixtures:4,inference:{meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:p95,maxMs:times.at(-1)},errors,realIPadSafari:false};
 if(out){mkdirSync(out,{recursive:true});const path=resolve(out,'preflight.json');writeFileSync(path+'.tmp',JSON.stringify(result,null,2)+'\n');renameSync(path+'.tmp',path);}
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));const r=checkPreflight({modelsDir:args.models,out:args.out});console.log(JSON.stringify(r));if(!r.passed)process.exitCode=1;}
