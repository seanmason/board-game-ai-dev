# Wingspan neural value pilot

Status: **running** · stage **screen** · snapshot 2026-10-19T12:59:41.735Z.
Recorded 560 / 728 scheduled actual games across the displayed stages. Data generation and training are not win-rate measurements.

[Live dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-neural) · [Dataset manifest](dataset/manifest.json) · [Seed audit](seed-audit.json) · [Source archive](execution-source.zip) · [Private-runtime inventory hashes](runtime-inventory.json) · [Model selection](training/selection.json) · [Offline report](training/offline-report.json)

## Scope and source

Original 170-bird, two-player Wingspan only. Observation inputs contain each viewer’s separately redacted information; actual final scores supply labels only. All turns, both viewers and related setup groups stay in one split. Calibration is excluded from learning. The data teacher uses the frozen deployed opening-plan package, horizon4, original prior, and independently seeded 80%100/20%300-sample decisions. Complete supplied-root coverage remains mandatory; candidate generation still prunes complete legal play.

Dataset profile: `full`. Base Git revision: `abe5bd2433b8bb54852f94876e1b0781147f5830`. Exact collection files are pinned by dataset manifest source hashes; revision alone does not describe uncommitted frozen modules.
Feature version: `wingspan-observation-v1`; 1316 features. Auxiliary targets: birds, bonuses, goals, eggs, cached and tucked points for both perspectives.

## Hardware and training

| Item | Value |
| --- | --- |
| Data/evaluation CPU pool | At most24 BelowNormal workers; Ryzen9 5950X /32 logical processors |
| Memory / GPU | About96GiB RAM; RTX3080 10GiB; training ceiling6GiB VRAM |
| Training device | NVIDIA GeForce RTX 3080 |
| Python / PyTorch / CUDA | 3.13.14 / 2.11.0+cu128 / 12.8 |
| Networks | Regularized linear control and input→64→32→margin ReLU MLP |
| Fixed value scale / auxiliary loss | Margin30 points; auxiliary coefficient0.1 |
| Optimizer defaults | AdamW learning rate0.001, weight decay0.0001; batch512; at most100 epochs, patience10 |
| Recorded trainer configuration | `{"auxiliaryNames": ["own.birds", "own.bonuses", "own.goals", "own.eggs", "own.cached", "own.tucked", "other.birds", "other.bonuses", "other.goals", "other.eggs", "other.cached", "other.tucked"], "auxiliaryScale": 20.0, "auxiliary_weight": 0.1, "batch_size": 512, "cpu_threads": 4, "epochs": 100, "learning_rate": 0.001, "optimizationSeeds": [1729, 2718, 31415], "patience": 10, "ridge_alpha": 10.0, "valueScale": 30.0, "weight_decay": 0.0001}` |

Normalization fits train groups only. Three fixed optimization seeds are compared using development Huber loss, then CPU latency, then seed. Test labels do not choose the model. Exported JSON models include normalization, frozen feature names, dense weights, model metadata and point scale. Python/JavaScript and browser parity evidence is retained when available. The selected binary training checkpoints remain outside Git.

Selected checkpoint metadata: `{"bestEpoch": 1, "checkpoint": "checkpoint-1729.pt", "checkpointSha256": "65ff14ed53c551d43451991b8e97b5291e0b271caf332d90e3da0af0026c48ab", "cpuInferenceMs": 0.04997500102035701, "devValueHuber": 0.07632496953010559, "seed": 1729}`.
Offline status: **passed**. Held-out learning gate: `True`. Offline prediction accuracy does not establish playing strength.

## Playing-strength results

| Comparison | Valid / scheduled | Complete setup pairs | Winner share (descriptive95% paired interval) | Mean margin (95% interval) |
| --- | ---: | ---: | --- | --- |
| canary/linear | 2 / 2 | 1 / 1 | 50.0% [0.0, 100.0]% | -5.00 [—, —] |
| canary/reference | 2 / 2 | 1 / 1 | 50.0% [0.0, 100.0]% | 1.50 [—, —] |
| canary/deployed | 2 / 2 | 1 / 1 | 100.0% [0.0, 100.0]% | 7.50 [—, —] |
| canary/neural | 2 / 2 | 1 / 1 | 50.0% [0.0, 100.0]% | 0.50 [—, —] |
| screen/linear | 8 / 64 | 4 / 32 | 50.0% [0.0, 100.0]% | 4.38 [-15.31, 24.06] |
| screen/reference | 8 / 64 | 4 / 32 | 68.8% [9.1, 100.0]% | 5.62 [-5.76, 17.01] |
| screen/deployed | 8 / 64 | 4 / 32 | 62.5% [0.0, 100.0]% | 0.00 [-15.45, 15.45] |

One fixed blend uses50% reference relative value plus50% learned viewer-relative margin; the margin prediction is not subtracted twice. Terminal scoring remains exact. Setup/pending or unsupported visibility contexts fall back to the reference. All pilot comparisons request1000ms per whole decision, including preparation, with a soft coverage floor. Linear, corrected-reference and actual-deployed controls remain distinct.

The screen uses32 fresh paired setups per comparison. A single preselected neural checkpoint can advance only after complete valid results, at least55% winner share and positive margin versus deployed, positive margin versus corrected reference, and mean/p95 latency ceilings1.10/1.25. If eligible, fresh confirmation uses200 pairs versus deployed and100 versus corrected reference. Each superiority claim uses one-sided alpha0.05/2, positive margins, complete validity and the latency gates. The independent unit is the setup pair, not individual observations or games. Partial intervals are descriptive; invalid or incomplete stages cannot establish a passing result. Canary outcomes validate execution only.

## Retained evidence and limits

Raw observations, teacher candidate actions, per-game dataset/evaluation records, virtual environments and .pt checkpoints remain outside Git in the private local runtime. `runtime-inventory.json` records relative filenames, byte sizes and SHA256 digests for completed artifacts, while public manifests retain seed/split assignments and source hashes. Only explicitly allowlisted small summaries, manifests, model/parity/loss JSONs and the source zip are published. Missing linked stages mean no artifact has been produced yet. Favorable, unfavorable, partial and failed summaries are retained.

This pilot concerns internal two-player simulator comparisons. It does not establish calibrated win probabilities, optimal play, independent human strength, or actual iPad Safari performance. Production defaults remain unchanged; publication is evidence sharing, not automatic promotion.
