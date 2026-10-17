/** Game-independent worker lifecycle. Rules, beliefs and ranking stay in adapters. */
export function installSearchWorker(adapter, {
  scope = globalThis,
  now = () => performance.now(),
  schedule = fn => setTimeout(fn, 0),
  cancel = id => clearTimeout(id),
  reportEveryMs = 450,
  sliceMs = 12
} = {}) {
  let generation = 0, search = null, running = false, timer = null;
  let activeFrom = 0, activeMs = 0, reportedAt = 0, batch = 1;
  let metadata = {};
  const elapsed = () => activeMs + (running ? now() - activeFrom : 0);
  function halt() {
    if (running) activeMs += now() - activeFrom;
    running = false;
    if (timer !== null) cancel(timer);
    timer = null;
  }
  function report() {
    if (!search) return;
    scope.postMessage({
      ...adapter.summarize(search), ...metadata,
      type: 'progress', generation, elapsedMs: elapsed(), paused: !running
    });
  }
  function fail(error) {
    halt();
    // A failed transition or partially completed simulation cannot be resumed.
    search = null;
    scope.postMessage({type: 'error', generation, message: String(error?.message ?? error)});
  }
  function tick() {
    if (!running || timer !== null) return;
    timer = schedule(() => {
      timer = null;
      if (!running) return;
      try {
        const started = now();
        // Yield between iterations so slow games do not multiply pause latency
        // by an entire batch. A single engine iteration is still synchronous.
        for (let i = 0; i < batch; i++) {
          adapter.run(search, 1);
          if (now() - started >= sliceMs) break;
        }
        if (now() - reportedAt >= reportEveryMs) {
          report();
          reportedAt = now();
        }
        tick();
      } catch (error) { fail(error); }
    });
  }
  function resume() {
    if (!search || running) return;
    running = true;
    activeFrom = now();
    reportedAt = now();
    report();
    tick();
  }
  scope.onmessage = ({data}) => {
    if (!data || typeof data !== 'object') return;
    try {
      if (data.type === 'start') {
        halt();
        search = null;
        generation = data.generation;
        activeMs = 0;
        metadata = {};
        const requested = adapter.batchSize?.(data) ?? 1;
        batch = Number.isFinite(requested) ? Math.max(1, Math.min(250, Math.floor(requested))) : 1;
        search = adapter.create(data);
        if (data.running !== false) resume(); else report();
      } else if (data.type === 'advance') {
        if (data.previousGeneration !== generation || !adapter.advance) return;
        halt();
        generation = data.generation;
        const next = adapter.advance(search, data);
        search = next.search;
        metadata = next.metadata ?? {};
        activeMs = 0;
        if (data.running) resume(); else report();
      } else if (data.generation === generation) {
        if (data.type === 'pause') { halt(); report(); }
        else if (data.type === 'resume') resume();
        else if (data.type === 'stop') { halt(); search = null; }
        else if (data.type === 'snapshot') report();
      }
    } catch (error) { fail(error); }
  };
  return {dispose() { halt(); search = null; scope.onmessage = null; }};
}
