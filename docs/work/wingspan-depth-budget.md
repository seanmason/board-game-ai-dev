# Wingspan depth and budget matrix

Status: halted by user on 2026-10-18 UTC to start the evaluator screen. Preserved
108/108 original games and 11/72 extension games; confidence extension 0/720.
Unfinished games are not losses. See [replacement study](wingspan-evaluators.md).
Originally launched on 2026-10-17 at revision `d541f45`, initial process PID 77008.
All 584 tests and documentation checks passed before launch.
User requested 500 and 1,000 playouts at depths
12 through 20, parallel experiments, and a live dashboard. No default change.

Frozen design: six configurations (depths 12, 16, 20 crossed with budgets 500,
1,000). Nine comparisons isolate one variable at a time: 1,000 vs 500 at each
depth; all three depth pairs at each budget. Each matchup plays six fresh setups
from both seats, for 12 games each and 108 total. Seeds `1276400 + 997*i`, i=0..5,
balance starters. The same six setups are reused across matchups; comparisons
are not statistically independent. Execution interleaves comparisons by seed.
No outcome-based stopping, budget adjustment or seed replacement is planned.

The requested depth range requires accepting horizon 20. Every configuration
uses the same 160-step rollout safety cap, rather than the prior 48, to reduce
premature truncation. Diagnostics separately record candidate and opponent
rollout counts, total subsequent action turns, requested horizon reached,
terminal reached and safety-cap counts. These counts can overlap at terminal
boundaries and should not be summed as disjoint outcomes. Search defaults remain
unchanged (including the 48-step default). The production UI is unchanged.
Results are not directly attributable to depth/budget alone when compared with
older studies, because this study uses new seeds and a higher safety cap.

```sh
node scripts/benchmark-wingspan-depth-budget.mjs --out=NEW_RUNTIME_DIRECTORY --workers=24
node --test test/wingspan-depth-budget.test.js test/wingspan-deep-options.test.js test/wingspan-screen.test.js
```

Runtime: `C:\Users\mason\.codex\benchmark-runs\wingspan-depth-budget-20261017`.
24 workers at BelowNormal priority, leaving eight logical CPUs outside the worker
count on the desktop. Scheduling is not CPU affinity. The runtime manifest pins
source hashes, settings and all task IDs. Each game saves independently.

Live dashboard is local-only, outside Git. Its configuration names must include
both depth and budget. Read checkpoint.json and process state for actual status.
Dashboard: `http://192.168.50.14:52466/#wingspan-depth-budget` on the same LAN.
On completion preserve outcomes, scores, timing, diagnostics and the manifest;
check all task IDs and seat pairs; summarize each matchup with uncertainty over
six setup pairs. Report failures and capped games separately. Retain all results,
including unfavorable findings. No independent transcript replay is provided.

## User-requested 3,000-sample extension

Added while the original run continues, preserving its frozen manifest and all
in-flight work. The extension adds 72 games: 3,000 vs 1,000 at each depth and all
three depth pairs at 3,000. Same seeds, seat pairs and 160-step limit. Combined
study: nine configurations, 15 matchups, 180 games. There is no direct 3,000-vs-500
matchup. This amendment was requested by the user, not selected from outcomes.

```sh
node scripts/benchmark-wingspan-depth-budget-3000.mjs --out=EXTENSION_RUNTIME_DIRECTORY --workers=24 --alongside=ORIGINAL_RUNTIME_DIRECTORY
```

Extension runtime:
`C:\Users\mason\.codex\benchmark-runs\wingspan-depth-budget-3000-20261017`.
The extension polls original process/checkpoint capacity and begins additional
games only as original active slots free up; the combined worker ceiling is 24.
Original workers are not interrupted. The dashboard merges both manifests and
checkpoints, and must not mark the whole study complete when just one finishes.
This coordination assumes the original runner is not independently restarted
with a new PID while the extension is running. Keep its original pid.txt intact.

## Confidence expansion requested by user

Final planned total is 900 games: 60 per matchup, 30 paired setups, balanced
starters. Preserve the first six setups and add 24 new setups per matchup using
`1276400 + 997*i`, i=6..29. This adds 720 games with identical search parameters.
The increased sample size was requested by the user, not chosen to chase a
favorable intermediate outcome. Freeze this target: no stopping when a result
becomes favorable and no replacing inconvenient failures.

Primary comparison is paired win share (draw=half), with the two seat outcomes
averaged within each setup. Report uncertainty using setups as the independent
unit, not individual games; account for the family of 15 comparisons before
claiming a superior configuration. Also report paired score-margin intervals,
timing and truncation rates. Give ordinary 95% intervals for estimation and a
multiple-comparison adjustment for superiority claims. Treat small or uncertain
differences as inconclusive, not proof of equivalence. Thirty pairs improve
precision but do not guarantee sufficient power for small differences.

```sh
node scripts/benchmark-wingspan-depth-budget-confidence.mjs --out=CONFIDENCE_RUNTIME_DIRECTORY --workers=24 --after=ORIGINAL_RUNTIME_DIRECTORY --after=EXTENSION_RUNTIME_DIRECTORY
node --test test/wingspan-confidence.test.js
```

New runtime directory:
`C:\Users\mason\.codex\benchmark-runs\wingspan-depth-budget-confidence-20261017`.
This runner waits until both predecessor processes exit before launching its
pool, avoiding races between independent capacity allocators. Existing games
continue uninterrupted; total game concurrency remains at most 24. The dashboard
combines all three runs and expects 900 results. Do not restart predecessor
runners independently under new PIDs while this queue is active.
