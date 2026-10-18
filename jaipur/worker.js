import {installSearchWorker} from '../shared/search-worker.js';
import {createSearch,runSearch,summarizeSearch} from './ai.js';
installSearchWorker({create:createSearch,run:runSearch,summarize:summarizeSearch,batchSize:()=>1});
