# Wingspan original-base card audit

> Retained development record. Wingspan is now integrated for development at the user's direction; earlier draft/branch-only instructions are historical. Read the [current overview](games/wingspan/README.md) for remaining validation and release limits.

**Status (2026-10-17): all original card identities and metadata cross-checked; all
power patterns exercised in qualifying situations; exhaustive rules certification
still pending.**

## Scope and method

- **170 original birds**, **26 original bonus cards**, **8 physically
  paired goal tiles (16 faces)**. The 10 Swift-Start tutorial birds and all
  later expansions are excluded.
- The separate original-card dataset in [Wingsearch](https://github.com/navarog/wingsearch)
  was consulted at pinned commit
  `43e5036de9e68fa9c4fabaf4c760412a887adf05`. All **170** cards
  matched on printed points, egg limit, nest type, habitats, six food-cost
  categories, slash/alternative food status, wingspan, and power timing:
  **0 discrepancies**. Both Wingsearch and Morgan-Griffiths have community
  data ancestry, so this is independently curated data comparison, not a
  wholly independent photographed-card transcription.
- An additional comparison of the **individual bonus-eligibility flags**
  found one difference: Wingsearch incorrectly flags **Tufted Titmouse**
  as qualifying for Anatomist. The base game's printed Anatomist word list
  excludes both "tuft" and "tit", so we explicitly retain its **nonqualifying**
  status. The pinned-source audit records this as an explained reference
  exception rather than silently changing base-game rules.
- All **164 bird cards with powers** have executed at least one non-skip
  effect in a tailored board position, preserving card/bonus/egg inventories.
  The six birds without a power have their absence verified.
- All **67 distinct power archetypes** executed successfully.
- All **164 powered cards' descriptions** cleared a normalized cross-source
  comparison between pinned Morgan-Griffiths and Wingsearch datasets. The six
  blank/no-power descriptions were intentionally excluded.
- All **26 original bonus cards' printed scoring schedules** were independently
  parsed and compared, with the documented original-rule exception for
  Backyard Birder's misprinted 6+ tier in one community source.
- The test harness exercised **316 different offered power-choice branches**
  and resolved resulting mandatory/nested power queues, including shared
  drafts, pink reactions, and forced discard selections.
- All **26 bonuses** have their own scoring tests: empty conditions, lower
  and higher thresholds, count-per-bird criteria, and score contribution.
- Original goal categories and green/blue tie scoring have targeted tests;
  actual real-board end-of-round scoring transcripts are not yet supplied.

Verification workflows:
- [170-card activation and bonus suite](https://github.com/seanmason/board-game-ai-dev/actions/workflows/wingspan-card-audit.yml)
- [Pinned independent metadata comparison](https://github.com/seanmason/board-game-ai-dev/actions/workflows/wingspan-independent-audit.yml)
- [Full development validation](https://github.com/seanmason/board-game-ai-dev/actions/workflows/ci.yml)

Primary rules reference: [official Wingspan rules and appendix](https://wingspan.rulepop.com/)
(choose the original-base rules rather than expansion-only rules).
Community card sources: [Wingsearch](https://github.com/navarog/wingsearch),
[2019 base-card catalog](https://boardgamegeek.com/filepage/176217/wingspan-bird-card-list-as-a-spreadsheet).

## Errors identified and corrected during this audit

1. A feeder-caching bird did not offer the printed keep-vs-cache choice.
2. Hummingbirds did not permit the owner to choose which player gains food first.
3. Egg-parasite pink powers were conditioned on eggs actually being laid rather
   than another player choosing the egg-laying action.
4. Some draw-and-discard powers demanded discards before other activated powers
   finished, rather than at the end of the turn.
5. Ravens were restricted to two food tokens of the same type; they may choose
   two different types.
6. All-player nest-egg powers permitted the owner's additional egg on the same
   bird, when it must be a **different** qualifying bird.
7. A redacted analysis observation exposed face-down tucked card identities;
   those identities are now hidden, with only their public count retained.
8. Chained bonus choices and shared card drafts could lose the identity of the
   original player; mandatory downstream decisions now cannot be skipped.

9. Chained white bird plays could enqueue the same pending pink reaction twice;
   the pending queue now prevents duplicate once-between-turns reactions.

These are genuine rules/privacy defects discovered by deeper tests, not
changes made merely to quiet warnings.

## Explicit remaining limitations

- **No independent complete-game rules oracle for all 170 power effects.**
  A transition invariant checks conservation and legality, but cannot detect a
  consistently misinterpreted printed power by itself.
- The 316 executed branches cover all options *offered in representative
  fixtures*, not the Cartesian product of every hand, dice configuration,
  birdfeeder state, player count, pink trigger and multi-card interaction.
- Physical games with hidden opponent hands, unusual delayed decisions or
  previously unrevealed cards still require human reconciliation.
- The browser's candidate-action generator intentionally presents
  representative moves; it does not enumerate every legal way to allocate
  food, eggs, extra bird effects, dice rerolls or optional follow-on choices.
  This limits the present analysis engine and digital interface.
- Search output is sampled **strategic utility**, not true win probability
  or a solved/optimal Wingspan strategy.
- Solo Automa, Swift-Start and all expansion content remain out of scope.
- This audit does not constitute approval to redistribute publisher card
  illustrations or copyrighted text. No official card art is bundled.

**Release gate:** keep [draft Wingspan PR #3](https://github.com/seanmason/board-game-ai-dev/pull/3)
unmerged until power-interaction transcript testing, human acceptance, and
IP/license review are complete. Keep Azul and Pentago separate and unchanged.

## 67 bird-power archetypes

| Code | Timing | Category | Cards using code | Test status |
|---:|---|---|---:|---|
| 1 | brown | caching food | 6 | Exercised |
| 2 | pink | egg-laying | 1 | Exercised |
| 3 | brown | card-drawing | 2 | Exercised |
| 4 | brown | flocking | 9 | Exercised |
| 5 | brown | food from supply | 3 | Exercised |
| 6 | white | food from supply | 1 | Exercised |
| 7 | brown | hunting/fishing | 6 | Exercised |
| 8 | white | card-drawing | 1 | Exercised |
| 9 | brown | flocking | 1 | Exercised |
| 10 | brown | hunting/fishing | 6 | Exercised |
| 11 | brown | food from birdfeeder | 2 | Exercised |
| 12 | white | egg-laying | 1 | Exercised |
| 13 | white | other | 15 | Exercised |
| 14 | brown | egg-laying | 4 | Exercised |
| 15 | white | food from birdfeeder | 1 | Exercised |
| 16 | brown | food from supply | 1 | Exercised |
| 17 | brown | hunting/fishing | 6 | Exercised |
| 18 | pink | egg-laying | 1 | Exercised |
| 19 | pink | food from supply | 1 | Exercised |
| 20 | brown | other | 8 | Exercised |
| 21 | brown | card-drawing | 3 | Exercised |
| 22 | pink | food from birdfeeder | 3 | Exercised |
| 23 | brown | flocking | 3 | Exercised |
| 24 | white | card-drawing | 2 | Exercised |
| 25 | brown | food from supply | 2 | Exercised |
| 26 | white | egg-laying | 1 | Exercised |
| 27 | brown | flocking | 6 | Exercised |
| 28 | pink | egg-laying | 3 | Exercised |
| 29 | white | food from supply | 1 | Exercised |
| 30 | brown | egg-laying | 3 | Exercised |
| 31 | brown | caching food | 5 | Exercised |
| 32 | brown | flocking | 1 | Exercised |
| 33 | brown | food from supply | 2 | Exercised |
| 34 | brown | card-drawing | 4 | Exercised |
| 35 | brown | flocking | 2 | Exercised |
| 36 | brown | flocking | 1 | Exercised |
| 37 | white | other | 4 | Exercised |
| 38 | white | other | 3 | Exercised |
| 39 | pink | food from supply | 1 | Exercised |
| 40 | brown | food from supply | 2 | Exercised |
| 41 | brown | card-drawing | 2 | Exercised |
| 42 | brown | hunting/fishing | 3 | Exercised |
| 43 | brown | other | 2 | Exercised |
| 44 | white | other | 2 | Exercised |
| 45 | brown | food from birdfeeder | 1 | Exercised |
| 46 | brown | hunting/fishing | 1 | Exercised |
| 47 | brown | food from supply | 1 | Exercised |
| 48 | brown | food from birdfeeder | 1 | Exercised |
| 49 | brown | other | 1 | Exercised |
| 50 | pink | flocking | 1 | Exercised |
| 51 | white | other | 1 | Exercised |
| 52 | white | egg-laying | 1 | Exercised |
| 53 | brown | food from birdfeeder | 2 | Exercised |
| 54 | brown | egg-laying | 1 | Exercised |
| 55 | pink | caching food | 1 | Exercised |
| 56 | brown | card-drawing | 1 | Exercised |
| 57 | brown | food from supply | 1 | Exercised |
| 58 | white | food from birdfeeder | 1 | Exercised |
| 59 | brown | card-drawing | 4 | Exercised |
| 60 | brown | food from supply | 1 | Exercised |
| 61 | brown | egg-laying | 1 | Exercised |
| 62 | brown | flocking | 1 | Exercised |
| 63 | brown | food from supply | 1 | Exercised |
| 64 | brown | food from birdfeeder | 1 | Exercised |
| 65 | white | egg-laying | 1 | Exercised |
| 66 | brown | food from supply | 1 | Exercised |
| 67 | brown | egg-laying | 1 | Exercised |

## Individual bird inventory

The audit test `test/wingspan-card-audit.test.js` constructs a qualifying
state separately for each row, tests all currently offered activation
branches through nested completion, and checks immutable state invariants.
“Exercised” is **not** a claim of every conceivable rules interaction.

| ID | Species | Printed timing | Effect code | Verified stage |
|---:|---|---|---:|---|
| 000 | Acorn Woodpecker | brown | 1 | Activation + nested branches exercised |
| 001 | American Avocet | pink | 2 | Activation + nested branches exercised |
| 002 | American Bittern | brown | 3 | Activation + nested branches exercised |
| 003 | American Coot | brown | 4 | Activation + nested branches exercised |
| 004 | American Crow | brown | 5 | Activation + nested branches exercised |
| 005 | American Goldfinch | white | 6 | Activation + nested branches exercised |
| 006 | American Kestrel | brown | 7 | Activation + nested branches exercised |
| 007 | American Oystercatcher | white | 8 | Activation + nested branches exercised |
| 008 | American Robin | brown | 4 | Activation + nested branches exercised |
| 009 | American White Pelican | brown | 9 | Activation + nested branches exercised |
| 010 | American Woodcock | none | — | No printed power |
| 011 | Anhinga | brown | 10 | Activation + nested branches exercised |
| 012 | Anna's Hummingbird | brown | 11 | Activation + nested branches exercised |
| 013 | Ash-Throated Flycatcher | white | 12 | Activation + nested branches exercised |
| 014 | Atlantic Puffin | white | 13 | Activation + nested branches exercised |
| 015 | Baird's Sparrow | brown | 14 | Activation + nested branches exercised |
| 016 | Bald Eagle | white | 15 | Activation + nested branches exercised |
| 017 | Baltimore Oriole | brown | 16 | Activation + nested branches exercised |
| 018 | Barn Owl | brown | 7 | Activation + nested branches exercised |
| 019 | Barn Swallow | brown | 4 | Activation + nested branches exercised |
| 020 | Barred Owl | brown | 17 | Activation + nested branches exercised |
| 021 | Barrow's Goldeneye | pink | 18 | Activation + nested branches exercised |
| 022 | Bell's Vireo | white | 13 | Activation + nested branches exercised |
| 023 | Belted Kingfisher | pink | 19 | Activation + nested branches exercised |
| 024 | Bewick's Wren | brown | 20 | Activation + nested branches exercised |
| 025 | Black Skimmer | brown | 10 | Activation + nested branches exercised |
| 026 | Black Tern | brown | 21 | Activation + nested branches exercised |
| 027 | Black Vulture | pink | 22 | Activation + nested branches exercised |
| 028 | Black-Bellied Whistling Duck | brown | 23 | Activation + nested branches exercised |
| 029 | Black-Billed Magpie | pink | 22 | Activation + nested branches exercised |
| 030 | Black-Crowned Night-Heron | brown | 5 | Activation + nested branches exercised |
| 031 | Black-Necked Stilt | white | 24 | Activation + nested branches exercised |
| 032 | Blue Grosbeak | brown | 20 | Activation + nested branches exercised |
| 033 | Blue Jay | brown | 1 | Activation + nested branches exercised |
| 034 | Blue-Gray Gnatcatcher | brown | 25 | Activation + nested branches exercised |
| 035 | Blue-Winged Warbler | none | — | No printed power |
| 036 | Bobolink | white | 26 | Activation + nested branches exercised |
| 037 | Brewer's Blackbird | brown | 27 | Activation + nested branches exercised |
| 038 | Bronzed Cowbird | pink | 28 | Activation + nested branches exercised |
| 039 | Brown Pelican | white | 29 | Activation + nested branches exercised |
| 040 | Brown-Headed Cowbird | pink | 28 | Activation + nested branches exercised |
| 041 | Burrowing Owl | brown | 7 | Activation + nested branches exercised |
| 042 | Bushtit | brown | 27 | Activation + nested branches exercised |
| 043 | California Condor | white | 13 | Activation + nested branches exercised |
| 044 | California Quail | brown | 30 | Activation + nested branches exercised |
| 045 | Canada Goose | brown | 23 | Activation + nested branches exercised |
| 046 | Carolina Chickadee | brown | 31 | Activation + nested branches exercised |
| 047 | Carolina Wren | white | 24 | Activation + nested branches exercised |
| 048 | Cassin's Finch | white | 13 | Activation + nested branches exercised |
| 049 | Cassin's Sparrow | brown | 14 | Activation + nested branches exercised |
| 050 | Cedar Waxwing | brown | 32 | Activation + nested branches exercised |
| 051 | Cerulean Warbler | white | 13 | Activation + nested branches exercised |
| 052 | Chestnut-Collared Longspur | white | 13 | Activation + nested branches exercised |
| 053 | Chihuahuan Raven | brown | 33 | Activation + nested branches exercised |
| 054 | Chimney Swift | brown | 20 | Activation + nested branches exercised |
| 055 | Chipping Sparrow | brown | 14 | Activation + nested branches exercised |
| 056 | Clark's Grebe | brown | 21 | Activation + nested branches exercised |
| 057 | Clark's Nutcracker | brown | 1 | Activation + nested branches exercised |
| 058 | Common Grackle | brown | 27 | Activation + nested branches exercised |
| 059 | Common Loon | brown | 3 | Activation + nested branches exercised |
| 060 | Common Merganser | brown | 10 | Activation + nested branches exercised |
| 061 | Common Nighthawk | brown | 20 | Activation + nested branches exercised |
| 062 | Common Raven | brown | 33 | Activation + nested branches exercised |
| 063 | Common Yellowthroat | brown | 34 | Activation + nested branches exercised |
| 064 | Cooper's Hawk | brown | 17 | Activation + nested branches exercised |
| 065 | Dark-Eyed Junco | brown | 35 | Activation + nested branches exercised |
| 066 | Dickcissel | brown | 27 | Activation + nested branches exercised |
| 067 | Double-Crested Cormorant | brown | 36 | Activation + nested branches exercised |
| 068 | Downy Woodpecker | white | 37 | Activation + nested branches exercised |
| 069 | Eastern Bluebird | white | 38 | Activation + nested branches exercised |
| 070 | Eastern Kingbird | pink | 39 | Activation + nested branches exercised |
| 071 | Eastern Phoebe | brown | 40 | Activation + nested branches exercised |
| 072 | Eastern Screech Owl | brown | 7 | Activation + nested branches exercised |
| 073 | Ferruginous Hawk | brown | 7 | Activation + nested branches exercised |
| 074 | Fish Crow | brown | 5 | Activation + nested branches exercised |
| 075 | Forster's Tern | brown | 21 | Activation + nested branches exercised |
| 076 | Franklin's Gull | brown | 41 | Activation + nested branches exercised |
| 077 | Golden Eagle | brown | 42 | Activation + nested branches exercised |
| 078 | Grasshopper Sparrow | brown | 14 | Activation + nested branches exercised |
| 079 | Gray Catbird | brown | 43 | Activation + nested branches exercised |
| 080 | Great Blue Heron | white | 44 | Activation + nested branches exercised |
| 081 | Great Crested Flycatcher | brown | 45 | Activation + nested branches exercised |
| 082 | Great Egret | white | 44 | Activation + nested branches exercised |
| 083 | Great Horned Owl | brown | 42 | Activation + nested branches exercised |
| 084 | Greater Prairie Chicken | white | 13 | Activation + nested branches exercised |
| 085 | Greater Roadrunner | brown | 46 | Activation + nested branches exercised |
| 086 | Green Heron | brown | 47 | Activation + nested branches exercised |
| 087 | Hermit Thrush | brown | 48 | Activation + nested branches exercised |
| 088 | Hooded Merganser | brown | 49 | Activation + nested branches exercised |
| 089 | Hooded Warbler | none | — | No printed power |
| 090 | Horned Lark | pink | 50 | Activation + nested branches exercised |
| 091 | House Finch | brown | 4 | Activation + nested branches exercised |
| 092 | House Wren | white | 51 | Activation + nested branches exercised |
| 093 | Inca Dove | white | 52 | Activation + nested branches exercised |
| 094 | Indigo Bunting | brown | 53 | Activation + nested branches exercised |
| 095 | Juniper Titmouse | brown | 31 | Activation + nested branches exercised |
| 096 | Killdeer | brown | 41 | Activation + nested branches exercised |
| 097 | King Rail | white | 13 | Activation + nested branches exercised |
| 098 | Lazuli Bunting | brown | 54 | Activation + nested branches exercised |
| 099 | Lincoln's Sparrow | brown | 20 | Activation + nested branches exercised |
| 100 | Loggerhead Shrike | pink | 55 | Activation + nested branches exercised |
| 101 | Mallard | brown | 56 | Activation + nested branches exercised |
| 102 | Mississippi Kite | brown | 7 | Activation + nested branches exercised |
| 103 | Mountain Bluebird | white | 38 | Activation + nested branches exercised |
| 104 | Mountain Chickadee | brown | 31 | Activation + nested branches exercised |
| 105 | Mourning Dove | brown | 30 | Activation + nested branches exercised |
| 106 | Northern Bobwhite | brown | 30 | Activation + nested branches exercised |
| 107 | Northern Cardinal | brown | 57 | Activation + nested branches exercised |
| 108 | Northern Flicker | white | 58 | Activation + nested branches exercised |
| 109 | Northern Harrier | brown | 17 | Activation + nested branches exercised |
| 110 | Northern Mockingbird | brown | 43 | Activation + nested branches exercised |
| 111 | Northern Shoveler | brown | 59 | Activation + nested branches exercised |
| 112 | Osprey | brown | 60 | Activation + nested branches exercised |
| 113 | Painted Bunting | white | 13 | Activation + nested branches exercised |
| 114 | Peregrine Falcon | brown | 42 | Activation + nested branches exercised |
| 115 | Pied-Billed Grebe | brown | 34 | Activation + nested branches exercised |
| 116 | Pileated Woodpecker | brown | 61 | Activation + nested branches exercised |
| 117 | Pine Siskin | brown | 35 | Activation + nested branches exercised |
| 118 | Prothonotary Warbler | none | — | No printed power |
| 119 | Purple Gallinule | brown | 59 | Activation + nested branches exercised |
| 120 | Purple Martin | brown | 4 | Activation + nested branches exercised |
| 121 | Pygmy Nuthatch | brown | 62 | Activation + nested branches exercised |
| 122 | Red Crossbill | brown | 63 | Activation + nested branches exercised |
| 123 | Red-Bellied Woodpecker | brown | 1 | Activation + nested branches exercised |
| 124 | Red-Breasted Nuthatch | brown | 31 | Activation + nested branches exercised |
| 125 | Red-Cockaded Woodpecker | white | 13 | Activation + nested branches exercised |
| 126 | Red-Eyed Vireo | white | 37 | Activation + nested branches exercised |
| 127 | Red-Headed Woodpecker | brown | 1 | Activation + nested branches exercised |
| 128 | Red-Shouldered Hawk | brown | 17 | Activation + nested branches exercised |
| 129 | Red-Tailed Hawk | brown | 17 | Activation + nested branches exercised |
| 130 | Red-Winged Blackbird | brown | 27 | Activation + nested branches exercised |
| 131 | Ring-Billed Gull | brown | 4 | Activation + nested branches exercised |
| 132 | Rose-Breasted Grosbeak | brown | 64 | Activation + nested branches exercised |
| 133 | Roseate Spoonbill | white | 13 | Activation + nested branches exercised |
| 134 | Ruby-Crowned Kinglet | white | 37 | Activation + nested branches exercised |
| 135 | Ruby-Throated Hummingbird | brown | 11 | Activation + nested branches exercised |
| 136 | Ruddy Duck | brown | 34 | Activation + nested branches exercised |
| 137 | Sandhill Crane | brown | 23 | Activation + nested branches exercised |
| 138 | Savannah Sparrow | white | 38 | Activation + nested branches exercised |
| 139 | Say's Phoebe | white | 65 | Activation + nested branches exercised |
| 140 | Scissor-Tailed Flycatcher | brown | 40 | Activation + nested branches exercised |
| 141 | Snowy Egret | brown | 10 | Activation + nested branches exercised |
| 142 | Song Sparrow | brown | 20 | Activation + nested branches exercised |
| 143 | Spotted Owl | white | 13 | Activation + nested branches exercised |
| 144 | Spotted Sandpiper | brown | 59 | Activation + nested branches exercised |
| 145 | Spotted Towhee | brown | 66 | Activation + nested branches exercised |
| 146 | Sprague's Pipit | white | 13 | Activation + nested branches exercised |
| 147 | Steller's Jay | brown | 1 | Activation + nested branches exercised |
| 148 | Swainson's Hawk | brown | 17 | Activation + nested branches exercised |
| 149 | Tree Swallow | brown | 4 | Activation + nested branches exercised |
| 150 | Trumpeter Swan | none | — | No printed power |
| 151 | Tufted Titmouse | white | 37 | Activation + nested branches exercised |
| 152 | Turkey Vulture | pink | 22 | Activation + nested branches exercised |
| 153 | Violet-Green Swallow | brown | 4 | Activation + nested branches exercised |
| 154 | Western Meadowlark | brown | 67 | Activation + nested branches exercised |
| 155 | Western Tanager | brown | 53 | Activation + nested branches exercised |
| 156 | White-Breasted Nuthatch | brown | 31 | Activation + nested branches exercised |
| 157 | White-Crowned Sparrow | brown | 20 | Activation + nested branches exercised |
| 158 | White-Faced Ibis | brown | 10 | Activation + nested branches exercised |
| 159 | Whooping Crane | white | 13 | Activation + nested branches exercised |
| 160 | Wild Turkey | none | — | No printed power |
| 161 | Willet | brown | 10 | Activation + nested branches exercised |
| 162 | Wilson's Snipe | brown | 59 | Activation + nested branches exercised |
| 163 | Wood Duck | brown | 34 | Activation + nested branches exercised |
| 164 | Wood Stork | white | 13 | Activation + nested branches exercised |
| 165 | Yellow-Bellied Sapsucker | brown | 25 | Activation + nested branches exercised |
| 166 | Yellow-Billed Cuckoo | pink | 28 | Activation + nested branches exercised |
| 167 | Yellow-Breasted Chat | brown | 20 | Activation + nested branches exercised |
| 168 | Yellow-Headed Blackbird | brown | 27 | Activation + nested branches exercised |
| 169 | Yellow-Rumped Warbler | brown | 4 | Activation + nested branches exercised |

## 26 bonus-card scoring checks

The following thresholds/points were verified against the original base-game
reference. One community spreadsheet historically misprints the high-tier
Backyard Birder threshold as 6+, but the original intended threshold is **7+**;
the implementation uses 7+.

| ID | Bonus card | Base-game scoring | Test |
|---:|---|---|---|
| 00 | Anatomist | 2+ (3 VP), 4+ (7 VP) | Passed |
| 01 | Backyard Birder | 5+ (3 VP), 7+ (6 VP) | Passed |
| 02 | Bird Counter | 2 VP per qualifying bird | Passed |
| 03 | Bird Feeder | 5+ (3 VP), 8+ (7 VP) | Passed |
| 04 | Breeding Manager | 1 VP per qualifying bird | Passed |
| 05 | Cartographer | 2+ (3 VP), 4+ (7 VP) | Passed |
| 06 | Ecologist | 2 VP per qualifying bird | Passed |
| 07 | Enclosure Builder | 4+ (4 VP), 6+ (7 VP) | Passed |
| 08 | Falconer | 2 VP per qualifying bird | Passed |
| 09 | Fishery Manager | 2+ (3 VP), 4+ (8 VP) | Passed |
| 10 | Food Web Expert | 2 VP per qualifying bird | Passed |
| 11 | Forester | 3+ (4 VP), 5+ (8 VP) | Passed |
| 12 | Historian | 2 VP per qualifying bird | Passed |
| 13 | Large Bird Specialist | 4+ (3 VP), 6+ (6 VP) | Passed |
| 14 | Nest Box Builder | 4+ (4 VP), 6+ (7 VP) | Passed |
| 15 | Omnivore Specialist | 2 VP per qualifying bird | Passed |
| 16 | Oologist | 7+ (3 VP), 9+ (6 VP) | Passed |
| 17 | Passerine Specialist | 4+ (3 VP), 6+ (6 VP) | Passed |
| 18 | Photographer | 4+ (3 VP), 6+ (7 VP) | Passed |
| 19 | Platform Builder | 4+ (4 VP), 6+ (7 VP) | Passed |
| 20 | Prairie Manager | 2+ (3 VP), 4+ (8 VP) | Passed |
| 21 | Rodentologist | 2 VP per qualifying bird | Passed |
| 22 | Visionary Leader | 5+ (4 VP), 8+ (7 VP) | Passed |
| 23 | Viticulturalist | 2+ (3 VP), 4+ (7 VP) | Passed |
| 24 | Wetland Scientist | 3+ (3 VP), 5+ (7 VP) | Passed |
| 25 | Wildlife Gardener | 4+ (4 VP), 6+ (7 VP) | Passed |
