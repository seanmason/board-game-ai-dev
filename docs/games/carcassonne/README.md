# Carcassonne — current overview

Reference reviewed: 2026-10-17, main implementation `560606e`. Documentation
review only; the linked reports retain their own tested revisions and conditions.

## Scope and capabilities

72 core tiles including start, farmers, 2–5 players; no River or Abbot.

Actual tile draws, rotation/placement and feature/meeple choice; pan/zoom, explicit recording, scoring explanations and recovery. Analysis is advisory; real observations govern physical play. Digital hidden
state must not leak into advice. All remain development capabilities, not release approval.

## Implementation and verification commands

- [Rules/state](../../../carcassonne/core.js); [Search/ranking](../../../carcassonne/ai.js); [Worker adapter](../../../carcassonne/worker.js); [Interface](../../../carcassonne/app.js).
- [Rules tests](../../../test/carcassonne.test.js); [In-project reference implementation](../../../test/carcassonne-reference.js); [Browser checks](../../../scripts/browser-carcassonne.mjs).
- [Component catalog](../../../carcassonne/catalog.js)
- [Cross-game independent audit and source limitations](../../FIVE_GAME_AUDIT.md).

Run `npm run verify:carcassonne` for the game verifier; `npm test` and `npm run check`
for repository regressions. The [game report](../../CARCASSONNE.md) supplies audit,
benchmark and browser prerequisites/commands. [CI](../../../.github/workflows/ci.yml)
is the command inventory, not proof a new revision passed. Packaging:
`npm run package:game -- carcassonne <new-output-directory>`.

## Current AI and findings

Progressively widened root UCB with field-aware ordering and sampled three-turn continuations. All legal combined placement/meeple alternatives remain eligible. Public remaining counts drive sampling; actual RNG state is excluded. Projected point utility is not win probability. Edits restart search.

Four-game pilots showed no advantage over tuned heuristic or shorter search. Synchronous iterations overshot nominal budgets; results do not establish matched-compute superiority or bounded pause latency. See [evaluation evidence](../../CARCASSONNE.md).

## Evidence and remaining gates

| Dimension | Evidence and boundary |
| --- | --- |
| Rules/data | Publisher inventory/topology transcription, catalog checks and separate graph/scoring oracle; the oracle shares factual catalog data and does not independently prove every topology. [Report](../../CARCASSONNE.md). |
| Physical workflow | Implemented controls and regression coverage described in the report; real-table user acceptance remains open. |
| AI | [Study](../../CARCASSONNE.md); findings above are scoped to its opponents/budgets, not human Elo. |
| Browser/device | [Browser script](../../../scripts/browser-carcassonne.mjs) and the linked game report distinguish available checks from recorded runs; script existence is not a passing run. Real-device iPad Safari remains unverified here. |
| Release | Standalone packaging is available; [release review](../../platform/release.md) is still required. |

## Next priorities

Practical latency and broader opponent evidence, real-table/iPad acceptance and release review.

[Game directory](../INDEX.md) · [Documentation routing](../../INDEX.md)
