# Wingspan 10,000 versus 300 follow-up

Status: halted at the user's request on 2026-10-17, with 19/20 games complete.
The unfinished game was stopped and is not a loss. Completed results were 8 wins,
11 losses for 10,000, mean margin +1.37. This is incomplete, stopping-time-selected
evidence and should not be treated as the planned paired study. Runtime records
and halted.json are preserved. Replaced by the [depth study](wingspan-depth.md).

Original plan: User requested exactly 20 games to
test whether much higher sampling improves strength. No production changes.

Frozen plan: ten fresh setups, each played from both candidate seats; five setups
start in each seat. Seeds `1052800 + 997*i`, i=0..9. Belief-rollout on both sides,
10,000 vs 300 iterations, unchanged horizon 4 and 600-action cap. No outcome-based
stopping, replacement seeds or adjustment of budgets. Failures/caps remain visible
and must not enter win or margin summaries. Same unchanged game loop as the earlier
screen, with production state validation and no independent transcript replay.

Source base `8fd7c6f`, plus the new high-budget orchestration script. Runtime
manifest records exact source hashes and tasks. Twelve workers at BelowNormal
priority leave desktop capacity available. Each completed game saves its result.

```sh
node scripts/benchmark-wingspan-high-budget.mjs --out=RUNTIME_DIRECTORY --workers=12
node --test test/wingspan-high-budget.test.js test/wingspan-screen.test.js
```

Runtime directory:
`C:\Users\mason\.codex\benchmark-runs\wingspan-10000-vs-300-20261017`.
Read checkpoint.json and the current process state for progress; this plan is not
evidence that execution is still running. Initial process PID 75884.

On completion verify 20 unique expected IDs and ten full seat pairs, retain raw
metrics and manifest under benchmarks/wingspan, and summarize W/D/L, mean score
margin, setup-paired uncertainty (10 pairs), mean/max timing, and failures/caps.
Compare to the [prior scaling study](../../benchmarks/wingspan/2026-10-17-scaling/REPORT.md).
Do not interpret an internal-opponent win rate as calibrated human strength.
Close this work plan and update the game overview with the completed evidence.
