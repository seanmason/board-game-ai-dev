# Search-tree reuse and diverse opponent experiments

> Retained development report: sections describe the work and evidence at their recorded stages. Start with the [current azul overview](games/azul/README.md) for present behavior and remaining gates. Historical counts and results were not rerun for the documentation migration.

**Scope:** Azul MCTS workers, after each observed drafting move, and external
headless experiments. This implementation is independent of the public
finished-game repository.

## Safe root advancement

Each worker receives the actual played action and new observed state. Its
prior MCTS root is advanced to an already-expanded child **only if**:

1. Both states are in the same deterministic factory-drafting phase.
2. `applyAction(previousRoot, action)` produces exactly the supplied state.
3. The chosen action has an expanded child in that worker's search tree.
4. The search method and worker configuration have not changed.

The subtree retains its child visit counts, per-player reward/win/score sums,
descendants, and rollout RNG stream. Ancestors and siblings are discarded, so
all prior simulations of *unplayed* alternatives are lost. The root visit
count becomes the chosen child's visits, not the old root's total; node memory
is recomputed from descendants.

Every worker makes this decision independently; a root-parallel worker
without the chosen child simply begins a fresh search. A new factory draw,
undo/redo, imported position, or changed method/worker count invalidates
the old tree. This avoids reusing outcome statistics based on unavailable
future random information or an incorrect observation.

Paused searches remain paused after the root moves, and can resume without
losing conditional visits. This is in-memory reuse only; a browser reload or
tab eviction clears the search, though the recorded board is locally saved.

## Verification

- Node tests inspect preserved child identity, previous visit counts,
  per-player sums and continued updates; reject changed observations and
  unexpanded actions without mutating the old search.
- Chance/refill transitions must always reject deterministic rerooting.
- Chromium test pauses search, commits an analyzed candidate, confirms the
  retained simulation total and resumed growth, then verifies undo resets it.
- `npm run benchmark:reuse` measures how many **conditional** visits are
  transferred after representative best moves under fixed simulation budgets.

## Synthetic opponent diversity

The tournament now supports:
- `random`: uniformly random legal actions.
- `heuristic`: original greedy one-step baseline.
- `informed`: stronger greedy wall/progress/penalty evaluation.
- `stochastic`: temperature-sampled informed heuristic.
- `floor-averse`: stronger avoidance of immediate floor penalties.
- `denial`: greedily weights its own immediate prospects against the next
  player's maximum immediate heuristic opportunity.
- `mixed`: rotates five policies across opponent seats/game indices.
- `legacy-uct`: original UCT tree search as a competing agent with its own
  configurable simulation budget.

These are deliberately diverse *synthetic* players, not human performance
proxies. Paired seeds and rotating seats reduce some tournament biases but
do not create identical game trajectories when opponents choose different
moves. Report confidence intervals and avoid treating small samples as
universal playing-strength claims.

The [diverse opponent workflow](../.github/workflows/opponents.yml) records
each game configuration separately; match simulation and CPU budgets before
comparing algorithms. Research qualification is required before promoting the
feature to the Github Pages development preview.


## Observed search-reuse results (2026-10-17)

[Complete rules and browser verification](https://github.com/seanmason/board-game-ai-dev/actions/runs/39005425254)

The benchmark selects the top MCTS action in each of 24 initial drafting
positions for 2, 3, and 4 players (350 original simulations per position).
It advances the search to that action and measures how many simulations
are still conditional on the observed move.

| Players | Successfully rerooted | Original visits summed | Conditional visits retained | Average visits per new root |
|---|---:|---:|---:|---:|
| 2 | 24 / 24 | 8,400 | 600 (7.1%) | 25.0 |
| 3 | 24 / 24 | 8,400 | 581 (6.9%) | 24.2 |
| 4 | 24 / 24 | 8,400 | 510 (6.1%) | 21.3 |

All 30 Node unit tests, the 10,000-game rules oracle comparison, and the
Chromium smoke test passed in the cited validation run. The browser test
confirmed that committing a paused, previously searched action retains the
corresponding visits, that resume adds further visits, and that undo safely
invalidates the tree.

**Scope caveat:** these results concern selected first moves under this
specific search budget, not arbitrary physical play. Unexpanded moves restart
the worker. They also cannot be extrapolated to multi-round reuse across
stochastic factory refills.

## Diverse-opponent results (2026-10-17)

[Completed tournament matrix](https://github.com/seanmason/board-game-ai-dev/actions/runs/39005335303)

Headless complete-game tournament, matched RNG seeds and independently
rotated AI seats/starting players. Each cell below is **24 games** at **128
MCTS simulations per decision**, with the same separately implemented
opponent strategy for both search variants. These are exploratory, noisy
comparisons rather than human-strength measurements.

| Opponent | Players | Guided MCTS win share | Original UCT win share |
|---|---:|---:|---:|
| Informed greedy | 2 | 91.7% | 54.2% |
| Informed greedy | 3 | 54.2% | 4.2% |
| Informed greedy | 4 | 25.0% | 0% |
| Denial-oriented | 2 | 70.8% | 25.0% |
| Denial-oriented | 3 | 22.9% | 0% |
| Denial-oriented | 4 | 29.2% | 0% |
| Mixed policies | 2 | 91.7% | 45.8% |
| Mixed policies | 3 | 58.3% | 12.5% |
| Mixed policies | 4 | 39.6% | 0% |
| Stochastic informed | 2 | 100% | 95.8% |
| Stochastic informed | 3 | 95.8% | 62.5% |
| Stochastic informed | 4 | 100% | 45.8% |

As an additional head-to-head-style opponent, the original UCT searched
**64 simulations per decision**. In 12 games per player count, Guided MCTS
(also 64 simulations) scored 91.7% / 100% / 91.7% win share for 2 / 3 / 4
players, respectively. These especially small tests are exploratory and
should not be considered proof of a calibrated strength differential.
The original UCT versus an independently seeded original-UCT opponent
produced volatile results, demonstrating how sensitive small tests can be
to root choices, seating, and search randomness.

### Interpretation

Guided MCTS generally outperformed the original search against the
different opponent styles at equal simulation budgets. It was not
universally dominant: in the three-player denial-oriented contest,
Guided MCTS won only 22.9% of the 24 games, below the equal-strength
reference share of 33.3%.

Future strength work should target more robust opponent modeling, especially
defensive/denial drafting and diverse human-like policies. Tournament
design should also incorporate more seeds, seat-swapped pairings and
compute-normalized comparisons, rather than trusting small-sample win share.
