# Wingspan — current experimental overview

Integrated on 2026-10-17 from `feat/wingspan-integration` (`3b0e0d0`),
including the newer physical-observation work beyond the original draft PR.
User authorized integration into main; this is not finished-release approval.

## Current browser AI

Reviewed October19,2026: the best production-validated AI remains the combined
opening strategy: opening-plan evaluation, expanded actual setup choices and
horizon4. The browser and worker share `wingspan/production-ai.js`; analysis
continues sampling while active. Explicit benchmark settings remain explicit.
The original adoption won117–83 in fresh confirmation. The completed2,800-game
study and480-game follow-up supplied no stronger replacement. Sample scaling
was confirmed within the corrected research reference, which does not establish
a new deployed budget. See the [selection and evidence](2026-10-19-selection.md).

The next proposed direction is a [small neural value pilot](../../plans/wingspan-neural-pilot-2026-10-19.md),
with a linear baseline, observation-safe training data and fresh equal-time play.
No model training has started.

## Scope and capabilities

Original 170 birds (excluding ten Swift-Start birds), 26 bonuses, 16 goal faces;
competitive 2–5 players, no expansions or solo Automa. The implementation includes physical
observation prompts, unknown private slots, pending-action save/cancel/recovery,
detailed human move entry and sampled hidden-world rollout analysis. It remains experimental and is not release-approved.

Read the retained integration reports (historical sections may describe earlier blockers):

- [Physical observation flow](../../WINGSPAN_PHYSICAL_OBSERVATIONS.md): actual public cards/dice, unknown private cards and advice gating. Earlier claims that these controls are wholly absent are superseded in the integrated implementation.
- [Gameplay/AI review](../../WINGSPAN_GAMEPLAY_AND_AI_REVIEW.md): chained pink/white fixes, detailed second-bird payments, timed evaluation and remaining gates.
- [Card audit](../../WINGSPAN_CARD_AUDIT.md): per-card fixtures and provenance, not exhaustive interaction certification.

## Implementation map and evidence limits

Inspect `wingspan/core.js`, `powers.js`, `actions.js`,
`observations.js`, `observation-io.js`, `physical-ui.js`, `move-editor.js`,
`belief.js`, `rollout.js`, `worker.js` and `data/`. Run `npm run verify:wingspan` and the Wingspan tests via `npm test`.
The staged preview includes both observation modules. Wingspan remains excluded
from standalone release packaging pending its separate release review.

Rules/catalog: representative per-card activations and pinned catalog comparisons
exist; unusual multi-card interactions still need independent complete-game traces.
Physical workflow: implemented/browser-tested per report; real-table
acceptance remains open. AI: representative quick-action generator and sampled
utility, not exhaustive legal search or calibrated wins. The recorded 19/24 timed
result is against an internal baseline, not independent human-strength evidence.
The completed [bounded 30/100-iteration screen](2026-10-17-budget-screen.md)
records 32 valid internal games: 9/12 and 11/12 wins against the heuristic,
and 5/8 for 100 against 30. Budget superiority remains inconclusive with these
small paired samples and strong seat effects; no default policy was changed.
The subsequent [30/100/300/1,000 scaling study](../../../benchmarks/wingspan/2026-10-17-scaling/REPORT.md)
completed 168 games with balanced starting seats and no failures. Direct results
were 15–9 for 100 vs 30, 11–1–12 for 300 vs 100, and 12–12 for 1,000 vs 300.
All direct paired-margin intervals include zero; higher default budgets are not
justified by this screen. Production defaults remain unchanged.
A user-requested [20-game 10,000-vs-300 follow-up](../../work/wingspan-high-budget.md)
was halted by the user after 19 games (8 wins, 11 losses for 10,000; one unfinished).
The completed [paired depth study](../../../benchmarks/wingspan/2026-10-17-depth/REPORT.md)
compared depths 4, 8, 12 and 16 at 100 samples in 72 games, with no failures.
Depth 12 had the best observed record (21/36), but all direct paired-margin
intervals include zero. Depth 16 did not show a clear benefit. Defaults unchanged.
The follow-up [depth/budget matrix](../../work/wingspan-depth-budget.md) tests
500, 1,000 and 3,000 samples at depths 12, 16 and 20 was halted by the user with
119 games preserved. The completed [leaf evaluator screen](../../../benchmarks/wingspan/2026-10-18-evaluators/REPORT.md)
tested eight alternatives at depth 4 and 100 samples in 320 games. None showed
clear superiority. Practical-combined went 20–20 with +2.35 mean margin; points-only
went 11–1–28. This exploratory screen was followed by independent confirmation.
The completed [fresh-seed confirmation](../../../benchmarks/wingspan/2026-10-18-confirmation/REPORT.md)
found combined beat current 28–12 at 100 samples and 24–16 at 300; combined 300
beat combined 100 by 27–13. All 160 games passed, depth fixed at 4. This is a
promising improvement with seed/opponent uncertainty; practical-combined was subsequently promoted to the browser.
Browser/device: automated browser coverage does not establish real iPad Safari
performance. Release: final rights/provenance and release review remain open.

## Integration verification

See the [integration record](../../work/wingspan-documentation-integration.md) for
commands, tested revision/tree and results. Earlier study results are retained,
not rerun strength claims.

## Next priorities

Retain detailed human choices and authoritative observation flow. Resolve independent
interaction/transcript coverage and practical device acceptance before a complete
base-game/release claim. Do not restart the already implemented observation work.

[Game directory](../INDEX.md)

The [refinement screen](../../../benchmarks/wingspan/2026-10-18-refinements/REPORT.md) found no qualifying improvement in 120 games. The [specialist experiment](../../../benchmarks/wingspan/2026-10-18-specialists/REPORT.md) also found no qualifying improvement in 120 games. The [diverse study](../../../benchmarks/wingspan/2026-10-18-diverse/REPORT.md) completed 656 games: row-unlocks won its screen but did not beat practical-combined in fresh confirmation (18-1-21). The completed expansion (1,512 games) and realizable-value (1,392 games) studies did not establish a stronger replacement. See the [all-study synthesis and final selection protocol](../../../benchmarks/wingspan/2026-10-18-final-selection/REPORT.md). The final 640-game screen found no qualifying replacement; practical-combined remained the reference. The [opening experiment](../../../benchmarks/wingspan/2026-10-18-opening/REPORT.md) completed 640 games and fresh confirmation; the combined setup expansion and opening evaluator won 117–83 and was adopted as the browser default. Evaluator-only confirmation did not pass the confidence gate.


The completed [two-player evaluator/compute study](../../work/wingspan-evaluator-compute-2026-10-18.md)
and [unattended follow-up](../../work/wingspan-overnight-2026-10-18.md) preserve their
frozen protocols, source archives and raw favorable/unfavorable evidence. Final
results and the current production decision are in the
[October19 selection](2026-10-19-selection.md).
