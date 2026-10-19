# Wingspan: compact iterative self-play learning

Status: proposed October 19, 2026; implementation and new experiments have not
started. Scope: two-player original Wingspan. This replaces the old pilot's
conditional next-step proposal, not its preserved experimental protocol.

## Objective and evidence

Build a bounded loop that generates new experience, trains a small evaluator,
tests it and uses useful successors to generate the next batch. The first question
is whether learned corrections improve decisions; larger networks are a later
option. Production remains the opening-plan package with horizon 4.

The [completed pilot](../games/wingspan/2026-10-19-neural-pilot.md) does not yet
establish a learned playing-strength benefit. Its network tied the corrected
reference in fresh confirmation; the constant-output attribution was inconclusive.
All three original fits selected epoch 1. Only 320 independent training games
underlay the many correlated observations. Compact inputs improved development
point estimates, with uncertain differences. These findings motivate a smaller
representation, more independent games and cleaner attribution.

Borrow small initial models, replay, randomized search budgets, score-component
targets and cautious growth from [KataGo's original paper](https://arxiv.org/html/1902.10565v5).
Its [official training guide](https://github.com/lightvector/KataGo/blob/master/SelfplayTraining.md)
also describes a bounded synchronous loop suitable for one machine. These are
design inspirations, not evidence of a Wingspan speedup. Our first version retains
the existing belief-sampled search and heuristic rollout policy; it is not a
complete KataGo/PUCT policy-and-value implementation.

## 1. Establish a reproducible reference

Before broad collection, reconstruct the recorded raven-heavy slow case
(seed 46035892, seat 0, step 86) from frozen code, recorded iteration counts and
actions where recoverable. The old summary does not contain a complete state
snapshot; if exact reconstruction fails, retain that limitation and create a
representative double-raven continuation fixture. Profile generation, power
continuations, heuristic evaluation, copying and GC separately. Dense inference
was absent from the recorded 78.97-second decision.

Make only a bounded performance repair if profiling identifies a concrete cause.
Keep rules and complete legal human entry unchanged. Disclose any AI candidate
or rollout approximation; do not disguise it as a neural improvement. Freeze the
resulting corrected research reference R and source hashes before collection.
Run a small, outcome-blind calibration and adversarial latency set. Unresolved
multi-second stalls under a one-second request block broad timed comparisons;
report p99 and maximum, not only mean/p95. Worker watchdog failures are retained
as failures, never scored as losses or assigned fabricated terminal labels.
Initial calibration targets are p99 at most 2 seconds and maximum at most 5 seconds
for a one-second request, including adversarial power positions. Freeze the
measured hardware and exact gates before collecting strength evidence.

Use a new worktree/runtime for implementation. Preserve the old frozen source,
models, raw records and original deadline as historical evidence.

## 2. Compact observation representation and model

Target approximately 180–200 scalar inputs, with this provisional 192-input
budget. The exact named schema and scales must be frozen after correctness
fixtures and before collecting the new learning corpus.

| Feature family | Budget | Contents |
| --- | ---: | --- |
| Tempo/context | 16 | Round, remaining actions, viewer/actor/starter relation, public context and coverage masks |
| Player resources | 24 | Both players' observable food, hand/bonus counts, eggs/capacity and stored scoring resources |
| Public habitat engines | 96 | Six rows × 16 summaries: occupancy, points, base output, productive power families, conversion costs and order-sensitive dependencies |
| Own hand | 24 | Aggregates/maxima over all known cards: affordability, placement, points, engine roles and combinations with installed engines |
| Bonus/goals | 16 | Known private bonus progress/opportunities and both players' public goal progress; aggregate overflow rather than silently truncating cards |
| Feeder/tray | 16 | Public food availability and coarse affordable/engine/bonus opportunities in the market |

Avoid bird-ID one-hots, ordinal numeric power codes, large per-power histograms
and duplicated slot trait vectors. Do not discard the distinction between
habitats. Include coarse producer/converter/consumer and repeat effects, especially
egg-to-food, card-to-point and free resource engines. Small order-sensitive
features distinguish a resource producer activating before versus after its
consumer. Audit the semantic power mapping against existing mechanism fixtures;
these descriptors need not solve an entire future turn to be computed.

Aggregates lose some card and chain detail. Document aliases and unsupported
contexts. Add per-bird/shared-encoder detail later only if development failures
show that this loss matters. Keep unknown quantities explicitly masked; missing
information is not zero. Initially the learned correction applies only to covered,
settled digital observations with complete own private information. Physical
advice retains its existing observation guards and reference fallback.

Initial network: input → 32 ReLU → 16 ReLU → one correction, approximately 6,721
inference parameters at 192 inputs, versus the pilot's 86,401. Add training-only
score-component heads with a small fixed loss weight. No browser GPU is required.

Use an additive residual, in point units:

`V(world, viewer) = R(world, viewer) + correction(redactedObservation)`

Here R is the viewer-minus-opponent reference margin, not a single-player score;
the label baseline uses the same frozen evaluator and perspective.

Initialize the final correction head to zero. Apply the correction at both root
and leaf; retain the original `.18 × prior + .82 × (V_leaf − V_root)` reward,
UCB scale, candidate order and rollout policy. Terminal and unsupported-context
corrections are exactly zero. Start with a fixed smooth ±10-point correction bound;
report saturation rather than silently increasing it during a run.

The training target is final viewer-relative margin minus an observation-safe
reference baseline. Reuse the existing four independent belief-world average
computed from the redacted observation, never the actual hidden opponent hand.
Check its sampling noise on a fixed training-only subset. This baseline is cached
for labels; do not add four extra belief evaluations to every neural inference.
The correction estimates expected reference error, not the error of a particular
imagined hidden world. Exact zero output must reproduce reference rewards,
allocations and chosen actions under fixed iteration counts. An equal-cost zero
head control retains the real encoder and dense work; a plain reference also
measures the practical cost of adding the network.
Feature extraction must be deterministic and consume none of the search RNG.

## 3. First bounded campaign: three generations

Proposed experiment cap after implementation: three cycles or six elapsed hours,
whichever comes first, including confirmation and analysis. This is a proposed new
budget, not an extension of the completed pilot's clock. A 32-game calibration,
excluded from learning/strength claims, determines whether fewer cycles are needed.
Measure actual collection/evaluation throughput before promising a finish time.
Before starting another cycle, reserve the measured cost of final 400-game
confirmation plus analysis. The optional compute check is skipped first if time
is short, followed by later collection cycles. Do not start a comparison that is
unlikely to finish inside the cap. Report any interrupted comparison as incomplete;
never redefine its sample size after observing outcomes.

Each cycle collects 1,024 fresh independent setup groups, initially one full game
per group. Balance seats across groups. Any reused opening, both viewers, related
seat swaps and all snapshots remain in one group and split.

| Per cycle | Groups | Use |
| --- | ---: | --- |
| Training | 768 | Gradient updates/replay |
| Development | 128 | Early stopping and candidate selection |
| Sealed offline audit | 128 | Open once, after the final campaign candidate is frozen |

At most 3,072 fresh groups across three cycles; position counts are not independent
sample sizes. The old 320 training games may be a fixed training anchor. Keep
the original development/test groups out of new training; the inspected old test
set is not a fresh confirmation set.

Generation 0 is the corrected reference with zero correction. Within each batch,
freeze an opponent mixture: 50% training-champion self-play, 25% champion versus R,
25% champion versus a pool of earlier champions, falling back to R when empty.
Rotate asymmetric pairings through both seats. The first batch naturally collapses
to reference play; independently seeded action exploration supplies diversity.

Use independently randomized 80% 100-sample / 20% 300-sample decisions, horizon 4,
logging actual work and root coverage. On a fixed 20% of training games only,
sample among searched reasonable alternatives early in rounds; freeze its
temperature/safety filter before collection. Evaluation disables this exploration.
Record actor-only search distributions for future policy learning. Do not label
unvisited moves as bad or treat forced coverage visits as optimal policy targets.

Retain separately redacted observations for both viewers, exact complete actions,
full terminal scores/leftover-food tiebreaks, timing and replay receipts. True
hidden outcomes are supervised targets only. Never put the acting player's
private candidate list in the other viewer's features. Train on actual completed
game observations, not imagined rollout leaves assigned the actual game's label.

Initially replay all training groups. Beyond the first three cycles, cap replay
at 8,192 games: 75% recent data, 25% older/reference anchors, with explicit group
weights. Sample games uniformly within each stratum, then balance rounds/viewers
within games. This reduces accidental dominance by long games and late positions.
Normalization uses training data only. Version changes re-encode retained redacted
observations; they never recover extra information from true hidden states.
Freeze normalization from the first fresh training batch for all three cycles so
warm starts preserve the incumbent function. Track distribution drift separately.

## 4. Train, screen and advance

For each generation, warm-start from the training champion with the same schema;
retain that unmodified checkpoint as epoch zero. Use one fixed optimization seed,
AdamW, a conservative learning rate, Huber residual loss, small fixed auxiliary
loss, early stopping and a short epoch cap. Freeze exact constants after plumbing
tests. The purpose is another batch of experience, not a hyperparameter search.
Fit a regularized linear residual on the same data as a cheap offline control.

Select at most one neural candidate per cycle using development Huber loss, with
grouped MAE, round/engine strata and correction saturation reported. Epoch zero
can win. A candidate that cannot improve development prediction over zero does
not advance to games. Better prediction is eligibility, not playing-strength proof.
Use all development groups accumulated so far, with equal weight per generation
and per setup within generation, and fixed round/viewer weighting. Compare each
candidate and epoch zero on exactly that same pool; also report each generation
separately so an easier opponent distribution cannot masquerade as improvement.
Pass privacy/invariance, legality, terminal, zero-effect, export parity and bounded
inference checks before any screen.

Screen one frozen candidate on 40 fresh seat-paired setups against the training
champion and 40 against plain R, deduplicating when champion equals R. At 1,000 ms
requested per complete decision, require at least 52.5% winner share and positive
mean margin in each comparison, complete validity and acceptable mean/p95/tail
latency before it becomes the next **training** champion. Report paired intervals:
this small development gate is exploratory, not proof of superiority. A failed
candidate remains archived; collect the next independent batch with the incumbent.
Never train on screen or confirmation games.

Stop the initial campaign after two consecutive cycles with neither development
nor screen improvement, a privacy/rules/parity failure, or unresolved runtime
failure. Do not automatically enlarge the model or start another tournament to
rescue unfavorable results. Preserve incomplete records and the original stop time.

After freezing the final promising candidate, open the sealed offline audit once
and report prediction/calibration against zero, linear and reference. If valid
and still eligible, run independent confirmation:

- 100 fresh setup pairs versus the same-cost zero-head control: learned attribution.
- 100 different fresh setup pairs versus plain corrected R: practical improvement.

Require paired lower winner-share bounds above 50% using one-sided alpha .025
for each of the two claims, positive score margins, complete validity and latency
gates. These 400 games can remain inconclusive about small improvements. Do not
swap finalists or keep extending the same test until a bound passes. Report all
comparisons and unfavorable results. Production promotion additionally needs a
fresh direct comparison against the actual deployed package and normal browser/
physical checks; the training champion is not automatically the production AI.

## 5. Test compute scaling and grow only for a reason

If a learned candidate is promising, reserve a small exploratory compute check:
40 seat pairs of candidate 300 versus 100 samples, and 40 of R 300 versus 100,
with horizon 4 fixed, fresh setups and actual work reported. Do not reuse these
games to select checkpoints. The interaction is informative; a positive slope is
not a necessary or sufficient condition for a good evaluator. Search allocation,
rollout bias and candidate coverage can create flat or negative curves. Equal-time
confirmation remains the practical measure. Depth changes are a separate later
experiment, not another axis in the first campaign.

Keep the initial schema and architecture fixed for all three cycles. If new data
keeps improving development error/strength, continue that design. If training and
development both plateau with little gap after several thousand independent games,
compare 32/16 versus 64/32 on identical replay. Increase capacity only if the larger
model improves held-out development performance and then fresh playing strength
within the latency budget. If training improves but development worsens, gather
more diverse games or regularize instead of growing the network.

Add one feature family only when development diagnostics identify a concrete
blind spot, such as order-sensitive chains or individual hand opportunities. Test
it separately from a width increase and from search changes. A later learned
state-action scorer can provide policy priors for variable legal actions, trained
from actor-only expensive-search records with exploration/coverage correction.
Do not add a large fixed action head or rewrite search before value learning works.

## Automation, resources and deliverables

One resumable controller executes collect → validate/split → train → export/parity
→ screen → accept-for-training/archive → next cycle → final analysis. Use at most
24 BelowNormal CPU workers; one RTX 3080 trainer with a 6 GiB VRAM ceiling and
2–4 CPU math threads. Keep timed games and GPU fits sequential. Training was only
seconds in the pilot; generation and evaluation are the likely bottlenecks.

Freeze code/schema/teacher/opponent/weights/seed-bank hashes per generation. Store
large raw data outside Git/OneDrive. Use atomic manifests and canonical frozen
task fields distinct from scheduler metadata. Resume only unfinished planned tasks,
without resetting clocks or deleting failures. Preserve exact actions and sufficient
replay data for future slow-case diagnosis. No unbounded retries or silent rule edits.

Publish a generation dashboard with game groups, source/model versions, training/
development curves, error strata, correction magnitude, learned/fallback coverage,
paired screens/confirmation, actual samples, latency tails, failures, throughput
and elapsed/remaining budget. Publish the final snapshot only after all final
analysis is written; pin completed public evidence to an immutable revision to
avoid a stale branch-CDN snapshot. No production changes happen as a side effect
of a completed training job.

Success for the first campaign is credible learned benefit over zero and R at
practical cost, or a clear diagnosis that tells us whether data, representation
or search is the next bottleneck. It is not a promise of monotonic self-improvement.
