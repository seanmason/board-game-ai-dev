# Wingspan opening experiment

Pre-launch validation record: prior final selection completed 640 games with no
qualifier; practical-combined remains the reference and browser default.
[Results, rationale and protocol](../../benchmarks/wingspan/2026-10-18-opening/REPORT.md)
incorporate earlier evaluator evidence and the diagnostic replay.

Three ablations compare setup-only, eval-only and both against practical-combined.
Each gets 80 games / 40 fresh seat pairs at 300 samples, depth 4, step cap 48.
At most two qualifying candidates receive 200 fresh games each, with the same
predeclared paired confirmation gate as the previous final tournament.
The screen has 240 games; maximum total is 640. Twenty-four BelowNormal workers
leave remaining desktop capacity available. No other benchmark should run concurrently.

```powershell
node scripts/benchmark-wingspan-opening.mjs --out=C:/Users/mason/.codex/benchmark-runs/wingspan-opening-20261018 --workers=24
```

Dashboard: http://192.168.50.14:52466/#wingspan-opening
Runtime: C:/Users/mason/.codex/benchmark-runs/wingspan-opening-20261018

The runner freezes hashes, seeds, settings and task identifiers in manifest.json.
All actual setup candidate generation, metrics and full-game results are saved;
selection.json and decision.json preserve the selection and recommendation.
Setup expansion is limited to the candidate's actual setup decisions; simulated
rollout setup choices remain the old generator. The new opening evaluator is
opt-in, expires after round one, and does not alter deployed defaults.

Validation: node --test passed 704 tests. Browser dashboard verification and
syntax/documentation checks are performed before launch. Evidence concerns this
simulator and representative move generator, not measured human playing strength.
