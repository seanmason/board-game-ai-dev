# Frozen first-pilot training

Use the isolated environment prepared for this pilot. `train.py` requires NumPy
and PyTorch; it records their exact installed versions and `pip freeze` alongside
every run. It installs nothing. Run `training-tests.py` explicitly for synthetic
checks; these tests do not collect board-game trajectories or measure strength.

```powershell
& PATH_TO_VENV_PYTHON scripts/wingspan-neural/training-tests.py
& PATH_TO_VENV_PYTHON scripts/wingspan-neural/train.py --data=DATASET_ROOT --out=FRESH_MODEL_DIRECTORY --device=cuda --max-vram-gb=6
```

The dataset manifest must contain `featureVersion`, `featureNames`, and its frozen
task inventory. Games live under `games/*.json` and contain `task`, `result`,
`valueExamples`, and `validation.valid`. Failed/incomplete games are quarantined
and block fitting, rather than reducing the admitted sample. All viewer examples
and related games from one setup seed must remain in one split. The trainer checks
both viewer labels against exact terminal scores. Observation privacy is enforced
by the encoder/collector; terminal labels never become input features.

Training uses only train-derived float32 means/scales, no feature clipping, a
64/32 ReLU network, Huber margin loss scaled by 30, auxiliary component loss scaled
by 20 with coefficient 0.1, and AdamW at 0.001 with weight decay 0.0001. Three seeds
1729/2718/31415 each run at most 100 epochs with patience 10 and batches of 512.
The selected checkpoint minimizes development main-value Huber loss, then CPU
latency, then seed. The auxiliary head is excluded from inference. The ridge
baseline uses the same features/normalization and the fixed objective
`||Xw-y||² + 10||w||²`, with an unpenalized intercept.

`selection.json` and model bytes are saved before offline test metrics are
calculated. Tests do not select checkpoints or architectures. A failed held-out
learning gate stops the run and retains its artifacts. That gate requires the
selected model's setup-group mean MAE to beat the train-constant predictor in
both development and test data; it supplies no playing-strength claim. Reports
include paired setup-group bootstrap comparisons, phase errors, calibration in
point units, and observation-safe reference comparisons when supplied. Missing
reference predictions are explicitly reported.

`linear.json` and `mlp.json` use version 1 dense layers with flat output-major
weights. Normalize `(features-mean)/scale`, apply ReLU after hidden layers, then
multiply the final scalar by `valueScale=30` exactly once to obtain margin points.
`parity.json` includes a literal float32 product/accumulation oracle and independent
PyTorch predictions; maximum disagreement must remain below 0.001 points. All
model and data-source hashes, environment versions, curves and checkpoint
stability results are retained. Production changes require separate fresh game
evidence.
