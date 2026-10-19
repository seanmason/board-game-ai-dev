# Compact Wingspan self-play implementation — October 19

Status: complete. All 4,064 games finished by 17:41:37.491 UTC; controller and
publisher exited normally after final publication. Frozen source is `04b01cd`.
The [final evidence and remaining gates](../games/wingspan/2026-10-19-compact-selfplay.md)
own results; timestamped progress below is historical. Production is unchanged.
Actual start: October 19, 2026, 14:44:26.907 UTC; original hard deadline:
20:44:26.907 UTC (15:44 Central). At launch the controller PID was 30572 and
publisher PID 90168, both BelowNormal. Inspect receipts/processes for current
health; these identifiers alone are not proof of liveness.
The user authorized implementation of the [iterative plan](../plans/wingspan-selfplay-loop-2026-10-19.md),
including its bounded automated collection/training/evaluation campaign. Production
remains opening-plan, expanded setup choices and horizon 4.

## Scope and code

New research modules live in `scripts/wingspan-selfplay/`. The original neural
pilot's isolated worktree, source/model hashes, raw outcomes and clock remain
unchanged. Its final public dashboard and immutable evidence were verified after
Validation/Pages succeeded; the old pilot heartbeat was paused.

- `encoder.mjs` / `inference.mjs`: 192 semantic inputs, 32/16 hidden widths,
  6,721 inference parameters, bounded ±10-point additive reference correction.
- `rollout.mjs` / `search.mjs` / `game.mjs`: root-viewer correction at both
  endpoints; settled horizon-4 leaves, exact terminal scoring, complete supplied
  root coverage and separate setup/power fallback. The rollout policy and prior
  remain fixed. AI roots remain representative, not exhaustive human actions.
- `collect.mjs`: separately redacted actual observations for both viewers,
  observation-only four-world reference baselines, actor-only root/action records,
  complete actual actions and terminal scores/food tiebreaks.
- `train.py`: CUDA fitting, epoch zero, fixed initial normalization, equal
  generation/setup/round/viewer weights, linear offline control, sealed audit,
  export/parity and grouped prediction diagnostics. See its [training contract](../../scripts/wingspan-selfplay/TRAINING.md).
- `plan.mjs` / `run.mjs` / `runtime.mjs`: frozen disjoint banks, three 1,024-group
  cycles at most, six-hour original absolute deadline, at most 24 BelowNormal
  workers, atomic records, raw/model/source hash checks and exclusive ownership.
  Generation, GPU fitting and timed evaluation execute sequentially.
- `profile.mjs`, `preflight.mjs` and `browser-preflight.mjs`: adversarial latency,
  zero-effect search identity and actual JS/Python/browser export checks.

The new dashboard study is `wingspan-selfplay`; this is distinct from the completed
`wingspan-neural` study. Public evidence contains summaries and model/source
receipts, not raw observations or Python environments. No training champion is
automatically a production promotion.

## Concrete raven latency repair

`findFoodPayment` formerly enumerated identical physical tokens repeatedly while
looking for a legal 2:1 substitution. Skipping equal token types at the same
recursive depth preserves the first minimal legal payment. Independent comparison
covered all 170 birds and 126 modest food multisets (21,420 cases), plus a stock
of 10,000 identical tokens. Human payment choices and rules are unchanged.

The old confirmation seed 46035892, seat 0, was reconstructed through all 85 prior
decisions using its recorded iteration counts and frozen model. Actor, role,
phase, action type/bird/habitat, roots, iterations, mean and selected visits matched
at every step. The saved state before step 86 is private runtime evidence. The
same 61 rollouts after repair took about 351 ms, settled every leaf and used no
neural evaluations. The original record was 78.97 seconds under a different
concurrent load; do not infer a controlled 225× speedup from those two timings.

Four fixed adversarial one-second-request fixtures, including rich-stock double
ravens and power decisions, passed with a maximum of about 1,001 ms. This is a
functional latency check, not a population tail guarantee. Calibration and all
later game records retain p99/max, real samples, fallbacks and failures.

## Verification observed before campaign

The initial full Node suite passed 1,050 tests with no failures. Four additional
search checks passed for zero identity, units/terminal behavior, action-counted
settled horizon and rich-stock roots. Trainer checks passed all ten tests,
including a real CUDA fit and sealed-file/read/resume guards.

Two full functional games, outside the campaign and excluded from strength
claims and campaign learning, each produced 104 viewer examples and 26 main
actions per player. A CUDA fit from this tiny plumbing dataset exported a real
nonzero model; it is not a useful-strength result or candidate. JS/scalar/Torch
parity passed all eight available round/viewer cells. Desktop touch Chromium
reported zero parity error and about 0.20 ms p95 encoding plus inference. This
does not establish real iPad Safari acceptance. The dashboard browser smoke test
also passed phone/tablet layouts, selection, incomplete results and fallback.

Final integrated checks passed 1,088 Node tests, 417 syntax-checked JavaScript
modules, all ten Python trainer checks and 81 maintained documentation files.
Affected Wingspan browser checks also passed setup, actions, food, undo/redo,
worker pause/resume, explicit AI, physical observations and tablet viewport.
A conservative seed audit found no overlap among 3,624 proposed independent setup
seeds and 4,287 retained historical seed identities/ranges. The audit and exact
source/model/process receipts remain in the external runtime.

The source archive, seed inventory and live summaries are published on development
branch `benchmarks/wingspan-selfplay-2026-10-19` under `wingspan-selfplay/`.
The [new dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-selfplay)
passed full Validation/Pages for implementation `04b01cd` and launch record
`f59a0ff`. Actual public touch-Chromium inspection at 14:56 UTC confirmed the new
study selector, remote evidence feed, calibration and generation-1 collection,
24 active workers, no page errors and no phone/tablet overflow. This remains an
automated desktop check, not actual iPad Safari acceptance.
Snapshot-only evidence pushes follow the same CI
exclusion as previous studies; main application changes still require full checks.
Do not infer a running campaign
from this document; inspect the runtime manifest and actual process receipts.

Calibration passed all 32 games and 3,192 measured decisions: mean 1,001.75 ms,
p95 1,004.78 ms, p99 1,007.84 ms and maximum 1,013.68 ms. Generation 1 then started
collecting its frozen 1,024 groups, with no failures at the first supervision check.
These are functional timing/data results, not learned playing-strength evidence.

Display correction: the frozen snapshot builder inherited the collection budget
caption for the calibration row. Actual calibration tasks use 1,000 ms per whole
decision, not the collection's 80/20 sample mix. The website now displays the
correct calibration budget without changing frozen source, data, clocks or
comparisons. Original snapshots remain preserved; read their calibration budget
caption with this correction. Caption update `a66279d` passed Validation/Pages;
actual public browser inspection at 15:06 UTC confirmed it.

The same inspection found a separate delivery issue: the raw branch CDN still
returned a 15:00 snapshot despite a healthy publisher and newer pushed evidence.
The website now resolves the evidence branch's immutable commit when a running
snapshot is stale or older than the last displayed data. Reference lookups are
limited to once per three minutes per page; API failure retains the newest known
snapshot with its honest timestamp. The browser regression covers stale recovery,
lookup throttling, monotonic progress and an API outage. A local frontend check
against the real public reference/immutable feed passed at 15:08 UTC. This is a
presentation/infrastructure repair only; all 105 frozen experimental source files,
tasks, data and the original deadline remain unchanged. Cache repair `764cdd7`
and missing-verdict correction `74b44d1` passed required Validation/Pages. Actual
public phone-browser verification at 15:26 UTC loaded the live screen stage,
with no errors or overflow; a forced stale-feed check also verified immutable
recovery after deployment.
Training cards also omit the held-out learning verdict until an explicit boolean
is present; a missing field is not a failed audit. Browser regression covers
development-only cards alongside the cache recovery checks.

## First completed generation screen

At the 15:36 UTC supervision check, generation 1 had completed collection,
CUDA training and its fixed 40-pair exploratory screen. Generation 2 collection
was running (239/1,024 groups); both actual controller/publisher command lines
and BelowNormal priority were verified, all 105 frozen source hashes matched,
and publication had no consecutive failures. These are timestamped observations,
not a promise of current liveness.

Generation 1 used 768 training groups and 128 development groups; its 128 sealed
audit groups remain unopened. Development selection chose epoch 3, with mean
absolute residual prediction error 7.251 points versus 8.016 for zero correction
and 7.735 for the linear control. Development Huber loss improved from 0.43984
to 0.37260. Training continued through epoch 7 under the frozen patience rule;
development error worsened after epoch 3, so later weights were not selected.
Export parity passed. These are development-selected prediction measurements,
not audit or playing-strength confirmation.

The complete screen against reference R produced 50 wins, 28 losses and two ties:
63.75% win share, +5.10 mean points. Independent regrouping verified every setup
appears in both seats and reproduced paired approximate t intervals: share
53.52–73.98%, margin +2.19–+8.01 points (95%, 40 independent pairs). This is an
exploratory promotion screen for the training champion; fresh final confirmation
and equal-cost zero attribution are still pending. It does not justify a
production promotion or quantify strength against human players.

Both sides requested 1,000 ms per complete decision at horizon 4. Candidate
latency was mean 1,001.88 ms, p95 1,004.82 ms, p99 1,007.30 ms and maximum
1,018.90 ms; all validity and latency gates passed. Candidate/opponent completed
1,645,908/1,652,729 rollouts across 4,086/3,941 decisions. No illegal actions,
errors, unvisited supplied roots, unsettled leaves, safety caps or coverage-floor
overruns were recorded. Only 555,956 candidate leaves used the neural correction;
1,089,952 used the explicit fallback. Preserve these applicability limits when
interpreting gains; the experiment is not a fully neural search policy.

Production remains opening-plan plus expanded setup and horizon 4. The controller
continues the already approved cycles and fixed final comparisons without
outcome-based retuning, extra tournaments or a reset of the original deadline.

## Closeout

All three collection/training cycles, screens, the once-only sealed audit,
400 fresh confirmation games and 160 exploratory scaling games completed before
the original deadline. Independent reviewer/coordinator calculations reproduced
paired results, split/read inventories, model hashes, validity and timing.
Final publisher receipt at 17:41:42 UTC records success and 4,064/4,064 games.
Both actual launch PIDs are absent after normal completion; no restart occurred.

The final report explicitly records the unexecuted training-only label-baseline
noise check, fixed-sample tails exceeding timed thresholds, and the automatic
analysis receipt's omission of scaling. Dashboard caption corrections and an
immutable final evidence feed preserve original frozen bytes. No test outcomes
selected another model. Future capacity work is separately authorized for up to
28 workers; this completed study remains 24 workers and retains its original clock.

Closeout validation in the canonical checkout passed 20 relevant static-asset,
self-play-dashboard and neural-dashboard tests, 418 syntax modules, 82 maintained
documentation files, and the phone/tablet dashboard browser suite including live
cache recovery, fixed sample captions and sealed-audit labelling. The dashboard
publisher test now decodes its Python script file URL correctly when the Windows
checkout path contains spaces. This test-only path repair does not alter frozen
experimental code. Required remote Validation/Pages and actual public final-feed
verification are the remaining publication checks at this commit.

## Runtime and reproduction

New external runtime root:
`C:/Users/mason/.codex/benchmark-runs/wingspan-selfplay-20261019`.
Functional smoke, replay and implementation checks are siblings of a separate
campaign directory, so their tasks cannot enter its dataset inventory by accident.

Prepare without starting clocks or workers:

```powershell
node scripts/wingspan-selfplay/run.mjs --out=EXTERNAL/campaign --prepare --workers=24 --cycles=3
```

Execute with the existing isolated CUDA Python interpreter:

```powershell
node --max-old-space-size=12288 scripts/wingspan-selfplay/run.mjs --out=EXTERNAL/campaign --python=PYTHON_EXE --device=cuda --workers=24 --cycles=3
```

The runtime manifest owns the first start/deadline; repeat commands never create a
fresh budget. Inspect ownership/process receipts before resuming. Failed or partial
scientific comparisons remain explicit and cannot be turned into successes by a
restart. Collection/test/audit banks are fixed before outcomes. Preserve the source
worktree while its source guard is active. The old workspace root is unrelated,
dirty and must remain untouched.
