# Hive primary source ledger — 2026-10-18

Pinned rules profile: Gen42 classic English Hive, copyright 2010, original eleven
pieces per player. This profile allows a Queen as the first placement.

| Evidence | Verified scope / location |
| --- | --- |
| [Gen42 product page](https://www.gen42.com/product/hive/) | Accessed 2026-10-18. Two players; 22 tactile pieces: each side Q1, B2, G3, S2, A3. Publisher links the English booklet. |
| [Gen42 classic English booklet](https://www.gen42.com/wp-content/uploads/Hive-rules.pdf) | Reopened 2026-10-18; web tool identifies a 12-page image-only PDF, no extracted lines. Existing reviewed plan supplies the rule/page digest below. No successful local download or SHA256 was obtained. |

The reviewed [implementation handoff](../../plans/next-games-2026-10-18/hive.md)
maps printed groups: preparation/object/placing pp1–2; Queen deadline/movement
permission p3; Queen p4; Beetle p5; Grasshopper p6; Spider p7; Ant p8; One Hive
p9; freedom/pass p10; endgame p11. This page map is inherited from the planning
research, not newly verified from local rendered pixels in this implementation.

The web screenshot tool returned only textual page references rather than pixels.
Coordinator's embedded PDF viewer likewise displayed a blank gray surface.
An ordinary local publisher PDF download was refused by sandbox networking;
its required escalation was subsequently interrupted. No protected publisher
assets have been saved in the repository, and no alternate download was used.

## Geometry acceptance boundary

Ground sliding uses an empty destination and exactly one occupied common flank
after lifting. Two occupied flanks close a gate; zero breaks continuous contact.
The Beetle predicate compares stationary flank heights with the greater of source
support and destination support after lifting; both taller flanks block the edge.
Ground-to-ground Beetles retain the ground continuous-contact requirement.

These predicates follow the reviewed handoff and have independently handcomputed
coordinate fixtures, plus a separate graph/edge oracle. Fixtures include ascent,
stack traversal, descent, two taller blockers, one clear flank and four Beetles
above a base tile. The tests are mathematical/repository evidence, not a claim
that a complete matching physical diagram audit has occurred.

**Remaining gate:** obtain readable primary Beetle and freedom-to-move diagrams,
record their coordinates/expected transitions and a verified PDF hash/page map.
No separately authenticated publisher FAQ resolving every elevated case has
been located. Community implementations must not silently substitute a different
opening profile or elevated movement rule.

Classic cyclic stalemate is represented by explicit player draw agreement. Search
ancestor repetition is merely a draw-like cutoff estimate. No chess-style
threefold or arbitrary ply-limit game draw is invented.
