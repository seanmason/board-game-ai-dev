# Evidence synthesis before final selection

Practical-combined remains the supported default. Across the latest two completed
large batches, no screened winner confirmed superiority over it on fresh seeds.
The final combination tournament is an additional experiment, not a deployment
recommendation. This report records evidence available before that tournament;
its results must be appended separately without reinterpreting the earlier data.

## Evidence inventory

[evidence-summary.json](evidence-summary.json) contains every matchup and paired
interval extracted from all fourteen available Wingspan runtime checkpoint files:
4,690 completed game records, not 4,690 independent trials. Seat pairs and reused
seeds across matchups are correlated. Runtime sources are under
`C:\Users\mason\.codex\benchmark-runs`; source paths, revisions, timestamps,
selection rules, matchup configurations and incomplete pairs are preserved in
that machine-readable file. Original checkpoint-byte SHA256 values and a per-game
file/hash manifest are included for durable audit. All retained per-game JSON files
were checked against checkpoint task ids, deduplicated by run+taskid: no additional
completed records were missing, including the three incomplete/halted studies.
Checkpoints are snapshots, not independently audited
rule correctness or physical tabletop strength evidence.

| Runtime study suffix | Completed/planned | Interpretation |
| --- | ---: | --- |
| wingspan-20261017 | 32/32 | Initial smoke/heuristic comparison |
| scaling-20261017 | 168/168 | Heuristic and rollout budget comparisons |
| 10000-vs-300-20261017 | 19/20 | Historical incomplete/halted sample; one planned game missing |
| depth-20261017 | 72/72 | Six small depth comparisons |
| depth-budget-20261017 | 108/108 | Nine small depth/budget comparisons |
| depth-budget-3000-20261017 | 11/72 | Historical incomplete/halted sample; do not treat as completed selection |
| depth-budget-confidence-20261017 | 0/720 | No completed evidence; historically queued/halted |
| evaluators-20261018 | 320/320 | Eight evaluator screen |
| evaluator-confirmation-20261018 | 160/160 | Fresh practical-combined and budget checks |
| refinements-20261018 | 120/120 | Three refinement screen |
| specialists-20261018 | 120/120 | Three specialist/investment screen |
| diverse-20261018 | 656/656 | Twelve-method 576-game screen plus 80 confirmation games |
| expansion-20261018 | 1,512/1,512 | Twenty-four-method 1,152-game screen plus 360 confirmation games |
| realizable-20261018 | 1,392/1,392 | Twenty-four-method 1,152-game screen plus 240 confirmation games |

The latest completed stages are dated 2026-10-18T03:51:37Z (expansion,
revision b04ce49995ce59e808bbf69d88836e4ec82960b2) and
2026-10-18T04:38:35Z (realizable,
revision 1590f834f8cba29626544ccec0593105f5f5fd4d).
No recorded result in the fourteen checkpoints has an error/non-complete status.
Recorded rollout safety-cap counts sum to zero. Some older result formats do not
include rollout diagnostics, so zero there means no recorded cap, not verified
absence; diagnostic coverage is explicit in the JSON. Missing planned games in
halted studies are not fabricated as losses, successes or error-free completions.

## Earlier repository and cloud evidence

The retained [gameplay/AI review](../../../docs/WINGSPAN_GAMEPLAY_AND_AI_REVIEW.md)
also records pre-desktop tests. At 12 samples and four-action continuation, rollout
win shares versus greedy/stochastic opponents were 95.8%/100% in 24 two-player
games per opponent, and 100% in 15 three-player games versus greedy. The older
method scored 83.3%/95.8%/86.7% respectively. These are historical report-level
results against weak opponents, not fresh comparisons among today's evaluators.
The linked cloud workflow was not rerun or independently re-audited here.

A retained [timed result](../../results/wingspan-time-budget-2026-10-17.json)
records 19/24 wins and +12.88 mean margin versus heuristic search, with 20 ms per
decision, depth 4, alternating AI seat and rotating starter; a preceding reported
12-game pilot won nine. Hardware-dependent sample overruns and older opponents
make these unsuitable for pooling with the 4,690 fixed-budget desktop records.
They support the original move to hidden-world rollouts, not selecting a new leaf.

## Uncertainty and pairing

Two seat-swapped games share a seed. All intervals below use the mean of those
two games as one observation, not two independent observations. They are 95%
Student-t intervals over complete seed-pair means (30 pairs in each latest
confirmation; t29=2.045). Draw share uses the actual recorded outcome, including
food tie-break outcomes, rather than assuming every tied point score is a draw.
Intervals are descriptive, unadjusted for selecting among many screened variants,
and conditional on this simulator, opponent, candidate pruning and search budget.
Seed pairs missing one seat are excluded from interval estimates and reported
separately in JSON. High-degree-of-freedom critical values use a standard t-quantile
expansion; the latest confirmation intervals use the explicit table value.

## What earlier experiments established

The original rollout beat the basic heuristic in small tests, but adding rollout
budget or depth was inconsistent against itself. Depth/budget screens had twelve
games per comparison, with broad paired intervals. Interrupted 3,000/10,000-budget
studies and the zero-game confidence study cannot establish a benefit.

Practical-combined has the clearest fresh evidence over the original evaluator:
28/40 wins at budget100 (70%, margin +3.625, paired margin CI [+0.423,+6.827]);
24/40 at budget300 (60%, +4.925, CI [+0.547,+9.303]). Raising practical-combined
from100 to300 gave27/40 (67.5%, +4.575, CI [+0.786,+8.364]); the corresponding
original-evaluator budget comparison was17/40 (42.5%, -0.900). These small studies
support retaining practical-combined, not claims of broad human-level strength.

Point-only and usable-resource-only variants underperformed in the first screen.
The action-budget planner was particularly bad (6/40, -10.2 points), demonstrating
that more explicit arithmetic planning is not automatically a better leaf value.
Bottleneck-engine (56.25%, +1.775), investment-payback (57.5%, +1.6), and
specialist-payback (55%, +1.975) did not qualify for confirmation. Pure habitat
specialization was negative. The later row-unlocks screen reached63.54%, +3.25,
but fresh confirmation against practical-combined was18 wins,1 draw,21 losses
(46.25%, +0.175). It beat the older evaluator26/40, which does not establish an
improvement over practical-combined.

## Latest expansion: screens versus fresh confirmation

All expansion screens used48 games per method at budget100, depth4; selection
required all48 valid, win share>=60%, positive mean margin, then at most the top
four. Slot-scarcity (66.67%, +3.104), forest-foundation (60.42%, +2.729), and
adaptive-portfolio (60.42%, +2.125) qualified. Bonus-card-option had +3.354 points
but only54.17% win share; grassland-foundation57.29%, +2.271; white-power-payback
57.29%, +0.563. Their positive screens are unconfirmed suggestions.

Fresh confirmation used60 games per matchup at budget300, depth4:

| Candidate vs opponent | W-D-L | Win share (paired95%CI) | Mean margin (paired95%CI) |
| --- | ---: | --- | --- |
| slot-scarcity vs practical-combined | 30-1-29 | 50.83% [38.7,63.0]% | +2.067 [-1.129,+5.262] |
| forest-foundation vs practical-combined | 24-0-36 | 40.00% [27.6,52.4]% | -2.167 [-4.734,+0.401] |
| adaptive-portfolio vs practical-combined | 28-0-32 | 46.67% [36.9,56.4]% | -1.117 [-3.772,+1.539] |
| slot-scarcity vs row-unlocks | 32-0-28 | 53.33% [41.4,65.3]% | +0.167 [-2.428,+2.761] |
| forest-foundation vs row-unlocks | 33-0-27 | 55.00% [43.7,66.3]% | +1.000 [-1.636,+3.636] |
| adaptive-portfolio vs row-unlocks | 30-1-29 | 50.83% [36.9,64.8]% | -0.733 [-4.354,+2.888] |

Slot-scarcity remains a useful control because its fresh margin is positive with
approximately even win share. Forest/adaptive screen gains regressed; do not
justify heavy new weights for them as confirmed improvements.

## Latest realizable batch

Again48 games per screen at100/depth4. Robust-value (64.58%, +1.229) and
predator-expectation (62.50%, +3.125) qualified. Engine-saturation was54.17%,
+2.083; two-bird-plan57.29%, +0.229; most shared-budget, goal-transition and
resource-cap corrections were neutral or negative. More faithful resource
accounting alone again failed to produce a clear competitive gain.

Fresh60-game confirmations at300/depth4:

| Candidate vs opponent | W-D-L | Win share (paired95%CI) | Mean margin (paired95%CI) |
| --- | ---: | --- | --- |
| robust-value vs practical-combined | 32-0-28 | 53.33% [41.4,65.3]% | +0.533 [-1.763,+2.830] |
| predator-expectation vs practical-combined | 22-2-36 | 38.33% [27.4,49.2]% | -1.700 [-4.318,+0.918] |
| robust-value vs slot-scarcity | 27-0-33 | 45.00% [32.6,57.4]% | -0.033 [-2.911,+2.845] |
| predator-expectation vs slot-scarcity | 31-0-29 | 51.67% [42.5,60.8]% | +0.933 [-1.650,+3.516] |

Robust-value is a reasonable second control. Predator-expectation's screen win
did not transfer to baseline confirmation; its paired win interval is below50%
in this descriptive comparison. It should not anchor a new combination.

## Frozen final candidates and protocol

There is no confirmed new improvement to combine. The final preregistered
experiment retains practical-combined as baseline and includes slot-scarcity and
robust-value as controls, plus the six authoritative blends in
[final-methods.md](../final-methods.md). Let S=slot-scarcity, R=robust-value,
E=engine-saturation, B=bonus-card-option, G=grassland-foundation and
T=tuck-card-opportunity. Every blend is added to practical-combined and clamped
after weighting to [-4,+4].

| Final blend | Adjustment before clamp |
| --- | --- |
| final-space-robust | .5S + .5R |
| final-space-saturation | .5S + .5E |
| final-robust-saturation | .5R + .5E |
| final-space-robust-saturation | (S + R + E)/3 |
| final-development-options | .35S + .35B + .30G |
| final-cautious-portfolio | .25S + .25R + .25E + .25T |

The first four isolate structural opportunity cost, robust realization and
production saturation; the fifth tests discounted bonus choice/egg development;
the sixth shrinks four complementary hints. These are combinations of existing
mechanisms, not six new mechanisms or fitted estimates. Slot/robust have the
least unfavorable latest confirmation; other components have screen-only
support. Correlation and winner's-curse regression remain plausible. Unfavorable
fresh forest/adaptive/predator results are not used as major new weights.

The frozen [runner](../../../scripts/benchmark-wingspan-final.mjs) screens eight
candidates/controls with80 games each (40 fresh seat pairs), all budget300,
depth4, safety step limit48, against practical-combined at the same settings.
Require all80 valid, win share>=55% and mean margin>0. Rank qualifiers by win
share, margin, then lexical evaluator name; advance at most two. Each finalist
receives200 independent fresh games (100 seat pairs) against practical-combined.
Maximum total is640+400=1,040 games. Zero screen qualifiers means no confirmation
and practical-combined is retained.

Promotion requires all200 valid unique confirmation games and100 complete seed
pairs, positive mean margin, and an approximate paired-t one-sided97.5% lower
win-share bound above0.5 using t99=1.9842169515. With at most two finalists this
is an approximate Bonferroni5% family false-promotion limit, conditional on the
paired-t assumptions. Screen data are not pooled into held-out estimates. If
multiple finalists pass, choose highest lower bound, then mean margin, fewer
name components as deterministic simplicity tie-break, then lexical name.

Screen seeds are2708400+997*i, i=0..39, both seats. Confirmation seeds are
2818400+997*i, i=0..99, both seats. These are140 distinct new seeds; the coordinator
verified zero overlap with288 historical unique seeds. Source hashes, frozen
plan and expected tasks are saved in the runtime manifest. The runner emits
selection.json and decision.json, with practical-combined as fallback whenever
no finalist passes. No default is installed before evaluation; a passing decision
is evidence for a subsequent explicit implementation step, not an automatic edit.

This report is the pre-execution evidence snapshot. Final outcomes must be
recorded separately without changing candidates, seeds or gates after seeing
results. This synthesis launched no games and changed no evaluator source.
