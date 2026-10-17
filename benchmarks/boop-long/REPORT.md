# Boop: longer-budget evaluation

Engine unchanged from implementation commit `d328f4d`. Same paired random eight-ply openings and seat rotation as the earlier 25 ms experiment, seed 1642911. Tactical greedy uses the same evaluator and exact immediate-win/loss screening, but no stochastic tree search. All trees start fresh; subtree reuse is deliberately disabled in this experiment.

| Budget per guided move | Wins / games | Losses | Capped | Mean move time | Median maximum tree depth | Mean root coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Earlier nominal 25 ms | 17/24 | 7 | 0 | 0.026 s | Not recorded | Not recorded |
| 3,000 simulations | 24/24 | 0 | 0 | 4.61 s | 4 | 99.9% |
| 10,000 simulations | 23/24 | 0 | 1 | 12.52 s | 4 | 100.0% |
| 5 s target; minimum 3,000 simulations | 12/12 | 0 | 0 | 5.63 s | 4 | 100.0% |

## Same-opening comparison

- **3,000 simulations:** converted 7/7 previously lost cases into wins; 0 previously won cases became losses.
- **10,000 simulations:** converted 6/7 previously lost cases into wins; 0 previously won cases became losses.
- **5 s target; minimum 3,000 simulations:** converted 3/3 previously lost cases into wins; 0 previously won cases became losses.

## Search accounting

Counts are MCTS iterations, including terminal-node revisits. Rollouts retain the original eight-move horizon; this experiment increases search effort without changing the rollout policy or evaluator. Maximum tree depth is explicit tree depth before a rollout, not the entire simulated continuation. Fixed-time runs intentionally continue to the target even when a win is already known; their millions of terminal revisits must not be described as millions of independent full-game playouts.

| Budget | Total iterations | Terminal tree revisits | Rollouts ending in a real win | Heuristic cutoff leaves | Median iterations/move |
| --- | ---: | ---: | ---: | ---: | ---: |
| 3000 | 804000 | 92090 | 249124 | 462786 | 3000 |
| 10000 | 4170000 | 560311 | 1908827 | 1700862 | 10000 |
| 5 s + minimum | 11474438 | 10996524 | 223576 | 254338 | 3113 |

## Capped game diagnostic

- At **10000 iterations**, game 11 reached the 250-evaluated-turn cap (258 total turns including the opening). It visited only **27 unique positions** across 251 recorded positions, with 224 repeated visits. The first repeat was at turn 35, with period 2; one position appeared 113 times.
The final sequence repeats Orange kitten B6, then Gray kitten A5. Gray search utility stayed near 0.83 while the actual game made no progress. This is evidence of a repetition/horizon or opponent-model weakness: extra samples can preserve an optimistic estimate while the real opponent repeats its defense. It is not an official game draw or a proven forced win. The unchanged 3,000-iteration version won this same opening. Breaking such cycles needs a separately evaluated policy change; no such change was included in these trials.


## Interpretation limits

These are small synthetic-opponent samples, not human ratings. The 24-game settings contain 12 paired opening seeds; the 12-game time-target setting contains six. Wilson intervals in the raw summaries are descriptive binomial reference intervals and do not adjust for dependence within each opening pair. Higher win rates cannot by themselves establish the difference between the two large budgets.

The fixed-count settings use the same full 24-game opening set as the old result. The time-target setting uses games 0–11 only. Actual times are measured while six ordinary benchmark child processes share an eight-CPU container quota. Nominal five-second searches continue until at least 3,000 iterations have run, even when that overruns five seconds. No capped game is silently scored as a real draw.

All new recorded games were replayed through both the production engine and the separately written two-dimensional rules oracle: **2118 transitions, zero differences**. The production engine itself was not changed.

## Reproduce

```sh
npm test
BOOP_EVAL_WORKERS=6 node scripts/evaluate-boop-long.mjs
node scripts/analyze-boop-long.mjs
```

The runner checkpoints after each completed game. Its shards/logs are local intermediates; the aggregate JSON files include complete replayable move traces, search metrics and final outcomes. `environment.json` records the engine/rules hashes and runtime details.
