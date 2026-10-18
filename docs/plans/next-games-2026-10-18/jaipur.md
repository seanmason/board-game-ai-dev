# Jaipur implementation handoff

Read [COMMON.md](COMMON.md) first; its public interfaces, module names, shared worker/session contract and coordinator ownership are authoritative.

Planning only; no game code or release is authorized by this document. Scope is
Space Cowboys' Vincent Dutrait English base edition, copyright2019, using the
publisher's currently linked eight-page English booklet (uploaded2025/11).
Exclude promos, campaigns and unofficial variants. Two players, approximately
30minutes. This is a good small hidden-information companion: public market
choices and private hand management produce useful physical-table advice.

## Popularity and evidence ledger

Accessed2026-10-18. [BGG54043 statistics](https://boardgamegeek.com/boardgame/54043/jaipur/stats)
returned7.478 average,59,191 ratings,97,959 owners, overall rank202/family34;
the search snapshot was crawled five days earlier, not an instantaneous API poll.
Counts describe BGG engagement, not sales or objective quality. Other cached BGG
pages disagree slightly; use this single stats snapshot rather than mixing dates.

Primary sources:

- [Publisher product/download page](https://www.spacecowboys-games.com/game/jaipur/): edition, two-player scope, component totals, publisher English download.
- [Official English booklet](https://cdn.svc.asmodee.net/production-spacecowboys/uploads/2025/11/Rules-JAIPUR-12x17-Version-EN_BD.pdf): PDFpage2 components/setup;3 token arrangement/turn;4 taking;5 sales;6 termination/scoring/restart;7 restrictions/information. PDFpage numbers here count the cover as1.
- [Official publisher photo archive](https://cdn.svc.asmodee.net/production-spacecowboys/uploads/2025/11/BoardgameShot-credit-1.zip): inspected all four BoardgameShot images; these show selected components, not a complete reverse-side inventory. No permission to redistribute artwork is inferred.

No additional publisher FAQ resolving the issues below was located. The PDF was
read through text extraction and visually inspected on pages2/3. This matters:
much component data appears in images, not selectable text.

## Rule contract, tied to source sections

Publisher component list:55 cards: diamonds/gold/silver6each, cloth/spice8each,
leather10, camels11;38 goods tokens,18 bonus tokens, camel token5rupees,
three seals. [Product page; bookletPDF2.](https://www.spacecowboys-games.com/game/jaipur/)

Reserve three market camels; shuffle/deal five cards each; add two market cards;
hand camels form herds. Sort goods tokens descending; shuffle bonus groups.
Alternate one take/sale. Taking means one good, all camels, or equal exchange
of at least two goods for own goods/camels; taken/returned goods types cannot
overlap. End-hand limit7 excludes camels. Sales discard one goods type; precious
goods require two cards. Award available highest goods tokens and one bonus for
3/4/5+cards, even with insufficient goods tokens. Bonus ranges1–3/4–6/8–10.
End immediately at three depleted goods piles or failed market refill. Strict
herd majority earns5; equal herds earn neither. Compare rupees, bonus-token count,
then goods-token count. Loser starts next round; first two seals wins. Opponent
herd size need not be disclosed. [BookletPDF2–7.](https://cdn.svc.asmodee.net/production-spacecowboys/uploads/2025/11/Rules-JAIPUR-12x17-Version-EN_BD.pdf)

## Exact data draft and unresolved authority gates

The following complete vectors are pinned as an explicit **secondary-source data
draft**, not misrepresented as fully verified publisher transcription:

| Stack | Highest-first values / bonus multiset |
| --- | --- |
| diamonds | 7,7,5,5,5 |
| gold | 6,6,5,5,5 |
| silver | 5,5,5,5,5 |
| cloth | 5,3,3,2,2,1,1 |
| spice | 5,3,3,2,2,1,1 |
| leather | 4,3,2,1,1,1,1,1,1 |
| 3-card bonus | 1,1,2,2,2,3,3 (7tokens) |
| 4-card bonus | 4,4,5,5,6,6 (6tokens) |
| 5+-card bonus | 8,8,9,10,10 (5tokens) |

[Table Games Hub's explicit component table](https://tablegameshub.com/jaipur-goods-token-calculator/)
provides these vectors. Its status is secondary, not publisher authority.
[An independent2017 university AI project](https://info.bb-ai.net/student_projects/project_reports/Games/Jordan-OBrien-Jaipur-project-report.pdf)
figure3.3 independently records all goods vectors and bonus group counts7/6/5.
Do not infer all token-value multiplicities from the booklet's value ranges.
The primary booklet totals38/18 and bonus ranges agree; publisher photos do not
show all backs. Required pre-implementation deliverable: audit a complete matching
edition's punchboards/fronts/backs or obtain an authoritative component sheet,
attach provenance and hashes, and promote the draft data to verified status.
A second-hand seller inventory contains contradictory gold/red values; exclude
it rather than silently combine inventories. Digital/belief correctness is
blocked until the draft vectors are audited; table recording can accept explicit
physical token values meanwhile without claiming a faithful generated edition.

Other decisions:

- Complete equality after all three published round comparisons has no further rule in the inspected booklet. Do not invent a random winner or shared seal. Core returns `roundAdjudicationRequired`; physical UI records an explicit agreed result/policy. Fully automatic official-match simulation remains blocked on authoritative clarification; optional house policy must be named and separately benchmarked.
- An empty bonus stack is not a termination condition in the booklet and is reachable: eight3-card sales can use leather9+cloth6+spice6+diamonds3, exhausting only the leather goods stack under the draft inventory. The primary booklet gives no explicit empty-bonus award procedure. Provisional named digital policy `finite-supply-no-bonus`: the sale remains legal, awards remaining goods tokens and no unavailable bonus, never substitutes another class or ends the round. This is a disclosed implementation interpretation, not a publisher ruling; official-mode automatic simulation remains blocked pending authority. Physical mode records the actual table award. Add an eighth3-card-sale fixture before claiming complete coverage.
- The sales reminder says “each round” although the turn/sale procedure selects a type each turn. Implement one type per sale, not one type for the entire match round; preserve source wording and cite the turn definition.
- Bonus values become known when drawn (bookletPDF5). Treat a drawn own bonus as owner-known and private; physical mode asks only for that actor's legitimately inspected value, and may keep it unknown if not entered. Never reveal an opponent's drawn value merely because simulator truth holds it. Exact stack order remains hidden. This ownership projection follows the booklet's draw-knowledge wording, not the unsupported claim that all bonuses remain unknowable even to their owner until scoring.

## State and action design

Game-local directory `jaipur/`; entry `jaipur/index.html`. Own `catalog.js`, `core.js`,
`actions.js`, `scoring.js`, `observations.js`, `belief.js`, `ai.js`, `worker.js`, `app.js`, `styles.css` and game-specific tests/docs. The
coordinator owns directory/allowlist/session routing and shared changes.

True state: edition id/data-audit version; mode; phase(setup,turn,pending-refill,
round-score,adjudication,gameover); current player; round; seals; seven-class card
multisets by deck/market/discard/hand/herd; remaining goods-token ordered arrays;
bonus-token true shuffled arrays; earned tokens with visibility tags; pending
market vacancies; observed event log; RNG state only in digital simulation.
Use physical-copy ids only for conservation, never strategic identity among
identical goods. `assertValid` checks class totals55, token partitions, nonnegative
counts, no camel in hand, and hand<=7 only at completed turn boundaries.

Actions are explicit JSON, not UI state: `takeGood{marketSlot}`, `takeCamels`,
`exchange{takeCounts,giveGoods,giveCamels}`, `sell{good,count}`, and observation
completions/reveal/adjudication. A transaction validates all preconditions on a
copy, resolves effects/refill/termination once and commits atomically. A physical
refill may be pending with unresolved new market cards; sampling a suggestion
must never turn a sample into an entered card. Handle a refill needing three
cards with only two left as a terminal partial refill, preserving actual card
conservation rather than resurrecting a full five-card market.

`legalActions` must enumerate complete human possibilities. Canonical multiset
exchanges eliminate permutations but not legal choices: select market goods of
size2..5 and matching own payment multisets, forbid any goods-type intersection,
check net hand size, and never take camels with goods. Include every legal sale
count, including larger-than-remaining-token sales and sales into an empty goods
stack if otherwise legal under the resolved rules. No “sell all” shortcut may
replace partial-sale choices.

## Observations and physical workflows

Separate `digitalState`, `recordedPosition` and actor `Observation`. Worker payload
contains actor hand/known own facts, visible market, public sales/refill history,
known token counts/values, opponent hand size, and only legitimately known herd
facts. Herd cardinality may be an interval if not observed: face-up stack is not
permission to read a simulator's hidden exact count. Opponent bonus values, hand
identities, deck order and unseen bonus-stack order are absent. Known acquired
goods values may be reconstructed from observed token removals; don't forget
history just because token backs are now covered.

Physical setup accepts own hand, visible market, own herd, remaining token piles,
seals and active seat. Opponent facts can be unknown. Exchange editor shows take
and payment panels with live legality reasons/net hand count. Sale editor shows
available public goods-token value plus a **range** for unknown bonus. Commit is
explicit, then enter actual refill cards/bonus observations if legitimately seen.
Undo/redo covers transaction plus observations; correction preserves an audit
label and invalidates stale analyses. Round scoring reveals actual totals and
requires the operator to reconcile any hidden bonus inputs before awarding a
seal. Never auto-play an analysis recommendation on the physical recording.

Beliefs sample remaining card classes without replacement, conditioned on
conservation, hand/herd size intervals and all observed public transfers. Sample
bonus multisets using verified counts only; do not default unknown distributions
to exact truth. Starting an arbitrary midgame with unknown discarded counts may
need interval constraints or more observations, not negative residual cards.
Reroot simulations at each actor's observation; an opponent policy cannot select
moves using the root actor's private hand. Include private-data access traps and
same-observation/different-hidden-truth invariance tests before AI acceptance.

## AI and worker integration

First ship a deterministic legal tactical baseline: exact immediate token return,
hand space, opportunity cost of payments, herd flexibility and round-end pressure;
uncertain bonus uses a stated distribution. Then sampled belief rollouts:100/300
samples, initially depth4/8 **own main actions**, terminal score/seal utility with
separate estimates. No neural training. Preserve all human actions; search may
rank/prune to64 canonical exchange roots while retaining all takes/camel actions,
all legal sale quantities and several distinct payment families. Report total
legal roots, searched roots, unvisited roots and cap coverage. Evaluate full root
coverage where cheap; don't call the shortlist exhaustive.

Wrap game adapter in [shared/search-worker.js](../../../shared/search-worker.js)
(create/run/summarize, generation metadata, bounded batches, pause/resume).
Use [shared/session.js](../../../shared/session.js) to validate everyv1 history
snapshot before live replacement; pin format/edition/mode and cursor, normalize
seats and reject unsupported audit versions. Session validation does not prove
history transitions legal. Search state/RNG is separate from recorded history.
Exports can contain entered private facts; worker projections remain explicit.
Shared registry/asset packaging edits require coordinator review; module owner
must not silently broaden shared contracts. [Platform map](../../platform/README.md).

## Acceptance tests and benchmark plan

Required hand-computed fixtures (synthetic values explicit, not reachability claims):

- Sale four cloth from draft stack[5,3,3,2,2,1,1], explicit4-bonus value6: goods13+6=19; exactly four cards leave hand and four goods tokens disappear.
- Sell three gold with one5-token left and explicit3-bonus2: receive7total, not three goods tokens; still reject a one-card gold sale.
- Hand7, herd2, take two goods/pay two camels: reject net hand9. Pay one hand good+one camel: reject8; pay two distinct allowed hand goods: finish7.
- Take two marketcloth while returning cloth+camel: reject overlapping type; taking cloth+spice while returning gold+camel is a separate allowed template when holdings suffice.
- Equal herds produce no camel award; score50vs50, bonus counts3vs2 resolves first tie-break; equal bonus counts and goods counts remain explicit adjudication, not fabricated victory.
- Two depleted piles plus sale exhausting a third ends after that sale, without an opponent turn. Deck0 with market5 does not end merely from count0; the next action requiring unavailable refill does.

Data audit tests assert all per-class card counts and token vector totals;
property tests generate legal transcripts, verify exact conservation, clone purity,
apply/undo identity, deterministic replay and no illegal candidate. Differential
brute-force exchange enumeration on tiny multisets catches missing legal payments.
Physical-observation imports must reject impossible residuals atomically. Browser
checks cover touch/keyboard exchange editing, privacy, stale workers, reload,
undo/correct and self-contained packaging.

Benchmark only after authority/data blockers close for the selected rules profile.
Use the COMMON protocol unchanged: each of at most two AI challengers gets
40 fresh seat-swapped setups (80 matches) at 300 samples against the tactical
incumbent; report whole matches and round margins separately. Initially hold
depth at four own main actions rather than changing depth and policy together.
Select at most two with >=55% win share, positive mean round margin and all games
valid, then test each on 100 fresh pairs (200 matches). Use the one-sided97.5%
paired win-share lower bound above0.5, positive mean round margin and all valid
matches. This is the same approximate family-error gate as COMMON. Report
runtime, root coverage and non-complete games; do not silently drop a rare
unresolved adjudication. A provisional profile is separately named and cannot
establish faithful official-match strength. Keep the incumbent if inconclusive.
No implementation, tournament, UI or release has been executed by this handoff.

Source audit: downloaded primary PDF SHA256 `f831fa5f2764abfdae25cb28af9f52b435d7cbc383753a602731c17efa6cef2c`; accessed2026-10-18. Source PDFs/art remain outside the repository; handoff links the publisher rather than redistributing protected assets.
