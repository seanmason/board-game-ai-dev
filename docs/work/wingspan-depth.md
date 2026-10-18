# Wingspan rollout depth study

Status: completed 2026-10-17. All 72 games completed, zero failures/caps.
See the [results](../../benchmarks/wingspan/2026-10-17-depth/REPORT.md).
User requested multiple depths, parallel execution,
a live dashboard, and termination of the earlier 10,000-vs-300 run.

Frozen design: depths 4, 8, 12 and 16, full round robin, six paired fresh deals
per matchup, 12 games each, 72 games total. Both sides use 100 belief-rollout
samples per decision. Seeds `1168400 + 997*i`, i=0..5, alternate starting seats;
each seed is played with the deeper candidate in both seats. No outcome stopping.
The existing 48-step rollout safety cap remains in force, so the requested
horizon is an upper bound, especially with lengthy power chains. This experiment
changes horizon only; it does not add full-game rollouts or strengthen the policy.

Base revision `94540bf`, plus depth runner and per-player horizon options added
to the shared benchmark game loop. Production engine and defaults unchanged.
Runtime manifest pins source hashes. Twelve workers, BelowNormal priority.

```sh
node scripts/benchmark-wingspan-depth.mjs --out=RUNTIME_DIRECTORY --workers=12
node --test test/wingspan-depth.test.js test/wingspan-screen.test.js
```

Runtime directory: `C:\Users\mason\.codex\benchmark-runs\wingspan-depth-20261017`.
Initial PID 77000. Inspect checkpoint.json, stderr.log and the current process
for actual status. The local dashboard is an external, disposable monitor and
does not change game state or enter the repository.

On completion preserve manifest and per-game metrics, verify all 72 IDs and seat
pairs, report W/D/L and margins per matchup, and compute uncertainty over six
paired setups rather than treating all games as independent. Report any failures
or caps; none count as wins/losses. Timing is under desktop contention, not iPad
latency. No independent transcript replay is provided by this benchmark loop.
Promote results to benchmarks/wingspan and update the game overview.
