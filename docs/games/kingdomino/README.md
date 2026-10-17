# Kingdomino — current overview

Reference reviewed: 2026-10-17, main implementation `560606e`. Documentation
review only; the linked reports retain their own tested revisions and conditions.

## Scope and capabilities

Original 2016 default or explicit US second edition, 5×5, 2–4 players; edition affects 3-player draws and ties.

Actual domino rows, claims and kingdom placement, edition-preserving sessions, manual recording and recovery. Analysis is advisory; real observations govern physical play. Digital hidden
state must not leak into advice. All remain development capabilities, not release approval.

## Implementation and verification commands

- [Rules/state](../../../kingdomino/core.js); [Search/ranking](../../../kingdomino/ai.js); [Worker adapter](../../../kingdomino/worker.js); [Interface](../../../kingdomino/app.js).
- [Rules tests](../../../test/kingdomino.test.js); [In-project reference implementation](../../../test/kingdomino-reference.js); [Browser checks](../../../scripts/browser-kingdomino.mjs).
- [Component catalog](../../../kingdomino/catalog.js)
- [Cross-game independent audit and source limitations](../../FIVE_GAME_AUDIT.md).

Run `npm run verify:kingdomino` for the game verifier; `npm test` and `npm run check`
for repository regressions. The [game report](../../KINGDOMINO.md) supplies audit,
benchmark and browser prerequisites/commands. [CI](../../../.github/workflows/ci.yml)
is the command inventory, not proof a new revision passed. Packaging:
`npm run package:game -- kingdomino <new-output-directory>`.

## Current AI and findings

UCB/progressive widening with sampled hidden worlds and finite-horizon tuned continuations; all immediate legal choices remain eligible. Exact final-row continuation search stops once solved. Reported utility is heuristic score margin; exact endgame results do not imply whole-game solved play.

Four-game paired pilots gave 2/4 versus shallower search and 1/4 versus heuristic, with negative mean margins. No deeper-search improvement is established. See [evaluation evidence](../../KINGDOMINO.md).

## Evidence and remaining gates

| Dimension | Evidence and boundary |
| --- | --- |
| Rules/data | Numbered catalog and independent scoring/transition evidence. Component faces have photographic corroboration; complete independent face-to-reverse-number verification remains open. [Report](../../KINGDOMINO.md). |
| Physical workflow | Implemented controls and regression coverage described in the report; real-table user acceptance remains open. |
| AI | [Study](../../KINGDOMINO.md); findings above are scoped to its opponents/budgets, not human Elo. |
| Browser/device | [Browser script](../../../scripts/browser-kingdomino.mjs) and the linked game report distinguish available checks from recorded runs; script existence is not a passing run. Real-device iPad Safari remains unverified here. |
| Release | Standalone packaging is available; [release review](../../platform/release.md) is still required. |

## Next priorities

Numbered physical-set audit, real-table/iPad acceptance, practical-budget evidence and release review.

[Game directory](../INDEX.md) · [Documentation routing](../../INDEX.md)
