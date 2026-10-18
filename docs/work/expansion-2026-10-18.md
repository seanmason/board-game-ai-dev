# Stabilization and six-game implementation

Canonical development checkout: `local-run/pages-publish` relative to the old
workspace root. Starting revision `ca3f297` on `codex/next-games-plans` was pushed
to the development repository on 2026-10-18 before new implementation branches.
Use this checkout for integration; the workspace root is an old dirty checkout,
not the development source of truth. The finished-release repository is excluded.

## Preservation

The old root remains intact on `handoff/windows-ai-benchmarks-20261017`.
Its Kingdomino configuration contains an additional Windows execution record,
and its results are absent from the current development tree. A byte-preserving
copy of that entire benchmark directory is retained under
`benchmarks/preserved-root-2026-10-18/kingdomino-budget.zip`, with SHA-256 inventory
alongside it. This is preserved evidence, not a new validated benchmark or a
promotion recommendation. Do not run its historical test/runner as current code.

The old Carcassonne replay test has identical content after newline normalization.
The current evaluator contains the old replay fix plus subsequent improvements;
copying the old version over it would regress those improvements. Old `local-run`
and `transfer` directories remain in place; no cleanup deletes them.

## Acceptance

Stabilization precedes new-game integration. Full Validation and all browser
scripts must pass. Pages calls that full workflow and packages only after success.
Automated touch/tablet viewport checks are distinct from a real iPad Safari
acceptance test, which remains open until the user performs it on the public preview.

Implementation follows the [six-game package](../plans/next-games-2026-10-18/README.md)
and its source/adjudication gates. Independent agents use isolated game branches;
the coordinator owns suite integration, asset packaging and CI. No strength
tournaments are required for stabilization or documentation cleanup.
