# Pentago — current overview

Reference reviewed: 2026-10-17, main implementation `560606e`. Documentation
review only; the linked reports retain their own tested revisions and conditions.

## Scope and capabilities

Original 6×6 rotating-board game, 2 players; printed neutral-quadrant skip and placement-win rules.

Physical placement/twist recording, digital manual turns, continuous analysis, placement heatmaps, undo/redo and recovery. Analysis is advisory; real observations govern physical play. Digital hidden
state must not leak into advice. All remain development capabilities, not release approval.

## Implementation and verification commands

- [Rules/state](../../../pentago/core.js); [Search/ranking](../../../pentago/ai.js); [Worker adapter](../../../pentago/worker.js); [Interface](../../../pentago/app.js).
- [Rules tests](../../../test/pentago.test.js); [In-project reference implementation](../../../validation/pentago-reference.js); [Browser checks](../../../scripts/browser-pentago.mjs).

Run `npm run verify:pentago` for the game verifier; `npm test` and `npm run check`
for repository regressions. The [game report](../../PENTAGO_VALIDATION.md) supplies audit,
benchmark and browser prerequisites/commands. [CI](../../../.github/workflows/ci.yml)
is the command inventory, not proof a new revision passed. Packaging:
`npm run package:game -- pentago <new-output-directory>`.

## Current AI and findings

The default recommendation is the stable tactical heuristic; MCTS remains available for analysis. Do not confuse the selected recommendation policy with the most-visited MCTS action or claim that additional short-budget search is stronger.

Short-budget MCTS performed poorly against the stronger greedy comparator; heuristic-only self-comparison does not demonstrate independent strength. See [evaluation evidence](../../PENTAGO_VALIDATION.md).

## Evidence and remaining gates

| Dimension | Evidence and boundary |
| --- | --- |
| Rules/data | Separate reference-engine comparisons and tactical/rules fixtures are documented. [Report](../../PENTAGO_VALIDATION.md). |
| Physical workflow | Implemented controls and regression coverage described in the report; real-table user acceptance remains open. |
| AI | [Study](../../PENTAGO_VALIDATION.md); findings above are scoped to its opponents/budgets, not human Elo. |
| Browser/device | [Browser script](../../../scripts/browser-pentago.mjs) and the linked game report distinguish available checks from recorded runs; script existence is not a passing run. Real-device iPad Safari remains unverified here. |
| Release | Standalone packaging is available; [release review](../../platform/release.md) is still required. |

## Next priorities

Independent strategic opponents, practical-budget evidence, real-table/device acceptance and release review remain priorities.

[Game directory](../INDEX.md) · [Documentation routing](../../INDEX.md)
