# Wingspan — current experimental overview

Integrated on 2026-10-17 from `feat/wingspan-integration` (`3b0e0d0`),
including the newer physical-observation work beyond the original draft PR.
User authorized integration into main; this is not finished-release approval.

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
