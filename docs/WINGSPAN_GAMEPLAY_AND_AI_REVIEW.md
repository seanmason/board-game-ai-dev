# Wingspan original-base gameplay and AI review

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
| Physical companion | Simulated placeholders for unobserved cards, dice and goals can still be mistaken for authoritative physical data | **Not release-ready** |
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
not a complete game-position editor and does not solve physical placeholder
reconciliation.

## Release blockers

- **Authoritative physical observation tracking:** separate known cards,
  dice, goals and private hands entered by users from randomly initialized
  placeholders. Do not infer real hands/deck order.
- **Full choice enumeration and interface:** the new collapsed, detailed
  human-turn editor now accepts explicit bird food payments (including
  two-for-one substitutes), egg-source allocation, sequential birdfeeder die
  indices, grassland egg targets, deck/tray draws and ordinary optional
  habitat conversions. The quick AI generator remains representative;
  chained second-bird effects and some multi-stage, rerolled feeder choices
  still do not have every desired UI path.
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
