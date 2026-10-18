# Hive validation evidence — 2026-10-18

Game-owner branch `codex/hive`, based on `375db17`. No shared integration or
release changes belong to this branch.

```text
node --test test/hive.test.js
node scripts/audit-hive.mjs
node scripts/verify-hive.mjs
node scripts/benchmark-hive.mjs
node scripts/check-syntax.mjs
node scripts/check-docs.mjs
BASE_URL=http://127.0.0.1:8080/ node scripts/browser-hive.mjs
```

The browser command requires an already running static server, the standard
Playwright package and its installed Chromium. `PLAYWRIGHT_CHANNEL` optionally
selects a locally installed browser. `STANDALONE_URL` adds a packaged-file smoke
check. It writes original app screenshots to ignored `test-artifacts/hive-*.png`.

## Executed engine/search evidence

An initial 18-test run passed: all opening types and six second placements,
Queen deadline, top-colour placement, exact after-lift articulation, closed/open
and zero-contact gates, Spider exact-three witnesses, long Ant perimeter,
Grasshopper all-six rays and first vacancies, Beetle support heights, covered
Queens and simultaneous surrounds, forced-pass deadline exception, malformed
snapshot imports, cycle non-adjudication, independent bounded random graph/slide
oracle and geometric symmetries. Depth-one immediate-win and depth-two mandatory
defense fixtures both passed without root pruning.

Independent reviewer then found and reported three import defects: inherited
object property names could substitute for a piece, a two-pass state could stay
in play, and a terminal simultaneous surround could be mislabeled resignation.
All three were corrected with dedicated regressions. A synthetic physical-mode
recording test also covers preview purity, a reasoned correction, complete-history
recovery, natural game end and undo from terminal. This is operator-entry code
evidence, not an independent real-copy physical playtest.

Final `node --test test/hive.test.js`: **22/22 passed**, approximately 2.35 s.
The default sandbox initially blocked Node's test subprocess; rerunning under
the already approved test command succeeded. The independent reviewer rechecked
all three reported import defects as rejected and a genuine simultaneous draw
as accepted. `node scripts/audit-hive.mjs` passed the component/opening audit
while explicitly retaining the diagram gate. `node scripts/check-docs.mjs`
passed 53 maintained files / 11 existing packaged-game entries. `git diff --check`
passed; the owner branch adds no shared registry entries.

`node scripts/benchmark-hive.mjs` ran serially with one worker-equivalent process,
seed 47891. Opening searches completed depth 3 at approximately 100.15 ms / 1069
nodes and depth 4 at approximately 500.09 ms / 5642 nodes; both retained complete
root rankings while the next depth was partial. Two tactical-baseline/random
smoke games completed in 31 and 14 plies with zero invalid actions, zero caps
and zero unresolved reviews. These two games are not strength promotion or
confidence-bound evidence. Raw output is ignored `test-artifacts/hive-smoke.json`.

The independent reviewer separately checked the tactical fixtures at 100/150/500
ms for immediate wins and 100/500 ms for mandatory defense; reported selections
were legal wins or actions without an immediate winning enemy reply. This is
spot-check evidence, not a tournament.

## Browser/source gates

The first local Chrome launch was blocked by sandbox `spawn EPERM`. Its launch
permission request was interrupted before execution. The subsequent portable
script includes actual `hasTouch` tablet interaction, keyboard placement,
preview/cancel/confirm, worker pause/resume, invalid import atomicity, correction
preview/confirm, export/reload/history, view-only pan/zoom and administrative
confirmation/cancel. Final browser execution and screenshot inspection are
coordinator-owned pending integration. No browser pass or screenshot artifact is
claimed by this owner branch yet.

Coordinator integration subsequently passed 22 rules tests and three static
asset/standalone regressions. The staged browser suite passed using installed
Chrome with `BASE_URL=http://127.0.0.1:52818` and a separate `STANDALONE_URL`.
The first browser run exposed tablet grid overflow; flexible grid minimums and
form widths were corrected and the entire script then passed. Desktop and
touch-tablet screenshots were visually inspected. This is automated Chrome
touch emulation, not real iPad Safari acceptance. Full CI gates deployment.

Primary movement-diagram pixel inspection/hash remains unresolved; see the
[source gate](sources.md). No finished-release publication is claimed.
