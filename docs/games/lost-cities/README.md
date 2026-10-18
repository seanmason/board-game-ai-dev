# Lost Cities — original five-expedition companion

Implements the original 60-card expedition card game for exactly two players,
publisher item 691820, English booklet revision `691820-02-121114`.
The 72-card sixth expedition, Board Game, Rivals and Roll & Write are excluded.
Integrated into the development suite; full cloud validation gates deployment.

## Edition and source evidence

The [publisher manual directory](https://support.thamesandkosmos.com/hc/en-us/articles/360046967034-Product-Instruction-Manuals-Downloadable-PDFs)
was freshly verified on 2026-10-18. It distinguishes 691820, five expeditions,
from 691821, six expeditions. Its 691820 link points to the
[English original-game booklet](https://drive.google.com/file/d/1rq4JVadvrAFGH3M3B4WwTVWOO-mBKNt7/view?usp=drive_link).
The Drive viewer resolved during implementation, but download/render attempts
were inaccessible to the web tool. No fresh PDF download, hash or visual-page
verification is claimed.

The retained [implementation plan](../../plans/next-games-2026-10-18/lost-cities.md)
records the prior direct download and visual source review, accessed 2026-10-18:
SHA256 `f03ef1815e2ef878b69f6e9ae2ea3dc07be5f0bc05d7dea4d8c562cce753822f`.
That hash is inherited planning evidence. Its page map places printed p4 plus
cover on PDF sheet1, printed pp2–3 on sheet2, and a later blank rendering despite
duplicated extractable text. Printed p2 covers components/setup/turns; p3 covers
placement/draw/round end/scoring; p4 contains the scoring example and edition code.
No separate official clarification was located for starter ties or discard cycles.
Source PDFs and art are not distributed in this repository.

The catalog audit independently transcribes five colors, numbers 2–10 once each,
and three wagers per color: 45 numbered cards plus 15 wagers. Internal wager
copy IDs preserve conservation; printed-equivalent wagers share canonical choices.
Original CSS and text/schematic symbols supply the UI without publisher art.

## Exact ordinary rules and explicit adjudication

Deal eight cards to each player and leave 44 in the draw pile. The oldest player
starts; the UI asks for that seat. Each turn first plays or discards one card,
then draws one replacement from the deck or a discard top. Numbers in an expedition
strictly increase; wagers precede every number. Discards go to their matching color.
The card just discarded cannot be immediately taken back, and buried cards are
not selectable. Drawing the deck's last card ends the round immediately, with
eight-card hands and no additional play.

Unstarted expeditions score zero. Started expeditions score
`(number sum − 20) × (wagers + 1) + bonus`, with a 20-point bonus for at least
eight cards, including wagers. The bonus is outside the multiplier. A wager alone
therefore scores −40. Held cards never score. Three rounds contribute to cumulative
totals; equal final totals remain co-leading. `outcome()` returns equal shares for
those co-leaders as an application utility convention, not a new booklet tiebreak.

Only `strict-booklet` is supported. After each nonfinal round the state enters
`choose-starter` and waits for an explicit agreed seat. Last-round higher score
is displayed as a proposed reading. The booklet does not clearly distinguish it
from cumulative higher score and gives no tied-round starter rule. The control
shows both score sets and records the operator's adjudication. Neither a seed nor
a silent seat preference chooses the next round. Automatic edition-exact match
starter handling is not claimed; unattended benchmarks stop after one round.

Discard cycling is legal and can continue indefinitely. The rules engine never
forces a deck draw or manufactures a terminal draw from repeated states or a
turn cap. Search cutoffs are nonterminal evaluations; benchmark caps are reported
as non-complete games.

## Physical recording, correction and privacy

Physical mode is the default. Hands and unlocated cards use null slots, not
invented identities. A public declaration editor can record an actual played card
while private hands remain shielded. It shows every printed type, independent
of the active player's recorded private hand. Only the active viewer's revealed
private panel supplies a hand-specific menu; a non-active digital viewer never
receives the actor's choices. Buttons offer Play and Discard side by side and
explain ascending/wager restrictions.

Placement and draw are distinct confirmed actions. A physical draw creates an
atomic pending observation that survives reload. It can be cancelled before the
actual draw is performed. Confirming records the actual observed card, or a hidden
opponent draw as an anonymous slot. If a discard pickup exposes an unknown buried
card, the operator enters the actual new top or reports an empty pile. Unknown
draw-pile counts require the actual last-card result. No software cancellation
after confirmation pretends a person has unlearned a real card.

The midgame editor records both public expedition sets, public discard tops,
known or anonymous represented buried slots, unknown extra pile depth, round,
seat, move phase, forbidden take-back pile, prior round totals and agreed/unknown/
bounded deck counts. Prior manual totals carry operator provenance rather than
invented per-expedition breakdowns. Empty piles must have known empty depth.
Unlocated inventory can cover unknown buried cards and draw-pile cards; it is
not silently assigned to a fabricated exact deck. Impossible negative residuals
and incompatible card multiplicities are rejected.

The midgame editor validates a separate review preview before the final Confirm;
preview/cancel does not replace the live record. Private hand and remembered-public-pickup corrections are explicit history
events. Only legitimately witnessed pickups should be entered as a known holding
subset. Public pickups remain constrained until the corresponding card type is
played or discarded; a hidden deck draw does not erase them. Public discard
history becomes remembered stack information. Midgame transcription does not
give other viewers access to entered buried memory. Corrections clear affected
derived constraints instead of retaining stale certainty.

Private panels are concealed on reload, handoff, history navigation and import.
Private exports contain entered hands and digital hidden state and are labelled
accordingly. The separate public snapshot export omits hands, hidden deck,
pending private outcomes and remembered buried cards. It is a sharing document,
not a restorable session. Every private-session snapshot is validated before an
import replaces live state. Snapshot validation establishes coherent positions,
not historical reachability.

## Advice, evidence and limits

The worker receives actor hand, public expeditions/tops/count history, scores and
that viewer's permitted memory. It does not read opponent hands, actual hidden
deck, RNG state or actual buried stacks. Hostile-getter tests exercise each of
those boundaries. Paired hidden worlds with the same observation produce identical
seeded advice.

Sampling allocates remaining copies without replacement, honoring remembered
opponent holdings and buried-stack constraints. Unknown pile depths and deck
bounds are compatible-world assumptions, not observed facts. Opponent policies
use their own sampled observation; they do not inherit root-private buried memory.
If no compatible allocation is found, advice asks for reconciliation rather than
inventing a world. Human recording remains available without advice.

Practical ordering is the default and runs no background samples: exact current expedition values, discounted
own-hand opportunities, wager/bonus risk, opponent public demand, discard safety
and the deck clock. Hand opportunities are discounted and have no terminal value.
The optional sampled comparison covers all legal actions in the current phase,
with no root pruning, using four complete-turn continuations. The browser caps at
300 action samples, launched only after explicitly selecting sampled comparison.
Switching back to practical pauses an existing sampler and preserves its samples.
Pause/resume retains
the worker search; stale generations are ignored after moves/corrections.

Only terminal leaves use exact public round score difference. Earlier leaves are
heuristic expected-score-margin estimates. Terminal samples, horizon cutoffs and
cycle cutoffs are separate counters. A repeated sampled state is a bounded leaf,
never an exact win or draw. No general exact minimax or calibrated win-probability
claim is made. A synchronous iteration may exceed a nominal worker time slice.

Bounded correctness smoke used seed79, both candidate seats, at least 16 action
samples (full root coverage first) and a four-turn horizon against mixed and greedy
policies. All four single rounds completed with zero illegal/capped games. Latest
results after fixing optimistic discard-pickup valuation:

| Opponent | Completed / capped | Round win share | Mean margin | Terminal / horizon / cycle leaves |
| --- | --- | ---: | ---: | --- |
| Mixed | 2 / 0 | 0.50 | +7 | 157 / 2,595 / 0 |
| Greedy | 2 / 0 | 0.00 | −52 | 141 / 2,035 / 0 |

An earlier same-seed implementation smoke before that valuation fix yielded
mixed 1.00/+14 and greedy 0.00/−44, with no caps. These reused-seed implementation
checks are not independent held-out strength evidence. No promotion gate was run.
The weaker sampled result is retained and the simpler practical ordering remains
the default. No three-round strength result is inferred from single rounds.

## Verification and integration

Executed in this checkout:

```
node --test --test-concurrency=4 test/lost-cities.test.js
node scripts/audit-lost-cities.mjs
node scripts/verify-lost-cities.mjs
node scripts/benchmark-lost-cities.mjs
node scripts/check-syntax.mjs
node scripts/check-docs.mjs
```

The 21 tests cover the complete catalog, independently computed subset scoring,
placement/draw legality, duplicate wagers, persistent pickups, hidden getter and
paired-world privacy, atomic pending recovery, explicit corrections, last-card
endings, tied match utility, legal discard cycles, unknown midgame piles and
20 random complete rounds with every legal branch validated.

Recording parity covers 12 single rounds, all completed, 1,696 recorded draws,
plus two complete three-round physical transcripts. Each draw is serialized and
reloaded while pending. Opponent deck-draw identities remain unknown. Full-match
transcripts explicitly agree next starters `[1,0]` and record separate result fields:

| Seed | Round totals (P1/P2) | Cumulative | Final-round higher seat | Cumulative leader |
| --- | --- | --- | --- | --- |
| 41 | −30/−23; −34/−53; −51/−22 | −115/−98 | P2 | P2 |
| 97 | 20/−9; −20/−24; −58/−34 | −58/−67 | P2 | P1 |

These two matches used 453 and 350 recorded draws. They validate manual match
recording and round/cumulative separation, not an automatic starter interpretation
or comparative AI strength. Parity uses two production pathways; the score/rule
fixtures provide separate semantic expectations.

Coordinator staged-browser acceptance passed on 2026-10-18 using installed Chrome:

```
node scripts/browser-lost-cities.mjs
```

Use `BASE_URL` for a suite root with an optional Pages project prefix,
`PLAYWRIGHT_CHANNEL=chrome` for installed Chrome, and optional `STANDALONE_URL`.
The script covers physical phases/pending reload/cancel, hand privacy and public
export, actual worker pause/preview, explicit starter agreement, last-card match
end, import/history and touch layouts. Images write
`test-artifacts/lost-cities-{desktop,tablet,phone,landscape,last}.png`.
The tablet screenshot was visually reviewed. This is automated Chrome viewport
coverage, not real iPad Safari acceptance.

Suite navigation, static/standalone packaging, npm scripts and CI are integrated.
All 21 game tests and three packaging regressions passed locally after integration.

Remaining evidence: fresh original PDF download/page/hash verification, independent
physical-table and real iPad Safari acceptance, and a
publisher clarification before claiming automatic edition-exact match starters.
