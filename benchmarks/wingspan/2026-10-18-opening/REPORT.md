# Opening experiment: prior evidence and diagnostic replay

Practical-combined remains the reference and production evaluator. The completed
final-selection tournament produced no qualifying challenger:640/640 games
completed, zero recorded rollout caps/errors, and no method met both55% win share
and positive margin. The frozen decision retained practical-combined; no
held-out confirmation games were run. This is a completed unfavorable result,
not a paused selection or evidence that the nearest candidate should be promoted.

## Prior final selection

[prior-final-summary.json](prior-final-summary.json) records all eight aggregated
matchups, source checkpoint SHA256, canonical640-record hash, per-game manifest
hash, selection and decision. The runtime source is
`C:\Users\mason\.codex\benchmark-runs\wingspan-final-20261018`.
Each method had80 games at300 belief samples, depth4, against practical-combined
with identical settings, using40 seat-swapped seed pairs. Intervals below are
95% t39 intervals over paired seed means (critical2.02269), descriptive and
unadjusted for screening. The640 game records are not640 independent trials;
methods reuse the same40 seeds and games within a seat pair share a seed.

| Evaluator | W-D-L | Win share (paired95%CI) | Mean margin (paired95%CI) |
| --- | ---: | --- | --- |
| final-cautious-portfolio | 43-0-37 | 53.750% [43.3,64.2]% | +0.400 [-2.025,+2.825] |
| final-development-options | 40-0-40 | 50.000% [37.5,62.5]% | +0.150 [-2.840,+3.140] |
| final-robust-saturation | 36-2-42 | 46.250% [35.3,57.2]% | -1.575 [-4.194,+1.044] |
| final-space-robust | 38-0-42 | 47.500% [38.0,57.0]% | -0.362 [-2.772,+2.047] |
| final-space-robust-saturation | 29-0-51 | 36.250% [26.7,45.8]% | -3.625 [-5.629,-1.621] |
| final-space-saturation | 43-1-36 | 54.375% [44.2,64.6]% | +0.688 [-1.963,+3.338] |
| robust-value | 43-1-36 | 54.375% [44.5,64.3]% | -0.738 [-2.936,+1.461] |
| slot-scarcity | 41-1-38 | 51.875% [41.6,62.2]% | +0.450 [-1.913,+2.813] |

Robust-value and final-space-saturation were closest at54.375%, below the55%
threshold; robust-value also had negative mean margin. The three-way blend
final-space-robust-saturation was negative on both descriptive paired intervals.
Combining plausible prior signals did not establish a stronger evaluator.

## New opening hypothesis and fixed comparison

The next experiment separates setup choice expansion from opening evaluation:
`setup-only` expands actual candidate setup roots while retaining practical-combined;
`eval-only` (opening evaluation only) changes the opening leaf value while retaining existing setup
roots; `both` applies both changes. These are three challengers against the same
practical-combined reference, not a claim that openings caused prior failures.
Keep the existing production default while testing this narrower hypothesis.

Screen each challenger for80 games (40 seat pairs), at300 samples/depth4.
Advance at most the top two with all80 valid, win share>=55% and mean margin>0,
ranked by win share then margin. Each finalist receives200 fresh games
(100 seat pairs), with the same fixed paired gate used by final selection:
approximate one-sided97.5% win-share lower bound>0.5 using t99=1.9842169515,
positive mean margin and all200 valid complete games/100 pairs. At most two
finalists gives an approximate Bonferroni5% family false-promotion limit,
conditional on the paired-t assumptions. Zero qualifiers or no passing held-out
candidate retains practical-combined. Maximum cost is240 screen+400 confirmation
=640 games; this report does not launch that tournament.

Screen seeds2928400+997*i (i=0..39); confirmation3038400+997*i (i=0..99), both
seats. The140 new seeds were checked against328 unique completed historical
Wingspan seeds, including the final-selection40: zero overlap. The [opening runner](../../../scripts/benchmark-wingspan-opening.mjs)
manifest owns the authoritative method names, setup root limits and hash-frozen
implementation. Search samples, candidate enumeration costs and root counts must
be reported separately rather than equating equal sample counts with equal time.

## Descriptive reference pilot

Select one weak, typical and strong prior baseline-margin seed. Replay the actual
prior slot-scarcity versus practical-combined tasks at both seats, preserving
evaluators, budgets, seeds and search configuration (300 samples/depth4).
The reference player is1-seat. The task method isreference, so opening setup
expansion is disabled; this is instrumentation of the prior matchup. Strata are
based on mean baseline margin across the prior final tournament's16 games per
seed, not true opening difficulty or prospectively randomized test categories:
weak2730334(-4.375 points), typical2728340(+0.625), strong2724352(+6.375).
These are intentionally diagnostic historical seeds and are excluded from new
screen/confirmation seeds. They cannot estimate comparative opening strength.

The first attempt was stopped before any game completed to correct metric
coverage for white extra bird placements and candidate-generation time. Its
original manifest remains at `wingspan-opening-diagnostics-20261018`; no hashes
or results were silently replaced. A fresh `wingspan-opening-diagnostics-v2-20261018` directory retains corrected
replay source hashes, six task records, expected original scores/margins and an
explicit reproducedPriorScores flag. Only exact-score matches establish replay
reproduction; descriptive metrics alone do not establish it. Replays use at most two concurrent
games and must finish or stop before the full24-worker tournament is launched.

Metrics include kept cards/bonus/food, first/second placed bird own main-action
numbers (including extra placements), food actions before each, round1 food and
eggs, pre-goal score, row lengths/basic production, search samples, root counts,
unvisited roots and candidate enumeration time. Basic row production is an
output-count vector, not an estimate of actual engine income. A missing second
bird by round1 is a meaningful absence and must not be replaced with a zero-cost
play. Six selected reference replays are a small descriptive pilot; they cannot
support an opening treatment effect or a calibrated opening policy.

### Completed pilot observations

All six corrected replays completed and exactly reproduced their original final
scores and margins. The pilot process has exited; no replay workers remain.
Source hashes and all twelve players' opening metrics are preserved in the
`diagnosticReplay` section of prior-final-summary.json. The table below reports
only the practical-combined reference player (player1-seat, zero-based). F/G/W
means forest/grassland/wetland. Bird-action numbers count own main actions;
white extra placements share the triggering action number. Score is actual
round1 score before its goal award, including bonuses already earned.

| Stratum/seed, challenger seat | Reference player | First bird action | Second bird action | Food actions before first/second | Round1 F/G/W birds | Round1 F/G/W basic output | Round1 food / eggs | Pre-goal score |
| --- | ---: | ---: | ---: | --- | --- | --- | --- | ---: |
| weak 2730334, seat0 | 1 | 1 | 5 | 0/1 | 0/1/1 | 1/2/1 | 2 / 3 | 13 |
| weak 2730334, seat1 | 0 | 1 | 8 | 0/3 | 0/0/2 | 1/2/2 | 3 / 1 | 16 |
| typical 2728340, seat0 | 1 | 2 | 7 | 1/1 | 0/0/2 | 1/2/2 | 3 / 3 | 10 |
| typical 2728340, seat1 | 0 | 2 | 4 | 1/1 | 0/0/2 | 1/2/2 | 3 / 1 | 11 |
| strong 2724352, seat0 | 1 | 1 | 5 | 0/2 | 1/1/0 | 1/2/1 | 2 / 4 | 14 |
| strong 2724352, seat1 | 0 | 3 | 5 | 1/1 | 1/2/0 | 1/3/1 | 0 / 1 | 16 |

| Stratum/seed, challenger seat | Kept bird ids | Kept food | Bonus id | First/second placement (bird id, habitat) |
| --- | --- | --- | ---: | --- |
| weak 2730334, seat0 | 29,90,84 | invertebrate:1, seed:1 | 23 | 90 grassland / 112 wetland |
| weak 2730334, seat1 | 59,3,127 | seed:1, fish:1 | 15 | 3 wetland / 59 wetland |
| typical 2728340, seat0 | 12,164,94 | fruit:1, rodent:1 | 3 | 12 wetland / 109 wetland |
| typical 2728340, seat1 | 150,131,162 | invertebrate:1, seed:1 | 20 | 162 wetland / 131 wetland |
| strong 2724352, seat0 | 59,168,40 | seed:1, fish:1 | 8 | 40 grassland / 18 forest |
| strong 2724352, seat1 | 62,73,106 | seed:1, rodent:1 | 13 | 156 forest / 73 grassland |

First bird actions were 1,1,2,2,1,3; second bird actions were 5,8,7,4,5,5. The immediate first birds in the weak stratum contradict a universal delayed-first-bird
explanation. The observed spread instead suggests examining development sequencing
and the second placement, while allowing that a later placement may be correct
for a particular hand, engine or goal. All six references had two birds by round1;
this pilot does not show that adding bird count alone would improve their outcomes.
The strata were selected from prior outcomes, the matchups share a single fixed
challenger and the sample is only six games. There is no opening-treatment effect
estimate, randomized diagnosis or evidence to change the default here.

Candidate generation and search timings were recorded separately per player;
wall-clock values are descriptive and hardware/load-dependent. No unvisited
search arms or rollout safety caps were recorded in these six replays. The new
opening screen remains a prospective test on fresh seeds, not these diagnostic
replays.

Validation: prior-summary consistency checks ran during
aggregation (all640 complete, eight groups of80,40 complete pairs per group,
source hashes, no fresh-seed overlap); all six pilot result assertions passed.
The coordinator's full suite passed704 tests, syntax211files and documentation38
files before these final report observations were added. No full opening
tournament was launched by this diagnostic task.
