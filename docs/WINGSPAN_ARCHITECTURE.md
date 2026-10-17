# Wingspan (original base game): rules, data, and architecture

Status: Research-verified implementation specification. **Not a claim of complete
card-power support.** The Wingspan implementation must remain draft until its
170 base birds' effects, 26 bonuses and full-game transitions are validated.

## Original board-game rules and sources

- Original Wingspan is a 1–5 player, four-round, resource-engine-building game.
- Primary core rules PDF:
  https://media.play-in.com/pdf/rules_games/wingspan_rules_en.pdf
- Bird powers, goals and bonus appendix:
  https://manuals.plus/m/907fd3f70d1f8cfa97caf0cba6232659f9086467d46fd1edf2865103635ed042
- Publisher rules and FAQ:
  https://stonemaiergames.com/games/wingspan/rules/
- Publisher base-game component list:
  https://store.stonemaiergames.com/products/wingspan
- Factual card-statistical data provenance:
  https://github.com/coolbutuseless/wingspan (MIT package),
  originally compiled by TawnyFrogmouth on BoardGameGeek.
  Structured power categories also cross-checked against
  https://github.com/Morgan-Griffiths/wingspan.
- No official illustrations, card flavor text, card layout, or rulebook prose
  will be redistributed. We use independently written labels and original UI.

## Exact content boundary

The **original 2019 base game** contains **170 unique bird cards**, **26 bonus
cards**, **8 double-sided round-goal tiles** (16 faces), 5 dice, 5 food
categories, 75 egg miniatures and 5 player mats.

Later editions include **ten extra Swift-Start bird cards** that are NOT among
the original 170. Without expansions, use the 170-card original deck by
default. The ten Swift-Start cards are not treated as separate regional
expansions, but they are still excluded from this strict original deck:

American Redstart; Black-chinned Hummingbird; Brant; Broad-winged Hawk;
Canvasback; Painted Whitestart; Red-breasted Merganser; Scaled Quail;
Vaux's Swift; White-throated Swift.

No European, Oceania, Asia, or later expansion mechanics or cards;
specifically **no nectar**, end-of-round teal powers, or upgraded habitat mats.
A current-base-plus-Swift-Start option may be added later as explicit opt-in.

## Setup (2–5 real players; 1-player Automa separately scoped)

- Shuffle bird deck, reveal three birds, roll five food dice into birdfeeder,
  select the competitive (green) or personal (blue) round-goal scoring board,
  choose four goal faces from four distinct physical double-sided tiles.
- Each player gets five unique bird cards, two bonus cards, and five food
  (one invertebrate, one seed, one fish, one fruit, one rodent).
- Each player keeps 0–5 bird cards and discards one initial food for EACH
  bird card kept. The initial hand and food totals together equal five.
  Choose exactly one of the two starting bonus cards.
- Choose a starting player, each player starts with eight action cubes.

There is public game state, current-player private hands/bonus cards and
hidden deck order. A physical-board companion cannot secretly infer hands or
deck order. A search must only sample plausible unknown cards.

## Turn sequencing

Four rounds, 8 / 7 / 6 / 5 turns per player. A player spends one available
action cube per turn, choosing:

1. **Play one bird** from their hand into an allowed habitat, leftmost empty
   slot (maximum 5 per forest, grassland, wetland).
   - Column egg costs: [0,1,1,2,2].
   - Pay card's exact food requirements (or one among listed food alternatives
     for slash choices); wild food can be any type.
   - During *this action only*, two of ANY food may substitute for one
     required food token. An explicit payment allocation avoids assumptions
     about which food players spend.
   - Only optional white 'when played' powers resolve; no brown activation.
2. **Gain food** using dice in the forest action row.
   - Resource progression for 0..5 forest birds: [1,1,2,2,3,3].
   - Each die removed yields one matching food; a dual die permits exactly
     one of its two choices. Refill all five dice if empty; if all remaining
     dice show one identical face, optionally reroll before taking food.
   - Some forest slots allow discarding up to one bird card for one extra die.
   - Then optionally activate brown forest powers in reverse bird order.
3. **Lay eggs** in grassland.
   - Egg progression [2,2,3,3,4,4]; respect each bird's separate capacity.
   - Some slots allow paying one food for one additional egg.
   - If no capacity remains, unused egg production is lost.
   - Then optionally activate brown grassland powers in reverse order.
4. **Draw bird cards** in wetland.
   - Draw progression [1,1,2,2,3,3] from face-up cards or hidden deck.
   - Some slots permit discarding one egg for one additional card.
   - Do not replenish the face-up tray until the end of this action/turn.
   - If the bird deck runs out, reshuffle the discard.
   - Then optionally activate brown wetland powers in reverse order.

Brown powers are always optional. Pink powers respond to other players'
specified events but can be triggered only once between their owner's turns.
White powers only trigger when that bird is played. Some powers force or offer
additional choices, transactions, movement, public effects, tucking or caching;
they must be modeled individually.

## Round and game end

- After all players exhaust their action cubes, score that round's goal,
  removing one action cube per player permanently for scoring. Discard and
  restock all three displayed birds; pass starting player clockwise.
- Competitive goal values by round (1st,2nd,3rd) are
  [4,1,0], [5,2,1], [6,3,2], [7,4,3] with zero for lower places.
  Ties average occupied and skipped positions with FLOOR rounding; players
  holding zero qualifying items cannot score.
- Personal goal mode gives min(5, number of qualifying items) points.
- Each bird's printed VP, bonus card criteria, goal scores, eggs on cards,
  cached food and tucked bird cards add to the final score.
- Highest score wins. Food tokens **unspent by players** break ties; further
  ties share victory.

## Architecture

Source subdirectory \`wingspan/\` must not import Azul/Pentago rules.
Structural components:
- \`data/birds.js\`: strict 170-card base-game factual metadata.
- \`data/bonuses.js\`: original 26 bonus identities and scoring definitions.
- \`rules.js\`: pure/serializable transitions, inventory, deck/dice randomness,
  explicit optional decisions and action validation.
- \`powers.js\`: type-safe effect handlers keyed by stable bird IDs and
  timing; non-supported powers MUST be reported as unsupported rather than
  silently ignored.
- \`analysis.js\`: imperfect-information Monte Carlo determinization and
  scored action candidates; never peek at hidden hands/decks.
- \`worker.js\`: pause/resume retained analysis, cancellation with generation
  tokens and incremental progress.
- \`app.js\`, \`index.html\`, \`styles.css\`: static HTML/JS/CSS, original
  visuals, physical companion, digital seats, history, import/export.

The original Azul and Pentago static previews remain intact at / and /pentago/.
New Wingspan preview, when qualified: /wingspan/.
No change to the separate public release repository.

## Test and publication gates

1. Exact 170 distinct original birds + 26 bonuses + 16 goal faces,
   validated card traits, unique IDs, no Swift-Start/expansion cards.
2. All setup exchanges and game phases, four full rounds and turn counts,
   food/dice market, egg capacity, card tray and 1:1 bird inventory.
3. Explicit tests for all card-specific powers, optional decisions, and
   pink reaction timing, including cross-player effects.
4. Independent differential test against a separate reference engine and
   human-scored complete-game transcripts.
5. Physical-board observation and corrections without revealing unknown
   cards; browser/iPad smoke for all action categories.
6. AI strength benchmarks versus distinct heuristic and random opponents,
   with repeated seeds and uncertainty estimates.
7. Public preview only once the claimed subset passes tests; do NOT label
   the preview "full standard Wingspan" while known card powers are missing.

Solo Automa from the original box is a separate 1-player subsystem, not a
second human player; do not claim solo support without implementing it.
