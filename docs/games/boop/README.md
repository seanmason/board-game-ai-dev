# Boop — current overview

Reference reviewed: 2026-10-17, main implementation `560606e`. Documentation
review only; the linked reports retain their own tested revisions and conditions.

## Scope and capabilities

Original base game, 2 players; no holiday expansions or younger-player variant.

Complete placement plus graduation/retrieval confirmation; hypothetical variation isolation, heatmaps, continuous analysis, additional iterations, undo/redo and recovery. Analysis is advisory; real observations govern physical play. Digital hidden
state must not leak into advice. All remain development capabilities, not release approval.

## Implementation and verification commands

- [Rules/state](../../../boop/core.js); [Search/ranking](../../../boop/ai.js); [Worker adapter](../../../boop/worker.js); [Interface](../../../boop/app.js).
- [Rules tests](../../../test/boop.test.js); [In-project reference implementation](../../../validation/boop-reference.js); [Browser checks](../../../scripts/browser-boop.mjs).
- [Long-budget records](../../../benchmarks/boop-long/REPORT.md) and [targeted repetition verifier](../../../scripts/verify-boop-repetition.mjs).

Run `npm run verify:boop` for the game verifier; `npm test` and `npm run check`
for repository regressions. The [game report](../../BOOP_RESEARCH.md) supplies audit,
benchmark and browser prerequisites/commands. [CI](../../../.github/workflows/ci.yml)
is the command inventory, not proof a new revision passed. Packaging:
`npm run package:game -- boop <new-output-directory>`.

## Current AI and findings

Tactically guided UCT with progressive widening, bounded heuristic rollouts and history-aware root repetition preference within tactical tiers. Conditional subtree reuse is supported. Repetition is legal: no official draw rule was added. Utility, terminal revisits and actual rollout wins are distinct.

3,000 iterations won 24/24 against the specified tactical opponent/openings. A 10,000-iteration run looped; the retained failure led to a history-aware preference. A five-move continuation fixed that fixture, not a new broad strength result. See [evaluation evidence](../../BOOP_RESEARCH.md).

## Evidence and remaining gates

| Dimension | Evidence and boundary |
| --- | --- |
| Rules/data | Independent two-dimensional oracle and targeted rules/import/search tests; later repetition regression is explicitly narrower than a tournament. [Report](../../BOOP_RESEARCH.md). |
| Physical workflow | Implemented controls and regression coverage described in the report; real-table user acceptance remains open. |
| AI | [Study](../../BOOP_RESEARCH.md); findings above are scoped to its opponents/budgets, not human Elo. |
| Browser/device | [Browser script](../../../scripts/browser-boop.mjs) and the linked game report distinguish available checks from recorded runs; script existence is not a passing run. Real-device iPad Safari remains unverified here. |
| Release | Standalone packaging is available; [release review](../../platform/release.md) is still required. |

## Next priorities

Real-table and iPad Safari acceptance and release review remain open. Broaden strategic evaluation only if needed for practical adequacy; do not repeat the already completed repetition fix.

[Game directory](../INDEX.md) · [Documentation routing](../../INDEX.md)
