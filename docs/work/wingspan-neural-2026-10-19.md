# Wingspan neural pilot — execution record

Status: fixed pilot and bounded diagnostics complete, October19,2026.
Lasting findings and the production decision are in the
[neural pilot evidence](../games/wingspan/2026-10-19-neural-pilot.md).
The [approved plan](../plans/wingspan-neural-pilot-2026-10-19.md) owns the fixed
questions, sample profiles, model selection and strength gates. Production remains
the [reviewed opening package](../games/wingspan/2026-10-19-selection.md).

## Implemented research path

All new code is under `scripts/wingspan-neural/`. The original research runners,
deployed snapshot and rules engine are preserved. Three parallel implementation
packages cover observation collection, training/export, and inference/search;
the coordinator owns frozen tasks, controls, execution and publication.

- `encoder.mjs`, `targets.mjs`, `collect.mjs`:1,316 fixed observation-only features,
  both viewer perspectives, actor-only teacher action records, exact terminal
  margin and12 auxiliary point targets. Failed trajectories retain no labels.
- `train.py`: train-only normalization, ridge linear control,64/32-hidden-unit MLP,
  three fixed optimization seeds, development-only checkpoint selection, held-out
  grouped errors and public-engine strata. Exported value net has86,401 parameters;
  auxiliary training parameters are recorded separately.
- `inference.mjs`, `rollout.mjs`, `search.mjs`, `game.mjs`: browser-safe float32
  inference, direct root-viewer margin blend, exact terminal/fallback behavior,
  original prior/policy, corrected settled research leaves, actual model hashes
  and measured learned-leaf/fallback counters.
- `plan.mjs`, `data-run.mjs`, `eval-run.mjs`, `analyze.mjs`: fixed grouped seeds,
  timing-only data admission, bounded24-worker pools, complete paired validation
  and two-control fresh confirmation. `pilot.py` orchestrates collection handoff,
  GPU fit, numerical/browser preflight,8 canaries,192 exploratory games and
  conditional600-game confirmation, with a six-hour overall ceiling from launch.
- `dashboard.mjs`, `publish.py`: public summary feed, source/model/data checksums
  and explicit small-artifact allowlist. Large observations, teacher roots,
  virtual environments and training checkpoints stay outside Git.

Data-generation source closure is frozen in each manifest. The pilot additionally
pins all inference/control/training source files across stages, and ties selected
weights to their offline certificate. Weight, selection, parity or source changes
stop downstream stages. Invalid or incomplete comparisons cannot pass a gate.
The driver exits nonzero on failure and preserves complete records on deadline.

## Resource and plumbing verification

Actual CUDA forward/backward passed on the RTX3080. Isolated environment:
Python3.13.14, PyTorch2.11.0+cu128, NumPy2.5.2, CUDA12.8 build. Full dependency
lock, hardware record and exact runtime paths accompany the public evidence.
Generation/evaluation uses at most24 BelowNormal workers. GPU training is separate
from collection, with2–4 CPU math threads and a6GiB VRAM ceiling.

The16 calibration games all completed validly and produced1,664 observations.
Mean summed worker time was32.70seconds/game under16 concurrent calibration jobs.
The conservative512-game estimate was17.44minutes at24 workers, so the full
320-train/64-development/128-test profile was frozen before dataset outcomes.
This estimate is provisional;24-worker contention and late games can cost more.

The seed audit covered2,601 retained/planned historical values and1,120 distinct
proposed game setups across all data/evaluation profiles, with no overlaps across
banks or history. Paired seats/comparisons reuse seeds intentionally within banks.
Calibration is excluded from all learning and strength claims.

Synthetic CUDA plumbing fit, Python/JS scalar parity and390×844 touch-Chromium
inference passed. Expanded parity used49 development-only cases/model across
rounds and both viewers. Synthetic MLP maximum PyTorch/scalar discrepancy was
0.00000346points. Synthetic browser p95 encoding+inference was about0.5ms for
this86k-parameter shape. These are implementation checks, not trained Wingspan
accuracy, strength or actual iPad Safari measurements.

The real fit passed59 development parity cases per model, round/viewer coverage,
0.001-point tolerance and20ms p95 encoding/inference ceiling before strength games.
The selected checkpoint and both references stayed fixed through all game tests.

## Evidence and current results

[Live neural dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-neural)
and [public report](https://github.com/seanmason/board-game-ai-dev/blob/benchmarks/wingspan-neural-2026-10-19/wingspan-neural/REPORT.md)
own current counters, fitting curves, offline errors, latency and paired results.
The report distinguishes data collection, offline fitting, validation and actual
playing strength. Publication does not promote a model.

The [bounded diagnostic follow-up](../plans/wingspan-neural-diagnostics-2026-10-19.md)
freezes a train/dev-only feature/capacity comparison and a fresh constant-value
attribution control. Both ran after the complete fixed pilot stopped, with no
overlapping GPU fit and timed strength games. A separately tested transport-only
resume retained the first control record and original deadline; original failure
artifacts remain alongside the repaired complete result. See the evidence report
for conclusions, the long search tail and interpretation limits.

The evidence publisher refreshes public snapshots every90seconds; the page polls
every60seconds. It shows the current stage, collection counts, latest optimization
seed/epoch and development loss, then held-out error and paired game results as
they become available. Phone/tablet Chromium checks cover the training display;
these automated checks do not establish real iPad Safari acceptance.

Runtime root on the recorded desktop:
`C:\Users\mason\.codex\benchmark-runs\wingspan-neural-20261019`.
Generation and dataset manifests identify source bytes even when collection began
before the combined implementation commit. The full source archive and manifest,
plus per-file dataset/model hashes, preserve exact reproduction inputs.

## Verification commands

Implementation validation recorded1,024 passing Node tests,395 syntax-checked
modules and11 passing Python training tests. Source commits85d5a31/91647e4 and the
diagnostic protocol commit69943e7 passed GitHub Validation and Pages. Final artifact
checks passed8 focused dashboard/static-packaging tests and the documentation
check covering79 files/15 packaged entries. External mechanical-resume tests
passed7 checks; the repair-aware publisher passed3 synthetic checks. Independent
audits reconciled all600 confirmation games and64 repaired control games. These
checks do not add human-strength, physical-table or real iPad acceptance evidence.

Run Node tests with `node --test --test-concurrency=3`, syntax/docs checks with
`node scripts/check-syntax.mjs` and `node scripts/check-docs.mjs`. Run Python
training tests with the isolated environment's interpreter and
`scripts/wingspan-neural/training-tests.py`. Execute synthetic and real
`preflight.mjs` / `browser-preflight.mjs` with their recorded model directories.
Public Pages remains gated by full GitHub Validation.

Full data generation:

```powershell
node --max-old-space-size=12288 scripts/wingspan-neural/data-run.mjs --out=RUNTIME/dataset --profile=full --workers=24
```

The one-shot pilot driver uses the isolated Python interpreter, `--runtime`,
`--root` and absolute `--node` arguments. Set `WINGSPAN_PLAYWRIGHT_MODULE` to the
available Playwright module URL when the experimental checkout has no local
package installation. Never restart it with a fresh deadline or reuse offline
test outcomes to tune a new checkpoint. Preserve failed results for diagnosis.
