import {installSearchWorker} from '../shared/search-worker.js';
import {createSearch,runSearch,summary} from './ai.js';
installSearchWorker({create:d=>createSearch(d.observation,{seed:d.seed,depth:d.depth??2,beam:d.beam??7}),run:runSearch,summarize:summary,batchSize:()=>1});
