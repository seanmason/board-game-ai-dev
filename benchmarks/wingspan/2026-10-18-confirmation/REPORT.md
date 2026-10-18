# Combined evaluator fresh-seed confirmation

Record type: evidence. Date: 2026-10-18. Outcome: practical-combined is a promising
improvement; no production defaults changed.

All 160 games completed without failures/caps in 318.134 seconds (5m18s).
Four matchups each used 20 fresh setups, both candidate seats, balanced starters.
Seeds `1498400 + 997*i`, i=0..19. Depth 4 and 48-step cap fixed, all other engine
settings unchanged. Prior selection study used different seeds. No outcome stops.

| First vs second configuration | W–D–L | Mean margin | Paired margin 95% interval | Paired win-share 95% interval |
| --- | --- | --- | --- | --- |
| Combined 100 vs current 100 | 28–0–12 | +3.625 | [0.42, 6.83] | [58.2%, 81.8%] |
| Combined 300 vs current 300 | 24–0–16 | +4.925 | [0.55, 9.30] | [45.6%, 74.4%] |
| Combined 300 vs combined 100 | 27–0–13 | +4.575 | [0.79, 8.36] | [53.8%, 81.2%] |
| Current 300 vs current 100 | 17–0–23 | -0.900 | [-5.31, 3.51] | [25.1%, 59.9%] |

Intervals are approximate Student-t intervals over 20 setup-level seat averages,
using multiplier 2.093 (19 df), unadjusted for four comparisons. Comparisons share
seed sets and are dependent. Selection-study results were not pooled into these
intervals. All three favorable combined comparisons had positive paired mean
margins on 13/20 setups. Mean full-game times under 24-worker contention were
24.29, 65.78, 46.91, 43.58 seconds in the table's order.

This is stronger evidence for the combined evaluator than the initial screen.
The pattern is consistent with evaluator quality affecting returns from more
samples: additional samples helped combined in this batch but not current.
It is not a formal interaction test, and the poor current budget result is not
proof that increasing samples harms current play. Combined's 100-sample record
was 20–20 in selection and 28–12 in confirmation, illustrating seed sensitivity.
Depth 4 and one internal opponent family limit extrapolation. Keep formulas
unchanged while designing targeted alternative improvements; do not claim human
strength or statistically established superiority at every budget.

## Evidence and reproduction

Execution revision `e824109`. [Manifest and all game records](results.json).
[Frozen protocol](../../../docs/work/wingspan-evaluator-confirmation.md).
Node v24.19.0, Windows, Ryzen 9 5950X, 24 BelowNormal workers.

```sh
node scripts/benchmark-wingspan-evaluator-confirmation.mjs --out=NEW_RUNTIME_DIRECTORY --workers=24
```

Verified all 160 expected unique IDs, task settings and score margins; all groups
have 20 complete seat pairs. Production validates states after actual actions;
no independent full-transcript replay. No engine changes were needed for this
study. Task design, syntax and documentation checks passed before launch;
documentation checked again at completion. Original runtime remains at
`C:\Users\mason\.codex\benchmark-runs\wingspan-evaluator-confirmation-20261018`.
