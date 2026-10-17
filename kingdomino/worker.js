import {installSearchWorker} from '../shared/search-worker.js';
import {createSearch,runSearch,summary} from './ai.js';
installSearchWorker({create:d=>{const search=createSearch(d.observation,{seed:d.seed,horizon:d.horizon??6,beam:d.beam??12});if(search.solved)d.running=false;return search;},run:runSearch,summarize:summary,batchSize:()=>1});
