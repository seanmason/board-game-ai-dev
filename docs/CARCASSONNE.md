# Carcassonne core base game

> Retained development report: sections describe the work and evidence at their recorded stages. Start with the [current carcassonne overview](games/carcassonne/README.md) for present behavior and remaining gates. Historical counts and results were not rerun for the documentation migration.

Physical-table companion first, continuous analysis second, digital play secondary.
2–5 players, **all 72 base tiles including farmers**. The starting D tile is one
of the four D tiles. River and Abbot mini-expansions are explicitly excluded;
gardens and decorative buildings have no gameplay effect. No autoplay.

## Rules and catalog evidence

Functional facts are transcribed from the publisher's current English base rules
and farmers supplement. The 24 A–X tile types, counts, shields and topology were
visually cross-checked against the publisher's 2021 Big Box inventory, page 22.
No publisher illustrations, text passages, or implementation code are bundled.
The interface draws original abstract landscape diagrams.

Sources and SHA-256 byte pins are in `carcassonne/catalog.js`'s `SOURCE_MANIFEST`:

- Rules: https://www.hans-im-glueck.de/wp-content/uploads/2024/11/Carcassonne-v3_Rulesheet_EN_web.pdf
- Farmers, page 1: https://www.hans-im-glueck.de/wp-content/uploads/2024/11/Carcassonne-v3_Supplement_EN_web.pdf
- Complete inventory, page 22: https://www.hans-im-glueck.de/wp-content/uploads/2023/06/Carc-Big-Box_Rulebook_EN-komprimiert.pdf-komprimiert_1.pdf

Counts A–X are `2,4,1,4,5,2,1,3,2,3,3,3,2,3,2,3,1,3,2,1,8,9,4,1`.
The catalog records internal connected city and road segments, field boundary
half-ports and each field's adjacent local cities. Edge labels alone are insufficient:
F/G connect opposite city sides; H has two separate opposite cities; I has two
separate adjacent cities; junctions L/W/X terminate distinct roads; S/T contain
two fields separated by the road ending at the city. Road/city walls divide farms;
monasteries and decorative buildings do not. Each rotation transforms ports, while
feature IDs remain stable for session history.

`audit-carcassonne-catalog.mjs --fetch` downloads all three pinned evidence PDFs, checks
their hashes, extracts p22 using `pdftotext`, and checks every printed multiplicity.
Offline auditing checks all counts, boundary coverage and field-city references.
This is a manual topology transcription plus automated structural checks, not an
independently certified catalog. The original PDFs are not redistributed.

## Rules engine and observation boundaries

`core.js` is pure and serializable. Draw, placement, and optional meeple placement
are explicit phases. Physical draws require the actual observed tile. Tiles that
cannot legally fit anywhere are discarded, and the same player draws again.
A player can claim only an unoccupied connected feature on the newly placed tile,
including a newly completed feature, before scoring and returning meeples.
Roads and cities count distinct tiles; shields count per city segment; majority
ties each receive full points. Monasteries count all eight neighboring positions.
Farmers remain until final scoring and receive three points per **distinct completed
adjacent city**. Different farms can each score the same city. Unfinished city tiles
and shields each score one at game end; unfinished roads and monasteries score as
usual. Equal final scores share victory.

There is **no stored hidden deck** even in digital mode. Physical state contains
only remaining tile counts, observed discards, and the actual current drawn tile.
Digital draws use a seeded random generator over the remaining multiset. Worker
observations remove that generator state. Analysis samples hypothetical draws
from public counts and cannot inspect the actual future draw sequence.

`assertValid` checks inventory conservation, board connectivity and matching edges,
turn/phase accounting, seven playing meeples per seat, score types, finished-feature
cleanup and imported event metadata. Shared `readSession` validates the entire
history before replacing the live session. History validation checks snapshots,
not provenance or legality of every historical transition.

## Interface and analysis

The SVG landscape supports mouse/touch pan, wheel/pinch zoom, fit-to-board,
coordinates, orientation-aware placements, and explicit feature selection including
farmers. Draw identification offers all available types, diagrams and name filters.
Moves are recorded manually. Candidate hovering previews a placement and pins the displayed action while analysis
continues. Buttons carry their own action payload, so reranking cannot change a
recorded action between display and click; a separate
button records it. Scores explain feature type, tile/shield or city count and winners.
Undo/redo, timeline, local autosave and JSON import/export use shared session rules.

The worker uses the shared lifecycle: generation guards reject stale reports;
pause/resume retains accumulated samples. Root UCB progressively widens among
all legal combined placement/meeple alternatives, ordered by a field-aware static
prior. Rollouts sample remaining tile counts and use per-seat adversarial
positional policies with mild stochasticity. Values include score margin, city
completion prospects, monastery surroundings, farm majority, distinct adjacent
completed and incomplete cities, and limited meeple supply. The default horizon
is three future turns. It is a sampled lookahead policy, **not** a deep multiplayer
game-tree solution. Worker creation and a single iteration are synchronous inside
the worker, so pause may wait for an iteration; the main UI remains available.

Reported utility is relative projected points, not calibrated win probability.
Sample standard errors describe rollout sample variation only. They exclude model
bias and are not confidence in move superiority. Narrow progressive widening,
limited horizon, artificial opponent policy and uncertain future farm growth can
all cause poor recommendations. Search restarts after recording or editing a state.
There is no human-strength rating or expert-play claim.

## Verification and reproduction

```
node --test test/carcassonne.test.js
node scripts/audit-carcassonne-catalog.mjs
node scripts/audit-carcassonne-catalog.mjs --fetch
node scripts/verify-carcassonne.mjs
node scripts/benchmark-carcassonne.mjs --games=8 --iterations=4 --horizon=3 --seed=761993 --opponent=heuristic
node scripts/benchmark-carcassonne.mjs --games=8 --ms=250 --horizon=3 --opponent=search --opponent-horizon=1 --seed=981781
python3 -m http.server 8080
node scripts/browser-carcassonne.mjs
# Optional packaged worker test:
STANDALONE_URL=http://127.0.0.1:8080/standalone-carcassonne/ node scripts/browser-carcassonne.mjs
```

The tests include fixed publisher multiplicities, all rotational boundary coverage,
explicit special topology assertions, known city/road/monastery/farm scores, road
loops, tied full awards, field occupancy, impossible draws, immutable transitions,
redacted/deterministic observations, unsafe import rejection and optimized ranking
agreement with actual rules transitions. Four complete seeded 2/3/4/5-player games
check every graph and every scoring transition against a separately implemented
flood-fill oracle. It shares catalog facts, not graph or scoring helpers; this does
not independently prove the topology transcription.

The benchmark pairs seats and environment seeds; saves scores, winners, timing
and complete replayable draw/action traces; compares against a tuned positional
heuristic or another rollout horizon. Fixed-iteration experiments are reproducible;
wall-time experiments report actual overshoot and include root preparation. Tiny
synthetic samples cannot establish strength. Raw results are in `benchmarks/results/`.

Browser automation covers actual draw, rotation, placement, meeple scoring,
discard/redraw, no autoplay, pause/resume, undo/redo, persistence, atomic malformed
import, zoom and phone horizontal overflow. The script needs installed Playwright
and Chromium. Actual physical-table acceptance, iPad Safari, and independent
opponents remain release gates.

## Initial AI pilots (2026-10-17)

After a development-screen finding that four first-visit ties merely selected the
heuristic prior, widening was adjusted to revisit two initial alternatives sooner.
The original development diagnostic remains recorded separately. Fresh seeds were
then used for the following small pilots, with paired seats and two environment
seeds in each experiment:

| Search | Opponent | Games | Search wins | Mean score margin | Actual mean decision times |
|---|---|---:|---:|---:|---|
| 8 iterations, 3 future turns | Tuned static heuristic | 4 | 2 | −9 | 456.9 / 17.3 ms |
| Nominal 250 ms, 3 future turns | Nominal 250 ms, 1 future turn | 4 | 1 | −18 | 275.3 / 258.7 ms |

These results establish **no advantage over either opponent**. The second
comparison uses the same nominal budget, not strictly matched actual compute;
individual synchronous iterations overshot the target. Mean actual time was 6.4%
higher for the three-turn variant. Both sides overshot on all 142 decisions. In
that run, root creation had 38.2 ms p95 / 59.0 ms maximum, while individual
iterations had 34.8 ms p95 / 165.0 ms maximum across both horizons. A separate
61-tile, 59-candidate position took approximately 52 ms to prepare and 168 ms for
one three-turn iteration. These measurements do not bound worst-case pause latency.

Four games with paired seeds are much too few to select a superior policy or
estimate a useful confidence interval. The three-turn default remains experimental;
a larger independent budget-scaling and opponent study is needed. Raw files
`carcassonne-heuristic-holdout-2026-10-17.json` and
`carcassonne-nominal-budget-2026-10-17.json` contain all replayable traces.
