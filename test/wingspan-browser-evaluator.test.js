import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PRODUCTION_AI} from '../wingspan/production-ai.js';
test('browser worker uses promoted evaluator while retaining explicit research overrides',()=>{
 const calls=[],messages=[];
 const source=readFileSync(new URL('../wingspan/worker.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const context={PRODUCTION_AI,self:{postMessage:m=>messages.push(m)},performance:{now:()=>0},setTimeout:()=>0,clearTimeout:()=>{},seededRandom:()=>()=>.5,createSearch:(o,a,options)=>{calls.push(options);return {};},runSearch:()=>{},searchSummary:()=>({})};
 vm.runInNewContext(source,context);
 context.self.onmessage({data:{type:'start',generation:1,observation:{},actions:[],running:false}});
 assert.equal(calls[0].leafEvaluator,'opening-plan');assert.equal(calls[0].horizon,4);assert.equal(calls[0].method,'belief-rollout');
 context.self.onmessage({data:{type:'start',generation:2,observation:{},actions:[],running:false,leafEvaluator:'current',horizon:6}});
 assert.equal(calls[1].leafEvaluator,'current');assert.equal(calls[1].horizon,6);
 assert.equal(messages.length,2);
});

import {newGame,applyAction,assertValid} from '../wingspan/core.js';
import {observedCandidates} from '../wingspan/observations.js';
import {candidateActions} from '../wingspan/actions.js';
import {openingSetupActions} from '../wingspan/opening-strategy.js';
test('browser setup uses confirmed shortlist while research generator stays unchanged',()=>{
 const s=newGame({seed:17}),before=JSON.stringify(s),original=candidateActions(s),actual=observedCandidates(s);
 assert.equal(original.length,8);assert.equal(actual.length,24);
 assert.deepEqual(actual,openingSetupActions(s,original));
 for(const {action} of actual)assertValid(applyAction(s,action));
 assert.equal(JSON.stringify(s),before);
});
test('physical setup stays blocked until observed private cards are available',()=>{
 const s=newGame({seed:17,mode:'physical'});
 assert.deepEqual(observedCandidates(s),[]);
});
