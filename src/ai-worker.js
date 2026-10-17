import {createSearch, advanceSearch, runSearch, searchSummary} from "./mcts.js";
import {seededRandom} from "./azul.js";

// A live worker owns one MCTS tree and PRNG. Pause does not destroy either.
// Workers are only terminated by the coordinator on a changed position or
// worker configuration, or when the browser discards the tab.
let generation = 0, search = null, running = false, scheduled = null;
let activeStarted = 0, activeMillis = 0, lastReport = 0, batchSize = 10;
let retainedVisits = 0, retainedNodes = 0, wasReused = false;
const now = () => performance.now();
const elapsed = () => activeMillis + (running ? now() - activeStarted : 0);

function report() {
  if (!search) return;
  self.postMessage({
    type:"progress", generation, elapsedMs:elapsed(), paused:!running,
    retainedVisits, retainedNodes, wasReused,
    ...searchSummary(search)
  });
}
function cancelScheduled() {
  if (scheduled !== null) clearTimeout(scheduled);
  scheduled = null;
}
function stop() {
  if (running) activeMillis += now() - activeStarted;
  running = false;
  cancelScheduled();
  search = null;
}
function tick() {
  if (!running || scheduled !== null) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    if (!running) return;
    try {
      runSearch(search, batchSize);
    } catch (error) {
      if (running) activeMillis += now() - activeStarted;
      running = false;
      self.postMessage({type:"error",generation,message:error.message});
      return;
    }
    const at = now();
    if (at - lastReport >= 450) { report(); lastReport = at; }
    tick();
  }, 0);
}
function pause() {
  if (running) activeMillis += now() - activeStarted;
  running = false;
  cancelScheduled();
  // Send the exact final counters for the paused tree; they never reset.
  report();
}
function resume() {
  if (!search || running) return;
  activeStarted = now();
  running = true;
  lastReport = now();
  report();
  tick();
}
self.onmessage = event => {
  const data = event.data;
  if (data.type === "start") {
    stop();
    generation = data.generation;
    search = createSearch(data.state, {
      rng:seededRandom(data.seed),
      exploration:data.exploration,
      maxNodes:data.maxNodes ?? 18000,
      variant:data.variant ?? "guided-informed"
    });
    batchSize = Math.max(1, Math.min(30, data.batch ?? 10));
    activeMillis = 0;
    retainedVisits = 0; retainedNodes = 0; wasReused = false;
    resume();
    return;
  }
  // A real move changes the search root without terminating the worker.
  // Each worker independently falls back to a fresh tree if its chosen
  // child was never explored. Paused searches remain paused across moves.
  if (data.type === "advance") {
    if (data.previousGeneration !== generation) return;
    pause();
    const previousRng = search?.rng ?? seededRandom(data.seed);
    const transition = search &&
      search.variant === data.variant &&
      advanceSearch(search, data.action, data.state);
    generation = data.generation;
    wasReused = !!transition?.reused;
    retainedVisits = wasReused ? transition.retainedVisits : 0;
    retainedNodes = wasReused ? transition.retainedNodes : 0;
    if (!wasReused) {
      search = createSearch(data.state, {
        rng: previousRng,
        variant: data.variant ?? "guided-informed",
        exploration: data.exploration,
        maxNodes: data.maxNodes ?? 18000
      });
    }
    activeMillis = 0;
    if (data.running) resume();
    else report();
    return;
  }
  if (data.generation !== generation) return;
  if (data.type === "stop") stop();
  else if (data.type === "pause") pause();
  else if (data.type === "resume") resume();
  else if (data.type === "snapshot") report();
};
