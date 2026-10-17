# Cascadia base-game companion

`/cascadia/` implements standard base Cascadia for 2–4 players and the official
20-turn solo mode. Physical observation is the primary workflow. Every starter,
opening offer and replacement comes from the actual table. Digital play is a
secondary workflow and never plays an AI move automatically. No Landmarks,
promos, family/intermediate scoring, scenarios or achievements are included.

## Rules and component facts

Rules: publisher 2025 base rulebook:
https://www.alderac.com/wp-content/uploads/2025/04/Cascadia_BaseGame_Rulebook_Optimized.pdf

The high-resolution publisher 2021 rulebook was also downloaded and rendered to
read every number and formation on all 20 A–D wildlife cards (page 11):
https://www.alderac.com/wp-content/uploads/2021/08/Cascadia-Rules.pdf
The 2025 PDF is image-only and its small scoring tables are heavily compressed.
No original illustrations, card descriptions or game artwork are bundled.

Tile facts were transcribed from these university CSV reference files:
https://sopra.cs.tu-dortmund.de/wiki/_media/sopra/26b/projekt2/tiles.csv
https://sopra.cs.tu-dortmund.de/wiki/_media/sopra/26b/projekt2/start_tiles.csv
There are 85 regular tiles, 25 keystones, and 15 constituent hexes in five
starters. Their associated assignment changes the game rules and supports only
A/B cards. Its gameplay assumptions were not used. In particular, physical
players do **not** know which habitat tiles were excluded during setup.

The five complete starters' habitat sides, wildlife and relative arrangement
were independently checked against the German components photograph at:
https://media.cdn.kaufland.de/product-images/1024x1024/13df45d32835e2a127d4777a55b0b19d.jpg
The rulebook's starter example agrees with its matching starter. CSV sides begin
at the upper-right edge, clockwise; the engine converts to its right-edge-first
axial convention. Starters are rigid three-hex pieces, not independently rotatable
hexes. The UI uses an arbitrary whole-board orientation, which preserves scoring.

Independent physical-count corroboration:
https://www.reddit.com/r/boardgames/comments/1b8qk3n/some_stats_about_cascadia/
Every species occurs on 32 regular tiles; every habitat on 29; each habitat has
five keystones and six tiles for each two-habitat combination. These aggregates
agree with the catalog. **A complete independent, legible physical scan of all 85
individual regular tile faces has not yet been located.** Aggregate agreement
cannot prove every individual wildlife/terrain combination. The catalog remains
provisional at that level; identify physical tiles by their printed attributes.
This source gap is a release gate, not a claim of complete component certification.

## Rules covered

- Axial hex placement, all six rotations, unrestricted adjacent terrain placement,
  rigid starters and edge-matched habitat corridors.
- Every wildlife card A–D, including maximum-scoring disjoint elk formations,
  circular elk arcs, salmon branch invalidation, distinct adjacent animals,
  hawk sight lines blocked only by intervening hawks, optimal disjoint hawk/fox
  pair selection, and fox species-pair counting.
- Forced four-of-a-kind wildlife replacements; optional three-of-a-kind once per
  turn; removed wildlife stays out of the bag throughout an unresolved replacement
  sequence. An explicit return action resolves the sequence before a nature wipe.
- Nature awards on occupied keystones, unlimited nature spends within a turn,
  mismatched tile/token selection, arbitrary wildlife replacement and optional
  release of an unwanted wildlife token back into the bag.
- Exactly 20 turns per player. Solo removes the farthest remaining tile and token
  independently, slides the remaining two of each and replenishes on the left;
  discarded solo components stay removed. Final turn needs no replacement.
- Habitat majority bonuses, all first/second-place tie cases, unused nature points
  and nature tie-break followed by shared victory.

## Observation and analysis boundaries

Physical setup starts with empty boards and four unidentified offer slots. It
never fabricates replacement identities. Tile lists describe both habitats and
all printed wildlife; printed duplicate tiles are interchangeable. Digital hidden
tile order and random-generator state are removed before worker dispatch. Sampled
worlds draw a fresh unknown remaining stack from all unobserved tiles, including
unknown excluded identities; they never condition on actual hidden omissions.
Wildlife remaining counts are inferable from the public inventory.

The worker uses the shared bounded-slice lifecycle. Pause/resume retains samples;
state changes reset the search; generation checks reject stale progress. Candidate
hover previews are read-only. Clicking a candidate pins an immutable selection;
only **Record selected action** commits it, even while rankings continue changing.
Undo/redo, local autosave, JSON export/import and atomic history validation are
provided. JSON exports contain the entire session, including digital hidden state.

Search screens habitat placements by matching edges, then evaluates exact wildlife
scores, largest corridors, nature and unfinished-pattern potential. Root UCB
allocation compares up to 24 screened actions using sampled continuations through
the active player's next turn. Terminal evaluations use exact majority scoring
and tie-break winners. The rollout policy and screening are approximations;
strong moves can be screened out. Values and sample standard errors describe this
policy, not calibrated win probabilities or proof of optimal play. One iteration
can exceed a worker slice on a large board; UI work remains on the main thread.

## Reproduction

```
node --test test/cascadia.test.js
node scripts/verify-cascadia.mjs
VERIFY_GAMES=200 node scripts/verify-cascadia.mjs
node scripts/benchmark-cascadia.mjs --games=8 --players=2 --iterations=8 --opponent=tuned
node scripts/benchmark-cascadia.mjs --games=8 --players=2 --ms=100 --opponent=search
CASCADIA_BROWSER_BASE=http://127.0.0.1:8080 node scripts/browser-cascadia.mjs
```

The browser test expects `/cascadia/` and `/standalone-cascadia/` on that server.
It checks actual setup/replacements, previews, no autoplay, persistence, undo/redo,
pause/resume, advice selection stability, invalid imports, phone overflow and the
standalone worker. Screenshots are written to `/tmp/cascadia-*.png`.

Initial correctness run: 16 focused tests and 40 seeded complete games across
1/2/3/4 players, 6,232 transitions and 2,100 end-game comparisons with a separately
written scorer, zero discrepancies. The independent scorer imports no rules or
scoring helpers. Its separate shape-enumeration and union-find methods help detect
implementation mistakes; it shares transcribed card facts and is not external
certification. Timed strength results are recorded separately when run. Search
versus a tuned non-search policy is informative, but is not matched-compute or
human-strength evidence. Search-vs-search uses horizon two versus horizon one;
`--ms` provides the same requested time per decision, with synchronous iteration
overshoot reported in actual elapsed times.

Remaining release work: full individual regular-tile physical audit, real-table
user acceptance, iPad/Safari performance and ergonomics, larger held-out strength
experiments, and source/release review. This is a development implementation.
