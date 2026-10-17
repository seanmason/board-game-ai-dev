# Cascadia — current overview

Reference reviewed: 2026-10-17, main implementation `560606e`. Documentation
review only; the linked reports retain their own tested revisions and conditions.

## Scope and capabilities

Standard base game, 1–4 players, all A–D wildlife cards; see report for solo details.

Actual starter/offer observation and replacements, nature actions, tile/wildlife placement, pinned selection with explicit record, undo/redo and recovery. Analysis is advisory; real observations govern physical play. Digital hidden
state must not leak into advice. All remain development capabilities, not release approval.

## Implementation and verification commands

- [Rules/state](../../../cascadia/core.js); [Search/ranking](../../../cascadia/ai.js); [Worker adapter](../../../cascadia/worker.js); [Interface](../../../cascadia/app.js).
- [Rules tests](../../../test/cascadia.test.js); [In-project reference implementation](../../../test/cascadia-reference.js); [Browser checks](../../../scripts/browser-cascadia.mjs).
- [Component catalog](../../../cascadia/catalog.js)
- [Wildlife and habitat scoring](../../../cascadia/scoring.js)
- [Cross-game independent audit and source limitations](../../FIVE_GAME_AUDIT.md).

Run `npm run verify:cascadia` for the game verifier; `npm test` and `npm run check`
for repository regressions. The [game report](../../CASCADIA.md) supplies audit,
benchmark and browser prerequisites/commands. [CI](../../../.github/workflows/ci.yml)
is the command inventory, not proof a new revision passed. Packaging:
`npm run package:game -- cascadia <new-output-directory>`.

## Current AI and findings

Experimental root UCB over up to 24 screened actions, sampled continuations through the active player’s next turn; tuned heuristic comparator. Screening can exclude strong legal moves. Hidden tile order, omissions and RNG are not available to analysis. State changes reset samples.

Two four-game pilots each achieved 25% win share; they do not establish a deeper-search benefit. Sample error and heuristic utilities are not calibrated confidence or win forecasts. See [evaluation evidence](../../CASCADIA.md).

## Evidence and remaining gates

| Dimension | Evidence and boundary |
| --- | --- |
| Rules/data | Separate scorer and complete-game checks; starter geometry independently checked. Regular tiles have aggregate physical corroboration, not a complete independent 85-face audit. [Report](../../CASCADIA.md). |
| Physical workflow | Implemented controls and regression coverage described in the report; real-table user acceptance remains open. |
| AI | [Study](../../CASCADIA.md); findings above are scoped to its opponents/budgets, not human Elo. |
| Browser/device | [Browser script](../../../scripts/browser-cascadia.mjs) and the linked game report distinguish available checks from recorded runs; script existence is not a passing run. Real-device iPad Safari remains unverified here. |
| Release | Standalone packaging is available; [release review](../../platform/release.md) is still required. |

## Next priorities

Complete individual regular-tile audit, practical-budget evaluation if needed, real-table/iPad acceptance and release review.

[Game directory](../INDEX.md) · [Documentation routing](../../INDEX.md)
