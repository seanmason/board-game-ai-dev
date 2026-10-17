# Kingdomino base-game companion

`/kingdomino/` is a physical tabletop companion first: record actual face-up
numbers, record the initial randomly drawn king order, and explicitly confirm
placements and claims. No recommendation ever plays automatically. Digital mode
uses the same pure engine with browser-drawn rows and manual moves.

## Rules and edition boundary

The default is the original 2016 game. The publisher's original English PDF is:
https://blueorangegames.eu/wp-content/uploads/2023/04/Kingdomino-Rules-EN.pdf

The separately selectable US second edition follows its publisher's PDF:
https://www.blueorangegames.com/webroot/img/games/rules/cfa0f38157341a002eab1100aab478ea-Kingdomino-Rules-US-2nd-Edition.pdf

| Rule | Original 2016 (default) | US second edition |
| --- | --- | --- |
| Two players | 24 random dominoes, four per row, two kings each | Same |
| Three players | 36 random dominoes, three per row, one king each | All 48, four per row; unclaimed domino discarded |
| Four players | All 48, four per row, one king each | Same |
| Ties | Score, largest territory, total crowns, shared victory | Score, largest territory, shared victory |

Edition is fixed for a session, including imported history. Six rows are used
with two players and twelve with three/four; everyone gets twelve dominoes.
The initial king draw establishes only the first claim order. Thereafter every
king acts in ascending order of its previously claimed domino number, including
two separate kings belonging to the same player. Placement/discard and the next
claim are separate compulsory phases. The last claimed row is placed without a
further claim. A domino must be placed whenever any legal placement exists;
discard appears only when exhaustive placement enumeration finds none.

The castle connects to all terrain types. Other contacts require at least one
orthogonal matching terrain edge. Extra nonmatching contacts are allowed.
The occupied kingdom can shift within a five-by-five bounding box; the castle
does not have to be centered. Connected terrain regions score area times crowns;
the castle and diagonals never merge regions. Bonus rules (Harmony/Middle Kingdom),
Dynasty, Mighty Duel/7×7, expansions, and Kingdomino Origins are outside scope.

## Domino facts and provenance

All 48 numbered dominoes and both terrain/crown halves are encoded in
`kingdomino/catalog.js`. Only functional facts are included. CSS creates the
terrain colors and simple symbols; no publisher artwork or source photographs
are redistributed.

The number-to-facts transcription agrees with all 48 rows in:
https://github.com/RuPaulsDataRace/Kingdomino-For-Queens/blob/905e17dc4c5c440e6b0f00ccc24c851a70b23533/kingdomino.csv

Every terrain half and crown count was visually checked against this complete
physical-set photograph, column by column, top to bottom:
https://github.com/RuPaulsDataRace/Kingdomino-For-Queens/blob/905e17dc4c5c440e6b0f00ccc24c851a70b23533/kingdominoinordershifted.jpg

`test/kingdomino-catalog-reference.js` records that manual photo transcription
independently of the engine's data structure. The photograph shows terrain faces,
not numbered backs: it verifies all terrain/crown combinations and their stated
order, but is not an independent proof of each reverse number. The photograph and
CSV come from the same source, so this is not two independent data ancestries.
The publisher rulebooks do not enumerate all 48 numbered domino faces. This
remaining provenance limit should be resolved with a numbered physical-set audit
before a finished release. Totals are 26 wheat, 22 forest, 18 water, 14 grass,
10 swamp and 6 mine squares; crowns total 5/6/6/6/6/10 respectively.

## State and observation contracts

- `newGame({players, mode, edition, seed, initialOrder})` returns serializable state.
  `mode` is `physical` or `digital`; `edition` is `original` or `us2`.
- Physical state begins at `draw` with no deck or random placeholder dominoes.
  `observeRow(state, ids)` atomically validates distinct unseen numbers and sorts
  the observed row. The first-row UI also records the actual king draw order.
- `legalActions` exposes only `pick` during draft, and only legal `place` actions
  (or a mandatory `discard`) during placement. Actions never combine those phases.
- `applyAction` returns a new state. Coordinates locate half zero; rotation 0/1/2/3
  locates half one east/south/west/north. Castle is `(0,0)`.
- `assertValid` checks unique/conserved domino inventories, board bounds, paired
  halves, matching-contact reachability to the castle, kings, counters, phases,
  rows and hidden deck counts. This validates snapshots, not every transition
  between imported snapshots. `readSession` validates the complete history before
  the UI swaps any live state; mode/player count/edition cannot change mid-history.
- `observation` allowlists public fields and removes the actual digital deck,
  excluded identities and any unknown auxiliary fields. `createSearch` repeats
  this boundary. `determinize` samples possible future rows from all unseen IDs,
  choosing only the remaining in-play count. It never receives the actual excluded
  allocation or actual hidden order. Physical recommendations stop at draw phases
  until the real row is entered; simulated future draws occur only inside search.

## Interface and analysis

The responsive nine-by-nine coordinate view permits every possible five-by-five
kingdom containing the castle. Green squares are legal anchors at the selected
rotation. Hover previews two squares; clicking pins a ghost; **Record** confirms
it. Draft selections use the same select/confirm pattern. Analysis buttons carry
stable action payloads and only select a preview. Hover/focus freezes candidate
reranking, so a moving list cannot change an action underneath a click. Region
score explanations and the numbered king queue remain visible.

Shared session and worker helpers provide atomic import, snapshot undo/redo,
timeline navigation, local autosave/export, generation checks and pause/resume.
Pausing retains the current search. Every confirmed move/edit resets analysis;
subtree reuse and persisted search trees are not implemented. Digital exports
contain the full hidden deck; only the public observation is sent to analysis.

The AI evaluates region crowns, unseen terrain/crown supply, future region growth,
interior holes, opponent claim value and next-row king priority. It ranks a beam
of placements with the ensuing draft choice, then uses UCB allocation and
progressive widening over all legal immediate choices. Each simulation samples a
hidden world and follows a stochastic tuned policy for a finite horizon. All
legal choices remain available; low-ranked choices enter the search gradually.
The final row is solved by exhaustive independent kingdom continuation search,
including both pending dominoes of a two-player kingdom. Final comparisons follow
the selected edition's tie rules. An exact result pauses the worker and reports
unique evaluated legal choices; repeated reads do not inflate the sample count.

The displayed utility is a heuristic score margin, not a calibrated win probability,
confidence level, solved whole-game result or human strength rating. A single
simulation/root evaluation can take longer than the worker time slice on slower
hardware. No learned model, camera recognition or multiplayer networking is used.

## Reproduction and evidence

```
node --test test/kingdomino.test.js
node scripts/audit-kingdomino-catalog.mjs
node scripts/audit-kingdomino-catalog.mjs --online
node scripts/verify-kingdomino.mjs
node scripts/benchmark-kingdomino.mjs --games=4 --iterations=16 --opponent=tuned
node scripts/benchmark-kingdomino.mjs --games=4 --ms=100 --opponent=search --horizon=6 --beam=12 --opponent-horizon=2 --opponent-beam=0
node scripts/browser-kingdomino.mjs
```

The targeted suite covers castle/matching/bounds, compulsory placement, independent
king orders, edition-specific ties, inventory and topology rejection, atomic row
input, hidden-information invariance and exact final-row continuation against an
independent evaluator. Complete-game tests compare every legal-action set,
transition and score with `test/kingdomino-reference.js`, which imports only catalog
facts and implements placement by an independent exhaustive coordinate scan and
scoring via union-find. The separate verification run completed **120 seeded games,
8,640 transitions, 487 mandatory discards, zero discrepancies**, balanced across
2/3/4 players and both editions. This is repository differential testing, not an
external rules certification.

The browser script covers actual row and king-order entry, rotation/ghost/confirm,
separate claims, no autoplay, persistence, pause/resume, undo/redo, export/import,
malformed-import rejection, phone width, both edition row sizes and the packaged
standalone worker at `/standalone-kingdomino/`. Browser execution results and search
benchmark results are reported separately when run; a script's presence alone is
not evidence that it passed. Benchmark JSON includes seeds, rotated seats, per-game
scores/winners, realized time/sample counts and replayable action traces. Fixed
iteration runs are explicitly not matched-compute comparisons; timed runs include
root evaluation and disclose one-simulation budget overruns.

Before release: numbered physical-set audit, live-table user acceptance, iPad/Safari
performance, larger held-out matched-compute strength testing, and source/license
review remain necessary. This implementation is not publisher endorsed.
