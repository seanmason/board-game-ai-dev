# Wingspan evaluator and compute study

Status: **running**; stage **screen**. Snapshot 2026-10-19T03:26:57.393Z.
Recorded 1521 / 1600 scheduled games; 1521 valid and 0 invalid records. 24 active games; worker limit 24, BelowNormal priority.

[Live dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-evaluator) · [Frozen protocol](protocol.md) · [Evaluator formulas](methods.md) · [Manifest](manifest.json) · [Checkpoint](checkpoint.json) · [Source archive](execution-source.zip) · [Source archive digest](archive-sha256.txt) · [Seed audit](seed-audit.json)

Execution source: `a863dc5c8a3a9510729ea6f050633015bb3bec11`. Deployed comparison pipeline is frozen from `66444d1868c364e11712253d73542d50b9cb0705`. Production defaults remain unchanged during research.

## Design and decision rules

Reference plus exceptional-power action economy, ordered sustainable row chains, bounded early investment, and a conservative blend. Each method crosses 100/300 root samples with horizons 4/12 against the fixed reference at 300/4. Horizon counts subsequent ordinary actions across both players, not the acting player alone. The corrected research endpoint finishes pending powers before leaf evaluation; the original deployed pipeline is retained separately.

The screen has 40 fresh seat-swapped setup pairs per cell, 1,600 full games. At most one challenger qualifies using only the 300/4 cell (at least 55% winner share, positive margin, all results valid), ranked by share, margin, stable key. Confirmation uses separate fixed banks: up to six 100-pair comparisons of equal-work strength, sample scaling, horizon scaling, and matched-requested-time strength against deployed R0. If none qualifies, execute only the three reference comparisons. This is 2,200 or 2,800 strength games plus eight prior canaries; no outcome-dependent extra studies.

Fresh superiority requires a one-sided paired-t lower bound above 50% using fixed alpha 0.05/6, positive margin and complete valid results. This is approximate family error control. Promotion additionally requires the equal-work and matched-time gates, with mean latency ratio at most 1.10 and p95 ratio at most 1.25. More compute winning is a separate hypothesis, not a selection rule. Degenerate samples use conservative uncertainty rather than false certainty.

## Timing and validation

Outcome-blind calibration: 24 fixed diagnostic positions; matched requested-time target **329 ms** (ceil median total decision time). Observation, root generation, search initialization and sampling are charged. Mandatory root coverage can overrun the soft target. Timed outcomes can differ under different hardware/load.

Eight reference canaries completed with zero errors, safety caps, unsettled study leaves or uncovered roots. Their original source archive and manifest are preserved under [canary/](canary/). Later challenger-ledger corrections were fixture-tested before screening. Final calibration is [preflight-final/calibration.json](preflight-final/calibration.json); the earlier calibration is retained, superseded for execution.

Local preflight: 945 Node tests passed; syntax checked 354 modules; documentation checked 73 files and 15 packaged entries; dashboard browser checks and the actual 20-card 390-pixel touch layout passed. Automated touch checks do not establish real iPad Safari acceptance. GitHub full Validation separately gates Pages publication.

Initial cost estimate from eight canaries and diagnostic timings: roughly 3-8 hours for the bounded full batch at the original 18 workers, with substantial uncertainty from evaluator cost, power density, and desktop load. No outcome-driven stopping or extra tournaments are authorized by that estimate.

## Progress (descriptive, incomplete until scheduled cells finish)

| Stage / matchup | Valid / planned | Complete seat pairs | Winner share | Paired 95% interval | Mean margin | Mean candidate decision |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| screen/reference-n100-h4 | 76 / 80 | 38 / 40 | 42.1% | 30.3% to 53.9% | -2.99 | 344.1 ms |
| screen/reference-n100-h12 | 76 / 80 | 38 / 40 | 40.8% | 29.4% to 52.2% | -1.91 | 1218.6 ms |
| screen/reference-n300-h4 | 76 / 80 | 38 / 40 | 50.0% | 28.0% to 72.0% | 0.00 | 1023.6 ms |
| screen/reference-n300-h12 | 75 / 80 | 37 / 40 | 54.1% | 44.1% to 64.0% | 0.89 | 3653.8 ms |
| screen/exceptional-n100-h4 | 77 / 80 | 38 / 40 | 37.5% | 27.8% to 47.2% | -3.13 | 562.1 ms |
| screen/exceptional-n100-h12 | 77 / 80 | 38 / 40 | 34.9% | 24.0% to 45.8% | -5.24 | 1541.8 ms |
| screen/exceptional-n300-h4 | 76 / 80 | 38 / 40 | 52.6% | 42.7% to 62.5% | 1.17 | 1705.0 ms |
| screen/exceptional-n300-h12 | 76 / 80 | 38 / 40 | 55.3% | 45.1% to 65.4% | 1.37 | 4304.8 ms |
| screen/chains-n100-h4 | 77 / 80 | 38 / 40 | 44.7% | 32.9% to 56.5% | -2.29 | 569.2 ms |
| screen/chains-n100-h12 | 76 / 80 | 38 / 40 | 40.8% | 30.1% to 51.5% | -2.30 | 1484.2 ms |
| screen/chains-n300-h4 | 76 / 80 | 38 / 40 | 51.3% | 40.0% to 62.6% | 1.07 | 1668.2 ms |
| screen/chains-n300-h12 | 74 / 80 | 36 / 40 | 59.0% | 47.9% to 70.1% | 1.01 | 4463.7 ms |
| screen/investment-n100-h4 | 76 / 80 | 38 / 40 | 42.1% | 32.3% to 51.9% | -2.57 | 684.7 ms |
| screen/investment-n100-h12 | 76 / 80 | 38 / 40 | 39.5% | 28.6% to 50.4% | -5.05 | 1361.5 ms |
| screen/investment-n300-h4 | 76 / 80 | 38 / 40 | 46.1% | 35.7% to 56.4% | -0.32 | 2038.4 ms |
| screen/investment-n300-h12 | 75 / 80 | 37 / 40 | 41.9% | 33.3% to 50.5% | -1.04 | 4246.8 ms |
| screen/blend-n100-h4 | 77 / 80 | 38 / 40 | 53.9% | 43.6% to 64.3% | 0.33 | 1063.8 ms |
| screen/blend-n100-h12 | 77 / 80 | 38 / 40 | 40.8% | 30.1% to 51.5% | -2.88 | 1804.8 ms |
| screen/blend-n300-h4 | 76 / 80 | 38 / 40 | 58.6% | 49.1% to 68.0% | 2.80 | 3184.1 ms |
| screen/blend-n300-h12 | 76 / 80 | 38 / 40 | 42.1% | 31.6% to 52.6% | -1.30 | 5511.3 ms |

These partial summaries are descriptive. Do not select a winner, claim compute scaling, or change defaults from the live screen. Fixed seed groups are the pairing unit; ties use exact final-outcome share. Invalid/capped records remain in raw evidence and are excluded from valid paired summaries. The runner halts on an invalid result.

## Evidence and reproduction

Raw immutable per-game JSON appears under [games/](games/); filenames encode task IDs. Execution receipts record actual invocation times and priority. The runner writes screen-analysis.json, selection.json, confirmation-analysis.json and analysis.json only as their stages validate. Source and record SHA256 inventories preserve exact runtime bytes; nested .gitattributes disables line-ending conversion for this evidence folder.

For the recorded machine, use the archived 24-worker runtime wrapper to resume the existing execution only after verifying that no runner is active (recorded Node runtime is in execution-receipt.json):

```powershell
node PATH_TO_ARCHIVED_RUNTIME_WRAPPER --mode=study --out=EXISTING_EXECUTION_DIRECTORY --workers=24 --calibration=PATH_TO_FROZEN_CALIBRATION_JSON
```

Use exact archived source bytes to satisfy raw hash guards, including Windows line endings. A retained execution can resume only with an identical manifest; never delete invalid or unfavorable records to rerun them.

Limits: root choices use the representative generator, not exhaustive legal moves. Heuristics remain bounded approximations; early investment does not forecast gathering actions. Power-flow counters are owner net resource deltas, not exhaustive gross attribution across nested/shared powers. The delayed-discard ledger conservatively matches the current pending model; it does not resolve every unusual physical-card interaction. Legacy R0 endpoint settlement is explicitly uninstrumented, never certified as corrected. Results concern this internal two-player matchup and are not human-strength certification.

## User-authorized worker-count amendment

The user requested 24 workers after the original 18-worker launch. The original manifest, protocol, source archive and calibration remain unchanged. The operational wrapper permits only this manifest-checked concurrency change. It revalidates retained records and all63 frozen source hashes before resuming; evaluator formulas, tasks, seeds, budgets, horizons and decision gates are unchanged.

At the restart, 131 completed games were retained and 17 unsaved in-flight games were requeued without recorded outcomes. Screen timing mixes18- and24-worker phases. Confirmation, including matched-time comparisons, runs under24 workers. The original18-worker cost estimate above is historical, not an updated ETA.

[Operational amendment](worker-amendment.json) · [Archived 24-worker wrapper](runtime/runner-workers24.mjs) · [Original 18-worker checkpoint and receipt](executions/initial-18-workers/)

Wrapper SHA256: `a9ff92bae8746d798c693b7701b1f90c293d428e104718d9640c386094dfc5ea`.

The archived wrapper contains paths for the recorded machine and verifies the original manifest and amendment. Relocation or a separate execution requires its own explicit execution manifest; do not reuse this directory for a different study.
