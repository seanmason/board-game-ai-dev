import {installSearchWorker} from '../shared/search-worker.js';
import {createSearch,runSearch,summary} from './ai.js';
export function workerAdapter(scope=globalThis){
 let generation=0;
 return {
  create(data){generation=data.generation;return createSearch(data.state,{width:data.width??2,maxDepth:Infinity});},
  run(search,count){runSearch(search,count);if(search.complete)scope.onmessage({data:{type:'pause',generation}});},
  summarize:summary,
  batchSize:()=>64
 };
}
if(typeof globalThis.postMessage==='function')installSearchWorker(workerAdapter());
