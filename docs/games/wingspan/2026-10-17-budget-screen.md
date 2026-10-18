# Bounded search screen — completed

Question: do 30 or 100 belief-rollout iterations provide useful internal play
against the existing heuristic, and does increasing this modest budget help?
This is an exploratory screen, not human-strength or release evidence.

Engine baseline: `4b412f84ddaca960e6b23b0980f3ecb5d8fd07a3`.
The runner manifest records the exact committed runner revision at launch.
No engine, candidate generator, utility, or UI behavior is changed by this study.

## Frozen design and stopping rules

`scripts/benchmark-wingspan-screen.mjs` freezes all seeds and budgets. Each of
30 and 100 iterations plays the 100-iteration heuristic over six seeds, with
both candidate seats on the identical initial deal (12 games per budget).
100 versus 30 uses four separate seeds and both candidate seats (8 games).
The initial starter is seed parity. Total: 32 games, 2 players, horizon 4.
Calibration seed 817030 is excluded from scored seeds.

An iteration allocates one action sample using UCB over the representative
candidate set. Belief samples use invented hidden worlds and a truncated
horizon; these are not full-game playouts. The heuristic is sampled utility,
not the distinct greedy policy. Both policies receive redacted observations.
Record total candidate alternatives and unvisited alternatives: small budgets
can leave candidates unexamined and candidate enumeration is not exhaustive.

One sequential process, below-normal priority, is sufficient. Each complete,
failed, or capped game is atomically written before the next game starts.
Stop at the first failure or 600-action cap. Such games carry no scores/wins.
Completed game files permit restart using the identical command/revision;
the manifest rejects configuration or revision changes. No adaptive stopping
on favorable scores, budget escalation, or tuning on these seeds.

## Calibration and validation

On this Windows host, baseline command:

```text
node scripts/benchmark-wingspan-ai.mjs --games=1 --samples=100 --method=belief-rollout --opponent=heuristic --seed=817030
```

completed in 6,608 ms, 64 candidate searches / 6,400 belief iterations,
973 belief iterations/second. This suggests a few minutes for the full
screen; host load and head-to-head cost can change that. Selected 30/100
rather than 300 because this is a bounded practicality screen.

Prelaunch validation passed: 259 existing Wingspan tests; verifier completed
20 games / 2,960 actions / 1,070 powers. Its nine unexercised power codes remain
uncovered: 9, 15, 18, 48, 52, 54, 62, 63, 65. Three new harness checks cover
batch/single-iteration equivalence, deal/seat pairing and cap invalidation.

```text
node --test test/wingspan*.test.js
node scripts/verify-wingspan.mjs
node scripts/check-docs.mjs
node scripts/benchmark-wingspan-screen.mjs --out=C:\Users\mason\.codex\benchmark-runs\wingspan-20261017
```

Runtime manifest, individual game checkpoints, checkpoint summary, stdout and
stderr stay outside Git at the output directory above. The runner skips existing
game records, including failure records; diagnose failures before a fresh run.
The final checkpoint distinguishes planned, finished and successfully complete
games; never divide wins by planned games before all games succeed.

## Completed results

Completed all 32 games on 2026-10-17 at runner revision
`a72410537c04af1628d41043756fcb887a923c75`, with zero failures/caps.
The sequential below-normal process took 234.23 seconds summed across games.
[Retained results](../../../benchmarks/wingspan/2026-10-17-budget-screen/results.json)
contain every game's score/counters, paired summaries and the original
checkpoint SHA-256. Millisecond fields in individual retained games are rounded.

| Comparison | Wins / games | Mean score margin | Mean game time | Mean search time / decision |
| --- | --- | --- | --- | --- |
| 30 vs heuristic 100 | 9 / 12 | +17.42 | 3.91 s | 34.79 ms |
| 100 vs heuristic 100 | 11 / 12 | +15.67 | 9.82 s | 86.42 ms |
| 100 vs 30 | 5 / 8 | +6.00 | 8.67 s | 83.32 ms |

Wins use the engine's final food tie-break; one 30-iteration win had equal
printed scores. Search time includes both actors and all phases, and does not
establish candidate-only decision latency. Counts of iterations likewise combine
both actors and the two methods in baseline games.

For baseline seeds 817101, 817103, 817107, 817109, 817111, 817117, the paired
mean-margin changes (100 minus 30) were +2, -10.5, -8.5, -16, +18, +4.5.
Three of six improved; the overall change was -1.75 points despite more wins.
Head-to-head paired mean margins for 100 were +10, -9, -6, +29: two positive
seed pairs out of four. Seat 0 won seven of eight head-to-head games: the
100-iteration policy won 4/4 as seat 0 and 1/4 as seat 1.
Every frozen seed is odd, so the starter was seat 1 in all games;
candidate seat was balanced, but the physical starter seat was not. These small
seed counts and seat effects prevent a reliable strength ordering.

The 30-vs-heuristic block left 65 of 10,528 enumerated action alternatives
unvisited; 100-vs-heuristic left none of 10,465, and head-to-head left one of
6,214. These sum per-decision candidates across both actors, not distinct legal
actions. Candidate pruning and short rollout horizons remain limitations even
when all generated alternatives receive a sample.

Outcome: both modest budgets passed this internal baseline screen. Increasing
to 100 cost about 2.51 times the mean full-game time against the heuristic,
without consistent paired margin improvement. Budget superiority is inconclusive;
no default policy change or further tournament is authorized by these results.
No full action trace was retained, so the completed run does not establish
independent replay validation. Runtime `assertValid` checked each applied state.
Known independent interaction, real-table, iPad and provenance/release gates in
the overview remain open.
