# Two-player compact self-play — October 19, 2026

Decision: preserve production opening-plan, expanded setup and horizon 4. The
compact residual model passed both fresh research confirmation gates. This
establishes useful learned correction in the tested search system; production
integration and a direct comparison against the actual deployed package remain
separate gates.

The campaign completed all 4,064 games from 14:44:26.907 to 17:41:37.491 UTC
(2 h 57 min), before its unchanged 20:44:26.907 UTC deadline. Controller and
publisher exited normally after final publication. After the audit, only the prespecified confirmation and exploratory scaling
games ran; no model retuning or production promotion followed.

[Dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-selfplay)
· [Frozen protocol](../../plans/wingspan-selfplay-loop-2026-10-19.md)
· [Implementation and execution](../../work/wingspan-selfplay-2026-10-19.md)
· [Public source, models and receipts](https://github.com/seanmason/board-game-ai-dev/tree/benchmarks/wingspan-selfplay-2026-10-19/wingspan-selfplay)

## Model, data and search

Frozen executable source revision: `04b01cd84c9cc57b1d55099c7524f484e4eeb56e`.
All 105 guarded source files matched at closeout. Exact source archive SHA-256:
`a3dfed3d8aab23ea2bac0224df4daf634b0da2a1d2e4bb0f5209f2e6867b73d7`.
Final generation-3 model SHA-256:
`6131bafd429500d55fa5c60900923e6f46973a25905b3bb2df10ac7bb1922843`.
Original source and unsuccessful generations remain retained.

The network has 192 semantic observation inputs, hidden widths 32/16 with ReLU,
and a bounded ±10-point residual output (6,721 inference parameters). Inputs
preserve own private information, public opponent information and row/ability
summaries; opponent private cards, deck order and RNG state are unavailable.
Known scoring and reference arithmetic remain explicit. The learned correction
is added to the reference at both the root and settled rollout endpoint. A zero
correction reproduces reference rewards/allocations/actions at fixed work in the
preflight fixtures. The rollout policy remains fixed; this is value learning,
not a learned policy or full-tree self-play system.

There were 3,072 unique collection setups, exactly 1,024 per cycle. Each cycle
has 768 training, 128 development and 128 sealed audit groups; both viewers and
all turns stay in one split. Each split is seat-balanced. Training-only early
exploration affects exactly 154 groups per cycle; none of the development or
audit groups receives it. No calibration, screen, confirmation or scaling setup
overlaps the collection bank. Previously retained seed inventories were also
checked before launch. Games share the implementation/catalog, so independent
seeds do not establish independent rules correctness.

Collection independently requests 100 samples for 80% of decisions and 300 for
20%, at horizon four main actions across both players. Triggered powers settle
before leaf evaluation. These are total samples per decision, not per action;
mandatory supplied-root coverage can raise the count. Actual games finish for
terminal targets; imagined rollout endpoints are not independently labelled
training examples. Each game produces 104 correlated viewer observations.

Targets are eventual score margin minus an observation-only reference baseline
averaged over four sampled belief worlds. Normalization is frozen from the first
training batch. Fitting uses CUDA only between game batches, one fixed seed,
AdamW, residual Huber loss, a small auxiliary score-component loss, epoch zero,
early stopping and a linear residual control. CPU game pools used at most 24
BelowNormal workers; GPU fits did not overlap timed games.

## Development and exploratory succession

| Generation | Training / development groups | Selected epoch | Development MAE: NN / zero / linear | Screen vs incumbent | Screen vs reference |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 768 / 128 | 3 | 7.251 / 8.016 / 7.735 | 63.75%, +5.10 points | Same comparison; incumbent was R |
| 2 | 1,536 / 256 | 1 | 6.928 / 7.912 / 7.526 | 49.375%, −0.763 points | 63.75%, +5.613 points |
| 3 | 2,304 / 384 | 2 | 6.931 / 8.118 / 7.711 | 61.25%, +1.313 points | 71.25%, +6.088 points |

Each displayed screen uses 40 fresh setup pairs per distinct opponent at a
1,000 ms whole-decision request, horizon 4. Complete validity and latency gates
passed. Generation 2 failed advancement against generation 1 and remains
archived. Both generations 2 and 3 warm-start generation 1, the incumbent; these
are not three successive accepted improvements. Generation 3 passed its
exploratory advancement gate and was frozen before opening the audit.

Development pools and actor distributions change across generations. Their
aggregate error numbers cannot establish a same-distribution learning curve.
Checkpoint selection uses those development data, so the screen remains
exploratory. In generation 1, development error improved through epoch 3 and then
worsened while training loss continued falling: later epochs were rejected.
Neither this observation nor a successful screen establishes a capacity bottleneck.

## Once-only sealed prediction audit

The final frozen model was evaluated on 384 independent audit games, producing
39,936 correlated position/viewer observations. No checkpoint reselection or
training followed it. Training read receipts contain only train/development files;
the once-only audit receipt pins the final model and dataset identities.

| Evaluator | Audit Huber | Audit MAE, points |
| --- | ---: | ---: |
| Neural residual | 0.33305 | 6.710 |
| Zero correction / reference | 0.41189 | 7.655 |
| Linear residual | 0.38198 | 7.271 |

MAE is about 12.35% lower than reference. The model's own grouped bootstrap 95%
MAE interval is 6.335–7.054; this is not a paired improvement interval. Round-one
MAE is 9.238, declining to 4.054 in round four. These errors concern final margin
under the collection policies, not calibrated win probabilities or move quality.

Protocol omission: independent review found no executed evidence for the planned
fixed-training-subset sampling-noise check of the four-world label baseline.
Treat it as unexecuted. The labels are not known to be noise-free. This limits
offline residual interpretation and leaves a diagnostic for future training; it
does not invalidate the independent completed game confirmation below. No new
diagnostic games were added after seeing the sealed audit.

## Fresh confirmation and learned attribution

Two disjoint fresh banks each supplied 100 complete setup pairs / 200 games.
Both players requested 1,000 ms per complete decision at horizon 4. Ties count
as half a win. Intervals use the setup mean across both seats, with paired
approximate Student t bounds; each claim has one-sided alpha .025.

| Opponent | Wins / losses / ties | Winner share [paired 95% interval] | Mean margin [95% interval] |
| --- | ---: | ---: | ---: |
| Same-cost zero output | 151 / 47 / 2 | 76.0% [70.15, 81.85] | +7.615 [+6.110, +9.120] |
| Plain corrected reference R | 130 / 68 / 2 | 65.5% [59.61, 71.39] | +5.795 [+4.092, +7.498] |

Both frozen lower-share bounds exceed 50%; both margins are positive. A separate
reviewer and coordinator independently reproduced complete pairs and statistics.
The zero model preserves the encoder, normalization and hidden layers, zeroing
only the final output head. It supports useful learned correction within this
fixed search system, including changed allocations and trajectories. The plain-R
comparison shows that the practical advantage survives inference overhead.

The two opponent banks differ: the 10.5-percentage-point difference between their
shares does not isolate the cost of inference. Neither result isolates neural
architecture, iterative generation or greater model capacity as the cause, nor
does either directly compare against the actual deployed search package.

| Matchup / side | Decisions | Actual rollouts | Learned leaves |
| --- | ---: | ---: | ---: |
| Zero / candidate | 10,617 | 4,096,218 | 1,412,536 |
| Zero / zero control | 9,874 | 3,815,477 | 1,418,541 |
| R / candidate | 10,816 | 4,374,517 | 1,474,161 |
| R / reference | 10,109 | 4,211,318 | 0 |

Timed confirmation is not a fixed 100-sample comparison. Candidate mean latency
is about 1,001.8 ms; p99 is below 1,008 ms and maximum below 1,025 ms in both
comparisons. Validity and mean/p95/p99/max gates pass. Approximately 34% of
candidate endpoints receive a learned correction. Other endpoints use reference
fallback, including unsupported contexts and exact terminal handling. Supported
learned use is settled two-player digital observation with complete own private
information; physical advice and other unsupported states remain outside it.

## Exploratory compute scaling

These are fixed-sample, horizon-4 comparisons, not one-second-request matches.
Each uses 40 fresh setup pairs. No scaling result selected a checkpoint.

| Comparison | Wins / losses / ties | Winner share [paired 95% interval] | Mean margin [95% interval] |
| --- | ---: | ---: | ---: |
| NN 300 vs NN 100 | 45 / 35 / 0 | 56.25% [45.27, 67.23] | +2.825 [+0.117, +5.533] |
| R 300 vs R 100 | 48 / 32 / 0 | 60.0% [49.02, 70.98] | +2.913 [+0.033, +5.792] |

Both winner-share intervals include 50%. Positive point margins are exploratory
evidence consistent with useful compute, not fresh confidence-gated confirmation
of higher win rate. The two separate small comparisons do not establish a
network-versus-reference scaling interaction or a universal positive slope.

NN mean decision time was 1,089.30 vs 367.49 ms (2.964×); R was 950.02 vs 318.09 ms
(2.987×). Actual total rollouts were 1,299,300 vs 422,906 for NN, and 1,214,400 vs
398,306 for R. Per-decision work was exactly 300 versus approximately 100.001;
small low-budget excesses reflect supplied-root coverage.

Fixed-sample tails matter: NN300 p99/max were 2,835.8/5,103.6 ms; R300 were
2,839.8/5,037.7 ms. These exceed the timed-confirmation 2-second p99/5-second
maximum thresholds. Do not present fixed 300 samples as a guaranteed one-second
or practically validated default. Valid game completion does not imply a latency
pass for this setting.

## Failures, presentation corrections and remaining gates

All 4,064 games completed validly. Reported illegal actions, errors, caps,
unvisited supplied roots, unsettled leaves and coverage-floor overruns are zero.
This does not make candidate generation exhaustive or certify all card chains.
The previously reconstructed raven food-payment stall was repaired before this
campaign and preserves payment choices; see the execution record for replay and
21,420 comparison cases. No frozen campaign source was repaired during this run.

The frozen builder miscaptioned calibration with collection sample budgets, and
omitted explicit 300/100 values on scaling rows. Website captions now distinguish
1,000 ms calibration from sample-based scaling. Frozen snapshots are preserved.
Its generic training metric field also carries the audit MAE; the website labels
that row as sealed audit, rather than development. The automatic final analysis
receipt omits scaling, so this review and retained scaling records supply the
complete interpretation. No outcomes or source/model hashes were changed.

Production remains opening-plan, expanded actual setup and horizon 4. Before
promotion, run the planned direct deployed-package comparison and normal browser,
worker, observation-guard and physical-workflow checks. Actual iPad Safari,
real-table acceptance, multiplayer strength and human strength remain unestablished.

The user approved a separate 32/16 vs 64/32 capacity comparison with identical
192 inputs, matched train/development data and selection procedures, fresh paired
strength games and at most 28 BelowNormal workers. Do not reuse the now-opened
sealed audit for selection. More diverse data and a training-only baseline-noise
diagnostic remain worthwhile; this report does not start another campaign or
extend the completed campaign clock.
