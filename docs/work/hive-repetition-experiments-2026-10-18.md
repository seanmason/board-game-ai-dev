# Hive repetition experiments — 2026-10-18

## Question and frozen design

Does extra computation or a public-history tie-break reduce Hive repetition?
The prior screen had 45 unresolved games out of 80 against the independent
heuristic. This batch uses fresh openings; it is not a rerun or confirmation.

Three arms face unchanged `simple-v1` on the same 40 setup seeds, starting at
8182600 with stride 997, both candidate seats: 240 games total. All use six-ply
seeded legal openings, maxTurns 160, repetitionLimit 4 and maxDepth 5.

1. Control: `tactical-v2`, soft 100 ms.
2. History: research-only `history-v1`, soft 100 ms. Among exactly equal root
   evaluations prefer fewer previous occurrences of the resulting position in
   public game history, then retain lexical ordering. Keep all legal roots,
   immediate-win priority and mandatory reply safety. Tie comparisons use root
   heuristic/completed-minimax scores before the shared all-losing fallback
   substitutes proven-loss display values; that fallback ordering is unchanged
   to isolate this experiment. No repetition rule changes.
3. Compute: `tactical-v2`, soft 500 ms.

The independent heuristic has no changed budget or policy. Run arms sequentially
with twelve BelowNormal workers. The tactical/depth-one floor may exceed the soft
budget. Record actual decision cost, search depth, completion, repeats, caps,
errors and every result. Freeze code hashes before execution. No interim tuning,
optional early success stopping, or automatic promotion. Stop only for execution
or validity failure; preserve those records and document any restart.

## Analysis and decisions

The independent unit is one opening with both seat rotations. Primary outcome:
completion fraction and its paired difference versus control (approximate 95%
paired-t interval over 40 opening means). Report which individual games change
from unresolved to complete and vice versa. Report candidate win-share lower and
upper sensitivity bounds across *all* scheduled games, allowing unresolved
outcomes any share from zero to one. These bounds are not assigned game results.
Report complete-group win shares separately as conditional, potentially biased.

Also report matched differences in observed-win lower-bound scores (unresolved
contributes zero only to this bound), actual latency and completed search depths.
This is exploratory with two comparisons; intervals are descriptive, not a
multiple-comparison-adjusted promotion test. An arm merits future confirmation
only if completion improves at least ten percentage points, its completion
paired interval excludes zero, and its all-scheduled observed-win lower bound
is no worse than control. No additional tournament runs automatically this turn.
Even qualifying arms need separately planned fresh confirmation and safety review.
The browser AI and rules remain unchanged. Timed searches can differ across
machines/load; fixed seeds reproduce setup, not necessarily decisions.

## Reproduction

Use `node scripts/benchmark-comparison.mjs --games=hive --players=2 --opponent=simple-v1 --pairs=40 --workers=12 --seed-base=8182600` with distinct output folders,
`--policy=tactical-v2` or `--policy=history-v1`, and JSON budget
`{"ms":100,"maxDepth":5,"openingPlies":6,"maxTurns":160,"repetitionLimit":4}`
(replace ms with 500 for compute). Frozen manifests preserve exact tasks and hashes.


## Completed outcome

All 240 records are preserved: 143 complete, 93 unresolved repetitions, four caps,
zero illegal actions/errors. History completed 55/80 versus control 45/80
(+12.5 percentage points, paired 95% interval +5.5 to +19.5); ten gains and no
lost control completions. It meets the exploratory follow-up gate and remains
research-only pending separately planned fresh confirmation. The 500 ms arm
completed 43/80 at more than twice control's measured decision cost and does not
qualify. No further tournament ran. See the
[report and raw evidence](https://github.com/seanmason/board-game-ai-dev/blob/benchmarks/ai-comparison-2026-10-18/hive-repetition/REPORT.md).
