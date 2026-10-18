# Wingspan final selection tournament

Status: validated and ready to launch, with no earlier benchmark still running.

[Evidence synthesis](../../benchmarks/wingspan/2026-10-18-final-selection/REPORT.md)
consolidates prior completed, incomplete and unstarted experiments. The runner
freezes its code hashes, revision, 640 screen tasks and potential confirmation tasks.
All stages use 300 samples, depth 4 and 48-step rollout safety limit, 24 BelowNormal
workers. The best at most two qualifying screens receive 200 fresh games each.
The fixed paired confirmation gate and fallback are in the report and runner.

Command from the pages-publish checkout:

```powershell
node scripts/benchmark-wingspan-final.mjs --out=C:/Users/mason/.codex/benchmark-runs/wingspan-final-20261018 --workers=24
```

Runtime files are outside Git. Per-game JSON, checkpoint.json, manifest.json,
selection.json and decision.json preserve the execution and final recommendation.
The runner does not publish or change the browser default. If neither challenger
qualifies, practical-combined is the final recommendation. Otherwise the highest
confirmation lower bound wins (margin then name-based tie-breaks).

Dashboard: http://192.168.50.14:52466/#wingspan-final

Validation before launch: `node --test` passed all 689 tests;
`node scripts/check-syntax.mjs` checked 204 modules;
`node scripts/check-docs.mjs` passed. No playing-strength result is claimed for
this new batch before it runs. Current candidate pruning, shallow rollout policy,
and two-player-only experimental scope remain limitations.
