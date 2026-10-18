import {installSearchWorker} from '../shared/search-worker.js';
import {createSearch,runSearch,summary} from './ai.js';
installSearchWorker({create:d=>createSearch(d.observation,{seed:d.seed,actions:d.actions,horizon:d.horizon??4}),run:runSearch,summarize:summary,batchSize:()=>1});
