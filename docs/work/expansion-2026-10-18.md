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
The extracted local copy is outside the canonical checkout at workspace-relative
`local-run/preserved-root-2026-10-18-extracted`; all nine hashes were rechecked
after relocation so Node test discovery cannot mistake it for current tests.

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

## Stabilization verification

Full [Validation run 39147861993](https://github.com/seanmason/board-game-ai-dev/actions/runs/39147861993)
passed at `bbe379e`: unit tests, syntax/docs, independent rules comparisons,
bounded CI smoke benchmarks, packaging, and all eleven browser scripts. The
preceding aggregate run exposed the additional Carcassonne stale assertion:
Pause is hidden when its 30-sample budget completes, with Think longer available.
The corrected test also verifies pause/resume without depending on driver latency.

Local `node --test --test-concurrency=8`: 706 passed, zero failures.
`node scripts/check-syntax.mjs`: 211 modules passed. Documentation check: 48
files and nine packaged game entries. No new strength study was performed.

On 2026-10-18 the extended Wingspan browser script passed against the public
Pages preview using installed Chrome (`PLAYWRIGHT_CHANNEL=chrome`,
`BASE_URL=https://seanmason.github.io/board-game-ai-dev/`). It checked actual
worker messages for depth 4 and opening-plan, invalid setup, physical observation
blocking, recovery, and touch actions. The optional favicon 404 is excluded by
its exact resource URL; other console errors remain failures. Desktop, tablet,
phone and physical-phone screenshots are saved under `test-artifacts/wingspan-*`;
CI now uploads the same evidence. Tablet screenshot review showed 24 opening
candidates and no horizontal overflow. This is automated Chrome touch emulation,
not a real iPad Safari or complete real-table acceptance test.

## First integrations

Stabilization deployed successfully at `664d239` through [gated Pages run
39148524389](https://github.com/seanmason/board-game-ai-dev/actions/runs/39148524389).
Love Letter and Sushi Go are now integrated into static/standalone packaging,
navigation and comprehensive CI. Local acceptance passed 22 Love Letter and
18 Sushi Go tests plus packaging regressions. Both installed-Chrome browser
suites passed, with screenshots reviewed at phone size. Love Letter review fixed
private card leakage through action choices and both games received private-panel
contrast fixes. Real iPad Safari and physical-table acceptance remain open.

After both integrations, local full regression passed 746 tests with no failures;
syntax checked 237 modules and documentation checked 50 files/11 game entries.

Love Letter and Sushi Go deployed at `375db17` through successful [Pages run
39151203269](https://github.com/seanmason/board-game-ai-dev/actions/runs/39151203269),
including full validation. Jaipur physical recording is integrated and locally
validated; exact digital token generation remains source-gated in its overview.
Lost Cities, Hive and Ticket to Ride continue in isolated worktrees.

Lost Cities is integrated with 21 passing game tests, three packaging tests and
staged-browser acceptance, including private views, correction preview, explicit
round starter agreement and match completion. Practical ranking is the default;
the small sampled-policy smoke was unfavorable, so sampling remains opt-in.
