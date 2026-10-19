/** External focused tests only. Never imports/starts a game worker or plays a game. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {CONTROL,RUNTIME,read,write,tasks,assertExecutionAllowed} from './support.mjs';
export async function runTests(plan,{provisional=true}={}){
 const {compileModel,predictFeatures,predictObservation}=await import(pathToFileURL(resolve(plan.sourceRoot,'scripts/wingspan-neural/inference.mjs')));
 const {publicObservation}=await import(pathToFileURL(resolve(plan.sourceRoot,'wingspan/core.js')));
 const {diagnosticPositions}=await import(pathToFileURL(resolve(plan.sourceRoot,'scripts/wingspan-study/fixtures.mjs')));
 const realJSON=read(resolve(CONTROL,plan.modelFiles.neural)),zeroJSON=read(resolve(CONTROL,plan.modelFiles.linear));
 const real=compileModel(realJSON),zero=compileModel(zeroJSON),checks=[];
 const check=(name,fn)=>{fn();checks.push({name,passed:true});};
 check('same architecture, encoder schema, normalization and real hidden layers',()=>{
  assert.deepEqual(realJSON.featureNames,zeroJSON.featureNames);assert.equal(realJSON.featureVersion,zeroJSON.featureVersion);
  assert.deepEqual(realJSON.normalization,zeroJSON.normalization);assert.equal(realJSON.valueScale,zeroJSON.valueScale);
  assert.equal(realJSON.layers.length,zeroJSON.layers.length);assert.equal(real.parameterCount,zero.parameterCount);
  realJSON.layers.forEach((l,i)=>{const z=zeroJSON.layers[i];assert.equal(l.in,z.in);assert.equal(l.out,z.out);assert.equal(l.activation,z.activation);if(i<realJSON.layers.length-1)assert.deepEqual(l,z);});
 });
 check('only final scalar head is zero and no trained ridge is mislabeled',()=>{
  const h=zeroJSON.layers.at(-1);assert.equal(h.out,1);assert.equal(h.activation,'linear');assert.ok(h.weights.every(x=>x===0));assert.ok(h.bias.every(x=>x===0));
  assert.equal(zeroJSON.metadata.trainedRidge,false);assert.equal(zeroJSON.metadata.realModelSha256,plan.modelHashes.neural);
  assert.ok(realJSON.layers.at(-1).weights.some(x=>x!==0));
 });
 const parity=read(resolve(RUNTIME,'training/parity.json'));
 check('exact zero for all certified development cases and bounded artificial vectors',()=>{
  assert.ok(parity.models.mlp.length>=30);
  for(const c of parity.models.mlp){assert.equal(predictFeatures(zero,c.features),0);assert.ok(Math.abs(predictFeatures(real,c.features)-c.expectedMargin)<=.001);}
  for(const value of [0,1,-1,100,-100])assert.equal(predictFeatures(zero,Array(real.inputSize).fill(value)),0);
 });
 function reward({r0,r1,n0,n1,rootEligible=true,leafEligible=true,prior=3}){
  const before=rootEligible?.5*r0+.5*n0:r0,after=rootEligible&&leafEligible?.5*r1+.5*n1:r1;
  return .82*(after-before)+.18*prior;
 }
 check('constant nonterminal blend halves only reference delta while retaining prior',()=>{
  for(const c of [-20,0,17])assert.ok(Math.abs(reward({r0:10,r1:14,n0:c,n1:c})-(.41*(14-10)+.18*3))<1e-12);
 });
 check('setup/power root fallback stays full-reference and terminal score is not halved',()=>{
  assert.ok(Math.abs(reward({r0:10,r1:14,n0:88,n1:99,rootEligible:false})-(.82*4+.18*3))<1e-12);
  const terminal=reward({r0:10,r1:14,n0:0,n1:0,leafEligible:false});
  assert.ok(Math.abs(terminal-(.82*(14-.5*10)+.18*3))<1e-12);
  assert.notEqual(terminal,.41*(14-10)+.18*3);
 });
 check('exact fixed inventory and labels; no promotion or implicit execution',()=>{
  const ts=tasks();assert.deepEqual(ts,plan.tasks);assert.equal(ts.length,64);assert.equal(new Set(ts.map(t=>t.seed)).size,32);
  for(const seed of new Set(ts.map(t=>t.seed)))assert.deepEqual(ts.filter(t=>t.seed===seed).map(t=>t.seat),[0,1]);
  assert.ok(ts.every(t=>t.candidate.method==='neural'&&t.opponent.method==='linear'&&t.opponent.modelRole.includes('zero-output-mlp')&&t.candidate.blend===.5&&t.opponent.blend===.5&&t.candidate.timeMs===1000&&t.opponent.timeMs===1000));
  assert.throws(()=>assertExecutionAllowed({approved:false,pilotResult:{status:'finished'},progress:{status:'finished'}}),/Explicit coordinator/);
  assert.throws(()=>assertExecutionAllowed({approved:true,pilotResult:null,progress:{status:'running'}}),/not completed/);
  assert.throws(()=>assertExecutionAllowed({approved:true,pilotResult:{status:'finished'},progress:{status:'finished'},receiptExists:true}),/already exists/);
  assert.doesNotThrow(()=>assertExecutionAllowed({approved:true,pilotResult:{status:'finished'},progress:{status:'finished'},receiptExists:false}));
 });
 const fixtures=diagnosticPositions().map(f=>({observation:publicObservation(f.state,0),viewer:0}));
 for(let pass=0;pass<3;pass++)for(const f of fixtures){predictObservation(real,f.observation,f.viewer);assert.equal(predictObservation(zero,f.observation,f.viewer),0);}
 const times={real:[],zero:[]};
 const repeats=provisional?5:20;
 for(let pass=0;pass<repeats;pass++)for(const f of fixtures){
  for(const [key,model]of pass%2?[['zero',zero],['real',real]]:[['real',real],['zero',zero]]){
   const a=performance.now();const value=predictObservation(model,f.observation,f.viewer);times[key].push(performance.now()-a);if(key==='zero')assert.equal(value,0);
  }
 }
 const stats=a=>{const sorted=[...a].sort((x,y)=>x-y);return {n:a.length,meanMs:a.reduce((x,y)=>x+y)/a.length,p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1)};};
 const timing={real:stats(times.real),zero:stats(times.zero),provisionalUnderActivePilot:provisional,
  operationCounts:{parameters:real.parameterCount,multiplyAddsPerLayer:realJSON.layers.map(l=>l.in*l.out),sameEncoder:true,sameNormalization:true,sameRealHiddenWeights:true,noZeroFastPath:true}};
 timing.zeroRealMeanRatio=timing.zero.meanMs/timing.real.meanMs;timing.zeroRealP95Ratio=timing.zero.p95Ms/timing.real.p95Ms;
 check('bounded same-shape forward timing sanity (not a strength or selection gate)',()=>{
  assert.ok(timing.real.p95Ms<20&&timing.zero.p95Ms<20);
  if(!provisional)assert.ok(timing.zeroRealMeanRatio>=.5&&timing.zeroRealMeanRatio<=2,'unexpected operation/timing mismatch; stop, do not tune using outcomes');
 });
 const result={purpose:'Focused synthetic deterministic inference/algebra/readiness tests, plus bounded fixed-position timing; NO games launched.',passed:true,createdAt:new Date().toISOString(),checks,exactZeroCases:parity.models.mlp.length+5,timing,
  interpretation:'Dense operation counts and all hidden computations are identical; head output is the only manipulated value. Provisional under-load timing is not evidence about playing strength.'};
 write(resolve(CONTROL,provisional?'tests-preparation.json':'tests-execution.json'),result);console.log(JSON.stringify({testsPassed:checks.length,exactZeroCases:result.exactZeroCases,timing}));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await runTests(read(resolve(CONTROL,'plan.json')),{provisional:true});
