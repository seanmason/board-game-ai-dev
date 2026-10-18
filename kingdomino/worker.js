import {installSearchWorker} from '../shared/search-worker.js';
import {createSearch,runSearch,summary,recommendations} from './ai.js';
installSearchWorker({create:d=>{if(!d.experiment){d.running=false;return {recommendation:recommendations(d.observation)};}const search=createSearch(d.observation,{seed:d.seed,horizon:d.horizon??6,beam:d.beam??12});if(search.solved)d.running=false;return search;},run:(s,n)=>{if(!s.recommendation)runSearch(s,n);},summarize:s=>s.recommendation??summary(s),batchSize:()=>1});
