# Wingspan specialist evaluator experiment

Status: completed 120/120; no qualifiers. See [results](../../benchmarks/wingspan/2026-10-18-specialists/REPORT.md).

User authorized new evaluators and the next batch. Test habitat-specialist, investment-payback and specialist-payback against practical-combined. Screen: 100 samples, depth 4, step cap 48, 20 paired setups per candidate, 120 games total. Seeds 1828400 + 997*i, i=0..19, both seats.

Predeclared rule: all 40 valid, win share >=60% and positive mean margin; top two by win share then margin then name. Each qualifier receives 40 games vs practical-combined and 40 vs current at 300 samples, fresh seeds 1938400 + 997*i. Maximum 280 games; no within-stage outcome stopping. Selection is exploratory, not statistical significance. Report pair-based uncertainty, multiplicity, cap diagnostics and timing. Do not pool screen into confirmation estimates.

Use 24 BelowNormal workers. Preserve prior evaluators and production defaults. Frozen source-hash manifest and per-game checkpoints retain evidence.

Runner: scripts/benchmark-wingspan-specialists.mjs --out=NEW_DIRECTORY --workers=24.
Runtime: C:/Users/mason/.codex/benchmark-runs/wingspan-specialists-20261018.
Dashboard: http://192.168.50.14:52466/#wingspan-specialists.

Launched at revision 59b9767, PID 78772, 24 BelowNormal workers. All 606 tests pass; documentation check passed. Methods: [evaluator formulas](../../benchmarks/wingspan/leaf-refinements-methods.md).
