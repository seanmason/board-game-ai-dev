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

The worker uses deterministic iterative-deepening alpha-beta with a transposition
table whose keys include ancestor context. Terminal surrounds dominate a small
Queen-liberty, connected-top mobility and Beetle-pin heuristic. It searches every
legal root at each depth; the UI reports completed depth, nodes, elapsed time,
root count and partial progress at the next depth. A paused deeper iteration
retains the last completed-depth ranking. No selective root pruning occurs.
Ancestor cycles receive a draw-like search estimate; they never adjudicate the
recorded game. Recorded cyclic stalemate requires explicit player agreement.

The initial budget is 150 ms, with 100/500 ms options and pause/resume for longer
analysis. A single engine step can overrun the nominal budget; this is not a
hard real-time guarantee. Evaluations are not calibrated win probabilities.
Opening diagnostics and two modest baseline/random smoke games are described
in [validation evidence](validation.md); they do not establish human strength or
benchmark promotion.

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

Shared registry, suite menus, allowlist, npm scripts, CI and documentation indexes
remain coordinator-owned. Standalone packaging and release verification follow
integration; this implementation does not authorize publishing.
