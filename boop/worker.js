import {createSearch,runSearch,searchSummary,advanceSearch} from './ai.js';
import {seededRandom} from './core.js';
import {installSearchWorker} from '../shared/search-worker.js';
const create=(data,rng=seededRandom(data.seed))=>createSearch(data.state,{rng,method:data.method,maxNodes:10000,rolloutLength:8});
installSearchWorker({create,run:runSearch,summarize:searchSummary,batchSize:()=>3,
  advance(search,data){const reused=search&&advanceSearch(search,data.action,data.state);return{search:reused?.reused?search:create(data,search?.rng),metadata:reused??{reused:false}};}
});
