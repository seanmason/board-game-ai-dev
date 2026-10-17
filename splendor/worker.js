import {installSearchWorker} from '../shared/search-worker.js';
import {createSearch,runSearch,summary} from './ai.js';
installSearchWorker({create:d=>createSearch(d.observation,{seed:d.seed,horizon:d.horizon??12}),run:runSearch,summarize:summary,batchSize:()=>8});
