# Two-player neural value pilot — October 19, 2026

Decision: retain the production opening-plan evaluator, expanded setup choices
and horizon 4. The neural blend passed confirmation against the deployed AI but
failed the required comparison against the corrected research reference.

The [public report](https://github.com/seanmason/board-game-ai-dev/blob/benchmarks/wingspan-neural-2026-10-19/wingspan-neural/REPORT.md)
and [dashboard](https://seanmason.github.io/board-game-ai-dev/benchmark-dashboard/?study=wingspan-neural)
retain the exact manifests, model/source hashes, errors, learning curves, paired
results and diagnostic artifacts. The [execution record](../../work/wingspan-neural-2026-10-19.md)
owns implementation and reproduction details. No finished-release claim follows.

## Fixed experiment and fresh confirmation

The data teacher played 512 valid games, split by whole setup into 320 training,
64 development and 128 test games. Both viewers and all turns stayed together.
The 53,248 observations are correlated positions, not independent games. Calibration
was excluded. Inputs were 1,316 separately redacted observation features; opponent
private identities, deck order and RNG state were unavailable to inference.

The selected 64/32-hidden-unit value network has 86,401 inference parameters.
It used final margin plus training-only auxiliary point targets. Three fixed
optimization seeds used development loss for selection; test outcomes did not
select the checkpoint. CUDA training took 17.34 seconds on the RTX 3080. The real
export passed 59 development parity cases per model, with exact Python-scalar/JS
agreement and about 0.30 ms browser p95 encoding plus neural inference. Desktop
touch-Chromium checks do not establish actual iPad Safari acceptance.

One fixed 50% learned/reference blend passed the 192-game exploratory screen and
advanced to 600 fresh games. Every setup rotated the candidate through both seats.
Both controls requested 1,000 ms per complete decision, with a soft minimum root
coverage requirement. All 600 confirmation games were valid, with no illegal
actions, caps or unresolved research leaves.

| Fresh comparison | Setup pairs | Neural winner share | Paired 95% interval | Mean margin | Margin 95% interval |
| --- | ---: | ---: | --- | ---: | --- |
| Deployed opening package | 200 | 57.0% | 52.11–61.89% | +1.77 | +0.52 to +3.01 |
| Corrected research reference | 100 | 50.0% | 43.39–56.61% | −0.04 | −1.53 to +1.45 |

Each superiority claim used one-sided alpha 0.025 for the two planned controls;
its lower bound equals the displayed two-sided 95% lower endpoint. Mean/p95
latency gates passed. The deployed comparison passed; the research-reference
comparison failed. This is not evidence of equivalence to the reference, nor a
direct reference-versus-deployed comparison. No automatic promotion occurred.

## What the network learned and the size question

All three original fits chose epoch 1; development loss then worsened while the
training objective fell. This is consistent with overfitting or representation
mismatch. Test grouped absolute margin error was 9.12 points for the neural net,
9.84 for ridge, 9.69 for a constant and 7.70 for the existing heuristic estimate.
Neural versus constant improvement was uncertain; the heuristic was clearly more
accurate on this metric. Absolute prediction error does not measure action ranking
or establish playing strength.

Of 1,316 inputs, 1,202 varied in training. Removing constant columns alone saves
only 8.7%. A separately frozen train/development-only probe compared four cells:

| Inputs / hidden widths | Training parameters | Development Huber | Development grouped MAE |
| --- | ---: | ---: | ---: |
| 1,316 / 64,32 | 86,797 | 0.07632 | 9.384 |
| 1,316 / 16,8 | 21,325 | 0.07744 | 9.233 |
| 491 / 64,32 | 33,997 | 0.06801 | 8.835 |
| 491 / 16,8 | 8,125 | 0.07001 | 8.932 |

The smaller full-input network did not improve the primary development loss.
Compact inputs look promising, but remove useful information as well as dimensions.
All paired development MAE improvement intervals included zero. Development data
also selected checkpoints, so these are exploratory findings. The probe opened
zero test files and produced no new online candidate or promotion evidence.

## Practical limits and attribution

The 50% blend changes the scale of the reference delta relative to the original
action prior and UCB exploration. A constant learned value therefore changes play
even without useful learned ordering. The separately frozen 64-game constant-output
control retains the real hidden layers, encoder and dense work while zeroing the
final scalar head. All 64 games completed, giving 32 seat pairs. The real network
achieved 48.44% winner share (descriptive paired 95% interval 37.71–59.16%) and
+2.22 mean margin (−1.22 to +5.66). This did not demonstrate useful learned value
over the constant control, but does not establish equivalence or rule out a
meaningful effect. This was exploratory attribution, not a promotion gate.

The first control attempt stopped after one valid saved game because its validator
mistook scheduler-only `startedAt` metadata for a frozen task field. A separately
tested mechanical resume compared the canonical plan fields, retained that record
byte-for-byte and preserved every task, model, seed and the original 14:11:48 UTC
deadline. All 64 games finished by 14:09 UTC. Original failed artifacts and separate
repair source, tests, receipts, analysis and raw-record hash inventory remain in
the public report. A publisher handoff race was also corrected without changing
experimental results. No unsuccessful record or interrupted history was erased.

Confirmation also exposed a 78.97-second neural-arm decision in a raven-heavy
round 4 position: seed 46035892, seat 0, step 86, power 33, 61 roots and 61 iterations.
All those rollouts used reference fallback. The logs establish that search, rather
than initial action generation or dense neural inference, dominated the stall.
They cannot distinguish expensive continuation work from scheduling or GC.
Across 21,088 candidate decisions versus deployed, 16 exceeded 2 seconds and 7 exceeded
10 seconds. Passing the declared mean/p95 gates does not remove this practical tail.

Before another broad tournament, reconstruct and profile the slow case and instrument
generation, continuation and evaluation cost. A useful next model would learn a
correction to known score/reference arithmetic, with zero correction reproducing
the reference. Freeze any new design on training/development data and use fresh
holdout and strength banks: the original test set has now been inspected.
