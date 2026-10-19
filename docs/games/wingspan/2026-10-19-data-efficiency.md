# Two-player Wingspan data efficiency — October 19, 2026

Decision: retain the previous generation-3 research teacher and preserve production
opening-plan, expanded setup and horizon 4. Mostly one-step generation supplied
about four times as many complete examples per collection time, but the fitted
hybrid-data model did not improve playing strength in the fixed exploratory
screen. No confirmation, teacher replacement, extra cycle or production promotion
followed. This is an unfavorable valid result, not an infrastructure failure.

The bounded pilot completed 1,680 valid games in 37.81 minutes, from
18:22:19.312 to 19:00:08.170 UTC. Its original 21:22:19.312 UTC deadline remained
unchanged. Controller and publisher exited after normal terminal publication.

[Dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-data-efficiency)
· [Frozen protocol](../../plans/wingspan-data-efficiency-2026-10-19.md)
· [Implementation and execution](../../work/wingspan-data-efficiency-2026-10-19.md)
· [Public evidence](https://github.com/seanmason/board-game-ai-dev/tree/42a9ac1ee7d1b8b8ace5094b6e162539ab27a2df/wingspan-data-efficiency)

## What changed and what stayed fixed

Both collection arms used the same frozen 192-input, 32/16 residual network,
normalization, opponent mixture, candidate roots and setup search. The searched
arm requested 100 samples for 80% of decisions and 300 for 20%. Search horizon 4
counts four subsequent main actions after the root; triggered powers settle.

The hybrid arm kept setup searched. On subsequent decisions it selected 80% cheap
and 20% original search. A cheap main decision compared one separately sampled,
redacted-belief successor per candidate, settling triggered powers but starting
no later main action. Cheap power choices used the existing action prior. This
is model-guided one-step evaluation, not transition-free play or pure zero-search
self-play. Reference opponents used their corresponding reference-only evaluator.

Each calibration had 140 valid games at 28 BelowNormal workers. Counts were frozen
using the fixed completion-28-to-112 steady timing window, excluding startup and
final tail. Calibration games were excluded from all fitting and strength tests.
The new setup bank passed its audit against 7,873 retained historical IDs. Shared
prefixes across collection arms were intentional; the related trajectories are
not independent starting setups.

## Collection and resource costs

| Measure | Searched data | Hybrid data |
| --- | ---: | ---: |
| Fresh games | 280 | 1,040 |
| Fresh train / development games | 224 / 56 | 832 / 208 |
| Collection pool wall | 614.220 s | 572.748 s |
| Collection process CPU | 4.217 core-hours | 3.981 core-hours |
| Trainer subprocess wall | 94.406 s | 124.844 s |
| Trainer process CPU | 92.344 s | 112.969 s |
| Collection + trainer wall | 11.810 min | 11.627 min |

Actual hybrid/searched collection wall ratio was 0.93248, passing the frozen
[0.9,1.1] gate. It generated 3.714 times as many games in 6.75% less collection
wall time: **3.98 times the throughput**, or 3.93 times per process CPU time.
This is approximate matched-cost evidence, not exact equal-compute measurement.
The arms ran sequentially on one desktop and remain sensitive to background load.

Collection timings include redaction, features, label baselines and record writes.
The collection-plus-trainer sums exclude calibration, shared verification,
export preflight, strength testing and publication; they are not separate complete
end-to-end campaigns. The entire two-arm pilot, including those shared stages and
the screen, took 37.81 minutes. GPU fits ran sequentially between game batches.

Hybrid collection recorded 84,395 cheap and 22,916 searched decisions, including
searched setup: 43,429 cheap main decisions, 40,966 cheap power decisions and
574,939 one-step successor evaluations. It used 3,191,565 searched iterations;
the searched arm used 4,087,665. These counters describe work, not independent
training examples or completed simulated games.

## Learning and generalization

Each fit retained the old 2,304 training and 384 development games, excluding all
old audit, calibration and strength data. Each trained on its own fresh training
bank only, weighted 75% retained / 25% fresh. Both selected checkpoints on the
same development pool: 60% retained / 20% searched-fresh / 20% hybrid-fresh mass.
The 648 development games represent **592 unique setups**, not 648 independent
groups: 56 fresh setups intentionally occur in both arms. Viewer/turn observations
remain correlated within games and matched setups.

Both fits warm-started generation 3, froze normalization and used the same
optimizer, seed, loss, epoch-zero candidate and early-stopping rules. No new sealed
audit was opened for this pilot; development data selected checkpoints.

| Common development metric | Parent / searched-data selection | Hybrid-data selection |
| --- | ---: | ---: |
| Selected epoch | 0 | 1 |
| Residual Huber loss | 0.356708 | 0.352961 |
| Score-margin MAE | 7.02673 points | 6.98134 points |
| Development eligibility | No new checkpoint | Passed |
| JavaScript export parity | Passed | Passed |

Hybrid development Huber improved 1.05% and MAE improved 0.65% relative to epoch
zero. These are selection findings, not untouched-test gains. The searched-data
fit kept epoch zero: its further training reduced training loss while development
loss worsened. Its inference tensors and normalization exactly match the parent
generation-3 model; the different export hash reflects model metadata, not a new
teacher. Hybrid development loss also worsened after epoch 1 while training
loss continued falling. More epochs did not solve this generalization problem.
This supplies no evidence that a larger network is the immediate bottleneck.

## Completed fresh strength screen

The sole prespecified exploratory screen used 40 fresh setups with both seats,
80 valid complete games, at 1,000 ms per decision and unchanged research horizon 4.
The hybrid-data model faced the selected searched-data model, which is
functionally the unchanged parent generation-3 network.

| Measure | Result |
| --- | ---: |
| Hybrid wins / losses / ties | 39 / 40 / 1 |
| Hybrid winner share, ties half | 49.375% |
| Paired approximate 95% interval | 39.38% to 59.37% |
| Mean score margin | -1.2625 points |
| Paired approximate 95% margin interval | -3.6634 to +1.1384 points |
| Candidate / opponent mean decision time | 1,002.32 / 1,002.44 ms |
| Candidate p95 / p99 / maximum | 1,005.92 / 1,011.22 / 1,060.41 ms |
| Complete validity / timing checks | Passed / passed |
| Screen admission | Failed |

Only 31.08% of candidate rollout endpoints used the learned correction; the rest
used the fixed reference fallback. The comparator used learned correction on
32.63% of endpoints. This comparison changes a learned residual within the fixed
search system; neither side is a standalone neural policy.

The screen failed both the required promising winner-share threshold and positive
mean margin. Its intervals remain compatible with modest improvement or harm;
it does not prove equivalence or that cheap examples are inherently worse.
The hybrid checkpoint passed development eligibility separately. The failure
prevented both planned 100-pair confirmations; no partial confirmation, rescue
retuning or additional tournament ran. This is exploratory evidence only.

## Baseline sampling diagnostic and limits

A separate training-only probe selected four old train games by identity hash and
32 fixed round/viewer observations, without reading old development/audit outcomes
for selection. Sixteen independent four-world baseline estimates per observation
were compared with a separate 128-world estimate: 6,144 belief worlds total.
Mean within-case sampling standard deviation was 0.870 points, maximum 2.031;
RMS difference of replicate means from the larger noisy reference was 0.248 points.
No labels, targets or fitting rules changed from this diagnostic.

This small probe identifies sampling variation, not total target noise. The
128-world reference is noisy too, and these 32 correlated cases cannot explain
or decompose the full prediction error or establish that larger label samples
would improve strength. The old campaign's omitted diagnostic remains recorded
as omitted; this is distinct new evidence.

All 120 frozen source/config/model guards and exported model hashes matched at
closeout. No game cap, illegal action, unsettled search or scientific stage error
was reported. The first publisher launch, before a finite controller deadline
existed, exited without publishing; its receipt/logs remain retained. The healthy
replacement published the terminal result. The initial source inventory omitted
relative-path dependencies; it was corrected before collection results, retaining
both Git revisions. Neither publication correction altered scientific comparisons.

Frozen executable revision: `8a1f2fd7b652072372d0bba61dad1b152a07c776`.
Exact 117-file source/plan archive SHA-256:
`4e0e696a8fa967bbe56a6a94022047f38cd540b6a1fc81883972cc155fe581e7`.
Selected hybrid model SHA-256:
`94475f4c0239bfd926629b523f1645a5a57bc30f5635a34e368f98aadb484a02`.
Selected searched-data model SHA-256:
`32b28c19c50d9a9429c2757a56ee3e17afafbac5f6d5d4cb786b3689d2701f4c`.

Raw observations, labels and full game records remain local under the documented
runtime; public artifacts contain aggregate receipts, exported weights and exact
source. Timed decisions need not reproduce identical choices under different load.
These results do not establish human, multiplayer or physical-table strength.

## Next decision

Keep generation 3 as the research teacher. Retain the faster generator and all
corpora as useful infrastructure, without treating game volume as learning success.
Before another collection campaign, inspect whether value corrections improve
candidate-action ranking and how that changes between one-step and searched use.
A small searched-action distillation or policy-target pilot is a reasonable next
proposal: target decisions directly and check improvement against the actual
parent teacher. It is not implemented or launched by this closeout. More epochs,
a larger network, or an indefinite cheap self-play loop are not supported as an
immediate remedy by these results. The separately approved width comparison remains
available as a controlled future question, not a rescue of this failed screen.

Final evidence is pinned to immutable commit `42a9ac1ee7d1b8b8ace5094b6e162539ab27a2df`, including the
[review](https://github.com/seanmason/board-game-ai-dev/blob/42a9ac1ee7d1b8b8ace5094b6e162539ab27a2df/wingspan-data-efficiency/REVIEW.md)
and independently recomputed aggregate receipts.
