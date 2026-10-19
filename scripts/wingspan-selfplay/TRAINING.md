# Compact residual trainer

Run `python -X utf8 scripts/wingspan-selfplay/train.py --manifest=ABSOLUTE_INDEX.json --out=FRESH_DIR --device=cuda`.
Later generations add `--warm-start=PREVIOUS_MODEL.json`. CPU uses `--device=cpu`.
The trainer requires NumPy and PyTorch; the isolated neural benchmark venv is suitable.
Run plumbing checks with `python -X utf8 scripts/wingspan-selfplay/training-tests.py`.
These checks generate synthetic records only and include CUDA fitting when available.

The schema-1 index declares `featureVersion: wingspan-compact-v1`, 192 unique
`featureNames`, 12 unique `auxNames`, and `records`. Each record has an absolute
`path`, `split`, `gameId`, `generation` (integer, starting at 1), and `setupSeed`.
Allowed splits are train, dev, audit and calibration. No evaluation split is allowed.
All inventory identities are checked before opening any records. Game IDs are unique;
setup seeds, including related seat swaps, cannot cross splits or generations' split
boundaries. Each opened record must be validated and complete, with matching frozen
task identity and matching example identities. Both viewers are required in each game.
Finite 192-input features, baseline/final margins, rounds 1–4 and twelve auxiliary
targets are required. If terminal scores are present, final margins must match them.
The collector owns redaction and the observation-safe baseline; fitting never derives
features or a baseline from hidden state. This trainer does not certify collector privacy.

Fitting reads only train and dev record paths. It does not stat, hash or open audit
or calibration records. `training-summary.json` logs exactly the records read and
their hashes, plus manifest, code and exported artifact hashes. Train-only generation-1
weighted mean/scale become float32 constants; subsequent fits must warm-start and
reuse those constants unchanged. A normalized drift summary records later shifts.
Generation, setup, game, round and viewer receive equal conditional weight. Thus
long games or duplicated snapshots cannot dominate a setup's total contribution.

The fixed seed is 1729. The model is 192→32 ReLU→16 ReLU→1, with correction
`10*tanh(output)`. The last head starts at zero. Huber loss trains against
`(finalMargin-baselineMargin)/10`; a training-only twelve-component head uses
targets divided by 20 and loss weight .05. AdamW resets each fit (recorded), with
learning rate .0005, weight decay .0001, batch size 512, cap 24 epochs and patience 4.
An improvement must exceed 1e-8 development Huber. Epoch zero always participates
and can win. Development metrics use the same pooled weighting for every epoch.
The summary includes group counts, per-generation/round/viewer and coarse named
engine activity strata, saturation at absolute correction ≥9.5, and a weighted
regularized linear control (ridge 10, free intercept). Metrics are prediction
diagnostics; eligibility requires improvement over epoch zero and zero correction
and does not establish strength or authorize production promotion.
Each epoch records balanced training Huber alongside development metrics. Selected
development and audit MAE have fixed-seed 1,000-replicate 95% percentile bootstrap
intervals, resampling setup groups within generation with equal generation weight.
These are group-level prediction uncertainty intervals, not playing-strength bounds.

Four CPU math threads and deterministic PyTorch operations are configured. CUDA
TF32 is disabled and the allocator is limited to at most 6 GiB. CUDA must be explicitly
requested and fails if unavailable. No collection, tournaments or retry loop runs here.

Artifacts are `model.json`, `zero-model.json`, `epoch-zero.json`, `linear-model.json`,
`parity.json` and `training-summary.json`. Zero retains the selected model's exact
hidden layers and normalization, with a zero final head; inference must still perform
the complete dense work. Layers export flat row-major output-by-input weights. JS
must float32-round normalization operands, subtraction and division; initialize each
sum with float32 bias; round each product and each sum; ReLU between hidden layers;
then evaluate `10*Math.tanh(finalScalar)`. `parity.json` provides feature vectors,
Python scalar expectations, PyTorch expectations and tolerance .0002. Its `passed`
flag covers Python scalar versus PyTorch only. JS export
parity remains a required integration check, owned by the runtime harness.
Up to 64 outcome-blind cases cover available round/viewer cells and multiple setup
groups; each case includes round, viewer and gameId for coverage checks.

After the final candidate is frozen, use a separate invocation:
`python -X utf8 scripts/wingspan-selfplay/train.py --manifest=INDEX.json --out=AUDIT_DIR --audit --model=FIT_DIR/model.json`.
Keep its frozen siblings `linear-model.json` and `training-summary.json`. The audit
checks model/control hashes against the completed fit before opening sealed data.
The final audit inventory can accumulate later generations when the frozen champion
came from an earlier fit; both training and final audit manifest hashes are retained.
The audit never fits or selects a model.
It compares the candidate, equal-cost zero/reference and frozen linear predictions.
`valid` means structural checks passed; `eligible` requires preexisting development
eligibility and audit Huber improvement over zero/reference greater than 1e-8.
That criterion is fixed here before audit; a failure cannot select another candidate.
Audit inference uses batched CPU PyTorch, with scalar parity checked on the same
outcome-blind coverage subset rather than executing Python scalar products for
every audit snapshot. An exclusive `INDEX.audit-receipt.json` records the model,
control and manifest hashes before sealed records open. A completed same-hash
request reuses its hash-verified saved summary without reopening audit records.
A different identity or incomplete/invalid receipt fails closed. Preserve
this receipt and the manifest in durable storage: copying the manifest to bypass
the receipt violates the once-only protocol. Calibration remains unopened. The
orchestrator must ensure the candidate is final and prevent post-audit tuning.

Implementation is research plumbing for the [self-play plan](../../docs/plans/wingspan-selfplay-loop-2026-10-19.md).
No real corpus, audit, tournament or playing-strength experiment is run by these tests.
