# Wingspan Ubuntu migration handoff

Status: complete Windows research closeout; no experiment is active. Last observed:
2026-10-19 21:04 UTC. Application baseline: `39177dbec99961187ed8bb735a598bfb11c59de7`;
the later commit containing this handoff adds transfer support and preservation,
not a new AI. Development repository: [board-game-ai-dev](https://github.com/seanmason/board-game-ai-dev).

## Objective and boundaries

Move context and recoverable research inputs to Ubuntu without starting work in
the new chat. Use the [context-only prompt](ubuntu-context-prompt-2026-10-19.txt).
It explicitly requests acknowledgment and waiting, with no tools or actions.
The old Windows workspace and its dirty root remain preserved. The canonical
Windows checkout was `local-run/pages-publish`, branch `codex/next-games-plans`;
its final application changes were already on GitHub `main`.

Only `seanmason/board-game-ai-dev` is authorized for development and preview.
Do not change the separate finished-release repository `board-game-ai`.
Follow [AGENTS.md](../../AGENTS.md), [documentation routing](../INDEX.md) and
the [Wingspan overview](../games/wingspan/README.md) when work is later authorized.
Browser companions serve physical tabletop play: preserve actor observations,
hidden-information boundaries, complete legal human choices, preview/confirmation,
undo/history, and touch/keyboard access. Automated mobile Chromium is not real
iPad Safari acceptance. The six planned new games have implementations on main;
their remaining source/acceptance limits are in their individual overviews.

## Closed research and the retained teacher

Production remains **opening-plan with expanded setup choices and horizon 4**.
No neural model was promoted to browser production. Search horizon 4 excludes the
root main action and includes four subsequent main actions; resolving powers does
not consume that main-action horizon. Preserve physical setup observation guards.

The best accepted research teacher is compact **generation 3**: 192 semantic
observation features, a 192→32→16→1 ReLU network, 6,721 inference parameters,
and a bounded ±10-point residual added to reference evaluator R. It is used within
search, alongside existing heuristics and fallbacks; it is not a standalone learned
policy. Teacher SHA256:
`6131bafd429500d55fa5c60900923e6f46973a25905b3bb2df10ac7bb1922843`.
The [frozen teacher export](https://raw.githubusercontent.com/seanmason/board-game-ai-dev/9894988d53ff063f43bd2622c9658452a92532ca/wingspan-refit/frozen-models/frozen-generation-3.json)
is public. Inference exports omit the auxiliary training head.

| Completed study | Finding | Durable evidence |
| --- | --- | --- |
| [Compact self-play](../games/wingspan/2026-10-19-compact-selfplay.md) | 4,064 valid games; generation 3 achieved 76% against same-cost zero output and 65.5% against R in separate fresh 100-pair comparisons. These are not direct matches against the deployed package. Compute-scaling evidence remained inconclusive. | [3c98b00](https://github.com/seanmason/board-game-ai-dev/tree/3c98b00b303798f8ca0da41334508362a2592d9a/wingspan-selfplay) |
| [Cheap-data efficiency](../games/wingspan/2026-10-19-data-efficiency.md) | 1,680 valid games; 80% one-step/20% searched collection produced about 3.98× throughput, but the resulting model scored only 49.375%, −1.2625 points in its complete 40-pair screen. No confirmation or teacher update. | [42a9ac1](https://github.com/seanmason/board-game-ai-dev/tree/42a9ac1ee7d1b8b8ace5094b6e162539ab27a2df/wingspan-data-efficiency) |
| [Conservative refits](../games/wingspan/2026-10-19-refit.md) | Four learning-rate/auxiliary-loss recipes slightly improved development prediction. All selected epoch 1. Fresh selected-model confirmation: 93W/106L/1T, 46.75%, paired 95% interval 40.301–53.199%, −0.325 points. No teacher accepted; the conditional collection cycle never ran. | [9894988](https://github.com/seanmason/board-game-ai-dev/tree/9894988d53ff063f43bd2622c9658452a92532ca/wingspan-refit) |

Lower prediction loss and faster collection have not yet established an improved
teacher. Removing auxiliary loss did not improve development Huber in the controlled
refit contrasts; auxiliary interference is not an established explanation.
Neither more epochs nor a larger network is currently supported as the immediate fix.
Reports retain paired gates, latency, source hashes, failures and limitations.

The latest campaign finished normally at 20:37:24.466 UTC. Its independent audits
verified 127 guards, 4,008 retained records, four fit inventories and all 360 raw
strength receipts. All four research heartbeat automations are PAUSED. No controller,
trainer, game worker or publisher remains active. The remaining old dashboard bridge
and two local preview servers were stopped after checking actual command lines.
Do not infer process liveness from historical PIDs, clocks, manifests or launch scripts.

## Private data transfer

GitHub contains code, frozen model exports, safe aggregate evidence, source archives
and reports. Raw observations, features, labels and trajectories remain **private**.
A Git clone alone is insufficient to reproduce fits or analyze recorded decisions.

The portable ZIP was created inside the canonical checkout's ignored
`local-run/ubuntu-transfer-20261019/` directory. Transfer this directory separately
to Ubuntu; its presence or synchronization on the new machine has not been verified.

- Archive: `wingspan-evidence-private.zip`, **771,539,924 bytes**.
- SHA256: `bcdc4f6e8b4374026736d8e8d1ea3c8cc0b9eb8d5d23ef483a70c2c44f671c84`.
- 12,428 ZIP entries, about 9.48 GB of source file data; full ZIP CRC verification passed.
- All three closed campaign directories, root execution/review receipts, exact source
  archives, portable manifest and `reindex.py` are included. Windows environments,
  node_modules and executables are excluded.
- Approved fitting inventory: **3,360 train + 648 dev = 4,008 records**. All original
  training-input hashes were checked while packing. Old audit, calibration and
  strength records are retained as evidence only and must not enter fitting.
- Safe aggregate [transfer receipt](../../benchmarks/windows-ubuntu-handoff-2026-10-19/transfer-receipt.json)
  and checksum are public; the ZIP is deliberately not in GitHub or Pages.

After a separate instruction authorizes Ubuntu setup, verify the external checksum
before extraction. Preserve the original manifests and indexes, which contain Windows
absolute paths. The standard-library [migration utility](../../scripts/wingspan-migration-index.py)
can derive a **new** absolute-path index from the extracted transfer manifest. It
checks every approved source hash and identity, setup split isolation, completed/valid
collection status, and path containment; it refuses existing outputs. It does not
extract, install, train or resume a campaign. Its regression test covers integrity,
tampering, forbidden splits, traversal, split contamination and overwrite refusal.
Use fresh output directories for future work; never resume terminal Windows campaigns.

Ubuntu setup must discover actual CPU/GPU/VRAM and available runtimes first. Windows
used Node 24 locally (CI Node 22), Python 3.13, NumPy and CUDA PyTorch. Recreate suitable
Linux environments; do not copy the Windows venv. Linux process priority needs explicit
handling: the existing BelowNormal code is Windows-specific. Old worker counts and
GPU limits are historical constraints, not a description of the new machine.

## Git and legacy preservation

The checkout/branch audit found no missing implementation changes requiring integration.
Old root Kingdomino evidence is already preserved in
[the earlier archive](../../benchmarks/preserved-root-2026-10-18/kingdomino-budget.zip).
Its nine entries were rechecked against the preserved checksums. The old root's
Carcassonne replay fix/test are already incorporated and improved on main.
Two remaining stale scratch files are retained in
[scratch preservation](../../benchmarks/windows-ubuntu-handoff-2026-10-19/scratch.zip)
with an inventory; neither supersedes current source. Old worktrees and the dirty root
were not deleted or reset. This is a research migration, not a backup of the whole
Windows workspace, historical local-run folders or machine.

## Verification and possible next work

Application baseline `39177db` had full Validation and Pages green and a verified
public mobile Chromium dashboard: final refit 360/360, zero workers, 46.75% confirmation,
immutable `9894988` evidence and no browser errors/overflow. Publication of this later
handoff uses the same required Validation-before-Pages workflow; its GitHub Actions
results are authoritative. Local migration regression, documentation and static-asset
checks accompany this handoff. No new strength experiments were run for migration.

Once the user authorizes research, the suggested next question is action ranking:
does the network distinguish sibling moves usefully under actual search, rather
than merely reduce global prediction loss? Analyze training-only positions first;
stronger search is a noisy comparison, not ground truth. Pairwise ranking or policy
distillation is a possible follow-up, requiring a new frozen protocol and fresh
parent comparison. No such diagnostic or experiment has been implemented or launched.

OpenSpiel is another **unstarted feasibility option**, requested during closeout.
Its [AlphaZero components](https://github.com/google-deepmind/open_spiel/blob/master/docs/alpha_zero.md)
offer learned policy/value search and self-play, but the official
[game list](https://openspiel.readthedocs.io/en/stable/games.html) has no Wingspan entry
as checked October 19. Its standard
[MCTS implementation](https://github.com/google-deepmind/open_spiel/blob/master/open_spiel/python/algorithms/mcts.py)
does not handle imperfect information specially. A suitable adapter or port would
need action/chance encodings and verified actor observation/belief boundaries.
The [algorithm catalog](https://openspiel.readthedocs.io/en/latest/algorithms.html)
includes information-set MCTS, marked lightly tested. Do not assume generic MCTS on
true state is a valid tabletop opponent. A bounded rules-parity/throughput/equal-time
comparison could establish whether adoption is useful; it is not yet authorized or
implemented. Keep the JavaScript rules engine, browser product and generation-3
teacher as controls. OpenSpiel's LibTorch AlphaZero
[README](https://github.com/google-deepmind/open_spiel/blob/master/open_spiel/algorithms/alpha_zero_torch/README.md)
also notes build issues and limited maintenance, so installation is not itself a
proven shortcut to a production training pipeline.

No pending experiment, promotion or automatic continuation is transferred. The new
chat must establish context and wait for a new instruction before any action.
