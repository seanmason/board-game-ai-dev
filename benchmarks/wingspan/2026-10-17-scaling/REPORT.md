# Wingspan playout scaling

Record type: evidence. Date: 2026-10-17. Outcome: defer higher default budgets;
no production policy change. All 168 games completed, zero failures or caps.

## Protocol

Frozen before execution: 168 two-player games, no outcome-based stopping or seed
replacement. Budgets 30, 100, 300 and 1,000 each face the same heuristic at 100
samples for 24 games. Adjacent budgets (100/30, 300/100, 1,000/300) each play 24
games. Each comparison has 12 fresh setups, each played from both candidate
seats. Six setups start in seat 0 and six in seat 1, correcting the starting-seat
imbalance in the earlier screen. Baseline seeds are `928400 + 997*i`; direct
comparison seeds are `941600 + 997*i`, for i=0..11. Comparisons reuse their seed
sets for comparability; distinct groups are not independent evidence samples.

All settings other than iteration budget remain unchanged: belief-rollout search,
horizon 4, representative candidate generator, and a 600-action cap. A playout
is a sampled short continuation, not a complete game. Only the acting player's
public observation reaches search. Each applied action passes production state
validation; this run does not provide independent transcript replay validation.

The orchestration imports the previous screen's unchanged game loop. Per-game
records include outcomes, scores, timing, iterations, candidate counts and
unvisited candidate counts; no full action transcript is retained. Failed or
capped games cannot contribute win or score metrics.

## Reproduction

Base revision: `7c79d48`, plus the new scaling runner retained with this evidence.
The manifest pins SHA-256 hashes of both runners and all Wingspan JS/JSON source.
Node v24.19.0 on Windows, Ryzen 9 5950X, eight worker threads, process priority BelowNormal.
Outputs checkpoint after every completed game; resume requires the exact same
revision, plan and source hashes. Use a new directory for a fresh execution.

```sh
node scripts/benchmark-wingspan-scaling.mjs --out=PATH_TO_RUNTIME_DIRECTORY --workers=8
node --test test/wingspan-screen.test.js test/wingspan-scaling.test.js
node benchmarks/wingspan/2026-10-17-scaling/summarize.mjs PATH_TO_RUNTIME_DIRECTORY
```

Timing includes concurrent worker contention and is not browser or iPad latency.
Paired mean score-margin intervals use the 12 setup-level seat averages, a
Student-t interval with 11 degrees of freedom, and multiplier 2.201. They are
descriptive, unadjusted for the seven comparisons. Wins are observed full-game
outcomes, not the analysis UI's utility score. Shared evaluators and an internal
heuristic opponent limit human-strength conclusions.

## Results

Execution took 783.516 seconds (13 minutes 4 seconds), from 22:22:07 to 22:35:10
UTC. All seven groups completed their 24 games. No games were omitted or replaced.

| Candidate | Opponent | W–D–L | Mean margin | Paired margin 95% interval | Mean game seconds |
| --- | --- | --- | --- | --- | --- |
| 30 | Heuristic | 20–0–4 | +8.13 | [5.41, 10.84] | 2.07 |
| 100 | Heuristic | 20–0–4 | +16.92 | [12.03, 21.80] | 6.14 |
| 300 | Heuristic | 23–0–1 | +19.96 | [13.60, 26.32] | 29.49 |
| 1,000 | Heuristic | 21–0–3 | +16.63 | [12.99, 20.26] | 90.87 |
| 100 | 30 | 15–0–9 | +1.92 | [-1.87, 5.71] | 8.11 |
| 300 | 100 | 11–1–12 | +0.71 | [-3.53, 4.94] | 29.88 |
| 1,000 | 300 | 12–0–12 | +0.88 | [-2.92, 4.67] | 78.44 |

Against the heuristic, mean full-game cost increased about 3.0x from 30 to 100,
4.8x from 100 to 300, and 3.1x from 300 to 1,000. These ratios include different
game trajectories, not just a fixed-state microbenchmark. Maximum game times
were 7.41, 15.14, 269.82 and 438.95 seconds respectively. High-budget tails make
the earlier small screen's quick average a poor guarantee for arbitrary deals.

The 30-budget baseline left 5 of 18,725 generated candidate instances unvisited;
the 100-vs-30 matchup left about 1.09% unvisited across both players. All other
groups visited every generated candidate. This does not mean every legal action
was generated: the representative quick-action generator remains a restriction.

## Interpretation and decision

All four budgets beat the internal heuristic in this screen. More computation
did not produce a monotonic strength improvement. The 100-vs-30 result and larger
baseline score margin suggest a useful modest extension, but its paired margin
interval still includes zero. Neither step above 100 produced a convincing
head-to-head benefit. Starting seat is balanced here, but seat-conditioned results
still fluctuate; 12 paired deals per group do not establish a precise ranking.

For a practical interface, retain 30 as a fast checkpoint and consider 100 as an
optional extension. The evidence does not justify a default of 300 or 1,000, or
another larger tournament now. No production UI, search or default changed in
this task. Revisit higher budgets if concrete human-play mistakes motivate a
targeted test or an evaluator/search change.

## Retained evidence and verification

[Results and manifest](results.json) retain all 168 per-game records, paired
summaries, all frozen tasks and source hashes. [Summarizer](summarize.mjs)
reconstructs these aggregates from the runtime checkpoint. The original runtime
directory is `C:\Users\mason\.codex\benchmark-runs\wingspan-scaling-20261017`;
the committed records do not require it for inspection.

The four focused runner tests passed, checking balanced unique tasks, paired
seats, sample batching equivalence, and exclusion of capped games from outcomes.
Both new scripts passed syntax checks. Documentation links were checked after
updating the overview. The summarizer verified all expected task IDs were present
exactly once. Production rules were unchanged; independent transcript replay,
human testing and browser/device timing were not performed for this study.
