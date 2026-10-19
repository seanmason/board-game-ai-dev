# Compact Wingspan self-play implementation — October 19

Status: bounded campaign running from frozen source `04b01cd`.
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
is deployed through required full Validation/Pages; publication verification is
pending at this record update. Snapshot-only evidence pushes follow the same CI
exclusion as previous studies; main application changes still require full checks.
Do not infer a running campaign
from this document; inspect the runtime manifest and actual process receipts.

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
