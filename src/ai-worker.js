import {createSearch, runSearch, searchSummary} from "./mcts.js";
import {seededRandom} from "./azul.js";

// Independent trees in separate Web Workers; cancel/restart at batch boundaries.
let running = false, generation = 0, search = null, started = 0, lastReport = 0;
let batchSize = 10;
function report() {
  if (!search) return;
  self.postMessage({
    type: "progress", generation, elapsedMs: performance.now() - started,
    ...searchSummary(search)
  });
}
function tick() {
  if (!running) return;
  try {
    runSearch(search, batchSize);
    if (performance.now() - lastReport >= 450) {
      report();
      lastReport = performance.now();
    }
  } catch (error) {
    running = false;
    self.postMessage({type: "error", generation, message: error.message});
    return;
  }
  setTimeout(tick, 0);
}
self.onmessage = event => {
  const data = event.data;
  if (data.type === "stop") {
    running = false; generation = data.generation ?? generation;
    return;
  }
  if (data.type === "snapshot") { report(); return; }
  if (data.type !== "start") return;
  running = false;
  generation = data.generation;
  search = createSearch(data.state, {
    rng: seededRandom(data.seed),
    exploration: data.exploration ?? 1.3,
    maxNodes: data.maxNodes ?? 18000
  });
  batchSize = Math.max(1, Math.min(30, data.batch ?? 10));
  started = performance.now();
  lastReport = 0;
  running = true;
  tick();
};
