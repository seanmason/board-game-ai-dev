# Leaf refinement screen

Revision d35d2afad1202f5cdcc3023b8c01e223e333a58d. 120/120 complete; elapsed 145.3 seconds. Depth 4, 100 samples, 48-step cap, 24 workers. Twenty paired setups per comparison against practical-combined.

| Evaluator | W / D / L | Win share | Mean margin | Paired margin 95% interval |
| --- | --- | --- | --- | --- |
| action-budget-planner | 6 / 0 / 34 | 15.00% | -10.20 | -14.87 to -5.53 |
| bottleneck-engine | 22 / 1 / 17 | 56.25% | 1.77 | -1.94 to 5.49 |
| phase-calibrated | 20 / 0 / 20 | 50.00% | 0.13 | -3.32 to 3.57 |

Intervals use t(19) over setup-pair mean margins, unadjusted for three comparisons. None passed the predeclared 60% win-share and positive-margin screen, so no confirmation was scheduled. Shared seeds make comparisons dependent.

The planner is clearly worse in this sample: its hand-only egg/printed-point projection removes engine investment signals. This is a hypothesis for the mechanism, not a measured causal decomposition. Bottleneck correction is inconclusive; phase weighting is neutral. Preserve practical-combined as the experimental reference. Next test row-specialized engine activation and future engine value of prospective hand birds, separately and combined.

Full checkpoints: [results](results.json). Runtime source manifest and per-game records: C:/Users/mason/.codex/benchmark-runs/wingspan-refinements-20261018.
