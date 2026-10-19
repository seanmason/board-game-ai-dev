# Wingspan conservative teacher refits — October 19, 2026

Status: stopped normally after failed fresh confirmation; see the
[final evidence and decision](../games/wingspan/2026-10-19-refit.md). The original
frozen protocol remains in the source archive at revision 29e5d95. Production
opening-plan, expanded setup and h4 stay
unchanged. Completed studies, source, data, models and deadlines remain preserved.

## Hypothesis and fixed fit design

The [cheap-data pilot](../games/wingspan/2026-10-19-data-efficiency.md) improved
collection throughput about fourfold, but did not improve teacher strength. Its
later training epochs reduced training loss while worsening development loss.
Code inspection found that a warm start restores only exported inference layers;
the auxiliary prediction head starts randomly, yet its loss backpropagates through
the learned trunk. This is a plausible interference mechanism, not an established
cause. Test it directly alongside a smaller learning rate before expanding the
network or collecting another unconditional corpus.

All four phase-0 fits start from the confirmed generation-3 research model,
SHA-256 `6131bafd429500d55fa5c60900923e6f46973a25905b3bb2df10ac7bb1922843`.
The same compact 192→32→16→1 network, frozen normalization, target definitions,
seed 1729, batch 512, AdamW weight decay 0.0001, 24-epoch cap, patience 4,
epoch-zero option and original auxiliary scaling remain fixed.

| Recipe | Learning rate | Auxiliary loss weight |
| --- | ---: | ---: |
| control | 0.0005 | 0.05 |
| value-only | 0.0005 | 0 |
| gentle | 0.0001 | 0.05 |
| gentle-value | 0.0001 | 0 |

The control is refit because the pooled training bank differs from the prior
single-arm comparison. Auxiliary-weight zero prevents auxiliary gradients; it
does not restore a previously learned auxiliary head. All four have identical
inference cost and search code. Recipe and trainer/source hashes are preserved;
no arbitrary hyperparameter override or strength-based retuning is allowed.

## Replay and information boundaries

Use exactly the old compact study's 2,304 training / 384 development games plus
both cheap-data pilot collection banks: generation 4 has 224 train / 56 dev and
generation 5 has 832 train / 208 dev. Total 3,360 train / 648 dev games. The 648
dev games represent 592 unique setups because 56 setups intentionally appear in
both generation-4/5 arms. Whole related trajectories keep their original split.
No old audit, calibration, screen, confirmation or scaling records enter any fit.

The unchanged trainer gives each generation equal mass, with balanced setup,
round and viewer weighting within generation. Thus phase 0 uses 60% old replay,
20% searched-fresh and 20% hybrid-fresh mass, identically for all four fits and
common development selection. This differs from the prior 75/25 training fits.
Raw terminal labels remain unchanged. Hash every input inventory and raw source
before/after fitting; retain original identities and verify model export parity.
Development is repeatedly used research selection data, not a new sealed test.

Fitting cannot read hidden opponent information from true state. Existing encoded
redacted observations and actor-only belief baselines remain unchanged. No new
labels from imagined outcomes or strength-test games are introduced.

## Selection, screening and research teacher acceptance

Eligible models must select an epoch above zero, pass JavaScript parity, improve
common development Huber over both the parent's epoch zero and reference, and
have development MAE no worse than the parent. Do not impose a post-hoc percentage
threshold. Deduplicate exact inference tensors plus normalization, ignoring IDs.

Rank eligible distinct models by development Huber, then MAE, then recipe ID.
Screen at most two, each on exactly 40 fresh setups with both seats (80 games),
against the actual frozen parent teacher. All strength decisions request 1,000 ms
with unchanged horizon 4, which excludes the chosen root and includes four later
main actions; powers settle. These are representative supplied AI actions, not
complete human action enumeration or full-tree search.

A promising screen needs at least 52.5% winner share (ties half), positive mean
score margin, complete valid pairs and timing gates. No confidence requirement
is added to exploratory admission. Choose at most one qualifying finalist by
higher complete-screen share, then margin, then development Huber, then recipe ID.
No partial screen results are interpreted or published.

Confirm that single frozen finalist on exactly 100 entirely new setup pairs
against its actual parent. Require one-sided paired approximate t alpha .025
lower bound above 50%, positive mean margin, validity and timing gates. A bounded
fallback handles degenerate pair samples. Screens and confirmation remain separate;
never pool them to support the strength claim. Each completed comparison reports
paired two-sided 95% intervals, margins and actual work counters.

Timing gates: candidate/opponent mean ratio <=1.10, p95 ratio <=1.25, candidate
p99 <=2,000 ms and maximum <=5,000 ms. Source/model/input changes, invalid games,
partial stages and export failures stop without retries. A failed screen or
inconclusive confirmation does not imply equivalence, nor authorize a rescue.
Only passing fresh confirmation accepts a new RESEARCH teacher. No automatic
browser production promotion or release repository change is permitted.

## One conditional further iteration

Only if phase 0 confirms a stronger teacher AND at least 70 minutes remain on
the original deadline, collect one new fixed 1,040-game hybrid batch. Otherwise
skip it entirely, preserving the accepted research teacher and explicit reason.
The cycle uses 832 train / 208 dev games, balanced 40-game blocks. Opponents are
50% self, 25% corrected reference and 25% old parent. Setup stays searched;
subsequent decisions use 80% one-step / 20% original 100/300-sample search. Existing
training-only early exploration and separate chance/policy/budget RNGs remain.
Generation 6 has wholly fresh setup IDs. Cheap main evaluation settles root powers
but does not start another main action; cheap power choices use action priors.

Fit exactly the accepted recipe again, warm-starting the newly confirmed parent.
Keep all previous legal train/dev replay and add generation 6. Equal-generation
weighting now gives previous five generations 5/6 mass and new data 1/6 mass in
both train and dev. This cautious replay weighting is frozen; do not silently
claim 75/25 or treat different generation IDs as successive accepted teachers.

If development eligibility passes, run one new fixed 40-pair screen and, only if
promising, one new fixed 100-pair confirmation against that immediate parent.
The same eligibility/timing/confidence gates apply. Retain the best accepted
teacher if the subsequent fit or gate fails. Stop after this one extra cycle.
There are at most two confirmation claims, each alpha .025 (union-bound false
positive allowance <=.05 across the two prespecified acceptance opportunities).
No indefinite loop, width trial, extra candidate or post-outcome extension runs.

## Resources, ownership and publication

Hard limit: three hours from the first real controller launch; never restart its
clock. At most 28 BelowNormal CPU workers. RTX 3080 CUDA fits use at most 6 GiB
and four CPU math threads, sequentially and only between game batches. Preserve
exclusive process ownership, frozen source/model/config hashes, child receipts,
all failed stages and old benchmark evidence. Partial resume fails closed;
terminal inspection is read-only even after the original deadline.

Fresh seed banks use base 1,000,000,000 + bank*10,000,000 + index*997: phase-0
screen slots banks 0/1 (40 setups each), phase-0 confirmation bank 2 (100), new
collection bank 3 (1,040), next screen bank 4 (40), next confirmation bank 5 (100).
Audit every maximum bank against retained historical inventories before launch.
Paired seats intentionally share a seed; stage banks never overlap. Model/budget
selection cannot use these held-out outcomes before the corresponding stage.

Publish a new `wingspan-refit` dashboard/evidence branch every 90 seconds, with
explicit fitting progress versus playing strength and withheld partial outcomes.
Only safe aggregate receipts, exported weights and exact frozen source are public;
raw observations, features, labels, actual game files, local paths and environments
stay outside Git. Required comprehensive Validation gates GitHub Pages deployment.

At terminal state independently review fit curves, controlled contrasts, accepted
teacher lineage, complete paired strength evidence, actual CPU/wall/latency/work,
all failures and limitations. Publish the final report and immutable snapshot,
verify CI/Pages/public dashboard, then pause the new monitor. Preservation of
production defaults does not preclude retaining a confirmed stronger research
teacher for the next separately authorized study.
