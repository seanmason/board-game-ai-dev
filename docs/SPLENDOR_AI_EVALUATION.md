# Splendor search evaluation — 2026-10-17

> Retained development report: sections describe the work and evidence at their recorded stages. Start with the [current splendor overview](games/splendor/README.md) for present behavior and remaining gates. Historical counts and results were not rerun for the documentation migration.

## Question and protocol

The initial 16/16 two-player and 10/12 three-player pilots used nonsearching
heuristic opponents. This follow-up uses actual search on both sides.

The development policy is root UCB over sampled hidden worlds, a 12-turn
stochastic heuristic rollout, and highest estimated mean utility at the root.
Comparators change rollout depth (4 or 24 turns), select the most-visited root
move instead, or give the existing policy more time. These share an evaluator
and rollout policy; they are substantially more demanding than the old heuristic
opponents but are not independent external engines.

Each deal is played once with the candidate in each seat. The starting seat
rotates across deals. Both sides receive only their own observation, never actual
opponent private reservations or the true deck. Actual moves are validated by the
rules engine. Shared victories count fractionally. A turn-limit failure aborts
rather than inventing a winner.

Matched-budget comparisons give each side the same wall-clock allowance **per
phase decision**, including gem returns and noble choices. Total game compute can
differ with the number of decisions. The runner is sequential; reported actual
milliseconds include deadline overruns from indivisible simulations. This is a
CPU-time proxy, not a controlled instruction-count experiment. Higher-budget
comparisons are explicitly unequal and test scaling, not algorithm superiority.

The exploratory screen uses 12 deals (24 games) per comparison. Higher-budget
experiments use fresh seeds, fixed sample sizes, and are not stopped when a
favorable result appears. The percentile bootstrap resamples whole deals, keeping
seat rotations together; intervals are descriptive 95% intervals, not corrections
for multiple comparisons. Small samples cannot establish small improvements.

## Results

184 full games across seven search-versus-search comparisons completed without
invalid actions or turn-limit failures.

All comparisons below use the original production policy as the opponent unless
specified. Win share includes fractional credit for shared victories. Intervals
resample deals, not individual games.

| Candidate | Budget per side | Games | Candidate win share | 95% paired interval |
|---|---:|---:|---:|---:|
| 4-turn rollout | 30 / 30 ms | 24 | 41.7% (10/24) | 20.8–66.7% |
| 24-turn rollout | 30 / 30 ms | 24 | 29.2% (7/24) | 12.5–45.8% |
| Most-visited recommendation | 30 / 30 ms | 24 | 50.0% (12/24) | 33.3–66.7% |
| 24-turn rollout, fresh deals | 100 / 100 ms | 32 | 40.6% (13/32) | 21.9–59.4% |
| Current policy with more time, fresh deals | 150 / 30 ms | 32 | 59.4% (19/32) | 43.8–75.0% |

The depth-24 screening result is poor, but the exploratory comparisons have no
multiple-testing adjustment. At 100 ms it still does not outperform depth 12;
its interval includes parity. The 150 ms current-policy result is suggestive,
not decisive evidence of stronger play: its interval also includes 50%.

### Root coverage and throughput

Depth 24 at 30 ms failed to sample all legal root moves on 164/810 decisions
(20.2%) and recommended a move supported by only one sample on 184/810 decisions
(22.7%). At 100 ms neither depth suffered these issues in its tournament.

On 24 separate fixed positions spanning two- and three-player games, after four
excluded warmups and rotating budget order across positions:

| Budget | Mean simulations | Decisions with incomplete coverage | One-sample recommendations |
|---|---:|---:|---:|
| 30 ms | 39.8 | 0/24 | 0/24 |
| 150 ms | 194.7 | 0/24 | 0/24 |
| 500 ms | 625.5 | 0/24 | 0/24 |

An initial cold-start scan, with budgets run in ascending order, had 3/24
incomplete roots and 5/24 one-sample recommendations at 30 ms. The corrected
warmup/order-controlled scan above did not reproduce those failures on these
positions. Its raw results replace that preliminary diagnostic. This sensitivity
is why the full-game counters, rather than a cold-start microbenchmark, support
the coverage conclusion. Across the fresh 2/3/4-player budget tournaments, the
30 ms opponents made 181 one-sample recommendations in 4,768 decisions (3.8%);
the 150 ms agent made none in 2,486 decisions.

These are server measurements; one sample is a reliability warning, not proof the
move is wrong. Complete coverage also does not mean adequate convergence. The
fixed positions are a diagnostic sample, not a representative human-play dataset.

### Multiplayer

One 150 ms agent plays against 30 ms copies of the same policy, rotating through
every seat. These are unequal-budget scaling tests, not algorithm comparisons.

| Players | Games / deals | Higher-budget win share | Neutral share | 95% paired interval |
|---|---:|---:|---:|---:|
| 3 | 24 / 8 | 58.3% (14/24) | 33.3% | 41.7–79.2% |
| 4 | 24 / 6 | 37.5% (9/24) | 25.0% | 25.0–54.2% |

The three-player result supports a benefit from additional compute in this matchup.
It is still only eight independently generated deals, with broad uncertainty and
no claim about unrelated opponents or human strength. The four-player interval
reaches the neutral share; its six-deal result is inconclusive.

## Reproduce

```
# Exploratory screens, one command at a time to avoid CPU contention.
npm run benchmark:splendor-search -- --pairs=12 --horizon=4 --ms=30
npm run benchmark:splendor-search -- --pairs=12 --horizon=24 --ms=30
npm run benchmark:splendor-search -- --pairs=12 --horizon=12 --rule=visits --ms=30
# Fresh deals, deeper search at equal time.
npm run benchmark:splendor-search -- --pairs=16 --seed=891001 --horizon=24 --ms=100
# Fresh deals, more time for exactly the current policy.
npm run benchmark:splendor-search -- --pairs=16 --seed=972001 --horizon=12 --ms=150 --opponent-ms=30
# One higher-budget agent against faster search opponents, rotated through every seat.
npm run benchmark:splendor-search -- --pairs=8 --players=3 --seed=1083001 --horizon=12 --ms=150 --opponent-ms=30
npm run benchmark:splendor-search -- --pairs=6 --players=4 --seed=1194001 --horizon=12 --ms=150 --opponent-ms=30
# Root coverage at 30 / 150 / 500 ms on fixed public positions.
node scripts/diagnose-splendor-search.mjs /tmp/splendor-diagnostics.json
```

Use `--out=path.json` to save results. JSON includes seeds, configuration, hardware,
per-game scores and winners, and aggregate work/timing. `--iterations=N` switches
to deterministic fixed-work comparisons (not equal time when horizons differ).
The later experiments also record each decision's simulation count and a digest
of the action sequence. `--replay=path.json` reruns those exact simulation counts
to check the entire game trajectory despite wall-clock nondeterminism. The three early
screens predate trace capture; their configurations remain rerunnable,
but their exact timed choices cannot be reconstructed.

## Scope and remaining strength questions

The production engine under evaluation is commit
`af1eed924cdad38923712443ae0c0cb023b052b1`; this study does not silently tune it
on the test deals. These comparisons isolate depth, root recommendation and time.
They do not establish human Elo or a calibrated chance of winning. A longer
rollout still follows a heuristic policy; it does not add adversarial tree search
at future decisions. Shared policy blind spots can survive every comparison here.

An independently implemented strong opponent and human games remain necessary to
establish absolute strength. Timings from this server also do not establish iPad
Safari throughput. Continuous browser analysis can accumulate more work than these
short decision budgets, so the coverage diagnostic includes a 500 ms budget.

## Decision

Keep the existing 12-turn horizon and mean-utility recommendation. None of the
matched-time variants demonstrates an improvement sufficient to promote. More
compute improves sampling coverage and shows a positive three-player result; the
two-player win-rate estimate alone does not establish a strength gain. No production AI, UI or rules are changed by this
study.

The next strength-development step should test improvements to the future-play
policy and position evaluation, with an independently implemented opponent and
held-out deals. Retain these paired tournaments as a regression baseline. Do not
label this engine expert-level or translate its utility scores into win chances
from these results.

## Verification

All 84 automated tests and syntax checks passed locally. The new tests cover fixed
work reproducibility, both root recommendation rules, the deal-level bootstrap,
seat rotation and game replay. One recorded full game from each of the four
trace-enabled tournaments was replayed and its complete action digest verified.
The original hidden-information invariance tests remain in the suite.
