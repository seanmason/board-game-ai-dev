# Lost Cities implementation handoff

Read [COMMON.md](COMMON.md) first; its public interfaces, module names, shared worker/session contract and coordinator ownership are authoritative.

Planning only. Implement **Lost Cities: The Original Card Game**, five expeditions,
60cards, exactly two players; publisher item691820, English booklet revision
691820-02-121114, copyright2014Thames&Kosmos/1999,2012Franckh-Kosmos.
Do not substitute Lost Cities: The Board Game, Rivals, Roll&Write, or the
72-card sixth-expedition edition. A small board is only the discard-pile aid;
this is the original expedition **card game**. No game implementation, benchmark
or release is executed or authorized by this handoff itself.

## Popularity and primary sources

Accessed2026-10-18. [BGG50 ratings](https://boardgamegeek.com/boardgame/50/lost-cities/ratings)
returned7.261 average and51,632 ratings, approximately52K; its cached snapshot
was crawled the preceding week. This demonstrates substantial community uptake,
not current sales. Ownership count could not be verified: stats page403 and
both XML APIs401. Do not replace it with “rated owners” or an old third-party
69,000 figure. Popularity ownership remains an explicitly missing research field,
not a rules/implementation blocker. Other cached rating pages differ slightly;
keep one snapshot and refresh the same stats source before publishing comparisons.

Authoritative source chain:

- [Publisher manual directory](https://support.thamesandkosmos.com/hc/en-us/articles/360046967034-Product-Instruction-Manuals-Downloadable-PDFs), entry691820 “Card Game (5Expeditions)”. It separately lists691821(6thExpedition), protecting scope.
- [Publisher-linked English691820 PDF on GoogleDrive](https://drive.google.com/file/d/1rq4JVadvrAFGH3M3B4WwTVWOO-mBKNt7/view?usp=drive_link), downloadable via [official linked file export](https://drive.google.com/uc?export=download&id=1rq4JVadvrAFGH3M3B4WwTVWOO-mBKNt7). This is primary publisher distribution despite the hosting domain.
- Visually verified page map: PDF sheet 1 contains printed page 4 (scoring example, credits and edition code) plus the unnumbered front cover. PDF sheet 2 contains printed pages 2 and 3: components/setup/turn sequence on 2, placement/draw/end/scoring on 3. A later sheet rendered blank despite duplicated extractable text; do not use extraction order as pagination.

The indexed old `thamesandkosmos.com/manuals/full/691820_lostcities2p_manual.pdf`
now returns404 directly; the official directory's Drive replacement was downloaded
and read successfully. No separate official English FAQ resolving ties or repeated
discard cycling was located. Rule checks below use the primary booklet, not a
third-party “official rules” label or a different edition's tutorial.

## Compact rule contract

Components: board/five discard spaces; the five colors are yellow, blue, white, green and red. Each has numbers2..10 once
and three wagers:45numbered+15wagers=60. Deal eight each; deck44; oldest starts.
Alternate: play/discard one card, then draw deck-top or discard-top. Own expedition
numbers strictly increase; wagers precede all numbers. Discard only to matching
color; the just-discarded card cannot be redrawn. Last deck-card draw ends the
round immediately. Unstarted colors score0; started score
(number sum−20)×(wagers+1), then+20for at least eight cards including wagers.
Record three round totals; highest cumulative total wins. Higher scorer starts
the next round. Remaining deck may be counted near the end by agreement.
[Printed2–3: Preparation, Sequence, Placing/Drawing, End/Scoring; printed4 example.](https://drive.google.com/file/d/1rq4JVadvrAFGH3M3B4WwTVWOO-mBKNt7/view?usp=drive_link)

## Decisions, omissions and readiness gates

The60-card identity/count and score formula are verified, so no unverified
component distribution is needed. Keep three physically indistinguishable wagers
per color internally unique for conservation; their copy ids carry no public or
strategic meaning.

The booklet supplies no extra tie-break after equal three-round totals: display
an unresolved equality/co-leading score, do not claim a hidden tie-break. The
benchmark convention may score equal totals as0.5 each, clearly a utility
convention rather than a newly invented rule. For tied prior round scores, the
next-round starter is unspecified; physical mode asks the players which starter
they agreed. A digital-match policy must name that convention up front rather
than silently favor a seat. “Higher scorer starts” should use the just-scored
round as the proposed reading; the English text does not explicitly contrast it
with cumulative score. Record that interpretation and require a primary-language
or publisher clarification before labeling fully automatic three-round match
handling edition-exact. Single-round rules/scoring/companion analysis can proceed.

Do not force a deck draw or declare a draw merely because players repeatedly
recycle discard tops: the booklet gives no such turn limit. This can keep a round
alive indefinitely. A search safety cutoff yields a nonterminal leaf estimate;
a benchmark cutoff is a separately reported non-complete game, not a fabricated
win/loss/draw. A tournament draw/clock variant would require explicit mode/rules
policy. A wager-only expedition counts as started and incurs multiplied negative
cost. No final play follows drawing the deck's last card. The draw phase cannot
be skipped because the desired card is unavailable.

## Proposed modules and ownership

Own `lost-cities/` modules: `catalog.js`, `core.js`, `scoring.js`, `actions.js`,
`observations.js`, `belief.js`, `ai.js`, `worker.js`, `app.js`,
`styles.css`; entry `lost-cities/index.html`, game-local tests and overview/methods.
The integration coordinator owns shared registry, home navigation, static asset
allowlist/packaging and shared/session compatibility changes. No universal engine
rewrite or neural component is needed.

True state: exact edition id; physical/digital mode; round index; cumulative and
round scores; current seat; phase(place,draw,pending-observation,round-score,
choose-starter,gameover); own/opponent hands; ten ordered expedition columns;
five ordered discard stacks; deck; lastDiscardCard id/forbidden draw source for
this turn; public/private knowledge ledger; deterministic digital RNG.

`play{cardId}` appends only to that card's own color column after strict legality
check. `discard{cardId}` appends to its color stack. `draw{source:'deck'|color}`
is a separate legal decision phase; an atomic composite recommendation can pair
placement with source, but deck identity is a chance/observed outcome, never a
chosen card. `observeDeckDraw{cardId}` fills a physical actor draw only when
legitimately seen. A hidden opponent draw records count/location, not identity.
Round reset waits for explicit physical setup observations and agreed starter.

`assertValid`: all60 copies occupy exactly one location in digital truth; physical
unseen pools carry matching residual counts, not fabricated identities. Wager
multiplicity<=3/color, numbered uniqueness, valid color/phase/seat, strictly
increasing numeric suffix and wager prefix. Hand sizes8 at complete turns,7
between placement and draw; last-deck draw still produces an eight-card hand
before terminal scoring. Every discarded card remains in exactly one stack or
subsequent hand/column. Do not validate a mere total card count while allowing
same-number duplicate cards or a wager after a number.

## Complete actions and practical AI

Human legal action coverage is small enough to remain exhaustive: for each of
eight cards offer discard and legal play; each resulting draw phase offers deck
plus nonempty discard tops except the just-discarded card. At most8×2×6=96
composite roots before restrictions/duplicate-wager canonicalization. Do not
prune a poor-looking discard from the human recorder. With duplicate wager
copies, canonicalize equivalent type choices and report represented multiplicity.

Baseline heuristic scores exact started-expedition values, playable own hand
continuations, multiplier risk, the eight-card threshold, known opponent demand,
discard safety and deck-clock opportunity cost. Empty/unstarted colors have
zero cost; a hand card has no automatic terminal points. Use explicit expected
unseen-card access rather than summing all desired future cards as guaranteed.
Never evaluate a pending draw by consulting the actual hidden deck top.

Belief rollouts can initially cover all roots with100/300samples and horizon4/8
complete turns; only after measuring cost consider root allocation by successive
halving. An “iteration” is one sampled hidden state plus rollout, not a full game
or calibrated win probability. When deck count is small, exact minimax inside a
sampled world is a tactical experiment, not an omniscient perfect-information
solution for the real game. Discount unresolved hand opportunities and always
return exact public score difference at terminal. Report probability estimates
only as empirical simulated outcomes with uncertainty and limits.

Stalling is strategic: expose separate termination counts, leaf cutoffs and
repeated-history counts; do not make the rollout choose deck every turn solely
to terminate. A simple mixed discard/draw baseline is an appropriate benchmark
opponent alongside a score-greedy baseline; random legal play is a sanity test,
not strength certification.

## Physical entry and no-hidden-state boundary

Observation must be constructed independently of true state: actor hand, both
public expedition columns, current visible discard tops, any legitimately
remembered public discard/draw history, hand counts, known draw-count history,
round scores and whose turn/phase. Never send opponent hand identities, hidden
deck order or unseen buried discard identities to the worker. Prior public
history can legitimately identify a buried discard; a new midgame transcription
cannot acquire the same knowledge from the simulator's array.

Digital truth may know a whole discard stack, but a worker projection includes
only its visible top plus recorded memory. Opponent picks from public discard
enter the observer's known-card subset; later unknown deck draws add anonymous
slots. Sampling allocates remaining card copies without replacement subject to
these persistent known holdings, history and phase. Do not forget a tracked
public pickup simply because it is now held privately. Reroot opponent policies
at their own observation in each simulation; root-private cards may not guide
opponent decisions. Sample strategy is an approximation and must be labeled.

Deck count inferred from fully recorded draws is legitimate information; directly
counting an arbitrary physical deck follows the edition's agreement convention.
If no such agreement/history exists, permit unknown or bounded deck count and
ask for reconciliation only when needed. Unknown buried discard cards stay
unknown unless the players legitimately know them; inventory consistency may
be underdetermined, not invalid. Reject truly impossible negative residuals.

Setup screen pins “original5expeditions/60cards”, own hand and active seat;
physical midgame editor enters public columns, discard tops/known memory,
round totals and approximate/known deck count. Card selection shows “play” and
“discard” side by side; illegal play explains the exact bound/wager issue. After
placement, draw-source selector prevents immediate take-back and separately
asks for a newly seen deck card. A two-stage pending transaction must recover
atomically on reload. Analysis preview never advances recording; apply/confirm,
undo/redo and correction invalidate stale worker generations.

Use textual suit names/icons in addition to five colors, readable overlapping
cards, a visible numeric scoring explanation, and a round/match score table.
Show8+threshold progress and negative costs without misleading “current win%”.
Privacy/hot-seat hand cover works with keyboard/touch. Export identifies whether
it contains entered private information; a public share export strips it.

## Shared platform integration

Use [shared/session.js](../../../shared/session.js) `readSession` to validate every
v1 snapshot before replacing live state, including edition/mode consistency,
player count2, bounded history cursor and normalized seat array. Session format
is game-specific; unfinished draw observations and knowledge tags are part of
the serialized state. Snapshot validation is not a proof of historic legal play.

Use [shared/search-worker.js](../../../shared/search-worker.js) through the normal
create/run/summarize adapter, generation guards, bounded batches and progress
reports. Pause retains only in-memory search; reload need not preserve trees.
Projected actor observations, not session true state, cross the worker boundary.
One synchronous iteration may exceed a slice target, so measure and disclose
latency. Coordinator owns changes to shared contracts; see
[platform map](../../platform/README.md). Static self-contained packaging must
include game-local imports without importing another game's runtime.

## Hand-computed and semantic acceptance fixtures

- Empty expedition=0; wager alone=−40; two wagers alone=−60; numbers2,3,4=−11; one wager with2,3,4=−22. Hand identities have no effect on terminal score.
- Numbers2..9 sum44: eight cards, score44−20+20=44. One wager+numbers2..8 sum35: eight cards, score(35−20)×2+20=50. This catches multiplying the20-point bonus incorrectly.
- Two wagers+numbers4,5,6,7,8,10 sum40: eight cards, score(40−20)×3+20=80. Aggregate synthetic columns3,0,−40,−10,65 totals18, matching the published example arithmetic without relying on art.
- Play7 onto8 illegal; play9 onto8 legal. Wager after any number illegal; a second/third initial wager legal when available. A same-color discard can be strategically useless but remains legal.
- Discard red7 then draw red-top rejects taking that exact card; drawing a blue discard is permitted if nonempty. A different pre-existing buried red card is not top and cannot be selected.
- With deck1, place/discard then draw deck: end immediately; the drawn card remains in hand and cannot be played. Drawing a discard leaves deck1 and does not end.
- Public pickup of blue9 becomes persistent known opponent holding until observed played/discarded. Two observations differing only in hidden deck/opponent hand/unseen buried cards must serialize identically and produce identical seeded root analysis.
- Legal transcript conservation, deterministic replay, immutable scoring, apply/undo, invalid-import atomicity and interrupted draw recovery. Repeated discard recycling must not trigger a fabricated rules terminal.

Browser acceptance covers both move phases, score explanation, physical unknowns,
hand privacy, keyboard/touch, stale worker results, undo/edit/import and standalone
asset closure. Before a full match release, close or explicitly label tied-next-
starter interpretation; never hide it inside seed initialization.

## Benchmark and delivery gates

Planning stages: source/data fixture review; pure rules+all legal actions;
physical recorder/knowledge projection; tactical AI; belief AI; UI/browser and
packaging checks. Proposed commands once implemented: targeted lost-cities
node tests, relevant shared session/worker tests, syntax/docs/asset closure and
browser script. Report not-run gates rather than manufacture current pass counts.

Freeze edition, starter/tie policy, source hashes and seed manifest. Follow
COMMON: at most two AI challengers, 40 fresh paired setups (80 games) each at
300 samples and four complete-turn continuation versus the tactical baseline.
At most two with >=55% win share, positive mean margin and all valid may advance
to100 fresh paired setups each, using the one-sided97.5% paired lower win-share
bound above0.5 plus positive margin. Report exact root coverage, elapsed time,
nonterminal/cycle cutoffs and all incomplete games. Do not pool single-round and
three-round matches or compare a margin-only policy as if it were match utility.

Default digital policy is `strict-booklet`: end a three-round game with all equal
leaders co-leading, and enter `choose-starter` if the next starter is ambiguous.
This is an explicit decision phase, not a seed-dependent seat preference. A
physical operator records the agreed starter; a digital user may select either
seat through the same visible control. No unattended match benchmark may auto
choose under that profile. An optional `last-round-score/alternate-on-tie` profile
may be implemented for reproducible simulations, with 'alternate' meaning the
other player from the preceding round's starter; its noncanonical tie convention
must be named in UI, exports and evidence. It does not close the publisher gate.
Use official single-round benchmarks until automatic match rules are resolved;
never claim three-round strength from those results.

Within any small-deck exact-search branch, a repeated full state (including side,
phase and hands in the sampled world) returns `unresolved-cycle`/a bounded leaf,
not an exact win/draw. Only acyclic fully explored terminal continuation can be
labelled exact. Iteration/step caps are separately reported, non-complete games
in validation and never fabricated rules terminals. Retain the simpler baseline
if the held-out gate fails. No benchmark or implementation is claimed here.

Source audit: downloaded primary PDF SHA256 `f03ef1815e2ef878b69f6e9ae2ea3dc07be5f0bc05d7dea4d8c562cce753822f`; accessed2026-10-18. Source PDFs/art remain outside the repository; handoff links the publisher rather than redistributing protected assets.
