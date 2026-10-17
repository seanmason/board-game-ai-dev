# Patchwork original base game

> Retained development report: sections describe the work and evidence at their recorded stages. Start with the [current patchwork overview](games/patchwork/README.md) for present behavior and remaining gates. Historical counts and results were not rerun for the documentation migration.

`/patchwork/` is a two-player physical-table companion with continuous public-position analysis. Digital games use the same engine. Every move needs an explicit click; there is no autoplay. Original 33-patch base game only, with an explicit choice of original or corrected time board. No expansions, Express, Halloween rebalanced tiles, anniversary Automa, or 5×5 promo.

## Rules and component evidence

Primary rules and edition sources:

- Publisher game, official component count, FAQ and downloads: https://www.lookout-spiele.de/en/games/patchwork.html
- Original English rulebook: https://www.lookout-spiele.de/upload/en_patchwork.html_Rules_Patchwork_EN.pdf
- Publisher's correction sticker: https://www.lookout-spiele.de/upload/en_patchwork.html_UpdateSticker_Patchwork_De-EN.pdf

The initial circle has 33 distinct regular patches. Neutral begins immediately clockwise after the 1×2 patch. Physical setup requires all 33 actual IDs in clockwise order after neutral, ending with that domino (#1); it does not substitute a generated circle. IDs are local references, identified by geometric shape and all three printed values. Digital mode shuffles the other 32 with a seeded generator and puts the domino last.

Track indices count the starting space as 0 and finish as 53. Income occurs at 5, 11, 17, 23, 29, 35, 41, 47 and 53. The original board's leather spaces are 20, 26, 32, 44 and 50. The corrected board moves the original space-20 leather to 38, yielding 26, 32, 38, 44 and 50. The publisher FAQ explicitly explains this change; the rulebook setup illustration and correction sticker are the primary visual evidence. The user chooses which board is physically present. These numbers also agree with the old track in the research source and the firsthand board count reported at https://boardgamegeek.com/thread/3530438/patchwork-revised-edition-info .

The 33 functional shape/cost/time/income records were transcribed from Mikael Zayenz Lagerkvist's research implementation, pinned at commit `53fc6e7ed2acad800b6ac6a7c5c122f13270dbb4`, `code/src/patchwork/tiles.cpp`:
https://github.com/zayenz/cp-mod-ref-2019-patchwork
https://zayenz.se/blog/post/patchwork-modref2019-paper/
The paper motivates considering placement consequences rather than shape area alone. Our JavaScript rules and search are original implementations; we do not incorporate its C++/Gecode code.

Visual component cross-checks:

- Full physical component photograph, all 33 laid out separately: https://i.blogs.es/fd8009/patwchork/1366_2000.jpg (1200×604). Retrieved through the Xataka image listing. All 33 geometric shapes, button costs, time costs and income counts were visually compared by the implementation author and a separate audit agent, and exposed a genuine error in the research source: its 6-button / 5-time / 2-income patch was an L triomino, but the physical component is a full 2×2 square. Local #4 is corrected to the square. The corrected catalog totals 166 regular squares. Some 10-button cost labels are small; this is a manual photographic check, not certified publisher machine-readable data.
- Independent detailed physical component photograph confirms #9 (4 buttons, 2 time, 1 income) and #24 (3 buttons, 6 time, 2 income): https://boardgamecomponents.wordpress.com/wp-content/uploads/2017/01/dsc_0539.jpg ; context https://boardgamecomponents.wordpress.com/2017/01/16/patchwork/ .
- Publisher photo explicitly confirms the large crosses #27 (0 buttons, 3 time, 1 income) and #33 (1 button, 4 time, 1 income): https://www.lookout-spiele.de/upload/en_patchwork.html_GalleryImage_7.jpg . The FAQ confirms the zero-cost cross is intentional.

A second complete implementation was compared by cost, time, income and shape equivalence under every rotation/reflection: NicoZeitz/Studienarbeit at `68fa707bdc2bc7c695f9a9c7dd133a649a30ddd3`, `code/patchwork/patchwork-core/src/patch/patch_manager.rs` (https://github.com/NicoZeitz/Studienarbeit). It independently encodes the square correctly. The other 31 shapes match the research source. Its remaining disagreement is the 5-button / 3-time / 1-income blue H: it incorrectly encodes an 11-square 3/5/3 shape, whereas the research source and physical photograph show the 8-square 2/4/2 shape retained as local #28. The two complete sources therefore disagree; photographic evidence resolves both discrepancies. An independent aggregate count of 166 regular squares also appears in https://flukegames.wordpress.com/2016/07/23/board-games-are-toally-math-patchwork/ . No implementation was treated as authoritative solely because it is a research project.

No publisher artwork, fabric textures, labels, photographs or illustrations are bundled. The UI draws original solid-color grid geometry. The data is functional component facts. All 33 orientation sets are checked against a separately written coordinate transformation.

## Engine and interface

The pure engine returns new JSON-serializable states. The ring's first three elements are purchasable; after purchase it rotates to the chosen patch's successor, preserving skipped patches. Purchase requires both money and a complete legal placement. A patch may rotate and reflect, cannot overlap, and cannot extend outside the 9×9 quilt.

The trailing time token acts. An arriving tied token remains on top and acts again. Purchases place the regular patch and add its income before time movement; every income event landed on or crossed uses the resulting income. Advance pays only actual spaces to the capped end. An available leather marker is removed on first crossing and becomes an explicit placement phase owned by that mover; multiple claims resolve in track order before any next turn. A full quilt cannot accept more leather, so those claimed markers are recorded as discarded. A newly completed 7×7 immediately claims the unique 7-point bonus, including if completed with leather. Final ties favor the first player to reach 53.

Physical controls support shape diagrams, sequential circle entry/removal, pasted actual orders, rotate/flip, hover/tap previews, explicit placement confirmation, advances and earned leather. Analysis hover changes only the preview. Candidate buttons carry stable serialized actions, so worker reranking cannot silently change the move a clicked button represents. Both quilts, buttons, income, circle, time events and current scores are public. The shared worker gets the actual full public position; there is no hidden-world sampling.

Shared session validation is transactional across the entire history. Import rejects malformed inventories, placements, income, impossible minimum purchased time, future/duplicate leather claims or discards, track edition changes, inconsistent bonus/end states, and invalid timeline indices. Snapshot undo/redo, timeline navigation, local autosave and JSON export/import are available. Historical transitions are not replay-certified; validation is a structural and necessary-reachability check. Correcting a past move branches the timeline and discards the later redo branch.

## Search and interpretation

The search is incremental adversarial alpha-beta with iterative deepening. It checks the actual player to act at each node, including consecutive moves and leather phases. Each patch's legal placements are enumerated; a contact/packing filter retains a small beam. Packing considers trapped empty regions, exposed perimeter, corner compactness and progress toward the 7×7 bonus. Evaluation combines current score difference, remaining income, expected coverage capacity, liquidity and remaining time. Candidate values are shown only from a fully completed common depth; unfinished deeper root searches do not mix evaluation horizons.

Each worker slice can yield between individual DFS nodes. Pause/resume retains the current DFS stack, completed depth values and node count. Recording a move, undo/redo, import, refresh or new game starts a new position search; child-tree reuse and persistence across reload are not implemented. Iterative deepening has no fixed depth cap in the browser. If the current beam is searched to terminal outcomes, the beam widens and searches again; only a terminal search covering every legal placement stops the worker. Widening retains the accumulated node count, while restarting values at a common depth for the larger candidate set.

Values are heuristic estimates of score difference, not win probabilities, calibrated confidence, solved full-game values or human Elo. At normal thinking times the placement filter excludes legal moves, and deeper search may overfit that filter and its evaluation. No strong-play claim is established by implementation completeness.

## Reproduction and evidence

```
node --test test/patchwork.test.js
node scripts/verify-patchwork.mjs --games=120
node scripts/audit-patchwork-catalog.mjs
node scripts/benchmark-patchwork.mjs --games=16 --nodes=256 --opponent=tuned
node scripts/benchmark-patchwork.mjs --games=24 --ms=40 --opponent=search --seed=910001 --out=benchmarks/results/patchwork-heldout-search-40ms.json
PATCHWORK_URL=http://127.0.0.1:8080/patchwork/ node scripts/browser-patchwork.mjs
```

The verification run completed 120 seeded full games and 5,250 transitions across both editions with zero discrepancies against a separately written transition oracle. It independently reconstructs patch transformations from factual shape rows, but shares the component catalog. This is useful differential evidence, not an independent publisher certification. Nineteen focused tests cover setup, all shape symmetries, neutral wrap/skips, nonalternating/tied turns, new income timing, purchase legality, overlap/bounds, multiple leather claims, bonus scoring, end caps/ties, atomic imports and incremental search.

After correcting the research catalog, the deterministic two-game smoke against a tuned resource/tempo heuristic used 16 search nodes per move, reversed seats on the same ring, and split wins 1–1 (mean score difference −2). Its 95% Wilson win-rate interval is roughly 9–91%; it is only an execution smoke, not strength evidence. Replayable details are in `benchmarks/results/patchwork-smoke-nodes16.json`. The harness supports paired seed/seat games, actual search opponents at matched elapsed budgets (including candidate generation), timing/node telemetry, score differences, Wilson intervals and complete action traces. The width-1 search opponent and width-2 main search share placement/evaluation machinery, so their comparison does not establish independent-opponent strength. A corrected-catalog pilot used four games (two distinct rings, each with seats reversed) against the width-1 adversarial search at 250 ms per decision. Main search won 3/4, with mean score difference +8.5; the illustrative 95% Wilson interval is approximately 30–95%, and does not adjust for correlation within pairs. Mean measured decision time was 245.38 ms for main search and 244.73 ms for the opponent; maximum times were 254.71 and 251.85 ms, with maximum budget overruns of 4.71 and 1.85 ms. Some fully solved late positions finished early. Full traces, node counts and timing summaries are in `benchmarks/results/patchwork-heldout-search-250ms.json`. The tournament ran sequentially relative to this task's other tournaments; unrelated shared-host workloads were outside our control. These four games do not establish a search advantage, budget scaling, independent-opponent strength, or human-level strength. Broader budget-scaling and independent-opponent tournaments remain pending.

The browser script exercises real order entry/edition selection, rotate/flip/tap preview and explicit recording, undo/redo/autosave, worker pause/resume, malformed import atomicity, escaped imported labels, JSON round-trip, earned leather, phone overflow and secondary digital no-autoplay. Local execution was blocked by an absent Chromium executable and truncated browser installation downloads; hosted execution is a pending integration gate. Physical-table user acceptance, iPad Safari ergonomics and independent-opponent strength remain release gates.

Runtime dependencies for standalone packaging: the seven files in `patchwork/` and `shared/session.js`, `shared/search-worker.js`. No build step or application runtime package is required.
