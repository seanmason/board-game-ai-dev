# Splendor base game

Development implementation for 2–4 players, no expansions. The primary workflow
is a physical table companion; digital play and research use the same pure engine.
No action is played automatically. This is not a publisher-endorsed product.

## Rule and data provenance

Rules follow the publisher's 2024 base-game text, including the explicit permission
to pay gold instead of a matching gem and the requirement to take fewer than three
different gems only when fewer colors are available:
https://cdn.svc.asmodee.net/production-spacecowboys/uploads/2025/10/SCSPL01EN_SPLENDOR_RULES_LIGHT.pdf

Cross-checked against the original rulebook:
https://cdn.svc.asmodee.net/production-unboxnowcom/uploads/2022/02/Splendor-EN.pdf

The 90 cards' level, bonus, points and five costs agree exactly across:
- bouk/splendimax, commit 5ffcb148ee0093e3b47f612b04a1927301ff13ee,
  `Splendor Cards.csv`.
- anicolao/splendor, commit 5b3efd26f2e460b1bef3839a058270b536a13648,
  `data/verified_card_properties.csv`, transcribed from photographed physical cards.
- seal256/splendor, commit 263abc066c563a1c89dba4bdc408446a20ad9d1d,
  `assets/cards.csv`.

The ten noble requirement vectors are checked against seal256's `NOBLES_STR`.
Nine also occur in bouk's incomplete nine-noble list. Nobles have generic numbered
labels; portraits and historical names are unnecessary for gameplay. The metadata
comparison does not claim that these community datasets have independent ancestry.

A fourth repository, boardgamers/splendor at 5c6ca1b7b994181aaaa81d0e893ee0c679057e0c,
claimed cross-verification but disagreed with the three sources above and was rejected.
No rules code, illustrations, original card art, or creative descriptions are copied.
Our catalog encodes only functional card facts with stable local IDs. IDs need not
match another site's card numbers; identify physical cards by all printed attributes.

The forced-pass exception follows the attributed Asmodee representative ruling:
https://boardgamegeek.com/thread/1192043/article/16190546
Its original page returned 403 during research; the attribution and wording were
available at https://boardgames.stackexchange.com/questions/57737/.
A pass is offered only when no action is possible, requires identified reservations,
and reveals them to prove no purchase is possible. There is no arbitrary turn-limit
winner; the verification harness reports any fully stalled positions separately.

## State and observation boundaries

Physical setup has twelve empty unidentified slots, not random placeholders.
The user enters the market and player-count-plus-one nobles. The bank is fixed by
player count. Face-up replacements pause the turn for actual card input. Blind
reservations can be identified or remain unknown; unknown reservations carry only
their tier. Later identification cannot duplicate a card already known elsewhere.

Bank tokens, player tokens, discounts and scores are public. Public reservations
retain their identities in the analysis projection. Other players' blind reservations
and all digital deck order are redacted before worker dispatch. Sampled worlds are
built from remaining identities and counts, never from actual hidden allocations.
Advice pauses if the active player has unidentified reserved cards. Manual play,
observation entry, undo and identification remain available.

Every core transition returns a new state. Return excess gems and select a noble
are explicit phases; single eligible nobles are mandatory and automatic. The final
round ends on the seat immediately before the chosen starting player. Ties compare
purchased-card count, then share victory. State validation checks inventories,
unique IDs, phase shape, deck levels, token totals and noble conservation.

## Interface and analysis

- Complete manual entry for taking/returning tokens, payments including gold,
  face-up/blind reservations, purchases and multiple eligible nobles.
- No autoplay. Candidate buttons explicitly record a move; hover highlights its card.
- Shared worker lifecycle: pause/resume preserves samples; generation checks reject
  stale results; bounded slices yield between individual simulations.
- Root UCB allocation across all immediate legal actions, including payments and
  return combinations, followed by hidden-world stochastic heuristic rollouts.
- The future policy and finite horizon are approximations. Displayed utility and
  sample standard errors are not win probabilities, calibrated confidence in move
  superiority, solved play, or human Elo. Search currently resets after every edit.
- Snapshot undo/redo, browser autosave, export/import, atomic session validation.
  Exports intentionally contain all entered private information.
- Responsive interface and dependency-free standalone package.

## Reproduction

```
npm test
npm run check
npm run audit:splendor
npm run verify:splendor
npm run benchmark:splendor -- --games=16 --ms=20
npm run stage:preview
npm run package:game -- splendor /tmp/splendor-site
python3 -m http.server 8080
# Open /splendor/ (or serve the standalone output directory).
```

Validation:
- Exact factual comparison of all 90 cards across three pinned sources and all
  ten nobles against the complete reference.
- 120 seeded 2/3/4-player games, 13,226 transitions compared with a separately
  written transition oracle; zero discrepancies and zero fully stalled games.
  Oracle and implementation share catalog facts, not rules helpers. This is useful
  differential testing, not an exhaustive proof of every reachable state.
- Targeted tests for token availability/returns, gold payments, free purchases,
  reservation limits, depleted decks, nobles, final-round rotation, ties,
  transactional observation input and seeded hidden-information invariance.
- Initial search pilots: 16/16 wins against greedy in two-player games; 10/12 wins
  against stochastic heuristic opponents in three-player games. Both used 20 ms
  per search decision, alternating seats and first players. Opponents do not search,
  so these are not matched-compute strength comparisons. Full per-game results are
  in `benchmarks/results/`.
- Hosted browser tests cover physical setup, actual/unknown draws, persistence,
  undo/redo, pause/resume, malformed import rejection, phone viewport overflow,
  and a self-contained package including its worker.

The follow-up [search evaluation](SPLENDOR_AI_EVALUATION.md) compares actual search
opponents at matched time, tests budget scaling and records uncertainty and
replayable game traces. It does not establish absolute human-level strength.

Before calling it a finished release: user acceptance on a real table, iPad Safari
performance/usability, independent-opponent strength validation, and final source/
release review. Development packaging does not publish to the finished-games repo.
