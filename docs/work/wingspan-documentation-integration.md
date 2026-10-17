# Wingspan and documentation integration

Status: implementation complete; hosted integration gate pending. Date: 2026-10-17.

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

No local Chromium executable was available. The integration PR's hosted Validation
workflow is the browser/packaging merge gate; inspect its exact head revision and
conclusion before merging. No new tournament or human-strength claim is made.

## Resume / closure

Merge only after the hosted combined suite passes; retain the known limitations
in the current Wingspan overview. The user explicitly authorized the Wingspan
merge into main. Once merged, this record preserves integration evidence rather
than a continuing implementation backlog.
