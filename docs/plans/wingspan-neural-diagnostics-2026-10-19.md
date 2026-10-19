# Wingspan neural pilot diagnostics

Prepared after the completed192-game screen and before fresh confirmation
results. The user authorized autonomous investigation while away. These bounded
diagnostics do not change the frozen pilot, its selected checkpoint or its gates.

## Feature and capacity comparison

After the entire fixed pilot stops, run the separately frozen runtime plan
`feature-capacity-probe/plan.json` (SHA256
`db99db669b4fe67cbb3ac62aba833aebc7a178e1c9b25d41c8d48588974fc39d`).
Compare four cells, each with the same three optimization seeds and optimizer,
loss, auxiliary targets, normalization and early-stopping protocol:

| Inputs | Hidden widths | Training parameters | Execution |
| --- | --- | ---: | --- |
| Full1,316 |64,32 |86,797 | Reuse locked original checkpoints |
| Full1,316 |16,8 |21,325 | Three new fits |
| Compact491 |64,32 |33,997 | Three new fits |
| Compact491 |16,8 |8,125 | Three new fits |

Only the384 manifest-selected training/development game files may be opened.
Inventory tests reject test-file access, missing entries and changed bytes.
Normalization must reproduce the original training-only arrays exactly. Report
development Huber loss, grouped absolute error, round breakdowns, selection
epochs, parameter counts and CPU inference time. Comparisons are exploratory
because development outcomes also select checkpoints.

The compact projection retains ordered board slots and installed-power counts
but drops useful hand identities and bird traits. It therefore changes both
information and dimension. Full versus smaller hidden layers with identical
inputs is the cleaner capacity comparison. Do not select a production model or
reuse the already inspected pilot test set to confirm a new model.

## Constant-value attribution control

The positive screen justifies one additional32-pair/64-game diagnostic after the
fixed pilot and GPU probe finish. Compare the original selected network blend
against a zero-output blend on fresh setups. Preserve encoding, dense inference
work,50% blend, fallbacks, exact terminal scoring, horizon4, original prior/UCB
and complete supplied-root coverage. Zero only the final output head while
retaining the original hidden layers; verify exact-zero predictions and timing.

Use24 BelowNormal workers,1,000ms requested per complete decision and a15-minute
hard limit. Freeze and independently audit the proposed seed bank
`48000000 + 997i`, for `i=0..31`, before dispatch. Freeze actual source and model
hashes, retain both seat games, validate counters and report paired results with
descriptive uncertainty. No outcome-based early stopping or automatic promotion.

This control matters because a constant learned value halves the reference
delta at supported nonterminal leaves while retaining the action prior and UCB
scale. A favorable whole-package result alone does not isolate learned ordering.
Do not replace this control with a global half-leaf shortcut, which would change
fallback behavior. Keep the run isolated and retain unfavorable results.

## Boundaries

Do not overlap GPU fitting with timed strength games. No additional feature grid,
weights, seeds or games are authorized by this diagnostic plan. Future candidates
need fresh confirmation data. A promising next design to consider separately is
predicting a correction to known scoring arithmetic rather than relearning it.

See the [execution record](../work/wingspan-neural-2026-10-19.md) and its public
dashboard/report links for measured outcomes and implementation evidence.
