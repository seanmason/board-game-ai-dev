# Sushi Go! — original game implementation handoff

Read [COMMON.md](COMMON.md) first; its exported interfaces, entry paths and integration ownership are authoritative. Planning only; researched 2026-10-18. Target Phil Walker-Harding's original 2013 game, standard 2–5 players, fixed original deck. Exclude Sushi Go Party!, Sushi Roll, Spin Some for Dim Sum, promos, the alternating-pass option and dummy-player variant from initial acceptance. The ordinary two-player game is included.

## Primary evidence, pages and popularity

- [Gamewright English rules](https://gamewright.com/pdfs/Rules/SushiGoTM-RULES.pdf): seven PDF pages; page 1 cover, p2 contents/setup/drafting/wasabi, p3 chopsticks/round end/maki, p4 sets/nigiri/new rounds, p5 pudding/endgame/variants, p6 variant continuation/credits, p7 summary. This PDF bears ©2014 Gamewright; it implements the original game, not Party. Treat 2013 as the game's BGG publication year, not the PDF copyright date.
- [Original author rules, ©2012 Phil Walker-Harding](https://www.goblins.net/files/downloads/Sushi%20Go.pdf): primary author text hosted by a third party; five pages with matching printed pagination. P1 catalog; p2 drafting/chopsticks; p3 scoring, including an explicit zero-maki restriction missing from Gamewright's English text; p4 endgame; p5 optional pass variant. Preserve author/provenance distinction when archiving this reference.
- [Official Gamewright FAQ](https://gamewright.com/faq/), unpaginated headings “Sushi Go: How exactly do the Chopsticks work?” and “Sushi Go: I got six dumplings in one round!”: confirms future-turn chopsticks, selecting both from one hand and returning chopsticks, and the 15-point dumpling ceiling.
- [Designer clarification, BGG thread 1014756](https://boardgamegeek.com/thread/1014756/chopsticks-with-wasabi-and-nigiri), Phil Walker-Harding / Phil81, 2013-07-31: the two chosen cards can be ordered, including wasabi immediately followed by nigiri. Search-index text was accessible; direct page fetch returned 403. Retain a verifiable copy/quote within ordinary quotation limits before making this a permanent regression citation. This is a designer statement, not an anonymous forum ruling.
- [Publisher product page](https://gamewright.com/product/Sushi-Go): stock #249, 108 cards, 2–5 players, approximately 15 minutes.

[BGG 133473 ratings](https://boardgamegeek.com/boardgame/133473/sushi-go/ratings?rated=1) search-index snapshot retrieved 2026-10-18: 53,253 ratings, mean 6.978, overall rank 664, weight 1.16. Direct BGG requests were intermittent and these are crawl-time figures, not promised real-time totals. Do not use Party's entry or popularity figures.

## Complete catalog and edition checks

The original deck has **12 distinct printed types**, not 11. “Maki” and “nigiri” are families with different printed members; there are eight broad families if those are collapsed. Do not let family names determine conservation counts. The author catalog p1 and Gamewright p2 agree:

| Stable type | Copies | Data fields beyond ID |
| --- | ---: | --- |
| Tempura | 14 | set family |
| Sashimi | 14 | set family |
| Dumpling | 14 | count family |
| Maki 1 | 6 | icons 1 |
| Maki 2 | 12 | icons 2 |
| Maki 3 | 8 | icons 3 |
| Egg nigiri | 5 | base value 1 |
| Salmon nigiri | 10 | base value 2 |
| Squid nigiri | 5 | base value 3 |
| Pudding | 10 | persistent dessert |
| Wasabi | 6 | binding slot |
| Chopsticks | 4 | reusable pick modifier |
| **Total** | **108** | unique copy IDs plus semantic type IDs |

No card artwork or copied publisher layout is required: use original simple icons, readable names and numeric badges. Catalog tests assert both per-type and total counts, immutable copy identity, semantic equivalence of duplicates, and absence of Party cards. Acquire and compare an actual original deck before claiming complete component fidelity; numeric rules evidence is already sufficient for a preliminary headless catalog.

## Compact rules contract

Gamewright p2: three rounds, hands of 10/9/8/7 at 2/3/4/5 players; simultaneous private picks, public reveal, pass left. P3: existing chopsticks permit two picks, return one chopsticks before passing, maximum one use per turn; final passed singleton is played. P4: discard round cards except pudding; deal fresh hands from the remaining deck, without a Party-style reshuffle.

Author p3–4 scoring: tempura pairs=5, sashimi triples=10; dumplings 1/3/6/10/15, capped; nigiri 1/2/3, tripled by one available wasabi; unused wasabi/chopsticks=0. Maki icons: first=6, second=3; split ties with truncation, first-place tie suppresses second, zero icons ineligible. Pudding: most +6, least −6, split/truncate; all equal=0; two players omit penalties. Final ties compare pudding count. Gamewright p5 confirms the pudding exception and tiebreak.

After score and pudding count are both tied, return shared winners with equal winner shares. This is the explicit application draw default for a tie not further broken by the inspected text; introduce no third statistic.

The designer clarification resolves ordered double-pick consequences: wasabi→nigiri may triple immediately; nigiri→wasabi cannot retroactively triple. With one empty wasabi and two different nigiri, choosing their order can change value. This must be represented as a legal choice, not resolved by card-ID sorting. The FAQ's “two cards at once” concerns selection, not loss of consequential resolution order.

## State machine and simultaneous actions

Stable module boundary: `sushi-go/{catalog,core,scoring,actions,observations,belief,ai,worker,app}.js`, `sushi-go/index.html` and `sushi-go/styles.css`, following COMMON. Additional internal analysis/physical-UI modules are optional. A game owner owns these modules and game-local tests. Parent integration owns shared shell/navigation/static-assets/packaging/index edits; coordinate their interface before parallel editing.

True state stores edition/catalog hashes, player count, round/pick number, undealt deck, round discards, each current hand with packet identity, face-up tableaux, persistent pudding, wasabi-to-nigiri bindings, round totals and unrevealed commitments. Use explicit `choose → allCommitted → revealResolve → returnChopsticks → pass → nextPick/scoreRound` phases. One seat's commitment never changes the state from which another seat chooses. Joint transitions apply all commitments against the same prior state; validation order and UI seat order cannot confer information or extra actions.

Canonical moves include every single available copy/type and each legal **ordered** two-card choice using an already available chopsticks, plus identity of the chopsticks being returned where meaningful. Equivalent copies can be canonicalized internally, but a human can identify the actual physical cards. Two fresh cards cannot use freshly drafted chopsticks. At one card remaining there is no two-card choice. Passing after a double selection plus chopsticks return must shrink every hand by exactly one, just like an ordinary pick. Revealed cards and returns remain conserved across tableau/hand/deck/discard. Preserve explicit wasabi bindings and pick order; recounting a tableau as unordered types would lose scoring history.

## Projection, memory and belief

Separate three records: full digital state, player observation/history, and sampled possible states. Actor observations expose own current hand, own committed pick, public revealed tableaux/pudding/round scores, packet sizes and remembered cards previously seen. Opponents' current commitments and hand contents do not enter the worker payload. The opponent's thinking cursor, selected card, analysis text and unfinished physical form are not public observations.

Hand circulation creates legitimate memory: a player can recognize a packet they previously saw and constrain its remaining contents using intervening public picks. Packet identity is an internal inference aid, not an extra peek. Double-pick returns insert a publicly known chopsticks into the circulating packet and must update constraints. Keep unknown removals, deck composition and unobserved packets consistent with conservation. Sample worlds from these constraints; do not re-randomize a known packet independently on every turn or condition on the true hidden choice. A test should construct two true worlds with identical observations and demand identical analysis inputs/action distributions for a fixed analysis seed.

Physical mode needs a private hand editor; public reveal entry for every player; and an atomic “everyone revealed” commit. During partial data entry, allow correction/cancel without exposing another player's reveal early. Record actual selected cards and chopsticks return, then ask for the received hand when physical information is available. Never fabricate missing cards to complete a packet. Human-confirmed notes and legal inferences survive reload with provenance; beliefs may be regenerated. Undoing a reveal must also undo bindings, scores, packet transformations and relevant analysis caches.

## Interface and affordable AI

Show own hand, public tableaux, pending private selection, ordered double-pick preview, empty/filled wasabi slots, pudding totals, round score breakdown and pass direction. All human legal choices remain available before AI prioritization. Analysis is advisory: explain marginal set completion, likely return of cards, maki contest and dessert pressure, with sample coverage rather than an invented calibrated win percentage. Privacy screen/handoff must hide previous seat's private hand and pending selection before a shared device changes seats.

Start with exact immediate scoring deltas plus transparent potential: set-completion probabilities under observed deck/packet constraints, limited wasabi slots, expected chopsticks opportunity, maki rank pressure, and pudding swing over remaining rounds. Sample opponent commitments simultaneously using distinct policies; do not choose a best reply after secretly observing their actual committed card. Extend rollouts through remaining picks and rounds at modest worker budgets. At small known residual packets, enumerate legal joint actions/ordered doubles exactly where tractable; chance and unknown cards still require belief averaging. Determinized perfect-information values must not be advertised as an exact imperfect-information solution. Score every terminal tableau exactly.

## Independent validation fixtures

Create a small separate score oracle and hand-computed fixtures, before evaluating AI strength. Examples: tempura counts 1/2/5→0/5/10; sashimi 2/3/7→0/10/20; dumplings 0/1/5/6→0/1/15/15. Nigiri salmon alone=2; wasabi→salmon=6; salmon→wasabi remains 2. Maki vectors [5,3,3,2]→[6,1,1,0], [4,4,2]→[3,3,0], [5,0]→[6,0], all zero→all zero. Pudding [4,3,0,0]→[6,0,−3,−3]; [1,1,1]→all zero; two-player [2,0]→[6,0]. Equal final scores and equal pudding→shared winners/equal shares; equal scores with different pudding→the higher-pudding player. Four-way most-pudding tie with a fifth lower player gives +1 each to the four, not rounded +2.

Test ordered double picks, one empty wasabi/two nigiri, two wasabi/two nigiri, fresh chopsticks ineligibility, returning a used chopsticks and drafting it again, last singleton, multiple simultaneous users, duplicate card identities, round cleanup, retained pudding and no reshuffle. Exhaust all small hands and compare canonical legal actions to an independently enumerated set. Randomized whole-game tests assert all 108 copies conserved and hands shrink in lockstep. Joint action submission permutations must yield identical revealed state. Incomplete commitments, cancel/undo and malformed physical entries must not partially mutate public state.

## Benchmark and handoff gates

Use fixed complete deck permutations and rotate seat assignments across policy lineups at each player count. Compare random-legal, greedy exact-marginal and sampled search under matched time budgets; retain diverse opponent styles rather than only self-play. Use seed groups as independent units, report score margin/rank and tie-adjusted wins separately for 2/3/4/5 players, confidence intervals, latency, invalid games and action coverage. Reserve fresh validation seeds and predeclare the candidate-selection rule. Initial smoke runs are correctness evidence, not a human-strength claim.

Acceptance requires catalog reconciliation, ordered chopsticks/wasabi fixtures, zero-maki and pudding edge cases, exact scoring, simultaneous privacy, consistent draft memory and actual tabletop correction flows. There is no remaining basic scoring blocker: the original-author zero-maki statement and direct designer ordering statement resolve the main English-booklet omissions. Archive their provenance before implementation review. Variants and release/publication remain separately authorized work.
