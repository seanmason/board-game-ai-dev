# Wingspan evaluator and compute study

Status: **running**; stage **screen**. Snapshot 2026-10-19T00:31:37.651Z.
Recorded 12 / 1600 scheduled games; 12 valid and 0 invalid records. 18 active games; worker limit 18, BelowNormal priority.

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

Initial cost estimate from eight canaries and diagnostic timings: roughly 3-8 hours for the bounded full batch at 18 workers, with substantial uncertainty from evaluator cost, power density, and desktop load. No outcome-driven stopping or extra tournaments are authorized by that estimate.

## Progress (descriptive, incomplete until scheduled cells finish)

| Stage / matchup | Valid / planned | Complete seat pairs | Winner share | Paired 95% interval | Mean margin | Mean candidate decision |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| screen/reference-n100-h4 | 1 / 80 | 0 / 40 | - | - to - | - | 391.9 ms |
| screen/reference-n100-h12 | 1 / 80 | 0 / 40 | - | - to - | - | 1519.2 ms |
| screen/reference-n300-h4 | 1 / 80 | 0 / 40 | - | - to - | - | 904.5 ms |
| screen/reference-n300-h12 | 0 / 80 | 0 / 40 | - | - to - | - | - |
| screen/exceptional-n100-h4 | 1 / 80 | 0 / 40 | - | - to - | - | 474.6 ms |
| screen/exceptional-n100-h12 | 0 / 80 | 0 / 40 | - | - to - | - | - |
| screen/exceptional-n300-h4 | 1 / 80 | 0 / 40 | - | - to - | - | 1426.7 ms |
| screen/exceptional-n300-h12 | 1 / 80 | 0 / 40 | - | - to - | - | 2416.5 ms |
| screen/chains-n100-h4 | 1 / 80 | 0 / 40 | - | - to - | - | 461.6 ms |
| screen/chains-n100-h12 | 1 / 80 | 0 / 40 | - | - to - | - | 1065.4 ms |
| screen/chains-n300-h4 | 1 / 80 | 0 / 40 | - | - to - | - | 1380.2 ms |
| screen/chains-n300-h12 | 0 / 80 | 0 / 40 | - | - to - | - | - |
| screen/investment-n100-h4 | 1 / 80 | 0 / 40 | - | - to - | - | 631.4 ms |
| screen/investment-n100-h12 | 0 / 80 | 0 / 40 | - | - to - | - | - |
| screen/investment-n300-h4 | 1 / 80 | 0 / 40 | - | - to - | - | 1671.9 ms |
| screen/investment-n300-h12 | 0 / 80 | 0 / 40 | - | - to - | - | - |
| screen/blend-n100-h4 | 1 / 80 | 0 / 40 | - | - to - | - | 1228.4 ms |
| screen/blend-n100-h12 | 0 / 80 | 0 / 40 | - | - to - | - | - |
| screen/blend-n300-h4 | 0 / 80 | 0 / 40 | - | - to - | - | - |
| screen/blend-n300-h12 | 0 / 80 | 0 / 40 | - | - to - | - | - |

These partial summaries are descriptive. Do not select a winner, claim compute scaling, or change defaults from the live screen. Fixed seed groups are the pairing unit; ties use exact final-outcome share. Invalid/capped records remain in raw evidence and are excluded from valid paired summaries. The runner halts on an invalid result.

## Evidence and reproduction

Raw immutable per-game JSON appears under [games/](games/); filenames encode task IDs. Execution receipts record actual invocation times and priority. The runner writes screen-analysis.json, selection.json, confirmation-analysis.json and analysis.json only as their stages validate. Source and record SHA256 inventories preserve exact runtime bytes; nested .gitattributes disables line-ending conversion for this evidence folder.

On the frozen source checkout (Node 22 or the recorded compatible Node runtime), run:

```powershell
node scripts/wingspan-study/run.mjs --mode=study --out=NEW_EXECUTION_DIRECTORY --workers=18 --calibration=PATH_TO_FROZEN_CALIBRATION_JSON
```

Use exact archived source bytes to satisfy raw hash guards, including Windows line endings. A retained execution can resume only with an identical manifest; never delete invalid or unfavorable records to rerun them.

Limits: root choices use the representative generator, not exhaustive legal moves. Heuristics remain bounded approximations; early investment does not forecast gathering actions. Power-flow counters are owner net resource deltas, not exhaustive gross attribution across nested/shared powers. The delayed-discard ledger conservatively matches the current pending model; it does not resolve every unusual physical-card interaction. Legacy R0 endpoint settlement is explicitly uninstrumented, never certified as corrected. Results concern this internal two-player matchup and are not human-strength certification.
