# Sushi Go! — original fixed-deck companion

Implements the original 108-card game for 2–5 players, using the Gamewright
English booklet, copyright 2014, and original author rules, copyright 2012.
The game's publication year is 2013. Sushi Go Party!, Sushi Roll, promos,
dummy players and alternating passing are excluded. Integrated into the development suite; full cloud validation gates deployment.

## Source evidence

Retrieved on 2026-10-18:

- [Gamewright English rules](https://gamewright.com/pdfs/Rules/SushiGoTM-RULES.pdf):
  seven pages; p2 catalog/setup/drafting/wasabi, p3 chopsticks/maki,
  p4 sets/nigiri/new rounds, p5 pudding/endgame, p7 summary.
- [Original author rules](https://goblins.net/files/downloads/Sushi%20Go.pdf),
  ©2012 Phil Walker-Harding, primary author text hosted by Goblins.net:
  p1 component counts; p2 simultaneous picks, left passing and chopsticks;
  p3 explicitly requires a positive maki holding to score; p4 pudding,
  two-player exception and final tiebreak. The `www` hostname returned 403;
  the linked hostname returned the complete five-page publisher-authored PDF.
- [Gamewright FAQ](https://gamewright.com/faq/), headings “Sushi Go: How exactly
  do the Chopsticks work?” and “Sushi Go: I got six dumplings in one round!”:
  old Chopsticks are used on a later turn, both cards come from the same packet,
  return occurs before passing, and dumplings cap at 15.
- [Designer double-pick clarification](https://boardgamegeek.com/thread/1014756/chopsticks-with-wasabi-and-nigiri),
  Phil Walker-Harding / Phil81, 2013-07-31, freshly retrieved indexed thread text:
  “you can choose the order you play the two cards”. This specifically permits
  wasabi followed immediately by nigiri. It is the designer's attributed
  statement, rather than an anonymous forum convention.

The catalog records URLs, attribution and the short quotation. PDF text was
retrieved; binary hashes and direct local PDF page captures are not claimed.
The separate audit transcription checks all twelve printed types and 108 copies.
No publisher illustrations, fonts or layouts are distributed; the UI uses original
CSS, schematic symbols and plain card names.

## Rules, observations and privacy

Three rounds use fresh hands of 10 / 9 / 8 / 7 at 2 / 3 / 4 / 5 players.
Passing is always left. The remaining draw pile is not reshuffled. Pudding is
retained between rounds. Every single card and every legal ordered double is
available. A double returns one previously drafted Chopsticks; freshly selected
Chopsticks cannot enable that same pick. Available old copies can be identified
in the complete editor. Equal-type hand copies share a canonical semantic choice.

The received singleton has one forced action in digital play; physical users
can enter its actual type when it was unknown. It is included in the explicit
joint reveal, preserving the same ordered wasabi/scoring transition as other picks.
Wasabi binds the next nigiri, never an earlier one. Maki and pudding ties split
and truncate; zero maki scores nothing. A maki lead tie suppresses second place.
Two-player pudding has no negative award, and all-equal pudding counts score zero.
Equal final scores compare pudding count, then share victory.

The default physical setup leaves unseen deck and hands as null slots. Each viewer
may enter their actual received hand, or record an actual pick without entering
opponents' hands. Unknown cards never receive invented types. Observed types bind
internal equivalent copy IDs solely for conservation. An explicit correction
invalidates derived memory for the affected packet and is recorded in history.

Commitments remain private. They do not alter hands or public plates. All players
choose against the same prior position. The joint reveal validates every choice,
then atomically resolves ordered cards, returns Chopsticks, updates memory, passes
packets and scores a finished round. Incomplete/invalid entries cannot partially
change the public position. Unperformed selections can be cancelled. Once an actual
reveal is confirmed, correcting history is an explicit record correction; it is
not a way to make people unlearn the real cards.

Packet memory is per viewer and retains exact multisets of packets that viewer
actually saw. Public picks remove types and returned Chopsticks add a type.
Packet identity follows the leftward pass, so known packets stay constrained
when they return. The private viewer is concealed on handoff, reload, history
navigation and import. Pending choices survive reload; earlier viewers' choices
are not displayed on the public board or in history labels.

Exports intentionally include entered private hands/choices and the digital
hidden deck. They are labelled private sessions, not redacted sharing files.
Every imported snapshot is validated before replacing the live history.
Validation establishes coherent snapshots, conservation and score reconciliation,
not complete historical reachability.

## Analysis and its limits

Worker input contains only own hand/commitment, public cards/scores, packet sizes
and that viewer's packet memory. It excludes true deck order, RNG state, other
hands and other commitments. Tests use hostile hidden getters and paired hidden
worlds to enforce identical observations and seeded advice.

The deterministic policy uses exact immediate scoring changes, short set
completion potential, limited empty wasabi slots, maki pressure and dessert
pressure. Sampled search compares every complete root action without pruning;
all root choices receive samples before repeats. Unseen packets are sampled
without replacement from remaining copies. Known packet multisets stay fixed.
Opponents choose simultaneously using their own sampled hand and a mixture of
random and scoring policies; they never inspect actual commitments or inherit
the root viewer's other private packet memory. Future simulated receptions build
their own authorized memory.

Continuations finish the current round, scoring every terminal plate exactly.
Evaluation is accumulated score margin versus the average opponent, plus 40%
of the current pudding swing before round three. It does not simulate all future
rounds, optimize calibrated match win probability or model human choice likelihoods.
This current-round continuation is a deliberate bounded implementation scope.
When all singleton packets are known, their reveal and round scoring are exact;
an earlier-round dessert estimate remains heuristic. No general imperfect-information
exact-solver claim is made. The UI recommends 64 samples and offers 256 through Analysis effort. Every
complete legal root receives a sample, so a large Chopsticks menu can raise the
effective limit above 64. Changing effort restarts advice without altering picks,
commitments or history, and a manually paused analysis stays paused. The setting
lasts for the open page; reloading restores the recommendation. Pause/resume
retains the current search until its budget is complete; a single synchronous
iteration can overrun a time slice. Explicit digital AI-seat preparation still
uses the deterministic policy; the sampled advice settings do not change it.

Historical bounded implementation smoke (runner at `7869a4f`): seed13, every candidate seat, at least 24 action
samples (one per root choice when coverage needs more), versus random and the
deterministic policy. The 28 one-round assignments completed in approximately
25 seconds with no illegal or capped games. Results are kept separate:

| Players | Opponent | Round win share | Mean round score margin |
| --- | --- | ---: | ---: |
| 2 | Random | 1.000 (2 rounds) | +7.50 |
| 2 | Greedy | 1.000 (2 rounds) | +10.50 |
| 3 | Random | 0.667 (3 rounds) | +4.17 |
| 3 | Greedy | 1.000 (3 rounds) | +5.67 |
| 4 | Random | 0.125 (4 rounds) | −0.83 |
| 4 | Greedy | 0.875 (4 rounds) | +9.17 |
| 5 | Random | 0.600 (5 rounds) | +4.70 |
| 5 | Greedy | 0.600 (5 rounds) | +3.90 |

These small correctness checks are not a strength study, promotion or confidence
claim. Round standings exclude future rounds and final pudding scoring. Those implementation checks predate the complete-match studies below; unfavorable
four-player random results are retained.

The current [benchmark adapter](BENCHMARK_ADAPTER.md) runs all three rounds and
final pudding by default, with an independent comparator. Its outcomes are
separate from the historical round-only smoke above.

The [fresh compute screen](https://github.com/seanmason/board-game-ai-dev/blob/benchmarks/ai-comparison-2026-10-18/good-enough/REPORT.md)
compared 64 with 256 samples at four players over 40 matched setups, all seats.
Winner share rose from 83.1% to 90.6% against the independent simple heuristic:
paired +7.5 points (95% interval −1.0 to +16.0), failing the declared positive
scaling criterion. Score margin versus the average opponent improved by 2.52
points (1.45 to 3.59), a secondary result. All 320 matches completed without
illegal actions or errors. Mean decisions rose from 650 to 1,673 ms under this
execution schedule. The winning-strength gain remains uncertain, while the low
budget already performs well against this comparator. More sampling still uses
the same current-round model. The browser now favors 64 samples for practical
response time and leaves 256 selectable. Only four players were measured in this
scaling screen; the same lower-cost default at other counts is an explicit
practical choice, not a demonstrated scaling result.

## Verification and integration

Executed in the isolated checkout:

```
node --test --test-concurrency=4 test/sushi-go.test.js
node scripts/audit-sushi-go.mjs
node scripts/verify-sushi-go.mjs
node scripts/benchmark-sushi-go.mjs
node scripts/check-syntax.mjs
node scripts/check-docs.mjs
```

The 19 tests include an independent short-menu score oracle, independently
enumerated ordered choices, wasabi/chopsticks order fixtures, maki/pudding
boundaries, simultaneous privacy, packet memory, correction/import atomicity,
known singleton scoring, and 48 seeded complete matches. Physical transcripts
run six full matches at each player count, with 180 / 162 / 144 / 126 joint
reveals and 12 round transitions each. Only one viewer enters actual received
hands; opponents can stay unknown. Every partial commitment is serialized and
validated before joint reveal. Transcript parity compares production recording
and digital transitions; it is not an independent complete rules oracle.

Coordinator browser acceptance passed on 2026-10-18 using installed headless Chrome, including desktop and simulated touch layouts:

```
node scripts/browser-sushi-go.mjs
```

`BASE_URL` accepts a suite root with an optional Pages project prefix.
`PLAYWRIGHT_CHANNEL=chrome` uses installed Chrome; default uses Playwright Chromium.
Optional `STANDALONE_URL` checks a packaged game. Images write to
`test-artifacts/sushi-go-{desktop,tablet,phone,landscape,last}.png`.
Checks cover private pending reload/cancel, handoff, immutable preview, joint
reveal, atomic import, real worker pause/resume, explicit AI preparation,
game end/export/history and touch layouts. Screenshot review also confirmed readable private controls after correcting inherited text color. This is not a real iPad Safari test.

Suite navigation, static and standalone packaging, npm scripts and CI checks are
integrated. Local game and static-asset integration tests passed all 21 cases.

Remaining evidence: real iPad Safari acceptance, direct physical
deck/table acceptance, PDF binary/page archival if required for permanent source
records, and strength against stronger or human opponents beyond the named benchmark comparators.


The practical advice-budget update passed all 909 repository tests, 319-module
syntax checks and 72-document link checks locally. A legal 81-choice Chopsticks
fixture verifies full coverage through the actual worker lifecycle. The expanded
browser check covers effort choices, paused restarts, unchanged recorded picks,
real standalone worker execution, desktop and simulated touch layouts. No new
strength tournament was run.
