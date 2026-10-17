import {createSearch, advanceSearch, runSearch, searchSummary} from './mcts.js';
import {seededRandom} from './azul.js';
import {installSearchWorker} from '../shared/search-worker.js';

const create = (data, rng = seededRandom(data.seed)) => createSearch(data.state, {
  rng, exploration: data.exploration, maxNodes: data.maxNodes ?? 18000,
  variant: data.variant ?? 'guided-informed'
});
installSearchWorker({
  create, run: runSearch, summarize: searchSummary,
  batchSize: data => Math.min(30, data.batch ?? 10),
  advance(search, data) {
    const result = search && search.variant === (data.variant ?? 'guided-informed') &&
      advanceSearch(search, data.action, data.state);
    const reused = !!result?.reused;
    return {
      search: reused ? search : create(data, search?.rng ?? seededRandom(data.seed)),
      metadata: {wasReused: reused, retainedVisits: reused ? result.retainedVisits : 0,
        retainedNodes: reused ? result.retainedNodes : 0}
    };
  }
});
