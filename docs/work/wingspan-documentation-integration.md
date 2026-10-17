# Wingspan and documentation integration

Status: complete. Merged through PR #10 on 2026-10-17. Date: 2026-10-17.

## Objective

User requested agent-oriented documentation, then explicitly authorized merging
Wingspan into main. Integrate main `560606e` with Wingspan integration `3b0e0d0`,
preserving the nine other games and their CI checks. Finished release is out of scope.

## Changes

Documentation routing, game summaries, evidence conventions and templates;
corrected stale architecture/preview guidance. Resolved README, CI and Azul
navigation conflicts by retaining current documentation and all game checks,
adding Wingspan verification/navigation. Preview includes observation modules;
Wingspan remains excluded from standalone release packaging.

## Verification

Local verification on the combined working tree (commit containing this record):

- `npm test`: 566 passed, zero failed/skipped.
- `npm run check`: 151 JavaScript modules checked.
- `npm run check:docs`: 25 maintained files and nine standalone game entries.
- Deliberately missing Markdown target was rejected; probe removed and check rerun.
- `WINGSPAN_GAMES=20 npm run verify:wingspan`: 20 games, 2,960 actions,
  498 activated powers; nine power archetypes not encountered in this random run.
  Per-card fixtures are in the separate automated suite; neither is exhaustive
  full-game interaction certification.
- `npm run stage:preview`: 85 allowlisted assets, including observation modules.
- `git diff --check`: clean.

No local Chromium executable was available. Hosted [Validation run 39051070055](https://github.com/seanmason/board-game-ai-dev/actions/runs/39051070055)
passed on integration head `00b856ebc11f996f887e897d5cc2a390a1e9e724`
(tree `111e47282e9eb9b57e4aa560f0bbafd197ed6a9e`). This includes all staged
browser scripts, documentation checks, source audits, Wingspan scenarios and
Azul/Pentago/Boop reference regressions. Browser automation is not real-device
Safari or physical-table acceptance. No new strength tournament was performed.

## Closure

[PR #10](https://github.com/seanmason/board-game-ai-dev/pull/10) merged as
`17c32487fa504de84f9cffebc6fc93fa42766f11`. Its merge preserves Wingspan branch
ancestry and the existing games. This final documentation-only closure records
the passing run; it does not change runtime code. Remaining product/release gates
live in the [current Wingspan overview](../games/wingspan/README.md), not this
completed handoff. The finished-release repository was not modified.
