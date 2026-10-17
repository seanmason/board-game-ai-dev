# Five-game independent audit

> Retained investigation/integration record. Its dated plans and verification apply to the recorded work, not automatically to later revisions. Start with the [game directory](games/INDEX.md) or [current platform contracts](platform/README.md).

Audit started 2026-10-17. This document records fixtures chosen from publisher
rules before examining the new engines. It is an acceptance checklist, not a
claim that implementation or catalogue completeness has been established.

## Evidence and edition boundaries

| Game | Primary evidence read | Required boundary |
| --- | --- | --- |
| 7 Wonders Duel | [Repos US rules](https://cdn.svc.asmodee.net/production-rprod/storage/downloads/games/7wonders-duel/en/7du-rules-us-15990558193s5I6.pdf), pp. 6–20 | Base game only; hidden setup removals and unrevealed cards remain unknown |
| Carcassonne | [Hans im Glück game page](https://www.hans-im-glueck.de/en/game/carcassonne/), [core rules](https://www.hans-im-glueck.de/wp-content/uploads/2024/11/Carcassonne-v3_Rulesheet_EN_web.pdf), [farmer supplement](https://www.hans-im-glueck.de/wp-content/uploads/2024/11/Carcassonne-v3_Supplement_EN_web.pdf) | 72 core tiles including start, farmers; no River or Abbot |
| Cascadia | [AEG base rules](https://www.alderac.com/wp-content/uploads/2025/04/Cascadia_BaseGame_Rulebook_Optimized.pdf), visually read pp. 3–14 | Standard 2–4 players; all base A–D wildlife cards. Solo only if explicitly implemented |
| Patchwork | [Lookout game/FAQ](https://www.lookout-spiele.de/en/games/patchwork.html), [current rule text](https://www.lookout-spiele.de/upload/en_patchworkanniversary.html_PW10_Rules_EN_web.pdf), [official correction sticker](https://www.lookout-spiele.de/upload/en_patchwork.html_UpdateSticker_Patchwork_De-EN.pdf) | 33 regular patches; select original/corrected first-leather track to match physical board |
| Kingdomino | [original ©2016 EU rules](https://blueorangegames.eu/wp-content/uploads/2023/04/Kingdomino-Rules-EN.pdf), [US second-edition rules](https://www.blueorangegames.com/webroot/img/games/rules/cfa0f38157341a002eab1100aab478ea-Kingdomino-Rules-US-2nd-Edition.pdf) | Original 5×5 default; US second edition must be an explicit choice |

The university Cascadia assignment is useful as a transcription lead, not as
authority for changed setup or hidden-information rules. A catalogue agreeing
with its source CSV only establishes transcription agreement. Independent
coverage requires checking physical component counts, identities, printed
geometry, costs/icons, and topology against another source or component images.

## Preimplementation fixtures

### 7 Wonders Duel

- D1: opponent brown production two stone; buying three costs 12. Opponent yellow/wonder production must not increase price.
- D2: fixed two-coin cost plus bought glass/papyrus costs seven in the publisher example; Economy transfers five, not seven.
- D3: test flexible production and Architecture/Masonry rebates against exhaustive resource assignments; no resource spending persists.
- D4: removing a lower card reveals newly accessible hidden cards before replay; replay on the last age card expires.
- D5: seventh built wonder removes the eighth. Mausoleum cannot use setup-removed cards. Great Library observes only its actual three-token draw.
- D6: cross military penalties once each, cap loss at treasury, end immediately at capital; Strategy affects future red cards only.
- D7: sixth distinct science symbol, including Law, ends immediately; a duplicate grants a progress choice.
- D8: weaker military chooses next-age starter; neutral pawn gives that choice to last actor. Civilian tie uses blue-card points.
- D9: Shipowners Guild uses combined brown+grey in one city, not independent color maxima.

### Carcassonne

- C1: merged road/city occupies several segments of one tile: count that tile once. Junction arms remain separate roads.
- C2: a tile closes an unoccupied feature; claim it before scoring and recover that meeple immediately. A meeple returned during scoring cannot fund placement earlier that turn.
- C3: merge occupied features legally, then award full points to every tied majority; minority gets zero.
- C4: completed three-tile city plus shield scores eight; incomplete five-tile city plus three shields scores eight at game end.
- C5: completing multiple neighboring monasteries scores each; incomplete monastery with three neighbors scores four.
- C6: road divides fields; distinct city segments may or may not divide them. Validate half-edge field joins through every rotation against tile artwork.
- C7: field touching one complete city in several places scores three, not once per contact; incomplete city contributes zero. Tied farmers each receive full field points and never return midgame.
- C8: no legal placement in any rotation discards the observed tile and requires another actual observation.

### Cascadia

- A1: setup uses 20 habitat tiles per player plus three; unused tiles remain hidden. Wildlife bag contains 20 of each species.
- A2: four matching tokens forces replacement; optional triple replacement is once per turn. Set-aside tokens cannot reappear in that same replacement, then return to bag.
- A3: each nature token buys independent tile/token choice OR selected-token replacement. Multiple tokens may be spent that turn, including one on each benefit.
- A4: a drafted token may occupy an older empty matching tile or be returned; only occupied keystones earn nature. Habitat edges need not match.
- A5: corridor counts connected tiles, not half-hex area. Split terrain joins only through corresponding edges.
- A6: two-player habitat ties give one each. In 3–4 players split tied available bonuses, rounding down: two tied first get two each; three/four tied first get one each; tied second get zero.
- A7: bear groups, elk line/shape/herd/ring, isolated/visible hawks, nonbranching salmon, fox species/pairs require separately hand-scored A–D fixtures. Nature remainder scores one each; total tie uses remaining nature then shared victory.

### Patchwork

- P1: equal time positions give next turn to the token on top, including newly landing token; earliest finish wins score ties.
- P2: only next three circular patches are selectable; neutral marker advances past the purchased patch. Check deletion/wrap at final one/two patches.
- P3: purchase requires affordable cost and a legal rotation/reflection wholly inside 9×9 without overlap; zero-cost, three-time patch is valid.
- P4: place purchased patch before resolving crossed income. Multiple crossed income events each use the new total.
- P5: chronological crossed leather events enqueue immediate individual placements; claimed leather cannot be claimed again. Both printed first-leather tracks are legitimate per FAQ.
- P6: advancement stops at final space; buttons use actual distance. First completed 7×7 region earns the sole seven-point bonus, including completion by leather.
- P7: final example: 14 buttons + seven bonus − five holes × two = 11. Income icons alone are not final points.
- P8: independently reconcile all 33 shapes, button costs, times, and income against component images; shape area alone is insufficient.

### Kingdomino

- K1: original setup: 2p uses 24 dominoes/four per line/two kings each; 3p uses 36/three/one; 4p uses 48/four/one. Every player places 12 dominoes.
- K2: US second-edition 3p uses 48/four and discards the unchosen domino each round; edition survives session round trip.
- K3: current claimed numerical order determines placement then next claim, independently for both kings. Final line places without a further claim.
- K4: placement can extend on either side of castle within a floating bounding box ≤5×5. One matching orthogonal contact suffices; other contacts may mismatch. Castle is wild, not terrain or a crown.
- K5: discard is legal only when every orientation/position fails. Adjacent differing domino halves are not a terrain region.
- K6: seven connected forests with three crowns score 21; nine lakes without crowns score zero. Diagonal connections do not join regions.
- K7: original tie compares score, largest territory, total crowns; US second edition omits crown comparison. Further tie shares victory.

## Platform fixtures independent of game heuristics

- S1: capture the browser state, hover/select a recommendation, pause/resume,
  and wait for several worker reports. Recorded board/history must remain byte
  identical until an explicit user action commits a move or observation.
- S2: physical initialization, draw/refill, hidden reveal, and random effects
  must pause for actual observation. A deterministic or sampled stand-in must
  never become the recorded physical result.
- S3: construct two digital states differing only in hidden deck order or
  inaccessible setup exclusions. Public projections and equal-seed candidate
  distributions must match. Assert worker payloads omit hidden order, hidden
  removals and secret RNG state; test UI labels/DOM/export separately.
- S4: pause retains exact search tree and RNG; resume increases visits. A stale
  report after a newer generation cannot replace visible results. A move can
  reuse only compatible conditional evidence; newly observed chance results
  must invalidate incompatible worlds.
- S5: every history snapshot and all game options are validated before live
  replacement. Malformed earlier history, fractional cursor, wrong mode/player
  count, invalid identity counts or impossible board topology reject atomically.
- S6: hand-scored fixtures use literal expected results, not engine scoring or
  catalogue helpers as their oracle. Legal-action generators must have a
  separate exhaustive reference for constrained fixture positions. Random
  self-play and inventory checks supplement these tests but cannot establish
  rules or dataset correctness by themselves.

## Review status

Initial engine reads covered all five rules modules and Cascadia scoring. A
confirmed Duel Age III blocker was reported: its special two-card middle row
was at x=1,5, making upper card index8 accessible at setup. The implementer
changed it to x=3,7. Independent recheck now returns initially accessible
indices [18,19], with middle cards covering [5,6] and [7,8]. A regression fixture
records these literal expectations.

Cascadia's 85-tile catalogue independently matches the firsthand physical
inventory tables in [this inventory count](https://www.reddit.com/r/boardgames/comments/1b8qk3n/some_stats_about_cascadia/):
all animal/habitat, keystone/habitat and animal co-occurrence matrix entries,
plus every terrain-pair count. This is corroboration rather than a proof of the
individual 85-face multiset. The printed [component photograph](https://media.cdn.kaufland.de/product-images/1024x1024/13df45d32835e2a127d4777a55b0b19d.jpg)
was independently checked against all five starters: all fifteen species sets,
terrain pairs, relative positions, and six-edge orientations agree. Literal
expectations are in `test/batch-audit-independent.test.js`.

Magnified starter photographs exposed a coordinate-convention correction: the
CSV begins at the upper-right edge, while the rendered/scored directions begin
at the right edge. The implementer rotated side strings one position; all ten
split starter hexes now match independently read E,SE,SW,W,NW,NE edge literals.

Focused adversarial import review found and reproduced these additional bugs:

| Game | Confirmed defect | Recheck |
| --- | --- | --- |
| Carcassonne | Completed nonfield feature could retain a meeple in draw phase and score again; exhausted draw could remain nonterminal | Validator tightened; occupied-completed-city regression passes |
| Carcassonne | Imported event type/points allowed HTML and were interpolated unescaped into the score explanation | Enum/numeric validation plus escaping added; malicious type and points regressions reject |
| Patchwork | Future leather could be discarded at time zero with empty quilts; regular patches could be owned at time zero | Discard/full-quilt/crossing and purchased-time bounds added; both regressions reject |
| Kingdomino | Geometrically attached domino with no matching-terrain/castle route was accepted | Domino-level matching-contact graph added; disconnected forest regression rejects |
| Patchwork | Worker stopped adding nodes after fixed depth9 while shared scheduling continued | Unbounded deepening/widening added; full legal terminal-tree completion pauses the runtime |
| Cascadia | Independent starter rotations, empty-string wildlife, and missing digital stack/RNG passed validation | Rigid starter geometry, species enum, digital stack/RNG requirements added; regressions reject |
| Cascadia | Scoring-card array `['A']` passed a coercing string-membership check and scored as another card | Strict string enum requested and independently regression-tested |
| Duel | Covered cards could be revealed/removed prematurely; effect phase accepted before drafting; inherited catalogue key `constructor` accepted | Reveal/removal chronology, age/draft prerequisites and own catalogue membership tightened; regressions reject |

Patchwork recommendation buttons now carry serialized action identities instead
of resolving changing ranks. Imported histories reject conflicting non-null
time-board editions. These changes were source-reviewed; no browser automation
was performed by this reviewer.

The full Patchwork component photograph was independently visually reviewed,
including the larger polyomino outlines. It exposed the missing square in the
research catalogue's striped cost6/time5/income2 patch: it is a solid 2×2
square, not an L triomino. Correcting it raises regular-patch area from165 to166.
The blue H patch has2+4+2=8 squares; an alternate dataset's eleven-square
version contradicts the physical photograph. Literal square/H geometry and
166-area fixtures now pass. The photograph source is linked in the fixture.

Independent hand-built scoring fixtures additionally pass for a closed
Carcassonne city whose seven local segments occupy six tiles with three
shields (18 points), its multiply touching field (three points), and a legal
Patchwork sequence covering same-space top-token turns, newly purchased
income, and two crossed income events.

Run against sibling worktrees before integration with:

```sh
BATCH_AUDIT_WORKTREES=1 node --test test/batch-audit-independent.test.js
```

Latest focused run: twelve tests passed, no skips, against implementation
worktrees. The integrated full suite subsequently passed 274 tests with no skips,
including all twelve independent fixtures. All five games are now integrated; without the environment override
these tests use the integrated game directories. Both hidden-world projection
fixtures establish invariance under changed actual hidden stacks, RNG state,
and unrevealed Duel identities, including equal-seed determinization.

Remaining evidence boundaries: Cascadia's individual85-face multiset has
aggregate physical corroboration rather than a complete independent face
photograph. Kingdomino's complete face facts are corroborated by component
photography, but a second independent source tying every face to its reverse
number was not obtained by this reviewer. Browser behavior, broader import
fuzzing, and real-device responsiveness remain outside this focused audit. No
throughput or strength claim is supported here; heavy tournaments are reserved
for parent coordination.
