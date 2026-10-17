# Platform review before Splendor

> Retained investigation/integration record. Its dated plans and verification apply to the recorded work, not automatically to later revisions. Start with the [game directory](games/INDEX.md) or [current platform contracts](platform/README.md).

Reviewed 2026-10-17 against main `87220d9` and Wingspan draft `8b5b5c9`.
Splendor is the selected next game; this change does not implement it.

## Assessment

The existing pure rules modules, seeded search engines, independent validators,
and game-specific views are sound boundaries to retain. There is no evidence
that a framework rewrite, TypeScript migration, neural model or WASM conversion
is needed before the next game. The major platform gap is repeated lifecycle
and persistence code, not the lack of a universal MCTS implementation.

| Area | Finding | Resolution |
| --- | --- | --- |
| Worker lifecycle | Azul/Pentago duplicate pause, timekeeping, timers, generations and reuse coordination; creation/advance exceptions escape structured reporting | Shared worker runtime with thin game adapters; failures discard potentially corrupt search, generation guards, pause keeps tree/RNG |
| Responsiveness | A fixed batch can multiply the delay before processing pause | Yield after a 12 ms slice between iterations; a single iteration remains synchronous, so this is not a hard latency guarantee |
| Session loading | Fractional/string cursors can replace history then fail while selecting its state | Validate all snapshots and cursor first, normalize seats/preferences, preserve v1 formats and storage keys |
| Physical input | Malformed persisted factory rows can reach the Azul renderer | Validate slot dimensions and tile values before restoring unfinished input |
| Metrics | Retained visits were counted as new work after the elapsed timer resets | Subtract retained visits from simulations/second, retain total evidence count |
| Deployment | Shell copy lists miss dependencies when shared modules are added | Explicit asset manifest and dependency checks; CI browser tests serve staged assets |
| Standalone games | Shared source must not require another game or a service at deployment | `package:game` prepares an independent directory with shared modules and root entry point |
| Search semantics | Azul outcomes, Pentago heuristic leaves, and Wingspan utility samples mean different things | Keep engines, ranking and aggregation game-specific; do not present utilities as calibrated wins |
| History | Snapshot undo/redo truncates future history after a new action | Preserved; named analysis variations and append-only observation events remain future work |

## Shared contracts

`shared/search-worker.js` accepts a game adapter with `create(data)`,
`run(search, iterations)`, `summarize(search)`, optional `batchSize(data)` and
optional `advance(search, data)`. Advance returns `{search, metadata}`; the
adapter alone decides whether reuse is valid. The runtime does not inspect
rules, hidden state or candidate rankings and never commits gameplay actions.
Messages retain the existing start/advance/pause/resume/stop/snapshot protocol.
Progress/error responses carry a generation. UI coordinators must compare that
value with their **current** generation, not merely a captured old token.

`shared/session.js` validates the session envelope, every state using the game's
validator, consistent player count/mode, labels and cursor before returning a
replacement. It is not a legal-transition/reachability oracle. Imports and local
autosaves keep their existing v1 shapes; there is no silent format migration.

`npm run stage:preview` writes a fresh allowlisted development preview.
The optional Wingspan manifest is used only when its entry point exists in the
checkout. No preview command publishes to the finished-games repository.

`npm run package:game -- azul /tmp/azul-site` and
`npm run package:game -- pentago /tmp/pentago-site` produce standalone sites.
Serve the output directory with an HTTP server. Pentago's files are relocated
to the root, its shared imports adjusted, and suite-only navigation omitted.
The package needs no runtime npm dependencies. Existing destination directories
are rejected to prevent stale assets. Wingspan remains ineligible for this
finished-game packaging command while its release blockers are open.

## Wingspan review and integration

The draft branch already separates catalog, core rules, effects, observations,
belief sampling and rollout analysis. Retain those boundaries. Its published
card-by-card coverage and independent reference checks do not establish complete
interaction coverage or human playing strength.

Unresolved items that matter for this project's primary workflows:

- Physical mode still contains simulated placeholders. Observed state must be
  authoritative before a physical assistant can safely recommend real moves.
- Some chained choices remain unavailable through the UI; AI candidate generation
  is representative rather than exhaustive. Displayed coverage must not imply all
  legal actions were searched.
- The worker message handler compares a response with a captured token rather
  than the mutable current generation. A queued response from a terminated worker
  needs an additional `token === generation` guard at migration.
- Its worker and session loader should adopt these shared services when integrating
  this main-based refactor. Preserve the observation-only worker boundary: never
  pass complete digital state to a generic worker convenience API.
- Full human-scored transcripts, stronger time-matched opponents and iPad Safari
  performance remain outstanding. Do not change draft/release status as part of
  this infrastructure review.

This PR does not rewrite or merge the separately active Wingspan branch. The
main-based refactor intentionally avoids coupling that game's acceptance gates
to infrastructure changes. Merging branches will require reconciling package.json
and preview-workflow changes using the shared checker/packager while retaining
all Wingspan commands and workflow triggers.

## Splendor implementation requirements

1. Pin base-game edition and reconcile all card/noble data to source references.
2. Pure rules and state validation; no DOM/worker dependencies in the engine.
3. Model actual observed market refills and private reservations separately from
   sampled unknowns. A physical session must never invent a real card draw.
4. Reuse worker lifecycle and session validation. Add only game-specific rules,
   candidate generation, observation/belief logic, evaluation and presentation.
5. Keep complete human move input separate from any pruned AI move set.
6. Test gem limits/returns, alternate payments, reservation visibility, nobles,
   final-round/tie rules, conservation, undo and hidden-information invariance.
7. Benchmark against diverse opponents at matched time and report sample counts;
   distinguish score/utility from win estimates. No autoplay, and no analysis
   preview may change the recorded physical state.
8. Register explicit static assets and test the resulting standalone package.

## Validation

- Baseline before changes: 44 Node tests passed.
- Refactor: 60 Node tests, including worker lifecycle/fault injection, atomic
  session rejection and dependency closure of both standalone packages.
- Azul reference comparison: 200 games / 18,058 moves, no differences.
- Pentago reference comparison: 2,000 games / 58,232 moves, no differences.
- Browser CI exercises staged assets, existing interaction suites and malformed
  import recovery. Local Chromium download failed; browser results must be read
  from CI before merge. Real-device Safari acceptance remains separate.
