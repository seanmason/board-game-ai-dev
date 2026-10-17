# Five-game development implementation

> Retained investigation/integration record. Its dated plans and verification apply to the recorded work, not automatically to later revisions. Start with the [game directory](games/INDEX.md) or [current platform contracts](platform/README.md).

Implemented in parallel with five GPT-6.1-Sol agents at high reasoning, plus an
independent agent using the same model for rules and component review. Each game
had an isolated worktree and owned game-specific code. Shared packaging,
navigation, CI and integration were coordinated separately.

This is a development batch, not a claim of expert AI strength or a production
release. The companions prioritize actual physical observations, manual move
recording, continuous analysis, and correction through validated session history.
No game autoplays a recommendation. Future hidden components are sampled from
public information rather than taken from the actual digital deck.

## Implemented scope

| Game | Scope | Search |
| --- | --- | --- |
| 7 Wonders Duel | Complete base cards, wonders and progress; physical drafting and reveals | Sampled hidden worlds with adversarial alpha-beta continuations |
| Carcassonne | 72 core tiles, farmers, 2–5 players; no River or Abbot | Root bandit, progressively widened placements and sampled opponent responses |
| Cascadia | Standard 1–4 players, including solo; all A–D wildlife cards | Screened placements and sampled hidden-world lookahead; optional heuristic comparison |
| Patchwork | 33 regular patches, original/corrected time track, 2 players | Incremental adversarial search with packing beams, deepening and widening |
| Kingdomino | Original/US second edition, 5×5 kingdoms, 2–4 players | Sampled future rows, placement/draft coupling, exact final-row optimization |

All have responsive interfaces, actual setup/observation entry, explicit move
confirmation, undo/redo, import/export, local persistence, and shared worker
lifecycle controls. Each can be packaged independently with `npm run package:game`.
Open `games.html` for the development directory.

## Corrections found through independent review

The review caught errors that source agreement and random play alone would miss:

- Patchwork's research catalog encoded a three-cell patch where physical photos
  show a solid 2×2 square. The corrected set contains 166 regular squares. A second
  reference's eleven-cell H was also rejected against its eight-cell physical face.
- Duel's Age III coverage graph initially exposed an upper card prematurely.
- Cascadia starter edge strings needed rotation between reference and renderer
  conventions. All five starters now match independent physical edge fixtures.
- Imported states could initially retain scored Carcassonne meeples, separate
  Cascadia starter components, claim future Patchwork leather, or place Kingdomino
  dominoes without a matching route to the castle. These cases now reject.
- Unsafe imported Carcassonne event HTML, inherited Duel catalog keys, and coerced
  Cascadia scoring-card values were rejected and covered by regressions.
- Candidate selection uses stable action identities; solved searches stop and
  pause tests wait for worker acknowledgement rather than optimistic UI text.

See [the independent audit](FIVE_GAME_AUDIT.md) and each game report for evidence
and literal fixtures. Shared-history validation checks snapshots; it is not a
cryptographic record of physically observed play.

## What the AI evidence does and does not establish

The pilots are deliberately recorded even when their results are unfavorable.
Carcassonne, Cascadia and Kingdomino did not establish a search advantage over
stronger heuristic or shallower-search comparisons. Duel won its two-game
nominal-100ms comparison and four games against a much cheaper heuristic; those
samples are too small to support a general strength claim. Patchwork's final
post-correction pilot is recorded in its own report.

These are tiny paired-seed experiments on a shared host, with actual elapsed
budget overruns disclosed. Other project work could consume CPU. Equal requested
wall-clock budgets therefore do not establish controlled equal-compute strength.
Sample standard errors in interfaces describe sampled continuation variation,
not confidence that a recommendation is optimal. No model is assigned a human
skill rating. Larger held-out comparisons and human games remain necessary.

## Integrated validation

The integrated checkout passes **274 Node tests with zero failures or skips**,
including all twelve independently authored audit fixtures. Syntax checks cover
108 JavaScript modules. The package tests verify complete local dependency graphs
for all eight standalone games, and staging copies only explicit runtime assets.
Hosted CI also runs each game-specific catalog/rules verifier before browser checks.

## Remaining acceptance boundaries

- Cascadia's 85 regular faces have complete reference data and independent
  physical aggregate corroboration, but not a second full individual-face audit.
  Nature-token exhaustion also lacks a located explicit publisher clarification.
- Kingdomino's 48 face facts match the reference CSV and component photograph;
  a second source binding every face to its reverse printed number remains absent.
- Browser checks cover Chromium desktop/phone widths and standalone workers.
  Actual tabletop usability, touch behavior on real iPads, and Safari still need
  acceptance testing.
- No expansions or variants beyond each report's stated scope are implied.
  Production publication and merging are separate from this development work.
