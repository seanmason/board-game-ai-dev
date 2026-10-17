# Pentago correctness and AI validation

Development preview: https://seanmason.github.io/board-game-ai-dev/pentago/

## Rules compliance

The game follows the printed two-player Pentago rules for a 6×6 board
of four rotating 3×3 quadrants, including the early-win placement exception,
optional no-effect rotation while a neutral quadrant exists, and draws
caused by simultaneous lines after rotation.

The independent oracle in
[validation/pentago-reference.js](../validation/pentago-reference.js)
uses a 2-D grid, transpose-based rotation and separate directional win scans.
It does not import the production Pentago engine, reducing the chance of
shared implementation mistakes. Its authorship is still within this project:
it is **not** an externally certified reference.

The reproducible [10,000 complete-game verification run](https://github.com/seanmason/board-game-ai-dev/actions/runs/39008077603)
passed all cases with no production/reference disagreements:

| Measure | Result |
|---|---:|
| Completed seeded games | 10,000 |
| Complete turns checked | 290,961 |
| Drawn games | 984 |
| CPU elapsed time on CI | 50.8 seconds |

The smaller 2,000-game comparison is included in routine CI.
Unit tests explicitly cover rotations and their inverses, the neutral-twist
exception, immediate placement victories, simultaneous-win draws,
opponent victories caused by a twist, and legal-move uniqueness.

Playwright Chromium also exercises real place+rotate sequences, neutral
skips, undo/redo, manual AI turns, hover/selection, preserved simulations
across pause and resume, subtree reuse and saved-session reload.
Mobile Chromium touch emulations cover iPad-sized and narrow screens.
**Native iPad Safari remains to be tested by a human.**

## Search quality and recommended move policy

The initial MCTS implementation was evaluated at 48 simulations per turn
against 24 complete games of each artificial opponent type.

| Opponent | Initial most-visited MCTS win share |
|---|---:|
| Uniform random | 100% |
| Stochastic informed | 91.7% |
| Stronger greedy one-ply heuristic | 16.7% |

The greedy result demonstrates that shallow-rollout MCTS can be unreliable
against adversarial tactical play at short budgets. We tested additional
search variants, but neither unsaturated rollout scores nor a two-ply
beam-minimax guard consistently improved the result in preliminary samples.

**The Pentago UI therefore separates recommendation policy from search
analysis.** It defaults to the deterministic one-step heuristic, which
accounts for immediate terminal wins/losses and evaluates open five-cell
windows and quadrant-center control. The MCTS workers continue to run and
provide visits, position heatmaps and approximate winning chances. The
recommendation control can switch to **MCTS visits** explicitly, without
discarding simulations. Heuristic recommendations are not a solved-game
tablebase and should not be presented as optimal play.

A heuristic-only recommendation against the same greedy implementation
produced a 50% win share in 24 matched-seed games, as expected for comparable
policies. This is not independent human strength validation.

Caveats:
- Estimated winning chances arise from imperfect, truncated simulation
  continuations; they are not calibrated probabilities.
- Search results vary with simulation budget and opponents' strategies.
- A few dozen benchmark games have wide sampling uncertainty.
- Published Pentago perfect-play tablebases are not bundled or queried.

## Development and reproducibility

```sh
npm test
npm run verify:pentago
PENTAGO_GAMES=10000 npm run verify:pentago
npm run benchmark:pentago -- --games=24 --playouts=48 --opponent=greedy
```

GitHub Actions packages only explicit static browser assets for Pentago,
under `/pentago/` on the development-preview site, leaving the existing
Azul application at `/`.

The finished-game release repository `seanmason/board-game-ai` remains
untouched until additional real-device testing, user review and rights
review are complete.
