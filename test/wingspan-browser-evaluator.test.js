import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('browser worker uses promoted evaluator while retaining explicit research overrides',()=>{
 const calls=[],messages=[];
 const source=readFileSync(new URL('../wingspan/worker.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const context={self:{postMessage:m=>messages.push(m)},performance:{now:()=>0},setTimeout:()=>0,clearTimeout:()=>{},seededRandom:()=>()=>.5,createSearch:(o,a,options)=>{calls.push(options);return {};},runSearch:()=>{},searchSummary:()=>({})};
 vm.runInNewContext(source,context);
 context.self.onmessage({data:{type:'start',generation:1,observation:{},actions:[],running:false}});
 assert.equal(calls[0].leafEvaluator,'practical-combined');assert.equal(calls[0].horizon,4);
 context.self.onmessage({data:{type:'start',generation:2,observation:{},actions:[],running:false,leafEvaluator:'current',horizon:6}});
 assert.equal(calls[1].leafEvaluator,'current');assert.equal(calls[1].horizon,6);
 assert.equal(messages.length,2);
});
