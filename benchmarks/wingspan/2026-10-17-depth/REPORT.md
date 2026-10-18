# Wingspan depth comparison

Record type: evidence. Date: 2026-10-17. Outcome: depth 12 is promising, not
established as superior; no production default changed.

All 72 games completed without failures/caps in 490.38 seconds (8m10s), from
23:06:45 to 23:14:55 UTC. Both players received 100 belief-rollout samples per
decision. Depths 4, 8, 12, 16 played a full round robin: six fresh setup pairs per
matchup, candidate seats swapped, starting seats balanced. Seeds were
`1168400 + 997*i`, i=0..5; the same six setups were reused across matchups.
No outcome-based stopping or replacement occurred.

| Deeper vs shallower | Deeper W–D–L | Mean margin | Paired 95% margin interval | Mean game seconds |
| --- | --- | --- | --- | --- |
| 8 vs 4 | 6–0–6 | -2.33 | [-8.86, 4.19] | 37.60 |
| 12 vs 4 | 8–0–4 | +2.17 | [-2.59, 6.93] | 39.23 |
| 12 vs 8 | 7–0–5 | +1.92 | [-6.75, 10.58] | 54.43 |
| 16 vs 4 | 6–0–6 | -1.67 | [-6.70, 3.36] | 62.39 |
| 16 vs 8 | 7–0–5 | -1.00 | [-9.66, 7.66] | 65.21 |
| 16 vs 12 | 6–0–6 | -6.00 | [-16.21, 4.21] | 89.93 |

Overall wins out of 36 per depth: 4=16, 8=16, 12=21, 16=19. Mean margins:
4=+0.61, 8=-1.08, 12=+3.36, 16=-2.89. These totals are descriptive, not
independent evidence across comparisons. Depth 12 has the best observed record
and positive paired margins on five of six setups against depth 4. However every
direct paired interval includes zero. Increasing depth is not monotonically
helpful in this sample, and the largest depth does not justify its extra cost.

Intervals use six setup-level averages over the two seats, sample standard
deviation divided by sqrt(6), and t multiplier 2.571 (five degrees of freedom).
They are unadjusted for multiple comparisons. Small samples, shared heuristic
policies, restricted candidate generation and common seeds limit generalization.
The unchanged 48-step safety cap may stop a rollout before its requested depth;
actual reached depth was not instrumented. These are short continuations, not
full-game simulations. Timing includes desktop contention and both players'
searches; it does not isolate per-depth latency or predict iPad performance.

## Reproduction and artifacts

Execution base `94540bf` with the depth runner/shared horizon-option patch,
subsequently committed as `9c3c732`. [Results](results.json) include the exact
source-hash manifest, all tasks, all 72 game records, paired margins and summaries.
Node v24.19.0, Windows, Ryzen 9 5950X, 12 workers at BelowNormal priority.

```sh
node scripts/benchmark-wingspan-depth.mjs --out=NEW_RUNTIME_DIRECTORY --workers=12
node --test test/wingspan-depth.test.js test/wingspan-screen.test.js
```

Runtime directory: `C:\Users\mason\.codex\benchmark-runs\wingspan-depth-20261017`.
The four focused tests passed before launch. Final aggregation verified all 72
expected unique task IDs, configurations, successful statuses, score margins
and paired seats. Production state validation runs after each action; no
independent full-transcript replay was performed. Documentation links checked
after recording completion. Retain depth 12 as a candidate for a small fresh
confirmation if a production depth change is desired; no further runs launched.
