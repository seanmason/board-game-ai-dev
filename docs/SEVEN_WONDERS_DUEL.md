# 7 Wonders Duel — base-game companion

Dependency-free browser prototype at `/seven-wonders-duel/`. Two players; no
expansions or promo components. Physical-table recording is the primary workflow.
Continuous analysis is advisory. Every move requires an explicit recording action.

## Physical setup and use

Select the five actual progress tokens, then enter the first four actual wonders.
Record the real draft in order 1–2–2–1, then enter the second four and record
2–1–1–2. The chosen first player begins Age I. Enter all face-up structure cards by
name; costs, effects and colors appear in the picker for identification. Unknown
face-down slots stay unknown. Newly accessible face-down cards pause the game for
actual observation before the next turn, including replay turns. Do not enter
cards returned to the box during setup.

Tap a card to inspect it, then explicitly record Build, Discard, or Build a Wonder.
Special effects request the actual destroyed/recovered card, progress token,
private Great Library offer, or next-age starter. Pinning an analysis candidate
never records a move. Undo, redo, timeline navigation, autosave and import/export
support corrections. Exports include all entered information and digital hidden
state; share them accordingly. Imported history is validated atomically.

Digital play draws seeded hidden structures, progress and wonder offers. It still
requires manual moves and effect choices; there is no autoplay.

## Rules and catalog provenance

The complete catalog contains **73 buildings/guilds (23/23/20 + 7), 12 wonders,
and 10 progress tokens**. Publisher rules:
https://cdn.svc.asmodee.net/production-rprod/storage/downloads/games/7wonders-duel/en/7du-rules-us-15990558193s5I6.pdf

Publisher FAQ: https://www.rprod.com/en/7-wonders-duel/faq

`seven-wonders-duel/provenance.json` pins source URLs, SHA-256 fingerprints,
field coverage, official page references and audit scope. The official illustrated
appendix on pages 18–19 was inspected for every building cost, effect and chain;
page 20 supplies all structure relations. Pages 14, 16 and 17 describe all progress,
guild and wonder effects. The FAQ explicitly makes the Library offer private and
clarifies Law as its own scientific symbol.

All building and wonder facts agree with retained normalized metadata from
`koenheltzel/bga-sevenwondersduel` at
`f023693fa764eedbfea5f858749a09253e6064f3`, `modules/php/Material.php`.
A second numerical comparison covers all 95 components, including all card
science symbols, production, shields and chains, against
`indjev99/7-Wonders-Duel-AI` at
`01ed7a5f1b695c410800023ac3d26097600ffc32`, `src/game/objects.cpp` and
`object_decks.cpp`. The current pinned sources have no observed disagreement.
These community datasets may share ancestry. Wonder costs other than the
rulebook's illustrated Colossus example rely on the two pinned reference datasets.
No commercial artwork, creative descriptions or external rules code is bundled.

Notable rules covered: permanent production with optimal flexible allocation;
trade prices use opposing brown/grey cards only; resource rebates remove any two
resource requirements; chains waive the entire cost; Economy receives resource
trade only; Strategy boosts future red buildings only; one replay per wonder;
seven-wonder limit; one-time military looting at three/six; immediate supremacy;
weakest military chooses the next starter, last active player at a neutral pawn;
last-card replays expire; combined brown/grey guild counts use a single city;
civilian ties compare blue-card points, then share victory.

## State, privacy and search

Pure serializable immutable transitions implement setup, drafting, observations,
turns, effects and results. The validator checks component identities/conservation,
structure chronology, hidden physical identities, canonical geometry, phase shape,
draft completion, numerical totals and import safety.

Workers receive `observation(state)` with **no actual secret deck or covered card
identities**. Physical states never allocate real hidden cards. Belief sampling
uses remaining catalog identities, three omitted age cards and three guilds. The
active player's current private Library offer is retained; the opponent's offer is
redacted. Same public state plus seed yields identical search regardless of actual
hidden allocations. Future sampling never reads the real digital deck.

Continuous search allocates root samples using UCB and searches adversarial
alpha-beta continuations in each sampled world. All immediate successor wins are
checked before beam pruning; effect choices extend the horizon without consuming
a drafting ply. Depth and branch limits are explicit approximations. The default
search extends two drafting plies after each candidate with seven branches per
internal node; leaf-adjacent and effect choices use all branches. Pause/resume
retains samples in the shared worker lifecycle. Every observed change starts a new
search. The UI rejects stale worker generations. Utilities and displayed sampling
standard errors are not calibrated win probabilities or confidence that a move is
best; hidden-world, beam and leaf-evaluation biases remain.

## Reproduction and evidence

```sh
node --test test/seven-wonders-duel.test.js
node scripts/audit-seven-wonders-duel.mjs
node scripts/verify-seven-wonders-duel.mjs
node scripts/benchmark-seven-wonders-duel.mjs --games=8 --iterations=24 --depth=2 --seed=712351 --output=benchmarks/results/seven-wonders-duel-search-v-tuned.json
# With a local server and Playwright available; standalone directory also served:
node scripts/browser-seven-wonders-duel.mjs
```

The audit also accepts `--bga=Material.php --cpp=objects.cpp --rules=rules.pdf`
to verify local reference bytes against pinned hashes. Retained factual fixtures
make ordinary validation independent of network availability.

Validation currently includes 108 targeted/subcomponent tests and 20 seeded full
games. An independently written arithmetic/transition oracle checks 120 further
seeded games, **8,561 transitions and 143,880 payment quotations**, with zero
discrepancies; 105 civilian, 13 military and 2 scientific endings. It shares factual
catalog data, not rules helpers. This is not exhaustive or external certification.
The browser script covers actual setup/draft/reveals, advisory pinning, continuous
worker privacy/pause/resume, explicit recording, undo/redo/reload, malformed and
malicious imports, phone overflow and standalone worker dependencies. Its hosted
execution result is recorded by integration CI; no local browser executable was
available during initial implementation.

Benchmark scripts pair setup seeds and alternate seats against a tuned one-step
heuristic with science denial, and retain replayable move traces, samples, nodes,
wall time, outcomes and approximate uncertainty. The heuristic uses much less
compute. Do not interpret a tiny pilot as expert play, human Elo, or matched-compute
superiority. Wider held-out and search-v-search evaluations remain release work.
Physical-table acceptance, Safari/iPad performance and final release/licensing
review remain development gates.
