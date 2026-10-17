import {installSearchWorker} from '../shared/search-worker.js';
import {createSearch,runSearch,summary} from './ai.js';
let generation=0;
installSearchWorker({create:d=>{generation=d.generation;return createSearch(d.state,{width:d.width??2,maxDepth:Infinity});},run:(s,n)=>{runSearch(s,n);if(s.complete&&!s.reportedComplete){s.reportedComplete=true;globalThis.onmessage({data:{type:'pause',generation}});}},summarize:summary,batchSize:()=>64});
