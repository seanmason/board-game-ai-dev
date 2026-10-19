# Frozen constant-value attribution control (prepared, not launched)

Purpose: compare the frozen real neural 50% value blend against a zero-output
model using the identical encoder, normalization, hidden weights, architecture,
float32 dense operations, search policy and fallback rules. This isolates useful
learned endpoint variation from the blend's reference-leaf rescaling. It is an
exploratory/descriptive experiment and cannot authorize promotion.

For eligible nonterminal ordinary roots/leaves, reward is
`.41*referenceDelta + .41*networkDelta + .18*rootPrior`. The zero model leaves
`.41*referenceDelta + .18*rootPrior`. Setup/power roots retain the complete
reference continuation; terminal leaves retain exact score. The control uses
that same adapter rather than globally halving every reference reward.

The real model is copied byte-for-byte from the selected pilot checkpoint.
The control retains the real model's normalization and all hidden-layer weights
and biases, but makes the final scalar output head's weights and bias zero.
Every normalization and dense layer still executes; there is no zero fast path.
The internal `linear` model slot is only a transport label: it loads this
same-shape zero-output MLP, never the separately trained ridge model. Task and
result metadata identify both roles explicitly.

Exactly 32 fresh setup seeds `48000000 + 997*i`, each in both candidate seats,
produce 64 games. Both arms request 1000 ms for the complete decision interval,
horizon 4, original continuation policy, root prior .18, leaf scale .82,
UCB exploration 3.5, common 192-transition cap and all supplied-root coverage.
Workers are capped at 24 and run BelowNormal. The whole batch has a 15-minute
wall-clock limit; completed records survive a deadline, and incomplete stages
have no success/adoption gate. This is requested-time matching, not equal samples
or a strict per-decision deadline. Record actual latency, samples and overruns.

No games start in preparation mode (the default). Execution requires the
coordinator's later authorization, the fixed pilot's completed receipt, a new
exclusive execution receipt, and matching frozen source/model/control hashes.
No overlapping pilot pool, automatic retries of a returned invalid game,
outcome-based stopping, seed substitution, checkpoint selection or extra games.
Existing helper permits one retry only for a process crash with no returned game.
A model/source/invalid-endpoint failure stops dependent work and retains evidence.
The execution receipt is never removed, so re-running this campaign is refused.

Before execution, require structural identity of all hidden layers and
normalization, exact zero predictions across the certified development fixtures,
Python/JS certification already passed for the real model, formula and fallback
unit checks, equal dense operation count, and bounded paired inference timing.
Preparation timing under an active pilot is provisional, never used for model
selection or a strength claim. Quiet timing is repeated before workers start.

Primary descriptive endpoint: setup-paired mean real-model winner share, with
paired descriptive 95% intervals, plus score margin. Report all games and paired
latencies, actual samples, model hashes and learned/fallback endpoint counts.
Use paired setup units rather than decisions or rollout samples. Also report
reference/zero formula interpretation, the 50% reference blend and teacher-policy
limitations. No promotion gate, multiplicity-adjusted superiority claim or
post-result model replacement belongs to this small attribution experiment.

Commands (outside the repository):

- `node control.mjs` or `node control.mjs --prepare-only`: prepare/check only.
- `node tests.mjs`: inference/algebra/readiness tests only; no games.
- After explicit coordinator authorization and fixed-pilot completion only:
  `node control.mjs --execute --approved-after-fixed-pilot`.

All artifacts, tests, models and results remain in this external directory.
No frozen repository source is edited.
