# Practical Kingdomino and Carcassonne recommendations

Record type: evidence. Date: 2026-10-17. Outcome: adopt the simple Kingdomino
recommendation; retain a 30-sample Carcassonne checkpoint with optional extension
to 100. This is a small practical screen, not a claim of optimal play.

## Question and protocol

The preceding exploratory screen found Kingdomino search worse than its tuned
heuristic (30: 5/12 wins; 300: 2/12). Carcassonne 30 and 300 each won 8/12 against
the heuristic and split their direct eight-game contest. Those comparisons used
different setups from the fresh confirmations below.

We inspected existing losses and ordinary positions before freezing confirmation
seeds. Kingdomino's candidate uses the tuned heuristic for ordinary moves and the
existing exact final-row solver. Its opponent is unchanged search at 30 samples,
horizon 6, beam 12. Carcassonne's candidate is unchanged search at 100 samples,
horizon 3, compared with heuristic and search at 30. Each matchup contains six
fresh setups, each played from both seats: 12 games, 48 total. No outcome-based
early stopping or replacement seeds were used.

Kingdomino setup seeds are `48319271 + pairIndex * 104729`; Carcassonne seeds are
`1410172026 + pairIndex * 997`, with pairIndex 0 through 5. Candidate seat is
gameIndex modulo 2. The archive records exact initial settings, RNG schedules,
source hashes and full moves. Carcassonne's initial oversized launch and a serial
launch were stopped before any game was saved; the final 12-game-per-matchup run
used eight disjoint shards, with no missing or duplicate game indices.

## Results

| Candidate | Opponent | W–D–L | Mean score margin |
| --- | --- | --- | --- |
| Kingdomino heuristic + exact final row | Heuristic | 6–0–6 | 0 |
| Same Kingdomino candidate | Search 30 | 9–0–3 | +12.75 |
| Carcassonne search 100 | Heuristic | 8–0–4 | +8.50 |
| Carcassonne search 100 | Search 30 | 7–1–4 | +7.58 |

Kingdomino's paired mean margin against search was positive on all six setups.
The exact final-row solver showed no incremental gain over the heuristic in this
sample. Single-process replay timing averaged 12 evaluations per state: ordinary
decisions had median/p95 0.63/3.29 ms, and exact final decisions 1.36/5.17 ms.
These are percentiles of per-state average times, not an individual-call tail bound.

Carcassonne's 100-sample recommendation changed from its 30-sample recommendation
in 14/42 ordinary probes and 5/14 saved-game probes. This measures stability, not
correctness. Head-to-head mean decision wall times were 3.52 seconds at 100 versus
1.06 at 30, under eight-worker contention. Separate single-process calibration at
early/middle/late positions measured roughly 0.12/0.94/1.76 seconds for 30, and
0.32/3.08/5.96 for 100, including root preparation.

Six seed pairs give wide uncertainty: approximate paired-margin 95% t intervals
for Carcassonne were [-7.5, 24.5] versus heuristic and [-3.1, 18.3] versus 30.
The extra cost is clear; improved strength is only suggestive. No human-strength
or iPad performance conclusion follows. Policies share evaluators, and the
diagnostic positions were selected rather than a representative random sample.

## Diagnostics and decision

Kingdomino recommendations were sensitive to lookahead depth and, on some older
positions, to a common offset in heuristic priors blended with rollout scores.
The offset effect was absent on nine inspected recent loss states; it is not a
proven explanation or a validated fix. One selected 3,000-sample probe retained
the 30-sample recommendation. We chose the existing simple policy instead of
introducing another formula or a larger search.

Keep Carcassonne's evaluator and search unchanged; pause at 30 and let the user
continue the same search to 100. These are sampled short continuations, not full
games or calibrated win probabilities. More extensive testing is deferred unless
real play exposes a specific weakness worth addressing.

## Reproduction and retained evidence

The experiment ran on Windows, Node v24.19.0, Ryzen 9 5950X. The original execution
revision was `5cf0ba7ee3b06dcd8f86119730101258370be357`; integration started from
`4b412f8`. The tested AI source text matches the integration base after newline
normalization. Exact historical hashes remain in the archive.

Run from the repository root, with new output paths:

```sh
node scripts/benchmark-kingdomino-practical.mjs --candidate=tuned-exact --games=12 --seed=48319271 --opponent=tuned --output=kingdomino-heuristic.json
node scripts/benchmark-kingdomino-practical.mjs --candidate=tuned-exact --games=12 --seed=48319271 --opponent=search --opponent-iterations=30 --opponent-horizon=6 --opponent-beam=12 --output=kingdomino-search30.json
node scripts/evaluate-carcassonne-budget.mjs --scenario=100-vs-heuristic --seed=1410172026 --out=carcassonne-heuristic.json
node scripts/evaluate-carcassonne-budget.mjs --scenario=100-vs-30 --seed=1410172026 --out=carcassonne-search30.json
node --test test/carcassonne-budget.test.js test/carcassonne-replay.test.js
```

The runners preserve fixed iteration settings; machine contention changes timing.
The Carcassonne runner can select disjoint indices with `--game-indices=0,1,2` and
separate `--out` paths. Its checkpoints refuse mixed-source or mixed-plan resumes.
Its replay fix reads recorded `gameSeed`, validates it, and verifies observed draws.

[Summary](summary.json), [Kingdomino plan](kingdomino-plan.json),
[Kingdomino findings](kingdomino-findings.json), and
[Carcassonne calibration](carcassonne-calibration.json) are compact evidence.
[Full confirmation records](confirmation-traces.json.gz) contain all 48 games;
[artifact metadata](artifact.json) gives the archive SHA-256. Decode with Node's
`gunzipSync` or a standard gzip reader. The committed archive avoids dependence
on the original desktop paths. Worker folders, launch logs and the one-off live
dashboard are intentionally excluded from the repository.

All 24 Kingdomino games passed independent legal-action, transition, score and
winner replay checks. All 24 Carcassonne games passed graph/scoring replay and
termination checks. Parent aggregation verified uniqueness, complete seat pairs,
recorded outcomes and final scores. The oracle implementations share component
catalog facts and do not independently certify every printed component.
