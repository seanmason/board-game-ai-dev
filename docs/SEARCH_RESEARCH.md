# Multiplayer MCTS research · October 17, 2026

All experiments use original Azul standard rules and the same independently
validated state-transition engine. This work is distinct from rules correctness
validation, and does not claim that any policy is perfect.

## Hypotheses

The original MCTS was very weak in three/four-player tournaments at small
budgets. The root branching factor meant 256 simulations were spread too thinly.
Binary win rewards produced sparse evidence in multiplayer games. Noisy
rollouts could obscure long-term wall scoring and floor costs.

The following additions were individually tested:
1. **Guided progressive widening:** expand heuristic-ranked legal actions
   incrementally instead of exploring almost all moves at low visit counts.
   This never permanently excludes a legal move.
2. **Soft relative-score multiplayer utility:** backpropagate a softmax of
   final scores combined with the true winner reward, rather than nearly
   all-or-nothing winner rewards. Hard winner shares remain independently
   available for statistics; the search utility is not a calibrated probability.
3. **Informed rollout heuristic:** estimate imminent wall scoring, longer-term
   bonuses, non-linear floor costs and initiative value.

### Initial variant ablation

[Full workflow](https://github.com/seanmason/board-game-ai-dev/actions/runs/39004060437)

36 complete games per variant/player count, 256 simulations per decision,
identical tournament random seeds and independent seat/round-starter rotation.
Opponent: original deterministic greedy heuristic.

| Variant | 2p win share | 3p win share | 4p win share |
|---|---:|---:|---:|
| Original MCTS | 66.7% | 6.9% | 2.8% |
| Guided widening | 73.6% | 44.4% | 19.4% |
| Widening + relative score | 87.5% | 44.4% | 13.9% |
| Widening + relative score + informed rollouts | **91.7%** | **50.0%** | **41.7%** |

Not every isolated change improved all formats: e.g., the softmax variant
underperformed widening-only at four players. The combined approach won
the most in the initial sample at each player count.

### Held-out confirmation

[Fresh-seed confirmation run](https://github.com/seanmason/board-game-ai-dev/actions/runs/39004254036)

48 complete games per pairing using **seed 913731**, distinct from the
initial experiment's **seed 147**. Same 256 simulations per MCTS decision.

| Contestant (vs original greedy baseline) | 2p win share | 3p win share | 4p win share |
|---|---:|---:|---:|
| Original MCTS | 65.6% | 12.5% | 2.1% |
| **Enhanced MCTS** | **97.9%** | **60.4%** | **33.3%** |
| Informed heuristic only, no search | 62.5% | 30.2% | 33.3% |

Enhanced MCTS was also tested against the **informed** heuristic rather than
the original greedy one:

| Enhanced MCTS vs informed heuristic | 2p | 3p | 4p |
|---|---:|---:|---:|
| Win share (48 new-seed games) | 100% | 59.4% | 45.8% |

The informed heuristic alone accounted for some improvements, particularly
in four-player contests. However, enhanced MCTS clearly improved over
the no-search heuristic in two/three-player matches. The holdout adds
evidence against simple seed overfitting.

## Performance

The benchmark workflows measure simulations per second, total search time,
and mean game score. Browser devices can perform differently from GitHub
runners. Equal-simulation tournaments do not imply identical CPU budgets.

`npm run benchmark:search` runs both search methods on the same collection
of positions and in the same Node process, alternating their execution
order for a more meaningful raw-throughput comparison.

## Interpretation and remaining risks

- Results are **against artificial heuristic agents**, not humans, and cannot
  be treated as calibrated win probabilities or Elo ratings.
- Sample sizes are still modest, especially four-player. Confidence intervals
  must accompany public strength claims.
- Training/tuning and final comparison use different RNG seeds, but both
  share the same underlying simulation engine.
- Rollouts approximate opponents; the realized quality of the analysis may
  depend on playing style and game phase.
- Widening can initially omit low-ranked actions; enough continued analysis
  eventually expands all legal moves.
- The search tree currently spans deterministic drafting actions within a
  single offer round, not the stochastic bag refills across rounds.
- Further improvements should be judged against the new enhanced engine,
  not merely against the weak original implementation.

The browser defaults to `guided-informed`. The original `baseline` remains
available as an explicit comparison option. Switching methods invalidates the
current search tree, while pause/resume within one method preserves visits.

### Same-runner throughput after caching action scores

[Validation and speed measurement](https://github.com/seanmason/board-game-ai-dev/actions/runs/39004656866).

Each method ran 3,072 simulations over the same 12 positions per player count
within a single Node process, with alternating execution order and warmups.
Enhanced-to-original simulations/second ratios:

| Player count | Original sims/s | Enhanced sims/s | Relative |
|---|---:|---:|---:|
| 2 | 3,961 | 3,889 | 98% |
| 3 | 2,235 | 2,178 | 97% |
| 4 | 1,490 | 1,430 | 96% |

Search quality has improved dramatically at a nearly unchanged simulation rate.
Machine-specific absolute numbers are not representative of every browser.
