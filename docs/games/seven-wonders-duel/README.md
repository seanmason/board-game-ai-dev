# 7 Wonders Duel — current overview

Reference reviewed: 2026-10-17, main implementation `560606e`. Documentation
review only; the linked reports retain their own tested revisions and conditions.

## Scope and capabilities

Base game, 2 players; no expansions or promos.

Actual wonder/progress setup and draft, face-up observations, newly uncovered reveals, effect choices, manual recording and session recovery. Analysis is advisory; real observations govern physical play. Digital hidden
state must not leak into advice. All remain development capabilities, not release approval.

## Implementation and verification commands

- [Rules/state](../../../seven-wonders-duel/core.js); [Search/ranking](../../../seven-wonders-duel/ai.js); [Worker adapter](../../../seven-wonders-duel/worker.js); [Interface](../../../seven-wonders-duel/app.js).
- [Rules tests](../../../test/seven-wonders-duel.test.js); [In-project reference implementation](../../../test/seven-wonders-duel-reference.js); [Browser checks](../../../scripts/browser-seven-wonders-duel.mjs).
- [Component catalog](../../../seven-wonders-duel/catalog.js)
- [Cross-game independent audit and source limitations](../../FIVE_GAME_AUDIT.md).

Run `npm run verify:seven-wonders-duel` for the game verifier; `npm test` and `npm run check`
for repository regressions. The [game report](../../SEVEN_WONDERS_DUEL.md) supplies audit,
benchmark and browser prerequisites/commands. [CI](../../../.github/workflows/ci.yml)
is the command inventory, not proof a new revision passed. Packaging:
`npm run package:game -- seven-wonders-duel <new-output-directory>`.

## Current AI and findings

Root UCB over sampled hidden worlds with adversarial alpha-beta continuations; default two drafting plies and seven internal branches, with broader leaf/effect choices. Root immediate wins are checked before pruning. Search resets on observed changes. Utilities/sample errors are not calibrated probabilities.

4/4 versus a tuned heuristic and 2/2 versus shallower search are tiny pilots, not robust strength evidence; paired setups and compute differences limit interpretation. See [evaluation evidence](../../SEVEN_WONDERS_DUEL.md).

## Evidence and remaining gates

| Dimension | Evidence and boundary |
| --- | --- |
| Rules/data | Catalog/provenance and independent payment/transition oracle evidence; community sources may share ancestry and some wonder costs rely on those references. [Report](../../SEVEN_WONDERS_DUEL.md). |
| Physical workflow | Implemented controls and regression coverage described in the report; real-table user acceptance remains open. |
| AI | [Study](../../SEVEN_WONDERS_DUEL.md); findings above are scoped to its opponents/budgets, not human Elo. |
| Browser/device | [Browser script](../../../scripts/browser-seven-wonders-duel.mjs) and the linked game report distinguish available checks from recorded runs; script existence is not a passing run. Real-device iPad Safari remains unverified here. |
| Release | Standalone packaging is available; [release review](../../platform/release.md) is still required. |

## Next priorities

Held-out practical-budget evidence if needed, physical-table/iPad acceptance and release review.

[Game directory](../INDEX.md) · [Documentation routing](../../INDEX.md)
