# Splendor — current overview

Reference reviewed: 2026-10-17, main implementation `560606e`. Documentation
review only; the linked reports retain their own tested revisions and conditions.

## Scope and capabilities

Base game, 2–4 players; no expansions.

Actual market/noble setup, observed replacements, unknown private reservations, explicit human phases, continuous analysis and atomic history recovery. Advice pauses if the active player has unidentified reservations. Analysis is advisory; real observations govern physical play. Digital hidden
state must not leak into advice. All remain development capabilities, not release approval.

## Implementation and verification commands

- [Rules/state](../../../splendor/core.js); [Search/ranking](../../../splendor/ai.js); [Worker adapter](../../../splendor/worker.js); [Interface](../../../splendor/app.js).
- [Rules tests](../../../test/splendor.test.js); [In-project reference implementation](../../../test/splendor-reference.js); [Browser checks](../../../scripts/browser-splendor.mjs).
- [Component catalog](../../../splendor/catalog.js)

Run `npm run verify:splendor` for the game verifier; `npm test` and `npm run check`
for repository regressions. The [game report](../../SPLENDOR.md) supplies audit,
benchmark and browser prerequisites/commands. [CI](../../../.github/workflows/ci.yml)
is the command inventory, not proof a new revision passed. Packaging:
`npm run package:game -- splendor <new-output-directory>`.

## Current AI and findings

Root UCB allocation over sampled hidden worlds, 12-turn stochastic heuristic rollouts and mean-utility recommendation. All immediate legal actions are candidates. Actual hidden deck/opponent reservations are redacted. Search resets after edits; utility and sample error are not win probability or confidence in move superiority.

Keep the 12-turn mean-utility policy. Matched-time alternatives did not justify promotion; extra compute improved coverage and the tested three-player result, while two-/four-player strength evidence remained uncertain. See [evaluation evidence](../../SPLENDOR_AI_EVALUATION.md).

## Evidence and remaining gates

| Dimension | Evidence and boundary |
| --- | --- |
| Rules/data | 90 cards cross-checked against three pinned datasets; ten nobles checked against a complete source. Datasets may share ancestry. Independent transition oracle shares catalog facts. [Report](../../SPLENDOR.md). |
| Physical workflow | Implemented controls and regression coverage described in the report; real-table user acceptance remains open. |
| AI | [Study](../../SPLENDOR_AI_EVALUATION.md); findings above are scoped to its opponents/budgets, not human Elo. |
| Browser/device | [Browser script](../../../scripts/browser-splendor.mjs) and the linked game report distinguish available checks from recorded runs; script existence is not a passing run. Real-device iPad Safari remains unverified here. |
| Release | Standalone packaging is available; [release review](../../platform/release.md) is still required. |

## Next priorities

Real-table/iPad acceptance, independently authored opponents where further strength evidence is needed, and release review. Do not treat the earlier nonsearch pilots as the strongest available evidence.

[Game directory](../INDEX.md) · [Documentation routing](../../INDEX.md)
