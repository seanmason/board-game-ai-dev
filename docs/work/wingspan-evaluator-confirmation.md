# Wingspan combined evaluator confirmation

Status: completed 2026-10-18 UTC, 160/160 successful games in 5m18s.
See [results](../../benchmarks/wingspan/2026-10-18-confirmation/REPORT.md).
Launched at revision `e824109`, initial PID 79696.
Verified 160 unique tasks, four balanced matchups and all fresh seeds; runner
syntax and documentation checks passed. No engine changes required new rules tests.
User requested another quick batch with agent
judgment. Prior screen selected practical-combined for its +2.35 margin despite
a 20–20 game record; this is a fresh-seed follow-up, not more games on those seeds.

Frozen design: four comparisons with 20 paired setups each (40 games), 160 total:
combined vs current at 100 samples; combined vs current at 300; 300 vs 100 within
combined; 300 vs 100 within current. Depth 4, 48-step cap, rollout policy,
candidate generator, root prior and exploration constant unchanged. No engine
changes or parameter tuning. Seeds `1498400 + 997*i`, i=0..19, both candidate seats,
balanced starters, interleaved comparisons. Primary question: does combined beat
current at equal compute on fresh seeds? Budget comparisons are secondary and
help distinguish evaluator benefit from compute benefit. All four comparisons
remain visible regardless of outcome; no outcome stopping or seed replacement.

```sh
node scripts/benchmark-wingspan-evaluator-confirmation.mjs --out=NEW_RUNTIME_DIRECTORY --workers=24
```

Runtime: `C:\Users\mason\.codex\benchmark-runs\wingspan-evaluator-confirmation-20261018`.
Dashboard: `http://192.168.50.14:52466/#wingspan-confirmation`.
24 BelowNormal workers. Prior evaluator run finished all 320 games before launch.
Manifest pins source hashes/configuration; each complete game checkpoints.

Report paired win share and score margins over the 20 setup pairs, ordinary 95%
intervals with explicit multiplicity caveat, timing and cap diagnostics. Do not
pool previous selection data into confirmation significance. Four shared-seed
comparisons are dependent. No human-strength or independent replay claim. Keep
production defaults unless the user approves a supported change.
