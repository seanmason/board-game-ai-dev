# Patchwork — current overview

Reference reviewed: 2026-10-17, main implementation `560606e`. Documentation
review only; the linked reports retain their own tested revisions and conditions.

## Scope and capabilities

Original 33 patches, 2 players; explicit original/corrected first-leather time tracks.

Observed patch ring/setup, legal placements/reflections, leather choices, explicit recording, continuous search and recovery. Analysis is advisory; real observations govern physical play. Digital hidden
state must not leak into advice. All remain development capabilities, not release approval.

## Implementation and verification commands

- [Rules/state](../../../patchwork/core.js); [Search/ranking](../../../patchwork/ai.js); [Worker adapter](../../../patchwork/worker.js); [Interface](../../../patchwork/app.js).
- [Rules tests](../../../test/patchwork.test.js); [In-project reference implementation](../../../test/patchwork-reference.js); [Browser checks](../../../scripts/browser-patchwork.mjs).
- [Component catalog](../../../patchwork/catalog.js)
- [Cross-game independent audit and source limitations](../../FIVE_GAME_AUDIT.md).

Run `npm run verify:patchwork` for the game verifier; `npm test` and `npm run check`
for repository regressions. The [game report](../../PATCHWORK.md) supplies audit,
benchmark and browser prerequisites/commands. [CI](../../../.github/workflows/ci.yml)
is the command inventory, not proof a new revision passed. Packaging:
`npm run package:game -- patchwork <new-output-directory>`.

## Current AI and findings

Incremental alpha-beta, iterative deepening and placement beams; respects consecutive turns and leather phases. Reports only completed common-depth values. Widens a terminally searched beam; normal budgets exclude legal placements. Values are heuristic score differences, not win probabilities. Edits reset search.

Corrected-catalog 1–1 smoke and 3/4 against width-1 search are too small to establish strength. Opponents share evaluator/placement machinery; larger nominal node counts are not full-game playouts. See [evaluation evidence](../../PATCHWORK.md).

## Evidence and remaining gates

| Dimension | Evidence and boundary |
| --- | --- |
| Rules/data | Publisher/photograph audit corrected a square patch and catalog area; targeted fixtures and separate reference checks. [Report](../../PATCHWORK.md). |
| Physical workflow | Implemented controls and regression coverage described in the report; real-table user acceptance remains open. |
| AI | [Study](../../PATCHWORK.md); findings above are scoped to its opponents/budgets, not human Elo. |
| Browser/device | [Browser script](../../../scripts/browser-patchwork.mjs) and the linked game report distinguish available checks from recorded runs; script existence is not a passing run. Real-device iPad Safari remains unverified here. |
| Release | Standalone packaging is available; [release review](../../platform/release.md) is still required. |

## Next priorities

Practical-budget adequacy, real-table/iPad acceptance and release review. Preserve corrected catalog fixtures when changing packing/search.

[Game directory](../INDEX.md) · [Documentation routing](../../INDEX.md)
