# Physical observation flow

Physical sessions record the actual table. Enter the face-up tray, five starting
feeder dice, and four round goals before setup. Starting private cards can be
identified through the observation controls or kept as unidentified slots.

When recording an action requires a draw, replacement, or roll, the UI requests
that result. Private draws may remain unknown. Public cards and dice must be
entered. After a feeder reroll, select the actual die taken. The action remains
pending until all required results are entered; cancel restores the pre-action
position. Pending input is preserved by save/reload and undo/redo.

The engine retains unique internal card allocations for conservation only.
Unidentified cards are redacted from the table and analysis observation. They
must be identified before being played. Advice pauses while public facts or the
active player's private cards are missing; manual tracking can continue with
unknown private cards. Hidden opponent identities are sampled for analysis.

Corrections are available between actions. To record an opponent playing an
unknown bird, identify its hand slot first, then record the play. Older physical
session exports without explicit knowledge metadata must be restarted; digital
sessions retain their existing behavior.

This change addresses incremental tabletop input, not overall release readiness.
Wingspan still needs its independent rules/transcript audit, broader chained
power interaction coverage, and AI strength qualification. Keep it in development.
When integrating the separate shared-platform refactor, include observation-io.js
and physical-ui.js in its optional Wingspan static package manifest.
