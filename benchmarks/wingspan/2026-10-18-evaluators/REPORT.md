# Wingspan leaf evaluator screen

Record type: evidence. Date: 2026-10-18. Outcome: retain current evaluator;
no alternative demonstrated superiority in this screen.

All 320 games completed without failures/caps in 377.191 seconds (6m17s).
Each alternative played the unchanged current evaluator on 20 fresh setups from
both seats, 40 games each. Starting seats were balanced. Seeds were
`1388400 + 997*i`, i=0..19, reused across alternatives. Depth 4, 100 samples per
decision, 48-step safety cap, same candidate generator, rollout policy,
exploration coefficient and 18% root-heuristic contribution. No outcome stopping.

| Alternative | W–D–L | Mean margin | Paired margin 95% interval |
| --- | --- | --- | --- |
| Points only | 11–1–28 | -3.63 | [-6.54, -0.71] |
| Remaining turns | 15–0–25 | -3.15 | [-7.13, 0.83] |
| Engine income | 19–0–21 | +0.30 | [-2.93, 3.53] |
| Goal aware | 20–1–19 | +0.35 | [-3.40, 4.10] |
| Practical combined | 20–0–20 | +2.35 | [-2.19, 6.89] |
| Usable resources | 14–1–25 | -4.70 | [-9.49, 0.09] |
| Conservative | 18–1–21 | -1.05 | [-5.08, 2.98] |
| Habitat productivity | 15–0–25 | -2.20 | [-5.50, 1.10] |

Intervals use 20 setup-level seat-averaged margins, sample standard deviation
divided by sqrt(20), and Student-t multiplier 2.093 (19 df). They are approximate
and unadjusted for eight comparisons; do not infer corrected significance from
them. No alternative's win-share interval excludes 50% in the favorable direction.
Points-only's approximate paired win-share interval is 16.0%–41.5%, also unadjusted.

The current future-value estimates appear useful relative to removing them.
More elaborate hand-written estimates were not automatically better. Correcting
remaining turns alone was not an improvement under the existing weights, policy
and root prior. This does not disprove the importance of tempo or leaf evaluation.
Practical-combined has the largest observed positive margin: positive on 13/20
paired setups, negative on six, tied on one. Its 20–20 game record and broad
interval make it a candidate for investigation, not an adopted improvement.
Engine-income and goal-aware were approximately even in this sample.

Keep production defaults unchanged. Next useful diagnostic is to inspect move
disagreements and concrete loss positions before adding more evaluator complexity.
If testing practical-combined further, use fresh seeds and treat this selection
as exploratory. The study tests these particular formulas at shallow search,
not all possible evaluators, larger budgets or human strength.

## Reproduction and evidence

Execution revision `39fef0b`; [records and manifest](results.json) preserve every
task, source hash and per-game metric. [Exact formulas](../leaf-evaluators-methods.md)
and [protocol](../../../docs/work/wingspan-evaluators.md) explain limitations.
Node v24.19.0, Windows, Ryzen 9 5950X, 24 workers at BelowNormal priority.

```sh
node scripts/benchmark-wingspan-evaluators.mjs --out=NEW_RUNTIME_DIRECTORY --workers=24
node --test test/wingspan-evaluator-screen.test.js test/wingspan-leaf-evaluators.test.js
```

Runtime directory: `C:\Users\mason\.codex\benchmark-runs\wingspan-evaluators-20261018`.
Aggregation verified all 320 expected unique IDs, configurations, completion and
score margins. Every alternative had 20 complete seat pairs. Engine state
validation runs after every actual action; no independent transcript replay was
performed. Full prelaunch tests found one missing static asset dependency, then
the corrected asset suite passed; other 592 tests passed. No new tournament was
run to produce this report. Documentation checks passed on completion.
