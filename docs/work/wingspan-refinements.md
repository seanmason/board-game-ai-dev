# Wingspan leaf refinement experiment

Status: completed 120/120 games in 145.3 seconds. No candidates qualified for confirmation. See [results](../../benchmarks/wingspan/2026-10-18-refinements/REPORT.md).

User authorized the proposed next tests. Screen action-budget-planner,
bottleneck-engine and phase-calibrated against practical-combined at 100 samples,
depth 4 and a 48-step limit. Each comparison has 20 paired setups (40 games),
120 games total. Seeds are 1608400 + 997*i for i=0..19, both candidate seats.
See [methods](../../benchmarks/wingspan/leaf-refinements-methods.md).

Predeclared selection: all 40 games valid, win share at least 60% and positive
mean score margin. Select at most two by win share, then margin, then name.
This is a screening rule, not a significance claim. Each selected candidate
receives 40 games against practical-combined and 40 against current, both at
300 samples. Confirmation uses independent seeds 1718400 + 997*i, both seats.
Total scheduled work is 120 to 280 games. No outcome stopping within a stage.
Keep selection and confirmation estimates separate; report paired uncertainty,
multiple-comparison limitations, runtime, failures and rollout cap diagnostics.

Use at most 24 worker threads, BelowNormal priority. Runner saves a frozen
source-hash manifest, individual game results, selection and live checkpoints.
Production defaults remain unchanged.

```sh
node scripts/benchmark-wingspan-refinements.mjs --out=NEW_RUNTIME_DIRECTORY --workers=24
```

Runtime: `C:\Users\mason\.codex\benchmark-runs\wingspan-refinements-20261018`.
Dashboard: `http://192.168.50.14:52466/#wingspan-refinements`.

Launched at revision d35d2af, PID 76480, 24 BelowNormal workers. Validation: all 600 tests pass; documentation check passed.
