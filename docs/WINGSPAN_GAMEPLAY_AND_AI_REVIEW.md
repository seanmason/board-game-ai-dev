# Wingspan original-base gameplay and AI review

> Retained development record. Wingspan is now integrated for development at the user's direction; earlier draft/branch-only instructions are historical. Read the [current overview](games/wingspan/README.md) for remaining validation and release limits.

**Status: experimental; draft PR #3 remains unmerged.** Reviewed October 17, 2026.
Authority: https://media.play-in.com/pdf/rules_games/wingspan_rules_en.pdf
and https://stonemaiergames.com/games/wingspan/rules/.

## Gameplay audit

| Area | Evidence | Assessment |
|---|---|---|
| Bird data | All 170 original birds independently compared against pinned second dataset: habitat, food, nest, eggs, wingspan, points, power timing | High-confidence catalog |
| Powers | All 164 powered birds and 67 effect patterns exercised, including 316 offered branches and nested queues | Representative tests only, NOT exhaustive |
| Bonuses | All 26 original bonus scoring definitions tested and cross-checked | High confidence in tested cases |
| Goals | Eight physical double-sided tiles, green and blue goal scoring and ties tested | Requires physical transcripts |
| Initial setup | 5 bird cards, 2 bonuses and 5 starting food; discard/keep procedure | Tested 2–5 players |
| Turns | Bird placement, exact food and egg payments, feeder, eggs, bird tray, habitat powers | Tested, but choice generation is representative rather than exhaustive |
| Pink powers | Once-between-turns and matching opponent events | More multiplayer timing traces needed |
| Round progression | 8/7/6/5 turns, starter rotation and goal scoring | Tested and round-end tray defect fixed |
| Inventory | Every transition checks conservation of 170 bird IDs, 26 bonus IDs and 75 eggs | Tested across seeded games |
| Privacy | Public projection hides opponents' hands, hidden decks, discarded bonus IDs and facedown tucked species | Shuffle-invariance tests passed |
| Physical companion | Explicit knowledge metadata; transactional input for cards, goals and dice; unknown cards redacted; save/reload and undo/redo tested | Implemented, tabletop acceptance still needed |
| Solo Automa | Not implemented | Missing from a complete base-box adaptation |

### Confirmed defect corrected

Previously, a bird-tray draw on the final turn of a round could cause an
immediate refill before round-end discarded the remaining three face-up
cards. That silently changed the bird deck. Now round-end discards the
actual remaining face-up birds **before** drawing the next tray. A targeted
regression asserts the exact number of cards moving into the discard pile
and leaving the deck.

### Further privacy correction

Discarded bonus objectives are not revealed public bird cards. The public
analysis projection now exposes their *number*, never their identities.
Inferred hands and deck orders use the remaining unseen cards, and every
sampled world must satisfy all inventory invariants.

## New imperfect-information AI

The original engine ranked one-step heuristics plus small sampled noise.

The new engine has two separately testable parts:

1. A belief sampler constructs a plausible complete world from only
   revealed data, the active player's known cards and the remaining
   unseen bird/bonus inventory. It never receives the real hidden deck.
2. A bounded game rollout applies real rules-engine transitions over a
   sample of future opponents' decisions, scoring relative strategic
   utility rather than claiming a calibrated win probability.

The active player retains a **Fast heuristic** method choice; hidden-world
rollouts are the default for continuous analysis following held-out tests.
The analysis can still be paused and resumed without losing its samples.

Reversing the *actual* hidden deck or opponents' bonus deck order gives the
same sampled analysis with the same RNG seed. Tests check this privacy
invariant and conservation of every possible sampled world.

### Held-out benchmark

Workflow: https://github.com/seanmason/board-game-ai-dev/actions/runs/39031823889

All configurations used 12 samples per AI decision, seed 907331 and
a 4-main-action simulated continuation.

| Opponent | Players | Games per method | Old win share | Rollout win share |
|---|---:|---:|---:|---:|
| Greedy | 2 | 24 | 83.3% | 95.8% |
| Stochastic | 2 | 24 | 95.8% | 100% |
| Greedy | 3 | 15 | 86.7% | 100% |

**Limitations:** Synthetic opponents are weak and samples are modest.
The new method is much slower per simulation. Equal simulated moves are
not equal CPU budgets. These data do not establish human strength, Elo,
optimal play or calibrated win percentages.

## Detailed human action input

The primary quick-action menu still offers representative suggestions.
A collapsed "Detailed action entry" section now accepts more precise human
moves for all four base action types. Each action is passed directly to the
authoritative core rules engine, which rejects invalid costs or allocations
without recording a move. Chromium tests exercise both a zero-egg habitat
action and a fully paid forest bird placement, with undo and card conservation.

This significantly improves legal move coverage in digital play, but it is
not a complete game-position editor. Physical observation reconciliation is now
implemented separately; see WINGSPAN_PHYSICAL_OBSERVATIONS.md.

## Release blockers

- **Physical acceptance:** observation tracking is implemented and browser-tested;
  validate its usability against real tabletop sessions.
- **Full choice enumeration and interface:** the new collapsed, detailed
  human-turn editor now accepts explicit bird food payments (including
  two-for-one substitutes), egg-source allocation, sequential birdfeeder die
  indices, grassland egg targets, deck/tray draws and ordinary optional
  habitat conversions. The quick AI generator remains representative;
  second-bird payments and egg sources now have detailed entry, and physical
  rerolls prompt for actual dice. Exhaustive enumeration for AI search is still absent.
- **Independent complete-game traces:** validate unusual white/brown/pink
  interactions against human-scored physical sessions and an independent
  implementation. The current card-by-card test covers representative
  activations, not all combinations.
- **Search quality:** test diverse and stronger opponents at matched time,
  improve opponent modeling and measure actual iPad Safari CPU use.
- **Solo Automa:** absent; competitive 2–5 players only.
- **Rights review:** the game uses original visual design and factual data,
  but verify all data provenance and intellectual-property obligations.

Keep Wingspan isolated in draft PR #3 and the finished-games repository
untouched until these blockers are addressed or explicitly descoped.

## Integration follow-up — October 17, 2026

PR #4 (platform foundations) and PR #5 (physical observations) are merged into
main and the Wingspan development branch respectively. Their integration adds
both observation modules to the static manifest, runs browser tests against the
staged assets, and adopts atomic shared-session validation in Wingspan.

Further regression-driven fixes:
- Chained white powers could queue an opponent's identical pink reaction twice
  before either was resolved. Pending pink reactions are now deduplicated.
- Second-bird powers now validate user-selected food payments and egg sources,
  including two-for-one food substitutions, instead of always spending defaults.
- Quick suggestions now offer rerolls for multiple identical feeder faces.

The second-bird and pink-chain scenarios are hand-constructed tests, not an
independent complete-game oracle or a recorded physical playthrough. The pinned
catalog comparison was rerun with zero unexplained differences.

AI benchmarks accept --time-ms and search-based opponents. Both players receive
the same per-decision wall-time target, with a minimum of one non-preemptible
sample, so expensive samples can overrun. Timing changes sample counts and makes
results hardware-dependent; fixed-sample mode remains available. See the saved
benchmark results for exploratory outcomes; these do not establish human strength.

Time-budgeted follow-up: 24 two-player games, seed 731043, four-action rollout
horizon, alternating AI seat and rotating starting player. Rollout search won
19/24 games (79.2%), with mean margin +12.88 points against heuristic search.
Both received 20 ms per decision, subject to the sample overrun noted above.
A preceding 12-game pilot at seed 731042 yielded 9 wins. No parameters were tuned
between those trials. The saved 24-game result is
`benchmarks/results/wingspan-time-budget-2026-10-17.json`.
This is evidence against the old internal baseline, not expert human validation.
