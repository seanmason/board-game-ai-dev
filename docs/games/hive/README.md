# Hive classic companion

Scope: Gen42 English classic rules, copyright 2010, two players with eleven
pieces each. Queen openings are legal. Mosquito, Ladybug, Pillbug, Carbon/Pocket
expansion pieces, Ultimate opening restrictions, tournament clocks and other
competition rules are excluded. [Open the companion](../../../hive/index.html).

## Rules and physical recording

The immutable engine handles complete reserve placements, Queen deadline,
after-lift One Hive connectivity, Queen/Ant/Spider sliding, straight Grasshopper
jumps, height-aware Beetle movement and visible stack colour. Covered identities
remain in bottom-to-top arrays. Reserves use the lowest available equivalent
ordinal for each type. Simultaneous Queen surrounds draw; a covered Queen still
counts. Pass is available only when no ordinary action exists. Two consecutive
forced passes trigger a review, without automatically recording a draw.

Physical recording is the default; digital board mode uses the same rules.
Select a reserve/top tile, inspect every highlighted destination or use the
coordinate dropdown, preview the path/climb and confirm. Cancel only discards
the preview. No move is played automatically by analysis. Starting side, move
history, undo/redo, autosave, validated entire-history import/export and complete
position corrections are available. Correction requires a reason and a preview
of the whole board before confirmation; the event retains the preceding board,
side and counters. Draw agreements and resignations require confirmation and
can be undone in the recording. Arbitrary position validation does not prove
historical reachability.

All game information is public. Imports must include every identity and full
stack order; unknown underlying tiles are not sampled. Pan/zoom changes view
metadata only. The first physical placement is normalized to `(0,0)` as an
arbitrary table origin; later physical positions can be translated freely.

## Search

The worker first checks every legal root for an immediate winning surround. If
none wins, it verifies the preferred move against every immediate opponent reply,
trying alternatives when a losing reply is found. This tactical gate yields
between root/reply checks. Advice is withheld until a safe move is verified; if
every legal move allows an immediate loss, that fact and its loss value are
reported. Unverified alternatives are withheld from advice, never from human
legal actions. The UI distinguishes root evaluation from tactical reply coverage.

Deterministic iterative-deepening alpha-beta then searches every legal root at
each depth, using a transposition table whose keys include ancestor context.
Queen liberties, connected-top mobility and Beetle pins remain the small generic
evaluation. A newly preferred root must pass the same tactical gate before its
deeper ranking replaces the previous verified recommendation. Pausing retains
the last completed and verified ranking. No selective search-root pruning occurs.
Ancestor cycles receive a draw-like search estimate; they never adjudicate the
recorded game. Recorded cyclic stalemate requires explicit player agreement.

The initial budget is 150 ms, with 100/500 ms options and pause/resume for longer
analysis. A single engine step can overrun the nominal budget; this is not a
hard real-time guarantee. Evaluations are not calibrated win probabilities.
If the initial budget expires before the tactical gate finishes, the UI offers no
unverified recommendation; resume continues the same gate and search state.
Opening diagnostics and two modest baseline/random smoke games are described
in [validation evidence](validation.md); they do not establish human strength or
benchmark promotion.

The tactical follow-up has independent immediate-win, mandatory-defense and
unavoidable-loss fixtures plus cooperative worker pause/resume tests. It does
not establish stronger full-game play. The old search is frozen in a
[benchmark-only module](../../../scripts/benchmark-adapters/hive-incumbent.mjs),
which is not imported by the browser. See the [comparison protocol](BENCHMARKS.md)
for the separate candidate/incumbent keys and soft-budget diagnostics.

## Evidence and limitations

The [source ledger](sources.md) maps rules/components to primary publisher
sources. Independent coordinate fixtures cover slide contact, articulation,
spider path length, unbounded Ant perimeter traversal, six jump directions and
Beetle support heights. A slow independent graph/slide oracle and translated,
rotated and reflected fixtures check geometry.

**Direct publisher diagram pixel inspection remains unresolved.** The PDF is
image-only in the available web tool, and its attempted local download was not
completed. Height-aware movement is implemented and tested mathematically but
is not certified as an independently reviewed transcription of all publisher
Beetle/freedom diagrams. No complete-rules certification is claimed. There is
also no independent real-copy physical match transcript yet.

## Implementation map

- [Catalog](../../../hive/catalog.js), [geometry](../../../hive/geometry.js),
  [complete actions](../../../hive/actions.js), [core](../../../hive/core.js).
- [Public observations](../../../hive/observations.js),
  [search](../../../hive/ai.js), [worker](../../../hive/worker.js).
- [App](../../../hive/app.js), [tests](../../../test/hive.test.js),
  [browser check](../../../scripts/browser-hive.mjs).

Suite navigation, static and standalone packaging, npm scripts and CI are
integrated. Coordinator acceptance passed all 22 rules tests, three packaging
regressions and the browser suite including the standalone package. Tablet
overflow found during browser review was fixed; desktop and actual touch-context
tablet screenshots were reviewed. Real iPad Safari acceptance remains open.
