# Search-tree reuse and diverse opponent experiments

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
