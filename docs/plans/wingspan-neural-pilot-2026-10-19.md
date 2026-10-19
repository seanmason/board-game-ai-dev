# Wingspan: small neural value pilot

Status: fixed pilot completed, October19,2026; no production promotion.
The [results and interpretation](../games/wingspan/2026-10-19-neural-pilot.md)
record the fresh confirmation decision and exploratory follow-ups.
Current progress and implementation evidence are recorded in the
[active work record](../work/wingspan-neural-2026-10-19.md). Scope: original Wingspan, two players. The user explicitly
requested a simplified neural approach; this plan gives bounded first milestones
and evidence gates before a larger training investment.

## Objective and first decision

Can a small learned value function improve practical playing strength over the
[best deployed AI](../games/wingspan/2026-10-19-selection.md), at the same requested
decision time? The first deliverable is a reproducible learned evaluator and a
small independent comparison. A policy network and iterative self-play follow
only if that first experiment provides useful evidence.

Borrow KataGo's combination of search-generated experience, point/score auxiliary
targets, cheap versus expensive searches, and successive evaluation against an
incumbent. Wingspan has hidden information and random events; retain observation
guards and belief sampling. A Go-style perfect-information search state cannot
be passed directly to a Wingspan network.

Sources, reviewed October19:

- [David Wu, Accelerating Self-Play Learning in Go](https://arxiv.org/html/1902.10565v5), especially sections3.1,3.2 and4: randomized search budgets, exploration-contaminated policy targets, and score/auxiliary learning.
- [KataGo method documentation](https://github.com/lightvector/KataGo/blob/master/docs/KataGoMethods.md): subsequent training methods and auxiliary targets.
- [Official PyTorch Windows setup](https://pytorch.org/get-started/locally/): supported Python and CUDA installation/verification.

These sources motivate the design. Their Go results do not predict Wingspan's
learning rate or the speedup attainable on this desktop.

## Available resources

Measured locally: Ryzen9 5950X,16 physical cores/32 logical processors; about96GiB
RAM; RTX3080 with10,240MiB VRAM (about7,945MiB free at inspection); about349GiB
free on C:. Python3.13.14 is available. The inspected Python environment has no
PyTorch, NumPy, ONNX or scikit-learn installed.

Use an isolated Python environment with a pinned CUDA-enabled PyTorch wheel,
NumPy and a small training script. Verify `torch.cuda.is_available()` and a small
actual forward/backward pass before promising a GPU timetable. The official
Windows page currently lists Python3.10–3.14, covering the installed interpreter;
verify wheel availability at setup and record exact versions/driver.

Use at most24 BelowNormal CPU workers for data generation/evaluation. During GPU
training, stop the generation pool initially and limit CPU math threads to2–4.
Use one GPU trainer with a target VRAM ceiling of6GiB, leaving desktop capacity.
Keep data and checkpoints outside OneDrive under `.codex/benchmark-runs`; allow
10GiB initially. No multi-GPU setup or distributed training is needed for this
model. Measure throughput before assigning a larger compute budget.

## Milestone1: trustworthy data, before fitting a model

Implement `scripts/wingspan-neural/` separately from frozen studies and production
code. Reuse immutable rules and the full-game runner callback. At each settled
ordinary decision, collect one value example for EACH viewer containing that
viewer's redacted observation, viewer/actor and phase/round/remaining actions.
Separately store a teacher-decision record for the ACTING viewer only, with exact
candidate actions, chosen action and root search statistics. Candidate lists can
reveal the actor's private hand: they must never enter the other viewer's example
or its encoder. The two value views are separate records, never concatenated.
Future policy training uses only acting-viewer teacher-decision records.

Do not serialize the callback's authoritative state: it contains hidden hands,
deck order and random-generator state. Inputs must be constructed exclusively
from `publicObservation(state,viewer)`, known-card/visibility masks and public
catalog constants. True terminal scores are allowed as supervised TARGETS,
never features. No seed, outcome, future draw, true hidden bonus, or unknown-card
identity enters the encoder.

After a valid game ends, attach exact final score margin from that viewer's
perspective and score components/outcome for auxiliary targets. Keep both views,
all turns, any world samples, and related seat-swapped games in the SAME split.
Capture both viewers because rollout leaves often have someone other than the
root viewer to act. Attach actual final-game labels only to recorded real game
observations, never to independently imagined rollout-world leaves. Do not infer perspective by flipping a sign at every power
choice. Quarantine failed/capped/illegal actual games and incomplete trajectories;
retain their records without training on their terminal labels.

The previous game archives contain summary decisions, outcomes and timings, but
omit observations, full actions and complete root distributions. They support
baseline analysis, not exact training reconstruction. Existing30-state mechanism
fixtures are unit tests, not an independent training corpus.

First run16 functional/calibration games, excluded from learning/evaluation. Check
privacy, complete labels, conservation, row size, memory, generation throughput,
and a tiny end-to-end CPU/GPU/browser parity example. Stop on failures.

Then freeze one dataset profile using timing alone:

- Normal pilot:512 independent games;320 train,64 development,128 offline test.
- Compact pilot if calibration predicts over two hours of generation:256 games;
  160 train,32 development,64 offline test.

Use the incumbent opening-plan teacher with80%100-sample decisions and20%
300-sample decisions, horizon4, original action prior and actual setup expansion
symmetrically. Budget selection is seeded independently of state quality and
outcomes; log the coverage floor and requested/actual work. This produces a mix
of teacher continuations rather than an optimal-play oracle.

About52 ordinary decision states/game, recorded for both viewers, gives roughly
53,000 observations for512 games. They are correlated within games;512 games
remain512 independent setup units. Do not inflate statistical sample size using
positions. Save complete root records now for a possible later policy model.

Audit seed banks against retained historical and planned evaluation banks. Split
by whole setup group before collection; share no groups between train/dev/test.
Keep the final game-strength confirmation bank wholly fresh and separate from
offline tests. Freeze rules/catalog/teacher/encoder hashes in the dataset manifest.

## Milestone2: one small network and a serious cheap baseline

Encode about1,000 normalized features: ordered slots in both public habitats,
bird traits/power identity, eggs/cache/tucks, viewer's own known private hand/bonuses,
food by type, public tray/feeder/goals/discards, actions remaining, viewer/actor,
and visibility masks. Preserve row order because activation order matters. Unknown
private quantities use only legitimately observed counts and explicit masks.
Order-independent hand summaries avoid inventing meaningful hand order. Fit all
normalization on training data only.

Fit a regularized linear value model and one MLP on the SAME inputs and labels.
Proposed MLP: input→64→32→value, ReLU hidden layers, about70,000 parameters or
0.3MiB of float32 weights. Add a small auxiliary head for final score components;
its loss coefficient is fixed0.1. Main Huber loss predicts final viewer-relative
score margin scaled by30; auxiliary components use fixed point scales. Three
fixed optimization seeds assess fit stability; select at mostone checkpoint
using development loss and latency, never game-strength test results. Cap at
100 epochs, early stopping patience10, batch512, AdamW learning rate0.001,
weight decay0.0001. Freeze constants after plumbing tests and before strength.

Offline gates: beat a constant predictor, compare against the incumbent heuristic
and trained linear model on unseen game groups, inspect MAE by round and engine
type, and check extreme margins. Report group-bootstrap uncertainty and calibration.
One model can predict a final margin directly; do not subtract two margin predictions.
Do not call its output a calibrated win probability. Auxiliary outcome prediction
can be added later if score fitting works; no extra heads are required for v1.

Export dense weights/normalization to a small versioned browser asset. Use direct
JavaScript Float32Array inference inside the existing worker, with Python/JS
numeric parity fixtures. This small network needs no browser GPU dependency.
Measure total encoding+inference time on Node and automated mobile-sized Chrome;
actual iPad Safari latency/acceptance remains a separate device check.

## Milestone3: playing-strength proof, with attributable controls

Use the corrected research boundary so the learned evaluator receives settled
states. Keep rules, root candidates, setup expansion, horizon4, rollout policy,
UCB and the0.18 prior/0.82 leaf reward scale fixed. The trained value is a direct
root-viewer margin in point units; replace the relative-value function once,
not the per-player score and then subtract it a second time. Terminal evaluation
uses exact scoring. Unsupported/setup/pending contexts fall back to the reference. Physical games
retain all existing observation blockers; unsupported visibility patterns also
fall back until they have explicit training and validation coverage.

De-normalize the output first: marginPoints=30×networkOutput.
Test one fixed blend:50% reference relative value +50% learned marginPoints. Use the
same blend for the linear control. A zero-effect control must reproduce the
reference exactly. Do not introduce a learned rollout policy simultaneously.

Before strength, require legal trajectories, hidden-state mutation invariance for BOTH acting and off-turn viewers,
terminal equality, correct root perspective, deterministic replay, complete
supplied-root coverage, and bounded inference/memory with no network request.
Use eight functional canaries and an outcome-blind fixed-position latency check.

Freeze the model, feature version, time budget and tasks. Screen on32 fresh paired
setups per comparison (64 games each), at1,000ms requested per whole decision:

1. Neural blend versus the trained linear blend.
2. Neural blend versus corrected reference without a learned evaluator.
3. Neural blend versus the actual deployed AI.

Total192 pilot games. The same paired setup bank may support descriptive
contrasts across comparisons. Report all paired intervals, outcomes, margins,
samples completed and realized mean/p95 latency. The corrected-reference control
separates neural effects from the endpoint correction; the deployed control
answers practical improvement. Offline accuracy or matching teacher choices
alone cannot establish better play.

Predeclared exploratory eligibility: all games valid, at least55% winner share
and positive margin against deployed, positive margin against corrected reference,
and latency ratios≤1.10 mean/≤1.25 p95. The only eligible finalist in this pilot is the preselected neural checkpoint;
do not switch to the linear model after seeing these game results. An inconclusive
neural-versus-linear comparison supplies no evidence that neural complexity is
necessary. A cheaper linear candidate can enter a later separately frozen direct
comparison against both references. The small screen can detect large effects
and remains inconclusive about small gains.

If eligible, freeze exactlyone finalist and run fresh confirmation:200 setup
pairs against deployed (400 games) and100 pairs against corrected reference
(200 games). Use one-sided paired lower bounds above50%, positive margins,
complete validity and latency gates, with alpha0.05/2 across these two claims.
No repeated checkpoint testing or seed reuse after tuning. Failed gates stop
promotion; retain the results and diagnose the cause.

## Milestone4: limited learning iteration, only after a useful pilot

If the first evaluator is useful, collect one additional batch with a frozen
mixture of incumbent and learned agents, keep older replay alongside new data,
and retrain once. Compare that checkpoint on new games. This is the first bounded
policy-improvement loop; avoid open-ended overnight reinforcement learning.

Then consider a shared value/policy model that scores variable candidate-action
features with a masked softmax, and use its prior for root search allocation.
Raw UCB visits include forced coverage, exploration and the old heuristic prior;
they are not optimal-action probabilities. Use expensive-search targets with
explicit exploration handling and ablate policy guidance separately from value.
The original candidate generator still prunes complete legal play; a learned
prior must not silently remove additional moves or bypass human entry.

Finally test100/300/1,000 samples at fixed depth, plus equal-time play. More samples
and deeper continuations are separate questions. A useful model can have a flat
depth curve. The first practical question remains stronger play per unit time.

## Work packages, stop rules and deliverables

Assign three isolated implementation packages: (1) observation encoder/collector,
(2) Python training/export, (3) JS inference/parity/search adapter. Coordinator
owns manifests, split/seed audit, cross-runtime checks, paired evaluation and
dashboard publication. No edits to frozen research modules or production defaults
until a separately reviewed promotion.

Target first data/model plumbing and offline evidence in one implementation
session; then one bounded evaluation batch. These are milestones, not a promise
of strength or elapsed training time. The16-game calibration determines the
compute estimate. Stop early for privacy/rules errors, no held-out learning,
unacceptable inference cost or a failed strength screen. Do not compensate with
an expensive hyperparameter sweep.

Publish hardware/software manifest, data provenance/group splits, feature schema,
loss curves and phase errors, linear comparison, model/weight hashes, inference
latency, paired results and a dashboard. Data/model download/storage goes through
the existing development repository/evidence conventions. Keep large datasets
and Python environments outside Git and OneDrive; retain their checksums.
