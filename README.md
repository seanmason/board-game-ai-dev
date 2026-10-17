# Tabletop Observatory — Board Game AI

A browser-native strategy-game companion and analysis workbench. Games: **Azul** and **Pentago** (in development).

**Primary workflows:** enter moves and factory refills from a real physical board, or analyze candidate actions and continuations in a KataGo-inspired interface. Full digital play is also supported as an experimental secondary workflow.

**Status:** Development prototype, not yet publicly released. Rules and AI performance are being validated. Development takes place in this repository, currently public for previews; released, source-available standalone games will be published separately at [board-game-ai](https://github.com/seanmason/board-game-ai).

## Start locally

No dependencies or build step:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080/. The app uses native JavaScript modules and Web Workers, so serve over HTTP rather than opening `index.html` as a file.

## Use with a physical game

1. Select **Physical board** and 2–4 players, then start a session.
2. Choose a tile color and tap factory slots to record the **actual observed** tiles. Number keys 1–5 select colors; Erase clears a slot. Confirm when the entire round has been entered.
3. Choose a source/color tile group in the factory offer, then click a legal pattern row (or the floor) on the current player's board. Repeat as real players move.
4. MCTS starts automatically in parallel browser workers. Rankings, simulated win estimates, and score projections update continuously. **Hover over a candidate** to temporarily highlight its source tiles and destination; click to pin a preview. No hover changes the recorded state.
5. **Pause analysis** to stop using CPU while retaining each worker’s MCTS tree, accumulated visits, and results in memory. **Resume analysis** to continue the same search; its simulation count should increase from the previous value.
6. Use undo/redo, timeline navigation, and export/import to preserve and correct observations. Analysis never commits a suggested move automatically in physical mode.

**Digital gameplay:** switch to Digital game and start a new session. Factories are drawn in the browser. Each seat can be Human or AI. **AI players never move automatically**: MCTS searches indefinitely while that position is displayed; click **Play Best Move** on an AI turn to use its current highest-visit candidate. Wait for at least one result before playing.

## Technical notes

- `src/azul.js`: fully serializable state, rules, inventory, legal action and scoring transitions.
- `src/mcts.js`: independent UCT MCTS with rollout heuristic and per-player statistics.
- `src/ai-worker.js`: cancelable batch-based search in module Web Workers.
- `src/app.js`: observation entry, digital game, state history, and position analysis.
- `styles.css`: original, responsive tiles and UI. No game art is bundled.
- `test/`: Node's built-in test runner.

```sh
npm test
npm run check
```

### Current limitations

The search tree models deterministic draft actions in the **current** round and samples future random refills in rollouts. **Pause/resume retains the exact tree and playout statistics as long as this browser tab remains alive.** A real drafting move can reuse the portion of each worker's tree that actually explored that move. All irrelevant alternatives are discarded, so only **conditional** playouts remain. A newly observed random factory refill, unexpanded move, undo/redo, changed worker count or method, page reload, or browser-tab eviction starts a fresh search. Full-tree persistence across refresh is not implemented. It also does not yet apply a learned value function. Its win estimates are policy-dependent and should not be read as calibrated probabilities. Manual late-game position editing, gray-wall variant, camera recognition, automatic worker throttling and native Rust/WASM optimization are roadmap work. Production release, licensing review, and stronger cross-browser testing are release gates.

See [architecture specification](docs/ARCHITECTURE.md) for intended long-run components and acceptance criteria. Official game rules: [Next Move Games](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf).

## Rule validation and AI benchmarks

The 10,000-game differential validator compares every transition, score, tile inventory, legal move and final result against a separately written Azul model. It is an independent implementation **within this repository**, not an externally certified rules engine.

```sh
npm run verify:gameplay
VERIFY_GAMES=200 npm run verify:gameplay
npm run benchmark:ai -- --games=24 --playouts=100 --players=2 --opponent=heuristic
npm run benchmark:ai -- --games=24 --playouts=100 --players=4 --opponent=random
```

The tournament rotates the MCTS player through seats, uses reproducible random seeds, and reports win-share estimates, scores, playout throughput and timing. Small sample sizes and rollout-policy biases mean results are exploratory. No real physical game transcripts have yet been supplied for external confirmation.

## Search method

The analysis panel defaults to **Guided MCTS**: heuristic-ranked progressive
widening, continuous multiplayer relative-score utility and improved Azul
rollouts. Switch to **UCT baseline** to compare with the original search.
Changing methods starts a new analysis; pause and resume still preserve the
current tree. The candidate panel also reports the number of legal moves
examined so far, since progressive widening deliberately starts with a subset. No AI moves automatically.

Use `npm run benchmark:search` for a same-machine throughput comparison.
Use `npm run benchmark:ai -- --games=48 --playouts=256 --players=4 --variant=guided-informed --seed=913731`
for complete-game strength experiments. The baseline remains available via
`--variant=baseline`.

See [search research results](docs/SEARCH_RESEARCH.md).


## Analysis reuse and opponent evaluation

After a recorded drafting move, the analysis panel displays **Retained N simulations**
if some workers already explored that exact child of the current tree.
The count is deliberately smaller than the previous root's total: all
simulations of other candidate moves are irrelevant to the observed action.
Unvisited actions start fresh. Future random draws are never used for
subtree matching. Pause/resume preserves retained conditional visits.

```sh
npm run benchmark:reuse
npm run benchmark:ai -- --games=24 --playouts=128 --players=3 --opponent=mixed
npm run benchmark:ai -- --games=24 --playouts=128 --players=4 --opponent=stochastic
npm run benchmark:ai -- --games=12 --playouts=64 --players=2 --opponent=legacy-uct
```

Opponent baselines include greedy, informed, stochastic, floor-averse,
denial-oriented, mixed, random, and original-UCT search. They are
synthetic strategy probes—not human playing-strength measurements. See
[tree-reuse and opponent testing](docs/REUSE_AND_OPPONENTS.md).


## Pentago — second game

The **Pentago** prototype is separately deployable at `/pentago/`.
When the Pentago feature branch is published by GitHub Pages, its
development preview is:

https://seanmason.github.io/board-game-ai-dev/pentago/

Its printed-rule implementation covers the 6×6 rotating board, immediate
wins from placement (without twisting), optional skipping while a neutral
quadrant exists, opponent wins and simultaneous-line draws. It supports
physical-game entry, manual digital AI turns, continuous MCTS, placement
heatmaps, candidate highlights, undo/redo, local autosave and import/export.
The default recommendation uses a **stable tactical heuristic**, while the
analysis selector can display the **MCTS most-visited move** instead, without
resetting accumulated simulations. This distinction matters because short-budget
MCTS performed poorly against some greedy tactical opponents.
The engine and browser assets have no runtime package dependencies.

```sh
npm run verify:pentago
npm run benchmark:pentago -- --games=24 --playouts=32 --opponent=greedy
```

See [Pentago architecture and testing requirements](docs/PENTAGO_ARCHITECTURE.md).

See [Pentago validation and benchmarks](docs/PENTAGO_VALIDATION.md) for testing evidence and limitations.

## Platform foundations and next game

**Splendor** is the selected next game. The pre-expansion
[platform review](docs/PLATFORM_REVIEW.md) records the shared contracts,
remaining gaps and its implementation checklist.

Azul and Pentago share worker lifecycle and session validation under `shared/`;
their rules, search strategies and views remain independent. Existing saved
sessions keep their v1 format. To prepare static files without publishing:

```sh
npm run stage:preview
npm run package:game -- azul /tmp/azul-site
npm run package:game -- pentago /tmp/pentago-site
```

Each standalone output has its own `index.html` and all runtime dependencies.
Serve that directory over HTTP. The development preview can also include the
experimental Wingspan directory when present on its draft branch; this is not
release approval. CI tests the staged preview rather than relying on files that
only exist in the development checkout.

## Splendor base-game companion (development)

`/splendor/` contains the 2–4 player physical companion and digital implementation.
Enter the actual market/nobles, record moves explicitly, and supply replacement
cards as they appear. Private reservations may remain unknown. Continuous
hidden-world analysis supports pause/resume and never commits moves automatically.

See [Splendor rules, catalog provenance, tests and limitations](docs/SPLENDOR.md).
Run `npm run verify:splendor` or build a self-contained directory with
`npm run package:game -- splendor /tmp/splendor-site`.
