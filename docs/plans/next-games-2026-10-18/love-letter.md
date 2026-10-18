# Love Letter — classic sixteen-card implementation handoff

Planning only, researched 2026-10-18. Read [COMMON.md](COMMON.md) first; it owns interfaces, physical transactions, UI/search contracts, validation and coordinator integration. Implement AEG/Tempest English classic, copyright 2012, 2–4 players and sixteen cards. Exclude the 2019 twenty-one-card game, Spy, Chancellor, Premium extra roles, themed substitutions and 5–8-player rules. This is a full classic-game scope, not a modern-card subset.

## Popularity, sources and edition pin

The [BGG 2012 ratings entry](https://boardgamegeek.com/boardgame/129622/love-letter/ratings?comment=1) returned 72,430 ratings, average 7.226, overall rank 372, family rank 101 and weight 1.18/5. These are retrieved/indexed snapshots, which can drift independently. Keep item129622 distinct from 2019 item277085. No independently verified primary owner count was obtained; the approximate119k selection estimate is not a verified BGG API result here.

Primary: [AEG classic English rules](https://alderac.com/wp-content/uploads/2017/11/Love_Letter_Rules_Final.pdf), copyright2012. Printed pages: components7–8; setup9; turns/discards/elimination10–12; round/match victory13–14; Princess15–16; Countess16–17; King18; Prince19; Handmaid19–20; Baron20–21; Priest22; Guard22–23. PDF has24 pages including cover/story. Record file hash and page-linked fixture provenance when implementing.

The classic printing leaves completely equal rank-plus-total unresolved. The publisher-hosted [AEG Premium rulebook](https://alderac.com/wp-content/uploads/2017/11/Love-Letter-Premium_Rulebook.pdf), printed p6, supplies a compatible clarification within its sixteen-card 2–4-player section: fully tied players all win and each receives a token; the most recently dated among those winners starts next. Its 2–4-player victory table preserves 7/5/4. This section was verified through the official PDF's indexed full text after direct retrieval failed (web content-length limit/local403). Retain page evidence/hash when creating fixtures; do not import Premium extra roles or 5–8-player rules. The 2019 rules remove discarded-total tiebreak and are not this clarification's source.

## Rule map and boundary decisions

Rank/count catalog: Guard1×5, Priest2×2, Baron3×2, Handmaid4×2, Prince5×2, King6×1, Countess7×1, Princess8×1. Four reference cards are aids, not deck cards. Affection tokens track score rather than limit legal actions.

Classic setup removes one unseen card; two players additionally expose three unused cards, then everyone receives one secret card. Most recent date opens, younger on tie; use a seat control rather than collecting dates. Each turn draws and plays one of two cards, resolving effects before empty-deck checks. Discards stay public/ordered. Sole survivor wins; otherwise highest retained rank, then tied players' discarded totals. Winner earns one affection; match targets7/5/4 for2/3/4 players. Round winner starts next. Classic pp9–14.

Effect digest, classic pp15–23: Guard guesses another eligible hand except rank1; Priest privately sees another hand; Baron privately compares, lower eliminated/equality unchanged; Handmaid blocks others until own next turn; Prince discards an eligible hand, possibly self, and replaces from deck/reserve; King swaps eligible hands; Countess must be played with Prince/King; Princess discard eliminates holder.

Implementation decisions requiring explicit fixtures: eliminated players reveal/discard their hand without resolving it; Princess still eliminates on Prince discard and receives no replacement. Prince cannot target protected opponents and must target self if everyone else is protected. Guard/Priest/Baron/King cannot target self; with no eligible opponent, resolve without effect. Handmaid expires at own turn start before draw. Baron compares the retained card after playing Baron. Countess legality uses both pre-discard cards; voluntary Countess does not prove Prince/King possession. Cite card-specific pages above, not convenience conventions.

Keep `roundWinners` separate from next `starter`. Highest retained rank ties compare discarded totals; any still tied all receive one token. Enter a relative last-date/age tiebreak order at setup without collecting actual dates, then choose the highest-priority tied winner as next starter under the publisher clarification. Never choose lowest seat silently. If several classic players reach the affection target together, retain all qualifying match winners: each satisfies the 2–4-player victory condition. Do not import the extra-card 5–8-player tie-playoff procedure. Ordinary rounds consume cards, so no repetition draw is needed. A tied round is not a match draw. Never substitute modern two-player 6-token victory.

## Owned modules, state and complete actions

Own `love-letter/` with catalog/core/ai/worker/observations/belief/app modules and index/styles; own game tests/audit/verify/browser/benchmark scripts and eventual overview per COMMON. Coordinator owns shared/menu/package/assets/CI edits. Use original schematic rank/name/count cards, not redistributed publisher artwork or lengthy flavour text.

Versioned state: edition/profile/mode; seats and affection; round/starter/current player; phase (`setup`, `awaitDraw`, `choosePlay`, `resolve`, `roundEnd`, `gameover`); hands/unknown slots; alive/protection; ordered discards with play-versus-forced provenance; public exclusions; draw count/private reserve; pending effect/observation transaction; history/winner lists. Digital truth may hold deck IDs; physical state must retain constrained unknown slots instead of inventing unseen identities. Duplicate cards have internal IDs without unnecessary public copy labels.

Actions: draw (digital chance or physical observation), `{type:'play',cardRank,target?,guess?}`, effect observations, next-round setup and recorded corrections. Complete `legalActions` includes both cards, every eligible target and Guard guess2–8, even a statistically impossible guess. Equal-rank copies share a canonical action. Countess with5/6 leaves mandatory Countess only. No-target cards remain playable using an explicit targetless action. Do not prune the human editor with an AI shortlist.

Guard targeting cannot depend on whether the inaccessible hand actually matches; success is an effect. Physical public recording can accept a declared opponent play from an unknown hand by binding a compatible slot. Ask only for facts needed to resolve visible effects. Advice requires the actor's actual two cards; unrelated public recording never requires opponents' secret hands.

Validation: sixteen-card conservation across hands/deck/reserve/exclusions/discards; phase hand sizes (normally1, actor2 before play, eliminated0); protected/alive consistency; edition-specific affection thresholds and round outcomes. Validate imports before replacing the session; coherent snapshots do not prove historical reachability.

## Private information and observation lifecycle

Public: discards, affection, protection/alive, two-player exclusions, deck size, targets/guesses and outcomes. Private: own cards, Priest views, Baron compared hands and exchanged King hands. Deck order/reserve stay hidden until an authorized effect draws/exposes them. Device handoff conceals the preceding viewer.

Represent remembered knowledge as event-derived constraints with observer/event/holder-slot/rank/visibility/provenance. Avoid a single global `knownOpponentHand`. Update possible worlds through public draws/discards rather than blanket erasing or retaining knowledge:

- Priest reveals only to actor. A later draw does not erase knowledge of the old card. Playing a different rank implies the known card remains; playing its rank may remove it. Another same-rank copy remains possible when counts permit, but certainty must not persist without evidence.
- Baron participants see compared cards; outsiders see result and eliminated public card, not the surviving opponent's card. Equality is public equality evidence without its rank. A physical outsider may record comparison outcome/loser's card without entering both secret ranks.
- King participants know what they gave/received. An observer's known card follows the publicly announced transfer to its new holder. Do not retain stale claims about its old holder or leak both exchanged ranks to outsiders.
- Prince exposes old hand and invalidates retained-slot certainty; replacement is private to recipient. Reserve replacement does not publicly expose the reserve. Elimination discards are public. Reshuffle resets old round-private constraints.

Physical flow: enter own drawn card, select play/target/guess, preview and Confirm, then request only authorized effect evidence. Guard asks success/failure and eliminated public discard; Priest uses private actor prompt; Baron asks result/public loser and private ranks only for a participating viewer; Prince requests visible discard and recipient-authorized replacement; King updates own transferred facts without demanding outsider access. Pending transactions are atomic/cancellable/reload-resumable. Cancelling an unperformed preview must not leak its hypothetical data into advice. Once a real physical Priest/Baron look or other reveal has happened, record that observed knowledge with provenance; cancellation cannot make people unlearn it. Roll back a mistaken entry through an explicit correction, not by silently deleting an actual observation. Corrections recompute downstream constraints, not stale omniscient memory. Export may contain deliberately entered private knowledge: mark viewer and independently enforce worker projection. Hover/sample continuations never become recorded facts.

## AI and bounded evidence

Verbal bluffing is unnecessary for legal play. A voluntary Countess/target can convey strategy, but uniform-compatible inference is an explicit baseline, not a model of reading humans. Start with complete actions and deterministic heuristics: protection, guaranteed eliminations, legal Countess handling, showdown value and public-count Guard guesses.

Root information-set sampling or exact weighted enumeration fits the sixteen-card state. Condition allocations of hands/reserve/deck on actor cards, public removals, Guard failures, Baron comparisons and valid private memories/transfers. Duplicate-rank multiplicity weights matter; uniform rank labels are wrong. Never use digital true deck to seed/reject worlds. Opponent sample policies see only each opponent's own information, not root-private Priest facts. Aggregate root actions across worlds to avoid acting as if the player can distinguish hidden worlds.

Use exact chance/expectimax for tractable two-player endings. Multiplayer needs seat-specific utility/policy, not scalar negamax. Optimize/report sampled round win share or match win share distinctly, including affection totals. Round survival is not match-win probability. Begin128–512 worlds or150–300ms recommendation, extending worker batches. Enumerate all root targets/guesses; report samples, constraints, coverage, elapsed time and exact/estimated result. Follow COMMON experiments separately for2/3/4 players; do not pool outcomes or assume more samples implies stronger play.

Privacy gates precede tournaments: observations identical despite different hidden digital truth must yield identical seeded advice; throwing hidden getters; no root-private access by opponent policy; brute-force small-world endings; Priest/King information affects authorized advice only.

## Semantic fixtures and acceptance

Create independent source-linked fixtures, then full physical transcripts:

- Catalog16; unseen reserve always; public exclusions exactly3 only at2players; deal/deck counts, seeded setup, starter, new-round reset and persistent affection.
- Every target/guess2–8; reject guess1/self/protected/dead; successful/failed Guard; targetless effect; equal-copy canonicalization.
- Guard-failure rank exclusions attach to the retained slot at that event, survive only while supported, transfer correctly through a known King swap, and are invalidated/recomputed after Prince replacement, elimination or a later draw/discard that could change the retained card; never ban a rank forever.
- Priest privacy and persistence after different-rank discard; matching-rank uncertainty and duplicate multiplicities. Baron higher/lower/equal, retained-card comparison, public/private distinction, eliminated discard without recursive effect.
- Handmaid expire-before-draw; Prince self/other and forced self, normal/reserve replacement, Princess/no replacement, last-card effects before showdown. King transfer of cards and observer constraints. Countess mandatory with5/6 and voluntary otherwise. Voluntary Princess remains a legal losing play.
- Sole-survivor immediate ending; showdown rank/discard-total; fully equal round shared tokens; date/age-priority starter among tied winners; simultaneous qualifying match winners; seven/five/four match thresholds; no modern Spy bonuses.
- Every generated action applies; invalid action leaves input unchanged; all copies conserved; random legal matches terminate without fabricated identities/reveals; historical scoring reconciles.
- Physical2/3/4-player transcripts exercise private look, incorrect-rank correction, cancelled effect, undo/redo, reload pending, round transition, export/import privacy and stale worker rejection. Human editor includes bad legal guesses/Princess choices.

UI: readable ranks/counts without pretending hidden holdings are certain, touch targets, keyboard card/target/guess navigation, visible focus, private-view shield, ordered discards/forced provenance, round/match/protection status, hover explanation also available through tap/keyboard, and effect preview separate from confirmation. Browser-test desktop/tablet, portrait/landscape, analysis pause and history without live mutation.

Readiness: complete classic play and finite hidden inference are manageable; the publisher's classic-compatible tie clarification closes the original printing's gap. Retain indexed-source provenance and verify the actual PDF page when fixtures are authored. No implementation, tests, benchmark or release has been performed by this document.
