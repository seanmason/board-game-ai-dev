# Wingspan: cheaper self-play data at fixed model size

Status: authorized by the user on October 19, 2026; implement and validate before
freezing source and launching a new, separate bounded runtime. This supersedes
the priority of the approved width comparison, not its future authorization.
Production remains opening-plan, expanded setup and horizon 4. The completed
[compact campaign](../games/wingspan/2026-10-19-compact-selfplay.md), its source,
model, audit, records and original deadline remain untouched.

## Question and fixed controls

Can cheaper game generation improve playing strength per collection time, despite
weaker decisions? More games or lower prediction loss alone do not answer this.
The comparison changes a collection policy bundle, not network architecture.
The model remains 192 inputs, hidden widths 32/16, 6,721 inference parameters,
with the same residual target, frozen normalization and trainer constants.

Both collection arms use the frozen generation-3 model from the completed study
(SHA-256 6131bafd429500d55fa5c60900923e6f46973a25905b3bb2df10ac7bb1922843),
and the same 50% self / 25% corrected reference R / 25% generation-1 historical
opponent mixture. Generation 2 was not an accepted champion. Retain the same
training-only opening exploration policy and independent budget/policy/chance RNG
streams. Common setup prefixes across arms are intentional paired starting setups;
related trajectories are not independent setup evidence.

- **Search generator:** exactly the existing 80% 100 / 20% 300 sample decisions.
  Search horizon 4 counts FOUR subsequent main actions after the chosen root move;
  it is not four moves including the root. Settle triggered powers at the endpoint.
- **Hybrid generator:** setup stays under that same search policy. On later
  decisions, independently choose 80% cheap / 20% original searched decisions.
  Cheap main actions evaluate one sampled belief successor per supplied candidate,
  including its triggered powers, without beginning another main action. Cheap
  power choices use the existing action prior; no neural prediction is supported
  there. Reference opponents use the corresponding reference-only cheap evaluator.

This is one-step evaluation, not literally zero rule transitions. Values and
chance draws come from redacted actor observations and separately seeded sampled
beliefs, never the true future deck or opponent hand. Candidate actions remain
representative AI roots; human legal action entry is unchanged. Fixed-work tests
must establish unchanged baseline search rewards/actions, legal cheap successors,
settled powers, reference support, deterministic replay and hidden-input invariance.
Report actual cheap/searched counts, transitions, samples and learned/fallback use.

## Bounded calibration and matched collection

Use at most 28 BelowNormal CPU workers, leaving four logical desktop threads.
There is one exclusive controller and a new three-hour absolute deadline from its
first launch. Do not reset a clock, overwrite a failed stage, start duplicate
controllers or overlap GPU fits with timed games. Preserve source/model/task/config
hashes and all incomplete records. No production promotion is automatic.

Before data collection, run 28 full collection games per arm as outcome-blind
calibration, excluded from fitting/strength. Calibration includes redaction,
features, four-world label baselines and raw record writes. One worker batch per
arm is a noisy cost estimate, not a population timing guarantee.

Use only whole-batch timings to freeze each arm's collection count. Aim for
20 minutes of pool wall time per arm, reducing the COMMON target if either arm's
4,080-game cap or the original deadline requires it. Round down to balanced
40-game blocks, require at least 280 per arm, and require predicted cost ratio
within [0.9,1.1]. If no feasible count pair exists, stop before broad collection.
All maximum seed banks and sizing rules are frozen before outcomes. Scores do
not enter allocation; no post-outcome extension, resizing or rescue is permitted.

Fresh collection blocks have exactly 80% train / 20% development groups, balanced
by seat within split and opponent mixture. Actual hybrid/baseline collection
pool-wall ratio must fall within [0.9,1.1]. A miss stops before fits/strength and
leaves useful corpora preserved, but supplies no equal-time superiority claim.
Report actual process CPU time as well as pool wall time. Matching applies to
COLLECTION time: report fitting and total end-to-end cost separately, because the
larger dataset may cost more to fit. Different CPU and wall ratios must not be
silently equated. Sequential arm order is baseline then hybrid and is a residual
sensitivity to desktop background load, not a controlled multi-machine measure.

Reserve 60 minutes for the screen, optional fixed confirmation, fits and analysis,
using conservative historical one-second-game costs. Cheap calibration cannot
justify shortening the timed comparison reserve. Collection/training stages have
earlier deadline cutoffs; the hard three-hour deadline always takes precedence.

## Replay, selection and diagnostic

Use only the completed campaign's 2,304 TRAIN and 384 DEVELOPMENT games as retained
replay. Old audit, calibration, screen, confirmation and scaling games are excluded
from every fit and from architecture/target selection. Preserve and verify every
retained path, identity and hash before reading labels.

Fresh baseline and hybrid records use data-stratum generation IDs 4 and 5; these
are weighting strata, not successive accepted learners. Each fit trains on the
same retained training rows plus its OWN fresh training bank. Existing equal-
generation weighting gives 75% retained / 25% fresh mass in either fit, with equal
setup/round/viewer mass inside each generation regardless of dataset length.

Both fits use an IDENTICAL common development selection pool: retained generations
1–3 plus both fresh development banks. Its fixed generation weighting gives
60% retained / 20% baseline-fresh / 20% hybrid-fresh mass. Both fits warm-start the
same frozen generation-3 model, preserve its normalization, use seed 1729 and the
same AdamW/loss/auxiliary targets/24-epoch cap/patience. Epoch zero participates;
each arm gets exactly one development-selected checkpoint. No new offline audit
is required for this pilot; fresh playing-strength confirmation is primary.
Development metrics are selection diagnostics, not untouched test evidence.

Run one training-only baseline-noise diagnostic from the retained index, with its
source frozen first. Select four training games by identity hash and one fixed
observation per round/viewer (32 cases), ignoring outcomes. Compare 16 independently
seeded four-world baseline replicates to a separate 128-world estimate. That larger
estimate is noisy too. Publish sampling variation and safe IDs/hashes, not raw
features or observations. Do not change training labels or targets from this probe.
The old campaign's omitted check stays recorded as omitted; this is new evidence.

## Fresh strength comparisons and stop rules

After source/privacy/export/numeric parity checks and both fixed fits, screen
hybrid-trained vs search-trained on 40 fresh seat pairs, at 1,000 ms per complete
decision and unchanged research horizon 4. Require complete validity, at least
52.5% winner share, positive mean margin and the existing latency gates. Hybrid
must improve common development Huber over zero and its warm-start epoch zero.
A failed screen/eligibility result closes the experiment without another model,
budget change, extra tournament or production change.

Only one frozen promising hybrid candidate advances to:

- 100 different fresh setup pairs versus the search-trained model.
- 100 other fresh setup pairs versus the original frozen generation-3 model.

Use setup means across both seats; ties count half. Each claim uses paired
approximate t one-sided alpha .025 (bounded fallback for degenerate samples),
positive score margin and valid complete games. Candidate/opponent mean ratio
must be at most 1.10, p95 ratio at most 1.25, candidate p99 at most 2 seconds and
maximum at most 5 seconds under the one-second request. No partial winner shares
are interpreted or published before each whole fixed comparison completes.

These comparisons can remain inconclusive about small improvements. Success
requires useful strength at matched collection cost; failure does not establish
equivalence. A stronger model at unequal collection cost is not an efficiency win.
Inference overhead and any extra power choices remain in actual timing counters.
No result establishes human strength, multiplayer strength or physical readiness.

## Publication and subsequent work

Use a distinct runtime, evidence branch and dashboard study
`wingspan-data-efficiency`. Publish live validated counts/costs, selected development
curves and complete paired results every 90 seconds. Public material is an explicit
allowlist of aggregates, source/model hashes, exported weights and receipts.
Keep raw observations, labels, actual game records, local paths and environments
outside Git. Preserve exact source archive bytes and pin final published evidence
to an immutable commit. Full application Validation must gate Pages deployment.

On completion, independently review results, actual collection/fit/end-to-end
costs, baseline-noise diagnostics, all failures and practical limits. Close this
monitor only after final evidence/required CI/public dashboard are verified, or
report an unresolved failure/deadline and pause. Do not run indefinitely.

The 32/16 versus 64/32 width comparison remains separately approved, behind this
experiment. Do not combine it with a policy/data change or start it automatically
as a rescue for an unfavorable result.
