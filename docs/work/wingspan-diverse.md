# Wingspan diverse evaluator screen

Status: completed656/656 games after recovering a checkpoint-write interruption. See [results](../../benchmarks/wingspan/2026-10-18-diverse/REPORT.md). User requested at least twelve new evaluators
grounded in the rules and immediate execution of the next batch.

Review: scoring.js implements bird points, bonuses, round awards, eggs, caches
and tucked cards; leftover food breaks score ties, ordinary unused cards/food do
not directly score. Goals use competitive rank on green and capped quantity on
blue. Actions require typed food (including conversion), placement eggs, and
available habitat slots. Egg capacity and placement affect goals and bonuses.
Row outputs improve at specific columns; brown powers activate in the chosen
row, pink powers respond to opponents, and white powers fire on placement.
The game has 8/7/6/5 actions per player by round. Representative action generation
still limits what any leaf evaluator can choose; this experiment does not expand it.

Screen all twelve new methods against unchanged practical-combined at 100 samples,
depth 4, step cap 48. Each gets 24 paired setups (48 games), total 576 games.
Fresh seeds 2048400 + 997*i for i=0..23, both seats, comparisons interleaved.
All games run to completion; no within-stage outcome stopping.

Predeclared qualification: all48 valid, win share >=60% and positive mean margin.
Select at most three by win share, then margin, then name. This is exploratory
selection, not a significance test. Each qualifier gets 40 games vs combined and
40 vs current at 300 samples using fresh seeds 2158400 + 997*i, i=0..19, both seats.
Maximum total816. Keep confirmation separate and report pair-based uncertainty
and the twelve-comparison selection/multiplicity limitation. No parameter fitting
to screen outcomes, no production-default change.

Runner: scripts/benchmark-wingspan-diverse.mjs --out=NEW_DIRECTORY --workers=24.
Runtime: C:/Users/mason/.codex/benchmark-runs/wingspan-diverse-20261018.
Dashboard: http://192.168.50.14:52466/#wingspan-diverse.
Use at most24 BelowNormal workers; manifests pin source hashes and each game
checkpoints. Report failures, timing, capped searches and the fixed rollout policy.

Rulebook cross-check: [publisher rulebook distributed with the digital game](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1217910/manuals/Core_Game_Rules.pdf?t=1578504733), especially turn structure and end-game scoring (pages4–5). Local scoring.js, actions.js, core.js and powers.js determine the tested implementation.

Exact twelve hypotheses and limitations: [diverse evaluator methods](../../benchmarks/wingspan/diverse-methods.md).

Launched revision 3c78a94, PID45016, 24 BelowNormal workers. All619 regression tests pass; runner syntax, diff whitespace and documentation checks passed. Dashboard verified with live checkpoint.
