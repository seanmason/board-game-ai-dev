# Azul — current overview

Reference reviewed: 2026-10-17, main implementation `560606e`. Documentation
review only; the linked reports retain their own tested revisions and conditions.

## Scope and capabilities

Original colored-wall base game, 2–4 players; gray wall excluded.

Physical factory/refill entry, explicit drafting, digital play, continuous analysis, undo/redo and session recovery. Analysis is advisory; real observations govern physical play. Digital hidden
state must not leak into advice. All remain development capabilities, not release approval.

## Implementation and verification commands

- [Open the companion](../../../azul.html). The suite home lists all games; standalone Azul packages use `index.html`.
- [Rules/state](../../../src/azul.js); [Search/ranking](../../../src/mcts.js); [Worker adapter](../../../src/ai-worker.js); [Interface](../../../src/app.js).
- [Rules tests](../../../test/azul.test.js); [In-project reference implementation](../../../validation/reference-azul.js); [Browser checks](../../../scripts/browser-smoke.mjs).

Run `npm run verify:gameplay` for the game verifier; `npm test` and `npm run check`
for repository regressions. The [game report](../../VALIDATION.md) supplies audit,
benchmark and browser prerequisites/commands. [CI](../../../.github/workflows/ci.yml)
is the command inventory, not proof a new revision passed. Packaging:
`npm run package:game -- azul <new-output-directory>`.

## Current AI and findings

Guided MCTS with heuristic-ranked progressive widening and informed rollouts; UCT comparator. Current-round tree and sampled future refills. Conditional subtree reuse is supported; newly observed chance events and incompatible edits reset it. Outcome estimates are policy-dependent, not calibrated probabilities.

Held-out synthetic-opponent comparisons support the guided default in the tested settings; they do not establish human strength. See [evaluation evidence](../../SEARCH_RESEARCH.md).

## Evidence and remaining gates

| Dimension | Evidence and boundary |
| --- | --- |
| Rules/data | Rules/reference transition checks and browser evidence are recorded in the validation report; the oracle is independently written within this repository. [Report](../../VALIDATION.md). |
| Physical workflow | Implemented controls and regression coverage described in the report; real-table user acceptance remains open. |
| AI | [Study](../../SEARCH_RESEARCH.md); findings above are scoped to its opponents/budgets, not human Elo. |
| Browser/device | [Browser script](../../../scripts/browser-smoke.mjs) and the linked game report distinguish available checks from recorded runs; script existence is not a passing run. Real-device iPad Safari remains unverified here. |
| Release | Standalone packaging is available; [release review](../../platform/release.md) is still required. |

## Next priorities

Real-table transcripts, iPad Safari acceptance, arbitrary late-game editing and release/license review remain open.

[Game directory](../INDEX.md) · [Documentation routing](../../INDEX.md)
