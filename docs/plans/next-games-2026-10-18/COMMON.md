# Shared implementation contract for the next six games

Planning date: 2026-10-18. These are implementation instructions, not claims that
any of the six games exists or has passed validation. Read this file and the
assigned game plan before editing. The implementation target is this JavaScript
repository; no neural training, WASM rewrite, server dependency or new framework
is needed. The coordinating agent owns suite integration.

## Assignment and ownership

Each game agent owns its game directory, game-specific tests, scripts and overview:
`<slug>/`, `test/<slug>*.test.js`, `scripts/{audit,verify,benchmark,browser}-<slug>.mjs`,
and `docs/games/<slug>/README.md`. Use a separate `codex/<slug>` branch/worktree
when implementation begins; this planning package itself does not create one.
The coordinator alone edits `index.html`, `games.html`, `scripts/static-assets.mjs`,
`package.json`, shared modules, CI and documentation indexes. Supply the exact
integration patch required rather than racing other game agents on those files.
Implement the pinned edition completely. Optional variants and exclusions must
be explicit in setup/rules help; do not silently substitute a convenient edition.

## Deliverables and stable interfaces

Use `catalog.js` for component definitions and source metadata; `core.js` for
immutable rules/state; `ai.js` for search; `worker.js` for worker adaptation;
`app.js`, `index.html`, `styles.css` for UI. Hidden-information games also need
`observations.js` and `belief.js`. Split `scoring.js` or `rules.js` where useful.
Use original CSS/SVG symbols and a schematic board. Link rulebooks; do not bundle
publisher art or copy lengthy card/rule text. Encode rule facts in original code.

The concrete exported interface must include:

- `newGame({players, mode, edition, seed, ...gameOptions})`: reject unsupported
  combinations; seeded digital setup and a physical setup awaiting observations.
- `currentPlayer(state)`: decision owner, including forced effects. For simultaneous
  games expose `decisionOwners(state)` and an explicit per-viewer decision owner.
- `legalActions(state, actor)`: complete, canonical legal choices given that actor's
  known decision information. Do not prune this function for AI performance.
- `applyAction(state, action)`: validate and return a new state; failed actions leave
  input untouched. Rules determine effects before search evaluation is involved.
- `assertValid(state)`: phase/turn constraints, resource/component conservation,
  board legality and score invariants. Validators must reject malformed imports.
- `score` / `outcome`: exact game-specific scoring and winners, including ties and
  match/round separation. Return winner shares summing to one at a terminal state.
- `publicObservation(state, viewer)`: own permitted facts, public facts and that
  viewer's remembered private observations. Exclude hidden identities, true deck
  order, random-generator state, other players' choices and unrevealed outcomes.
- `analysisBlocker(state, viewer)`: a concise missing-information explanation.
- Physical mode: `recordObservation` and `recordPhysicalAction` validate actual
  entered outcomes and resolve an atomic transaction. A pending observation is
  resumable/cancellable; advice cannot commit a simulated outcome as a real fact.

The game plan supplies concrete state/action schemas; finalize these before UI
work. Unknown cards use slots/counts, not invented card IDs that can leak through
labels. Digital true state may contain a deck; the worker receives only the
observation and root choices. Determinizations are invented possibilities sampled
from constraints. Identical visible information must yield identical seeded
advice distributions even if the inaccessible true hidden state changes.

Cancellation is permitted before an actual tabletop effect is performed. If a player
has already seen a real private card or other physical outcome, preserve that
knowledge as an observed event with provenance; software cancellation cannot
undo the real information. Correct mistaken entries explicitly, and distinguish
counterfactual previews from things that really happened.

For physical observation corrections, preserve an event/history entry and validate
the corrected snapshot. Unknown private facts must not block unrelated public
recording. Block recommendations only when information required for the current
actor's own legal choices is missing. Never require an opponent's hidden hand.

## Search and meaning of values

Provide a simple deterministic baseline first. Add only the AI method in the game
plan. The Wingspan experiments showed that larger playout counts, deeper leaves,
or sums of attractive bonuses do not reliably improve results. Use a short,
interpretable evaluation, complete root choices and tactical terminal checks.
All abstract-game immediate wins and mandatory defenses must be tested before
strength tournaments. Where terminal continuation is small, compute it exactly.
Distinguish exact endgame results from heuristic estimates and sampled utilities.

Search may have its own `candidateActions` ranking/beam, but its pruning must be
reported and must not remove moves from the human recording UI. Include all
immediate wins/defenses. Inspect action coverage before increasing compute;
Wingspan's useful change expanded starting choices as well as its evaluator.
State-specific tactics may override a generic heuristic only through a validated
legal move. Do not make an exact-solver claim for the complete game.

Worker adapter: import `installSearchWorker` from `../shared/search-worker.js`;
implement `create(data)`, `run(search, iterations)`, `summarize(search)` and optional
`batchSize(data)`. Commands are start/pause/resume/stop/snapshot with generation
IDs. Report iterations, candidates, utility, elapsed time and method. Respect
stale generations; reset after recorded moves and corrections. Pause/resume
retains the current search. A synchronous iteration can overrun a time slice;
keep iterations small and do not promise hard real-time interruption.

No value may be labelled win probability without calibration evidence. Prefer
`Evaluation`, `Expected score margin`, `Sampled win share`, `Exact result` as
appropriate. Explain each algorithm with a hover tooltip and a touch/keyboard
expandable explanation. Use ordinary product text, without 'experimental' or
'Base Game' banners. A concise rules-scope panel still states supported editions.

## Human workflow and browser UI

Default to a physical-table companion, with optional digital play. Display the
board/market/tableau, resource and score breakdown, active player and pending
observations. Enter every legal action, including strategically unattractive
choices. Use selection -> legal targets -> complete action preview -> Confirm.
Hovering/selecting a recommendation previews it without changing state. Touch
users receive the same information through tap and expandable controls.

Provide: starting-player/seat controls, private-hand entry/reveal for the actor,
unknown opponent slots, clear chance-result prompts, corrections, Undo/Redo,
autosave, JSON export/import and history navigation. Pass-device privacy must
conceal the preceding actor's hand before revealing the next. Simultaneous games
must conceal submitted choices until the reveal boundary. Names, symbols and
text supplement color. Main touch targets >=44 CSS pixels; keyboard-operable
controls, labelled inputs and visible focus; check an iPad-sized viewport.

Each page has one `Games` link to `../index.html` marked `data-suite-nav`; no
cross-game list. Import is atomic: validate all history snapshots before replacing
live session using `readSession` from `../shared/session.js`. Use game-specific
storage and format IDs, version 1 envelope/history/index/seats and a pinned rules
edition. Do not persist search trees. Invalid import must preserve the current
session. Future incompatible schemas need explicit migration/rejection.

## Source and fidelity gates

1. Record publisher rule URL, edition/version, page/section and retrieval date.
   For catalog-heavy games create a manifest mapping each component to a source
   location; compare an independently transcribed second copy. Do not call a copy
   of production data an independent oracle.
2. Implement state/transitions, then hand-computed fixtures for every rule family
   and edge case in the game plan. Test illegality and failed-action immutability.
3. Component/count audits and seeded complete legal games must pass before UI or
   AI strength claims. Add a slow reference implementation for movement/scoring
   where practical; it must not call the corresponding production function.
4. Test projections with hostile getters on hidden fields and paired true states
   sharing one observation. Test known-card memory loss/persistence at each effect.
5. Physical complete-game transcripts must exercise reveal/correction/cancel/
   recovery and score reconciliation. A digital simulation alone is insufficient.
6. Browser checks: new game, representative actions, pending observations, advice
   preview, pause/resume, undo/redo, import rejection, reload recovery and game end.
   Save screenshots of board and analysis on desktop and tablet-sized viewport.

## Bounded AI experiment and acceptance

First compare against random and the deterministic baseline, recording illegal
moves, complete-game caps, runtime, root coverage and outcomes. Screening starts
with 40 independent setups, both seats for two-player games, equal fixed compute
budgets and a separate equal-time comparison if methods differ in cost. For
multiplayer games use balanced seat rotations for each player count, report
winner share versus its correct 1/n chance reference, and do not pool counts or
interpret a two-player success as multiplayer evidence.

At most two candidate methods may advance to fresh 100 paired setups (200 games)
against the incumbent in two-player mode. Predeclare selection threshold and
weights before screening; a practical default is >=55% win share, positive mean
margin and every game valid. Promotion requires a one-sided 97.5% paired-t lower
bound above 50% and positive mean margin; this gives an approximate 5% family
error allowance across two finalists, conditional on paired-t assumptions.
Report margin uncertainty separately; a positive point estimate is insufficient
for a claim of certain margin gain. Multiplayer promotion uses preregistered
seat-balanced uncertainty over independent setups and baseline matchups rather
than reusing the two-player threshold mechanically. If inconclusive, retain the
simpler method. This is a good-enough decision process, not a search for perfection.

Use <=24 desktop game workers across all simultaneous studies at BelowNormal
priority, retaining UI capacity. Never infer finished status from process absence:
report completed, failed, capped, missing and interrupted games distinctly.
Freeze revision, hashes, seeds, assignments and stopping rules; checkpoint after
each game. Do not stop on favorable results. Keep confirmation separate from
screening. Any dashboard extension is optional to implementation and must show
actual process/stage health and active games, with stable game/method IDs.

## Integration and handback

Planned commands (create these scripts; do not claim they have already run):
`node --test test/<slug>*.test.js`, `node scripts/audit-<slug>.mjs`,
`node scripts/verify-<slug>.mjs`, `node scripts/benchmark-<slug>.mjs`.
Use explicit file arguments on shells that do not expand globs. Run the repo's
syntax and documentation checks. Run affected shared regressions only if shared
code changed; no need to rerun old strength tournaments for documentation edits.

Hand back: source/test files, component audit, precise unsupported variants,
commands and outcomes with revision, representative rule traces, physical-flow
transcript, AI evidence/limits, browser screenshots, asset list, required suite
integration patch and unresolved issues. The coordinator adds assets to the
allowlist, optional/standalone arrays, suite index, docs/game routing, npm scripts
and CI, then checks static import closure and standalone packaging. Update game
overviews only after files exist. No game release or GitHub Pages deployment is
automatically authorized by this planning request.
