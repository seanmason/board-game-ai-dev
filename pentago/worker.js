import {createSearch, runSearch, searchSummary, advanceSearch} from './ai.js';
import {seededRandom} from './core.js';
import {installSearchWorker} from '../shared/search-worker.js';

const create = (data, rng = seededRandom(data.seed)) => createSearch(data.state, {
  rng, maxNodes: data.maxNodes ?? 14000, rolloutLength: data.rolloutLength ?? 10
});
installSearchWorker({
  create, run: runSearch, summarize: searchSummary,
  batchSize: data => data.batch ?? 3,
  advance(search, data) {
    const result = search && advanceSearch(search, data.action, data.state);
    const reused = !!result?.reused;
    return {
      search: reused ? search : create(data, search?.rng ?? seededRandom(data.seed)),
      metadata: {reused, retainedVisits: reused ? result.retainedVisits : 0,
        retainedNodes: reused ? result.retainedNodes : 0}
    };
  }
}, {reportEveryMs: 500});
